export function HealthForecastMetrics() {
  const metrics = [
    { label: 'P99 Latency', value: '124', unit: 'ms', trend: '+12% vs baseline', trendColor: 'text-orange-500' },
    { label: 'Error Rate', value: '0.02', unit: '%', trend: '+0.01% vs baseline', trendColor: 'text-rose-500' },
    { label: 'Throughput', value: '12.4', unit: 'k/s', trend: 'Steady', trendColor: 'text-neutral-500' },
    { label: 'Saturation', value: '42', unit: '%', trend: '+5% vs baseline', trendColor: 'text-amber-500' },
  ];

  return (
    <div className="bg-[#131313] border border-neutral-800 p-6 rounded-xl">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-6 gap-4">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-400 mb-1">AI System Health Forecast</h3>
          <p className="text-neutral-500 text-xs">Stability predicted for next 6h based on current ingress trends.</p>
        </div>
        <div className="sm:text-right">
          <p className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Current Score</p>
          <p className="text-4xl font-mono font-bold text-orange-500 tracking-tighter">
            91<span className="text-base text-neutral-600">/100</span>
          </p>
          <p className="text-[10px] text-rose-500 font-bold mt-1">-3 points predicted in 2h</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {metrics.map((m) => (
          <div key={m.label} className="p-4 bg-neutral-950 border border-neutral-800 rounded-lg">
            <p className="text-[10px] text-neutral-500 uppercase font-bold tracking-widest mb-1">{m.label}</p>
            <p className="text-xl font-mono text-white">
              {m.value}<span className="text-xs text-neutral-500 ml-1">{m.unit}</span>
            </p>
            <p className={`text-[10px] font-mono mt-2 ${m.trendColor}`}>{m.trend}</p>
          </div>
        ))}
      </div>
    </div>
  );
}