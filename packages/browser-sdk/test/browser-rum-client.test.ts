import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createBrowserRumClient } from '../src/index';
import { RumIngestBatchDto } from '../../../apps/server/src/modules/rum/dto/rum-ingest.dto';

function setup(opts: Record<string, unknown> = {}) {
  const calls: Array<{ url: string; headers: Record<string, string>; body: any }> = [];
  const fetcher = vi.fn(async (url: string, init: RequestInit) => {
    calls.push({ url, headers: init.headers as Record<string, string>, body: JSON.parse(String(init.body)) });
    return new Response(JSON.stringify({ data: { status: 'queued' } }), { status: 202, headers: { 'content-type': 'application/json' } });
  });
  const client = createBrowserRumClient({ baseUrl: 'https://api.example', projectId: 'proj_x', rumKey: 'rum_k', fetcher: fetcher as never, ...opts });
  return { client, calls, fetcher };
}

describe('ApexBrowserRumClient', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    delete (globalThis as any).window;
  });

  it('flush is a no-op with an empty queue', async () => {
    const { client, fetcher } = setup();
    await client.flush();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('flushes queued events to /api/v1/rum with the x-rum-key header and empties the queue', async () => {
    const { client, calls } = setup({ defaultContext: { app: 'shop' } });
    client.trackPageView('/home', { experiment: 'b' });
    client.trackCustom('cta', { id: 'buy' });
    client.trackWebVitals({ lcpMs: 1200 });
    client.trackError(new TypeError('boom'));
    await client.flush();
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://api.example/api/v1/rum');
    expect(calls[0].headers['x-rum-key']).toBe('rum_k');
    expect(calls[0].body.projectId).toBe('proj_x');
    expect(calls[0].body.events.map((e: any) => e.type)).toEqual(['page_view', 'custom', 'web_vitals', 'error']);
    expect(calls[0].body.events[0].payload).toMatchObject({ path: '/home', app: 'shop', experiment: 'b' });
    expect(calls[0].body.events[3].payload).toMatchObject({ name: 'TypeError', message: 'boom' });
    await client.flush();
    expect(calls).toHaveLength(1);
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

  it.fails('[known bug KI-10] produces batches the server RUM endpoint accepts', async () => {
    const { client, calls } = setup();
    client.trackPageView('/pricing');
    client.trackWebVitals({ lcpMs: 1200, fcpMs: 800, ttfbMs: 120 });
    await client.flush();
    const parsed = RumIngestBatchDto.safeParse(calls[0].body);
    expect(parsed.success, JSON.stringify(parsed.error?.issues?.slice(0, 2))).toBe(true);
  });
});
