# Security Model

## Principals and credentials

| Principal | Credential | Header | Verified in | Grants |
|---|---|---|---|---|
| Dashboard user | Access JWT (HS256, 15 min, `tokenType: access`) | `Authorization: Bearer` | `shared/middleware/require-auth.ts` → `shared/auth/tokens.ts#verifyAccessToken` | User APIs; project APIs after membership check |
| Dashboard user | Refresh JWT (30 days) | httpOnly cookie `refresh_token` or body | `modules/users/user.service.ts` | New token pair |
| Backend service | Ingest API key `proj_…` | `x-api-key` | `modules/auth/middleware/auth.middleware.ts#validateApiKey` | Write to `/ingest` for the key's project |
| Browser | RUM write key | `x-rum-key` + `Origin` | `#validateRumWriteKey` | Write to `/rum` from allowed origins |
| Payment provider | `X-VERIFY` signature | header | `shared/utils/phonepe.utils.ts` | Upgrade subscription |
| Socket client | Access JWT in `join` payload | n/a | `modules/websocket/websocket.service.ts` | Join project room |

## Authorisation

- **Project membership** is the tenancy boundary. `requireProjectAccess` loads the user's projects and checks the requested `projectId`; `requireOwner: true` restricts key issuance and member management to owners.
- Roles: `owner` (manages keys, members, alert rules) and `developer` (reads all project data). Enforced by Zod on the member routes and by a CHECK constraint on `project_members.role` (v9). A project always keeps at least one owner: removing or demoting the last one is refused.
- Services for `keys` and `rum` reads do their own membership checks (throw `PROJECT_ACCESS_DENIED`).

**Invariant to keep:** the project a request acts on must come from a verified credential. Dashboard routes satisfy this through `requireProjectAccess`; ingest uses the project bound to the API key and rejects a mismatching body `projectId` with 403.

## Secrets at rest

| Secret | Storage |
|---|---|
| User passwords | argon2id |
| API / RUM keys | argon2id(key + `ARGON2_PEPPER`) (64 MB memory cost); only a 10-char display prefix stored in clear. Rows are found by `key_lookup` = HMAC-SHA256 of the key with a secret derived from the pepper (`modules/auth/key-material.ts`), then verified with argon2. Validated keys are cached in Redis for 5 min under sha256(key), and revoking a key evicts it at once (`modules/auth/key-cache.ts`) |
| JWT signing | Access: `JWT_SECRET`. Refresh: `JWT_REFRESH_SECRET`, or a key derived from `JWT_SECRET` (HMAC) when unset. OAuth state: derived key. All HS256 with a `tokenType` claim checked on verify (`shared/auth/tokens.ts`) |
| OAuth / PhonePe | env vars |

## Privacy

- Client IPs in request logs: `sha256(ip:projectId:YYYY-MM-DD)`. Not reversible, but not linkable across days or projects.
- RUM visitor/session IDs: HMAC of IP + UA (+ session id) with a daily salt.
- Raw logs auto-expire after 90 days, raw RUM after 7 days. Aggregates are kept indefinitely.
- No PII fields are expected in telemetry, but `tags`, `userAgent`, and RUM `metadata` are free-form.

## Transport and HTTP hardening

- `helmet` defaults, CORS allow-list from `CORS_ORIGINS` with credentials.
- JSON body limit 2 MB; ingest batch ≤ 500 logs; RUM batch ≤ 200 events.
- Request ID on every response (`x-request-id`).

## Logs

Request logs (`shared/utils/logger.ts`) replace credentials with `[REDACTED]`: `Authorization`, `Cookie`, `x-api-key`, `x-rum-key`, `Set-Cookie`, `x-access-token`, redirect `Location`, and query parameters such as `code`, `state`, `token`, `key`. Add new credential headers to `REDACTED_LOG_PATHS`.

## Outbound webhooks

Alert webhooks go to user-supplied URLs, so they are sent only through `shared/net/webhook.ts#sendWebhook`:

- `https:` only, no credentials in the URL
- the target must be a public address: loopback, private, link-local (cloud metadata), CGNAT, multicast, reserved, NAT64/6to4 and IPv4-mapped forms of those are refused
- literal IPs are checked before connecting; hostnames are checked inside the socket's DNS lookup, so the address that was checked is the one connected to (no DNS-rebinding gap)
- redirects are not followed; 5 s timeout for the whole request

Any new outbound call to a user-supplied URL must use `sendWebhook` (or the same guards).

## Audit

`audit_logs` records sign-in/up, key create/revoke, project create, member changes, profile updates (`shared/services/audit-log.service.ts`). There's no UI or export yet.

## Open gaps

| ID | Gap |
|---|---|
| KI-17 | Tokens persisted in localStorage |
| KI-30 | No server-side route protection in web |
| n/a | `/metrics/system` is unauthenticated and exposes queue/dependency details |
| n/a | No CSRF protection on cookie-authenticated `/auth/refresh` (mitigated only by CORS) |
| n/a | No brute-force protection / lockout on login |
| n/a | No email verification; anyone can register any email |

Reporting vulnerabilities: add a `SECURITY.md` with a contact before public launch (plan Phase 6).
