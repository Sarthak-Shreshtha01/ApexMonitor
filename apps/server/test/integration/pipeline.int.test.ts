import crypto from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { api, createIngestKey, logEntry, mongoCount, pgQuery, redisClient, registerTenant, Tenant, waitFor } from './harness';

// Unique path segments start with a letter so they are never mistaken for ids.
const uniq = () => `x${crypto.randomUUID().replace(/-/g, '').slice(0, 10)}`;

describe('ingest → workers → query APIs (real stack)', () => {
  let t: Tenant;
  let key: string;
  const now = new Date();
  const hourStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), now.getUTCHours()));
  const inHour = (minute: number) => new Date(hourStart.getTime() + minute * 60_000).toISOString();

  beforeAll(async () => {
    t = await registerTenant('pipeline');
    key = (await createIngestKey(t)).key;
    const logs = [
      logEntry({ endpoint: '/orders/1001', method: 'GET', statusCode: 200, latencyMs: 100, timestamp: inHour(1), ip: '198.51.100.23' }),
      logEntry({ endpoint: '/orders/1002', method: 'GET', statusCode: 200, latencyMs: 300, timestamp: inHour(2) }),
      logEntry({ endpoint: '/orders/1003', method: 'GET', statusCode: 500, latencyMs: 2500, timestamp: inHour(3) }),
      logEntry({ endpoint: '/orders', method: 'POST', statusCode: 201, latencyMs: 700, timestamp: inHour(4) }),
      logEntry({ endpoint: '/users/9f8e7d6c-1a2b-4c3d-8e9f-0123456789ab', method: 'DELETE', statusCode: 404, latencyMs: 40, timestamp: inHour(5) }),
    ];
    const res = await api('POST', '/api/v1/ingest', { apiKey: key, body: { sdkVersion: '1.2.3', logs } });
    expect(res.status).toBe(202);
    await waitFor(async () => (await mongoCount('api_logs', { projectId: t.projectId })) === 5, { label: '5 raw logs' });
    await waitFor(async () => (await pgQuery('SELECT 1 FROM hourly_metrics WHERE project_id = $1', [t.projectId])).length === 3, { label: '3 aggregate rows' });
  });

  it('raw logs are normalised, IP-hashed and tagged with the SDK version', async () => {
    const mongoose = (await import('mongoose')).default;
    const docs = await mongoose.connection.db!.collection('api_logs').find({ projectId: t.projectId }).toArray();
    expect(new Set(docs.map((d) => d.endpoint))).toEqual(new Set(['/orders/:id', '/orders', '/users/:id']));
    expect(docs.every((d) => d.sdkVersion === '1.2.3' && /^[0-9a-f]{64}$/.test(d.ip))).toBe(true);
    expect(JSON.stringify(docs)).not.toContain('198.51.100.23');
  });

  it('hourly_metrics holds counts, errors and Apdex buckets per endpoint+method', async () => {
    const rows = await pgQuery('SELECT endpoint, method, request_count, error_count, satisfied_count, tolerating_count, frustrated_count, hour_bucket FROM hourly_metrics WHERE project_id = $1 ORDER BY endpoint, method', [t.projectId]);
    const get = rows.find((r: any) => r.endpoint === '/orders/:id' && r.method === 'GET');
    // Apdex T=500ms: 100ms and 300ms satisfied, the 2500ms/500 error frustrated.
    expect(get).toMatchObject({ request_count: 3, error_count: 1, satisfied_count: 2, tolerating_count: 0, frustrated_count: 1 });
  });

  it('hour buckets are UTC hours even when the server runs in Asia/Kolkata (KI-9)', async () => {
    const [row] = await pgQuery('SELECT hour_bucket FROM hourly_metrics WHERE project_id = $1 LIMIT 1', [t.projectId]);
    expect(new Date(row.hour_bucket).toISOString()).toBe(hourStart.toISOString());
  });

  it('GET /metrics/overview summarises the project', async () => {
    const res = await api('GET', `/api/v1/metrics/overview?projectId=${t.projectId}&timeframe=24h`, { token: t.accessToken });
    expect(res.status).toBe(200);
    expect(res.body.data.summary).toMatchObject({ totalRequests: 5, errorRate: 40 });
    expect(res.body.data.topEndpoints.length).toBeGreaterThan(0);
  });

  it('GET /metrics/latency and /metrics/operations respond for members', async () => {
    expect((await api('GET', `/api/v1/metrics/latency?projectId=${t.projectId}`, { token: t.accessToken })).status).toBe(200);
    const ops = await api('GET', `/api/v1/metrics/operations?projectId=${t.projectId}`, { token: t.accessToken });
    expect(ops.status).toBe(200);
    expect(ops.body.data.totals.requests).toBe(5);
  });

  it('GET /logs filters by status class, method, endpoint and search, and paginates', async () => {
    const q = (s: string) => api('GET', `/api/v1/logs?projectId=${t.projectId}${s}`, { token: t.accessToken });
    expect((await q('')).body.data).toMatchObject({ total: 5, summary: { total: 5, errorRate: 40 } });
    expect((await q('&statusClass=5xx')).body.data.total).toBe(1);
    expect((await q('&statusClass=4xx')).body.data.logs[0].endpoint).toBe('/users/:id');
    expect((await q('&method=POST')).body.data.total).toBe(1);
    expect((await q('&endpoint=orders')).body.data.total).toBe(4);
    expect((await q('&search=users')).body.data.total).toBe(1);
    expect((await q('&search=.*')).body.data.total).toBe(0); // regex metacharacters are escaped
    const page2 = await q('&limit=2&page=3');
    expect(page2.body.data).toMatchObject({ page: 3, limit: 2, total: 5 });
    expect(page2.body.data.logs).toHaveLength(1);
    expect((await q(`&from=${inHour(3)}&to=${inHour(4)}`)).body.data.total).toBe(2);
  });

  it('GET /traces lists requests and /traces/:id returns spans; unknown id → 404', async () => {
    const list = await api('GET', `/api/v1/traces?projectId=${t.projectId}&statusClass=5xx`, { token: t.accessToken });
    expect(list.body.data.total).toBe(1);
    const traceId = list.body.data.traces[0].traceId;
    const detail = await api('GET', `/api/v1/traces/${traceId}?projectId=${t.projectId}`, { token: t.accessToken });
    expect(detail.status).toBe(200);
    expect(detail.body.data.trace).toMatchObject({ traceId, statusCode: 500, latencyMs: 2500 });
    expect(detail.body.data.trace.spans).toHaveLength(4);
    expect((await api('GET', `/api/v1/traces/${crypto.randomUUID()}?projectId=${t.projectId}`, { token: t.accessToken })).status).toBe(404);
  });

  it('a trace from another project is not retrievable even with its id', async () => {
    const other = await registerTenant('pipeline-other');
    const list = await api('GET', `/api/v1/traces?projectId=${t.projectId}`, { token: t.accessToken });
    const traceId = list.body.data.traces[0].traceId;
    expect((await api('GET', `/api/v1/traces/${traceId}?projectId=${other.projectId}`, { token: other.accessToken })).status).toBe(404);
  });

  it('idempotency: replaying a batch with the same x-idempotency-key stores it once', async () => {
    const headers = { 'x-idempotency-key': `idem-${crypto.randomUUID()}` };
    const body = { logs: [logEntry({ endpoint: '/idempotent' })] };
    const first = await api('POST', '/api/v1/ingest', { apiKey: key, body, headers });
    const second = await api('POST', '/api/v1/ingest', { apiKey: key, body, headers });
    expect(second.body.data.batchId).toBe(first.body.data.batchId);
    await waitFor(async () => (await mongoCount('api_logs', { projectId: t.projectId, endpoint: '/idempotent' })) === 1, { label: 'one idempotent log' });
    await new Promise((r) => setTimeout(r, 500));
    expect(await mongoCount('api_logs', { projectId: t.projectId, endpoint: '/idempotent' })).toBe(1);
  });

  it('live counters are written for the websocket pulse', async () => {
    await api('POST', '/api/v1/ingest', { apiKey: key, body: { logs: [logEntry(), logEntry({ statusCode: 503 })] } });
    const redis = await redisClient();
    expect(Number(await redis.get(`live:${t.projectId}:requests`))).toBeGreaterThanOrEqual(2);
    expect(Number(await redis.get(`live:${t.projectId}:errors`))).toBeGreaterThanOrEqual(1);
  });

  it('ingest validation and key errors', async () => {
    expect((await api('POST', '/api/v1/ingest', { body: { logs: [logEntry()] } })).status).toBe(401);
    expect((await api('POST', '/api/v1/ingest', { apiKey: 'pk_live_doesnotexist', body: { logs: [logEntry()] } })).status).toBe(401);
    expect((await api('POST', '/api/v1/ingest', { apiKey: key, body: { logs: [] } })).status).toBe(400);
    expect((await api('POST', '/api/v1/ingest', { apiKey: key, body: { logs: [logEntry({ timestamp: 'yesterday' })] } })).status).toBe(400);
  });

  it('anomaly worker: a latency spike after a stable baseline creates an insight', async () => {
    const endpoint = `/spiky/${uniq()}`;
    for (const latencyMs of [20, 22, 21, 23, 20, 22]) {
      await api('POST', '/api/v1/ingest', { apiKey: key, body: { logs: [logEntry({ endpoint, latencyMs })] } });
      await new Promise((r) => setTimeout(r, 120));
    }
    await api('POST', '/api/v1/ingest', { apiKey: key, body: { logs: [logEntry({ endpoint, latencyMs: 9000 })] } });
    const insight = await waitFor(async () => {
      const res = await api('GET', `/api/v1/insights?projectId=${t.projectId}&limit=50`, { token: t.accessToken });
      return res.body.data.insights.find((i: any) => i.endpoint === endpoint);
    }, { label: 'latency_spike insight' });
    expect(insight).toMatchObject({ type: 'latency_spike', severity: 'warning', projectId: t.projectId });
  });

  it('merging batches into the same hour keeps a request-weighted average latency (KI-8)', async () => {
    const endpoint = `/weighted/${uniq()}`;
    // Batch 1: 3 requests at 100ms. Batch 2: 1 request at 500ms. True mean = 200ms.
    await api('POST', '/api/v1/ingest', { apiKey: key, body: { logs: [100, 100, 100].map((l) => logEntry({ endpoint, latencyMs: l, timestamp: inHour(10) })) } });
    await waitFor(async () => (await pgQuery('SELECT 1 FROM hourly_metrics WHERE project_id=$1 AND endpoint=$2', [t.projectId, endpoint])).length === 1);
    await api('POST', '/api/v1/ingest', { apiKey: key, body: { logs: [logEntry({ endpoint, latencyMs: 500, timestamp: inHour(11) })] } });
    const row = await waitFor(async () => {
      const [r] = await pgQuery('SELECT request_count, avg_ms FROM hourly_metrics WHERE project_id=$1 AND endpoint=$2', [t.projectId, endpoint]);
      return r?.request_count === 4 ? r : undefined;
    });
    expect(row.avg_ms).toBe(200);
  });

  it('merged p50 reflects all requests in the hour, not only the first batch (KI-8)', async () => {
    const endpoint = `/p50/${uniq()}`;
    await api('POST', '/api/v1/ingest', { apiKey: key, body: { logs: [logEntry({ endpoint, latencyMs: 10, timestamp: inHour(20) })] } });
    await waitFor(async () => (await pgQuery('SELECT 1 FROM hourly_metrics WHERE project_id=$1 AND endpoint=$2', [t.projectId, endpoint])).length === 1);
    await api('POST', '/api/v1/ingest', { apiKey: key, body: { logs: [1000, 1000, 1000].map((l) => logEntry({ endpoint, latencyMs: l, timestamp: inHour(21) })) } });
    const row = await waitFor(async () => {
      const [r] = await pgQuery('SELECT request_count, p50_ms FROM hourly_metrics WHERE project_id=$1 AND endpoint=$2', [t.projectId, endpoint]);
      return r?.request_count === 4 ? r : undefined;
    });
    expect(row.p50_ms).toBe(1000);
  });

  it('merged percentiles stay within 6% of the exact values over many batches (KI-8)', async () => {
    const { computePercentile } = await import('@shared/utils/math.utils');
    const endpoint = `/accuracy/${uniq()}`;
    // Deterministic, skewed latencies: mostly fast with a long tail.
    let seed = 42;
    const rand = () => ((seed = (seed * 1_103_515_245 + 12_345) % 2 ** 31) / 2 ** 31);
    const all: number[] = [];
    for (let batch = 0; batch < 4; batch++) {
      const latencies = Array.from({ length: 60 }, () => Math.round(20 + 2000 * rand() ** 4));
      all.push(...latencies);
      const res = await api('POST', '/api/v1/ingest', {
        apiKey: key,
        body: { logs: latencies.map((latencyMs, i) => logEntry({ endpoint, latencyMs, timestamp: inHour(30 + (i % 20)) })) },
      });
      expect(res.status).toBe(202);
    }
    const row = await waitFor(async () => {
      const [r] = await pgQuery('SELECT request_count, avg_ms, p50_ms, p95_ms, p99_ms, latency_min_ms, latency_max_ms FROM hourly_metrics WHERE project_id=$1 AND endpoint=$2', [t.projectId, endpoint]);
      return r?.request_count === all.length ? r : undefined;
    }, { label: '240 merged requests' });
    const sorted = [...all].sort((a, b) => a - b);
    const exact = (p: number) => computePercentile(sorted, p);
    expect(row.avg_ms).toBeCloseTo(all.reduce((a, b) => a + b, 0) / all.length, 6);
    expect(row.latency_min_ms).toBe(sorted[0]);
    expect(row.latency_max_ms).toBe(sorted.at(-1));
    for (const [col, p] of [['p50_ms', 50], ['p95_ms', 95], ['p99_ms', 99]] as const) {
      expect(Math.abs(row[col] - exact(p)) / exact(p), `${col}: ${row[col]} vs exact ${exact(p)}`).toBeLessThan(0.06);
    }
  });

  it('dashboard numbers merge across endpoints instead of averaging averages (KI-8)', async () => {
    const tenant = await registerTenant('merge-readers');
    const ownKey = (await createIngestKey(tenant)).key;
    // 9 fast requests on one endpoint, 1 slow on another: true mean 190 ms (an average of
    // the two endpoint averages would say 550), p50 100 ms, p99 1000 ms.
    const logs = [
      ...Array.from({ length: 9 }, (_, i) => logEntry({ endpoint: '/fast', latencyMs: 100, timestamp: inHour(i) })),
      logEntry({ endpoint: '/slow', latencyMs: 1000, timestamp: inHour(9) }),
    ];
    expect((await api('POST', '/api/v1/ingest', { apiKey: ownKey, body: { logs } })).status).toBe(202);
    await waitFor(async () => (await pgQuery('SELECT 1 FROM hourly_metrics WHERE project_id=$1', [tenant.projectId])).length === 2, { label: 'two rows' });

    const overview = await api('GET', `/api/v1/metrics/overview?projectId=${tenant.projectId}&timeframe=24h`, { token: tenant.accessToken });
    expect(overview.body.data.summary).toMatchObject({ totalRequests: 10, avgLatency: 190, p99Latency: 1000 });
    const latency = await api('GET', `/api/v1/metrics/latency?projectId=${tenant.projectId}`, { token: tenant.accessToken });
    expect(latency.status).toBe(200);
  });
});
