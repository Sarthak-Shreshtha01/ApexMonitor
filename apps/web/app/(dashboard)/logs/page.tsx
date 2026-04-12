import type { Metadata } from 'next';
import { LogsExplorer } from '@/features/logs/ui/LogsExplorer';

export const metadata: Metadata = {
  title: 'Logs',
  description: 'Search and inspect application logs with filtering and live context.',
};

export default function LogsPage() {
  return <LogsExplorer />;
}