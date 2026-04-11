import { Zap, AlertTriangle, Wand2 } from 'lucide-react';

export function ActionableSuggestions() {
  return (
    <div className="space-y-4">
      <h3 className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest px-1">AI Actionable Suggestions</h3>
      
      <div className="bg-[#131313] border border-rose-900/30 p-5 rounded-xl group hover:border-rose-500/50 transition-all cursor-pointer shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <span className="bg-rose-500/10 text-rose-400 text-[9px] px-2 py-1 rounded font-bold uppercase tracking-widest border border-rose-500/20">AI Suggestion: Critical</span>
          <Zap className="text-neutral-600 group-hover:text-rose-500 w-5 h-5 transition-colors" />
        </div>
        <h5 className="text-sm font-bold text-white mb-2">Index Missing in Production</h5>
        <p className="text-xs text-neutral-400 leading-relaxed">Add composite index on <code className="font-mono text-orange-400 bg-orange-400/10 px-1 rounded">logs(timestamp, level)</code> to resolve current query timeouts.</p>
      </div>
      
      <div className="bg-[#131313] border border-amber-900/30 p-5 rounded-xl group hover:border-amber-500/50 transition-all cursor-pointer shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <span className="bg-amber-500/10 text-amber-500 text-[9px] px-2 py-1 rounded font-bold uppercase tracking-widest border border-amber-500/20">AI Suggestion: Warn</span>
          <AlertTriangle className="text-neutral-600 group-hover:text-amber-500 w-5 h-5 transition-colors" />
        </div>
        <h5 className="text-sm font-bold text-white mb-2">Resource Exhaustion Limit</h5>
        <p className="text-xs text-neutral-400 leading-relaxed">Container <code className="font-mono text-orange-400 bg-orange-400/10 px-1 rounded">auth-proxy</code> is at 88% memory. Increase heap to 2Gi to avoid OOM.</p>
      </div>

      <div className="bg-[#131313] border border-neutral-800 p-5 rounded-xl group hover:border-orange-500/50 transition-all cursor-pointer shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <span className="bg-neutral-800 text-neutral-400 text-[9px] px-2 py-1 rounded font-bold uppercase tracking-widest border border-neutral-700">AI Suggestion: Optimize</span>
          <Wand2 className="text-neutral-600 group-hover:text-orange-500 w-5 h-5 transition-colors" />
        </div>
        <h5 className="text-sm font-bold text-white mb-2">Code Path Optimization</h5>
        <p className="text-xs text-neutral-400 leading-relaxed">Unused middleware detected in <code className="font-mono text-neutral-300 bg-neutral-800 px-1 rounded">router.v1</code>. Removal could save 5ms per request.</p>
      </div>
    </div>
  );
}