-- v7: mergeable latency statistics for hourly_metrics (KI-8)
--
-- Averages: keep the running sum, so avg = sum / count stays exact when batches merge.
-- Percentiles: keep a log-scale histogram of latencies. Bucket k (array index k+1) holds
-- latencies in (1.1^(k-1), 1.1^k] ms; bucket 0 holds <= 1 ms. Histograms merge by adding
-- counts, so the percentile of a whole hour (or of many rows) can be computed at any time,
-- within ~5%. Estimates are clamped to the exact min/max seen.
-- The bucket layout is mirrored in apps/server/src/shared/utils/math.utils.ts (LATENCY_HIST_*).

ALTER TABLE hourly_metrics ADD COLUMN IF NOT EXISTS latency_sum_ms DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE hourly_metrics ADD COLUMN IF NOT EXISTS latency_min_ms DOUBLE PRECISION;
ALTER TABLE hourly_metrics ADD COLUMN IF NOT EXISTS latency_max_ms DOUBLE PRECISION;
ALTER TABLE hourly_metrics ADD COLUMN IF NOT EXISTS latency_hist   INTEGER[] NOT NULL DEFAULT '{}';

-- Best effort for rows written before v7: their (already approximate) average times count.
UPDATE hourly_metrics SET latency_sum_ms = avg_ms * request_count WHERE latency_sum_ms = 0 AND request_count > 0;

-- Element-wise sum of two histograms of any length.
CREATE OR REPLACE FUNCTION apex_hist_add(a INTEGER[], b INTEGER[]) RETURNS INTEGER[]
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT COALESCE(array_agg(COALESCE(a[i], 0) + COALESCE(b[i], 0) ORDER BY i), '{}')
  FROM generate_series(1, GREATEST(COALESCE(array_length(a, 1), 0), COALESCE(array_length(b, 1), 0))) AS i
$$;

-- Aggregate: merge the histograms of many rows (e.g. all endpoints of a project for 24 h).
CREATE OR REPLACE AGGREGATE apex_hist_sum(INTEGER[]) (SFUNC = apex_hist_add, STYPE = INTEGER[], INITCOND = '{}');

-- q-quantile (0..1) of a histogram, clamped to [lo, hi]. NULL for an empty histogram.
CREATE OR REPLACE FUNCTION apex_hist_percentile(hist INTEGER[], q DOUBLE PRECISION, lo DOUBLE PRECISION, hi DOUBLE PRECISION)
RETURNS DOUBLE PRECISION LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE AS $$
DECLARE
  total  BIGINT := 0;
  target BIGINT;
  cum    BIGINT := 0;
  est    DOUBLE PRECISION;
BEGIN
  IF hist IS NULL OR COALESCE(array_length(hist, 1), 0) = 0 THEN RETURN NULL; END IF;
  SELECT COALESCE(SUM(x), 0) INTO total FROM unnest(hist) AS x;
  IF total = 0 THEN RETURN NULL; END IF;
  target := GREATEST(1, CEIL(q * total));
  FOR i IN 1 .. array_length(hist, 1) LOOP
    cum := cum + COALESCE(hist[i], 0);
    IF cum >= target THEN
      -- representative value: geometric middle of the bucket (bucket 0 → 1 ms)
      est := CASE WHEN i = 1 THEN 1 ELSE power(1.1, (i - 1) - 0.5) END;
      IF lo IS NOT NULL THEN est := GREATEST(est, lo); END IF;
      IF hi IS NOT NULL THEN est := LEAST(est, hi); END IF;
      RETURN round(est::numeric, 1)::double precision;
    END IF;
  END LOOP;
  RETURN hi;
END
$$;
