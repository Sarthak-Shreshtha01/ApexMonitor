import { beforeAll, describe, expect, it } from 'vitest';
import { api, createIngestKey, logEntry, mongoCount, pgQuery, registerTenant, Tenant, waitFor } from './harness';

/**
 * Cross-tenant isolation: user/key of tenant A must never read or write tenant B's data.
 */
describe('tenant isolation (real stack)', () => {
  let a: Tenant;
  let b: Tenant;
  let keyA: string;

  beforeAll(async () => {
    a = await registerTenant('tenant-a');
    b = await registerTenant('tenant-b');
    keyA = (await createIngestKey(a)).key;
  });

  describe('KI-2: ingest is bound to the API key project', () => {
    it('key A writing to project B is rejected and nothing is stored or counted for B', async () => {
      const res = await api('POST', '/api/v1/ingest', { apiKey: keyA, body: { projectId: b.projectId, logs: [logEntry({ endpoint: '/cross-tenant' })] } });
      expect(res.status).toBe(403);
      expect(res.body.error).toBe('FORBIDDEN');

      // Give workers a chance to (incorrectly) process anything that slipped through.
      await new Promise((r) => setTimeout(r, 1500));
      expect(await mongoCount('api_logs', { projectId: b.projectId })).toBe(0);
      expect(await pgQuery('SELECT 1 FROM hourly_metrics WHERE project_id = $1', [b.projectId])).toHaveLength(0);
      const redis = await (await import('./harness')).redisClient();
      expect(await redis.get(`rate:${b.projectId}`)).toBeNull();
    });

    it('key A without projectId writes to project A', async () => {
      const res = await api('POST', '/api/v1/ingest', { apiKey: keyA, body: { logs: [logEntry({ endpoint: '/no-project-field' })] } });
      expect(res.status).toBe(202);
      await waitFor(async () => (await mongoCount('api_logs', { projectId: a.projectId, endpoint: '/no-project-field' })) === 1, { label: 'raw log in A' });
    });

    it('key A with projectId A writes to project A', async () => {
      const res = await api('POST', '/api/v1/ingest', { apiKey: keyA, body: { projectId: a.projectId, logs: [logEntry({ endpoint: '/explicit-project' })] } });
      expect(res.status).toBe(202);
      await waitFor(async () => (await mongoCount('api_logs', { projectId: a.projectId, endpoint: '/explicit-project' })) === 1, { label: 'raw log in A' });
    });
  });

  describe("user B cannot touch project A through any project-scoped route", () => {
    const P = () => a.projectId;
    const cases: Array<[string, () => string, (() => unknown) | undefined]> = [
      ['GET', () => `/api/v1/metrics/overview?projectId=${P()}`, undefined],
      ['GET', () => `/api/v1/metrics/latency?projectId=${P()}`, undefined],
      ['GET', () => `/api/v1/metrics/operations?projectId=${P()}`, undefined],
      ['GET', () => `/api/v1/logs?projectId=${P()}`, undefined],
      ['GET', () => `/api/v1/traces?projectId=${P()}`, undefined],
      ['GET', () => `/api/v1/traces/anything?projectId=${P()}`, undefined],
      ['GET', () => `/api/v1/insights?projectId=${P()}`, undefined],
      ['GET', () => `/api/v1/rum/overview?projectId=${P()}`, undefined],
      ['GET', () => `/api/v1/rum/series?projectId=${P()}`, undefined],
      ['GET', () => `/api/v1/rum/paths?projectId=${P()}`, undefined],
      ['GET', () => `/api/v1/rum/devices?projectId=${P()}`, undefined],
      ['GET', () => `/api/v1/rum/geo?projectId=${P()}`, undefined],
      ['GET', () => `/api/v1/rum/referrers?projectId=${P()}`, undefined],
      ['GET', () => `/api/v1/keys?projectId=${P()}`, undefined],
      ['GET', () => `/api/v1/keys/stats?projectId=${P()}`, undefined],
      ['POST', () => '/api/v1/keys', () => ({ projectId: P(), label: 'steal' })],
      ['DELETE', () => `/api/v1/keys/1?projectId=${P()}`, undefined],
      ['POST', () => '/api/v1/auth/keys', () => ({ projectId: P() })],
      ['POST', () => '/api/v1/auth/rum-keys', () => ({ projectId: P() })],
      ['GET', () => `/api/v1/users/${P()}/members`, undefined],
      ['POST', () => `/api/v1/users/${P()}/members`, () => ({ email: b.email, role: 'owner' })],
      ['PATCH', () => `/api/v1/users/${P()}/members/${b.userId}`, () => ({ role: 'owner' })],
      ['DELETE', () => `/api/v1/users/${P()}/members/${a.userId}`, undefined],
    ];

    it.each(cases)('%s %s → 403', async (method, url, body) => {
      const res = await api(method, url(), { token: b.accessToken, body: body?.() });
      expect(res.status).toBe(403);
    });

    it('and B was not silently added to A', async () => {
      const members = await pgQuery('SELECT user_id FROM project_members WHERE project_id = $1', [a.projectId]);
      expect(members.map((m: any) => m.user_id)).toEqual([a.userId]);
    });

    it("B's key list does not include A's keys", async () => {
      const res = await api('GET', '/api/v1/keys', { token: b.accessToken });
      expect(res.status === 403 || res.body.data.keys.every((k: any) => k.projectId !== a.projectId)).toBe(true);
    });
  });
});
