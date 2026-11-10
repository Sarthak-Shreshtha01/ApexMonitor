# Testing

The manual end-to-end runbook is [end-to-end-testing.md](end-to-end-testing.md). This page covers the automated suites.

## Commands (repo root)

```bash
npm test                    # everything that needs no services: server unit, web, TS SDK, browser SDK, Python SDK
npm run test:integration    # server against real Postgres/Mongo/Redis/RabbitMQ (docker compose up -d first)
npm run test:all            # both
npm run test:e2e            # browser tests: Chromium against the real API + dashboard (docker compose up -d first)
npm run test:coverage       # server unit tests + coverage report in apps/server/coverage (HTML + lcov)

# per package
npm test --workspace=apps/server            # server unit tests
npm run test:watch --workspace=apps/server  # watch mode
npm test --workspace=@apexmonitor/sdk
npm run test:python-sdk
```

Useful environment variables:

| Variable | Effect |
|---|---|
| `SHOW_KNOWN_BUGS=1` | Run known-bug tests as normal tests to see why each one fails |
| `DEBUG_TESTS=1` | Show server `console.*` output (silenced by default) |
| `TEST_PG_URI`, `TEST_PG_ADMIN_URI`, `TEST_MONGO_URI`, `TEST_REDIS_URL`, `TEST_RABBITMQ_URL`, `TEST_RABBITMQ_MGMT_URL`, `TEST_RABBITMQ_USER`, `TEST_RABBITMQ_PASS` | Point integration tests at other services (defaults match `docker-compose.yml`) |

## Suites

| Suite | Location | Tool | Services | What it covers |
|---|---|---|---|---|
| Server unit | `apps/server/test/unit/` | Vitest + supertest | none (in-memory fakes) | Utils, tokens, middleware, every DTO, every router/controller/service, workers, RabbitMQ topology, websocket, platform health, billing, full `createApp()` route table and auth matrix, client/server path drift, config loading |
| Server integration | `apps/server/test/integration/` | Vitest | real PG, Mongo, Redis, RabbitMQ | Auth flows, tenant isolation matrix, ingest → workers → query APIs, keys, members/roles, RUM, websocket pulse, readiness, TS SDK + browser SDK against the live server, dead-lettering |
| Web | `apps/web/test/` | Vitest | none | API client token refresh queue, auth state, routes and login redirects, project websocket |
| Browser (E2E) | `apps/web/e2e/` | Playwright (Chromium) | real API + workers, PG, Mongo, Redis, RabbitMQ; production build of the dashboard | Server-side login redirect with `?next=`, sign-up, session restore from the httpOnly cookie (no tokens in storage), sign-out, wrong password, project + key creation, ingest → overview numbers and normalised endpoints, key revocation, live traffic websocket join and pulses |
| TS SDK | `packages/sdk/test/` | Vitest | none | Transport (auth, retries, timeouts, aborts, envelopes, errors) and every client method's path |
| Browser SDK | `packages/browser-sdk/test/` | Vitest | none | Queueing, flushing, timers, unload; contract against the server RUM schema |
| Python SDK | `packages/python-sdk/tests/` | unittest | none | Transport, auth, retries, errors, endpoint mapping |

### Integration isolation

`apps/server/test/setup/integration-global.ts` runs before the suite and:

- drops and recreates the Postgres database `apexmonitor_test`, then applies `scripts/migrations/*` with the same runner production uses
- drops the Mongo database `apexmonitor_test`
- flushes Redis DB 15
- recreates the RabbitMQ vhost `apexmonitor_test` through the management API

The suite never touches the development databases, so a running `npm run dev:server` is unaffected. The whole stack (API, workers, websocket) boots once in-process on a random port (`test/integration/harness.ts`). Tests run with `TZ=Asia/Kolkata` so timezone bugs reproduce identically everywhere.

### Browser tests

`npm run test:e2e` (or `npx playwright test` in `apps/web`) starts two servers through `apps/web/playwright.config.ts`:

- **API** on `:3100`: `npm run e2e:api --workspace=apps/server` (`apps/server/test/e2e/serve.ts`). It resets its own stores with the same code as the integration suite (Postgres/Mongo database and RabbitMQ vhost `apexmonitor_e2e`, Redis DB 14), then boots the full server with workers.
- **Dashboard** on `:3101`: `next build` into `.next-e2e` (a normal `.next` build is untouched) and `next start`, with `WEB_SESSION_COOKIE_CHECK=true`.

Locally, servers already listening on those ports are reused; stop them to pick up server code changes. Each test registers its own user, so tests don't depend on each other. Failures keep a trace, screenshot and page snapshot in `apps/web/test-results/` (`npx playwright show-trace <zip>`). The first run needs the browser: `npx playwright install chromium` in `apps/web`.

Selectors use roles, accessible names and placeholders, which is a reason to give icon-only buttons an `aria-label`.

### Guarantees in unit tests

- **No network:** `fetch` is replaced with a function that throws; tests that need outbound HTTP stub it explicitly.
- **No `.env`:** `NODE_ENV=test` makes `config.ts` ignore local files; values come from `test/setup/unit-env.ts`.

## Known-bug tests

Defects listed in [`../known-issues.md`](../known-issues.md) have tests that assert the **correct** behaviour and are marked as expected failures:

- Server: `knownBug('KI-n', ...)` from `apps/server/test/helpers/known-bug.ts`
- Other TS packages: `it.fails('[known bug KI-n] ...')`
- Python: `@unittest.expectedFailure` on `test_known_bug_ki_n_...`

While the bug exists the suite stays green. **When you fix a bug, its test starts passing, the runner reports that the expected failure passed, and you must turn it into a normal test** and remove the entry from `known-issues.md`. Use `SHOW_KNOWN_BUGS=1` to confirm a known-bug test fails for the documented reason, not a test mistake.

## Writing tests

- Every bug fix ships with a test that fails before the fix.
- Prefer real dependencies (integration suite) for SQL, Mongo queries, Redis behaviour and AMQP.
- Integration tests create their own tenants with `registerTenant()`; never depend on other files' data or order.
- Use `waitFor()` for anything a worker produces; don't sleep for fixed times.
- Unique path segments in test endpoints should start with a letter; whole numeric/UUID/hex segments become `:id`.

## CI

`.github/workflows/ci.yml` runs five jobs on every push and PR, on the Node version in `.nvmrc` (24):

1. **build-and-verify:** migration checks, `npm run lint`, server typecheck, builds (the server bundle is checked for unresolved aliases), SDK conformance
2. **unit-tests:** `npm test`, then server coverage (uploaded as the `server-coverage` artifact; no thresholds yet)
3. **integration-tests:** Postgres, Mongo, Redis and RabbitMQ service containers, then `npm run test:integration`
4. **browser-tests:** the same service containers, Playwright's Chromium, then `npm run test:e2e`; the report and traces are uploaded when it fails
5. **docker-image:** builds the server and web images and validates the production compose file

## Not covered yet

- Browser tests for the remaining pages (alerts, logs filters, traces, analytics, settings, billing)
- Load tests (k6; plan Phase 3)
- Python SDK against a live server
