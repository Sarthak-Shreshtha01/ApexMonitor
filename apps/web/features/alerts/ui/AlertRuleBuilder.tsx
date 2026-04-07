import { Sliders, ChevronDown, MessageSquare, Mail } from 'lucide-react';

export function AlertRuleBuilder() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Sliders className="text-secondary w-5 h-5" />
        <h2 className="text-xl font-bold tracking-tight text-white">Alert Rule Builder</h2>
      </div>
      
      <div className="bg-surface-container-low rounded-2xl p-8 border border-outline-variant/10 space-y-8 relative">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-[0.1em] text-secondary">Metric</label>
            <div className="bg-surface-container-lowest border border-outline-variant/20 rounded-xl p-3 flex items-center justify-between cursor-pointer">
              <span className="text-sm font-medium">Error Rate</span>
              <ChevronDown className="w-4 h-4 text-secondary" />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-[0.1em] text-secondary">Operator</label>
            <div className="bg-surface-container-lowest border border-outline-variant/20 rounded-xl p-3 flex items-center justify-between cursor-pointer">
              <span className="text-sm font-medium">Greater than {`>`}</span>
              <ChevronDown className="w-4 h-4 text-secondary" />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-[0.1em] text-secondary">Threshold</label>
            <div className="bg-surface-container-lowest border border-outline-variant/20 rounded-xl p-3 flex items-center gap-2">
              <input 
                type="text" 
                defaultValue="5"
                className="bg-transparent border-none p-0 text-sm font-bold text-secondary focus:ring-0 w-full outline-none" 
              />
              <span className="text-secondary text-xs">%</span>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-bold uppercase tracking-[0.1em] text-secondary">Preview Logic</label>
            <span className="text-[10px] text-secondary font-mono tracking-tighter">Live Preview 09:42 UTC</span>
          </div>
          <div className="h-32 bg-surface-container-lowest rounded-xl border border-outline-variant/10 p-4 flex items-end gap-1 overflow-hidden relative">
            <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(rgba(70, 69, 84, 0.15) 1px, transparent 1px)', backgroundSize: '16px 16px' }}></div>
            
            {/* Threshold Line */}
            <div className="absolute top-1/4 left-0 w-full border-t border-dashed border-error/50 z-0">
              <span className="absolute right-2 -top-2.5 text-[8px] bg-surface-container-lowest px-1 text-error font-bold uppercase">5% Critical Threshold</span>
            </div>
            
            {/* Mock Graph Bars */}
            <div className="w-full h-8 bg-secondary/10 rounded-t-sm self-end relative z-10"></div>
            <div className="w-full h-12 bg-secondary/10 rounded-t-sm self-end relative z-10"></div>
            <div className="w-full h-10 bg-secondary/10 rounded-t-sm self-end relative z-10"></div>
            <div className="w-full h-24 bg-error/20 rounded-t-sm self-end border-t border-error relative z-10 shadow-[0_0_10px_rgba(255,180,171,0.2)]"></div>
            <div className="w-full h-20 bg-error/20 rounded-t-sm self-end border-t border-error relative z-10"></div>
            <div className="w-full h-14 bg-secondary/10 rounded-t-sm self-end relative z-10"></div>
            <div className="w-full h-9 bg-secondary/10 rounded-t-sm self-end relative z-10"></div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between pt-4 border-t border-outline-variant/10 gap-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded bg-surface-container-high flex items-center justify-center">
                <MessageSquare className="w-4 h-4 text-secondary" />
              </div>
              <span className="text-xs font-medium">#ops-alerts</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded bg-surface-container-high flex items-center justify-center">
                <Mail className="w-4 h-4 text-secondary" />
              </div>
              <span className="text-xs font-medium">admin@pulseapi.io</span>
            </div>
          </div>
          <button className="bg-surface-container-high border border-outline-variant/20 text-on-surface px-6 py-2.5 rounded-lg text-sm font-bold hover:bg-surface-container-highest transition-all">
            Save Alert Rule
          </button>
        </div>
      </div>
    </div>
  );
}