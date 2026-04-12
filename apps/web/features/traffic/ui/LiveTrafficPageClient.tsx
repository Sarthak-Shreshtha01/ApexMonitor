'use client';

import { RefreshCcw } from 'lucide-react';
import { LiveThroughputCard } from '@/features/traffic/ui/LiveThroughputCard';
import { TerminalStream } from '@/features/traffic/ui/TerminalStream';
import { AnomalySidebar } from '@/features/traffic/ui/AnomalySidebar';
import { useLiveTraffic } from '@/features/traffic/hooks/useLiveTraffic';

export function LiveTrafficPageClient() {
  const {
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
    geo,
  } = useLiveTraffic();

  const summary = overviewQuery.data?.summary;
  const series = overviewQuery.data?.series ?? [];

  return (
    <div className="flex min-h-[calc(100vh-3rem)] flex-col overflow-hidden rounded-lg border border-outline-variant bg-app">
      <header className="flex flex-col gap-3 px-3 py-3 sm:px-4 lg:px-6 sm:flex-row sm:items-center sm:justify-between w-full bg-app border-b border-outline-variant z-10">
        <div className="flex items-center gap-3 sm:gap-6 min-w-0 flex-wrap">
          <div className="flex items-center gap-2 shrink-0">
            <div className={`w-2 h-2 rounded-full ${isSocketConnected ? 'bg-primary animate-pulse' : 'bg-secondary'}`}></div>
            <span className="font-medium tracking-tight text-[11px] uppercase text-primary">Real-time Ops Monitor</span>
          </div>
          <div className="flex items-center gap-4 sm:gap-6 flex-wrap text-[10px] sm:text-[11px]">
            <span className="font-medium tracking-tight text-[11px] uppercase text-primary border-b-2 border-primary pb-1">
              {projectId ?? 'No Project'}
            </span>
            <span className="font-medium tracking-tight uppercase text-secondary">{timeframe}</span>
          </div>
        </div>

        <div className="flex items-center gap-3 sm:gap-4 self-start sm:self-auto">
          <div className="text-[10px] font-mono text-secondary bg-surface-container px-3 py-1 border border-outline-variant">
            UPTIME: <span className="text-white">{isSocketConnected ? 'LIVE' : 'SYNC'}</span>
          </div>
          <button
            className="text-secondary hover:text-primary transition-colors"
            onClick={() => {
              overviewQuery.refetch();
              logsQuery.refetch();
              insightsQuery.refetch();
            }}
            type="button"
            aria-label="Refresh traffic data"
          >
            <RefreshCcw className="w-4 h-4" />
          </button>
        </div>
      </header>

      <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">
        <div className="flex-1 flex flex-col min-w-0 border-r border-outline-variant">
          <LiveThroughputCard
            summary={summary}
            series={series}
            liveRps={pulse?.rps}
            liveErrorRate={pulse?.errorRate}
            isSocketConnected={isSocketConnected}
          />
          <TerminalStream logs={criticalLogs} isLoading={logsQuery.isLoading} />
        </div>

        <AnomalySidebar
          insights={mergedInsights}
          isLoading={insightsQuery.isLoading}
          isSocketConnected={isSocketConnected}
          geo={geo}
          isGeoLoading={geoQuery.isLoading}
        />
      </div>

      <footer className="bg-app border-t border-outline-variant">
        <div className="px-3 sm:px-6 py-3 flex flex-col gap-2 md:flex-row md:justify-between md:items-center">
          <span className="text-[10px] text-secondary uppercase tracking-widest">ApexMonitor Ops OS v3.8.1</span>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] uppercase tracking-widest">
            <span className="text-secondary">Knowledge Base</span>
            <span className="text-secondary">Node Status</span>
            <span className="text-secondary">Sec Compliance</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-primary font-bold font-mono">CLUSTER: {isSocketConnected ? 'LIVE' : 'DEGRADED'}</span>
            <span className={`w-1.5 h-1.5 rounded-full ${isSocketConnected ? 'bg-success' : 'bg-tertiary'}`}></span>
          </div>
        </div>
      </footer>
    </div>
  );
}
