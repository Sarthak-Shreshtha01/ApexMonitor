import crypto from 'crypto';
import { URL } from 'url';
import { getRedis } from '@infrastructure/redis';
import { getChannel } from '@infrastructure/rabbitmq';
import { config } from '@config';
import { UserService } from '@modules/users/user.service';
import { RumIngestBatch, RumEnrichedEvent } from './dto/rum-ingest.dto';
import { RumQuery } from './dto/rum-query.dto';
import { RumRepository } from './rum.repository';

const RUM_INGEST_EXCHANGE = 'logs.exchange';
const RUM_INGEST_KEY = 'rum.ingest';

type IngestContext = {
  projectId: string;
  origin: string;
  referrer: string;
  userAgent: string;
  ip: string;
  countryCode: string;
  regionCode: string;
  idempotencyKey?: string;
};

export class RumService {
  private repository = new RumRepository();
  private usersService = new UserService();

  async processBatch(dto: RumIngestBatch, context: IngestContext): Promise<{ received: number; batchId: string }> {
    const redis = getRedis();
    const channel = getChannel();

    // Keep ingress non-blocking with Redis-only safeguards.
    const nowMinute = new Date().toISOString().slice(0, 16);
    const rateKey = `rate:rum:${context.projectId}:${nowMinute}`;
    const current = await redis.incr(rateKey);
    if (current === 1) {
      await redis.expire(rateKey, 120);
    }

    const limit = Number(process.env.RUM_RATE_LIMIT_RPM ?? config.RATE_LIMIT_RPM * 2);
    if (current > limit) {
      throw new Error('RATE_LIMITED');
    }

    const batchId = crypto.randomUUID();

    if (context.idempotencyKey) {
      const idempotencyCacheKey = `rum:idempotency:${context.projectId}:${context.idempotencyKey}`;
      const idempotencyLock = await redis.set(idempotencyCacheKey, batchId, 'EX', 300, 'NX');
      if (idempotencyLock !== 'OK') {
        const existing = await redis.get(idempotencyCacheKey);
        return { received: 0, batchId: existing ?? batchId };
      }
    }

    const dailySalt = new Date().toISOString().split('T')[0];
    const now = Date.now();

    const enrichedEvents: RumEnrichedEvent[] = dto.events
      .filter((event) => {
        const eventTime = new Date(event.timestamp).getTime();
        if (Number.isNaN(eventTime)) return false;
        const drift = eventTime - now;
        return drift <= 5 * 60 * 1000 && drift >= -24 * 60 * 60 * 1000;
      })
      .map((event) => {
      const browser = this.detectBrowser(context.userAgent);
      const os = this.detectOs(context.userAgent);
      const deviceType = this.detectDeviceType(context.userAgent);

      const normalizedPath = this.normalizePath(event.path);
      const referrerSource = this.normalizeReferrer(event.referrer || context.referrer);

      const stableBase = `${context.projectId}:${context.ip}:${context.userAgent}:${dailySalt}`;
      const visitorHash = this.hmac(stableBase);
      const sessionHash = event.sessionId
        ? this.hmac(`${context.projectId}:${event.sessionId}:${dailySalt}`)
        : this.hmac(`${stableBase}:session`);

      return {
        eventId: crypto.randomUUID(),
        projectId: context.projectId,
        type: event.type,
        path: normalizedPath,
        referrerSource,
        sessionHash,
        visitorHash,
        ttfbMs: event.ttfbMs ?? null,
        fcpMs: event.fcpMs ?? null,
        lcpMs: event.lcpMs ?? null,
        browserName: browser,
        osName: os,
        deviceType,
        countryCode: context.countryCode,
        regionCode: context.regionCode,
        timestamp: new Date(event.timestamp).toISOString(),
        sdkVersion: dto.sdkVersion,
      };
    });

    if (enrichedEvents.length === 0) {
      return { received: 0, batchId };
    }

    const payload = {
      batchId,
      projectId: context.projectId,
      events: enrichedEvents,
      receivedAt: new Date().toISOString(),
    };

    channel.publish(RUM_INGEST_EXCHANGE, RUM_INGEST_KEY, Buffer.from(JSON.stringify(payload)), {
      persistent: true,
      contentType: 'application/json',
      messageId: batchId,
      correlationId: batchId,
    });

    return { received: enrichedEvents.length, batchId };
  }

  async getOverview(userId: string, query: RumQuery) {
    await this.assertProjectAccess(userId, query.projectId);
    return this.repository.getOverview(query);
  }

  async getSeries(userId: string, query: RumQuery) {
    await this.assertProjectAccess(userId, query.projectId);
    return this.repository.getSeries(query);
  }

  async getTopPaths(userId: string, query: RumQuery) {
    await this.assertProjectAccess(userId, query.projectId);
    return this.repository.getTopPaths(query);
  }

  async getDeviceBreakdown(userId: string, query: RumQuery) {
    await this.assertProjectAccess(userId, query.projectId);
    return this.repository.getDeviceBreakdown(query);
  }

  async getGeoBreakdown(userId: string, query: RumQuery) {
    await this.assertProjectAccess(userId, query.projectId);
    return this.repository.getGeoBreakdown(query);
  }

  async getReferrerBreakdown(userId: string, query: RumQuery) {
    await this.assertProjectAccess(userId, query.projectId);
    return this.repository.getReferrerBreakdown(query);
  }

  private async assertProjectAccess(userId: string, projectId: string): Promise<void> {
    const projects = await this.usersService.listProjects(userId);
    const hasAccess = projects.some((project) => project.id === projectId);

    if (!hasAccess) {
      throw new Error('PROJECT_ACCESS_DENIED');
    }
  }

  private normalizePath(path: string): string {
    if (!path) return '/';

    try {
      const parsed = new URL(path, 'https://rum.local');
      return parsed.pathname
        .replace(/\/{2,}/g, '/')
        .replace(/\/$/, '') || '/';
    } catch {
      return path.split('?')[0].split('#')[0].trim() || '/';
    }
  }

  private normalizeReferrer(referrer: string): string {
    if (!referrer) return 'direct';

    try {
      const parsed = new URL(referrer);
      return parsed.hostname.toLowerCase();
    } catch {
      return 'unknown';
    }
  }

  private hmac(value: string): string {
    return crypto.createHmac('sha256', config.JWT_SECRET).update(value).digest('hex');
  }

  private detectBrowser(userAgent: string): string {
    const ua = (userAgent || '').toLowerCase();
    if (ua.includes('edg/')) return 'Edge';
    if (ua.includes('chrome/')) return 'Chrome';
    if (ua.includes('safari/') && !ua.includes('chrome/')) return 'Safari';
    if (ua.includes('firefox/')) return 'Firefox';
    if (ua.includes('opr/') || ua.includes('opera/')) return 'Opera';
    return 'Unknown';
  }

  private detectOs(userAgent: string): string {
    const ua = (userAgent || '').toLowerCase();
    if (ua.includes('windows')) return 'Windows';
    if (ua.includes('android')) return 'Android';
    if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('ios')) return 'iOS';
    if (ua.includes('mac os') || ua.includes('macintosh')) return 'macOS';
    if (ua.includes('linux')) return 'Linux';
    return 'Unknown';
  }

  private detectDeviceType(userAgent: string): 'mobile' | 'desktop' | 'tablet' | 'bot' | 'unknown' {
    const ua = (userAgent || '').toLowerCase();
    if (ua.includes('bot') || ua.includes('spider') || ua.includes('crawler')) return 'bot';
    if (ua.includes('ipad') || ua.includes('tablet')) return 'tablet';
    if (ua.includes('mobile') || ua.includes('iphone') || ua.includes('android')) return 'mobile';
    if (ua.length === 0) return 'unknown';
    return 'desktop';
  }
}
