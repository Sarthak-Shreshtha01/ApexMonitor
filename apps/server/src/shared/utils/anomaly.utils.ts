import { LATENCY_HIST_GROWTH } from './math.utils';

/** Tuning for latency anomaly detection (workers/anomaly.worker.ts). */
export const ANOMALY = {
  /** Previous minutes the baseline is built from. */
  BASELINE_MINUTES: 30,
  /** Minutes of history needed before anything is flagged. */
  MIN_BASELINE_MINUTES: 5,
  /** Minutes with fewer requests are too noisy to be a baseline point or a spike. */
  MIN_REQUESTS_PER_MINUTE: 3,
  Z_THRESHOLD: 3,
  /** A spike must also be this many times the usual p99 ... */
  MIN_RATIO: 1.5,
  /** ... and this many milliseconds above it, so tiny endpoints don't alert on jitter. */
  MIN_INCREASE_MS: 50,
  /** Spread assumed at least this fraction of the mean, so a perfectly flat baseline still works. */
  MIN_RELATIVE_STDDEV: 0.1,
  /** Only minutes this close to now are evaluated; older ones (late or backfilled data) only feed baselines. */
  EVALUATE_RECENT_MINUTES: 2,
  COOLDOWN_SECONDS: 300,
  /** Per-minute histograms live a little longer than the baseline window. */
  HIST_TTL_SECONDS: (30 + 5) * 60,
} as const;

/**
 * Calculates the Z-Score of a value against a historical dataset.
 * A Z-Score > 3 is generally considered a significant anomaly.
 */
export function calculateZScore(currentValue: number, history: number[]): number {
  if (history.length < 5) return 0; // Not enough data points to form a baseline

  const mean = history.reduce((acc, val) => acc + val, 0) / history.length;

  // Calculate Standard Deviation
  const variance = history.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / history.length;
  const standardDeviation = Math.sqrt(variance);

  if (standardDeviation === 0) return 0; // Prevent division by zero if all historical values are identical

  return (currentValue - mean) / standardDeviation;
}

/**
 * Percentile `q` (0–1) from a log-scale latency histogram (math.utils#latencyHistogram):
 * the upper bound of the bucket holding the q-th request, within ~10% of the true value.
 */
export function histogramPercentile(counts: number[], q: number): number {
  const total = counts.reduce((a, b) => a + b, 0);
  if (total === 0) return 0;
  const rank = Math.max(1, Math.ceil(q * total));
  let seen = 0;
  for (let k = 0; k < counts.length; k++) {
    seen += counts[k] ?? 0;
    if (seen >= rank) return k === 0 ? 1 : LATENCY_HIST_GROWTH ** k;
  }
  return LATENCY_HIST_GROWTH ** (counts.length - 1);
}

export interface LatencySpike {
  zScore: number;
  baselineMs: number;
}

/**
 * Is `currentP99` a spike against `history` (p99s of previous minutes)? Needs
 * MIN_BASELINE_MINUTES of history, a z-score above Z_THRESHOLD (with the spread floored at
 * MIN_RELATIVE_STDDEV of the mean), and an increase of at least MIN_RATIO× and MIN_INCREASE_MS.
 */
export function detectLatencySpike(currentP99: number, history: number[]): LatencySpike | null {
  if (history.length < ANOMALY.MIN_BASELINE_MINUTES) return null;
  const mean = history.reduce((a, b) => a + b, 0) / history.length;
  const variance = history.reduce((a, b) => a + (b - mean) ** 2, 0) / history.length;
  const spread = Math.max(Math.sqrt(variance), mean * ANOMALY.MIN_RELATIVE_STDDEV, 1);
  const zScore = (currentP99 - mean) / spread;
  if (zScore <= ANOMALY.Z_THRESHOLD) return null;
  if (currentP99 < mean * ANOMALY.MIN_RATIO || currentP99 - mean < ANOMALY.MIN_INCREASE_MS) return null;
  return { zScore, baselineMs: mean };
}
