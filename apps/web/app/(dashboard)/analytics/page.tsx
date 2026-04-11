import { Clock, ChevronDown, CheckCircle2 } from 'lucide-react';
import { GlobalPulseCards } from '@/features/analytics/ui/GlobalPulseCards';
import { CoreWebVitals } from '@/features/analytics/ui/CoreWebVitals';
import { TrafficChart } from '@/features/analytics/ui/TrafficChart';
import { TopPagesTable } from '@/features/analytics/ui/TopPagesTable';
import { DeviceStats } from '@/features/analytics/ui/DeviceStats';
import { ReferrersMap } from '@/features/analytics/ui/ReferrersMap';

export default function WebAnalyticsPage() {
  return (
    <div className="bg-[#0A0A0A] text-white min-h-[calc(100vh-4rem)] p-4 sm:p-8 selection:bg-orange-500/30 font-sans">
      <div className="max-w-[1600px] mx-auto space-y-8">
        
        {/* Header Section */}
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-white mb-1">Web Analytics (RUM)</h1>
            <p className="text-zinc-500 text-sm font-mono uppercase tracking-widest">Real-time user monitoring & experience metrics</p>
          </div>
          <div className="flex items-center gap-2 bg-[#131313] border border-[#242424] px-4 py-2 cursor-pointer hover:bg-[#1a1919] transition-colors rounded-lg">
            <Clock className="w-4 h-4 text-orange-500" />
            <span className="text-xs font-mono text-white">Last 24 Hours</span>
            <ChevronDown className="w-4 h-4 text-zinc-600" />
          </div>
        </header>

        {/* Section 1: Global Pulse */}
        <GlobalPulseCards />

        {/* Section 2: Core Web Vitals */}
        <CoreWebVitals />

        {/* Section 3: Main Traffic Chart */}
        <TrafficChart />

        {/* Section 4: Bento Grid */}
        <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <TopPagesTable />
          <DeviceStats />
          <ReferrersMap />
        </section>

      </div>

      {/* Success Feedback (Floating Toast) */}
      <div className="fixed bottom-6 right-6 flex items-center gap-3 px-4 py-2 bg-emerald-500/10 border border-emerald-500/50 backdrop-blur-md rounded-lg shadow-lg z-50">
        <CheckCircle2 className="text-emerald-500 w-4 h-4" />
        <span className="text-[10px] font-mono text-emerald-500 font-bold uppercase tracking-widest">System Health: Optimal</span>
      </div>
    </div>
  );
}