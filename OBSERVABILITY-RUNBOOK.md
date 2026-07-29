# Observability runbook

## Current state

MARKAZ emits structured server logs through Pino. API middleware records procedure, operation type,
authenticated actor ID where present, safe error code, duration, and slow-request classification.
Auth, database, Storage, external-adapter, and Admin workflow failures reach these server logging
integration points. Immutable `audit_events` are the authoritative record of Admin/control actions;
they are not a replacement for operational telemetry. Request/trace IDs are a recommended provider
integration and are not currently implemented.

There is no external log sink, client error tracker, metrics/APM service, uptime monitor, trace
backend, pager, or alert owner configured. This is a production blocker.

## Redaction rules

Never log passwords, OTPs, recovery links, token hashes, bearer/cookie values, service keys,
database URLs, private document paths, signed URLs, document content, or full user email. Production
tRPC responses redact unexpected internal messages/stacks. Monitoring integrations must preserve
the same policy and apply retention/access controls appropriate to personal data.

## Required integration points

| Signal            | Capture                                                                                  | Suggested alert                                                         |
| ----------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Availability      | HTTPS checks for web/Admin and safe API query                                            | Two consecutive failures or elevated latency                            |
| API               | Request count, latency percentiles, safe error code/procedure                            | 5xx/error-rate or p95 latency above agreed SLO                          |
| Client            | Sanitized rendering/navigation failures with release SHA                                 | New high-volume exception                                               |
| Auth              | Aggregate signup/login/verification/recovery success and throttles—no identifiers/tokens | Failure/throttle spike or provider outage                               |
| Database          | Connections, saturation, locks, replication/backup health, slow queries                  | Exhaustion, long lock, replication/backup failure                       |
| Storage           | Upload/read/signing errors, capacity, malware-scan queue once present                    | Private access anomaly, error spike, capacity threshold                 |
| Email             | Delivery, bounce, complaint, suppression, template/provider error                        | Delivery drop, bounce/complaint threshold                               |
| External adapters | Mode, timeout, circuit state, sanitized provider status                                  | Staging UAE PASS outage; Bayut adapter error only where legally enabled |
| Admin/audit       | Capability, action/reason, entity ID, actor ID, outcome; audit append failure            | Audit-write failure, unusual destructive-control volume                 |
| Jobs              | None currently; `apps/worker` is a placeholder                                           | Do not deploy/monitor as a worker                                       |

## Triage

1. Declare severity and incident owner; record environment, release SHA, start time, and customer
   impact.
2. Verify monitoring is not exposing a secret; rotate immediately if suspected.
3. Correlate safe request ID, application logs, provider health, DB/Storage metrics, and immutable
   audit events.
4. Stop the affected adapter or roll back application code only within `ROLLBACK-RUNBOOK.md`.
5. Preserve evidence. Do not edit/delete audit history.
6. Validate recovery with the smoke checklist and publish an incident/update record.

## Ownership to assign

Before shared staging: App owner, Platform/SRE owner, Security/privacy owner, database/Auth/Storage
owner, email owner, and release/incident commander. Before production, define SLOs, severity model,
pager rotation, escalation contacts, dashboards, retention, access review, and an incident drill.
