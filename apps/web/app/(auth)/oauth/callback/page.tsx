'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAppDispatch } from '@/lib/redux/hooks';
import { setTokens } from '@/features/auth/state/auth.slice';
import { projectsService } from '@/features/projects/api/projects.service';
import { useProjectStore } from '@/features/projects/state/project.store';
import { ROUTES } from '@/shared/routes/routes';

export default function OAuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dispatch = useAppDispatch();
  const setProjects = useProjectStore((s) => s.setProjects);

  useEffect(() => {
    let cancelled = false;

    const completeOAuth = async () => {
      const accessToken = searchParams.get('accessToken');
      const refreshToken = searchParams.get('refreshToken');

      if (!accessToken || !refreshToken) {
        router.replace(ROUTES.auth.login);
        return;
      }

      dispatch(setTokens({ accessToken, refreshToken }));

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
