import type { Metadata } from 'next';
import { TraceDetailPageClient } from '@/features/traces/ui/TraceDetailPageClient';

export const metadata: Metadata = {
  title: 'Trace Detail',
  description: 'Inspect distributed trace spans, timing waterfalls, and request metadata.',
};

// Route params are a Promise in this Next.js version; reading `params.id` directly gives undefined.
export default async function TraceDetailView({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TraceDetailPageClient traceId={decodeURIComponent(id)} />;
}
