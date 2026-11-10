'use client';

import { ReactNode, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAppSelector } from '@/lib/redux/hooks';
import { refreshAccessToken } from '@/shared/api/apiClient';
import { PUBLIC_PATHS, ROUTES } from '@/shared/routes/routes';

const isPublicPath = (path: string) => (PUBLIC_PATHS as readonly string[]).includes(path);

/**
 * Protects dashboard pages. Tokens are kept in memory only, so after a page load the
 * session is `unknown`: the gate asks the API for a fresh access token using the httpOnly
 * refresh cookie, then either renders the page or sends the user to /login.
 */
export function RouteGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const status = useAppSelector((state) => state.auth.status);
  const isPublic = isPublicPath(pathname);

  useEffect(() => {
    if (isPublic || status !== 'unknown') return;
    // Success stores the token; failure marks the session anonymous (both via the store).
    refreshAccessToken().catch(() => undefined);
  }, [isPublic, status]);

  useEffect(() => {
    if (!isPublic && status === 'anonymous') {
      router.replace(ROUTES.auth.login);
    }
  }, [isPublic, router, status]);

  if (!isPublic && status !== 'authenticated') {
    return null;
  }

  return <>{children}</>;
}
