# PulseApi Implementation and User Flow Guide

## 1. Purpose

This document explains the current implementation of the project in practical terms:

- what changed in the latest implementation pass
- how the backend and frontend are structured
- how data moves through the system
- how the SDKs work
- how a real startup user would use the product end to end
- how the platform monitors itself

It is written for engineers, technical founders, and operators who need to understand the product from the inside out.

---

## 2. What Was Implemented

The latest implementation work focused on the foundations required to sell and operate the product for real startup monitoring use.

### 2.1 API contract normalization

A canonical response/error contract was introduced in the server layer.

- success responses now use a shared envelope with `data` and `meta`
- error responses now use a shared error body with `error`, `message`, and `requestId`
- request IDs are generated and propagated consistently
- the main public controllers were updated to use the same format

Why this matters:

- SDKs can depend on one stable shape
- frontend code can handle responses consistently
- support/debugging becomes easier because every response carries a request ID

### 2.2 Multi-tenant auth and isolation

A shared project access middleware was introduced.

- authenticated requests are checked against project membership
- owner-only actions are enforced at route level where needed
- API key issuance is no longer open
- RUM key issuance is restricted to project owners
- analytics, logs, traces, insights, keys, and member-management routes now require project access

Why this matters:

- no user can accidentally query another tenant’s project data
- project ownership is enforced before business logic runs
- tenant separation is clearer and safer

### 2.3 Scale-safe ingest

Ingest handling was hardened.

- log ingest accepts optional idempotency keys
- duplicate batches are deduplicated in Redis
- RabbitMQ messages include `messageId`, `correlationId`, and headers
- RUM ingest already had idempotency protection and continues to use it

Why this matters:

- retries do not duplicate the same log batch
- queue fan-out remains stable under load
- downstream workers get traceable message metadata

### 2.4 Live monitoring reliability

WebSocket room joins were secured.

- a user token is verified before a client joins a live room
- project membership is checked before joining
- the room state is tied to a validated user/project combination
- the live feed still comes from Redis counters and insight events

Why this matters:

- real-time dashboards are not exposed to unauthorised viewers
- only project members can subscribe to live monitoring streams
- the live room model is now tenant-aware

### 2.5 Platform observability

The platform now monitors itself.

- structured HTTP logging was added via pino-http
- `/health` returns a basic health snapshot
- `/ready` checks Mongo, PostgreSQL, Redis, RabbitMQ, and queue status
- `/metrics/system` returns a simple internal system snapshot
- platform health is read from shared services instead of ad hoc code

Why this matters:

- operators can tell whether the platform is healthy before customers report issues
- readiness can be used by load balancers and deployment checks
- queue health is visible without opening the database manually

### 2.6 SDK conformance checks

The SDKs now have an executable conformance script.

- the TypeScript SDK is validated against the canonical envelope
- retry behavior is checked with mocked transport
- browser RUM flush behavior is checked with a mocked transport
- rum-key auth is verified to use the correct header

Why this matters:

- SDK changes can be validated before publish
- wire contract changes are caught early
- browser and server SDKs stay aligned

---

## 3. Repository Structure

### 3.1 Root layout

- `apps/server` - Express API, workers, infrastructure, and websocket server
- `apps/web` - Next.js dashboard and public product UI
- `packages/sdk` - core TypeScript SDK
- `packages/browser-sdk` - browser RUM SDK
- `packages/python-sdk` - Python SDK
- `docs` - architecture, implementation, publishing, and operational guides
- `scripts` - release and operational helper scripts
- `docker-compose.yml` - local infrastructure stack

### 3.2 Backend structure

Inside `apps/server/src`:

- `app.ts` - Express app composition and global middleware
- `bootstrap.ts` - process startup, infrastructure connections, worker start, HTTP server creation
- `config/` - environment validation and runtime config
- `infrastructure/` - Mongo, PostgreSQL, Redis, RabbitMQ adapters
- `modules/` - domain modules
- `shared/` - reusable middleware, utils, HTTP contract helpers, health helpers
- `workers/` - async processors for log, aggregation, anomaly, RUM, and alerts
- `events/` - internal event bus

### 3.3 Frontend structure

Inside `apps/web`:

- `app/` - App Router routes, layouts, and providers
- `features/` - domain-oriented UI/data logic per feature
- `shared/api/` - axios client and endpoint map
- `shared/layout/` - app shell and public layout pieces
- `shared/routes/` - route constants

### 3.4 SDK structure

- `packages/sdk/src/http.ts` - transport, retries, auth, idempotency, envelope unwrap
- `packages/sdk/src/client.ts` - domain API surface
- `packages/sdk/src/types.ts` - shared request/response/auth types
- `packages/browser-sdk/src/index.ts` - browser RUM client
- `packages/python-sdk/src/apexmonitor_sdk/client.py` - Python client implementation

---

## 4. Runtime Architecture

## 4.1 Server startup flow

The backend boots in a predictable order:

1. load and validate environment variables
2. connect MongoDB, PostgreSQL, Redis, and RabbitMQ
3. start background workers
4. create Express app
5. attach WebSocket server
6. start HTTP listener

This boot order is important because workers and live monitoring depend on queues and caches being available.

## 4.2 Request handling flow

Every HTTP request follows the same broad path:

1. request enters Express
2. security middleware runs (`helmet`, `cors`, `compression`)
3. request body is parsed
4. request ID is attached and returned in the response
5. route-level auth/access middleware validates the caller
6. controller validates input with Zod
7. service performs the domain action
8. response is wrapped in the canonical success envelope

## 4.3 Background workers

Workers are long-running processors that consume RabbitMQ queues:

- RawLogWorker - persists raw logs to MongoDB
- AggregationWorker - rolls raw logs into hourly PostgreSQL aggregates
- AnomalyWorker - detects spikes and writes insights
- RumWorker - stores and aggregates browser RUM data
- AlertWorker - evaluates alert rules and emits notifications

Workers are important because the platform is intentionally async-first for scale.

---

## 5. User Flow: From Signup to Real-Time Monitoring

This is the actual customer journey a startup would experience.

## 5.1 Signup and login

1. A user signs up or logs in from the web app.
2. The API creates or validates the account.
3. A default project is created during registration.
4. Access and refresh tokens are returned.
5. The frontend stores auth tokens and uses them for protected requests.

## 5.2 Project setup

1. The user opens the dashboard.
2. The app loads the user profile and project list.
3. The user selects a project.
4. The user can create additional projects if needed.
5. Project membership is used everywhere else in the product.

## 5.3 API key creation

1. The owner requests an ingest key or RUM key.
2. The route middleware verifies the user is authenticated.
3. Project access is checked.
4. Owner-only access is enforced for key issuance.
5. The key is shown once and stored hashed in the database.

## 5.4 Server-side log ingestion

1. A backend service or SDK sends a batch to `/api/v1/ingest`.
2. The ingest controller validates the payload.
3. The service rate-limits the batch using Redis and subscription context.
4. The service deduplicates batches when an idempotency key is present.
5. Logs are normalized and privacy-hashed.
6. The batch is published to RabbitMQ.
7. Redis live counters are updated.
8. The API returns `202 queued`.
9. Workers asynchronously persist and aggregate the batch.

## 5.5 Browser RUM ingestion

1. The browser SDK queues page views, errors, custom events, and web vitals.
2. It flushes batches on interval or when the queue reaches the threshold.
3. The browser sends events to `/api/v1/rum` with the RUM key.
4. The backend validates the key and origin.
5. Events are enriched with browser/device/session metadata.
6. The enriched batch is published to RabbitMQ.
7. RumWorker stores raw events and aggregates hourly metrics.

## 5.6 Dashboard metrics and analytics

1. The dashboard requests metrics/logs/traces/insights for a chosen project.
2. Project access is checked before any query runs.
3. PostgreSQL or MongoDB is queried depending on the data type.
4. Redis caches frequently used analytics for short periods.
5. The frontend renders the response in charts, tables, and summary cards.

## 5.7 Real-time live monitoring

1. The dashboard opens a WebSocket connection.
2. The user sends a join request with a JWT and project ID.
3. The server validates the token and project membership.
4. The socket joins the project room.
5. Every two seconds the server reads live counters from Redis.
6. The latest anomaly insight is merged into the payload.
7. The server broadcasts `pulse:live` to all members of the room.

## 5.8 Alert flow

1. AlertWorker evaluates active rules every minute.
2. It reads recent metrics for each project/rule.
3. It triggers an alert if thresholds are breached.
4. Alert events are logged and emitted over the internal event bus.
5. Optional webhook dispatch can notify external systems.

---

## 6. API Contract and Response Shape

The server now uses a canonical envelope.

### Success response

```json
{
  "data": { "...": "..." },
  "meta": {
    "requestId": "req_...",
    "timestamp": "2026-05-26T12:00:00.000Z"
  }
}
```

### Error response

```json
{
  "error": "FORBIDDEN",
  "message": "No access to this project",
  "requestId": "req_..."
}
```

Why the envelope matters:

- SDKs can unwrap data consistently
- request correlation is always present
- clients can distinguish response data from transport metadata

---

## 7. SDK Behavior

## 7.1 TypeScript SDK

The main SDK handles:

- base URL configuration
- bearer, API key, RUM key, and custom auth
- retries with backoff
- timeouts and abort signals
- idempotency keys
- canonical response envelope unwrapping
- request ID propagation

## 7.2 Browser SDK

The browser SDK is a small RUM collector.

- queues events locally
- flushes them on a timer or threshold
- sends browser events to the RUM endpoint
- uses the correct RUM key header
- supports a custom fetcher for testing and controlled environments

## 7.3 Python SDK

The Python SDK mirrors the platform in a lightweight way.

- built with `requests`
- supports retries and idempotency
- exposes convenience methods for the main API areas
- is packaged for PyPI release

---

## 8. Platform Observability

The platform now exposes its own internal health surfaces.

### `/health`

Basic liveness check.

### `/ready`

Readiness check that verifies:

- MongoDB
- PostgreSQL
- Redis
- RabbitMQ
- queue availability

### `/metrics/system`

Internal operational snapshot:

- uptime
- memory usage
- service status flags
- queue counts and consumer counts

Additionally:

- HTTP request logs are structured
- request IDs are available in every response
- workers and routers can be traced through consistent logs

---

## 9. Security and Isolation Rules

- Only authenticated users can access dashboard APIs.
- Only users with project access can query project-scoped data.
- Only owners can issue keys and manage membership.
- RUM ingest is restricted by origin and key validation.
- Ingest batches are rate-limited and deduplicated.
- IPs are hashed before persistence.

These are the rules that make the platform safe enough for a real startup tenant model.

---

## 10. Current Operational Data Stores

### MongoDB

- raw logs
- raw RUM events

### PostgreSQL

- users
- projects
- project members
- subscriptions
- api keys
- rum keys
- hourly aggregates
- alerts and insights data

### Redis

- auth/key cache
- rate limits
- live counters
- short-lived analytics cache
- idempotency cache
- webhook and anomaly baseline state

### RabbitMQ

- ingest fan-out
- worker queueing
- DLQ routing
- async backpressure control

---

## 11. Conformance and Release Flow

SDK releases now have a conformance script.

What it checks:

- retry behavior
- auth header correctness
- canonical success envelope handling
- browser RUM flush format
- RUM key header correctness

Why this matters:

- package releases are safer
- runtime changes are validated before publish
- browser and server SDKs stay aligned

---

## 12. Future AI Direction

The system already emits insights from anomaly detection. A future AI layer can sit on top of this.

Possible AI stages:

1. anomaly explanation
2. cross-signal correlation
3. incident summarization
4. remediation suggestions
5. natural-language querying for dashboards

Best practice:

- keep deterministic monitoring as the source of truth
- add AI as an assistant layer on top, not as the only detection system

---

## 13. Summary of What the Product Is Doing

At a high level, the product does this:

- users sign in and create or join projects
- owners issue API and RUM keys
- servers and browsers send telemetry to the platform
- telemetry is validated, rate-limited, normalized, and queued
- workers aggregate and analyze the telemetry asynchronously
- the dashboard reads aggregated data and receives live updates through WebSockets
- alerts and anomalies are emitted as internal events
- the platform exposes its own health and metrics endpoints
- SDKs provide a clean integration layer for customer applications

This is the complete working model of the current system.

---

## 14. Reference Files

Backend:

- `apps/server/src/app.ts`
- `apps/server/src/bootstrap.ts`
- `apps/server/src/shared/http/api-contract.ts`
- `apps/server/src/shared/http/platform-controller.ts`
- `apps/server/src/shared/services/platform-health.service.ts`
- `apps/server/src/shared/middleware/require-project-access.ts`
- `apps/server/src/modules/ingest/ingest.service.ts`
- `apps/server/src/modules/rum/rum.service.ts`
- `apps/server/src/modules/websocket/websocket.service.ts`
- `apps/server/src/workers/*`

Frontend:

- `apps/web/app/layout.tsx`
- `apps/web/app/providers/AppProviders.tsx`
- `apps/web/shared/api/apiClient.ts`
- `apps/web/shared/layout/AppShell.tsx`

SDKs:

- `packages/sdk/src/http.ts`
- `packages/sdk/src/client.ts`
- `packages/browser-sdk/src/index.ts`
- `packages/python-sdk/src/apexmonitor_sdk/client.py`

Operational docs:

- `docs/project-architecture-internal.md`
- `docs/sdk-publishing.md`
- `scripts/sdk-conformance.mjs`
