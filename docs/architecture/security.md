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
- Roles: `owner`, `developer` (in `project_members.role`).
- Services for `keys` and `rum` reads do their own membership checks (throw `PROJECT_ACCESS_DENIED`).

**Invariant to keep:** the project a request acts on must come from a verified credential. Dashboard routes satisfy this through `requireProjectAccess`; ingest uses the project bound to the API key and rejects a mismatching body `projectId` with 403.

## Secrets at rest

| Secret | Storage |
|---|---|
| User passwords | argon2id |
| API / RUM keys | argon2id(key + `ARGON2_PEPPER`) (64 MB memory cost); only a 10-char prefix stored in clear |
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

## Audit

`audit_logs` records sign-in/up, key create/revoke, project create, member changes, profile updates (`shared/services/audit-log.service.ts`). There's no UI or export yet.

## Open gaps

| ID | Gap |
|---|---|
| KI-4 | OAuth tokens in redirect URL |
| KI-35 | Access and refresh tokens written to request logs |
| KI-5 | Revoked keys valid ≤5 min; raw keys used as Redis key names |
| KI-6 | Webhook SSRF |
| KI-7 | Payment sandbox fallbacks |
| KI-17 | Tokens persisted in localStorage |
| KI-30 | No server-side route protection in web |
| n/a | `/metrics/system` is unauthenticated and exposes queue/dependency details |
| n/a | No CSRF protection on cookie-authenticated `/auth/refresh` (mitigated only by CORS) |
| n/a | No brute-force protection / lockout on login |
| n/a | No email verification; anyone can register any email |

Reporting vulnerabilities: add a `SECURITY.md` with a contact before public launch (plan Phase 6).
