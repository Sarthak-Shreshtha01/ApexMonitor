import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { appWith, FakeChannel, FakeRedis, PROJECT_A, PROJECT_B, project, fakeRabbit } from '../../helpers/fakes';

const redis = new FakeRedis();
const channel = new FakeChannel();
vi.mock('@infrastructure/redis', () => ({ getRedis: () => redis }));
vi.mock('@infrastructure/rabbitmq', async (importOriginal) => ({ ...(await importOriginal<object>()), ...fakeRabbit(channel) }));
vi.mock('@infrastructure/db/postgres', () => ({ getPg: () => ({ query: vi.fn(async () => ({ rows: [] })) }) }));

const listProjects = vi.fn(async () => [project(PROJECT_A)]);
vi.mock('@modules/users/user.service', () => ({ UserService: class { listProjects = listProjects; } }));

const repo = {
  getOverview: vi.fn(async () => ({ pageViews: 1 })),
  getSeries: vi.fn(async () => []),
  getTopPaths: vi.fn(async () => []),
  getDeviceBreakdown: vi.fn(async () => []),
  getGeoBreakdown: vi.fn(async () => []),
  getReferrerBreakdown: vi.fn(async () => []),
};
vi.mock('@modules/rum/rum.repository', () => ({ RumRepository: class { constructor() { return repo; } } }));

vi.mock('@modules/auth/auth.service', () => ({
  AuthService: class {
    validateRumWriteKey = vi.fn(async (key: string) => {
      if (key === 'rum-a') return PROJECT_A;
      throw new Error('UNAUTHORIZED');
    });
  },
}));

const { RumService } = await import('@modules/rum/rum.service');
const { rumRouter } = await import('@modules/rum');
const { signAccessToken } = await import('@shared/auth/tokens');

const CHROME_MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
const SAFARI_IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const EDGE_WIN = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36 Edg/120.0';
const FIREFOX_LINUX = 'Mozilla/5.0 (X11; Linux x86_64; rv:120.0) Gecko/20100101 Firefox/120.0';
const ANDROID_CHROME = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36';
const IPAD = 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/604.1';
const BOT = 'Googlebot/2.1 (+http://www.google.com/bot.html)';

const ctx = (overrides: Record<string, unknown> = {}) => ({
  projectId: PROJECT_A,
  origin: 'https://shop.example',
  referrer: '',
  userAgent: CHROME_MAC,
  ip: '198.51.100.1',
  countryCode: 'IN',
  regionCode: 'KA',
  ...overrides,
});
const ev = (overrides: Record<string, unknown> = {}) => ({ type: 'page_view' as const, path: '/', referrer: '', timestamp: new Date().toISOString(), metadata: {}, ...overrides });

describe('RumService.processBatch', () => {
  const service = new RumService();
  beforeEach(() => {
    redis.store.clear();
    channel.published = [];
  });

  it.each([
    [CHROME_MAC, 'Chrome', 'macOS', 'desktop'],
    [SAFARI_IPHONE, 'Safari', 'iOS', 'mobile'],
    [EDGE_WIN, 'Edge', 'Windows', 'desktop'],
    [FIREFOX_LINUX, 'Firefox', 'Linux', 'desktop'],
    [ANDROID_CHROME, 'Chrome', 'Android', 'mobile'],
    [IPAD, 'Safari', 'iOS', 'tablet'],
    [BOT, 'Unknown', 'Unknown', 'bot'],
    ['', 'Unknown', 'Unknown', 'unknown'],
  ])('detects browser/os/device for %s', async (ua, browser, os, device) => {
    await service.processBatch({ sdkVersion: '1.0.0', events: [ev()] }, ctx({ userAgent: ua }));
    const [e] = (channel.published[0].body as any).events;
    expect(e).toMatchObject({ browserName: browser, osName: os, deviceType: device });
  });

  it('normalises paths and referrers', async () => {
    await service.processBatch({
      sdkVersion: '1.0.0',
      events: [
        ev({ path: '/a//b/?q=1#frag', referrer: 'https://WWW.Google.com/search?q=x' }),
        ev({ path: 'https://other.example/pricing/' }),
        ev({ path: '/', referrer: 'not a url' }),
      ],
    }, ctx({ referrer: 'https://ctx.example/' }));
    const events = (channel.published[0].body as any).events;
    expect(events[0]).toMatchObject({ path: '/a/b', referrerSource: 'www.google.com' });
    expect(events[1]).toMatchObject({ path: '/pricing', referrerSource: 'ctx.example' });
    expect(events[2]).toMatchObject({ path: '/', referrerSource: 'unknown' });
  });

  it('uses "direct" when there is no referrer at all', async () => {
    await service.processBatch({ sdkVersion: '1.0.0', events: [ev()] }, ctx());
    expect((channel.published[0].body as any).events[0].referrerSource).toBe('direct');
  });

  it('drops events older than 24h or more than 5 min in the future', async () => {
    const now = Date.now();
    const res = await service.processBatch({
      sdkVersion: '1.0.0',
      events: [
        ev({ timestamp: new Date(now - 25 * 3600_000).toISOString() }),
        ev({ timestamp: new Date(now + 10 * 60_000).toISOString() }),
        ev({ timestamp: new Date(now - 60_000).toISOString() }),
      ],
    }, ctx());
    expect(res.received).toBe(1);
  });

  it('returns received 0 and publishes nothing when every event is stale', async () => {
    const res = await service.processBatch({ sdkVersion: '1.0.0', events: [ev({ timestamp: '2000-01-01T00:00:00Z' })] }, ctx());
    expect(res.received).toBe(0);
    expect(channel.published).toHaveLength(0);
  });

  it('hashes visitor and session ids (no raw IP/UA/session id leaves the service)', async () => {
    await service.processBatch({ sdkVersion: '1.0.0', events: [ev({ sessionId: 'sess-1' }), ev({ sessionId: 'sess-2' }), ev()] }, ctx());
    const [a, b, c] = (channel.published[0].body as any).events;
    expect(a.visitorHash).toMatch(/^[0-9a-f]{64}$/);
    expect(a.visitorHash).toBe(b.visitorHash);
    expect(a.sessionHash).not.toBe(b.sessionHash);
    expect(c.sessionHash).not.toBe(a.sessionHash);
    expect(JSON.stringify(channel.published[0].body)).not.toContain('198.51.100.1');
    expect(JSON.stringify(channel.published[0].body)).not.toContain('sess-1');
  });

  it('publishes rum.ingest with the batch envelope and copies web vitals', async () => {
    const res = await service.processBatch({ sdkVersion: '1.2.3', events: [ev({ type: 'web_vital', ttfbMs: 100, fcpMs: 200, lcpMs: 300 })] }, ctx());
    const msg = channel.published[0];
    expect(msg).toMatchObject({ exchange: 'logs.exchange', routingKey: 'rum.ingest' });
    expect(msg.body).toMatchObject({ batchId: res.batchId, projectId: PROJECT_A });
    expect((msg.body as any).events[0]).toMatchObject({ type: 'web_vital', ttfbMs: 100, fcpMs: 200, lcpMs: 300, sdkVersion: '1.2.3', countryCode: 'IN', regionCode: 'KA' });
  });

  it('rate limits per project per minute', async () => {
    const minute = new Date().toISOString().slice(0, 16);
    redis.store.set(`rate:rum:${PROJECT_A}:${minute}`, String(10_000_000));
    await expect(service.processBatch({ sdkVersion: '1.0.0', events: [ev()] }, ctx())).rejects.toThrow('RATE_LIMITED');
  });

  it('deduplicates by idempotency key and returns the original batchId', async () => {
    const first = await service.processBatch({ sdkVersion: '1.0.0', events: [ev()] }, ctx({ idempotencyKey: 'idem-1' }));
    const second = await service.processBatch({ sdkVersion: '1.0.0', events: [ev()] }, ctx({ idempotencyKey: 'idem-1' }));
    expect(second).toEqual({ received: 0, batchId: first.batchId });
    expect(channel.published).toHaveLength(1);
  });

  it('a batch RabbitMQ does not confirm is rejected and frees its idempotency key (KI-16)', async () => {
    const rabbit = await import('@infrastructure/rabbitmq');
    vi.mocked(rabbit.publish).mockRejectedValueOnce(new rabbit.BrokerUnavailableError('down'));
    await expect(service.processBatch({ sdkVersion: '1.0.0', events: [ev()] }, ctx({ idempotencyKey: 'idem-fail' }))).rejects.toThrow('down');
    expect(redis.store.has(`rum:idempotency:${PROJECT_A}:idem-fail`)).toBe(false);
    const retry = await service.processBatch({ sdkVersion: '1.0.0', events: [ev()] }, ctx({ idempotencyKey: 'idem-fail' }));
    expect(retry.received).toBe(1);
  });

  it('read methods enforce project membership', async () => {
    const q = { projectId: PROJECT_B, timeframe: '24h' as const, limit: 20 };
    for (const fn of ['getOverview', 'getSeries', 'getTopPaths', 'getDeviceBreakdown', 'getGeoBreakdown', 'getReferrerBreakdown'] as const) {
      await expect(service[fn]('usr_1', q)).rejects.toThrow('PROJECT_ACCESS_DENIED');
    }
    await expect(service.getOverview('usr_1', { ...q, projectId: PROJECT_A })).resolves.toEqual({ pageViews: 1 });
  });
});

describe('RUM routes', () => {
  const app = appWith((a) => a.use('/rum', rumRouter));
  const token = signAccessToken({ id: 'usr_1', email: 'u@example.test' });
  beforeEach(() => {
    channel.published = [];
    redis.store.clear();
  });

  it('415 for non-JSON bodies', async () => {
    const res = await request(await app).post('/rum').set('x-rum-key', 'rum-a').set('content-type', 'text/plain').send('hi');
    expect(res.status).toBe(415);
  });

  it('401 for invalid keys', async () => {
    const res = await request(await app).post('/rum').set('x-rum-key', 'nope').send({ events: [ev()] });
    expect(res.status).toBe(401);
  });

  it('extracts IP, country, region and idempotency from headers', async () => {
    const res = await request(await app)
      .post('/rum')
      .set('x-rum-key', 'rum-a')
      .set('x-forwarded-for', '203.0.113.9, 10.0.0.1')
      .set('cf-ipcountry', 'de')
      .set('x-region-code', 'by')
      .set('x-idempotency-key', 'abc')
      .set('referer', 'https://ref.example/x')
      .send({ events: [{ path: '/p', timestamp: new Date().toISOString() }] });
    expect(res.status).toBe(202);
    const e = (channel.published[0].body as any).events[0];
    expect(e).toMatchObject({ countryCode: 'DE', regionCode: 'BY', referrerSource: 'ref.example' });
    expect(redis.store.has(`rum:idempotency:${PROJECT_A}:abc`)).toBe(true);
  });

  it('defaults country/region when headers are absent', async () => {
    await request(await app).post('/rum').set('x-rum-key', 'rum-a').send({ events: [ev()] });
    expect((channel.published[0].body as any).events[0]).toMatchObject({ countryCode: 'XX', regionCode: 'UNKNOWN' });
  });

  it('429 when rate limited', async () => {
    redis.store.set(`rate:rum:${PROJECT_A}:${new Date().toISOString().slice(0, 16)}`, '99999999');
    const res = await request(await app).post('/rum').set('x-rum-key', 'rum-a').send({ events: [ev()] });
    expect(res.status).toBe(429);
  });

  it.each(['overview', 'series', 'paths', 'devices', 'geo', 'referrers'])('GET /rum/%s requires auth and membership', async (path) => {
    expect((await request(await app).get(`/rum/${path}?projectId=${PROJECT_A}`)).status).toBe(401);
    const forbidden = await request(await app).get(`/rum/${path}?projectId=${PROJECT_B}`).set('authorization', `Bearer ${token}`);
    expect(forbidden.status).toBe(403);
    const ok = await request(await app).get(`/rum/${path}?projectId=${PROJECT_A}`).set('authorization', `Bearer ${token}`);
    expect(ok.status).toBe(200);
    expect(ok.body.data).toHaveProperty('data');
    const bad = await request(await app).get(`/rum/${path}?projectId=bad`).set('authorization', `Bearer ${token}`);
    expect(bad.status).toBe(400);
  });
});
