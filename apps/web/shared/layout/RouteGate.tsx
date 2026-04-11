'use client';

import { ReactNode, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { authService } from '@/features/auth/api/auth.service';
import { useAppDispatch, useAppSelector } from '@/lib/redux/hooks';
import { setTokens } from '@/features/auth/state/auth.slice';
import { PUBLIC_PATHS, ROUTES } from '@/shared/routes/routes';

const isPublicPath = (path: string) => (PUBLIC_PATHS as readonly string[]).includes(path);

export function RouteGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const accessToken = useAppSelector((state) => state.auth.accessToken);
  const refreshToken = useAppSelector((state) => state.auth.refreshToken);
  const [isHydrated] = useState(true);

  const [isRestoringSession, setIsRestoringSession] = useState(false);

  useEffect(() => {
    if (!isHydrated) return;

    if (isPublicPath(pathname)) return;

    if (accessToken || !refreshToken) return;

    let cancelled = false;

    const restore = async () => {
      try {
        setIsRestoringSession(true);
        const refreshed = await authService.refresh();

        if (!cancelled) {
          dispatch(setTokens({
            accessToken: refreshed.accessToken,
            refreshToken: refreshed.refreshToken,
          }));
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
  }, [accessToken, dispatch, isHydrated, pathname, refreshToken]);

  useEffect(() => {
    if (!isHydrated) return;
    if (isRestoringSession) return;

    const isCurrentPathPublic = isPublicPath(pathname);

    if (!isCurrentPathPublic && !accessToken && !refreshToken) {
      router.replace(ROUTES.auth.login);
    }
  }, [accessToken, isHydrated, isRestoringSession, pathname, refreshToken, router]);

  if (!isHydrated || isRestoringSession) {
    return null;
  }

  if (!isPublicPath(pathname) && !accessToken && !refreshToken) {
    return null;
  }

  return <>{children}</>;
}
