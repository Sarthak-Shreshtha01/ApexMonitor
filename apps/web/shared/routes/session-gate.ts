import { PUBLIC_PATHS, ROUTES } from '@/shared/routes/routes';

/** Name of the httpOnly refresh cookie the API sets (apps/server/src/shared/auth/session-cookie.ts). */
export const REFRESH_COOKIE = 'refresh_token';

/** Query parameter that carries the page to return to after signing in. */
export const NEXT_PARAM = 'next';

export function isPublicPath(pathname: string): boolean {
  return (PUBLIC_PATHS as readonly string[]).includes(pathname);
}

/**
 * Returns `raw` only if it is a same-origin dashboard path, otherwise the overview.
 * Rejects absolute URLs, protocol-relative `//host` and `/\host` (open redirects) and
 * public pages (no point returning to /login after logging in).
 */
export function safeNextPath(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) {
    return ROUTES.dashboard.overview;
  }
  const pathname = raw.split(/[?#]/, 1)[0];
  if (isPublicPath(pathname) || /[\u0000-\u001f]/.test(raw)) return ROUTES.dashboard.overview;
  return raw;
}

/** `/login?next=<path+query>` for a dashboard page; plain `/login` for the overview. */
export function loginUrlFor(pathname: string, search = ''): string {
  const target = `${pathname}${search}`;
  if (pathname === ROUTES.dashboard.overview && !search) return ROUTES.auth.login;
  return `${ROUTES.auth.login}?${NEXT_PARAM}=${encodeURIComponent(target)}`;
}

/** Where to go after a successful sign-in, read from the current URL's `?next=`. */
export function nextPathFromSearch(search: string): string {
  return safeNextPath(new URLSearchParams(search).get(NEXT_PARAM));
}

/**
 * Server-side gate (proxy.ts). Redirects to the login page only when the refresh cookie is
 * visible to the dashboard and absent. The cookie is visible only when the dashboard and API
 * share a host, or the API sets COOKIE_DOMAIN to a parent domain of both. On other layouts the
 * dashboard never sees it, so the check is opt-in (WEB_SESSION_COOKIE_CHECK=true) and the
 * client-side RouteGate stays the fallback.
 */
export function proxyRedirectFor(input: {
  pathname: string;
  search: string;
  hasRefreshCookie: boolean;
  cookieCheckEnabled: boolean;
}): string | null {
  if (!input.cookieCheckEnabled || input.hasRefreshCookie || isPublicPath(input.pathname)) return null;
  return loginUrlFor(input.pathname, input.search);
}
