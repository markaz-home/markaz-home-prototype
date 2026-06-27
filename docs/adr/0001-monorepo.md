# ADR 0001: Turborepo + pnpm Monorepo with Strict TypeScript

- **Status:** Accepted
- **Date:** 2026-03

## Context

MARKAZ Home ships two related but separately deployed Next.js applications (a
customer/public app and an admin app) that must share a large amount of code:
domain types and state machines, a design system, internationalization, a
database schema, auth, an API layer, and observability. Duplicating these across
repositories would cause drift between the apps and the database, and would make
atomic changes (e.g. a schema change plus its API and UI consumers) span multiple
pull requests across multiple repos.

We also want a single, fast, cache-aware task runner so that `lint`, `typecheck`,
`test`, and `build` run consistently and only re-run for affected packages.

## Decision

Use a single monorepo managed with **pnpm 9 workspaces** and **Turborepo 2**.

- **Apps** live under `apps/`:
  - `apps/web` — customer/public application (port 3000).
  - `apps/admin` — separate admin application (port 3001).
  - `apps/worker` — placeholder for durable background jobs (documented only in Week 1).
- **Shared packages** live under `packages/`, each scoped `@markaz/*`:
  - `@markaz/config` — shared eslint / tsconfig / tailwind presets.
  - `@markaz/ui` — shadcn-style neutral design system + tokens (RTL-safe).
  - `@markaz/i18n` — next-intl (en + ar), RTL, AED formatting.
  - `@markaz/domain` — types, state machines, zod schemas, routing decisions.
  - `@markaz/db` — Drizzle schema + client + RLS context helper.
  - `@markaz/auth` — Supabase SSR clients + RBAC.
  - `@markaz/api` — tRPC routers and procedure tiers.
  - `@markaz/realtime` — Supabase Realtime hook.
  - `@markaz/observability` — pino logging.
- **TypeScript 5** in **strict** mode across all packages, with shared base
  config from `@markaz/config`.
- Turborepo orchestrates `dev`, `build`, `lint`, `typecheck`, `test`, and
  `test:e2e` with task-level caching and dependency-aware ordering.

## Consequences

- Atomic cross-cutting changes (schema → API → UI) land in one pull request and
  stay internally consistent.
- Shared presets keep lint/TS/Tailwind behavior identical across apps.
- Turborepo caching keeps CI and local feedback fast; only affected packages
  re-run.
- The workspace requires pnpm (via Corepack or a pinned standalone install) and
  Node 22; contributors cannot use npm/yarn at the root.
- The boundary between apps is enforced by separate deployments, not just folders
  (see ADR 0008): the customer app must not import admin-only routes.
