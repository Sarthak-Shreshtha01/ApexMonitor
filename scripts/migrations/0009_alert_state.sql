-- v8: alert rule state (KI-18)
-- A rule notifies when it starts breaching and again when it recovers, instead of on every
-- evaluation. `state` is what the evaluator compares against; the transition is a
-- conditional UPDATE, so two evaluators can never both send the same notification.
ALTER TABLE alert_rules ADD COLUMN IF NOT EXISTS state             VARCHAR(16) NOT NULL DEFAULT 'ok'; -- ok | firing
ALTER TABLE alert_rules ADD COLUMN IF NOT EXISTS last_value        DOUBLE PRECISION;
ALTER TABLE alert_rules ADD COLUMN IF NOT EXISTS last_evaluated_at TIMESTAMPTZ;
ALTER TABLE alert_rules ADD COLUMN IF NOT EXISTS last_triggered_at TIMESTAMPTZ;
ALTER TABLE alert_rules ADD COLUMN IF NOT EXISTS last_resolved_at  TIMESTAMPTZ;
ALTER TABLE alert_rules ADD COLUMN IF NOT EXISTS updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_alert_rules_project ON alert_rules (project_id);

ALTER TABLE alert_events ADD COLUMN IF NOT EXISTS kind  VARCHAR(16) NOT NULL DEFAULT 'triggered'; -- triggered | resolved
ALTER TABLE alert_events ADD COLUMN IF NOT EXISTS value DOUBLE PRECISION;
CREATE INDEX IF NOT EXISTS idx_ae_rule ON alert_events (alert_rule_id, triggered_at DESC);
