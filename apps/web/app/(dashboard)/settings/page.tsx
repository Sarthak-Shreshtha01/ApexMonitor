import type { Metadata } from 'next';
import { SettingsPageClient } from '@/features/settings/ui/SettingsPageClient';

export const metadata: Metadata = {
  title: 'Workspace Settings',
  description: 'Manage profile, team access, and workspace configuration.',
};

export default function SettingsPage() {
  return <SettingsPageClient />;
}