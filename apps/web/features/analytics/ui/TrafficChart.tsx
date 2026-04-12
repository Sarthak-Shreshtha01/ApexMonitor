import { useMemo, useState } from 'react';

type TrafficPoint = {
  bucket: string;
  page_views: number;
};

type TrafficChartProps = {
  points: TrafficPoint[];
  timeframe: '1h' | '6h' | '24h' | '7d';
};

const buildPath = (values: TrafficPoint[]): string => {
  if (values.length === 0) return '';
  const max = Math.max(...values.map((point) => point.page_views), 1);

  return values
    .map((point, index) => {
      const x = values.length === 1 ? 0 : (index / (values.length - 1)) * 1000;
      const y = 360 - (point.page_views / max) * 280;
      return `${index === 0 ? 'M' : 'L'}${x},${y}`;
    })
    .join(' ');
};

export function TrafficChart({ points, timeframe }: TrafficChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const linePath = buildPath(points);
  const areaPath = linePath
    ? `${linePath} L1000,400 L0,400 Z`
    : '';

  const chartPoints = useMemo(() => {
    const max = Math.max(...points.map((point) => point.page_views), 1);
    return points.map((point, index) => {
      const x = points.length === 1 ? 500 : (index / (points.length - 1)) * 1000;
      const y = 360 - (point.page_views / max) * 280;
      return { ...point, x, y };
    });
  }, [points]);

  const activePoint = chartPoints.length > 0
    ? chartPoints[hoveredIndex ?? chartPoints.length - 1]
    : null;
  const activeXPercent = activePoint ? (activePoint.x / 1000) * 100 : 0;
  const tooltipLeftPercent = Math.min(86, Math.max(8, activeXPercent));

  const timeLabels = [0, 0.2, 0.4, 0.6, 0.8, 1].map((ratio) => {
    const idx = Math.min(points.length - 1, Math.max(0, Math.floor((points.length - 1) * ratio)));
    const point = points[idx];
    return point
      ? new Date(point.bucket).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : '--:--';
  });

  return (
    <section className="bg-[#131313] border border-[#242424] p-4 sm:p-8 rounded-lg">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-8">
        <h2 className="text-lg font-bold text-white">{timeframe.toUpperCase()} Traffic Distribution</h2>
        <div className="flex gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-[#FF4500] rounded-sm"></div>
            <span className="text-[10px] font-mono text-zinc-400">PAGE VIEWS</span>
          </div>
        </div>
      </div>

      <div className="h-64 sm:h-100 w-full relative overflow-hidden" onMouseLeave={() => setHoveredIndex(null)}>
        <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 1000 400">
          <defs>
            <linearGradient id="chartGradient" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#FF4500" stopOpacity="0.3"></stop>
              <stop offset="100%" stopColor="#FF4500" stopOpacity="0"></stop>
            </linearGradient>
          </defs>
          
          {/* Grid Lines */}
          <line stroke="#242424" strokeDasharray="4" strokeWidth="1" x1="0" x2="1000" y1="0" y2="0"></line>
          <line stroke="#242424" strokeDasharray="4" strokeWidth="1" x1="0" x2="1000" y1="100" y2="100"></line>
          <line stroke="#242424" strokeDasharray="4" strokeWidth="1" x1="0" x2="1000" y1="200" y2="200"></line>
          <line stroke="#242424" strokeDasharray="4" strokeWidth="1" x1="0" x2="1000" y1="300" y2="300"></line>
          <line stroke="#242424" strokeDasharray="4" strokeWidth="1" x1="0" x2="1000" y1="400" y2="400"></line>
          
          {/* Area Fill */}
          <path d={areaPath} fill="url(#chartGradient)" className="transition-all duration-300 ease-out"></path>

          {/* Main Line */}
          <path className="drop-shadow-[0_0_8px_rgba(255,69,0,0.5)] transition-all duration-300 ease-out" d={linePath} fill="none" stroke="#FF4500" strokeWidth="3"></path>
        </svg>

        {activePoint ? (
          <>
            <div className="absolute top-0 bottom-0 w-px bg-[#FF4500]/60 transition-all duration-150" style={{ left: `${activeXPercent}%` }}>
              <div className="absolute left-1/2 top-[42%] -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-[#FF4500] ring-4 ring-[#FF4500]/25" />
            </div>
            <div
              className="absolute top-3 bg-black/75 border border-white/10 rounded-md px-2 py-1 text-[10px] font-mono text-white backdrop-blur-sm transition-all duration-150"
              style={{ left: `calc(${tooltipLeftPercent}% - 48px)` }}
            >
              <div className="text-[#ff7b52]">{activePoint.page_views.toLocaleString()} views</div>
              <div className="text-zinc-300">{new Date(activePoint.bucket).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
            </div>
          </>
        ) : null}

        <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${Math.max(chartPoints.length, 1)}, minmax(0, 1fr))` }}>
          {chartPoints.map((point, index) => (
            <button
              key={point.bucket}
              type="button"
              onMouseEnter={() => setHoveredIndex(index)}
              onFocus={() => setHoveredIndex(index)}
              className="h-full w-full"
              aria-label={`Traffic at ${new Date(point.bucket).toLocaleString()}`}
            />
          ))}
        </div>

        {/* X-Axis Labels */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mt-4 text-[10px] font-mono text-zinc-600">
          {timeLabels.map((label, idx) => (
            <span key={`${label}-${idx}`} className={`${idx === 0 ? 'text-left' : idx === timeLabels.length - 1 ? 'text-right' : 'text-center'} truncate`}>
              {label}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}