import { X, Copy, List, Box, FileText, ExternalLink } from 'lucide-react';

export function TraceSidebar() {
  return (
    <aside className="w-96 flex flex-col bg-surface-container-lowest border-l border-outline-variant/10 z-10 relative shrink-0">
      
      {/* Selected Span Header */}
      <div className="p-4 border-b border-outline-variant/20 bg-surface-container-low/50">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-primary">Selected Span</span>
          <X className="w-4 h-4 text-secondary cursor-pointer hover:text-primary-foreground transition-colors" />
        </div>
        <div className="text-sm font-bold text-on-surface">PostgreSQL: SELECT users</div>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[10px] font-mono text-secondary">span_9a3f2e1_db1</span>
          <Copy className="w-3 h-3 text-muted cursor-pointer hover:text-secondary transition-colors" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar pb-20">
        
        {/* Attributes Section */}
        <div className="p-4 border-b border-outline-variant/10">
          <div className="flex items-center gap-2 mb-3">
            <List className="w-4 h-4 text-secondary" />
            <span className="text-[11px] font-bold uppercase tracking-widest text-secondary">Attributes</span>
          </div>
          <div className="space-y-2">
            <div className="flex flex-col gap-0.5 p-2 rounded bg-app border border-outline-variant/10">
              <span className="text-[9px] font-mono text-secondary uppercase">db.system</span>
              <span className="text-[11px] font-mono text-primary">postgresql</span>
            </div>
            <div className="flex flex-col gap-0.5 p-2 rounded bg-app border border-outline-variant/10">
              <span className="text-[9px] font-mono text-secondary uppercase">db.statement</span>
              <span className="text-[10px] font-mono text-primary-foreground whitespace-pre-wrap">
                SELECT * FROM users WHERE id = 'usr_23x1' AND tenant_id = 'tn_88'
              </span>
            </div>
            <div className="flex flex-col gap-0.5 p-2 rounded bg-app border border-outline-variant/10">
              <span className="text-[9px] font-mono text-secondary uppercase">net.peer.name</span>
              <span className="text-[11px] font-mono text-primary-foreground">db-replica-01.internal</span>
            </div>
          </div>
        </div>

        {/* Resources Section */}
        <div className="p-4 border-b border-outline-variant/10">
          <div className="flex items-center gap-2 mb-3">
            <Box className="w-4 h-4 text-secondary" />
            <span className="text-[11px] font-bold uppercase tracking-widest text-secondary">Resource</span>
          </div>
          <div className="space-y-1.5">
            <div className="flex justify-between items-center py-1 border-b border-outline-variant/5">
              <span className="text-[10px] text-secondary">service.name</span>
              <span className="text-[10px] font-mono text-primary-foreground">checkout-svc</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-outline-variant/5">
              <span className="text-[10px] text-secondary">host.name</span>
              <span className="text-[10px] font-mono text-primary-foreground">k8s-node-42</span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-[10px] text-secondary">telemetry.sdk.language</span>
              <span className="text-[10px] font-mono text-primary-foreground">nodejs</span>
            </div>
          </div>
        </div>

        {/* Events/Logs within span */}
        <div className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <FileText className="w-4 h-4 text-secondary" />
            <span className="text-[11px] font-bold uppercase tracking-widest text-secondary">Events</span>
          </div>
          
          <div className="relative pl-4 space-y-4 border-l border-outline-variant/20 ml-2">
            <div className="relative">
              <div className="absolute -left-[21px] w-2 h-2 rounded-full bg-muted top-1"></div>
              <div className="text-[9px] font-mono text-secondary">+1.2ms</div>
              <div className="text-[11px] text-primary-foreground font-medium">Acquiring connection</div>
            </div>
            <div className="relative">
              <div className="absolute -left-[21px] w-2 h-2 rounded-full bg-primary/60 top-1"></div>
              <div className="text-[9px] font-mono text-secondary">+4.5ms</div>
              <div className="text-[11px] text-primary-foreground font-medium">Query executed</div>
            </div>
            <div className="relative">
              <div className="absolute -left-[21px] w-2 h-2 rounded-full bg-muted top-1"></div>
              <div className="text-[9px] font-mono text-secondary">+22.1ms</div>
              <div className="text-[11px] text-primary-foreground font-medium">Results serialized</div>
              <div className="mt-1 text-[9px] font-mono bg-surface p-1.5 rounded text-secondary border border-white/5">
                {`{ "rows": 1, "size": "1.2kb" }`}
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Action Footer */}
      <div className="p-4 bg-app border-t border-outline-variant/20 flex gap-2 absolute bottom-0 w-full">
        <button className="flex-1 py-2 rounded bg-primary/10 border border-primary/30 text-primary text-[10px] font-bold uppercase tracking-widest hover:bg-primary/20 transition-all focus:outline-none">
          View Logs
        </button>
        <button className="p-2 rounded bg-surface-container-high border border-outline-variant/20 text-secondary hover:text-white transition-all focus:outline-none">
          <ExternalLink className="w-4 h-4" />
        </button>
      </div>

    </aside>
  );
}