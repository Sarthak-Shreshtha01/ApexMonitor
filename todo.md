# TODO

Priority-ordered: **top = do first**. Pick from the top of **Now**.

- When an item is finished, move it to **Done** with the date (newest first), remove its entry from `docs/known-issues.md`, tick it in `plan.md`, and turn its expected-failure test into a normal test.
- When new work is discovered, insert it at the right priority, not at the bottom.
- `KI-n` = entry in [`docs/known-issues.md`](docs/known-issues.md). `Pn` = phase in [`plan.md`](plan.md).

_Last updated: 2026-11-10_

---

## Now: security and data loss (P0 + urgent P1)

_All done (see Done). Next up: item 1 below._

## Next: launch blockers (P1)

1. [ ] **API key prefix collisions:** longer prefix or HMAC lookup; handle multiple rows. (KI-26)
2. [ ] **Publisher confirms + reconnect:** confirm channel, await confirms before 202, 503 on backpressure, separate publish/consume channels, reconnect with backoff. (KI-16)
3. [ ] **Production build:** resolve path aliases (`tsup` or `tsc-alias`); verify `node dist/bootstrap.js` boots. (KI-13)
4. [ ] **Monorepo-aware Dockerfile** built from repo root. (KI-22)
5. [ ] **Aggregation math:** weighted average (store sum), mergeable percentiles, update `p50`, UTC buckets. `workers/aggregation.worker.ts` (KI-8, KI-9)
6. [ ] **Browser SDK contract:** send the server's RUM schema. (KI-10)
7. [ ] **Billing config:** remove sandbox fallbacks, redirect from `FRONTEND_URL`, invalid webhook signature → 4xx, fail boot in production without real credentials. (KI-7)
8. [ ] **Alert rules API:** CRUD routes + wire `AlertRuleBuilder`; cooldown + resolve state; evaluate on finer-grained data. (KI-18)

## Soon: before real traffic (P2)

9. [ ] **Request body errors:** honour body-parser status (400/413); validate bodies with Zod on login, members, webhook. (KI-39)
10. [ ] **SDK fixes:** `x-idempotency-key` header, no retry on 409/caller abort, Python RUM header + `revoke_key` projectId, remove or implement `metrics.rps` / `metrics.endpoints`. (KI-33, KI-34, KI-11, KI-12)
11. [ ] **Endpoint normalisation:** whole-segment ids only, strip query/hash. (KI-37)
12. [ ] **Validate member roles** with a Zod enum. (KI-38)
13. [ ] **Config:** validate `PHONEPE_*`, `RUM_RATE_LIMIT_RPM` in Zod. (KI-14, remainder)
14. [ ] **Migration runner** (`node-pg-migrate`); convert existing SQL files. (KI-15)
15. [ ] **Graceful shutdown:** drain consumers, clear intervals, close all clients. (KI-21)
16. [ ] **Rate limiting:** count events not batches, sliding window/GCRA, fix FREE tier cache miss, pipeline live-counter writes. (KI-19)
17. [ ] **Web auth hardening:** httpOnly cookies instead of localStorage; clear tokens + redirect when refresh fails. (KI-17, KI-40)
18. [ ] **Production compose file** (infra + api + web, healthchecks) under `infra/compose/`. (P1)
19. [ ] **CI remainder:** ESLint/Prettier for server and SDKs, docker build job, `.nvmrc`, coverage report. (P1)
20. [ ] **Multi-replica safety:** broker-based events, Socket.IO Redis adapter, singleton scheduled jobs (pg-boss). (KI-20)

## Then: restructure (P2 phase)

21. [ ] Write and accept ADRs 0002–0005 (tenancy, API/worker split, ClickHouse, OTLP). `docs/adr/`
22. [ ] Extract `packages/contracts` (Zod schemas, endpoint paths, message types); delete duplicated endpoint maps.
23. [ ] Extract `packages/platform` + composition roots; remove module-level singletons.
24. [ ] Split `apps/api` and `apps/worker`.
25. [ ] Merge auth + users flows; single key-issuance route; members under `/projects/:id/members`. (KI-23)
26. [ ] Web UI tests with Playwright (login, keys, overview, live traffic). (P2d)

## Later: cleanup (P3)

27. [ ] Populate or drop `five_minute_metrics`. (KI-24)
28. [ ] Time-based anomaly baselines; method-qualified endpoint key. (KI-27)
29. [ ] Server-side route protection in web `middleware.ts`. (KI-30)
30. [ ] One client-state library in web; remove root `axios`/`zustand`; configure or delete `turbo.json`. (KI-31)

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
