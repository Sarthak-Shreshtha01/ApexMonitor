-- v11: drop five_minute_metrics (KI-24)
-- Created by 0001 but never written or read. Dashboards and alerts use hourly_metrics;
-- finer rollup tiers come with the ClickHouse move (plan.md Phase 3) and get their own
-- tables. Dropping the table also drops its index (idx_5m_project_recent).
DROP TABLE IF EXISTS five_minute_metrics;
