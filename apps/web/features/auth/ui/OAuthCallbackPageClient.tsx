'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAppDispatch } from '@/lib/redux/hooks';
import { setAccessToken } from '@/features/auth/state/auth.slice';
import { authService } from '@/features/auth/api/auth.service';
import { projectsService } from '@/features/projects/api/projects.service';
import { useProjectStore } from '@/features/projects/state/project.store';
import { ROUTES } from '@/shared/routes/routes';

/**
 * Login codes are single-use, but React may run the effect twice (StrictMode, remounts).
 * Every run for the same code shares one exchange request.
 */
const exchanges = new Map<string, ReturnType<typeof authService.exchangeOAuthCode>>();
function exchangeOnce(code: string) {
  let pending = exchanges.get(code);
  if (!pending) {
    pending = authService.exchangeOAuthCode(code);
    exchanges.set(code, pending);
  }
  return pending;
}

export function OAuthCallbackPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dispatch = useAppDispatch();
  const setProjects = useProjectStore((s) => s.setProjects);

  useEffect(() => {
    let cancelled = false;

    const completeOAuth = async () => {
      // The API redirects here with a single-use code, never with tokens (KI-4).
      const code = searchParams.get('code');
      if (!code) {
        router.replace(ROUTES.auth.login);
        return;
      }

      try {
        const tokens = await exchangeOnce(code);
        if (cancelled) return;
        dispatch(setAccessToken(tokens.accessToken)); // refresh token is the httpOnly cookie
      } catch {
        // Expired or already used (e.g. the page was reloaded): start the sign-in again.
        if (!cancelled) router.replace(ROUTES.auth.login);
        return;
      }

      try {
        const projects = await projectsService.listMine();
        if (!cancelled) {
          setProjects(projects);
          router.replace(ROUTES.dashboard.overview);
        }
      } catch {
        if (!cancelled) {
          router.replace(ROUTES.dashboard.overview);
        }
      }
    };

    void completeOAuth();

    return () => {
      cancelled = true;
    };
  }, [dispatch, router, searchParams, setProjects]);

  return (
    <main className="min-h-screen bg-app text-on-surface flex items-center justify-center p-6">
      <section className="w-full max-w-md rounded-2xl border border-outline-variant/30 bg-surface-container-low p-8 text-center">
        <h1 className="text-xl font-bold tracking-tight mb-2">Finalizing Sign In</h1>
        <p className="text-sm text-on-surface-variant">Please wait while we connect your account.</p>
      </section>
    </main>
  );
}
