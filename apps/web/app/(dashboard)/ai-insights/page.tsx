import { NeuralSummaryCard } from '@/features/ai-insights/ui/NeuralSummaryCard';
import { HealthForecastMetrics } from '@/features/ai-insights/ui/HealthForecastMetrics';
import { FlaggedRoutesTable } from '@/features/ai-insights/ui/FlaggedRoutesTable';
import { AiAnalysisBot } from '@/features/ai-insights/ui/AiAnalysisBot';
import { ActionableSuggestions } from '@/features/ai-insights/ui/ActionableSuggestions';
import { ModelLoadBanner } from '@/features/ai-insights/ui/ModelLoadBanner';
import { AiFab } from '@/features/ai-insights/ui/AiFab';

export default function AiInsightsPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-4 sm:p-8 selection:bg-orange-500/30">
      <div className="max-w-[1600px] mx-auto w-full">
        
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:justify-between md:items-end mb-10 gap-6">
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

        {/* Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8">
          
          {/* Top Full-Width Hero */}
          <div className="col-span-1 lg:col-span-12">
            <NeuralSummaryCard />
          </div>

          {/* Left Column (Main Content) */}
          <div className="col-span-1 lg:col-span-8 flex flex-col gap-6 md:gap-8">
            <HealthForecastMetrics />
            <FlaggedRoutesTable />
          </div>

          {/* Right Column (Sidebar/Chat) */}
          <div className="col-span-1 lg:col-span-4 flex flex-col gap-6 md:gap-8">
            <AiAnalysisBot />
            <ActionableSuggestions />
          </div>

          {/* Bottom Full-Width Banner */}
          <ModelLoadBanner />
          
        </div>
      </div>

      <AiFab />
      
      {/* Scope custom scrollbar purely to this page if needed */}
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