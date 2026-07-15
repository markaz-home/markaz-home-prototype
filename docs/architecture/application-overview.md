# Application Overview

## Product

MARKAZ Home is a property marketplace for the UAE (initial focus: Dubai). A single
customer account can both **sell** (list a property) and **buy** (browse listings,
make offers, move through a transaction). Admin operations live in a separate
application. The prototype spans **Weeks 1–6**: the application foundation (monorepo,
shared packages, real auth + onboarding, the database with RLS, storage, a Realtime
proof), the listing wizard, publication + the public marketplace, non-binding offers
and negotiation, simulated transactions, and a separate admin operations portal. Only
the regulated integrations (UAE PASS, DLD, Trakheesi, payment) are simulated, behind
named interfaces with persisted outcomes.

## The two applications

| App           | Purpose                                                        | Port (local) | Origin env              |
| ------------- | -------------------------------------------------------------- | ------------ | ----------------------- |
| `apps/web`    | Customer / public app — buy and sell journeys                  | 3000         | `NEXT_PUBLIC_WEB_URL`   |
| `apps/admin`  | Separate admin app — `ADMIN` account_type required             | 3001         | `NEXT_PUBLIC_ADMIN_URL` |
| `apps/worker` | Durable background jobs — **placeholder only** (not yet built) | —            | —                       |

The customer app exposes **no admin routes or navigation** (ADR 0008). There are
exactly two account types, `CUSTOMER` and `ADMIN`; buyer/seller are journeys, not
roles (ADR 0002).

## Shared packages

| Package                 | Role                                                               |
| ----------------------- | ------------------------------------------------------------------ |
| `@markaz/config`        | Shared eslint / tsconfig / tailwind presets                        |
| `@markaz/ui`            | shadcn/Radix-style neutral design system + tokens, RTL-safe        |
| `@markaz/i18n`          | next-intl (en + ar), RTL, AED currency formatting                  |
| `@markaz/domain`        | Types, state machines, zod schemas, `resolvePostAuthDestination`   |
| `@markaz/db`            | Drizzle schema + postgres-js client + `withUserContext` RLS helper |
| `@markaz/auth`          | Supabase SSR clients + RBAC                                        |
| `@markaz/api`           | tRPC routers + procedure tiers (`protected`/`customer`/`admin`)    |
| `@markaz/realtime`      | Supabase Realtime subscription hook                                |
| `@markaz/observability` | pino structured logging                                            |

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

**Simulated (clearly fictional, behind named interfaces with persisted outcomes):**

- UAE PASS identity step (sets identity status to `VERIFIED_DEMO`).
- Ownership verification, Form A, and Trakheesi permit steps of the listing journey
  (failures stay recoverable — recorded `FAILED_DEMO`, never `REJECTED`).
- DLD title transfer, escrow/deposit, and payment in the transaction workspace — no
  real money, escrow, or ownership transfer.

No demo customers or demo domain data are seeded — customers sign up through the app;
`pnpm db:setup` optionally bootstraps a single admin via the Supabase Admin API.

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

## Scope (Weeks 1–6) vs deferred

**Built:** the application foundation (monorepo + shared packages, real email +
password auth with a 6-digit signup code + onboarding routing, profiles + marketplace
schema, RLS policy set + integration-test gate, storage buckets + boundary tests,
Realtime proof, canonical migrations), the property-listing wizard, publication + the
public marketplace, non-binding offers and negotiation, the simulated transaction
workspace, and the separate admin operations portal.

**Deferred:** durable background jobs (`apps/worker`), any AWS provisioning, real
DLD/Trakheesi/Madmoun/payment integrations, free-form messaging/chat, contact
exchange, and map search.

## Platform boundary

The **platform-engineering team** owns AWS/Terraform/RDS/ECS/ECR/SES/ElastiCache/
SonarQube and the self-hosted Supabase deployment in me-central-1 (UAE). Week 1
did **not** provision AWS and does **not** claim self-hosted-Supabase-on-RDS is
validated — that is the §6A.1 gate (ADR 0006). Application development runs on
the official Supabase local Docker stack; a managed-Supabase bridge is available
for demo-only environments.
