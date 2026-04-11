import { TrendingUp } from 'lucide-react';

export function GlobalPulseCards() {
  return (
    <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
      {/* Current Visitors */}
      <div className="bg-[#131313] p-6 border border-[#242424] relative overflow-hidden group">
        <div className="flex justify-between items-start mb-4">
          <span className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 font-bold">Current Visitors</span>
          <div className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FF4500] opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-[#FF4500]"></span>
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-mono font-bold text-white tracking-tighter">42</span>
          <span className="text-zinc-400 text-xs font-medium">Active now</span>
        </div>
        <div className="mt-4 h-1 w-full bg-zinc-900 rounded-full overflow-hidden">
          <div className="h-full bg-[#FF4500] w-1/3"></div>
        </div>
      </div>

      {/* Total Page Views */}
      <div className="bg-[#131313] p-6 border border-[#242424]">
        <div className="flex justify-between items-start mb-4">
          <span className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 font-bold">Total Page Views</span>
          <span className="text-emerald-500 text-xs font-mono font-bold flex items-center gap-1">
            +12% <TrendingUp className="w-3 h-3" />
          </span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-mono font-bold text-white tracking-tighter">124.5k</span>
        </div>
        <div className="mt-4 flex gap-1 h-6 items-end">
          <div className="bg-zinc-800 w-1 h-2 rounded-t-sm"></div>
          <div className="bg-zinc-800 w-1 h-3 rounded-t-sm"></div>
          <div className="bg-zinc-700 w-1 h-4 rounded-t-sm"></div>
          <div className="bg-zinc-600 w-1 h-3 rounded-t-sm"></div>
          <div className="bg-orange-900 w-1 h-5 rounded-t-sm"></div>
          <div className="bg-[#FF4500] w-1 h-6 rounded-t-sm shadow-[0_0_8px_rgba(255,69,0,0.5)]"></div>
          <div className="bg-[#FF4500] w-1 h-5 rounded-t-sm"></div>
        </div>
      </div>

      {/* Unique Visitors */}
      <div className="bg-[#131313] p-6 border border-[#242424]">
        <div className="flex justify-between items-start mb-4">
          <span className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 font-bold">Unique Visitors</span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-mono font-bold text-white tracking-tighter">89.2k</span>
        </div>
        <div className="mt-4 flex items-center gap-2">
          <span className="text-[10px] font-mono text-zinc-600">VS PREV PERIOD:</span>
          <span className="text-[10px] font-mono text-zinc-400">84.1k</span>
        </div>
      </div>

      {/* Bounce Rate */}
      <div className="bg-[#131313] p-6 border border-[#242424]">
        <div className="flex justify-between items-start mb-4">
          <span className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 font-bold">Bounce Rate</span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-mono font-bold text-white tracking-tighter">42%</span>
        </div>
        <div className="mt-4 h-1 w-full bg-zinc-900 rounded-full overflow-hidden">
          <div className="h-full bg-orange-800 w-[42%]"></div>
        </div>
      </div>
    </section>
  );
}