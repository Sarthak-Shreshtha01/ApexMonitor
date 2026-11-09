import { afterEach, describe, expect, it, vi } from 'vitest';
import jwt from 'jsonwebtoken';
import { config } from '@config';
import {
  InvalidTokenError,
  secretFor,
  signAccessToken,
  signRefreshToken,
  signToken,
  verifyAccessToken,
  verifyRefreshToken,
  verifyToken,
} from '@shared/auth/tokens';

const user = { id: 'usr_123', email: 'a@example.test' };

describe('shared/auth/tokens', () => {
  afterEach(() => {
    vi.useRealTimers();
    delete (config as { JWT_REFRESH_SECRET?: string }).JWT_REFRESH_SECRET;
  });

  it('round-trips access and refresh tokens', () => {
    expect(verifyAccessToken(signAccessToken(user))).toEqual(user);
    expect(verifyRefreshToken(signRefreshToken(user))).toEqual(user);
  });

  it('embeds tokenType and expiries (15m access, 30d refresh, 10m oauth state)', () => {
    const access = jwt.decode(signAccessToken(user)) as jwt.JwtPayload;
    const refresh = jwt.decode(signRefreshToken(user)) as jwt.JwtPayload;
    const state = jwt.decode(signToken('oauth_state', { provider: 'google' })) as jwt.JwtPayload;
    expect(access.tokenType).toBe('access');
    expect(refresh.tokenType).toBe('refresh');
    expect(state.tokenType).toBe('oauth_state');
    expect(access.exp! - access.iat!).toBe(15 * 60);
    expect(refresh.exp! - refresh.iat!).toBe(30 * 24 * 60 * 60);
    expect(state.exp! - state.iat!).toBe(10 * 60);
  });

  it('KI-3: rejects a refresh token where an access token is required', () => {
    expect(() => verifyAccessToken(signRefreshToken(user))).toThrow(InvalidTokenError);
  });

  it('rejects an access token where a refresh token is required', () => {
    expect(() => verifyRefreshToken(signAccessToken(user))).toThrow(InvalidTokenError);
  });

  it('rejects an OAuth state token as an access token', () => {
    expect(() => verifyAccessToken(signToken('oauth_state', { sub: user.id, email: user.email }))).toThrow(InvalidTokenError);
  });

  it('rejects a token signed with the access key but claiming tokenType refresh (legacy refresh tokens)', () => {
    const legacy = jwt.sign({ sub: user.id, email: user.email, tokenType: 'refresh' }, config.JWT_SECRET, { expiresIn: '30d' });
    expect(() => verifyAccessToken(legacy)).toThrow(InvalidTokenError);
    expect(() => verifyRefreshToken(legacy)).toThrow(InvalidTokenError);
  });

  it('rejects an access-key token with no tokenType claim', () => {
    const untyped = jwt.sign({ sub: user.id, email: user.email }, config.JWT_SECRET);
    expect(() => verifyAccessToken(untyped)).toThrow(InvalidTokenError);
  });

  it('rejects tokens missing sub or email', () => {
    expect(() => verifyAccessToken(signToken('access', { email: user.email }))).toThrow(InvalidTokenError);
    expect(() => verifyAccessToken(signToken('access', { sub: user.id }))).toThrow(InvalidTokenError);
    expect(() => verifyAccessToken(signToken('access', { sub: '', email: user.email }))).toThrow(InvalidTokenError);
  });

  it('rejects tampered, foreign-key and garbage tokens', () => {
    const token = signAccessToken(user);
    const [h, p, s] = token.split('.');
    const forgedPayload = Buffer.from(JSON.stringify({ sub: 'usr_admin', email: 'x@x', tokenType: 'access' })).toString('base64url');
    expect(() => verifyAccessToken(`${h}.${forgedPayload}.${s}`)).toThrow(InvalidTokenError);
    expect(() => verifyAccessToken(`${h}.${p}.${s}x`)).toThrow(InvalidTokenError);
    expect(() => verifyAccessToken(jwt.sign({ sub: 'u', email: 'e', tokenType: 'access' }, 'some-other-secret-that-is-long-enough'))).toThrow(InvalidTokenError);
    expect(() => verifyAccessToken('not-a-jwt')).toThrow(InvalidTokenError);
    expect(() => verifyAccessToken('')).toThrow(InvalidTokenError);
  });

  it('rejects alg=none tokens', () => {
    const none = jwt.sign({ sub: user.id, email: user.email, tokenType: 'access' }, '', { algorithm: 'none' } as jwt.SignOptions);
    expect(() => verifyAccessToken(none)).toThrow(InvalidTokenError);
  });

  it('rejects expired tokens', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    const token = signAccessToken(user);
    vi.setSystemTime(new Date('2026-01-01T00:16:00Z'));
    expect(() => verifyAccessToken(token)).toThrow(InvalidTokenError);
  });

  it('uses distinct keys per token type', () => {
    expect(secretFor('access')).toBe(config.JWT_SECRET);
    expect(secretFor('refresh')).not.toBe(config.JWT_SECRET);
    expect(secretFor('oauth_state')).not.toBe(config.JWT_SECRET);
    expect(secretFor('refresh')).not.toBe(secretFor('oauth_state'));
    expect(secretFor('refresh')).toBe(secretFor('refresh'));
  });

  it('uses JWT_REFRESH_SECRET for refresh tokens when configured', () => {
    const derivedToken = signRefreshToken(user);
    (config as { JWT_REFRESH_SECRET?: string }).JWT_REFRESH_SECRET = 'dedicated-refresh-secret-0123456789abcdef';
    expect(secretFor('refresh')).toBe('dedicated-refresh-secret-0123456789abcdef');
    expect(verifyRefreshToken(signRefreshToken(user))).toEqual(user);
    expect(() => verifyRefreshToken(derivedToken)).toThrow(InvalidTokenError);
  });

  it('verifyToken returns the payload for the matching type', () => {
    const payload = verifyToken('oauth_state', signToken('oauth_state', { provider: 'github', mode: 'login' }));
    expect(payload).toMatchObject({ provider: 'github', mode: 'login', tokenType: 'oauth_state' });
  });
});
