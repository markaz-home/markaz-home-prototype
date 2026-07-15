# UAE PASS Staging — Proof of Concept

> **STAGING / POC ONLY.** This is a **test-environment** integration. It is **not**
> production identity verification, **not** "government verified", and **does not
> verify property ownership**. UAE PASS confirms identity only.

UAE PASS is offered as an **optional sign-in method** on the existing Sign In screen,
**alongside** email + password. It is **not** a post-login identity-verification step
and does **not** replace Supabase authentication.

## How it works (architecture)

UAE PASS is registered with **Supabase Auth (GoTrue) as a Custom OAuth2 provider**
(`custom:uae-pass`). Supabase performs the OAuth code → token → UserInfo exchange and
issues a **standard Supabase session**, so `auth.uid()` and RLS work exactly as for
email/password. We do **not** hand-roll a session, mint custom JWTs, or use the
service-role key during login.

```
Sign In → "Continue with UAE PASS Staging"
  → supabase.auth.signInWithOAuth({ provider: 'custom:uae-pass', redirectTo: /auth/callback })
  → GoTrue /authorize?provider=custom:uae-pass  →  UAE PASS staging login
  → GoTrue /auth/v1/callback (token + userinfo, account resolution by `sub`)
  → app /auth/callback?code=…  → exchangeCodeForSession → standard Supabase session
  → first sign-in: handle_new_user trigger creates the normal CUSTOMER profile
  → (app) guard routes onboarding as usual (verify-email / profile-setup / …)
```

- **First** UAE PASS sign-in creates the normal CUSTOMER profile via the existing safe
  `handle_new_user` trigger — no bespoke provisioning.
- **Repeat** sign-ins with the same UAE PASS subject (`sub`) resolve to the **same**
  account (GoTrue links identities by provider subject natively).

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
UAE_PASS_SCOPE=urn:uae:digitalid:profile:general            # optional (default shown)
UAE_PASS_ACR_VALUES=urn:safelayer:tws:policies:authentication:level:low   # optional
```

## Create a UAE PASS staging account

Request a UAE PASS **staging/sandbox** tester account through the official onboarding
channel on `docs.uaepass.ae` / the UAE PASS partner portal. For the POC the published
`sandbox_stage` client is used; a project-specific staging `client_id`/`client_secret`
and **registered redirect URI** are issued during formal onboarding.

## Callback / redirect URL setup

Register this **exact** redirect URI with UAE PASS (it is GoTrue's callback, not an app
route):

```
{SUPABASE_URL}/auth/v1/callback        # local: http://127.0.0.1:54321/auth/v1/callback
```

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

Open `/en/sign-in` → the **"Continue with UAE PASS Staging"** button appears.

### Expected success flow

Click → redirected to UAE PASS staging → authenticate → back to `/auth/callback` →
standard Supabase session → first-time users complete the normal onboarding → dashboard.

### Expected cancellation / failure flows

- **Cancel** at UAE PASS → `/[locale]/sign-in?error=uae_pass_cancelled` with a safe,
  recoverable message; email/password still available.
- **Token/UserInfo/exchange failure** → `/[locale]/sign-in?error=uae_pass` (generic,
  safe). The authorization code is never reflected back into any URL.

## What is stored

Only what **Supabase Auth** stores for any OAuth identity: the `auth.identities` row
(provider `custom:uae-pass` + subject) and the `auth.users` row, plus the normal
`public.profiles` CUSTOMER row created by `handle_new_user`.

## What is deliberately **NOT** stored

Access token, refresh token, authorization code, Emirates ID (`idn`), date of birth,
mobile, address, or the full raw UserInfo payload — none are persisted by the app, and
none are logged. Tokens are managed by Supabase in secure cookies and never returned to
the browser by our code.

## Staging limitations

- Real authorize → token → userinfo round-trip requires a live UAE PASS **staging
  tester** and is a **manual** test; automated tests are fully mocked and never call
  UAE PASS.
- GoTrue sets `pkce_enabled: true` on the provider. If the staging tenant rejects PKCE,
  disable it on the provider (re-register with `pkce_enabled:false`); the token
  `Content-Type` may also need `application/x-www-form-urlencoded` vs `multipart/form-data`
  depending on the tenant. These are the two most common staging-integration variances.
- The custom provider lives in GoTrue's DB (not `config.toml`); rerun
  `pnpm db:setup-uae-pass` after a stack reset. To change config, delete the provider
  (dashboard/admin API) and rerun.

## Account-linking risks

- Repeat UAE PASS sign-ins link by provider **subject** — correct and intended.
- **Email-based auto-merge:** GoTrue may automatically link an OAuth identity to an
  existing user when the **verified email matches**. We add **no** email-based linking
  ourselves, but this native behaviour means a UAE PASS email equal to an existing
  email/password account's email could be linked by GoTrue. For the POC, **use distinct
  test emails**; **explicit, user-consented account linking is a separate, future
  concern** and must not merge accounts on email alone.

## UAE PASS does not prove property ownership

UAE PASS authenticates a **person's identity**. It says nothing about whether that
person owns any property. Ownership remains governed by the (simulated) listing
ownership-verification flow and, in production, DLD/Trakheesi — never by UAE PASS.

## Production onboarding blockers (out of scope here)

- Production UAE PASS endpoints, a production `client_id`/`client_secret`, registered
  production redirect URIs, and formal UAE PASS onboarding/approval.
- A reviewed Arabic copy pass (the strings here are **draft/unreviewed**).
- A decided policy for explicit account linking + the email auto-merge behaviour above.
- Attribute-mapping review (which UserInfo claims map to Supabase user metadata) and an
  SOP-level policy if a minimum assurance level is required.

## Rollback to simulated mode

Set `UAE_PASS_MODE=simulated` (or unset it). The UAE PASS button disappears; email +
password and the existing simulated onboarding are unchanged. Optionally delete the
provider: `DELETE {SUPABASE_URL}/auth/v1/admin/custom-providers/custom:uae-pass`
(service-role). No app code or schema changes are needed to roll back.
