import type { Metadata } from 'next';
import { AlertsPageClient } from '@/features/alerts/ui/AlertsPageClient';

export const metadata: Metadata = {
  title: 'Alerts',
  description: 'Alert rules on error rate and p99 latency, with trigger history.',
};

export default function AlertsPage() {
  return <AlertsPageClient />;
}
