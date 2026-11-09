# 0005. OTLP as the primary ingest protocol

- **Status:** Proposed
- **Date:** 2026-11-10

## Context

Ingest accepts a custom JSON request-log format, produced by three hand-written SDKs that don't instrument any framework automatically. "Traces" are single request records without spans (KI-25). Buyers increasingly standardise on OpenTelemetry and expect any backend to accept it; maintaining instrumentations for every language and framework ourselves isn't feasible.

## Decision

- Accept **OTLP/HTTP** (protobuf and JSON) at `/v1/traces`, `/v1/metrics`, `/v1/logs`, authenticated with ingest keys. gRPC can come later.
- Map OTLP resources/spans/logs/metrics to the internal schema (`schemaVersion`ed) and the same queue pipeline.
- Derive request metrics (RED: rate, errors, duration per route) from server spans, replacing the custom request-log path over time.
- Keep `/api/v1/ingest` (custom JSON) for backward compatibility through 1.x; SDKs become thin OTel distributions or exporters.
- Document configuration for the OpenTelemetry Collector and auto-instrumentation agents per language.

## Alternatives considered

| Option | Pros | Cons |
|---|---|---|
| Keep custom JSON only | Simple | Every language/framework needs our SDK; no real tracing |
| Zipkin/Jaeger formats | Established | Traces only; OTLP supersedes them |

## Consequences

- Distributed tracing, logs, and metrics from any OTel-instrumented app on day one.
- Larger ingest surface (protobuf decoding, semantic conventions mapping).
- Storage must handle spans and attributes efficiently (ADR-0004).
