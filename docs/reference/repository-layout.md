# Repository Layout

Every top-level path and the files that matter. For the planned layout see [../architecture/target-architecture.md](../architecture/target-architecture.md#repository-structure-target).

## Root

| Path | Purpose |
|---|---|
| `CLAUDE.md` | Instructions for AI coding assistants (conventions, git rules, commands) |
| `README.md` | Project intro + quick start |
| `plan.md` | Roadmap to ship, phase by phase |
| `.env.example` | Template for the repo-root `.env` read by the server |
| `package.json` | npm workspaces (`apps/*`, `packages/*`) + root scripts |
| `turbo.json` | Turborepo config (currently empty) |
| `docker-compose.yml` | Local infra: Mongo :27018, Postgres :9999, Redis :6379, RabbitMQ :5672/:15672 |
| `todo.md` | Live priority-ordered task list (top = do first) with a Done log |
| `.gitignore` | Ignores dependencies, build output, `.env*` (except `.env.example`) |
| `.github/workflows/ci.yml` | CI: install, validate migrations, build server/web/SDKs, SDK conformance |
| `.github/workflows/release-sdks.yml` | Manual SDK release to npm + PyPI |

## `apps/server`: Express API + workers

| Path | Purpose |
|---|---|
| `Dockerfile` | Server image; build from the repo root: `docker build -f apps/server/Dockerfile .` |
| `package.json` | `dev` (tsx watch), `build` (tsc) |
| `tsconfig.json` | Strict TS, path aliases |
| `build.mjs` | Production build: esbuild bundle → `dist/bootstrap.js` |
| `src/bootstrap.ts` | Process entry: connect infra, start workers, HTTP + Socket.IO |
| `src/app.ts` | Express app factory, global middleware, router mounting |
| `src/config/config.ts` | Zod env schema; loads `<root>/.env` |
| `src/events/event-bus.ts` | Typed in-process EventEmitter |
| `src/infrastructure/db/postgres.ts` | `pg` Pool + `getPg()` |
| `src/infrastructure/db/mongo.ts` | mongoose connect |
| `src/infrastructure/redis.ts` | ioredis client + `getRedis()` |
| `src/infrastructure/rabbitmq.ts` | AMQP connection, channel, topology |
| `src/modules/auth/` | Login/refresh/logout, OAuth, key issuance, key-validation middleware |
| `src/modules/users/` | Register/login/me, project members |
| `src/modules/projects/` | List/create projects |
| `src/modules/keys/` | Key list/stats/create/revoke |
| `src/modules/ingest/` | `POST /ingest` |
| `src/modules/rum/` | `POST /rum` + RUM analytics; `rum.schema.ts` Mongo model |
| `src/modules/metrics/` | Aggregated metrics queries |
| `src/modules/logs/` | Raw log queries; `logs.schema.ts` Mongo model (`api_logs`) |
| `src/modules/traces/` | Trace list/detail (over `api_logs`) |
| `src/modules/insights/` | Anomaly insights repository + list |
| `src/modules/alerts/` | `alerts.repository.ts` only |
| `src/modules/billing/` | PhonePe checkout + webhook |
| `src/modules/websocket/` | Socket.IO live pulse |
| `src/workers/raw-log.worker.ts` | `raw_log_queue` → Mongo |
| `src/workers/aggregation.worker.ts` | `aggregation_queue` → `hourly_metrics` |
| `src/workers/anomaly.worker.ts` | `anomaly_queue` → z-score → `insights` |
| `src/workers/rum.worker.ts` | `rum_queue` → Mongo + `hourly_rum_metrics` |
| `src/workers/alert.worker.ts` | 60 s rule evaluation loop + webhooks |
| `src/shared/constants/endpoints.ts` | API prefix + route path constants |
| `src/shared/http/api-contract.ts` | `successBody` / `errorBody` envelope helpers |
| `src/shared/http/platform-controller.ts` | `/health`, `/ready`, `/metrics/system` |
| `src/shared/middleware/` | `require-auth`, `require-project-access`, `async-handler`, `error-handler` |
| `src/shared/net/webhook.ts` | SSRF-guarded outbound webhook sender |
| `src/shared/services/audit-log.service.ts` | Writes `audit_logs` |
| `src/shared/services/platform-health.service.ts` | Dependency + queue health |
| `test/unit/` | Vitest unit tests (in-memory fakes, no network) |
| `test/integration/` | Vitest integration tests against real services; `harness.ts` boots the stack |
| `test/setup/`, `test/helpers/` | Test env, isolated-DB global setup, fakes, `knownBug()` helper |
| `vitest.config.ts`, `vitest.integration.config.ts` | Unit / integration runner configs |
| `src/shared/utils/` | `logger` (pino; redacts credentials from request logs), `math.utils` (percentiles), `anomaly.utils` (z-score), `cookie.utils`, `phonepe.utils` |

## `apps/web`: Next.js dashboard

| Path | Purpose |
|---|---|
| `AGENTS.md`, `CLAUDE.md` | Next.js 16 caveats for AI assistants |
| `app/layout.tsx`, `app/page.tsx` | Root layout, landing page |
| `app/(auth)/` | login, register, oauth/callback |
| `app/(dashboard)/` | overview, live-traffic, logs, traces, traces/[id], analytics, ai-insights, keys, settings, billing |
| `app/(marketing)/about/` | About page |
| `app/providers/` | AppProviders, QueryProvider |
| `features/<domain>/` | api / hooks / state / ui per domain |
| `shared/api/apiClient.ts` | axios client with token refresh queue |
| `shared/api/endpoints.ts` | Endpoint map (duplicate of server's) |
| `shared/layout/` | AppShell, PublicNavbar, Footer, RouteGate |
| `shared/routes/routes.ts` | Route constants, public paths |
| `shared/ui/` | Leaflet GeoIP map |
| `lib/redux/` | Store, hooks, persist storage |
| `proxy.ts` | Next proxy (formerly middleware): optional server-side redirect to /login |
| `test/` | Vitest tests for API client, auth state, routes |

## `packages`: SDKs

| Path | Purpose |
|---|---|
| `packages/sdk/src/http.ts` | Transport: auth strategies, retries, timeouts, idempotency, envelope unwrap |
| `packages/sdk/src/client.ts` | `ApexClient` domain methods + path table |
| `packages/sdk/src/types.ts`, `errors.ts` | Types, `ApexApiError`, `ApexNetworkError` |
| `packages/browser-sdk/src/index.ts` | `ApexBrowserRumClient` / `createBrowserRumClient` |
| `packages/python-sdk/src/apexmonitor_sdk/client.py` | Python `ApexClient` |
| `packages/sdk/test/`, `packages/browser-sdk/test/` | Vitest SDK tests |
| `packages/python-sdk/tests/` | unittest tests for the Python SDK |
| `packages/python-sdk/pyproject.toml` | PyPI metadata (`apexmonitor-sdk`) |

## `scripts`

| Path | Purpose |
|---|---|
| `migrations/NNNN_*.sql` | Ordered schema migrations, applied by `apps/server/src/infrastructure/db/migrations.ts` and tracked in `schema_migrations`. 0001 initial schema · 0002 users, owner FK, Apdex · 0003 subscriptions · 0004 profile columns · 0005 RUM tables · 0006 `billing_checkouts` · 0007 key `key_lookup` · 0008 latency histograms + `apex_hist_*` · 0009 alert state · 0010 member role check |
| `validate-migrations.mjs` | CI check: file naming, no gaps, re-runnable statements |
| `sdk-conformance.mjs` | SDK wire-contract checks with mocked transport |
| `check-release-version.mjs` | Ensures package versions match `RELEASE_VERSION` |
| `rum-smoke.sh`, `rum-loop.sh` | Manual RUM traffic generators |

## `docs`

See [../README.md](../README.md).

## `infra`

| Path | Purpose |
|---|---|
| `compose/docker-compose.prod.yml` | Production-style stack: datastores, broker, `migrate` job, API, dashboard (see `docs/operations/deployment.md`) |
| `compose/.env.example` | Template for its secrets; the filled-in `.env` is gitignored |
