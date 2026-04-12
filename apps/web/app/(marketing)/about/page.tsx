import type { Metadata } from 'next';
import { HeroSection } from '@/features/marketing/ui/HeroSection';
import { PricingSection } from '@/features/marketing/ui/PricingSection';
import { FeaturesSection } from '@/features/marketing/ui/FeaturesSection';

export const metadata: Metadata = {
  title: 'About ApexMonitor',
  description: 'Learn how ApexMonitor helps teams monitor reliability, performance, and user experience.',
};

export default function LandingPage() {
  return (
    <>
      <HeroSection />
      <PricingSection />
      <FeaturesSection />
    </>
  );
}