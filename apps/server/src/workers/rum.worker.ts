import { getChannel } from '@infrastructure/rabbitmq';
import { getPg } from '@infrastructure/db/postgres';
import { getRedis } from '@infrastructure/redis';
import { RumEnrichedEvent } from '@modules/rum/dto/rum-ingest.dto';
import { RumRawEvent } from '@modules/rum/rum.schema';

type RumEnvelope = {
  batchId: string;
  projectId: string;
  events: RumEnrichedEvent[];
  receivedAt: string;
};

type GroupState = {
  projectId: string;
  path: string;
  deviceType: RumEnrichedEvent['deviceType'];
  browserName: string;
  countryCode: string;
  regionCode: string;
  referrerSource: string;
  hourBucketIso: string;
  pageViews: number;
  ttfbSum: number;
  ttfbCount: number;
  fcpSum: number;
  fcpCount: number;
  lcpSum: number;
  lcpCount: number;
};

export class RumWorker {
  private readonly QUEUE = 'rum_queue';
  private readonly PREFETCH = 150;

  async start(): Promise<void> {
    const channel = getChannel();
    await channel.prefetch(this.PREFETCH);
    console.log(`👷 [Worker] RumWorker started, consuming from ${this.QUEUE}`);

    await channel.consume(this.QUEUE, async (msg) => {
      if (!msg) return;

      try {
        const payload = JSON.parse(msg.content.toString()) as RumEnvelope;
        await this.processBatch(payload);
        channel.ack(msg);
      } catch (error) {
        console.error('❌ [RumWorker] Processing failed:', error);
        channel.nack(msg, false, false);
      }
    });
  }

  private async processBatch(payload: RumEnvelope): Promise<void> {
    const pg = getPg();
    const redis = getRedis();

    // Preserve raw RUM events for short forensic window with TTL cleanup.
    try {
      await RumRawEvent.insertMany(
        payload.events.map((event) => ({
          ...event,
          timestamp: new Date(event.timestamp),
          ingestedAt: new Date(),
        })),
        { ordered: false }
      );
    } catch (error: any) {
      if (error?.code !== 11000 && error?.name !== 'BulkWriteError') {
        throw error;
      }
    }

    const grouped = new Map<string, GroupState>();

    for (const event of payload.events) {
      const hourBucketIso = this.toUtcHourBucket(event.timestamp);
      const key = [
        event.projectId,
        event.path,
        event.deviceType,
        event.browserName,
        event.countryCode,
        event.regionCode,
        event.referrerSource,
        hourBucketIso,
      ].join('|');

      let group = grouped.get(key);
      if (!group) {
        group = {
          projectId: event.projectId,
          path: event.path,
          deviceType: event.deviceType,
          browserName: event.browserName,
          countryCode: event.countryCode,
          regionCode: event.regionCode,
          referrerSource: event.referrerSource,
          hourBucketIso,
          pageViews: 0,
          ttfbSum: 0,
          ttfbCount: 0,
          fcpSum: 0,
          fcpCount: 0,
          lcpSum: 0,
          lcpCount: 0,
        };
        grouped.set(key, group);
      }

      if (event.type === 'page_view') {
        group.pageViews += 1;
      }

      if (typeof event.ttfbMs === 'number') {
        group.ttfbSum += event.ttfbMs;
        group.ttfbCount += 1;
      }

      if (typeof event.fcpMs === 'number') {
        group.fcpSum += event.fcpMs;
        group.fcpCount += 1;
      }

      if (typeof event.lcpMs === 'number') {
        group.lcpSum += event.lcpMs;
        group.lcpCount += 1;
      }

      const uniquenessKey = this.uniquenessKey(group);
      await redis.pfadd(`${uniquenessKey}:visitors`, event.visitorHash);
      await redis.expire(`${uniquenessKey}:visitors`, 60 * 60 * 24 * 8);
      await redis.pfadd(`${uniquenessKey}:sessions`, event.sessionHash);
      await redis.expire(`${uniquenessKey}:sessions`, 60 * 60 * 24 * 8);
    }

    for (const group of grouped.values()) {
      const uniquenessKey = this.uniquenessKey(group);
      const [uniqueVisitors, uniqueSessions] = await Promise.all([
        redis.pfcount(`${uniquenessKey}:visitors`),
        redis.pfcount(`${uniquenessKey}:sessions`),
      ]);

      const avgTtfb = group.ttfbCount > 0 ? group.ttfbSum / group.ttfbCount : null;
      const avgFcp = group.fcpCount > 0 ? group.fcpSum / group.fcpCount : null;
      const avgLcp = group.lcpCount > 0 ? group.lcpSum / group.lcpCount : null;

      await pg.query(
        `
          INSERT INTO hourly_rum_metrics (
            project_id,
            path,
            device_type,
            browser_name,
            country_code,
            region_code,
            referrer_source,
            hour_bucket,
            page_views,
            unique_visitors,
            unique_sessions,
            avg_ttfb_ms,
            avg_fcp_ms,
            avg_lcp_ms,
            ttfb_samples,
            fcp_samples,
            lcp_samples
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8,
            $9, $10, $11, $12, $13, $14, $15, $16, $17
          )
          ON CONFLICT (project_id, path, device_type, browser_name, country_code, region_code, referrer_source, hour_bucket)
          DO UPDATE SET
            page_views = hourly_rum_metrics.page_views + EXCLUDED.page_views,
            unique_visitors = GREATEST(hourly_rum_metrics.unique_visitors, EXCLUDED.unique_visitors),
            unique_sessions = GREATEST(hourly_rum_metrics.unique_sessions, EXCLUDED.unique_sessions),
            avg_ttfb_ms = CASE
              WHEN (hourly_rum_metrics.ttfb_samples + EXCLUDED.ttfb_samples) = 0 THEN NULL
              ELSE (
                (COALESCE(hourly_rum_metrics.avg_ttfb_ms, 0) * hourly_rum_metrics.ttfb_samples) +
                (COALESCE(EXCLUDED.avg_ttfb_ms, 0) * EXCLUDED.ttfb_samples)
              ) / (hourly_rum_metrics.ttfb_samples + EXCLUDED.ttfb_samples)
            END,
            avg_fcp_ms = CASE
              WHEN (hourly_rum_metrics.fcp_samples + EXCLUDED.fcp_samples) = 0 THEN NULL
              ELSE (
                (COALESCE(hourly_rum_metrics.avg_fcp_ms, 0) * hourly_rum_metrics.fcp_samples) +
                (COALESCE(EXCLUDED.avg_fcp_ms, 0) * EXCLUDED.fcp_samples)
              ) / (hourly_rum_metrics.fcp_samples + EXCLUDED.fcp_samples)
            END,
            avg_lcp_ms = CASE
              WHEN (hourly_rum_metrics.lcp_samples + EXCLUDED.lcp_samples) = 0 THEN NULL
              ELSE (
                (COALESCE(hourly_rum_metrics.avg_lcp_ms, 0) * hourly_rum_metrics.lcp_samples) +
                (COALESCE(EXCLUDED.avg_lcp_ms, 0) * EXCLUDED.lcp_samples)
              ) / (hourly_rum_metrics.lcp_samples + EXCLUDED.lcp_samples)
            END,
            ttfb_samples = hourly_rum_metrics.ttfb_samples + EXCLUDED.ttfb_samples,
            fcp_samples = hourly_rum_metrics.fcp_samples + EXCLUDED.fcp_samples,
            lcp_samples = hourly_rum_metrics.lcp_samples + EXCLUDED.lcp_samples,
            updated_at = NOW()
        `,
        [
          group.projectId,
          group.path,
          group.deviceType,
          group.browserName,
          group.countryCode,
          group.regionCode,
          group.referrerSource,
          group.hourBucketIso,
          group.pageViews,
          uniqueVisitors,
          uniqueSessions,
          avgTtfb,
          avgFcp,
          avgLcp,
          group.ttfbCount,
          group.fcpCount,
          group.lcpCount,
        ]
      );
    }
  }

  private uniquenessKey(group: GroupState): string {
    return [
      'rum:hll',
      group.projectId,
      group.path,
      group.deviceType,
      group.browserName,
      group.countryCode,
      group.regionCode,
      group.referrerSource,
      group.hourBucketIso,
    ].join(':');
  }

  private toUtcHourBucket(timestampIso: string): string {
    const date = new Date(timestampIso);
    return new Date(Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      date.getUTCHours(),
      0,
      0,
      0,
    )).toISOString();
  }
}
