import { describe, expect, it } from 'vitest';
import { AxiosAdapter, AxiosError, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { apiClient } from '@/shared/api/apiClient';
import { setAccessToken } from '@/features/auth/state/auth.store';
import { alertsErrorMessage, alertsService } from '@/features/alerts/api/alerts.service';

const P = 'proj_aaaaaaaaaaaaaaaaaaaaaaaa';

function install(status: number, data: unknown) {
  const seen: InternalAxiosRequestConfig[] = [];
  const adapter: AxiosAdapter = async (config) => {
    seen.push(config);
    const response = { data, status, statusText: String(status), headers: {}, config } as AxiosResponse;
    if (status >= 400) throw new AxiosError(`HTTP ${status}`, String(status), config, null, response);
    return response;
  };
  apiClient.defaults.adapter = adapter;
  setAccessToken('a');
  return seen;
}

describe('alertsService (KI-18)', () => {
  it('lists rules and events for the project', async () => {
    const seen = install(200, { data: { rules: [{ id: 1 }], events: [{ id: 2 }] } });
    expect(await alertsService.listRules(P)).toEqual([{ id: 1 }]);
    expect(await alertsService.listEvents(P, 5)).toEqual([{ id: 2 }]);
    expect(seen[0]).toMatchObject({ url: '/api/v1/alerts/rules', method: 'get', params: { projectId: P } });
    expect(seen[1]).toMatchObject({ url: '/api/v1/alerts/events', params: { projectId: P, limit: 5 } });
  });

  it('creates, updates and deletes with the projectId where the API expects it', async () => {
    const seen = install(200, { data: { rule: { id: 9 } } });
    const body = { projectId: P, name: 'n', conditionType: 'error_rate_high' as const, threshold: 5, windowMinutes: 5 };
    expect(await alertsService.createRule(body)).toEqual({ id: 9 });
    await alertsService.updateRule(P, 9, { isActive: false });
    await alertsService.deleteRule(P, 9);
    expect(seen.map((c) => [c.method, c.url])).toEqual([['post', '/api/v1/alerts/rules'], ['patch', '/api/v1/alerts/rules/9'], ['delete', '/api/v1/alerts/rules/9']]);
    expect(JSON.parse(String(seen[0].data))).toEqual(body);
    expect(JSON.parse(String(seen[1].data))).toEqual({ isActive: false });
    expect(seen[1].params).toEqual({ projectId: P });
    expect(seen[2].params).toEqual({ projectId: P });
  });
});

describe('alertsErrorMessage', () => {
  const fail = async (status: number, data: unknown) => {
    install(status, data);
    return alertsService.listRules(P).catch((e) => e);
  };

  it('shows field validation errors from the API', async () => {
    const error = await fail(400, { error: 'VALIDATION_ERROR', message: 'Request validation failed', details: { formErrors: [], fieldErrors: { notifyWebhook: ['Webhook URL must use https'] } } });
    expect(alertsErrorMessage(error)).toBe('notifyWebhook: Webhook URL must use https');
  });

  it('explains owner-only changes and falls back to the API message', async () => {
    expect(alertsErrorMessage(await fail(403, { error: 'FORBIDDEN', message: 'Owner role required' }))).toBe('Only project owners can change alert rules.');
    expect(alertsErrorMessage(await fail(404, { error: 'NOT_FOUND', message: 'Alert rule not found' }))).toBe('Alert rule not found');
    expect(alertsErrorMessage(new Error('boom'))).toBe('boom');
  });
});
