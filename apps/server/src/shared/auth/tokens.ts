import crypto from 'crypto';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { config } from '@config';

/**
 * Single place where JWTs are signed and verified.
 *
 * Every token carries a `tokenType` claim and each type is signed with its own key,
 * so a token minted for one purpose (e.g. a 30-day refresh token or an OAuth state)
 * can never be accepted where another purpose is expected (e.g. as an access token).
 */
export type TokenType = 'access' | 'refresh' | 'oauth_state';

const ALGORITHM = 'HS256' as const;

export const TOKEN_TTL: Record<TokenType, jwt.SignOptions['expiresIn']> = {
  access: '15m',
  refresh: '30d',
  oauth_state: '10m',
};

const derivedSecrets = new Map<string, string>();

function deriveSecret(purpose: TokenType): string {
  const cacheKey = `${purpose}:${config.JWT_SECRET}`;
  let secret = derivedSecrets.get(cacheKey);
  if (!secret) {
    secret = crypto.createHmac('sha256', config.JWT_SECRET).update(`apexmonitor:jwt:${purpose}`).digest('base64url');
    derivedSecrets.set(cacheKey, secret);
  }
  return secret;
}

/** Signing key per token type. Refresh uses JWT_REFRESH_SECRET when set, otherwise a key derived from JWT_SECRET. */
export function secretFor(type: TokenType): string {
  if (type === 'access') return config.JWT_SECRET;
  if (type === 'refresh' && config.JWT_REFRESH_SECRET) return config.JWT_REFRESH_SECRET;
  return deriveSecret(type);
}

export class InvalidTokenError extends Error {
  constructor(public readonly expectedType: TokenType) {
    super('INVALID_TOKEN');
    this.name = 'InvalidTokenError';
  }
}

export function signToken(type: TokenType, claims: Record<string, unknown>): string {
  return jwt.sign({ ...claims, tokenType: type }, secretFor(type), {
    algorithm: ALGORITHM,
    expiresIn: TOKEN_TTL[type],
  });
}

/** Verifies signature, expiry, algorithm and `tokenType`. Throws InvalidTokenError on any failure. */
export function verifyToken(type: TokenType, token: string): JwtPayload {
  let payload: string | JwtPayload;
  try {
    payload = jwt.verify(token, secretFor(type), { algorithms: [ALGORITHM] });
  } catch {
    throw new InvalidTokenError(type);
  }

  if (typeof payload !== 'object' || payload === null || payload.tokenType !== type) {
    throw new InvalidTokenError(type);
  }

  return payload;
}

export interface TokenUser {
  id: string;
  email: string;
}

function toUser(type: TokenType, payload: JwtPayload): TokenUser {
  const { sub, email } = payload as { sub?: unknown; email?: unknown };
  if (typeof sub !== 'string' || !sub || typeof email !== 'string' || !email) {
    throw new InvalidTokenError(type);
  }
  return { id: sub, email };
}

export function signAccessToken(user: TokenUser): string {
  return signToken('access', { sub: user.id, email: user.email });
}

export function signRefreshToken(user: TokenUser): string {
  return signToken('refresh', { sub: user.id, email: user.email });
}

export function verifyAccessToken(token: string): TokenUser {
  return toUser('access', verifyToken('access', token));
}

export function verifyRefreshToken(token: string): TokenUser {
  return toUser('refresh', verifyToken('refresh', token));
}
