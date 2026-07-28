# Rollback runbook

## Triggers

Rollback or stop rollout for authorization/privacy failure, migration/data corruption, incorrect
Auth origin/cookies, missing audit events, unrecoverable signup/login, severe error/latency
regression, or secret exposure. A minor copy/layout issue may use forward-fix only with release-owner
approval.

## Application rollback

1. Freeze deploys and identify current/previous exact artifact SHA/digest.
2. Confirm the previous app is compatible with the **current** database.
3. Shift web and Admin separately to the previous immutable artifact; do not rebuild from a moving
   branch.
4. Disable affected optional adapters (`BAYUT_API_MODE=disabled`, `UAE_PASS_MODE=simulated`) when
   permitted; never use a mode switch to hide a core security/data failure.
5. Run the smoke checklist and observe error/auth/audit signals.

## Database

Canonical migrations are forward-only. Do not run ad hoc down SQL. If the new schema is backward
compatible, retain it while rolling back code. For incompatible corruption:

1. stop writes;
2. preserve logs/audit and capture current state;
3. restore the verified pre-deploy database backup into an isolated target;
4. validate migrations, RLS/grants, row counts, Auth, audit, and critical journeys;
5. cut traffic only with database/release-owner approval.

This is restore-based recovery. Data written after the backup may be lost; the approved RPO/RTO and
reconciliation plan must govern.

## Storage, Auth, and email

- Restore/version Storage objects independently, then reconcile object manifests with
  `storage.objects` and application metadata. Never make a private bucket public to recover access.
- Database restore does not automatically restore object bytes or external Auth/email provider state.
- Revoking Auth sessions or rotating keys impacts all users/apps; record the decision and redeploy
  both apps where credentials are shared.
- Pause email if callbacks/templates are wrong; preserve suppression/bounce state and never resend
  token-bearing messages indiscriminately.

## Security/audit and communication

Never delete or rewrite audit history. For suspected secret exposure, revoke/rotate in the source
system, review access, invalidate sessions where required, and redeploy. Record incident owner,
timeline, impact, decisions, customer/stakeholder communications, data-loss estimate, and recovery
evidence.

## Exit

Rollback is complete only when customer/Admin health, Auth, API, database, Storage privacy, email,
audit, and monitoring checks pass on the chosen artifact and stakeholders receive the recorded
status. Open a follow-up for root cause and safe forward recovery.
