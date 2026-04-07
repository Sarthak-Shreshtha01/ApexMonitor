'use client';

import { useProjectStore } from '@/features/projects/state/project.store';
import { useDashboardStore } from '@/features/dashboard/state/dashboard.store';
import { useMetricsOverview } from '@/features/metrics/hooks/useMetrics';

export function OverviewExplorer() {
  const activeProjectId = useProjectStore((state) => state.activeProjectId);
  const timeframe = useDashboardStore((state) => state.timeframe);
  const overviewQuery = useMetricsOverview(activeProjectId, timeframe);

  const summary = overviewQuery.data?.summary;
  const series = overviewQuery.data?.series ?? [];
  const topEndpoints = overviewQuery.data?.topEndpoints ?? [];

  const totalSeriesRequests = series.reduce((acc, point) => acc + point.requestCount, 0);

  if (!activeProjectId) {
    return (
      <div className="max-w-[1400px] mx-auto w-full p-8">
        <div className="bg-surface-container-low border border-outline-variant/10 rounded-2xl p-6 text-primary-foreground">
          Select a project from the navbar to view overview metrics.
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto w-full space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-white">Overview</h2>
          <p className="text-sm text-secondary">Project {activeProjectId} · Timeframe {timeframe}</p>
        </div>
      </div>

      {overviewQuery.isLoading ? (
        <div className="bg-surface-container-low border border-outline-variant/10 rounded-2xl p-6 text-primary-foreground">Loading overview metrics...</div>
      ) : null}

      {overviewQuery.isError ? (
        <div className="bg-error/10 border border-error/30 rounded-2xl p-6 text-error">Failed to load overview metrics. Please retry.</div>
      ) : null}

      {!overviewQuery.isLoading && !overviewQuery.isError && summary ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <MetricCard title="Total Requests" value={formatCount(summary.totalRequests)} sub={`${summary.rps} req/s`} />
            <MetricCard title="Error Rate" value={`${summary.errorRate}%`} sub={`${summary.totalErrors} errors`} />
            <MetricCard title="P99 Latency" value={`${summary.p99Latency} ms`} sub={`avg ${summary.avgLatency} ms`} />
            <MetricCard title="Apdex" value={summary.apdex.toFixed(2)} sub={summary.apdex >= 0.85 ? 'Healthy' : 'Needs attention'} />
          </div>

          <div className="bg-surface-container-low p-6 rounded-2xl border border-outline-variant/10">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">Request Volume Over Time</h3>
              <span className="text-xs text-secondary">{series.length} points</span>
            </div>
            <div className="h-[220px] flex items-end gap-2">
              {series.length === 0 ? (
                <p className="text-sm text-secondary">No time-series points available for selected timeframe.</p>
              ) : (
                series.map((point) => {
                  const barHeight = totalSeriesRequests > 0 ? Math.max(8, (point.requestCount / Math.max(...series.map((s) => s.requestCount), 1)) * 100) : 8;
                  return (
                    <div key={point.bucket} className="flex-1 flex flex-col items-center gap-2">
                      <div
                        className="w-full rounded-t bg-primary/60 border border-primary/30"
                        style={{ height: `${barHeight}%` }}
                        title={`${new Date(point.bucket).toLocaleString()} · ${point.requestCount} req`}
                      />
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="bg-surface-container-low rounded-2xl border border-outline-variant/10 overflow-hidden">
            <div className="px-6 py-4 border-b border-outline-variant/10 flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">Top Endpoints</h3>
              <span className="text-xs text-secondary">{topEndpoints.length} endpoints</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px]">
                <thead>
                  <tr className="bg-surface-container-high/30">
                    <th className="px-6 py-3 text-left text-[10px] uppercase tracking-wider text-secondary">Method</th>
                    <th className="px-6 py-3 text-left text-[10px] uppercase tracking-wider text-secondary">Endpoint</th>
                    <th className="px-6 py-3 text-left text-[10px] uppercase tracking-wider text-secondary">Requests</th>
                    <th className="px-6 py-3 text-left text-[10px] uppercase tracking-wider text-secondary">Error Rate</th>
                    <th className="px-6 py-3 text-left text-[10px] uppercase tracking-wider text-secondary">P99</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/5">
                  {topEndpoints.map((row) => (
                    <tr key={`${row.method}:${row.endpoint}`} className="hover:bg-primary/5">
                      <td className="px-6 py-3 text-xs text-primary font-mono">{row.method}</td>
                      <td className="px-6 py-3 text-sm text-on-surface font-mono">{row.endpoint}</td>
                      <td className="px-6 py-3 text-xs text-primary-foreground">{formatCount(row.requests)}</td>
                      <td className="px-6 py-3 text-xs text-primary-foreground">{row.errorRate}%</td>
                      <td className="px-6 py-3 text-xs text-primary-foreground">{row.p99Latency} ms</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

function MetricCard({ title, value, sub }: { title: string; value: string; sub: string }) {
  return (
    <div className="bg-surface-container-low p-5 rounded-2xl border border-outline-variant/10">
      <p className="text-[10px] uppercase tracking-widest text-secondary font-bold mb-2">{title}</p>
      <p className="text-2xl font-black text-white tracking-tight">{value}</p>
      <p className="text-xs text-secondary mt-1">{sub}</p>
    </div>
  );
}

function formatCount(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return `${value}`;
}
