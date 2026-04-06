export function LiveThroughputCard() {
  // Dummy data for sparkline heights (percentages)
  const sparklineHeights = [40, 25, 35, 50, 40, 60, 15, 25, 40, 35, 45, 55];

  return (
    <div className="bg-surface-container-low rounded-2xl p-8 border border-outline-variant/15 relative overflow-hidden">
      <div className="absolute -top-24 -left-24 w-64 h-64 bg-indigo-500/10 blur-[100px]"></div>
      
      <div className="flex justify-between items-start relative z-10">
        <div>
          <h2 className="text-xs uppercase tracking-widest text-secondary font-bold mb-1">Live Throughput</h2>
          <div className="flex items-baseline gap-4">
            <span className="text-6xl font-black tracking-tighter text-on-surface">1,284.5</span>
            <span className="text-xl font-medium text-slate-500">RPS</span>
          </div>
        </div>
        <div className="flex flex-col items-end">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-secondary animate-pulse"></div>
            <span className="text-xs font-bold text-secondary uppercase tracking-widest">Streaming Live</span>
          </div>
          <div className="text-right">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500">LATENCY (P99)</p>
            <p className="text-2xl font-bold text-indigo-200">142ms</p>
          </div>
        </div>
      </div>

      <div className="mt-8 h-32 w-full flex items-end gap-1">
        {sparklineHeights.map((h, i) => (
          <div 
            key={i} 
            style={{ height: `${h}%` }}
            className={`w-full bg-gradient-to-t from-secondary/20 to-secondary/40 rounded-t-sm border-t border-secondary/50 transition-all duration-500 ${
              i === 5 ? 'shadow-[0_0_15px_-2px_rgba(93,230,255,0.4)]' : ''
            }`}
          ></div>
        ))}
      </div>
    </div>
  );
}