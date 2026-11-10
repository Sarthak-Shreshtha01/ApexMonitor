import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { appWith, FakeRedis, PROJECT_A, PROJECT_B, project } from '../../helpers/fakes';

const redis = new FakeRedis();
vi.mock('@infrastructure/redis', () => ({ getRedis: () => redis }));
vi.mock('@infrastructure/db/postgres', () => ({ getPg: () => ({ query: vi.fn(async () => ({ rows: [] })) }) }));

const listProjects = vi.fn();
vi.mock('@modules/users/user.service', () => ({
  UserService: class {
    listProjects = listProjects;
    createProject = vi.fn(async (_u: string, name: string) => ({ ...project('proj_new0000000000000000000'), name }));
  },
}));

const metricsRepo = { getOverview: vi.fn(async () => ({ totalRequests: 5 })), getLatencyBreakdown: vi.fn(async () => ({ rows: [] })), getOperations: vi.fn(async () => ({ ops: [] })) };
vi.mock('@modules/metrics/metrics.repository', () => ({ MetricsRepository: class { constructor() { return metricsRepo; } } }));
const logsRepo = { list: vi.fn(async () => ({ logs: [], total: 0, summary: { total: 0, errorRate: 0, avgLatency: 0 } })) };
vi.mock('@modules/logs/logs.repository', () => ({ LogsRepository: class { constructor() { return logsRepo; } } }));
const tracesRepo = { list: vi.fn(async () => ({ traces: [], total: 0 })), getByTraceId: vi.fn() };
vi.mock('@modules/traces/traces.repository', () => ({ TracesRepository: class { constructor() { return tracesRepo; } } }));
const insightsRepo = { listRecent: vi.fn(async () => [{ id: 1 }]), createInsight: vi.fn() };
vi.mock('@modules/insights/insights.repository', () => ({ InsightsRepository: class { constructor() { return insightsRepo; } } }));
const keysRepo = {
  listByProjectIds: vi.fn(async () => [{ id: 1 }]),
  getStats: vi.fn(async () => ({ totalKeys: 1, staleKeys: 0 })),
  insertKey: vi.fn(async () => 99),
  revokeKey: vi.fn(async () => true),
};
vi.mock('@modules/keys/keys.repository', () => ({ KeysRepository: class { constructor() { return keysRepo; } } }));
vi.mock('@shared/services/audit-log.service', () => ({ auditLogService: { recordSafe: vi.fn(async () => undefined) } }));
vi.mock('argon2', () => ({ default: { hash: vi.fn(async (v: string) => `hash(${v.length})`), argon2id: 2 } }));

const { metricsRouter } = await import('@modules/metrics/metrics.router');
const { logsRouter } = await import('@modules/logs/logs.router');
const { tracesRouter } = await import('@modules/traces/traces.router');
const { insightsRouter } = await import('@modules/insights/insights.router');
const { keysRouter } = await import('@modules/keys/keys.router');
const { projectsRouter } = await import('@modules/projects/projects.router');
const { MetricsService } = await import('@modules/metrics/metrics.service');
const { KeysService } = await import('@modules/keys/keys.service');
const { eventBus } = await import('@events/event-bus');
const { signAccessToken } = await import('@shared/auth/tokens');

const app = appWith((a) => {
  a.use('/metrics', metricsRouter);
  a.use('/logs', logsRouter);
  a.use('/traces', tracesRouter);
  a.use('/insights', insightsRouter);
  a.use('/keys', keysRouter);
  a.use('/projects', projectsRouter);
});
const auth = { authorization: `Bearer ${signAccessToken({ id: 'usr_1', email: 'u@example.test' })}` };

beforeEach(() => {
  redis.store.clear();
  listProjects.mockResolvedValue([project(PROJECT_A, 'owner'), project('proj_dddddddddddddddddddddddd', 'developer', 'pro')]);
});

describe.each([
  ['/metrics/overview'],
  ['/metrics/latency'],
  ['/metrics/operations'],
  ['/logs'],
  ['/traces'],
  ['/insights'],
])('GET %s', (path) => {
  it('401 without a token', async () => {
    expect((await request(await app).get(`${path}?projectId=${PROJECT_A}`)).status).toBe(401);
  });

  it('400 without projectId', async () => {
    expect((await request(await app).get(path).set(auth)).status).toBe(400);
  });

  it('403 for a project the user is not a member of', async () => {
    const res = await request(await app).get(`${path}?projectId=${PROJECT_B}`).set(auth);
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('FORBIDDEN');
  });

  it('200 with the success envelope for members', async () => {
    const res = await request(await app).get(`${path}?projectId=${PROJECT_A}`).set(auth);
    expect(res.status).toBe(200);
    expect(res.body.meta.requestId).toBe('test-request-id');
  });
});

describe('metrics caching', () => {
  it('serves from Redis on the second call and invalidates on aggregation.completed', async () => {
    await request(await app).get(`/metrics/overview?projectId=${PROJECT_A}`).set(auth);
    await request(await app).get(`/metrics/overview?projectId=${PROJECT_A}`).set(auth);
    expect(metricsRepo.getOverview).toHaveBeenCalledTimes(1);
    expect(redis.ttl.get(`metrics:${PROJECT_A}:overview:24h`)).toBe(30);

    await new MetricsService().invalidateCache(PROJECT_A);
    expect(redis.store.has(`metrics:${PROJECT_A}:overview:24h`)).toBe(false);

    redis.store.set(`metrics:${PROJECT_A}:latency:24h:all:1`, '{}');
    redis.store.set(`metrics:${PROJECT_B}:latency:24h:all:1`, '{}');
    eventBus.emit('aggregation.completed', { projectIds: [PROJECT_A] });
    await new Promise((r) => setTimeout(r, 10));
    expect(redis.store.has(`metrics:${PROJECT_A}:latency:24h:all:1`)).toBe(false);
    expect(redis.store.has(`metrics:${PROJECT_B}:latency:24h:all:1`)).toBe(true);
  });

  it('latency cache key includes endpoint and page; operations TTL is 15s', async () => {
    await request(await app).get(`/metrics/latency?projectId=${PROJECT_A}&endpoint=/x&page=2`).set(auth);
    expect(redis.store.has(`metrics:${PROJECT_A}:latency:24h:/x:2`)).toBe(true);
    await request(await app).get(`/metrics/operations?projectId=${PROJECT_A}&timeframe=7d`).set(auth);
    expect(redis.ttl.get(`metrics:${PROJECT_A}:operations:7d`)).toBe(15);
  });
});

describe('logs/traces/insights responses', () => {
  it('logs and traces echo pagination', async () => {
    const logs = await request(await app).get(`/logs?projectId=${PROJECT_A}&page=2&limit=5`).set(auth);
    expect(logs.body.data).toMatchObject({ page: 2, limit: 5, total: 0 });
    const traces = await request(await app).get(`/traces?projectId=${PROJECT_A}`).set(auth);
    expect(traces.body.data).toMatchObject({ page: 1, limit: 20 });
  });

  it('trace detail: 404 when missing, 200 when found, 403 for other tenants', async () => {
    tracesRepo.getByTraceId.mockResolvedValueOnce(null);
    expect((await request(await app).get(`/traces/t1?projectId=${PROJECT_A}`).set(auth)).status).toBe(404);
    tracesRepo.getByTraceId.mockResolvedValueOnce({ traceId: 't1' });
    const ok = await request(await app).get(`/traces/t1?projectId=${PROJECT_A}`).set(auth);
    expect(ok.body.data.trace).toEqual({ traceId: 't1' });
    expect(tracesRepo.getByTraceId).toHaveBeenLastCalledWith(PROJECT_A, 't1');
    expect((await request(await app).get(`/traces/t1?projectId=${PROJECT_B}`).set(auth)).status).toBe(403);
  });

  it('insights include the project id', async () => {
    const res = await request(await app).get(`/insights?projectId=${PROJECT_A}&limit=3`).set(auth);
    expect(res.body.data).toEqual({ projectId: PROJECT_A, insights: [{ id: 1 }] });
    expect(insightsRepo.listRecent).toHaveBeenCalledWith(PROJECT_A, 3);
  });
});

describe('keys routes', () => {
  it('list/stats scope to the user projects; 403 for foreign project filters', async () => {
    await request(await app).get('/keys').set(auth);
    expect(keysRepo.listByProjectIds).toHaveBeenLastCalledWith([PROJECT_A, 'proj_dddddddddddddddddddddddd']);
    expect((await request(await app).get(`/keys?projectId=${PROJECT_B}`).set(auth)).status).toBe(403);
    const stats = await request(await app).get(`/keys/stats?projectId=${PROJECT_A}`).set(auth);
    expect(stats.body.data).toMatchObject({ timeframe: '24h', projectScopeCount: 1, criticalProjects: 0 });
    const all = await request(await app).get('/keys/stats').set(auth);
    expect(all.body.data.criticalProjects).toBe(1);
    expect((await request(await app).get(`/keys/stats?projectId=${PROJECT_B}`).set(auth)).status).toBe(403);
  });

  it('403 for users with no projects', async () => {
    listProjects.mockResolvedValue([]);
    expect((await request(await app).get('/keys').set(auth)).status).toBe(403);
  });

  it('create requires owner (developer → 403, non-member → 403) and returns the key once', async () => {
    expect((await request(await app).post('/keys').set(auth).send({ projectId: 'proj_dddddddddddddddddddddddd', label: 'x' })).status).toBe(403);
    expect((await request(await app).post('/keys').set(auth).send({ projectId: PROJECT_B, label: 'x' })).status).toBe(403);
    const res = await request(await app).post('/keys').set(auth).send({ projectId: PROJECT_A, label: 'ci' });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ keyId: 99, projectId: PROJECT_A, label: 'ci' });
    expect(res.body.data.plaintextKey).toMatch(/^pk_live_/);
    expect(keysRepo.insertKey.mock.calls.at(-1)![0].keyHash).not.toContain(res.body.data.plaintextKey);
  });

  it('create validates the label', async () => {
    expect((await request(await app).post('/keys').set(auth).send({ projectId: PROJECT_A })).status).toBe(400);
  });

  it('revoke: owner only, 404 when nothing was revoked', async () => {
    const ok = await request(await app).delete(`/keys/5?projectId=${PROJECT_A}`).set(auth);
    expect(ok.status).toBeLessThan(300);
    expect(keysRepo.revokeKey).toHaveBeenLastCalledWith(PROJECT_A, 5);
    expect(redis.store.get('api_key:revoked:5')).toBe('1'); // cache eviction tombstone (KI-5)
    keysRepo.revokeKey.mockResolvedValueOnce(false);
    expect((await request(await app).delete(`/keys/6?projectId=${PROJECT_A}`).set(auth)).status).toBe(404);
    expect((await request(await app).delete('/keys/5?projectId=proj_dddddddddddddddddddddddd').set(auth)).status).toBe(403);
    expect((await request(await app).delete('/keys/5').set(auth)).status).toBe(400);
  });

  it('every created key gets a unique lookup hash, even when display prefixes collide (KI-26)', async () => {
    const { keyLookupHash } = await import('@modules/auth/key-material');
    const service = new KeysService();
    const prefixes = new Set<string>();
    const lookups = new Set<string>();
    keysRepo.insertKey.mockClear();
    for (let i = 0; i < 500; i++) {
      const created = await service.create('usr_1', { projectId: PROJECT_A, label: `k${i}` });
      prefixes.add(created.keyPrefix);
      const stored = keysRepo.insertKey.mock.calls.at(-1)![0];
      expect(stored.keyLookup).toBe(keyLookupHash(created.plaintextKey));
      lookups.add(stored.keyLookup);
    }
    expect(lookups.size).toBe(500);
    // The 10-char display prefix is still collision-prone; it is no longer used to find keys.
    expect(prefixes.size).toBeLessThan(500);
  });
});

describe('projects routes', () => {
  it('lists and creates projects', async () => {
    expect((await request(await app).get('/projects')).status).toBe(401);
    const list = await request(await app).get('/projects').set(auth);
    expect(list.body.data.projects).toHaveLength(2);
    const created = await request(await app).post('/projects').set(auth).send({ name: '  Shop ' });
    expect(created.status).toBe(201);
    expect(created.body.data.project.name).toBe('Shop');
    expect((await request(await app).post('/projects').set(auth).send({ name: 'x' })).status).toBe(400);
  });
});
