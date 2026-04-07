import { getPg } from '@infrastructure/db/postgres';

export interface KeyRecord {
  id: number;
  projectId: string;
  projectName: string;
  label: string;
  keyPrefix: string;
  createdAt: string;
  lastUsedAt: string | null;
}

export class KeysRepository {
  private get db() { return getPg(); }

  async listByProjectIds(projectIds: string[]): Promise<KeyRecord[]> {
    if (projectIds.length === 0) return [];

    const { rows } = await this.db.query(
      `SELECT
         k.id,
         k.project_id,
         p.name AS project_name,
         COALESCE(k.label, 'Unnamed Key') AS label,
         k.key_prefix,
         k.created_at,
         k.last_used_at
       FROM api_keys k
       INNER JOIN projects p ON p.id = k.project_id
       WHERE k.project_id = ANY($1::text[])
         AND k.revoked_at IS NULL
       ORDER BY p.name ASC, k.created_at DESC`,
      [projectIds]
    );

    return rows.map((row) => ({
      id: Number(row.id),
      projectId: String(row.project_id),
      projectName: String(row.project_name),
      label: String(row.label),
      keyPrefix: String(row.key_prefix),
      createdAt: new Date(row.created_at).toISOString(),
      lastUsedAt: row.last_used_at ? new Date(row.last_used_at).toISOString() : null,
    }));
  }

  async insertKey(data: { projectId: string; keyPrefix: string; keyHash: string; label: string }): Promise<number> {
    const { rows } = await this.db.query(
      `INSERT INTO api_keys (project_id, key_prefix, key_hash, label)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [data.projectId, data.keyPrefix, data.keyHash, data.label]
    );

    return Number(rows[0].id);
  }

  async revokeKey(projectId: string, keyId: number): Promise<boolean> {
    const { rowCount } = await this.db.query(
      `UPDATE api_keys
       SET revoked_at = NOW()
       WHERE id = $1
         AND project_id = $2
         AND revoked_at IS NULL`,
      [keyId, projectId]
    );

    return (rowCount ?? 0) > 0;
  }
}
