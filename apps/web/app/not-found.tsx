import Link from 'next/link';
import { ROUTES } from '@/shared/routes/routes';

export default function GlobalNotFound() {
  return (
    <main className="min-h-screen bg-app text-on-surface flex items-center justify-center p-6">
      <section className="w-full max-w-2xl rounded-2xl border border-outline-variant/20 bg-surface-container-low p-10 text-center">
        <p className="text-[11px] uppercase tracking-widest text-secondary mb-2">Route Not Found</p>
        <h1 className="text-5xl font-black tracking-tight text-white mb-3">404</h1>
        <p className="text-sm text-secondary mb-8">
          This page does not exist yet. Your session remains active.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link
            href={ROUTES.dashboard.overview}
            className="px-5 py-2.5 rounded-lg bg-primary text-on-primary text-xs font-bold uppercase tracking-widest"
          >
            Go to Overview
          </Link>
          <Link
            href={ROUTES.dashboard.traces}
            className="px-5 py-2.5 rounded-lg border border-outline-variant/30 text-xs font-bold uppercase tracking-widest text-secondary"
          >
            Open Traces
          </Link>
        </div>
      </section>
    </main>
  );
}
