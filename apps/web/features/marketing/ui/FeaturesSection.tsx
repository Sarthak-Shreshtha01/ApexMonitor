import { Activity, BarChart2, CheckCircle2, ExternalLink } from 'lucide-react';

export function FeaturesSection() {
  return (
    <section className="py-32 max-w-7xl mx-auto px-8 space-y-32">
      
      {/* Multi-Metrics Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        <div className="lg:col-span-4">
          <h2 className="text-4xl font-black mb-6 tracking-tight">Real-time Multi-Metrics</h2>
          <p className="text-slate-400 text-lg leading-relaxed mb-8">
            Don't settle for static charts. Stream thousands of data points every second with hardware-accelerated rendering.
          </p>
          <div className="space-y-6">
            <div className="flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/10">
              <div className="w-12 h-12 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                <Activity className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-bold text-white">1s Resolution</h4>
                <p className="text-xs text-slate-500">Detect micro-spikes instantly</p>
              </div>
            </div>
            <div className="flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/10">
              <div className="w-12 h-12 rounded-lg bg-purple-500/20 flex items-center justify-center text-purple-400">
                <BarChart2 className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-bold text-white">Custom Tagging</h4>
                <p className="text-xs text-slate-500">Filter by customer, region, or hash</p>
              </div>
            </div>
          </div>
        </div>
        
        <div className="lg:col-span-8 bg-surface-container/60 backdrop-blur-xl rounded-2xl p-8 border border-white/10 relative overflow-hidden h-[400px]">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent"></div>
          <div className="relative h-full flex flex-col">
            <div className="flex justify-between mb-8">
              <div className="flex gap-4">
                <div className="px-3 py-1 rounded bg-indigo-500/10 border border-indigo-500/30 text-[10px] font-mono text-indigo-400 font-bold tracking-tighter">NODE_CPU_USAGE</div>
                <div className="px-3 py-1 rounded bg-slate-800 border border-white/10 text-[10px] font-mono text-slate-400 font-bold tracking-tighter">MEMORY_RESIDENT</div>
              </div>
              <span className="text-[10px] font-mono text-slate-500 uppercase">Live: US-EAST-1 Cluster</span>
            </div>
            <div className="flex-grow flex items-end gap-1 px-2">
              <div className="w-2 bg-indigo-500/20 rounded-t-sm h-[30%]"></div>
              <div className="w-2 bg-indigo-500/40 rounded-t-sm h-[45%]"></div>
              <div className="w-2 bg-indigo-500/20 rounded-t-sm h-[20%]"></div>
              <div className="w-2 bg-indigo-500/60 rounded-t-sm h-[70%]"></div>
              <div className="w-2 bg-indigo-500/30 rounded-t-sm h-[50%]"></div>
              <div className="w-2 bg-indigo-500/80 rounded-t-sm h-[85%] border-t border-indigo-400 shadow-[0_0_10px_rgba(99,102,241,0.5)]"></div>
              <div className="w-2 bg-indigo-500/40 rounded-t-sm h-[40%]"></div>
              <div className="w-2 bg-indigo-500/20 rounded-t-sm h-[25%]"></div>
              <div className="w-2 bg-indigo-500/60 rounded-t-sm h-[65%]"></div>
              <div className="w-2 bg-indigo-500/90 rounded-t-sm h-[95%] border-t border-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.6)]"></div>
              <div className="w-2 bg-slate-700/40 rounded-t-sm h-[40%]"></div>
              <div className="w-2 bg-slate-700/60 rounded-t-sm h-[55%]"></div>
              <div className="w-2 bg-slate-700/30 rounded-t-sm h-[30%]"></div>
              <div className="w-2 bg-indigo-500/50 rounded-t-sm h-[60%]"></div>
              <div className="w-2 bg-indigo-500/30 rounded-t-sm h-[45%]"></div>
              <div className="w-2 bg-indigo-500/70 rounded-t-sm h-[75%]"></div>
              <div className="w-2 bg-indigo-500/40 rounded-t-sm h-[50%]"></div>
              <div className="w-2 bg-rose-500/50 rounded-t-sm h-[90%] border-t border-rose-400 animate-pulse"></div>
              <div className="w-2 bg-indigo-500/30 rounded-t-sm h-[40%]"></div>
              <div className="w-2 bg-indigo-500/60 rounded-t-sm h-[65%]"></div>
            </div>
          </div>
        </div>
      </div>

      {/* Traces Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        <div className="lg:col-span-7 bg-surface-container/60 backdrop-blur-xl rounded-2xl p-10 border border-white/10 order-2 lg:order-1">
          <div className="mb-10 flex justify-between items-center">
            <div>
              <h3 className="font-mono text-lg font-bold text-white mb-1">Trace ID: 7c2a-89b1-ff02</h3>
              <div className="flex gap-4">
                <span className="text-[10px] font-mono bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20">STATUS: 200</span>
                <span className="text-[10px] font-mono text-slate-500">TOTAL TIME: 842ms</span>
              </div>
            </div>
            <ExternalLink className="w-5 h-5 text-slate-500" />
          </div>
          
          <div className="space-y-6 font-mono text-[11px]">
            <div className="relative h-8 bg-indigo-500/10 rounded-lg group">
              <div className="absolute left-0 top-0 h-full w-full bg-indigo-500/30 rounded-lg border-l-4 border-indigo-500"></div>
              <div className="relative px-4 flex items-center h-full justify-between z-10">
                <span className="flex items-center gap-2 font-bold"><span className="w-2 h-2 rounded-full bg-indigo-500"></span> gateway-srv</span>
                <span className="text-indigo-300">842ms</span>
              </div>
            </div>
            <div className="relative h-8 bg-purple-500/10 rounded-lg ml-6">
              <div className="absolute left-[5%] top-0 h-full w-[15%] bg-purple-500/30 rounded-lg border-l-4 border-purple-500"></div>
              <div className="relative px-4 flex items-center h-full justify-between z-10">
                <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-purple-500"></span> auth-verify</span>
                <span className="text-purple-300">120ms</span>
              </div>
            </div>
            <div className="relative h-8 bg-amber-500/10 rounded-lg ml-12">
              <div className="absolute left-[20%] top-0 h-full w-[45%] bg-amber-500/30 rounded-lg border-l-4 border-amber-500"></div>
              <div className="relative px-4 flex items-center h-full justify-between z-10">
                <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-amber-500"></span> postgres.select</span>
                <span className="text-amber-300">380ms</span>
              </div>
            </div>
            <div className="relative h-8 bg-emerald-500/10 rounded-lg ml-12">
              <div className="absolute left-[20%] top-0 h-full w-[8%] bg-emerald-500/30 rounded-lg border-l-4 border-emerald-500"></div>
              <div className="relative px-4 flex items-center h-full justify-between z-10">
                <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> redis.get</span>
                <span className="text-emerald-300">42ms</span>
              </div>
            </div>
            <div className="relative h-8 bg-sky-500/10 rounded-lg ml-6">
              <div className="absolute left-[65%] top-0 h-full w-[30%] bg-sky-500/30 rounded-lg border-l-4 border-sky-500"></div>
              <div className="relative px-4 flex items-center h-full justify-between z-10">
                <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-sky-500"></span> email-dispatch</span>
                <span className="text-sky-300">250ms</span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="lg:col-span-5 order-1 lg:order-2">
          <h2 className="text-4xl font-black mb-6 tracking-tight">Zero-Config Distributed Traces</h2>
          <p className="text-slate-400 text-lg leading-relaxed mb-8">
            Connect the dots across complex microservices. Our automatic instrumentation follows the request flow through every database call, cache hit, and third-party API.
          </p>
          <ul className="space-y-4">
            <li className="flex items-start gap-3">
              <CheckCircle2 className="w-6 h-6 text-indigo-500 mt-1 shrink-0" />
              <span className="text-slate-300">Automatic context propagation across HTTP, gRPC, and message queues.</span>
            </li>
            <li className="flex items-start gap-3">
              <CheckCircle2 className="w-6 h-6 text-indigo-500 mt-1 shrink-0" />
              <span className="text-slate-300">Pinpoint exactly which service in the chain is causing bottlenecks.</span>
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}