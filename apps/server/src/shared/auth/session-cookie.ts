import type { Response } from 'express';
import { config } from '@config';
import { serializeCookie } from '@shared/utils/cookie.utils';

/**
 * The refresh token travels to browsers only as an httpOnly cookie, so page scripts (and
 * any XSS) can't read it. Attributes come from config:
 * - Secure: on by default in production (COOKIE_SECURE)
 * - SameSite: lax by default; use none (+ Secure) only if the web app and API are on
 *   different sites (COOKIE_SAMESITE)
 * - Domain: unset by default = API host only (COOKIE_DOMAIN)
 */
export const REFRESH_COOKIE = 'refresh_token';
export const REFRESH_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

/** Header a browser must send when refreshing with the cookie. Custom headers force a CORS preflight, so other sites can't make the browser do it. */
export const CSRF_HEADER = 'x-requested-with';

function cookie(value: string, maxAgeSeconds: number): string {
  return serializeCookie(REFRESH_COOKIE, value, {
    httpOnly: true,
    secure: config.COOKIE_SECURE,
    sameSite: config.COOKIE_SAMESITE,
    domain: config.COOKIE_DOMAIN,
    path: '/',
    maxAgeSeconds,
  });
}

/** Sets the refresh cookie and exposes the access token in X-Access-Token. */
export function setSessionCookies(res: Response, accessToken: string, refreshToken: string): void {
  res.setHeader('Set-Cookie', [cookie(refreshToken, REFRESH_COOKIE_MAX_AGE_SECONDS)]);
  res.setHeader('X-Access-Token', accessToken);
}

export function clearSessionCookies(res: Response): void {
  res.setHeader('Set-Cookie', [cookie('', 0)]);
}
