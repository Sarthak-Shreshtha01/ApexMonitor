import { Zap, TrendingUp, AlertTriangle } from 'lucide-react';

export function LogsInsights() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      <div className="bg-surface-container-low p-6 rounded-2xl border border-outline-variant/10 flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <Zap className="text-tertiary w-5 h-5" />
          <h3 className="text-sm font-bold tracking-tight">Latency Anomaly</h3>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed">
          Detected a 45% spike in latency for <code className="bg-surface-container-lowest px-1 rounded text-secondary font-mono">/auth/refresh</code> in the last 15 minutes. Investigating cluster health.
        </p>
      </div>

      <div className="bg-surface-container-low p-6 rounded-2xl border border-outline-variant/10 flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="text-secondary w-5 h-5" />
          <h3 className="text-sm font-bold tracking-tight">Traffic Volume</h3>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed">
          Incoming request volume is trending 12% higher than your 7-day average. System capacity is currently at 64%.
        </p>
      </div>

      <div className="bg-surface-container-low p-6 rounded-2xl border border-outline-variant/10 flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="text-error w-5 h-5" />
          <h3 className="text-sm font-bold tracking-tight">Error Spike</h3>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed">
          A total of 14 new 5xx errors from <code className="bg-surface-container-lowest px-1 rounded text-primary font-mono">IP 104.22.4.1</code>. Potential rate limit bypass attempt.
        </p>
      </div>

    </div>
  );
}