import { ChevronDown, Info } from 'lucide-react';

const SPANS_DATA = [
  { id: '1', name: 'Gateway Pipeline', service: 'kong-gateway.internal', duration: '27ms', color: 'bg-secondary', border: 'border-secondary/40', bgLine: 'bg-secondary/20', left: '0%', width: '12%', textColor: 'text-secondary', isParent: true, indent: 0 },
  { id: '2', name: 'Auth Check', service: 'identity.svc', duration: '7ms', color: 'bg-secondary/60', border: 'border-secondary/30', bgLine: 'bg-secondary/10', left: '1%', width: '3%', textColor: 'text-secondary', isParent: false, indent: 1 },
  { id: '3', name: 'Rate Limit', service: 'redis-cluster.internal', duration: '3ms', color: 'bg-secondary/60', border: 'border-secondary/30', bgLine: 'bg-secondary/10', left: '4.5%', width: '1.5%', textColor: 'text-secondary', isParent: false, indent: 1 },
  { id: '4', name: 'Checkout Service', service: 'checkout.main.svc', duration: '198ms', color: 'bg-primary', border: 'border-primary/40', bgLine: 'bg-primary/20', left: '12%', width: '88%', textColor: 'text-primary', isParent: true, indent: 0 },
  { id: '5', name: 'PostgreSQL: SELECT users', service: 'db-replica-01', duration: '24ms', color: 'bg-primary/60', border: 'border-primary/30', bgLine: 'bg-primary/10', left: '15%', width: '12%', textColor: 'text-secondary', isParent: false, indent: 1, extraText: "SELECT * FROM users WHERE id = 'usr_23x1'", isSelected: true },
  { id: '6', name: 'Redis GET', service: 'session-cache', duration: '4ms', color: 'bg-primary/60', border: 'border-primary/30', bgLine: 'bg-primary/10', left: '28%', width: '2%', textColor: 'text-secondary', isParent: false, indent: 1, badge: 'HIT' },
  { id: '7', name: 'Stripe API: Create Charge', service: 'api.stripe.com', duration: '124ms', color: 'bg-tertiary', border: 'border-tertiary/40', bgLine: 'bg-tertiary/20', left: '35%', width: '55%', textColor: 'text-tertiary', isParent: false, indent: 1 },
  { id: '8', name: 'PostgreSQL: UPDATE sessions', service: 'db-primary', duration: '9ms', color: 'bg-primary/60', border: 'border-primary/30', bgLine: 'bg-primary/10', left: '92%', width: '4%', textColor: 'text-secondary', isParent: false, indent: 1, extraText: "UPDATE sessions SET last_active = NOW() WHERE id = 'ses_99'", alignRight: true },
  { id: '9', name: 'SendGrid: Receipt Email', service: 'api.sendgrid.com (Async)', duration: '8ms', color: 'bg-tertiary', border: 'border-tertiary/20 border-dashed', bgLine: 'bg-tertiary/10', left: '96%', width: '4%', textColor: 'text-secondary', isParent: false, indent: 0 },
];

export function TraceWaterfall() {
  return (
    <section className="flex-1 flex flex-col min-w-0 border-r border-outline-variant/20 overflow-hidden relative z-10">
      
      {/* Waterfall Header */}
      <div className="p-4 sm:p-6 border-b border-outline-variant/20 bg-surface-container-lowest/50">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4 mb-6">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-on-surface mb-1 wrap-break-word">POST /api/v1/checkout</h1>
            <p className="text-xs text-secondary font-mono">Initiated at 2023-10-24 14:32:01.045 UTC</p>
          </div>
          <div className="text-left sm:text-right">
            <div className="text-2xl sm:text-3xl font-black text-secondary tracking-tighter font-mono">225ms</div>
            <div className="text-[10px] text-secondary uppercase tracking-widest font-bold">Total Duration</div>
          </div>
        </div>

        {/* Time Scale */}
        <div className="relative w-full h-6 border-b border-outline-variant/10 flex items-end pb-1">
          <span className="absolute left-0 text-[9px] font-mono text-muted">0ms</span>
          <span className="absolute left-1/4 text-[9px] font-mono text-muted">56ms</span>
          <span className="absolute left-1/2 text-[9px] font-mono text-muted">112ms</span>
          <span className="absolute left-3/4 text-[9px] font-mono text-muted">168ms</span>
          <span className="absolute right-0 text-[9px] font-mono text-muted">225ms</span>
        </div>
      </div>

      {/* Waterfall Spans Content */}
      <div className="flex-1 overflow-y-auto pb-20 custom-scrollbar">
        <div className="bg-surface-container-low/20">
          
          {SPANS_DATA.map((span) => (
            <div 
              key={span.id} 
              className={`group border-b border-outline-variant/10 transition-colors flex flex-col md:flex-row ${span.isSelected ? 'bg-app/80 hover:bg-surface' : 'hover:bg-surface-container-low'}`}
            >
              {/* Left Column: Span Tree Info */}
              <div 
                className={`w-full md:w-80 p-3 border-b md:border-b-0 md:border-r border-outline-variant/10 flex items-center gap-3 shrink-0`}
                style={{ paddingLeft: span.indent > 0 ? `${(span.indent * 1.5) + 0.75}rem` : '0.75rem' }}
              >
                {span.isParent ? (
                  <ChevronDown className="w-3 h-3 text-muted shrink-0" />
                ) : (
                  <div className="w-3 shrink-0"></div> // Spacer
                )}
                
                <div className={`w-1.5 h-1.5 rounded-full ${span.color} shrink-0`}></div>
                
                <div className="flex-1 min-w-0">
                  <div className={`text-[11px] flex items-center gap-2 truncate ${span.isParent ? 'font-bold text-primary-foreground' : 'font-semibold text-secondary'}`}>
                    <span className="truncate">{span.name}</span>
                    {span.badge && (
                      <span className="text-[8px] px-1 bg-green-900/20 text-green-500 border border-green-900/40 rounded shrink-0">{span.badge}</span>
                    )}
                    {span.isParent && <Info className="w-3.5 h-3.5 text-secondary opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer shrink-0 ml-auto" />}
                  </div>
                  <div className="text-[9px] font-mono text-muted truncate">{span.service}</div>
                </div>
              </div>

              {/* Right Column: Timeline Visualization */}
              <div className="flex-1 relative h-14 sm:h-12 p-2 min-w-0">
                <div 
                  className={`absolute h-3 top-1/2 -translate-y-1/2 ${span.bgLine} border-l border-r ${span.border}`} 
                  style={{ left: span.left, width: span.width }}
                >
                  <span className={`absolute -top-4 left-0 text-[8px] font-mono ${span.textColor}`}>
                    {span.duration}
                  </span>
                </div>
                
                {/* Optional Extra SQL/Query Text */}
                {span.extraText && (
                  <div 
                    className={`absolute top-8 text-[9px] font-mono text-secondary wrap-break-word max-w-sm ${span.alignRight ? 'right-4 text-right' : 'left-[15%]'}`}
                  >
                    {span.extraText}
                  </div>
                )}
              </div>
            </div>
          ))}

        </div>
      </div>
    </section>
  );
}