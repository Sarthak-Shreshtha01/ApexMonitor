import type { Metadata } from 'next';
import { SupportQrCard } from '@/features/billing/ui/SupportQrCard';

export const metadata: Metadata = {
  title: 'Billing',
  description: 'Review billing status, plan access, and support payment options.',
};

/*
import { BillingHeader } from '@/features/billing/ui/BillingHeader';
import { BillingUsageGrid } from '@/features/billing/ui/BillingUsageGrid';
import { BillingTierSection } from '@/features/billing/ui/BillingTierSection';
import { BillingPaymentSection } from '@/features/billing/ui/BillingPaymentSection';

export default function BillingPage() {
  return (
    <section className="w-full mx-auto min-w-0 space-y-6 sm:space-y-8 lg:space-y-10">
      <BillingHeader />
      <BillingUsageGrid />
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.85fr)] gap-6 lg:gap-8 items-start">
        <BillingTierSection />
        <BillingPaymentSection />
      </div>
    </section>
  );
}
*/

export default function BillingPage() {
  return (
    <section className="min-h-[calc(100vh-3rem)] w-full grid place-items-center p-4 sm:p-8 bg-[#0a0a0a]">
      <div className="w-full max-w-2xl rounded-xl border border-neutral-800 bg-[#131313] p-6 sm:p-10 text-center space-y-5">
        <p className="text-[10px] font-mono uppercase tracking-widest text-neutral-500">ApexMonitor Billing</p>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">Platform Is Free For Now</h1>
        <p className="text-sm sm:text-base text-neutral-400 max-w-xl mx-auto">
          Enjoy all services while we finalize production billing. You currently have full access at no cost.
        </p>
        <div className="pt-2">
          <SupportQrCard />
        </div>
      </div>
    </section>
  );
}