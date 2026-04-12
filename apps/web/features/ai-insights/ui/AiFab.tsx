import { Sparkles } from 'lucide-react';

export function AiFab() {
  return (
    <button 
      className="fixed bottom-4 right-4 sm:bottom-8 sm:right-8 w-12 h-12 sm:w-14 sm:h-14 bg-orange-600 rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(234,88,12,0.4)] hover:bg-orange-500 hover:scale-110 transition-all active:scale-95 group z-50 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 focus:ring-offset-[#0a0a0a]"
      aria-label="Ask AI Agent"
    >
      <Sparkles className="text-white w-6 h-6" />
      
      <div className="absolute right-16 bg-neutral-900 border border-neutral-800 px-3 py-2 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-xl">
        <span className="text-xs font-bold text-white tracking-wide">Ask AI Agent</span>
      </div>
    </button>
  );
}