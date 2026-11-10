-- v6: API / RUM key lookup hash (KI-26)
-- Keys used to be found by their first 10 characters, which collide (`pk_live_` keys have
-- only 2 random characters there). key_lookup = HMAC-SHA256 of the whole key, written for
-- new keys and filled in for existing keys the first time they are used.
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS key_lookup CHAR(64);
CREATE UNIQUE INDEX IF NOT EXISTS idx_api_keys_lookup ON api_keys (key_lookup) WHERE key_lookup IS NOT NULL;

ALTER TABLE rum_public_keys ADD COLUMN IF NOT EXISTS key_lookup CHAR(64);
CREATE UNIQUE INDEX IF NOT EXISTS idx_rum_keys_lookup ON rum_public_keys (key_lookup) WHERE key_lookup IS NOT NULL;
