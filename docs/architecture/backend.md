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

Workers register through `consume(queue, prefetch, handler)` in `infrastructure/rabbitmq.ts`; each gets its own channel and prefetch. They `ack` on success and `nack(requeue=false)` on failure, which dead-letters to `<queue>_dlq`.

Publishing (`publish()`) uses a separate confirm channel and resolves only when the broker confirms the message. It rejects with `BrokerUnavailableError` (mapped to `503` + `Retry-After: 5`) when the broker is disconnected, doesn't confirm within 5 s, or the channel's write buffer is full. If the connection or any channel closes, everything is rebuilt with exponential backoff (1 s → 30 s, jittered): topology, publisher and every registered consumer.

| Worker | Queue | Prefetch | Does |
|---|---|---|---|
| `RawLogWorker` | `raw_log_queue` | 200 | `insertMany` normalised logs into Mongo `api_logs` (unordered; duplicates acked) |
| `AggregationWorker` | `aggregation_queue` | 100 | Groups by project/endpoint/method/hour, computes stats, upserts `hourly_metrics`, emits `aggregation.completed` |
| `AnomalyWorker` | `anomaly_queue` | 50 | Counts each request into a per-minute latency histogram for its method + endpoint (by the request's timestamp, so batching doesn't matter). For recent minutes: p99 vs the p99s of up to 30 earlier minutes (≥5 minutes with ≥3 requests each); a spike (z > 3, ≥1.5× and ≥50 ms above normal) → `insights` row + `anomaly.detected`, then a 5-minute cooldown per endpoint. Tuning: `ANOMALY` in `shared/utils/anomaly.utils.ts` |
| `RumWorker` | `rum_queue` | 150 | Writes `rum_raw_events` (Mongo, 7-day TTL), aggregates into `hourly_rum_metrics`, HyperLogLog for uniques |
| `AlertWorker` | n/a (interval 60 s) | n/a | One replica per minute (Redis lock `alerts:evaluation-pass`); evaluates active `alert_rules` over raw logs, records triggered/resolved events, emits `alert.triggered`, POSTs webhooks |

## Event bus

`src/events/event-bus.ts`: typed `EventEmitter` singleton. Listeners in the emitting process run synchronously; with the bridge (started in `bootstrap.ts`) every emit is also published on the Redis channel `apexmonitor:events` and re-emitted by every other replica. A replica ignores its own messages, and relayed events are never published again.

| Event | Emitted by | Consumed by |
|---|---|---|
| `aggregation.completed` | AggregationWorker | MetricsService (clears cached overview data) |
| `anomaly.detected` | AnomalyWorker | WebSocketService (`latestInsights`) |
| `alert.triggered` | AlertWorker | (nothing yet) |

## Running several replicas

Several API processes can run against the same Postgres, Mongo, Redis and RabbitMQ:

- Queue consumers compete: each message goes to one replica.
- Alert evaluation runs on one replica per minute (`SET alerts:evaluation-pass NX PX 55000`); a crashed replica's lock just expires. Rule transitions are conditional SQL updates, so even overlapping passes can't notify twice.
- Events cross replicas through the Redis bridge above, so websocket clients on any replica see every insight.
- Socket.IO runs **without** a Redis adapter on purpose. Each replica broadcasts the live counters (shared in Redis) to its own clients every 2 s; an adapter would deliver every broadcast N times. Clients connect with `transports: ['websocket']`, so no sticky sessions are needed.
- Migrations take a Postgres advisory lock, rate limits, idempotency keys and the key cache live in Redis.

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

Defined in `apps/server/tsconfig.json`: `@modules/*`, `@shared/*`, `@infrastructure/*`, `@workers/*`, `@events/*`, `@config`. Resolved by `tsx` in development and by esbuild in the production build (`apps/server/build.mjs` bundles `src/bootstrap.ts` into `dist/bootstrap.js`, leaving `node_modules` external).

## Testing seams (current limits)

Infrastructure clients are module-level singletons (`getPg()`, `getRedis()`, `getChannel()`), and services are created with `new` inside controllers and middleware. Unit-testing a service means mocking modules. Plan Phase 2 introduces composition roots and constructor injection.

## Shutdown

On SIGTERM or SIGINT (`bootstrap.ts`, steps in `shared/lifecycle.ts`), within `SHUTDOWN_TIMEOUT_MS`:

1. `/ready` starts answering 503 and every response carries `Connection: close`, so load balancers and keep-alive clients move to other instances.
2. WebSocket clients are disconnected; the HTTP server stops accepting connections and waits for in-flight requests (stragglers are cut off after 10 s).
3. The alert loop stops and its current pass finishes.
4. Queue consumers are cancelled and messages already being handled are allowed to finish (`stopConsuming`). Prefetched but unhandled messages return to the queue.
5. RabbitMQ, MongoDB, PostgreSQL and Redis connections are closed.

Exit code 0 if every step finished in time, 1 otherwise. Batches that got a 202 stay in their durable queue and are processed after the next start.
