import { Filter, Download } from 'lucide-react';

export function RequestVolumeChart() {
  return (
    <div className="bg-surface-container-low p-8 rounded-2xl border border-outline-variant/10 shadow-[0_20px_40px_-12px_rgba(0,0,0,0.5)] mb-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-10">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight">Request Volume Over Time</h2>
          <p className="text-xs text-slate-500">Aggregated telemetry data for production cluster main</p>
        </div>
        <div className="flex gap-2">
          <button className="bg-slate-900 border border-outline-variant/20 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-white transition-colors flex items-center gap-2">
            <Filter className="w-3.5 h-3.5" /> Filter
          </button>
          <button className="bg-indigo-500/10 border border-indigo-500/20 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest text-indigo-300 flex items-center gap-2 hover:bg-indigo-500/20 transition-colors">
            <Download className="w-3.5 h-3.5" /> Export
          </button>
        </div>
      </div>

      <div className="h-[320px] w-full relative">
        {/* Chart Background Lines */}
        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="border-t border-slate-800/50 w-full h-px"></div>
          ))}
        </div>

        {/* SVG Area Chart */}
        <svg className="w-full h-full relative z-10" preserveAspectRatio="none" viewBox="0 0 1000 300">
          <defs>
            <linearGradient id="areaGradient" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#c0c1ff" stopOpacity="0.3"></stop>
              <stop offset="100%" stopColor="#c0c1ff" stopOpacity="0"></stop>
            </linearGradient>
          </defs>
          <path d="M0,250 Q100,220 200,240 T400,180 T600,200 T800,120 T1000,150 V300 H0 Z" fill="url(#areaGradient)"></path>
          <path className="drop-shadow-[0_0_8px_rgba(192,193,255,0.4)]" d="M0,250 Q100,220 200,240 T400,180 T600,200 T800,120 T1000,150" fill="none" stroke="#c0c1ff" strokeWidth="2"></path>
        </svg>

        {/* Custom Crosshair Tooltip (Mockup) */}
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-indigo-500/40 pointer-events-none z-20">
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-indigo-400 rounded-full border-2 border-slate-950 ring-4 ring-indigo-500/20"></div>
          <div className="absolute top-1/3 left-4 bg-surface-container-highest/80 backdrop-blur-md p-3 rounded-lg border border-outline-variant/20 shadow-2xl min-w-[120px]">
            <p className="text-[10px] text-slate-400 uppercase font-bold tracking-tighter mb-1">14:42:00</p>
            <p className="text-sm font-bold text-white">42.8k req/s</p>
          </div>
        </div>
      </div>

      <div className="flex justify-between mt-4">
        {['12:00', '15:00', '18:00', '21:00', '00:00'].map((time) => (
          <span key={time} className="text-[10px] font-bold text-slate-600">{time}</span>
        ))}
      </div>
    </div>
  );
}