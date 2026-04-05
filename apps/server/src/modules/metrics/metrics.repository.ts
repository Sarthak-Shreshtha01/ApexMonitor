import { getPg } from '@infrastructure/db/postgres';
import { MetricsQuery } from './dto/metrics-query.dto';

export class MetricsRepository {
  private get db() { return getPg(); }

  /**
   * Calculates overall P50, P95, P99 and averages for the entire project or specific endpoint.
   */
  async getLatencyBreakdown(query: MetricsQuery) {
    // Map timeframe string to PostgreSQL interval
    const intervalMap: Record<string, string> = {
      '1h': '1 hour', '6h': '6 hours', '24h': '24 hours', '7d': '7 days', '30d': '30 days'
    };
    const interval = intervalMap[query.timeframe];

    const { rows } = await this.db.query(`
      SELECT 
        endpoint, 
        method,
        SUM(request_count)::int  AS request_count,
        SUM(error_count)::int    AS error_count,
        MAX(p50_ms)              AS p50_ms,
        MAX(p95_ms)              AS p95_ms,
        MAX(p99_ms)              AS p99_ms,
        AVG(avg_ms)              AS avg_ms
      FROM hourly_metrics
      WHERE project_id = $1
        AND hour_bucket >= NOW() - $2::interval
        AND ($3::text IS NULL OR endpoint = $3)
      GROUP BY endpoint, method
      ORDER BY SUM(request_count) DESC
      LIMIT $4 OFFSET $5
    `, [
      query.projectId, 
      interval, 
      query.endpoint ?? null,
      query.limit, 
      (query.page - 1) * query.limit
    ]);

    return rows;
  }
}