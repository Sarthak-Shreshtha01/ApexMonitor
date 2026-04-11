import { getPg } from '@infrastructure/db/postgres';
import { RumQuery } from './dto/rum-query.dto';

export class RumRepository {
  private get db() {
    return getPg();
  }

  private getInterval(timeframe: RumQuery['timeframe']): string {
    const map: Record<RumQuery['timeframe'], string> = {
      '1h': '1 hour',
      '6h': '6 hours',
      '24h': '24 hours',
      '7d': '7 days',
      '30d': '30 days',
    };

    return map[timeframe];
  }

  async getOverview(query: RumQuery) {
    const interval = this.getInterval(query.timeframe);

    const { rows } = await this.db.query(
      `
        SELECT
          COALESCE(SUM(page_views), 0)::int AS page_views,
          COALESCE(SUM(unique_visitors), 0)::int AS unique_visitors,
          COALESCE(SUM(unique_sessions), 0)::int AS unique_sessions,
          COALESCE(AVG(avg_ttfb_ms), 0)::float AS avg_ttfb_ms,
          COALESCE(AVG(avg_fcp_ms), 0)::float AS avg_fcp_ms,
          COALESCE(AVG(avg_lcp_ms), 0)::float AS avg_lcp_ms
        FROM hourly_rum_metrics
        WHERE project_id = $1
          AND hour_bucket >= NOW() - $2::interval
      `,
      [query.projectId, interval]
    );

    return rows[0] ?? {
      page_views: 0,
      unique_visitors: 0,
      unique_sessions: 0,
      avg_ttfb_ms: 0,
      avg_fcp_ms: 0,
      avg_lcp_ms: 0,
    };
  }

  async getSeries(query: RumQuery) {
    const interval = this.getInterval(query.timeframe);

    const { rows } = await this.db.query(
      `
        SELECT
          hour_bucket AS bucket,
          SUM(page_views)::int AS page_views,
          COALESCE(AVG(avg_ttfb_ms), 0)::float AS avg_ttfb_ms,
          COALESCE(AVG(avg_fcp_ms), 0)::float AS avg_fcp_ms,
          COALESCE(AVG(avg_lcp_ms), 0)::float AS avg_lcp_ms
        FROM hourly_rum_metrics
        WHERE project_id = $1
          AND hour_bucket >= NOW() - $2::interval
        GROUP BY hour_bucket
        ORDER BY hour_bucket ASC
      `,
      [query.projectId, interval]
    );

    return rows;
  }

  async getTopPaths(query: RumQuery) {
    const interval = this.getInterval(query.timeframe);

    const { rows } = await this.db.query(
      `
        SELECT
          path,
          SUM(page_views)::int AS page_views,
          COALESCE(AVG(avg_lcp_ms), 0)::float AS avg_lcp_ms,
          COALESCE(AVG(avg_fcp_ms), 0)::float AS avg_fcp_ms,
          COALESCE(AVG(avg_ttfb_ms), 0)::float AS avg_ttfb_ms
        FROM hourly_rum_metrics
        WHERE project_id = $1
          AND hour_bucket >= NOW() - $2::interval
        GROUP BY path
        ORDER BY page_views DESC
        LIMIT $3
      `,
      [query.projectId, interval, query.limit]
    );

    return rows;
  }

  async getDeviceBreakdown(query: RumQuery) {
    const interval = this.getInterval(query.timeframe);

    const { rows } = await this.db.query(
      `
        SELECT
          device_type,
          browser_name,
          SUM(page_views)::int AS page_views,
          COALESCE(AVG(avg_lcp_ms), 0)::float AS avg_lcp_ms
        FROM hourly_rum_metrics
        WHERE project_id = $1
          AND hour_bucket >= NOW() - $2::interval
        GROUP BY device_type, browser_name
        ORDER BY page_views DESC
      `,
      [query.projectId, interval]
    );

    return rows;
  }

  async getGeoBreakdown(query: RumQuery) {
    const interval = this.getInterval(query.timeframe);

    const { rows } = await this.db.query(
      `
        SELECT
          country_code,
          region_code,
          SUM(page_views)::int AS page_views,
          COALESCE(AVG(avg_lcp_ms), 0)::float AS avg_lcp_ms
        FROM hourly_rum_metrics
        WHERE project_id = $1
          AND hour_bucket >= NOW() - $2::interval
        GROUP BY country_code, region_code
        ORDER BY page_views DESC
        LIMIT $3
      `,
      [query.projectId, interval, query.limit]
    );

    return rows;
  }

  async getReferrerBreakdown(query: RumQuery) {
    const interval = this.getInterval(query.timeframe);

    const { rows } = await this.db.query(
      `
        SELECT
          referrer_source,
          SUM(page_views)::int AS page_views
        FROM hourly_rum_metrics
        WHERE project_id = $1
          AND hour_bucket >= NOW() - $2::interval
        GROUP BY referrer_source
        ORDER BY page_views DESC
        LIMIT $3
      `,
      [query.projectId, interval, query.limit]
    );

    return rows;
  }
}
