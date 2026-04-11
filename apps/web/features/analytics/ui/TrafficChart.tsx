export function TrafficChart() {
  return (
    <section className="bg-[#131313] border border-[#242424] p-8 rounded-lg">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-lg font-bold text-white">24h Traffic Distribution</h2>
        <div className="flex gap-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-[#FF4500] rounded-sm"></div>
            <span className="text-[10px] font-mono text-zinc-400">PAGE VIEWS</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-zinc-700 rounded-sm"></div>
            <span className="text-[10px] font-mono text-zinc-400">PREV PERIOD</span>
          </div>
        </div>
      </div>

      <div className="h-[400px] w-full relative">
        <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 1000 400">
          <defs>
            <linearGradient id="chartGradient" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#FF4500" stopOpacity="0.3"></stop>
              <stop offset="100%" stopColor="#FF4500" stopOpacity="0"></stop>
            </linearGradient>
          </defs>
          
          {/* Grid Lines */}
          <line stroke="#242424" strokeDasharray="4" strokeWidth="1" x1="0" x2="1000" y1="0" y2="0"></line>
          <line stroke="#242424" strokeDasharray="4" strokeWidth="1" x1="0" x2="1000" y1="100" y2="100"></line>
          <line stroke="#242424" strokeDasharray="4" strokeWidth="1" x1="0" x2="1000" y1="200" y2="200"></line>
          <line stroke="#242424" strokeDasharray="4" strokeWidth="1" x1="0" x2="1000" y1="300" y2="300"></line>
          <line stroke="#242424" strokeDasharray="4" strokeWidth="1" x1="0" x2="1000" y1="400" y2="400"></line>
          
          {/* Area Fill */}
          <path d="M0,400 L0,320 C100,340 200,280 300,300 C400,320 500,100 600,120 C700,140 800,220 900,180 L1000,200 L1000,400 Z" fill="url(#chartGradient)"></path>
          
          {/* Main Line */}
          <path className="drop-shadow-[0_0_8px_rgba(255,69,0,0.5)]" d="M0,320 C100,340 200,280 300,300 C400,320 500,100 600,120 C700,140 800,220 900,180 L1000,200" fill="none" stroke="#FF4500" strokeWidth="3"></path>
        </svg>

        {/* X-Axis Labels */}
        <div className="flex justify-between mt-4 text-[10px] font-mono text-zinc-600">
          <span>00:00</span>
          <span>04:00</span>
          <span>08:00</span>
          <span>12:00</span>
          <span>16:00</span>
          <span>20:00</span>
          <span>23:59</span>
        </div>
      </div>
    </section>
  );
}