import { getPg } from '@infrastructure/db/postgres';
import { MetricsQuery } from './dto/metrics-query.dto';
import { ApiLog } from '@modules/logs/logs.schema';

type StatusClass = '2xx' | '3xx' | '4xx' | '5xx';

export class MetricsRepository {
  private get db() { return getPg(); }

  private getInterval(timeframe: MetricsQuery['timeframe']): string {
    const intervalMap: Record<string, string> = {
      '1h': '1 hour', '6h': '6 hours', '24h': '24 hours', '7d': '7 days', '30d': '30 days'
    };

    return intervalMap[timeframe];
  }

  async getOverview(query: MetricsQuery) {
    const interval = this.getInterval(query.timeframe);

    const [summaryResult, topEndpointsResult, seriesResult] = await Promise.all([
      this.db.query(`
        SELECT
          COALESCE(SUM(request_count), 0)::int AS total_requests,
          COALESCE(SUM(error_count), 0)::int AS total_errors,
          COALESCE(MAX(p99_ms), 0)::float AS p99_latency,
          COALESCE(AVG(avg_ms), 0)::float AS avg_latency,
          COALESCE(SUM(satisfied_count), 0)::int AS satisfied_count,
          COALESCE(SUM(tolerating_count), 0)::int AS tolerating_count,
          COALESCE(SUM(frustrated_count), 0)::int AS frustrated_count
        FROM hourly_metrics
        WHERE project_id = $1
          AND hour_bucket >= NOW() - $2::interval
      `, [query.projectId, interval]),
      this.db.query(`
        SELECT
          endpoint,
          method,
          SUM(request_count)::int AS requests,
          COALESCE(SUM(error_count), 0)::int AS errors,
          COALESCE(MAX(p99_ms), 0)::float AS p99_latency,
          COALESCE(AVG(avg_ms), 0)::float AS avg_latency
        FROM hourly_metrics
        WHERE project_id = $1
          AND hour_bucket >= NOW() - $2::interval
        GROUP BY endpoint, method
        ORDER BY requests DESC
        LIMIT 10
      `, [query.projectId, interval]),
      this.db.query(`
        SELECT
          hour_bucket AS bucket,
          SUM(request_count)::int AS request_count,
          SUM(error_count)::int AS error_count,
          COALESCE(AVG(avg_ms), 0)::float AS avg_latency
        FROM hourly_metrics
        WHERE project_id = $1
          AND hour_bucket >= NOW() - $2::interval
        GROUP BY hour_bucket
        ORDER BY hour_bucket ASC
      `, [query.projectId, interval]),
    ]);

    const summary = summaryResult.rows[0] ?? {
      total_requests: 0,
      total_errors: 0,
      p99_latency: 0,
      avg_latency: 0,
      satisfied_count: 0,
      tolerating_count: 0,
      frustrated_count: 0,
    };

    const totalRequests = Number(summary.total_requests ?? 0);
    const totalErrors = Number(summary.total_errors ?? 0);
    const timeframeHours = this.timeframeToHours(query.timeframe);
    const apdexNumerator = Number(summary.satisfied_count ?? 0) + (Number(summary.tolerating_count ?? 0) / 2);
    const apdex = totalRequests > 0 ? apdexNumerator / totalRequests : 1;

    return {
      summary: {
        totalRequests,
        totalErrors,
        errorRate: totalRequests > 0 ? Number(((totalErrors / totalRequests) * 100).toFixed(2)) : 0,
        p99Latency: Number(Number(summary.p99_latency ?? 0).toFixed(2)),
        avgLatency: Number(Number(summary.avg_latency ?? 0).toFixed(2)),
        rps: timeframeHours > 0 ? Number((totalRequests / (timeframeHours * 3600)).toFixed(2)) : 0,
        apdex: Number(apdex.toFixed(2)),
      },
      topEndpoints: topEndpointsResult.rows.map((row) => ({
        endpoint: row.endpoint,
        method: row.method,
        requests: Number(row.requests ?? 0),
        errors: Number(row.errors ?? 0),
        errorRate: Number(row.requests) > 0 ? Number(((Number(row.errors) / Number(row.requests)) * 100).toFixed(2)) : 0,
        p99Latency: Number(Number(row.p99_latency ?? 0).toFixed(2)),
        avgLatency: Number(Number(row.avg_latency ?? 0).toFixed(2)),
      })),
      series: seriesResult.rows.map((row) => ({
        bucket: row.bucket,
        requestCount: Number(row.request_count ?? 0),
        errorCount: Number(row.error_count ?? 0),
        avgLatency: Number(Number(row.avg_latency ?? 0).toFixed(2)),
      })),
    };
  }

  /**
   * Calculates overall P50, P95, P99 and averages for the entire project or specific endpoint.
   */
  async getLatencyBreakdown(query: MetricsQuery) {
    const interval = this.getInterval(query.timeframe);

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

  async getOperations(query: MetricsQuery) {
    const from = this.timeframeToDate(query.timeframe);

    const [statusAgg, regionsAgg, nodesAgg] = await Promise.all([
      ApiLog.aggregate([
        { $match: { projectId: query.projectId, timestamp: { $gte: from } } },
        {
          $project: {
            statusClass: {
              $switch: {
                branches: [
                  { case: { $and: [{ $gte: ['$statusCode', 200] }, { $lt: ['$statusCode', 300] }] }, then: '2xx' },
                  { case: { $and: [{ $gte: ['$statusCode', 300] }, { $lt: ['$statusCode', 400] }] }, then: '3xx' },
                  { case: { $and: [{ $gte: ['$statusCode', 400] }, { $lt: ['$statusCode', 500] }] }, then: '4xx' },
                ],
                default: '5xx',
              },
            },
          },
        },
        { $group: { _id: '$statusClass', count: { $sum: 1 } } },
      ]),
      ApiLog.aggregate([
        { $match: { projectId: query.projectId, timestamp: { $gte: from } } },
        {
          $group: {
            _id: { $ifNull: ['$region', 'XX'] },
            requests: { $sum: 1 },
            errors: {
              $sum: {
                $cond: [{ $gte: ['$statusCode', 400] }, 1, 0],
              },
            },
            avgLatency: { $avg: '$latencyMs' },
          },
        },
        { $sort: { requests: -1 } },
        { $limit: 8 },
      ]),
      ApiLog.aggregate([
        { $match: { projectId: query.projectId, timestamp: { $gte: from } } },
        {
          $group: {
            _id: { $ifNull: ['$sdkVersion', 'unknown'] },
            requests: { $sum: 1 },
            errors: {
              $sum: {
                $cond: [{ $gte: ['$statusCode', 400] }, 1, 0],
              },
            },
            avgLatency: { $avg: '$latencyMs' },
          },
        },
        { $sort: { requests: -1 } },
        { $limit: 6 },
      ]),
    ]);

    const statusCounts: Record<StatusClass, number> = {
      '2xx': 0,
      '3xx': 0,
      '4xx': 0,
      '5xx': 0,
    };

    for (const row of statusAgg) {
      const key = String(row._id) as StatusClass;
      if (statusCounts[key] !== undefined) {
        statusCounts[key] = Number(row.count ?? 0);
      }
    }

    const total = Object.values(statusCounts).reduce((sum, count) => sum + count, 0);
    const toRate = (count: number) => (total > 0 ? Number(((count / total) * 100).toFixed(2)) : 0);

    return {
      timeframe: query.timeframe,
      totals: {
        requests: total,
        errors: statusCounts['4xx'] + statusCounts['5xx'],
      },
      statusBreakdown: {
        ok2xx: { count: statusCounts['2xx'], rate: toRate(statusCounts['2xx']) },
        redirect3xx: { count: statusCounts['3xx'], rate: toRate(statusCounts['3xx']) },
        client4xx: { count: statusCounts['4xx'], rate: toRate(statusCounts['4xx']) },
        server5xx: { count: statusCounts['5xx'], rate: toRate(statusCounts['5xx']) },
      },
      regions: regionsAgg.map((row) => {
        const requests = Number(row.requests ?? 0);
        const errors = Number(row.errors ?? 0);
        return {
          region: String(row._id ?? 'XX'),
          requests,
          errorRate: requests > 0 ? Number(((errors / requests) * 100).toFixed(2)) : 0,
          avgLatency: Number(Number(row.avgLatency ?? 0).toFixed(2)),
        };
      }),
      nodes: nodesAgg.map((row, index) => {
        const requests = Number(row.requests ?? 0);
        const errors = Number(row.errors ?? 0);
        const errorRate = requests > 0 ? (errors / requests) * 100 : 0;
        const avgLatency = Number(Number(row.avgLatency ?? 0).toFixed(2));
        const status = errorRate >= 12 || avgLatency >= 1200
          ? 'critical'
          : errorRate >= 4 || avgLatency >= 650
            ? 'warning'
            : 'ok';

        return {
          nodeId: `edge-${String(row._id ?? 'unknown').replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}-${index + 1}`,
          source: String(row._id ?? 'unknown'),
          requests,
          errorRate: Number(errorRate.toFixed(2)),
          avgLatency,
          status,
        };
      }),
      generatedAt: new Date().toISOString(),
    };
  }

  private timeframeToHours(timeframe: MetricsQuery['timeframe']): number {
    switch (timeframe) {
      case '1h':
        return 1;
      case '6h':
        return 6;
      case '24h':
        return 24;
      case '7d':
        return 24 * 7;
      case '30d':
        return 24 * 30;
      default:
        return 24;
    }
  }

  private timeframeToDate(timeframe: MetricsQuery['timeframe']): Date {
    const now = Date.now();
    const hours = this.timeframeToHours(timeframe);
    return new Date(now - (hours * 60 * 60 * 1000));
  }
}