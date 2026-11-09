import { describe, expect, it } from 'vitest';
import { computeBatchStats, computePercentile } from '@shared/utils/math.utils';
import { calculateZScore } from '@shared/utils/anomaly.utils';
import { parseCookieHeader, serializeCookie } from '@shared/utils/cookie.utils';
import { errorBody, getRequestId, successBody } from '@shared/http/api-contract';

function fakeRes(requestId?: string) {
  return { getHeader: (name: string) => (name === 'x-request-id' ? requestId : undefined) } as never;
}

describe('math.utils', () => {
  it('returns 0 for empty input and the value for a single element', () => {
    expect(computePercentile([], 99)).toBe(0);
    expect(computePercentile([42], 50)).toBe(42);
  });

  it('interpolates linearly between ranks', () => {
    const sorted = [10, 20, 30, 40];
    expect(computePercentile(sorted, 0)).toBe(10);
    expect(computePercentile(sorted, 100)).toBe(40);
    expect(computePercentile(sorted, 50)).toBe(25);
    expect(computePercentile([1, 2, 3, 4, 5], 50)).toBe(3);
  });

  it('computes batch stats with rounding and 4xx/5xx as errors', () => {
    const stats = computeBatchStats([30, 10, 20, 40], [200, 404, 500, 302]);
    expect(stats).toEqual({ requestCount: 4, errorCount: 2, avg: 25, p50: 25, p95: 39, p99: 40 });
  });

  it('returns zeros for an empty batch', () => {
    expect(computeBatchStats([], [])).toEqual({ requestCount: 0, errorCount: 0, p50: 0, p95: 0, p99: 0, avg: 0 });
  });

  it('does not mutate the input array', () => {
    const latencies = [3, 1, 2];
    computeBatchStats(latencies, []);
    expect(latencies).toEqual([3, 1, 2]);
  });
});

describe('anomaly.utils.calculateZScore', () => {
  it('needs at least 5 history points', () => {
    expect(calculateZScore(1000, [1, 2, 3, 4])).toBe(0);
  });

  it('returns 0 when history has no variance', () => {
    expect(calculateZScore(1000, [5, 5, 5, 5, 5])).toBe(0);
  });

  it('computes population z-score', () => {
    // mean 3, population sd sqrt(2)
    expect(calculateZScore(3 + 3 * Math.SQRT2, [1, 2, 3, 4, 5])).toBeCloseTo(3, 10);
    expect(calculateZScore(1, [1, 2, 3, 4, 5])).toBeCloseTo(-Math.SQRT2, 10);
  });
});

describe('cookie.utils', () => {
  it('parses cookie headers including values containing "=" and encoded chars', () => {
    expect(parseCookieHeader(undefined)).toEqual({});
    expect(parseCookieHeader('a=1; refresh_token=x.y=z; b=%20sp')).toEqual({ a: '1', refresh_token: 'x.y=z', b: ' sp' });
    expect(parseCookieHeader('; ;empty=')).toEqual({ empty: '' });
  });

  it('serializes with secure defaults', () => {
    expect(serializeCookie('n', 'v')).toBe('n=v; Path=/; SameSite=Lax; HttpOnly');
  });

  it('serializes all options', () => {
    const c = serializeCookie('n v', 'a;b', { maxAgeSeconds: 10.9, httpOnly: false, secure: true, sameSite: 'none', path: '/x' });
    expect(c).toBe('n%20v=a%3Bb; Max-Age=10; Path=/x; SameSite=None; Secure');
    expect(serializeCookie('n', '', { sameSite: 'strict', maxAgeSeconds: 0 })).toBe('n=; Max-Age=0; Path=/; SameSite=Strict; HttpOnly');
  });
});

describe('api-contract', () => {
  it('wraps data with requestId and ISO timestamp', () => {
    const body = successBody(fakeRes('req-1'), { ok: true });
    expect(body.data).toEqual({ ok: true });
    expect(body.meta.requestId).toBe('req-1');
    expect(new Date(body.meta.timestamp).toISOString()).toBe(body.meta.timestamp);
  });

  it('builds error bodies and omits details when undefined', () => {
    expect(errorBody(fakeRes('r'), 'FORBIDDEN', 'nope')).toEqual({ error: 'FORBIDDEN', message: 'nope', requestId: 'r' });
    expect(errorBody(fakeRes('r'), 'X', 'm', { a: 1 })).toEqual({ error: 'X', message: 'm', requestId: 'r', details: { a: 1 } });
  });

  it('falls back to "unknown" request id', () => {
    expect(getRequestId(fakeRes(undefined))).toBe('unknown');
  });
});
