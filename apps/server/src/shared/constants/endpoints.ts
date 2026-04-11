export const API_PREFIX = '/api/v1';
export const HEALTH_ENDPOINT = '/health';

export const SERVER_ENDPOINTS = {
  modules: {
    auth: '/auth',
    ingest: '/ingest',
    rum: '/rum',
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
    rumKeys: '/rum-keys',
    oauthStart: '/oauth/:provider/start',
    oauthCallback: '/oauth/:provider/callback',
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
    operations: '/operations',
  },
  ingest: {
    root: '/',
  },
  rum: {
    root: '/',
    overview: '/overview',
    series: '/series',
    paths: '/paths',
    devices: '/devices',
    geo: '/geo',
    referrers: '/referrers',
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
    stats: '/stats',
    key: '/:keyId',
  },
  traces: {
    root: '/',
    detail: '/:traceId',
  },
} as const;
