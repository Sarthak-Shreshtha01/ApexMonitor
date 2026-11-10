'use client';

import { useQuery } from '@tanstack/react-query';
import { AlertCircle, CheckCircle2, History } from 'lucide-react';
import { alertsErrorMessage, alertsService } from '../api/alerts.service';

/** Latest triggered/resolved events of the active project's rules. */
export function TriggerHistory({ projectId }: { projectId: string }) {
  const eventsQuery = useQuery({
    queryKey: ['alerts', 'events', projectId],
    queryFn: () => alertsService.listEvents(projectId, 20),
    refetchInterval: 30_000,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <History className="text-tertiary w-5 h-5" />
        <h2 className="text-xl font-bold tracking-tight text-white">Trigger History</h2>
      </div>

      <div className="bg-surface-container-low rounded-2xl p-6 border border-outline-variant/10 max-h-[520px] overflow-y-auto">
        {eventsQuery.isLoading && <p className="text-sm text-secondary">Loading…</p>}
        {eventsQuery.isError && <p className="text-sm text-error">{alertsErrorMessage(eventsQuery.error)}</p>}
        {eventsQuery.data?.length === 0 && <p className="text-sm text-secondary">Nothing has fired yet.</p>}
        <ol className="space-y-6">
          {eventsQuery.data?.map((event, index, all) => {
            const triggered = event.kind === 'triggered';
            const Icon = triggered ? AlertCircle : CheckCircle2;
            return (
              <li key={event.id} className="flex gap-4 relative">
                {index < all.length - 1 && <div className="absolute left-[15px] top-8 w-[1px] h-[calc(100%-8px)] bg-outline-variant/30" />}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border ${triggered ? 'bg-error/10 border-error/30' : 'bg-success/10 border-success/30'}`}>
                  <Icon className={`w-4 h-4 ${triggered ? 'text-error' : 'text-success'}`} />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-2">
                    <p className="text-sm font-bold text-white">{event.ruleName ?? `Rule ${event.ruleId}`} {triggered ? 'fired' : 'resolved'}</p>
                    <time dateTime={event.at} className="text-[10px] text-secondary font-mono">{new Date(event.at).toLocaleString()}</time>
                  </div>
                  <p className="text-xs text-secondary mt-1 break-words">{event.message}</p>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
