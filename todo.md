# TODO

Priority-ordered: **top = do first**. Pick from the top of **Now**.

- When an item is finished, move it to **Done** with the date (newest first), remove its entry from `docs/known-issues.md`, tick it in `plan.md`, and turn its expected-failure test into a normal test.
- When new work is discovered, insert it at the right priority, not at the bottom.
- `KI-n` = entry in [`docs/known-issues.md`](docs/known-issues.md). `Pn` = phase in [`plan.md`](plan.md).

_Last updated: 2026-11-11_

---

## Now: security and data loss (P0 + urgent P1)

_All done (see Done)._

## Next: launch blockers (P1)

_All done (see Done). Remaining P1 gap: KI-7 subscription lifecycle, planned for Phase 5._

## Soon: before real traffic (P2)

_All done (see Done)._

## Then: restructure (P2 phase)

1. [ ] Write and accept ADRs 0002–0005 (tenancy, API/worker split, ClickHouse, OTLP). `docs/adr/` **Needs your decision before items 2–4.**
2. [ ] Extract `packages/contracts` (Zod schemas, endpoint paths, message types); delete duplicated endpoint maps.
3. [ ] Extract `packages/platform` + composition roots; remove module-level singletons.
4. [ ] Split `apps/api` and `apps/worker`.
5. [ ] Merge auth + users flows; single key-issuance route; members under `/projects/:id/members`. (KI-23)

## Later: cleanup (P3)

6. [ ] **Formatting and coverage gates:** decide on Prettier (one repo-wide reformat commit); add coverage thresholds once the baseline (80% server unit) is agreed. **Needs your decision.**
7. [ ] One client-state library in web (Redux + zustand today); configure or delete `turbo.json`. (KI-31)

## Backlog: product (P3–P7, see plan.md)

- [ ] Orgs, email verification, forgot/reset password, invitations, 2FA (P4a)
- [ ] Email / Slack / PagerDuty notification channels (P4b)
- [ ] OTLP ingest + real distributed traces (P4c)
- [ ] ClickHouse migration + mergeable percentiles + rollup tiers (P3)
- [ ] Error tracking, uptime checks, status pages, infra metrics (P4c)
- [ ] OpenAPI spec + cursor pagination (P4e)
- [ ] Usage metering, plans in DB, org subscriptions (P5)
- [ ] Self-instrumentation, backups, Helm chart, security scanning (P6)
- [ ] Load tests with k6 (P3)
- [ ] Docs site, SDK 1.0 publish, branding, terms/privacy, beta program (P7)

---

## Done

- [x] 2026-11-11: Anomaly detection uses time-based baselines: per-minute latency histograms per method + endpoint (by request timestamp), p99 vs a 30-minute baseline, noise floors, 5-minute cooldown per endpoint; a flat baseline no longer hides spikes (KI-27)
- [x] 2026-11-11: Dropped the unused `five_minute_metrics` table (migration 0011); rollup tiers are planned with ClickHouse (KI-24)
- [x] 2026-11-11: Web lint is warning-free and now fails on warnings; logs and traces reload on live traffic at most every 5 s instead of on every 2 s pulse
- [x] 2026-11-11: Browser tests with Playwright (`npm run test:e2e`, CI job `browser-tests`): login redirects, sign-up, cookie session restore, sign-out, keys, ingest → overview, revocation, live traffic. They found the live-view websocket bug (KI-41) and a stale project list after creating a project on the Keys page (fixed); icon-only key buttons and the account menu got accessible names (P2d)
- [x] 2026-11-11: Live views (live traffic, logs, traces) never received updates: their websocket join sent no access token and the server refused it. Shared `connectProjectSocket` sends the token, refreshes once on an unauthorized join, and shows LIVE only after `join:ok`; unused mock `MetricCards` removed (KI-41)
- [x] 2026-11-11: Web route protection: `proxy.ts` (Next 16) redirects signed-out visitors on the server when the refresh cookie is visible (opt-in `WEB_SESSION_COOKIE_CHECK`); every login redirect keeps `?next=` with an open-redirect guard (KI-30)
- [x] 2026-11-10: Multiple replicas: event bus bridged through Redis pub/sub, one alert pass per minute cluster-wide (Redis lock), competing queue consumers; Socket.IO adapter deliberately not used (KI-20)
- [x] 2026-11-10: CI: Node 24 from `.nvmrc`, ESLint for server + SDKs + web in CI (42 web errors fixed), server coverage report as an artifact
- [x] 2026-11-10: Production compose stack (`infra/compose`): datastores without published ports, one-shot migrate job, API, dashboard; web Docker image (Next standalone); CI builds both images and validates the compose file
- [x] 2026-11-10: Web auth: tokens no longer in localStorage (access token in memory, refresh token httpOnly cookie, CSRF header on cookie refresh, configurable cookie flags); failed refresh clears state and redirects to /login (KI-17, KI-40)
- [x] 2026-11-10: Rate limiting counts events in a sliding window (atomic Lua), refused batches cost nothing, 429 carries Retry-After/X-RateLimit-*, FREE tier cached, live counters pipelined (KI-19)
- [x] 2026-11-10: Graceful shutdown on SIGTERM/SIGINT: /ready 503, finish HTTP requests, drain queue consumers, stop alert loop and websockets, close all connections, time-boxed (KI-21)
- [x] 2026-11-10: Migration runner: numbered files in `scripts/migrations`, tracked in `schema_migrations`, advisory lock, per-file transactions; auto-applied in dev, production refuses to start with pending ones; `npm run db:migrate` / `node dist/migrate.js` (KI-15)
- [x] 2026-11-10: Endpoint/RUM path normalisation: whole ID segments only (number, UUID, ObjectId, ULID, long hex), query/hash stripped; shared `shared/utils/route.utils.ts` (KI-37)
- [x] 2026-11-10: SDK fixes: `x-idempotency-key`, no retry on 409 / caller abort / unsafe POSTs, automatic idempotency keys for ingest, Python `x-rum-key` + `revoke_key(project_id)`, removed nonexistent metrics endpoints, TS alerts helpers (KI-33, KI-34, KI-11, KI-12)
- [x] 2026-11-10: Member roles limited to owner/developer (Zod + DB check); the last owner can't be demoted; web settings use the same roles (KI-38)
- [x] 2026-11-10: Malformed JSON → 400, body over 2 MB → 413, bad charset → 415; missing bodies treated as {}; login validated with Zod (KI-39)
- [x] 2026-11-10: Alerts page in the dashboard: create rules, see ok/firing state and last value, pause/resume/delete, trigger history (KI-18 complete; email delivery stays in Phase 4b) (KI-18)
- [x] 2026-11-10: Alerts backend: rules CRUD API, ok/firing state (notify on trigger and resolve only), evaluation over raw logs in the real window, owner-only writes (KI-18, backend)
- [x] 2026-11-10: Billing config: no built-in sandbox credentials (billing off → 503), production boot guard, merchant/endpoint from config, redirect from `FRONTEND_URL`, bad webhook signature → 401 (KI-7, config part)
- [x] 2026-11-10: PHONEPE_* and RUM_RATE_LIMIT_RPM validated by the Zod config; nothing reads process.env directly any more (KI-14)
- [x] 2026-11-10: Browser SDK sends the server's RUM schema (page_view / web_vital / heartbeat, top-level path, ttfb/fcp/lcp); unit tests validate its output with the server's Zod schema (KI-10)
- [x] 2026-11-10: Hourly metrics: UTC buckets (KI-9); exact weighted averages and mergeable histogram percentiles (~5%) in rows and in dashboard/alert queries (KI-8, KI-9)
- [x] 2026-11-10: Server Docker image builds from the repo root with the workspace lockfile; Node 24, non-root, healthcheck, no .env in the image; CI builds it (KI-22)
- [x] 2026-11-10: Production build: esbuild bundles the server (aliases resolved) into `dist/bootstrap.js`; `npm start --workspace=apps/server` boots it (KI-13)
- [x] 2026-11-10: Ingest answers 202 only after RabbitMQ confirms the batch (503 + Retry-After otherwise); per-consumer channels; automatic reconnect with backoff; failed batches release their idempotency key (KI-16)
- [x] 2026-11-10: Keys found by an HMAC lookup hash instead of the collision-prone 10-char prefix; legacy keys tried by prefix and backfilled on first use (KI-26)
- [x] 2026-11-10: Paid checkouts upgrade the right user: checkouts recorded in `billing_checkouts` and matched by transaction id and amount; replays are no-ops (KI-36)
- [x] 2026-11-10: OAuth callback redirects with a 60 s single-use code; the web app exchanges it via `POST /auth/oauth/exchange`; tokens never appear in URLs (KI-4)
- [x] 2026-11-10: Revoked API keys stop working immediately; key cache named by sha256, never the raw key; RUM origin allow-list enforced on cache hits (KI-5)
- [x] 2026-11-10: Dead-letter queues bound to `dlq.exchange`; rejected or expired messages are kept and their depth shows in `/ready` and `/metrics/system` (KI-32)
- [x] 2026-11-10: Request logs redact auth headers, API/RUM keys, cookies, issued tokens, redirect locations and secret query params (KI-35)
- [x] 2026-11-10: Webhook SSRF guard: https only, public addresses only (checked at connect time), no redirects, 5 s timeout (KI-6)
- [x] 2026-11-10: Test suites: server unit (381) and integration (79, real infra), web (12), TS SDK (58), browser SDK (7), Python SDK (14); CI unit + integration jobs; expected-failure tests for every known defect (KI-28)
- [x] 2026-11-10: `.env` file optional; env vars validated by Zod (KI-14, part)
- [x] 2026-11-10: Refresh/OAuth-state tokens rejected as access tokens; per-type signing keys in `shared/auth/tokens.ts` (KI-3)
- [x] 2026-11-10: Ingest tenant isolation: project taken from API key, mismatching body `projectId` → 403 (KI-2)
- [x] 2026-11-10: Docs, plan, todo and `.gitignore` committed and merged to `main`
- [x] 2026-11-10: Root `.gitignore` added (KI-1)
- [x] 2026-11-10: `.env.example` added at repo root
- [x] 2026-11-10: Root assistant instructions file with conventions and git attribution rules
- [x] 2026-11-10: `plan.md` shipping roadmap
- [x] 2026-11-10: `docs/` restructured: architecture, reference, guides, operations, ADRs, known issues
- [x] 2026-11-10: `README.md` rewritten with correct env vars, ports, and paths
