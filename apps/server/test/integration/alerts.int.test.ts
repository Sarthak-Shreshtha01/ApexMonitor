import crypto from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { api, createIngestKey, logEntry, mongoCount, pgQuery, registerTenant, Tenant, waitFor } from './harness';

// Unique path segments start with a letter so they are never mistaken for ids.
const uniq = () => `x${crypto.randomUUID().replace(/-/g, '').slice(0, 10)}`;

describe('alert rules and evaluation (real stack, KI-18)', () => {
  let t: Tenant;
  let key: string;

  beforeAll(async () => {
    t = await registerTenant('alerts');
    key = (await createIngestKey(t)).key;
  });

  const evaluate = async () => {
    const { AlertWorker } = await import('@workers/alert.worker');
    await new AlertWorker().evaluateRules();
  };
  const createRule = async (body: Record<string, unknown>) => {
    const res = await api('POST', '/api/v1/alerts/rules', { token: t.accessToken, body: { projectId: t.projectId, ...body } });
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    return res.body.data.rule;
  };
  const ruleRow = async (id: number) => (await pgQuery('SELECT state, last_value, last_triggered_at, last_resolved_at FROM alert_rules WHERE id = $1', [id]))[0];
  const events = async (id: number) => pgQuery<{ kind: string; value: number }>('SELECT kind, value FROM alert_events WHERE alert_rule_id = $1 ORDER BY id', [id]);

  it('create, list, update and delete rules through the API', async () => {
    const rule = await createRule({ name: 'Errors', conditionType: 'error_rate_high', threshold: 5, notifyWebhook: 'https://hooks.example.com/x' });
    expect(rule).toMatchObject({ name: 'Errors', windowMinutes: 5, isActive: true, state: 'ok', notifyWebhook: 'https://hooks.example.com/x' });

    const list = await api('GET', `/api/v1/alerts/rules?projectId=${t.projectId}`, { token: t.accessToken });
    expect(list.body.data.rules.map((r: any) => r.id)).toContain(rule.id);

    const patched = await api('PATCH', `/api/v1/alerts/rules/${rule.id}?projectId=${t.projectId}`, { token: t.accessToken, body: { threshold: 20, isActive: false } });
    expect(patched.status).toBe(200);
    expect(patched.body.data.rule).toMatchObject({ threshold: 20, isActive: false, name: 'Errors' });

    expect((await api('DELETE', `/api/v1/alerts/rules/${rule.id}?projectId=${t.projectId}`, { token: t.accessToken })).status).toBe(204);
    expect((await api('DELETE', `/api/v1/alerts/rules/${rule.id}?projectId=${t.projectId}`, { token: t.accessToken })).status).toBe(404);
  });

  it("another tenant can neither see nor change this project's rules", async () => {
    const rule = await createRule({ name: 'Private', conditionType: 'error_rate_high', threshold: 50 });
    const other = await registerTenant('alerts-other');
    expect((await api('GET', `/api/v1/alerts/rules?projectId=${t.projectId}`, { token: other.accessToken })).status).toBe(403);
    // Using their own project id with our rule id finds nothing.
    expect((await api('PATCH', `/api/v1/alerts/rules/${rule.id}?projectId=${other.projectId}`, { token: other.accessToken, body: { name: 'pwned' } })).status).toBe(404);
    expect((await api('DELETE', `/api/v1/alerts/rules/${rule.id}?projectId=${other.projectId}`, { token: other.accessToken })).status).toBe(404);
    expect((await ruleRow(rule.id))).toBeDefined();
  });

  it('a p99 rule fires once from raw logs in its window, and does not re-notify while still breached', async () => {
    const endpoint = `/slow/${uniq()}`;
    const rule = await createRule({ name: 'Slow checkout', conditionType: 'latency_p99_high', threshold: 500, windowMinutes: 10, endpointFilter: endpoint });
    const now = new Date().toISOString();
    const logs = Array.from({ length: 10 }, () => logEntry({ endpoint, latencyMs: 1200, timestamp: now }));
    expect((await api('POST', '/api/v1/ingest', { apiKey: key, body: { logs } })).status).toBe(202);
    await waitFor(async () => (await mongoCount('api_logs', { projectId: t.projectId, endpoint })) === 10, { label: 'raw logs' });

    await evaluate();
    const fired = await ruleRow(rule.id);
    expect(fired.state).toBe('firing');
    expect(fired.last_value).toBeCloseTo(1200, -1); // Mongo $percentile (approximate)
    expect(fired.last_triggered_at).not.toBeNull();

    await evaluate();
    await evaluate();
    expect((await events(rule.id)).map((e) => e.kind)).toEqual(['triggered']);

    const history = await api('GET', `/api/v1/alerts/events?projectId=${t.projectId}&ruleId=${rule.id}`, { token: t.accessToken });
    expect(history.body.data.events).toEqual([expect.objectContaining({ ruleId: rule.id, kind: 'triggered', ruleName: 'Slow checkout' })]);
    expect(history.body.data.events[0].message).toContain('P99 latency');
  });

  it('a firing rule resolves once its window is healthy, with one "resolved" event', async () => {
    const endpoint = `/quiet/${uniq()}`;
    const rule = await createRule({ name: 'Errors on quiet path', conditionType: 'error_rate_high', threshold: 10, windowMinutes: 5, endpointFilter: endpoint });
    // Healthy traffic in the window, rule currently firing (e.g. from an earlier incident).
    const now = new Date().toISOString();
    expect((await api('POST', '/api/v1/ingest', { apiKey: key, body: { logs: Array.from({ length: 5 }, () => logEntry({ endpoint, statusCode: 200, timestamp: now })) } })).status).toBe(202);
    await waitFor(async () => (await mongoCount('api_logs', { projectId: t.projectId, endpoint })) === 5, { label: 'healthy logs' });
    await pgQuery(`UPDATE alert_rules SET state = 'firing' WHERE id = $1`, [rule.id]);

    await evaluate();
    await evaluate();
    const resolved = await ruleRow(rule.id);
    expect(resolved.state).toBe('ok');
    expect(resolved.last_resolved_at).not.toBeNull();
    expect(await events(rule.id)).toEqual([{ kind: 'resolved', value: 0 }]);
  });

  it('an error-rate rule fires on errors in its window; changing its threshold re-arms it', async () => {
    const endpoint = `/errors/${uniq()}`;
    const rule = await createRule({ name: 'Error burst', conditionType: 'error_rate_high', threshold: 20, windowMinutes: 5, endpointFilter: endpoint });
    const now = new Date().toISOString();
    const logs = [...Array.from({ length: 3 }, () => logEntry({ endpoint, statusCode: 500, timestamp: now })), logEntry({ endpoint, statusCode: 200, timestamp: now })];
    expect((await api('POST', '/api/v1/ingest', { apiKey: key, body: { logs } })).status).toBe(202);
    await waitFor(async () => (await mongoCount('api_logs', { projectId: t.projectId, endpoint })) === 4, { label: 'error logs' });

    await evaluate();
    expect((await ruleRow(rule.id)).state).toBe('firing');
    expect((await events(rule.id))[0]).toEqual({ kind: 'triggered', value: 75 });

    await api('PATCH', `/api/v1/alerts/rules/${rule.id}?projectId=${t.projectId}`, { token: t.accessToken, body: { threshold: 90 } });
    expect((await ruleRow(rule.id)).state).toBe('ok'); // re-armed, nothing sent for the edit itself
    await evaluate();
    expect((await ruleRow(rule.id)).state).toBe('ok'); // 75% is under the new 90% threshold
  });

  it('inactive rules are not evaluated', async () => {
    const endpoint = `/off/${uniq()}`;
    const rule = await createRule({ name: 'Off', conditionType: 'error_rate_high', threshold: 1, endpointFilter: endpoint, isActive: false });
    expect((await api('POST', '/api/v1/ingest', { apiKey: key, body: { logs: [logEntry({ endpoint, statusCode: 500, timestamp: new Date().toISOString() })] } })).status).toBe(202);
    await waitFor(async () => (await mongoCount('api_logs', { projectId: t.projectId, endpoint })) === 1, { label: 'log' });
    await evaluate();
    expect(await ruleRow(rule.id)).toMatchObject({ state: 'ok', last_value: null });
  });
});
