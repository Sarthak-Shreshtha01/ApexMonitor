import crypto from 'crypto';
import argon2 from 'argon2';
import { config } from '@config';

/**
 * How API and RUM keys are stored and found.
 *
 * - `key_prefix`: first 10 characters, shown in the UI so people can tell keys apart.
 *   Not unique: `pk_live_` keys have only 2 random characters in it.
 * - `key_lookup`: HMAC-SHA256 of the whole key (unique index). This is how a presented key
 *   finds its row. It is keyed with a secret derived from ARGON2_PEPPER, so a database dump
 *   alone can't be used to test guesses.
 * - `key_hash`: argon2id(key + pepper), checked after the lookup as a second factor.
 *
 * Keys created before `key_lookup` existed have it NULL; they are found by prefix (all
 * matching rows are tried) and the lookup hash is filled in the first time they verify.
 */

export const DISPLAY_PREFIX_LENGTH = 10;
/** Upper bound on legacy rows tried for one prefix, so a crafted prefix can't trigger unbounded argon2 work. */
export const MAX_LEGACY_CANDIDATES = 8;

const lookupSecret = () => crypto.createHmac('sha256', config.ARGON2_PEPPER).update('apexmonitor:key-lookup:v1').digest();

export function keyLookupHash(rawKey: string): string {
  return crypto.createHmac('sha256', lookupSecret()).update(rawKey).digest('hex');
}

export const displayPrefix = (rawKey: string): string => rawKey.substring(0, DISPLAY_PREFIX_LENGTH);

/** Everything the database stores for a newly generated key. The raw key itself is never stored. */
export async function prepareKeyForStorage(rawKey: string) {
  const keyHash = await argon2.hash(rawKey + config.ARGON2_PEPPER, {
    type: argon2.argon2id,
    memoryCost: 65536, // 64 MB
    timeCost: 3,
    parallelism: 4,
  });
  return { keyPrefix: displayPrefix(rawKey), keyHash, keyLookup: keyLookupHash(rawKey) };
}

/** True if `rawKey` matches the stored argon2 hash. */
export function verifyKeyHash(storedHash: string, rawKey: string): Promise<boolean> {
  return argon2.verify(storedHash, rawKey + config.ARGON2_PEPPER).catch(() => false);
}
