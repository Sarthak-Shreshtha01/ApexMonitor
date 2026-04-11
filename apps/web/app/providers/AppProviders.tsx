'use client';

import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { QueryProvider } from './QueryProvider';
import { RouteGate } from '@/shared/layout/RouteGate';
import { persistor, store } from '@/lib/redux/store';

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <RouteGate>
          <QueryProvider>{children}</QueryProvider>
        </RouteGate>
      </PersistGate>
    </Provider>
  );
}
