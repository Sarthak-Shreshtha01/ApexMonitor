import assert from 'node:assert/strict';
import { ApexClient } from '../packages/sdk/dist/index.js';
import { createBrowserRumClient } from '../packages/browser-sdk/dist/index.js';

function createJsonResponse(status, body, requestId = 'req-test') {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({
      'content-type': 'application/json',
      'x-request-id': requestId,
    }),
    async json() {
      return body;
    },
    async text() {
      return JSON.stringify(body);
    },
  };
}

async function runCoreSdkCheck() {
  const calls = [];
  let attempt = 0;

  const client = new ApexClient({
    baseUrl: 'https://api.example.com',
    auth: { type: 'bearer', token: 'token_123' },
    fetcher: async (url, init) => {
      calls.push({ url, init });
      attempt += 1;

      if (attempt === 1) {
        return createJsonResponse(500, { error: 'INTERNAL_ERROR', message: 'retry me' });
      }

      return createJsonResponse(200, {
        data: { summary: { ok: true } },
        meta: { requestId: 'req-test', timestamp: new Date().toISOString() },
      });
    },
  });

  const result = await client.metrics.overview({ projectId: 'proj_123', timeframe: '24h' });
  assert.deepEqual(result, { summary: { ok: true } });
  assert.equal(calls.length, 2);
  assert.equal(calls[0].init.headers.authorization, 'Bearer token_123');
  assert.equal(calls[0].init.headers['x-request-id'].length > 0, true);
  assert.equal(calls[0].init.method, 'GET');
}

async function runBrowserSdkCheck() {
  const calls = [];
  const rum = createBrowserRumClient({
    baseUrl: 'https://api.example.com',
    projectId: 'proj_123',
    rumKey: 'rum_key_abc',
    fetcher: async (url, init) => {
      calls.push({ url, init });
      return createJsonResponse(200, {
        data: { received: true },
        meta: { requestId: 'req-test', timestamp: new Date().toISOString() },
      });
    },
  });

  rum.trackPageView('/home', { plan: 'pro' });
  await rum.flush();

  assert.equal(calls.length, 1);
  assert.equal(calls[0].init.headers['x-rum-key'], 'rum_key_abc');

  const payload = JSON.parse(calls[0].init.body);
  assert.equal(payload.projectId, 'proj_123');
  assert.equal(Array.isArray(payload.events), true);
  assert.equal(payload.events.length, 1);
  assert.equal(payload.events[0].type, 'page_view');
}

async function main() {
  await runCoreSdkCheck();
  await runBrowserSdkCheck();
  console.log('SDK conformance checks passed.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
