import { Activity } from 'lucide-react';

export function ModelLoadBanner() {
  return (
    <div className="col-span-12 bg-[#131313] border border-neutral-800 rounded-xl p-1 relative overflow-hidden h-32 md:h-48 mt-6">
      {/* Abstract Background pattern simulation */}
      <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at center, #ea580c 1px, transparent 1px)', backgroundSize: '16px 16px' }}></div>
      <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-transparent to-transparent"></div>
      
      <div className="relative z-10 p-6 md:p-8 flex flex-col justify-end h-full">
        <div className="flex flex-wrap gap-8 md:gap-16">
          <div className="flex items-center gap-4">
             <Activity className="w-8 h-8 text-neutral-700 hidden sm:block" />
             <div>
               <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1">Neural Model Load</p>
               <p className="text-2xl md:text-3xl font-mono text-white font-bold">0.14<span className="text-sm font-sans font-normal text-neutral-500 ml-1">ms Infr</span></p>
             </div>
          </div>
          <div>
            <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1">Data Points / Sec</p>
            <p className="text-2xl md:text-3xl font-mono text-white font-bold">850k<span className="text-sm font-sans font-normal text-neutral-500 ml-1"> p/s</span></p>
          </div>
        </div>
      </div>
    </div>
  );
}