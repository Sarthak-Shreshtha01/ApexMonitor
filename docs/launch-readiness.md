# Launch Readiness

This document captures the operational rules for shipping ApexMonitor to an actual startup.

## Security and Compliance

- Audit logging is stored in `audit_logs` with actor, project, resource, and metadata fields.
- Sensitive events that should be audited include sign-in, sign-up, key creation, key revocation, project creation, member changes, and profile updates.
- API keys and RUM keys are never stored in plaintext after issuance.
- Raw telemetry IP addresses are hashed before persistence.
- Default project posture remains free for now; no paid-plan enforcement is enabled.
- Retention defaults stay at 90 days for project data unless a customer contract says otherwise.

### Secret and Key Rotation

- Rotate JWT and webhook secrets on a fixed schedule.
- Rotate API and RUM keys on a customer-controlled schedule.
- Revoke and reissue keys when a secret leak, contractor handoff, or environment compromise occurs.
- Keep a documented break-glass path for emergency secret replacement.

### Retention and Delete Policy

- Keep raw logs and raw RUM data bounded by retention policy.
- Delete or archive customer data when the retention window expires.
- Honor user and customer deletion requests by removing or anonymizing user-linked data where the schema allows it.
- Keep compliance decisions documented per environment and per tenant.

### Backup and Restore

- Back up PostgreSQL, MongoDB, and Redis state on a daily schedule.
- Test restore into a non-production environment before launch.
- Confirm point-in-time recovery works for PostgreSQL and that raw event stores can be restored without schema drift.
- Keep a restore checklist and a recovery-time target.

## Release Governance

- CI must run migration validation, backend build, web build, SDK build, and SDK conformance checks.
- Release workflow must require an explicit `release_version` input.
- Release scripts must fail if package versions do not match the requested version.
- Keep changelog updates in the same PR as code changes.
- Do not publish SDKs unless builds and conformance pass.
- Keep rollback simple: publish a corrected patch version and retain the prior package version for consumers.

### Environment Promotion Rules

- Promote only from passing CI.
- Keep development, staging, and production separate.
- Require migration validation before any database-affecting deployment.
- Use a canary or small tenant rollout before moving to wider production usage.

## Support and Incident Workflow

- Define severity levels: SEV-1 for outage, SEV-2 for major degradation, SEV-3 for partial impact, SEV-4 for minor issues.
- Route SEV-1 and SEV-2 alerts to the on-call owner immediately.
- Support escalates product-impacting issues to engineering with request IDs, tenant IDs, and timestamps.
- Post customer-visible outage updates quickly, then update status until resolution.
- Keep an incident timeline, root cause, fix, and prevention action for every meaningful outage.

### Customer Communication

- Use one customer-facing status channel.
- Acknowledge the issue early, even before root cause is known.
- Tell customers what is impacted, what is not, and the next update time.
- Close the incident only after validation and monitoring confirm stability.

## Final Production Validation

Before broad launch:

1. Run load tests against ingest, metrics, logs, and websocket fan-out.
2. Run failure drills for Redis, RabbitMQ, MongoDB, and PostgreSQL.
3. Run a backup and restore test into a clean environment.
4. Dogfood the product with one real tenant before broader rollout.
5. Confirm audit logs, alerts, and incident routing work in the live environment.

## Free Usage Policy

The product stays free for now.

- No paid-plan enforcement gate is enabled.
- Default project creation remains on the `free` plan.
- Usage controls exist for safety and abuse prevention, not monetization.
- Billing can remain available as a future capability, but it should not block onboarding or telemetry collection during the free launch phase.