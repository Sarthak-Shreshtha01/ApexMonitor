export function computePercentile(sortedValues: number[], percentile: number): number {
  if (sortedValues.length === 0) return 0;
  if (sortedValues.length === 1) return sortedValues[0];
  
  const index = (percentile / 100) * (sortedValues.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;

  if (upper === lower) return sortedValues[lower];
  return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
}

export interface BatchStats {
  requestCount: number;
  errorCount: number;
  p50: number;
  p95: number;
  p99: number;
  avg: number;
}

export function computeBatchStats(latencies: number[], statusCodes: number[]): BatchStats {
  const requestCount = latencies.length;
  const errorCount = statusCodes.filter(c => c >= 400).length;
  
  if (requestCount === 0) {
    return { requestCount: 0, errorCount: 0, p50: 0, p95: 0, p99: 0, avg: 0 };
  }

  // Sort ascending for percentile math
  const sortedLatencies = [...latencies].sort((a, b) => a - b);
  const sum = sortedLatencies.reduce((acc, val) => acc + val, 0);

  return {
    requestCount,
    errorCount,
    avg: Math.round(sum / requestCount),
    p50: Math.round(computePercentile(sortedLatencies, 50)),
    p95: Math.round(computePercentile(sortedLatencies, 95)),
    p99: Math.round(computePercentile(sortedLatencies, 99)),
  };
}
/**
 * Log-scale latency histogram, mergeable by adding counts (see scripts/migrations/0008_latency_histograms.sql,
 * which holds the matching percentile function). Bucket 0 holds latencies <= 1 ms;
 * bucket k holds (GROWTH^(k-1), GROWTH^k] ms. With GROWTH 1.1 a percentile read from the
 * histogram is within ~5% of the true value. 140 buckets reach ~568 s; anything slower
 * lands in the last bucket (ingest caps latencyMs at 300 s).
 */
export const LATENCY_HIST_GROWTH = 1.1;
export const LATENCY_HIST_BUCKETS = 140;

export function latencyBucket(latencyMs: number): number {
  if (!(latencyMs > 1)) return 0;
  const k = Math.ceil(Math.log(latencyMs) / Math.log(LATENCY_HIST_GROWTH) - 1e-9);
  return Math.min(LATENCY_HIST_BUCKETS - 1, k);
}

/** Bucket counts for `latencies`, with trailing empty buckets trimmed (merging handles any length). */
export function latencyHistogram(latencies: number[]): number[] {
  const counts: number[] = [];
  for (const latency of latencies) {
    const k = latencyBucket(latency);
    while (counts.length <= k) counts.push(0);
    counts[k] += 1;
  }
  return counts;
}
