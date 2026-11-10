import type { Metadata } from 'next';
import { Suspense } from 'react';
import { OAuthCallbackPageClient } from '@/features/auth/ui/OAuthCallbackPageClient';

export const metadata: Metadata = {
  title: 'OAuth Callback',
  description: 'Finalizing OAuth sign in for your ApexMonitor workspace.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function OAuthCallbackPage() {
  // The client component reads ?code with useSearchParams, which needs a Suspense boundary
  // so the rest of the page can still be prerendered.
  return (
    <Suspense fallback={null}>
      <OAuthCallbackPageClient />
    </Suspense>
  );
}
