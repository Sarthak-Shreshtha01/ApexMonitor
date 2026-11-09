# 0001. Record architecture decisions

- **Status:** Accepted
- **Date:** 2026-11-10

## Context

ApexMonitor is moving from prototype to a product others will deploy and pay for. Several foundational choices (storage, process topology, ingest protocol, tenancy) are pending, and earlier choices were made implicitly in code. New contributors and future maintainers need to know *why* the system is shaped the way it is.

## Decision

We will record significant architectural decisions as ADRs in `docs/adr/`, using `template.md`. A decision is "significant" if it is costly to reverse, affects more than one app/package, or changes an external contract (API, SDK, data retention, security model).

## Consequences

- Decisions get discussed in PRs before code is written.
- `docs/architecture/target-architecture.md` links to ADRs instead of restating rationale.
- Small overhead per decision (~30 minutes to write).
