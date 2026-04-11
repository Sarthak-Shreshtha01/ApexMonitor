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
    <div className="p-8 max-w-[1500px] mx-auto space-y-6">
      <header className="flex items-end justify-between gap-6 flex-wrap">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-white">Trace Explorer</h1>
          <p className="text-sm text-secondary mt-1">
            {activeProjectId ? `Trace timeline for ${activeProjectId}` : 'Select a project to view traces.'}
          </p>
        </div>
        <div className="bg-surface-container-low border border-outline-variant/20 rounded-xl px-4 py-3">
          <p className="text-[10px] uppercase tracking-widest text-secondary">Total Traces</p>
          <p className="text-2xl font-bold text-primary">{total}</p>
        </div>
      </header>

      <form onSubmit={onApply} className="flex flex-wrap gap-3 bg-surface-container p-3 rounded-xl border border-outline-variant/20">
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
          className="flex-1 min-w-[220px] bg-surface-container-high border border-outline-variant/20 rounded-lg px-3 py-2 text-xs text-white"
        />
        <button
          type="submit"
          className="bg-primary text-on-primary px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider"
        >
          Search
        </button>
      </form>

      <div className="bg-surface-container-lowest border border-outline-variant/15 rounded-2xl overflow-hidden">
        <table className="w-full min-w-[900px]">
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
        <div className="px-5 py-4 border-t border-outline-variant/10 flex justify-between items-center">
          <span className="text-xs text-secondary">Page {page} of {totalPages}</span>
          <div className="flex gap-2">
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
