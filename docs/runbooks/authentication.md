# Runbook: Authentication (Local OTP via Inbucket)

Authentication is **real Supabase email OTP** (6-digit). Locally, no real email is
sent — Supabase delivers it to **Inbucket**, a local test inbox.

## Request and retrieve an OTP

1. Open the customer app at http://localhost:3000 (or admin at
   http://localhost:3001).
2. Enter an email address and request the code.
3. Open **Inbucket** at **http://127.0.0.1:54324**.
4. Open the inbox for the email you used; open the newest message.
5. Copy the **6-digit code** and enter it in the app.

OTP codes are **never built, stored, or logged by app code** — read them from
Inbucket only.

## New vs returning behavior

- **New customer:** landing → email → OTP → profile setup → **simulated UAE PASS**
  → dashboard. The UAE PASS step is simulated and sets identity status to
  `VERIFIED_DEMO`.
- **Returning verified customer** (profile complete + identity `VERIFIED_DEMO`):
  skips onboarding, goes straight to the dashboard.
- **Admin:** same OTP flow in the admin app. After auth the app loads the profile
  and requires `account_type === 'ADMIN'`; otherwise it shows an **access-denied**
  screen.

Routing is decided by `resolvePostAuthDestination` in `@markaz/domain`.

## Demo accounts (fictional, seeded)

| Account | Email | Role |
| --- | --- | --- |
| Customer A | customer-a@markaz.demo | CUSTOMER (seller in seed data) |
| Customer B | customer-b@markaz.demo | CUSTOMER (buyer in seed data) |
| Admin | admin@markaz.demo | ADMIN |

All seed accounts and data are clearly fictional. Request a code for any of these
emails and retrieve it from Inbucket.

## Demo-auth fallback

The one-click demo-auth fallback is **DISABLED** (ADR 0007). Only the env contract
exists (`DEMO_ENVIRONMENT`, `DEMO_AUTH_FALLBACK`, `DEMO_AUTH_ALLOWLIST`). Use the
real OTP flow via Inbucket.

## Troubleshooting

- **No email in Inbucket** — confirm the Supabase stack is running
  (`pnpm supabase:status`) and that Inbucket is reachable at :54324; re-request
  the code.
- **Auth provider unavailable** — restart the stack (`pnpm supabase:stop` then
  `pnpm supabase:start`).
- **Rate limit** — Supabase rate-limits OTP requests; wait before re-requesting
  rather than spamming the button.
- **Admin access-denied** — the account's `account_type` is not `ADMIN`; use
  `admin@markaz.demo` or promote via a trusted server op (never self-promotion).
