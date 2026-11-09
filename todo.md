# TODO

Priority-ordered: **top = do first**. Pick from the top of **Now**.

- When an item is finished, move it to **Done** with the date (newest first) and remove its entry from `docs/known-issues.md` / tick it in `plan.md`.
- When new work is discovered, insert it at the right priority, not at the bottom.
- `KI-n` = entry in [`docs/known-issues.md`](docs/known-issues.md). `Pn` = phase in [`plan.md`](plan.md).

_Last updated: 2026-11-10_

---

## Now: security and data loss (P0)

1. [ ] **Commit the docs + `.gitignore` work** on a `docs/` branch and merge, so the ignore rules and docs are in history.
4. [ ] **Webhook SSRF guard:** https only, block private/loopback/link-local IPs after DNS resolve, no redirects, 5 s timeout. `workers/alert.worker.ts` (KI-6)
5. [ ] **Bind dead-letter queues** to `dlq.exchange` so rejected messages are kept. `infrastructure/rabbitmq.ts` (KI-32)
6. [ ] **Key revocation:** cache by `sha256(key)`, delete cache entry on revoke (API + RUM keys). `modules/auth/auth.service.ts`, `modules/keys/*` (KI-5)
7. [ ] **OAuth callback:** stop passing tokens in the redirect URL; httpOnly cookie + one-time code. `modules/auth/auth.controller.ts` (KI-4)

## Next: launch blockers (P1)

8. [ ] **Test harness (minimal):** Vitest in `apps/server`, `npm test` at root, wired into CI; add regression tests for items 2–7. (KI-28, P2d)
9. [ ] **Publisher confirms + reconnect:** confirm channel, await confirms before 202, 503 on backpressure, separate publish/consume channels, reconnect with backoff. (KI-16)
10. [ ] **Production build:** resolve path aliases (`tsup` or `tsc-alias`); verify `node dist/bootstrap.js` boots. (KI-13)
11. [ ] **Monorepo-aware Dockerfile** built from repo root. (KI-22)
12. [ ] **Aggregation math:** weighted average (store sum), stop `GREATEST()` for percentiles, update `p50`, UTC buckets. `workers/aggregation.worker.ts` (KI-8, KI-9)
13. [ ] **Browser SDK contract:** send the server's RUM schema; conformance test validates SDK output with the server Zod schema. (KI-10)
14. [ ] **Billing config:** remove sandbox fallbacks, redirect from `FRONTEND_URL`, fail boot in production without real credentials. (KI-7)
15. [ ] **Alert rules API:** CRUD routes + wire `AlertRuleBuilder`; cooldown + resolve state; evaluate on finer-grained data. (KI-18)

## Soon: before real traffic (P2)

16. [ ] **Config from env only:** `.env` optional; validate `PHONEPE_*`, `RUM_RATE_LIMIT_RPM` in Zod. (KI-14)
17. [ ] **Migration runner** (`node-pg-migrate`); convert existing SQL files. (KI-15)
18. [ ] **Graceful shutdown:** drain consumers, clear intervals, close all clients. (KI-21)
19. [ ] **Rate limiting:** count events not batches, sliding window/GCRA, fix FREE tier cache miss, pipeline live-counter writes. (KI-19)
20. [ ] **SDK fixes:** Python RUM header `x-rum-key`; remove or implement `metrics.rps` / `metrics.endpoints`. (KI-11, KI-12)
21. [ ] **Web auth hardening:** stop persisting tokens in localStorage; httpOnly cookies. (KI-17)
22. [ ] **Production compose file** (infra + api + web, healthchecks) under `infra/compose/`. (P1)
23. [ ] **CI:** lint + typecheck + test + docker build; ESLint/Prettier for server and SDKs; `.nvmrc`. (P1)
24. [ ] **Multi-replica safety:** broker-based events, Socket.IO Redis adapter, singleton scheduled jobs (pg-boss). (KI-20)

## Then: restructure (P2 phase)

25. [ ] Write and accept ADRs 0002–0005 (tenancy, API/worker split, ClickHouse, OTLP). `docs/adr/`
26. [ ] Extract `packages/contracts` (Zod schemas, endpoint paths, message types); delete duplicated endpoint maps.
27. [ ] Extract `packages/platform` + composition roots; remove module-level singletons.
28. [ ] Split `apps/api` and `apps/worker`.
29. [ ] Merge auth + users flows; single key-issuance route; members under `/projects/:id/members`. (KI-23)
30. [ ] Integration + tenant-isolation security suites with Testcontainers. (P2d)

## Later: cleanup (P3)

31. [ ] Populate or drop `five_minute_metrics`. (KI-24)
32. [ ] Fix key prefix collisions (longer prefix or handle multiple rows). (KI-26)
33. [ ] Time-based anomaly baselines; method-qualified endpoint key. (KI-27)
34. [ ] Server-side route protection in web `middleware.ts`. (KI-30)
35. [ ] One client-state library in web; remove root `axios`/`zustand`; configure or delete `turbo.json`. (KI-31)

## Backlog: product (P3–P7, see plan.md)

- [ ] Orgs, email verification, forgot/reset password, invitations, 2FA (P4a)
- [ ] Email / Slack / PagerDuty notification channels (P4b)
- [ ] OTLP ingest + real distributed traces (P4c)
- [ ] ClickHouse migration + mergeable percentiles + rollup tiers (P3)
- [ ] Error tracking, uptime checks, status pages, infra metrics (P4c)
- [ ] OpenAPI spec + cursor pagination (P4e)
- [ ] Usage metering, plans in DB, org subscriptions (P5)
- [ ] Self-instrumentation, backups, Helm chart, security scanning (P6)
- [ ] Docs site, SDK 1.0 publish, branding, terms/privacy, beta program (P7)

---

## Done

- [x] 2026-11-10: Refresh/OAuth-state tokens rejected as access tokens; per-type signing keys in `shared/auth/tokens.ts` (KI-3)
- [x] 2026-11-10: Ingest tenant isolation: project taken from API key, mismatching body `projectId` → 403 (KI-2)
- [x] 2026-11-10: Root `.gitignore` added (KI-1)
- [x] 2026-11-10: `.env.example` added at repo root
- [x] 2026-11-10: Root `CLAUDE.md` with conventions and git attribution rules
- [x] 2026-11-10: `plan.md` shipping roadmap
- [x] 2026-11-10: `docs/` restructured: architecture, reference, guides, operations, ADRs, known issues
- [x] 2026-11-10: `README.md` rewritten with correct env vars, ports, and paths
