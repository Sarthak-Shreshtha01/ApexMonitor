# TODO

Priority-ordered: **top = do first**. Pick from the top of **Now**.

- When an item is finished, move it to **Done** with the date (newest first), remove its entry from `docs/known-issues.md`, tick it in `plan.md`, and turn its expected-failure test into a normal test.
- When new work is discovered, insert it at the right priority, not at the bottom.
- `KI-n` = entry in [`docs/known-issues.md`](docs/known-issues.md). `Pn` = phase in [`plan.md`](plan.md).

_Last updated: 2026-11-10_

---

## Now: security and data loss (P0 + urgent P1)

_All done (see Done)._

## Next: launch blockers (P1)

_All done (see Done). Remaining P1 gap: KI-7 subscription lifecycle, planned for Phase 5._

## Soon: before real traffic (P2)

1. [ ] **SDK fixes:** `x-idempotency-key` header, no retry on 409/caller abort, Python RUM header + `revoke_key` projectId, remove or implement `metrics.rps` / `metrics.endpoints`. (KI-33, KI-34, KI-11, KI-12)
2. [ ] **Endpoint normalisation:** whole-segment ids only, strip query/hash. (KI-37)
3. [ ] **Migration runner** (`node-pg-migrate`); convert existing SQL files. (KI-15)
4. [ ] **Graceful shutdown:** drain consumers, clear intervals, close all clients. (KI-21)
5. [ ] **Rate limiting:** count events not batches, sliding window/GCRA, fix FREE tier cache miss, pipeline live-counter writes. (KI-19)
6. [ ] **Web auth hardening:** httpOnly cookies instead of localStorage; clear tokens + redirect when refresh fails. (KI-17, KI-40)
7. [ ] **Production compose file** (infra + api + web, healthchecks) under `infra/compose/`. (P1)
8. [ ] **CI remainder:** ESLint/Prettier for server and SDKs, web Docker image, Node 24 in CI + `.nvmrc` (CI still uses Node 20, which is end-of-life), coverage report. (P1)
9. [ ] **Multi-replica safety:** broker-based events, Socket.IO Redis adapter, singleton scheduled jobs (pg-boss). (KI-20)

## Then: restructure (P2 phase)

10. [ ] Write and accept ADRs 0002–0005 (tenancy, API/worker split, ClickHouse, OTLP). `docs/adr/`
11. [ ] Extract `packages/contracts` (Zod schemas, endpoint paths, message types); delete duplicated endpoint maps.
12. [ ] Extract `packages/platform` + composition roots; remove module-level singletons.
13. [ ] Split `apps/api` and `apps/worker`.
14. [ ] Merge auth + users flows; single key-issuance route; members under `/projects/:id/members`. (KI-23)
15. [ ] Web UI tests with Playwright (login, keys, overview, live traffic). (P2d)

## Later: cleanup (P3)

16. [ ] Populate or drop `five_minute_metrics`. (KI-24)
17. [ ] Time-based anomaly baselines; method-qualified endpoint key. (KI-27)
18. [ ] Server-side route protection in web `middleware.ts`. (KI-30)
19. [ ] One client-state library in web; remove root `axios`/`zustand`; configure or delete `turbo.json`. (KI-31)

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
