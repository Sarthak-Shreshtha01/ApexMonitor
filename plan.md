# ApexMonitor: Plan to Ship

_Last updated: 2026-11-10_

This is the working plan to take ApexMonitor from a functional prototype to a product that other teams can deploy (self-hosted) or pay for (SaaS). Work top to bottom: each phase assumes the previous phases are done. Defects referenced as **KI-n** are described in [`docs/known-issues.md`](docs/known-issues.md).

## Where we are

| Area | State |
|---|---|
| Ingest (HTTP logs, RUM) | Works end to end in dev; has a tenant-isolation hole and can drop data |
| Aggregation | Runs, but merged percentiles and averages are mathematically wrong |
| Dashboard | Most pages wired, including alerts |
| Alerts | Evaluator exists; no CRUD API, no email, no dedup/cooldown |
| SDKs | TS SDK works; browser SDK payload does not match server schema; Python RUM header wrong |
| Billing | PhonePe (sandbox or production by config), one-shot payment, per-user not per-org |
| Tests | None |
| Deployment | Production build does not start; no deploy manifests |

## Definition of "shippable" (v1.0 launch gate)

All of the following must be true before inviting external users:

1. No open **P0** or **P1** item in `docs/known-issues.md`.
2. Automated tests cover tenant isolation, ingest → worker → query, aggregation math, alert evaluation; CI blocks merge on failure.
3. `docker compose -f infra/compose/docker-compose.prod.yml up` brings up a working stack from published images on a clean machine.
4. A customer can: sign up → verify email → create org/project → create key → install SDK → see data in < 5 minutes → get an alert in Slack/email.
5. Sustained load test: 5k events/s ingest for 1 hour with zero data loss and p99 ingest latency < 200 ms on the reference deployment.
6. Backups configured, restore tested once, runbooks written for every dependency failure.
7. Public docs site, API reference (OpenAPI), SDK READMEs, terms, privacy policy, status page.

---

## Phase 0: Stop the bleeding (security + correctness)

Goal: nothing in the current code leaks data across tenants or silently corrupts numbers. Small, surgical PRs.

- [x] **Repo hygiene:** add root `.gitignore` (`node_modules`, `.env*` except `.env.example`, `dist`, `.next`, `*.tsbuildinfo`, `__pycache__`, `.venv`, `coverage`). (KI-1)
- [x] **Tenant isolation on ingest:** use `req.project.id` from the API key in `ingest.controller.ts`; reject body `projectId` that differs (403) or drop the field from the DTO. (KI-2)
- [x] **Token types:** `requireAuth` and the websocket `resolveUser` reject tokens whose `tokenType !== 'access'`; access, refresh and OAuth-state tokens use separate signing keys (`JWT_SECRET`, optional `JWT_REFRESH_SECRET`, derived keys). (KI-3)
- [x] **OAuth callback:** stop putting tokens in the redirect query string. Set an httpOnly refresh cookie and redirect with a one-time code the web app exchanges. (KI-4)
- [x] **Key revocation:** on revoke, delete the Redis cache entry; cache by `sha256(rawKey)` instead of raw key. Same for RUM keys. (KI-5)
- [x] **Webhook SSRF:** validate webhook URLs (https only, resolve DNS, block private/link-local/loopback ranges), 5 s timeout, no redirects. (KI-6)
- [x] **PhonePe:** remove hardcoded sandbox merchant/salt defaults; fail boot in production if billing is enabled without real credentials; build redirect URL from `FRONTEND_URL`. (KI-7)
- [x] **Aggregation math:** fix `avg_ms` to a weighted mean (store `latency_sum_ms`), stop `GREATEST()` for percentiles (interim: store a mergeable histogram column, see Phase 3), compute buckets in UTC. (KI-8, KI-9)
- [x] **Browser SDK contract:** make `@apexmonitor/browser-sdk` send the server's RUM schema (`type ∈ page_view|web_vital|heartbeat`, top-level `path`, `ttfbMs/fcpMs/lcpMs`); add a conformance test that validates SDK output against the server Zod schema. (KI-10)
- [x] **Dead-letter queues:** bind each `*_dlq` queue to `dlq.exchange` so rejected messages are kept instead of dropped. (KI-32)
- [x] **Python SDK:** `rumKey` auth must default to `x-rum-key`. Remove `metrics.rps` / `metrics.endpoints` from the TS SDK or implement them on the server. (KI-11, KI-12)

- [x] **Redact tokens from request logs.** (KI-35)
- [x] **PhonePe upgrades never applied** (truncated user id). (KI-36)

**Exit criteria:** every P0 item in known-issues is closed; each fix converts its expected-failure test into a regular test.

---

## Phase 1: Build, run, deploy foundations

Goal: the code can be built and run as containers anywhere, configured only through the environment.

- [x] **Production build:** compile `apps/server` with `tsup` (or `tsc` + `tsc-alias`) so path aliases resolve in `dist/`. Verify `node dist/bootstrap.js` boots. (KI-13)
- [ ] **Config:** read config from `process.env` only; `.env` loading becomes optional and dev-only. Move `PHONEPE_*` and `RUM_RATE_LIMIT_RPM` into the Zod schema. Add `.env.example` coverage check in CI. (KI-14: all done except the CI check)
- [x] **Dockerfiles:** one per app, built from repo root using workspace-aware install. Non-root user, healthcheck, `NODE_ENV=production` (`apps/server/Dockerfile`, `apps/web/Dockerfile`).
- [x] **Compose files:** `infra/compose/docker-compose.prod.yml` (infra + migrate + api + web, healthchecks, `depends_on: condition`, secrets only from the env file). The dev compose file stays at the repo root.
- [x] **Migrations:** adopt a runner (built in: `infrastructure/db/migrations.ts`). Convert `init-postgres.sql` + `migrate-v2..v4*.sql` into ordered, tracked migrations. API refuses to start if migrations are pending. (KI-15)
- [ ] **Graceful shutdown:** on SIGTERM/SIGINT: stop accepting HTTP, cancel consumers, wait for in-flight messages, clear intervals, close Socket.IO, close PG/Mongo/Redis/AMQP.
- [x] **RabbitMQ resilience:** reconnect with backoff on connection/channel close; separate publish and consume channels; use a confirm channel for publishing and await confirms before returning 202. Handle `publish()` returning `false` (backpressure → 503). (KI-16)
- [ ] **Tooling:** root `tsconfig.base.json`, ESLint + Prettier for server and SDKs, `.nvmrc` (Node 20 LTS or 22), `engines` in root `package.json`. Either configure `turbo.json` pipelines (build/lint/test with caching) or delete it. Remove stray root deps (`axios`, `zustand`) and pick one client state lib in web.
- [ ] **CI:** lint → typecheck → build → (tests from Phase 2) → docker build. Cache npm. Run on PRs to `main`.

**Exit criteria:** `docker compose -f infra/compose/docker-compose.prod.yml up --build` on a clean machine yields a healthy `/ready` and a working dashboard.

---

## Phase 2: Restructure + test harness

Goal: code layout that supports independent scaling and testing. Do this before adding features so new code lands in the right place. Target structure is in [`docs/architecture/target-architecture.md`](docs/architecture/target-architecture.md).

### 2a. Shared packages
- [ ] `packages/contracts`: Zod schemas + inferred types for every request/response, endpoint path constants, queue message types (with `schemaVersion`), event payload types. Server, web, and TS SDKs import from here. Delete duplicated endpoint maps in `apps/web/shared/api/endpoints.ts` and `packages/sdk/src/client.ts`.
- [ ] `packages/platform`: config loader, logger, PG/Mongo/Redis/AMQP client factories (no module-level singletons).
- [ ] `packages/core`: domain services + repositories grouped by domain (identity, projects, keys, telemetry, metrics, alerting, insights, billing).
- [ ] `packages/db`: migrations + runner + seed scripts.

### 2b. Apps split
- [ ] `apps/api`: HTTP routes/controllers + Socket.IO. Composition root `container.ts` builds clients → repos → services and injects them.
- [ ] `apps/worker`: queue consumers + scheduled jobs. Own composition root and Dockerfile.
- [ ] Replace in-process `eventBus` with broker events (RabbitMQ topic exchange `events`) consumed by the API's realtime layer; add `@socket.io/redis-adapter` so multiple API replicas fan out correctly.
- [ ] Scheduled jobs (alerts, retention, rollups) run under a distributed lock or a job queue (pg-boss recommended: no new infra) so N replicas don't run them N times.

### 2c. Module cleanup
- [ ] Merge `auth` + `users` auth flows into `identity`; delete duplicate `/users/login`, `/users/logout` (keep `/auth/*`).
- [ ] Single owner for key issuance: remove `POST /auth/keys` and `/auth/rum-keys` in favour of `/keys` (with `kind: ingest|rum`).
- [ ] Move member routes to `/projects/:projectId/members`.
- [ ] Move `phonepe.utils.ts` → billing, `anomaly.utils.ts` → insights. `shared/` keeps only cross-cutting code.
- [ ] Remove module-level `new Service()` in middleware; inject dependencies.
- [ ] Add API deprecation: old paths return `Deprecation` + `Link` headers for one minor version, then 410.

### 2d. Tests
- [x] Vitest config for all TS packages; `npm test` at root.
- [x] Unit: `math.utils`, aggregation merge logic, anomaly z-score, alert rule evaluation, endpoint normalisation, key generation/verification, Zod DTOs.
- [x] Integration (real Postgres, Mongo, Redis, RabbitMQ via compose / CI service containers, isolated DBs): ingest → workers → query APIs; RUM ingest → aggregates; key revoke takes effect immediately.
- [x] Security suite: for every project-scoped route, assert a user from project A gets 403 for project B; assert API key for A cannot write to B.
- [x] Contract: TS + browser SDK run against the live server in the integration suite; Python SDK unit tests (live-server Python tests still open).
- [x] Web: Playwright smoke (login, overview renders, create key, live traffic). Logs page still to add.
- [ ] Coverage gate: start at 60% for `packages/core`, raise over time.

**Exit criteria:** `apps/api` and `apps/worker` deploy and scale independently; CI runs unit + integration + security + contract suites on every PR.

---

## Phase 3: Data pipeline correctness and scale

Goal: correct numbers at real volume, with no silent loss.

- [ ] **Decide storage** (ADR-0004): move telemetry (logs, request events, spans, RUM events, metric rollups) to ClickHouse; keep Postgres for metadata only; retire MongoDB. If deferring ClickHouse, at minimum use TimescaleDB for rollups.
- [ ] **Mergeable percentiles:** store DDSketch/t-digest (or ClickHouse `quantilesTDigestState` / `AggregatingMergeTree`) per bucket; compute p50/p95/p99 at read time.
- [ ] **Rollup tiers:** raw (retention per plan) → 1 min → 1 h → 1 d. (`five_minute_metrics`, never used, was dropped in migration 0011.)
- [ ] **Idempotent consumers:** dedupe on `batchId`/`eventId` at write (unique keys / ReplacingMergeTree), so redelivery after a crash doesn't double count.
- [ ] **Late data policy:** accept events up to N hours late, reject beyond; document it.
- [ ] **Backpressure:** shed load with 503 + `Retry-After` when queue depth exceeds threshold; SDKs honour `Retry-After`.
- [ ] **DLQ tooling:** admin endpoint/CLI to inspect and replay DLQ messages; alert when DLQ depth > 0.
- [ ] **Cardinality guards:** per-project caps on distinct endpoints/tags; overflow bucketed to `__other__`; improve endpoint normalisation (hex IDs, slugs, Mongo ObjectIds, base64 tokens).
- [ ] **Rate limiting:** real sliding window (Redis sorted set or GCRA via Lua), limits per plan read from DB not hardcoded, return `X-RateLimit-*` headers. Pipeline the Redis live-counter updates (currently one round trip per log).
- [ ] **Retention jobs:** per-plan retention enforced by TTL/partition drop; `projects.log_retention_days` actually used.
- [ ] **Load test:** k6 scripts in `tests/load/`; publish results in `docs/operations/capacity.md`.

**Exit criteria:** load test target from the launch gate passes; aggregate numbers match a brute-force recomputation from raw events within 1%.

---

## Phase 4: Product completeness (what a buyer expects)

### 4a. Accounts and organisations
- [ ] Organisation model: `organizations`, `org_members (role: owner|admin|member|viewer)`, projects belong to orgs, optional `environments` per project (prod/staging).
- [ ] Email verification, forgot/reset password (routes already exist in web `ROUTES`), change email.
- [ ] Invitations by email with expiring tokens.
- [ ] 2FA (TOTP) and session list / revoke-all.
- [ ] Refresh-token rotation with reuse detection, stored server-side (hashed).
- [x] Move web auth to httpOnly cookies; stop persisting tokens in localStorage via redux-persist. (KI-17)
- [ ] Audit log viewer + export (table already exists).

### 4b. Alerting
- [x] CRUD API for alert rules (`/api/v1/alerts`), wire `AlertRuleBuilder` + `TriggerHistory` UI. (KI-18)
- [ ] Evaluate against 1-min rollups (not hourly); support `for` duration, cooldown, and resolve notifications.
- [ ] Alert states: `ok → pending → firing → resolved`; dedupe keys; silence/mute windows.
- [ ] Notification channels: email (SMTP/Resend/SES), Slack, Discord, Microsoft Teams, PagerDuty, generic signed webhook (HMAC header).
- [ ] Conditions: error rate, p95/p99 latency, throughput drop, Apdex, RUM LCP, no-data.

### 4c. Telemetry breadth
- [ ] **OTLP ingest** (ADR-0005): `/v1/traces`, `/v1/metrics`, `/v1/logs` (HTTP/protobuf + JSON; gRPC later). Map to internal model. This gives every language for free.
- [ ] Real distributed traces: spans with parent/child, service map, trace ↔ log correlation via `trace_id`.
- [ ] Structured application logs (not only request logs): level, message, attributes, full-text search.
- [ ] Error tracking: exception capture in SDKs, fingerprinting/grouping, first/last seen, source maps for browser.
- [ ] Uptime/synthetic checks (HTTP, keyword, TLS expiry) + public status pages.
- [ ] Infra metrics: accept Prometheus remote-write or OTel host metrics (CPU, memory, disk, network, container).

### 4d. Dashboard
- [ ] Time-range picker consistent across pages, URL-shareable state.
- [ ] Custom dashboards (saved queries + panels).
- [ ] SLOs with error budgets and burn-rate alerts.
- [ ] Onboarding wizard with copy-paste snippets per framework (Express, Fastify, Nest, Next, Flask, FastAPI, Django).
- [ ] Empty states, loading skeletons, error boundaries on every page.

### 4e. Public API
- [ ] OpenAPI 3.1 generated from `packages/contracts` Zod schemas; served at `/api/v1/openapi.json`; rendered docs.
- [ ] Cursor pagination for logs/traces (replace `skip/limit`).
- [ ] Personal access tokens for automation; scoped API keys (ingest-only vs read).

---

## Phase 5: Billing and metering

- [ ] Usage metering: count events/spans/log bytes per org per day (Redis counters flushed to `usage_daily`).
- [ ] Plans defined in DB (`plans` table: limits, retention, seats, price), not code constants.
- [ ] Enforce quotas: soft limit warnings (email at 80/100%), hard limit behaviour documented (drop vs overage).
- [ ] Subscriptions per **org**, recurring billing with renewal/expiry/downgrade. Add Stripe alongside PhonePe/Razorpay if selling outside India.
- [ ] Idempotent, signature-verified webhooks with event log table; reconcile job.
- [ ] Invoices, GST/tax fields, billing email, billing UI.
- [ ] Self-hosted licensing (if selling self-hosted): license key verification, feature flags per edition.

---

## Phase 6: Operability and compliance

- [ ] Self-instrumentation with OpenTelemetry (API + workers); dogfood into a separate ApexMonitor instance.
- [ ] Prometheus metrics endpoint protected by auth: queue depth, consumer lag, DLQ size, ingest latency, PG pool usage.
- [ ] Structured logging everywhere (replace `console.*` with pino child loggers carrying `requestId`, `projectId`).
- [ ] Backups: PG PITR, ClickHouse/Mongo snapshots, documented restore tested quarterly.
- [ ] Runbooks for each dependency outage (`docs/operations/runbooks.md`, expand as incidents happen).
- [ ] Kubernetes: Helm chart under `infra/helm/` (api, worker, web, HPA on CPU + queue depth, PDBs).
- [ ] Secrets via the platform's secret manager; rotation procedure documented.
- [ ] Security: dependency scanning (Dependabot/Renovate), `npm audit` + `pip-audit` in CI, container scanning, CodeQL. Pen-test before GA.
- [ ] GDPR: data export, account deletion (cascade to telemetry), DPA template, sub-processor list, data region option.
- [ ] Legal: Terms of Service, Privacy Policy (web routes `/terms`, `/privacy` already reserved), cookie notice.

---

## Phase 7: Launch

- [ ] Public docs site (Docusaurus/Nextra/Mintlify) built from `docs/` + SDK READMEs.
- [ ] SDKs published at 1.0.0 with semver policy and changelog (Changesets).
- [ ] Status page for the SaaS itself.
- [ ] Support channel + SLA definitions (see `docs/operations/launch-readiness.md`).
- [ ] Beta with 3–5 design partners for 4 weeks; fix top issues; then GA.
- [ ] Marketing site pricing matches enforced plans.
- [ ] Logo, brand guidelines, favicon/OG images (replace Next.js default assets in `apps/web/public`).
- [ ] Rename leftover "PulseApi"/"pulse" identifiers (DB user, RabbitMQ user, SDK repository URLs pointing at `your-org/pulseapi`).

---

## Later / not before GA

- AI layer (anomaly explanations, incident summaries, NL query) on top of deterministic detection. See `docs/architecture/target-architecture.md#ai-layer`.
- Seasonality-aware baselines (today: rolling 30-minute baseline of per-minute p99s).
- Session replay, profiling, mobile SDKs.
- gRPC OTLP, Kafka/Redpanda for replayable ingest log.

## Open decisions (need an owner and an ADR)

| Decision | Options | Recommendation | ADR |
|---|---|---|---|
| Distribution model | SaaS / self-hosted / both | Both, SaaS first | to write |
| Telemetry store | Postgres+Mongo / TimescaleDB / ClickHouse | ClickHouse | [0004](docs/adr/0004-telemetry-storage.md) |
| Ingest wire format | Custom JSON / OTLP | OTLP primary, custom JSON kept for SDK compat | [0005](docs/adr/0005-otlp-ingest.md) |
| Job scheduling | setInterval / BullMQ / pg-boss | pg-boss | to write |
| Payments | PhonePe / Razorpay / Stripe | Razorpay (IN) + Stripe (intl) | to write |
| License | Proprietary / open-core (AGPL core + commercial EE) | Open-core | to write |
| Hosting for SaaS | Self-managed K8s / managed DBs (Supabase or Neon for PG, ClickHouse Cloud, Upstash/managed Redis, CloudAMQP) | Managed datastores + small K8s or Fly/Render for stateless apps | to write |

`todo.md` items are all covered above: npm publish (Phase 7), Kubernetes deploy and CI/CD (Phases 1 and 6), architecture (Phase 2 + ADRs), user docs (Phase 7), AI insights (Later), branding (Phase 7), forgot password and OAuth hardening (Phases 0 and 4a), Supabase/Mongo setup (hosting decision above), billing (Phase 5), public APIs (Phase 4e).
