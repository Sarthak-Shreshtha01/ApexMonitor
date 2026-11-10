import { describe, expect, it } from 'vitest';
import { ROUTES } from '@/shared/routes/routes';
import { loginUrlFor, nextPathFromSearch, proxyRedirectFor, safeNextPath } from '@/shared/routes/session-gate';
import { config } from '@/proxy';

describe('safeNextPath (open-redirect guard)', () => {
  it.each([
    ['/keys', '/keys'],
    ['/traces/abc?range=24h', '/traces/abc?range=24h'],
    [ROUTES.dashboard.alerts, ROUTES.dashboard.alerts],
  ])('keeps dashboard path %s', (raw, expected) => {
    expect(safeNextPath(raw)).toBe(expected);
  });

  it.each([
    [null],
    [''],
    ['https://evil.example/keys'],
    ['//evil.example/keys'],
    ['/\\evil.example'],
    ['javascript:alert(1)'],
    ['keys'],
    [ROUTES.auth.login],
    [`${ROUTES.auth.login}?next=/keys`],
    ['/keys\n'],
  ])('falls back to the overview for %j', (raw) => {
    expect(safeNextPath(raw)).toBe(ROUTES.dashboard.overview);
  });

  it('reads ?next= from a search string', () => {
    expect(nextPathFromSearch('?next=%2Ftraces%2Ft1%3Frange%3D1h')).toBe('/traces/t1?range=1h');
    expect(nextPathFromSearch('?next=https%3A%2F%2Fevil.example')).toBe(ROUTES.dashboard.overview);
    expect(nextPathFromSearch('')).toBe(ROUTES.dashboard.overview);
  });
});

describe('loginUrlFor', () => {
  it('carries the page (and its query) in ?next=', () => {
    expect(loginUrlFor('/logs', '?level=error')).toBe('/login?next=%2Flogs%3Flevel%3Derror');
    expect(nextPathFromSearch(loginUrlFor('/logs', '?level=error').split('?')[1])).toBe('/logs?level=error');
  });

  it('plain /login for the overview, the default landing page', () => {
    expect(loginUrlFor(ROUTES.dashboard.overview)).toBe(ROUTES.auth.login);
  });
});

describe('proxy gate (KI-30)', () => {
  const base = { pathname: '/keys', search: '', hasRefreshCookie: false, cookieCheckEnabled: true };

  it('redirects a dashboard page without the refresh cookie to /login?next=', () => {
    expect(proxyRedirectFor(base)).toBe('/login?next=%2Fkeys');
  });

  it('lets the request through with the cookie, on public pages, or when the check is off', () => {
    expect(proxyRedirectFor({ ...base, hasRefreshCookie: true })).toBeNull();
    expect(proxyRedirectFor({ ...base, pathname: ROUTES.auth.login })).toBeNull();
    expect(proxyRedirectFor({ ...base, pathname: ROUTES.home })).toBeNull();
    expect(proxyRedirectFor({ ...base, cookieCheckEnabled: false })).toBeNull();
  });

  it('matcher skips API routes, Next assets and files', () => {
    const re = new RegExp(`^${config.matcher[0]}$`);
    expect(re.test('/keys')).toBe(true);
    expect(re.test('/traces/t1')).toBe(true);
    expect(re.test('/_next/static/chunk.js')).toBe(false);
    expect(re.test('/api/health')).toBe(false);
    expect(re.test('/favicon.ico')).toBe(false);
  });
});
