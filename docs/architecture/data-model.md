# Data Model

Source of truth: `scripts/init-postgres.sql` + `scripts/migrate-v*.sql`, Mongoose schemas in `apps/server/src/modules/{logs,rum}/*.schema.ts`, Redis key usage across `apps/server/src`, topology in `apps/server/src/infrastructure/rabbitmq.ts`.

## PostgreSQL

```mermaid
erDiagram
    users ||--o{ projects : owns
    users ||--o| subscriptions : has
    projects ||--o{ project_members : has
    projects ||--o{ api_keys : has
    projects ||--o{ rum_public_keys : has
    alert_rules ||--o{ alert_events : triggers
    projects ||..o{ hourly_metrics : "project_id (no FK)"
    projects ||..o{ hourly_rum_metrics : "project_id (no FK)"
    projects ||..o{ insights : "project_id (no FK)"
    projects ||..o{ alert_rules : "project_id (no FK)"
```

### Identity and tenancy

| Table | Key columns | Notes |
|---|---|---|
| `users` | `id` PK, `email` unique, `password_hash`, `name`, `company`, `job_title`, `timezone` | v2 + v4 migrations |
| `projects` | `id` PK (`proj_…`), `name`, `owner_user_id` → users (RESTRICT), `plan`, `rate_limit_rpm`, `log_retention_days` (90) | `plan`, `rate_limit_rpm`, `log_retention_days` aren't read by code yet |
| `project_members` | `project_id` → projects (CASCADE), `user_id`, `role` (`owner`/`developer`), unique(project,user) | `user_id` has no FK |
| `subscriptions` | `user_id` PK → users (CASCADE), `plan_tier` (`FREE`/`PRO`), `last_tx_id`, `payment_status` | Per user, not per org |
| `audit_logs` | `actor_user_id`, `project_id`, `action`, `resource_type`, `resource_id`, `metadata` jsonb, `ip_address`, `user_agent` | Written by `shared/services/audit-log.service.ts` |

### Credentials

| Table | Key columns | Notes |
|---|---|---|
| `api_keys` | `project_id`, `key_prefix` (10 chars, indexed), `key_hash` (argon2id, unique), `label`, `last_used_at`, `revoked_at` | Ingest keys `proj_…` |
| `rum_public_keys` | as above + `allowed_origins text[]` | Browser write keys |

### Telemetry aggregates

| Table | Grain (unique key) | Measures |
|---|---|---|
| `hourly_metrics` | project, endpoint, method, hour_bucket | request_count, error_count, p50/p95/p99/avg_ms, rps_peak, satisfied/tolerating/frustrated counts |
| `five_minute_metrics` | project, endpoint, method, bucket | request_count, error_count, avg_ms (**never written**, KI-24) |
| `hourly_rum_metrics` | project, path, device_type, browser_name, country_code, region_code, referrer_source, hour_bucket | page_views, unique_visitors, unique_sessions, avg + sample counts for TTFB/FCP/LCP |
| view `hourly_apdex` | from hourly_metrics | `(satisfied + tolerating/2) / total` |

### Alerting and insights

| Table | Key columns |
|---|---|
| `alert_rules` | `project_id`, `name`, `condition_type` (`error_rate_high`, `latency_p99_high`), `endpoint_filter`, `threshold`, `window_minutes`, `notify_email`, `notify_webhook`, `is_active` |
| `alert_events` | `alert_rule_id` → alert_rules (CASCADE), `project_id`, `message`, `metadata`, `triggered_at` |
| `insights` | `project_id`, `endpoint`, `severity`, `type` (`latency_spike`, …), `message`, `metadata`, `is_read` |

## MongoDB

| Collection | Model | Fields | Indexes / TTL |
|---|---|---|---|
| `api_logs` | `ApiLog` (`modules/logs/logs.schema.ts`) | reqId (unique), projectId, method, endpoint, statusCode, latencyMs, ip (hashed), userAgent, region (`XX`), timestamp, sdkVersion, tags | (projectId, timestamp), (projectId, endpoint, timestamp), (projectId, statusCode, timestamp); **TTL 90 days** on timestamp |
| `rum_raw_events` | `RumRawEvent` (`modules/rum/rum.schema.ts`) | eventId (unique), projectId, type, path, referrerSource, sessionHash, visitorHash, ttfb/fcp/lcpMs, browserName, osName, deviceType, countryCode, regionCode, timestamp, sdkVersion, ingestedAt | (projectId, timestamp), (projectId, path, timestamp); **TTL 7 days** on ingestedAt |

## Redis keys

| Pattern | Type | TTL | Writer → Reader |
|---|---|---|---|
| `api_key_cache:<rawKey>` | string (projectId) | 300 s | auth.service |
| `rum_key_cache:<rawKey>` | string | 300 s | auth.service |
| `project_owner:<projectId>` | string | 3600 s | ingest.service |
| `tier:<userId>` | string | 3600 s | ingest.service; deleted by billing webhook |
| `rate:<projectId>` | counter | 60 s | ingest.service |
| `rate:rum:<projectId>:<YYYY-MM-DDTHH:MM>` | counter | 120 s | rum.service |
| `ingest:idempotency:<projectId>:<key>` | JSON | 300 s | ingest.service |
| `rum:idempotency:<projectId>:<key>` | string (batchId) | 300 s | rum.service |
| `live:<projectId>:requests` / `:errors` / `:latency_total` | counter / float | 5 s | ingest.service → websocket |
| `live:<projectId>:endpoints` | sorted set | 8 s | ingest.service → websocket |
| `baseline:<projectId>:<endpoint>:p99` | list (≤20) | 3600 s | anomaly.worker |
| `rum:hll:*` | HyperLogLog | n/a | rum.worker |
| `metrics:<projectId>:<view>:…` | JSON | short | metrics.service (query cache) |

Redis is started with `maxmemory 256mb` and `allkeys-lru` in compose, so **any** key, including rate limits and idempotency locks, can be evicted under memory pressure.

## RabbitMQ topology

| Exchange | Type | Durable |
|---|---|---|
| `logs.exchange` | direct | yes |
| `dlq.exchange` | direct | yes |
| `ws.fanout` | fanout | no (declared, unused) |

| Queue | Bound to (routing key) | DLQ | Message TTL |
|---|---|---|---|
| `raw_log_queue` | logs.exchange (`log.ingest`) | `raw_log_dlq` | 24 h |
| `aggregation_queue` | logs.exchange (`log.ingest`) | `aggregation_dlq` | 24 h |
| `anomaly_queue` | logs.exchange (`log.ingest`) | `anomaly_dlq` | 24 h |
| `rum_queue` | logs.exchange (`rum.ingest`) | `rum_dlq` | 24 h |

DLQs are declared but **not bound** to `dlq.exchange`. Dead-lettered messages are routed with `deadLetterRoutingKey=<name>_dlq` to `dlq.exchange`, which has no bindings, so they're dropped (KI-32).

### Message shapes

- `log.ingest`: JSON array of normalised logs `{reqId, projectId, method, endpoint, statusCode, latencyMs, ip, userAgent, region, timestamp, sdkVersion, tags}`; headers `projectId`, `sdkVersion`, `idempotencyKey`; `messageId = correlationId = batchId`.
- `rum.ingest`: `{batchId, projectId, events: RumEnrichedEvent[], receivedAt}`.

Neither message carries a schema version.

## Retention summary

| Data | Retention | Mechanism |
|---|---|---|
| Raw request logs | 90 days | Mongo TTL index (not per plan) |
| Raw RUM events | 7 days | Mongo TTL index |
| Hourly aggregates, insights, alert events, audit logs | forever | none |
