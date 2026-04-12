import { Globe, Share2, Zap, Link as LinkIcon } from 'lucide-react';
import { GeoIpLeafletMap } from '@/shared/ui/GeoIpLeafletMap';

type ReferrerRow = {
  referrer_source: string;
  page_views: number;
};

type GeoRow = {
  country_code: string;
  region_code: string;
  page_views: number;
};

type ReferrersMapProps = {
  referrers: ReferrerRow[];
  geo: GeoRow[];
};

const format = (value: number) => Intl.NumberFormat('en').format(value);

const iconFor = (source: string) => {
  const normalized = source.toLowerCase();
  if (normalized === 'direct') return Zap;
  if (normalized.includes('google') || normalized.includes('bing')) return Globe;
  if (normalized.includes('twitter') || normalized.includes('x.com') || normalized.includes('facebook') || normalized.includes('linkedin')) return Share2;
  return LinkIcon;
};

const typeFor = (source: string) => {
  const normalized = source.toLowerCase();
  if (normalized === 'direct') return 'Direct';
  if (normalized.includes('google') || normalized.includes('bing')) return 'Organic Search';
  if (normalized.includes('twitter') || normalized.includes('x.com') || normalized.includes('facebook') || normalized.includes('linkedin')) return 'Social / Referral';
  return 'Referral';
};

export function ReferrersMap({ referrers, geo }: ReferrersMapProps) {
  return (
    <div className="bg-[#131313] border border-[#242424] p-6 rounded-lg">
      <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-6">Top Referrers</h3>
      
      <div className="space-y-6">
        {referrers.map((ref, i) => {
          const Icon = iconFor(ref.referrer_source);
          return (
            <div key={i} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-zinc-900 flex items-center justify-center border border-[#242424]">
                  <Icon className="w-4 h-4 text-zinc-400" />
                </div>
                <div>
                  <p className="text-xs font-bold text-white">{ref.referrer_source}</p>
                  <p className="text-[10px] text-zinc-500 font-mono">{typeFor(ref.referrer_source)}</p>
                </div>
              </div>
              <span className="text-xs font-mono text-orange-500">{format(ref.page_views)}</span>
            </div>
          );
        })}
        {referrers.length === 0 ? <p className="text-xs text-zinc-500">No referrer data.</p> : null}
      </div>

      <div className="mt-10 p-4 border border-[#242424] bg-[#0A0A0A] rounded-lg">
        <GeoIpLeafletMap data={geo} title="Live Map Projection" />
      </div>
    </div>
  );
}