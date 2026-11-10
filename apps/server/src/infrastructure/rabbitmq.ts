import amqp, { Channel, ChannelModel, ConfirmChannel, ConsumeMessage, Options } from 'amqplib';
import { config } from '@config';

/**
 * RabbitMQ connection management.
 *
 * - Publishing goes through a **confirm channel**: `publish()` resolves only after the
 *   broker has taken responsibility for the message, so the API never answers 202 for
 *   a batch that was silently lost. When the broker is gone, slow to confirm, or pushing
 *   back (write buffer full), `publish()` rejects with `BrokerUnavailableError` (→ 503).
 * - Each consumer gets **its own channel** with its own prefetch, separate from the
 *   publisher, so a slow consumer can't block publishing and one channel error doesn't
 *   take every worker down.
 * - If the connection or any channel closes unexpectedly, everything is torn down and
 *   rebuilt with exponential backoff: topology, publisher, and every registered consumer.
 */

export class BrokerUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BrokerUnavailableError';
  }
}

export type ConsumeHandler = (msg: ConsumeMessage, channel: Channel) => Promise<void>;

interface ConsumerRegistration {
  queue: string;
  prefetch: number;
  handler: ConsumeHandler;
}

export const PUBLISH_CONFIRM_TIMEOUT_MS = 5_000;
export const RECONNECT_BASE_DELAY_MS = 1_000;
export const RECONNECT_MAX_DELAY_MS = 30_000;

let connection: ChannelModel | null = null;
let adminChannel: Channel | null = null; // topology + queue inspection
let publishChannel: ConfirmChannel | null = null;
let publisherBlocked = false;
let generation = 0; // bumps on every (re)connect so stale close events are ignored
let closing = false;
let reconnectTimer: NodeJS.Timeout | null = null;
let reconnectAttempt = 0;
const consumers: ConsumerRegistration[] = [];

/** Connects, declares the topology and starts any registered consumers. Throws if the first attempt fails. */
export async function connectRabbitMQ(): Promise<void> {
  closing = false;
  await openConnection();
  console.log('✅ [RabbitMQ] Connected and Topology Configured');
}

/** Channel for topology and inspection (checkQueue). Not for publishing or consuming. */
export function getChannel(): Channel {
  if (!adminChannel) throw new Error('RabbitMQ channel not created');
  return adminChannel;
}

export function isRabbitConnected(): boolean {
  return connection !== null && publishChannel !== null;
}

/**
 * Publishes a persistent message and waits for the broker's confirm.
 * Rejects with BrokerUnavailableError if the message may not have been stored.
 */
export function publish(exchange: string, routingKey: string, content: Buffer, options: Options.Publish = {}): Promise<void> {
  const ch = publishChannel;
  if (!ch) return Promise.reject(new BrokerUnavailableError('RabbitMQ is not connected'));
  if (publisherBlocked) return Promise.reject(new BrokerUnavailableError('RabbitMQ is applying backpressure'));

  return new Promise<void>((resolve, reject) => {
    let settled = false;
    const settle = (err?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (err) reject(err);
      else resolve();
    };
    const timer = setTimeout(
      () => settle(new BrokerUnavailableError('Timed out waiting for RabbitMQ to confirm the message')),
      PUBLISH_CONFIRM_TIMEOUT_MS,
    );

    try {
      const accepted = ch.publish(exchange, routingKey, content, { persistent: true, ...options }, (err) =>
        settle(err ? new BrokerUnavailableError('RabbitMQ did not accept the message') : undefined),
      );
      // false = the channel's write buffer is full. This message is still sent, but refuse
      // new ones until 'drain' so memory doesn't grow without bound.
      if (!accepted) publisherBlocked = true;
    } catch {
      settle(new BrokerUnavailableError('RabbitMQ channel is closed'));
    }
  });
}

/**
 * Registers a consumer on its own channel. It is (re)started on every (re)connect.
 * The handler must ack or nack `msg` on the channel it is given.
 */
export async function consume(queue: string, prefetch: number, handler: ConsumeHandler): Promise<void> {
  const registration = { queue, prefetch, handler };
  consumers.push(registration);
  if (connection) await startConsumer(connection, registration, generation);
}

/** Stops reconnecting and closes the connection (shutdown, tests). */
export async function closeRabbitMQ(): Promise<void> {
  closing = true;
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = null;
  const conn = connection;
  resetState();
  consumers.length = 0;
  if (conn) await conn.close().catch(() => undefined);
}

async function openConnection(): Promise<void> {
  const conn = await amqp.connect(config.RABBITMQ_URL);
  const gen = ++generation;
  const lost = (reason: string) => () => handleConnectionLost(gen, reason);

  try {
    conn.on('error', (err: Error) => console.error('❌ [RabbitMQ] Connection error:', err.message));
    conn.on('close', lost('connection closed'));

    const admin = await conn.createChannel();
    admin.on('error', (err: Error) => console.error('❌ [RabbitMQ] Admin channel error:', err.message));
    admin.on('close', lost('admin channel closed'));
    await setupRabbitMQTopology(admin);

    const pub = await conn.createConfirmChannel();
    pub.on('error', (err: Error) => console.error('❌ [RabbitMQ] Publish channel error:', err.message));
    pub.on('close', lost('publish channel closed'));
    pub.on('drain', () => {
      publisherBlocked = false;
    });

    connection = conn;
    adminChannel = admin;
    publishChannel = pub;
    publisherBlocked = false;

    for (const registration of consumers) {
      await startConsumer(conn, registration, gen);
    }
  } catch (error) {
    await conn.close().catch(() => undefined);
    throw error;
  }
}

async function startConsumer(conn: ChannelModel, registration: ConsumerRegistration, gen: number): Promise<void> {
  const ch = await conn.createChannel();
  ch.on('error', (err: Error) => console.error(`❌ [RabbitMQ] ${registration.queue} channel error:`, err.message));
  ch.on('close', () => handleConnectionLost(gen, `${registration.queue} channel closed`));
  await ch.prefetch(registration.prefetch);
  await ch.consume(registration.queue, async (msg) => {
    if (!msg) {
      // The broker cancelled this consumer (e.g. the queue was deleted); rebuild everything.
      handleConnectionLost(gen, `${registration.queue} consumer cancelled`);
      return;
    }
    try {
      await registration.handler(msg, ch);
    } catch (error) {
      // Typically ack/nack on a channel that just closed. The message was not acked, so the
      // broker redelivers it after reconnect.
      console.error(`❌ [RabbitMQ] ${registration.queue} handler failed:`, (error as Error).message);
    }
  });
}

function resetState(): void {
  connection = null;
  adminChannel = null;
  publishChannel = null;
  publisherBlocked = false;
}

function handleConnectionLost(gen: number, reason: string): void {
  if (closing || gen !== generation) return; // shutting down, or an old connection's late event
  generation++; // ignore the other close events from this same connection
  const conn = connection;
  resetState();
  console.error(`❌ [RabbitMQ] Lost connection (${reason}); reconnecting`);
  conn?.close().catch(() => undefined);
  scheduleReconnect();
}

function scheduleReconnect(): void {
  if (closing || reconnectTimer) return;
  const delay = Math.min(RECONNECT_MAX_DELAY_MS, RECONNECT_BASE_DELAY_MS * 2 ** reconnectAttempt);
  const jittered = Math.round(delay * (0.5 + Math.random() / 2));
  reconnectAttempt++;
  reconnectTimer = setTimeout(async () => {
    reconnectTimer = null;
    if (closing) return;
    try {
      await openConnection();
      reconnectAttempt = 0;
      console.log('✅ [RabbitMQ] Reconnected');
    } catch (error) {
      console.error('❌ [RabbitMQ] Reconnect failed:', (error as Error).message);
      scheduleReconnect();
    }
  }, jittered);
}

/** Queues consumed by workers. Each one dead-letters into `<name>_dlq` (see DEAD_LETTER_QUEUES). */
export const WORKER_QUEUES = ['raw_log_queue', 'aggregation_queue', 'anomaly_queue', 'rum_queue'] as const;

/** Where messages go when a worker rejects them (nack without requeue) or they expire after 24 h. */
export const DEAD_LETTER_QUEUES = ['raw_log_dlq', 'aggregation_dlq', 'anomaly_dlq', 'rum_dlq'] as const;

// Declarative Topology Setup (from SRS §9.2)
async function setupRabbitMQTopology(ch: Channel): Promise<void> {
  // 1. Exchanges
  await ch.assertExchange('logs.exchange', 'direct', { durable: true });
  await ch.assertExchange('dlq.exchange', 'direct', { durable: true });
  await ch.assertExchange('ws.fanout', 'fanout', { durable: false });

  // 2. Dead-letter queues. Each one must be bound to dlq.exchange under its own name:
  //    dlq.exchange is a direct exchange, so a dead-lettered message with no matching
  //    binding would be silently discarded.
  for (const dlq of DEAD_LETTER_QUEUES) {
    await ch.assertQueue(dlq, { durable: true });
    await ch.bindQueue(dlq, 'dlq.exchange', dlq);
  }

  // 3. Worker Queues with DLQ Routing
  const qArgs = (dlq: string) => ({
    durable: true,
    deadLetterExchange: 'dlq.exchange',
    deadLetterRoutingKey: dlq,
    messageTtl: 86_400_000, // 24h
  });

  await ch.assertQueue('raw_log_queue', qArgs('raw_log_dlq'));
  await ch.assertQueue('aggregation_queue', qArgs('aggregation_dlq'));
  await ch.assertQueue('anomaly_queue', qArgs('anomaly_dlq'));
  await ch.assertQueue('rum_queue', qArgs('rum_dlq'));

  // 4. Bindings
  await ch.bindQueue('raw_log_queue', 'logs.exchange', 'log.ingest');
  await ch.bindQueue('aggregation_queue', 'logs.exchange', 'log.ingest');
  await ch.bindQueue('anomaly_queue', 'logs.exchange', 'log.ingest');
  await ch.bindQueue('rum_queue', 'logs.exchange', 'rum.ingest');
}
