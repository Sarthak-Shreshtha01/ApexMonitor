import type { Metadata } from 'next';
import { AppShell } from '@/shared/layout/AppShell';
import { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Dashboard',
  description: 'ApexMonitor private dashboard for operational observability.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}