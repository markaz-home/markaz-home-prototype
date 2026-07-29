# Security readiness

Assessment date: 2026-07-28

Scope: Week 8 controlled-deployment preparation; not a penetration test or production certification.

## Implemented controls

| Boundary             | Readiness evidence                                                                                                                                         |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Identity and roles   | Two account types only; no public Admin signup; profile trigger/RLS prevents self-promotion; customer denial at Admin is browser-tested                    |
| API separation       | Customer/public and Admin apps use separate origins and routers; state-changing tRPC requests require the exact configured origin                          |
| CSRF/CORS posture    | Same-origin cookies plus exact Origin validation on non-GET/HEAD tRPC requests; no permissive CORS response is configured; foreign origins fail closed     |
| Database             | RLS is the security boundary; customer context sets JWT claims and local `authenticated` role; security-definer writes re-derive actor                     |
| Admin authority      | Server capability checks, closed reason enums, database checks, and immutable audit events; UI visibility is not authorization                             |
| Storage              | Private owner/participant buckets; service-only public publishing; path ownership validation; expiring object-scoped signed URLs; Admin direct read denied |
| Service role         | Server-only trusted publication, signed-URL, setup, and test operations; never used for customer-scoped queries                                            |
| Secrets              | Ignored env files/platform store; client-secret name rejection; startup errors and scan suppress values                                                    |
| Uploads              | Bucket and API MIME/size allow-lists; owner/listing path constraint; filenames do not establish authorization                                              |
| Errors/logs          | Production internal tRPC messages are redacted; stack omitted; logger records safe codes/context, not cause/message secrets                                |
| Browser headers      | CSP, `frame-ancestors 'none'`, `X-Frame-Options: DENY`, nosniff, strict referrer, Permissions Policy, CORP, DNS prefetch off                               |
| HTTPS-only hardening | HSTS and CSP upgrade-insecure-requests activate only for an HTTPS `production` environment                                                                 |

The CSP allow-list includes the selected Supabase HTTP/Realtime origins and approved web image
hosts. Production removes `unsafe-eval`; `unsafe-inline` remains for Next/runtime compatibility and
should be replaced by a nonce/hash policy after validating the selected platform. Cookies are owned
by `@supabase/ssr`; `Secure`, `HttpOnly`, `SameSite`, domain, and callback behavior must be verified
on the real HTTPS topology.

## Database/function review

- RLS and function grants are exercised by live integration tests, including cross-user denial,
  self-offer denial, single acceptance, transaction participant scope, Admin capabilities, audit
  immutability, publication projection, and Storage access.
- Security-definer functions set a safe search path and derive the actor from `auth.uid()`.
- Public marketplace reads use the security-barrier projection and allow-listed DTO mapping.
- Admin document access records requested then granted/failed; audit metadata excludes raw paths and
  signed URLs.

## Automated checks

- Repository secret scanner: `pnpm security:secrets`; it scans tracked and unignored candidate
  files and prints rule/file only.
- Dependency command: `pnpm security:audit` (`pnpm audit --prod --audit-level high`).
- Week 8 secret scan passed with no findings; final file count is recorded in `WEEK-8.md`.
- The dependency audit was attempted, but registry DNS was unavailable in the sandbox and the
  external retry was not authorized because it sends the dependency graph to npm. This is an
  **unresolved evidence gate**, not a clean audit. Run it in an approved networked CI/security
  environment, archive the report, triage high/critical findings, and record exceptions before any
  production decision.

## Known risks and production-only gaps

- No independent threat model review, SAST/DAST, penetration test, WAF/bot policy, vulnerability
  management owner, or incident-response exercise.
- Production Auth cookies, password policy, rate limits, redirects, and email delivery are not
  platform-verified.
- MIME checks do not replace malware scanning or image/document decoding.
- No secrets manager/rotation schedule or break-glass access is configured.
- No dependency-audit evidence exists for this exact baseline.
- BayutAPI is unofficial and must stay disabled in production until legal/data rights approval.
- Real identity, property, permit, payment, escrow, and legal integrations are not present.
- Arabic legal/transactional copy remains professionally unreviewed.

Security recommendation: suitable for continued internal/local demonstration. **No-go for public
production** until the production-only gaps and dependency evidence are closed and an accountable
Security sign-off is recorded.
