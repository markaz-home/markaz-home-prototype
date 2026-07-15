# Deployment and release runbook

This runbook defines the repository-side deployment structure for MARKAZ Home. It is
provider-neutral because the production hosting platform and approved UAE data-residency
architecture have not yet been selected. Do not add provider credentials or production secrets to
this repository.

## Branch and environment mapping

| Git branch | GitHub environment | Purpose                                         | Deployment behavior                                  |
| ---------- | ------------------ | ----------------------------------------------- | ---------------------------------------------------- |
| `develop`  | `development`      | Integrated release candidate and shared testing | Deploy automatically after CI succeeds               |
| `main`     | `production`       | Reviewed, release-ready code                    | Deploy only after CI and production approval succeed |

Short-lived `feature/*`, `fix/*`, and `codex/*` branches do not deploy to shared environments. They
must open a pull request into `develop`. Promote an approved release from `develop` to `main` with a
pull request. Hotfixes branch from `main` and must be merged back into `develop` after release.

Protect both long-lived branches in GitHub:

- require a pull request and an up-to-date branch;
- require `quality (no Docker)` and `full-stack (Supabase + integration + E2E)`;
- prevent force pushes and branch deletion;
- use squash merges for feature work;
- require a production-environment approval before the `main` deployment job runs.

The CI workflow runs on pull requests and pushes to both `develop` and `main`. A hosting workflow
must not be added until the provider is selected; connect deployments to successful CI, never to an
unchecked branch push.

## Application topology

Deploy the monorepo as two applications with separate origins:

| Application      | Workspace    | Development example    | Production example |
| ---------------- | ------------ | ---------------------- | ------------------ |
| Customer/public  | `apps/web`   | `dev.example.ae`       | `example.ae`       |
| Admin operations | `apps/admin` | `admin.dev.example.ae` | `admin.example.ae` |

The examples are placeholders, not approved domains. The customer app must never expose an admin
route or navigation item. Do not deploy `apps/worker`; it remains a placeholder.

From the monorepo root, the provider should install with `pnpm install --frozen-lockfile` and build
the selected workspace with one of:

```bash
pnpm --filter @markaz/web build
pnpm --filter @markaz/admin build
```

Both applications require Node.js 22 and pnpm 9.15.4.

## Environment isolation

Create separate secret sets and database/auth/storage environments for `development` and
`production`. A development deployment must never connect to production Supabase or PostgreSQL.

At minimum, configure each environment independently with the variables documented in
`.env.example` and `infra/environment-contract.md`:

- public app URLs and Supabase URL/anon key;
- pooled application and direct migration database URLs;
- service-role key for trusted server operations only;
- admin bootstrap credentials, used once and then rotated or removed;
- integration modes and server-only credentials.

Never expose `DATABASE_URL`, `DIRECT_DATABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
`UAE_PASS_CLIENT_SECRET`, or `BAYUT_API_KEY` through a `NEXT_PUBLIC_` variable. Store values in the
hosting platform or GitHub environment secrets, not in Git.

Integration policy:

| Integration             | `development`                                      | `production`                                               |
| ----------------------- | -------------------------------------------------- | ---------------------------------------------------------- |
| Email/password          | Environment-specific real delivery                 | Enable after template and delivery verification            |
| UAE PASS                | Staging tenant and registered development callback | Disabled until production onboarding and URLs are approved |
| BayutAPI                | Private RapidAPI POC only                          | Disabled until redistribution permission/legal approval    |
| DLD, Trakheesi, payment | Existing persisted simulation                      | Keep simulated until separately approved                   |

## First development deployment

1. Select an approved hosting provider and create separate web/admin projects from this repository.
2. Provision an isolated development Supabase project or the approved UAE-hosted equivalent.
3. Add the `development` environment variables to the hosting platform.
4. Set the customer and admin site/redirect URLs in Supabase Auth.
5. Apply the canonical migrations using `DIRECT_DATABASE_URL`.
6. Run `pnpm db:setup` only when the development admin bootstrap variables are intentionally set.
7. Configure UAE PASS staging with the hosted Supabase callback and run `pnpm db:setup-uae-pass`.
8. Deploy from `develop`, then smoke-test signup code, password recovery, UAE PASS, marketplace,
   listing, offers, transactions, admin access, and Arabic/RTL rendering.

## Production promotion

1. Confirm `develop` CI and the development smoke tests are green.
2. Back up production and review the pending canonical SQL migrations.
3. Open and approve a release pull request from `develop` to `main`.
4. Apply migrations through the direct database connection before shifting traffic to code that
   requires them.
5. Deploy the web and admin applications from the exact `main` commit.
6. Run read-only and low-risk smoke tests, verify monitoring, and record the release commit.

Do not enable UAE PASS production or external property data merely because the application deploys.
Each integration retains its own approval gate.

## Rollback

- Roll application code back to the previous known-good `main` commit through the hosting platform.
- Prefer forward-fixing database changes. Every production migration needs a reviewed recovery plan;
  do not run destructive down migrations against user data without explicit approval and a backup.
- Rotate any credential suspected of exposure and redeploy both applications if they share it.
- Pause an affected external integration by switching its mode to the documented disabled/simulated
  value while the incident is investigated.
