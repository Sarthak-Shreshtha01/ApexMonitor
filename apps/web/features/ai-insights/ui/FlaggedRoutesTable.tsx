import { Filter } from 'lucide-react';

const FLAGGED_ROUTES = [
  { path: '/api/v1/user/profile', rps: '2,850', insight: 'Latency tail-end drift detected. Likely DB lock contention.', severity: 'Moderate', color: 'orange' },
  { path: '/api/v1/search/global', rps: '1,120', insight: 'Spiking 5xx errors correlate with upstream DNS resolution failures.', severity: 'Critical', color: 'rose' },
  { path: '/api/v1/auth/token', rps: '4,210', insight: 'Historical baseline drift starting. No current impact.', severity: 'Trace', color: 'neutral' },
];

export function FlaggedRoutesTable() {
  return (
    <div className="bg-[#131313] border border-neutral-800 rounded-xl overflow-hidden flex-1 flex flex-col">
      <div className="px-4 sm:px-6 py-5 border-b border-neutral-800 flex justify-between items-center gap-3 bg-neutral-950/50">
        <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-200">AI-Flagged Route Performance</h3>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-neutral-500 italic hidden sm:block">Showing only anomalies</span>
          <button aria-label="Filter routes" className="hover:bg-neutral-800 p-1.5 rounded transition-colors">
            <Filter className="w-4 h-4 text-neutral-500" />
          </button>
        </div>
      </div>
      
      <div className="md:hidden p-3 space-y-3">
        {FLAGGED_ROUTES.map((route) => (
          <div key={route.path} className="rounded-lg border border-neutral-800 bg-neutral-950/40 p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-widest text-neutral-500 mb-1">Route Path</div>
                <div className="text-sm font-semibold text-white break-all">{route.path}</div>
              </div>
              <span className={`px-2 py-1 bg-${route.color}-500/10 text-${route.color}-500 border border-${route.color}-500/20 rounded text-[9px] font-bold uppercase tracking-wider shrink-0`}>
                {route.severity}
              </span>
            </div>
            <div className="flex gap-4 text-xs font-mono text-neutral-400">
              <span>RPS: {route.rps}</span>
            </div>
            <p className={`text-xs leading-relaxed ${route.color === 'neutral' ? 'text-neutral-500 italic' : `text-${route.color}-400/90`}`}>
              {route.insight}
            </p>
          </div>
        ))}
      </div>

      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-150">
          <thead>
            <tr className="border-b border-neutral-800 bg-neutral-950/30">
              {['Route Path', 'RPS', 'AI Insight', 'Severity'].map((h) => (
                <th key={h} className="px-6 py-4 text-[10px] font-bold text-neutral-500 uppercase tracking-widest">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="text-xs font-mono">
            {FLAGGED_ROUTES.map((route, i) => (
              <tr key={i} className="border-b last:border-0 border-neutral-800/50 hover:bg-neutral-900/50 transition-colors">
                <td className="px-6 py-4 text-white font-semibold">{route.path}</td>
                <td className="px-6 py-4 text-neutral-400">{route.rps}</td>
                <td className={`px-6 py-4 leading-relaxed ${route.color === 'neutral' ? 'text-neutral-500 italic' : `text-${route.color}-400/90`}`}>
                  {route.insight}
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 bg-${route.color}-500/10 text-${route.color}-500 border border-${route.color}-500/20 rounded text-[9px] font-bold uppercase tracking-wider`}>
                    {route.severity}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}