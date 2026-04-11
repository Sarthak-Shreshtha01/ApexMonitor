import { apiClient } from '@/shared/api/apiClient';
import { ENDPOINTS } from '@/shared/api/endpoints';
import { DashboardTimeframe } from '@/features/dashboard/state/dashboard.store';

export type RumOverview = {
  page_views: number;
  unique_visitors: number;
  unique_sessions: number;
  avg_ttfb_ms: number;
  avg_fcp_ms: number;
  avg_lcp_ms: number;
};

export type RumSeriesPoint = {
  bucket: string;
  page_views: number;
  avg_ttfb_ms: number;
  avg_fcp_ms: number;
  avg_lcp_ms: number;
};

export type RumPathRow = {
  path: string;
  page_views: number;
  avg_lcp_ms: number;
  avg_fcp_ms: number;
  avg_ttfb_ms: number;
};

export type RumDeviceRow = {
  device_type: string;
  browser_name: string;
  page_views: number;
  avg_lcp_ms: number;
};

export type RumGeoRow = {
  country_code: string;
  region_code: string;
  page_views: number;
  avg_lcp_ms: number;
};

export type RumReferrerRow = {
  referrer_source: string;
  page_views: number;
};

const normalizeNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const analyticsService = {
  async getOverview(projectId: string, timeframe: DashboardTimeframe): Promise<RumOverview> {
    const response = await apiClient.get<{ data: RumOverview }>(ENDPOINTS.rum.overview, {
      params: { projectId, timeframe },
    });

    const row = response.data.data;
    return {
      page_views: normalizeNumber(row.page_views),
      unique_visitors: normalizeNumber(row.unique_visitors),
      unique_sessions: normalizeNumber(row.unique_sessions),
      avg_ttfb_ms: normalizeNumber(row.avg_ttfb_ms),
      avg_fcp_ms: normalizeNumber(row.avg_fcp_ms),
      avg_lcp_ms: normalizeNumber(row.avg_lcp_ms),
    };
  },

  async getSeries(projectId: string, timeframe: DashboardTimeframe): Promise<RumSeriesPoint[]> {
    const response = await apiClient.get<{ data: RumSeriesPoint[] }>(ENDPOINTS.rum.series, {
      params: { projectId, timeframe },
    });

    return response.data.data.map((row) => ({
      bucket: row.bucket,
      page_views: normalizeNumber(row.page_views),
      avg_ttfb_ms: normalizeNumber(row.avg_ttfb_ms),
      avg_fcp_ms: normalizeNumber(row.avg_fcp_ms),
      avg_lcp_ms: normalizeNumber(row.avg_lcp_ms),
    }));
  },

  async getTopPaths(projectId: string, timeframe: DashboardTimeframe, limit = 8): Promise<RumPathRow[]> {
    const response = await apiClient.get<{ data: RumPathRow[] }>(ENDPOINTS.rum.paths, {
      params: { projectId, timeframe, limit },
    });

    return response.data.data.map((row) => ({
      path: row.path,
      page_views: normalizeNumber(row.page_views),
      avg_lcp_ms: normalizeNumber(row.avg_lcp_ms),
      avg_fcp_ms: normalizeNumber(row.avg_fcp_ms),
      avg_ttfb_ms: normalizeNumber(row.avg_ttfb_ms),
    }));
  },

  async getDevices(projectId: string, timeframe: DashboardTimeframe): Promise<RumDeviceRow[]> {
    const response = await apiClient.get<{ data: RumDeviceRow[] }>(ENDPOINTS.rum.devices, {
      params: { projectId, timeframe },
    });

    return response.data.data.map((row) => ({
      device_type: row.device_type,
      browser_name: row.browser_name,
      page_views: normalizeNumber(row.page_views),
      avg_lcp_ms: normalizeNumber(row.avg_lcp_ms),
    }));
  },

  async getGeo(projectId: string, timeframe: DashboardTimeframe, limit = 8): Promise<RumGeoRow[]> {
    const response = await apiClient.get<{ data: RumGeoRow[] }>(ENDPOINTS.rum.geo, {
      params: { projectId, timeframe, limit },
    });

    return response.data.data.map((row) => ({
      country_code: row.country_code,
      region_code: row.region_code,
      page_views: normalizeNumber(row.page_views),
      avg_lcp_ms: normalizeNumber(row.avg_lcp_ms),
    }));
  },

  async getReferrers(projectId: string, timeframe: DashboardTimeframe, limit = 8): Promise<RumReferrerRow[]> {
    const response = await apiClient.get<{ data: RumReferrerRow[] }>(ENDPOINTS.rum.referrers, {
      params: { projectId, timeframe, limit },
    });

    return response.data.data.map((row) => ({
      referrer_source: row.referrer_source,
      page_views: normalizeNumber(row.page_views),
    }));
  },
};
