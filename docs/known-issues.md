# Known Issues

_Audited: 2026-11-10 against commit `debac85`._

Each issue has an ID referenced from [`plan.md`](../plan.md). When you fix one, delete its entry in the same PR (git history keeps the record) and update the plan checkbox.

**Severity**

| Level | Meaning |
|---|---|
| **P0** | Security hole or cross-tenant data exposure. Fix before anyone else touches the system. |
| **P1** | Blocks launch: wrong data, data loss, or a core flow that does not work. |
| **P2** | Must fix before real traffic or multiple replicas. |
| **P3** | Cleanup / consistency. |

---

## P0

### KI-2 Any API key can write telemetry into any project
`apps/server/src/modules/ingest/ingest.controller.ts` validates `req.body` (including `projectId`) and passes it to `IngestService.processBatch`. The project resolved from the API key (`req.project.id`, set in `modules/auth/middleware/auth.middleware.ts`) is never compared. A customer with one valid key can inject data into, and exhaust the rate limit of, any other project whose ID they know or guess.
**Fix:** derive `projectId` from `req.project.id`; reject a mismatching body value.

### KI-3 Refresh tokens are accepted as access tokens
`shared/middleware/require-auth.ts` and `modules/websocket/websocket.service.ts#resolveUser` verify JWTs with `JWT_SECRET` but never check `tokenType`. Refresh tokens (30-day expiry, `modules/users/user.service.ts`) are signed with the same secret, so a refresh token works as a 30-day access token.
**Fix:** check `tokenType === 'access'`; use separate signing secrets.

### KI-6 Webhook SSRF
`workers/alert.worker.ts#dispatchWebhook` POSTs to the user-supplied `alert_rules.notify_webhook` with no URL validation, so a user can make the server call `http://169.254.169.254/…`, `http://localhost:15672`, internal services, etc.
**Fix:** allow-list scheme (https), resolve and block private/loopback/link-local IPs, disable redirects, add timeout.

---

## P1

### KI-4 OAuth callback leaks tokens in the URL
`modules/auth/auth.controller.ts` (~line 72) redirects to `/oauth/callback?accessToken=…&refreshToken=…`. Tokens end up in browser history, proxy/server logs, and `Referer` headers.
**Fix:** httpOnly refresh cookie + short-lived one-time code exchanged by the web app.

### KI-5 Revoked API keys keep working for up to 5 minutes; raw keys stored in Redis
`modules/auth/auth.service.ts#validateApiKey` caches `api_key_cache:<rawKey>` for 300 s; revocation (`modules/keys/*`) does not delete the cache entry. The raw secret is also the Redis key name. Same pattern for `rum_key_cache:<rawKey>`.
**Fix:** cache by `sha256(rawKey)`, delete on revoke, store key id alongside project id.

### KI-7 Billing is sandbox-only and incomplete
- `shared/utils/phonepe.utils.ts` falls back to the public sandbox merchant ID and salt when env vars are missing, so production silently runs against sandbox.
- `modules/billing/billing.service.ts` hardcodes `X-MERCHANT-ID: PGTESTPAYUAT` and redirect `http://localhost:3000/dashboard/billing`.
- One-time payment upgrades to PRO forever: no period, renewal, expiry, or downgrade. Billing is per user, not per org. Webhook handling is not idempotent (no event log).
**Fix:** plan Phase 0 (config) + Phase 5 (real subscriptions).

### KI-8 Aggregated latency statistics are wrong
`workers/aggregation.worker.ts` upserts into `hourly_metrics`:
- `avg_ms = (old + new) / 2`: unweighted, so it's wrong whenever batches differ in size.
- `p95_ms/p99_ms = GREATEST(old, new)`: this is a running max of per-batch percentiles, not a percentile.
- `p50_ms` is never updated after the first insert of an hour.
- `rps_peak` is never written.
**Fix:** store sum + count for averages; store a mergeable sketch/histogram for percentiles.

### KI-9 Time buckets use server local time
`aggregation.worker.ts` builds the hour bucket with `new Date(y, m, d, h)` (local timezone). Any non-UTC host produces shifted buckets, and DST transitions merge or split hours.
**Fix:** truncate in UTC (`Date.UTC(...)` or `date_trunc('hour', ts AT TIME ZONE 'UTC')`).

### KI-10 Browser SDK payload doesn't match the server schema
`packages/browser-sdk/src/index.ts` sends events shaped `{ type, timestamp, payload }` with `type ∈ page_view|error|custom|web_vitals`, and sends `projectId` in the body. The server (`modules/rum/dto/rum-ingest.dto.ts`) requires top-level `path`, accepts `type ∈ page_view|web_vital|heartbeat`, and reads metrics from `ttfbMs/fcpMs/lcpMs`. Real browser SDK batches fail validation (400). `scripts/sdk-conformance.mjs` only checks transport shape against a mock, so it doesn't catch this.
**Fix:** align SDK to server contract (or extend server for `error`/`custom`); validate SDK output against the server Zod schema in conformance tests.

### KI-13 Production build does not run
`apps/server` builds with plain `tsc`, which leaves `@modules/...`, `@shared/...` imports untouched in `dist/`. `node dist/bootstrap.js` (Dockerfile `CMD`) fails with "Cannot find module". Dev works only because `tsx` resolves tsconfig paths.
**Fix:** `tsup`/`esbuild` bundle or `tsc-alias` post-step.

### KI-16 Ingest can lose accepted data
- `modules/ingest/ingest.service.ts` calls `channel.publish(...)` on a plain channel without publisher confirms and ignores its boolean return (backpressure), yet responds `202 queued`.
- `infrastructure/rabbitmq.ts` has no reconnect logic; a broker restart leaves the process with a dead channel.
- One channel is shared by publishers and all consumers.
**Fix:** confirm channel + await confirms, reconnect with backoff, separate channels.

### KI-32 Dead-lettered messages are dropped
`infrastructure/rabbitmq.ts` declares `raw_log_dlq`, `aggregation_dlq`, `anomaly_dlq`, `rum_dlq` and routes rejected messages to `dlq.exchange` with routing key `<name>_dlq`, but never binds the DLQ queues to `dlq.exchange`. A direct exchange with no matching binding discards the message, so every `nack(requeue=false)` in the workers loses data.
**Fix:** `bindQueue('<name>_dlq', 'dlq.exchange', '<name>_dlq')` for each; add DLQ depth alerting.

### KI-18 Alerting is not usable
- No HTTP routes for alert rules. `modules/alerts/` only has a repository; the web `AlertRuleBuilder` has nothing to call.
- `alert_rules.notify_email` is stored but no email is ever sent.
- No state machine/cooldown: a breached rule fires (DB row + webhook) every 60 s until it recovers; there's no "resolved" notification.
- Evaluates `hourly_metrics`, so `window_minutes` < 60 is meaningless.

### KI-22 Server Dockerfile is not monorepo-aware
`apps/server/Dockerfile` runs `npm ci` with `apps/server/package*.json`, but the lockfile is at the repo root. The image build fails (or installs unpinned deps).

### KI-28 No automated tests
There are no unit, integration, or end-to-end tests. CI only builds.

---

## P2

### KI-11 Python SDK sends RUM keys in the wrong header
`packages/python-sdk/src/apexmonitor_sdk/client.py#_auth_headers` defaults both `apiKey` and `rumKey` to `x-api-key`. Server expects `x-rum-key`.

### KI-12 TS SDK exposes endpoints the server doesn't have
`packages/sdk/src/client.ts` defines `metrics.rps` and `metrics.endpoints` (`/api/v1/metrics/rps`, `/api/v1/metrics/endpoints`); the server only serves `overview`, `latency`, `operations`. Web `shared/api/endpoints.ts` lists them too.

### KI-14 Configuration loading
- `config/config.ts` exits if the repo-root `.env` file is missing, even when all variables are present in the environment (breaks containers/K8s).
- `PHONEPE_*` and `RUM_RATE_LIMIT_RPM` are read from `process.env` directly and are not validated.
- README previously documented wrong names (`MONGODB_URI`, `POSTGRES_URL`) and location (`apps/server/.env`).

### KI-15 No migration runner
Schema lives in `scripts/init-postgres.sql` (auto-applied only on first Postgres container start) + manual `migrate-v*.sql`. Nothing records which migrations ran. `validate-migrations.mjs` only checks that files exist and contain a few strings.

### KI-17 Tokens persisted in localStorage
The web app keeps access/refresh tokens in Redux state persisted by `redux-persist` (localStorage). Any XSS reads them.

### KI-19 Rate limiting is per batch and fixed-window
- `ingest.service.ts` does `INCR rate:<projectId>` once per **batch** (up to 500 logs), so "60,000 RPM" is really 60,000 batches/min (up to 30M events/min).
- Fixed 60 s window (not sliding as documented).
- Tier lookup: when the cached tier is `FREE`, the code re-queries Postgres on every request, so the cache never helps free users.
- Live counters do one Redis round trip per log (`zincrby` loop); should be pipelined.

### KI-20 Not safe to run more than one replica
- `AlertWorker` uses `setInterval`; N replicas evaluate and fire every rule N times.
- `events/event-bus.ts` is an in-process `EventEmitter`; once workers and API are separate processes, websocket clients stop receiving anomaly/alert events.
- Socket.IO has no Redis adapter.

### KI-21 No graceful shutdown
`bootstrap.ts` only handles SIGTERM by closing the HTTP server. Consumers, intervals, DB/Redis/AMQP connections are not closed; in-flight messages can be redelivered or lost mid-write.

---

## P3

### KI-23 Duplicate and misplaced routes
- `/auth/login` and `/users/login`, `/auth/logout` and `/users/logout` both exist.
- Ingest-key issuance exists at both `POST /auth/keys` and `POST /keys`.
- Member management lives at `/users/:projectId/members` instead of `/projects/:projectId/members`.
- `require-auth.ts` and `auth.middleware.ts` return errors without the canonical envelope (`requestId` missing).

### KI-24 `five_minute_metrics` is never written
The table and index exist; nothing populates it. README claimed it powers recent charts.

### KI-25 "Traces" are single request logs
`modules/traces/traces.repository.ts` reads the Mongo `api_logs` collection; `traceId` is the server-generated `reqId`. There are no spans, parent/child relationships, or cross-service propagation.

### KI-26 API key prefix collisions reject valid keys
Keys are looked up by a 10-char prefix (`proj_` + 5 random chars) and `findKeyByPrefix` returns only `rows[0]`. If two keys share a prefix, the second always fails verification.

### KI-27 Anomaly baseline is per batch, not per time window
`workers/anomaly.worker.ts` pushes the p99 of each incoming batch into a 20-item Redis list. Baselines depend on SDK batch size and flush rate rather than time; small batches produce noisy p99s and false positives. Endpoint key is not method-qualified.

### KI-30 Web `middleware.ts` does nothing
Both branches return `NextResponse.next()`; route protection is purely client-side (`RouteGate`).

### KI-31 Mixed state libraries and stray root dependencies
Root `package.json` depends on `axios` and `zustand`; the web app uses both Redux Toolkit and Zustand stores. `turbo.json` is empty.
