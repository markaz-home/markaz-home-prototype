# ADR 0007: Demo-Auth One-Click Fallback — Conditional, Disabled by Default

- **Status:** Accepted (the fallback itself is **DISABLED**; only the contract +
  docs exist)
- **Date:** 2026-03

## Context

Primary authentication is **real Supabase email OTP** (6-digit). Locally, codes
are captured by Inbucket; in deployed demos, email is delivered via SES. There is
a desire for a one-click "demo login" to make live demos resilient if email
delivery hiccups.

The problem: a one-click login must mint a real session **without** the user
entering an OTP. Doing that safely requires a **supported, secure Supabase
server-side session-minting mechanism**. We will not hand-store tokens or use an
unsupported workaround — sessions must come from `@supabase/ssr` secure cookies,
and OTP codes are never built, stored, or logged by app code.

## Decision

Ship the **env/feature-flag contract and documentation only**. The one-click
fallback is **DISABLED by default** and **was not built**.

Env contract (present in `.env.example`):

- `DEMO_ENVIRONMENT` — marks an environment as a demo environment.
- `DEMO_AUTH_FALLBACK` — feature flag for the one-click fallback (off by default).
- `DEMO_AUTH_ALLOWLIST` — allow-list of fictional demo accounts eligible for the
  fallback, if/when it is ever enabled.

**Blocker (explicit):** a supported, secure Supabase server-side session-minting
mechanism must be confirmed before this is built. Until then, demo reliability
rests on **local Inbucket OTP** and (in deployed demos) **SES**.

## Consequences

- No unsupported or insecure session-minting code exists in the repo.
- The env contract is reserved so enabling the feature later is config + a guarded
  code path, not a redesign.
- Demos depend on email OTP delivery (Inbucket locally, SES deployed); that is the
  accepted risk until the blocker is resolved.
- Even when enabled, the fallback would be restricted to the allow-listed
  fictional demo accounts in demo-flagged environments only.
