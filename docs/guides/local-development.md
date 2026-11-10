# Local Development

## Prerequisites

- Node.js 20+ and npm 9+ (workspaces)
- Docker + Docker Compose
- Python 3.9+ (only for the Python SDK)

## 1. Install

```bash
git clone <repo-url> apexmonitor && cd apexmonitor
npm install
```

## 2. Start infrastructure

```bash
docker compose up -d
docker compose ps        # all four services should be "running"
```

| Service | URL |
|---|---|
| PostgreSQL | `localhost:9999` (db `apexmonitor`, user `pulse`) |
| MongoDB | `localhost:27018` |
| Redis | `localhost:6379` |
| RabbitMQ | `localhost:5672`, UI http://localhost:15672 (`pulse` / `pulse_dev`) |

## 3. Database schema

Migrations live in `scripts/migrations/` (`0001_initial_schema.sql`, `0002_…`) and are tracked in the `schema_migrations` table. `npm run dev:server` applies pending ones at startup; to run them yourself:

```bash
npm run db:migrate          # apply pending migrations
npm run db:migrate:status   # applied / pending (exits 2 if anything is pending)
```

A database set up by hand with the old `init-postgres.sql` + `migrate-v*.sql` files is adopted automatically: every file is safe to re-apply, so the first run re-applies them and records them. To reset everything: `docker compose down -v && docker compose up -d`, then start the server.

## 4. Configure

```bash
cp .env.example .env                       # repo root, NOT apps/server/.env
# set JWT_SECRET and ARGON2_PEPPER to 32+ random chars: openssl rand -base64 48

cat > apps/web/.env.local <<'EOF'
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_WS_URL=http://localhost:3000
EOF
```

## 5. Run

```bash
npm run dev:server                # API + workers + Socket.IO on :3000
npm run dev:web -- -p 3001        # dashboard on :3001 (matches CORS_ORIGINS / FRONTEND_URL)
```

Check: `curl localhost:3000/ready` should report all dependencies healthy.

## 6. Send test data

1. Register at http://localhost:3001/register (creates a default project).
2. Create an ingest key on **Keys**.
3. Send a batch:

```bash
curl -X POST localhost:3000/api/v1/ingest \
  -H "x-api-key: proj_…" -H "content-type: application/json" \
  -d '{"projectId":"proj_…","logs":[{"method":"GET","endpoint":"/users/1","statusCode":200,"latencyMs":42,"timestamp":"'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'"}]}'
```

4. Open **Live traffic** and **Overview**. RUM traffic generators: `scripts/rum-smoke.sh`, `scripts/rum-loop.sh`.

## 7. Build and checks

```bash
npm run validate:migrations
npm run build --workspace=apps/server   # type check + bundle to apps/server/dist/bootstrap.js
npm start --workspace=apps/server       # run the production bundle (same env vars as dev)
docker build -f apps/server/Dockerfile -t apexmonitor-server .   # server image, from the repo root
npm run build --workspace=apps/web
npm run build:sdks
npm run conformance:sdks
```

To run the image against the local stack, pass configuration as environment variables (the image never contains a `.env`):

```bash
docker run --rm --network host --env-file .env apexmonitor-server
```

The image runs as the non-root `node` user, has a `HEALTHCHECK` on `/health`, and does not run database migrations.

Tests: `npm test`, `npm run test:integration` and `npm run test:e2e` (browser); see [testing-strategy.md](testing-strategy.md).

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `Invalid environment variables` listing every var | No `.env` at the repo root and nothing exported |
| `Invalid environment variables` | Check names (`MONGO_URI`, `PG_URI`) and 32-char secrets |
| CORS errors in browser | Add the web origin to `CORS_ORIGINS` |
| `relation "users" does not exist` | Migrations not applied (step 3) |
| Ingest returns 202 but no data | Check RabbitMQ UI for consumers on `*_queue`; server logs for worker errors |
