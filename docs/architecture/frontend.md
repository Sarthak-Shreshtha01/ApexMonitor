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
│   └── providers/            AppProviders (Redux, RouteGate, QueryProvider)
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
└── proxy.ts                  optional server-side redirect to /login (Next 16 "proxy", formerly middleware)
```

Feature slices: `ai-insights`, `alerts` (rules list, rule builder and trigger history on `/alerts`, via `/api/v1/alerts`), `analytics`, `auth`, `billing`, `dashboard`, `keys`, `logs`, `marketing`, `metrics`, `overview`, `projects`, `settings`, `traces`, `traffic`.

## State

| Kind | Tool | Where |
|---|---|---|
| Server data | TanStack Query | `features/*/hooks`, `app/providers/QueryProvider.tsx` |
| Auth session | Redux Toolkit, **in memory only**: `{accessToken, status}`. The refresh token is the API's httpOnly `refresh_token` cookie | `features/auth/state/auth.slice.ts`, `lib/redux/store.ts` |
| UI/project selection | Zustand | `features/projects/state/project.store.ts`, `features/dashboard/state/dashboard.store.ts` |

Two client-state libraries are in use; consolidating on one is in plan Phase 1.

## API client

`shared/api/apiClient.ts` (axios):

1. Base URL from `NEXT_PUBLIC_API_URL`.
2. Request interceptor attaches `Authorization: Bearer <accessToken>`.
3. On 401 (non-auth endpoints) it calls `refreshAccessToken()`: `POST /api/v1/auth/refresh` with the cookie (`withCredentials`) and `X-Requested-With: XMLHttpRequest`, no token in the body. Concurrent 401s share one refresh and are replayed with the new token.
4. If the refresh fails, the auth state is cleared (`status: anonymous`) and the browser goes to `/login`.

Session on page load: nothing is stored in the browser, so `RouteGate` starts with `status: unknown` on dashboard pages and calls `refreshAccessToken()`; it renders the page once `authenticated` or redirects to `/login` when `anonymous`. Login, register and the OAuth callback keep only the access token. The `persist:persistroot` localStorage entry written by older versions is deleted at startup.

Endpoint paths are duplicated in `shared/api/endpoints.ts`. They'll move to `packages/contracts` (plan Phase 2).

## Realtime

Live views (`features/traffic/hooks/useLiveTraffic.ts`, the logs and traces explorers) use `shared/realtime/projectSocket.ts#connectProjectSocket`. It connects `socket.io-client` (websocket transport only) to `NEXT_PUBLIC_WS_URL`, emits `join {projectId, token}` with the in-memory access token on every (re)connect, and passes on `pulse:live` events for that project. The server refuses joins without a valid access token for a member of the project (`join:error`). An unauthorized join (expired token) is retried once after `refreshAccessToken()`. Live traffic shows LIVE only after `join:ok`.

## Auth gating

Two layers, both built on `shared/routes/session-gate.ts`:

1. **`proxy.ts` (server, opt-in).** With `WEB_SESSION_COOKIE_CHECK=true`, a request for a dashboard page without the `refresh_token` cookie is redirected to `/login?next=<page>` before anything renders. The dashboard can see the API's cookie only when both run on the same host, or the API sets `COOKIE_DOMAIN` to a parent domain of both (e.g. `.example.com`). On other layouts leave it off, because the dashboard would never see the cookie and everyone would be sent to /login.
2. **`shared/layout/RouteGate.tsx` (client, always on).** After a page load the session is `unknown`; the gate calls `refreshAccessToken()` (cookie), then renders the page or redirects to `/login?next=<page>`.

After signing in, the login page returns to `?next=` if `safeNextPath` accepts it: a same-origin dashboard path, never an absolute URL, `//host` or a public page. Access control itself is the API: every data call needs a valid access token.

## Environment

| Variable | Used by |
|---|---|
| `NEXT_PUBLIC_API_URL` | apiClient, auth service |
| `NEXT_PUBLIC_WS_URL` | Socket.IO clients |
| `WEB_SESSION_COOKIE_CHECK` | `proxy.ts` (runtime, server only) |

See [../reference/configuration.md](../reference/configuration.md).
