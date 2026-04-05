import { getPg } from '@infrastructure/db/postgres';

export interface CreateInsightDTO {
  projectId: string;
  endpoint: string;
  severity: 'info' | 'warning' | 'critical';
  type: string;
  message: string;
  metadata: Record<string, unknown>;
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
}