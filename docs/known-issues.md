# Known Issues

_Audited: 2026-11-10 against commit `debac85`; KI-33 to KI-40 found by the test suite._

Every issue that can be expressed as a test has an expected-failure test (see `docs/guides/testing-strategy.md#known-bug-tests`). Fixing an issue makes its test pass, which the runner flags until the test is converted to a normal one.

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

_None open._

---

## P1

### KI-7 Billing has no subscription lifecycle
`modules/billing/*`: one successful payment upgrades the user to PRO forever. There is no billing period, renewal, expiry or downgrade, and billing is per user, not per org. (Configuration was fixed: no sandbox fallbacks, production guard, redirect from `FRONTEND_URL`, 401 on bad signatures.)
**Fix:** plan Phase 5 (real subscriptions).

### KI-18 Alerting UI is not wired
The backend is done (CRUD API under `/api/v1/alerts`, ok/firing state with triggered/resolved notifications, evaluation over raw logs in the rule's window), but the web `AlertRuleBuilder` and `TriggerHistory` are static mock-ups. `notify_email` is stored but never sent (plan Phase 4b).

### KI-11 Python SDK sends RUM keys in the wrong header
`packages/python-sdk/src/apexmonitor_sdk/client.py#_auth_headers` defaults both `apiKey` and `rumKey` to `x-api-key`. Server expects `x-rum-key`.

### KI-12 TS SDK exposes endpoints the server doesn't have
`packages/sdk/src/client.ts` defines `metrics.rps` and `metrics.endpoints` (`/api/v1/metrics/rps`, `/api/v1/metrics/endpoints`); the server only serves `overview`, `latency`, `operations`. Web `shared/api/endpoints.ts` lists them too.

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

### KI-33 SDK transport defects
- TS and Python SDKs send idempotency keys as `idempotency-key`; the server reads `x-idempotency-key`, so SDK retries are never deduplicated.
- 409 Conflict is treated as retryable (e.g. register with a taken email is sent 3 times).
- TS SDK retries requests the caller cancelled (`AbortError` is treated as retryable).

### KI-34 Python `revoke_key()` always fails
`ApexClient.revoke_key(key_id)` sends no `projectId` query parameter, which `DELETE /api/v1/keys/:id` requires (400).

### KI-37 Endpoint normalisation is too aggressive and too lax
`ingest.service.ts#normalizeEndpoint` replaces any `/` followed by digits, so `/auth/2fa/setup` becomes `/auth/:idfa/setup`, and it keeps query strings, so `/search?q=…` creates one endpoint per query (cardinality explosion in `hourly_metrics`).
**Fix:** split on `/`, replace whole segments that are numeric/UUID/ObjectId/long hex; strip `?…` and `#…`.

### KI-38 Member roles are not validated
`POST/PATCH /users/:projectId/members` store any `role` string (no Zod DTO). Only `owner` is recognised elsewhere, so typos silently create members with no defined permissions.

### KI-39 Malformed or missing request bodies return 500
- `errorHandler` ignores the `status` of body-parser errors: malformed JSON → 500 (should be 400), body over 2 MB → 500 (should be 413).
- Express 5 leaves `req.body` undefined when no body is sent; `/auth/login`, member add and the billing webhook destructure it and crash with 500.

### KI-40 Web client keeps stale tokens after a failed refresh
`apps/web/shared/api/apiClient.ts` rejects queued requests when `/auth/refresh` fails but never clears the persisted tokens or redirects to `/login`, leaving the UI in a broken signed-in state.

## P3

### KI-23 Duplicate and misplaced routes
- `/auth/login` and `/users/login`, `/auth/logout` and `/users/logout` both exist.
- Ingest-key issuance exists at both `POST /auth/keys` and `POST /keys`.
- Member management lives at `/users/:projectId/members` instead of `/projects/:projectId/members`.
- `auth.middleware.ts` (API/RUM key checks) returns errors without the canonical envelope (`requestId` missing).

### KI-24 `five_minute_metrics` is never written
The table and index exist; nothing populates it. README claimed it powers recent charts.

### KI-25 "Traces" are single request logs
`modules/traces/traces.repository.ts` reads the Mongo `api_logs` collection; `traceId` is the server-generated `reqId`. There are no spans, parent/child relationships, or cross-service propagation.

### KI-27 Anomaly baseline is per batch, not per time window
`workers/anomaly.worker.ts` pushes the p99 of each incoming batch into a 20-item Redis list. Baselines depend on SDK batch size and flush rate rather than time; small batches produce noisy p99s and false positives. Endpoint key is not method-qualified.

### KI-30 Web `middleware.ts` does nothing
Both branches return `NextResponse.next()`; route protection is purely client-side (`RouteGate`).

### KI-31 Mixed state libraries and stray root dependencies
Root `package.json` depends on `axios` and `zustand`; the web app uses both Redux Toolkit and Zustand stores. `turbo.json` is empty.
