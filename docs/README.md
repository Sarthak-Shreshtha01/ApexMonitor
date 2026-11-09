# ApexMonitor Documentation

Start with **Architecture → Overview**, then the reference page for whatever you're touching. The shipping roadmap is [`../plan.md`](../plan.md).

## Architecture: how it works today
| Doc | What's in it |
|---|---|
| [architecture/overview.md](architecture/overview.md) | System context, components, runtime processes, tech stack |
| [architecture/backend.md](architecture/backend.md) | Server boot, middleware chain, module pattern, workers, event bus, realtime |
| [architecture/data-flow.md](architecture/data-flow.md) | Sequence diagrams: ingest, RUM, queries, live traffic, alerts, auth, billing |
| [architecture/data-model.md](architecture/data-model.md) | Postgres tables, Mongo collections, Redis keys, RabbitMQ topology |
| [architecture/frontend.md](architecture/frontend.md) | Next.js app structure, routing, state, API client, realtime |
| [architecture/security.md](architecture/security.md) | Auth model, keys, tenant isolation, privacy, current gaps |
| [architecture/target-architecture.md](architecture/target-architecture.md) | Where the architecture is going and why (HLD decisions) |

## Reference: look things up
| Doc | What's in it |
|---|---|
| [reference/repository-layout.md](reference/repository-layout.md) | Every directory and key file, what it does |
| [reference/api.md](reference/api.md) | All HTTP endpoints, auth, envelopes, error codes, WebSocket events |
| [reference/configuration.md](reference/configuration.md) | Environment variables for server and web |
| [reference/sdks.md](reference/sdks.md) | TypeScript, browser, and Python SDK usage and status |

## Guides: do things
| Doc | What's in it |
|---|---|
| [guides/local-development.md](guides/local-development.md) | Set up and run everything locally |
| [guides/contributing.md](guides/contributing.md) | Branching, commits, PR checklist, code conventions |
| [guides/testing-strategy.md](guides/testing-strategy.md) | Test pyramid, tooling, what to test first |
| [guides/end-to-end-testing.md](guides/end-to-end-testing.md) | Manual end-to-end verification runbook |
| [guides/sdk-publishing.md](guides/sdk-publishing.md) | Releasing SDKs to npm and PyPI |

## Operations: run it
| Doc | What's in it |
|---|---|
| [operations/launch-readiness.md](operations/launch-readiness.md) | Security, release governance, support, final validation |
| [operations/runbooks.md](operations/runbooks.md) | What to do when a dependency or pipeline fails |

## Decisions and status
| Doc | What's in it |
|---|---|
| [adr/](adr/README.md) | Architecture Decision Records |
| [known-issues.md](known-issues.md) | Audited defects with severity and file references |

## Keeping docs honest
- Docs describe **current** behaviour unless they say otherwise (`target-architecture.md`, ADRs marked *Proposed*).
- Change the docs in the same PR as the behaviour.
- Link to source files with repo-relative paths so they stay greppable.
