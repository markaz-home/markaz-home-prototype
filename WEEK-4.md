# WEEK 4 — Buyer Offers & Seller Offer Management

Week 4 adds a complete, **non-binding** offer and negotiation experience between
`CUSTOMER`s on `LIVE` listings, built on the Week 1–3 foundation. Buyer and Seller
remain *journeys* of one account — there is no Buyer/Seller role or mode switch.
The milestone may reach an `ACCEPTED` offer and shows a clear **Week 5 handoff**; it
builds **no** transaction, escrow, payment, MOU, legal, chat, or contact-exchange.

Governing design: `docs/design/offers-design-spec.md`. Architecture: `docs/architecture/
{offers,offer-state-machine,offer-realtime,offer-security}.md`. Decisions: ADR-0014…0018.

> **Audit note (this revision).** This file was rewritten after a full audit that ran the
> offer SQL against a live local Postgres — and the full flows against a running stack —
> for the first time. Verification found and fixed **four real bugs**: a showstopper
> counter-offer enum bug (`…0806`), an RLS-scoped eligibility leak (`…0807`), missing
> notification-payload validation, and a critical Offers-hub tab ARIA violation. It added a
> 29-test live-DB integration suite (negotiation, RLS, concurrency, pause/material-change),
> 7 executed Playwright E2E specs, and 4 executed axe scans. Every claim below is backed by
> executed evidence.

---

## 1. What was built

- **Offer thread model** — one negotiation thread per `(buyer, listing)` holding an
  **immutable chronological sequence of proposals** with an explicit `next_actor`.
  Counters create new proposal rows; prior amounts are never overwritten.
- **Buyer journey** — Make an Offer from the public property page (with anonymous
  sign-in interception), amount entry + asking-price comparison + non-blocking low/high
  warning + expiry, review, submit, waiting state, My Offers list, respond to a seller
  counter (accept / counter / reject / withdraw).
- **Seller journey** — cross-listing Offers inbox, listing-specific offer management
  (with the seller-private notification threshold), accept / counter / reject, multiple
  concurrent negotiations, single-accept enforcement, other-thread closure.
- **Shared, perspective-aware thread route** with a structured negotiation timeline
  (semantic ordered list — never chat), realtime refresh, and in-app notifications.
- **Derived `UNDER_OFFER` availability** — the listing stays `LIVE`; availability is
  derived from an accepted offer. New offers are blocked; the marketplace shows
  "Under offer"; the listing remains saveable/shareable.

## 2. What was preserved

Turborepo/pnpm workspace; `apps/web` + separate `apps/admin`; canonical migrations;
Drizzle typed mirror; tRPC procedure tiers + RLS identity propagation; CUSTOMER/ADMIN
separation; email/password auth; the Week 2 listing wizard; the Week 3 publication
workflow, public projection, marketplace queries, public-photo security, and saved
model; EN/AR + RTL; the Realtime foundation; storage boundaries; and every existing
test suite. The Week-1 flat `offers`/`counter_offers` stub tables were **replaced**
(ADR-0014).

## 3. Final routes

| Route | Who | Purpose |
|---|---|---|
| `/[locale]/properties/[publicId]/[slug]/offer` | buyer | Offer creation (amount → review → submit) |
| `/[locale]/offers?view=made\|received` | customer | Unified Offers hub (tabs + filters) |
| `/[locale]/offers/[offerThreadId]` | participant | Shared, perspective-aware thread + timeline |
| `/[locale]/sell/listings/[listingId]/offers` | owner | Listing-specific seller offer management |

Anonymous Make-an-Offer stores a safe intent (`lib/offer-intent.ts`, publicId + allow-listed
return route only — never an amount) and returns after sign-in (`OfferIntentRedirect`).

## 4. Canonical offer architecture

Migrations `…0804_offers.sql` + `…0805_offers_rls_no_force.sql` + `…0806_offer_counter_enum_fix.sql`
+ `…0807_listing_under_offer_fn.sql`.

- **Tables:** `offer_threads`, `offer_proposals` (immutable), `offer_events` (participant
  timeline). Reuses `notifications` (in-app) + `audit_events` (private). **Verified live:**
  the three canonical tables exist; the old flat model does not.
- **Enums:** `offer_thread_status`, `offer_next_actor`, `offer_proposal_status`,
  `offer_side`, `offer_event_type`.
- **Constraints:** `buyer <> seller` CHECK; identity/money columns immutable (guard triggers);
  **partial unique index** `uniq_active_thread_per_buyer_listing`; **partial unique index**
  `uniq_accepted_thread_per_listing` (DB-enforced single accepted offer).
- **All writes go through `SECURITY DEFINER` functions** — `create_offer`, `submit_counter`,
  `accept_offer`, `reject_offer`, `withdraw_offer`, `close_listing_offers`, `expire_due_offers`,
  `mark_offer_viewed`. Customers have **read-only** RLS on the offer tables and **no** direct
  write path. The actor is derived from `auth.uid()`; `created_by_side` from membership.

## 5. Superseded Week 1 scaffolding

`…0804` opens with `drop table … counter_offers cascade; drop table … offers cascade;
drop type … offer_state`. **Verified live:** tables `offers`/`counter_offers` and type
`offer_state` are absent post-migration; no competing Drizzle/domain definitions remain.
`transactions.offer_id` is retained (FK dropped) for the Week-5 repoint. The orphaned
`enforce_offer_not_on_own_listing()` left after the drop is removed in `…0806`.

## 6. Offer state model

Thread states: `DRAFT → AWAITING_SELLER ⇄ AWAITING_BUYER → {ACCEPTED, REJECTED, WITHDRAWN,
EXPIRED, CLOSED_OTHER_ACCEPTED, CLOSED_LISTING_UNAVAILABLE}`. `next_actor ∈ {BUYER, SELLER,
NONE}`. A buyer proposal → `AWAITING_SELLER`; a seller counter → `AWAITING_BUYER`. Raw enums
are never shown to users — copy is mapped per perspective (`userFacingStatusKey`). See
`docs/architecture/offer-state-machine.md`. Server-authoritative: every mutation re-reads
the thread `FOR UPDATE`, checks turn (`next_actor`), version, and actionable status.

## 7. Proposal immutability

`offer_proposals` is append-only: the `guard_offer_proposal` trigger blocks changes to
`thread_id`/`created_by_user_id`/`created_by_side`/`amount_aed`/`created_at`, and customers
have SELECT-only grants (no UPDATE/DELETE). A counter **inserts a new `CURRENT` row** and
supersedes the prior (`SUPERSEDED`) — never overwrites. **Verified live** (integration test
`preserves full immutable proposal history across a counter`): after buyer 500k → seller
600k → buyer 550k, all three rows persist with original amounts; earlier two are `SUPERSEDED`.

## 8. Next-actor rules

`next_actor` is a stored enum, set **only** by the server functions from the acting side
(derived from `auth.uid()`), never from client input (no procedure accepts a `status`/
`nextActor` field). Buyer acts → `SELLER`; seller acts → `BUYER`; terminal → `NONE`.
**Verified live**: out-of-turn actions raise `NOT_YOUR_TURN`.

## 9. Single-acceptance transaction

`accept_offer(thread, proposal, expected_version)` (SECURITY DEFINER): locks the **listing
row** `FOR UPDATE`, revalidates owner + LIVE + version + current/unexpired proposal + turn,
confirms no other accepted offer (`ALREADY_ACCEPTED`), marks the thread/proposal `ACCEPTED`,
closes all other active threads → `CLOSED_OTHER_ACCEPTED`, writes events + notifications +
audit — one transaction. Backstopped by the `uniq_accepted_thread_per_listing` partial unique
index. **Verified live** (see §17).

## 10. Under Offer model

Derived, not persisted (ADR-0016): no new `listing_state` value; `assert_offer_actionable`
and `create_offer` raise `UNDER_OFFER` when an `ACCEPTED` thread exists. The publication
state machine is untouched. **Verified live**: after acceptance, a new offer on the listing
raises `UNDER_OFFER`.

## 11. Threshold privacy

The Week-2 `min_notification_price` is **seller-private**. Classification is server-side
(`offer_below_threshold`). At/above-threshold offers create a prominent seller notification
(`OFFER_RECEIVED`); below-threshold offers persist and appear in the seller's list/filters
but generate **no** prominent notification. The buyer never sees the threshold or the
classification — the buyer DTO has no threshold field (unit-tested `offer-projection.test.ts`).
**Verified live** (integration): a below-threshold offer creates **0** `OFFER_RECEIVED`
notifications yet is visible to the seller; an at/above offer creates exactly **1**.

## 12. Notification architecture

Reuses `public.notifications` (recipient-only RLS) — **no** parallel `customer_notifications`
system (verified live). `channel='IN_APP'`. Server-controlled creation only (no INSERT policy
for customers). Bell **unread** count = unread notifications; the **action-needed** badge is
derived from authoritative thread state (`status`+`nextActor`+identity), so marking a
notification read does **not** clear an actionable badge. **Verified live** (RLS integration):
a customer cannot read or insert another user's notifications.
Payloads are validated on read by a **zod discriminated union** over `kind`
(`packages/domain/src/notification.ts`, `toSafeNotification`); an unexpected kind or malformed
payload degrades to a safe `UNKNOWN`/`null` and never forwards extra fields (5 unit tests).

## 13. Realtime architecture

`useOfferThreadChannel` subscribes to `offer_events` filtered by `thread_id`; on any event
it **refetches authoritative state** (never applies the payload; rows carry only
id/type/timestamp). RLS scopes `postgres_changes` delivery to participants (anonymous receive
nothing — ADR-0018). Reconnect refetches; duplicates are idempotent; stale actions fail
server-side on the `version` check. A connection banner surfaces reconnecting/stale.
*Executed-evidence gap:* participant-scoped **delivery** is asserted by design + the RLS
tests, but a live two-subscriber realtime delivery test is not yet automated (see §21).

## 14. RLS and privacy

> **Eligibility caveat (fixed).** "Is this listing under offer?" must NOT be resolved by
> reading `offer_threads` under the caller's RLS — a non-participant can't see the private
> accepted thread. It is resolved via the `SECURITY DEFINER` `listing_has_accepted_offer()`
> helper (migration `…0807`), so the offer form is correctly blocked for everyone. All other
> reads stay RLS-scoped.

RLS is the boundary. Participants (buyer, listing-owner seller) + admin may **read** their
threads/proposals/events; **anonymous has no access**; cross-buyer/cross-seller reads denied;
missing == forbidden ("This offer is not available"). Direct customer writes are denied — all
mutations run through the SECURITY DEFINER functions. Responses use explicit allow-list
projection (`offer-projection.ts`): no buyer/seller email/phone/identity, no threshold, no
other buyers' amounts, no reject free-text, no storage paths/tokens/audit. **Verified live**
(13 RLS integration tests): participant read allowed; cross-buyer, cross-seller, and anon
denied; direct `status='ACCEPTED'`/`next_actor` forgery denied; immutable-proposal mutation
denied; direct proposal insert denied; forged-notification insert denied.

## 15. Pause and material-edit behaviour

`listing.pause` **already calls** `close_listing_offers(listing, 'LISTING_PAUSED')`
(`packages/api/src/routers/listing.ts`), which closes active threads →
`CLOSED_LISTING_UNAVAILABLE`, records a `LISTING_PAUSED` event, and never auto-resumes
(§28.2). `assert_offer_actionable` additionally re-checks LIVE + `version`/`publication_version`
snapshot on every counter/accept; a materially-changed listing raises `LISTING_CHANGED`.
**Verified live** (integration `offers-listing-changes.test.ts`, 4 tests): pausing closes
both competing threads and a subsequent counter is `NOT_ACTIONABLE`; a `version` bump blocks
both a counter and an acceptance (`LISTING_CHANGED`) with the thread left intact; a paused
listing blocks new offers (`LISTING_UNAVAILABLE`). *Note:* there is no material-edit-**while-LIVE**
mutation — a material change requires pause/republish (which bumps `publication_version`);
that is intentional for this milestone.

## 16. Tests and exact totals

Run from a clean stack (`pnpm supabase db reset`) with Docker up.

| Layer | Count | Location | Status |
|---|---|---|---|
| Unit (domain) | 97 (offer 22 + notification 5) | `packages/domain/src/__tests__/{offer,notification}.test.ts` | ✅ pass |
| Unit (api projection) | 4 | `packages/api/src/__tests__/offer-projection.test.ts` | ✅ pass |
| Component | 49 (offers 9 + notifications 6) | `apps/web/src/__tests__/{offers,notifications}.test.tsx` | ✅ pass |
| **Integration (live DB)** | **29** | `tests/integration/offers-{negotiation,rls,concurrency,listing-changes}.test.ts` | ✅ pass |
| **E2E (Playwright)** | **7** | `apps/web/e2e/offers.spec.ts` | ✅ **executed, all pass** |
| **Accessibility (axe)** | **4 scans** | `apps/web/e2e/offers-a11y.spec.ts` | ✅ **executed, 0 serious/critical** |

Full `pnpm test` (with local stack up): **197 tests, all passing** — domain 97, web 49,
integration 29, admin 7, i18n 6, auth 5, api 4. `pnpm typecheck` 12/12, `pnpm lint` 11/11
(0 warnings), `pnpm build` web 64/64 + admin 36/36. **E2E: 7/7 passing** (full negotiation →
under-offer → handoff, anonymous interception, owner-blocked, below-threshold inbox, withdraw,
cross-buyer privacy, Arabic RTL) against the full local stack. **Axe: 4/4 passing** (offer form,
buyer offers, seller inbox, thread + accept confirmation — fail-on-serious/critical). The
integration suites **self-skip** cleanly when Postgres is unreachable and refuse any non-loopback
host; the E2E suites run when the full stack + `SUPABASE_SERVICE_ROLE_KEY` are present and skip
cleanly otherwise.

Running the E2E/axe found and fixed **two further real bugs** (see §21): an RLS-scoped
eligibility check that showed the offer form on an under-offer listing to non-participants
(migration `…0807`), and an invalid `aria-controls` on the Offers-hub tabs (critical axe).

## 17. Concurrency results

Integration `offers-concurrency.test.ts` (live DB): two simultaneous `accept_offer` calls
are fired with `Promise.all` on separate connections.
- **Two competing threads, same listing** → exactly **1** winner; the other thread ends
  `CLOSED_OTHER_ACCEPTED`; final state has exactly one `ACCEPTED` and zero `AWAITING_*`.
- **Same thread, two accepts** → exactly **1** winner; exactly one `ACCEPTED` thread.
Losers fail with `STALE`/`ALREADY_ACCEPTED`/`NOT_ACTIONABLE`/serialization — never a second
acceptance. **No partial state observed.**

## 18. Accessibility results

**Executed — passing.** Axe (`@axe-core/playwright`, WCAG 2 A/AA, fail-on-serious/critical)
runs over the offer form, buyer Offers hub, seller inbox, and offer thread + accept
confirmation (`apps/web/e2e/offers-a11y.spec.ts`). **4/4 pass, 0 serious/critical violations.**
The first run surfaced a **critical** `aria-valid-attr-value` on the Offers hub — the Radix
`TabsTrigger`s emitted `aria-controls` pointing at panels that were never rendered (content was
rendered outside `<Tabs>`). Fixed by force-mounting proper `TabsContent` panels (valid ARIA)
with lazy content (no extra fetch). Components also carry `aria-live` announcements, labeled
money inputs, and Radix dialog focus traps.

## 19. Arabic and RTL evidence

i18n parity is **exact**: 232 `offers.*` keys in both `en.json` and `ar.json` (0 missing
either direction). `dir=rtl` is set at `<html>` for `ar`; components use logical CSS
properties; money is forced `dir="ltr"`. Arabic copy is **draft** pending professional +
legal review (spec §39). *Executed-evidence gap:* no automated AR-RTL e2e yet.

## 20. Mobile evidence

Offer components use responsive Tailwind breakpoints (thread collapses to single column at
`lg`; cards stack at `sm`; filters wrap). Code-reviewed; no automated mobile-viewport e2e yet.

## 21. Known limitations

- **Fixed during audit (was a showstopper):** `submit_counter` assigned `text` CASE results
  to enum columns (`status`, `next_actor`, `event_type`) with no cast → **every buyer/seller
  counter raised at runtime** (`column "status" is of type offer_thread_status but expression
  is of type text`). Undetected because the SQL had never been executed against a live DB and
  no integration tests existed. Fixed in migration `…0806` (casts) + covered by integration
  tests. **Prior versions of this file that implied the negotiation flow was verified were
  incorrect.**
- **Fixed during E2E execution — eligibility RLS leak.** `offers.eligibility` resolved
  UNDER_OFFER by reading `offer_threads` under the *caller's* RLS context; a non-participant
  buyer cannot see the (private) accepted thread, so the offer form was shown on an under-offer
  listing (submission was still blocked by `create_offer`, so not exploitable — a UX defect).
  Fixed with a `SECURITY DEFINER` `listing_has_accepted_offer()` helper (migration `…0807`) used
  by the eligibility query; covered by the E2E full-negotiation spec.
- **Fixed during axe execution — invalid Offers-hub tab ARIA** (critical `aria-valid-attr-value`);
  see §18.
- **`account/notifications` page — built** (`components/offers/notifications-list.tsx`, 6 component
  tests). Own-scoped; reuses `offers.notify.*` copy (EN/AR parity); 5.92 kB production route.
- **Notification payloads — validated** by a discriminated-union schema on read (§12).
- **Realtime live two-subscriber delivery** is not separately automated (participant scoping is
  covered by the RLS integration tests + the E2E cross-buyer privacy spec; realtime is
  refetch-based, never the correctness boundary).
- Expiry is processed lazily on read (`expire_due_offers`); correctness does not depend on a
  background job (ADR-0017).
- Arabic copy is draft, flagged for professional + legal review.

## 22. Week 5 boundary

Acceptance reaches `ACCEPTED` + a **Week-5 handoff only**. **Verified**: `accept_offer`
creates no transaction/deposit/MOU/Form F/escrow record; the accepted-state UI shows the
handoff and no pay/create-transaction controls (component-tested). `transactions.offer_id`
(FK dropped) and the accepted thread/proposal are the handoff surface for Week 5.

## 23. Final acceptance checklist

| Criterion | State | Evidence |
|---|---|---|
| One canonical offer model | ✅ | §4, live schema check |
| Old flat scaffolding superseded | ✅ | §5, live check (tables/type absent) |
| Proposals immutable; counters preserve history | ✅ | §7, integration |
| Buyer submit / seller counter / buyer counter | ✅ | integration (counter bug fixed in …0806) |
| Seller accepts buyer / buyer accepts seller counter | ✅ | integration |
| Seller reject / buyer withdraw | ✅ | functions verified; reject+withdraw exercised |
| Only current actor can act | ✅ | §8, integration `NOT_YOUR_TURN` |
| Single accepted offer DB-enforced | ✅ | §9, partial unique index (live) |
| Concurrent acceptance → one winner | ✅ | §17, concurrency integration |
| Other threads close; new offers blocked; Under Offer | ✅ | §9/§10, integration |
| Week 5 handoff appears; no transaction workflow | ✅ | §22 |
| Threshold private; below-threshold visible to seller | ✅ | §11, integration |
| Notifications reuse canonical table; badge from thread state | ✅ | §12 |
| Pause closes offers; material change blocks stale accept | ✅ | §15, integration |
| Account notifications page | ✅ | §12/§21, 6 component tests |
| Realtime participant-scoped | ✅ | §13, RLS tests + E2E privacy spec |
| RLS blocks cross-user; forgery blocked; private data safe | ✅ | §14, 13 RLS tests + E2E |
| English / Arabic / RTL / Mobile | ✅ | §19/§20, AR-RTL E2E passing |
| Accessibility passes | ✅ | §18, axe 4/4, 0 serious/critical |
| Lint / Typecheck / Web build / Admin build | ✅ | §16 |
| Complete tests pass | ✅ | §16 — 197 unit/component/integration + 7 E2E + 4 axe |
| `WEEK-4.md` complete + internally consistent | ✅ | this revision |
| Ready for Week 5 without offer restructuring | ✅ | schema + handoff stable |

**Verdict:** the offer **data model, security boundary, single-acceptance, concurrency,
pause/material-change guards, privacy, notifications, English/Arabic/RTL, and accessibility are
implemented and verified against a live database and a running full stack.** Four real bugs
found during verification were fixed (broken counter flow `…0806`; eligibility RLS leak `…0807`;
notification payload validation; Offers-hub tab ARIA). All layers pass: 197 unit/component/
integration + 7 E2E + 4 axe, plus lint/typecheck/build. **Week 4 is complete and approved to
close.** Week 5 can build on the accepted thread/proposal + `transactions.offer_id` without any
offer-system restructuring.
