import { BrainCircuit, Sparkles } from 'lucide-react';

export function NeuralSummaryCard() {
  return (
    <div className="bg-neutral-950 border border-orange-600/30 p-8 rounded-xl relative overflow-hidden group shadow-[0_0_50px_-12px_rgba(234,88,12,0.15)]">
      <div className="flex flex-col md:flex-row items-start justify-between relative z-10 gap-6">
        
        <div className="flex flex-col sm:flex-row gap-6">
          <div className="w-14 h-14 bg-orange-600 rounded-xl flex items-center justify-center shadow-2xl shrink-0">
            <BrainCircuit className="text-white w-8 h-8" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-3 mb-3">
              <h2 className="text-2xl font-bold text-white tracking-tight">Neural Log Summary</h2>
              <span className="px-2 py-0.5 bg-orange-600/20 text-orange-400 text-[10px] border border-orange-600/40 rounded font-mono uppercase tracking-widest flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Real-time Inference
              </span>
            </div>
            <p className="text-lg text-neutral-300 leading-relaxed max-w-4xl italic">
              "Critical pattern detected in <code className="text-orange-400 font-mono bg-orange-600/10 px-1.5 py-0.5 rounded">auth-v2-proxy</code>. Increased 401 Unauthorized errors (12% spike) correlate with the <code className="text-orange-400 font-mono bg-orange-600/10 px-1.5 py-0.5 rounded">ConfigMap-Alpha</code> deployment. AI predicts a complete service outage within 45 minutes if cache-invalidation is not manually triggered or the deployment rolled back immediately."
            </p>
          </div>
        </div>

        <div className="flex flex-col items-start md:items-end gap-1 shrink-0 bg-neutral-900/50 p-4 rounded-lg md:bg-transparent md:p-0">
          <p className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Analysis Confidence</p>
          <p className="text-4xl font-mono font-bold text-orange-500 tracking-tighter">
            98.4<span className="text-sm text-neutral-500 ml-1">%</span>
          </p>
        </div>

      </div>
      
      {/* Background Decorative Element */}
      <div className="absolute -bottom-16 -right-16 opacity-5 pointer-events-none">
        <BrainCircuit className="w-64 h-64 text-orange-500" />
      </div>
    </div>
  );
}