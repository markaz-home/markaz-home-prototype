# 15 July 2026 — Current handoff

This is the current starting point for MARKAZ Home. The earlier July 15 review handoff is
superseded: its CI and self-provisioning work has landed, and today's focus was the UAE PASS
login POC plus external property data.

Current work branch: `codex/bayut-marketplace-polish`.

## What we achieved today

### UAE PASS staging login POC

- Added UAE PASS as an optional Supabase OAuth login method for the customer web app.
- Kept the integration server-gated and disabled by default for local/CI use.
- Implemented the PKCE callback and safe error/cancellation redirects without leaking codes or
  tokens.
- Forced a fresh UAE PASS mobile challenge for each login, as requested.
- Fixed first-login provisioning for UAE PASS identities that do not provide an email address.
- Preserved the existing MARKAZ routing gates and account types; UAE PASS is a login method, not a
  new role.
- Added configuration, callback, sign-in visibility, and routing tests plus the staging runbook.
- Confirmed a real UAE PASS staging mobile authentication reaches the MARKAZ dashboard.

Production is not enabled. It still requires official UAE PASS onboarding, production credentials,
registered production redirect URLs, attribute-policy review, and an explicit account-linking
policy.

### BayutAPI property-data POC

- Added an opt-in, server-only adapter for the unofficial BayutAPI service on RapidAPI.
- Added a fixed-host, fixed-query boundary; the API key never enters the browser bundle.
- Added a five-second timeout, stable safe error codes, an explicit public DTO allowlist, approved
  image/link hosts, and a one-hour in-memory cache.
- Added real listing images, including a safe fallback from a missing `cover_photo` to the first
  approved entry in `media.photos`.
- Changed the feed to request Dubai apartments and villas in one API call.
- Added semantic deduplication so visually equivalent units from the same community/layout do not
  occupy multiple homepage cards.
- Added round-robin category selection. The verified homepage result showed three apartments and
  three villas.
- Added property-type labels to the homepage cards.
- Extended `/properties` with a separate **Selected external properties** section. Direct MARKAZ
  listings remain distinct and continue to use the internal security-barrier marketplace view.
- Applied supported browse filters to the selected external set: text, apartment/villa, bedrooms,
  bathrooms, price, size, community, and sorting.
- Kept external listings outside MARKAZ Save and Make-an-Offer journeys. They open on Bayut in a
  new tab with the external-source disclosure.
- Added adapter and client-filter regression tests and updated the integration runbook.

This is still a development/staging POC. The provider states that it scrapes Bayut, so keep
`BAYUT_API_MODE=disabled` in production until written redistribution permission and legal approval
exist.

### Verification completed

- `pnpm typecheck` — passed.
- `pnpm lint` — passed with the repository's existing non-blocking Next.js warnings.
- `pnpm test` — passed; the Bayut adapter has 8 tests and the web external-filter coverage has 3.
- `pnpm build` — customer and admin applications passed production builds.
- Changed-file Prettier check and `git diff --check` — passed.
- Live browser verification — homepage mix, images, browse-page external section, and Villa filter
  passed with no browser errors.

The last local full test command could not reach the local Supabase/Postgres stack, so its
integration suites self-skipped. The existing GitHub full-stack workflow remains the authoritative
integration/E2E gate and should run on the pull request.

## Local environment

Secrets are stored only in the ignored root `.env`/`.env.local` files. Do not copy their values into
this document, source control, screenshots, tickets, or chat.

Required POC variables include:

```dotenv
# UAE PASS staging
UAE_PASS_MODE=staging
UAE_PASS_CLIENT_ID=...
UAE_PASS_CLIENT_SECRET=...

# BayutAPI staging POC
BAYUT_API_MODE=rapidapi
BAYUT_API_KEY=...
```

Run locally with:

```bash
pnpm supabase:start   # when auth/database flows are required
pnpm dev              # customer web :3000, admin :3001
```

The previous version of this handoff contained a local service-role value. It was removed before
this file was committed. `.env` and `.env.local` remain gitignored.

## Recommended branch and deployment model

Repository-side setup completed on 15 July: CI now runs for both long-lived branches and the
provider-neutral release process is recorded in `docs/runbooks/deployment.md`. Hosting projects,
domains, GitHub environment secrets, and production infrastructure still require a provider and
approved environment to be selected.

Use two protected long-lived branches because the project needs a shared development environment:

| Branch    | Purpose                          | Deployment                               |
| --------- | -------------------------------- | ---------------------------------------- |
| `develop` | Integrated work awaiting release | Automatic shared dev/staging deployments |
| `main`    | Release-ready code only          | Production deployments                   |

Workflow:

1. Create short-lived `feature/*`, `fix/*`, or `codex/*` branches from `develop`.
2. Open pull requests into `develop`; require quality and full-stack CI before merge.
3. Deploy every `develop` merge automatically to the shared dev environment.
4. Promote with a reviewed release pull request from `develop` to `main`.
5. Deploy production only from `main`, after staging smoke tests pass.
6. Create urgent `hotfix/*` branches from `main`, merge to `main`, then merge the fix back into
   `develop` immediately.

Protect both branches. Disable direct pushes, require pull requests and passing checks, require the
branch to be current before merging, and use squash merges for feature work. Keep `develop` close to
`main`; release frequently instead of allowing a long-lived divergence.

### Deployment topology

Recommended initial topology:

- Deploy `apps/web` and `apps/admin` as separate applications and separate domains. The customer app
  must never expose admin routes or navigation.
- Do not deploy `apps/worker` yet; it is still a documented placeholder.
- Use separate Supabase projects for development/staging and production. Never point a development
  deployment at the production database.
- Store all secrets in the deployment platform's environment settings, scoped separately to
  development and production.
- Configure Supabase Auth site URLs, allowed redirect URLs, email templates, and admin bootstrap
  credentials independently per environment.
- Apply database migrations to development first, run smoke/E2E checks, then apply the same ordered
  migration history to production with a backup and rollback plan.

Environment policy:

| Integration           | Development/staging                            | Production                                                |
| --------------------- | ---------------------------------------------- | --------------------------------------------------------- |
| Email/password auth   | Real environment-specific Supabase Auth        | Enable after email delivery and templates are verified    |
| UAE PASS              | `staging` credentials and staging redirect URI | Disabled until official production onboarding is complete |
| BayutAPI              | `rapidapi` for the private POC                 | Disabled pending permission/legal approval                |
| DLD/Trakheesi/payment | Existing persisted simulations                 | Keep simulated until separately approved and integrated   |

## Next steps

### 1. Land today's work

- Push `codex/bayut-marketplace-polish` and promote the verified commit through `develop` to `main`.
- Let the complete GitHub Actions workflow run, including Supabase integration and Playwright E2E.
- Review the Arabic copy; it is currently draft.
- Merge only after CI and review are green.

### 2. Establish deployment environments

- Create `develop` from the updated `main` after today's pull request is merged.
- Create separate dev and production deployments for both the customer and admin apps.
- Provision separate dev and production Supabase projects in an approved data region.
- Add environment variables in the hosting dashboards, never in Git.
- Configure dev domains, Supabase redirects, email redirects/templates, and UAE PASS staging redirect
  registration.
- Run migrations and the admin bootstrap in dev, then complete the auth, listing, offer, transaction,
  admin, UAE PASS, and external-property smoke checks.

### 3. Production-readiness decisions

- Decide the production hosting provider and approved data-residency region.
- Complete UAE PASS production onboarding and account-linking policy.
- Replace the unofficial BayutAPI POC with an approved/contracted property-data source, or obtain
  explicit permission to use it.
- Configure a production email provider and verify signup-code and password-recovery delivery.
- Define monitoring, error reporting, uptime checks, backups, restore drills, and secret rotation.
- Review all Arabic legal, transactional, and integration copy with the business/legal owner.

## Definition of ready for the first dev deployment

- `develop` protection and CI are enabled.
- Web/admin dev deployments use isolated environment variables and an isolated Supabase project.
- Email signup verification and password recovery work on the dev domain.
- UAE PASS staging redirect and login work on the dev domain.
- BayutAPI is explicitly marked as a non-production external POC.
- Database migrations, RLS integration tests, web/admin E2E, and smoke tests are green.
- No secret exists in Git history or client bundles.
