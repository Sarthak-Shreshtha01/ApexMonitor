import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { io as ioClient, Socket } from 'socket.io-client';
import { api, createIngestKey, createRumKey, getStack, logEntry, pgQuery, registerTenant, Tenant, waitFor } from './harness';

const CHROME = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

describe('RUM (real stack)', () => {
  let t: Tenant;
  let rumKey: string;

  beforeAll(async () => {
    t = await registerTenant('rum');
    rumKey = await createRumKey(t, ['https://shop.example']);
  });

  it('origin allow-list: disallowed origin → 403; allowed origin → 202', async () => {
    const event = { type: 'page_view', path: '/', timestamp: new Date().toISOString() };
    const denied = await api('POST', '/api/v1/rum', { rumKey, headers: { origin: 'https://evil.example' }, body: { events: [event] } });
    expect(denied.status).toBe(403);
    const ok = await api('POST', '/api/v1/rum', { rumKey, headers: { origin: 'https://shop.example' }, body: { events: [event] } });
    expect(ok.status).toBe(202);
  });

  it('rejects bad keys (401), non-JSON (415), invalid events (400)', async () => {
    expect((await api('POST', '/api/v1/rum', { rumKey: 'rum_nope', body: { events: [] } })).status).toBe(401);
    expect((await api('POST', '/api/v1/rum', { rumKey, headers: { 'content-type': 'text/plain', origin: 'https://shop.example' }, raw: 'x' })).status).toBe(415);
    expect((await api('POST', '/api/v1/rum', { rumKey, headers: { origin: 'https://shop.example' }, body: { events: [{ type: 'error' }] } })).status).toBe(400);
  });

  it('events flow to hourly_rum_metrics and every analytics endpoint', async () => {
    const now = new Date().toISOString();
    const headers = { origin: 'https://shop.example', 'user-agent': CHROME, 'cf-ipcountry': 'IN', 'x-region-code': 'KA', 'x-forwarded-for': '203.0.113.50' };
    const events = [
      { type: 'page_view', path: '/pricing?ref=ad', referrer: 'https://www.google.com/search', timestamp: now, sessionId: 's1', ttfbMs: 100, fcpMs: 400, lcpMs: 900 },
      { type: 'page_view', path: '/pricing', timestamp: now, sessionId: 's1', ttfbMs: 300 },
      { type: 'web_vital', path: '/pricing', timestamp: now, sessionId: 's2', lcpMs: 1500 },
    ];
    const res = await api('POST', '/api/v1/rum', { rumKey, headers, body: { sdkVersion: '0.1.0', events } });
    expect(res.status).toBe(202);
    expect(res.body.data.received).toBe(3);

    const rows = await waitFor(async () => {
      const r = await pgQuery('SELECT * FROM hourly_rum_metrics WHERE project_id = $1', [t.projectId]);
      return r.length >= 2 ? r : undefined;
    }, { label: 'rum aggregates' });
    const google = rows.find((r: any) => r.referrer_source === 'www.google.com');
    expect(google).toMatchObject({ path: '/pricing', device_type: 'desktop', browser_name: 'Chrome', country_code: 'IN', region_code: 'KA', page_views: 1 });

    const q = (p: string) => api('GET', `/api/v1/rum/${p}?projectId=${t.projectId}`, { token: t.accessToken });
    const overview = await q('overview');
    expect(overview.status).toBe(200);
    // 2 page views here + 1 from the origin allow-list test above (web_vital events don't count).
    expect(overview.body.data.data.page_views).toBe(3);
    for (const p of ['series', 'paths', 'devices', 'geo', 'referrers']) {
      const r = await q(p);
      expect(r.status, p).toBe(200);
      expect(Array.isArray(r.body.data.data), p).toBe(true);
    }
  });

  it('stale events are dropped and reported as received: 0', async () => {
    const res = await api('POST', '/api/v1/rum', { rumKey, headers: { origin: 'https://shop.example' }, body: { events: [{ path: '/', timestamp: '2001-01-01T00:00:00Z' }] } });
    expect(res.status).toBe(202);
    expect(res.body.data.received).toBe(0);
  });
});

describe('live traffic websocket (real stack)', () => {
  let t: Tenant;
  let other: Tenant;
  const sockets: Socket[] = [];

  beforeAll(async () => {
    t = await registerTenant('ws');
    other = await registerTenant('ws-other');
  });
  afterAll(() => sockets.forEach((s) => s.close()));

  async function join(token: string, projectId: string) {
    const { baseUrl } = await getStack();
    const socket = ioClient(baseUrl, { transports: ['websocket'], reconnection: false, forceNew: true });
    sockets.push(socket);
    const result = await new Promise<{ event: string; payload: any }>((resolve) => {
      socket.on('connect', () => socket.emit('join', { projectId, token }));
      socket.on('join:ok', (payload) => resolve({ event: 'join:ok', payload }));
      socket.on('join:error', (payload) => resolve({ event: 'join:error', payload }));
    });
    return { ...result, socket };
  }

  it('members join with an access token; refresh tokens and other tenants are refused', async () => {
    expect((await join(t.accessToken, t.projectId)).event).toBe('join:ok');
    expect((await join(t.refreshToken, t.projectId)).event).toBe('join:error');
    expect((await join(other.accessToken, t.projectId)).event).toBe('join:error');
  });

  it('pulse:live reflects ingested traffic within one tick', async () => {
    const { key } = await createIngestKey(t);
    const { socket } = await join(t.accessToken, t.projectId);
    await api('POST', '/api/v1/ingest', { apiKey: key, body: { logs: [logEntry(), logEntry({ statusCode: 500 }), logEntry()] } });
    const pulse: any = await new Promise((resolve) => socket.on('pulse:live', (p: any) => p.data.rps > 0 && resolve(p)));
    expect(pulse.projectId).toBe(t.projectId);
    expect(pulse.data.errorRate).toBeCloseTo(33.33, 1);
    expect(pulse.data.topEndpoints[0].endpoint).toBe('GET /api/items/:id');
  }, 15_000);
});

describe('platform endpoints (real stack)', () => {
  it('/health, /ready and /metrics/system report a healthy stack with consumers attached', async () => {
    expect((await api('GET', '/health')).status).toBe(200);
    const ready = await api('GET', '/ready');
    expect(ready.status).toBe(200);
    expect(ready.body.data.snapshot.services).toEqual({ mongo: 'ok', postgres: 'ok', redis: 'ok', rabbitmq: 'ok' });
    const metrics = await api('GET', '/metrics/system');
    const queues = metrics.body.data.queues as { queue: string; consumerCount: number }[];
    for (const q of queues.filter((x) => x.queue.endsWith('_queue'))) expect(q.consumerCount, q.queue).toBeGreaterThanOrEqual(1);
    // Dead-letter queues are reported (for backlog visibility) but nothing consumes them.
    expect(queues.filter((x) => x.queue.endsWith('_dlq')).map((x) => x.consumerCount)).toEqual([0, 0, 0, 0]);
  });
});
