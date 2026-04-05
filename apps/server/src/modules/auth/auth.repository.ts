import { getPg } from '@infrastructure/db/postgres';

export class AuthRepository {
  private get db() { return getPg(); }

  async findKeyByPrefix(prefix: string) {
    const { rows } = await this.db.query(
      `SELECT * FROM api_keys WHERE key_prefix = $1 AND revoked_at IS NULL`,
      [prefix]
    );
    return rows[0];
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
  async insertKey(data: { projectId: string; keyPrefix: string; keyHash: string; label?: string }) {
    await this.db.query(
      `INSERT INTO api_keys (project_id, key_prefix, key_hash, label) VALUES ($1, $2, $3, $4)`,
      [data.projectId, data.keyPrefix, data.keyHash, data.label]
    );
  }
}