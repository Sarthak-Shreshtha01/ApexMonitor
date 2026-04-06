import { Sparkles, AlertTriangle, TrendingUp, Brain, ArrowRight } from 'lucide-react';

export function AiInsightsSection() {
  return (
    <div className="bg-indigo-600/5 rounded-3xl border border-indigo-500/20 p-12 overflow-hidden relative max-w-7xl mx-auto my-32">
      <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 blur-[100px] -z-10"></div>
      
      <div className="max-w-4xl mx-auto text-center mb-16">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded bg-indigo-500/10 border border-indigo-500/30 mb-4">
          <Sparkles className="w-4 h-4 text-indigo-400" />
          <span className="text-[10px] uppercase tracking-widest font-bold text-indigo-400">Autonomous Intelligence</span>
        </div>
        <h2 className="text-5xl font-black mb-6 tracking-tight text-white">PulseAI™ Insights</h2>
        <p className="text-xl text-slate-400">Our machine learning models analyze 10,000+ signals simultaneously to predict issues before they impact your SLAs.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card 1 */}
        <div className="bg-surface-container/60 backdrop-blur-xl p-6 rounded-2xl border border-white/10 flex flex-col h-full">
          <div className="flex justify-between items-center mb-6">
            <span className="font-mono text-[10px] text-slate-500">ANOMALY DETECTION</span>
            <AlertTriangle className="text-rose-400 w-5 h-5" />
          </div>
          <div className="h-24 w-full relative mb-6">
            <svg className="w-full h-full" viewBox="0 0 200 60">
              <path d="M0,50 Q20,45 40,48 T80,45 T100,10 T140,45 T180,42 T200,45" fill="none" stroke="#F43F5E" strokeWidth="2"></path>
              <circle className="animate-ping" cx="100" cy="10" fill="#F43F5E" r="3"></circle>
            </svg>
          </div>
          <h4 className="font-bold text-white mb-2">Memory Leak Detected</h4>
          <p className="text-xs text-slate-400 leading-relaxed mb-6">Heap usage on <span className="text-indigo-400">api-node-04</span> is trending up by 14% hourly without GC reclaim.</p>
          <button className="mt-auto text-[10px] font-mono text-indigo-400 font-bold flex items-center gap-1 hover:gap-2 transition-all group">
            VIEW RECOMMENDATION <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>

        {/* Card 2 */}
        <div className="bg-surface-container/60 backdrop-blur-xl p-6 rounded-2xl border border-white/10 flex flex-col h-full">
          <div className="flex justify-between items-center mb-6">
            <span className="font-mono text-[10px] text-slate-500">PREDICTIVE TRENDS</span>
            <TrendingUp className="text-emerald-400 w-5 h-5" />
          </div>
          <div className="h-24 w-full relative mb-6">
            <svg className="w-full h-full" viewBox="0 0 200 60">
              <path d="M0,55 L20,52 L40,48 L60,42 L80,35 L100,28 L120,20 L140,15 L160,10 L200,5" fill="none" stroke="#10B981" strokeDasharray="4" strokeWidth="2"></path>
              <path d="M0,58 L40,55 L80,50 L120,48" fill="none" stroke="#10B981" strokeWidth="2"></path>
            </svg>
          </div>
          <h4 className="font-bold text-white mb-2">Capacity Planning</h4>
          <p className="text-xs text-slate-400 leading-relaxed mb-6">Current growth trends suggest DB storage will exceed 85% in <span className="text-emerald-400">12 days</span>.</p>
          <button className="mt-auto text-[10px] font-mono text-emerald-400 font-bold flex items-center gap-1 hover:gap-2 transition-all group">
            PROVISION RESOURCES <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>

        {/* Card 3 */}
        <div className="bg-surface-container/60 backdrop-blur-xl p-6 rounded-2xl border border-white/10 flex flex-col h-full">
          <div className="flex justify-between items-center mb-6">
            <span className="font-mono text-[10px] text-slate-500">AUTOMATED RC</span>
            <Brain className="text-indigo-400 w-5 h-5" />
          </div>
          <div className="bg-black/40 rounded-lg p-3 mb-4 flex-grow border border-white/5">
            <div className="text-[9px] font-mono text-slate-500 uppercase mb-2">Root Cause Hypothesis:</div>
            <div className="text-[10px] font-mono text-indigo-300 leading-tight">
              v2.4.1 migration locked 'orders' table. Impacting 14% of writes. Suggesting concurrent index rebuild.
            </div>
          </div>
          <h4 className="font-bold text-white mb-2">Issue Resolved</h4>
          <p className="text-xs text-slate-400 leading-relaxed mb-6">Last incident auto-correlated with 14 logs and 3 trace failures across services.</p>
          <button className="mt-auto text-[10px] font-mono text-slate-400 font-bold flex items-center gap-1 hover:gap-2 transition-all group">
            POST-MORTEM REPORT <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </div>
    </div>
  );
}