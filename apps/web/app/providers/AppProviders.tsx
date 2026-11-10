'use client';

import { QueryProvider } from './QueryProvider';
import { RouteGate } from '@/shared/layout/RouteGate';

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <RouteGate>
      <QueryProvider>{children}</QueryProvider>
    </RouteGate>
  );
}
