'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useProjectStore } from '@/features/projects/state/project.store';
import { tracesService } from '@/features/traces/api/traces.service';

export default function TraceDetailView() {
  const params = useParams<{ id: string }>();
  const traceId = params?.id;
  const activeProjectId = useProjectStore((state) => state.activeProjectId);

  const traceQuery = useQuery({
    queryKey: ['traceDetail', traceId, activeProjectId],
    queryFn: () => tracesService.detail(traceId as string, activeProjectId as string),
    enabled: Boolean(traceId && activeProjectId),
  });

  if (!activeProjectId) {
    return <div className="p-8 text-secondary">Select a project to view a trace.</div>;
  }

  if (traceQuery.isLoading) {
    return <div className="p-8 text-secondary">Loading trace details...</div>;
  }

  if (traceQuery.isError || !traceQuery.data) {
    return (
      <div className="p-8">
        <div className="max-w-xl bg-surface-container-low border border-outline-variant/20 rounded-2xl p-6">
          <h1 className="text-2xl font-bold text-white mb-2">Trace Not Found</h1>
          <p className="text-sm text-secondary mb-4">This trace is unavailable or does not belong to your project.</p>
          <Link href="/traces" className="text-primary text-sm font-bold hover:underline">Back to Traces</Link>
        </div>
      </div>
    );
  }

  const trace = traceQuery.data;
  const maxDuration = Math.max(...trace.spans.map((span) => span.startOffsetMs + span.durationMs), trace.latencyMs);

  return (
    <div className="p-8 space-y-6">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[11px] uppercase tracking-widest text-secondary">Trace ID</p>
          <h1 className="text-3xl font-black text-white font-mono tracking-tight">{trace.traceId}</h1>
          <p className="text-sm text-secondary mt-2">{trace.method} {trace.endpoint}</p>
        </div>
        <div className="text-right">
          <p className="text-4xl font-black text-primary font-mono">{trace.latencyMs}ms</p>
          <p className="text-[10px] uppercase tracking-widest text-secondary">Total Duration</p>
        </div>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <section className="xl:col-span-8 bg-surface-container-lowest border border-outline-variant/15 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-outline-variant/10 text-xs text-secondary">
            Captured {new Date(trace.timestamp).toLocaleString()} • {trace.region} • {trace.ip}
          </div>
          <div className="divide-y divide-outline-variant/10">
            {trace.spans.map((span) => {
              const left = (span.startOffsetMs / maxDuration) * 100;
              const width = (span.durationMs / maxDuration) * 100;

              return (
                <div key={span.spanId} className="grid grid-cols-[260px_1fr] min-h-[58px] items-center">
                  <div className="px-5 py-3 border-r border-outline-variant/10">
                    <p className="text-xs font-semibold text-white truncate">{span.name}</p>
                    <p className="text-[11px] font-mono text-secondary truncate">{span.service}</p>
                  </div>
                  <div className="relative px-5 py-3">
                    <div
                      className="h-3 rounded bg-primary/30 border border-primary/50"
                      style={{ marginLeft: `${left}%`, width: `${Math.max(width, 1.5)}%` }}
                    />
                    <span className="absolute top-0 text-[10px] font-mono text-secondary" style={{ left: `calc(${left}% + 1.25rem)` }}>
                      {span.durationMs}ms
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <aside className="xl:col-span-4 bg-surface-container-lowest border border-outline-variant/15 rounded-2xl p-5 space-y-5">
          <div>
            <h2 className="text-xs uppercase tracking-widest text-secondary mb-2">Metadata</h2>
            <div className="space-y-2 text-xs">
              <p><span className="text-secondary">Status:</span> <span className="text-white font-semibold">{trace.statusCode}</span></p>
              <p><span className="text-secondary">SDK:</span> <span className="text-white font-semibold">{trace.sdkVersion}</span></p>
              <p><span className="text-secondary">User Agent:</span> <span className="text-white font-mono break-all">{trace.userAgent || 'unknown'}</span></p>
            </div>
          </div>
          <div>
            <h2 className="text-xs uppercase tracking-widest text-secondary mb-2">Tags</h2>
            <div className="flex flex-wrap gap-2">
              {trace.tags.length === 0 ? (
                <span className="text-xs text-secondary">No tags</span>
              ) : (
                trace.tags.map((tag) => (
                  <span key={tag} className="px-2 py-1 text-[10px] rounded bg-surface-container border border-outline-variant/20 text-secondary">{tag}</span>
                ))
              )}
            </div>
          </div>
          <Link href="/traces" className="inline-block text-xs font-bold text-primary hover:underline">Back to Trace Explorer</Link>
        </aside>
      </div>
    </div>
  );
}