import { AlertsRepository, AlertRule, WindowStats } from '@modules/alerts/alerts.repository';
import { eventBus } from '@events/event-bus';
import { sendWebhook } from '@shared/net/webhook';

export const ALERT_EVALUATION_INTERVAL_MS = 60_000;

export interface Evaluation {
  breached: boolean;
  /** The measured value: error rate in % or p99 in ms; null without traffic. */
  value: number | null;
  /** Human-readable description of the measured value. */
  summary: string;
}

/** Pure: does `stats` breach `rule`? No traffic never breaches. */
export function evaluateRule(rule: Pick<AlertRule, 'condition_type' | 'threshold' | 'window_minutes'>, stats: WindowStats): Evaluation {
  const window = `last ${rule.window_minutes} min`;
  if (rule.condition_type === 'error_rate_high') {
    if (stats.totalRequests === 0) return { breached: false, value: null, summary: `no requests in the ${window}` };
    const rate = (stats.totalErrors / stats.totalRequests) * 100;
    return {
      breached: rate > rule.threshold,
      value: Number(rate.toFixed(2)),
      summary: `error rate ${rate.toFixed(2)}% (${stats.totalErrors}/${stats.totalRequests} requests, ${window}; threshold ${rule.threshold}%)`,
    };
  }
  if (rule.condition_type === 'latency_p99_high') {
    if (stats.p99Ms === null || stats.totalRequests === 0) return { breached: false, value: null, summary: `no requests in the ${window}` };
    return {
      breached: stats.p99Ms > rule.threshold,
      value: Math.round(stats.p99Ms),
      summary: `p99 latency ${Math.round(stats.p99Ms)}ms (${stats.totalRequests} requests, ${window}; threshold ${rule.threshold}ms)`,
    };
  }
  return { breached: false, value: null, summary: `unknown condition ${String(rule.condition_type)}` };
}

/**
 * Evaluates every active rule once a minute against the raw logs of its window.
 *
 * Each rule is `ok` or `firing`. Only transitions notify: ok → firing ("triggered") and
 * firing → ok ("resolved"). A rule that stays breached is not re-sent every minute. The
 * transition is a conditional UPDATE, so concurrent evaluators can't double-notify.
 */
export class AlertWorker {
  private repo = new AlertsRepository();
  private interval: NodeJS.Timeout | null = null;
  private running = false;

  start(): void {
    console.log('👷 [Worker] AlertWorker started, evaluating rules every 60s');
    this.interval = setInterval(() => void this.evaluateRules(), ALERT_EVALUATION_INTERVAL_MS);
    void this.evaluateRules();
  }

  stop(): void {
    if (this.interval) clearInterval(this.interval);
    this.interval = null;
  }

  /** True while an evaluation pass is running (shutdown waits for it). */
  isBusy(): boolean {
    return this.running;
  }

  async evaluateRules(): Promise<void> {
    if (this.running) return; // a slow pass must not overlap the next tick
    this.running = true;
    try {
      const rules = await this.repo.getActiveRules();
      for (const rule of rules) {
        try {
          await this.processRule(rule);
        } catch (error) {
          console.error(`❌ [AlertWorker] Rule ${rule.id} failed:`, (error as Error).message);
        }
      }
    } catch (error) {
      console.error('❌ [AlertWorker] Failed to evaluate rules:', error);
    } finally {
      this.running = false;
    }
  }

  private async processRule(rule: AlertRule): Promise<void> {
    const stats = await this.repo.getWindowStats(rule.project_id, rule.endpoint_filter, rule.window_minutes);
    const evaluation = evaluateRule(rule, stats);
    await this.repo.recordEvaluation(rule.id, evaluation.value);

    if (evaluation.breached && rule.state === 'ok') {
      const message = `Alert: ${rule.name}. ${capitalize(evaluation.summary)}.`;
      if (await this.repo.transition(rule, 'ok', 'firing', message, evaluation.value)) {
        this.notify(rule, 'triggered', message, evaluation.value);
      }
    } else if (!evaluation.breached && rule.state === 'firing') {
      const message = `Resolved: ${rule.name}. ${capitalize(evaluation.summary)}.`;
      if (await this.repo.transition(rule, 'firing', 'ok', message, evaluation.value)) {
        this.notify(rule, 'resolved', message, evaluation.value);
      }
    }
  }

  private notify(rule: AlertRule, kind: 'triggered' | 'resolved', message: string, value: number | null): void {
    console.log(`🚨 [Alert] ${message}`);
    eventBus.emit('alert.triggered', {
      alertRuleId: rule.id,
      projectId: rule.project_id,
      message,
      severity: kind === 'triggered' ? 'critical' : 'info',
    });

    // Fire and forget. sendWebhook refuses non-https URLs and private/internal addresses,
    // and never follows redirects (KI-6).
    if (rule.notify_webhook) {
      sendWebhook(rule.notify_webhook, {
        text: message,
        source: 'ApexMonitor',
        status: kind,
        rule: { id: rule.id, name: rule.name, condition: rule.condition_type, threshold: rule.threshold, windowMinutes: rule.window_minutes },
        projectId: rule.project_id,
        value,
      }).catch((err: Error) => console.error(`[AlertWorker] Webhook for rule ${rule.id} not sent: ${err.message}`));
    }
  }
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
