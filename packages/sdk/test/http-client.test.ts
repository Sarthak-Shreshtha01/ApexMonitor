import { describe, expect, it, vi } from 'vitest';
import { ApexApiError, ApexClient, ApexNetworkError, createApexClient } from '../src/index';
import { HttpClient } from '../src/http';

type Call = { url: string; init: RequestInit };

function fetcher(...responses: Array<Response | Error | ((c: Call) => Response | Promise<Response>)>) {
  const calls: Call[] = [];
  const fn = vi.fn(async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const next = responses.length > 1 ? responses.shift()! : responses[0];
    if (next instanceof Error) throw next;
    return typeof next === 'function' ? next({ url, init }) : next.clone();
  });
  return { fn: fn as unknown as typeof fetch, calls };
}

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });
const envelope = (data: unknown) => json({ data, meta: { requestId: 'r', timestamp: 't' } });
const headersOf = (c: Call) => c.init.headers as Record<string, string>;

describe('HttpClient', () => {
  it('requires a baseUrl and strips a trailing slash', async () => {
    expect(() => new HttpClient({ baseUrl: '' })).toThrow('non-empty baseUrl');
    const f = fetcher(envelope(1));
    await new HttpClient({ baseUrl: 'https://api.example/', fetcher: f.fn }).request('GET', 'x');
    expect(f.calls[0].url).toBe('https://api.example/x');
  });

  it('serialises query params, skipping null/undefined', async () => {
    const f = fetcher(envelope(1));
    await new HttpClient({ baseUrl: 'https://a', fetcher: f.fn }).request('GET', '/q', { query: { a: 1, b: true, c: null, d: undefined, e: 'x y' } });
    expect(f.calls[0].url).toBe('https://a/q?a=1&b=true&e=x+y');
  });

  it('sends JSON bodies and default + per-request headers, generating x-request-id', async () => {
    const f = fetcher(envelope(1));
    const c = new HttpClient({ baseUrl: 'https://a', fetcher: f.fn, defaultHeaders: { 'x-team': 't' } });
    await c.request('POST', '/p', { body: { a: 1 }, headers: { 'x-extra': 'e' } });
    expect(f.calls[0].init.body).toBe('{"a":1}');
    expect(headersOf(f.calls[0])).toMatchObject({ 'content-type': 'application/json', 'x-team': 't', 'x-extra': 'e' });
    expect(headersOf(f.calls[0])['x-request-id']).toMatch(/[0-9a-f-]{36}/);
    await c.request('GET', '/p', { headers: { 'x-request-id': 'mine' } });
    expect(headersOf(f.calls[1])['x-request-id']).toBe('mine');
    expect(f.calls[1].init.body).toBeUndefined();
  });

  it.each([
    [{ type: 'bearer', token: 'tok' }, { authorization: 'Bearer tok' }],
    [{ type: 'bearer', token: async () => 'async-tok' }, { authorization: 'Bearer async-tok' }],
    [{ type: 'apiKey', key: 'k' }, { 'x-api-key': 'k' }],
    [{ type: 'apiKey', key: () => 'k2', headerName: 'x-custom' }, { 'x-custom': 'k2' }],
    [{ type: 'rumKey', key: 'r' }, { 'x-rum-key': 'r' }],
    [{ type: 'custom', getHeaders: async () => ({ 'x-sig': 's' }) }, { 'x-sig': 's' }],
  ] as const)('auth strategy %o → headers', async (auth, expected) => {
    const f = fetcher(envelope(1));
    await new HttpClient({ baseUrl: 'https://a', fetcher: f.fn, auth: auth as never }).request('GET', '/');
    expect(headersOf(f.calls[0])).toMatchObject(expected);
  });

  it('unwraps {data, meta} envelopes and passes through other payloads', async () => {
    expect(await new HttpClient({ baseUrl: 'https://a', fetcher: fetcher(envelope({ x: 1 })).fn }).request('GET', '/')).toEqual({ x: 1 });
    expect(await new HttpClient({ baseUrl: 'https://a', fetcher: fetcher(json({ profile: 1 })).fn }).request('GET', '/')).toEqual({ profile: 1 });
    expect(await new HttpClient({ baseUrl: 'https://a', fetcher: fetcher(new Response('plain', { status: 200 })).fn }).request('GET', '/')).toBe('plain');
    expect(await new HttpClient({ baseUrl: 'https://a', fetcher: fetcher(new Response(null, { status: 204 })).fn }).request('DELETE', '/')).toBeNull();
  });

  it('requestWithMeta exposes status and request id', async () => {
    const f = fetcher(json({ data: 1 }, 202, { 'x-request-id': 'rid' }));
    const r = await new HttpClient({ baseUrl: 'https://a', fetcher: f.fn }).requestWithMeta('POST', '/');
    expect(r).toMatchObject({ data: 1, meta: { status: 202, requestId: 'rid' } });
  });

  it('maps error envelopes to ApexApiError without retrying non-retryable statuses', async () => {
    const f = fetcher(json({ error: 'FORBIDDEN', message: 'nope', requestId: 'rid', details: { a: 1 } }, 403));
    const err = await new HttpClient({ baseUrl: 'https://a', fetcher: f.fn }).request('GET', '/').catch((e) => e);
    expect(err).toBeInstanceOf(ApexApiError);
    expect(err).toMatchObject({ status: 403, code: 'FORBIDDEN', message: 'nope', requestId: 'rid', details: { a: 1 }, isRetryable: false });
    expect(f.calls).toHaveLength(1);
  });

  it('falls back to header request id and generic message for non-JSON errors', async () => {
    const f = fetcher(new Response('', { status: 400, headers: { 'x-request-id': 'hdr' } }));
    const err = await new HttpClient({ baseUrl: 'https://a', fetcher: f.fn }).request('GET', '/').catch((e) => e);
    expect(err).toMatchObject({ status: 400, code: 'API_ERROR', requestId: 'hdr', message: 'Request failed' });
  });

  it('retries retryable statuses with backoff and then succeeds', async () => {
    const f = fetcher(json({}, 503), json({}, 429), envelope('ok'));
    const c = new HttpClient({ baseUrl: 'https://a', fetcher: f.fn, retry: { maxRetries: 2, baseDelayMs: 1 } });
    expect(await c.request('GET', '/')).toBe('ok');
    expect(f.calls).toHaveLength(3);
  });

  it('gives up after maxRetries and throws the last error', async () => {
    const f = fetcher(json({ error: 'UNAVAILABLE' }, 503));
    const err = await new HttpClient({ baseUrl: 'https://a', fetcher: f.fn, retry: { maxRetries: 1, baseDelayMs: 1 } }).request('GET', '/').catch((e) => e);
    expect(err).toMatchObject({ status: 503, isRetryable: true });
    expect(f.calls).toHaveLength(2);
  });

  it('retries network failures (TypeError) and rethrows when exhausted', async () => {
    const ok = fetcher(new TypeError('fetch failed'), envelope(1));
    expect(await new HttpClient({ baseUrl: 'https://a', fetcher: ok.fn, retry: { baseDelayMs: 1 } }).request('GET', '/')).toBe(1);
    const bad = fetcher(new TypeError('fetch failed'));
    await expect(new HttpClient({ baseUrl: 'https://a', fetcher: bad.fn, retry: { maxRetries: 0 } }).request('GET', '/')).rejects.toThrow('fetch failed');
  });

  it('aborts slow requests after timeoutMs', async () => {
    const slow = vi.fn((_u: string, init: RequestInit) => new Promise<Response>((_r, reject) => {
      init.signal!.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
    }));
    const c = new HttpClient({ baseUrl: 'https://a', fetcher: slow as never, timeoutMs: 20, retry: { maxRetries: 0 } });
    const err = await c.request('GET', '/').catch((e) => e);
    expect(err).toBeInstanceOf(ApexNetworkError);
    expect(err.message).toBe('Request timed out after 20 ms');
  });

  it('retries a request that timed out (our timeout, not the caller cancelling)', async () => {
    let n = 0;
    const flaky = vi.fn((_u: string, init: RequestInit) => {
      n += 1;
      if (n > 1) return Promise.resolve(envelope('ok'));
      return new Promise<Response>((_r, reject) => init.signal!.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))));
    });
    const c = new HttpClient({ baseUrl: 'https://a', fetcher: flaky as never, timeoutMs: 20, retry: { maxRetries: 1, baseDelayMs: 1 } });
    expect(await c.request('GET', '/')).toBe('ok');
    expect(flaky).toHaveBeenCalledTimes(2);
  });

  // Behaves like real fetch: rejects immediately for an already-aborted signal, or when it aborts later.
  const abortableFetch = () => vi.fn((_u: string, init: RequestInit) => new Promise<Response>((_r, reject) => {
    const fail = () => reject(new DOMException('aborted', 'AbortError'));
    if (init.signal!.aborted) return fail();
    init.signal!.addEventListener('abort', fail);
  }));

  it('honours a caller AbortSignal', async () => {
    const controller = new AbortController();
    const p = new HttpClient({ baseUrl: 'https://a', fetcher: abortableFetch() as never, retry: { maxRetries: 0 } }).request('GET', '/', { signal: controller.signal });
    controller.abort();
    await expect(p).rejects.toThrow('aborted');
  });

  it('a request cancelled by the caller is not retried (KI-33)', async () => {
    const controller = new AbortController();
    controller.abort();
    const f = abortableFetch();
    await new HttpClient({ baseUrl: 'https://a', fetcher: f as never, retry: { maxRetries: 2, baseDelayMs: 1 } })
      .request('GET', '/', { signal: controller.signal })
      .catch(() => undefined);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('ApexNetworkError is retryable by definition', () => {
    expect(new ApexNetworkError('x').isRetryable).toBe(true);
  });

  it('sends the idempotency key in the header the server reads, x-idempotency-key (KI-33)', async () => {
    const f = fetcher(envelope(1));
    await new HttpClient({ baseUrl: 'https://a', fetcher: f.fn }).request('POST', '/', { idempotencyKey: 'idem-12345' });
    expect(headersOf(f.calls[0])['x-idempotency-key']).toBe('idem-12345');
  });

  it('does not retry 409 Conflict, even for idempotent requests (KI-33)', async () => {
    for (const method of ['POST', 'GET'] as const) {
      const f = fetcher(json({ error: 'CONFLICT' }, 409));
      const err = await new HttpClient({ baseUrl: 'https://a', fetcher: f.fn, retry: { maxRetries: 2, baseDelayMs: 1 } }).request(method, '/').catch((e) => e);
      expect(err).toMatchObject({ status: 409, isRetryable: false });
      expect(f.calls).toHaveLength(1);
    }
  });

  describe('POST/PATCH retries never risk creating something twice', () => {
    const client = (f: ReturnType<typeof fetcher>) => new HttpClient({ baseUrl: 'https://a', fetcher: f.fn, retry: { maxRetries: 2, baseDelayMs: 1 } });

    it('without an idempotency key: no retry on 500/502/504 or network errors', async () => {
      for (const first of [json({}, 500), json({}, 502), json({}, 504), new TypeError('socket hang up')]) {
        const f = fetcher(first, envelope('second'));
        await expect(client(f).request('POST', '/')).rejects.toBeDefined();
        expect(f.calls).toHaveLength(1);
      }
      const p = fetcher(json({}, 500), envelope('second'));
      await expect(client(p).request('PATCH', '/')).rejects.toBeDefined();
      expect(p.calls).toHaveLength(1);
    });

    it('without an idempotency key: still retries 429 and 503 (the server did not act on them)', async () => {
      const f = fetcher(json({}, 429), json({}, 503), envelope('ok'));
      expect(await client(f).request('POST', '/')).toBe('ok');
      expect(f.calls).toHaveLength(3);
    });

    it('with an idempotency key: retries 5xx and network errors, sending the same key each time', async () => {
      const f = fetcher(json({}, 500), new TypeError('reset'), envelope('ok'));
      expect(await client(f).request('POST', '/', { idempotencyKey: 'idem-abc' })).toBe('ok');
      expect(f.calls.map((c) => headersOf(c)['x-idempotency-key'])).toEqual(['idem-abc', 'idem-abc', 'idem-abc']);
    });
  });
});

describe('ApexClient endpoint mapping', () => {
  const f = fetcher(envelope({}));
  const client = createApexClient({ baseUrl: 'https://a', fetcher: f.fn });
  const last = () => f.calls.at(-1)!;

  it.each<[string, (c: ApexClient) => Promise<unknown>, string, string]>([
    ['auth.login', (c) => c.auth.login({}), 'POST', '/api/v1/auth/login'],
    ['auth.register', (c) => c.auth.register({}), 'POST', '/api/v1/users/register'],
    ['auth.refresh', (c) => c.auth.refresh({}), 'POST', '/api/v1/auth/refresh'],
    ['auth.logout', (c) => c.auth.logout(), 'POST', '/api/v1/auth/logout'],
    ['auth.me', (c) => c.auth.me(), 'GET', '/api/v1/users/me'],
    ['auth.generateIngestKey', (c) => c.auth.generateIngestKey({}), 'POST', '/api/v1/auth/keys'],
    ['auth.generateRumKey', (c) => c.auth.generateRumKey({}), 'POST', '/api/v1/auth/rum-keys'],
    ['auth.oauthStart', (c) => c.auth.oauthStart('github', 'register'), 'GET', '/api/v1/auth/oauth/github/start?mode=register'],
    ['auth.oauthCallback', (c) => c.auth.oauthCallback('google', { code: 'c' }), 'GET', '/api/v1/auth/oauth/google/callback?code=c'],
    ['projects.listMine', (c) => c.projects.listMine(), 'GET', '/api/v1/projects'],
    ['projects.create', (c) => c.projects.create({}), 'POST', '/api/v1/projects'],
    ['projects.members.list', (c) => c.projects.members.list('p1'), 'GET', '/api/v1/users/p1/members'],
    ['projects.members.add', (c) => c.projects.members.add('p1', {}), 'POST', '/api/v1/users/p1/members'],
    ['projects.members.update', (c) => c.projects.members.update('p1', 'm1', {}), 'PATCH', '/api/v1/users/p1/members/m1'],
    ['projects.members.remove', (c) => c.projects.members.remove('p1', 'm1'), 'DELETE', '/api/v1/users/p1/members/m1'],
    ['ingest.batch', (c) => c.ingest.batch({}), 'POST', '/api/v1/ingest'],
    ['rum.ingest', (c) => c.rum.ingest({}), 'POST', '/api/v1/rum'],
    ['rum.overview', (c) => c.rum.overview({ projectId: 'p' }), 'GET', '/api/v1/rum/overview?projectId=p'],
    ['rum.series', (c) => c.rum.series(), 'GET', '/api/v1/rum/series'],
    ['rum.paths', (c) => c.rum.paths(), 'GET', '/api/v1/rum/paths'],
    ['rum.devices', (c) => c.rum.devices(), 'GET', '/api/v1/rum/devices'],
    ['rum.geo', (c) => c.rum.geo(), 'GET', '/api/v1/rum/geo'],
    ['rum.referrers', (c) => c.rum.referrers(), 'GET', '/api/v1/rum/referrers'],
    ['metrics.overview', (c) => c.metrics.overview(), 'GET', '/api/v1/metrics/overview'],
    ['metrics.latency', (c) => c.metrics.latency(), 'GET', '/api/v1/metrics/latency'],
    ['metrics.operations', (c) => c.metrics.operations(), 'GET', '/api/v1/metrics/operations'],
    ['logs.list', (c) => c.logs.list(), 'GET', '/api/v1/logs'],
    ['traces.list', (c) => c.traces.list(), 'GET', '/api/v1/traces'],
    ['traces.detail', (c) => c.traces.detail('t1'), 'GET', '/api/v1/traces/t1'],
    ['insights.list', (c) => c.insights.list(), 'GET', '/api/v1/insights'],
    ['keys.list', (c) => c.keys.list(), 'GET', '/api/v1/keys'],
    ['keys.stats', (c) => c.keys.stats(), 'GET', '/api/v1/keys/stats'],
    ['keys.create', (c) => c.keys.create({}), 'POST', '/api/v1/keys'],
    ['keys.revoke', (c) => c.keys.revoke(5, { query: { projectId: 'p' } }), 'DELETE', '/api/v1/keys/5?projectId=p'],
    ['billing.checkout', (c) => c.billing.checkout({}), 'POST', '/api/v1/billing/checkout'],
    ['alerts.listRules', (c) => c.alerts.listRules('p'), 'GET', '/api/v1/alerts/rules?projectId=p'],
    ['alerts.createRule', (c) => c.alerts.createRule({ projectId: 'p' }), 'POST', '/api/v1/alerts/rules'],
    ['alerts.updateRule', (c) => c.alerts.updateRule('p', 3, { isActive: false }), 'PATCH', '/api/v1/alerts/rules/3?projectId=p'],
    ['alerts.deleteRule', (c) => c.alerts.deleteRule('p', 3), 'DELETE', '/api/v1/alerts/rules/3?projectId=p'],
    ['alerts.events', (c) => c.alerts.events({ projectId: 'p', limit: 5 }), 'GET', '/api/v1/alerts/events?projectId=p&limit=5'],
    ['request.put', (c) => c.request.put('/custom', { a: 1 }), 'PUT', '/custom'],
  ])('%s → %s %s', async (_name, invoke, method, path) => {
    await invoke(client);
    expect(last().init.method).toBe(method);
    expect(last().url).toBe(`https://a${path}`);
  });
});

describe('telemetry batches get an idempotency key automatically (KI-33)', () => {
  it('ingest.batch and rum.ingest send a fresh key per call, and keep a caller-provided one', async () => {
    const f = fetcher(envelope({}));
    const client = createApexClient({ baseUrl: 'https://a', fetcher: f.fn });
    await client.ingest.batch({ logs: [] });
    await client.ingest.batch({ logs: [] });
    await client.rum.ingest({ events: [] }, { idempotencyKey: 'mine-12345' });
    const keys = f.calls.map((c) => headersOf(c)['x-idempotency-key']);
    expect(keys[0]).toMatch(/^[0-9a-f-]{36}$/);
    expect(keys[1]).not.toBe(keys[0]);
    expect(keys[2]).toBe('mine-12345');
  });

  it('so a timed-out ingest is retried with the same key', async () => {
    const f = fetcher(new TypeError('socket hang up'), envelope({ status: 'queued' }));
    const client = createApexClient({ baseUrl: 'https://a', fetcher: f.fn, retry: { maxRetries: 1, baseDelayMs: 1 } });
    await client.ingest.batch({ logs: [] });
    expect(f.calls).toHaveLength(2);
    expect(headersOf(f.calls[0])['x-idempotency-key']).toBe(headersOf(f.calls[1])['x-idempotency-key']);
  });
});
