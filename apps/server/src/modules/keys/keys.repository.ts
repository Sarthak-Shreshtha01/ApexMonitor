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

  async getStats(projectIds: string[], timeframe: '1h' | '6h' | '24h' | '7d' | '30d') {
    const interval = this.timeframeToInterval(timeframe);

    const { rows } = await this.db.query(
      `SELECT
         COUNT(*)::int AS total_keys,
         COUNT(*) FILTER (
           WHERE created_at >= NOW() - $2::interval
         )::int AS created_in_window,
         COUNT(*) FILTER (
           WHERE last_used_at IS NOT NULL
             AND last_used_at >= NOW() - $2::interval
         )::int AS used_in_window,
         COUNT(*) FILTER (
           WHERE last_used_at IS NULL OR last_used_at < NOW() - INTERVAL '90 days'
         )::int AS stale_keys,
         COUNT(*) FILTER (
           WHERE created_at >= NOW() - INTERVAL '24 hours'
         )::int AS created_last_24h
       FROM api_keys
       WHERE project_id = ANY($1::text[])
         AND revoked_at IS NULL`,
      [projectIds, interval]
    );

    const row = rows[0] ?? {};
    const totalKeys = Number(row.total_keys ?? 0);
    const staleKeys = Number(row.stale_keys ?? 0);
    const usedInWindow = Number(row.used_in_window ?? 0);

    return {
      totalKeys,
      createdInWindow: Number(row.created_in_window ?? 0),
      createdLast24h: Number(row.created_last_24h ?? 0),
      usedInWindow,
      staleKeys,
      healthyRate: totalKeys > 0 ? Number((((totalKeys - staleKeys) / totalKeys) * 100).toFixed(2)) : 100,
    };
  }

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

  private timeframeToInterval(timeframe: '1h' | '6h' | '24h' | '7d' | '30d'): string {
    if (timeframe === '1h') return '1 hour';
    if (timeframe === '6h') return '6 hours';
    if (timeframe === '24h') return '24 hours';
    if (timeframe === '7d') return '7 days';
    return '30 days';
  }
}
