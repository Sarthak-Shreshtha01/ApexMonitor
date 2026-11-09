# 0004. ClickHouse as the telemetry store

- **Status:** Proposed
- **Date:** 2026-11-10

## Context

Telemetry is split across MongoDB (raw request logs, raw RUM) and PostgreSQL (hourly aggregates). Problems:

- Percentiles are stored as scalars and merged incorrectly (KI-8); fixing that in Postgres needs custom sketch types or extensions.
- Mongo `skip/limit` and `countDocuments` degrade on large collections; full-text search is limited.
- Self-hosters must operate five stateful services (PG, Mongo, Redis, RabbitMQ, plus the app).
- The roadmap adds spans, structured logs, and infra metrics, all high-volume, append-only, and analytical.

## Decision

- Store all telemetry (request events, spans, logs, RUM events, metric rollups) in **ClickHouse**.
  - Raw tables: `MergeTree`, ordered by `(project_id, timestamp)`, TTL per plan.
  - Rollups: materialised views into `AggregatingMergeTree` with `quantilesTDigestState` / `uniqState` for 1 m / 1 h / 1 d.
  - Dedup: `event_id` with `ReplacingMergeTree` or insert-dedup tokens per batch.
- PostgreSQL keeps metadata only: users, orgs, projects, keys, rules, billing, audit, jobs.
- Retire MongoDB once data is migrated.

## Alternatives considered

| Option | Pros | Cons |
|---|---|---|
| Keep PG + Mongo, fix math | No new tech | Doesn't scale to spans/logs; two telemetry stores |
| TimescaleDB | Postgres-compatible, continuous aggregates | Weaker for logs/full-text and very wide events; percentile sketches via toolkit extension |
| Elasticsearch/OpenSearch | Strong search | Expensive to run; weak aggregations at scale |
| Managed (BigQuery etc.) | No ops | Not self-hostable; cost per query |

## Consequences

- Correct mergeable percentiles and fast aggregations at volume.
- One fewer service for self-hosters (Mongo removed).
- New operational skill (ClickHouse); need a migration path and dual-write window.
- Query layer rewritten for metrics/logs/traces/RUM repositories.
