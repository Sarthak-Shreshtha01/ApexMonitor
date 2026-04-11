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
  const linePath = buildPath(points);
  const areaPath = linePath
    ? `${linePath} L1000,400 L0,400 Z`
    : '';

  return (
    <section className="bg-[#131313] border border-[#242424] p-8 rounded-lg">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-lg font-bold text-white">{timeframe.toUpperCase()} Traffic Distribution</h2>
        <div className="flex gap-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-[#FF4500] rounded-sm"></div>
            <span className="text-[10px] font-mono text-zinc-400">PAGE VIEWS</span>
          </div>
        </div>
      </div>

      <div className="h-100 w-full relative">
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
          <path d={areaPath} fill="url(#chartGradient)"></path>

          {/* Main Line */}
          <path className="drop-shadow-[0_0_8px_rgba(255,69,0,0.5)]" d={linePath} fill="none" stroke="#FF4500" strokeWidth="3"></path>
        </svg>

        {/* X-Axis Labels */}
        <div className="flex justify-between mt-4 text-[10px] font-mono text-zinc-600">
          <span>{points[0] ? new Date(points[0].bucket).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}</span>
          <span>{points[Math.floor(points.length * 0.2)] ? new Date(points[Math.floor(points.length * 0.2)].bucket).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}</span>
          <span>{points[Math.floor(points.length * 0.4)] ? new Date(points[Math.floor(points.length * 0.4)].bucket).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}</span>
          <span>{points[Math.floor(points.length * 0.6)] ? new Date(points[Math.floor(points.length * 0.6)].bucket).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}</span>
          <span>{points[Math.floor(points.length * 0.8)] ? new Date(points[Math.floor(points.length * 0.8)].bucket).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}</span>
          <span>{points[Math.max(points.length - 1, 0)] ? new Date(points[Math.max(points.length - 1, 0)].bucket).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}</span>
        </div>
      </div>
    </section>
  );
}