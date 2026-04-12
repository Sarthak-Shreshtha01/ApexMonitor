'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { io } from 'socket.io-client';
import { useProjectStore } from '@/features/projects/state/project.store';
import { useDashboardStore } from '@/features/dashboard/state/dashboard.store';
import { tracesService, TracesQuery } from '@/features/traces/api/traces.service';
import { ROUTES } from '@/shared/routes/routes';

const PAGE_SIZE = 20;

export function TracesExplorer() {
  const activeProjectId = useProjectStore((state) => state.activeProjectId);
  const timeframe = useDashboardStore((state) => state.timeframe);
  const [page, setPage] = useState(1);
  const [statusClass, setStatusClass] = useState<'' | '2xx' | '3xx' | '4xx' | '5xx'>('');
  const [searchDraft, setSearchDraft] = useState('');
  const [search, setSearch] = useState('');

  const queryParams: TracesQuery | null = useMemo(() => {
    if (!activeProjectId) return null;

    const range = getTimeRange(timeframe);

    return {
      projectId: activeProjectId,
      page,
      limit: PAGE_SIZE,
      statusClass: statusClass || undefined,
      search: search || undefined,
      from: range.from,
      to: range.to,
    };
  }, [activeProjectId, page, search, statusClass, timeframe]);

  const tracesQuery = useQuery({
    queryKey: ['traces', queryParams],
    queryFn: () => tracesService.list(queryParams as TracesQuery),
    enabled: !!queryParams,
    refetchInterval: 12000,
  });

  useEffect(() => {
    if (!activeProjectId) return;

    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3000';

    const socket = io(wsUrl, { transports: ['websocket'], withCredentials: true });
    socket.on('connect', () => socket.emit('join', { projectId: activeProjectId }));
    socket.on('pulse:live', (payload: { projectId: string }) => {
      if (payload.projectId === activeProjectId) {
        void tracesQuery.refetch();
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [activeProjectId, tracesQuery.refetch]);

  const traces = tracesQuery.data?.traces ?? [];
  const total = tracesQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const onApply = (event: FormEvent) => {
    event.preventDefault();
    setPage(1);
    setSearch(searchDraft.trim());
  };

  return (
    <div className="w-full min-w-0 p-4 sm:p-6 lg:p-8 space-y-5 sm:space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 sm:gap-6">
        <div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-white">Trace Explorer</h1>
          <p className="text-sm text-secondary mt-1">
            {activeProjectId ? `Trace timeline for ${activeProjectId}` : 'Select a project to view traces.'}
          </p>
        </div>
        <div className="bg-surface-container-low border border-outline-variant/20 rounded-xl px-4 py-3 w-fit">
          <p className="text-[10px] uppercase tracking-widest text-secondary">Total Traces</p>
          <p className="text-2xl font-bold text-primary">{total}</p>
        </div>
      </header>

      <form onSubmit={onApply} className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-[auto_auto_1fr_auto] gap-3 bg-surface-container p-3 rounded-xl border border-outline-variant/20">
        <select
          value={statusClass}
          onChange={(e) => {
            setStatusClass(e.target.value as '' | '2xx' | '3xx' | '4xx' | '5xx');
            setPage(1);
          }}
          className="bg-surface-container-high border border-outline-variant/20 rounded-lg px-3 py-2 text-xs font-semibold text-white"
        >
          <option value="">Any status</option>
          <option value="2xx">2xx</option>
          <option value="3xx">3xx</option>
          <option value="4xx">4xx</option>
          <option value="5xx">5xx</option>
        </select>
        <input
          value={searchDraft}
          onChange={(e) => setSearchDraft(e.target.value)}
          placeholder="Search trace id, endpoint, IP"
          className="min-w-0 bg-surface-container-high border border-outline-variant/20 rounded-lg px-3 py-2 text-xs text-white sm:col-span-2 xl:col-span-1"
        />
        <button
          type="submit"
          className="bg-primary text-on-primary px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider"
        >
          Search
        </button>
      </form>

      <div className="bg-surface-container-lowest border border-outline-variant/15 rounded-2xl overflow-hidden">
        <div className="md:hidden divide-y divide-outline-variant/10">
          {tracesQuery.isLoading ? (
            <div className="px-4 py-8 text-secondary text-sm">Loading traces...</div>
          ) : tracesQuery.isError ? (
            <div className="px-4 py-8 text-error text-sm">Failed to load traces.</div>
          ) : traces.length === 0 ? (
            <div className="px-4 py-8 text-secondary text-sm">No traces found.</div>
          ) : (
            traces.map((trace) => (
              <article key={trace.traceId} className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <p className="text-[10px] uppercase tracking-widest text-secondary">Trace ID</p>
                    <p className="text-xs font-mono text-primary wrap-break-word">{trace.traceId}</p>
                  </div>
                  <Link href={ROUTES.dashboard.traceDetail(trace.traceId)} className="text-xs font-bold text-primary hover:underline shrink-0">
                    View
                  </Link>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-secondary mb-1">Route</p>
                    <p className="text-white wrap-break-word">{trace.endpoint}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-secondary mb-1">Status / Latency</p>
                    <p className="text-secondary">{trace.statusCode} • {trace.latencyMs}ms</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-secondary mb-1">Method</p>
                    <p className="text-secondary">{trace.method}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-secondary mb-1">Timestamp</p>
                    <p className="text-secondary">{new Date(trace.timestamp).toLocaleString()}</p>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>

        <table className="hidden md:table w-full min-w-195 lg:min-w-225">
          <thead className="bg-surface-container-low border-b border-outline-variant/15">
            <tr>
              {['Trace ID', 'Route', 'Method', 'Status', 'Latency', 'Timestamp', 'Action'].map((label) => (
                <th key={label} className={`px-5 py-4 text-[10px] uppercase tracking-widest text-secondary text-left ${label === 'Action' ? 'text-right' : ''}`}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tracesQuery.isLoading ? (
              <tr><td className="px-5 py-8 text-secondary" colSpan={7}>Loading traces...</td></tr>
            ) : tracesQuery.isError ? (
              <tr><td className="px-5 py-8 text-error" colSpan={7}>Failed to load traces.</td></tr>
            ) : traces.length === 0 ? (
              <tr><td className="px-5 py-8 text-secondary" colSpan={7}>No traces found.</td></tr>
            ) : (
              traces.map((trace) => (
                <tr key={trace.traceId} className="border-t border-outline-variant/10 hover:bg-surface-container-high/40">
                  <td className="px-5 py-4 text-xs font-mono text-primary">{trace.traceId}</td>
                  <td className="px-5 py-4 text-xs text-white">{trace.endpoint}</td>
                  <td className="px-5 py-4 text-xs text-secondary">{trace.method}</td>
                  <td className="px-5 py-4 text-xs text-secondary">{trace.statusCode}</td>
                  <td className="px-5 py-4 text-xs text-secondary">{trace.latencyMs}ms</td>
                  <td className="px-5 py-4 text-xs text-secondary">{new Date(trace.timestamp).toLocaleString()}</td>
                  <td className="px-5 py-4 text-right">
                    <Link href={ROUTES.dashboard.traceDetail(trace.traceId)} className="text-xs font-bold text-primary hover:underline">
                      View Trace
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <div className="px-4 sm:px-5 py-4 border-t border-outline-variant/10 flex flex-col sm:flex-row gap-3 sm:justify-between sm:items-center">
          <span className="text-xs text-secondary">Page {page} of {totalPages}</span>
          <div className="flex gap-2 self-end sm:self-auto">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 text-xs border border-outline-variant/20 rounded disabled:opacity-40"
            >Previous</button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1.5 text-xs border border-outline-variant/20 rounded disabled:opacity-40"
            >Next</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function getTimeRange(timeframe: '1h' | '6h' | '24h' | '7d') {
  const now = new Date();
  const from = new Date(now);

  if (timeframe === '1h') from.setHours(from.getHours() - 1);
  if (timeframe === '6h') from.setHours(from.getHours() - 6);
  if (timeframe === '24h') from.setHours(from.getHours() - 24);
  if (timeframe === '7d') from.setDate(from.getDate() - 7);

  return {
    from: from.toISOString(),
    to: now.toISOString(),
  };
}
