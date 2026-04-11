export const ENDPOINTS = {
  auth: {
    login: '/api/v1/auth/login',
    register: '/api/v1/users/register',
    refresh: '/api/v1/auth/refresh',
    logout: '/api/v1/users/logout',
    oauthStart: (provider: 'google' | 'github', mode: 'login' | 'register') =>
      `/api/v1/auth/oauth/${provider}/start?mode=${mode}`,
  },
  user: {
    profile: '/api/v1/users/me',
  },
  metrics: {
    overview: '/api/v1/metrics/overview',
    latency: '/api/v1/metrics/latency',
    operations: '/api/v1/metrics/operations',
    rps: '/api/v1/metrics/rps',
    endpoints: '/api/v1/metrics/endpoints',
  },
  projects: {
    listMine: '/api/v1/projects',
    create: '/api/v1/projects',
    members: (projectId: string) => `/api/v1/users/${projectId}/members`,
    addMember: (projectId: string) => `/api/v1/users/${projectId}/members`,
    updateMember: (projectId: string, memberId: string) => `/api/v1/users/${projectId}/members/${memberId}`,
    removeMember: (projectId: string, memberId: string) => `/api/v1/users/${projectId}/members/${memberId}`,
  },
  logs: {
    list: '/api/v1/logs',
  },
  traces: {
    list: '/api/v1/traces',
    detail: (traceId: string) => `/api/v1/traces/${traceId}`,
  },
  rum: {
    ingest: '/api/v1/rum',
    overview: '/api/v1/rum/overview',
    series: '/api/v1/rum/series',
    paths: '/api/v1/rum/paths',
    devices: '/api/v1/rum/devices',
    geo: '/api/v1/rum/geo',
    referrers: '/api/v1/rum/referrers',
  },
  insights: {
    list: '/api/v1/insights',
  },
  keys: {
    list: '/api/v1/keys',
    stats: '/api/v1/keys/stats',
    create: '/api/v1/keys',
    revoke: (keyId: number) => `/api/v1/keys/${keyId}`,
  }
} as const;