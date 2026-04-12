import { Network, Database, Calendar, MoreHorizontal } from 'lucide-react';
import Link from 'next/link';
import { ROUTES } from '@/shared/routes/routes';

export function HeroSection() {
  return (
    <section className="relative pt-24 sm:pt-32 lg:pt-40 pb-16 sm:pb-20 lg:pb-24 overflow-hidden">
      <div className="absolute inset-0 grid-blueprint pointer-events-none opacity-10"></div>
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-125 bg-primary/10 blur-[140px] -z-10"></div>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center mb-12 sm:mb-16">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 mb-8 backdrop-blur-md">
          <span className="flex h-2 w-2 rounded-full bg-primary animate-pulse"></span>
          <span className="text-[11px] uppercase tracking-[0.2em] font-bold text-primary">
            New: Multi-Cluster Observability
          </span>
        </div>
        
        <h1 className="text-4xl sm:text-5xl lg:text-7xl xl:text-8xl font-black tracking-tight mb-6 text-white leading-none">
          Observe Everything.<br/>
          <span className="text-primary">
            Miss Nothing.
          </span>
        </h1>
        
        <p className="text-base sm:text-lg lg:text-2xl text-secondary max-w-3xl mx-auto mb-10 sm:mb-12 font-light leading-relaxed">
          The ultimate command center for modern engineering. Complex telemetry simplified into real-time, actionable intelligence.
        </p>
        
        <div className="flex flex-col sm:flex-row justify-center gap-4">
          <Link href={ROUTES.auth.register} className="bg-primary text-white px-6 sm:px-10 py-4 sm:py-5 rounded-xl text-base sm:text-lg font-bold transition-all shadow-[0_0_50px_-10px_rgba(255,69,0,0.2)] hover:scale-[1.02] hover:bg-primary flex items-center justify-center">
            Start Free Trial
          </Link>
          <button className="bg-white/5 border border-white/10 text-white px-6 sm:px-10 py-4 sm:py-5 rounded-xl text-base sm:text-lg font-semibold transition-all hover:bg-white/10">
            Explore Sandbox
          </button>
        </div>
      </div>

      <div className="max-w-350 mx-auto px-4 relative hidden lg:block">
        <div className="grid grid-cols-12 gap-4 min-h-140 xl:h-162.5">
          
          {/* Network Topology Panel */}
          <div className="col-span-3 bg-surface-container/60 backdrop-blur-xl rounded-2xl border border-white/10 flex flex-col overflow-hidden min-h-100">
            <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/5">
              <span className="font-mono text-[10px] uppercase tracking-widest font-bold text-primary">Network Topology</span>
              <Network className="w-4 h-4 text-secondary" />
            </div>
            <div className="grow relative p-6 flex flex-col items-center justify-center">
              <div className="relative w-full h-full">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full border border-primary/50 flex items-center justify-center text-primary bg-primary/10 shadow-[0_0_15px_currentColor]">
                  <Database className="w-6 h-6" />
                </div>
                <svg className="absolute inset-0 w-full h-full stroke-primary/20" fill="none">
                  <line x1="50%" y1="50%" x2="20%" y2="20%"></line>
                  <line x1="50%" y1="50%" x2="80%" y2="20%"></line>
                  <line x1="50%" y1="50%" x2="20%" y2="80%"></line>
                  <line x1="50%" y1="50%" x2="80%" y2="80%"></line>
                </svg>
                <div className="absolute top-[15%] left-[15%] w-10 h-10 rounded-lg border border-outline-variant bg-surface/80 flex items-center justify-center text-secondary text-xs z-10">Auth</div>
                <div className="absolute top-[15%] right-[15%] w-10 h-10 rounded-lg border border-outline-variant bg-surface/80 flex items-center justify-center text-secondary text-xs z-10">API</div>
                <div className="absolute bottom-[15%] left-[15%] w-10 h-10 rounded-lg border border-outline-variant bg-surface/80 flex items-center justify-center text-secondary text-xs z-10">DB</div>
                <div className="absolute bottom-[15%] right-[15%] w-10 h-10 rounded-lg border border-emerald-500/50 bg-emerald-500/10 flex items-center justify-center text-emerald-400 text-xs z-10">Redis</div>
              </div>
              <div className="mt-4 w-full space-y-2">
                <div className="flex justify-between text-[10px] font-mono text-secondary">
                  <span>Ingress Traffic</span>
                  <span className="text-primary">1.2 GB/s</span>
                </div>
                <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                  <div className="w-2/3 h-full bg-primary"></div>
                </div>
              </div>
            </div>
          </div>

          {/* Main Dashboard Panel */}
          <div className="col-span-6 bg-surface-container/60 backdrop-blur-xl rounded-2xl border border-white/10 shadow-[0_0_50px_-10px_rgba(255,69,0,0.2)] flex flex-col overflow-hidden min-h-100">
            <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/5">
              <div className="flex gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500/50"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500/50"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/50"></div>
              </div>
              <span className="font-mono text-[11px] font-medium text-secondary px-3 py-1 bg-white/5 rounded">Global Request Latency (P50, P90, P99)</span>
              <div className="flex gap-3">
                <Calendar className="w-4 h-4 text-secondary" />
                <MoreHorizontal className="w-4 h-4 text-secondary" />
              </div>
            </div>
            <div className="grow p-8 flex flex-col">
              <div className="flex gap-8 mb-8">
                <div className="flex flex-col">
                  <span className="text-[10px] font-mono text-secondary uppercase font-bold">P99 Latency</span>
                  <span className="text-3xl font-black font-mono text-primary drop-shadow-[0_0_8px_currentColor]">124ms</span>
                </div>
                <div className="flex flex-col border-l border-white/10 pl-8">
                  <span className="text-[10px] font-mono text-secondary uppercase font-bold">Requests</span>
                  <span className="text-3xl font-black font-mono text-white">42.8k/s</span>
                </div>
                <div className="flex flex-col border-l border-white/10 pl-8">
                  <span className="text-[10px] font-mono text-secondary uppercase font-bold">Error Rate</span>
                  <span className="text-3xl font-black font-mono text-rose-500">0.002%</span>
                </div>
              </div>
              
              <div className="grow relative">
                <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 800 300">
                  <line stroke="white" strokeDasharray="4" strokeOpacity="0.05" x1="0" x2="800" y1="50" y2="50"></line>
                  <line stroke="white" strokeDasharray="4" strokeOpacity="0.05" x1="0" x2="800" y1="150" y2="150"></line>
                  <line stroke="white" strokeDasharray="4" strokeOpacity="0.05" x1="0" x2="800" y1="250" y2="250"></line>
                  <path className="opacity-30" d="M0,240 Q100,230 200,235 T400,210 T600,225 T800,220" fill="none" stroke="#ff4500" strokeWidth="2"></path>
                  <path className="opacity-60" d="M0,200 Q100,180 200,195 T400,160 T600,185 T800,170" fill="none" stroke="#ffffff" strokeWidth="2"></path>
                  <path className="drop-shadow-[0_0_8px_currentColor] text-primary" d="M0,150 Q100,120 200,140 T400,80 T600,110 T800,100" fill="none" stroke="currentColor" strokeWidth="3"></path>
                  <circle className="animate-ping" cx="400" cy="80" fill="#ff4500" r="4"></circle>
                  <circle cx="400" cy="80" fill="#ff4500" r="3"></circle>
                </svg>
                <div className="absolute left-1/2 top-10 -translate-x-1/2 bg-surface-container/80 backdrop-blur-xl p-3 rounded-lg border border-primary/40 text-[10px] font-mono z-10">
                  <div className="text-primary border-b border-white/10 pb-1 mb-1">T-12:00:42</div>
                  <div className="flex justify-between gap-4"><span>P99:</span> <span className="text-white">124ms</span></div>
                  <div className="flex justify-between gap-4"><span>P90:</span> <span className="text-secondary">82ms</span></div>
                </div>
              </div>
            </div>
          </div>

          {/* Live Log Stream Panel */}
          <div className="col-span-3 bg-surface-container/60 backdrop-blur-xl rounded-2xl border border-white/10 flex flex-col overflow-hidden">
            <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/5">
              <span className="font-mono text-[10px] uppercase tracking-widest font-bold text-secondary">Live log stream</span>
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                <span className="text-[9px] font-mono text-emerald-500 font-bold">CONNECTED</span>
              </span>
            </div>
            <div className="grow p-4 font-mono text-[10px] overflow-hidden">
              <div className="space-y-3">
                <div className="flex gap-2"><span className="text-muted">12:44:01</span><span className="text-emerald-400">[INFO]</span><span className="text-secondary">Handshake verified (node-7)</span></div>
                <div className="flex gap-2"><span className="text-muted">12:44:03</span><span className="text-amber-400">[WARN]</span><span className="text-secondary">High cache miss on /v2/search</span></div>
                <div className="flex gap-2"><span className="text-muted">12:44:05</span><span className="text-primary">[TRACE]</span><span className="text-secondary">Incoming POST /orders (req_92js)</span></div>
                <div className="flex gap-2"><span className="text-muted">12:44:08</span><span className="text-rose-400">[ERR]</span><span className="text-secondary">Database connection timeout (retrying...)</span></div>
                <div className="flex gap-2 opacity-60"><span className="text-muted">12:44:09</span><span className="text-emerald-400">[INFO]</span><span className="text-secondary">Health check passed in 12ms</span></div>
                <div className="flex gap-2 opacity-40"><span className="text-muted">12:44:11</span><span className="text-primary">[TRACE]</span><span className="text-secondary">Cleanup worker started</span></div>
                <div className="flex gap-2 opacity-20"><span className="text-muted">12:44:12</span><span className="text-emerald-400">[INFO]</span><span className="text-secondary">Cluster rebalancing complete</span></div>
              </div>
            </div>
            <div className="p-3 bg-white/5 border-t border-white/10 flex gap-2">
              <div className="bg-black/50 border border-white/10 rounded px-2 py-1 text-[9px] font-mono text-primary">
                FILTER: severity &gt;= WARN
              </div>
            </div>
          </div>
          
        </div>
      </div>
    </section>
  );
}