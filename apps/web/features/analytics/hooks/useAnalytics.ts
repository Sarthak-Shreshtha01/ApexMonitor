import { useQueries } from '@tanstack/react-query';
import { DashboardTimeframe } from '@/features/dashboard/state/dashboard.store';
import { analyticsService } from '../api/analytics.service';

export const analyticsQueryKeys = {
  overview: (projectId: string, timeframe: DashboardTimeframe) => ['rum', 'overview', projectId, timeframe] as const,
  series: (projectId: string, timeframe: DashboardTimeframe) => ['rum', 'series', projectId, timeframe] as const,
  paths: (projectId: string, timeframe: DashboardTimeframe) => ['rum', 'paths', projectId, timeframe] as const,
  devices: (projectId: string, timeframe: DashboardTimeframe) => ['rum', 'devices', projectId, timeframe] as const,
  geo: (projectId: string, timeframe: DashboardTimeframe) => ['rum', 'geo', projectId, timeframe] as const,
  referrers: (projectId: string, timeframe: DashboardTimeframe) => ['rum', 'referrers', projectId, timeframe] as const,
};

export function useRumAnalytics(projectId: string | null, timeframe: DashboardTimeframe) {
  const [overview, series, paths, devices, geo, referrers] = useQueries({
    queries: [
      {
        queryKey: analyticsQueryKeys.overview(projectId || 'none', timeframe),
        queryFn: () => analyticsService.getOverview(projectId!, timeframe),
        enabled: !!projectId,
      },
      {
        queryKey: analyticsQueryKeys.series(projectId || 'none', timeframe),
        queryFn: () => analyticsService.getSeries(projectId!, timeframe),
        enabled: !!projectId,
      },
      {
        queryKey: analyticsQueryKeys.paths(projectId || 'none', timeframe),
        queryFn: () => analyticsService.getTopPaths(projectId!, timeframe),
        enabled: !!projectId,
      },
      {
        queryKey: analyticsQueryKeys.devices(projectId || 'none', timeframe),
        queryFn: () => analyticsService.getDevices(projectId!, timeframe),
        enabled: !!projectId,
      },
      {
        queryKey: analyticsQueryKeys.geo(projectId || 'none', timeframe),
        queryFn: () => analyticsService.getGeo(projectId!, timeframe),
        enabled: !!projectId,
      },
      {
        queryKey: analyticsQueryKeys.referrers(projectId || 'none', timeframe),
        queryFn: () => analyticsService.getReferrers(projectId!, timeframe),
        enabled: !!projectId,
      },
    ],
  });

  return {
    overview,
    series,
    paths,
    devices,
    geo,
    referrers,
    isLoading: [overview, series, paths, devices, geo, referrers].some((query) => query.isLoading),
    isError: [overview, series, paths, devices, geo, referrers].some((query) => query.isError),
  };
}
