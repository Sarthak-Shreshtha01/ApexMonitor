import type { Metadata } from 'next';
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
  return <OAuthCallbackPageClient />;
}
