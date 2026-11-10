import crypto from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { api, createIngestKey, createRumKey, getStack, logEntry, mongoCount, pgQuery, registerTenant, Tenant, waitFor } from './harness';
import { knownBug } from '../helpers/known-bug';
import { ApexApiError, createApexClient } from '../../../../packages/sdk/src/index';
import { createBrowserRumClient } from '../../../../packages/browser-sdk/src/index';

describe('TypeScript SDK against the live server', () => {
  let t: Tenant;
  let key: string;
  let baseUrl: string;

  beforeAll(async () => {
    baseUrl = (await getStack()).baseUrl;
    t = await registerTenant('sdk');
    key = (await createIngestKey(t)).key;
  });

  it('ingest.batch with apiKey auth is accepted and stored', async () => {
    const client = createApexClient({ baseUrl, auth: { type: 'apiKey', key } });
    const endpoint = `/sdk/x${crypto.randomUUID().slice(0, 6)}`;
    const result = await client.ingest.batch<{ status: string; received: number }>({ projectId: t.projectId, logs: [logEntry({ endpoint })] });
    expect(result).toMatchObject({ status: 'queued', received: 1 });
    await waitFor(async () => (await mongoCount('api_logs', { projectId: t.projectId, endpoint })) === 1, { label: 'sdk log stored' });
  });

  it('bearer auth reads projects and unwraps the envelope', async () => {
    const client = createApexClient({ baseUrl, auth: { type: 'bearer', token: async () => t.accessToken } });
    const data = await client.projects.listMine<{ projects: Array<{ id: string }> }>();
    expect(data.projects[0].id).toBe(t.projectId);
  });

  it('surfaces server errors as ApexApiError with code and requestId (no retry on 403)', async () => {
    const other = await registerTenant('sdk-other');
    const client = createApexClient({ baseUrl, auth: { type: 'bearer', token: other.accessToken } });
    const err = await client.logs.list({ projectId: t.projectId }).catch((e) => e);
    expect(err).toBeInstanceOf(ApexApiError);
    expect(err).toMatchObject({ status: 403, code: 'FORBIDDEN', isRetryable: false });
    expect(err.requestId).toBeTruthy();
  });

  knownBug('KI-33', 'SDK idempotencyKey deduplicates batches on the server', async () => {
    const client = createApexClient({ baseUrl, auth: { type: 'apiKey', key } });
    const idempotencyKey = `sdk-${crypto.randomUUID()}`;
    const a = await client.ingest.batch<{ batchId: string }>({ logs: [logEntry()] }, { idempotencyKey });
    const b = await client.ingest.batch<{ batchId: string }>({ logs: [logEntry()] }, { idempotencyKey });
    expect(b.batchId).toBe(a.batchId);
  });

  knownBug('KI-12', 'metrics.rps is served by the server', async () => {
    const client = createApexClient({ baseUrl, auth: { type: 'bearer', token: t.accessToken }, retry: { maxRetries: 0 } });
    await expect(client.metrics.rps({ projectId: t.projectId })).resolves.toBeDefined();
  });

  knownBug('KI-10', 'browser SDK batches are accepted by the RUM endpoint', async () => {
    const rumKey = await createRumKey(t);
    const rum = createBrowserRumClient({ baseUrl, projectId: t.projectId, rumKey });
    rum.trackPageView('/landing');
    rum.trackWebVitals({ lcpMs: 1200 });
    await expect(rum.flush({ timeoutMs: 5000 })).resolves.toBeUndefined();
  });
});

describe('RabbitMQ dead-lettering (real stack)', () => {
  it('a message rejected by a worker lands in its dead-letter queue (KI-32)', async () => {
    await getStack();
    const { getChannel } = await import('@infrastructure/rabbitmq');
    const channel = getChannel();
    const before = (await channel.checkQueue('aggregation_dlq')).messageCount;
    // Poison message: not JSON, so AggregationWorker nacks it without requeue.
    channel.publish('logs.exchange', 'log.ingest', Buffer.from('not-json'), { persistent: true });
    await new Promise((r) => setTimeout(r, 1500));
    expect((await channel.checkQueue('aggregation_dlq')).messageCount).toBe(before + 1);
  });

  it('a poison message does not stop the consumers', async () => {
    const t = await registerTenant('after-poison');
    const { key } = await createIngestKey(t);
    expect((await api('POST', '/api/v1/ingest', { apiKey: key, body: { logs: [logEntry()] } })).status).toBe(202);
    await waitFor(async () => (await mongoCount('api_logs', { projectId: t.projectId })) === 1, { label: 'log after poison' });
  });
});

describe('RabbitMQ connection loss (real broker, KI-16)', () => {
  const mgmt = async (path: string, init: RequestInit = {}) => {
    const { testUrls, TEST_DB } = await import('../setup/integration-urls');
    const auth = Buffer.from(`${testUrls.rabbitUser}:${testUrls.rabbitPass}`).toString('base64');
    const url = `${testUrls.rabbitMgmt}/api${path.replace('{vhost}', encodeURIComponent(TEST_DB))}`;
    return fetch(url, { ...init, headers: { authorization: `Basic ${auth}`, 'x-reason': 'integration test', ...(init.headers ?? {}) } });
  };

  it('answers 503 while the broker connection is gone, then reconnects and resumes consuming', async () => {
    await getStack();
    const rabbit = await import('@infrastructure/rabbitmq');
    const t = await registerTenant('broker-drop');
    const { key } = await createIngestKey(t);

    // Kill every connection the server holds to the test vhost, like a broker restart would.
    let names: string[] = [];
    await waitFor(async () => {
      names = ((await (await mgmt('/vhosts/{vhost}/connections')).json()) as { name: string }[]).map((c) => c.name);
      return names.length > 0;
    }, { label: 'management API lists the connection' });
    for (const name of names) expect((await mgmt(`/connections/${encodeURIComponent(name)}`, { method: 'DELETE' })).status).toBe(204);

    await waitFor(async () => !rabbit.isRabbitConnected(), { label: 'connection loss noticed' });
    const during = await api('POST', '/api/v1/ingest', { apiKey: key, body: { logs: [logEntry()] } });
    expect(during.status).toBe(503);
    expect(during.headers.get('retry-after')).toBe('5');
    expect((await api('GET', '/ready')).status).toBe(503);

    await waitFor(async () => rabbit.isRabbitConnected(), { label: 'reconnected', timeoutMs: 20_000 });
    expect((await api('GET', '/ready')).status).toBe(200);
    const after = await api('POST', '/api/v1/ingest', { apiKey: key, body: { logs: [logEntry()] } });
    expect(after.status).toBe(202);
    // Consumers were re-registered on the new connection: the batch reaches Mongo and Postgres.
    await waitFor(async () => (await mongoCount('api_logs', { projectId: t.projectId })) === 1, { label: 'raw log after reconnect' });
    await waitFor(async () => (await pgQuery('SELECT 1 FROM hourly_metrics WHERE project_id = $1', [t.projectId])).length > 0, {
      label: 'aggregate after reconnect',
    });
  }, 40_000);
});
