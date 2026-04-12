'use client';

import dynamic from 'next/dynamic';

export type GeoMetricRow = {
  country_code: string;
  region_code: string;
  page_views: number;
  avg_lcp_ms?: number;
};

type GeoIpLeafletMapProps = {
  data: GeoMetricRow[];
  loading?: boolean;
  compact?: boolean;
  title?: string;
};

const GeoIpLeafletMapClient = dynamic(
  () => import('./GeoIpLeafletMapClient').then((module) => module.GeoIpLeafletMapClient),
  {
    ssr: false,
    loading: () => (
      <div className="h-44 sm:h-52 w-full rounded border border-white/10 bg-[#0A0A0A] grid place-items-center text-[10px] font-mono text-zinc-500">
        Loading IP map...
      </div>
    ),
  }
);

export function GeoIpLeafletMap(props: GeoIpLeafletMapProps) {
  return <GeoIpLeafletMapClient {...props} />;
}
