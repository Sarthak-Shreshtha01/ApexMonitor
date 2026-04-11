export const ROUTES = {
  home: '/',
  auth: {
    login: '/login',
    register: '/register',
    oauthCallback: '/oauth/callback',
    verifyEmail: '/verify-email',
    forgotPassword: '/forgot-password',
    resetPassword: '/reset-password',
  },
  dashboard: {
    overview: '/overview',
    liveTraffic: '/live-traffic',
    logs: '/logs',
    webAnalytics: '/analytics',
    traces: '/traces',
    traceDetail: (traceId: string) => `/traces/${traceId}`,
    keys: '/keys',
    alerts: '/alerts',
    insights: '/ai-insights',
    billing: '/billing',
    settings: '/settings',
  },
  marketing: {
    about: '/about',
  },
  legal: {
    terms: '/terms',
    privacy: '/privacy',
  },
} as const;

export const PUBLIC_PATHS = [
  ROUTES.home,
  ROUTES.auth.login,
  ROUTES.auth.register,
  ROUTES.auth.oauthCallback,
  ROUTES.auth.verifyEmail,
  ROUTES.auth.forgotPassword,
  ROUTES.auth.resetPassword,
  ROUTES.marketing.about,
  ROUTES.legal.terms,
  ROUTES.legal.privacy,
] as const;
