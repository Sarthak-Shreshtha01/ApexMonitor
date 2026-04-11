type CoreWebVitalsProps = {
  ttfbMs: number;
  fcpMs: number;
  lcpMs: number;
};

const quality = (metric: 'ttfb' | 'fcp' | 'lcp', value: number): 'GOOD' | 'NEEDS IMPROVEMENT' | 'POOR' => {
  if (metric === 'ttfb') {
    if (value <= 800) return 'GOOD';
    if (value <= 1800) return 'NEEDS IMPROVEMENT';
    return 'POOR';
  }

  if (metric === 'fcp') {
    if (value <= 1800) return 'GOOD';
    if (value <= 3000) return 'NEEDS IMPROVEMENT';
    return 'POOR';
  }

  if (value <= 2500) return 'GOOD';
  if (value <= 4000) return 'NEEDS IMPROVEMENT';
  return 'POOR';
};

const toneClass = (state: 'GOOD' | 'NEEDS IMPROVEMENT' | 'POOR') => {
  if (state === 'GOOD') return 'text-emerald-500';
  if (state === 'NEEDS IMPROVEMENT') return 'text-amber-500';
  return 'text-error';
};

export function CoreWebVitals({ ttfbMs, fcpMs, lcpMs }: CoreWebVitalsProps) {
  const ttfbState = quality('ttfb', ttfbMs);
  const fcpState = quality('fcp', fcpMs);
  const lcpState = quality('lcp', lcpMs);

  return (
    <section className="bg-[#131313] border border-[#242424] p-1 flex flex-col md:flex-row items-stretch rounded-lg overflow-hidden">
      
      <div className="flex-1 p-6 border-b md:border-b-0 md:border-r border-[#242424]">
        <div className="flex justify-between items-end mb-4">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-500">TTFB (Time to First Byte)</h3>
          <span className={`${toneClass(ttfbState)} text-[10px] font-mono font-bold`}>{ttfbState}</span>
        </div>
        <p className="text-2xl font-mono font-bold text-white mb-2">{Math.round(ttfbMs)}ms</p>
        <div className="h-1 w-full bg-zinc-900 overflow-hidden rounded-full">
          <div className="h-full bg-emerald-500" style={{ width: `${Math.max(5, Math.min(100, 100 - (ttfbMs / 3000) * 100))}%` }}></div>
        </div>
      </div>

      <div className="flex-1 p-6 border-b md:border-b-0 md:border-r border-[#242424]">
        <div className="flex justify-between items-end mb-4">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-500">FCP (First Contentful Paint)</h3>
          <span className={`${toneClass(fcpState)} text-[10px] font-mono font-bold`}>{fcpState}</span>
        </div>
        <p className="text-2xl font-mono font-bold text-white mb-2">{(fcpMs / 1000).toFixed(2)}s</p>
        <div className="h-1 w-full bg-zinc-900 overflow-hidden rounded-full">
          <div className="h-full bg-emerald-500" style={{ width: `${Math.max(5, Math.min(100, 100 - (fcpMs / 5000) * 100))}%` }}></div>
        </div>
      </div>

      <div className="flex-1 p-6">
        <div className="flex justify-between items-end mb-4">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-500">LCP (Largest Contentful Paint)</h3>
          <span className={`${toneClass(lcpState)} text-[10px] font-mono font-bold`}>{lcpState}</span>
        </div>
        <p className="text-2xl font-mono font-bold text-white mb-2">{(lcpMs / 1000).toFixed(2)}s</p>
        <div className="h-1 w-full bg-zinc-900 overflow-hidden rounded-full">
          <div className="h-full bg-amber-500" style={{ width: `${Math.max(5, Math.min(100, 100 - (lcpMs / 6000) * 100))}%` }}></div>
        </div>
      </div>

    </section>
  );
}