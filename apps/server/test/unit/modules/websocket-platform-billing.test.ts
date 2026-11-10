import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import http from 'http';
import { AddressInfo } from 'net';
import crypto from 'crypto';
import request from 'supertest';
import { io as ioClient, Socket } from 'socket.io-client';
import { appWith, FakeChannel, FakePg, FakeRedis, PROJECT_A, PROJECT_B, project } from '../../helpers/fakes';
import { knownBug } from '../../helpers/known-bug';

const redis = new FakeRedis();
const pg = new FakePg();
const channel = new FakeChannel();
vi.mock('@infrastructure/redis', () => ({ getRedis: () => redis }));
vi.mock('@infrastructure/db/postgres', () => ({ getPg: () => pg }));
vi.mock('@infrastructure/rabbitmq', async (importOriginal) => ({ ...(await importOriginal<object>()), getChannel: () => channel }));

const listProjects = vi.fn(async () => [project(PROJECT_A)]);
vi.mock('@modules/users/user.service', () => ({ UserService: class { listProjects = listProjects; } }));

let mongoState = 1;
vi.mock('mongoose', () => ({ default: { connection: { get readyState() { return mongoState; } } } }));

const { WebSocketService } = await import('@modules/websocket');
const { eventBus } = await import('@events/event-bus');
const { signAccessToken, signRefreshToken } = await import('@shared/auth/tokens');
const { PlatformController } = await import('@shared/http/platform-controller');
const { billingRouter } = await import('@modules/billing/billing.router');
const { BillingService } = await import('@modules/billing/billing.service');
const { PhonePeUtils } = await import('@shared/utils/phonepe.utils');

const user = { id: 'usr_1', email: 'u@example.test' };

describe('WebSocketService', () => {
  let server: http.Server;
  let url: string;
  const sockets: Socket[] = [];

  beforeAll(async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    server = http.createServer();
    new WebSocketService(server);
    await new Promise<void>((r) => server.listen(0, r));
    url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(async () => {
    sockets.forEach((s) => s.close());
    await new Promise((r) => server.close(r));
  });

  function join(token: string | undefined, projectId: string): Promise<{ event: string; payload: any; socket: Socket }> {
    const socket = ioClient(url, { transports: ['websocket'], reconnection: false, forceNew: true });
    sockets.push(socket);
    return new Promise((resolve) => {
      socket.on('connect', () => socket.emit('join', { projectId, token }));
      socket.on('join:ok', (payload) => resolve({ event: 'join:ok', payload, socket }));
      socket.on('join:error', (payload) => resolve({ event: 'join:error', payload, socket }));
    });
  }

  it('lets members join with an access token', async () => {
    const r = await join(signAccessToken(user), PROJECT_A);
    expect(r.event).toBe('join:ok');
    expect(r.payload).toEqual({ projectId: PROJECT_A, userId: user.id });
  });

  it('KI-3: rejects refresh tokens', async () => {
    const r = await join(signRefreshToken(user), PROJECT_A);
    expect(r).toMatchObject({ event: 'join:error', payload: { message: 'Unauthorized websocket join' } });
  });

  it('rejects missing/garbage tokens and non-member projects', async () => {
    expect((await join(undefined, PROJECT_A)).event).toBe('join:error');
    expect((await join('garbage', PROJECT_A)).event).toBe('join:error');
    expect((await join(signAccessToken(user), PROJECT_B)).payload.message).toBe('No access to this project');
  });

  it('broadcasts pulse:live every 2s from Redis counters plus the latest insight', async () => {
    redis.store.set(`live:${PROJECT_A}:requests`, '10');
    redis.store.set(`live:${PROJECT_A}:errors`, '2');
    redis.store.set(`live:${PROJECT_A}:latency_total`, '500');
    redis.zsets.set(`live:${PROJECT_A}:endpoints`, new Map([['GET /a', 7], ['POST /b', 3], ['GET /c', 1], ['GET /d', 0]]));
    eventBus.emit('anomaly.detected', { projectId: PROJECT_A, endpoint: '/a', type: 'latency_spike', meta: { message: 'spike' } });
    const { socket } = await join(signAccessToken(user), PROJECT_A);
    const pulse: any = await new Promise((r) => socket.once('pulse:live', r));
    expect(pulse).toMatchObject({ type: 'pulse:live', projectId: PROJECT_A });
    expect(pulse.data).toMatchObject({ rps: 2, errorRate: 20, activeAlerts: 0 });
    expect(pulse.data.topEndpoints).toEqual([
      { endpoint: 'GET /a', rps: 1.4, p99: 50 },
      { endpoint: 'POST /b', rps: 0.6, p99: 50 },
      { endpoint: 'GET /c', rps: 0.2, p99: 50 },
    ]);
    expect(pulse.data.latestInsight).toMatchObject({ type: 'latency_spike', endpoint: '/a', message: 'spike' });
  }, 10_000);
});

describe('PlatformController', () => {
  const controller = new PlatformController();
  const app = appWith((a) => {
    a.get('/health', controller.health);
    a.get('/ready', controller.ready);
    a.get('/metrics/system', controller.metrics);
  });
  beforeEach(() => { mongoState = 1; });

  it('/health is always 200', async () => {
    const res = await request(await app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('ok');
  });

  it('/ready is 200 when all services are up and reports queue depth', async () => {
    const res = await request(await app).get('/ready');
    expect(res.status).toBe(200);
    expect(res.body.data.ready).toBe(true);
    expect(res.body.data.snapshot.queues.map((q: any) => q.queue)).toEqual([
      'raw_log_queue', 'aggregation_queue', 'anomaly_queue', 'rum_queue',
      'raw_log_dlq', 'aggregation_dlq', 'anomaly_dlq', 'rum_dlq',
    ]);
  });

  it('/ready is 503 when a dependency is down', async () => {
    mongoState = 0;
    expect((await request(await app).get('/ready')).status).toBe(503);
    mongoState = 1;
    redis.ping.mockRejectedValueOnce(new Error('down'));
    const res = await request(await app).get('/ready');
    expect(res.status).toBe(503);
    expect(res.body.data.snapshot.services.redis).toBe('down');
    pg.connect.mockRejectedValueOnce(new Error('down'));
    expect((await request(await app).get('/ready')).body.data.snapshot.services.postgres).toBe('down');
  });

  it('/metrics/system reports zeros for queues that cannot be inspected', async () => {
    channel.checkQueue.mockRejectedValueOnce(new Error('404'));
    const res = await request(await app).get('/metrics/system');
    expect(res.status).toBe(200);
    expect(res.body.data.queues[0]).toEqual({ queue: 'raw_log_queue', messageCount: 0, consumerCount: 0 });
    expect(typeof res.body.data.uptimeSeconds).toBe('number');
  });
});

describe('billing', () => {
  const SALT = '099eb0cd-02cf-4e2a-8aca-3e6c6aff0399';
  const sign = (b64: string) => `${crypto.createHash('sha256').update(b64 + SALT).digest('hex')}###1`;
  const app = appWith((a) => a.use('/billing', billingRouter));

  it('checkout requires auth', async () => {
    expect((await request(await app).post('/billing/checkout')).status).toBe(401);
  });

  it('generateCheckoutPayload signs the payload with the X-VERIFY checksum', () => {
    const { base64Payload, checksum, url } = PhonePeUtils.generateCheckoutPayload('TX_1_ab', 'usr_abc', 299900, 'http://x');
    const payload = JSON.parse(Buffer.from(base64Payload, 'base64').toString());
    expect(payload).toMatchObject({ merchantTransactionId: 'TX_1_ab', amount: 299900, redirectUrl: 'http://x', paymentInstrument: { type: 'PAY_PAGE' } });
    expect(checksum).toBe(`${crypto.createHash('sha256').update(`${base64Payload}/pg/v1/pay${SALT}`).digest('hex')}###1`);
    expect(url).toContain('phonepe.com');
  });

  it('verifyWebhookSignature accepts valid and rejects tampered signatures', () => {
    const b64 = Buffer.from('{"a":1}').toString('base64');
    expect(PhonePeUtils.verifyWebhookSignature(b64, sign(b64))).toBe(true);
    expect(PhonePeUtils.verifyWebhookSignature(b64, sign(`${b64}x`))).toBe(false);
  });

  it('webhook: 400 without signature/payload', async () => {
    expect((await request(await app).post('/billing/webhook/phonepe').send({})).status).toBe(400);
  });

  const send = async (payload: unknown) => {
    const b64 = Buffer.from(JSON.stringify(payload)).toString('base64');
    return request(await app).post('/billing/webhook/phonepe').set('x-verify', sign(b64)).send({ response: b64 });
  };

  it('webhook: PAYMENT_SUCCESS upgrades the user recorded for that transaction and clears the tier cache (KI-36)', async () => {
    pg.calls = [];
    const realUserId = `usr_${'a'.repeat(32)}`; // 36 chars, as generated by the users module
    redis.store.set(`tier:${realUserId}`, 'FREE');
    pg.respond([{ user_id: realUserId }], /WITH done AS/);
    const res = await send({ code: 'PAYMENT_SUCCESS', data: { merchantTransactionId: 'TX1', amount: 299900 } });
    expect(res.status).toBe(200);
    const upgrade = pg.calls.find((c) => c.sql.includes('INSERT INTO subscriptions'))!;
    expect(upgrade.sql).toContain("WHERE merchant_transaction_id = $1 AND status = 'PENDING' AND amount_paise = $3");
    expect(upgrade.params).toEqual(['TX1', 'PAYMENT_SUCCESS', 299900]);
    expect(redis.store.has(`tier:${realUserId}`)).toBe(false);
  });

  it('webhook: an unknown, replayed or wrong-amount transaction changes no cache and still answers 200', async () => {
    redis.store.set('tier:usr_someone', 'FREE');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const res = await send({ code: 'PAYMENT_SUCCESS', data: { merchantTransactionId: 'TX_unknown', amount: 1 } });
    expect(res.status).toBe(200);
    expect(redis.store.get('tier:usr_someone')).toBe('FREE');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('TX_unknown'));
  });

  it('webhook: never trusts a user id sent by the gateway', async () => {
    pg.calls = [];
    await send({ code: 'PAYMENT_SUCCESS', data: { merchantTransactionId: 'TX2', merchantUserId: 'usr_attacker', amount: 299900 } });
    expect(pg.calls.flatMap((c) => c.params)).not.toContain('usr_attacker');
  });

  it('webhook: failure codes mark the pending checkout FAILED; PAYMENT_PENDING and missing ids change nothing', async () => {
    pg.calls = [];
    await send({ code: 'PAYMENT_ERROR', data: { merchantTransactionId: 'TX3' } });
    expect(pg.calls).toHaveLength(1);
    expect(pg.calls[0].sql).toContain("SET status = $2");
    expect(pg.calls[0].params).toEqual(['TX3', 'FAILED', 'PAYMENT_ERROR']);
    pg.calls = [];
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await send({ code: 'PAYMENT_PENDING', data: { merchantTransactionId: 'TX4' } });
    await send({ code: 'PAYMENT_ERROR', data: {} });
    expect(pg.calls).toHaveLength(0);
  });

  knownBug('KI-7', 'webhook with an invalid signature is a 4xx, not a 500', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const b64 = Buffer.from('{}').toString('base64');
    const res = await request(await app).post('/billing/webhook/phonepe').set('x-verify', 'bad###1').send({ response: b64 });
    expect(res.status).toBeLessThan(500);
  });

  it('checkout ids fit PhonePe limits and the gateway never sees the raw user id (KI-36)', () => {
    const userId = `usr_${'a'.repeat(32)}`;
    const tx = PhonePeUtils.newMerchantTransactionId();
    expect(tx.length).toBeLessThanOrEqual(38);
    expect(PhonePeUtils.newMerchantTransactionId()).not.toBe(tx);
    const { base64Payload } = PhonePeUtils.generateCheckoutPayload(tx, userId, 1, 'http://x');
    const payload = JSON.parse(Buffer.from(base64Payload, 'base64').toString());
    expect(payload.merchantUserId.length).toBeLessThanOrEqual(34);
    expect(payload.merchantUserId).toBe(PhonePeUtils.merchantUserIdFor(userId)); // stable per user
    expect(base64Payload).not.toContain(Buffer.from(userId).toString('base64').slice(0, 20));
    expect(JSON.stringify(payload)).not.toContain(userId);
  });

  it('createCheckoutSession returns the PhonePe redirect URL or throws', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true, data: { instrumentResponse: { redirectInfo: { url: 'https://pay/x' } } } })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: false, message: 'nope' })));
    vi.stubGlobal('fetch', fetchMock);
    const service = new BillingService();
    pg.calls = [];
    await expect(service.createCheckoutSession('usr_1')).resolves.toBe('https://pay/x');
    const insert = pg.calls.find((c) => c.sql.includes('INSERT INTO billing_checkouts'))!;
    const [txId, userId, tier, amount] = insert.params as [string, string, string, number];
    expect([userId, tier, amount]).toEqual(['usr_1', 'PRO', 299900]);
    // the transaction id sent to PhonePe is the one we recorded
    const sent = JSON.parse(Buffer.from(JSON.parse(fetchMock.mock.calls[0][1].body).request, 'base64').toString());
    expect(sent.merchantTransactionId).toBe(txId);

    await expect(service.createCheckoutSession('usr_1')).rejects.toThrow('PhonePe Checkout Failed: nope');
    expect(pg.calls.at(-1)!.params).toEqual([expect.stringMatching(/^TX_/), 'FAILED', 'CHECKOUT_REJECTED']);
    vi.unstubAllGlobals();
  });
});
