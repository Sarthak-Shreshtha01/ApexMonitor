import pino from 'pino';
import type { Options as HttpLoggerOptions } from 'pino-http';
import { config } from '@config';

/**
 * Header values that are credentials. Anyone who can read logs must not be able to
 * reuse them, so they are replaced with "[REDACTED]" wherever a req/res is logged.
 */
export const REDACTED_LOG_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-api-key"]',
  'req.headers["x-rum-key"]',
  'req.headers["x-access-token"]',
  'req.headers["x-refresh-token"]',
  'res.headers["set-cookie"]',
  'res.headers["x-access-token"]',
  'res.headers["x-refresh-token"]',
  'res.headers.location', // OAuth redirects
];

/** Query-string parameters that carry secrets (OAuth codes, tokens, keys). */
const SECRET_QUERY_PARAMS = /^(code|state|token|access_?token|refresh_?token|id_?token|api_?key|key|password|secret)$/i;

/** Replaces the values of secret-looking query parameters in a URL path such as `/cb?code=abc`. */
export function redactUrl(url: string | undefined): string | undefined {
  if (!url || !url.includes('?')) return url;
  const [path, query] = url.split('?', 2);
  const params = new URLSearchParams(query);
  let changed = false;
  for (const key of [...params.keys()]) {
    if (SECRET_QUERY_PARAMS.test(key)) {
      params.set(key, '[REDACTED]');
      changed = true;
    }
  }
  return changed ? `${path}?${params.toString()}` : url;
}

export function createLogger(destination?: pino.DestinationStream) {
  return pino(
    {
      level: config.LOG_LEVEL,
      base: { service: 'apexmonitor-server' },
      redact: { paths: REDACTED_LOG_PATHS, censor: '[REDACTED]' },
    },
    destination,
  );
}

export const logger = createLogger();

/** Options for pino-http: secrets are stripped from headers (via `redact`) and from query strings. */
export function httpLoggerOptions(base: pino.Logger = logger): HttpLoggerOptions {
  return {
    logger: base,
    serializers: {
      req(req: { url?: string; query?: Record<string, unknown> }) {
        req.url = redactUrl(req.url);
        if (req.query && typeof req.query === 'object') {
          req.query = Object.fromEntries(
            Object.entries(req.query).map(([k, v]) => [k, SECRET_QUERY_PARAMS.test(k) ? '[REDACTED]' : v]),
          );
        }
        return req;
      },
    },
  };
}
