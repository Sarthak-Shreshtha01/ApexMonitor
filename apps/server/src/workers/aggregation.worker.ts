import { getChannel } from '@infrastructure/rabbitmq';
import { getPg } from '@infrastructure/db/postgres';
import { eventBus } from '@events/event-bus';
import { computeBatchStats } from '@shared/utils/math.utils';
import { LogEntry } from '@modules/ingest/dto/ingest-batch.dto';

// Apdex Thresholds
const APDEX_T_MS = 500;
const APDEX_4T_MS = 2000;

export class AggregationWorker {
  private readonly QUEUE = 'aggregation_queue';
  private readonly PREFETCH = 100;

  async start(): Promise<void> {
    const channel = getChannel();
    await channel.prefetch(this.PREFETCH);
    console.log(`👷 [Worker] AggregationWorker (v2) started, consuming from ${this.QUEUE}`);

    await channel.consume(this.QUEUE, async (msg) => {
      if (!msg) return;

      try {
        const batch: (LogEntry & { projectId: string })[] = JSON.parse(msg.content.toString());
        await this.processBatch(batch);
        channel.ack(msg);
      } catch (error) {
        console.error('❌ [AggregationWorker] Processing failed:', error);
        channel.nack(msg, false, false);
      }
    });
  }

  private async processBatch(batch: (LogEntry & { projectId: string })[]): Promise<void> {
    const pg = getPg();

    // 1. Group logs
    const grouped = new Map<string, any>();

    for (const log of batch) {
      const date = new Date(log.timestamp);
      const hourBucket = new Date(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours());
      
      const key = `${log.projectId}|${log.endpoint}|${log.method}|${hourBucket.getTime()}`;
      
      if (!grouped.has(key)) {
        grouped.set(key, { 
          latencies: [], 
          statusCodes: [], 
          bucket: hourBucket, 
          projectId: log.projectId, 
          endpoint: log.endpoint, 
          method: log.method,
          // Apdex Buckets
          satisfied: 0,
          tolerating: 0,
          frustrated: 0
        });
      }
      
      const group = grouped.get(key)!;
      group.latencies.push(log.latencyMs);
      group.statusCodes.push(log.statusCode);

      // Apdex Categorization
      if (log.statusCode >= 500 || log.latencyMs > APDEX_4T_MS) {
        group.frustrated += 1;
      } else if (log.latencyMs > APDEX_T_MS) {
        group.tolerating += 1;
      } else {
        group.satisfied += 1;
      }
    }

    // 2. Compute stats and UPSERT
    const projectIds = new Set<string>();

    for (const group of grouped.values()) {
      projectIds.add(group.projectId);
      const stats = computeBatchStats(group.latencies, group.statusCodes);

      // UPSERT Hourly Metrics with Apdex columns
      await pg.query(`
        INSERT INTO hourly_metrics 
          (project_id, endpoint, method, hour_bucket, request_count, error_count, p50_ms, p95_ms, p99_ms, avg_ms, satisfied_count, tolerating_count, frustrated_count)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        ON CONFLICT (project_id, endpoint, method, hour_bucket) 
        DO UPDATE SET 
          request_count    = hourly_metrics.request_count + EXCLUDED.request_count,
          error_count      = hourly_metrics.error_count + EXCLUDED.error_count,
          p99_ms           = GREATEST(hourly_metrics.p99_ms, EXCLUDED.p99_ms),
          p95_ms           = GREATEST(hourly_metrics.p95_ms, EXCLUDED.p95_ms),
          avg_ms           = (hourly_metrics.avg_ms + EXCLUDED.avg_ms) / 2.0,
          satisfied_count  = hourly_metrics.satisfied_count + EXCLUDED.satisfied_count,
          tolerating_count = hourly_metrics.tolerating_count + EXCLUDED.tolerating_count,
          frustrated_count = hourly_metrics.frustrated_count + EXCLUDED.frustrated_count,
          updated_at       = NOW()
      `, [
        group.projectId, group.endpoint, group.method, group.bucket,
        stats.requestCount, stats.errorCount, stats.p50, stats.p95, stats.p99, stats.avg,
        group.satisfied, group.tolerating, group.frustrated
      ]);
    }

    if (projectIds.size > 0) {
      eventBus.emit('aggregation.completed', { projectIds: Array.from(projectIds) });
    }
  }
}