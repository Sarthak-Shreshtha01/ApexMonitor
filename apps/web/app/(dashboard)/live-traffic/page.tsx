import type { Metadata } from 'next';
import { LiveTrafficPageClient } from '@/features/traffic/ui/LiveTrafficPageClient';

export const metadata: Metadata = {
  title: 'Live Traffic Monitor',
  description: 'Monitor requests, anomalies, and geographic traffic patterns in real time.',
};

export default function LiveTrafficPage() {
  return <LiveTrafficPageClient />;
}
