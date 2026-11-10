import { describe, expect, it, vi } from 'vitest';
import { FakeChannel } from '../../helpers/fakes';

const channel = new FakeChannel();
vi.mock('amqplib', () => ({
  default: { connect: vi.fn(async () => ({ createChannel: async () => channel })) },
}));

const { connectRabbitMQ, getChannel } = await import('@infrastructure/rabbitmq');

describe('RabbitMQ topology', () => {
  it('getChannel throws before connect', () => {
    expect(() => getChannel()).toThrow('RabbitMQ channel not created');
  });

  it('declares durable exchanges, queues with DLQ routing and 24h TTL, and bindings', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    await connectRabbitMQ();
    expect(getChannel()).toBe(channel);
    expect(channel.assertExchange).toHaveBeenCalledWith('logs.exchange', 'direct', { durable: true });
    expect(channel.assertExchange).toHaveBeenCalledWith('dlq.exchange', 'direct', { durable: true });
    for (const q of ['raw_log', 'aggregation', 'anomaly', 'rum']) {
      expect(channel.assertQueue).toHaveBeenCalledWith(`${q}_dlq`, { durable: true });
      expect(channel.assertQueue).toHaveBeenCalledWith(`${q}_queue`, {
        durable: true, deadLetterExchange: 'dlq.exchange', deadLetterRoutingKey: `${q}_dlq`, messageTtl: 86_400_000,
      });
    }
    expect(channel.bindQueue).toHaveBeenCalledWith('raw_log_queue', 'logs.exchange', 'log.ingest');
    expect(channel.bindQueue).toHaveBeenCalledWith('aggregation_queue', 'logs.exchange', 'log.ingest');
    expect(channel.bindQueue).toHaveBeenCalledWith('anomaly_queue', 'logs.exchange', 'log.ingest');
    expect(channel.bindQueue).toHaveBeenCalledWith('rum_queue', 'logs.exchange', 'rum.ingest');
  });

  it('binds every dead-letter queue to dlq.exchange under the routing key its worker queue uses (KI-32)', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    await connectRabbitMQ();
    for (const q of ['raw_log', 'aggregation', 'anomaly', 'rum']) {
      const workerArgs = channel.assertQueue.mock.calls.find(([name]) => name === `${q}_queue`)![1];
      expect(channel.bindQueue).toHaveBeenCalledWith(workerArgs.deadLetterRoutingKey, workerArgs.deadLetterExchange, workerArgs.deadLetterRoutingKey);
    }
  });
});
