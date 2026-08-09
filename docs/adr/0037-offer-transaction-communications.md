# ADR-0037 — Offer and transaction communications

## Status

Accepted (9 August 2026).

## Context

The original offer and transaction milestones stored terse in-app notifications but did not
deliver email. The dropdown could render generic “View” rows, viewing an offer had no buyer
receipt, accepted-offer continuity depended too heavily on finding a CTA, and waiting states had
no reminder policy.

## Decision

- `public.notifications` remains the canonical recipient-scoped activity record. Payloads are
  enriched at write time with allow-listed listing and amount context; customer reads still pass
  through the discriminated-union projection.
- Every valid initial offer creates one seller notification, while the seller's price threshold
  remains private. A buyer-authored proposal creates one in-app-only view receipt when the seller
  first opens that proposal.
- Counter, reject, withdraw, close/expiry, accepted-offer transaction creation, and important
  transaction events create email jobs. Acceptance creates the transaction immediately and its
  two `TRANSACTION_CREATED` notifications are the one accepted-offer email for each participant.
- Email jobs are inserted transactionally into `private.notification_email_outbox`, claimed with
  `FOR UPDATE SKIP LOCKED`, retried with a stable provider idempotency key, and never expose the
  provider or service credentials to customer code.
- A trusted scheduled worker inserts one `TRANSACTION_REMINDER` per transaction version and
  waiting recipient after 24 unchanged hours. The notification dedupe key makes repeated scheduler
  runs safe.
- Transaction UI is split into six focused stage URLs. Buyer and seller still operate on one
  participant-authorised transaction and see each side's progress without contact or identity
  disclosure.

## Consequences

Customers receive detailed real-time activity cards and branded, event-specific email without
making network calls inside state-transition transactions. Delivery is durable and retryable;
viewing remains low-noise and in-app only. Production delivery requires the Resend provider,
sender domain, and cron secret to be configured. Arabic transactional copy remains draft pending
review.
