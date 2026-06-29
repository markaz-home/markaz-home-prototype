# Runbook: Authentication (Email + Password; email via Mailpit)

Authentication is **email + password** via Supabase Auth (ADR 0009). The two email
artefacts are split by purpose:

- **Six-digit email code → new-account email verification only.**
- **Official Supabase recovery LINK → Forgot Password / Reset Password.**

Neither is the sign-in credential. Locally, no real email is sent: Supabase
delivers mail to the local inbox. On newer Supabase CLIs that is **Mailpit**
(older CLIs ship **Inbucket**) at **http://127.0.0.1:54324**.

Codes, links, and tokens are **never built, stored, or logged by app code** — read
them from the inbox only.

## Sign up (new customer)

1. Open the customer app at http://localhost:3000 and go to **Sign up**.
2. Enter full name, email, password, confirm password, and accept **Terms** and
   **Privacy**. The password must meet the policy (min 8; upper, lower, number,
   special; **max 128**) — a live checklist and strength meter guide you.
3. You are routed to **verify-email**. Open the inbox at
   **http://127.0.0.1:54324**, open the newest message for your email, copy the
   **6-digit code**, and enter it.
4. Continue through the **simulated UAE PASS** step → dashboard. The normal path
   skips profile-setup (it is hydrated from sign-up metadata).

### Retrieving the code or link from Mailpit (manual)

Open http://127.0.0.1:54324, find the inbox for the email you used, open the
newest message. For **verification** read the **6-digit code**; for **recovery**
click the **"Reset your password" link**. e2e tests do this via the Mailpit API
(`GET /api/v1/search?query=to:<email>` → `GET /api/v1/message/<id>`) — extracting
the code for verification and the `token_hash` **link** for recovery.

## Sign in (returning customer)

Enter **email + password**. Wrong credentials show a single generic message —
"The email or password is incorrect." — that never reveals which field was wrong
or whether the account exists. If the email is unverified you are routed back to
**verify-email**.

## Forgot / reset password (official recovery LINK)

1. **Forgot password** → enter your email. You always see the generic "If an
   account exists…" message (this is intentional; it does not confirm whether the
   email exists).
2. Open the inbox and click the **"Reset your password" link** in the recovery
   email. (e2e tests extract the link from the email body via the Mailpit API —
   they do **not** read a code for recovery.)
3. The link opens **`/auth/confirm`**, which verifies the recovery token
   (`verifyOtp({ type:'recovery', token_hash })`) and establishes a recovery
   session, then forwards you to **`/reset-password`**.
4. **Reset password** → enter a **new password only** (there is **no code
   field**). On success you are **signed out** and sent to
   `/reset-password/success`; sign in with the new password.

If the link is missing, expired, reused, or you open `/reset-password` directly
without a recovery session, you get an **invalid-link** panel with a "Request a
new link" action — no reset happens.

Legacy passwordless accounts (from Week 1) set their **first** password through
this same Forgot Password link flow.

## Admin

The admin app (http://localhost:3001) uses **email + password** with **no public
sign-up** (`/login`, `/forgot-password`, `/reset-password`). After sign-in it
requires `account_type === 'ADMIN'`; otherwise it shows an **access-denied**
screen. Admins are created only by `pnpm db:setup` (Supabase Admin API).

Routing is decided by `resolvePostAuthDestination` in `@markaz/domain` — it gates
on email verification first, so unverified/incomplete customers never reach the
dashboard.

## Demo accounts (fictional)

| Account | Email | Local password | Type |
| --- | --- | --- | --- |
| Customer A | `customer-a@markaz.demo` | `Markaz!Demo1` | CUSTOMER (`VERIFIED_DEMO`) |
| Customer B | `customer-b@markaz.demo` | `Markaz!Demo1` | CUSTOMER (`VERIFIED_DEMO`) |
| Admin | `admin@markaz.demo` | `Markaz!Admin1` | ADMIN |

These are **local-only** credentials. Provision them with
`pnpm supabase:reset && pnpm db:setup`. Both customers are seeded `VERIFIED_DEMO`
(returning; skip onboarding). Full details, env overrides, and the production
guard are in **`demo-runbook.md`**.

## Demo-auth fallback

The one-click demo-auth fallback is **DISABLED** (ADR 0007). Only the env contract
exists (`DEMO_ENVIRONMENT`, `DEMO_AUTH_FALLBACK`, `DEMO_AUTH_ALLOWLIST`). Use the
real email/password flow.

## Troubleshooting

- **No email in the inbox** — confirm the stack is running
  (`pnpm supabase:status`) and the inbox is reachable at :54324; re-request.
- **Verification email shows a link instead of a 6-digit code** — the
  `confirmation.html` template wasn't picked up. Templates live in
  `supabase/templates/` and are wired in `supabase/config.toml`: `confirmation.html`
  carries the **code** (`{{ .Token }}`); `recovery.html` carries the **link**
  (`{{ .RedirectTo }}/auth/confirm?token_hash=…&type=recovery`). A **recovery**
  email containing a link is **correct** — only a *verification* email should show
  a code. Restart the stack and request a **fresh** email after editing templates.
- **"Email not confirmed" on sign-in** — verify the account first (the app routes
  you to verify-email); read the `confirmation` code from the inbox.
- **Rate limit** — Supabase rate-limits email sends; wait before re-requesting
  rather than spamming the button.
- **Admin access-denied** — the account's `account_type` is not `ADMIN`; use
  `admin@markaz.demo` or provision via `pnpm db:setup` (never self-promotion).
- **Auth provider unavailable** — restart the stack (`pnpm supabase:stop` then
  `pnpm supabase:start`).
