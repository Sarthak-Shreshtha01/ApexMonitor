import { useQuery } from '@tanstack/react-query';
import { metricsService } from '../api/metrics.service';
import { DashboardTimeframe } from '@/features/dashboard/state/dashboard.store';

// Factory pattern for query keys [cite: 978]
export const metricsQueryKeys = {
  overview: (projectId: string, timeframe: DashboardTimeframe) => ['metrics', 'overview', projectId, timeframe] as const,
  operations: (projectId: string, timeframe: DashboardTimeframe) => ['metrics', 'operations', projectId, timeframe] as const,
};

export function useMetricsOverview(projectId: string | null, timeframe: DashboardTimeframe) {
  return useQuery({
    queryKey: metricsQueryKeys.overview(projectId!, timeframe),
    queryFn: () => metricsService.getOverview(projectId!, timeframe),
    enabled: !!projectId,
  });
}

export function useMetricsOperations(projectId: string | null, timeframe: DashboardTimeframe) {
  return useQuery({
    queryKey: metricsQueryKeys.operations(projectId!, timeframe),
    queryFn: () => metricsService.getOperations(projectId!, timeframe),
    enabled: !!projectId,
  });
}