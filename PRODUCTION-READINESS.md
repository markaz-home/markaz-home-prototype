# Production readiness assessment

Assessment date: 2026-07-28

Baseline: `rc-week-7` → `9e9bfa7c76acd33efb8b449ee5d38018f0b85ba5`; Week 8 changes are
forward preparation on `feature/auth-flow-gold`.

## Decision

**NO-GO for public production.**

The codebase is prepared for local/internal demonstration and for a controlled shared staging
deployment only after a platform, isolated environment, secrets, email, monitoring, backup policy,
dependency audit, and accountable approvals are supplied. This assessment does not authorize a
deployment.

## Readiness matrix

| Area                  | Status          | Evidence / remaining gate                                                                 |
| --------------------- | --------------- | ----------------------------------------------------------------------------------------- |
| Immutable RC baseline | Ready           | Week 7 tag/SHA recorded; 501 automated tests at freeze                                    |
| Week 8 code hardening | Locally ready   | Env validation, headers, origin checks, error redaction, Storage constraints pass         |
| Database/RLS          | Locally ready   | Fresh replay through `0821`; 119 live integration tests pass with zero skips              |
| Backup/restore        | Local proof     | Logical local restore passed; production PITR/Storage policy and drill absent             |
| Auth                  | Prototype ready | Journeys covered; production provider settings/cookies/rate limits/password policy absent |
| Storage               | Locally ready   | Bucket MIME/size/privacy and signed-URL proofs pass; malware scan/versioning absent       |
| Email                 | Local only      | Mailpit/templates work; sender/domain/provider/deliverability absent                      |
| Security              | Conditional     | Defense-in-depth added; dependency audit and independent security review absent           |
| Observability         | Not ready       | Structured logs only; no sink, metrics, errors, uptime, alerts, pager, or owner           |
| Hosting/topology      | Not ready       | Provider-neutral contracts only; no deployment configuration or approved data residency   |
| Product/legal         | Not ready       | Arabic review, data rights, regulated integrations, and sign-offs outstanding             |

## Performance baseline

The final Week 8 production artifacts report the following Next.js first-load values. These are
comparison baselines, not budgets:

| Representative route         | First-load JS |
| ---------------------------- | ------------: |
| Listing wizard shared routes |        298 kB |
| Reset password               |        273 kB |
| Offer workspace              |        292 kB |
| Transaction workspace        |        294 kB |
| Admin dashboard/overview     |        240 kB |
| Marketplace browse           |        229 kB |
| Admin publication detail     |        223 kB |

No major performance rewrite is justified without measured user impact.

### Risks and recommendations

- Offer, transaction, reset-password, and large listing routes are the first performance candidates.
  Measure Web Vitals on the selected deployment before setting budgets.
- Next emits a non-fatal Edge-runtime warning from Supabase's transitive browser/SSR dependency.
  Verify the chosen runtime boundary; do not assume all Node APIs are safe at the edge.
- Marketplace/Admin queues are paginated; listing and transaction detail can accumulate nested
  records. Add provider-side slow-query telemetry and query plans for observed hot paths.
- Public photos use Next/image or constrained remote hosts where applicable; draft signed URLs are
  intentionally unproxied. Configure CDN caching for immutable public keys and no public caching for
  private signed URLs.
- Run bundle analyzer only with `ANALYZE=true`; archive the report without committing generated
  artifacts.

## Required gates before controlled staging

1. Select provider, regions/data residency, isolated Supabase/database/Auth/Storage, and exact URLs.
2. Configure environment values in an approved secret store and pass `pnpm config:check`.
3. Configure redirects, cookies, email sender/templates, rate limits, and Admin bootstrap.
4. Configure logs, errors, uptime, alerts, owner/pager, backup/PITR/Storage restore.
5. Run dependency/security review and exact-release CI with zero core skips.
6. Run `docs/runbooks/smoke-tests.md`, UAT-67–70 as applicable, and record named sign-offs.
