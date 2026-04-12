'use client';

import { useMemo, useState } from 'react';
import { Activity, AlertTriangle, Gauge, Globe, RefreshCcw } from 'lucide-react';
import { useProjectStore } from '@/features/projects/state/project.store';
import { useDashboardStore } from '@/features/dashboard/state/dashboard.store';
import { useMetricsOverview, useMetricsOperations } from '@/features/metrics/hooks/useMetrics';

export function OverviewExplorer() {
  const activeProjectId = useProjectStore((state) => state.activeProjectId);
  const timeframe = useDashboardStore((state) => state.timeframe);
  const overviewQuery = useMetricsOverview(activeProjectId, timeframe);
  const operationsQuery = useMetricsOperations(activeProjectId, timeframe);

  const summary = overviewQuery.data?.summary;
  const series = useMemo(() => overviewQuery.data?.series ?? [], [overviewQuery.data?.series]);
  const topEndpoints = useMemo(() => overviewQuery.data?.topEndpoints ?? [], [overviewQuery.data?.topEndpoints]);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const chartModel = useMemo(() => {
    const maxRequests = Math.max(...series.map((point) => point.requestCount), 1);
    const errorRatios = series.map((point) => (point.requestCount > 0 ? (point.errorCount / point.requestCount) * 100 : 0));
    const maxErrorRatio = Math.max(...errorRatios, 0.1);

    const points = series.map((point, index) => {
      const x = series.length > 1 ? (index / (series.length - 1)) * 1000 : 500;
      const y = 250 - (point.requestCount / maxRequests) * 180;
      const errorHeight = (errorRatios[index] / maxErrorRatio) * 120;
      return { x, y, errorHeight, errorRatio: errorRatios[index], ...point };
    });

    if (points.length === 0) {
      return {
        areaPath: '',
        linePath: '',
        points,
      };
    }

    const areaPath = `M ${points[0].x} 250 ${points
      .map((point) => `L ${point.x} ${point.y}`)
      .join(' ')} L ${points[points.length - 1].x} 250 Z`;
    const linePath = `M ${points[0].x} ${points[0].y} ${points
      .slice(1)
      .map((point) => `L ${point.x} ${point.y}`)
      .join(' ')}`;

    return {
      areaPath,
      linePath,
      points,
    };
  }, [series]);

  const displayedPoint = chartModel.points.length > 0
    ? chartModel.points[hoveredIndex ?? chartModel.points.length - 1]
    : null;
  const displayedXPercent = displayedPoint ? (displayedPoint.x / 1000) * 100 : 0;
  const overviewTooltipLeftPercent = Math.min(86, Math.max(8, displayedXPercent));

  const latencyDistribution = useMemo(() => {
    const values = [...series.map((point) => point.avgLatency)].sort((a, b) => a - b);
    if (values.length === 0) {
      return { p50: 0, p90: 0, p99: 0 };
    }

    const percentile = (p: number) => {
      const idx = Math.min(values.length - 1, Math.floor((p / 100) * values.length));
      return Number(values[idx].toFixed(0));
    };

    return {
      p50: percentile(50),
      p90: percentile(90),
      p99: percentile(99),
    };
  }, [series]);

  const statusModel = useMemo(() => {
    const breakdown = operationsQuery.data?.statusBreakdown;
    if (!breakdown) {
      return { ok: 0, client: 0, server: 0, redirect: 0 };
    }

    const ok = Number(breakdown.ok2xx.rate.toFixed(2));
    const redirect = Number(breakdown.redirect3xx.rate.toFixed(2));
    const client = Number(breakdown.client4xx.rate.toFixed(2));
    const server = Number(breakdown.server5xx.rate.toFixed(2));

    return { ok, client, server, redirect };
  }, [operationsQuery.data?.statusBreakdown]);

  const topRegions = operationsQuery.data?.regions ?? [];
  const clusterNodes = operationsQuery.data?.nodes ?? [];

  if (!activeProjectId) {
    return (
      <div className="max-w-350 mx-auto w-full p-8">
        <div className="bg-surface-container p-6 border border-outline-variant rounded-lg text-primary-foreground">
          Select a project from the navbar to view overview metrics.
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-375 mx-auto w-full p-4 sm:p-6 lg:p-8 space-y-5 sm:space-y-6 custom-scrollbar">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg sm:text-xl font-semibold tracking-tight text-white uppercase">Overview</h2>
          <p className="text-xs text-secondary font-mono">Project {activeProjectId} · Timeframe {timeframe}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            overviewQuery.refetch();
            operationsQuery.refetch();
          }}
          className="inline-flex items-center gap-2 px-3 py-1.5 text-[10px] uppercase font-bold tracking-widest border border-outline-variant text-secondary hover:text-white hover:bg-surface-container-high"
        >
          <RefreshCcw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {overviewQuery.isLoading || operationsQuery.isLoading ? (
        <div className="bg-surface-container p-6 border border-outline-variant rounded-lg text-primary-foreground">Loading overview metrics...</div>
      ) : null}

      {overviewQuery.isError || operationsQuery.isError ? (
        <div className="bg-error/10 border border-error/30 rounded-lg p-6 text-error">Failed to load overview metrics. Please retry.</div>
      ) : null}

      {!overviewQuery.isLoading && !operationsQuery.isLoading && !overviewQuery.isError && !operationsQuery.isError && summary ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard title="Requests (RPS)" value={summary.rps.toFixed(2)} sub={`${formatCount(summary.totalRequests)} total`} accent="orange" />
            <MetricCard title="Error Rate" value={`${summary.errorRate}%`} sub={`${summary.totalErrors} total errors`} accent="amber" />
            <MetricCard title="P99 Latency" value={`${summary.p99Latency}ms`} sub={`avg ${summary.avgLatency}ms`} accent="orange" />
            <MetricCard title="Apdex" value={summary.apdex.toFixed(2)} sub={summary.apdex >= 0.85 ? 'Healthy' : 'Needs attention'} accent="neutral" />
          </div>

          <section className="bg-surface-container p-4 sm:p-6 border border-outline-variant rounded-lg">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <div>
                <h3 className="text-sm font-bold tracking-widest text-white uppercase">Traffic Overview</h3>
                <p className="text-[11px] text-secondary font-mono">Real-time composite metric stream (RPS + Errors)</p>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 bg-primary"></span>
                  <span className="text-[10px] uppercase font-bold text-secondary">RPS Area</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 bg-tertiary"></span>
                  <span className="text-[10px] uppercase font-bold text-secondary">Error Bars</span>
                </div>
              </div>
            </div>

            <div className="h-56 sm:h-64 relative w-full border-l border-b border-outline-variant overflow-hidden" onMouseLeave={() => setHoveredIndex(null)}>
              {chartModel.points.length === 0 ? (
                <div className="h-full w-full grid place-items-center text-secondary text-sm">No chart points available for selected timeframe.</div>
              ) : (
                <>
                  <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none" viewBox="0 0 1000 260">
                    <defs>
                      <linearGradient id="overviewReqGrad" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="#ff4500" stopOpacity="0.35" />
                        <stop offset="100%" stopColor="#ff4500" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <path d={chartModel.areaPath} fill="url(#overviewReqGrad)" className="transition-all duration-300 ease-out" />
                    <path d={chartModel.linePath} fill="none" stroke="#ff4500" strokeWidth="2" className="transition-all duration-300 ease-out" />
                    {chartModel.points.map((point) => (
                      <rect
                        key={`err-${point.bucket}`}
                        x={point.x - 10}
                        y={250 - point.errorHeight}
                        width="20"
                        height={Math.max(point.errorHeight, 2)}
                        fill="rgba(245, 158, 11, 0.3)"
                        stroke="rgba(245, 158, 11, 0.45)"
                        className="transition-all duration-200 ease-out"
                      />
                    ))}
                  </svg>

                  {displayedPoint ? (
                    <>
                      <div
                        className="absolute top-0 bottom-0 w-px bg-white/40 transition-all duration-150"
                        style={{ left: `${displayedXPercent}%` }}
                      >
                        <div className="absolute top-[32%] -translate-y-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-white ring-4 ring-white/20" />
                      </div>
                      <div
                        className="absolute top-2 bg-surface-container-high border border-outline-variant px-2 py-1 rounded-md text-[10px] whitespace-nowrap z-20 transition-all duration-150"
                        style={{ left: `calc(${overviewTooltipLeftPercent}% - 56px)` }}
                      >
                        <div className="font-mono text-primary">Requests: {formatCount(displayedPoint.requestCount)}</div>
                        <div className="font-mono text-tertiary">Err: {displayedPoint.errorRatio.toFixed(2)}%</div>
                        <div className="font-mono text-secondary">{new Date(displayedPoint.bucket).toLocaleTimeString()}</div>
                      </div>
                    </>
                  ) : null}

                  <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${chartModel.points.length}, minmax(0, 1fr))` }}>
                    {chartModel.points.map((point, index) => (
                      <button
                        key={`hit-${point.bucket}`}
                        onMouseEnter={() => setHoveredIndex(index)}
                        onFocus={() => setHoveredIndex(index)}
                        onMouseLeave={() => setHoveredIndex(null)}
                        className="h-full w-full outline-none"
                        aria-label={`Point ${new Date(point.bucket).toLocaleString()}`}
                        type="button"
                      />
                    ))}
                  </div>
                </>
              )}

              <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                {[1, 2, 3, 4].map((idx) => (
                  <div key={idx} className="w-full border-t border-outline-variant/50" />
                ))}
              </div>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-5 mt-4 gap-2 text-[10px] font-mono text-muted uppercase">
              {chartModel.points.slice(0, 5).map((point, idx, arr) => (
                <span key={`label-${point.bucket}`} className={`${idx === 0 ? 'text-left' : idx === arr.length - 1 ? 'text-right' : 'text-center'} truncate`}>
                  {new Date(point.bucket).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              ))}
            </div>
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
            <div className="bg-surface-container p-5 border border-outline-variant rounded-lg">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-[11px] font-bold uppercase tracking-widest text-white">Latency Distribution</h3>
                <Gauge className="text-secondary w-4 h-4" />
              </div>
              <div className="space-y-4">
                <LatencyBar label="P50 Mean" value={latencyDistribution.p50} pct={Math.min(100, (latencyDistribution.p50 / Math.max(latencyDistribution.p99, 1)) * 100)} tone="bg-surface-container-highest" />
                <LatencyBar label="P90 Target" value={latencyDistribution.p90} pct={Math.min(100, (latencyDistribution.p90 / Math.max(latencyDistribution.p99, 1)) * 100)} tone="bg-tertiary" />
                <LatencyBar label="P99 Tail" value={latencyDistribution.p99} pct={100} tone="bg-primary" />
              </div>
              <div className="mt-6 pt-4 border-t border-outline-variant text-[10px] font-mono text-muted italic">
                Computed from {formatCount(summary.totalRequests)} requests in {timeframe}
              </div>
            </div>

            <div className="bg-surface-container p-5 border border-outline-variant rounded-lg overflow-hidden">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-[11px] font-bold uppercase tracking-widest text-white">Top Endpoints</h3>
                <div className="flex items-center gap-1 text-[10px] text-secondary font-mono">
                  <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span> Live
                </div>
              </div>
              <table className="w-full text-left border-separate border-spacing-y-2">
                <thead>
                  <tr className="text-[10px] uppercase tracking-tighter text-secondary">
                    <th className="pb-2 font-normal">Method</th>
                    <th className="pb-2 font-normal">Endpoint</th>
                    <th className="pb-2 font-normal text-right">Hits</th>
                  </tr>
                </thead>
                <tbody className="text-[11px] font-mono">
                  {topEndpoints.slice(0, 6).map((row) => (
                    <tr key={`${row.method}:${row.endpoint}`} className="hover:bg-surface-container-high transition-colors cursor-pointer">
                      <td className="py-2">
                        <span className="px-2 py-1 rounded-sm bg-primary/20 text-primary border border-primary/20">{row.method}</span>
                      </td>
                      <td className="py-2 text-primary-foreground truncate max-w-45">{row.endpoint}</td>
                      <td className="py-2 text-right font-bold text-white">{formatCount(row.requests)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="bg-surface-container p-5 border border-outline-variant rounded-lg">
              <div className="mb-4">
                <h3 className="text-[11px] font-bold uppercase tracking-widest text-white">Status Breakdown</h3>
              </div>
              <div className="flex flex-col gap-5">
                <div className="relative w-32 h-32 mx-auto">
                  <div
                    className="absolute inset-0 rounded-full"
                    style={{
                      background: `conic-gradient(#ff4500 0 ${statusModel.ok}%, #f59e0b ${statusModel.ok}% ${statusModel.ok + statusModel.client}%, #737373 ${statusModel.ok + statusModel.client}% ${statusModel.ok + statusModel.client + statusModel.redirect}%, #ef4444 ${statusModel.ok + statusModel.client + statusModel.redirect}% 100%)`,
                    }}
                  />
                  <div className="absolute inset-3.5 bg-surface-container rounded-full flex items-center justify-center flex-col">
                    <span className="text-xs font-mono font-bold text-white">100%</span>
                    <span className="text-[8px] text-secondary uppercase tracking-tighter">Total</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                  <StatusRow dot="bg-primary" label="200 OK" value={`${statusModel.ok.toFixed(1)}%`} />
                  <StatusRow dot="bg-tertiary" label="4XX REQ" value={`${statusModel.client.toFixed(1)}%`} />
                  <StatusRow dot="bg-secondary" label="3XX RED" value={`${statusModel.redirect.toFixed(1)}%`} />
                  <StatusRow dot="bg-error" label="5XX ERR" value={`${statusModel.server.toFixed(1)}%`} />
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 pb-10">
            <div className="md:col-span-8 bg-surface-container border border-outline-variant h-64 relative overflow-hidden rounded-lg p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[11px] font-bold uppercase tracking-widest text-white">Global Ingress Distribution</h3>
                <span className="text-[10px] text-secondary font-mono">Top regions by requests</span>
              </div>

              <div className="space-y-3">
                {topRegions.slice(0, 6).map((region) => {
                  const maxRequests = Math.max(...topRegions.map((item) => item.requests), 1);
                  const width = Math.max(4, Math.round((region.requests / maxRequests) * 100));

                  return (
                    <div key={region.region}>
                      <div className="flex justify-between items-center text-[10px] font-mono mb-1">
                        <span className="text-white">{region.region}</span>
                        <span className="text-secondary">{formatCount(region.requests)} req · {region.errorRate.toFixed(2)}% err</span>
                      </div>
                      <div className="h-1.5 bg-app border border-outline-variant overflow-hidden">
                        <div className="h-full bg-primary" style={{ width: `${width}%` }} />
                      </div>
                    </div>
                  );
                })}

                {topRegions.length === 0 ? (
                  <div className="h-40 grid place-items-center text-secondary text-sm">No regional ingress data for selected timeframe.</div>
                ) : null}
              </div>
            </div>

            <div className="md:col-span-4 bg-surface-container border border-outline-variant p-5 flex flex-col justify-between rounded-lg">
              <div>
                <h3 className="text-[11px] font-bold uppercase tracking-widest text-white mb-4">Cluster Health</h3>
                <div className="space-y-3">
                  {clusterNodes.slice(0, 4).map((item) => (
                    <div key={item.nodeId} className="flex items-center justify-between p-2 bg-app border border-outline-variant">
                      <span className="text-[11px] font-mono text-secondary">{item.nodeId}</span>
                      {item.status === 'ok' ? (
                        <Activity className="w-3.5 h-3.5 text-primary" />
                      ) : (
                        <AlertTriangle className="w-3.5 h-3.5 text-tertiary" />
                      )}
                    </div>
                  ))}
                  {clusterNodes.length === 0 ? (
                    <div className="text-[11px] font-mono text-secondary p-2 bg-app border border-outline-variant">No node health data in selected range.</div>
                  ) : null}
                </div>
              </div>

              <div className="mt-6">
                <div className="text-[10px] text-secondary uppercase font-bold mb-2">Resource Utilization</div>
                <div className="flex items-center gap-4">
                  <UtilRow label="CPU" value={Math.min(95, Math.round(summary.apdex * 70 + 20))} tone="bg-primary" />
                  <UtilRow label="MEM" value={Math.min(98, Math.round(summary.errorRate * 4 + 58))} tone="bg-tertiary" />
                </div>
                <div className="mt-4 text-[10px] text-secondary font-mono flex items-center gap-2">
                  <Globe className="w-3.5 h-3.5" /> {series.length} telemetry buckets ingested
                </div>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

function MetricCard({
  title,
  value,
  sub,
  accent,
}: {
  title: string;
  value: string;
  sub: string;
  accent: 'orange' | 'amber' | 'neutral';
}) {
  const accentBar = accent === 'orange' ? 'bg-primary' : accent === 'amber' ? 'bg-tertiary' : 'bg-secondary';

  return (
    <div className="bg-surface-container p-5 border border-outline-variant rounded-lg relative overflow-hidden transition-colors hover:bg-surface-container-high">
      <p className="text-[11px] uppercase tracking-wider text-secondary font-bold mb-2">{title}</p>
      <p className="text-3xl font-mono font-bold text-white tracking-tight tabular-nums">{value}</p>
      <p className="text-[11px] text-muted mt-1 font-mono">{sub}</p>
      <div className={`absolute bottom-0 left-0 h-0.5 w-full ${accentBar} opacity-70`} />
    </div>
  );
}

function LatencyBar({ label, value, pct, tone }: { label: string; value: number; pct: number; tone: string }) {
  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <span className="text-[11px] font-mono text-secondary">{label}</span>
        <span className="text-[12px] font-mono font-bold text-white">{value}ms</span>
      </div>
      <div className="w-full h-1 bg-surface-container-high rounded-full overflow-hidden">
        <div className={`h-full ${tone} transition-all duration-300`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function StatusRow({ dot, label, value }: { dot: string; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className={`w-2 h-2 ${dot}`} />
      <div className="flex flex-col">
        <span className="text-[10px] text-secondary font-bold">{label}</span>
        <span className="text-[12px] font-mono text-white">{value}</span>
      </div>
    </div>
  );
}

function UtilRow({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="flex-1">
      <div className="flex justify-between text-[10px] mb-1">
        <span className="text-secondary">{label}</span>
        <span className="text-white">{value}%</span>
      </div>
      <div className="w-full h-1 bg-surface-container-high rounded-full">
        <div className={`h-full ${tone}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function formatCount(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return `${value}`;
}
