import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';
import { appWith, FakeChannel, FakePg, FakeRedis, logEntry, PROJECT_A, PROJECT_B, fakeRabbit } from '../../helpers/fakes';
import { windowKeys } from '@shared/rate-limit/sliding-window';

const rateKey = (scope: string, id: string) => windowKeys(scope, id, Date.now()).current;

const redis = new FakeRedis();
const pg = new FakePg();
const channel = new FakeChannel();
vi.mock('@infrastructure/redis', () => ({ getRedis: () => redis }));
vi.mock('@infrastructure/db/postgres', () => ({ getPg: () => pg }));
vi.mock('@infrastructure/rabbitmq', async (importOriginal) => ({ ...(await importOriginal<object>()), ...fakeRabbit(channel) }));

const validateApiKey = vi.fn();
vi.mock('@modules/auth/auth.service', () => ({
  AuthService: class {
    validateApiKey = validateApiKey;
  },
}));

const { ingestRouter } = await import('@modules/ingest');
const { IngestService } = await import('@modules/ingest/ingest.service');

const app = appWith((a) => a.use('/ingest', ingestRouter));

function reset() {
  redis.store.clear();
  redis.zsets.clear();
  pg.calls = [];
  channel.published = [];
  validateApiKey.mockReset();
  validateApiKey.mockImplementation(async (key: string) => {
    if (key === 'key-a') return PROJECT_A;
    if (key === 'key-b') return PROJECT_B;
    throw new Error('UNAUTHORIZED');
  });
}

describe('POST /ingest (controller + router)', () => {
  beforeEach(reset);

  it('401 without an API key', async () => {
    const res = await request(await app).post('/ingest').send({ logs: [logEntry()] });
    expect(res.status).toBe(401);
    expect(channel.published).toHaveLength(0);
  });

  it('401 with an invalid API key', async () => {
    const res = await request(await app).post('/ingest').set('x-api-key', 'nope').send({ logs: [logEntry()] });
    expect(res.status).toBe(401);
  });

  it('202 and publishes under the key project when body projectId matches', async () => {
    const res = await request(await app).post('/ingest').set('x-api-key', 'key-a').send({ projectId: PROJECT_A, logs: [logEntry()] });
    expect(res.status).toBe(202);
    expect(res.body.data).toMatchObject({ status: 'queued', received: 1 });
    expect(channel.published[0].options.headers).toMatchObject({ projectId: PROJECT_A });
    expect((channel.published[0].body as any[])[0].projectId).toBe(PROJECT_A);
  });

  it('202 when body omits projectId; uses the key project', async () => {
    const res = await request(await app).post('/ingest').set('x-api-key', 'key-a').send({ logs: [logEntry()] });
    expect(res.status).toBe(202);
    expect((channel.published[0].body as any[])[0].projectId).toBe(PROJECT_A);
  });

  it('KI-2: 403 when body projectId names another project, and nothing is published or counted', async () => {
    const res = await request(await app).post('/ingest').set('x-api-key', 'key-a').send({ projectId: PROJECT_B, logs: [logEntry()] });
    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ error: 'FORBIDDEN', requestId: 'test-request-id' });
    expect(channel.published).toHaveLength(0);
    expect(redis.store.get(rateKey('ingest', PROJECT_B))).toBeUndefined();
    expect(redis.store.get(`live:${PROJECT_B}:requests`)).toBeUndefined();
  });

  it('400 on invalid payloads', async () => {
    const res = await request(await app).post('/ingest').set('x-api-key', 'key-a').send({ logs: [logEntry({ statusCode: 42 })] });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
  });

  it('400 when body projectId is malformed (validated before the tenant check)', async () => {
    const res = await request(await app).post('/ingest').set('x-api-key', 'key-a').send({ projectId: 'x', logs: [logEntry()] });
    expect(res.status).toBe(400);
  });

  it('429 when the project is rate limited', async () => {
    redis.store.set(rateKey('ingest', PROJECT_A), '60000');
    const res = await request(await app).post('/ingest').set('x-api-key', 'key-a').send({ logs: [logEntry()] });
    expect(res.status).toBe(429);
    expect(res.body.error).toBe('RATE_LIMIT_EXCEEDED');
    expect(Number(res.headers['retry-after'])).toBeGreaterThan(0);
    expect(res.headers['x-ratelimit-limit']).toBe('60000');
    expect(res.headers['x-ratelimit-remaining']).toBe('0');
  });

  it('passes x-idempotency-key (trimmed, ≤128 chars) to the service', async () => {
    const key = `  ${'k'.repeat(200)}  `;
    const first = await request(await app).post('/ingest').set('x-api-key', 'key-a').set('x-idempotency-key', key).send({ logs: [logEntry()] });
    const second = await request(await app).post('/ingest').set('x-api-key', 'key-a').set('x-idempotency-key', key).send({ logs: [logEntry()] });
    expect(first.body.data.batchId).toBe(second.body.data.batchId);
    expect(channel.published).toHaveLength(1);
    expect(redis.store.has(`ingest:idempotency:${PROJECT_A}:${'k'.repeat(128)}`)).toBe(true);
  });

  it('503 with Retry-After when RabbitMQ does not confirm the batch, and nothing counted as received (KI-16)', async () => {
    const rabbit = await import('@infrastructure/rabbitmq');
    vi.mocked(rabbit.publish).mockRejectedValueOnce(new rabbit.BrokerUnavailableError('RabbitMQ is not connected'));
    const res = await request(await app).post('/ingest').set('x-api-key', 'key-a').send({ logs: [logEntry()] });
    expect(res.status).toBe(503);
    expect(res.headers['retry-after']).toBe('5');
    expect(res.body.error).toBe('SERVICE_UNAVAILABLE');
    expect(redis.store.has(`live:${PROJECT_A}:requests`)).toBe(false); // live counters only move for accepted batches
  });

  it('a failed batch frees its idempotency key so the retry is processed, not answered with a placeholder', async () => {
    const rabbit = await import('@infrastructure/rabbitmq');
    vi.mocked(rabbit.publish).mockRejectedValueOnce(new rabbit.BrokerUnavailableError('down'));
    const failed = await request(await app).post('/ingest').set('x-api-key', 'key-a').set('x-idempotency-key', 'retry-me').send({ logs: [logEntry()] });
    expect(failed.status).toBe(503);
    expect(redis.store.has(`ingest:idempotency:${PROJECT_A}:retry-me`)).toBe(false);
    const retry = await request(await app).post('/ingest').set('x-api-key', 'key-a').set('x-idempotency-key', 'retry-me').send({ logs: [logEntry()] });
    expect(retry.status).toBe(202);
    expect(retry.body.data.received).toBe(1);
    expect(channel.published).toHaveLength(1);
  });

  it('a rate-limited batch also frees its idempotency key', async () => {
    redis.store.set(rateKey('ingest', PROJECT_A), '60000');
    const res = await request(await app).post('/ingest').set('x-api-key', 'key-a').set('x-idempotency-key', 'limited-batch').send({ logs: [logEntry()] });
    expect(res.status).toBe(429);
    expect(redis.store.has(`ingest:idempotency:${PROJECT_A}:limited-batch`)).toBe(false);
  });
});

describe('IngestService.processBatch', () => {
  beforeEach(reset);
  const service = new IngestService();

  it('normalises endpoints, hashes IPs with a daily salt, and fills defaults', async () => {
    await service.processBatch({
      projectId: PROJECT_A,
      sdkVersion: '2.0.0',
      logs: [
        logEntry({ endpoint: '/users/123/orders/9f8e7d6c-1a2b-4c3d-8e9f-0123456789ab', ip: '1.2.3.4' }),
        logEntry({ endpoint: '/v1/items/42?x=1' }),
      ] as never,
    });
    const [first, second] = channel.published[0].body as any[];
    expect(first.endpoint).toBe('/users/:id/orders/:id');
    expect(second.endpoint).toBe('/v1/items/:id'); // query string dropped (KI-37)
    const day = new Date().toISOString().split('T')[0];
    expect(first.ip).toBe(crypto.createHash('sha256').update(`1.2.3.4:${PROJECT_A}:${day}`).digest('hex'));
    expect(first.ip).not.toContain('1.2.3.4');
    expect(first).toMatchObject({ projectId: PROJECT_A, region: 'XX', sdkVersion: '2.0.0' });
    expect(first.reqId).toMatch(/^[0-9a-f-]{36}$/);
    expect(first.reqId).not.toBe(second.reqId);
  });

  it('only whole numeric segments are replaced, /2fa/setup is not an id (KI-37)', async () => {
    await service.processBatch({ projectId: PROJECT_A, sdkVersion: '1.0.0', logs: [logEntry({ endpoint: '/auth/2fa/setup' })] as never });
    expect((channel.published[0].body as any[])[0].endpoint).toBe('/auth/2fa/setup');
  });

  it('query strings are stripped so they do not explode endpoint cardinality (KI-37)', async () => {
    await service.processBatch({ projectId: PROJECT_A, sdkVersion: '1.0.0', logs: [logEntry({ endpoint: '/search?q=shoes' })] as never });
    expect((channel.published[0].body as any[])[0].endpoint).toBe('/search');
  });

  it('publishes a persistent JSON message with batch metadata', async () => {
    const result = await service.processBatch({ projectId: PROJECT_A, sdkVersion: '1.0.0', logs: [logEntry()] as never });
    const msg = channel.published[0];
    expect(msg.exchange).toBe('logs.exchange');
    expect(msg.routingKey).toBe('log.ingest');
    expect(msg.options).toMatchObject({ persistent: true, contentType: 'application/json', messageId: result.batchId, correlationId: result.batchId });
  });

  it('updates live counters for the websocket pulse', async () => {
    await service.processBatch({
      projectId: PROJECT_A,
      sdkVersion: '1.0.0',
      logs: [logEntry({ statusCode: 500, latencyMs: 100 }), logEntry({ statusCode: 404, latencyMs: 50 }), logEntry({ latencyMs: 10 })] as never,
    });
    expect(redis.store.get(`live:${PROJECT_A}:requests`)).toBe('3');
    expect(redis.store.get(`live:${PROJECT_A}:errors`)).toBe('2');
    expect(redis.store.get(`live:${PROJECT_A}:latency_total`)).toBe('160');
    expect(redis.zsets.get(`live:${PROJECT_A}:endpoints`)?.get('GET /users/:id')).toBe(3);
    expect(redis.ttl.get(`live:${PROJECT_A}:requests`)).toBe(5);
  });

  it('looks up owner + tier and caches them', async () => {
    pg.respond([{ owner_user_id: 'usr_owner' }], /FROM projects/).respond([{ plan_tier: 'PRO' }], /FROM subscriptions/);
    await service.processBatch({ projectId: PROJECT_A, sdkVersion: '1.0.0', logs: [logEntry()] as never });
    expect(redis.store.get(`project_owner:${PROJECT_A}`)).toBe('usr_owner');
    expect(redis.store.get('tier:usr_owner')).toBe('PRO');
  });

  it('PRO tier gets 10x the FREE limit', async () => {
    redis.store.set(`project_owner:${PROJECT_A}`, 'usr_owner');
    redis.store.set('tier:usr_owner', 'PRO');
    redis.store.set(rateKey('ingest', PROJECT_A), '60000');
    await expect(service.processBatch({ projectId: PROJECT_A, sdkVersion: '1.0.0', logs: [logEntry()] as never })).resolves.toMatchObject({ received: 1 });
    redis.store.set(rateKey('ingest', PROJECT_A), '600000');
    await expect(service.processBatch({ projectId: PROJECT_A, sdkVersion: '1.0.0', logs: [logEntry()] as never })).rejects.toThrow('RATE_LIMITED');
  });

  it('rate limit counts events, not batches (KI-19)', async () => {
    await service.processBatch({ projectId: PROJECT_A, sdkVersion: '1.0.0', logs: Array.from({ length: 10 }, () => logEntry()) as never });
    expect(redis.store.get(rateKey('ingest', PROJECT_A))).toBe('10');
    expect(redis.ttl.get(rateKey('ingest', PROJECT_A))).toBe(120);
  });

  it('a batch that would cross the limit is refused whole and uses no budget (KI-19)', async () => {
    redis.store.set(rateKey('ingest', PROJECT_A), String(60_000 - 5));
    const ten = Array.from({ length: 10 }, () => logEntry()) as never;
    await expect(service.processBatch({ projectId: PROJECT_A, sdkVersion: '1.0.0', logs: ten })).rejects.toThrow('RATE_LIMITED');
    expect(redis.store.get(rateKey('ingest', PROJECT_A))).toBe(String(60_000 - 5));
    await expect(service.processBatch({ projectId: PROJECT_A, sdkVersion: '1.0.0', logs: Array.from({ length: 5 }, () => logEntry()) as never })).resolves.toMatchObject({ received: 5 });
  });

  it('the free tier is cached too, so Postgres is asked once (KI-19)', async () => {
    redis.store.set(`project_owner:${PROJECT_A}`, 'usr_free');
    pg.calls = [];
    for (let i = 0; i < 3; i++) await service.processBatch({ projectId: PROJECT_A, sdkVersion: '1.0.0', logs: [logEntry()] as never });
    expect(pg.calls.filter((c) => c.sql.includes('FROM subscriptions'))).toHaveLength(1);
    expect(redis.store.get('tier:usr_free')).toBe('FREE');
  });

  it('live counters are written in one pipeline, grouped per endpoint (KI-19)', async () => {
    redis.pipeline.mockClear();
    const logs = [logEntry({ endpoint: '/a' }), logEntry({ endpoint: '/a' }), logEntry({ endpoint: '/b', statusCode: 500 })] as never;
    await service.processBatch({ projectId: PROJECT_A, sdkVersion: '1.0.0', logs });
    expect(redis.pipeline).toHaveBeenCalledTimes(1);
    expect(redis.zincrby.mock.calls.filter(([k]) => k === `live:${PROJECT_A}:endpoints`)).toHaveLength(2);
    expect(redis.store.get(`live:${PROJECT_A}:requests`)).toBe('3');
    expect(redis.store.get(`live:${PROJECT_A}:errors`)).toBe('1');
  });

  it('idempotency keys are scoped per project', async () => {
    const a = await service.processBatch({ projectId: PROJECT_A, sdkVersion: '1.0.0', idempotencyKey: 'same-key-123', logs: [logEntry()] as never });
    const b = await service.processBatch({ projectId: PROJECT_B, sdkVersion: '1.0.0', idempotencyKey: 'same-key-123', logs: [logEntry()] as never });
    expect(a.batchId).not.toBe(b.batchId);
    expect(channel.published).toHaveLength(2);
  });

  it('blank idempotency keys are ignored', async () => {
    await service.processBatch({ projectId: PROJECT_A, sdkVersion: '1.0.0', idempotencyKey: '   ', logs: [logEntry()] as never });
    await service.processBatch({ projectId: PROJECT_A, sdkVersion: '1.0.0', idempotencyKey: '   ', logs: [logEntry()] as never });
    expect(channel.published).toHaveLength(2);
  });
});

describe('normalizeRoute (KI-37)', async () => {
  const { normalizeRoute } = await import('@shared/utils/route.utils');
  it.each([
    ['/orders/1042', '/orders/:id'],
    ['/auth/2fa/setup', '/auth/2fa/setup'],
    ['/v2/items', '/v2/items'],
    ['/search?q=shoes#top', '/search'],
    ['/users/9f8e7d6c-1a2b-4c3d-8e9f-0123456789ab/', '/users/:id'],
    ['/docs/507f1f77bcf86cd799439011', '/docs/:id'],
    ['/t/01ARZ3NDEKTSV4RRFFQ69G5FAV', '/t/:id'],
    ['/files/3f2a9c1b8e7d6a5f4e3d', '/files/:id'],
    ['//a///b//', '/a/b'],
    ['https://shop.example/cart/7?x=1', '/cart/:id'],
    ['', '/'],
  ])('%s → %s', (input, expected) => {
    expect(normalizeRoute(input)).toBe(expected);
  });
});
