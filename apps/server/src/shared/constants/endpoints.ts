export const API_PREFIX = '/api/v1';
export const HEALTH_ENDPOINT = '/health';

export const SERVER_ENDPOINTS = {
  modules: {
    auth: '/auth',
    ingest: '/ingest',
    metrics: '/metrics',
    users: '/users',
    billing: '/billing',
    projects: '/projects',
    logs: '/logs',
    insights: '/insights',
    keys: '/keys',
    traces: '/traces',
  },
  auth: {
    login: '/login',
    refresh: '/refresh',
    logout: '/logout',
    keys: '/keys',
  },
  users: {
    register: '/register',
    login: '/login',
    logout: '/logout',
    me: '/me',
    members: '/:projectId/members',
    member: '/:projectId/members/:memberId',
  },
  metrics: {
    overview: '/overview',
    latency: '/latency',
  },
  ingest: {
    root: '/',
  },
  logs: {
    root: '/',
  },
  insights: {
    root: '/',
  },
  projects: {
    root: '/',
  },
  billing: {
    checkout: '/checkout',
    webhookPhonePe: '/webhook/phonepe',
  },
  keys: {
    root: '/',
    key: '/:keyId',
  },
  traces: {
    root: '/',
    detail: '/:traceId',
  },
} as const;
