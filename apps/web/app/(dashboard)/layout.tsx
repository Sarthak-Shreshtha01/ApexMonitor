import { AppShell } from '@/shared/layout/AppShell';
import { ReactNode } from 'react';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  // Edge middleware handles unauthenticated redirects, no need for client checks here [cite: 721]
  return <AppShell>{children}</AppShell>;
}