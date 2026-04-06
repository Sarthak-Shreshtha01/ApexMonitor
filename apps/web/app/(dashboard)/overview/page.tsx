import { MetricCards } from '@/features/overview/ui/MetricCards';
import { RequestVolumeChart } from '@/features/overview/ui/RequestVolumeChart';
import { DistributionRow } from '@/features/overview/ui/DistributionRow';
import { TopEndpointsTable } from '@/features/overview/ui/TopEndpointsTable';
import { Plus } from 'lucide-react';

export default function OverviewPage() {
  return (
    <div className="max-w-[1400px] mx-auto w-full relative">
      <MetricCards />
      <RequestVolumeChart />
      <DistributionRow />
      <TopEndpointsTable />

      {/* Floating Action Button */}
      <button 
        className="fixed bottom-8 right-8 w-14 h-14 bg-gradient-to-tr from-primary to-primary-container rounded-lg shadow-[0_0_30px_-5px_rgba(192,193,255,0.4)] flex items-center justify-center text-on-primary group hover:scale-110 active:scale-95 transition-all duration-150 z-50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-slate-950"
        aria-label="New Action"
      >
        <Plus className="w-8 h-8 fill-current" strokeWidth={3} />
      </button>
    </div>
  );
}