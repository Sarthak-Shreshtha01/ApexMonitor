import { consume } from '@infrastructure/rabbitmq';
import { getRedis } from '@infrastructure/redis';
import { eventBus } from '@events/event-bus';
import { LogEntry } from '@modules/ingest/dto/ingest-batch.dto';
import { latencyBucket } from '@shared/utils/math.utils';
import { detectLatencySpike, histogramPercentile, ANOMALY } from '@shared/utils/anomaly.utils';
import { InsightsRepository } from '@modules/insights/insights.repository';

type QueuedLog = LogEntry & { projectId: string };

interface MinuteGroup {
  projectId: string;
  method: string;
  endpoint: string;
  minute: number;
  buckets: Map<number, number>;
}

const minuteOf = (timestamp: string) => Math.floor(Date.parse(timestamp) / 60_000);

/** Redis hash: latency histogram (bucket index -> count) of one endpoint in one UTC minute. */
export const minuteHistKey = (projectId: string, method: string, endpoint: string, minute: number) =>
  `anomaly:hist:${projectId}:${method}:${endpoint}:${minute}`;

/** Set while an endpoint is in cooldown after an insight. */
export const cooldownKey = (projectId: string, method: string, endpoint: string) =>
  `anomaly:cooldown:${projectId}:${method}:${endpoint}`;

/**
 * Latency anomaly detection with time-based baselines (KI-27).
 *
 * Each request is counted into a per-minute latency histogram for its method + endpoint,
 * using the request's own timestamp, so the baseline doesn't depend on how the SDK batches.
 * When a batch touches a recent minute, that minute's p99 is compared with the p99s of up to
 * 30 previous minutes (see detectLatencySpike). A spike creates one insight per endpoint
 * per cooldown period.
 */
export class AnomalyWorker {
  private readonly QUEUE = 'anomaly_queue';
  private readonly PREFETCH = 50;
  private insightsRepo = new InsightsRepository();

  constructor(private readonly now: () => number = Date.now) {}

  async start(): Promise<void> {
    console.log(`👷 [Worker] AnomalyWorker started, consuming from ${this.QUEUE}`);

    // Own channel with PREFETCH unacked messages at most; restarted automatically after a reconnect.
    await consume(this.QUEUE, this.PREFETCH, async (msg, channel) => {
      try {
        const batch: QueuedLog[] = JSON.parse(msg.content.toString());
        await this.detectAnomalies(batch);
        channel.ack(msg);
      } catch (error) {
        console.error('❌ [AnomalyWorker] Processing failed:', error);
        channel.nack(msg, false, false);
      }
    });
  }

  private async detectAnomalies(batch: QueuedLog[]): Promise<void> {
    const redis = getRedis();
    const groups = new Map<string, MinuteGroup>();

    for (const log of batch) {
      const minute = minuteOf(log.timestamp);
      if (!Number.isFinite(minute)) continue;
      const key = minuteHistKey(log.projectId, log.method, log.endpoint, minute);
      let group = groups.get(key);
      if (!group) {
        group = { projectId: log.projectId, method: log.method, endpoint: log.endpoint, minute, buckets: new Map() };
        groups.set(key, group);
      }
      const bucket = latencyBucket(log.latencyMs);
      group.buckets.set(bucket, (group.buckets.get(bucket) ?? 0) + 1);
    }
    if (groups.size === 0) return;

    // 1. Record every request first, so a batch that carries both history and a spike is judged on all of it.
    const write = redis.pipeline();
    for (const [key, group] of groups) {
      for (const [bucket, count] of group.buckets) write.hincrby(key, String(bucket), count);
      write.expire(key, ANOMALY.HIST_TTL_SECONDS);
    }
    await write.exec();

    // 2. Evaluate the newest recent minute of each endpoint; older (backfilled) minutes only feed baselines.
    const nowMinute = Math.floor(this.now() / 60_000);
    const latest = new Map<string, MinuteGroup>();
    for (const group of groups.values()) {
      if (group.minute < nowMinute - ANOMALY.EVALUATE_RECENT_MINUTES || group.minute > nowMinute + 1) continue;
      const series = `${group.projectId}|${group.method}|${group.endpoint}`;
      const seen = latest.get(series);
      if (!seen || group.minute > seen.minute) latest.set(series, group);
    }

    for (const group of latest.values()) {
      await this.evaluate(group);
    }
  }

  private async evaluate(group: MinuteGroup): Promise<void> {
    const redis = getRedis();
    const read = redis.pipeline();
    for (let m = group.minute - ANOMALY.BASELINE_MINUTES; m <= group.minute; m++) {
      read.hgetall(minuteHistKey(group.projectId, group.method, group.endpoint, m));
    }
    const results = (await read.exec()) ?? [];
    const minutes = results.map(([, value]) => toCounts(value as Record<string, string> | null));
    const current = minutes.pop()!;
    const history = minutes.filter((h) => h.total >= ANOMALY.MIN_REQUESTS_PER_MINUTE).map((h) => histogramPercentile(h.counts, 0.99));
    if (current.total < ANOMALY.MIN_REQUESTS_PER_MINUTE) return;

    const currentP99 = histogramPercentile(current.counts, 0.99);
    const spike = detectLatencySpike(currentP99, history);
    if (!spike) return;

    // One insight per endpoint per cooldown, however many batches arrive during the spike.
    const fresh = await redis.set(cooldownKey(group.projectId, group.method, group.endpoint), '1', 'EX', ANOMALY.COOLDOWN_SECONDS, 'NX');
    if (fresh !== 'OK') return;

    const label = `${group.method} ${group.endpoint}`;
    const message = `Latency spike on ${label}: p99 ${Math.round(currentP99)} ms this minute vs a usual ${Math.round(spike.baselineMs)} ms (z-score ${spike.zScore.toFixed(1)}).`;

    await this.insightsRepo.createInsight({
      projectId: group.projectId,
      endpoint: group.endpoint,
      severity: 'warning',
      type: 'latency_spike',
      message,
      metadata: {
        method: group.method,
        currentP99: Math.round(currentP99),
        baselineP99: Math.round(spike.baselineMs),
        zScore: Number(spike.zScore.toFixed(2)),
        baselineMinutes: history.length,
        minute: new Date(group.minute * 60_000).toISOString(),
      },
    });

    // Broadcast so the websocket service (on every replica) can push it to dashboards.
    eventBus.emit('anomaly.detected', {
      projectId: group.projectId,
      endpoint: group.endpoint,
      type: 'latency_spike',
      meta: { message, method: group.method },
    });

    console.log(`⚠️ [Anomaly] ${message}`);
  }
}

function toCounts(hash: Record<string, string> | null): { counts: number[]; total: number } {
  const counts: number[] = [];
  let total = 0;
  for (const [bucket, value] of Object.entries(hash ?? {})) {
    const k = Number(bucket);
    const n = Number(value);
    if (!Number.isInteger(k) || k < 0 || !(n > 0)) continue;
    while (counts.length <= k) counts.push(0);
    counts[k] += n;
    total += n;
  }
  return { counts, total };
}
