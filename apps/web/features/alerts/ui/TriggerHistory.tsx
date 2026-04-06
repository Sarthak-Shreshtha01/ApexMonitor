import { History, AlertCircle, AlertTriangle, CheckCircle2 } from 'lucide-react';

const HISTORY_DATA = [
  { id: 1, title: 'Critical Error Spike', time: '14:02:11', desc: 'Error rate reached 8.4% (Threshold: 5%)', icon: AlertCircle, color: 'text-on-error-container', bg: 'bg-error-container', glow: 'shadow-[0_0_15px_rgba(147,0,10,0.4)]' },
  { id: 2, title: 'Latency Warning', time: '12:15:45', desc: 'p99 latency exceeded 450ms', icon: AlertTriangle, color: 'text-on-tertiary-container', bg: 'bg-tertiary-container', glow: '' },
  { id: 3, title: 'System Recovered', time: '10:30:00', desc: 'Status returned to within healthy bounds', icon: CheckCircle2, color: 'text-secondary', bg: 'bg-secondary-container/20 border border-secondary/40', glow: '' },
  { id: 4, title: 'Authentication Failure', time: '08:12:33', desc: 'Bulk invalid token attempts from IP: 192.x.x.1', icon: AlertCircle, color: 'text-on-error-container', bg: 'bg-error-container', glow: 'shadow-[0_0_15px_rgba(147,0,10,0.4)]', isLast: true },
];

export function TriggerHistory() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <History className="text-tertiary w-5 h-5" />
          <h2 className="text-xl font-bold tracking-tight text-white">Trigger History</h2>
        </div>
        <button className="text-[10px] font-bold text-primary uppercase tracking-widest hover:underline focus:outline-none">
          Export
        </button>
      </div>

      <div className="bg-surface-container-low rounded-2xl p-6 border border-outline-variant/10 relative overflow-hidden h-[420px]">
        <div className="space-y-6 relative z-10">
          {HISTORY_DATA.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.id} className="flex gap-4 relative">
                {!item.isLast && (
                  <div className="absolute left-[15px] top-8 w-[1px] h-12 bg-outline-variant/30"></div>
                )}
                <div className={`w-8 h-8 rounded-full ${item.bg} flex items-center justify-center shrink-0 ${item.glow}`}>
                  <Icon className={`${item.color} w-4 h-4`} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-white">{item.title}</p>
                    <span className="text-[10px] text-slate-500 font-mono">{item.time}</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">{item.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
        
        {/* Faded overlay for "view all" */}
        <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-surface-container-low to-transparent z-20 flex items-end justify-center pb-6 pointer-events-none">
          <button className="pointer-events-auto text-xs font-bold text-slate-400 hover:text-white transition-colors bg-surface-container-high/60 backdrop-blur px-4 py-2 rounded-full border border-outline-variant/20">
            View All History
          </button>
        </div>
      </div>
    </div>
  );
}