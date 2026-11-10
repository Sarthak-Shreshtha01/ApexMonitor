import crypto from 'crypto';
import { getRedis } from '@infrastructure/redis';
import { getPg } from '@infrastructure/db/postgres'; // <-- NEW IMPORT
import { publish } from '@infrastructure/rabbitmq';
import { config } from '@config';
import { IngestBatch } from './dto/ingest-batch.dto';
import { normalizeRoute } from '@shared/utils/route.utils';
import { enforceRateLimit } from '@shared/rate-limit/sliding-window';

export class IngestService {
  /**
   * Main entry point for SDK batch ingestion.
   */
  async processBatch(dto: IngestBatch): Promise<{ received: number; batchId: string }> {
    const redis = getRedis();
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

    // Everything after the idempotency lock: if any step fails (rate limit, broker down),
    // release the lock so the client's retry with the same key is processed instead of
    // being answered with the placeholder as if it had succeeded.
    try {
      const result = await this.acceptBatch(dto, batchId, idempotencyKey);
      if (idempotencyKey) {
        await redis.set(`ingest:idempotency:${idempotencyKey}`, JSON.stringify(result), 'EX', 300);
      }
      return result;
    } catch (error) {
      if (idempotencyKey) {
        await redis.del(`ingest:idempotency:${idempotencyKey}`).catch(() => undefined);
      }
      throw error;
    }
  }

  private async acceptBatch(dto: IngestBatch, batchId: string, idempotencyKey: string | undefined): Promise<{ received: number; batchId: string }> {
    const redis = getRedis();
    const pg = getPg();

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

    // 1b. Determine the tier (cached for 1 hour, including FREE; billing deletes the key on upgrade)
    let limit = config.RATE_LIMIT_RPM; // FREE: events per minute
    if (ownerId) {
      const tierKey = `tier:${ownerId}`;
      let tier = await redis.get(tierKey);
      if (tier === null) {
        const { rows } = await pg.query(`SELECT plan_tier FROM subscriptions WHERE user_id = $1`, [ownerId]);
        tier = (rows[0]?.plan_tier as string | undefined) ?? 'FREE';
        await redis.setex(tierKey, 3600, tier);
      }
      if (tier === 'PRO') limit = config.RATE_LIMIT_RPM * 10;
    }

    // 1c. Sliding-window limit on EVENTS (a 500-log batch costs 500). Over the limit → 429
    //     with Retry-After; a refused batch doesn't use up any budget.
    await enforceRateLimit(redis, 'ingest', dto.projectId, dto.logs.length, limit);
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
    // Resolves only once RabbitMQ has confirmed the message; throws BrokerUnavailableError (→ 503) otherwise.
    await publish(
      'logs.exchange',
      'log.ingest',
      Buffer.from(JSON.stringify(normalizedLogs)),
      {
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

    // One round trip for all live counters (they were one call per log).
    const endpointKey = `live:${dto.projectId}:endpoints`;
    const perEndpoint = new Map<string, number>();
    for (const log of normalizedLogs) {
      const member = `${log.method} ${log.endpoint}`;
      perEndpoint.set(member, (perEndpoint.get(member) ?? 0) + 1);
    }
    const live = redis.pipeline()
      .incrby(`live:${dto.projectId}:requests`, normalizedLogs.length)
      .expire(`live:${dto.projectId}:requests`, 5)
      .incrby(`live:${dto.projectId}:errors`, totalErrors)
      .expire(`live:${dto.projectId}:errors`, 5)
      .incrbyfloat(`live:${dto.projectId}:latency_total`, totalLatency)
      .expire(`live:${dto.projectId}:latency_total`, 5);
    for (const [member, count] of perEndpoint) live.zincrby(endpointKey, count, member);
    await live.expire(endpointKey, 8).exec();

    return { received: normalizedLogs.length, batchId };
  }

  /**
   * Converts dynamic URL paths into static templates (e.g., /users/123 -> /users/:id)
   */
  private normalizeEndpoint(path: string): string {
    return normalizeRoute(path);
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