import { AxiosError } from 'axios';
import { apiClient } from '@/shared/api/apiClient';
import { ENDPOINTS } from '@/shared/api/endpoints';

export type AlertCondition = 'error_rate_high' | 'latency_p99_high';

export interface AlertRule {
  id: number;
  projectId: string;
  name: string;
  conditionType: AlertCondition;
  /** percent for error_rate_high, milliseconds for latency_p99_high */
  threshold: number;
  windowMinutes: number;
  endpointFilter: string | null;
  notifyWebhook: string | null;
  notifyEmail: string | null;
  isActive: boolean;
  state: 'ok' | 'firing';
  lastValue: number | null;
  lastEvaluatedAt: string | null;
  lastTriggeredAt: string | null;
  lastResolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AlertEvent {
  id: number;
  ruleId: number;
  ruleName: string | null;
  kind: 'triggered' | 'resolved';
  message: string;
  value: number | null;
  at: string;
}

export interface NewAlertRule {
  projectId: string;
  name: string;
  conditionType: AlertCondition;
  threshold: number;
  windowMinutes: number;
  endpointFilter?: string | null;
  notifyWebhook?: string | null;
  isActive?: boolean;
}

export type AlertRulePatch = Partial<Omit<NewAlertRule, 'projectId'>>;

export const CONDITION_LABELS: Record<AlertCondition, { label: string; unit: string }> = {
  error_rate_high: { label: 'Error rate', unit: '%' },
  latency_p99_high: { label: 'p99 latency', unit: 'ms' },
};

export const alertsService = {
  async listRules(projectId: string): Promise<AlertRule[]> {
    const response = await apiClient.get<{ rules: AlertRule[] }>(ENDPOINTS.alerts.rules, { params: { projectId } });
    return response.data.rules;
  },

  async createRule(input: NewAlertRule): Promise<AlertRule> {
    const response = await apiClient.post<{ rule: AlertRule }>(ENDPOINTS.alerts.rules, input);
    return response.data.rule;
  },

  async updateRule(projectId: string, ruleId: number, patch: AlertRulePatch): Promise<AlertRule> {
    const response = await apiClient.patch<{ rule: AlertRule }>(ENDPOINTS.alerts.rule(ruleId), patch, { params: { projectId } });
    return response.data.rule;
  },

  async deleteRule(projectId: string, ruleId: number): Promise<void> {
    await apiClient.delete(ENDPOINTS.alerts.rule(ruleId), { params: { projectId } });
  },

  async listEvents(projectId: string, limit = 20): Promise<AlertEvent[]> {
    const response = await apiClient.get<{ events: AlertEvent[] }>(ENDPOINTS.alerts.events, { params: { projectId, limit } });
    return response.data.events;
  },
};

/** A readable message for a failed alerts request (validation details, permissions, etc.). */
export function alertsErrorMessage(error: unknown): string {
  if (error instanceof AxiosError) {
    const body = error.response?.data as { message?: string; details?: { fieldErrors?: Record<string, string[]>; formErrors?: string[] } } | undefined;
    const fieldErrors = Object.entries(body?.details?.fieldErrors ?? {}).flatMap(([field, messages]) => messages.map((m) => `${field}: ${m}`));
    if (fieldErrors.length > 0) return fieldErrors.join('; ');
    if (body?.details?.formErrors?.length) return body.details.formErrors.join('; ');
    if (error.response?.status === 403) return 'Only project owners can change alert rules.';
    if (body?.message) return body.message;
  }
  return error instanceof Error ? error.message : 'Something went wrong';
}
