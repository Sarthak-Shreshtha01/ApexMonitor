import { getPg } from '@infrastructure/db/postgres';

export interface CreateInsightDTO {
  projectId: string;
  endpoint: string;
  severity: 'info' | 'warning' | 'critical';
  type: string;
  message: string;
  metadata: Record<string, unknown>;
}

export interface InsightListItem {
  id: number;
  projectId: string;
  endpoint: string | null;
  severity: 'info' | 'warning' | 'critical';
  type: string;
  message: string;
  metadata: Record<string, unknown>;
  isRead: boolean;
  createdAt: string;
}

export class InsightsRepository {
  private get db() { return getPg(); }

  async createInsight(data: CreateInsightDTO): Promise<void> {
    await this.db.query(
      `INSERT INTO insights (project_id, endpoint, severity, type, message, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [data.projectId, data.endpoint, data.severity, data.type, data.message, data.metadata]
    );
  }

  async listRecent(projectId: string, limit: number): Promise<InsightListItem[]> {
    const { rows } = await this.db.query(
      `SELECT
          id,
          project_id,
          endpoint,
          severity,
          type,
          message,
          metadata,
          is_read,
          created_at
       FROM insights
       WHERE project_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [projectId, limit]
    );

    return rows.map((row) => ({
      id: Number(row.id),
      projectId: String(row.project_id),
      endpoint: row.endpoint ? String(row.endpoint) : null,
      severity: row.severity,
      type: String(row.type),
      message: String(row.message),
      metadata: (row.metadata ?? {}) as Record<string, unknown>,
      isRead: Boolean(row.is_read),
      createdAt: new Date(row.created_at).toISOString(),
    }));
  }
}