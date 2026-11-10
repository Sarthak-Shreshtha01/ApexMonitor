import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeChannel, FakePg, FakeRedis, PROJECT_A, PROJECT_B, fakeRabbit } from '../../helpers/fakes';

const channel = new FakeChannel();
const pg = new FakePg();
const redis = new FakeRedis();
vi.mock('@infrastructure/rabbitmq', async (importOriginal) => ({ ...(await importOriginal<object>()), ...fakeRabbit(channel) }));
vi.mock('@infrastructure/db/postgres', () => ({ getPg: () => pg }));
vi.mock('@infrastructure/redis', () => ({ getRedis: () => redis }));

const insertMany = vi.fn();
vi.mock('@modules/logs/logs.schema', () => ({ ApiLog: { insertMany: (...a: unknown[]) => insertMany(...a) } }));
const rumInsertMany = vi.fn();
vi.mock('@modules/rum/rum.schema', () => ({ RumRawEvent: { insertMany: (...a: unknown[]) => rumInsertMany(...a) } }));
const createInsight = vi.fn();
vi.mock('@modules/insights/insights.repository', () => ({ InsightsRepository: class { createInsight = createInsight; } }));

const alertsRepo = { getActiveRules: vi.fn(), getWindowStats: vi.fn(), recordEvaluation: vi.fn(), transition: vi.fn() };
vi.mock('@modules/alerts/alerts.repository', () => ({ AlertsRepository: class { constructor() { return alertsRepo; } } }));
const sendWebhook = vi.fn();
vi.mock('@shared/net/webhook', () => ({ sendWebhook: (...a: unknown[]) => sendWebhook(...a) }));

const { RawLogWorker } = await import('@workers/raw-log.worker');
const { AggregationWorker } = await import('@workers/aggregation.worker');
const { AnomalyWorker, minuteHistKey, cooldownKey } = await import('@workers/anomaly.worker');
const { RumWorker } = await import('@workers/rum.worker');
const { AlertWorker, evaluateRule, ALERT_PASS_LOCK_KEY } = await import('@workers/alert.worker');
const { eventBus } = await import('@events/event-bus');

const log = (o: Record<string, unknown> = {}) => ({
  projectId: PROJECT_A, method: 'GET', endpoint: '/a', statusCode: 200, latencyMs: 10, timestamp: '2026-03-01T10:15:00.000Z', ...o,
});

beforeEach(() => {
  channel.acked = [];
  channel.nacked = [];
  pg.calls = [];
  redis.lists.clear();
  redis.hll.clear();
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('RawLogWorker', () => {
  beforeEach(async () => { await new RawLogWorker().start(); });

  it('consumes raw_log_queue with prefetch 200 and acks after insert', async () => {
    expect(channel.prefetch).toHaveBeenCalledWith(200);
    insertMany.mockResolvedValueOnce([]);
    const msg = await channel.deliver('raw_log_queue', [log()]);
    expect(insertMany).toHaveBeenCalledWith([expect.objectContaining({ projectId: PROJECT_A })], { ordered: false });
    expect(channel.acked).toContain(msg);
  });

  it('acks duplicate-key errors (idempotent redelivery)', async () => {
    insertMany.mockRejectedValueOnce(Object.assign(new Error('dup'), { code: 11000 }));
    const msg = await channel.deliver('raw_log_queue', [log()]);
    expect(channel.acked).toContain(msg);
  });

  it('dead-letters other failures (nack, no requeue)', async () => {
    insertMany.mockRejectedValueOnce(new Error('mongo down'));
    const msg = await channel.deliver('raw_log_queue', [log()]);
    expect(channel.nacked).toEqual([{ msg, allUpTo: false, requeue: false }]);
  });

  it('dead-letters malformed JSON', async () => {
    await channel.deliver('raw_log_queue', 'not json');
    expect(channel.nacked).toHaveLength(1);
  });

  it('ignores null deliveries (consumer cancelled)', async () => {
    await channel.consumers.get('raw_log_queue')!(null);
    expect(channel.acked).toHaveLength(0);
  });
});

describe('AggregationWorker', () => {
  beforeEach(async () => { await new AggregationWorker().start(); });

  it('groups by project/endpoint/method/hour and upserts hourly_metrics with Apdex buckets', async () => {
    const emitted: unknown[] = [];
    eventBus.once('aggregation.completed', (p) => emitted.push(p));
    await channel.deliver('aggregation_queue', [
      log({ latencyMs: 100 }),
      log({ latencyMs: 800 }),
      log({ latencyMs: 3000 }),
      log({ latencyMs: 50, statusCode: 503 }),
      log({ method: 'POST' }),
      log({ projectId: PROJECT_B }),
    ]);
    const upserts = pg.calls.filter((c) => c.sql.includes('INSERT INTO hourly_metrics'));
    expect(upserts).toHaveLength(3);
    const get = upserts.find((c) => c.params[0] === PROJECT_A && c.params[2] === 'GET')!;
    // [project, endpoint, method, bucket, count, errors, latencySum, min, max, histogram, satisfied, tolerating, frustrated]
    expect(get.params.slice(4, 6)).toEqual([4, 1]);
    expect(get.params.slice(10)).toEqual([1, 1, 2]);
    expect(emitted).toEqual([{ projectIds: [PROJECT_A, PROJECT_B] }]);
    expect(channel.acked).toHaveLength(1);
  });

  it('dead-letters when the database write fails', async () => {
    pg.query.mockRejectedValueOnce(new Error('pg down'));
    await channel.deliver('aggregation_queue', [log()]);
    expect(channel.nacked).toHaveLength(1);
  });

  it('hour buckets are computed in UTC regardless of server timezone (KI-9)', async () => {
    const tz = process.env.TZ;
    process.env.TZ = 'Asia/Kolkata';
    try {
      await channel.deliver('aggregation_queue', [log({ timestamp: '2026-03-01T10:15:00.000Z' })]);
      const bucket = pg.calls.find((c) => c.sql.includes('INSERT INTO hourly_metrics'))!.params[3] as Date;
      expect(bucket.toISOString()).toBe('2026-03-01T10:00:00.000Z');
    } finally {
      process.env.TZ = tz;
    }
  });

  it('sends mergeable statistics: latency sum, min, max and histogram (KI-8)', async () => {
    const { latencyHistogram } = await import('@shared/utils/math.utils');
    await channel.deliver('aggregation_queue', [log({ latencyMs: 10 }), log({ latencyMs: 30 }), log({ latencyMs: 1000 })]);
    const call = pg.calls.find((c) => c.sql.includes('INSERT INTO hourly_metrics'))!;
    expect(call.params.slice(4, 10)).toEqual([3, 0, 1040, 10, 1000, latencyHistogram([10, 30, 1000])]);
    // merged on conflict, never averaged or max-ed
    expect(call.sql).toContain('latency_sum_ms   = hourly_metrics.latency_sum_ms + EXCLUDED.latency_sum_ms');
    expect(call.sql).toContain('apex_hist_add(hourly_metrics.latency_hist, EXCLUDED.latency_hist)');
    expect(call.sql).not.toMatch(/\(hourly_metrics\.avg_ms \+ EXCLUDED\.avg_ms\) \/ 2/);
    expect(call.sql).not.toMatch(/GREATEST\(hourly_metrics\.p9[59]_ms/);
  });
});

describe('AnomalyWorker (time-based baselines, KI-27)', () => {
  // Fixed clock: "now" is 10:15:30 UTC; minute(-n) is a timestamp n minutes earlier.
  const NOW = Date.parse('2026-03-01T10:15:30.000Z');
  const at = (minutesAgo: number, second = 10) => new Date(NOW - minutesAgo * 60_000 - 30_000 + second * 1000).toISOString();
  /** `perMinute` requests at `latencyMs` in each of the given minutes. */
  const traffic = (minutesAgo: number[], latencyMs: number, perMinute = 5, o: Record<string, unknown> = {}) =>
    minutesAgo.flatMap((m) => Array.from({ length: perMinute }, (_, i) => log({ latencyMs, timestamp: at(m, i), ...o })));
  const history = (n: number) => Array.from({ length: n }, (_, i) => i + 1); // minutes 1..n ago

  beforeEach(async () => {
    createInsight.mockReset();
    redis.hashes.clear();
    for (const k of [...redis.store.keys()]) if (k.startsWith('anomaly:')) redis.store.delete(k);
    await new AnomalyWorker(() => NOW).start();
  });

  it('records a latency histogram per method, endpoint and UTC minute of the request, with a TTL', async () => {
    await channel.deliver('anomaly_queue', [log({ latencyMs: 10, timestamp: at(0) }), log({ latencyMs: 10, timestamp: at(0) }), log({ method: 'POST', latencyMs: 10, timestamp: at(3) })]);
    const minute = Math.floor(NOW / 60_000);
    const get = redis.hashes.get(minuteHistKey(PROJECT_A, 'GET', '/a', minute));
    expect([...get!.values()].map(Number)).toEqual([2]);
    expect(redis.hashes.has(minuteHistKey(PROJECT_A, 'POST', '/a', minute - 3))).toBe(true);
    expect(redis.ttl.get(minuteHistKey(PROJECT_A, 'GET', '/a', minute))).toBe(35 * 60);
    expect(channel.acked).toHaveLength(1);
  });

  it('a spike after enough stable minutes creates one insight and emits anomaly.detected', async () => {
    const events: any[] = [];
    eventBus.once('anomaly.detected', (p) => events.push(p));
    await channel.deliver('anomaly_queue', traffic(history(10), 20));
    expect(createInsight).not.toHaveBeenCalled();

    await channel.deliver('anomaly_queue', traffic([0], 5000));
    expect(createInsight).toHaveBeenCalledTimes(1);
    const insight = createInsight.mock.calls[0][0];
    expect(insight).toMatchObject({ projectId: PROJECT_A, endpoint: '/a', type: 'latency_spike', severity: 'warning' });
    expect(insight.message).toContain('GET /a');
    expect(insight.metadata).toMatchObject({ method: 'GET', baselineMinutes: 10 });
    expect(insight.metadata.currentP99).toBeGreaterThan(4500);
    expect(insight.metadata.baselineP99).toBeLessThan(25);
    expect(events[0]).toMatchObject({ projectId: PROJECT_A, endpoint: '/a', type: 'latency_spike' });
  });

  it('a perfectly flat baseline still detects a spike (zero spread)', async () => {
    await channel.deliver('anomaly_queue', [...traffic(history(6), 20), ...traffic([0], 900)]);
    expect(createInsight).toHaveBeenCalledTimes(1);
  });

  it('later batches in the same spike are in cooldown: one insight, not one per batch', async () => {
    await channel.deliver('anomaly_queue', traffic(history(10), 20));
    for (let i = 0; i < 4; i++) await channel.deliver('anomaly_queue', traffic([0], 5000));
    expect(createInsight).toHaveBeenCalledTimes(1);
    expect(redis.ttl.get(cooldownKey(PROJECT_A, 'GET', '/a'))).toBe(300);
  });

  it('needs at least 5 minutes of baseline', async () => {
    await channel.deliver('anomaly_queue', [...traffic(history(4), 20), ...traffic([0], 5000)]);
    expect(createInsight).not.toHaveBeenCalled();
  });

  it('batch size does not matter: one request per batch builds the same baseline as one big batch', async () => {
    for (const entry of traffic(history(8), 20)) await channel.deliver('anomaly_queue', [entry]);
    for (const entry of traffic([0], 5000)) await channel.deliver('anomaly_queue', [entry]);
    expect(createInsight).toHaveBeenCalledTimes(1);
  });

  it('ignores small or thinly sampled changes', async () => {
    // 20 ms -> 40 ms is a big z-score on a flat line but only 20 ms slower: not worth an alert.
    await channel.deliver('anomaly_queue', [...traffic(history(10), 20), ...traffic([0], 40)]);
    // One slow request in a minute is not enough to judge a p99.
    await channel.deliver('anomaly_queue', [...traffic(history(10), 20, 5, { endpoint: '/b' }), log({ endpoint: '/b', latencyMs: 9000, timestamp: at(0) })]);
    expect(createInsight).not.toHaveBeenCalled();
  });

  it('baselines are kept per method (GET and POST on the same path are separate)', async () => {
    // A slow POST /a is normal; it must not look like a GET /a spike, nor be judged against fast GETs.
    await channel.deliver('anomaly_queue', [...traffic(history(10), 20), ...traffic(history(10), 2000, 5, { method: 'POST' })]);
    await channel.deliver('anomaly_queue', traffic([0], 2000, 5, { method: 'POST' }));
    expect(createInsight).not.toHaveBeenCalled();
    await channel.deliver('anomaly_queue', traffic([0], 2000));
    expect(createInsight).toHaveBeenCalledWith(expect.objectContaining({ metadata: expect.objectContaining({ method: 'GET' }) }));
  });

  it('old (late or backfilled) minutes feed the baseline but are not evaluated', async () => {
    await channel.deliver('anomaly_queue', [...traffic(history(20).map((m) => m + 10), 20), ...traffic([8], 5000)]);
    expect(createInsight).not.toHaveBeenCalled();
  });

  it('dead-letters on failure', async () => {
    createInsight.mockRejectedValueOnce(new Error('pg down'));
    await channel.deliver('anomaly_queue', [...traffic(history(10), 20), ...traffic([0], 9000)]);
    expect(channel.nacked).toHaveLength(1);
  });
});

describe('RumWorker', () => {
  const event = (o: Record<string, unknown> = {}) => ({
    eventId: crypto.randomUUID(), projectId: PROJECT_A, type: 'page_view', path: '/p', referrerSource: 'direct',
    sessionHash: 's1', visitorHash: 'v1', ttfbMs: 100, fcpMs: null, lcpMs: 300, browserName: 'Chrome', osName: 'macOS',
    deviceType: 'desktop', countryCode: 'IN', regionCode: 'KA', timestamp: '2026-03-01T10:59:59.000Z', sdkVersion: '1.0.0', ...o,
  });
  beforeEach(async () => {
    rumInsertMany.mockReset();
    await new RumWorker().start();
  });

  it('stores raw events, aggregates per dimension and UTC hour, counts uniques via HLL', async () => {
    await channel.deliver('rum_queue', {
      batchId: 'b', projectId: PROJECT_A, receivedAt: 'now',
      events: [event(), event({ visitorHash: 'v2', sessionHash: 's2', ttfbMs: 300 }), event({ type: 'web_vital', lcpMs: null }), event({ path: '/other' })],
    });
    expect(rumInsertMany).toHaveBeenCalledTimes(1);
    const upserts = pg.calls.filter((c) => c.sql.includes('INSERT INTO hourly_rum_metrics'));
    expect(upserts).toHaveLength(2);
    const p = upserts.find((c) => c.params[1] === '/p')!.params;
    expect(p[7]).toBe('2026-03-01T10:00:00.000Z');
    expect(p[8]).toBe(2); // page views (web_vital not counted)
    expect(p[9]).toBe(2); // unique visitors
    expect(p[10]).toBe(2); // unique sessions
    expect(p[11]).toBeCloseTo((100 + 300 + 100) / 3); // avg ttfb
    expect(p[12]).toBeNull(); // no fcp samples
    expect(p[13]).toBe(300); // lcp avg of the two with values
    expect(p.slice(14)).toEqual([3, 0, 2]);
    expect(channel.acked).toHaveLength(1);
  });

  it('tolerates duplicate raw events but dead-letters other storage errors', async () => {
    rumInsertMany.mockRejectedValueOnce(Object.assign(new Error('dup'), { code: 11000 }));
    await channel.deliver('rum_queue', { batchId: 'b', projectId: PROJECT_A, receivedAt: 'now', events: [event()] });
    expect(channel.acked).toHaveLength(1);
    rumInsertMany.mockRejectedValueOnce(new Error('mongo down'));
    await channel.deliver('rum_queue', { batchId: 'b', projectId: PROJECT_A, receivedAt: 'now', events: [event()] });
    expect(channel.nacked).toHaveLength(1);
  });
});

describe('evaluateRule', () => {
  const r = (condition_type: string, threshold: number) => ({ condition_type, threshold, window_minutes: 5 }) as never;
  it('error rate: strictly above the threshold breaches; no traffic never does', () => {
    expect(evaluateRule(r('error_rate_high', 5), { totalRequests: 100, totalErrors: 6, p99Ms: 1 })).toMatchObject({ breached: true, value: 6 });
    expect(evaluateRule(r('error_rate_high', 5), { totalRequests: 100, totalErrors: 5, p99Ms: 1 })).toMatchObject({ breached: false, value: 5 });
    expect(evaluateRule(r('error_rate_high', 5), { totalRequests: 0, totalErrors: 0, p99Ms: null })).toMatchObject({ breached: false, value: null });
  });
  it('p99 latency: compares the window p99 with the threshold in ms', () => {
    const e = evaluateRule(r('latency_p99_high', 500), { totalRequests: 3, totalErrors: 0, p99Ms: 900.4 });
    expect(e).toMatchObject({ breached: true, value: 900 });
    expect(e.summary).toContain('p99 latency 900ms');
    expect(evaluateRule(r('latency_p99_high', 500), { totalRequests: 0, totalErrors: 0, p99Ms: null }).breached).toBe(false);
  });
  it('unknown conditions never breach', () => {
    expect(evaluateRule(r('cpu_high', 1), { totalRequests: 1, totalErrors: 1, p99Ms: 1 }).breached).toBe(false);
  });
});

describe('AlertWorker (KI-18)', () => {
  const rule = (o: Record<string, unknown> = {}) => ({
    id: 1, project_id: PROJECT_A, name: 'r', condition_type: 'error_rate_high', endpoint_filter: null, threshold: 5, window_minutes: 5,
    notify_webhook: null, state: 'ok', is_active: true, ...o,
  });
  const breaching = { totalRequests: 100, totalErrors: 6, p99Ms: 10 };
  const healthy = { totalRequests: 100, totalErrors: 0, p99Ms: 10 };
  // singleton: false — the cluster-wide pass lock has its own tests below
  const worker = new AlertWorker({ singleton: false }) as unknown as { evaluateRules(): Promise<boolean>; start(): void; stop(): void };

  beforeEach(() => {
    Object.values(alertsRepo).forEach((f) => f.mockReset());
    alertsRepo.transition.mockResolvedValue(true);
    sendWebhook.mockReset();
    sendWebhook.mockResolvedValue(200);
  });
  afterEach(() => worker.stop());

  it('ok → firing on breach: records the event, emits, and sends one webhook with details', async () => {
    const emitted: any[] = [];
    eventBus.once('alert.triggered', (p) => emitted.push(p));
    alertsRepo.getActiveRules.mockResolvedValue([rule({ notify_webhook: 'https://hooks.example/x', endpoint_filter: '/pay' })]);
    alertsRepo.getWindowStats.mockResolvedValue(breaching);
    await worker.evaluateRules();
    expect(alertsRepo.getWindowStats).toHaveBeenCalledWith(PROJECT_A, '/pay', 5);
    expect(alertsRepo.recordEvaluation).toHaveBeenCalledWith(1, 6);
    expect(alertsRepo.transition).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }), 'ok', 'firing', expect.stringContaining('6.00%'), 6);
    expect(emitted[0]).toMatchObject({ alertRuleId: 1, projectId: PROJECT_A, severity: 'critical' });
    expect(sendWebhook).toHaveBeenCalledWith('https://hooks.example/x', expect.objectContaining({
      text: expect.stringContaining('Alert: r.'), status: 'triggered', value: 6, projectId: PROJECT_A,
      rule: expect.objectContaining({ id: 1, condition: 'error_rate_high', threshold: 5, windowMinutes: 5 }),
    }));
  });

  it('a rule that stays breached does not re-notify every minute (cooldown)', async () => {
    alertsRepo.getActiveRules.mockResolvedValue([rule({ state: 'firing', notify_webhook: 'https://hooks.example/x' })]);
    alertsRepo.getWindowStats.mockResolvedValue(breaching);
    await worker.evaluateRules();
    await worker.evaluateRules();
    expect(alertsRepo.transition).not.toHaveBeenCalled();
    expect(sendWebhook).not.toHaveBeenCalled();
    expect(alertsRepo.recordEvaluation).toHaveBeenCalledTimes(2); // still evaluated and visible in the UI
  });

  it('firing → ok when it recovers: one "resolved" event and webhook', async () => {
    const emitted: any[] = [];
    eventBus.once('alert.triggered', (p) => emitted.push(p));
    alertsRepo.getActiveRules.mockResolvedValue([rule({ state: 'firing', notify_webhook: 'https://hooks.example/x' })]);
    alertsRepo.getWindowStats.mockResolvedValue(healthy);
    await worker.evaluateRules();
    expect(alertsRepo.transition).toHaveBeenCalledWith(expect.anything(), 'firing', 'ok', expect.stringMatching(/^Resolved: r\./), 0);
    expect(emitted[0]).toMatchObject({ severity: 'info' });
    expect(sendWebhook).toHaveBeenCalledWith('https://hooks.example/x', expect.objectContaining({ status: 'resolved' }));
  });

  it('no traffic resolves a firing error-rate rule and never fires an ok one', async () => {
    alertsRepo.getActiveRules.mockResolvedValue([rule(), rule({ id: 2, state: 'firing' })]);
    alertsRepo.getWindowStats.mockResolvedValue({ totalRequests: 0, totalErrors: 0, p99Ms: null });
    await worker.evaluateRules();
    expect(alertsRepo.transition).toHaveBeenCalledTimes(1);
    expect(alertsRepo.transition).toHaveBeenCalledWith(expect.objectContaining({ id: 2 }), 'firing', 'ok', expect.any(String), null);
  });

  it('does not notify when another evaluator already made the transition', async () => {
    alertsRepo.getActiveRules.mockResolvedValue([rule({ notify_webhook: 'https://hooks.example/x' })]);
    alertsRepo.getWindowStats.mockResolvedValue(breaching);
    alertsRepo.transition.mockResolvedValue(false);
    await worker.evaluateRules();
    expect(sendWebhook).not.toHaveBeenCalled();
  });

  it('one failing rule does not stop the others; repository and webhook failures are contained', async () => {
    alertsRepo.getActiveRules.mockRejectedValueOnce(new Error('pg down'));
    await expect(worker.evaluateRules()).resolves.toBe(false); // the pass failed as a whole
    alertsRepo.getActiveRules.mockResolvedValue([rule({ id: 1 }), rule({ id: 2, notify_webhook: 'https://hooks.example/x' })]);
    alertsRepo.getWindowStats.mockRejectedValueOnce(new Error('mongo down')).mockResolvedValue(breaching);
    sendWebhook.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    await expect(worker.evaluateRules()).resolves.toBe(true); // one rule failed, the pass completed
    expect(alertsRepo.transition).toHaveBeenCalledWith(expect.objectContaining({ id: 2 }), 'ok', 'firing', expect.any(String), 6);
  });

  it('a slow pass never overlaps the next one', async () => {
    let release!: () => void;
    alertsRepo.getActiveRules.mockImplementationOnce(() => new Promise((r) => { release = () => r([]); }));
    const first = worker.evaluateRules();
    await worker.evaluateRules(); // skipped while the first is running
    expect(alertsRepo.getActiveRules).toHaveBeenCalledTimes(1);
    release();
    await first;
  });

  it('sends webhooks only through the SSRF-guarded sender (KI-6)', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    alertsRepo.getActiveRules.mockResolvedValue([rule({ notify_webhook: 'http://169.254.169.254/latest/meta-data' })]);
    alertsRepo.getWindowStats.mockResolvedValue(breaching);
    sendWebhook.mockRejectedValueOnce(new Error('Webhook URL must use https'));
    await worker.evaluateRules();
    expect(sendWebhook).toHaveBeenCalledWith('http://169.254.169.254/latest/meta-data', expect.anything());
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});

describe('AlertWorker across replicas (KI-20)', () => {
  beforeEach(() => {
    redis.store.delete(ALERT_PASS_LOCK_KEY);
    Object.values(alertsRepo).forEach((f) => f.mockReset());
    alertsRepo.getActiveRules.mockResolvedValue([]);
  });

  it('only one replica runs each pass: the first takes the lock, the others skip', async () => {
    const a = new AlertWorker();
    const b = new AlertWorker();
    expect(await a.evaluateRules()).toBe(true);
    expect(await b.evaluateRules()).toBe(false);
    expect(alertsRepo.getActiveRules).toHaveBeenCalledTimes(1);
    expect(redis.ttl.get(ALERT_PASS_LOCK_KEY)).toBeUndefined(); // PX expiry, see below
    expect(redis.set).toHaveBeenCalledWith(ALERT_PASS_LOCK_KEY, expect.any(String), 'PX', 55_000, 'NX');
  });

  it('once the lock expires, the next pass runs on whichever replica gets there first', async () => {
    const b = new AlertWorker();
    await new AlertWorker().evaluateRules();
    redis.store.delete(ALERT_PASS_LOCK_KEY); // expired
    expect(await b.evaluateRules()).toBe(true);
  });
});
