# MARKAZ Home — Week 2 Delivery Report

**Milestone: Property Listing Journey (`DRAFT → READY_TO_PUBLISH`)**

The complete customer listing-creation journey is implemented: real, persisted,
secure, resumable, bilingual. The journey ends at **`READY_TO_PUBLISH`** — a
listing **never becomes `LIVE`** in this milestone. Week 1 + Week 1.5 foundations
are preserved (no auth redesign, RLS strategy intact, Customer/Admin model intact).

Authoritative decision records: **ADR-0010** (listing state-machine retry /
invalidation) and **ADR-0011** (draft-photo privacy). UX governed by
`docs/design/property-listing-design-spec.md`.

## 1. What was built

- **Domain** (`packages/domain`): explicit rewind/invalidation on the existing
  state machine, derived section statuses + **server-authoritative readiness**,
  resume-step resolution, investment-case calculations, shared zod validation.
- **Database**: forward-only migration `20260301000700_listing_journey.sql`
  extending `properties`/`listings`, adding `investment_cases`, record
  freshness/outcome columns, exactly-one-cover + one-active-document constraints,
  indexes, investment-case RLS, and a **private `listing-photos-draft` bucket**.
- **Simulation services** (`packages/api/src/services/simulation.ts`):
  `OwnershipVerificationService`, `FormAService`, `PermitService`.
- **tRPC** (`packages/api/src/routers/listing.ts`): create, list, get, saveDetails,
  saveSettings, delete, document.{register,remove}, verification.{start,status,retry},
  investment.{save,skip,setVisibility,remove}, formA.complete, photos.{register,
  reorder,setCover,delete,complete}, permit.{submit,status,retry}, review.{status,
  markReady}, preview (+ tested public-projection mapper).
- **Web UI** (`apps/web`): My Listings, the `/sell/*` route tree, wizard shell
  (stepper + property identity + autosave indicator), and all step screens.
- **i18n**: full `listing/details/ownership/verification/settings/investment/
formA/photos/permit/review/ready/preview` namespaces (en + **ar draft, flagged**).
- **Seed**: Customer A incomplete / verification-pending / READY_TO_PUBLISH
  listings + Customer B draft (fictional).

## 2. What was preserved

Turborepo/pnpm workspace, `apps/web` + separate `apps/admin`, canonical
migrations, Drizzle, tRPC tiers + RLS context, Customer/Admin separation,
email/password auth + verification + recovery, simulated UAE PASS, onboarding
routing, en/ar + RTL, `@markaz/ui`, Supabase local, realtime + storage
foundations, demo provisioning. No authentication redesign.

## 3. Route inventory (design spec §6.1)

```
/[locale]/sell                                      My Listings
/[locale]/sell/new                                  preflight (resume or create)
/[locale]/sell/listings/[id]                        resolver → next required step
/[locale]/sell/listings/[id]/details
/[locale]/sell/listings/[id]/ownership
/[locale]/sell/listings/[id]/verification
/[locale]/sell/listings/[id]/settings
/[locale]/sell/listings/[id]/investment-case        optional
/[locale]/sell/listings/[id]/form-a
/[locale]/sell/listings/[id]/photos
/[locale]/sell/listings/[id]/trakheesi
/[locale]/sell/listings/[id]/review
/[locale]/sell/listings/[id]/ready
/[locale]/sell/listings/[id]/preview                owner-only
```

Every step requires an onboarded `CUSTOMER` (the `(app)` guard) and verifies
ownership **server-side** in tRPC; a non-owner gets a safe "This listing is not
available" (same copy for not-found and forbidden — anti-enumeration). `/listings`
redirects to `/sell`; nav + dashboard CTA repointed.

## 4. Listing state machine (ADR-0010)

Canonical enum unchanged. Settings / Investment Case / Review are derived
sub-states, not enum values. Forward transitions are single-step; **failures keep
the listing recoverable** (the record goes `FAILED_DEMO`; the listing never
auto-moves to `REJECTED`). Invalidating edits (replace document, edit details/
settings after Form A) **rewind** the listing explicitly and supersede stale
records. `READY_TO_PUBLISH` is gated by **server-computed readiness** + customer
confirmation on Review after permit approval.

## 5. Database changes (migration 07) + RLS

- `properties +` building/unit (private)/bathrooms/furnishing/occupancy (private)/
  completion/parking/features + check constraints + owner index.
- `listings +` current_step, description, investment_case_visible/skipped,
  review_confirmed_at, version.
- `investment_cases` (1:1, server-computed trusted values), with owner+admin RLS.
- `verifications`/`form_a_records`/`permit_records +` outcome + `superseded_at`
  freshness + updated_at triggers; `permit.approved_at`, form_a confirmation.
- `property_photos +` metadata + **partial unique index (one cover/listing)**.
- `ownership_documents +` metadata + **one active document/listing**.
- **Private `listing-photos-draft` bucket** + owner-scoped storage RLS.

RLS is unchanged for existing tables (owner-scoped policies already cover new
columns); investment_cases gets owner+admin policies. Money is stored as precise
`numeric(14,2)` (whole dirhams; validated integer).

## 6. Autosave, uploads, simulations, investment

- **Autosave**: the editable form steps (**Property Details**, **Listing
  Settings**) autosave partial changes via a **debounced** `listing.saveDraft`
  (800ms after the last edit; flushed on navigate/unmount). The header indicator
  shows `Saving…` / `Saved just now` / `Couldn't save changes` (no toast on
  success). **Optimistic concurrency**: each save carries the listing `version`;
  a mismatch (another tab/device saved first) returns `CONFLICT` and surfaces as
  the save-error state. Save-and-continue additionally validates the whole step
  and transitions state. The action-driven steps (uploads, simulations, photos,
  review) persist on their explicit action. Browser refresh / sign-out / direct
  link restore server state (each step refetches authoritative `listing.get`).
- **Uploads**: documents → private `ownership-documents`; draft photos → private
  `listing-photos-draft` — both uploaded with the **customer's own session**
  (RLS), read via **short-lived signed URLs**. No service-role key for
  customer-scoped operations. Only metadata is stored relationally.
- **Simulations**: explicit start → persisted PENDING → controlled outcome →
  persisted result + audit, idempotent; default SUCCESS with a non-production
  `demoOutcome` override for failure/retry tests. Approved labels only
  ("simulated", "Demo permit approved"); no official/legal/government claims.
- **Investment**: ROI, gain, **estimated annualised return** (null < 30 days /
  zero invested), price/sqft — computed and persisted server-side from validated
  inputs (never trusting client calculations).

## 7. Audit events

`LISTING_DRAFT_CREATED`, `LISTING_DETAILS_COMPLETED`,
`OWNERSHIP_DOCUMENT_UPLOADED/REPLACED/REMOVED`,
`OWNERSHIP_VERIFICATION_STARTED/SUCCEEDED/FAILED`, `LISTING_SETTINGS_SAVED`,
`INVESTMENT_CASE_SAVED/SKIPPED`, `FORM_A_SIMULATION_COMPLETED/FAILED`,
`LISTING_PHOTOS_UPDATED`, `LISTING_COVER_PHOTO_CHANGED`,
`PERMIT_SIMULATION_SUBMITTED/APPROVED/FAILED`, `LISTING_READY_TO_PUBLISH`,
`LISTING_DRAFT_DELETED`. Safe metadata only (IDs/types) — never document content,
signed URLs, tokens, or identity data.

## 8. Tests & exact results

Validated against a clean local stack (`pnpm supabase:reset && pnpm db:setup`).

| Command                                               | Result                                                                      |
| ----------------------------------------------------- | --------------------------------------------------------------------------- |
| `pnpm typecheck`                                      | ✅ 12/12 packages                                                           |
| `pnpm lint`                                           | ✅ 11/11 packages                                                           |
| `pnpm test` (unit + component + integration)          | ✅ **120 tests**, 8 packages                                                |
| &nbsp;&nbsp;`@markaz/domain`                          | 45                                                                          |
| &nbsp;&nbsp;`@markaz/web` (component)                 | 31                                                                          |
| &nbsp;&nbsp;`@markaz/admin` (component)               | 7                                                                           |
| &nbsp;&nbsp;`@markaz/auth`                            | 5                                                                           |
| &nbsp;&nbsp;`@markaz/i18n`                            | 6                                                                           |
| &nbsp;&nbsp;`@markaz/tests` (integration, live stack) | 26 — RLS 9, storage 3, provisioning 3, listing-journey 6, listing-privacy 5 |
| `pnpm test:e2e` (Playwright, live stack + Mailpit)    | ✅ **21** — auth 6, foundation 4, listing-journey 3, listing-quality 8      |
| `pnpm build`                                          | ✅ web + admin compiled                                                     |

- **Skipped:** none (integration + e2e ran against the active stack).
- Migration `07` applies cleanly; `db:setup` seeds the Week-2 scenarios.

New tests of note: domain state-machine rewind + readiness + investment edge
cases (`listing-journey.test.ts`); backend integration through the real tRPC
router incl. failure→retry, idempotency, document-replace rewind, server
readiness gate, preview-projection privacy (`integration/listing-journey.test.ts`);
draft + ready privacy incl. private bucket (`integration/listing-privacy.test.ts`);
full browser journey to `READY_TO_PUBLISH` + cross-customer isolation
(`e2e/listing-journey.spec.ts`).

## 9. Browser verification (e2e) + accessibility / localisation / responsive

- **Full journey** (`listing-journey.spec.ts`): My Listings (seeded drafts) →
  create → Property Details → fictional document upload → simulated verification →
  settings → skip Investment Case → simulated Form A → photo upload + cover →
  simulated Trakheesi (approved) → Review → **Ready**; cross-customer access denied.
- **Accessibility** (`listing-quality.spec.ts`, axe `wcag2a`+`wcag2aa`): **no
  serious/critical violations** on **Property Details**, **Ownership Document**,
  **Property Photos**, **Review**, and **Ready to Publish**.
- **Arabic RTL**: a listing step renders with `dir="rtl"`, the localized heading,
  and AED currency inputs kept LTR/bidi-isolated inside the RTL page.
- **Mobile** (390×844): the `Step X of 9` progress, the sticky action bar, and a
  core control render and are usable.
- **Photo ordering**: non-drag `Move earlier/later` + `Set as cover` controls are
  real, focusable buttons (drag is not the only method).
- Auth, admin isolation, recovery, and landing accessibility remain green.

## 10. Known limitations

- **Arabic copy is a flagged draft** (`_meta.reviewRequired`); not legally
  reviewed — do not represent as approved.
- **Simulation timing** is resolve-on-poll (no durable job queue — out of scope);
  believable PENDING → result without slowing tests.
- **Production server-side password policy** remains a platform follow-up (Week
  1.5 / ADR-0009), unaffected here.
- Listing-screen **component tests** (Vitest) are light relative to the backend +
  e2e coverage; the journey, accessibility (axe), RTL, and mobile are covered by
  the Playwright suite.

## 11. Acceptance status

- [x] My Listings functional; create draft; data persists; resume; direct owned
      links; cross-customer access denied.
- [x] **Debounced autosave** (Property Details + Settings) with Saving…/Saved/
      save-failure indicator and **stale-version (optimistic-concurrency)
      protection**; Save-and-Continue validates + advances.
- [x] Property Details; ownership-document upload (private); simulated ownership
      verification (incl. failure/retry).
- [x] Listing & offer settings (asking + threshold validation, threshold ≤ asking).
- [x] Optional Investment Case; investment calculations correct (server-computed).
- [x] Simulated Form A; photo upload (private draft bucket), reorder, cover, min/max.
- [x] Simulated Trakheesi (approved/failed/retry); Review reports every section;
      incomplete sections block; **server-side readiness**; reaches
      `READY_TO_PUBLISH`; never `LIVE`.
- [x] Owner-only preview excludes private data (tested projection mapper).
- [x] RLS + storage-boundary tests pass; audit events created; en/ar/RTL;
      desktop/mobile; **axe (no serious/critical) on the major listing screens**;
      existing Week 1/1.5 tests green.
- [x] Integration + e2e run against the active stack; lint, typecheck, web build,
      admin build pass. No real sensitive documents; no secrets committed.

## 12. Readiness for the next milestone

The listing setup pipeline is complete and secure through `READY_TO_PUBLISH`. The
next milestone (publication + customer-facing marketplace) builds on this: the
public-projection mapper is already implemented and tested, and ADR-0011 keeps the
public photo-delivery path (copy draft → public `listing-photos` on publish)
available without restructuring. No further listing-setup or auth rework is needed.
