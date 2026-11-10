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

### KI-20 Not safe to run more than one replica
- `AlertWorker` uses `setInterval`; N replicas evaluate and fire every rule N times.
- `events/event-bus.ts` is an in-process `EventEmitter`; once workers and API are separate processes, websocket clients stop receiving anomaly/alert events.
- Socket.IO has no Redis adapter.

---

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
