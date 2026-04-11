import { Globe, Share2, Zap, Link as LinkIcon } from 'lucide-react';

const REFERRERS = [
  { domain: 'google.com', type: 'Organic Search', views: '42,104', icon: Globe },
  { domain: 'twitter.com', type: 'Social / Referral', views: '18,592', icon: Share2 },
  { domain: 'direct', type: 'Internal / Direct', views: '12,110', icon: Zap },
  { domain: 'github.com', type: 'Dev Community', views: '9,842', icon: LinkIcon },
];

export function ReferrersMap() {
  return (
    <div className="bg-[#131313] border border-[#242424] p-6 rounded-lg">
      <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-6">Top Referrers</h3>
      
      <div className="space-y-6">
        {REFERRERS.map((ref, i) => {
          const Icon = ref.icon;
          return (
            <div key={i} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-zinc-900 flex items-center justify-center border border-[#242424]">
                  <Icon className="w-4 h-4 text-zinc-400" />
                </div>
                <div>
                  <p className="text-xs font-bold text-white">{ref.domain}</p>
                  <p className="text-[10px] text-zinc-500 font-mono">{ref.type}</p>
                </div>
              </div>
              <span className="text-xs font-mono text-orange-500">{ref.views}</span>
            </div>
          );
        })}
      </div>

      <div className="mt-10 p-4 border border-[#242424] bg-[#0A0A0A] rounded-lg">
        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-3">Live Map Projection</p>
        <div className="aspect-video bg-zinc-900 relative flex items-center justify-center rounded overflow-hidden">
          {/* Abstract map pattern fallback */}
          <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at center, #71717a 1px, transparent 1px)', backgroundSize: '8px 8px' }}></div>
          
          <div className="absolute top-4 left-4 flex items-center gap-2 bg-black/50 px-2 py-1 rounded backdrop-blur-sm border border-white/5">
            <div className="w-1.5 h-1.5 rounded-full bg-[#FF4500] animate-pulse"></div>
            <span className="text-[8px] font-mono text-white">NORTH AMERICA: 42%</span>
          </div>
        </div>
      </div>
    </div>
  );
}