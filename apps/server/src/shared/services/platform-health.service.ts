import mongoose from 'mongoose';
import { getPg } from '@infrastructure/db/postgres';
import { getRedis } from '@infrastructure/redis';
import { getChannel } from '@infrastructure/rabbitmq';

export interface QueueHealth {
  queue: string;
  messageCount: number;
  consumerCount: number;
}

export interface PlatformHealthSnapshot {
  uptimeSeconds: number;
  memoryUsageMb: number;
  services: {
    mongo: 'ok' | 'down';
    postgres: 'ok' | 'down';
    redis: 'ok' | 'down';
    rabbitmq: 'ok' | 'down';
  };
  queues: QueueHealth[];
}

export class PlatformHealthService {
  async snapshot(): Promise<PlatformHealthSnapshot> {
    const [mongo, postgres, redis, rabbitmq, queues] = await Promise.all([
      this.checkMongo(),
      this.checkPostgres(),
      this.checkRedis(),
      this.checkRabbitMq(),
      this.checkQueues(),
    ]);

    return {
      uptimeSeconds: Number(process.uptime().toFixed(0)),
      memoryUsageMb: Number((process.memoryUsage().rss / 1024 / 1024).toFixed(2)),
      services: {
        mongo,
        postgres,
        redis,
        rabbitmq,
      },
      queues,
    };
  }

  private async checkMongo(): Promise<'ok' | 'down'> {
    return mongoose.connection.readyState === 1 ? 'ok' : 'down';
  }

  private async checkPostgres(): Promise<'ok' | 'down'> {
    try {
      const client = await getPg().connect();
      await client.query('SELECT 1');
      client.release();
      return 'ok';
    } catch {
      return 'down';
    }
  }

  private async checkRedis(): Promise<'ok' | 'down'> {
    try {
      await getRedis().ping();
      return 'ok';
    } catch {
      return 'down';
    }
  }

  private async checkRabbitMq(): Promise<'ok' | 'down'> {
    try {
      getChannel();
      return 'ok';
    } catch {
      return 'down';
    }
  }

  private async checkQueues(): Promise<QueueHealth[]> {
    const channel = getChannel();
    const queueNames = ['raw_log_queue', 'aggregation_queue', 'anomaly_queue', 'rum_queue'];

    const results: QueueHealth[] = [];
    for (const queue of queueNames) {
      try {
        const status = await channel.checkQueue(queue);
        results.push({
          queue,
          messageCount: status.messageCount,
          consumerCount: status.consumerCount,
        });
      } catch {
        results.push({
          queue,
          messageCount: 0,
          consumerCount: 0,
        });
      }
    }

    return results;
  }
}
