# MARKAZ Home handover

## Plain-English product summary

MARKAZ Home is a Dubai-first property marketplace prototype. One customer account can both sell and
buy: create a listing, pass persisted simulated property checks, publish through Admin review,
browse/save homes, negotiate a non-binding offer, and follow a shared simulated transaction. A
separate operations app lets authorized Admins review and recover workflows with reasons and an
immutable audit trail.

Real UAE property, identity, permit, payment, escrow, transfer, and legal services are **not**
connected. The product must not be represented as completing a regulated property transaction.

## Operator map

| Need                      | Start here                                               |
| ------------------------- | -------------------------------------------------------- |
| Run locally               | `README.md`, `docs/runbooks/local-development.md`        |
| Validate configuration    | `ENVIRONMENT-VARIABLES.md`, `pnpm config:check`          |
| Validate release          | `WEEK-8.md`, `docs/runbooks/release-candidate.md`        |
| Deploy a controlled build | `DEPLOYMENT-RUNBOOK.md`                                  |
| Roll back/recover         | `ROLLBACK-RUNBOOK.md`, `docs/runbooks/backup-restore.md` |
| Auth/Admin bootstrap      | `docs/runbooks/auth-readiness.md`                        |
| Migrations/database       | `docs/runbooks/database-migrations.md`                   |
| Documents/photos          | `docs/runbooks/storage-readiness.md`                     |
| Email                     | `docs/runbooks/email-readiness.md`                       |
| Incidents/telemetry       | `OBSERVABILITY-RUNBOOK.md`                               |
| Security/limitations      | `SECURITY-READINESS.md`, `FINAL-LIMITATIONS.md`          |

## Day-to-day rules

- Customers sign up themselves; never add a shared demo customer seed.
- Admins are bootstrapped by environment-driven Admin API only. Remove/rotate the temporary secret.
- Run all customer queries under RLS context and use `ctx.tx`; service role is never a customer path.
- Append a new canonical SQL migration plus the Drizzle mirror; never edit applied history.
- Private files use scoped paths/signed URLs. Admin document access requires capability, purpose,
  acknowledgement, and audit. Never expose raw paths or signed URLs in DTOs/logs.
- Closed Admin reasons and audit events are operational evidence. Never modify audit history.
- Keep Bayut disabled for production and UAE PASS simulated unless separate approval/configuration
  is supplied.

## Admin operations

Use the separate Admin origin. Queues cover publication and transaction operations; controls are
capability-gated, reason-coded, database-enforced, and audited. Admin is not customer impersonation
and cannot make offers/listings. Read audit events by actor, action, entity, reason, outcome, and
time; metadata is allow-listed and should contain no tokens/document paths.

## Owner responsibilities

- **Product/legal:** simulation wording, data rights, Arabic/legal review, regulated-scope claims.
- **Engineering:** code, migrations, test health, application incident support.
- **QA/design:** complete UAT-67–70/device/RTL evidence and accessibility/release sign-off.
- **Platform/SRE:** hosting, regions, TLS/DNS, secrets, Supabase/database/Storage, monitoring, backup,
  restore, capacity, incident response.
- **Security/privacy:** threat/dependency/penetration review, secret rotation/access, retention.
- **Identity/email:** Auth/UAE PASS settings, callbacks, rate limits, sender/domain/deliverability.
- **Release owner:** exact artifact, approvals, change record, smoke/rollback decision.

## Handover state

The immutable Week 7 RC remains `rc-week-7`. Week 8 adds deployment preparation and operational
hardening but does not deploy. Public production remains no-go; external dependencies and final
approvals are in `FINAL-LIMITATIONS.md`.
