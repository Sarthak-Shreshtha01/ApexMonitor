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
  projectId: 'proj_123',
  rumKey: 'rum_key_abc',
});

rum.start();
rum.trackPageView(window.location.pathname);
rum.trackCustom('signup_click', { plan: 'pro' });
```
