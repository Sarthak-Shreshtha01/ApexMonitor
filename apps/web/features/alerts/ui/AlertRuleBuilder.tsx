'use client';

import { FormEvent, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Sliders, Webhook } from 'lucide-react';
import { AlertCondition, alertsErrorMessage, alertsService, CONDITION_LABELS } from '../api/alerts.service';

const WINDOWS = [1, 5, 15, 30, 60];
const DEFAULT_THRESHOLD: Record<AlertCondition, string> = { error_rate_high: '5', latency_p99_high: '800' };

const field = 'bg-surface-container-lowest border border-outline-variant/20 rounded-xl p-3 text-sm font-medium w-full outline-none focus:border-secondary/60';
const label = 'text-[10px] font-bold uppercase tracking-[0.1em] text-secondary';

/** Creates an alert rule for the active project (owners only; the API enforces it). */
export function AlertRuleBuilder({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [conditionType, setConditionType] = useState<AlertCondition>('error_rate_high');
  const [threshold, setThreshold] = useState(DEFAULT_THRESHOLD.error_rate_high);
  const [windowMinutes, setWindowMinutes] = useState(5);
  const [endpointFilter, setEndpointFilter] = useState('');
  const [notifyWebhook, setNotifyWebhook] = useState('');
  const [saved, setSaved] = useState(false);

  const create = useMutation({
    mutationFn: alertsService.createRule,
    onSuccess: async () => {
      setName('');
      setEndpointFilter('');
      setSaved(true);
      await queryClient.invalidateQueries({ queryKey: ['alerts', 'rules', projectId] });
    },
  });

  const unit = CONDITION_LABELS[conditionType].unit;
  const thresholdNumber = Number(threshold);
  const thresholdValid = Number.isFinite(thresholdNumber) && thresholdNumber > 0 && (conditionType !== 'error_rate_high' || thresholdNumber <= 100);
  const canSave = name.trim().length > 0 && thresholdValid && !create.isPending;

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!canSave) return;
    setSaved(false);
    create.mutate({
      projectId,
      name: name.trim(),
      conditionType,
      threshold: thresholdNumber,
      windowMinutes,
      endpointFilter: endpointFilter.trim() || null,
      notifyWebhook: notifyWebhook.trim() || null,
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Sliders className="text-secondary w-5 h-5" />
        <h2 className="text-xl font-bold tracking-tight text-white">Alert Rule Builder</h2>
      </div>

      <form onSubmit={onSubmit} className="bg-surface-container-low rounded-2xl p-6 sm:p-8 border border-outline-variant/10 space-y-6">
        <div className="space-y-2">
          <label htmlFor="alert-name" className={label}>Name</label>
          <input id="alert-name" className={field} value={name} maxLength={100} placeholder="Checkout errors" onChange={(e) => setName(e.target.value)} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2">
            <label htmlFor="alert-metric" className={label}>Metric</label>
            <select
              id="alert-metric"
              className={field}
              value={conditionType}
              onChange={(e) => {
                const next = e.target.value as AlertCondition;
                setConditionType(next);
                setThreshold(DEFAULT_THRESHOLD[next]);
              }}
            >
              <option value="error_rate_high">Error rate (status ≥ 400)</option>
              <option value="latency_p99_high">p99 latency</option>
            </select>
          </div>
          <div className="space-y-2">
            <label htmlFor="alert-threshold" className={label}>Fires when above</label>
            <div className={`${field} flex items-center gap-2`}>
              <input
                id="alert-threshold"
                inputMode="decimal"
                className="bg-transparent border-none p-0 text-sm font-bold text-secondary focus:ring-0 w-full outline-none"
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
                aria-invalid={!thresholdValid}
              />
              <span className="text-secondary text-xs">{unit}</span>
            </div>
          </div>
          <div className="space-y-2">
            <label htmlFor="alert-window" className={label}>Over the last</label>
            <select id="alert-window" className={field} value={windowMinutes} onChange={(e) => setWindowMinutes(Number(e.target.value))}>
              {WINDOWS.map((m) => (
                <option key={m} value={m}>{m === 60 ? '1 hour' : `${m} min`}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label htmlFor="alert-endpoint" className={label}>Endpoint (optional)</label>
            <input id="alert-endpoint" className={`${field} font-mono`} value={endpointFilter} placeholder="/orders/:id — all endpoints if empty" onChange={(e) => setEndpointFilter(e.target.value)} />
          </div>
          <div className="space-y-2">
            <label htmlFor="alert-webhook" className={`${label} flex items-center gap-1`}><Webhook className="w-3 h-3" /> Webhook (optional)</label>
            <input id="alert-webhook" type="url" className={`${field} font-mono`} value={notifyWebhook} placeholder="https://hooks.slack.com/services/…" onChange={(e) => setNotifyWebhook(e.target.value)} />
          </div>
        </div>

        <p className="text-xs text-secondary">
          The rule notifies once when it starts firing and once when it recovers. Webhooks must be public <span className="font-mono">https://</span> URLs.
        </p>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between pt-4 border-t border-outline-variant/10 gap-4">
          <div className="text-xs min-h-4" role="status" aria-live="polite">
            {create.isError && <span className="text-error">{alertsErrorMessage(create.error)}</span>}
            {saved && !create.isError && <span className="text-success">Rule saved.</span>}
            {!thresholdValid && <span className="text-error">Threshold must be a positive number{conditionType === 'error_rate_high' ? ' up to 100' : ''}.</span>}
          </div>
          <button
            type="submit"
            disabled={!canSave}
            className="bg-surface-container-high border border-outline-variant/20 text-on-surface px-6 py-2.5 rounded-lg text-sm font-bold hover:bg-surface-container-highest transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {create.isPending ? 'Saving…' : 'Save Alert Rule'}
          </button>
        </div>
      </form>
    </div>
  );
}
