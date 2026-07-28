# Controlled deployment runbook

This is provider-neutral. No hosting provider, production topology, or deployment workflow is
configured, and this runbook does not authorize a public launch.

## 1. Prerequisites

- Approved release SHA/tag, change ticket, release owner, rollback owner, maintenance/write plan.
- Selected Node 22/pnpm 9 hosting for two separate apps.
- Isolated database/Supabase/Auth/Storage and approved region/data residency.
- HTTPS web/Admin origins, DNS/TLS, secret store, email, monitoring/alerts, backup and restore proof.
- Named Product, Engineering, QA, Design, Security, and Release decision.

## 2. Configure

Populate the platform store from `ENVIRONMENT-VARIABLES.md`; do not copy local/hosted `.env` files.
Keep Bayut disabled and UAE PASS simulated unless the relevant non-production approval exists.

```bash
pnpm install --frozen-lockfile
pnpm config:check
pnpm security:secrets
```

Configure exact Auth Site URL/redirects, password/session/rate-limit policy, sender/domain/templates,
and the four Storage buckets. Confirm the platform enforces the repository's response headers.

## 3. Validate the exact release

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
pnpm security:audit
```

Core skips/failures, dependency high/critical findings without approved disposition, or mismatched
artifacts are no-go.

## 4. Database and Storage

Take verified database and Storage backups. Review/apply canonical migrations using
`DIRECT_DATABASE_URL`:

```bash
pnpm db:migrate
```

Verify migration history, RLS, grants, bucket visibility/MIME/size rules, private signed URLs, public
publication reads, and backup checkpoint. Do not run a shared demo seed.

## 5. Bootstrap and deploy

1. Temporarily inject Admin bootstrap email/password; run `pnpm db:setup`; verify and remove/rotate.
2. Build/deploy customer app from `apps/web` with the customer origin.
3. Build/deploy Admin app from `apps/admin` with the separate Admin origin and tighter access policy
   where the selected provider supports it.
4. Do **not** deploy `apps/worker`; it is a placeholder with no production job contract.
5. Deploy the exact tested commit and record artifact IDs/digests.

Workspace build/start commands:

```bash
pnpm --filter @markaz/web build
pnpm --filter @markaz/web start
pnpm --filter @markaz/admin build
pnpm --filter @markaz/admin start
```

## 6. Smoke and observe

Execute `docs/runbooks/smoke-tests.md`. Verify headers, redirects, Auth/email, customer/Admin
separation, marketplace, one controlled listing/offer/transaction path, Admin queues/audit, Storage
privacy, logs/metrics/errors, backup health, and absence of secret leakage. Clean up fictional data
through approved flows.

## 7. Known warnings/troubleshooting

- Supabase/Next Edge-runtime warning: verify middleware on the selected runtime; treat new runtime
  errors as a rollback trigger.
- Wrong callbacks/cookie domain: stop; correct Auth configuration rather than bypassing verification.
- Migration failure/drift: stop traffic/change, preserve evidence, follow backup/restore; never edit
  an applied migration.
- Private Storage exposure or missing audit: stop/rollback immediately and begin Security response.
- UAE PASS staging requires issued credentials/app; production UAE PASS is out of scope.
- Email, monitoring, backup/PITR, dependency audit, and Arabic/legal review are external gates.

Rollback: `ROLLBACK-RUNBOOK.md`.
