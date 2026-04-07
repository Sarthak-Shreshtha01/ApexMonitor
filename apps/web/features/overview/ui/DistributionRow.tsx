import { Info, PieChart } from 'lucide-react';

export function DistributionRow() {
  const latencyBars = [15, 25, 45, 75, 100, 65, 35, 20, 10, 5];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
      
      {/* Latency Distribution */}
      <div className="bg-surface-container-low p-6 rounded-2xl border border-outline-variant/10">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-sm font-bold text-primary">Latency Distribution</h3>
          <Info className="text-secondary w-4 h-4" />
        </div>
        
        <div className="flex items-end gap-1.5 h-48 w-full">
          {latencyBars.map((height, i) => (
            <div 
              key={i}
              style={{ height: `${height}%` }}
              className={`w-full rounded-t-sm transition-colors ${
                height === 100 ? 'bg-primary shadow-[0_0_15px_rgba(255,69,0,0.3)]' :
                height > 50 ? 'bg-primary/40' :
                height > 20 ? 'bg-primary/30' :
                'bg-primary/20 hover:bg-primary/40'
              }`}
            ></div>
          ))}
        </div>
        
        <div className="flex justify-between mt-4 text-[10px] font-bold text-muted">
          <span>50ms</span><span>100ms</span><span>200ms</span><span>500ms</span><span>1s+</span>
        </div>
      </div>

      {/* Status Code Breakdown */}
      <div className="bg-surface-container-low p-6 rounded-2xl border border-outline-variant/10">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-sm font-bold text-primary">Status Codes</h3>
          <PieChart className="text-secondary w-4 h-4" />
        </div>
        
        <div className="flex items-center gap-12 h-48">
          <div className="relative w-32 h-32 shrink-0">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
              <circle cx="18" cy="18" fill="none" r="16" stroke="#262626" strokeWidth="4"></circle>
              {/* Success (Secondary) */}
              <circle className="drop-shadow-[0_0_4px_rgba(255,69,0,0.3)]" cx="18" cy="18" fill="none" r="16" stroke="#ff4500" strokeDasharray="85, 100" strokeWidth="4"></circle>
              {/* 4xx Errors (Tertiary) */}
              <circle cx="18" cy="18" fill="none" r="16" stroke="#f59e0b" strokeDasharray="10, 100" strokeDashoffset="-85" strokeWidth="4"></circle>
              {/* 5xx Errors (Danger) */}
              <circle cx="18" cy="18" fill="none" r="16" stroke="#ef4444" strokeDasharray="5, 100" strokeDashoffset="-95" strokeWidth="4"></circle>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-lg font-bold text-white">94%</span>
              <span className="text-[8px] text-secondary uppercase font-bold tracking-widest">Success</span>
            </div>
          </div>
          
          <div className="flex-1 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-secondary"></div>
                <span className="text-xs text-secondary">2xx OK</span>
              </div>
              <span className="text-xs font-bold text-white">1.1M</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-tertiary"></div>
                <span className="text-xs text-secondary">4xx Client Error</span>
              </div>
              <span className="text-xs font-bold text-white">124k</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-error-container"></div>
                <span className="text-xs text-secondary">5xx Server Error</span>
              </div>
              <span className="text-xs font-bold text-white">12k</span>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}