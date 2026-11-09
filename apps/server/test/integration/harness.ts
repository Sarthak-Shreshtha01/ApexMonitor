import http from 'node:http';
import { AddressInfo } from 'node:net';
import crypto from 'node:crypto';

/**
 * Boots the real server (all infrastructure, workers, HTTP app and websocket) once per
 * test run, mirroring src/bootstrap.ts, on an ephemeral port.
 */
interface Stack {
  baseUrl: string;
  server: http.Server;
}

let stackPromise: Promise<Stack> | undefined;

export function getStack(): Promise<Stack> {
  stackPromise ??= (async () => {
    const { connectMongo } = await import('@infrastructure/db/mongo');
    const { connectPostgres } = await import('@infrastructure/db/postgres');
    const { connectRedis } = await import('@infrastructure/redis');
    const { connectRabbitMQ } = await import('@infrastructure/rabbitmq');
    await Promise.all([connectMongo(), connectPostgres(), connectRedis(), connectRabbitMQ()]);

    const { RawLogWorker } = await import('@workers/raw-log.worker');
    const { AggregationWorker } = await import('@workers/aggregation.worker');
    const { AnomalyWorker } = await import('@workers/anomaly.worker');
    const { RumWorker } = await import('@workers/rum.worker');
    await Promise.all([new RawLogWorker().start(), new AggregationWorker().start(), new AnomalyWorker().start(), new RumWorker().start()]);

    const { createApp } = await import('../../src/app');
    const { WebSocketService } = await import('@modules/websocket');
    const server = http.createServer(createApp());
    new WebSocketService(server);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    return { baseUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, server };
  })();
  return stackPromise;
}

export interface ApiResponse<T = any> {
  status: number;
  body: T;
  headers: Headers;
}

export async function api<T = any>(
  method: string,
  path: string,
  opts: { token?: string; apiKey?: string; rumKey?: string; body?: unknown; headers?: Record<string, string>; raw?: string } = {},
): Promise<ApiResponse<T>> {
  const { baseUrl } = await getStack();
  const headers: Record<string, string> = { ...(opts.headers ?? {}) };
  if (opts.body !== undefined || opts.raw !== undefined) headers['content-type'] ??= 'application/json';
  if (opts.token) headers.authorization = `Bearer ${opts.token}`;
  if (opts.apiKey) headers['x-api-key'] = opts.apiKey;
  if (opts.rumKey) headers['x-rum-key'] = opts.rumKey;
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: opts.raw ?? (opts.body === undefined ? undefined : JSON.stringify(opts.body)),
    redirect: 'manual',
  });
  const text = await res.text();
  let body: any = text;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    /* non-JSON body */
  }
  return { status: res.status, body, headers: res.headers };
}

export interface Tenant {
  email: string;
  password: string;
  userId: string;
  accessToken: string;
  refreshToken: string;
  projectId: string;
}

export async function registerTenant(tag = 'user'): Promise<Tenant> {
  const email = `${tag}-${crypto.randomUUID()}@example.test`;
  const password = 'correct-horse-battery';
  const reg = await api('POST', '/api/v1/users/register', { body: { email, password, name: `Test ${tag}` } });
  if (reg.status !== 201) throw new Error(`register failed: ${reg.status} ${JSON.stringify(reg.body)}`);
  const { accessToken, refreshToken, user } = reg.body;
  const projects = await api('GET', '/api/v1/projects', { token: accessToken });
  return { email, password, userId: user.id, accessToken, refreshToken, projectId: projects.body.data.projects[0].id };
}

export async function createIngestKey(t: Tenant, label = 'test'): Promise<{ key: string; keyId: number }> {
  const res = await api('POST', '/api/v1/keys', { token: t.accessToken, body: { projectId: t.projectId, label } });
  if (res.status !== 201) throw new Error(`create key failed: ${res.status} ${JSON.stringify(res.body)}`);
  return { key: res.body.data.plaintextKey, keyId: res.body.data.keyId };
}

export async function createRumKey(t: Tenant, allowedOrigins: string[] = []): Promise<string> {
  const res = await api('POST', '/api/v1/auth/rum-keys', { token: t.accessToken, body: { projectId: t.projectId, label: 'web', allowedOrigins } });
  if (res.status !== 201) throw new Error(`create rum key failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.data.key;
}

export function logEntry(overrides: Record<string, unknown> = {}) {
  return {
    method: 'GET',
    endpoint: '/api/items/42',
    statusCode: 200,
    latencyMs: 20,
    ip: '203.0.113.5',
    userAgent: 'integration',
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

/** Polls until `check` returns a truthy value (workers are asynchronous). */
export async function waitFor<T>(check: () => Promise<T>, { timeoutMs = 15_000, intervalMs = 150, label = 'condition' } = {}): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  let last: T | undefined;
  while (Date.now() < deadline) {
    last = await check();
    if (last) return last;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`Timed out waiting for ${label} (last value: ${JSON.stringify(last)})`);
}

export async function pgQuery<T = any>(sql: string, params: unknown[] = []): Promise<T[]> {
  const { getPg } = await import('@infrastructure/db/postgres');
  return (await getPg().query(sql, params)).rows as T[];
}

export async function mongoCount(collection: string, filter: Record<string, unknown>): Promise<number> {
  const mongoose = (await import('mongoose')).default;
  return mongoose.connection.db!.collection(collection).countDocuments(filter);
}

export async function redisClient() {
  const { getRedis } = await import('@infrastructure/redis');
  return getRedis();
}
