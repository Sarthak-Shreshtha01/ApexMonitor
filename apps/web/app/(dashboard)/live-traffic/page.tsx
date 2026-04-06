import { LiveThroughputCard } from '@/features/traffic/ui/LiveThroughputCard';
import { TerminalStream } from '@/features/traffic/ui/TerminalStream';
import { AnomalySidebar } from '@/features/traffic/ui/AnomalySidebar';
import { Globe, Zap } from 'lucide-react';

export default function LiveTrafficPage() {
  return (
    <div className="grid grid-cols-12 gap-6 relative">
      
      {/* Left Column: Metrics & Logs */}
      <section className="col-span-12 lg:col-span-8 space-y-6">
        <LiveThroughputCard />
        <TerminalStream />
      </section>

      {/* Right Column: AI & Infra Status */}
      <section className="col-span-12 lg:col-span-4 space-y-6">
        <AnomalySidebar />

        {/* Secondary Metric Cards */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 rounded-2xl bg-surface-container-low border border-outline-variant/15">
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-2">Error Rate</p>
            <p className="text-2xl font-black text-error">0.04%</p>
            <p className="text-[9px] text-slate-600 mt-1">↓ 2% from avg</p>
          </div>
          <div className="p-4 rounded-2xl bg-surface-container-low border border-outline-variant/15">
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-2">Active Nodes</p>
            <p className="text-2xl font-black text-on-surface">12</p>
            <p className="text-[9px] text-secondary mt-1">Healthy</p>
          </div>
        </div>

        {/* Infrastructure Visualization */}
        <div className="p-6 rounded-2xl bg-surface-container-low border border-outline-variant/15 relative overflow-hidden">
          <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-4">Traffic Map</p>
          <div className="h-40 w-full rounded-xl bg-slate-900/50 flex items-center justify-center border border-outline-variant/10 relative overflow-hidden">
            {/* Using a CSS gradient map grid as a safe fallback instead of an external image link */}
            <div 
              className="absolute inset-0 opacity-20"
              style={{ backgroundImage: 'radial-gradient(circle, #5de6ff 1px, transparent 1px)', backgroundSize: '10px 10px' }}
            ></div>
            <div className="relative z-10 flex flex-col items-center">
              <Globe className="text-secondary w-8 h-8 mb-2 animate-pulse" />
              <span className="text-[10px] text-slate-400">Global Cluster Status: Nominal</span>
            </div>
          </div>
        </div>
      </section>

      {/* Contextual FAB for Troubleshooting */}
      <button 
        className="fixed bottom-8 right-8 w-14 h-14 rounded-full bg-primary flex items-center justify-center text-on-primary shadow-2xl hover:scale-110 active:scale-95 transition-all z-50 pulse-glow"
        aria-label="Quick Action"
      >
        <Zap className="w-6 h-6 fill-current" />
      </button>

    </div>
  );
}