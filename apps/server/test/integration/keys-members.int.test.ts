import { beforeAll, describe, expect, it } from 'vitest';
import { api, createIngestKey, logEntry, pgQuery, redisClient, registerTenant, Tenant } from './harness';

describe('API keys (real stack)', () => {
  let owner: Tenant;
  beforeAll(async () => {
    owner = await registerTenant('keys');
  });

  it('created keys are stored hashed with a prefix, listed, counted and usable', async () => {
    const { key, keyId } = await createIngestKey(owner, 'ci');
    const [row] = await pgQuery('SELECT key_prefix, key_hash, label, revoked_at FROM api_keys WHERE id = $1', [keyId]);
    expect(row).toMatchObject({ key_prefix: key.slice(0, 10), label: 'ci', revoked_at: null });
    expect(row.key_hash).toMatch(/^\$argon2id\$/);
    expect(row.key_hash).not.toContain(key);

    const list = await api('GET', `/api/v1/keys?projectId=${owner.projectId}`, { token: owner.accessToken });
    expect(list.body.data.keys.map((k: any) => k.id)).toContain(keyId);
    expect(JSON.stringify(list.body)).not.toContain(key);

    const stats = await api('GET', `/api/v1/keys/stats?projectId=${owner.projectId}`, { token: owner.accessToken });
    expect(stats.body.data.totalKeys).toBeGreaterThanOrEqual(1);

    expect((await api('POST', '/api/v1/ingest', { apiKey: key, body: { logs: [logEntry()] } })).status).toBe(202);
    const [used] = await pgQuery('SELECT last_used_at FROM api_keys WHERE id = $1', [keyId]);
    expect(used.last_used_at).not.toBeNull();
  });

  it('a never-used key stops working immediately after revocation', async () => {
    const { key, keyId } = await createIngestKey(owner, 'revoke-me');
    const revoke = await api('DELETE', `/api/v1/keys/${keyId}?projectId=${owner.projectId}`, { token: owner.accessToken });
    expect(revoke.status).toBe(204);
    expect((await api('POST', '/api/v1/ingest', { apiKey: key, body: { logs: [logEntry()] } })).status).toBe(401);
    expect((await api('DELETE', `/api/v1/keys/${keyId}?projectId=${owner.projectId}`, { token: owner.accessToken })).status).toBe(404);
    const list = await api('GET', `/api/v1/keys?projectId=${owner.projectId}`, { token: owner.accessToken });
    expect(list.body.data.keys.map((k: any) => k.id)).not.toContain(keyId);
  });

  it('a key that was used recently stops working immediately after revocation (KI-5)', async () => {
    const { key, keyId } = await createIngestKey(owner, 'cached');
    expect((await api('POST', '/api/v1/ingest', { apiKey: key, body: { logs: [logEntry()] } })).status).toBe(202);
    const redis = await redisClient();
    expect(await redis.get(`api_key:ref:${keyId}`)).toMatch(/^[0-9a-f]{64}$/); // it really was cached
    await api('DELETE', `/api/v1/keys/${keyId}?projectId=${owner.projectId}`, { token: owner.accessToken });
    expect((await api('POST', '/api/v1/ingest', { apiKey: key, body: { logs: [logEntry()] } })).status).toBe(401);
  });

  it('Redis never holds a raw key, as a name or a value (KI-5)', async () => {
    const { key } = await createIngestKey(owner, 'no-raw-in-redis');
    expect((await api('POST', '/api/v1/ingest', { apiKey: key, body: { logs: [logEntry()] } })).status).toBe(202);
    const redis = await redisClient();
    const names = await redis.keys('*');
    expect(names.some((n) => n.includes(key))).toBe(false);
    const values = await Promise.all(names.filter((n) => n.startsWith('api_key:')).map((n) => redis.get(n)));
    expect(values.some((v) => v?.includes(key))).toBe(false);
  });

  it('the cache-write script refuses to cache a key with a revocation tombstone (real Redis Lua)', async () => {
    const { cacheValidatedKey, evictRevokedKey } = await import('@modules/auth/key-cache');
    const redis = await redisClient();
    expect(await cacheValidatedKey(redis, 'api', 'proj_lua_probe_key', 'lua-1', { projectId: owner.projectId })).toBe(true);
    await evictRevokedKey(redis, 'api', 'lua-1');
    expect(await cacheValidatedKey(redis, 'api', 'proj_lua_probe_key', 'lua-1', { projectId: owner.projectId })).toBe(false);
    expect(await redis.ttl('api_key:revoked:lua-1')).toBeGreaterThan(500);
  });

  it('legacy /auth/keys issues working proj_ keys for owners', async () => {
    const res = await api('POST', '/api/v1/auth/keys', { token: owner.accessToken, body: { projectId: owner.projectId, label: 'legacy' } });
    expect(res.status).toBe(201);
    expect(res.body.data.key).toMatch(/^proj_/);
    expect((await api('POST', '/api/v1/ingest', { apiKey: res.body.data.key, body: { logs: [logEntry()] } })).status).toBe(202);
  });
});

describe('project members and roles (real stack)', () => {
  let owner: Tenant;
  let dev: Tenant;
  const members = () => `/api/v1/users/${owner.projectId}/members`;

  beforeAll(async () => {
    owner = await registerTenant('owner');
    dev = await registerTenant('dev');
  });

  it('owner adds an existing user as developer; unknown email → 404; missing fields → 400', async () => {
    expect((await api('POST', members(), { token: owner.accessToken, body: { email: 'ghost@example.test', role: 'developer' } })).status).toBe(404);
    expect((await api('POST', members(), { token: owner.accessToken, body: { email: dev.email } })).status).toBe(400);
    const added = await api('POST', members(), { token: owner.accessToken, body: { email: dev.email, role: 'developer' } });
    expect(added.status).toBe(201);
    expect(added.body.member).toMatchObject({ userId: dev.userId, role: 'developer' });
  });

  it('developer can read project data but cannot manage keys or members', async () => {
    expect((await api('GET', `/api/v1/metrics/overview?projectId=${owner.projectId}`, { token: dev.accessToken })).status).toBe(200);
    expect((await api('GET', `/api/v1/logs?projectId=${owner.projectId}`, { token: dev.accessToken })).status).toBe(200);
    expect((await api('GET', members(), { token: dev.accessToken })).status).toBe(200);
    expect((await api('POST', '/api/v1/keys', { token: dev.accessToken, body: { projectId: owner.projectId, label: 'x' } })).status).toBe(403);
    expect((await api('POST', '/api/v1/auth/rum-keys', { token: dev.accessToken, body: { projectId: owner.projectId } })).status).toBe(403);
    expect((await api('POST', members(), { token: dev.accessToken, body: { email: owner.email, role: 'developer' } })).status).toBe(403);
    expect((await api('PATCH', `${members()}/${dev.userId}`, { token: dev.accessToken, body: { role: 'owner' } })).status).toBe(403);
  });

  it('the project appears in the developer project list with role developer', async () => {
    const res = await api('GET', '/api/v1/projects', { token: dev.accessToken });
    expect(res.body.data.projects.find((p: any) => p.id === owner.projectId)).toMatchObject({ role: 'developer' });
  });

  it('owner promotes, then removes the member; access is revoked', async () => {
    const promoted = await api('PATCH', `${members()}/${dev.userId}`, { token: owner.accessToken, body: { role: 'owner' } });
    expect(promoted.body.member.role).toBe('owner');
    await api('PATCH', `${members()}/${dev.userId}`, { token: owner.accessToken, body: { role: 'developer' } });
    expect((await api('DELETE', `${members()}/${dev.userId}`, { token: owner.accessToken })).status).toBe(204);
    expect((await api('GET', `/api/v1/logs?projectId=${owner.projectId}`, { token: dev.accessToken })).status).toBe(403);
  });

  it('the last owner cannot be removed', async () => {
    expect((await api('DELETE', `${members()}/${owner.userId}`, { token: owner.accessToken })).status).toBe(400);
  });

  it('member changes are audited', async () => {
    const rows = await pgQuery<{ action: string }>('SELECT action FROM audit_logs WHERE project_id = $1', [owner.projectId]);
    expect(rows.map((r) => r.action)).toEqual(expect.arrayContaining(['project.member_added', 'project.member_role_updated', 'project.member_removed']));
  });

  it('creating a project makes the creator its owner', async () => {
    const created = await api('POST', '/api/v1/projects', { token: dev.accessToken, body: { name: 'Side project' } });
    expect(created.status).toBe(201);
    expect(created.body.data.project).toMatchObject({ name: 'Side project', role: 'owner' });
  });
});
