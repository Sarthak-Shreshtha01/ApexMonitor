import { getChannel } from '@infrastructure/rabbitmq';
import { getRedis } from '@infrastructure/redis';
import { eventBus } from '@events/event-bus';
import { LogEntry } from '@modules/ingest/dto/ingest-batch.dto';
import { computeBatchStats } from '@shared/utils/math.utils';
import { calculateZScore } from '@shared/utils/anomaly.utils';
import { InsightsRepository } from '@modules/insights/insights.repository';

export class AnomalyWorker {
  private readonly QUEUE = 'anomaly_queue';
  private readonly PREFETCH = 50;
  private insightsRepo = new InsightsRepository();

  async start(): Promise<void> {
    const channel = getChannel();
    await channel.prefetch(this.PREFETCH);
    console.log(`👷 [Worker] AnomalyWorker started, consuming from ${this.QUEUE}`);

    await channel.consume(this.QUEUE, async (msg) => {
      if (!msg) return;

      try {
        const batch: (LogEntry & { projectId: string })[] = JSON.parse(msg.content.toString());
        await this.detectAnomalies(batch);
        channel.ack(msg);
      } catch (error) {
        console.error('❌ [AnomalyWorker] Processing failed:', error);
        channel.nack(msg, false, false);
      }
    });
  }

  private async detectAnomalies(batch: (LogEntry & { projectId: string })[]): Promise<void> {
    const redis = getRedis();
    
    // 1. Group by endpoint (similar to AggregationWorker)
    const grouped = new Map<string, { latencies: number[], projectId: string, endpoint: string }>();
    
    for (const log of batch) {
      const key = `${log.projectId}|${log.endpoint}`;
      if (!grouped.has(key)) {
        grouped.set(key, { latencies: [], projectId: log.projectId, endpoint: log.endpoint });
      }
      grouped.get(key)!.latencies.push(log.latencyMs);
    }

    // 2. Evaluate each endpoint group
    for (const group of grouped.values()) {
      const currentStats = computeBatchStats(group.latencies, []);
      const historyKey = `baseline:${group.projectId}:${group.endpoint}:p99`;

      // 3. Fetch historical P99s from Redis (List type)
      const historyStrings = await redis.lrange(historyKey, 0, -1);
      const history = historyStrings.map(Number);

      // 4. Calculate Z-Score
      const zScore = calculateZScore(currentStats.p99, history);

      // 5. Trigger Insight if Z-Score is extremely high (> 3.0)
      if (zScore > 3.0) {
        const message = `Latency spike detected on ${group.endpoint}. Current P99 is ${currentStats.p99}ms (Z-Score: ${zScore.toFixed(2)}).`;
        
        await this.insightsRepo.createInsight({
          projectId: group.projectId,
          endpoint: group.endpoint,
          severity: 'warning',
          type: 'latency_spike',
          message,
          metadata: { currentP99: currentStats.p99, zScore }
        });

        // Broadcast internally so the WebSocket engine can pick it up
        eventBus.emit('anomaly.detected', {
          projectId: group.projectId,
          endpoint: group.endpoint,
          type: 'latency_spike',
          meta: { message }
        });
        
        console.log(`⚠️ [Anomaly] ${message}`);
      }

      // 6. Update the baseline moving window (keep last 20 data points)
      await redis.rpush(historyKey, currentStats.p99);
      await redis.ltrim(historyKey, -20, -1); // Keep array size small
      await redis.expire(historyKey, 3600);   // Baseline expires after 1 hour of no traffic
    }
  }
}