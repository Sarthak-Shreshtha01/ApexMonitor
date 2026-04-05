import { getPg } from '@infrastructure/db/postgres';

export interface AlertRule {
  id: number;
  project_id: string;
  name: string;
  condition_type: string; // e.g., 'error_rate_high', 'latency_p99_high'
  endpoint_filter: string | null;
  threshold: number;
  window_minutes: number;
  notify_webhook: string | null;
}

export class AlertsRepository {
  private get db() { return getPg(); }

  async getActiveRules(): Promise<AlertRule[]> {
    const { rows } = await this.db.query(
      `SELECT * FROM alert_rules WHERE is_active = TRUE`
    );
    return rows;
  }

  async getRecentMetrics(projectId: string, endpoint: string | null, windowMinutes: number) {
    // For MVP, we query the hourly_metrics. In production, you'd use five_minute_metrics for tighter windows.
    const { rows } = await this.db.query(`
      SELECT 
        SUM(request_count)::int as total_requests,
        SUM(error_count)::int as total_errors,
        MAX(p99_ms) as max_p99
      FROM hourly_metrics
      WHERE project_id = $1 
        AND ($2::text IS NULL OR endpoint = $2)
        AND hour_bucket >= NOW() - ($3 || ' minutes')::interval
    `, [projectId, endpoint, windowMinutes]);
    
    return rows[0] || { total_requests: 0, total_errors: 0, max_p99: 0 };
  }

  async logAlertEvent(ruleId: number, projectId: string, message: string) {
    await this.db.query(
      `INSERT INTO alert_events (alert_rule_id, project_id, message) VALUES ($1, $2, $3)`,
      [ruleId, projectId, message]
    );
  }
}