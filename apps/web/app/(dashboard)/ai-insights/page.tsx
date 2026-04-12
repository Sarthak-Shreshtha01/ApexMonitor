import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'AI Insights',
  description: 'AI-assisted anomaly insights and recommendations for your telemetry data.',
};

/*
import { NeuralSummaryCard } from '@/features/ai-insights/ui/NeuralSummaryCard';
import { HealthForecastMetrics } from '@/features/ai-insights/ui/HealthForecastMetrics';
import { FlaggedRoutesTable } from '@/features/ai-insights/ui/FlaggedRoutesTable';
import { AiAnalysisBot } from '@/features/ai-insights/ui/AiAnalysisBot';
import { ActionableSuggestions } from '@/features/ai-insights/ui/ActionableSuggestions';
import { ModelLoadBanner } from '@/features/ai-insights/ui/ModelLoadBanner';
import { AiFab } from '@/features/ai-insights/ui/AiFab';

export default function AiInsightsPage() {
  return (
    <div className="min-h-[calc(100vh-3rem)] bg-[#0a0a0a] text-white p-4 sm:p-8 selection:bg-orange-500/30 overflow-x-hidden">
      <div className="w-full mx-auto space-y-8">
        <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-6">
          <div>
            <nav className="flex gap-2 text-[10px] font-mono text-neutral-500 uppercase tracking-widest mb-3">
              <span>Cluster Node 01</span>
              <span>/</span>
              <span className="text-orange-500 font-bold">AI Command Center</span>
            </nav>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tighter text-white">Neural Intelligence Hub</h1>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 bg-[#131313] border border-neutral-800 rounded-lg shadow-sm">
            <div className="relative w-2 h-2 flex items-center justify-center">
              <div className="absolute inset-0 bg-orange-500 rounded-full animate-ping opacity-75"></div>
              <div className="relative w-1.5 h-1.5 bg-orange-500 rounded-full"></div>
            </div>
            <span className="text-[10px] font-mono font-bold text-orange-500 uppercase tracking-tighter">AI Inference Online</span>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.85fr)] gap-6 md:gap-8 items-start">
          <div className="space-y-6 md:space-y-8 min-w-0">
            <NeuralSummaryCard />
            <HealthForecastMetrics />
            <FlaggedRoutesTable />
          </div>

          <div className="space-y-6 md:space-y-8 min-w-0">
            <AiAnalysisBot />
            <ActionableSuggestions />
          </div>
        </div>

        <ModelLoadBanner />
      </div>

      <AiFab />

      <style dangerouslySetInnerHTML={{
        __html: `
          .custom-scrollbar::-webkit-scrollbar { width: 4px; }
          .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
          .custom-scrollbar::-webkit-scrollbar-thumb { background: #262626; border-radius: 4px; }
        `
      }} />
    </div>
  );
}
*/

export default function AiInsightsPage() {
  return (
    <section className="min-h-[calc(100vh-3rem)] w-full grid place-items-center p-4 sm:p-8 bg-[#0a0a0a]">
      <div className="w-full max-w-2xl rounded-xl border border-neutral-800 bg-[#131313] p-6 sm:p-10 text-center space-y-4">
        <p className="text-[10px] font-mono uppercase tracking-widest text-neutral-500">ApexMonitor Insights</p>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">Insights Page Coming Soon</h1>
        <p className="text-sm sm:text-base text-neutral-400 max-w-xl mx-auto">
          We are preparing a smarter insights experience with anomaly detection, suggested actions, and service intelligence.
        </p>
      </div>
    </section>
  );
}