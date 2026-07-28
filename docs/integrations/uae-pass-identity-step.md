# UAE PASS identity step — real staging round trip

**Implemented integration note.** Read `AGENTS.md` first; its hard product rules are not negotiable.

## 1. What we are building

Today the third onboarding step (`/[locale]/onboarding/uae-pass`, "Demo identity") is a **pure
simulation**: the customer presses a button, the app writes an identity status, and buttons choose
the outcome. It never contacts UAE PASS.

We already have a **real UAE PASS Staging integration**, but only as a _login method_ on the
sign-in screen (`signInWithOAuth({ provider: 'custom:uae-pass' })`).

This task makes the identity step perform a **real UAE PASS Staging round trip** for a customer who
is **already signed in** with an email/password account: press the button → go out to UAE PASS
Staging → authenticate on the UAE PASS staging mobile app → return to MARKAZ → the step is
satisfied because Supabase now holds a `custom:uae-pass` identity for that user.

The customer onboarding page exposes **only UAE PASS Staging**. The legacy customer-callable
simulation mutation has been removed; test fixtures may still create historical `VERIFIED_DEMO`
rows only through the privileged local test setup.

## 2. The one correctness decision that matters

**Use `supabase.auth.linkIdentity()`, NOT `signInWithOAuth()`.**

`signInWithOAuth` starts a **new session**. Called from a screen where the customer is already
signed in with a password account, Supabase would either merge on matching email or create a
different user — silently moving the person into another account. UAE PASS staging identities may
also carry **no email at all** (there is already a fix in the repo for first-login provisioning of
email-less UAE PASS identities), which makes the merge behaviour worse.

`supabase.auth.linkIdentity({ provider })` attaches the provider identity to the **currently
signed-in user** and refuses when that identity already belongs to another user. That refusal is a
feature: it is the guard against two MARKAZ accounts claiming one Emirates ID.

Do not work around a link failure by falling back to `signInWithOAuth`.

## 3. Current state — files you will touch

| File                                                            | Today                                                                                                            |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `apps/web/src/components/uae-pass-flow.tsx`                     | UAE PASS Staging link flow through `linkIdentity`; no customer simulation controls.                              |
| `apps/web/src/app/[locale]/(auth)/onboarding/uae-pass/page.tsx` | Server page; `requireCustomerStep(locale, ['uae-pass'])`, passes `initialStatus`.                                |
| `apps/web/src/app/[locale]/(auth)/sign-in/page.tsx`             | Reference pattern: `isUaePassStagingEnabled()` from `@markaz/auth/uae-pass/server` gates the option server-side. |
| `apps/web/src/components/sign-in-form.tsx`                      | Reference pattern for the provider call + `redirectTo`.                                                          |
| `apps/web/src/app/auth/callback/route.ts`                       | PKCE callback; exchanges `?code=`, honours `?locale=` and `?next=`.                                              |
| `apps/web/src/lib/auth-redirect.ts`                             | `ALLOWED_POST_SIGN_IN_DESTINATIONS` currently allows **only** `/sell`.                                           |
| `packages/auth/src/server.ts`                                   | `getAuthProviderIds(user)` — reads `app_metadata.provider` + `.providers`.                                       |
| `packages/domain/src/identity.ts`                               | `IDENTITY_STATUSES` + guarded `IDENTITY_TRANSITIONS`.                                                            |
| `packages/domain/src/routing.ts`                                | Already skips this step when `identityAuthenticatedByProvider` is true.                                          |
| `supabase/config.toml`                                          | `[auth]` block has **no** `enable_manual_linking`.                                                               |

## 4. Work items

### 4.1 Enable manual identity linking

`supabase/config.toml`, under `[auth]`:

```toml
enable_manual_linking = true
```

Without it `linkIdentity` fails immediately. Requires a stack restart.
**The same setting must be enabled on the hosted Supabase project** — otherwise this works locally
and returns 422 in staging. That toggle is the product owner's to flip; note it in your handoff.

### 4.2 Allow the onboarding return path

`apps/web/src/lib/auth-redirect.ts` — add `/onboarding/uae-pass` to
`ALLOWED_POST_SIGN_IN_DESTINATIONS`. The allowlist exists because the value comes from the query
string; keep it an allowlist, do not loosen it to "any relative path".

### 4.3 Gate the real option server-side

`onboarding/uae-pass/page.tsx` — mirror the sign-in page exactly:

```ts
const uaePassStaging = isUaePassStagingEnabled();
return <UaePassFlow initialStatus={status} uaePassStaging={uaePassStaging} locale={locale} />;
```

The client must never decide whether the real provider is available.

**Return-path correction.** A successfully linked provider makes
`resolvePostAuthDestination()` return `dashboard` before this page renders. This page must therefore
allow both `uae-pass` and `dashboard`, but render the dashboard-qualified state here only when
`session.uaePassAuthenticated` is true. A simulation-verified customer who manually revisits the
route should still be redirected to the dashboard.

### 4.4 Start the link from the identity step

In `uae-pass-flow.tsx`, when `uaePassStaging` is true, offer **"Continue with UAE PASS"** as
the primary action:

```ts
const { error } = await supabase.auth.linkIdentity({
  provider: 'custom:uae-pass' as 'google', // supabase-js 2.47's union predates custom providers
  options: {
    redirectTo: `${window.location.origin}/auth/callback?locale=${locale}&next=/onboarding/uae-pass`,
  },
});
```

Do not expose a simulated identity button or fallback mutation.

### 4.5 Record the outcome — server-side only

On return, the customer lands back on the step. Derive the result from
`getAuthProviderIds(user).includes('custom:uae-pass')` — **read from Supabase `app_metadata`, which
only Supabase Auth can write**. Never accept a client-supplied "I verified" claim, never trust a
query parameter.

**Status value.** `IDENTITY_STATUSES` is `NOT_STARTED | PENDING | VERIFIED_DEMO | FAILED_DEMO`.
Recording a real staging round trip as `VERIFIED_DEMO` would conflate simulated and real results.
Add a distinct **`VERIFIED_STAGING`**:

- Add to `IDENTITY_STATUSES` and to `IDENTITY_TRANSITIONS` (`NOT_STARTED → VERIFIED_STAGING`,
  `PENDING → VERIFIED_STAGING`, `FAILED_DEMO → VERIFIED_STAGING`; terminal thereafter).
- Check how `identity_verification_status` is stored (`packages/db/src/schema.ts`). If it is a
  Postgres enum it needs a migration; if it is `text`, only the Drizzle mirror and zod change.
  Either way: **one canonical SQL migration in `supabase/migrations/` plus the matching Drizzle
  mirror** — never a second migration mechanism.
- Update `isIdentityVerified()` and every place that maps a status to a label/tone.
- The write must happen server-side (a tRPC mutation that re-derives the provider list from the
  session user), not from the browser.
- Do not add a customer-callable simulation mutation; historical `VERIFIED_DEMO` remains a
  persisted prototype value only.
- Defence in depth: direct `authenticated` updates cannot set or remove `VERIFIED_STAGING`. The
  tRPC mutation calls an idempotent `SECURITY DEFINER` function through `ctx.tx`; that function
  derives `auth.uid()`, confirms `auth.identities.provider = 'custom:uae-pass'`, updates the profile,
  and inserts the audit event atomically. Repeated calls do not duplicate the audit event.

Note `resolvePostAuthDestination` already lets these users through on
`identityAuthenticatedByProvider`, so the status write is for **display and audit**, not the gate.
Do not remove the provider-based gate.

## 5. Security invariants

- Never log the callback `code`, tokens, or provider payloads. Follow the existing
  `console.warn('[uae-pass] …')` style — messages only, no values.
- The provider identifier `custom:uae-pass` is a public slug, not a secret. Client id/secret stay
  server-side and must never reach the browser bundle.
- RLS is the boundary. The status write goes through `customerProcedure` and `ctx.tx`; never the
  service-role key for a customer-scoped request.
- Account type is unaffected. UAE PASS is a login/identity method, **not** a role. Customers can
  never self-promote to ADMIN.

## 6. Error paths

| Case                                              | Handling                                                                                                                                                                                                                                                                                                                                    |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Customer cancels at UAE PASS (`access_denied`)    | Return to the step with a neutral message and allow another UAE PASS attempt. Not an error state.                                                                                                                                                                                                                                           |
| Provider/exchange error                           | Generic safe copy. No provider detail surfaced.                                                                                                                                                                                                                                                                                             |
| Identity already linked to another MARKAZ account | Supabase refuses. Show a distinct, non-enumerating message: the identity cannot be linked, contact support. **Do not** reveal which account holds it.                                                                                                                                                                                       |
| `enable_manual_linking` disabled                  | Show a safe configuration-unavailable message. If the callback reports the stable error code, log a constant server-side warning naming `auth.enable_manual_linking`; an immediate browser-side failure contains no server request and must not send raw provider detail to a logging endpoint. Verify the hosted toggle during deployment. |
| Staging unreachable / mode off                    | Do not render a verification action. Show safe configuration-unavailable copy plus Sign Out.                                                                                                                                                                                                                                                |

Every failure leaves the customer able to retry UAE PASS where appropriate or sign out.

## 7. Customer-facing simulation is removed

UAE PASS Staging authentication requires the **UAE PASS staging mobile app and a test account**.
Anyone without them cannot complete this onboarding step:

- `UAE_PASS_MODE=staging` → show the real "Continue with UAE PASS" action.
- Otherwise → show configuration-unavailable copy and Sign Out.
- Never render `Start demo verification`, pending simulation controls, approve, or reject.

## 8. Copy and i18n

All copy through `next-intl`, EN + AR parity, RTL-safe. Arabic is machine-draft — flag it, do not
claim it is reviewed.

One existing string is now misleading and must change:

- `identity.disclosureBody` today: _"This prototype is not connected to the live UAE PASS service."_
  A tester who just used "Continue with UAE PASS Staging" reads this as a contradiction.
  Reword to distinguish **live** from **staging**, e.g. _"UAE PASS Staging is a test service. It
  confirms identity only — it does not verify property ownership, and no production identity check
  is performed."_

New keys needed for: the real action button, its in-progress state, the cancelled message, the
generic failure, the already-linked failure, and a `VERIFIED_STAGING` status label + chip.

## 9. Tests

- **Domain**: `VERIFIED_STAGING` transitions, `isIdentityVerified`, and `resolvePostAuthDestination`
  unchanged for provider-authenticated users.
- **Component**: the real option renders only when `uaePassStaging` is true; simulation controls
  never render in either configuration.
- **Server**: the status write derives the provider from the session user and **rejects** a
  client-supplied claim.
- **Callback**: `/onboarding/uae-pass` is an allowed `next`; an arbitrary path is not.
- Do not write an E2E that depends on the real UAE PASS staging app — that round trip is a manual
  tester check. Cover everything up to the redirect.

## 10. Verification

`pnpm typecheck && pnpm lint && pnpm test && pnpm build`, plus a local run:
`pnpm supabase:start` (after the config change) and `pnpm dev`.

Manual check, on a device with the UAE PASS staging app: sign up with email/password → verify email
→ at the identity step choose the real option → complete on the phone → confirm you return to the
step, the status shows the staging result, and the dashboard becomes reachable.

## 11. Out of scope / open decisions for the product owner

These are **not** for Codex to decide:

- **Unlinking.** Can a customer remove a linked UAE PASS identity, and what happens to their
  verification status if they do?
- **Wrong-person linking.** What if the Emirates ID behind the staging account is not theirs?
  Staging is a test IdP and proves nothing about the human.
- **Production onboarding.** Official UAE PASS onboarding, production credentials, registered
  production redirect URLs, and attribute-policy review all remain outstanding. Nothing here makes
  the integration production-ready.
- Enabling `enable_manual_linking` on the hosted Supabase project.

Do not implement unlink, do not touch production configuration, and do not present staging results
as production identity verification anywhere in the UI.
