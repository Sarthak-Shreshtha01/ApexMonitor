import { describe, expect, it } from 'vitest';
import { FakeRedis } from '../../helpers/fakes';
import { enforceRateLimit, RateLimitedError, takeFromBudget, WINDOW_MS, windowKeys } from '@shared/rate-limit/sliding-window';

const t0 = 1_800_000_000_000 - (1_800_000_000_000 % WINDOW_MS); // start of a minute

describe('sliding-window rate limit (KI-19)', () => {
  it('counts cost (events) and refuses what would exceed the limit', async () => {
    const redis = new FakeRedis();
    expect(await takeFromBudget(redis as never, 'ingest', 'p', 70, 100, t0)).toMatchObject({ allowed: true, remaining: 30 });
    expect(await takeFromBudget(redis as never, 'ingest', 'p', 40, 100, t0 + 1000)).toMatchObject({ allowed: false, remaining: 30, retryAfterSeconds: 59 });
    expect(await takeFromBudget(redis as never, 'ingest', 'p', 30, 100, t0 + 2000)).toMatchObject({ allowed: true, remaining: 0 });
  });

  it("weights the previous minute by how much of it is still inside the last 60 s", async () => {
    const redis = new FakeRedis();
    await takeFromBudget(redis as never, 'ingest', 'p', 100, 100, t0 + 59_000); // full at the end of minute 0
    // 15 s into minute 1: 75% of the previous 100 still counts → 75 used, 25 free
    expect(await takeFromBudget(redis as never, 'ingest', 'p', 30, 100, t0 + WINDOW_MS + 15_000)).toMatchObject({ allowed: false });
    expect(await takeFromBudget(redis as never, 'ingest', 'p', 25, 100, t0 + WINDOW_MS + 15_000)).toMatchObject({ allowed: true, remaining: 0 });
    // A fixed window would have allowed 100 more right at the boundary.
  });

  it('keeps projects and scopes apart', async () => {
    const redis = new FakeRedis();
    await takeFromBudget(redis as never, 'ingest', 'a', 100, 100, t0);
    expect((await takeFromBudget(redis as never, 'ingest', 'b', 100, 100, t0)).allowed).toBe(true);
    expect((await takeFromBudget(redis as never, 'rum', 'a', 100, 100, t0)).allowed).toBe(true);
  });

  it('keys expire after two windows', () => {
    const k = windowKeys('ingest', 'p', t0 + 30_000);
    expect(k.current).toBe(`rate:ingest:p:${t0 / WINDOW_MS}`);
    expect(k.previous).toBe(`rate:ingest:p:${t0 / WINDOW_MS - 1}`);
    expect(k.previousWeight).toBeCloseTo(0.5);
  });

  it('enforceRateLimit throws RateLimitedError (message RATE_LIMITED) with the decision', async () => {
    const redis = new FakeRedis();
    const err = await enforceRateLimit(redis as never, 'ingest', 'p', 101, 100, t0).catch((e) => e);
    expect(err).toBeInstanceOf(RateLimitedError);
    expect(err.message).toBe('RATE_LIMITED');
    expect(err.decision).toMatchObject({ allowed: false, limit: 100 });
  });
});
