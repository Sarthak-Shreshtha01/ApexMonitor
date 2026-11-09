import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeChannel, FakePg, FakeRedis, PROJECT_A, PROJECT_B } from '../../helpers/fakes';
import { knownBug } from '../../helpers/known-bug';

const channel = new FakeChannel();
const pg = new FakePg();
const redis = new FakeRedis();
vi.mock('@infrastructure/rabbitmq', () => ({ getChannel: () => channel }));
vi.mock('@infrastructure/db/postgres', () => ({ getPg: () => pg }));
vi.mock('@infrastructure/redis', () => ({ getRedis: () => redis }));

const insertMany = vi.fn();
vi.mock('@modules/logs/logs.schema', () => ({ ApiLog: { insertMany: (...a: unknown[]) => insertMany(...a) } }));
const rumInsertMany = vi.fn();
vi.mock('@modules/rum/rum.schema', () => ({ RumRawEvent: { insertMany: (...a: unknown[]) => rumInsertMany(...a) } }));
const createInsight = vi.fn();
vi.mock('@modules/insights/insights.repository', () => ({ InsightsRepository: class { createInsight = createInsight; } }));

const alertsRepo = { getActiveRules: vi.fn(), getRecentMetrics: vi.fn(), logAlertEvent: vi.fn() };
vi.mock('@modules/alerts/alerts.repository', () => ({ AlertsRepository: class { constructor() { return alertsRepo; } } }));

const { RawLogWorker } = await import('@workers/raw-log.worker');
const { AggregationWorker } = await import('@workers/aggregation.worker');
const { AnomalyWorker } = await import('@workers/anomaly.worker');
const { RumWorker } = await import('@workers/rum.worker');
const { AlertWorker } = await import('@workers/alert.worker');
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
    // [project, endpoint, method, bucket, count, errors, p50, p95, p99, avg, satisfied, tolerating, frustrated]
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

  knownBug('KI-9', 'hour buckets are computed in UTC regardless of server timezone', async () => {
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

  knownBug('KI-8', 'merging two batches keeps a request-weighted average (upsert SQL)', async () => {
    await channel.deliver('aggregation_queue', [log()]);
    const sql = pg.calls.find((c) => c.sql.includes('INSERT INTO hourly_metrics'))!.sql;
    expect(sql).not.toMatch(/avg_ms\s*=\s*\(hourly_metrics\.avg_ms \+ EXCLUDED\.avg_ms\) \/ 2/);
  });
});

describe('AnomalyWorker', () => {
  beforeEach(async () => {
    createInsight.mockReset();
    await new AnomalyWorker().start();
  });

  it('builds a 20-point p99 baseline per endpoint with a 1h TTL', async () => {
    for (let i = 0; i < 25; i++) await channel.deliver('anomaly_queue', [log({ latencyMs: 10 + (i % 3) })]);
    const key = `baseline:${PROJECT_A}:/a:p99`;
    expect(redis.lists.get(key)).toHaveLength(20);
    expect(redis.ttl.get(key)).toBe(3600);
    expect(createInsight).not.toHaveBeenCalled();
  });

  it('creates an insight and emits anomaly.detected when z > 3', async () => {
    const events: any[] = [];
    eventBus.once('anomaly.detected', (p) => events.push(p));
    for (const v of [10, 12, 11, 13, 10, 12]) await channel.deliver('anomaly_queue', [log({ latencyMs: v })]);
    await channel.deliver('anomaly_queue', [log({ latencyMs: 5000 })]);
    expect(createInsight).toHaveBeenCalledWith(expect.objectContaining({ projectId: PROJECT_A, endpoint: '/a', type: 'latency_spike', severity: 'warning' }));
    expect(events[0]).toMatchObject({ projectId: PROJECT_A, endpoint: '/a', type: 'latency_spike' });
  });

  it('dead-letters on failure', async () => {
    createInsight.mockRejectedValueOnce(new Error('pg down'));
    for (const v of [10, 12, 11, 13, 10, 12]) await channel.deliver('anomaly_queue', [log({ latencyMs: v })]);
    await channel.deliver('anomaly_queue', [log({ latencyMs: 9000 })]);
    expect(channel.nacked).toHaveLength(1);
  });

  knownBug('KI-27', 'baselines are kept per method (GET and POST on the same path are separate)', async () => {
    await channel.deliver('anomaly_queue', [log({ method: 'POST' })]);
    expect([...redis.lists.keys()].some((k) => k.includes('POST'))).toBe(true);
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

describe('AlertWorker', () => {
  const rule = (o: Record<string, unknown> = {}) => ({
    id: 1, project_id: PROJECT_A, name: 'r', condition_type: 'error_rate_high', endpoint_filter: null, threshold: 5, window_minutes: 5, notify_webhook: null, ...o,
  });
  const worker = new AlertWorker() as unknown as { evaluateRules(): Promise<void>; start(): void; interval: NodeJS.Timeout | null };
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    Object.values(alertsRepo).forEach((f) => f.mockReset());
    fetchMock = vi.fn(async () => new Response('ok'));
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    if (worker.interval) clearInterval(worker.interval);
  });

  it('fires on error rate above threshold, logs the event, emits and calls the webhook', async () => {
    const emitted: any[] = [];
    eventBus.once('alert.triggered', (p) => emitted.push(p));
    alertsRepo.getActiveRules.mockResolvedValue([rule({ notify_webhook: 'https://hooks.example/x' })]);
    alertsRepo.getRecentMetrics.mockResolvedValue({ total_requests: 100, total_errors: 6, max_p99: 0 });
    await worker.evaluateRules();
    expect(alertsRepo.getRecentMetrics).toHaveBeenCalledWith(PROJECT_A, null, 5);
    expect(alertsRepo.logAlertEvent).toHaveBeenCalledWith(1, PROJECT_A, expect.stringContaining('6.00%'));
    expect(emitted[0]).toMatchObject({ alertRuleId: 1, projectId: PROJECT_A, severity: 'critical' });
    expect(fetchMock).toHaveBeenCalledWith('https://hooks.example/x', expect.objectContaining({ method: 'POST' }));
  });

  it('does not fire at or below threshold, or with zero traffic', async () => {
    alertsRepo.getActiveRules.mockResolvedValue([rule(), rule({ id: 2 })]);
    alertsRepo.getRecentMetrics
      .mockResolvedValueOnce({ total_requests: 100, total_errors: 5, max_p99: 0 })
      .mockResolvedValueOnce({ total_requests: 0, total_errors: 0, max_p99: 0 });
    await worker.evaluateRules();
    expect(alertsRepo.logAlertEvent).not.toHaveBeenCalled();
  });

  it('fires on p99 latency above threshold', async () => {
    alertsRepo.getActiveRules.mockResolvedValue([rule({ condition_type: 'latency_p99_high', threshold: 500 })]);
    alertsRepo.getRecentMetrics.mockResolvedValue({ total_requests: 1, total_errors: 0, max_p99: 900 });
    await worker.evaluateRules();
    expect(alertsRepo.logAlertEvent).toHaveBeenCalledWith(1, PROJECT_A, expect.stringContaining('900ms'));
  });

  it('survives repository and webhook failures', async () => {
    alertsRepo.getActiveRules.mockRejectedValueOnce(new Error('pg down'));
    await expect(worker.evaluateRules()).resolves.toBeUndefined();
    alertsRepo.getActiveRules.mockResolvedValue([rule({ notify_webhook: 'https://hooks.example/x' })]);
    alertsRepo.getRecentMetrics.mockResolvedValue({ total_requests: 10, total_errors: 10, max_p99: 0 });
    fetchMock.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    await expect(worker.evaluateRules()).resolves.toBeUndefined();
  });

  knownBug('KI-6', 'webhooks to private/loopback/metadata addresses are refused (SSRF)', async () => {
    alertsRepo.getActiveRules.mockResolvedValue([rule({ notify_webhook: 'http://169.254.169.254/latest/meta-data' })]);
    alertsRepo.getRecentMetrics.mockResolvedValue({ total_requests: 10, total_errors: 10, max_p99: 0 });
    await worker.evaluateRules();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  knownBug('KI-18', 'a rule that stays breached does not re-notify every minute (cooldown)', async () => {
    alertsRepo.getActiveRules.mockResolvedValue([rule({ notify_webhook: 'https://hooks.example/x' })]);
    alertsRepo.getRecentMetrics.mockResolvedValue({ total_requests: 10, total_errors: 10, max_p99: 0 });
    await worker.evaluateRules();
    await worker.evaluateRules();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
