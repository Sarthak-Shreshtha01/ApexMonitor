import type { Metadata } from 'next';
import { TracesExplorer } from '@/features/traces/ui/TracesExplorer';

export const metadata: Metadata = {
  title: 'Traces',
  description: 'Inspect distributed traces, latency waterfalls, and service spans.',
};

export default function TracesPage() {
  return (
    <div className="w-full min-w-0">
      <TracesExplorer />
    </div>
  );
}
