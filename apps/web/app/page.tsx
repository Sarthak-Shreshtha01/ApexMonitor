import type { Metadata } from 'next';
import { HeroSection } from '@/features/marketing/ui/HeroSection';
import { FeaturesSection } from '@/features/marketing/ui/FeaturesSection';
import { AiInsightsSection } from '@/features/marketing/ui/AiInsightsSection';
import { PricingAndCta } from '@/features/marketing/ui/PricingAndCta';

export const metadata: Metadata = {
  title: 'Observability Platform',
  description: 'ApexMonitor delivers logs, traces, analytics, and AI-assisted observability in one platform.',
};

export default function MarketingLandingPage() {
  return (
    <div className="bg-surface text-on-surface overflow-x-hidden relative min-h-screen">
      {/* Background blueprint grid added via layout or globals.css */}
      <main className="relative">
        <HeroSection />
        <FeaturesSection />
        <AiInsightsSection />
        <PricingAndCta />
      </main>
    </div>
  );
}