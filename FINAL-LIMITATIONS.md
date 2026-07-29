# Final limitations

These are not hidden backlog items; they bound what the prototype may claim and where it may run.

## Product and regulatory

- DLD, Trakheesi, Madmoun, UAE PASS production, payments, escrow, contracts, legal completion, and
  ownership transfer are simulated or absent.
- Offers are non-binding; transaction completion and `SOLD_DEMO` are demonstration states.
- No customer impersonation, shared demo seed, messaging/chat, contact exchange, map search, or
  durable background worker.
- BayutAPI is an unofficial POC. Production mode is blocked pending redistribution/data rights and
  legal approval.

## Content/UAT

- Arabic legal and transactional copy is draft and professionally unreviewed.
- UAT-67–70 remain partial: full uninterrupted Arabic customer/Admin journeys and full mobile
  customer/Admin matrices have not been executed. Existing targeted evidence is described in
  `WEEK-7.md`; no full completion is claimed.
- Named Product, Engineering, QA, Design, Security, and Release sign-offs remain Pending unless an
  actual approver updates the record.

## Platform and operations

- No hosting provider, final topology, UAE data-residency approval, production domain/TLS, capacity
  plan, or deployment workflow.
- Self-hosted Supabase on RDS is not validated.
- No production monitoring/error tracking, log sink, SLOs, alerts/pager, incident drill, secrets
  manager/rotation, backup/PITR policy, Storage backup, or production restore drill.
- Local logical backup/restore is proven; it is not production recovery certification.
- `apps/worker` is a placeholder; durable expiry/notification work is not deployed.

## Auth, email, Storage, and security

- Production Auth redirects, cookies, session policy, rate limits, server-side password policy,
  email sender/domain/deliverability, and UAE PASS staging credentials/app remain external.
- Storage has MIME/size/RLS controls but no malware scanning, content decoding, versioning/lifecycle,
  or configured CDN/cache/restore policy.
- Dependency audit for the exact Week 8 state was not completed: sandbox registry DNS failed and the
  external dependency-graph request was not authorized. This must be run in approved CI.
- No independent threat model, SAST/DAST, penetration test, WAF/bot/rate-abuse review, or production
  security approval.

## Performance/tooling

- First-load sizes are baselines, not production budgets. Offer/transaction/reset/listing routes
  need measurement on the selected host.
- The non-fatal Supabase/Next Edge-runtime warning needs deployment-boundary verification.
- Local Supabase CLI reports a newer CLI and service versions different from the linked project;
  staging/production parity must be pinned and proven.

## Decision

Safe scope: local/internal prototype demonstration with fictional data.

Conditional scope: controlled staging after external platform/security/operations gates.

**Public production: NO-GO.**
