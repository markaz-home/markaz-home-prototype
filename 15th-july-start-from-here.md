# 15 July 2026 — Current handoff

This is the current starting point for MARKAZ Home. The earlier July 15 review handoff is
superseded: its CI and self-provisioning work has landed, and today's focus was the UAE PASS
login POC plus external property data.

Current repository state: `main` is at merge commit `7c42059`; `develop` is at `00bb03f` and
contains the same release content before the `main` merge commit.

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

On 19 July, the local Supabase/Postgres stack was available and the focused real-stack listing
journey plus the complete repository verification command both passed. GitHub's protected
full-stack workflow remains the authoritative remote integration/E2E gate.

### CI follow-up started on 19 July

The repository-side deployment structure was completed and release PR
[#13](https://github.com/markaz-home/markaz-home-prototype/pull/13) was merged into `main` at
`ae4d518`. The `develop` push and the protected release pull request both passed quality, build,
Supabase integration, web E2E, and admin E2E.

The final post-merge `main` run
([GitHub Actions run 29434433191](https://github.com/markaz-home/markaz-home-prototype/actions/runs/29434433191))
is red because the existing end-to-end listing-wizard journey timed out twice. Its hard-coded
five-second URL checks failed at different transitions on each attempt (`/sell` to `/details`,
`/details` to `/ownership`, and `/ownership` to `/verification`). The remaining 55 web tests
passed, as did the database integration suite and the quality/build job. Because the same release
tree passed the full journey on both `develop` and the release PR, the evidence points to CI
navigation latency rather than a deterministic application or Bayut regression.

The focused repair landed through PR #14 into `develop`, then through PR #15 into `main`. Every URL
assertion in the full listing journey remains in place, but navigation gets an explicit shared
20-second timeout to accommodate real CI latency without hiding failed saves. Local validation
passed:

- Focused Chromium listing journey against the real local Supabase stack: 3 tests passed.
- `pnpm typecheck && pnpm lint && pnpm test && pnpm build`: passed.
- Changed-file Prettier check and `git diff --check`: passed.

The branch promotion is complete. If the journey fails again with the explicit timeout, inspect the
Playwright trace and the relevant tRPC mutation before widening any other timeout.

### Vercel/Supabase prototype deployment started on 19 July

- Created the personal Vercel Hobby project `markaz-home-web` for `apps/web` with the Next.js
  preset, Node 22, and monorepo-aware install/build settings.
- Connected `markaz-home/markaz-home-prototype` to Vercel.
- Deployed `main` to `https://markaz-home-web.vercel.app` and smoke-tested `/`, `/en`, and
  `/en/sign-in`.
- Deployed `develop` as a Vercel Preview at
  `https://markaz-home-web-git-develop-tania-goles-projects.vercel.app`. Vercel Authentication
  protects the preview URL.
- Configured Production and Preview environment-variable scopes in Vercel. Secrets were entered
  directly in Vercel and were not copied into Git or this document.
- Applied the canonical Supabase migration history to hosted `markaz-prototype` through migration
  `20260301000817_oauth_identity_email_optional.sql`.
- Updated the Supabase Auth Site URL to `https://markaz-home-web.vercel.app`.
- Registered the UAE PASS staging custom provider against hosted Supabase and confirmed the live
  sign-in screen shows **Continue with UAE PASS Staging**.
- Verified the live marketplace renders one direct MARKAZ listing plus current BayutAPI apartments
  and villas with the external-source disclosure.

This is a technical staging/prototype deployment even though Vercel calls the `main` target
“Production.” It uses one development Supabase tenant and a personal Hobby workspace; it is not an
approved customer-facing production environment.

Still required for the current web prototype: add the hosted/local redirect URL allow-list in
Supabase Auth, then test signup verification, recovery, and the full UAE PASS round trip. The
separate `apps/admin` Vercel project has not been created yet.

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
provider-neutral release process is recorded in `docs/runbooks/deployment.md`. The customer-web
prototype now has temporary Vercel hosting. The admin project, custom domains, isolated production
Supabase project, approved production region, and production infrastructure still need to be
established.

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

### 1. Finish the temporary web prototype environment

- In Supabase Authentication → URL Configuration, add the allow-list entries for the canonical web
  URL, the fixed `develop` preview alias, and localhost/127.0.0.1 development URLs.
- Test email signup/code verification, password recovery, and UAE PASS staging on the Vercel URL.
- Confirm the Vercel runtime logs contain no authentication, database, or Bayut errors.
- Create `markaz-home-admin` as a separate Vercel project rooted at `apps/admin`, then configure the
  admin URL, environment variables, Supabase redirects, and env-driven admin bootstrap.

### 2. Establish approved deployment environments

- Keep the existing protected `develop` and `main` branches aligned through release pull requests.
- Replace the temporary Hobby deployment with an approved hosting/account arrangement before any
  customer-facing production use.
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
