import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createBrowserRumClient, MAX_EVENTS_PER_BATCH, SDK_VERSION } from '../src/index';
import { RumIngestBatchDto } from '../../../apps/server/src/modules/rum/dto/rum-ingest.dto';
import pkg from '../package.json';

function setup(opts: Record<string, unknown> = {}) {
  const calls: Array<{ url: string; headers: Record<string, string>; body: any }> = [];
  const fetcher = vi.fn(async (url: string, init: RequestInit) => {
    calls.push({ url, headers: init.headers as Record<string, string>, body: JSON.parse(String(init.body)) });
    return new Response(JSON.stringify({ data: { status: 'queued' } }), { status: 202, headers: { 'content-type': 'application/json' } });
  });
  const client = createBrowserRumClient({ baseUrl: 'https://api.example', rumKey: 'rum_k', fetcher: fetcher as never, ...opts });
  return { client, calls, fetcher };
}

/** The server's own schema: what it accepts is the contract (KI-10). */
function expectServerAccepts(body: unknown) {
  const parsed = RumIngestBatchDto.safeParse(body);
  expect(parsed.success, JSON.stringify(parsed.error?.issues?.slice(0, 3))).toBe(true);
  return parsed.data!;
}

describe('ApexBrowserRumClient', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    delete (globalThis as any).window;
    delete (globalThis as any).document;
    delete (globalThis as any).location;
  });

  it('flush is a no-op with an empty queue', async () => {
    const { client, fetcher } = setup();
    await client.flush();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('flushes queued events to /api/v1/rum with the x-rum-key header and empties the queue', async () => {
    const { client, calls } = setup({ defaultContext: { app: 'shop' } });
    client.trackPageView('/home', { experiment: 'b' });
    client.trackWebVitals({ lcpMs: 1200 }, '/home');
    await client.flush();
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://api.example/api/v1/rum');
    expect(calls[0].headers['x-rum-key']).toBe('rum_k');
    await client.flush();
    expect(calls).toHaveLength(1);
  });

  it('produces batches the server RUM endpoint accepts (KI-10)', async () => {
    const { client, calls } = setup({ defaultContext: { app: 'shop', nested: { dropped: true }, n: 3 } });
    client.trackPageView('/pricing', { plan: 'pro' }, { referrer: 'https://google.com/' });
    client.trackWebVitals({ lcpMs: 1200.4, fcpMs: 800, ttfbMs: 120 }, '/pricing');
    client.trackHeartbeat('/pricing');
    await client.flush();
    const batch = expectServerAccepts(calls[0].body);
    expect(batch.sdkVersion).toBe(SDK_VERSION);
    expect(batch.events.map((e) => e.type)).toEqual(['page_view', 'web_vital', 'heartbeat']);
    expect(batch.events[0]).toMatchObject({ path: '/pricing', referrer: 'https://google.com/', metadata: { app: 'shop', n: 3, plan: 'pro' } });
    expect(batch.events[0].metadata).not.toHaveProperty('nested');
    expect(batch.events[1]).toMatchObject({ lcpMs: 1200, fcpMs: 800, ttfbMs: 120 });
    // one session id for the client, sent with every event
    expect(new Set(batch.events.map((e) => e.sessionId)).size).toBe(1);
    expect(calls[0].body).not.toHaveProperty('projectId');
  });

  it('drops invalid vitals instead of sending a batch the server would reject', async () => {
    const { client, calls } = setup();
    client.trackWebVitals({ lcpMs: -5, fcpMs: Number.NaN, ttfbMs: 10_000_000 }, '/x');
    await client.flush();
    const [event] = expectServerAccepts(calls[0].body).events;
    expect(event).not.toHaveProperty('lcpMs');
    expect(event).not.toHaveProperty('fcpMs');
    expect(event).not.toHaveProperty('ttfbMs');
  });

  it('uses the browser location and referrer when not given', async () => {
    (globalThis as any).location = { pathname: '/checkout' };
    (globalThis as any).document = { referrer: 'https://news.example/' };
    const { client, calls } = setup();
    client.trackPageView('/checkout');
    client.trackWebVitals({ lcpMs: 900 });
    await client.flush();
    const batch = expectServerAccepts(calls[0].body);
    expect(batch.events[0].referrer).toBe('https://news.example/');
    expect(batch.events[1].path).toBe('/checkout');
  });

  it('truncates over-long paths and falls back to / for empty ones', async () => {
    const { client, calls } = setup();
    client.trackPageView(`/${'a'.repeat(2000)}`);
    client.trackPageView('');
    await client.flush();
    const batch = expectServerAccepts(calls[0].body);
    expect(batch.events[0].path).toHaveLength(1024);
    expect(batch.events[1].path).toBe('/');
  });

  it(`splits large queues into requests of at most ${MAX_EVENTS_PER_BATCH} events`, async () => {
    const { client, calls } = setup({ maxQueueSize: 10_000 });
    for (let i = 0; i < MAX_EVENTS_PER_BATCH + 5; i++) client.trackPageView(`/p${i}`);
    await client.flush();
    expect(calls.map((c) => c.body.events.length)).toEqual([MAX_EVENTS_PER_BATCH, 5]);
    calls.forEach((c) => expectServerAccepts(c.body));
  });

  it('keeps a caller-provided session id', async () => {
    const { client, calls } = setup({ sessionId: 'sess-123' });
    client.trackPageView('/');
    await client.flush();
    expect(calls[0].body.events[0].sessionId).toBe('sess-123');
  });

  it('SDK_VERSION matches package.json', () => {
    expect(SDK_VERSION).toBe(pkg.version);
  });

  it('auto-flushes when maxQueueSize is reached', async () => {
    const { client, calls } = setup({ maxQueueSize: 2 });
    client.trackPageView('/a');
    expect(calls).toHaveLength(0);
    client.trackPageView('/b');
    await vi.runAllTimersAsync();
    expect(calls).toHaveLength(1);
    expect(calls[0].body.events).toHaveLength(2);
  });

  it('start flushes on an interval, is idempotent, and stop halts it', async () => {
    const { client, calls } = setup({ flushIntervalMs: 1000 });
    client.start();
    client.start();
    client.trackPageView('/a');
    await vi.advanceTimersByTimeAsync(1000);
    expect(calls).toHaveLength(1);
    client.stop();
    client.stop();
    client.trackPageView('/b');
    await vi.advanceTimersByTimeAsync(5000);
    expect(calls).toHaveLength(1);
  });

  it('registers a beforeunload flush in browsers', async () => {
    const listeners: Record<string, () => void> = {};
    (globalThis as any).window = { addEventListener: (ev: string, fn: () => void) => { listeners[ev] = fn; } };
    const { client, calls } = setup();
    client.start();
    client.trackPageView('/leaving');
    listeners.beforeunload();
    await vi.runOnlyPendingTimersAsync();
    expect(calls).toHaveLength(1);
    client.stop();
  });

  it('accepts a key provider function', async () => {
    const { client, calls } = setup({ rumKey: async () => 'rum_dynamic' });
    client.trackPageView('/');
    await client.flush();
    expect(calls[0].headers['x-rum-key']).toBe('rum_dynamic');
  });
});
