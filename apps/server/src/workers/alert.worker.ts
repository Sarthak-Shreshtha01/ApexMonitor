import { AlertsRepository, AlertRule } from '@modules/alerts/alerts.repository';
import { eventBus } from '@events/event-bus';

export class AlertWorker {
  private repo = new AlertsRepository();
  private interval: NodeJS.Timeout | null = null;

  start(): void {
    console.log('👷 [Worker] AlertWorker started, evaluating rules every 60s');
    
    // Run evaluation loop every 60 seconds
    this.interval = setInterval(() => this.evaluateRules(), 60000);
    
    // Run immediately on boot
    this.evaluateRules();
  }

  private async evaluateRules(): Promise<void> {
    try {
      const activeRules = await this.repo.getActiveRules();

      for (const rule of activeRules) {
        await this.processRule(rule);
      }
    } catch (error) {
      console.error('❌ [AlertWorker] Failed to evaluate rules:', error);
    }
  }

  private async processRule(rule: AlertRule): Promise<void> {
    const stats = await this.repo.getRecentMetrics(rule.project_id, rule.endpoint_filter, rule.window_minutes);
    
    let isBreached = false;
    let message = '';

    // Rule Logic Matrix (cite: 1438-1440)
    if (rule.condition_type === 'error_rate_high') {
      const errorRate = stats.total_requests > 0 ? (stats.total_errors / stats.total_requests) * 100 : 0;
      if (errorRate > rule.threshold) {
        isBreached = true;
        message = `Alert: ${rule.name}. Error rate is ${errorRate.toFixed(2)}% (Threshold: ${rule.threshold}%).`;
      }
    } 
    else if (rule.condition_type === 'latency_p99_high') {
      if (stats.max_p99 > rule.threshold) {
        isBreached = true;
        message = `Alert: ${rule.name}. P99 Latency hit ${stats.max_p99}ms (Threshold: ${rule.threshold}ms).`;
      }
    }

    if (isBreached) {
      await this.triggerAlert(rule, message);
    }
  }

  private async triggerAlert(rule: AlertRule, message: string): Promise<void> {
    console.log(`🚨 [Alert] ${message}`);
    
    // 1. Log to Database
    await this.repo.logAlertEvent(rule.id, rule.project_id, message);

    // 2. Broadcast internally (so WebSocket can update activeAlerts count)
    eventBus.emit('alert.triggered', {
      alertRuleId: rule.id,
      projectId: rule.project_id,
      message,
      severity: 'critical'
    });

    // 3. Dispatch Webhook (Fire & Forget)
    if (rule.notify_webhook) {
      this.dispatchWebhook(rule.notify_webhook, message).catch(err => 
        console.error(`Failed to send webhook to ${rule.notify_webhook}`, err)
      );
    }
  }

  private async dispatchWebhook(url: string, message: string) {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: message, source: 'ApexMonitor' })
    });
  }
}