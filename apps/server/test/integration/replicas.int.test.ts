import { describe, expect, it } from 'vitest';
import { getStack, redisClient, waitFor } from './harness';

describe('running several replicas (real Redis, KI-20)', () => {
  it('events cross between processes through Redis pub/sub, once each, no echo', async () => {
    await getStack();
    const { TypedEventBus } = await import('@events/event-bus');
    const redis = await redisClient();
    const a = new TypedEventBus('it-replica-a');
    const b = new TypedEventBus('it-replica-b');
    await a.connectBridge(redis, redis.duplicate());
    await b.connectBridge(redis, redis.duplicate());
    try {
      const seenA: string[] = [];
      const seenB: string[] = [];
      a.on('anomaly.detected', (p) => seenA.push(p.endpoint));
      b.on('anomaly.detected', (p) => seenB.push(p.endpoint));

      a.emit('anomaly.detected', { projectId: 'p', endpoint: '/from-a', type: 'latency_spike', meta: {} });
      b.emit('anomaly.detected', { projectId: 'p', endpoint: '/from-b', type: 'error_surge', meta: {} });

      await waitFor(async () => seenA.length === 2 && seenB.length === 2, { label: 'both events on both replicas', timeoutMs: 5000 });
      await new Promise((r) => setTimeout(r, 200)); // anything extra would arrive by now
      expect(seenA.sort()).toEqual(['/from-a', '/from-b']);
      expect(seenB.sort()).toEqual(['/from-a', '/from-b']);
    } finally {
      await a.disconnectBridge();
      await b.disconnectBridge();
    }
  });

  it('two alert workers racing for the same minute: exactly one runs the pass', async () => {
    await getStack();
    const { AlertWorker, ALERT_PASS_LOCK_KEY } = await import('@workers/alert.worker');
    const redis = await redisClient();
    await redis.del(ALERT_PASS_LOCK_KEY);
    const results = await Promise.all([new AlertWorker().evaluateRules(), new AlertWorker().evaluateRules(), new AlertWorker().evaluateRules()]);
    expect(results.filter(Boolean)).toHaveLength(1);
    const ttl = await redis.pttl(ALERT_PASS_LOCK_KEY);
    expect(ttl).toBeGreaterThan(50_000);
    expect(ttl).toBeLessThanOrEqual(55_000);
    await redis.del(ALERT_PASS_LOCK_KEY); // leave other tests unaffected
  });
});
