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