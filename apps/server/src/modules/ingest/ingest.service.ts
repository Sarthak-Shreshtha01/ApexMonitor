import crypto from 'crypto';
import { getRedis } from '@infrastructure/redis';
import { getChannel } from '@infrastructure/rabbitmq';
import { config } from '@config';
import { IngestBatch } from './dto/ingest-batch.dto';

export class IngestService {
  /**
   * Main entry point for SDK batch ingestion.
   */
  async processBatch(dto: IngestBatch): Promise<{ received: number; batchId: string }> {
    const redis = getRedis();
    const channel = getChannel();

    // 1. Rate Limiting via Redis (Sliding Window / INCR Counter)
    const rateKey = `rate:${dto.projectId}`;
    const currentRpm = await redis.incr(rateKey);
    if (currentRpm === 1) {
      await redis.expire(rateKey, 60); // 60-second window
    }

    if (currentRpm > config.RATE_LIMIT_RPM) {
      throw new Error('RATE_LIMITED'); // Handled by global error handler later
    }

    // 2. Normalize Log Entries
    const dailySalt = new Date().toISOString().split('T')[0]; // Rotates daily
    const batchId = crypto.randomUUID();

    const normalizedLogs = dto.logs.map(log => ({
      reqId: crypto.randomUUID(),
      projectId: dto.projectId,
      method: log.method,
      endpoint: this.normalizeEndpoint(log.endpoint),
      statusCode: log.statusCode,
      latencyMs: log.latencyMs,
      ip: this.hashIp(log.ip, dto.projectId, dailySalt),
      userAgent: log.userAgent,
      region: 'XX', // Will be populated by GeoIP in a later phase
      timestamp: new Date(log.timestamp),
      sdkVersion: dto.sdkVersion,
      tags: log.tags,
    }));

    // 3. Publish to RabbitMQ
    channel.publish(
      'logs.exchange',
      'log.ingest',
      Buffer.from(JSON.stringify(normalizedLogs)),
      { persistent: true }
    );

    // 4. Increment Live WebSocket Counters
    await redis.incrby(`live:${dto.projectId}:rps`, dto.logs.length);
    await redis.expire(`live:${dto.projectId}:rps`, 5);

    return { received: normalizedLogs.length, batchId };
  }

  /**
   * Converts dynamic URL paths into static templates (e.g., /users/123 -> /users/:id)
   */
  private normalizeEndpoint(path: string): string {
    return path
      .replace(/\/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/g, '/:id') // UUIDs
      .replace(/\/\d+/g, '/:id'); // Numbers
  }

  /**
   * Cryptographically hashes the IP to protect user privacy
   */
  private hashIp(ip: string, projectId: string, salt: string): string {
    return crypto.createHash('sha256').update(`${ip}:${projectId}:${salt}`).digest('hex');
  }
}