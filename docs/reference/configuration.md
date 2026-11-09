# Configuration

## Server (`apps/server`)

Read from the process environment and validated with Zod by `apps/server/src/config/config.ts`; the process exits with a list of problems if a value is missing or invalid. For local development, a **`<repo-root>/.env`** file is loaded when present (it never overrides variables already set, and is ignored when `NODE_ENV=test`). Copy `.env.example` to `.env` to start.

| Variable | Required | Default | Description |
|---|---|---|---|
| `NODE_ENV` | no | `development` | `development` \| `test` \| `production` |
| `PORT` | no | `3000` | HTTP + Socket.IO port |
| `MONGO_URI` | **yes** | n/a | e.g. `mongodb://localhost:27018/apexmonitor` |
| `PG_URI` | **yes** | n/a | e.g. `postgresql://pulse:pulse_dev_password@localhost:9999/apexmonitor` |
| `REDIS_URL` | **yes** | n/a | e.g. `redis://localhost:6379` |
| `RABBITMQ_URL` | **yes** | n/a | e.g. `amqp://pulse:pulse_dev@localhost:5672` |
| `JWT_SECRET` | **yes** | n/a | ≥32 chars. Signs access tokens; refresh and OAuth-state keys are derived from it unless overridden |
| `JWT_REFRESH_SECRET` | no | derived from `JWT_SECRET` | ≥32 chars. Dedicated refresh-token signing key; changing it logs everyone out |
| `ARGON2_PEPPER` | **yes** | n/a | ≥32 chars. Appended to API keys before hashing; changing it invalidates all keys |
| `CORS_ORIGINS` | **yes** | n/a | Comma-separated origins (HTTP + Socket.IO) |
| `RATE_LIMIT_RPM` | no | `60000` | Base limit; RUM default is 2× this |
| `LOG_LEVEL` | no | `info` | `debug` \| `info` \| `warn` \| `error` |
| `API_BASE_URL` | no | `http://localhost:3000` | Public API URL (OAuth redirects) |
| `FRONTEND_URL` | no | `http://localhost:3001` | Web URL (OAuth callback redirect) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REDIRECT_URI` | no | n/a | Google OAuth |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` / `GITHUB_REDIRECT_URI` | no | n/a | GitHub OAuth |

Read directly from `process.env` (not validated):

| Variable | Default | Description |
|---|---|---|
| `RUM_RATE_LIMIT_RPM` | `2 × RATE_LIMIT_RPM` | RUM per-minute limit per project |
| `PHONEPE_MERCHANT_ID` | sandbox `PGTESTPAYUAT` | **Must** be set in production (KI-7) |
| `PHONEPE_SALT_KEY` | public sandbox key | **Must** be set in production |
| `PHONEPE_SALT_INDEX` | `1` | |

Generate secrets with:

```bash
openssl rand -base64 48
```

## Web (`apps/web`)

Next.js reads `apps/web/.env.local`.

| Variable | Example | Description |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:3000` | REST base URL |
| `NEXT_PUBLIC_WS_URL` | `http://localhost:3000` | Socket.IO URL |

Run the web app on a port that isn't the API's (e.g. `npm run dev:web -- -p 3001`) and include it in `CORS_ORIGINS`.

## Local infrastructure (`docker-compose.yml`)

| Service | Host port | Credentials (dev only) |
|---|---|---|
| MongoDB 7 | 27018 | none |
| PostgreSQL 16 | 9999 | db `apexmonitor`, user `pulse`, password `pulse_dev_password` |
| Redis 7 | 6379 | none; `maxmemory 256mb`, `allkeys-lru` |
| RabbitMQ 3.13 | 5672, UI 15672 | `pulse` / `pulse_dev` |

## CI secrets (GitHub Actions)

| Secret | Used by |
|---|---|
| `NPM_TOKEN` | `release-sdks.yml` npm publish |
| `PYPI_API_TOKEN` | `release-sdks.yml` PyPI upload |
