# Runbooks

Concise responses to known failure modes. Each entry: **symptoms → check → act → follow-up**. Add a runbook after every incident that didn't have one.

Useful endpoints: `GET /ready` (dependency status), `GET /metrics/system` (queue depths, consumers). RabbitMQ UI: port 15672.

---

## Ingest returns 202 but dashboards show no new data

- **Check:** `/metrics/system` queue counts. Are `raw_log_queue` / `aggregation_queue` growing? Are consumers 0?
- **Check:** server logs for `[AggregationWorker] Processing failed` / `[RawLogWorker]`.
- **Act:** consumers 0 → restart the server process (workers start at boot; there's no reconnect yet, KI-16). Errors → inspect the failing message shape.
- **Follow-up:** messages rejected by workers are currently **lost** (DLQs unbound, KI-32).

## RabbitMQ restarted or unreachable

- **Symptoms:** ingest 500s ("RabbitMQ channel not created" or channel closed), `/ready` fails.
- **Act:** after RabbitMQ is back, **restart the API process**; the app doesn't reconnect.
- **Data impact:** batches accepted while the channel was dead may be lost.

## Redis unavailable or evicting

- **Symptoms:** ingest/RUM 500s, auth slow (cache misses → argon2 per request), live traffic blank.
- **Check:** `redis-cli INFO memory`, `evicted_keys`.
- **Act:** restore Redis; raise `maxmemory` if evictions are high (compose sets 256 MB + `allkeys-lru`, so rate-limit and idempotency keys can be evicted).
- **Note:** rate limits reset and idempotency guarantees lapse during an outage.

## PostgreSQL unavailable

- **Symptoms:** login, dashboards, aggregation fail; aggregation messages nack and are lost (KI-32).
- **Act:** restore PG; restart API if the pool doesn't recover.
- **Follow-up:** replay is impossible until DLQs are bound; recompute aggregates from Mongo raw logs if needed.

## MongoDB unavailable

- **Symptoms:** logs/traces pages fail; `RawLogWorker` nacks (data lost).
- **Act:** restore Mongo. Aggregates in PG are unaffected.

## Ingest 429s for a customer

- **Check:** `GET rate:<projectId>` in Redis; owner tier `GET tier:<ownerId>`.
- **Note:** limit counts **batches**, not events (KI-19). Upgrade path: `subscriptions.plan_tier = 'PRO'` then `DEL tier:<ownerId>`.

## Alert storm (same alert every minute)

- **Cause:** no cooldown/dedup (KI-18).
- **Act:** `UPDATE alert_rules SET is_active = false WHERE id = …;` and notify the customer.

## Suspected leaked API key

1. Revoke the key from the dashboard (or `UPDATE api_keys SET revoked_at = NOW() WHERE id = …`).
2. `DEL api_key_cache:<rawKey>` if you have the raw key; otherwise wait 5 minutes (KI-5).
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
