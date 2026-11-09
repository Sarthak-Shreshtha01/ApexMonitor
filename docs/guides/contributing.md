# Contributing

## Workflow

1. Pick an item from [`plan.md`](../../plan.md) or [`known-issues.md`](../known-issues.md).
2. Branch from `main`: `<type>/<short-slug>`, e.g. `fix/ingest-tenant-isolation`, `feat/alert-rules-api`.
3. Keep PRs small and single-purpose. Refactors and behaviour changes go in separate PRs.
4. Open a PR to `main`; CI must pass; at least one review.
5. Squash-merge with a Conventional Commit title.

## Commit messages

[Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<optional scope>): <imperative summary ≤72 chars>

<why the change was needed, what it does, anything surprising>

Refs: KI-2
```

Types: `feat`, `fix`, `refactor`, `perf`, `test`, `docs`, `build`, `ci`, `chore`. Scopes: `server`, `web`, `sdk`, `browser-sdk`, `python-sdk`, `infra`, `docs`.

**Attribution rule:** commit messages, PR titles/descriptions, branch names, tags, and release notes must **not** contain AI co-author trailers (e.g. `Co-Authored-By: Claude`), "Generated with …" footers, or any mention of AI assistants. Authorship is the human committer's.

## PR checklist

- [ ] Tenant ID comes from the authenticated credential, not request input
- [ ] Inputs validated with Zod; responses use `successBody` / `errorBody`
- [ ] New/changed routes reflected in `shared/constants/endpoints.ts`, [`reference/api.md`](../reference/api.md), web `shared/api/endpoints.ts`, and SDKs
- [ ] Schema change has a new migration + `init-postgres.sql` + `validate-migrations.mjs` updated, and [`data-model.md`](../architecture/data-model.md) updated
- [ ] New env vars added to the Zod config, `.env.example`, and [`configuration.md`](../reference/configuration.md)
- [ ] Tests added/updated (once the harness exists, see [testing-strategy.md](testing-strategy.md))
- [ ] Fixed known issue removed from `known-issues.md`; plan checkbox ticked
- [ ] No secrets, `.env`, or build output committed

## Code conventions

**Backend**
- Module layout: router → controller → service → repository, with `dto/` for Zod schemas.
- Use path aliases (`@modules/*`, `@shared/*`, …) rather than deep relative imports.
- Throw known error codes (see `shared/middleware/error-handler.ts`); add new ones to the map instead of writing status codes in controllers.
- Parameterised SQL only. UTC for every timestamp and bucket.
- Use the pino `logger`, not `console.*`, in new code; include `requestId` / `projectId`.
- Outbound requests to user-supplied URLs must be SSRF-guarded and time-limited.

**Frontend**
- Read `apps/web/AGENTS.md` (Next.js 16 differences).
- New domain code goes in `features/<domain>/{api,hooks,ui,state}`.
- Server data via TanStack Query hooks; don't store server data in Redux.

**SDKs**
- Never break the wire contract silently; bump versions per semver and update `scripts/sdk-conformance.mjs`.

## Documentation

Docs live in `docs/` (index: [docs/README.md](../README.md)). Update them in the same PR as the behaviour. Significant architectural choices get an ADR in `docs/adr/`.
