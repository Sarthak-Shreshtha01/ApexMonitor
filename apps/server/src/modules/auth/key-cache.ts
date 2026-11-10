import crypto from 'crypto';
import type Redis from 'ioredis';

/**
 * Redis cache for validated API / RUM keys, so ingest doesn't run argon2 on every request.
 *
 * - Cache entries are named by sha256(rawKey), never by the raw secret, so anyone who can
 *   list Redis keys (or read a dump) cannot recover working keys.
 * - Revoking a key evicts its entry immediately. Revocation knows the key's id, not the
 *   raw key, so each entry has a `ref:<id>` pointer to its digest.
 * - Race with an in-flight validation (it read the row before the revoke committed and is
 *   about to write the cache): revoke writes a `revoked:<id>` tombstone *before* deleting,
 *   and the cache write is a Lua script that refuses to run while a tombstone exists.
 *   Redis runs scripts atomically, so the write lands either before the delete (and is
 *   deleted) or after the tombstone (and is refused).
 */

export type KeyKind = 'api' | 'rum';

export const KEY_CACHE_TTL_SECONDS = 300;
/** Must outlive the slowest validation that could still be in flight when a key is revoked. */
export const REVOKED_TOMBSTONE_TTL_SECONDS = 600;

const NAMESPACE: Record<KeyKind, string> = { api: 'api_key', rum: 'rum_key' };

export const digestKey = (rawKey: string): string => crypto.createHash('sha256').update(rawKey).digest('hex');

export const keyCacheNames = (kind: KeyKind, keyId: number | string, digest = '') => ({
  cache: `${NAMESPACE[kind]}:cache:${digest}`,
  ref: `${NAMESPACE[kind]}:ref:${keyId}`,
  revoked: `${NAMESPACE[kind]}:revoked:${keyId}`,
});

/** KEYS: cache, ref, revoked. ARGV: value, digest, ttl. Returns 1 if cached, 0 if the key was revoked. */
export const CACHE_UNLESS_REVOKED_LUA = `
if redis.call('EXISTS', KEYS[3]) == 1 then return 0 end
redis.call('SET', KEYS[1], ARGV[1], 'EX', ARGV[3])
redis.call('SET', KEYS[2], ARGV[2], 'EX', ARGV[3])
return 1
`;

export async function readCachedKey<T>(redis: Redis, kind: KeyKind, rawKey: string): Promise<T | null> {
  const raw = await redis.get(keyCacheNames(kind, '', digestKey(rawKey)).cache);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null; // unreadable entry: treat as a miss and re-validate
  }
}

/** Caches a validated key. Returns false (and caches nothing) if the key was revoked meanwhile. */
export async function cacheValidatedKey(redis: Redis, kind: KeyKind, rawKey: string, keyId: number | string, value: unknown): Promise<boolean> {
  const digest = digestKey(rawKey);
  const names = keyCacheNames(kind, keyId, digest);
  const stored = await redis.eval(
    CACHE_UNLESS_REVOKED_LUA,
    3,
    names.cache,
    names.ref,
    names.revoked,
    JSON.stringify(value),
    digest,
    KEY_CACHE_TTL_SECONDS,
  );
  return Number(stored) === 1;
}

/** Call after the key is marked revoked in the database. */
export async function evictRevokedKey(redis: Redis, kind: KeyKind, keyId: number | string): Promise<void> {
  const names = keyCacheNames(kind, keyId);
  await redis.set(names.revoked, '1', 'EX', REVOKED_TOMBSTONE_TTL_SECONDS);
  const digest = await redis.get(names.ref);
  const doomed = [names.ref];
  if (digest) doomed.push(keyCacheNames(kind, keyId, digest).cache);
  await redis.del(...doomed);
}
