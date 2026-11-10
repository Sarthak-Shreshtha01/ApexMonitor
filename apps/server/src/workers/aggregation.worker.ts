import { consume } from '@infrastructure/rabbitmq';
import { getPg } from '@infrastructure/db/postgres';
import { eventBus } from '@events/event-bus';
import { computeBatchStats, latencyHistogram } from '@shared/utils/math.utils';
import { LogEntry } from '@modules/ingest/dto/ingest-batch.dto';

// Apdex Thresholds
const APDEX_T_MS = 500;
const APDEX_4T_MS = 2000;
const HOUR_MS = 3_600_000;

export class AggregationWorker {
  private readonly QUEUE = 'aggregation_queue';
  private readonly PREFETCH = 100;

  async start(): Promise<void> {
    console.log(`👷 [Worker] AggregationWorker (v2) started, consuming from ${this.QUEUE}`);

    // Own channel with PREFETCH unacked messages at most; restarted automatically after a reconnect.
    await consume(this.QUEUE, this.PREFETCH, async (msg, channel) => {
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
      // UTC hour, independent of the server's timezone (KI-9).
      const hourBucket = new Date(Math.floor(new Date(log.timestamp).getTime() / HOUR_MS) * HOUR_MS);
      
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

      const latencySum = group.latencies.reduce((sum: number, v: number) => sum + v, 0);
      const histogram = latencyHistogram(group.latencies);

      // Every statistic here can be merged exactly across batches (KI-8):
      //   counts and latency_sum_ms add up, min/max use LEAST/GREATEST, histograms add
      //   element-wise; avg and percentiles are then recomputed from the merged values.
      // (In ON CONFLICT, the right-hand side sees the old row, so the merge is repeated
      // inside each derived column.)
      await pg.query(`
        INSERT INTO hourly_metrics
          (project_id, endpoint, method, hour_bucket, request_count, error_count,
           latency_sum_ms, latency_min_ms, latency_max_ms, latency_hist,
           avg_ms, p50_ms, p95_ms, p99_ms,
           satisfied_count, tolerating_count, frustrated_count)
        VALUES ($1, $2, $3, $4, $5::int, $6,
                $7::float8, $8::float8, $9::float8, $10::int[],
                $7::float8 / $5::int,
                apex_hist_percentile($10::int[], 0.50, $8::float8, $9::float8),
                apex_hist_percentile($10::int[], 0.95, $8::float8, $9::float8),
                apex_hist_percentile($10::int[], 0.99, $8::float8, $9::float8),
                $11, $12, $13)
        ON CONFLICT (project_id, endpoint, method, hour_bucket)
        DO UPDATE SET
          request_count    = hourly_metrics.request_count + EXCLUDED.request_count,
          error_count      = hourly_metrics.error_count + EXCLUDED.error_count,
          latency_sum_ms   = hourly_metrics.latency_sum_ms + EXCLUDED.latency_sum_ms,
          latency_min_ms   = LEAST(hourly_metrics.latency_min_ms, EXCLUDED.latency_min_ms),
          latency_max_ms   = GREATEST(hourly_metrics.latency_max_ms, EXCLUDED.latency_max_ms),
          latency_hist     = apex_hist_add(hourly_metrics.latency_hist, EXCLUDED.latency_hist),
          avg_ms           = (hourly_metrics.latency_sum_ms + EXCLUDED.latency_sum_ms)
                             / (hourly_metrics.request_count + EXCLUDED.request_count),
          p50_ms           = COALESCE(apex_hist_percentile(apex_hist_add(hourly_metrics.latency_hist, EXCLUDED.latency_hist), 0.50,
                               LEAST(hourly_metrics.latency_min_ms, EXCLUDED.latency_min_ms),
                               GREATEST(hourly_metrics.latency_max_ms, EXCLUDED.latency_max_ms)), EXCLUDED.p50_ms),
          p95_ms           = COALESCE(apex_hist_percentile(apex_hist_add(hourly_metrics.latency_hist, EXCLUDED.latency_hist), 0.95,
                               LEAST(hourly_metrics.latency_min_ms, EXCLUDED.latency_min_ms),
                               GREATEST(hourly_metrics.latency_max_ms, EXCLUDED.latency_max_ms)), EXCLUDED.p95_ms),
          p99_ms           = COALESCE(apex_hist_percentile(apex_hist_add(hourly_metrics.latency_hist, EXCLUDED.latency_hist), 0.99,
                               LEAST(hourly_metrics.latency_min_ms, EXCLUDED.latency_min_ms),
                               GREATEST(hourly_metrics.latency_max_ms, EXCLUDED.latency_max_ms)), EXCLUDED.p99_ms),
          satisfied_count  = hourly_metrics.satisfied_count + EXCLUDED.satisfied_count,
          tolerating_count = hourly_metrics.tolerating_count + EXCLUDED.tolerating_count,
          frustrated_count = hourly_metrics.frustrated_count + EXCLUDED.frustrated_count,
          updated_at       = NOW()
      `, [
        group.projectId, group.endpoint, group.method, group.bucket,
        stats.requestCount, stats.errorCount,
        latencySum, Math.min(...group.latencies), Math.max(...group.latencies), histogram,
        group.satisfied, group.tolerating, group.frustrated
      ]);
    }

    if (projectIds.size > 0) {
      eventBus.emit('aggregation.completed', { projectIds: Array.from(projectIds) });
    }
  }
}