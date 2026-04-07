import { getRedis } from '@infrastructure/redis';
import { eventBus } from '@events/event-bus';
import { MetricsRepository } from './metrics.repository';
import { MetricsQuery } from './dto/metrics-query.dto';
import { UserService } from '@modules/users/user.service';

export class MetricsService {
  private repository: MetricsRepository;
  private usersService: UserService;

  constructor() {
    this.repository = new MetricsRepository();
    this.usersService = new UserService();

    // Listen for the aggregation worker finishing a batch to clear the cache
    eventBus.on('aggregation.completed', async (payload) => {
      for (const projectId of payload.projectIds) {
        await this.invalidateCache(projectId);
      }
    });
  }

  async getOverview(query: MetricsQuery, userId: string) {
    await this.assertProjectAccess(userId, query.projectId);

    const redis = getRedis();
    const cacheKey = `metrics:${query.projectId}:overview:${query.timeframe}`;
    const cachedData = await redis.get(cacheKey);

    if (cachedData) {
      return JSON.parse(cachedData);
    }

    const data = await this.repository.getOverview(query);
    await redis.setex(cacheKey, 30, JSON.stringify(data));
    return data;
  }

  async getLatencyBreakdown(query: MetricsQuery, userId: string) {
    await this.assertProjectAccess(userId, query.projectId);

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

  private async assertProjectAccess(userId: string, projectId: string): Promise<void> {
    const projects = await this.usersService.listProjects(userId);
    const hasAccess = projects.some((project) => project.id === projectId);

    if (!hasAccess) {
      throw new Error('PROJECT_ACCESS_DENIED');
    }
  }
}