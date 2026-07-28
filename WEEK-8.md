# Week 8 — production readiness, deployment preparation, and handover

Assessment date: 2026-07-28

Branch: `feature/auth-flow-gold`

Immutable input baseline: `rc-week-7` at
`9e9bfa7c76acd33efb8b449ee5d38018f0b85ba5`

## 1. What was prepared

Week 8 prepared the Week 7 release candidate for controlled-environment review:

- a complete environment-variable inventory and fail-fast configuration validation;
- browser security headers, exact-origin checks for state-changing tRPC calls, production error
  redaction, and a repository secrets scan;
- Storage path, MIME, size, privacy, and Admin-access hardening through the forward-only `0821`
  migration;
- provider-neutral deployment, rollback, Auth, database, backup/restore, Storage, email,
  observability, smoke-test, handover, and limitations documentation;
- a fresh migration replay, live RLS/Storage suite, logical backup/restore drill, browser matrix,
  and production artifact review.

The hardening also exposed and fixed a real upload-path defect: ownership documents and draft
photos now use the required `user/listing/file` object hierarchy before registration.

## 2. What was not changed

No new customer feature, Admin module, role, shared demo seed, real regulated integration, public
deployment, hosting-provider assumption, or production credential was added. Historical migrations
were not edited. UAE PASS production, DLD, Trakheesi, Madmoun, payments, escrow, contracts, legal
completion, and public Bayut use remain outside the prototype.

## 3. RC baseline

The Week 7 tag and commit remain unchanged and verifiable:

```text
tag: rc-week-7
commit: 9e9bfa7c76acd33efb8b449ee5d38018f0b85ba5
Week 7 validation: 501 passed; 0 failed; 0 skipped; 0 retries
Week 7 UAT: 75 PASS; 4 PARTIAL; 0 failed
```

Week 8 is forward preparation after that immutable tag. The repository-freeze commit records this
work separately, but no Week 8 deployment tag or platform artifact is defined by this report. The
final commit and built artifact digest must be recorded in the deployment/change record before any
controlled deployment.

UAT-67–70 remain explicitly accepted as non-blocking for the internal prototype RC, but remain
deployment evidence gaps: full uninterrupted Arabic customer/Admin journeys and the complete
mobile customer/Admin matrices were not executed. Product, Engineering, QA, Design, Security, and
Release owner sign-offs remain `Pending`; no approval is invented.

## 4. Environment readiness

`ENVIRONMENT-VARIABLES.md` inventories application, database, Supabase, Auth, Storage, external
adapter, logging, test, and deployment values with exposure, secrecy, ownership, defaults, and
failure behavior. `.env.example` contains safe placeholders only. Final values must come from an
approved platform secret store.

No hosting provider, regions/data-residency decision, production origins, or isolated hosted
Supabase environment has been supplied. Environment readiness is therefore locally proven and
externally gated.

## 5. Configuration and secrets

`pnpm config:check` now fails before start/build on missing or unsafe URLs, keys, database
connections, locale flags, provider modes, Storage names, Admin bootstrap pairs, and logging
settings. It rejects client-exposed secret names and production use of staging/unsupported
adapters; diagnostics contain names and safe mode labels, never values.

`pnpm security:secrets` scans tracked and unignored candidate files for common credential forms and
passes across 653 repository files with zero findings. `pnpm security:audit` was attempted, but
registry DNS was unavailable in the sandbox and an external retry was not authorized because it
would disclose the dependency graph to npm. This is an unresolved production evidence gate, not a
clean dependency audit.

## 6. Auth readiness

`docs/runbooks/auth-readiness.md` records signup, six-digit email verification, official recovery
link, redirects, cookies, sessions, Admin bootstrap, route denial, password/rate-limit checks, and
the UAE PASS boundary. Local journeys pass. Production Site URL/redirects, cookie behavior,
server-side password policy, rate limits, email delivery, and UAE PASS staging prerequisites still
require provider-side configuration and proof.

## 7. Database readiness

The canonical migration chain replayed successfully from a fresh Supabase stack through
`20260301000821_storage_production_constraints.sql`. The live integration matrix passed 119 tests
with zero skips, including RLS, grants, security-definer functions, Realtime, audit immutability,
Storage, offers, publication, and transactions.

A logical schema/data backup was checksummed and restored into a separate local verification
database. The restored database contained all 24 public tables and was then removed; the application
database was not targeted. This proves the local procedure, not production PITR or Storage recovery.
See `docs/runbooks/database-migrations.md` and `docs/runbooks/backup-restore.md`.

## 8. Storage readiness

The four buckets now have explicit visibility, MIME, and size contracts:

| Bucket                  | Visibility | Limit | MIME allow-list |
| ----------------------- | ---------- | ----: | --------------- |
| `ownership-documents`   | Private    | 10 MB | PDF, JPEG, PNG  |
| `listing-photos-draft`  | Private    | 12 MB | JPEG, PNG, WebP |
| `listing-photos`        | Public     | 12 MB | JPEG, PNG, WebP |
| `transaction-documents` | Private    | 10 MB | PDF, JPEG, PNG  |

Customer uploads must be scoped to their user/listing hierarchy. Direct signed-in Admin reads of
private buckets are denied; the audited server capability remains the only Admin document path.
Public-photo writes remain service-only. Five focused Storage integration tests pass. Malware
scanning, content decoding, lifecycle/versioning, CDN policy, and production Storage backup remain
gaps. See `docs/runbooks/storage-readiness.md`.

## 9. Email readiness

Local Mailpit verification-code and recovery-link flows are covered. The verification and recovery
templates remain purpose-specific. No production sender, SMTP provider, domain authentication,
deliverability proof, bounce handling, or Arabic professional review exists. See
`docs/runbooks/email-readiness.md`.

## 10. Security readiness

Implemented Week 8 controls include:

- exact Origin validation on state-changing web/Admin tRPC requests;
- CSP, frame denial, nosniff, strict referrer, restricted permissions, CORP, and HTTPS-production
  HSTS;
- allow-listed Supabase HTTP/Realtime and web image origins;
- internal production error and stack redaction;
- API and bucket upload restrictions plus owned path validation;
- tighter private Storage policies while preserving audited Admin access;
- CI configuration and secrets gates.

RLS remains the authorization boundary and service-role use remains server-only. No independent
threat review, SAST/DAST, penetration test, WAF/abuse review, completed dependency audit, or named
Security approval exists. See `SECURITY-READINESS.md`.

## 11. Observability

The application has structured logs, safe error codes, request timing integration points,
notifications, and immutable Admin audit events. `OBSERVABILITY-RUNBOOK.md` defines triage,
redaction, recommended alerts, and owners. No external log sink, error tracker, metrics/APM, uptime
probe, SLO, pager, or incident exercise is configured, so production operations are not ready.

## 12. Performance baseline

The final production build generated 71 customer pages and 36 Admin pages. Representative Next.js
first-load values are:

| Route group                  | First-load JS |
| ---------------------------- | ------------: |
| Listing wizard shared routes |        298 kB |
| Transaction workspace        |        294 kB |
| Offer workspace              |        292 kB |
| Reset password               |        273 kB |
| Customer marketplace browse  |        229 kB |
| Admin overview               |        240 kB |
| Admin publication detail     |        223 kB |

These are baselines, not budgets. The build retains a non-fatal Supabase browser/SSR Edge-runtime
warning and webpack large-cache-string warnings. Runtime boundary, Web Vitals, image/CDN behavior,
and slow queries must be measured on the selected platform. See `PRODUCTION-READINESS.md`.

## 13. Deployment runbook

`DEPLOYMENT-RUNBOOK.md` provides a provider-neutral sequence for approvals, configuration,
validation, backup, migrations, Storage/Auth/email setup, one-time Admin bootstrap, separate web
and Admin artifacts, smoke checks, warnings, and rollback. `apps/worker` remains a placeholder and
must not be deployed. No deployment was performed.

## 14. Rollback runbook

`ROLLBACK-RUNBOOK.md` distinguishes safe application artifact rollback from database/Storage
recovery. Applied migrations have no automatic down path; incompatible data changes require an
approved restore/forward repair while preserving audit evidence. Auth/email impact, communication,
and post-rollback verification are included.

## 15. Smoke tests

`docs/runbooks/smoke-tests.md` covers customer and Admin availability, Auth, role denial,
marketplace/detail, private routes, queues, audit, database, Storage, email, API, headers,
configuration, and post-deploy evidence. The automated local equivalents pass; a hosted smoke run
cannot occur until an environment exists.

## 16. Handover

`HANDOVER.md` gives non-engineering stakeholders a bounded product summary and directs operators to
local setup, validation, deployment, recovery, migrations, documents, email, logs, audit, security,
and limitations. It assigns responsibilities across Product/legal, Engineering, QA/design,
Platform/SRE, Security/privacy, Identity/email, and Release ownership.

## 17. Final validation totals

| Validation                                        | Result                                        |
| ------------------------------------------------- | --------------------------------------------- |
| Configuration unit/security-header checks         | 16 passed                                     |
| Domain, API, Auth, i18n, web/Admin unit/component | 313 passed                                    |
| Unit/component subtotal                           | **329 passed**                                |
| Live database/RLS/Storage/Realtime integration    | **119 passed; 0 failed; 0 skipped**           |
| Customer Playwright                               | **60 passed; 0 failed; 0 skipped**            |
| Admin Playwright                                  | **20 passed; 0 failed; 0 skipped**            |
| Total automated checks                            | **528 passed; 0 failed; 0 skipped/retried**   |
| Fresh migration replay                            | PASS through `0821`                           |
| Focused Storage suite                             | PASS — 5/5                                    |
| Axe checks in executed browser matrix             | PASS — zero serious/critical findings         |
| Local logical backup/restore                      | PASS — 24 public tables restored in isolation |
| Customer/Admin production build                   | PASS — 71/36 pages                            |
| Secrets scan                                      | PASS — zero findings                          |
| Dependency audit                                  | UNRESOLVED external evidence gate             |

Final format, lint, typecheck, root test, E2E, build, diff-whitespace, and secret-scan commands are
the release evidence for this working state. The first build invocation failed configuration
validation because the local CLI environment mapping was unavailable inside the sandbox; the
corrected run used the CLI's actual local variables and both apps built successfully. This
demonstrates the intended fail-fast behavior and is not an application-test failure.

## 18. Known limitations

The authoritative list is `FINAL-LIMITATIONS.md`. Principal blockers are hosting/topology and data
residency, isolated environments and secrets management, production Auth/email settings, monitoring
and incident response, production backup/PITR and Storage recovery, dependency/security review,
Arabic/legal review, UAT-67–70, named sign-offs, provider/data rights, and all real regulated
integrations. Local Supabase CLI/service versions also require parity review.

## 19. Go or no-go decision

**NO-GO for public production.**

The code is suitable for continued local/internal demonstration with fictional data. A controlled
staging deployment is conditional on the external platform, secrets, email, monitoring, backup,
dependency, security, UAT, and named-approval gates in `PRODUCTION-READINESS.md`. This Week 8 work
does not authorize or begin a public launch.
