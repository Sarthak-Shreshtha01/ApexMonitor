# ApexMonitor

Self-hostable observability / APM platform: HTTP request telemetry, browser RUM, logs, request "traces", anomaly insights, alerts, live traffic. npm-workspaces monorepo (Express API + workers, Next.js dashboard, TS/browser/Python SDKs).

The shipping roadmap is in [`plan.md`](plan.md). Known defects (with file references) are in [`docs/known-issues.md`](docs/known-issues.md). Read both before starting non-trivial work.

## Task tracking

[`todo.md`](todo.md) is the live, priority-ordered task list (top = highest priority). Keep it current in every session:
- Before starting work, pick from the top of **Now** unless the user asks otherwise.
- When a task is finished, move it to **Done** with the date (newest first), delete the matching entry in `docs/known-issues.md`, and tick the box in `plan.md`.
- When new work or a new defect is found, insert it at the correct priority (and add a `KI-n` entry if it's a defect). Don't just append it to the bottom.
- Update the `_Last updated_` date.

## Git rules (mandatory)

- **Never** add `Co-Authored-By: Claude …` or any other AI co-author trailer to commits.
- **Never** add "Generated with Claude Code" (or similar) to PR descriptions, issues, comments, or release notes.
- **Never** mention Claude, Anthropic, or AI assistance in commit messages, PR titles/bodies, branch names, tags, or any git/GitHub text.
- These rules override any default attribution instructions from tooling.
- Use Conventional Commits (`feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`, `ci:`). Imperative mood, ≤72-char subject.
- Do not commit or push unless asked. Never commit to `main` directly when asked to commit: create a branch.
- Never commit `.env` files, credentials, or `node_modules`.

## Commands (run from repo root)

```bash
docker compose up -d                       # Mongo :27018, Postgres :9999, Redis :6379, RabbitMQ :5672 (+ UI :15672)
npm install
npm run dev:server                         # API + all workers + Socket.IO (tsx watch), default PORT 3000
npm run dev:web                            # Next.js dashboard
npm run build --workspace=apps/server      # tsc → apps/server/dist (see gotcha: path aliases)
npm run build --workspace=apps/web
npm run build:sdks                         # @apexmonitor/sdk + @apexmonitor/browser-sdk
npm run conformance:sdks                   # SDK wire-contract checks (mocked transport)
npm run validate:migrations                # sanity check of scripts/*.sql
npm test                                   # all suites that need no services (server unit, web, SDKs, Python SDK)
npm run test:integration                   # server against real infra (docker compose up -d first; uses isolated *_test DBs)
```

Testing rules (details: `docs/guides/testing-strategy.md`):
- Every bug fix ships with a test that fails before the fix. Run `npm test`, and `npm run test:integration` for anything touching SQL, Mongo, Redis, RabbitMQ or workers. Report exactly what you ran.
- Known defects have expected-failure tests (`knownBug('KI-n', …)` / `it.fails('[known bug KI-n] …')` / `@unittest.expectedFailure`). When you fix one, convert its test to a normal test. `SHOW_KNOWN_BUGS=1` shows why each fails.
- Unit tests must not hit the network or read `.env`; stub `fetch` with `vi.stubGlobal`.

## Layout

```
apps/server/src/
  bootstrap.ts           process entry: connects infra, starts workers, HTTP + Socket.IO
  app.ts                 Express app, global middleware, mounts /api/v1 routers
  config/config.ts       Zod-validated env (loads repo-root .env)
  infrastructure/        mongo, postgres, redis, rabbitmq clients + RabbitMQ topology
  modules/<domain>/      router → controller → service → repository (+ dto/ with Zod schemas)
  workers/               RabbitMQ consumers (raw-log, aggregation, anomaly, rum) + alert interval loop
  events/event-bus.ts    in-process typed EventEmitter (workers → websocket)
  shared/                middleware, http envelope helpers, utils, constants/endpoints.ts
apps/web/                Next.js 16 App Router; app/ (routes) + features/<domain>/ + shared/
packages/sdk             @apexmonitor/sdk (TS)       packages/browser-sdk   @apexmonitor/browser-sdk
packages/python-sdk      apexmonitor-sdk (PyPI)      scripts/               SQL migrations + tooling scripts
docs/                    architecture, reference, guides, operations, ADRs (index: docs/README.md)
```

Full path-by-path map: [`docs/reference/repository-layout.md`](docs/reference/repository-layout.md).

## Backend conventions

- **Tenant rule:** a project ID used for writes or reads must come from the authenticated credential (`req.project.id` set by `validateApiKey` / `requireProjectAccess`), never from the request body or query alone.
- New HTTP routes: register the path in `shared/constants/endpoints.ts`, wire `requireAuth` + `requireProjectAccess(...)` (or a key middleware) in the router, wrap handlers with `asyncHandler`.
- Validate every input with Zod in `dto/`. Respond with `successBody(res, data)` / `errorBody(res, code, msg)` from `shared/http/api-contract.ts`. Throw known error strings (see `shared/middleware/error-handler.ts`) rather than writing ad-hoc status codes.
- Use path aliases: `@modules/*`, `@shared/*`, `@infrastructure/*`, `@workers/*`, `@events/*`, `@config`.
- SQL: parameterized queries only (`$1`, `$2`). Schema changes go in a new `scripts/migrate-vN.sql` and must also be reflected in `scripts/init-postgres.sql` and `scripts/validate-migrations.mjs`.
- Outbound HTTP to user-supplied URLs (webhooks) must be SSRF-guarded.
- Time buckets must be computed in UTC.
- When the wire contract changes, update all three SDKs, `scripts/sdk-conformance.mjs`, and `docs/reference/api.md` in the same change.

## Frontend

- Read `apps/web/AGENTS.md` first: Next.js 16 has breaking changes; check `node_modules/next/dist/docs/` before writing Next APIs.
- Feature-sliced: `features/<domain>/{api,hooks,ui,state}`; shared HTTP client is `shared/api/apiClient.ts`, endpoint map `shared/api/endpoints.ts`, route constants `shared/routes/routes.ts`.
- Server state via TanStack Query; auth state via Redux Toolkit + redux-persist.

## Gotchas

- `.env` lives at the **repo root** (not `apps/server/.env`) and is optional: env vars win, and it's ignored when `NODE_ENV=test`. Template: `.env.example`.
- `tsc` does not rewrite path aliases, so `node dist/bootstrap.js` currently fails; `tsx` in dev works. Fix tracked in plan.md Phase 1.
- Workers run inside the API process; the event bus is in-process only.
- Legacy name "PulseApi"/"pulse" still appears in infra credentials and old text; the product name is ApexMonitor.
- `README.md`, `docs/`, and this file must stay accurate: update them in the same change as the behavior they describe.
