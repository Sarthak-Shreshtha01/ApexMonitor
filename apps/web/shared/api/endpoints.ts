export const ENDPOINTS = {
  auth: {
    login: '/api/v1/auth/login', // [cite: 466]
    register: '/api/v1/users/register', // [cite: 466]
    refresh: '/api/v1/auth/refresh', // [cite: 466]
    logout: '/api/v1/users/logout', // [cite: 466]
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
  },
  logs: {
    list: '/api/v1/logs',
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