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

---

## P3

### KI-23 Duplicate and misplaced routes
- `/auth/login` and `/users/login`, `/auth/logout` and `/users/logout` both exist.
- Ingest-key issuance exists at both `POST /auth/keys` and `POST /keys`.
- Member management lives at `/users/:projectId/members` instead of `/projects/:projectId/members`.

### KI-25 "Traces" are single request logs
`modules/traces/traces.repository.ts` reads the Mongo `api_logs` collection; `traceId` is the server-generated `reqId`. There are no spans, parent/child relationships, or cross-service propagation.

