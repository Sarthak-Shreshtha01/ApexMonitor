import { getPg } from '@infrastructure/db/postgres';
import { MAX_LEGACY_CANDIDATES } from './key-material';

export class AuthRepository {
  private get db() { return getPg(); }

  /**
   * Active rows that could own a presented key: the row with this lookup hash, plus legacy
   * rows (no lookup hash yet) sharing the display prefix. Exact matches come first.
   */
  async findKeyCandidates(lookup: string, prefix: string) {
    return this.findCandidates('api_keys', lookup, prefix);
  }

  async findRumKeyCandidates(lookup: string, prefix: string) {
    return this.findCandidates('rum_public_keys', lookup, prefix);
  }

  /** Fills in the lookup hash of a legacy key once it has been verified. */
  async backfillKeyLookup(table: 'api_keys' | 'rum_public_keys', keyId: string | number, lookup: string) {
    await this.db.query(`UPDATE ${table} SET key_lookup = $2 WHERE id = $1 AND key_lookup IS NULL`, [keyId, lookup]);
  }

  private async findCandidates(table: 'api_keys' | 'rum_public_keys', lookup: string, prefix: string) {
    const { rows } = await this.db.query(
      `SELECT * FROM ${table}
        WHERE revoked_at IS NULL
          AND (key_lookup = $1 OR (key_lookup IS NULL AND key_prefix = $2))
        ORDER BY (key_lookup IS NOT NULL) DESC, id
        LIMIT $3`,
      [lookup, prefix, MAX_LEGACY_CANDIDATES + 1]
    );
    return rows;
  }

  async updateLastUsed(keyId: string) {
    await this.db.query(
      `UPDATE api_keys SET last_used_at = NOW() WHERE id = $1`,
      [keyId]
    );
  }

  async getProjectMember(projectId: string, userId: string) {
    const { rows } = await this.db.query(
      `SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2`,
      [projectId, userId]
    );
    return rows[0];
  }
  async insertKey(data: { projectId: string; keyPrefix: string; keyHash: string; keyLookup: string; label?: string }) {
    await this.db.query(
      `INSERT INTO api_keys (project_id, key_prefix, key_hash, key_lookup, label) VALUES ($1, $2, $3, $4, $5)`,
      [data.projectId, data.keyPrefix, data.keyHash, data.keyLookup, data.label]
    );
  }

  async insertRumKey(data: { projectId: string; keyPrefix: string; keyHash: string; keyLookup: string; label?: string; allowedOrigins?: string[] }) {
    await this.db.query(
      `INSERT INTO rum_public_keys (project_id, key_prefix, key_hash, key_lookup, label, allowed_origins) VALUES ($1, $2, $3, $4, $5, $6)`,
      [data.projectId, data.keyPrefix, data.keyHash, data.keyLookup, data.label, data.allowedOrigins ?? []]
    );
  }

  async updateRumLastUsed(keyId: string) {
    await this.db.query(
      `UPDATE rum_public_keys SET last_used_at = NOW() WHERE id = $1`,
      [keyId]
    );
  }
}