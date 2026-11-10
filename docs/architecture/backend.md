# Backend Architecture (`apps/server`)

## Boot sequence

`src/bootstrap.ts`:

1. `config/config.ts` loads `<repo-root>/.env` if present (not in tests) and validates the environment with Zod. The process exits on invalid or missing values.
2. Connects MongoDB, PostgreSQL, Redis, RabbitMQ in parallel. RabbitMQ connect also asserts the exchange/queue topology (`infrastructure/rabbitmq.ts`).
3. Starts consumers: `RawLogWorker`, `AggregationWorker`, `AnomalyWorker`, `RumWorker`; starts `AlertWorker` interval loop (not awaited).
4. Builds the Express app (`createApp()` in `app.ts`), wraps it in `http.createServer`, attaches `WebSocketService`.
5. Listens on `PORT` (default 3000). SIGTERM closes the HTTP server only.

## HTTP middleware chain

Order in `src/app.ts`:

```
helmet → cors(CORS_ORIGINS, credentials) → compression → express.json({limit:'2mb'})
→ pino-http (credentials redacted) → request-id (x-request-id in/out)
→ /health, /ready, /metrics/system           (PlatformController)
→ /api/v1/<module> routers                   (per-route auth middleware)
→ notFoundHandler → errorHandler
```

Per-route middleware (from routers):

| Middleware | File | Purpose |
|---|---|---|
| `requireAuth` | `shared/middleware/require-auth.ts` | Verifies `Authorization: Bearer <JWT>`; sets `req.user` |
| `requireProjectAccess({source,key,requireOwner})` | `shared/middleware/require-project-access.ts` | Reads projectId from params/query/body; checks membership; sets `req.project` |
| `validateApiKey` | `modules/auth/middleware/auth.middleware.ts` | `x-api-key` → project id (Redis cache → PG prefix lookup → argon2 verify) |
| `validateRumWriteKey` | same | `x-rum-key` + `Origin` allow-list → project id |
| `asyncHandler` | `shared/middleware/async-handler.ts` | Forwards async errors to `errorHandler` |

## Module pattern

Each domain in `src/modules/<domain>/`:

```
<domain>.router.ts       route table + middleware composition
<domain>.controller.ts   parse/validate (Zod DTO), call service, shape response
<domain>.service.ts      business logic, orchestration, caching
<domain>.repository.ts   SQL / Mongo queries only
<domain>.schema.ts       Mongoose model (logs, rum only)
dto/*.dto.ts             Zod schemas + inferred types
index.ts                 barrel export (router)
```

| Module | Routes | Stores used |
|---|---|---|
| `auth` | login, refresh, logout, OAuth start/callback, key + RUM key issuance | PG, Redis |
| `users` | register, login, logout, me, project members | PG |
| `projects` | list/create own projects | PG |
| `keys` | list, stats, create, revoke API keys | PG |
| `ingest` | `POST /ingest` | Redis, PG (owner/tier), RabbitMQ |
| `rum` | `POST /rum` + 6 analytics queries | Redis, RabbitMQ, PG |
| `metrics` | overview, latency, operations | PG, Redis (query cache `metrics:*`) |
| `logs` | list raw logs | Mongo |
| `traces` | list + detail (backed by raw logs) | Mongo |
| `insights` | recent anomaly insights | PG |
| `billing` | PhonePe checkout + webhook | PG, Redis |
| `alerts` | repository only, used by `AlertWorker` (no routes) | PG |
| `websocket` | Socket.IO service (not an Express router) | Redis |

Full route list: [../reference/api.md](../reference/api.md).

### Response contract

`shared/http/api-contract.ts`:

```json
// success
{ "data": { }, "meta": { "requestId": "…", "timestamp": "ISO-8601" } }
// error
{ "error": "FORBIDDEN", "message": "…", "requestId": "…", "details": { } }
```

`shared/middleware/error-handler.ts` maps `ZodError` → 400 `VALIDATION_ERROR`, a fixed set of thrown error strings (`EMAIL_IN_USE`, `INVALID_CREDENTIALS`, `PROJECT_ACCESS_DENIED`, `RATE_LIMITED`, …) to statuses, and everything else to 500 `INTERNAL_ERROR`.

## Workers

All consumers share the single AMQP channel from `infrastructure/rabbitmq.ts`, `ack` on success, and `nack(requeue=false)` on failure, which dead-letters to `<queue>_dlq`.

| Worker | Queue | Prefetch | Does |
|---|---|---|---|
| `RawLogWorker` | `raw_log_queue` | 200 | `insertMany` normalised logs into Mongo `api_logs` (unordered; duplicates acked) |
| `AggregationWorker` | `aggregation_queue` | 100 | Groups by project/endpoint/method/hour, computes stats, upserts `hourly_metrics`, emits `aggregation.completed` |
| `AnomalyWorker` | `anomaly_queue` | 50 | Per endpoint: batch p99 vs Redis baseline (last 20 values); z > 3 → `insights` row + `anomaly.detected` |
| `RumWorker` | `rum_queue` | 150 | Writes `rum_raw_events` (Mongo, 7-day TTL), aggregates into `hourly_rum_metrics`, HyperLogLog for uniques |
| `AlertWorker` | n/a (interval 60 s) | n/a | Loads active `alert_rules`, reads `hourly_metrics`, logs `alert_events`, emits `alert.triggered`, POSTs webhook |

## Event bus

`src/events/event-bus.ts`: typed `EventEmitter` singleton.

| Event | Emitted by | Consumed by |
|---|---|---|
| `aggregation.completed` | AggregationWorker | (nothing yet) |
| `anomaly.detected` | AnomalyWorker | WebSocketService (`latestInsights`) |
| `alert.triggered` | AlertWorker | (nothing yet) |

In-process only: this breaks as soon as workers run in a different process (KI-20).

## Realtime (Socket.IO)

`modules/websocket/websocket.service.ts`:

- Client emits `join` with `{ projectId, token }`; server verifies JWT and project membership, then `socket.join(projectId)`; replies `join:ok` or `join:error`.
- Every 2 s, for each active room: reads `live:<projectId>:requests|errors|latency_total|endpoints` from Redis, computes RPS / error rate / avg latency / top endpoints, merges latest anomaly insight, emits `pulse:live`.
- Live counters are written by `IngestService` with 5–8 s TTLs.

## Platform endpoints

`shared/http/platform-controller.ts` + `shared/services/platform-health.service.ts`:

| Path | Purpose |
|---|---|
| `GET /health` | Liveness snapshot |
| `GET /ready` | Pings Mongo, PG, Redis, RabbitMQ; checks queues |
| `GET /metrics/system` | Uptime, memory, dependency flags, queue message/consumer counts (unauthenticated) |

## Path aliases

Defined in `apps/server/tsconfig.json`: `@modules/*`, `@shared/*`, `@infrastructure/*`, `@workers/*`, `@events/*`, `@config`. Resolved by `tsx` in dev only (see KI-13).

## Testing seams (current limits)

Infrastructure clients are module-level singletons (`getPg()`, `getRedis()`, `getChannel()`), and services are created with `new` inside controllers and middleware. Unit-testing a service means mocking modules. Plan Phase 2 introduces composition roots and constructor injection.
