export function DeviceStats() {
  return (
    <div className="bg-[#131313] border border-[#242424] p-6 flex flex-col gap-8 rounded-lg">
      <div>
        <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-6">Device Distribution</h3>
        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-[10px] font-mono text-zinc-500 mb-1">
              <span>DESKTOP</span><span>64%</span>
            </div>
            <div className="h-1.5 w-full bg-zinc-900 rounded-full overflow-hidden">
              <div className="h-full bg-[#FF4500] w-[64%]"></div>
            </div>
          </div>
          <div>
            <div className="flex justify-between text-[10px] font-mono text-zinc-500 mb-1">
              <span>MOBILE</span><span>32%</span>
            </div>
            <div className="h-1.5 w-full bg-zinc-900 rounded-full overflow-hidden">
              <div className="h-full bg-zinc-600 w-[32%]"></div>
            </div>
          </div>
          <div>
            <div className="flex justify-between text-[10px] font-mono text-zinc-500 mb-1">
              <span>TABLET</span><span>4%</span>
            </div>
            <div className="h-1.5 w-full bg-zinc-900 rounded-full overflow-hidden">
              <div className="h-full bg-zinc-800 w-[4%]"></div>
            </div>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-6">Top Browsers</h3>
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <span className="text-xs font-mono text-zinc-400 w-16">Chrome</span>
            <div className="flex-1 h-1 bg-zinc-900 rounded-full overflow-hidden">
              <div className="h-full bg-[#FF4500] w-[72%]"></div>
            </div>
            <span className="text-xs font-mono text-white">72%</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs font-mono text-zinc-400 w-16">Safari</span>
            <div className="flex-1 h-1 bg-zinc-900 rounded-full overflow-hidden">
              <div className="h-full bg-zinc-700 w-[18%]"></div>
            </div>
            <span className="text-xs font-mono text-white">18%</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs font-mono text-zinc-400 w-16">Firefox</span>
            <div className="flex-1 h-1 bg-zinc-900 rounded-full overflow-hidden">
              <div className="h-full bg-zinc-800 w-[6%]"></div>
            </div>
            <span className="text-xs font-mono text-white">6%</span>
          </div>
        </div>
      </div>
    </div>
  );
}