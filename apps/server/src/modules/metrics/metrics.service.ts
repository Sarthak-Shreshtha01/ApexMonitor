import { getRedis } from '@infrastructure/redis';
import { eventBus } from '@events/event-bus';
import { MetricsRepository } from './metrics.repository';
import { MetricsQuery } from './dto/metrics-query.dto';

export class MetricsService {
  private repository: MetricsRepository;

  constructor() {
    this.repository = new MetricsRepository();

    // Listen for the aggregation worker finishing a batch to clear the cache
    eventBus.on('aggregation.completed', async (payload) => {
      for (const projectId of payload.projectIds) {
        await this.invalidateCache(projectId);
      }
    });
  }

  async getLatencyBreakdown(query: MetricsQuery) {
    const redis = getRedis();
    const cacheKey = `metrics:${query.projectId}:latency:${query.timeframe}:${query.endpoint ?? 'all'}:${query.page}`;

    // 1. Check Redis Cache
    const cachedData = await redis.get(cacheKey);
    if (cachedData) {
      return JSON.parse(cachedData);
    }

    // 2. Cache Miss: Query PostgreSQL
    const data = await this.repository.getLatencyBreakdown(query);

    // 3. Save to Redis with 30-second TTL
    await redis.setex(cacheKey, 30, JSON.stringify(data));

    return data;
  }

  /**
   * Scans and deletes all metric cache keys for a specific project.
   */
  async invalidateCache(projectId: string): Promise<void> {
    const redis = getRedis();
    const pattern = `metrics:${projectId}:*`;
    
    // Use SCAN to safely find keys without blocking Redis
    let cursor = '0';
    do {
      const res = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = res[0];
      const keys = res[1];
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } while (cursor !== '0');
  }
}