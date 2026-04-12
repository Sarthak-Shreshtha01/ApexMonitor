import type { Metadata } from 'next';
import { WebAnalyticsExplorer } from '@/features/analytics/ui/WebAnalyticsExplorer';

export const metadata: Metadata = {
  title: 'Analytics',
  description: 'Explore web analytics, geography, referrers, and performance insights.',
};

export default function WebAnalyticsPage() {
  return <WebAnalyticsExplorer />;
}