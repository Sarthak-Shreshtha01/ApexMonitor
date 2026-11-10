# Runbooks

Concise responses to known failure modes. Each entry: **symptoms → check → act → follow-up**. Add a runbook after every incident that didn't have one.

Useful endpoints: `GET /ready` (dependency status), `GET /metrics/system` (queue depths, consumers). RabbitMQ UI: port 15672.

---

## Ingest returns 202 but dashboards show no new data

- **Check:** `/metrics/system` queue counts. Are `raw_log_queue` / `aggregation_queue` growing? Are consumers 0?
- **Check:** server logs for `[AggregationWorker] Processing failed` / `[RawLogWorker]`.
- **Act:** consumers 0 → check the logs for `[RabbitMQ] Reconnect failed` (the server is still trying) and `/ready`. Errors → inspect the failing message shape.
- **Check:** `*_dlq` counts in `/metrics/system`. Rejected messages are kept there; see *Messages piling up in a dead-letter queue*.

## RabbitMQ restarted or unreachable

- **Symptoms:** ingest and RUM return `503 SERVICE_UNAVAILABLE` with `Retry-After: 5`; `/ready` is 503; logs show `[RabbitMQ] Lost connection … reconnecting` and `Reconnect failed` lines.
- **Act:** bring RabbitMQ back. The server reconnects by itself (backoff 1 s doubling to 30 s), redeclares the topology and restarts every consumer; `[RabbitMQ] Reconnected` in the logs and `/ready` 200 confirm it. No restart needed.
- **Data impact:** none for clients that retry: a batch gets 202 only after RabbitMQ has confirmed it. The SDKs retry 503. Messages a worker had not acked yet are redelivered after the reconnect.

## Messages piling up in a dead-letter queue

- **Symptoms:** a `*_dlq` count in `/metrics/system` is above 0 and growing.
- **Check:** look at a few messages in the RabbitMQ UI (Queues → `<name>_dlq` → *Get messages*, ack mode *Nack message requeue true* so they stay). The `x-death` header says why (`rejected` = the worker failed; `expired` = it waited over 24 h). Match the time with worker errors in the server logs.
- **Act:** fix the cause first (dependency down, bad deploy, malformed payload). Then move the messages back to the **worker queue, not the exchange**, so other workers don't process them twice: enable the shovel plugin (`rabbitmq-plugins enable rabbitmq_shovel rabbitmq_shovel_management`) and use *Move messages* on the DLQ page with destination queue `<name>_queue` (e.g. `aggregation_dlq` → `aggregation_queue`). Purge messages that can never succeed (malformed JSON).
- **Note:** raw-log inserts are idempotent; aggregation replays add to existing counters, so replay each message once.

## Redis unavailable or evicting

- **Symptoms:** ingest/RUM 500s, auth slow (cache misses → argon2 per request), live traffic blank.
- **Check:** `redis-cli INFO memory`, `evicted_keys`.
- **Act:** restore Redis; raise `maxmemory` if evictions are high (compose sets 256 MB + `allkeys-lru`, so rate-limit and idempotency keys can be evicted).
- **Note:** rate limits reset and idempotency guarantees lapse during an outage.

## PostgreSQL unavailable

- **Symptoms:** login, dashboards, aggregation fail; aggregation messages are rejected into `aggregation_dlq`.
- **Act:** restore PG; restart API if the pool doesn't recover.
- **Follow-up:** replay `aggregation_dlq` once PG is back (see *Messages piling up in a dead-letter queue*).

## MongoDB unavailable

- **Symptoms:** logs/traces pages fail; `RawLogWorker` rejects batches into `raw_log_dlq` (replay after recovery).
- **Act:** restore Mongo. Aggregates in PG are unaffected.

## Ingest 429s for a customer

- **Check:** `GET rate:<projectId>` in Redis; owner tier `GET tier:<ownerId>`.
- **Note:** limit counts **batches**, not events (KI-19). Upgrade path: `subscriptions.plan_tier = 'PRO'` then `DEL tier:<ownerId>`.

## Alert flapping (triggered / resolved over and over)

- **Cause:** a rule only notifies on state changes, so repeated notifications mean the metric keeps crossing the threshold (often a small window with little traffic).
- **Check:** `SELECT kind, value, triggered_at FROM alert_events WHERE alert_rule_id = … ORDER BY triggered_at DESC LIMIT 20;`
- **Act:** ask the owner to widen `windowMinutes` or adjust the threshold (`PATCH /api/v1/alerts/rules/:id`). To silence it now: `PATCH … {"isActive": false}` (or `UPDATE alert_rules SET is_active = false WHERE id = …`).

## Suspected leaked API key

1. Revoke the key from the dashboard or `DELETE /api/v1/keys/:id`. It stops working immediately.
2. If you revoked it directly in SQL instead (`UPDATE api_keys SET revoked_at = NOW() WHERE id = …`), also clear the cache: `redis-cli SET api_key:revoked:<id> 1 EX 600`, then `redis-cli DEL api_key:cache:$(redis-cli GET api_key:ref:<id>) api_key:ref:<id>`. Otherwise it keeps working for up to 5 minutes.
3. Issue a new key; check `audit_logs` and `api_keys.last_used_at`.

## Rotating `JWT_SECRET`

Invalidates all access tokens (15 min) and, when `JWT_REFRESH_SECRET` is unset, all refresh tokens too, which logs every user out. Announce, rotate, restart all API instances. Set `JWT_REFRESH_SECRET` explicitly if you want to rotate access keys without forcing re-login.

## Rotating `ARGON2_PEPPER`

**Invalidates every API and RUM key.** Only do this on a confirmed pepper leak; coordinate key reissue with all customers.

## Restoring from backup

1. Stop API/workers.
2. Restore PG (`pg_restore`) and Mongo (`mongorestore`) to the same point in time.
3. Flush Redis caches: `FLUSHDB` (rate limits, caches, baselines rebuild).
4. Purge queues or let them drain after restart.
5. Start API, verify `/ready`, spot-check a tenant's dashboard.
