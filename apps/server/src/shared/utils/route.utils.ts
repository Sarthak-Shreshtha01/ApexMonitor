/**
 * Turns a concrete request path into a route template so metrics group by route, not by
 * every distinct URL:  /orders/1042?expand=items  →  /orders/:id
 *
 * - query string and fragment are dropped
 * - repeated slashes collapse, a trailing slash is removed
 * - only WHOLE segments that look like identifiers become `:id` (so `/auth/2fa/setup` and
 *   `/v2/items` stay as they are)
 * - absolute URLs keep only their path
 */
const ID_SEGMENT = [
  /^\d+$/, // 1042
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, // UUID
  /^[0-9a-f]{24}$/i, // MongoDB ObjectId
  /^[0-9A-HJKMNP-TV-Z]{26}$/, // ULID
  /^(?=.*\d)[0-9a-f]{16,}$/i, // long hex: hashes, tokens
];

export function normalizeRoute(raw: string): string {
  let path = String(raw ?? '').trim();
  if (/^https?:\/\//i.test(path)) {
    try {
      path = new URL(path).pathname;
    } catch {
      // keep as-is; treated as a path below
    }
  }
  path = path.split(/[?#]/, 1)[0];

  const segments = path
    .split('/')
    .filter((segment) => segment.length > 0)
    .map((segment) => (ID_SEGMENT.some((re) => re.test(segment)) ? ':id' : segment));

  return `/${segments.join('/')}`;
}
