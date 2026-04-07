import { Sparkles, AlertTriangle, LineChart, ShieldAlert, ExternalLink } from 'lucide-react';

const DUMMY_ANOMALIES = [
  { id: 1, title: 'Rate Limit Escalation', desc: 'IP 45.2.1.18 is hitting /auth 40x above baseline.', severity: 'Critical', time: '2 mins ago', icon: AlertTriangle, color: 'text-tertiary', bg: 'bg-tertiary/10' },
  { id: 2, title: 'P99 Latency Spike', desc: 'Region us-east-1 database connection delay increased by 15%.', severity: 'Informational', time: '12 mins ago', icon: LineChart, color: 'text-secondary', bg: 'bg-secondary/10' },
  { id: 3, title: 'New Payload Pattern', desc: 'Unusual JSON structure detected in /billing/checkout.', severity: 'Low Risk', time: '1 hour ago', icon: ShieldAlert, color: 'text-primary', bg: 'bg-primary/10' },
];

export function AnomalySidebar() {
  return (
    <div className="bg-surface-container/40 backdrop-blur-xl rounded-2xl p-6 border border-primary/20 pulse-glow">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary">
          <Sparkles className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-on-surface">Anomaly Stream</h3>
          <p className="text-[10px] text-secondary uppercase tracking-widest">Real-time AI Detection</p>
        </div>
      </div>

      <div className="space-y-4">
        {DUMMY_ANOMALIES.map((anomaly) => {
          const Icon = anomaly.icon;
          return (
            <div key={anomaly.id} className="p-4 rounded-xl bg-surface-container-high/50 border border-outline-variant/20 relative overflow-hidden group hover:border-primary/40 transition-all cursor-pointer">
              <div className="absolute top-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <ExternalLink className="text-primary w-4 h-4" />
              </div>
              <div className="flex items-start gap-3">
                <Icon className={`${anomaly.color} w-5 h-5 mt-0.5`} />
                <div>
                  <p className="text-xs font-bold text-primary-foreground">{anomaly.title}</p>
                  <p className="text-[10px] text-secondary mt-1 leading-relaxed">{anomaly.desc}</p>
                  <div className="flex items-center gap-2 mt-3">
                    <span className={`px-2 py-0.5 rounded-full ${anomaly.bg} ${anomaly.color} text-[9px] font-bold uppercase`}>
                      {anomaly.severity}
                    </span>
                    <span className="text-[9px] text-muted uppercase">{anomaly.time}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <button className="w-full mt-6 py-3 rounded-lg bg-surface-container-highest border border-outline-variant/20 text-xs font-bold uppercase tracking-widest text-primary hover:bg-primary/10 transition-all">
        View Insight Report
      </button>
    </div>
  );
}