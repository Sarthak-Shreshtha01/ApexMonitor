import { TrendingUp, TrendingDown } from 'lucide-react';

const METRICS_DATA = [
  {
    id: 'requests',
    title: 'Total Requests',
    value: '1.24M',
    delta: '+12.4%',
    trend: 'up',
    color: 'text-secondary',
    stroke: '#ff4500',
    dropShadow: 'drop-shadow-[0_0_4px_rgba(255,69,0,0.5)]',
    path: 'M0 15 Q 10 5, 20 12 T 40 8 T 60 15 T 80 5 T 100 10'
  },
  {
    id: 'error_rate',
    title: 'Error Rate',
    value: '0.04%',
    delta: '-0.02%',
    trend: 'down',
    color: 'text-tertiary',
    stroke: '#f59e0b',
    dropShadow: 'drop-shadow-[0_0_4px_rgba(255,183,131,0.5)]',
    path: 'M0 5 Q 15 8, 30 5 T 60 7 T 100 5'
  },
  {
    id: 'p99_latency',
    title: 'P99 Latency',
    value: '142ms',
    delta: 'Stable',
    trend: 'neutral',
    color: 'text-secondary',
    stroke: '#ff4500',
    dropShadow: 'drop-shadow-[0_0_4px_rgba(255,69,0,0.5)]',
    path: 'M0 10 L 20 12 L 40 9 L 60 11 L 80 10 L 100 10'
  },
  {
    id: 'apdex',
    title: 'Apdex',
    value: '0.98',
    delta: '+0.01',
    trend: 'up',
    color: 'text-secondary',
    stroke: '#ff4500',
    dropShadow: 'drop-shadow-[0_0_4px_rgba(255,69,0,0.5)]',
    path: 'M0 15 L 10 12 L 25 15 L 50 8 L 75 12 L 100 5'
  }
];

export function MetricCards() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-6 mb-8">
      {METRICS_DATA.map((metric) => (
        <div key={metric.id} className="bg-surface-container-low p-4 sm:p-6 rounded-2xl border border-outline-variant/10 shadow-[0_20px_40px_-12px_rgba(0,0,0,0.5)] min-w-0">
          <div className="flex justify-between items-start mb-4">
            <span className="text-[10px] uppercase tracking-widest text-secondary font-bold">{metric.title}</span>
            <span className={`${metric.color} text-xs font-bold flex items-center gap-1`}>
              {metric.delta} 
              {metric.trend === 'up' && <TrendingUp className="w-3.5 h-3.5" />}
              {metric.trend === 'down' && <TrendingDown className="w-3.5 h-3.5" />}
            </span>
          </div>
          <div className="flex items-baseline gap-2 mb-4">
            <span className="text-2xl sm:text-3xl font-bold tracking-tight text-on-surface">{metric.value}</span>
          </div>
          <div className="h-10 w-full relative">
            <svg className="w-full h-full" viewBox="0 0 100 20" preserveAspectRatio="none">
              <path 
                className={metric.dropShadow} 
                d={metric.path} 
                fill="none" 
                stroke={metric.stroke} 
                strokeWidth="1.5"
              />
            </svg>
          </div>
        </div>
      ))}
    </div>
  );
}