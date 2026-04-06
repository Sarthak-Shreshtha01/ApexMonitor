export function LogsHeader() {
  return (
    <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
      <div>
        <h2 className="text-4xl font-extrabold tracking-tight text-white mb-1">Logs Explorer</h2>
        <p className="text-on-surface-variant text-sm font-medium">Monitoring 4,209 requests in the last 24 hours.</p>
      </div>
      <div className="flex gap-4">
        <div className="bg-surface-container-low p-4 rounded-xl border border-outline-variant/10 min-w-[140px]">
          <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">Error Rate</p>
          <p className="text-2xl font-semibold text-error tracking-tight">0.24%</p>
        </div>
        <div className="bg-surface-container-low p-4 rounded-xl border border-outline-variant/10 min-w-[140px]">
          <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">Avg Latency</p>
          <p className="text-2xl font-semibold text-secondary tracking-tight">42ms</p>
        </div>
      </div>
    </div>
  );
}