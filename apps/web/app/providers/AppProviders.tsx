'use client';

import { Provider } from 'react-redux';
import { QueryProvider } from './QueryProvider';
import { RouteGate } from '@/shared/layout/RouteGate';
import { store } from '@/lib/redux/store';

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <Provider store={store}>
      <RouteGate>
        <QueryProvider>{children}</QueryProvider>
      </RouteGate>
    </Provider>
  );
}
