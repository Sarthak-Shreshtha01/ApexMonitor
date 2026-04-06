'use client';

import { ReactNode, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/features/auth/state/auth.store';

const PUBLIC_PATHS = ['/', '/login', '/register', '/verify-email', '/forgot-password', '/reset-password'];

export function RouteGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const accessToken = useAuthStore((state) => state.accessToken);
  const [isHydrated, setIsHydrated] = useState(() => useAuthStore.persist.hasHydrated());

  useEffect(() => {
    const unsubscribe = useAuthStore.persist.onFinishHydration(() => {
      setIsHydrated(true);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!isHydrated) return;

    const isPublicPath = PUBLIC_PATHS.includes(pathname);

    if (!isPublicPath && !accessToken) {
      router.replace('/login');
    }
  }, [accessToken, isHydrated, pathname, router]);

  if (!isHydrated) {
    return null;
  }

  if (!PUBLIC_PATHS.includes(pathname) && !accessToken) {
    return null;
  }

  return <>{children}</>;
}
