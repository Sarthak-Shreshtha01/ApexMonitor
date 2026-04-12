import { HttpClient } from './http.js';
import type { ApexClientOptions, RequestOptions } from './types.js';

const PATHS = {
  auth: {
    login: '/api/v1/auth/login',
    refresh: '/api/v1/auth/refresh',
    logout: '/api/v1/auth/logout',
    keys: '/api/v1/auth/keys',
    rumKeys: '/api/v1/auth/rum-keys',
    oauthStart: (provider: 'google' | 'github', mode: 'login' | 'register') =>
      `/api/v1/auth/oauth/${provider}/start?mode=${mode}`,
    oauthCallback: (provider: 'google' | 'github') => `/api/v1/auth/oauth/${provider}/callback`,
  },
  users: {
    register: '/api/v1/users/register',
    me: '/api/v1/users/me',
    members: (projectId: string) => `/api/v1/users/${projectId}/members`,
    member: (projectId: string, memberId: string) => `/api/v1/users/${projectId}/members/${memberId}`,
  },
  projects: {
    root: '/api/v1/projects',
  },
  ingest: {
    root: '/api/v1/ingest',
  },
  rum: {
    root: '/api/v1/rum',
    overview: '/api/v1/rum/overview',
    series: '/api/v1/rum/series',
    paths: '/api/v1/rum/paths',
    devices: '/api/v1/rum/devices',
    geo: '/api/v1/rum/geo',
    referrers: '/api/v1/rum/referrers',
  },
  metrics: {
    overview: '/api/v1/metrics/overview',
    latency: '/api/v1/metrics/latency',
    operations: '/api/v1/metrics/operations',
    rps: '/api/v1/metrics/rps',
    endpoints: '/api/v1/metrics/endpoints',
  },
  logs: {
    root: '/api/v1/logs',
  },
  traces: {
    root: '/api/v1/traces',
    detail: (traceId: string) => `/api/v1/traces/${traceId}`,
  },
  insights: {
    root: '/api/v1/insights',
  },
  keys: {
    root: '/api/v1/keys',
    stats: '/api/v1/keys/stats',
    key: (keyId: number) => `/api/v1/keys/${keyId}`,
  },
  billing: {
    checkout: '/api/v1/billing/checkout',
  },
} as const;

export class ApexClient {
  private readonly http: HttpClient;

  constructor(options: ApexClientOptions) {
    this.http = new HttpClient(options);
  }

  request = {
    get: <T = unknown>(path: string, options?: RequestOptions): Promise<T> =>
      this.http.request<T>('GET', path, options),
    post: <T = unknown>(path: string, body?: unknown, options?: RequestOptions): Promise<T> =>
      this.http.request<T>('POST', path, { ...options, body }),
    put: <T = unknown>(path: string, body?: unknown, options?: RequestOptions): Promise<T> =>
      this.http.request<T>('PUT', path, { ...options, body }),
    patch: <T = unknown>(path: string, body?: unknown, options?: RequestOptions): Promise<T> =>
      this.http.request<T>('PATCH', path, { ...options, body }),
    delete: <T = unknown>(path: string, options?: RequestOptions): Promise<T> =>
      this.http.request<T>('DELETE', path, options),
  };

  auth = {
    login: <T = unknown>(body: unknown, options?: RequestOptions): Promise<T> =>
      this.http.request<T>('POST', PATHS.auth.login, { ...options, body }),

    register: <T = unknown>(body: unknown, options?: RequestOptions): Promise<T> =>
      this.http.request<T>('POST', PATHS.users.register, { ...options, body }),

    refresh: <T = unknown>(body: unknown, options?: RequestOptions): Promise<T> =>
      this.http.request<T>('POST', PATHS.auth.refresh, { ...options, body }),

    logout: <T = unknown>(body: unknown = {}, options?: RequestOptions): Promise<T> =>
      this.http.request<T>('POST', PATHS.auth.logout, { ...options, body }),

    me: <T = unknown>(options?: RequestOptions): Promise<T> =>
      this.http.request<T>('GET', PATHS.users.me, options),

    generateIngestKey: <T = unknown>(body: unknown, options?: RequestOptions): Promise<T> =>
      this.http.request<T>('POST', PATHS.auth.keys, { ...options, body }),

    generateRumKey: <T = unknown>(body: unknown, options?: RequestOptions): Promise<T> =>
      this.http.request<T>('POST', PATHS.auth.rumKeys, { ...options, body }),

    oauthStart: <T = unknown>(provider: 'google' | 'github', mode: 'login' | 'register', options?: RequestOptions): Promise<T> =>
      this.http.request<T>('GET', PATHS.auth.oauthStart(provider, mode), options),

    oauthCallback: <T = unknown>(provider: 'google' | 'github', query?: RequestOptions['query'], options?: RequestOptions): Promise<T> =>
      this.http.request<T>('GET', PATHS.auth.oauthCallback(provider), { ...options, query }),
  };

  projects = {
    listMine: <T = unknown>(options?: RequestOptions): Promise<T> =>
      this.http.request<T>('GET', PATHS.projects.root, options),

    create: <T = unknown>(body: unknown, options?: RequestOptions): Promise<T> =>
      this.http.request<T>('POST', PATHS.projects.root, { ...options, body }),

    members: {
      list: <T = unknown>(projectId: string, options?: RequestOptions): Promise<T> =>
        this.http.request<T>('GET', PATHS.users.members(projectId), options),

      add: <T = unknown>(projectId: string, body: unknown, options?: RequestOptions): Promise<T> =>
        this.http.request<T>('POST', PATHS.users.members(projectId), { ...options, body }),

      update: <T = unknown>(projectId: string, memberId: string, body: unknown, options?: RequestOptions): Promise<T> =>
        this.http.request<T>('PATCH', PATHS.users.member(projectId, memberId), { ...options, body }),

      remove: <T = unknown>(projectId: string, memberId: string, options?: RequestOptions): Promise<T> =>
        this.http.request<T>('DELETE', PATHS.users.member(projectId, memberId), options),
    },
  };

  ingest = {
    batch: <T = unknown>(body: unknown, options?: RequestOptions): Promise<T> =>
      this.http.request<T>('POST', PATHS.ingest.root, { ...options, body }),
  };

  rum = {
    ingest: <T = unknown>(body: unknown, options?: RequestOptions): Promise<T> =>
      this.http.request<T>('POST', PATHS.rum.root, { ...options, body }),

    overview: <T = unknown>(query?: RequestOptions['query'], options?: RequestOptions): Promise<T> =>
      this.http.request<T>('GET', PATHS.rum.overview, { ...options, query }),

    series: <T = unknown>(query?: RequestOptions['query'], options?: RequestOptions): Promise<T> =>
      this.http.request<T>('GET', PATHS.rum.series, { ...options, query }),

    paths: <T = unknown>(query?: RequestOptions['query'], options?: RequestOptions): Promise<T> =>
      this.http.request<T>('GET', PATHS.rum.paths, { ...options, query }),

    devices: <T = unknown>(query?: RequestOptions['query'], options?: RequestOptions): Promise<T> =>
      this.http.request<T>('GET', PATHS.rum.devices, { ...options, query }),

    geo: <T = unknown>(query?: RequestOptions['query'], options?: RequestOptions): Promise<T> =>
      this.http.request<T>('GET', PATHS.rum.geo, { ...options, query }),

    referrers: <T = unknown>(query?: RequestOptions['query'], options?: RequestOptions): Promise<T> =>
      this.http.request<T>('GET', PATHS.rum.referrers, { ...options, query }),
  };

  metrics = {
    overview: <T = unknown>(query?: RequestOptions['query'], options?: RequestOptions): Promise<T> =>
      this.http.request<T>('GET', PATHS.metrics.overview, { ...options, query }),

    latency: <T = unknown>(query?: RequestOptions['query'], options?: RequestOptions): Promise<T> =>
      this.http.request<T>('GET', PATHS.metrics.latency, { ...options, query }),

    operations: <T = unknown>(query?: RequestOptions['query'], options?: RequestOptions): Promise<T> =>
      this.http.request<T>('GET', PATHS.metrics.operations, { ...options, query }),

    rps: <T = unknown>(query?: RequestOptions['query'], options?: RequestOptions): Promise<T> =>
      this.http.request<T>('GET', PATHS.metrics.rps, { ...options, query }),

    endpoints: <T = unknown>(query?: RequestOptions['query'], options?: RequestOptions): Promise<T> =>
      this.http.request<T>('GET', PATHS.metrics.endpoints, { ...options, query }),
  };

  logs = {
    list: <T = unknown>(query?: RequestOptions['query'], options?: RequestOptions): Promise<T> =>
      this.http.request<T>('GET', PATHS.logs.root, { ...options, query }),
  };

  traces = {
    list: <T = unknown>(query?: RequestOptions['query'], options?: RequestOptions): Promise<T> =>
      this.http.request<T>('GET', PATHS.traces.root, { ...options, query }),

    detail: <T = unknown>(traceId: string, options?: RequestOptions): Promise<T> =>
      this.http.request<T>('GET', PATHS.traces.detail(traceId), options),
  };

  insights = {
    list: <T = unknown>(query?: RequestOptions['query'], options?: RequestOptions): Promise<T> =>
      this.http.request<T>('GET', PATHS.insights.root, { ...options, query }),
  };

  keys = {
    list: <T = unknown>(query?: RequestOptions['query'], options?: RequestOptions): Promise<T> =>
      this.http.request<T>('GET', PATHS.keys.root, { ...options, query }),

    stats: <T = unknown>(query?: RequestOptions['query'], options?: RequestOptions): Promise<T> =>
      this.http.request<T>('GET', PATHS.keys.stats, { ...options, query }),

    create: <T = unknown>(body: unknown, options?: RequestOptions): Promise<T> =>
      this.http.request<T>('POST', PATHS.keys.root, { ...options, body }),

    revoke: <T = unknown>(keyId: number, options?: RequestOptions): Promise<T> =>
      this.http.request<T>('DELETE', PATHS.keys.key(keyId), options),
  };

  billing = {
    checkout: <T = unknown>(body: unknown, options?: RequestOptions): Promise<T> =>
      this.http.request<T>('POST', PATHS.billing.checkout, { ...options, body }),
  };
}

export function createApexClient(options: ApexClientOptions): ApexClient {
  return new ApexClient(options);
}
