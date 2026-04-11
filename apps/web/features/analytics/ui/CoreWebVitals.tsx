export function CoreWebVitals() {
  return (
    <section className="bg-[#131313] border border-[#242424] p-1 flex flex-col md:flex-row items-stretch rounded-lg overflow-hidden">
      
      <div className="flex-1 p-6 border-b md:border-b-0 md:border-r border-[#242424]">
        <div className="flex justify-between items-end mb-4">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-500">TTFB (Time to First Byte)</h3>
          <span className="text-emerald-500 text-[10px] font-mono font-bold">GOOD</span>
        </div>
        <p className="text-2xl font-mono font-bold text-white mb-2">120ms</p>
        <div className="h-1 w-full bg-zinc-900 overflow-hidden rounded-full">
          <div className="h-full bg-emerald-500 w-[85%]"></div>
        </div>
      </div>

      <div className="flex-1 p-6 border-b md:border-b-0 md:border-r border-[#242424]">
        <div className="flex justify-between items-end mb-4">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-500">FCP (First Contentful Paint)</h3>
          <span className="text-emerald-500 text-[10px] font-mono font-bold">GOOD</span>
        </div>
        <p className="text-2xl font-mono font-bold text-white mb-2">0.8s</p>
        <div className="h-1 w-full bg-zinc-900 overflow-hidden rounded-full">
          <div className="h-full bg-emerald-500 w-[78%]"></div>
        </div>
      </div>

      <div className="flex-1 p-6">
        <div className="flex justify-between items-end mb-4">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-500">LCP (Largest Contentful Paint)</h3>
          <span className="text-amber-500 text-[10px] font-mono font-bold">NEEDS IMPROVEMENT</span>
        </div>
        <p className="text-2xl font-mono font-bold text-white mb-2">2.8s</p>
        <div className="h-1 w-full bg-zinc-900 overflow-hidden rounded-full">
          <div className="h-full bg-amber-500 w-[62%]"></div>
        </div>
      </div>

    </section>
  );
}