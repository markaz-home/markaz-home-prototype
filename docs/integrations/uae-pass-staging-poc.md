# UAE PASS Staging — Proof of Concept

> **STAGING / POC ONLY.** This is a **test-environment** integration. It is **not**
> production identity verification, **not** "government verified", and **does not
> verify property ownership**. UAE PASS confirms identity only.

UAE PASS is an optional **account-creation and sign-in method**. A new customer may start
with UAE PASS, review the approved profile details MARKAZ received, and accept MARKAZ
Terms/Privacy. Existing email/password customers may still link UAE PASS from
**Profile → Sign-in methods**. UAE PASS is never a mandatory onboarding checkpoint.

## How it works (architecture)

UAE PASS is registered with **Supabase Auth (GoTrue) as a Custom OAuth2 provider**
(`custom:uae-pass`). Supabase performs the OAuth code → token → UserInfo exchange and
issues a **standard Supabase session**, so `auth.uid()` and RLS work exactly as for
email/password. We do **not** hand-roll a session, mint custom JWTs, or use the
service-role key during login.

```
Sign Up or Sign In → "Continue with UAE PASS Staging"
  → supabase.auth.signInWithOAuth({ provider: 'custom:uae-pass' })
  → GoTrue /authorize?provider=custom:uae-pass  →  UAE PASS staging login
  → GoTrue /auth/v1/callback (token + userinfo, account resolution by `sub`)
  → app /auth/callback?code=…  → exchangeCodeForSession → standard Supabase session
  → known subject: same Supabase user/session
  → new subject: one auth.users row + one CUSTOMER profile
  → sync_uae_pass_staging_identity verifies auth.identities, fills only missing
    approved profile fields, and records the audit result
  → incomplete profile/consent → Profile Setup; complete profile → Dashboard

Existing authenticated Profile → "Link UAE PASS Staging"
  → supabase.auth.linkIdentity({ provider: 'custom:uae-pass', redirectTo: /auth/callback?flow=link })
  → the same auth.users/profile row gains the provider identity
```

- **New** subjects create a CUSTOMER and must complete MARKAZ profile consent.
- **Repeat** sign-ins with the same UAE PASS subject (`sub`) resolve to the same account.
- **Existing-account linking** remains an explicit authenticated action.
- Email/password customers verify the six-digit email code and continue directly
  to the dashboard. UAE PASS is not repeated as an onboarding step (ADR-0030).

## Official sources (verify before changing anything)

- UAE PASS docs: <https://docs.uaepass.ae> (full corpus: `https://docs.uaepass.ae/llms-full.txt`)
- Supabase custom OAuth/OIDC providers: <https://supabase.com/docs/guides/auth/custom-oauth-providers>

### Verified UAE PASS **staging** values (docs.uaepass.ae)

|                    |                                                                  |
| ------------------ | ---------------------------------------------------------------- |
| Authorize          | `https://stg-id.uaepass.ae/idshub/authorize`                     |
| Token              | `https://stg-id.uaepass.ae/idshub/token`                         |
| UserInfo           | `https://stg-id.uaepass.ae/idshub/userinfo`                      |
| Scope              | `urn:uae:digitalid:profile:general`                              |
| `acr_values` (web) | `urn:safelayer:tws:policies:authentication:level:low`            |
| Forced re-auth     | `prompt=login` + `forceAuth=true`                                |
| Token auth         | HTTP Basic `base64(client_id:client_secret)` (handled by GoTrue) |
| Subject (linking)  | `sub` (UUID)                                                     |
| SOP field          | `userType` ∈ {SOP1, SOP2, SOP3}                                  |
| Sandbox creds      | `sandbox_stage` / `sandbox_stage` (POC only)                     |

Endpoint **hosts are allow-listed in code** (`packages/auth/src/uae-pass.ts`) — never
taken from an env var — to avoid an SSRF / token-disclosure risk.

## Local Supabase support

The pinned local CLI bundles **GoTrue v2.191.0**, which **supports** custom OAuth
providers via `POST /auth/v1/admin/custom-providers`. **No hosted Supabase project is
required** for the POC. (If a future pinned version lacked it, register the provider on
a hosted Supabase staging project instead and set the app's `NEXT_PUBLIC_SUPABASE_URL`
to it — do not hand-roll an insecure workaround.)

## Environment variables (SERVER ONLY — never `NEXT_PUBLIC_`)

```
UAE_PASS_MODE=staging                # default 'simulated' → feature OFF
UAE_PASS_CLIENT_ID=sandbox_stage
UAE_PASS_CLIENT_SECRET=sandbox_stage
# Only for an intentional hosted-tenant configuration:
UAE_PASS_ALLOW_REMOTE_SETUP=true
```

The POC scope, `acr_values`, and forced re-authentication policy (`prompt=login` plus
`forceAuth=true`) are fixed in server-only code. They cannot be changed through
environment variables.

## Create a UAE PASS staging account

Install the official UAE PASS **staging app** and create a separate staging account
using the [official staging-account guide](https://docs.uaepass.ae/start-test-environment-implementation/create-uaepass-user).
The public `sandbox_stage` client is sufficient for the POC. Project-specific staging
credentials and formal redirect registration belong to the onboarding process, not
this public sandbox test.

## Callback / redirect URL setup

Use this **exact** redirect URI in the OAuth flow (it is GoTrue's callback, not an app
route):

```
{SUPABASE_URL}/auth/v1/callback        # local: http://127.0.0.1:54321/auth/v1/callback
```

The public POC credentials allow a preferred callback URL. A project-specific staging
or production client requires UAE PASS to register the exact callback.

`signInWithOAuth`'s `redirectTo` (`{origin}/auth/callback?locale=…`) must also be in
Supabase's redirect allow-list (local dev allows localhost by default).

## Local HTTPS

UAE PASS staging is HTTPS. The **local app** may run over HTTP for the POC because
Supabase (not the browser) makes the server-to-server token call. Real onboarding
typically requires an HTTPS redirect URI; use a tunnel (e.g. an HTTPS dev URL) if the
staging tenant enforces it.

## Run the POC

```bash
pnpm supabase start                       # local stack (GoTrue v2.191.0)
UAE_PASS_MODE=staging \
  UAE_PASS_CLIENT_ID=sandbox_stage UAE_PASS_CLIENT_SECRET=sandbox_stage \
  pnpm db:setup-uae-pass                   # register custom:uae-pass (idempotent)
# set UAE_PASS_MODE=staging in your .env.local, then:
pnpm dev                                   # web :3000
```

Sign up and verify an email account, then open `/en/account/profile` →
**"Link UAE PASS Staging"** appears. The Sign In screen also shows
**"Continue with UAE PASS Staging"** for identities that have already been linked.

### Expected success flow

From Profile, click Link → redirected to UAE PASS staging → authenticate → back to
`/auth/callback?flow=link` → standard Supabase session → database-verified link result →
Profile. Later UAE PASS sign-in reaches the same dashboard. Each UAE PASS attempt sends
`prompt=login` and `forceAuth=true`, so an existing UAE PASS
browser SSO session is not silently reused and UAE PASS must start a fresh interactive
mobile challenge. The matching-code screen and mobile approval UI remain controlled by
UAE PASS.

### Expected cancellation / failure flows

- **Cancel** at UAE PASS → `/[locale]/sign-in?error=provider_cancelled` with a safe,
  recoverable message; email/password still available.
- **Token/UserInfo/exchange failure** → `/[locale]/sign-in?error=provider_error` (generic,
  safe). The authorization code is never reflected back into any URL.
- **Identity already linked elsewhere** → Profile shows safe support guidance; no account
  or identity is moved automatically.

## What is stored

First-time UAE PASS authentication creates one `auth.users`, one `public.profiles`, and one
`custom:uae-pass` `auth.identities` row. MARKAZ projects only missing full name, email, and
mobile into the application profile; mobile is normalized and records UAE PASS verification
provenance. It is never used to match or link the identity (ADR-0032 / ADR-0033). For OAuth identities,
Supabase stores provider identity metadata in `auth.identities.identity_data` and may
also copy it into Auth user metadata. With UAE PASS's general-profile scope, that
metadata can include names, mobile, nationality, and Emirates ID for some account
types. It is protected inside the Auth schema, but it is still persisted data.

## What is deliberately **NOT** stored

MARKAZ application tables do not copy Emirates ID, nationality, gender, provider access
tokens, provider refresh tokens, or authorization codes, and application code does not
log them. Supabase does not persist provider tokens in the project database, but normal
Supabase session access/refresh tokens are necessarily stored in SSR cookies to keep the
customer signed in.

Because direct generic OAuth does not provide a claim-minimization mapping, this POC
must use staging/test identities only. Do not use production identities or claim that
EID/mobile are never retained. A production design needs an approved minimal-attribute
contract or a reviewed UserInfo-minimizing adapter before onboarding.

## Staging limitations

- Real authorize → token → userinfo round-trip requires a live UAE PASS **staging
  tester** and is a **manual** test; automated tests are fully mocked and never call
  UAE PASS.
- The direct generic-provider design persists the returned identity metadata inside
  Supabase Auth. This is acceptable only for staging/test identities in this POC.
- UAE PASS's sample UserInfo does not advertise an `email_verified` field. Confirm the
  actual GoTrue email-confirmation behavior during the manual staging round-trip; do
  not claim the first-login journey is proven until that succeeds.
- GoTrue sets `pkce_enabled: true` on the provider. If the staging tenant rejects PKCE,
  disable it on the provider (re-register with `pkce_enabled:false`); the token
  `Content-Type` may also need `application/x-www-form-urlencoded` vs `multipart/form-data`
  depending on the tenant. These are the two most common staging-integration variances.
- The custom provider lives in GoTrue's DB (not `config.toml`); rerun
  `pnpm db:setup-uae-pass` after a stack reset. To change config, delete the provider
  (dashboard/admin API) and rerun.

## Account-linking boundary

- Repeat UAE PASS sign-ins resolve by provider **subject**, not by an app-supplied email.
- The public UAE PASS response does not advertise `email_verified`; application code never
  performs an email/phone merge. Supabase Auth remains responsible for its own provider
  identity-resolution rules.
- `auth.linkIdentity()` is available only to an already authenticated customer. The
  database sync independently verifies `auth.uid()` and `auth.identities`.
- Provider identity conflicts fail safely; MARKAZ never moves an identity between users.

## UAE PASS does not prove property ownership

UAE PASS authenticates a **person's identity**. It says nothing about whether that
person owns any property. Ownership remains governed by the (simulated) listing
ownership-verification flow and, in production, DLD/Trakheesi — never by UAE PASS.

## Production onboarding blockers (out of scope here)

- Production UAE PASS endpoints, a production `client_id`/`client_secret`, registered
  production redirect URIs, and formal UAE PASS onboarding/approval.
- A reviewed Arabic copy pass (the strings here are **draft/unreviewed**).
- Attribute-mapping review (which UserInfo claims map to Supabase user metadata) and an
  SOP-level policy if a minimum assurance level is required. Production must minimize
  persisted UserInfo attributes before real identities are allowed.

## Rollback to simulated mode

Set `UAE_PASS_MODE=simulated` (or unset it). The UAE PASS button disappears; the two-step email +
password signup and normal email/password sign-in remain available. Optionally delete the provider:
`DELETE {SUPABASE_URL}/auth/v1/admin/custom-providers/custom:uae-pass` (service-role). No app code or
schema changes are needed to roll back.
