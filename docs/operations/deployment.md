# Deployment

Two images, both built from the repository root:

| Image | Dockerfile | Runs | Port |
|---|---|---|---|
| `apexmonitor-server` | `apps/server/Dockerfile` | API + workers + Socket.IO (`node dist/bootstrap.js`); migrations (`node dist/migrate.js`) | 3000 |
| `apexmonitor-web` | `apps/web/Dockerfile` | Next.js standalone server (`node apps/web/server.js`) | 3001 |

Both run as the non-root `node` user, have a Docker `HEALTHCHECK`, and contain no `.env` file.

## Single host: Docker Compose

`infra/compose/docker-compose.prod.yml` runs Postgres, MongoDB, Redis, RabbitMQ, a one-shot `migrate` job, the API and the dashboard.

```bash
cp infra/compose/.env.example infra/compose/.env      # fill in every value; secrets: openssl rand -hex 32
docker compose -f infra/compose/docker-compose.prod.yml --env-file infra/compose/.env up -d --build --wait
```

- Only the API (`API_PORT`, default 3000) and the dashboard (`WEB_PORT`, 3001) are published. Databases and the broker are reachable only inside the compose network.
- Startup order: `postgres` healthy → `migrate` applies pending migrations and exits → `api` starts once Mongo, Redis and RabbitMQ are healthy → `web` starts once the API is healthy.
- Redis runs with `noeviction` and AOF persistence: rate-limit, idempotency and revocation entries must never be silently evicted.
- `docker compose stop api` (or a redeploy) sends SIGTERM; `stop_grace_period: 30s` gives the API's graceful shutdown (25 s) time to drain requests and queue consumers.
- Use URL-safe passwords (hex): they are embedded in connection URLs.

### TLS and URLs

Put a reverse proxy (Caddy, nginx, a cloud load balancer) in front of both ports and terminate TLS there. Set:

- `API_BASE_URL` to the API's public URL. It is also baked into the dashboard image as `NEXT_PUBLIC_API_URL`/`NEXT_PUBLIC_WS_URL` at build time, so rebuild `web` after changing it.
- `FRONTEND_URL` and `CORS_ORIGINS` to the dashboard's public URL.
- The proxy must pass WebSocket upgrades for `/socket.io/` to the API.

The refresh cookie is `Secure` in production, so browsers only send it over HTTPS (or `http://localhost`). If the dashboard and API are on different sites (not just subdomains), set `COOKIE_SAMESITE=none`.

### Optional settings

OAuth (`GOOGLE_*`, `GITHUB_*`), billing (`PHONEPE_*`) and other optional variables from [configuration.md](../reference/configuration.md) are not in the compose file, because empty values would fail validation. Add the ones you use in a `docker-compose.override.yml` next to it:

```yaml
services:
  api:
    environment:
      PHONEPE_ENV: production
      PHONEPE_MERCHANT_ID: ${PHONEPE_MERCHANT_ID}
      PHONEPE_SALT_KEY: ${PHONEPE_SALT_KEY}
```

and pass both files: `-f infra/compose/docker-compose.prod.yml -f infra/compose/docker-compose.override.yml`.

## Upgrades

1. Build or pull the new images.
2. Run migrations first: `docker compose … run --rm migrate` (compose also runs it on `up`). With `NODE_ENV=production` the API refuses to start while migrations are pending.
3. Restart `api`, then `web`.

## Not covered yet

- More than one API replica (in-process event bus, Socket.IO without a Redis adapter, scheduled jobs on every replica): KI-20.
- Backups: see the "Restoring from backup" runbook.
