import type Redis from 'ioredis';

/**
 * Per-project rate limiting by EVENTS per minute, with a sliding window.
 *
 * Sliding-window counter: the count for the current minute plus the previous minute's count
 * weighted by how much of it still overlaps the last 60 s. That removes the burst a fixed
 * window allows at the minute boundary (up to 2× the limit) at the cost of one extra key.
 *
 * The check and the increment are one Lua script, so concurrent requests can't both slip
 * under the limit. A request that would exceed the limit is refused whole and costs nothing.
 */

export const WINDOW_MS = 60_000;

/** KEYS: current, previous. ARGV: cost, limit, previous-window weight, ttl seconds. Returns {allowed, used}. */
export const SLIDING_WINDOW_LUA = `
local cur = tonumber(redis.call('GET', KEYS[1]) or '0')
local prev = tonumber(redis.call('GET', KEYS[2]) or '0')
local cost = tonumber(ARGV[1])
local limit = tonumber(ARGV[2])
local used = math.floor(prev * tonumber(ARGV[3])) + cur
if used + cost > limit then return {0, used} end
redis.call('INCRBY', KEYS[1], cost)
redis.call('EXPIRE', KEYS[1], tonumber(ARGV[4]))
return {1, used + cost}
`;

export interface RateDecision {
  allowed: boolean;
  limit: number;
  /** events still allowed in the current sliding window */
  remaining: number;
  /** when denied: seconds until the window has moved on enough to try again */
  retryAfterSeconds: number;
}

/** Thrown when a request is over its limit. The message stays RATE_LIMITED (→ 429). */
export class RateLimitedError extends Error {
  constructor(readonly decision: RateDecision) {
    super('RATE_LIMITED');
    this.name = 'RateLimitedError';
  }
}

export function windowKeys(scope: string, id: string, now: number) {
  const index = Math.floor(now / WINDOW_MS);
  const elapsed = (now % WINDOW_MS) / WINDOW_MS;
  return {
    current: `rate:${scope}:${id}:${index}`,
    previous: `rate:${scope}:${id}:${index - 1}`,
    previousWeight: 1 - elapsed,
    msUntilNextWindow: WINDOW_MS - (now % WINDOW_MS),
  };
}

/** Takes `cost` events from the budget, or refuses without taking anything. */
export async function takeFromBudget(redis: Redis, scope: string, id: string, cost: number, limit: number, now = Date.now()): Promise<RateDecision> {
  const keys = windowKeys(scope, id, now);
  const [allowed, used] = (await redis.eval(
    SLIDING_WINDOW_LUA,
    2,
    keys.current,
    keys.previous,
    cost,
    limit,
    keys.previousWeight.toFixed(6),
    Math.ceil((2 * WINDOW_MS) / 1000),
  )) as [number, number];
  return {
    allowed: Number(allowed) === 1,
    limit,
    remaining: Math.max(0, limit - Number(used)),
    retryAfterSeconds: Number(allowed) === 1 ? 0 : Math.max(1, Math.ceil(keys.msUntilNextWindow / 1000)),
  };
}

/** Same as takeFromBudget, but throws RateLimitedError when refused. */
export async function enforceRateLimit(redis: Redis, scope: string, id: string, cost: number, limit: number, now = Date.now()): Promise<RateDecision> {
  const decision = await takeFromBudget(redis, scope, id, cost, limit, now);
  if (!decision.allowed) throw new RateLimitedError(decision);
  return decision;
}
