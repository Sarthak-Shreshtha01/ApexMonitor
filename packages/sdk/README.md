# @apexmonitor/sdk

Official TypeScript SDK for ApexMonitor.

## Install

```bash
npm install @apexmonitor/sdk
```

## Quick Start

```ts
import { ApexClient } from '@apexmonitor/sdk';

const client = new ApexClient({
  baseUrl: 'https://api.example.com',
  auth: { type: 'bearer', token: process.env.APEX_TOKEN! },
});

const overview = await client.metrics.overview({ projectId: 'proj_123' });
console.log(overview);
```

## Auth Modes

- bearer
- apiKey
- rumKey
- custom headers

## Error Handling

```ts
import { ApexApiError } from '@apexmonitor/sdk';

try {
  await client.logs.list({ projectId: 'proj_123' });
} catch (error) {
  if (error instanceof ApexApiError) {
    console.error(error.code, error.requestId);
  }
}
```
