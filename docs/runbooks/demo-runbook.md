# Runbook: Demo Accounts & Provisioning

Demo accounts and demo domain data are provisioned by a script that uses the
Supabase **Admin API** — **not** by `supabase/seed.sql`. Writing Auth tables via
SQL is unsupported, so `seed.sql` is intentionally minimal and the Auth users
come from `packages/db/src/scripts/setup-demo.ts` (run via `pnpm db:setup`).

## The three demo accounts

| Account | Email | Type | State |
| --- | --- | --- | --- |
| Customer A | `customer-a@markaz.demo` | CUSTOMER | seeded `VERIFIED_DEMO` (returning; skips onboarding) — seller in demo data |
| Customer B | `customer-b@markaz.demo` | CUSTOMER | seeded `VERIFIED_DEMO` (returning; skips onboarding) — buyer in demo data |
| Admin | `admin@markaz.demo` | ADMIN | promoted to `ADMIN` after creation |

All three are clearly **fictional**. Their Auth user IDs are **random UUIDs**
(Admin-API generated), so tests and tooling resolve them **by email**, never by a
hard-coded ID.

## Local credentials (local/demo only — never production)

| Email | Default password | Env override |
| --- | --- | --- |
| `customer-a@markaz.demo` | `Markaz!Demo1` | `DEMO_CUSTOMER_A_PASSWORD` |
| `customer-b@markaz.demo` | `Markaz!Demo1` | `DEMO_CUSTOMER_B_PASSWORD` |
| `admin@markaz.demo` | `Markaz!Admin1` | `DEMO_ADMIN_PASSWORD` |

These are **local development credentials only**. They are safe to document
because they exist solely on a local/demo stack. **Never** reuse them, or any
real password, for a production or internet-reachable environment.

## How to provision

```bash
pnpm supabase:reset    # drop + re-apply migrations + (minimal) seed
pnpm db:setup          # create demo Auth users via the Admin API + seed demo data
```

`pnpm db:setup` runs `setup-demo.ts`, which:

1. Creates Customer A, Customer B, and Admin via `auth.admin.createUser`
   (`email_confirm: true`, passwords from the `DEMO_*` env above with the local
   defaults, plus profile metadata) — **idempotently** (safe to re-run).
2. Promotes the admin to `account_type = 'ADMIN'` and marks both customers
   `VERIFIED_DEMO`.
3. Seeds the fictional demo domain data (Dubai properties, listings, offers,
   transactions) via the direct DB connection.

## Production guard

`setup-demo.ts` **refuses to run** when `DEMO_ENVIRONMENT=production` **or**
`NODE_ENV=production`. It cannot create demo Auth users or demo data in a
production-flagged environment.

## How to reset

Re-run the same two commands to get a clean, deterministic state:

```bash
pnpm supabase:reset && pnpm db:setup
```

`supabase:reset` wipes the database (including the previous demo Auth users);
`db:setup` recreates everything. Because the script is idempotent, re-running
`pnpm db:setup` without a reset is also safe — it reconciles rather than
duplicates.

## Week 2 listing scenarios (seeded)

`pnpm db:setup` seeds fictional listing-journey drafts for the wizard (`/sell`):
Customer A has an **incomplete draft**, a **verification-pending** draft, and a
**`READY_TO_PUBLISH`** listing (full simulated records + Investment Case); Customer B
has a separate draft used by isolation tests. All assets are fictional; storage paths
are placeholders (no real files). Reset with `pnpm supabase:reset && pnpm db:setup`.

## Week 3 publication and marketplace scenarios (seeded)

`pnpm db:setup` also seeds Week 3 publication and marketplace fixtures:

- **LIVE listings** — Customer A has at least one listing that has passed the
  publication pipeline and is in `state = 'LIVE'`, visible in the marketplace.
- **Paused listing** — one of Customer A's LIVE listings is `PAUSED`, absent from
  the marketplace browse and treated as unavailable by saved-property stubs.
- **Saved properties** — Customer B has saved listings covering both the
  **available** (LIVE) and **unavailable** (PAUSED / non-LIVE) cases for the saved
  list view (§29).
- **Returned / photo-failure publication** — a publication request seeded as
  `REJECTED_DEMO` with `outcome_category = 'DEMO_REVIEW_RETURNED'` and one with
  `PHOTO_PROCESSING_FAILED` so the retry and failure-recovery screens can be
  exercised.

All publication fixtures are **simulated** — no real regulatory review, government,
legal, payment, or transaction integration is performed. Reset with
`pnpm supabase:reset && pnpm db:setup`.

## Notes

- Both customers are **CUSTOMER** type; there is no demo seller/buyer _role_ —
  buyer/seller are journeys, not roles.
- The Admin account can be created **only** by this script; there is no public
  admin sign-up.
- Sign in to the demo accounts with the credentials above (email + password). To
  exercise sign-up / verification / recovery manually, use a fresh email and the
  local mail inbox: read the **6-digit code** for new-account verification, and
  click the **recovery link** for Forgot/Reset password — see `authentication.md`.
