import type { Metadata } from 'next';
import { TraceDetailPageClient } from '@/features/traces/ui/TraceDetailPageClient';

export const metadata: Metadata = {
  title: 'Trace Detail',
  description: 'Inspect distributed trace spans, timing waterfalls, and request metadata.',
};

export default function TraceDetailView({ params }: { params: { id: string } }) {
  return <TraceDetailPageClient traceId={params.id} />;
}