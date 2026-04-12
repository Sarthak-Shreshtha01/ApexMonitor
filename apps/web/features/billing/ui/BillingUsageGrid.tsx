import { Check } from 'lucide-react';

export function BillingUsageGrid() {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 sm:gap-6">
      <div className="xl:col-span-8 bg-[#131313] border border-zinc-800 p-5 sm:p-8 rounded-lg flex flex-col justify-between relative overflow-hidden group hover:border-zinc-600 transition-colors duration-300 min-h-62.5">
        <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity duration-500 transform group-hover:scale-110">
          <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full border-10 border-[#FF4500]"></div>
        </div>

        <div className="relative z-10">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-6">
            <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-500">Resource Consumption</h2>
            <span className="text-xs font-mono text-zinc-500 italic">Resets in 12 days</span>
          </div>
          <div className="flex items-baseline gap-2 mb-2 flex-wrap">
            <span className="text-4xl sm:text-5xl lg:text-6xl font-mono font-bold text-white leading-none tracking-tighter">75,000</span>
            <span className="text-zinc-600 font-mono text-lg sm:text-xl">/ 100,000</span>
          </div>
          <p className="text-zinc-400 text-sm font-medium">API requests consumed this cycle</p>
        </div>

        <div className="mt-8 sm:mt-12 relative z-10">
          <div className="h-2 w-full bg-zinc-900 rounded-full overflow-hidden">
            <div className="h-full bg-[#FF4500] transition-all duration-1000 ease-out" style={{ width: '75%' }}></div>
          </div>
          <div className="flex justify-between mt-3">
            <span className="text-[10px] font-mono text-zinc-600 uppercase">Usage: 75.0%</span>
            <span className="text-[10px] font-mono text-zinc-600 uppercase">Limit: 100k</span>
          </div>
        </div>
      </div>

      <div className="xl:col-span-4 bg-[#FF4500] p-5 sm:p-8 rounded-lg flex flex-col justify-between text-black group hover:bg-[#FF8C00] transition-all duration-300 transform hover:-translate-y-1 hover:shadow-[0_10px_30px_rgba(255,69,0,0.2)] cursor-pointer gap-8">
        <div>
          <h2 className="text-xs font-black uppercase tracking-widest mb-4 opacity-70">Active Subscription</h2>
          <h3 className="text-3xl sm:text-4xl font-extrabold tracking-tighter leading-tight">Pro Plan Enterprise</h3>
        </div>
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4" />
            <span className="text-sm font-bold">Unlimited Projects</span>
          </div>
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4" />
            <span className="text-sm font-bold">24/7 Node Monitoring</span>
          </div>
          <button className="w-full bg-black text-white py-3 font-bold text-xs uppercase tracking-widest mt-4 rounded-sm flex items-center justify-center gap-2 hover:bg-zinc-900 transition-colors">
            Manage Subscription
          </button>
        </div>
      </div>
    </div>
  );
}
