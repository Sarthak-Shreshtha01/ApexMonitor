import { TraceHeader } from '@/features/traces/ui/TraceHeader';
import { TraceWaterfall } from '@/features/traces/ui/TraceWaterfall';
import { TraceSidebar } from '@/features/traces/ui/TraceSidebar';

export default function TraceDetailView() {
  return (
    <div className="flex flex-col h-full relative bg-[#000000]">
      {/* Background Grid specifically scoped to traces for accuracy to design */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-5" 
        style={{ backgroundImage: 'radial-gradient(circle, #464554 1px, transparent 1px)', backgroundSize: '24px 24px' }}
      ></div>
      
      <TraceHeader />
      
      <div className="flex-1 flex overflow-hidden">
        <TraceWaterfall />
        <TraceSidebar />
      </div>
      
      {/* Required for custom scrollbars scoped to this view to match design */}
      <style dangerouslySetInnerHTML={{
        __html: `
          .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
          .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
          .custom-scrollbar::-webkit-scrollbar-thumb { background: #262626; border-radius: 3px; }
        `
      }} />
    </div>
  );
}