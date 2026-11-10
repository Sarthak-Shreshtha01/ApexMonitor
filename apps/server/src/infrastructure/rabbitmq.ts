import amqp, { Connection, Channel , ChannelModel } from 'amqplib';
import { config } from '@config';

let connection: ChannelModel;
let channel: Channel;

export async function connectRabbitMQ(): Promise<void> {
  connection = await amqp.connect(config.RABBITMQ_URL);
  channel = await connection.createChannel();
  
  await setupRabbitMQTopology(channel);
  console.log('✅ [RabbitMQ] Connected and Topology Configured');
}

export function getChannel(): Channel {
  if (!channel) throw new Error('RabbitMQ channel not created');
  return channel;
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
