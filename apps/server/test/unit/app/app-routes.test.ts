import { beforeAll, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import request from 'supertest';
import { FakeChannel, FakePg, FakeRedis, PROJECT_A } from '../../helpers/fakes';
import { knownBug } from '../../helpers/known-bug';

vi.mock('@infrastructure/redis', () => ({ getRedis: () => new FakeRedis() }));
vi.mock('@infrastructure/db/postgres', () => ({ getPg: () => new FakePg() }));
vi.mock('@infrastructure/rabbitmq', async (importOriginal) => ({ ...(await importOriginal<object>()), getChannel: () => new FakeChannel() }));
vi.mock('mongoose', async (orig) => {
  const actual = await orig<typeof import('mongoose')>();
  return { ...actual, default: { ...actual.default, connection: { readyState: 1 } } };
});

const { createApp } = await import('../../../src/app');
const { signAccessToken, signRefreshToken } = await import('@shared/auth/tokens');

const app = createApp();
const user = { id: 'usr_route_test', email: 'r@example.test' };
const access = `Bearer ${signAccessToken(user)}`;
const refresh = `Bearer ${signRefreshToken(user)}`;
const P = PROJECT_A;

type Auth = 'public' | 'jwt' | 'apiKey' | 'rumKey' | 'signature';
const ROUTES: Array<[string, string, Auth]> = [
  ['GET', '/health', 'public'],
  ['GET', '/ready', 'public'],
  ['GET', '/metrics/system', 'public'],
  ['POST', '/api/v1/auth/login', 'public'],
  ['POST', '/api/v1/auth/refresh', 'public'],
  ['POST', '/api/v1/auth/logout', 'public'],
  ['GET', '/api/v1/auth/oauth/google/start', 'public'],
  ['GET', '/api/v1/auth/oauth/google/callback', 'public'],
  ['POST', '/api/v1/auth/keys', 'jwt'],
  ['POST', '/api/v1/auth/rum-keys', 'jwt'],
  ['POST', '/api/v1/users/register', 'public'],
  ['POST', '/api/v1/users/login', 'public'],
  ['POST', '/api/v1/users/logout', 'public'],
  ['GET', '/api/v1/users/me', 'jwt'],
  ['PATCH', '/api/v1/users/me', 'jwt'],
  ['GET', `/api/v1/users/${P}/members`, 'jwt'],
  ['POST', `/api/v1/users/${P}/members`, 'jwt'],
  ['PATCH', `/api/v1/users/${P}/members/usr_x`, 'jwt'],
  ['DELETE', `/api/v1/users/${P}/members/usr_x`, 'jwt'],
  ['GET', '/api/v1/projects', 'jwt'],
  ['POST', '/api/v1/projects', 'jwt'],
  ['GET', '/api/v1/keys', 'jwt'],
  ['GET', '/api/v1/keys/stats', 'jwt'],
  ['POST', '/api/v1/keys', 'jwt'],
  ['DELETE', '/api/v1/keys/1', 'jwt'],
  ['POST', '/api/v1/ingest', 'apiKey'],
  ['POST', '/api/v1/rum', 'rumKey'],
  ['GET', '/api/v1/rum/overview', 'jwt'],
  ['GET', '/api/v1/rum/series', 'jwt'],
  ['GET', '/api/v1/rum/paths', 'jwt'],
  ['GET', '/api/v1/rum/devices', 'jwt'],
  ['GET', '/api/v1/rum/geo', 'jwt'],
  ['GET', '/api/v1/rum/referrers', 'jwt'],
  ['GET', '/api/v1/metrics/overview', 'jwt'],
  ['GET', '/api/v1/metrics/latency', 'jwt'],
  ['GET', '/api/v1/metrics/operations', 'jwt'],
  ['GET', '/api/v1/logs', 'jwt'],
  ['GET', '/api/v1/traces', 'jwt'],
  ['GET', '/api/v1/traces/abc', 'jwt'],
  ['GET', '/api/v1/insights', 'jwt'],
  ['POST', '/api/v1/billing/checkout', 'jwt'],
  ['POST', '/api/v1/billing/webhook/phonepe', 'signature'],
];

const call = (method: string, url: string) => (request(app) as any)[method.toLowerCase()](url);

beforeAll(() => {
  // Unhandled errors in exercised handlers are logged by the error handler; keep output clean.
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('createApp route table', () => {
  it.each(ROUTES)('%s %s is mounted', async (method, url) => {
    const res = await call(method, url).set('authorization', access);
    expect(res.body?.message ?? '').not.toMatch(/^Route .* not found$/);
  });

  it.each(ROUTES.filter(([, , a]) => a === 'jwt'))('%s %s → 401 without a token', async (method, url) => {
    const res = await call(method, url);
    expect(res.status).toBe(401);
  });

  it.each(ROUTES.filter(([, , a]) => a === 'jwt'))('KI-3: %s %s → 401 with a refresh token', async (method, url) => {
    const res = await call(method, url).set('authorization', refresh);
    expect(res.status).toBe(401);
  });

  it.each(ROUTES.filter(([, , a]) => a === 'apiKey' || a === 'rumKey'))('%s %s → 401 without a key, even with a JWT', async (method, url) => {
    const res = await call(method, url).set('authorization', access).send({});
    expect(res.status).toBe(401);
  });

  it('unknown routes → 404 envelope with request id', async () => {
    const res = await request(app).get('/api/v1/nope').set('x-request-id', 'rid-123');
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ error: 'NOT_FOUND', requestId: 'rid-123' });
    expect(res.headers['x-request-id']).toBe('rid-123');
  });

  it('generates a request id when none is sent', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    expect(res.body.meta.requestId).toBe(res.headers['x-request-id']);
  });

  it('applies security headers and the CORS allow-list', async () => {
    const allowed = await request(app).get('/health').set('origin', 'http://localhost:3001');
    expect(allowed.headers['access-control-allow-origin']).toBe('http://localhost:3001');
    expect(allowed.headers['x-content-type-options']).toBe('nosniff');
    const denied = await request(app).get('/health').set('origin', 'https://evil.example');
    expect(denied.headers['access-control-allow-origin']).toBeUndefined();
  });

  knownBug('KI-39', 'POST endpoints without a body answer 4xx, not 500', async () => {
    const statuses: Record<string, number> = {};
    for (const url of ['/api/v1/auth/login', `/api/v1/users/${P}/members`, '/api/v1/billing/webhook/phonepe']) {
      statuses[url] = (await request(app).post(url).set('authorization', access)).status;
    }
    expect(Object.values(statuses).every((s) => s < 500), JSON.stringify(statuses)).toBe(true);
  });

  it('refuses JSON bodies over 2 MB (never reaches the handler)', async () => {
    const res = await request(app).post('/api/v1/users/register').set('content-type', 'application/json').send(`{"email":"${'a'.repeat(2.1 * 1024 * 1024)}"}`);
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.body.error).not.toBe('EMAIL_IN_USE');
  });

  knownBug('KI-39', 'body-parser errors keep their status (413 for > 2 MB)', async () => {
    const res = await request(app).post('/api/v1/users/login').set('content-type', 'application/json').send(`{"x":"${'a'.repeat(2.1 * 1024 * 1024)}"}`);
    expect(res.status).toBe(413);
  });

  knownBug('KI-39', 'malformed JSON is a 400, not a 500', async () => {
    const res = await request(app).post('/api/v1/users/login').set('content-type', 'application/json').send('{"email":');
    expect(res.status).toBe(400);
  });
});

describe('client/server path drift', () => {
  const repoRoot = path.resolve(__dirname, '../../../../..');
  const extractPaths = (file: string) => {
    const src = fs.readFileSync(path.join(repoRoot, file), 'utf8');
    return [...new Set([...src.matchAll(/[`'](\/api\/v1\/[^`'?]*)/g)].map((m) => m[1].replace(/\$\{[^}]+\}/g, 'x1')))];
  };
  const isMounted = async (p: string) => {
    for (const m of ['GET', 'POST', 'PATCH', 'DELETE']) {
      const res = await call(m, p).set('authorization', access);
      if (!/^Route .* not found$/.test(res.body?.message ?? '')) return true;
    }
    return false;
  };

  knownBug('KI-12', 'every path the TypeScript SDK calls exists on the server', async () => {
    const missing = [];
    for (const p of extractPaths('packages/sdk/src/client.ts')) if (!(await isMounted(p))) missing.push(p);
    expect(missing).toEqual([]);
  });

  knownBug('KI-12', 'every path the web app calls exists on the server', async () => {
    const missing = [];
    for (const p of extractPaths('apps/web/shared/api/endpoints.ts')) if (!(await isMounted(p))) missing.push(p);
    expect(missing).toEqual([]);
  });

  it('every Python SDK path exists on the server', async () => {
    const src = fs.readFileSync(path.join(repoRoot, 'packages/python-sdk/src/apexmonitor_sdk/client.py'), 'utf8');
    const paths = [...new Set([...src.matchAll(/f?"(\/api\/v1\/[^"]*)"/g)].map((m) => m[1].replace(/\{[^}]+\}/g, 'x1')))];
    expect(paths.length).toBeGreaterThan(10);
    for (const p of paths) expect(await isMounted(p), p).toBe(true);
  });
});
