'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30000, // 30s as per SRS [cite: 960]
            gcTime: 300000,   // 5m cache retention [cite: 963]
            retry: 2,         // [cite: 966]
            refetchOnWindowFocus: true, // [cite: 967]
          },
        },
      })
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}