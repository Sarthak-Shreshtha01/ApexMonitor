# Testing Strategy

> **Status:** no automated tests exist yet (KI-28). This is the target setup for plan Phase 2. The manual runbook is [end-to-end-testing.md](end-to-end-testing.md).

## Pyramid

| Layer | Tool | Scope | Runs |
|---|---|---|---|
| Unit | Vitest | Pure logic: math, normalisation, z-score, alert evaluation, DTOs, key hashing | Every PR, < 30 s |
| Integration | Vitest + Testcontainers (Postgres, Mongo, Redis, RabbitMQ) | Repository SQL, ingest → worker → query, key revoke, RUM aggregation | Every PR |
| Security | Vitest + supertest | Cross-tenant access matrix for every route | Every PR |
| Contract | Vitest + pytest against a running API container | SDK requests accepted by server; SDK parses server responses | Every PR |
| E2E (web) | Playwright | Login, create key, overview renders, live traffic connects | Every PR (smoke), nightly (full) |
| Load | k6 (`tests/load/`) | Ingest throughput, query latency, socket fan-out | Nightly / before release |

## Layout

```
apps/server/src/**/x.test.ts            unit tests next to code (later: packages/core/**)
apps/server/test/integration/*.test.ts  integration (Testcontainers)
apps/server/test/security/*.test.ts     tenant isolation matrix
packages/sdk/test/*.test.ts             SDK unit + contract
packages/python-sdk/tests/              pytest
tests/e2e/                              Playwright
tests/load/                             k6
```

`apps/server/tsconfig.json` already excludes `**/*.test.ts` from the build.

## First tests to write (highest value)

1. **Tenant isolation (KI-2):** key for project A posting `projectId: B` is rejected; every `JWT+P` route returns 403 for a non-member.
2. **Aggregation math (KI-8/9):** two batches merged into one hour produce the same avg/percentiles as a single combined batch (within sketch error); buckets are UTC.
3. **Token types (KI-3):** refresh token rejected by `requireAuth` and websocket join.
4. **Key lifecycle (KI-5):** revoked key fails on the next request.
5. **Ingest durability (KI-16):** broker unavailable → API returns 503, not 202.
6. **SDK contract (KI-10):** browser SDK output passes `RumIngestBatchDto.parse`.
7. **Alert evaluation:** threshold, window, cooldown, resolve.
8. **Endpoint normalisation:** numeric, UUID, ObjectId, hex segments.

## Practices

- Prefer real dependencies via Testcontainers over mocks for anything touching SQL, Redis scripts, or AMQP.
- Each integration test creates its own project/user IDs; never rely on test order.
- Freeze time with Vitest fake timers for bucket/TTL logic.
- Regression rule: every bug fix ships with a test that fails before the fix.
- Coverage gate: start at 60% lines for domain code, ratchet up; don't gate on UI coverage.

## CI order

```
lint → typecheck → unit → integration + security + contract (parallel) → build → docker build → e2e smoke
```
