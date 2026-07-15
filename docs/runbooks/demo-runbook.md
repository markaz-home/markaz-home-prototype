# Runbook: Accounts & Provisioning

The prototype uses **real accounts**. Customers **sign up through the app** (email +
password + 6-digit email verification); the `handle_new_user` trigger creates each
`profiles` row automatically. **No demo customers or demo domain data are seeded**, so a
deployment works out of the box with real accounts and needs no provisioning step.

`supabase/seed.sql` is intentionally minimal. `pnpm db:setup`
(`packages/db/src/scripts/setup-demo.ts`) is now an **optional, env-driven admin
bootstrap** only — because admins can never self-sign-up (no public admin sign-up).

## Create your own accounts (customers)

1. Start the stack + app, open the web app, and use **Sign up**.
2. Enter any email + a policy-compliant password, then read the **6-digit code** from the
   local mail inbox (Mailpit, http://127.0.0.1:54324) to verify, and complete onboarding.
3. Repeat for as many people as you like — each is an independent `CUSTOMER` who can both
   buy and sell. Buyer/Seller are journeys, not roles.

For Forgot/Reset password, use the **recovery link** from the inbox — see
`authentication.md`.

## Bootstrap an admin (optional)

Admins exist only if you create one explicitly:

```bash
BOOTSTRAP_ADMIN_EMAIL=you@example.com \
BOOTSTRAP_ADMIN_PASSWORD='a-strong-password' \
pnpm db:setup
```

This creates (or idempotently updates) one Auth user via the Supabase **Admin API**
(email pre-confirmed) and promotes its profile to `account_type = 'ADMIN'`. Sign in to the
admin app (port 3001) with it. With **no** `BOOTSTRAP_ADMIN_EMAIL` set, `pnpm db:setup` is a
**no-op** and seeds nothing.

> Never reuse a real/production password on a local or internet-reachable demo stack.

## Reset

```bash
pnpm supabase:reset        # drop + re-apply migrations (no seeded accounts)
```

Then sign up fresh accounts in the app. Re-run the admin bootstrap above only if you want
an admin again (it is idempotent).

## Notes

- Account types are only `CUSTOMER` and `ADMIN`. Customers can never self-promote to admin
  (DB trigger + RLS).
- Nothing here performs real regulatory review, government, legal, payment, or transaction
  integration — the UAE-PASS / DLD / Trakheesi / publication / offer flows are simulated.
