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

// Declarative Topology Setup (from SRS §9.2)
async function setupRabbitMQTopology(ch: Channel): Promise<void> {
  // 1. Exchanges
  await ch.assertExchange('logs.exchange', 'direct', { durable: true });
  await ch.assertExchange('dlq.exchange', 'direct', { durable: true });
  await ch.assertExchange('ws.fanout', 'fanout', { durable: false });

  // 2. Dead Letter Queues
  await ch.assertQueue('raw_log_dlq', { durable: true });
  await ch.assertQueue('aggregation_dlq', { durable: true });
  await ch.assertQueue('anomaly_dlq', { durable: true });
  await ch.assertQueue('rum_dlq', { durable: true });

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