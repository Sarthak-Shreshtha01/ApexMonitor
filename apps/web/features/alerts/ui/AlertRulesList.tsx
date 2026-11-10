'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BellRing, CheckCircle2, PauseCircle, Trash2 } from 'lucide-react';
import { AlertRule, alertsErrorMessage, alertsService, CONDITION_LABELS } from '../api/alerts.service';

function stateBadge(rule: AlertRule) {
  if (!rule.isActive) return { text: 'Paused', icon: PauseCircle, className: 'text-secondary bg-surface-container-high border-outline-variant/30' };
  if (rule.state === 'firing') return { text: 'Firing', icon: BellRing, className: 'text-error bg-error/10 border-error/30' };
  return { text: 'OK', icon: CheckCircle2, className: 'text-success bg-success/10 border-success/30' };
}

function describe(rule: AlertRule): string {
  const { label, unit } = CONDITION_LABELS[rule.conditionType];
  const scope = rule.endpointFilter ? ` on ${rule.endpointFilter}` : '';
  return `${label} > ${rule.threshold}${unit} over ${rule.windowMinutes} min${scope}`;
}

/** Rules of the active project with their current state; owners can pause, resume and delete. */
export function AlertRulesList({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient();
  const rulesQuery = useQuery({
    queryKey: ['alerts', 'rules', projectId],
    queryFn: () => alertsService.listRules(projectId),
    refetchInterval: 30_000, // state changes as the evaluator runs every minute
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['alerts'] });
  const toggle = useMutation({
    mutationFn: (rule: AlertRule) => alertsService.updateRule(projectId, rule.id, { isActive: !rule.isActive }),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: (rule: AlertRule) => alertsService.deleteRule(projectId, rule.id),
    onSuccess: refresh,
  });
  const actionError = toggle.error ?? remove.error;

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold tracking-tight text-white">Rules</h2>
      <div className="bg-surface-container-low rounded-2xl border border-outline-variant/10 divide-y divide-outline-variant/10">
        {rulesQuery.isLoading && <p className="p-6 text-sm text-secondary">Loading rules…</p>}
        {rulesQuery.isError && <p className="p-6 text-sm text-error">{alertsErrorMessage(rulesQuery.error)}</p>}
        {rulesQuery.data?.length === 0 && <p className="p-6 text-sm text-secondary">No alert rules yet. Create one below.</p>}
        {rulesQuery.data?.map((rule) => {
          const badge = stateBadge(rule);
          const Icon = badge.icon;
          const unit = CONDITION_LABELS[rule.conditionType].unit;
          return (
            <div key={rule.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
              <span className={`inline-flex items-center gap-1 self-start sm:self-auto px-2 py-1 rounded-md border text-[10px] font-bold uppercase tracking-wider ${badge.className}`}>
                <Icon className="w-3 h-3" /> {badge.text}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-white truncate">{rule.name}</p>
                <p className="text-xs text-secondary truncate">{describe(rule)}</p>
                <p className="text-[11px] text-secondary/80 mt-0.5">
                  {rule.lastEvaluatedAt
                    ? `Last check ${new Date(rule.lastEvaluatedAt).toLocaleTimeString()}: ${rule.lastValue === null ? 'no traffic' : `${rule.lastValue}${unit}`}`
                    : 'Not evaluated yet'}
                  {rule.notifyWebhook ? ' · webhook' : ''}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => toggle.mutate(rule)}
                  disabled={toggle.isPending}
                  className="text-xs font-bold px-3 py-1.5 rounded-md border border-outline-variant/20 bg-surface-container-high hover:bg-surface-container-highest disabled:opacity-50"
                >
                  {rule.isActive ? 'Pause' : 'Resume'}
                </button>
                <button
                  type="button"
                  aria-label={`Delete ${rule.name}`}
                  onClick={() => {
                    if (window.confirm(`Delete alert rule "${rule.name}"?`)) remove.mutate(rule);
                  }}
                  disabled={remove.isPending}
                  className="p-1.5 rounded-md border border-outline-variant/20 text-secondary hover:text-error hover:border-error/40 disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
      {actionError && <p className="text-xs text-error" role="alert">{alertsErrorMessage(actionError)}</p>}
    </div>
  );
}
