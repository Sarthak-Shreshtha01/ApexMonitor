# ApexMonitor

**ApexMonitor** is a full-stack, self-hostable application performance monitoring (APM) platform. It gives engineering teams real-time visibility into their backend APIs and frontend user experience — covering request metrics, distributed traces, raw logs, RUM (Real User Monitoring) analytics, anomaly detection, and billing-gated tier management.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Monorepo Structure](#monorepo-structure)
- [Architecture Diagram](#architecture-diagram)
- [Data Flow](#data-flow)
- [User Flow Diagram](#user-flow-diagram)
- [Database Schema](#database-schema)
- [API Reference](#api-reference)
- [SDKs](#sdks)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)

---

## Features

| Category | Capability |
|---|---|
| **Ingestion** | Batch HTTP log ingestion with sliding-window rate limiting (tier-aware) |
| **RUM** | Browser page views, web vitals (LCP, FCP, TTFB), errors, custom events |
| **Metrics** | Hourly & 5-minute aggregated P50/P95/P99 latency, RPS, error rate, Apdex score |
| **Traces** | Distributed trace storage and waterfall visualization |
| **Logs** | Raw log storage in MongoDB with full-text and filter querying |
| **Anomaly Detection** | Z-score-based latency spike detection with automated insights |
| **Alerts** | Configurable alert rules (error rate, latency threshold) with webhook/email delivery |
| **Live Traffic** | Real-time RPS, error rate, and top endpoints pushed over WebSocket (every 2 s) |
| **AI Insights** | Automatically generated plain-language insight cards surfaced in the dashboard |
| **Projects & Teams** | Multi-project workspace with owner/developer RBAC |
| **API Keys** | Argon2id-hashed ingest keys and RUM write keys with per-origin allowlisting |
| **Billing** | PhonePe payment integration; FREE → PRO tier upgrade (10× rate limit) |
| **OAuth** | Google and GitHub OAuth 2.0 login/register |

---

## Tech Stack

### Backend (`apps/server`)

| Layer | Technology |
|---|---|
| Runtime | Node.js + TypeScript |
| HTTP Framework | Express 5 |
| Authentication | JWT (jsonwebtoken) + Argon2id |
| Validation | Zod |
| Primary DB | **PostgreSQL 16** — aggregated metrics, config, users, billing |
| Raw Log Store | **MongoDB 7** — raw HTTP log documents + RUM events |
| Cache / Rate Limit | **Redis 7** — sliding-window counters, API key cache, live counters, anomaly baselines |
| Message Queue | **RabbitMQ 3.13** — async log & RUM processing pipeline |
| Real-time | Socket.IO 4 — WebSocket push for live traffic dashboard |
| Logging | Pino |
| Security | Helmet, CORS, IP hashing (SHA-256 with daily salt) |

### Frontend (`apps/web`)

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (React 19, App Router) |
| Styling | Tailwind CSS 4 |
| State Management | Redux Toolkit + Redux Persist |
| Server State | TanStack React Query |
| Charts | Recharts |
| Maps | React-Leaflet + Leaflet.heat (heatmap) |
| Real-time | Socket.IO Client |
| Icons | Lucide React |

### SDKs

| Package | Language | Purpose |
|---|---|---|
| `@apexmonitor/sdk` | TypeScript/Node.js | Server-side batch log + API client |
| `@apexmonitor/browser-sdk` | TypeScript/Browser | RUM event collection + flush |
| `apexmonitor_sdk` (Python) | Python | Server-side log ingestion |

---

## Monorepo Structure

```
ApexMonitor/
├── apps/
│   ├── server/                  # Express API server
│   │   └── src/
│   │       ├── bootstrap.ts     # App entry point — wires infra + workers
│   │       ├── app.ts           # Express app factory, route mounting
│   │       ├── config/          # Env-based config
│   │       ├── infrastructure/  # DB, Redis, RabbitMQ connection helpers
│   │       │   ├── db/
│   │       │   │   ├── mongo.ts
│   │       │   │   └── postgres.ts
│   │       │   ├── redis.ts
│   │       │   └── rabbitmq.ts
│   │       ├── modules/         # Feature modules (controller → service → repository)
│   │       │   ├── auth/        # JWT, OAuth (Google/GitHub), key validation
│   │       │   ├── ingest/      # SDK batch log ingestion
│   │       │   ├── rum/         # Real User Monitoring ingestion + queries
│   │       │   ├── metrics/     # Aggregated metrics queries
│   │       │   ├── logs/        # Raw log queries (MongoDB)
│   │       │   ├── traces/      # Distributed trace storage + queries
│   │       │   ├── insights/    # Anomaly insights CRUD
│   │       │   ├── alerts/      # Alert rules and events
│   │       │   ├── keys/        # API key management
│   │       │   ├── projects/    # Project CRUD
│   │       │   ├── users/       # User registration, login, team membership
│   │       │   ├── billing/     # PhonePe checkout + webhook handler
│   │       │   └── websocket/   # Socket.IO live traffic broadcaster
│   │       ├── workers/         # RabbitMQ consumer workers
│   │       │   ├── raw-log.worker.ts        # Writes raw logs → MongoDB
│   │       │   ├── aggregation.worker.ts    # Aggregates → PostgreSQL hourly_metrics
│   │       │   ├── anomaly.worker.ts        # Z-score anomaly detection → insights
│   │       │   ├── alert.worker.ts          # Alert rule evaluation
│   │       │   └── rum.worker.ts            # RUM events → PostgreSQL
│   │       ├── events/          # In-process EventEmitter bus
│   │       └── shared/          # Middleware, utils, constants
│   │
│   └── web/                     # Next.js dashboard
│       ├── app/
│       │   ├── (auth)/          # /login  /register  /oauth/callback
│       │   ├── (dashboard)/     # Protected dashboard routes
│       │   │   ├── overview/    # Traffic overview + metric cards
│       │   │   ├── live-traffic/# Real-time WebSocket stream
│       │   │   ├── logs/        # Raw log explorer
│       │   │   ├── traces/      # Trace list + waterfall detail
│       │   │   ├── analytics/   # RUM analytics (browser, geo, referrers)
│       │   │   ├── ai-insights/ # Anomaly insight cards
│       │   │   ├── keys/        # API key management
│       │   │   ├── settings/    # User + team settings
│       │   │   └── billing/     # Subscription management
│       │   └── (marketing)/     # Landing page, about
│       ├── features/            # Feature-slice UI + state (co-located by domain)
│       ├── shared/              # Shared layout, API client, route constants
│       └── lib/redux/           # Redux store + persistence setup
│
├── packages/
│   ├── sdk/                     # @apexmonitor/sdk  (TypeScript)
│   ├── browser-sdk/             # @apexmonitor/browser-sdk (TypeScript)
│   └── python-sdk/              # apexmonitor_sdk  (Python)
│
├── scripts/
│   ├── init-postgres.sql        # Initial schema (all tables)
│   ├── migrate-v2.sql           # Incremental migrations
│   ├── migrate-v3.sql
│   ├── migrate-v4.sql
│   └── migrate-v4-rum.sql
│
├── docker-compose.yml           # Local infra (Mongo, Postgres, Redis, RabbitMQ)
├── turbo.json                   # Turborepo pipeline config
└── package.json                 # Root workspace + scripts
```

---

## Architecture Diagram

```mermaid
graph TB
    subgraph Clients["Client Applications"]
        ServerSDK["@apexmonitor/sdk\n(Node.js Server)"]
        BrowserSDK["@apexmonitor/browser-sdk\n(Browser)"]
        PythonSDK["apexmonitor_sdk\n(Python Server)"]
        WebDash["Next.js Dashboard\n(apps/web)"]
    end

    subgraph API["Express API Server (apps/server)"]
        direction TB
        IngestAPI["/api/v1/ingest\nBatch Log Ingestion"]
        RumAPI["/api/v1/rum\nRUM Ingestion"]
        MetricsAPI["/api/v1/metrics\nAggregated Metrics"]
        LogsAPI["/api/v1/logs\nRaw Log Queries"]
        TracesAPI["/api/v1/traces\nDistributed Traces"]
        InsightsAPI["/api/v1/insights\nAnomaly Insights"]
        AuthAPI["/api/v1/auth\nJWT + OAuth + Keys"]
        KeysAPI["/api/v1/keys\nKey Management"]
        ProjectsAPI["/api/v1/projects\nProject CRUD"]
        BillingAPI["/api/v1/billing\nPhonePe Checkout"]
        WS["Socket.IO\nWebSocket Server"]
    end

    subgraph Queue["Message Queue"]
        RMQ["RabbitMQ\nlogs.exchange\naggregation_queue\nanomaly_queue\nrum.ingest"]
    end

    subgraph Workers["Background Workers"]
        RawLog["RawLogWorker\nlog.ingest → MongoDB"]
        Aggregation["AggregationWorker\naggregation_queue → PostgreSQL\nhourly_metrics upsert"]
        Anomaly["AnomalyWorker\nanomaly_queue → Z-Score\n→ insights table"]
        Alert["AlertWorker\nAlert rule evaluation"]
        Rum["RumWorker\nrum.ingest → PostgreSQL\nrum_events table"]
    end

    subgraph Storage["Data Stores"]
        Mongo["MongoDB 7\nRaw logs\nRUM events (raw)"]
        PG["PostgreSQL 16\nhourly_metrics\nfive_minute_metrics\nrum_events\ninsights\nalert_rules\nprojects\nusers\napi_keys\nsubscriptions"]
        Redis["Redis 7\nRate limiting\nAPI key cache\nLive counters\nAnomaly baseline"]
    end

    subgraph EventBus["In-Process Event Bus"]
        EB["EventEmitter\naggregation.completed\nanomaly.detected"]
    end

    ServerSDK -->|"POST /api/v1/ingest\n(bearer proj_…key)"| IngestAPI
    BrowserSDK -->|"POST /api/v1/rum\n(bearer rum_…key)"| RumAPI
    PythonSDK -->|"POST /api/v1/ingest"| IngestAPI
    WebDash -->|"REST + Cookie Auth"| MetricsAPI
    WebDash -->|REST| LogsAPI
    WebDash -->|REST| TracesAPI
    WebDash -->|REST| InsightsAPI
    WebDash -->|REST| AuthAPI
    WebDash -->|REST| KeysAPI
    WebDash -->|REST| ProjectsAPI
    WebDash -->|REST| BillingAPI
    WebDash <-->|"Socket.IO\npulse:live every 2s"| WS

    IngestAPI -->|"Sliding-window rate limit"| Redis
    IngestAPI -->|"Publish log.ingest"| RMQ
    IngestAPI -->|"Increment live counters"| Redis
    RumAPI -->|"Publish rum.ingest"| RMQ

    RMQ --> RawLog
    RMQ --> Aggregation
    RMQ --> Anomaly
    RMQ --> Rum

    RawLog --> Mongo
    Aggregation --> PG
    Aggregation --> EB
    Anomaly --> PG
    Anomaly --> EB
    Rum --> PG

    EB -->|"anomaly.detected"| WS
    WS -->|"Read live counters every 2s"| Redis

    AuthAPI --> Redis
    AuthAPI --> PG
    MetricsAPI --> PG
    LogsAPI --> Mongo
    TracesAPI --> PG
    InsightsAPI --> PG
    Alert --> PG
```

---

## Data Flow

### Backend Log Ingestion Pipeline

```
SDK (server)
  │
  ▼  POST /api/v1/ingest  (Authorization: Bearer proj_…)
[IngestService]
  ├── 1. Resolve project owner (Redis cache → PostgreSQL)
  ├── 2. Look up subscription tier (Redis cache → PostgreSQL)
  ├── 3. Sliding-window rate limit via Redis INCR  (FREE: 60k/min, PRO: 600k/min)
  ├── 4. Normalize logs (UUID/number path params → :id, IP hash with daily salt)
  ├── 5. Publish normalized batch to RabbitMQ  [logs.exchange → log.ingest]
  └── 6. Increment live Redis counters  (requests, errors, latency_total, endpoint scores)

RabbitMQ (logs.exchange, fanout → multiple queues)
  ├── raw_log_queue   → RawLogWorker    → MongoDB  (raw_logs collection)
  ├── aggregation_queue → AggregationWorker → PostgreSQL  (hourly_metrics UPSERT)
  │                                           emits  aggregation.completed
  └── anomaly_queue   → AnomalyWorker   → Z-score vs. Redis baseline (20-point window)
                                            if z > 3.0 → PostgreSQL (insights)
                                            emits  anomaly.detected

EventBus (anomaly.detected)
  └── WebSocketService.latestInsights map updated

WebSocketService (every 2 s)
  └── For each active Socket.IO room (projectId):
        Read Redis counters → compute RPS, error rate, top endpoints
        Emit  pulse:live  to all connected dashboard clients
```

### RUM Pipeline

```
Browser SDK
  │
  ▼  POST /api/v1/rum  (Authorization: Bearer rum_…)
[RumService]
  ├── 1. Per-minute rate limit via Redis INCR
  ├── 2. Idempotency check (5-min Redis lock)
  ├── 3. Enrich events (browser, OS, device type, visitor/session HMAC hashes)
  ├── 4. Filter stale events (>24h old or >5min future drift)
  └── 5. Publish to RabbitMQ  [logs.exchange → rum.ingest]

RumWorker
  └── Consumes rum.ingest → INSERT INTO rum_events (PostgreSQL)

Dashboard
  └── GET /api/v1/rum/overview|series|paths|devices|geo|referrers
        → RumRepository queries PostgreSQL
```

---

## User Flow Diagram

```mermaid
flowchart TD
    A([New User]) --> B{Has Account?}

    B -- No --> C[Visit Landing Page]
    C --> D[Register\nemail/password\nor OAuth]
    D --> E[Create Project\nin Onboarding]

    B -- Yes --> F[Login\nor OAuth]
    F --> G[Dashboard]

    E --> H[Copy Project ID +\nGenerate API Key]
    H --> I[Install SDK]

    I --> J{SDK Type?}
    J -- Node.js --> K["npm i @apexmonitor/sdk\nWrap routes with middleware"]
    J -- Browser --> L["npm i @apexmonitor/browser-sdk\ncreateRumClient().start()"]
    J -- Python --> M["pip install apexmonitor-sdk\nWrap Flask/FastAPI"]

    K --> N[SDK batches HTTP logs\n→ POST /api/v1/ingest]
    L --> O[Browser SDK collects\npage views + web vitals\n→ POST /api/v1/rum]
    M --> N

    N --> P[RabbitMQ Pipeline]
    O --> P

    P --> Q[Workers process async]
    Q --> R[(PostgreSQL\nMongoDB)]

    G --> S[Overview Page\nMetric Cards + Charts]
    G --> T[Live Traffic\nWebSocket real-time feed]
    G --> U[Logs Explorer\nFilter by status/endpoint]
    G --> V[Traces\nWaterfall view]
    G --> W[Analytics / RUM\nBrowser & Geo breakdown]
    G --> X[AI Insights\nAnomaly cards]
    G --> Y[API Keys\nCreate / Revoke]
    G --> Z[Settings\nTeam members / RBAC]
    G --> AA[Billing\nUpgrade to PRO]

    AA --> AB[PhonePe Checkout]
    AB --> AC{Payment Success?}
    AC -- Yes --> AD[Webhook → PRO Tier\nRedis cache cleared\n10× rate limit applied]
    AC -- No --> AA
```

---

## Database Schema

### PostgreSQL (aggregated data, config, billing)

| Table | Purpose |
|---|---|
| `projects` | Project metadata, plan tier, rate limit config |
| `api_keys` | Argon2id-hashed ingest API keys (prefix-indexed for O(1) lookup) |
| `rum_api_keys` | RUM write keys with allowed-origins allowlist |
| `project_members` | User ↔ Project RBAC (owner / developer) |
| `users` | User accounts (email, password hash, timezone) |
| `subscriptions` | Billing tier (FREE / PRO), last transaction |
| `hourly_metrics` | Per-endpoint, per-hour P50/P95/P99, error count, Apdex buckets |
| `five_minute_metrics` | Fine-grained 5-min buckets for recent charts |
| `rum_events` | Enriched RUM events (page views, web vitals, device, geo) |
| `insights` | Anomaly insight records (severity, type, message, JSONB metadata) |
| `alert_rules` | Configurable threshold alerts (error rate / latency) |
| `alert_events` | Triggered alert history |

### MongoDB (raw documents)

| Collection | Purpose |
|---|---|
| `raw_logs` | Full normalized HTTP log entries (method, endpoint, status, latency, hashed IP, tags) |
| `rum_events` (raw) | Buffered RUM events before PostgreSQL write |
| `traces` | Distributed trace spans |

---

## API Reference

All endpoints are prefixed with `/api/v1`.

### Authentication
| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/auth/login` | — | Email/password login |
| `POST` | `/auth/refresh` | Cookie | Refresh JWT session |
| `POST` | `/auth/logout` | Cookie | Invalidate session |
| `GET`  | `/auth/oauth/:provider/start` | — | Redirect to Google/GitHub OAuth |
| `GET`  | `/auth/oauth/:provider/callback` | — | Handle OAuth callback |
| `POST` | `/auth/keys` | JWT | Generate ingest API key |
| `POST` | `/auth/rum-keys` | JWT | Generate RUM write key |

### Ingestion
| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/ingest` | Bearer `proj_…` | Batch log ingestion |
| `POST` | `/rum` | Bearer `rum_…` | RUM event batch |

### Metrics & Observability
| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/metrics/overview` | JWT | Request count, error rate, avg latency |
| `GET` | `/metrics/latency` | JWT | P50/P95/P99 time series |
| `GET` | `/metrics/rps` | JWT | Requests-per-second time series |
| `GET` | `/metrics/endpoints` | JWT | Top endpoints by volume |
| `GET` | `/logs` | JWT | Raw log query (filter by status, endpoint, time) |
| `GET` | `/traces` | JWT | Trace list |
| `GET` | `/traces/:traceId` | JWT | Trace detail with spans |
| `GET` | `/insights` | JWT | Anomaly insights |

### RUM Analytics
| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/rum/overview` | JWT | Sessions, page views, bounce rate |
| `GET` | `/rum/series` | JWT | Time-series for web vitals |
| `GET` | `/rum/paths` | JWT | Top pages by view count |
| `GET` | `/rum/devices` | JWT | Browser / OS / device breakdown |
| `GET` | `/rum/geo` | JWT | Country / region breakdown |
| `GET` | `/rum/referrers` | JWT | Referrer source breakdown |

### Management
| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/users/register` | — | Create account |
| `GET` | `/users/me` | JWT | Current user profile |
| `GET/POST` | `/users/:projectId/members` | JWT | List / add team members |
| `PATCH/DELETE` | `/users/:projectId/members/:id` | JWT | Update / remove member |
| `GET/POST` | `/projects` | JWT | List / create projects |
| `GET/POST/DELETE` | `/keys` | JWT | API key management |
| `POST` | `/billing/checkout` | JWT | Initiate PhonePe checkout |

---

## SDKs

### Node.js / TypeScript SDK

```ts
import { createApexClient } from '@apexmonitor/sdk';

const apex = createApexClient({
  baseUrl: 'https://your-apexmonitor-server.com',
  auth: { type: 'apiKey', key: 'proj_...' },
});

// Send a batch of HTTP logs
await apex.ingest.batch({
  projectId: 'your-project-id',
  sdkVersion: '1.0.0',
  logs: [
    {
      method: 'GET',
      endpoint: '/api/users/123',
      statusCode: 200,
      latencyMs: 45,
      ip: '1.2.3.4',
      userAgent: 'Mozilla/5.0',
      timestamp: new Date().toISOString(),
    },
  ],
});
```

### Browser RUM SDK

```ts
import { createBrowserRumClient } from '@apexmonitor/browser-sdk';

const rum = createBrowserRumClient({
  baseUrl: 'https://your-apexmonitor-server.com',
  projectId: 'your-project-id',
  rumKey: 'rum_...',
  flushIntervalMs: 5000,
});

rum.start(); // Starts auto-flush interval + beforeunload handler

rum.trackPageView('/dashboard');
rum.trackError(new Error('Something went wrong'));
rum.trackWebVitals({ lcpMs: 1200, fcpMs: 800, ttfbMs: 120 });
rum.trackCustom('button_click', { buttonId: 'upgrade-cta' });
```

### Python SDK

```python
from apexmonitor_sdk import ApexMonitorClient

client = ApexMonitorClient(
    base_url="https://your-apexmonitor-server.com",
    api_key="proj_...",
    project_id="your-project-id",
)

client.ingest([
    {
        "method": "POST",
        "endpoint": "/api/orders",
        "statusCode": 201,
        "latencyMs": 120,
        "ip": "1.2.3.4",
        "userAgent": "python-requests/2.31",
        "timestamp": "2024-01-01T00:00:00Z",
    }
])
```

---

## Getting Started

### Prerequisites

- Node.js ≥ 20
- Docker + Docker Compose
- npm ≥ 9 (workspaces support)

### 1. Start Infrastructure

```bash
docker-compose up -d
```

This starts:
- **MongoDB** on port `27018`
- **PostgreSQL** on port `9999` (auto-seeds schema from `scripts/init-postgres.sql`)
- **Redis** on port `6379`
- **RabbitMQ** on port `5672` (management UI: http://localhost:15672, user: `pulse`, password: `pulse_dev`)

### 2. Configure Environment Variables

```bash
cp apps/server/.env.example apps/server/.env
# Edit apps/server/.env — see Environment Variables section below
```

### 3. Run the API Server

```bash
npm run dev:server
```

Server starts on `http://localhost:3001` (or `PORT` from env).

### 4. Run the Web Dashboard

```bash
npm run dev:web
```

Dashboard starts on `http://localhost:3000`.

### 5. Build the SDKs

```bash
npm run build:sdks
```

---

## Environment Variables

### `apps/server/.env`

| Variable | Description | Example |
|---|---|---|
| `PORT` | HTTP server port | `3001` |
| `MONGODB_URI` | MongoDB connection string | `mongodb://localhost:27018/apexmonitor` |
| `POSTGRES_URL` | PostgreSQL connection string | `postgresql://pulse:pulse_dev_password@localhost:9999/apexmonitor` |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` |
| `RABBITMQ_URL` | RabbitMQ AMQP URL | `amqp://pulse:pulse_dev@localhost:5672` |
| `JWT_SECRET` | Secret for signing JWTs | `change-me-in-production` |
| `ARGON2_PEPPER` | Additional pepper for Argon2id key hashing | `change-me-in-production` |
| `CORS_ORIGINS` | Allowed CORS origins (comma-separated) | `http://localhost:3000` |
| `FRONTEND_URL` | Frontend URL (for OAuth redirects) | `http://localhost:3000` |
| `RATE_LIMIT_RPM` | Default base rate limit (requests/min) | `60000` |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | *(optional)* |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | *(optional)* |
| `GOOGLE_REDIRECT_URI` | Google OAuth redirect URI | `http://localhost:3001/api/v1/auth/oauth/google/callback` |
| `GITHUB_CLIENT_ID` | GitHub OAuth client ID | *(optional)* |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth client secret | *(optional)* |
| `GITHUB_REDIRECT_URI` | GitHub OAuth redirect URI | `http://localhost:3001/api/v1/auth/oauth/github/callback` |
| `RUM_RATE_LIMIT_RPM` | RUM-specific rate limit override | *(optional, defaults to 2× RATE_LIMIT_RPM)* |
