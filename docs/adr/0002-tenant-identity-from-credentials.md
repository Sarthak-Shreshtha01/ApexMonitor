# 0002. Tenant identity comes only from credentials

- **Status:** Proposed
- **Date:** 2026-11-10

## Context

Log ingest accepts `projectId` in the request body and never compares it with the project bound to the API key (KI-2), so any key holder can write into any project. Dashboard routes avoid this only because each router remembers to add `requireProjectAccess`. Some services re-check membership themselves; others rely on middleware. The rule is enforced by convention, not structure.

## Decision

1. Every authenticated request resolves to a **tenant context** `{ orgId, projectId?, environment?, principal, scopes }` derived solely from the verified credential (API key → its project; JWT → user, plus a membership check for the requested project).
2. Handlers and services receive the tenant context as an argument. They never read tenant IDs from body/query for authorisation decisions.
3. Request fields that name a tenant (e.g. ingest `projectId`) are either removed from the contract or must equal the context value (otherwise 403).
4. Repositories require `projectId` (or `orgId`) as a mandatory parameter on every query; there are no unscoped telemetry queries.
5. An automated security test suite asserts cross-tenant denial for every route.
6. Defence in depth (later): Postgres row-level security on metadata tables.

## Alternatives considered

| Option | Pros | Cons |
|---|---|---|
| Keep per-route middleware convention | No refactor | Already failed once; easy to forget on new routes |
| Separate DB per tenant | Strong isolation | Operationally heavy; poor fit for SaaS with many small tenants |

## Consequences

- Fixes KI-2 and prevents its class of bug.
- Ingest DTO loses the authoritative `projectId`; SDKs must tolerate this (keep the field optional for one minor version).
- Small refactor of controller/service signatures.
