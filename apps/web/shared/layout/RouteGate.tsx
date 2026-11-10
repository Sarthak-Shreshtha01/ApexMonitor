'use client';

import { ReactNode, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/features/auth/state/auth.store';
import { refreshAccessToken } from '@/shared/api/apiClient';
import { isPublicPath, loginUrlFor } from '@/shared/routes/session-gate';

/**
 * Protects dashboard pages. Tokens are kept in memory only, so after a page load the
 * session is `unknown`: the gate asks the API for a fresh access token using the httpOnly
 * refresh cookie, then either renders the page or sends the user to /login.
 */
export function RouteGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const status = useAuthStore((state) => state.status);
  const isPublic = isPublicPath(pathname);

  useEffect(() => {
    if (isPublic || status !== 'unknown') return;
    // Success stores the token; failure marks the session anonymous (both via the store).
    refreshAccessToken().catch(() => undefined);
  }, [isPublic, status]);

  useEffect(() => {
    if (!isPublic && status === 'anonymous') {
      router.replace(loginUrlFor(pathname, window.location.search));
    }
  }, [isPublic, pathname, router, status]);

  if (!isPublic && status !== 'authenticated') {
    return null;
  }

  return <>{children}</>;
}
