'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { connectProjectSocket } from '@/shared/realtime/projectSocket';
import { useProjectStore } from '@/features/projects/state/project.store';
import { useDashboardStore } from '@/features/dashboard/state/dashboard.store';
import { useMetricsOverview } from '@/features/metrics/hooks/useMetrics';
import { logsService } from '@/features/logs/api/logs.service';
import { analyticsService } from '@/features/analytics/api/analytics.service';
import { insightsService, InsightItem } from '../api/insights.service';

interface LivePulsePayload {
  rps: number;
  errorRate: number;
  activeAlerts: number;
  topEndpoints: Array<{ endpoint: string; rps: number; p99: number }>;
  latestInsight: {
    type: string;
    endpoint: string;
    message: string;
    timestamp: number;
  } | null;
}

export function useLiveTraffic() {
  const projectId = useProjectStore((state) => state.activeProjectId);
  const timeframe = useDashboardStore((state) => state.timeframe);
  const overviewQuery = useMetricsOverview(projectId, timeframe);
  const range = getTimeRange(timeframe);

  const logsQuery = useQuery({
    queryKey: ['traffic', 'critical-logs', projectId, timeframe],
    queryFn: () => logsService.list({
      projectId: projectId!,
      page: 1,
      limit: 40,
      from: range.from,
      to: range.to,
    }),
    enabled: !!projectId,
    refetchInterval: 6000,
  });

  const insightsQuery = useQuery({
    queryKey: ['traffic', 'insights', projectId],
    queryFn: () => insightsService.list(projectId!, 8),
    enabled: !!projectId,
    refetchInterval: 10000,
  });

  const geoQuery = useQuery({
    queryKey: ['traffic', 'geo', projectId, timeframe],
    queryFn: () => analyticsService.getGeo(projectId!, timeframe, 12),
    enabled: !!projectId,
    refetchInterval: 12000,
  });

  const [pulse, setPulse] = useState<LivePulsePayload | null>(null);
  const [isSocketConnected, setIsSocketConnected] = useState(false);

  useEffect(() => {
    if (!projectId) return;

    // "Connected" means joined: the server has accepted our token for this project.
    const disconnect = connectProjectSocket<LivePulsePayload>(projectId, {
      onJoined: () => setIsSocketConnected(true),
      onLeft: () => setIsSocketConnected(false),
      onPulse: (event) => setPulse(event.data),
    });
    return () => {
      disconnect();
      setIsSocketConnected(false);
    };
  }, [projectId]);

  const criticalLogs = (logsQuery.data?.logs ?? []).filter((log) => log.statusCode >= 400).slice(0, 24);

  const serverInsights = insightsQuery.data ?? [];
  const mergedInsights = (() => {
    if (!pulse?.latestInsight) return serverInsights;

    const liveInsight: InsightItem = {
      id: -1,
      projectId: projectId ?? 'unknown',
      endpoint: pulse.latestInsight.endpoint,
      severity: pulse.latestInsight.type === 'error_surge' ? 'critical' : 'warning',
      type: pulse.latestInsight.type,
      message: pulse.latestInsight.message,
      metadata: {},
      isRead: false,
      createdAt: new Date(pulse.latestInsight.timestamp).toISOString(),
    };

    return [liveInsight, ...serverInsights].slice(0, 8);
  })();

  return {
    projectId,
    timeframe,
    overviewQuery,
    logsQuery,
    insightsQuery,
    geoQuery,
    pulse,
    isSocketConnected,
    criticalLogs,
    mergedInsights,
    geo: geoQuery.data ?? [],
  };
}

function getTimeRange(timeframe: '1h' | '6h' | '24h' | '7d') {
  const now = new Date();
  const from = new Date(now);

  if (timeframe === '1h') from.setHours(from.getHours() - 1);
  if (timeframe === '6h') from.setHours(from.getHours() - 6);
  if (timeframe === '24h') from.setHours(from.getHours() - 24);
  if (timeframe === '7d') from.setDate(from.getDate() - 7);

  return {
    from: from.toISOString(),
    to: now.toISOString(),
  };
}
