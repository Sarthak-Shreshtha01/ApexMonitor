'use client';

import { ReactNode, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/features/auth/state/auth.store';
import { authService } from '@/features/auth/api/auth.service';

const PUBLIC_PATHS = ['/', '/login', '/register', '/verify-email', '/forgot-password', '/reset-password'];

export function RouteGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const accessToken = useAuthStore((state) => state.accessToken);
  const refreshToken = useAuthStore((state) => state.refreshToken);
  const setTokens = useAuthStore((state) => state.setTokens);
  const [isHydrated, setIsHydrated] = useState(() => {
    const storeWithPersist = useAuthStore as typeof useAuthStore & {
      persist?: {
        hasHydrated: () => boolean;
        onFinishHydration: (callback: () => void) => () => void;
      };
    };

    return storeWithPersist.persist ? storeWithPersist.persist.hasHydrated() : true;
  });

  useEffect(() => {
    const storeWithPersist = useAuthStore as typeof useAuthStore & {
      persist?: {
        hasHydrated: () => boolean;
        onFinishHydration: (callback: () => void) => () => void;
      };
    };

    const persistApi = storeWithPersist.persist;

    if (!persistApi) {
      return;
    }

    const unsubscribe = persistApi.onFinishHydration(() => setIsHydrated(true));

    return unsubscribe;
  }, []);

  const [isRestoringSession, setIsRestoringSession] = useState(false);

  useEffect(() => {
    if (!isHydrated) return;

    const isPublicPath = PUBLIC_PATHS.includes(pathname);
    if (isPublicPath) return;

    if (accessToken || !refreshToken) return;

    let cancelled = false;

    const restore = async () => {
      try {
        setIsRestoringSession(true);
        const refreshed = await authService.refresh();

        if (!cancelled) {
          setTokens({
            accessToken: refreshed.accessToken,
            refreshToken: refreshed.refreshToken,
          });
        }
      } catch {
        if (!cancelled) {
          // Keep user state intact; explicit logout should be the only destructive action.
        }
      } finally {
        if (!cancelled) {
          setIsRestoringSession(false);
        }
      }
    };

    void restore();

    return () => {
      cancelled = true;
    };
  }, [accessToken, isHydrated, pathname, refreshToken, setTokens]);

  useEffect(() => {
    if (!isHydrated) return;
    if (isRestoringSession) return;

    const isPublicPath = PUBLIC_PATHS.includes(pathname);

    if (!isPublicPath && !accessToken && !refreshToken) {
      router.replace('/login');
    }
  }, [accessToken, isHydrated, isRestoringSession, pathname, refreshToken, router]);

  if (!isHydrated || isRestoringSession) {
    return null;
  }

  if (!PUBLIC_PATHS.includes(pathname) && !accessToken && !refreshToken) {
    return null;
  }

  return <>{children}</>;
}
