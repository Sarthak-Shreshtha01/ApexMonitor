import crypto from 'crypto';
import { getRedis } from '@infrastructure/redis';
import { getPg } from '@infrastructure/db/postgres'; // <-- NEW IMPORT
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
    const pg = getPg();
    const batchId = crypto.randomUUID();
    const idempotencyKey = this.normalizeIdempotencyKey(dto.projectId, dto.idempotencyKey);

    if (idempotencyKey) {
      const cachedBatchKey = `ingest:idempotency:${idempotencyKey}`;
      const cachedResult = await redis.get(cachedBatchKey);
      if (cachedResult) {
        return JSON.parse(cachedResult) as { received: number; batchId: string };
      }

      const lockResult = await redis.set(cachedBatchKey, JSON.stringify({ received: 0, batchId }), 'EX', 300, 'NX');
      if (lockResult !== 'OK') {
        const existing = await redis.get(cachedBatchKey);
        if (existing) {
          return JSON.parse(existing) as { received: number; batchId: string };
        }
      }
    }

    // ====================================================================
    // 1. DYNAMIC RATE LIMITING (Phase 7: Billing Integration)
    // ====================================================================
    
    // 1a. Find who owns this project (Cache for 1 hour)
    const ownerCacheKey = `project_owner:${dto.projectId}`;
    let ownerId = await redis.get(ownerCacheKey);
    
    if (!ownerId) {
      const { rows } = await pg.query(`SELECT owner_user_id FROM projects WHERE id = $1`, [dto.projectId]);
      ownerId = rows[0]?.owner_user_id;
      if (ownerId) await redis.setex(ownerCacheKey, 3600, ownerId);
    }

    // 1b. Determine Tier Limits (Cache for 1 hour)
    let limit = 60000; // Default FREE tier limit (60,000 requests per minute)
    if (ownerId) {
      const tierKey = `tier:${ownerId}`;
      let tier: string = await redis.get(tierKey) || 'FREE';
      
      if (!tier || tier === 'FREE') {
        const { rows } = await pg.query(`SELECT plan_tier FROM subscriptions WHERE user_id = $1`, [ownerId]);
        tier = rows[0]?.plan_tier || 'FREE';
        await redis.setex(tierKey, 3600, tier); // Cache tier in Redis
      }
      
      if (tier === 'PRO') limit = 600000; // PRO tier gets 10x limit
    }

    // 1c. Apply the Sliding Window Rate Limit
    const rateKey = `rate:${dto.projectId}`;
    const currentRpm = await redis.incr(rateKey);
    if (currentRpm === 1) {
      await redis.expire(rateKey, 60); // 60-second window
    }

    if (currentRpm > limit) {
      throw new Error('RATE_LIMITED'); // Handled by global error handler
    }
    // ====================================================================

    // 2. Normalize Log Entries
    const dailySalt = new Date().toISOString().split('T')[0]; // Rotates daily
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
      sdkVersion: dto.sdkVersion || 'unknown',
      tags: log.tags || [],
    }));

    // 3. Publish to RabbitMQ
    channel.publish(
      'logs.exchange',
      'log.ingest',
      Buffer.from(JSON.stringify(normalizedLogs)),
      {
        persistent: true,
        contentType: 'application/json',
        messageId: batchId,
        correlationId: batchId,
        headers: {
          projectId: dto.projectId,
          sdkVersion: dto.sdkVersion,
          idempotencyKey: idempotencyKey ?? undefined,
        },
      }
    );

    // 4. Increment Live WebSocket Counters
    const totalErrors = normalizedLogs.reduce((sum, log) => sum + (log.statusCode >= 400 ? 1 : 0), 0);
    const totalLatency = normalizedLogs.reduce((sum, log) => sum + log.latencyMs, 0);

    await redis.incrby(`live:${dto.projectId}:requests`, normalizedLogs.length);
    await redis.expire(`live:${dto.projectId}:requests`, 5);

    await redis.incrby(`live:${dto.projectId}:errors`, totalErrors);
    await redis.expire(`live:${dto.projectId}:errors`, 5);

    await redis.incrbyfloat(`live:${dto.projectId}:latency_total`, totalLatency);
    await redis.expire(`live:${dto.projectId}:latency_total`, 5);

    const endpointKey = `live:${dto.projectId}:endpoints`;
    for (const log of normalizedLogs) {
      await redis.zincrby(endpointKey, 1, `${log.method} ${log.endpoint}`);
    }
    await redis.expire(endpointKey, 8);

    const result = { received: normalizedLogs.length, batchId };

    if (idempotencyKey) {
      await redis.set(`ingest:idempotency:${idempotencyKey}`, JSON.stringify(result), 'EX', 300);
    }

    return result;
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

  private normalizeIdempotencyKey(projectId: string, key?: string): string | undefined {
    if (!key) {
      return undefined;
    }

    const trimmed = key.trim();
    if (!trimmed) {
      return undefined;
    }

    return `${projectId}:${trimmed}`;
  }
}