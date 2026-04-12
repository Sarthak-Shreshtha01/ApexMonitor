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