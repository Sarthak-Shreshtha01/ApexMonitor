import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { appWith, FakePg, PROJECT_A, PROJECT_B, project } from '../../helpers/fakes';

const pg = new FakePg();
vi.mock('@infrastructure/db/postgres', () => ({ getPg: () => pg }));
vi.mock('@infrastructure/redis', () => ({ getRedis: () => ({}) }));
const recordSafe = vi.fn(async () => undefined);
vi.mock('@shared/services/audit-log.service', () => ({ auditLogService: { recordSafe } }));

const listProjects = vi.fn();
vi.mock('@modules/users/user.service', () => ({ UserService: class { listProjects = listProjects; } }));

const { alertsRouter } = await import('@modules/alerts/alerts.router');
const { signAccessToken } = await import('@shared/auth/tokens');

const app = appWith((a) => a.use('/alerts', alertsRouter));
const auth = { authorization: `Bearer ${signAccessToken({ id: 'usr_1', email: 'u@example.test' })}` };
const DEV_PROJECT = 'proj_dddddddddddddddddddddddd';

const ruleRow = (o: Record<string, unknown> = {}) => ({
  id: '7', project_id: PROJECT_A, name: 'Checkout errors', condition_type: 'error_rate_high', endpoint_filter: null, threshold: 5,
  window_minutes: 5, notify_webhook: null, notify_email: null, is_active: true, state: 'ok', last_value: null, last_evaluated_at: null,
  last_triggered_at: null, last_resolved_at: null, created_at: new Date('2026-11-10T10:00:00Z'), updated_at: new Date('2026-11-10T10:00:00Z'), ...o,
});
const validRule = { projectId: PROJECT_A, name: 'Checkout errors', conditionType: 'error_rate_high', threshold: 5 };

beforeEach(() => {
  pg.calls = [];
  recordSafe.mockClear();
  listProjects.mockResolvedValue([project(PROJECT_A, 'owner'), project(DEV_PROJECT, 'developer')]);
});

describe('alert rules API (KI-18)', () => {
  it('requires authentication and project membership', async () => {
    expect((await request(await app).get(`/alerts/rules?projectId=${PROJECT_A}`)).status).toBe(401);
    expect((await request(await app).get(`/alerts/rules?projectId=${PROJECT_B}`).set(auth)).status).toBe(403);
    expect((await request(await app).get('/alerts/rules').set(auth)).status).toBe(400);
  });

  it('lists rules of the project in API shape', async () => {
    pg.respond([ruleRow({ state: 'firing', last_value: '7.5' })], /SELECT \* FROM alert_rules WHERE project_id/);
    const res = await request(await app).get(`/alerts/rules?projectId=${PROJECT_A}`).set(auth);
    expect(res.status).toBe(200);
    expect(res.body.data.rules[0]).toMatchObject({
      id: 7, projectId: PROJECT_A, conditionType: 'error_rate_high', threshold: 5, windowMinutes: 5, state: 'firing', lastValue: 7.5,
      createdAt: '2026-11-10T10:00:00.000Z',
    });
    expect(pg.calls[0].params).toEqual([PROJECT_A]);
  });

  it('creates a rule with defaults (5 min window, active) and audits it', async () => {
    pg.respond([ruleRow()], /INSERT INTO alert_rules/);
    const res = await request(await app).post('/alerts/rules').set(auth).send(validRule);
    expect(res.status).toBe(201);
    expect(res.body.data.rule.id).toBe(7);
    const insert = pg.calls.find((c) => c.sql.includes('INSERT INTO alert_rules'))!;
    expect(insert.params).toEqual([PROJECT_A, 'Checkout errors', 'error_rate_high', 5, 5, null, null, null, true]);
    expect(recordSafe).toHaveBeenCalledWith(expect.objectContaining({ action: 'alert_rule.created', projectId: PROJECT_A }));
  });

  it.each([
    ['unknown condition', { conditionType: 'cpu_high' }],
    ['error-rate threshold above 100%', { threshold: 150 }],
    ['zero threshold', { threshold: 0 }],
    ['window over a day', { windowMinutes: 2000 }],
    ['empty name', { name: ' ' }],
    ['http webhook', { notifyWebhook: 'http://hooks.example/x' }],
    ['private-address webhook', { notifyWebhook: 'https://10.0.0.5/hook' }],
    ['metadata webhook', { notifyWebhook: 'https://169.254.169.254/latest' }],
    ['invalid email', { notifyEmail: 'not-an-email' }],
  ])('400 for %s', async (_label, override) => {
    const res = await request(await app).post('/alerts/rules').set(auth).send({ ...validRule, ...override });
    expect(res.status).toBe(400);
    expect(pg.calls.some((c) => c.sql.includes('INSERT'))).toBe(false);
  });

  it('accepts a p99 rule in milliseconds above 100 with an https webhook', async () => {
    pg.respond([ruleRow({ condition_type: 'latency_p99_high', threshold: 800 })], /INSERT INTO alert_rules/);
    const res = await request(await app).post('/alerts/rules').set(auth)
      .send({ ...validRule, conditionType: 'latency_p99_high', threshold: 800, windowMinutes: 15, notifyWebhook: 'https://hooks.slack.com/services/T/B/x' });
    expect(res.status).toBe(201);
  });

  it('only owners can create, change or delete rules; developers can read', async () => {
    expect((await request(await app).post('/alerts/rules').set(auth).send({ ...validRule, projectId: DEV_PROJECT })).status).toBe(403);
    expect((await request(await app).patch(`/alerts/rules/7?projectId=${DEV_PROJECT}`).set(auth).send({ name: 'x' })).status).toBe(403);
    expect((await request(await app).delete(`/alerts/rules/7?projectId=${DEV_PROJECT}`).set(auth)).status).toBe(403);
    expect((await request(await app).get(`/alerts/rules?projectId=${DEV_PROJECT}`).set(auth)).status).toBe(200);
  });

  it('a body projectId the caller does not belong to is refused before validation', async () => {
    expect((await request(await app).post('/alerts/rules').set(auth).send({ ...validRule, projectId: PROJECT_B })).status).toBe(403);
  });

  it('PATCH updates only the given fields, scoped to the project, and re-arms the rule when its condition changes', async () => {
    pg.respond([ruleRow()], /SELECT \* FROM alert_rules WHERE id/);
    pg.respond([ruleRow({ threshold: 10 })], /UPDATE alert_rules SET/);
    const res = await request(await app).patch(`/alerts/rules/7?projectId=${PROJECT_A}`).set(auth).send({ threshold: 10 });
    expect(res.status).toBe(200);
    const update = pg.calls.find((c) => c.sql.startsWith('UPDATE alert_rules'))!;
    expect(update.sql).toContain('threshold = $3');
    expect(update.sql).toContain("state = 'ok'");
    expect(update.sql).not.toContain('name =');
    expect(update.params).toEqual([7, PROJECT_A, 10]);
  });

  it('PATCH of a name only keeps the rule state', async () => {
    pg.respond([ruleRow()], /SELECT \* FROM alert_rules WHERE id/);
    pg.respond([ruleRow({ name: 'Renamed' })], /UPDATE alert_rules SET/);
    await request(await app).patch(`/alerts/rules/7?projectId=${PROJECT_A}`).set(auth).send({ name: 'Renamed' });
    expect(pg.calls.find((c) => c.sql.startsWith('UPDATE alert_rules'))!.sql).not.toContain("state = 'ok'");
  });

  it('PATCH checks the threshold against the stored condition; 404 for unknown rules; 400 for empty patches', async () => {
    pg.respond([ruleRow()], /SELECT \* FROM alert_rules WHERE id/);
    expect((await request(await app).patch(`/alerts/rules/7?projectId=${PROJECT_A}`).set(auth).send({ threshold: 500 })).status).toBe(400);
    expect((await request(await app).patch(`/alerts/rules/8?projectId=${PROJECT_A}`).set(auth).send({ name: 'x' })).status).toBe(404);
    expect((await request(await app).patch(`/alerts/rules/7?projectId=${PROJECT_A}`).set(auth).send({})).status).toBe(400);
    expect((await request(await app).patch(`/alerts/rules/abc?projectId=${PROJECT_A}`).set(auth).send({ name: 'x' })).status).toBe(400);
  });

  it('DELETE removes a rule of this project only; 404 otherwise', async () => {
    pg.respond([{ id: 7 }], /DELETE FROM alert_rules/);
    expect((await request(await app).delete(`/alerts/rules/7?projectId=${PROJECT_A}`).set(auth)).status).toBe(204);
    expect(pg.calls.at(-1)!.params).toEqual([7, PROJECT_A]);
    expect((await request(await app).delete(`/alerts/rules/7?projectId=${PROJECT_A}`).set(auth)).status).toBe(404);
  });

  it('lists trigger history, optionally per rule, newest first', async () => {
    pg.respond([{ id: '3', alert_rule_id: '7', kind: 'resolved', message: 'Resolved: x', value: '0', triggered_at: new Date('2026-11-10T11:00:00Z'), rule_name: 'x' }], /FROM alert_events/);
    const res = await request(await app).get(`/alerts/events?projectId=${PROJECT_A}&ruleId=7&limit=10`).set(auth);
    expect(res.status).toBe(200);
    expect(res.body.data.events[0]).toEqual({ id: 3, ruleId: 7, ruleName: 'x', kind: 'resolved', message: 'Resolved: x', value: 0, at: '2026-11-10T11:00:00.000Z' });
    expect(pg.calls.at(-1)!.params).toEqual([PROJECT_A, 7, 10]);
    expect((await request(await app).get(`/alerts/events?projectId=${PROJECT_A}&limit=1000`).set(auth)).status).toBe(400);
  });
});
