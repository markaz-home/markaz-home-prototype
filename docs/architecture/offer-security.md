# Offer security & privacy (Week 4)

RLS is the authorisation boundary (offers-design-spec §37); client/API checks are UX only.

## Access matrix

| Actor                  | Threads / proposals / events                                              |
| ---------------------- | ------------------------------------------------------------------------- |
| Anonymous              | **No access** (no grant, no policy)                                       |
| Buyer                  | Read own threads only                                                     |
| Seller (listing owner) | Read threads on owned listings only                                       |
| Admin                  | Read all (parity with other tables)                                       |
| Any customer           | **No direct INSERT/UPDATE/DELETE** — writes only via SECURITY DEFINER fns |

Enforced in `supabase/migrations/20260301000804_offers.sql`:

- `force row level security` on `offer_threads`/`offer_proposals`/`offer_events`;
  participant-only `SELECT` policies; `grant select` to `authenticated` only.
- Guard triggers make identity + money columns immutable and block `authenticated`/`anon`
  from setting `status='ACCEPTED'` / `accepted_proposal_id` (only the elevated acceptance
  function, running as its owner, may).
- All mutations run through `SECURITY DEFINER` functions owned by a BYPASSRLS role; they
  read the actor from `auth.uid()` and derive `created_by_side` from thread membership —
  the client cannot supply buyer/seller/owner/side/status/next_actor/threshold/accepted.

## Single-accepted-offer enforcement (ADR-0015)

Two layers: (1) the partial unique index `uniq_accepted_thread_per_listing`; (2) the
`accept_offer` function locks the listing row (`FOR UPDATE`), re-reads, and rejects if any
accepted thread already exists. Two concurrent accepts → exactly one winner (integration
test: `tests/integration/offers.test.ts`).

## Privacy (never exposed)

Buyer email/phone/name/id; seller email/phone; the **notification threshold** (to buyers);
**competing offers / other buyers' amounts or identities**; internal IDs in copy; audit
events; raw rejection reasons; storage paths; realtime credentials. The buyer-facing DTO
is built by explicit allow-list and **has no threshold field**; sellers see a stable
`Buyer NN` + "Verified customer" label (never identity). Missing and forbidden threads
return the **same** copy ("This offer is not available") so existence is not disclosed.

## Concurrency

Every mutation carries `expected_version`; the server rejects double-accept, action on a
superseded proposal, withdraw-after-accept, counter-after-expiry, and action after pause.

## Audit (`audit_events`)

Safe events only: `OFFER_THREAD_CREATED`, `OFFER_PROPOSAL_SUBMITTED`,
`OFFER_COUNTERED_BY_{BUYER,SELLER}`, `OFFER_ACCEPTED`, `OFFER_REJECTED`, `OFFER_WITHDRAWN`,
`OFFER_CLOSED_OTHER_ACCEPTED`, `OFFER_CLOSED_LISTING_UNAVAILABLE`,
`OFFER_NOTIFICATION_CREATED`. No tokens, contact details, free-form text, or threshold in
buyer-accessible metadata.
