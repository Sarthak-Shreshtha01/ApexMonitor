# @apexmonitor/browser-sdk

Browser RUM SDK for ApexMonitor.

## Install

```bash
npm install @apexmonitor/browser-sdk
```

## Quick Start

```ts
import { createBrowserRumClient } from '@apexmonitor/browser-sdk';

const rum = createBrowserRumClient({
  baseUrl: 'https://api.example.com',
  rumKey: 'rum_key_abc',
});

rum.start();
rum.trackPageView(window.location.pathname);
rum.trackWebVitals({ lcpMs: 1200, fcpMs: 800, ttfbMs: 120 });
```

Supported events are page views, Core Web Vitals (TTFB, FCP, LCP) and heartbeats. Error and custom events are not supported yet; `trackError` and `trackCustom` were removed because the server rejected them.
