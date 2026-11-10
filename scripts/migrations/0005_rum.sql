-- 1) Hourly RUM aggregate storage
CREATE TABLE IF NOT EXISTS hourly_rum_metrics (
  id               BIGSERIAL    PRIMARY KEY,
  project_id       VARCHAR(64)  NOT NULL,
  path             VARCHAR(1024) NOT NULL,
  device_type      VARCHAR(20)  NOT NULL,
  browser_name     VARCHAR(32)  NOT NULL,
  country_code     VARCHAR(2)   NOT NULL DEFAULT 'XX',
  region_code      VARCHAR(16)  NOT NULL DEFAULT 'UNKNOWN',
  referrer_source  VARCHAR(255) NOT NULL DEFAULT 'direct',
  hour_bucket      TIMESTAMPTZ  NOT NULL,
  page_views       INTEGER      NOT NULL DEFAULT 0,
  unique_visitors  INTEGER      NOT NULL DEFAULT 0,
  unique_sessions  INTEGER      NOT NULL DEFAULT 0,
  avg_ttfb_ms      FLOAT,
  avg_fcp_ms       FLOAT,
  avg_lcp_ms       FLOAT,
  ttfb_samples     INTEGER      NOT NULL DEFAULT 0,
  fcp_samples      INTEGER      NOT NULL DEFAULT 0,
  lcp_samples      INTEGER      NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, path, device_type, browser_name, country_code, region_code, referrer_source, hour_bucket)
);

CREATE INDEX IF NOT EXISTS idx_hrm_project_time
  ON hourly_rum_metrics (project_id, hour_bucket DESC);

CREATE INDEX IF NOT EXISTS idx_hrm_project_path_time
  ON hourly_rum_metrics (project_id, path, hour_bucket DESC);

CREATE INDEX IF NOT EXISTS idx_hrm_project_device_time
  ON hourly_rum_metrics (project_id, device_type, browser_name, hour_bucket DESC);

DROP TRIGGER IF EXISTS update_hourly_rum_metrics_updated_at ON hourly_rum_metrics;
CREATE TRIGGER update_hourly_rum_metrics_updated_at
BEFORE UPDATE ON hourly_rum_metrics
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 2) RUM public write keys (browser-safe ingest keys)
CREATE TABLE IF NOT EXISTS public.rum_public_keys (
  id              BIGSERIAL    PRIMARY KEY,
  project_id      VARCHAR(64)  NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  key_prefix      VARCHAR(10)  NOT NULL,
  key_hash        VARCHAR(255) NOT NULL UNIQUE,
  label           VARCHAR(100),
  allowed_origins TEXT[]       NOT NULL DEFAULT '{}',
  last_used_at    TIMESTAMPTZ,
  revoked_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF to_regclass('public.rum_public_keys') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_rum_keys_prefix ON public.rum_public_keys (key_prefix);
    CREATE INDEX IF NOT EXISTS idx_rum_keys_project ON public.rum_public_keys (project_id);
  END IF;
END $$;
