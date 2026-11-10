import { NextRequest, NextResponse } from 'next/server';
import { proxyRedirectFor, REFRESH_COOKIE } from '@/shared/routes/session-gate';

/**
 * Sends visitors without a session to /login before a dashboard page is rendered, so they
 * don't download an empty shell first. Opt-in: see proxyRedirectFor for when the API's
 * cookie is visible here. Real access control is the API (every data call needs a token).
 */
export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const target = proxyRedirectFor({
    pathname,
    search,
    hasRefreshCookie: Boolean(req.cookies.get(REFRESH_COOKIE)?.value),
    cookieCheckEnabled: process.env.WEB_SESSION_COOKIE_CHECK === 'true',
  });
  return target ? NextResponse.redirect(new URL(target, req.url)) : NextResponse.next();
}

export const config = {
  // Pages only: no API routes, Next assets, or files with an extension (public/ assets).
  matcher: ['/((?!api|_next/static|_next/image|.*\\..*).*)'],
};
