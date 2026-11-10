# Frontend Architecture (`apps/web`)

Next.js **16** App Router, React 19, Tailwind 4. Read `apps/web/AGENTS.md` before changing Next.js APIs: this version has breaking changes relative to older Next.js docs.

## Route groups

| Group | Routes | Notes |
|---|---|---|
| `app/page.tsx` | `/` | Marketing landing (Hero, Features, AI insights, Pricing) |
| `(marketing)` | `/about` | |
| `(auth)` | `/login`, `/register`, `/oauth/callback` | |
| `(dashboard)` | `/overview`, `/live-traffic`, `/logs`, `/traces`, `/traces/[id]`, `/analytics`, `/ai-insights`, `/keys`, `/alerts`, `/settings`, `/billing` | Wrapped by `AppShell` |

`shared/routes/routes.ts` also reserves `/verify-email`, `/forgot-password`, `/reset-password`, `/terms`, `/privacy`. These have **no pages yet**.

## Directory layout

```
apps/web/
├── app/                      routes, layouts, providers
│   └── providers/            AppProviders (Redux, PersistGate, RouteGate, QueryProvider)
├── features/<domain>/        feature slices
│   ├── api/                  *.service.ts: calls apiClient
│   ├── hooks/                TanStack Query hooks
│   ├── state/                Redux slices / Zustand stores
│   └── ui/                   components
├── shared/
│   ├── api/                  apiClient.ts (axios + interceptors), endpoints.ts
│   ├── layout/               AppShell, PublicNavbar, Footer, RouteGate
│   ├── routes/routes.ts      route constants + PUBLIC_PATHS
│   └── ui/                   shared widgets (GeoIP Leaflet map)
├── lib/redux/                store, typed hooks, persist storage
└── middleware.ts             currently a no-op (KI-30)
```

Feature slices: `ai-insights`, `alerts` (rules list, rule builder and trigger history on `/alerts`, via `/api/v1/alerts`), `analytics`, `auth`, `billing`, `dashboard`, `keys`, `logs`, `marketing`, `metrics`, `overview`, `projects`, `settings`, `traces`, `traffic`.

## State

| Kind | Tool | Where |
|---|---|---|
| Server data | TanStack Query | `features/*/hooks`, `app/providers/QueryProvider.tsx` |
| Auth session | Redux Toolkit + redux-persist (localStorage) | `features/auth/state/auth.slice.ts`, `lib/redux/*` |
| UI/project selection | Zustand | `features/projects/state/project.store.ts`, `features/dashboard/state/dashboard.store.ts` |

Two client-state libraries are in use; consolidating on one is in plan Phase 1.

## API client

`shared/api/apiClient.ts` (axios):

1. Base URL from `NEXT_PUBLIC_API_URL`.
2. Request interceptor attaches `Authorization: Bearer <accessToken>`.
3. On 401 (non-auth endpoints) it starts a single refresh (`POST /api/v1/auth/refresh`), queues concurrent requests, and replays them with the new token. If the refresh fails, every queued request is rejected; stored tokens are **not** cleared and there is no redirect (KI-40).

Endpoint paths are duplicated in `shared/api/endpoints.ts`. They'll move to `packages/contracts` (plan Phase 2).

## Realtime

`features/traffic/hooks/useLiveTraffic.ts` (and logs/traces explorers) connect `socket.io-client` to `NEXT_PUBLIC_WS_URL`, emit `join {projectId, token}`, and subscribe to `pulse:live`.

## Auth gating

`shared/layout/RouteGate.tsx` redirects client-side based on Redux auth state. `middleware.ts` doesn't enforce anything server-side.

## Environment

| Variable | Used by |
|---|---|
| `NEXT_PUBLIC_API_URL` | apiClient, auth service |
| `NEXT_PUBLIC_WS_URL` | Socket.IO clients |

See [../reference/configuration.md](../reference/configuration.md).
