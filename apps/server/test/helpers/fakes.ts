import { vi } from 'vitest';
import express, { Express, NextFunction, Request, Response } from 'express';
import { CACHE_UNLESS_REVOKED_LUA } from '../../src/modules/auth/key-cache';

/** In-memory Redis stand-in implementing the subset of ioredis the server uses. */
export class FakeRedis {
  store = new Map<string, string>();
  zsets = new Map<string, Map<string, number>>();
  lists = new Map<string, string[]>();
  hll = new Map<string, Set<string>>();
  ttl = new Map<string, number>();

  get = vi.fn(async (key: string) => this.store.get(key) ?? null);
  getdel = vi.fn(async (key: string) => {
    const v = this.store.get(key) ?? null;
    this.store.delete(key);
    return v;
  });
  set = vi.fn(async (key: string, value: string, ...args: unknown[]) => {
    if (args.includes('NX') && this.store.has(key)) return null;
    this.store.set(key, String(value));
    const exIndex = args.indexOf('EX');
    if (exIndex >= 0) this.ttl.set(key, Number(args[exIndex + 1]));
    return 'OK';
  });
  /** Emulates the Lua scripts the server uses; any other script is a test error. */
  eval = vi.fn(async (script: string, numKeys: number, ...rest: (string | number)[]) => {
    const keys = rest.slice(0, numKeys).map(String);
    const args = rest.slice(numKeys).map(String);
    if (script === CACHE_UNLESS_REVOKED_LUA) {
      const [cache, ref, revoked] = keys;
      const [value, digest, ttl] = args;
      if (this.store.has(revoked)) return 0;
      this.store.set(cache, value);
      this.ttl.set(cache, Number(ttl));
      this.store.set(ref, digest);
      this.ttl.set(ref, Number(ttl));
      return 1;
    }
    throw new Error('FakeRedis.eval: unknown script');
  });
  setex = vi.fn(async (key: string, seconds: number, value: string) => {
    this.store.set(key, String(value));
    this.ttl.set(key, seconds);
    return 'OK';
  });
  del = vi.fn(async (...keys: string[]) => {
    let n = 0;
    for (const k of keys) if (this.store.delete(k) || this.zsets.delete(k) || this.lists.delete(k)) n++;
    return n;
  });
  incr = vi.fn(async (key: string) => {
    const v = Number(this.store.get(key) ?? 0) + 1;
    this.store.set(key, String(v));
    return v;
  });
  incrby = vi.fn(async (key: string, by: number) => {
    const v = Number(this.store.get(key) ?? 0) + by;
    this.store.set(key, String(v));
    return v;
  });
  incrbyfloat = vi.fn(async (key: string, by: number) => {
    const v = Number(this.store.get(key) ?? 0) + by;
    this.store.set(key, String(v));
    return String(v);
  });
  expire = vi.fn(async (key: string, seconds: number) => {
    this.ttl.set(key, seconds);
    return 1;
  });
  zincrby = vi.fn(async (key: string, by: number, member: string) => {
    const z = this.zsets.get(key) ?? new Map<string, number>();
    z.set(member, (z.get(member) ?? 0) + by);
    this.zsets.set(key, z);
    return String(z.get(member));
  });
  zrevrange = vi.fn(async (key: string, start: number, stop: number, withScores?: string) => {
    const entries = [...(this.zsets.get(key) ?? new Map()).entries()].sort((a, b) => b[1] - a[1]).slice(start, stop + 1);
    return withScores ? entries.flatMap(([m, s]) => [m, String(s)]) : entries.map(([m]) => m);
  });
  rpush = vi.fn(async (key: string, ...values: unknown[]) => {
    const l = this.lists.get(key) ?? [];
    l.push(...values.map(String));
    this.lists.set(key, l);
    return l.length;
  });
  ltrim = vi.fn(async (key: string, start: number, stop: number) => {
    const l = this.lists.get(key) ?? [];
    const len = l.length;
    const s = start < 0 ? Math.max(len + start, 0) : start;
    const e = stop < 0 ? len + stop : stop;
    this.lists.set(key, l.slice(s, e + 1));
    return 'OK';
  });
  lrange = vi.fn(async (key: string, start: number, stop: number) => {
    const l = this.lists.get(key) ?? [];
    const e = stop < 0 ? l.length + stop : stop;
    return l.slice(start, e + 1);
  });
  pfadd = vi.fn(async (key: string, ...values: string[]) => {
    const s = this.hll.get(key) ?? new Set<string>();
    const before = s.size;
    values.forEach((v) => s.add(v));
    this.hll.set(key, s);
    return s.size > before ? 1 : 0;
  });
  pfcount = vi.fn(async (key: string) => this.hll.get(key)?.size ?? 0);
  scan = vi.fn(async (_cursor: string, _m: string, pattern: string) => {
    const re = new RegExp(`^${pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`);
    return ['0', [...this.store.keys()].filter((k) => re.test(k))];
  });
  ping = vi.fn(async () => 'PONG');
  mget = vi.fn(async (...keys: string[]) => keys.map((k) => this.store.get(k) ?? null));
}

/** Records SQL calls; respond with queued results or a default. */
export class FakePg {
  calls: Array<{ sql: string; params: unknown[] }> = [];
  private responses: Array<{ match?: RegExp; rows: unknown[] }> = [];

  respond(rows: unknown[], match?: RegExp) {
    this.responses.push({ match, rows });
    return this;
  }

  query = vi.fn(async (sql: string, params: unknown[] = []) => {
    this.calls.push({ sql, params });
    const idx = this.responses.findIndex((r) => !r.match || r.match.test(sql));
    if (idx >= 0) {
      const [r] = this.responses.splice(idx, 1);
      return { rows: r.rows, rowCount: r.rows.length };
    }
    return { rows: [], rowCount: 0 };
  });

  connect = vi.fn(async () => ({ query: this.query, release: vi.fn() }));
}

/** AMQP channel stand-in that records publishes and lets tests deliver messages to consumers. */
export class FakeChannel {
  published: Array<{ exchange: string; routingKey: string; body: unknown; options: Record<string, unknown> }> = [];
  consumers = new Map<string, (msg: { content: Buffer } | null) => Promise<void> | void>();
  acked: unknown[] = [];
  nacked: Array<{ msg: unknown; allUpTo: boolean; requeue: boolean }> = [];

  publish = vi.fn((exchange: string, routingKey: string, content: Buffer, options: Record<string, unknown> = {}) => {
    this.published.push({ exchange, routingKey, body: JSON.parse(content.toString()), options });
    return true;
  });
  prefetch = vi.fn(async () => undefined);
  consume = vi.fn(async (queue: string, handler: (msg: { content: Buffer } | null) => Promise<void> | void) => {
    this.consumers.set(queue, handler);
    return { consumerTag: queue };
  });
  ack = vi.fn((msg: unknown) => { this.acked.push(msg); });
  nack = vi.fn((msg: unknown, allUpTo = false, requeue = true) => { this.nacked.push({ msg, allUpTo, requeue }); });
  checkQueue = vi.fn(async (queue: string) => ({ queue, messageCount: 0, consumerCount: 1 }));
  assertExchange = vi.fn(async () => ({}));
  assertQueue = vi.fn(async () => ({}));
  bindQueue = vi.fn(async () => ({}));

  async deliver(queue: string, body: unknown) {
    const handler = this.consumers.get(queue);
    if (!handler) throw new Error(`no consumer for ${queue}`);
    const msg = { content: Buffer.from(typeof body === 'string' ? body : JSON.stringify(body)) };
    await handler(msg);
    return msg;
  }
}

/**
 * Stand-ins for the publish/consume API of `@infrastructure/rabbitmq`, backed by a FakeChannel.
 * Use in a module mock: `vi.mock('@infrastructure/rabbitmq', async (orig) => ({ ...(await orig()), ...fakeRabbit(channel) }))`.
 */
export function fakeRabbit(channel: FakeChannel) {
  return {
    getChannel: () => channel,
    publish: vi.fn(async (exchange: string, routingKey: string, content: Buffer, options: Record<string, unknown> = {}) => {
      channel.publish(exchange, routingKey, content, { persistent: true, ...options });
    }),
    consume: vi.fn(async (queue: string, prefetch: number, handler: (msg: any, ch: FakeChannel) => Promise<void>) => {
      await channel.prefetch(prefetch);
      await channel.consume(queue, (msg) => (msg ? handler(msg, channel) : undefined));
    }),
  };
}

/** Minimal express app around a handler, with the same request-id + error handling as the real app. */
export async function appWith(
  mount: (app: Express) => void,
): Promise<Express> {
  const { errorHandler, notFoundHandler } = await import('@shared/middleware/error-handler');
  const app = express();
  app.use(express.json());
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader('x-request-id', 'test-request-id');
    next();
  });
  mount(app);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

export const PROJECT_A = 'proj_aaaaaaaaaaaaaaaaaaaaaaaa';
export const PROJECT_B = 'proj_bbbbbbbbbbbbbbbbbbbbbbbb';

export function project(id: string, role = 'owner', plan = 'free') {
  return {
    id,
    name: id,
    ownerUserId: 'usr_owner',
    role,
    plan,
    rateLimitRpm: 60000,
    logRetentionDays: 90,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function logEntry(overrides: Record<string, unknown> = {}) {
  return {
    method: 'GET',
    endpoint: '/users/42',
    statusCode: 200,
    latencyMs: 25,
    ip: '203.0.113.7',
    userAgent: 'vitest',
    timestamp: new Date().toISOString(),
    tags: [],
    ...overrides,
  };
}
