import type { Metadata } from 'next';
import { OverviewExplorer } from '@/features/overview/ui/OverviewExplorer';

export const metadata: Metadata = {
  title: 'Overview',
  description: 'Get a snapshot of system health, latency, and error trends across services.',
};

export default function OverviewPage() {
  return <OverviewExplorer />;
}