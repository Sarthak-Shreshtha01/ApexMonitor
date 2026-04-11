export const ENDPOINTS = {
  auth: {
    login: '/api/v1/auth/login', // [cite: 466]
    register: '/api/v1/users/register', // [cite: 466]
    refresh: '/api/v1/auth/refresh', // [cite: 466]
    logout: '/api/v1/users/logout', // [cite: 466]
  },
  user: {
    profile: '/api/v1/users/me',
  },
  metrics: {
    overview: '/api/v1/metrics/overview', // [cite: 807]
    latency: '/api/v1/metrics/latency', // [cite: 807]
    rps: '/api/v1/metrics/rps', // [cite: 807]
    endpoints: '/api/v1/metrics/endpoints', // [cite: 807]
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
  insights: {
    list: '/api/v1/insights',
  },
  keys: {
    list: '/api/v1/keys',
    create: '/api/v1/keys',
    revoke: (keyId: number) => `/api/v1/keys/${keyId}`,
  }
} as const;