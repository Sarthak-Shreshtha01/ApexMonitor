import { useQuery } from '@tanstack/react-query';
import { metricsService } from '../api/metrics.service';

// Factory pattern for query keys [cite: 978]
export const metricsQueryKeys = {
  overview: (projectId: string, timeframe: string) => ['metrics', 'overview', projectId, timeframe] as const,
};

export function useMetricsOverview(projectId: string | null, timeframe: string) {
  return useQuery({
    queryKey: metricsQueryKeys.overview(projectId!, timeframe), // [cite: 1029]
    queryFn: () => metricsService.getOverview(projectId!, timeframe), // [cite: 1030]
    enabled: !!projectId, // Suspends query if project context is missing [cite: 1032]
  });
}