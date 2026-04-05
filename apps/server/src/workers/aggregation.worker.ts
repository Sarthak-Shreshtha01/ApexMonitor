import { getChannel } from '@infrastructure/rabbitmq';
import { getPg } from '@infrastructure/db/postgres';
import { eventBus } from '@events/event-bus';
import { computeBatchStats } from '@shared/utils/math.utils';
import { LogEntry } from '@modules/ingest/dto/ingest-batch.dto';

export class AggregationWorker {
  private readonly QUEUE = 'aggregation_queue';
  private readonly PREFETCH = 100;

  async start(): Promise<void> {
    const channel = getChannel();
    await channel.prefetch(this.PREFETCH);
    console.log(`👷 [Worker] AggregationWorker started, consuming from ${this.QUEUE}`);

    await channel.consume(this.QUEUE, async (msg) => {
      if (!msg) return;

      try {
        const batch: (LogEntry & { projectId: string })[] = JSON.parse(msg.content.toString());
        await this.processBatch(batch);
        channel.ack(msg);
      } catch (error) {
        console.error('❌ [AggregationWorker] Processing failed, sending to DLQ:', error);
        channel.nack(msg, false, false); // Send to dead-letter queue
      }
    });
  }

  private async processBatch(batch: (LogEntry & { projectId: string })[]): Promise<void> {
    const pg = getPg();

    // 1. Group logs by: Project + Endpoint + Method + HourBucket
    const grouped = new Map<string, { latencies: number[], statusCodes: number[], bucket: Date, projectId: string, endpoint: string, method: string }>();

    for (const log of batch) {
      const date = new Date(log.timestamp);
      const hourBucket = new Date(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours());
      
      const key = `${log.projectId}|${log.endpoint}|${log.method}|${hourBucket.getTime()}`;
      
      if (!grouped.has(key)) {
        grouped.set(key, { latencies: [], statusCodes: [], bucket: hourBucket, projectId: log.projectId, endpoint: log.endpoint, method: log.method });
      }
      
      const group = grouped.get(key)!;
      group.latencies.push(log.latencyMs);
      group.statusCodes.push(log.statusCode);
    }

    // 2. Compute stats and UPSERT into PostgreSQL
    const projectIds = new Set<string>();

    for (const group of grouped.values()) {
      projectIds.add(group.projectId);
      const stats = computeBatchStats(group.latencies, group.statusCodes);

      // UPSERT Hourly Metrics
      await pg.query(`
        INSERT INTO hourly_metrics 
          (project_id, endpoint, method, hour_bucket, request_count, error_count, p50_ms, p95_ms, p99_ms, avg_ms, rps_peak)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (project_id, endpoint, method, hour_bucket) 
        DO UPDATE SET 
          request_count = hourly_metrics.request_count + EXCLUDED.request_count,
          error_count   = hourly_metrics.error_count + EXCLUDED.error_count,
          p99_ms        = GREATEST(hourly_metrics.p99_ms, EXCLUDED.p99_ms),
          p95_ms        = GREATEST(hourly_metrics.p95_ms, EXCLUDED.p95_ms),
          avg_ms        = (hourly_metrics.avg_ms + EXCLUDED.avg_ms) / 2.0,
          updated_at    = NOW()
      `, [
        group.projectId, group.endpoint, group.method, group.bucket,
        stats.requestCount, stats.errorCount, stats.p50, stats.p95, stats.p99, stats.avg, 0
      ]);

      // (Note: In a full production implementation, we would repeat this exact query block for `five_minute_metrics`)
    }

    // 3. Emit event to invalidate Redis dashboard cache
    if (projectIds.size > 0) {
      eventBus.emit('aggregation.completed', { projectIds: Array.from(projectIds) });
    }
  }
}