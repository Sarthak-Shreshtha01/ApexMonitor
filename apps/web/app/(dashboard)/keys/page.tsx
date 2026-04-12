import type { Metadata } from 'next';
import { ApiKeysSection } from '@/features/keys/ui/ApiKeysSection';

export const metadata: Metadata = {
  title: 'API Keys',
  description: 'Create and manage API keys for ingesting telemetry data securely.',
};

export default function KeysPage() {
  return (
    <div className="p-8 max-w-7xl mx-auto">
      <ApiKeysSection />
    </div>
  );
}