import Link from 'next/link';
import { ROUTES } from '@/shared/routes/routes';

export default function DashboardNotFound() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center p-8">
      <div className="max-w-xl w-full bg-surface-container-low border border-outline-variant/20 rounded-2xl p-10 text-center">
        <p className="text-[11px] uppercase tracking-widest text-secondary mb-2">Dashboard Route Error</p>
        <h1 className="text-4xl font-black tracking-tight text-white mb-3">404</h1>
        <p className="text-sm text-secondary mb-8">
          The page you requested does not exist in the dashboard workspace.
        </p>
        <div className="flex gap-3 justify-center">
          <Link href={ROUTES.dashboard.overview} className="px-5 py-2.5 rounded-lg bg-primary text-on-primary text-xs font-bold uppercase tracking-widest">
            Go To Overview
          </Link>
          <Link href={ROUTES.dashboard.traces} className="px-5 py-2.5 rounded-lg border border-outline-variant/30 text-xs font-bold uppercase tracking-widest text-secondary">
            Open Traces
          </Link>
        </div>
      </div>
    </div>
  );
}
