'use client';

import { useMemo, useState } from 'react';
import type { OverviewMetricsResponse } from '@/features/metrics/api/metrics.service';

interface LiveThroughputCardProps {
  summary: OverviewMetricsResponse['summary'] | undefined;
  series: OverviewMetricsResponse['series'];
  liveRps?: number;
  liveErrorRate?: number;
  isSocketConnected: boolean;
}

export function LiveThroughputCard({
  summary,
  series,
  liveRps,
  liveErrorRate,
  isSocketConnected,
}: LiveThroughputCardProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const chart = useMemo(() => {
    const maxReq = Math.max(...series.map((point) => point.requestCount), 1);
    const maxLat = Math.max(...series.map((point) => point.avgLatency), 1);
    const maxErr = Math.max(
      ...series.map((point) => (point.requestCount > 0 ? (point.errorCount / point.requestCount) * 100 : 0)),
      0.01
    );

    const points = series.map((point, index) => {
      const x = series.length > 1 ? (index / (series.length - 1)) * 1000 : 500;
      const velocityY = 360 - (point.requestCount / maxReq) * 300;
      const latencyY = 360 - (point.avgLatency / maxLat) * 260;
      const errorRatio = point.requestCount > 0 ? (point.errorCount / point.requestCount) * 100 : 0;
      const errorY = 380 - (errorRatio / maxErr) * 70;

      return {
        x,
        velocityY,
        latencyY,
        errorY,
        errorRatio,
        ...point,
      };
    });

    const pathFor = (selector: (point: (typeof points)[number]) => number) => {
      if (points.length === 0) return '';
      return `M ${points[0].x} ${selector(points[0])} ${points
        .slice(1)
        .map((point) => `L ${point.x} ${selector(point)}`)
        .join(' ')}`;
    };

    return {
      points,
      velocityPath: pathFor((point) => point.velocityY),
      latencyPath: pathFor((point) => point.latencyY),
      errorPath: pathFor((point) => point.errorY),
    };
  }, [series]);

  const activePoint = chart.points.length > 0
    ? chart.points[hoveredIndex ?? chart.points.length - 1]
    : null;

  const requestVelocity = liveRps ?? summary?.rps ?? 0;
  const avgLatency = summary?.avgLatency ?? 0;
  const errorRate = liveErrorRate ?? summary?.errorRate ?? 0;
  const computeLoad = Math.min(99.9, Math.max(12, avgLatency * 0.7));

  return (
    <section className="flex-1 bg-surface min-w-0 border-r border-outline-variant flex flex-col">
      <div className="grid grid-cols-2 md:grid-cols-4 border-b border-outline-variant bg-app">
        <StatTile
          title="Request Velocity"
          value={requestVelocity.toFixed(1)}
          unit="RPS"
          delta={isSocketConnected ? 'LIVE' : 'POLL'}
          accent="text-primary"
        />
        <StatTile
          title="Avg Latency"
          value={avgLatency.toFixed(1)}
          unit="MS"
          delta={`${summary?.p99Latency ?? 0} P99`}
          accent="text-tertiary"
        />
        <StatTile
          title="Error Rate"
          value={errorRate.toFixed(2)}
          unit="%"
          delta={`${summary?.totalErrors ?? 0} ERR`}
          accent="text-tertiary"
        />
        <StatTile
          title="Compute Load"
          value={computeLoad.toFixed(1)}
          unit="GZ"
          delta={`${Math.min(99, Math.round(computeLoad * 0.75))}% CAP`}
          accent="text-white"
        />
      </div>

      <div className="flex-1 bg-surface relative overflow-hidden flex flex-col">
        <div className="p-4 border-b border-outline-variant flex justify-between items-center bg-app">
          <div className="flex items-center gap-4">
            <span className="text-[10px] font-bold text-white uppercase tracking-widest">Unified Performance Monitor</span>
            <div className="flex gap-4 text-[9px] font-mono">
              <span className="flex items-center gap-1.5 text-primary"><div className="w-2 h-0.5 bg-primary"></div> VELOCITY</span>
              <span className="flex items-center gap-1.5 text-primary-foreground"><div className="w-2 h-0.5 bg-primary-foreground"></div> LATENCY</span>
              <span className="flex items-center gap-1.5 text-tertiary"><div className="w-2 h-0.5 bg-tertiary"></div> ERROR RATE</span>
            </div>
          </div>
          <span className="text-[9px] font-mono text-secondary uppercase">T-{series.length * 5}s window</span>
        </div>

        <div className="flex-1 relative p-4 grid-blueprint">
          {chart.points.length === 0 ? (
            <div className="h-full w-full grid place-items-center text-secondary text-sm">No live chart points available.</div>
          ) : (
            <>
              <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 1000 400">
                <path d={chart.velocityPath} fill="none" stroke="#FF4500" strokeWidth="2" className="animate-[fadeSlideUp_220ms_ease-out]" />
                <path d={chart.latencyPath} fill="none" stroke="#FFFFFF" strokeDasharray="4" strokeWidth="1.5" className="opacity-70" />
                <path d={chart.errorPath} fill="none" stroke="#F59E0B" strokeWidth="1.5" className="opacity-80" />
                <line x1="0" y1="380" x2="1000" y2="380" stroke="#242424" strokeWidth="0.6" />
                <line x1="0" y1="300" x2="1000" y2="300" stroke="#242424" strokeWidth="0.6" />
                <line x1="0" y1="200" x2="1000" y2="200" stroke="#242424" strokeWidth="0.6" />
                <line x1="0" y1="100" x2="1000" y2="100" stroke="#242424" strokeWidth="0.6" />
              </svg>

              {activePoint ? (
                <>
                  <div className="absolute top-0 bottom-0 w-px bg-primary/70" style={{ left: `${(activePoint.x / 1000) * 100}%` }} />
                  <div
                    className="absolute top-6 bg-surface-container border border-outline-variant px-2 py-1 rounded-md text-[10px] font-mono z-20"
                    style={{ left: `calc(${(activePoint.x / 1000) * 100}% - 40px)` }}
                  >
                    <div className="text-primary">RPS: {(activePoint.requestCount / 60).toFixed(1)}</div>
                    <div className="text-primary-foreground">LAT: {activePoint.avgLatency.toFixed(1)}ms</div>
                    <div className="text-tertiary">ERR: {activePoint.errorRatio.toFixed(2)}%</div>
                  </div>
                </>
              ) : null}

              <div className="absolute inset-4 grid" style={{ gridTemplateColumns: `repeat(${chart.points.length}, minmax(0, 1fr))` }}>
                {chart.points.map((point, index) => (
                  <button
                    key={point.bucket}
                    type="button"
                    onMouseEnter={() => setHoveredIndex(index)}
                    onMouseLeave={() => setHoveredIndex(null)}
                    onFocus={() => setHoveredIndex(index)}
                    className="h-full w-full"
                    aria-label={`Traffic point ${new Date(point.bucket).toLocaleString()}`}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function StatTile({
  title,
  value,
  unit,
  delta,
  accent,
}: {
  title: string;
  value: string;
  unit: string;
  delta: string;
  accent: string;
}) {
  return (
    <div className="p-4 border-r border-outline-variant flex flex-col relative overflow-hidden">
      <span className="text-[9px] font-bold text-secondary uppercase tracking-widest mb-1">{title}</span>
      <div className="flex items-baseline gap-2 z-10">
        <span className="text-3xl font-black font-mono text-white tracking-tighter">{value}</span>
        <span className={`text-[10px] font-mono ${accent}`}>{unit}</span>
      </div>
      <span className={`absolute top-4 right-4 text-[9px] font-mono ${accent}`}>{delta}</span>
    </div>
  );
}
