'use client';

import { useMemo } from 'react';
import { Clock, ChevronDown, CheckCircle2 } from 'lucide-react';
import { useProjectStore } from '@/features/projects/state/project.store';
import { useDashboardStore } from '@/features/dashboard/state/dashboard.store';
import { useRumAnalytics } from '@/features/analytics/hooks/useAnalytics';
import { GlobalPulseCards } from './GlobalPulseCards';
import { CoreWebVitals } from './CoreWebVitals';
import { TrafficChart } from './TrafficChart';
import { TopPagesTable } from './TopPagesTable';
import { DeviceStats } from './DeviceStats';
import { ReferrersMap } from './ReferrersMap';

export function WebAnalyticsExplorer() {
  const activeProjectId = useProjectStore((state) => state.activeProjectId);
  const timeframe = useDashboardStore((state) => state.timeframe);

  const analytics = useRumAnalytics(activeProjectId, timeframe);

  const overview = analytics.overview.data;
  const series = analytics.series.data ?? [];
  const paths = analytics.paths.data ?? [];
  const devices = analytics.devices.data ?? [];
  const geo = analytics.geo.data ?? [];
  const referrers = analytics.referrers.data ?? [];

  const activeVisitors = useMemo(() => {
    return Math.max(0, Math.round((overview?.unique_sessions ?? 0) / (timeframe === '1h' ? 12 : timeframe === '6h' ? 24 : timeframe === '24h' ? 48 : 96)));
  }, [overview?.unique_sessions, timeframe]);

  if (!activeProjectId) {
    return (
      <div className="bg-[#0A0A0A] text-white min-h-[calc(100vh-4rem)] p-4 sm:p-8 selection:bg-orange-500/30 font-sans">
        <div className="max-w-400 mx-auto">
          <div className="bg-[#131313] border border-[#242424] p-6 rounded-lg text-zinc-300">Select a project from the top bar to view Web Analytics.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#0A0A0A] text-white min-h-[calc(100vh-4rem)] p-4 sm:p-8 selection:bg-orange-500/30 font-sans">
      <div className="max-w-400 mx-auto space-y-8">
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-white mb-1">Web Analytics (RUM)</h1>
            <p className="text-zinc-500 text-sm font-mono uppercase tracking-widest">Real-time user monitoring & experience metrics</p>
          </div>
          <div className="flex items-center gap-2 bg-[#131313] border border-[#242424] px-4 py-2 cursor-default rounded-lg">
            <Clock className="w-4 h-4 text-orange-500" />
            <span className="text-xs font-mono text-white">{timeframe.toUpperCase()}</span>
            <ChevronDown className="w-4 h-4 text-zinc-600" />
          </div>
        </header>

        {analytics.isLoading ? <div className="bg-[#131313] border border-[#242424] p-4 rounded text-zinc-400 text-sm">Loading analytics...</div> : null}
        {analytics.isError ? <div className="bg-red-500/10 border border-red-500/40 p-4 rounded text-red-300 text-sm">Failed to load analytics APIs.</div> : null}

        <GlobalPulseCards
          activeVisitors={activeVisitors}
          pageViews={overview?.page_views ?? 0}
          uniqueVisitors={overview?.unique_visitors ?? 0}
          uniqueSessions={overview?.unique_sessions ?? 0}
        />

        <CoreWebVitals
          ttfbMs={overview?.avg_ttfb_ms ?? 0}
          fcpMs={overview?.avg_fcp_ms ?? 0}
          lcpMs={overview?.avg_lcp_ms ?? 0}
        />

        <TrafficChart points={series} />

        <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <TopPagesTable rows={paths} />
          <DeviceStats rows={devices} />
          <ReferrersMap referrers={referrers} geo={geo} />
        </section>
      </div>

      <div className="fixed bottom-6 right-6 flex items-center gap-3 px-4 py-2 bg-emerald-500/10 border border-emerald-500/50 backdrop-blur-md rounded-lg shadow-lg z-50">
        <CheckCircle2 className="text-emerald-500 w-4 h-4" />
        <span className="text-[10px] font-mono text-emerald-500 font-bold uppercase tracking-widest">System Health: Optimal</span>
      </div>
    </div>
  );
}
