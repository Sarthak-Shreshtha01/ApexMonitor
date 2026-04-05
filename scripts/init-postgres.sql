-- Trigger function for auto-updating timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- ==========================================
-- Core Domain Tables
-- ==========================================

-- Table 1: projects
CREATE TABLE IF NOT EXISTS projects (
    id             VARCHAR(64)  PRIMARY KEY,           
    name           VARCHAR(255) NOT NULL,
    owner_user_id  VARCHAR(64)  NOT NULL,
    plan           VARCHAR(32)  NOT NULL DEFAULT 'free', 
    rate_limit_rpm INTEGER      NOT NULL DEFAULT 60000, 
    log_retention_days INTEGER  NOT NULL DEFAULT 90,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Table 2: api_keys
CREATE TABLE IF NOT EXISTS api_keys (
    id             BIGSERIAL    PRIMARY KEY,
    project_id     VARCHAR(64)  NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    key_prefix     VARCHAR(10)  NOT NULL,               
    key_hash       VARCHAR(255) NOT NULL UNIQUE,        
    label          VARCHAR(100),                        
    last_used_at   TIMESTAMPTZ,
    revoked_at     TIMESTAMPTZ,                         
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_api_keys_prefix ON api_keys (key_prefix);
CREATE INDEX IF NOT EXISTS idx_api_keys_project ON api_keys (project_id);

-- Table 3: project_members
CREATE TABLE IF NOT EXISTS project_members (
    id         BIGSERIAL   PRIMARY KEY,
    project_id VARCHAR(64) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id    VARCHAR(64) NOT NULL,
    role       VARCHAR(20) NOT NULL DEFAULT 'developer', 
    invited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(project_id, user_id)
);

-- ==========================================
-- Metrics & Time-Series Tables
-- ==========================================

-- Table 4: hourly_metrics
CREATE TABLE IF NOT EXISTS hourly_metrics (
    id             BIGSERIAL    PRIMARY KEY,
    project_id     VARCHAR(64)  NOT NULL,
    endpoint       VARCHAR(512) NOT NULL,
    method         VARCHAR(10)  NOT NULL,
    hour_bucket    TIMESTAMPTZ  NOT NULL, 
    request_count  INTEGER      NOT NULL DEFAULT 0,
    error_count    INTEGER      NOT NULL DEFAULT 0,
    p50_ms         FLOAT        NOT NULL DEFAULT 0,
    p95_ms         FLOAT        NOT NULL DEFAULT 0,
    p99_ms         FLOAT        NOT NULL DEFAULT 0,
    avg_ms         FLOAT        NOT NULL DEFAULT 0,
    rps_peak       FLOAT        NOT NULL DEFAULT 0,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE(project_id, endpoint, method, hour_bucket)
);
CREATE INDEX IF NOT EXISTS idx_hm_project_time   ON hourly_metrics (project_id, hour_bucket DESC);
CREATE INDEX IF NOT EXISTS idx_hm_endpoint       ON hourly_metrics (project_id, endpoint, hour_bucket DESC);

-- Apply trigger to hourly_metrics
DROP TRIGGER IF EXISTS update_hourly_metrics_updated_at ON hourly_metrics;
CREATE TRIGGER update_hourly_metrics_updated_at 
BEFORE UPDATE ON hourly_metrics 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Table 5: five_minute_metrics 
CREATE TABLE IF NOT EXISTS five_minute_metrics (
    id             BIGSERIAL    PRIMARY KEY,
    project_id     VARCHAR(64)  NOT NULL,
    endpoint       VARCHAR(512) NOT NULL,
    method         VARCHAR(10)  NOT NULL,
    bucket         TIMESTAMPTZ  NOT NULL,  
    request_count  INTEGER      NOT NULL DEFAULT 0,
    error_count    INTEGER      NOT NULL DEFAULT 0,
    avg_ms         FLOAT        NOT NULL DEFAULT 0,
    UNIQUE(project_id, endpoint, method, bucket)
);
-- Note: SRS specifies a partial index here to automatically drop old data from the index tree
CREATE INDEX IF NOT EXISTS idx_5m_project_recent 
ON five_minute_metrics (project_id, bucket DESC);-- WHERE bucket > NOW() - INTERVAL '7 days';

-- ==========================================
-- Alerts & Insights Tables
-- ==========================================

-- Table 6: insights
CREATE TABLE IF NOT EXISTS insights (
    id           BIGSERIAL    PRIMARY KEY,
    project_id   VARCHAR(64)  NOT NULL,
    endpoint     VARCHAR(512),
    severity     VARCHAR(20)  NOT NULL DEFAULT 'info', 
    type         VARCHAR(50)  NOT NULL,  
    message      TEXT         NOT NULL,
    metadata     JSONB        NOT NULL DEFAULT '{}',
    is_read      BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_insights_project ON insights (project_id, created_at DESC);

-- Table 7: alert_rules
CREATE TABLE IF NOT EXISTS alert_rules (
    id              BIGSERIAL    PRIMARY KEY,
    project_id      VARCHAR(64)  NOT NULL,
    name            VARCHAR(100) NOT NULL,
    condition_type  VARCHAR(50)  NOT NULL, 
    endpoint_filter VARCHAR(512),          
    threshold       FLOAT        NOT NULL,
    window_minutes  INTEGER      NOT NULL DEFAULT 5,
    notify_email    VARCHAR(255),
    notify_webhook  TEXT,
    is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Table 8: alert_events 
CREATE TABLE IF NOT EXISTS alert_events (
    id            BIGSERIAL   PRIMARY KEY,
    alert_rule_id BIGINT      NOT NULL REFERENCES alert_rules(id) ON DELETE CASCADE,
    project_id    VARCHAR(64) NOT NULL,
    message       TEXT        NOT NULL,
    metadata      JSONB       NOT NULL DEFAULT '{}',
    triggered_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ae_project ON alert_events (project_id, triggered_at DESC);