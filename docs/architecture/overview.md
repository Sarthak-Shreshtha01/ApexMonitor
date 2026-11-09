# Architecture Overview

ApexMonitor collects telemetry from customer applications (server request logs and browser RUM events), processes it asynchronously, and serves dashboards, live traffic, anomaly insights, and alerts.

> Describes the system **as built** at commit `debac85`. For the planned design see [target-architecture.md](target-architecture.md). Defects are in [../known-issues.md](../known-issues.md).

## System context

```mermaid
flowchart LR
    subgraph Customer["Customer systems"]
        BE["Backend services<br/>(@apexmonitor/sdk, Python SDK)"]
        FE["Web frontends<br/>(@apexmonitor/browser-sdk)"]
    end
    Users["Customer engineers<br/>(browser)"]
    Ext["Webhook receivers<br/>(Slack, custom)"]
    OAuth["Google / GitHub OAuth"]
    Pay["PhonePe"]

    BE -- "POST /api/v1/ingest<br/>x-api-key" --> AM
    FE -- "POST /api/v1/rum<br/>x-rum-key" --> AM
    Users -- "HTTPS + Socket.IO" --> WEB["ApexMonitor Web<br/>(Next.js)"]
    WEB -- "REST /api/v1 (JWT)" --> AM["ApexMonitor API + Workers<br/>(Express, one process)"]
    AM -- webhooks --> Ext
    AM <--> OAuth
    AM <--> Pay
```

## Containers (runtime processes)

```mermaid
flowchart TB
    subgraph proc["apps/server: single Node.js process"]
        HTTP["Express HTTP API<br/>/api/v1/*, /health, /ready"]
        WS["Socket.IO server<br/>pulse:live every 2s"]
        RL["RawLogWorker"]
        AG["AggregationWorker"]
        AN["AnomalyWorker"]
        RU["RumWorker"]
        AL["AlertWorker<br/>(setInterval 60s)"]
        EB(("in-process<br/>EventBus"))
    end
    WEBAPP["apps/web<br/>Next.js 16"]

    MQ[["RabbitMQ<br/>logs.exchange"]]
    PG[("PostgreSQL 16<br/>metadata + aggregates")]
    MG[("MongoDB 7<br/>raw logs, raw RUM")]
    RD[("Redis 7<br/>cache, rate limits,<br/>live counters, baselines")]

    WEBAPP --> HTTP
    WEBAPP <--> WS
    HTTP --> RD
    HTTP --> PG
    HTTP --> MG
    HTTP -- publish --> MQ
    MQ --> RL & AG & AN & RU
    RL --> MG
    AG --> PG
    AN --> RD
    AN --> PG
    RU --> MG & PG & RD
    AL --> PG
    AG & AN & AL --> EB --> WS
    WS --> RD
```

Key facts:

- **One backend process** runs the HTTP API, Socket.IO, four RabbitMQ consumers, and the alert loop (`apps/server/src/bootstrap.ts`). They can't be scaled separately yet.
- **Async-first ingest:** ingest endpoints validate, rate-limit, normalise, publish to RabbitMQ, and return `202`. Persistence and aggregation happen in workers.
- **Two read paths:** dashboards query aggregates in Postgres (metrics, RUM) or raw documents in Mongo (logs, "traces"); live traffic reads short-TTL counters from Redis.
- **Event bus** is a typed Node `EventEmitter`, so it only works because everything shares one process.

## Components

| Component | Location | Responsibility |
|---|---|---|
| API server | `apps/server/src/app.ts`, `modules/*` | Auth, key management, ingest endpoints, query endpoints, billing |
| Workers | `apps/server/src/workers/*` | Persist raw data, aggregate, detect anomalies, evaluate alerts |
| Realtime | `apps/server/src/modules/websocket` | Authenticated project rooms, 2 s live pulse |
| Dashboard | `apps/web` | Marketing, auth, and dashboard UI |
| TS SDK | `packages/sdk` | Typed client for all API domains; transport with retries/idempotency |
| Browser SDK | `packages/browser-sdk` | Queues and flushes RUM events (built on TS SDK) |
| Python SDK | `packages/python-sdk` | `requests`-based client for ingest and read APIs |
| Schema | `scripts/*.sql` | Postgres DDL + migrations |
| Local infra | `docker-compose.yml` | Mongo, Postgres, Redis, RabbitMQ |

## Tech stack

| Layer | Choice |
|---|---|
| Language | TypeScript (Node 20), Python ≥ 3.9 for the Python SDK |
| HTTP | Express 5, helmet, cors, compression, pino-http |
| Validation | Zod 4 |
| Auth | jsonwebtoken (HS256), argon2id for keys and passwords |
| Queue | RabbitMQ 3.13 via amqplib |
| Stores | PostgreSQL 16 (`pg`), MongoDB 7 (mongoose), Redis 7 (ioredis) |
| Realtime | Socket.IO 4 |
| Web | Next.js 16 (App Router), React 19, Tailwind 4, Redux Toolkit + redux-persist, TanStack Query, Recharts, React-Leaflet |
| CI | GitHub Actions: build, migration validation, SDK conformance, SDK release |

## Quality attributes (current)

| Attribute | Status |
|---|---|
| Tenant isolation | Enforced on dashboard reads; **not** on log ingest (KI-2) |
| Durability | Queues and messages durable; publisher confirms missing (KI-16) |
| Correctness | Hourly percentiles/averages wrong when merged (KI-8) |
| Scalability | Single process; in-process event bus; interval-based alert loop (KI-20) |
| Observability of itself | `/health`, `/ready`, `/metrics/system`, pino request logs |
| Testability | No tests; module-level singletons (KI-28) |

## Related
- [backend.md](backend.md) · [data-flow.md](data-flow.md) · [data-model.md](data-model.md) · [frontend.md](frontend.md) · [security.md](security.md)
