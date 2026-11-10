import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import axios, { AxiosAdapter, AxiosError, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { apiClient, refreshAccessToken } from '@/shared/api/apiClient';
import { ENDPOINTS } from '@/shared/api/endpoints';
import { store } from '@/lib/redux/store';
import authReducer, { clearAuth, setAccessToken } from '@/features/auth/state/auth.slice';
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
const header = (c: InternalAxiosRequestConfig, name: string) => (c.headers as Record<string, unknown> | undefined)?.[name];

// The client redirects with window.location.assign when a session can't be renewed.
const assign = vi.fn();
beforeEach(() => {
  assign.mockReset();
  vi.stubGlobal('window', { location: { pathname: '/overview', assign }, localStorage: { removeItem: vi.fn() } });
});
afterEach(() => vi.unstubAllGlobals());

describe('auth slice (KI-17)', () => {
  it('keeps only an in-memory access token and a session status', () => {
    let s = authReducer(undefined, { type: 'init' });
    expect(s).toEqual({ accessToken: null, status: 'unknown' });
    s = authReducer(s, setAccessToken('a'));
    expect(s).toEqual({ accessToken: 'a', status: 'authenticated' });
    expect(authReducer(s, clearAuth())).toEqual({ accessToken: null, status: 'anonymous' });
  });

  it('nothing about the session is written to localStorage', () => {
    const setItem = vi.fn();
    vi.stubGlobal('localStorage', { setItem, getItem: vi.fn(), removeItem: vi.fn() });
    store.dispatch(setAccessToken('secret-access'));
    expect(setItem).not.toHaveBeenCalled();
    expect(JSON.stringify(store.getState())).not.toContain('refresh');
  });
});

describe('apiClient', () => {
  beforeEach(() => {
    store.dispatch(setAccessToken('old-access'));
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

  it('on 401 refreshes with the cookie (no token in the body, CSRF header set) and replays the request', async () => {
    const seen = install((c) => {
      if (c.url === ENDPOINTS.auth.refresh) return { status: 200, data: { data: { accessToken: 'new-access', refreshToken: 'ignored' } } };
      return auth(c) === 'Bearer new-access' ? { status: 200, data: { data: 'ok' } } : { status: 401, data: { error: 'UNAUTHORIZED' } };
    });
    const res = await apiClient.get('/api/v1/logs');
    expect(res.data).toBe('ok');
    expect(store.getState().auth).toEqual({ accessToken: 'new-access', status: 'authenticated' });
    const refreshCall = seen.find((c) => c.url === ENDPOINTS.auth.refresh)!;
    expect(JSON.parse(String(refreshCall.data))).toEqual({});
    expect(refreshCall.withCredentials).toBe(true);
    expect(header(refreshCall, 'X-Requested-With')).toBe('XMLHttpRequest');
    expect(seen.map((c) => c.url)).toEqual(['/api/v1/logs', ENDPOINTS.auth.refresh, '/api/v1/logs']);
  });

  it('concurrent 401s share a single refresh', async () => {
    let refreshes = 0;
    install(async (c) => {
      if (c.url === ENDPOINTS.auth.refresh) {
        refreshes += 1;
        await new Promise((r) => setTimeout(r, 20));
        return { status: 200, data: { accessToken: 'fresh' } };
      }
      return auth(c) === 'Bearer fresh' ? { status: 200, data: { data: c.url } } : { status: 401, data: {} };
    });
    const results = await Promise.all(['/a', '/b', '/c'].map((u) => apiClient.get(u)));
    expect(results.map((r) => r.data)).toEqual(['/a', '/b', '/c']);
    expect(refreshes).toBe(1);
  });

  it('when the refresh fails: every waiting request fails, tokens are cleared and the user goes to /login (KI-40)', async () => {
    install(async (c) => {
      if (c.url === ENDPOINTS.auth.refresh) {
        await new Promise((r) => setTimeout(r, 10));
        return { status: 401, data: { error: 'UNAUTHORIZED' } };
      }
      return { status: 401, data: {} };
    });
    const outcomes = await Promise.allSettled(['/a', '/b'].map((u) => apiClient.get(u)));
    expect(outcomes.every((o) => o.status === 'rejected')).toBe(true);
    expect(store.getState().auth).toEqual({ accessToken: null, status: 'anonymous' });
    expect(assign).toHaveBeenCalledWith(ROUTES.auth.login);
  });

  it('does not redirect when already on a public page', async () => {
    vi.stubGlobal('window', { location: { pathname: ROUTES.auth.login, assign }, localStorage: { removeItem: vi.fn() } });
    install(() => ({ status: 401, data: {} }));
    await apiClient.get('/x').catch(() => undefined);
    expect(assign).not.toHaveBeenCalled();
  });

  it('never tries to refresh for auth endpoints (no loops)', async () => {
    const seen = install(() => ({ status: 401, data: {} }));
    await expect(apiClient.post(ENDPOINTS.auth.login, {})).rejects.toBeInstanceOf(AxiosError);
    expect(seen).toHaveLength(1);
  });

  it('does not retry a request twice if the replay is also 401', async () => {
    const seen = install((c) => (c.url === ENDPOINTS.auth.refresh ? { status: 200, data: { accessToken: 'n' } } : { status: 401, data: {} }));
    await expect(apiClient.get('/x')).rejects.toBeInstanceOf(AxiosError);
    expect(seen.filter((c) => c.url === '/x')).toHaveLength(2);
  });

  it('passes non-401 errors straight through', async () => {
    const seen = install(() => ({ status: 500, data: {} }));
    await expect(apiClient.get('/x')).rejects.toMatchObject({ response: { status: 500 } });
    expect(seen).toHaveLength(1);
  });

  it('refreshAccessToken restores a session on page load', async () => {
    store.dispatch(clearAuth());
    install(() => ({ status: 200, data: { data: { accessToken: 'restored' } } }));
    await expect(refreshAccessToken()).resolves.toBe('restored');
    expect(store.getState().auth.status).toBe('authenticated');
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
    store.dispatch(setAccessToken('x'));
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
