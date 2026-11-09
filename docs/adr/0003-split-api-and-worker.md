# 0003. Split API and worker into separate deployables

- **Status:** Proposed
- **Date:** 2026-11-10

## Context

`apps/server/src/bootstrap.ts` runs the HTTP API, Socket.IO, four RabbitMQ consumers, and the alert `setInterval` loop in one process. Consequences today:

- Ingest/query traffic and background processing compete for one event loop.
- Running 2+ replicas duplicates alert evaluation and notifications (KI-20).
- The in-process `EventEmitter` only works because producers and consumers share memory.
- A worker crash takes down the API, and vice versa.

## Decision

- Create `apps/api` (HTTP + realtime) and `apps/worker` (queue consumers + scheduled jobs), each with its own composition root, Dockerfile, health endpoints, and graceful shutdown.
- Shared domain code moves to `packages/core`; infrastructure clients to `packages/platform`; contracts to `packages/contracts`.
- Cross-process events go through RabbitMQ (`events` topic exchange). The API subscribes and forwards to Socket.IO; `@socket.io/redis-adapter` syncs rooms across API replicas.
- Scheduled work (alerts, rollups, retention) uses pg-boss with singleton jobs, so exactly one replica runs each tick.
- `apps/ingest` may be split from `apps/api` later, when ingest traffic justifies it; the code boundary is drawn now.

## Alternatives considered

| Option | Pros | Cons |
|---|---|---|
| Keep one process, add a `ROLE=api\|worker` env switch | Minimal change | Still one dependency graph and image; easy to couple accidentally |
| Microservice per worker | Max isolation | Too many deployables for the team size |
| BullMQ for jobs | Popular, Redis-based | Adds reliance on Redis durability; pg-boss reuses Postgres we already back up |

## Consequences

- API and workers scale independently (HPA on CPU vs queue depth).
- Two images and two deployments to operate.
- Requires DI/composition roots first (plan Phase 2), which also unblocks unit testing.
