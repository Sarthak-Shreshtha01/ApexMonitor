# SDKs

| Package | Path | Registry | Version | Status |
|---|---|---|---|---|
| `@apexmonitor/sdk` | `packages/sdk` | npm | 0.1.0 | Works for ingest + read APIs; `metrics.rps`/`metrics.endpoints` hit missing routes (KI-12) |
| `@apexmonitor/browser-sdk` | `packages/browser-sdk` | npm | 0.1.0 | **Payload doesn't match server RUM schema** (KI-10) |
| `apexmonitor-sdk` | `packages/python-sdk` | PyPI | 0.1.0 | RUM key sent in wrong header (KI-11) |

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

`key`/`token` may be a string or a (async) function. Transport (`http.ts`) provides retries with backoff, timeouts, `AbortSignal`, idempotency and request-id headers, and unwraps the `{data, meta}` envelope. Errors: `ApexApiError` (HTTP error with `error`, `message`, `requestId`), `ApexNetworkError`.

Domains on `ApexClient`: `auth`, `projects`, `ingest`, `rum`, `metrics`, `logs`, `traces`, `insights`, `keys`, `billing`, and raw `request`.

## Browser: `@apexmonitor/browser-sdk`

```ts
import { createBrowserRumClient } from '@apexmonitor/browser-sdk';

const rum = createBrowserRumClient({
  baseUrl: 'https://api.example.com',
  projectId: 'proj_…',
  rumKey: 'rum_…',
  flushIntervalMs: 5000,   // default
  maxQueueSize: 50,
});

rum.start();                                   // timer + beforeunload flush
rum.trackPageView(location.pathname);
rum.trackWebVitals({ lcpMs: 1200, fcpMs: 800, ttfbMs: 120 });
rum.trackError(new Error('boom'));
rum.trackCustom('cta_click', { id: 'upgrade' });
await rum.flush();
rum.stop();
```

> Until KI-10 is fixed, the server rejects these batches with 400. The server accepts `type` ∈ `page_view | web_vital | heartbeat` with a top-level `path` (see [api.md](api.md#rum-apiv1rum)).

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

Methods: `login`, `refresh`, `me`, `list_projects`, `create_project`, `ingest`, `rum_ingest`, `metrics_overview`, `logs`, `traces`, `trace_detail`, `insights`, `keys`, `create_key`, `revoke_key`, `checkout`, `request`.

For RUM from Python, pass `headerName: "x-rum-key"` explicitly until KI-11 is fixed.

## Compatibility rules

- The wire contract is defined by server DTOs (`apps/server/src/modules/*/dto`). SDKs must not send fields the server rejects.
- Any contract change updates all three SDKs + `scripts/sdk-conformance.mjs` + [api.md](api.md) in one PR.
- Release process: [../guides/sdk-publishing.md](../guides/sdk-publishing.md).

## Roadmap

- Framework middleware: Express/Fastify/Nest/Next (Node), Flask/FastAPI/Django (Python).
- Automatic web-vitals collection (`PerformanceObserver`), SPA route tracking, error capture.
- OTLP export so SDKs and the OpenTelemetry Collector are interchangeable (ADR-0005).
