# SDKs

| Package | Path | Registry | Version | Status |
|---|---|---|---|---|
| `@apexmonitor/sdk` | `packages/sdk` | npm | 0.1.0 | Ingest, read APIs, alert rules; every path is checked against the server in tests |
| `@apexmonitor/browser-sdk` | `packages/browser-sdk` | npm | 0.1.0 | Sends the server's RUM schema; `trackError`/`trackCustom` removed (no server storage yet) |
| `apexmonitor-sdk` | `packages/python-sdk` | PyPI | 0.1.0 | Ingest, read APIs, key management |

All three are thin API clients. None auto-instruments a framework yet: callers build log entries themselves.

## TypeScript: `@apexmonitor/sdk`

```ts
import { createApexClient } from '@apexmonitor/sdk';

const apex = createApexClient({
  baseUrl: 'http://localhost:3000',
  auth: { type: 'apiKey', key: process.env.APEX_INGEST_KEY! }, // header x-api-key
});

await apex.ingest.batch(
  {
    projectId: 'proj_…',
    sdkVersion: '0.1.0',
    logs: [{
      method: 'GET', endpoint: '/users/42', statusCode: 200, latencyMs: 35,
      timestamp: new Date().toISOString(),
    }],
  },
  // optional: ingest.batch and rum.ingest generate a fresh key per call when you don't pass one
  { idempotencyKey: crypto.randomUUID() },
);
```

Auth strategies (`packages/sdk/src/types.ts`):

```ts
{ type: 'bearer', token }               // dashboard JWT
{ type: 'apiKey', key, headerName? }    // x-api-key
{ type: 'rumKey', key, headerName? }    // x-rum-key
{ type: 'custom', getHeaders }
```

`key`/`token` may be a string or a (async) function. Transport (`http.ts`) provides retries with backoff, timeouts, `AbortSignal`, `x-idempotency-key` and `x-request-id` headers, and unwraps the `{data, meta}` envelope. Errors: `ApexApiError` (HTTP error with `error`, `message`, `requestId`, `isRetryable`), `ApexNetworkError` (network failure or timeout).

Domains on `ApexClient`: `auth`, `projects`, `ingest`, `rum`, `metrics` (`overview`, `latency`, `operations`), `alerts` (`listRules`, `createRule`, `updateRule`, `deleteRule`, `events`), `logs`, `traces`, `insights`, `keys`, `billing`, and raw `request`.

### Retries (both SDKs)

Retries use exponential backoff (`maxRetries` default 2) and are designed never to create anything twice:

| Request | Retried on |
|---|---|
| GET, PUT, DELETE, HEAD, OPTIONS | 408, 425, 429, 500, 502, 503, 504, network errors, timeouts |
| POST/PATCH **with** an idempotency key | the same |
| POST/PATCH **without** a key | only 429 and 503 (the server rejected the request without acting on it) |

- `409 Conflict` and other 4xx are never retried.
- A request cancelled through the caller's `AbortSignal` is never retried.
- `ingest.batch` / `rum.ingest` (TS) and `ingest` / `rum_ingest` (Python) generate an idempotency key per call when none is given, so their retries are always safe; the server stores a batch once per key for 5 minutes.

## Browser: `@apexmonitor/browser-sdk`

```ts
import { createBrowserRumClient } from '@apexmonitor/browser-sdk';

const rum = createBrowserRumClient({
  baseUrl: 'https://api.example.com',
  rumKey: 'rum_…',            // the key decides the project
  flushIntervalMs: 5000,      // default
  maxQueueSize: 50,           // default; a flush sends at most 200 events per request
  defaultContext: { app: 'shop' },  // added to every event's metadata (strings, numbers, booleans only)
});

rum.start();                                         // timer + beforeunload flush
rum.trackPageView(location.pathname, { plan: 'pro' }); // referrer defaults to document.referrer
rum.trackWebVitals({ lcpMs: 1200, fcpMs: 800, ttfbMs: 120 }); // path defaults to location.pathname
rum.trackHeartbeat();                                // session still active
await rum.flush();
rum.stop();
```

Events match the server's RUM schema (`type` ∈ `page_view | web_vital | heartbeat`, top-level `path`, `ttfbMs/fcpMs/lcpMs`; see [api.md](api.md#rum-apiv1rum)). Invalid vitals (negative, non-finite, over 600 s) are dropped client-side. Every event carries a per-client `sessionId` (override with the `sessionId` option). Errors and custom events are not supported until the server can store them; `trackError` and `trackCustom` were removed in this version, and `projectId` is ignored.

## Python: `apexmonitor-sdk`

```python
from apexmonitor_sdk import ApexClient

client = ApexClient(
    base_url="http://localhost:3000",
    auth={"type": "apiKey", "key": "proj_…"},
    timeout_s=15.0,
    max_retries=2,
)

client.ingest({
    "projectId": "proj_…",
    "logs": [{
        "method": "POST", "endpoint": "/orders", "statusCode": 201,
        "latencyMs": 120, "timestamp": "2026-11-10T12:00:00Z",
    }],
}, idempotency_key="batch-0001")
```

Methods: `login`, `refresh`, `me`, `list_projects`, `create_project`, `ingest`, `rum_ingest`, `metrics_overview`, `logs`, `traces`, `trace_detail`, `insights`, `keys`, `create_key`, `revoke_key(key_id, project_id)`, `checkout`, `request`.

Auth `{"type": "rumKey", "key": …}` sends `x-rum-key`; `{"type": "apiKey", …}` sends `x-api-key` (override either with `headerName`).

## Compatibility rules

- The wire contract is defined by server DTOs (`apps/server/src/modules/*/dto`). SDKs must not send fields the server rejects.
- Any contract change updates all three SDKs + `scripts/sdk-conformance.mjs` + [api.md](api.md) in one PR.
- Release process: [../guides/sdk-publishing.md](../guides/sdk-publishing.md).

## Roadmap

- Framework middleware: Express/Fastify/Nest/Next (Node), Flask/FastAPI/Django (Python).
- Automatic web-vitals collection (`PerformanceObserver`), SPA route tracking, error capture.
- OTLP export so SDKs and the OpenTelemetry Collector are interchangeable (ADR-0005).
