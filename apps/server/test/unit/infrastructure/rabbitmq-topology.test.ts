import { EventEmitter } from 'node:events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** amqplib channel stand-in: records calls, emits events, keeps publish-confirm callbacks. */
class AmqpChannel extends EventEmitter {
  confirms: Array<(err: Error | null) => void> = [];
  consumers = new Map<string, (msg: unknown) => Promise<void>>();
  writable = true;
  assertExchange = vi.fn(async () => ({}));
  assertQueue = vi.fn(async () => ({}));
  bindQueue = vi.fn(async () => ({}));
  checkQueue = vi.fn(async () => ({}));
  prefetch = vi.fn(async () => undefined);
  cancel = vi.fn(async () => ({}));
  ack = vi.fn();
  nack = vi.fn();
  consume = vi.fn(async (queue: string, fn: (msg: unknown) => Promise<void>) => {
    this.consumers.set(queue, fn);
    return { consumerTag: queue };
  });
  publish = vi.fn((_ex: string, _rk: string, _c: Buffer, _o: unknown, cb: (err: Error | null) => void) => {
    this.confirms.push(cb);
    return this.writable;
  });
}

class AmqpConnection extends EventEmitter {
  channels: AmqpChannel[] = [];
  confirmChannel: AmqpChannel | null = null;
  createChannel = vi.fn(async () => {
    const ch = new AmqpChannel();
    this.channels.push(ch);
    return ch;
  });
  createConfirmChannel = vi.fn(async () => {
    this.confirmChannel = new AmqpChannel();
    return this.confirmChannel;
  });
  close = vi.fn(async () => undefined);
  /** The admin (topology) channel is the first plain channel created. */
  get admin() {
    return this.channels[0];
  }
  consumerChannel(queue: string) {
    return this.channels.find((c) => c.consumers.has(queue))!;
  }
}

const connections: AmqpConnection[] = [];
let failConnects = 0;
const connect = vi.fn(async () => {
  if (failConnects > 0) {
    failConnects--;
    throw new Error('ECONNREFUSED');
  }
  const c = new AmqpConnection();
  connections.push(c);
  return c;
});
vi.mock('amqplib', () => ({ default: { connect: (...a: unknown[]) => connect(...(a as [])) } }));

const rabbit = await import('@infrastructure/rabbitmq');
const { connectRabbitMQ, getChannel, publish, consume, closeRabbitMQ, isRabbitConnected, BrokerUnavailableError, stopConsuming, inFlightMessages } = rabbit;
const latest = () => connections.at(-1)!;

beforeEach(() => {
  connections.length = 0;
  failConnects = 0;
  connect.mockClear();
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(async () => {
  await closeRabbitMQ();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('RabbitMQ topology', () => {
  it('getChannel throws before connect', () => {
    expect(() => getChannel()).toThrow('RabbitMQ channel not created');
  });

  it('declares durable exchanges, queues with DLQ routing and 24h TTL, and bindings', async () => {
    await connectRabbitMQ();
    const admin = latest().admin;
    expect(getChannel()).toBe(admin);
    expect(admin.assertExchange).toHaveBeenCalledWith('logs.exchange', 'direct', { durable: true });
    expect(admin.assertExchange).toHaveBeenCalledWith('dlq.exchange', 'direct', { durable: true });
    for (const q of ['raw_log', 'aggregation', 'anomaly', 'rum']) {
      expect(admin.assertQueue).toHaveBeenCalledWith(`${q}_dlq`, { durable: true });
      expect(admin.assertQueue).toHaveBeenCalledWith(`${q}_queue`, {
        durable: true, deadLetterExchange: 'dlq.exchange', deadLetterRoutingKey: `${q}_dlq`, messageTtl: 86_400_000,
      });
    }
    expect(admin.bindQueue).toHaveBeenCalledWith('raw_log_queue', 'logs.exchange', 'log.ingest');
    expect(admin.bindQueue).toHaveBeenCalledWith('aggregation_queue', 'logs.exchange', 'log.ingest');
    expect(admin.bindQueue).toHaveBeenCalledWith('anomaly_queue', 'logs.exchange', 'log.ingest');
    expect(admin.bindQueue).toHaveBeenCalledWith('rum_queue', 'logs.exchange', 'rum.ingest');
  });

  it('binds every dead-letter queue to dlq.exchange under the routing key its worker queue uses (KI-32)', async () => {
    await connectRabbitMQ();
    const admin = latest().admin;
    for (const q of ['raw_log', 'aggregation', 'anomaly', 'rum']) {
      const workerArgs = (admin.assertQueue.mock.calls as unknown as [string, any][]).find(([name]) => name === `${q}_queue`)![1];
      expect(admin.bindQueue).toHaveBeenCalledWith(workerArgs.deadLetterRoutingKey, workerArgs.deadLetterExchange, workerArgs.deadLetterRoutingKey);
    }
  });

  it('fails the first connect loudly (boot must not continue without a broker)', async () => {
    failConnects = 1;
    await expect(connectRabbitMQ()).rejects.toThrow('ECONNREFUSED');
    expect(isRabbitConnected()).toBe(false);
  });
});

describe('publish with confirms (KI-16)', () => {
  it('resolves only after the broker confirms, and publishes persistently on the confirm channel', async () => {
    await connectRabbitMQ();
    let done = false;
    const p = publish('logs.exchange', 'log.ingest', Buffer.from('{}'), { messageId: 'm1' }).then(() => (done = true));
    const pub = latest().confirmChannel!;
    expect(pub.publish).toHaveBeenCalledWith('logs.exchange', 'log.ingest', expect.any(Buffer), { persistent: true, messageId: 'm1' }, expect.any(Function));
    await Promise.resolve();
    expect(done).toBe(false);
    pub.confirms[0](null);
    await p;
    expect(done).toBe(true);
  });

  it('rejects when the broker nacks the message', async () => {
    await connectRabbitMQ();
    const p = publish('x', 'y', Buffer.from('{}'));
    latest().confirmChannel!.confirms[0](new Error('nack'));
    await expect(p).rejects.toBeInstanceOf(BrokerUnavailableError);
  });

  it('rejects when no confirm arrives in time', async () => {
    await connectRabbitMQ();
    vi.useFakeTimers();
    const p = publish('x', 'y', Buffer.from('{}'));
    const assertion = expect(p).rejects.toThrow('Timed out waiting for RabbitMQ');
    await vi.advanceTimersByTimeAsync(rabbit.PUBLISH_CONFIRM_TIMEOUT_MS + 1);
    await assertion;
  });

  it('rejects immediately when not connected', async () => {
    await expect(publish('x', 'y', Buffer.from('{}'))).rejects.toThrow('RabbitMQ is not connected');
  });

  it('applies backpressure: refuses new messages while the write buffer is full, until drain', async () => {
    await connectRabbitMQ();
    const pub = latest().confirmChannel!;
    pub.writable = false;
    const first = publish('x', 'y', Buffer.from('1'));
    pub.confirms[0](null);
    await first; // the message that filled the buffer is still sent and confirmed
    await expect(publish('x', 'y', Buffer.from('2'))).rejects.toThrow('backpressure');
    pub.writable = true;
    pub.emit('drain');
    const third = publish('x', 'y', Buffer.from('3'));
    pub.confirms[1](null);
    await expect(third).resolves.toBeUndefined();
  });

  it('rejects when the channel throws on publish (already closed)', async () => {
    await connectRabbitMQ();
    latest().confirmChannel!.publish.mockImplementationOnce(() => {
      throw new Error('Channel closed');
    });
    await expect(publish('x', 'y', Buffer.from('{}'))).rejects.toThrow('channel is closed');
  });
});

describe('consumers', () => {
  it('each consumer gets its own channel and prefetch, separate from admin and publisher', async () => {
    await connectRabbitMQ();
    const a = vi.fn(async () => undefined);
    const b = vi.fn(async () => undefined);
    await consume('raw_log_queue', 200, a);
    await consume('rum_queue', 150, b);
    const conn = latest();
    const chA = conn.consumerChannel('raw_log_queue');
    const chB = conn.consumerChannel('rum_queue');
    expect(chA).not.toBe(chB);
    expect(chA).not.toBe(conn.admin);
    expect(chA.prefetch).toHaveBeenCalledWith(200);
    expect(chB.prefetch).toHaveBeenCalledWith(150);
    const msg = { content: Buffer.from('{}') };
    await chA.consumers.get('raw_log_queue')!(msg);
    expect(a).toHaveBeenCalledWith(msg, chA);
  });

  it('a throwing handler does not escape as an unhandled rejection', async () => {
    await connectRabbitMQ();
    await consume('raw_log_queue', 1, async () => {
      throw new Error('Channel closed');
    });
    await expect(latest().consumerChannel('raw_log_queue').consumers.get('raw_log_queue')!({ content: Buffer.from('x') })).resolves.toBeUndefined();
  });

  it('consumers registered before connect start once connected', async () => {
    const handler = vi.fn(async () => undefined);
    await consume('anomaly_queue', 50, handler);
    await connectRabbitMQ();
    expect(latest().consumerChannel('anomaly_queue').prefetch).toHaveBeenCalledWith(50);
  });
});

describe('reconnect (KI-16)', () => {
  beforeEach(() => {
    vi.spyOn(Math, 'random').mockReturnValue(1); // no jitter: delays are exactly base * 2^n
  });

  it('after the connection drops: refuses publishes, then rebuilds topology, publisher and consumers', async () => {
    await connectRabbitMQ();
    const handler = vi.fn(async () => undefined);
    await consume('aggregation_queue', 100, handler);
    vi.useFakeTimers();

    latest().emit('close');
    expect(isRabbitConnected()).toBe(false);
    expect(() => getChannel()).toThrow();
    await expect(publish('x', 'y', Buffer.from('{}'))).rejects.toBeInstanceOf(BrokerUnavailableError);

    await vi.advanceTimersByTimeAsync(rabbit.RECONNECT_BASE_DELAY_MS);
    expect(connections).toHaveLength(2);
    const conn = latest();
    expect(isRabbitConnected()).toBe(true);
    expect(conn.admin.assertExchange).toHaveBeenCalledWith('logs.exchange', 'direct', { durable: true });
    const ch = conn.consumerChannel('aggregation_queue');
    expect(ch.prefetch).toHaveBeenCalledWith(100);
    await ch.consumers.get('aggregation_queue')!({ content: Buffer.from('{}') });
    expect(handler).toHaveBeenCalledWith(expect.anything(), ch);

    const p = publish('x', 'y', Buffer.from('{}'));
    conn.confirmChannel!.confirms[0](null);
    await expect(p).resolves.toBeUndefined();
  });

  it('a single channel closing (e.g. a consumer channel error) also triggers a full reconnect, once', async () => {
    await connectRabbitMQ();
    await consume('rum_queue', 1, vi.fn(async () => undefined));
    vi.useFakeTimers();
    const first = latest();
    first.consumerChannel('rum_queue').emit('close');
    first.emit('close'); // the follow-up close of the same connection must not schedule a second reconnect
    expect(first.close).toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(rabbit.RECONNECT_BASE_DELAY_MS * 4);
    expect(connections).toHaveLength(2);
  });

  it('retries with exponential backoff while the broker stays down', async () => {
    await connectRabbitMQ();
    vi.useFakeTimers();
    failConnects = 2;
    latest().emit('close');
    await vi.advanceTimersByTimeAsync(1_000); // attempt 1 fails
    expect(connect).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1_999); // next is 2 s later
    expect(connect).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1); // attempt 2 fails
    expect(connect).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(4_000); // attempt 3 succeeds
    expect(connect).toHaveBeenCalledTimes(4);
    expect(isRabbitConnected()).toBe(true);
  });

  it('a broker-cancelled consumer triggers a reconnect', async () => {
    await connectRabbitMQ();
    await consume('raw_log_queue', 1, vi.fn(async () => undefined));
    vi.useFakeTimers();
    await latest().consumerChannel('raw_log_queue').consumers.get('raw_log_queue')!(null);
    expect(isRabbitConnected()).toBe(false);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(isRabbitConnected()).toBe(true);
  });

  it('closeRabbitMQ stops reconnecting', async () => {
    await connectRabbitMQ();
    vi.useFakeTimers();
    latest().emit('close');
    await closeRabbitMQ();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(connections).toHaveLength(1);
  });
});

describe('stopConsuming (graceful shutdown, KI-21)', () => {
  it('cancels every consumer and waits for messages still being handled', async () => {
    await connectRabbitMQ();
    let finish!: () => void;
    const handler = vi.fn(() => new Promise<void>((r) => { finish = r; }));
    await consume('raw_log_queue', 10, handler);
    await consume('rum_queue', 10, vi.fn(async () => undefined));
    const ch = latest().consumerChannel('raw_log_queue');
    const delivery = ch.consumers.get('raw_log_queue')!({ content: Buffer.from('{}') });
    expect(inFlightMessages()).toBe(1);

    let stopped = false;
    const stopping = stopConsuming(1000).then((ok) => { stopped = ok; });
    await new Promise((r) => setTimeout(r, 20));
    expect(ch.cancel).toHaveBeenCalledWith('raw_log_queue');
    expect(latest().consumerChannel('rum_queue').cancel).toHaveBeenCalledWith('rum_queue');
    expect(stopped).toBe(false); // still waiting for the in-flight message

    finish();
    await delivery;
    await stopping;
    expect(stopped).toBe(true);
    expect(inFlightMessages()).toBe(0);
  });

  it('reports false if a message is still in flight at the deadline', async () => {
    await connectRabbitMQ();
    await consume('raw_log_queue', 1, () => new Promise<void>(() => undefined));
    void latest().consumerChannel('raw_log_queue').consumers.get('raw_log_queue')!({ content: Buffer.from('{}') });
    expect(await stopConsuming(30)).toBe(false);
  });

  it('a reconnect after stopConsuming does not start consuming again', async () => {
    await connectRabbitMQ();
    await consume('aggregation_queue', 1, vi.fn(async () => undefined));
    await stopConsuming(100);
    vi.spyOn(Math, 'random').mockReturnValue(1);
    vi.useFakeTimers();
    latest().emit('close');
    await vi.advanceTimersByTimeAsync(rabbit.RECONNECT_BASE_DELAY_MS);
    expect(connections).toHaveLength(2);
    expect(latest().channels.some((c) => c.consumers.has('aggregation_queue'))).toBe(false);
  });
});
