import { getChannel } from '@infrastructure/rabbitmq';
import { ApiLog, IApiLog } from '@modules/logs/logs.schema';

export class RawLogWorker {
  private readonly QUEUE = 'raw_log_queue';
  private readonly PREFETCH = 200; // Max unacked messages in flight to prevent memory exhaustion

  async start(): Promise<void> {
    const channel = getChannel();
    
    // Tell RabbitMQ not to overwhelm this worker with more than 200 messages at once
    await channel.prefetch(this.PREFETCH);

    console.log(`👷 [Worker] RawLogWorker started, consuming from ${this.QUEUE}`);

    await channel.consume(this.QUEUE, async (msg) => {
      if (!msg) return;

      try {
        const logs: IApiLog[] = JSON.parse(msg.content.toString());

        // Unordered Bulk Insert: The fastest way to write to Mongo.
        // If a duplicate reqId exists, it throws a partial error but inserts the rest.
        await ApiLog.insertMany(logs, { ordered: false });

        // Success! Tell RabbitMQ to permanently remove the message from the queue.
        channel.ack(msg);
      } catch (error: any) {
        // Handle Mongo BulkWriteError (E11000 duplicate key error)
        if (error.code === 11000 || error.name === 'BulkWriteError') {
          console.warn('⚠️ [RawLogWorker] Duplicate reqId detected, acknowledging to prevent loop.');
          channel.ack(msg); // Ack it anyway so it doesn't get stuck in an infinite retry loop
          return;
        }

        console.error('❌ [RawLogWorker] Fatal insert error, sending to DLQ:', error);
        
        // Requeue=false sends this message directly to the Dead Letter Queue (raw_log_dlq)
        channel.nack(msg, false, false);
      }
    });
  }
}