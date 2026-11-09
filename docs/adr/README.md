# Architecture Decision Records

An ADR captures one significant decision: the context, the choice, and its consequences. They're short and immutable once **Accepted**: to change a decision, write a new ADR that supersedes the old one.

## Process

1. Copy [`template.md`](template.md) to `NNNN-short-title.md` (next number).
2. Status **Proposed**; open a PR for discussion.
3. On merge, set status **Accepted** (or **Rejected**) with the date.
4. If replaced later: set **Superseded by NNNN** and link both ways.

## Index

| # | Title | Status |
|---|---|---|
| [0001](0001-record-architecture-decisions.md) | Record architecture decisions | Accepted |
| [0002](0002-tenant-identity-from-credentials.md) | Tenant identity comes only from credentials | Proposed |
| [0003](0003-split-api-and-worker.md) | Split API and worker into separate deployables | Proposed |
| [0004](0004-telemetry-storage.md) | ClickHouse as the telemetry store | Proposed |
| [0005](0005-otlp-ingest.md) | OTLP as the primary ingest protocol | Proposed |

Decisions still needing an ADR (from [`plan.md`](../../plan.md#open-decisions-need-an-owner-and-an-adr)): distribution model, job scheduler, payment providers, licence.
