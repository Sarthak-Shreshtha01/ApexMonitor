import { beforeEach, describe, expect, it } from 'vitest';
import axios, { AxiosAdapter, AxiosError, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { apiClient } from '@/shared/api/apiClient';
import { ENDPOINTS } from '@/shared/api/endpoints';
import { store } from '@/lib/redux/store';
import authReducer, { clearAuth, setAccessToken, setRefreshToken, setTokens } from '@/features/auth/state/auth.slice';
import { PUBLIC_PATHS, ROUTES } from '@/shared/routes/routes';
import { authService } from '@/features/auth/api/auth.service';

type Handler = (config: InternalAxiosRequestConfig) => { status: number; data: unknown } | Promise<{ status: number; data: unknown }>;

/** Routes every axios request (apiClient and the bare axios used for refresh) through `handler`. */
function install(handler: Handler) {
  const seen: InternalAxiosRequestConfig[] = [];
  const adapter: AxiosAdapter = async (config) => {
    seen.push(config);
    const { status, data } = await handler(config);
    const response = { data, status, statusText: String(status), headers: {}, config } as AxiosResponse;
    if (status >= 400) throw new AxiosError(`HTTP ${status}`, String(status), config, null, response);
    return response;
  };
  apiClient.defaults.adapter = adapter;
  axios.defaults.adapter = adapter;
  return seen;
}

const auth = (c: InternalAxiosRequestConfig) => String(c.headers?.Authorization ?? '');

describe('auth slice', () => {
  it('sets, updates and clears tokens', () => {
    let s = authReducer(undefined, setTokens({ accessToken: 'a', refreshToken: 'r' }));
    expect(s).toEqual({ accessToken: 'a', refreshToken: 'r' });
    s = authReducer(s, setAccessToken('a2'));
    s = authReducer(s, setRefreshToken(null));
    expect(s).toEqual({ accessToken: 'a2', refreshToken: null });
    expect(authReducer(s, clearAuth())).toEqual({ accessToken: null, refreshToken: null });
  });
});

describe('apiClient', () => {
  beforeEach(() => {
    store.dispatch(setTokens({ accessToken: 'old-access', refreshToken: 'refresh-1' }));
  });

  it('attaches the access token and unwraps the success envelope', async () => {
    const seen = install(() => ({ status: 200, data: { data: { ok: true }, meta: { requestId: 'r' } } }));
    const res = await apiClient.get('/api/v1/users/me');
    expect(auth(seen[0])).toBe('Bearer old-access');
    expect(res.data).toEqual({ ok: true });
  });

  it('passes non-envelope payloads through unchanged', async () => {
    install(() => ({ status: 200, data: { profile: { id: 1 } } }));
    expect((await apiClient.get('/api/v1/users/me')).data).toEqual({ profile: { id: 1 } });
  });

  it('on 401 refreshes once, stores the new tokens and replays the request', async () => {
    const seen = install((c) => {
      if (c.url === ENDPOINTS.auth.refresh) return { status: 200, data: { data: { accessToken: 'new-access', refreshToken: 'refresh-2' } } };
      return auth(c) === 'Bearer new-access' ? { status: 200, data: { data: 'ok' } } : { status: 401, data: { error: 'UNAUTHORIZED' } };
    });
    const res = await apiClient.get('/api/v1/logs');
    expect(res.data).toBe('ok');
    expect(store.getState().auth).toEqual({ accessToken: 'new-access', refreshToken: 'refresh-2' });
    const refreshCall = seen.find((c) => c.url === ENDPOINTS.auth.refresh)!;
    expect(JSON.parse(String(refreshCall.data))).toEqual({ refreshToken: 'refresh-1' });
    expect(seen.map((c) => c.url)).toEqual(['/api/v1/logs', ENDPOINTS.auth.refresh, '/api/v1/logs']);
  });

  it('queues concurrent 401s behind a single refresh', async () => {
    let refreshes = 0;
    install(async (c) => {
      if (c.url === ENDPOINTS.auth.refresh) {
        refreshes += 1;
        await new Promise((r) => setTimeout(r, 20));
        return { status: 200, data: { accessToken: 'fresh', refreshToken: 'refresh-3' } };
      }
      return auth(c) === 'Bearer fresh' ? { status: 200, data: { data: c.url } } : { status: 401, data: {} };
    });
    const results = await Promise.all(['/a', '/b', '/c'].map((u) => apiClient.get(u)));
    expect(results.map((r) => r.data)).toEqual(['/a', '/b', '/c']);
    expect(refreshes).toBe(1);
  });

  it('rejects every queued request when the refresh fails', async () => {
    install(async (c) => {
      if (c.url === ENDPOINTS.auth.refresh) {
        await new Promise((r) => setTimeout(r, 10));
        return { status: 401, data: { error: 'UNAUTHORIZED' } };
      }
      return { status: 401, data: {} };
    });
    const outcomes = await Promise.allSettled(['/a', '/b'].map((u) => apiClient.get(u)));
    expect(outcomes.every((o) => o.status === 'rejected')).toBe(true);
  });

  it.fails('[known bug KI-40] clears stored tokens when the refresh fails', async () => {
    install(() => ({ status: 401, data: {} }));
    await apiClient.get('/x').catch(() => undefined);
    expect(store.getState().auth).toEqual({ accessToken: null, refreshToken: null });
  });

  it('fails fast without a stored refresh token', async () => {
    store.dispatch(setRefreshToken(null));
    const seen = install(() => ({ status: 401, data: {} }));
    await expect(apiClient.get('/x')).rejects.toThrow('MISSING_REFRESH_TOKEN');
    expect(seen.some((c) => c.url === ENDPOINTS.auth.refresh)).toBe(false);
  });

  it('never tries to refresh for auth endpoints (no loops)', async () => {
    const seen = install(() => ({ status: 401, data: {} }));
    await expect(apiClient.post(ENDPOINTS.auth.login, {})).rejects.toBeInstanceOf(AxiosError);
    expect(seen).toHaveLength(1);
  });

  it('does not retry a request twice if the replay is also 401', async () => {
    const seen = install((c) => (c.url === ENDPOINTS.auth.refresh ? { status: 200, data: { accessToken: 'n', refreshToken: 'r' } } : { status: 401, data: {} }));
    await expect(apiClient.get('/x')).rejects.toBeInstanceOf(AxiosError);
    expect(seen.filter((c) => c.url === '/x')).toHaveLength(2);
  });

  it('passes non-401 errors straight through', async () => {
    const seen = install(() => ({ status: 500, data: {} }));
    await expect(apiClient.get('/x')).rejects.toMatchObject({ response: { status: 500 } });
    expect(seen).toHaveLength(1);
  });
});

describe('authService.exchangeOAuthCode (KI-4)', () => {
  beforeEach(() => {
    store.dispatch(clearAuth());
  });

  it('POSTs the one-time code and returns the tokens', async () => {
    const seen = install(() => ({ status: 200, data: { data: { accessToken: 'a1', refreshToken: 'r1' } } }));
    await expect(authService.exchangeOAuthCode('code-123')).resolves.toEqual({ accessToken: 'a1', refreshToken: 'r1' });
    expect(seen[0].url).toBe(ENDPOINTS.auth.oauthExchange);
    expect(seen[0].method).toBe('post');
    expect(JSON.parse(String(seen[0].data))).toEqual({ code: 'code-123' });
  });

  it('a used or expired code fails without trying a token refresh', async () => {
    store.dispatch(setTokens({ accessToken: 'x', refreshToken: 'y' }));
    const seen = install(() => ({ status: 401, data: { error: 'UNAUTHORIZED' } }));
    await expect(authService.exchangeOAuthCode('used')).rejects.toBeInstanceOf(AxiosError);
    expect(seen).toHaveLength(1);
  });
});

describe('routes', () => {
  it('public paths include auth and legal pages but no dashboard pages', () => {
    expect(PUBLIC_PATHS).toEqual(expect.arrayContaining([ROUTES.home, ROUTES.auth.login, ROUTES.auth.register, ROUTES.legal.privacy]));
    expect(PUBLIC_PATHS).not.toEqual(expect.arrayContaining([ROUTES.dashboard.overview]));
    expect(ROUTES.dashboard.traceDetail('t1')).toBe('/traces/t1');
  });
});
