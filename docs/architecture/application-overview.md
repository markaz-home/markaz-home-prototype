# Application Overview

## Product

MARKAZ Home is a property marketplace for the UAE (initial focus: Dubai). A single
customer account can both **sell** (list a property) and **buy** (browse listings,
make offers, move through a transaction). Admin operations live in a separate
application. Week 1 delivers the application **foundation**: the monorepo, shared
packages, real authentication, the database with RLS, storage, a Realtime proof,
and the documentation set.

## The two applications

| App | Purpose | Port (local) | Origin env |
| --- | --- | --- | --- |
| `apps/web` | Customer / public app — buy and sell journeys | 3000 | `NEXT_PUBLIC_WEB_URL` |
| `apps/admin` | Separate admin app — `ADMIN` account_type required | 3001 | `NEXT_PUBLIC_ADMIN_URL` |
| `apps/worker` | Durable background jobs — **placeholder only in Week 1** | — | — |

The customer app exposes **no admin routes or navigation** (ADR 0008). There are
exactly two account types, `CUSTOMER` and `ADMIN`; buyer/seller are journeys, not
roles (ADR 0002).

## Shared packages

| Package | Role |
| --- | --- |
| `@markaz/config` | Shared eslint / tsconfig / tailwind presets |
| `@markaz/ui` | shadcn/Radix-style neutral design system + tokens, RTL-safe |
| `@markaz/i18n` | next-intl (en + ar), RTL, AED currency formatting |
| `@markaz/domain` | Types, state machines, zod schemas, `resolvePostAuthDestination` |
| `@markaz/db` | Drizzle schema + postgres-js client + `withUserContext` RLS helper |
| `@markaz/auth` | Supabase SSR clients + RBAC |
| `@markaz/api` | tRPC routers + procedure tiers (`protected`/`customer`/`admin`) |
| `@markaz/realtime` | Supabase Realtime subscription hook |
| `@markaz/observability` | pino structured logging |

## Stack

Node 22, pnpm 9, Turborepo 2, TypeScript 5 (strict), Next.js 15 (App Router),
React 19, Tailwind 3.4, shadcn/Radix, next-intl 3, TanStack Query 5, tRPC 11,
Drizzle ORM 0.38 + postgres-js, Supabase (auth/realtime/storage),
react-hook-form 7 + zod 3, Vitest 2, Playwright, pino. The **Supabase CLI is a
pinned dev dependency** (run via `pnpm supabase`), not installed globally.

## Real vs simulated

**Real:**

- Supabase email OTP authentication (6-digit), `@supabase/ssr` secure cookies.
- PostgreSQL schema with Row-Level Security, triggers, and grants.
- RLS identity propagation for direct Drizzle queries (ADR 0004).
- Storage buckets with enforced access boundaries (private + public).
- Supabase Realtime end-to-end proof.

**Simulated (clearly fictional, demo only):**

- UAE PASS identity step (sets identity status to `VERIFIED_DEMO`).
- Ownership verification, Form A, and Trakheesi permit steps (part of the
  deferred listing journey).
- All seed data (Customer A / Customer B / Admin, Dubai properties/listings/
  offers/transactions) — fictional, with `@markaz.demo` emails.

## Request flow (customer)

1. Browser → Next.js App Router (`apps/web`) with `@supabase/ssr` session cookies.
2. UI calls tRPC via TanStack Query.
3. The tRPC procedure tier (`customerProcedure`) opens an **RLS-scoped
   transaction** via `withUserContext`, setting `request.jwt.claims` + role
   `authenticated` (transaction-local).
4. Drizzle queries run on `ctx.tx`; Postgres `auth.uid()` resolves and **RLS
   policies** evaluate against the real user.
5. Transaction commits; identity context vanishes.

Anonymous reads use `withAnonContext` (role `anon`, public `LIVE` data only).
Trusted server ops (migrations/seed/worker/admin maintenance) use
`withServiceContext`; the service-role key is **never** used for customer
requests.

## Week 1 scope vs deferred

**In scope (Week 1):** monorepo + shared packages, real OTP auth + onboarding
routing, profiles + marketplace schema, RLS policy set + integration-test gate,
storage buckets + boundary tests, Realtime proof, canonical migrations + seed,
documentation/ADRs, infra boundary contracts.

**Deferred:** the full property-listing wizard, the live marketplace/browse,
offers and counter-offers UX, transactions UX, durable background jobs
(`apps/worker`), and the full admin application surface.

## Platform boundary

The **platform-engineering team** owns AWS/Terraform/RDS/ECS/ECR/SES/ElastiCache/
SonarQube and the self-hosted Supabase deployment in me-central-1 (UAE). Week 1
did **not** provision AWS and does **not** claim self-hosted-Supabase-on-RDS is
validated — that is the §6A.1 gate (ADR 0006). Application development runs on
the official Supabase local Docker stack; a managed-Supabase bridge is available
for demo-only environments.
