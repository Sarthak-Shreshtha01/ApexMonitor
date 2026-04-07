'use client';

import { FormEvent, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Copy, Search } from 'lucide-react';
import { useProjectStore } from '@/features/projects/state/project.store';
import { logsService, LogsQuery, LogItem, StatusClass } from '../api/logs.service';

const PAGE_SIZE = 25;

type DraftFilters = {
  method: '' | 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS';
  statusClass: '' | StatusClass;
  endpoint: string;
  search: string;
};

const EMPTY_FILTERS: DraftFilters = {
  method: '',
  statusClass: '',
  endpoint: '',
  search: '',
};

export function LogsExplorer() {
  const activeProjectId = useProjectStore((state) => state.activeProjectId);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftFilters>(EMPTY_FILTERS);
  const [applied, setApplied] = useState<DraftFilters>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);

  const queryParams: LogsQuery | null = useMemo(() => {
    if (!activeProjectId) return null;

    return {
      projectId: activeProjectId,
      method: applied.method || undefined,
      statusClass: applied.statusClass || undefined,
      endpoint: applied.endpoint || undefined,
      search: applied.search || undefined,
      page,
      limit: PAGE_SIZE,
    };
  }, [activeProjectId, applied, page]);

  const logsQuery = useQuery({
    queryKey: ['logs', queryParams],
    queryFn: () => logsService.list(queryParams as LogsQuery),
    enabled: !!queryParams,
  });

  const onApplyFilters = (event: FormEvent) => {
    event.preventDefault();
    setPage(1);
    setApplied(draft);
  };

  const logs = logsQuery.data?.logs ?? [];
  const total = logsQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const canPrev = page > 1;
  const canNext = page < totalPages;

  return (
    <div className="p-8 max-w-[1600px] mx-auto w-full space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-4xl font-extrabold tracking-tight text-white mb-1">Logs Explorer</h2>
          <p className="text-on-surface-variant text-sm font-medium">
            {activeProjectId ? `Monitoring project ${activeProjectId}` : 'Select a project to view logs.'}
          </p>
        </div>
        <div className="flex gap-4">
          <div className="bg-surface-container-low p-4 rounded-xl border border-outline-variant/10 min-w-[140px]">
            <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">Error Rate</p>
            <p className="text-2xl font-semibold text-error tracking-tight">{logsQuery.data?.summary.errorRate ?? 0}%</p>
          </div>
          <div className="bg-surface-container-low p-4 rounded-xl border border-outline-variant/10 min-w-[140px]">
            <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">Avg Latency</p>
            <p className="text-2xl font-semibold text-secondary tracking-tight">{logsQuery.data?.summary.avgLatency ?? 0}ms</p>
          </div>
        </div>
      </div>

      <form onSubmit={onApplyFilters} className="bg-surface-container rounded-2xl p-2 flex flex-wrap items-center gap-2 border border-outline-variant/5">
        <div className="flex items-center bg-surface-container-highest rounded-lg px-3 py-2 gap-2 text-xs font-medium border border-outline-variant/20">
          <span className="text-slate-500">Method:</span>
          <select
            value={draft.method}
            onChange={(e) => setDraft((prev) => ({ ...prev, method: e.target.value as DraftFilters['method'] }))}
            className="bg-transparent border-none p-0 text-indigo-300 focus:ring-0 text-xs font-bold cursor-pointer outline-none"
          >
            <option value="">ALL</option>
            <option value="GET">GET</option>
            <option value="POST">POST</option>
            <option value="PUT">PUT</option>
            <option value="PATCH">PATCH</option>
            <option value="DELETE">DELETE</option>
            <option value="OPTIONS">OPTIONS</option>
          </select>
        </div>

        <div className="flex items-center bg-surface-container-highest rounded-lg px-3 py-2 gap-2 text-xs font-medium border border-outline-variant/20">
          <span className="text-slate-500">Status:</span>
          <select
            value={draft.statusClass}
            onChange={(e) => setDraft((prev) => ({ ...prev, statusClass: e.target.value as DraftFilters['statusClass'] }))}
            className="bg-transparent border-none p-0 text-secondary focus:ring-0 text-xs font-bold cursor-pointer outline-none"
          >
            <option value="">ANY</option>
            <option value="2xx">2xx</option>
            <option value="3xx">3xx</option>
            <option value="4xx">4xx</option>
            <option value="5xx">5xx</option>
          </select>
        </div>

        <div className="flex items-center bg-surface-container-highest rounded-lg px-3 py-2 gap-2 text-xs font-medium border border-outline-variant/20 min-w-[220px]">
          <span className="text-slate-500">Endpoint:</span>
          <input
            value={draft.endpoint}
            onChange={(e) => setDraft((prev) => ({ ...prev, endpoint: e.target.value }))}
            placeholder="/api/v1/users"
            className="bg-transparent border-none p-0 text-indigo-300 focus:ring-0 text-xs font-bold outline-none w-full"
          />
        </div>

        <div className="flex-1 min-w-[200px] flex items-center bg-surface-container-lowest rounded-lg px-3 py-2 border border-outline-variant/20">
          <Search className="text-slate-500 w-4 h-4 mr-2" />
          <input
            value={draft.search}
            onChange={(e) => setDraft((prev) => ({ ...prev, search: e.target.value }))}
            type="text"
            className="bg-transparent border-none p-0 text-xs w-full focus:ring-0 text-on-surface outline-none placeholder:text-outline-variant"
            placeholder="Search endpoint, IP, user-agent"
          />
        </div>

        <button type="submit" className="bg-primary text-on-primary font-bold px-4 py-2 rounded-lg text-xs hover:shadow-[0_0_20px_rgba(192,193,255,0.4)] transition-all">
          Apply Filters
        </button>
      </form>

      <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/15 overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead>
              <tr className="bg-surface-container-low border-b border-outline-variant/10">
                {['Status', 'Method', 'Path', 'Duration', 'Timestamp', 'Action'].map((header) => (
                  <th key={header} className={`px-6 py-4 text-[10px] uppercase tracking-widest font-bold text-slate-500 ${header === 'Action' ? 'text-right' : ''}`}>
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/5">
              {logsQuery.isLoading ? (
                <tr>
                  <td className="px-6 py-8 text-sm text-slate-400" colSpan={6}>Loading logs...</td>
                </tr>
              ) : logsQuery.isError ? (
                <tr>
                  <td className="px-6 py-8 text-sm text-error" colSpan={6}>Failed to load logs.</td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td className="px-6 py-8 text-sm text-slate-400" colSpan={6}>No logs found for the current filters.</td>
                </tr>
              ) : (
                logs.map((log) => (
                  <LogRow
                    key={log.reqId}
                    log={log}
                    expanded={expandedId === log.reqId}
                    onToggle={() => setExpandedId((prev) => (prev === log.reqId ? null : log.reqId))}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="bg-surface-container-low px-6 py-4 flex items-center justify-between border-t border-outline-variant/10">
          <p className="text-xs text-slate-500">Showing {logs.length} of {total} logs</p>
          <div className="flex gap-2 items-center">
            <button
              disabled={!canPrev}
              onClick={() => canPrev && setPage((prev) => prev - 1)}
              className="px-3 py-1.5 rounded-lg bg-surface-container-lowest border border-outline-variant/20 text-xs font-bold hover:bg-surface-container-high transition-colors disabled:opacity-40"
            >
              Previous
            </button>
            <span className="text-xs text-slate-400">Page {page} / {totalPages}</span>
            <button
              disabled={!canNext}
              onClick={() => canNext && setPage((prev) => prev + 1)}
              className="px-3 py-1.5 rounded-lg bg-surface-container-lowest border border-outline-variant/20 text-xs font-bold hover:bg-surface-container-high transition-colors disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function LogRow({
  log,
  expanded,
  onToggle,
}: {
  log: LogItem;
  expanded: boolean;
  onToggle: () => void;
}) {
  const statusTone =
    log.statusCode >= 500
      ? 'bg-error/10 text-error border-error/20'
      : log.statusCode >= 400
        ? 'bg-tertiary/10 text-tertiary border-tertiary/20'
        : 'bg-secondary/10 text-secondary border-secondary/20';

  const methodTone =
    log.method === 'GET'
      ? 'text-secondary'
      : log.method === 'POST'
        ? 'text-indigo-300'
        : 'text-slate-300';

  const formattedTime = new Date(log.timestamp).toLocaleString();

  return (
    <>
      <tr onClick={onToggle} className="group hover:bg-surface-container-high/50 cursor-pointer transition-colors">
        <td className="px-6 py-4">
          <span className={`px-2 py-1 rounded text-[10px] font-bold border ${statusTone}`}>{log.statusCode}</span>
        </td>
        <td className={`px-6 py-4 font-mono text-xs ${methodTone}`}>{log.method}</td>
        <td className="px-6 py-4 font-mono text-xs text-on-surface truncate max-w-xs">{log.endpoint}</td>
        <td className="px-6 py-4 text-xs font-medium text-slate-400">{log.latencyMs}ms</td>
        <td className="px-6 py-4 text-xs text-slate-500">{formattedTime}</td>
        <td className="px-6 py-4 text-right text-xs text-indigo-300">{expanded ? 'Hide' : 'Details'}</td>
      </tr>
      {expanded ? (
        <tr className="bg-surface-container-high/30">
          <td colSpan={6} className="px-8 py-6">
            <div className="bg-surface-container-lowest rounded-xl p-6 border border-outline-variant/20 font-mono text-xs leading-relaxed overflow-x-auto">
              <div className="flex justify-between items-start mb-4 border-b border-outline-variant/10 pb-4">
                <div className="flex gap-8">
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] uppercase text-slate-600 font-bold">Request ID</span>
                    <span className="text-indigo-200">{log.reqId}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] uppercase text-slate-600 font-bold">IP Address</span>
                    <span className="text-slate-400">{log.ip}</span>
                  </div>
                </div>
                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    const payload = JSON.stringify(log, null, 2);
                    navigator.clipboard.writeText(payload).catch(() => undefined);
                  }}
                  className="text-indigo-400 hover:text-indigo-200 flex items-center gap-1.5 transition-colors focus:outline-none"
                >
                  <Copy className="w-4 h-4" /> Copy JSON
                </button>
              </div>
              <pre className="text-secondary/90">{JSON.stringify(log, null, 2)}</pre>
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}
