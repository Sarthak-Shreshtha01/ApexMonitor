/**
 * SQL fragments for reading latency statistics across many `hourly_metrics` rows
 * (several hours and/or endpoints). Averaging per-row averages or taking MAX of per-row
 * percentiles gives wrong numbers (KI-8); these merge the underlying sums and histograms
 * instead. Use inside a SELECT ... FROM hourly_metrics ... with GROUP BY as needed.
 */

/** Request-weighted mean latency in ms. */
export const SQL_AVG_LATENCY_MS = 'COALESCE(SUM(latency_sum_ms) / NULLIF(SUM(request_count), 0), 0)';

/**
 * q-quantile (0..1) of all requests in the group, from the merged histograms.
 * Rows written before migration v7 have no histogram; for those the old per-row column
 * (`fallbackColumn`) is used via MAX as a last resort.
 */
export function sqlLatencyPercentile(q: 0.5 | 0.95 | 0.99, fallbackColumn: 'p50_ms' | 'p95_ms' | 'p99_ms'): string {
  return `COALESCE(apex_hist_percentile(apex_hist_sum(latency_hist), ${q}, MIN(latency_min_ms), MAX(latency_max_ms)), MAX(${fallbackColumn}), 0)`;
}
