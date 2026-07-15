# MARKAZ Home — Publication and Customer-Facing Marketplace Design Specification

**File:** `MARKAZ-PUBLICATION-MARKETPLACE-DESIGN-SPEC.md`  
**Status:** Implementation-ready design specification  
**Milestone:** Week 3 — Listing Publication and Customer-Facing Marketplace  
**Applications:** MARKAZ Home customer and public web  
**Primary languages:** English and Arabic  
**Accessibility target:** WCAG 2.2 AA  
**Last updated:** June 2026

---

## Week 3 Understanding

Week 3 connects the completed private listing-creation journey to the public MARKAZ marketplace. A listing that reached `READY_TO_PUBLISH` in Week 2 can be previewed, checked, submitted to a clearly labelled simulated publication review, and moved to `LIVE` only after the public projection and every public photograph are ready. The same unified `CUSTOMER` account can publish an owned listing, browse other customers’ live listings, and save properties without selecting a Buyer or Seller role.

The public marketplace is available to anonymous visitors. Authentication is required only for personal or owner actions such as saving a property, opening Saved Properties, accessing My Listings, and publishing, pausing, or resuming an owned listing. The milestone does not include offers, messaging, viewings, transactions, payments, real regulatory review, or the full Admin Portal.

The approved Week 1 and Week 1.5 application, authentication, RLS, i18n, and accessibility foundations remain unchanged. Week 2 already provides server-authoritative listing readiness, an owner-only preview projection, private draft photographs, private ownership documents, secure owner routes, and a public-photo delivery path. This specification extends those foundations rather than redesigning them.

---

# 1. Executive Summary

Week 3 introduces two connected experiences:

1. **Seller publication:** `READY_TO_PUBLISH → simulated publication review → LIVE`, with clear public/private boundaries, reliable public-photo processing, live management, pause, and resume.
2. **Customer-facing marketplace:** premium anonymous browsing, search, focused filtering, sorting, public property details, image galleries, saving, and Saved Properties.

The recommended publication model uses a **separate publication-request status** instead of overloading the listing state machine:

```text
Listing state: READY_TO_PUBLISH → LIVE → PAUSED

Publication request:
NOT_SUBMITTED → PENDING → APPROVED_DEMO
                        ↘ REJECTED_DEMO
```

While review is pending, the listing remains `READY_TO_PUBLISH` and is not public. A successful review and complete public-photo processing atomically transition the listing to `LIVE`. A returned or failed request leaves the listing recoverable at `READY_TO_PUBLISH`.

The marketplace uses:

- Public, stable, SEO-ready routes based on an opaque public identifier plus a human-readable slug
- Server-side, page-based pagination
- A prominent search field and a restrained horizontal filter toolbar
- Three-column property cards on desktop, two on tablet, and one on mobile
- A large, image-led property-details page
- A single marketplace-level prototype disclosure rather than simulation badges on every card
- Idempotent, authenticated saving with safe anonymous return-to-intent behaviour
- A Saved Properties experience that withholds details when a listing becomes unavailable

The visual direction remains **Architectural Blue — Quiet Editorial Intelligence**: strong UAE property photography, Source Serif 4 for selected editorial headings, Manrope for interface content, Cool Off-White canvas, Clear Blue actions, restrained borders, generous spacing, and minimal decorative motion.

---

# 2. Scope

## 2.1 Included

### Seller publication

- Ready-to-publish listing management
- Final public preview
- Server-authoritative publication checklist
- Final publication confirmation
- Simulated publication review
- Public-photo processing
- Publication pending, approval, returned-for-changes, and processing failure states
- Transition to `LIVE`
- Live-listing success and management
- Public listing link and copy-link behaviour
- Aggregate saved count, where available
- Pause and resume
- Simple live-edit policy

### Marketplace

- Anonymous and authenticated browsing
- Marketplace page shell
- Search across approved public fields
- Focused filters
- Sort
- Page-based pagination
- Property cards
- Public property-details page
- Responsive image gallery and full-screen gallery
- Public Investment Case when enabled
- Save and remove-save behaviour
- Anonymous save interception and safe return
- Saved Properties
- Owner viewing their own public listing
- Loading, empty, unavailable, partial-failure, and retry states
- English, Arabic, and RTL behaviour

## 2.2 Excluded

- Making or responding to offers
- Counter-offers
- Offer notifications
- Accepted offers
- Transactions and stage tracking
- Escrow or payments
- Viewing bookings
- Agent contact
- Chat or messaging
- Full Admin Portal and advanced moderation
- Premium Managed Service
- Professional photography
- Real DLD, Trakheesi, or Madmoun integrations
- Real legal or regulatory review
- MARKAZ Invest transactions
- Recently viewed history
- Map search
- Recommendation or popularity ranking
- Saved searches and alerts

## 2.3 Source precedence

Use this order when implementation details appear to conflict:

1. Week 3 product brief and this design specification
2. Final technical architecture and accepted ADRs
3. Final Week 2 implementation and delivery report
4. Final Week 1.5 authentication implementation
5. Week 1 foundation
6. Approved design foundation and earlier design specifications
7. Original user stories for product intent

This specification does not reopen completed authentication or listing-setup decisions.

---

# 3. Product and Account Rules

1. Account types remain only `CUSTOMER` and `ADMIN`.
2. Every `CUSTOMER` can browse, save, list, publish, pause, and resume within permissions.
3. Buyer and Seller remain journeys, not roles.
4. Anonymous visitors may browse only `LIVE` listings and open public details.
5. Authentication is required for Save, Saved Properties, My Listings, publication, pause, resume, and owner management.
6. The customer application exposes no Admin controls.
7. Only the listing owner can submit, pause, resume, or manage an owned listing.
8. The public marketplace never exposes draft, ready, pending, paused, or rejected listings.
9. Public projection data is server-produced and allowlisted; the client must not remove private fields from an unrestricted record.
10. Ownership documents and verification internals never enter public storage or public responses.
11. Draft photographs remain private. Public images are separate approved public assets or public renditions.
12. The owner’s public view remains the same public projection. Owner authentication adds only an owner label and Manage Listing action.
13. An owner cannot save their own listing. Show `Your listing` instead.
14. Saving is idempotent. Removing a save is also idempotent.
15. Publication review is a prototype simulation and must not appear regulatory, legal, governmental, or official.
16. No Offer action or disabled “coming soon” offer button appears in Week 3. The property action area is designed to accept a Week 4 Offer control later without exposing unfinished functionality now.

---

# 4. Week 3 State Model

## 4.1 Main listing states

| Listing state      | Public visibility | Owner meaning                                                 |
| ------------------ | ----------------: | ------------------------------------------------------------- |
| `READY_TO_PUBLISH` |                No | Setup is complete; publication has not completed              |
| `LIVE`             |               Yes | Listing is available in marketplace and public detail routes  |
| `PAUSED`           |                No | Owner has temporarily removed listing from public marketplace |

`REJECTED` is not required for the Week 3 customer flow. The existing recoverable listing remains `READY_TO_PUBLISH` when simulated review returns changes. `SOLD_DEMO` is out of scope.

## 4.2 Publication-request states

```text
NOT_SUBMITTED
PENDING
APPROVED_DEMO
REJECTED_DEMO
```

| Request state   | Customer label                 | Listing state         |                   Public visibility |
| --------------- | ------------------------------ | --------------------- | ----------------------------------: |
| `NOT_SUBMITTED` | Ready to publish               | `READY_TO_PUBLISH`    |                                  No |
| `PENDING`       | Publication review in progress | `READY_TO_PUBLISH`    |                                  No |
| `APPROVED_DEMO` | Publication review complete    | transitions to `LIVE` | Yes only after public-photo success |
| `REJECTED_DEMO` | Changes required               | `READY_TO_PUBLISH`    |                                  No |

## 4.3 Derived processing states

The UI may derive these non-domain states from request and asset data:

```text
VALIDATING
PROCESSING_PHOTOS
FINALISING
PROCESSING_FAILED
```

Do not store these as listing states unless architecture requires it. They explain the pending work without expanding the canonical state machine.

## 4.4 Atomic live transition

A listing becomes `LIVE` only when all are true:

- Listing state is `READY_TO_PUBLISH`
- Server readiness remains valid
- Demo permit remains approved and current
- Required photographs remain valid
- A cover photograph exists
- Asking price remains valid
- Public projection passes privacy allowlist checks
- Seller has confirmed publication
- Publication request is approved in the demo workflow
- Every required public photograph is available
- Public cover-image reference is valid

If any check fails, the listing remains non-public.

---

# 5. Publication-Review Model

## 5.1 Recommendation

Use a dedicated publication-request record and status. Do not place `PENDING` or `REJECTED_DEMO` inside the main listing-state enum.

Reasons:

- `READY_TO_PUBLISH` accurately describes listing completeness throughout review.
- Publication attempts may be retried without corrupting the listing journey state.
- The future Admin Portal can review requests independently of listing lifecycle.
- Failure reasons and attempt history can remain private.
- The public query remains simple: only `listings.state = LIVE`.

## 5.2 Request behaviour

- One active request per listing.
- Repeated submit while pending returns the existing request rather than creating duplicates.
- Resubmission after `REJECTED_DEMO` creates a new attempt or safely resets the current attempt according to the domain implementation.
- A request stores safe outcome categories, not sensitive free-form Admin notes.
- Owner edits that invalidate readiness cancel or supersede a pending request.
- Refresh, sign-out, and direct return resolve the request server-side.

## 5.3 Customer-facing result categories

Use safe categories:

- `LISTING_CHANGED` — information changed after submission
- `PHOTO_PROCESSING_FAILED` — one or more public images could not be prepared
- `CHECKLIST_INCOMPLETE` — a required publication condition is no longer met
- `DEMO_REVIEW_RETURNED` — generic simulated outcome
- `PROCESSING_ERROR` — temporary system failure

Do not expose storage paths, internal review notes, database fields, or technical provider errors.

## 5.4 Required disclosure

> **Publication review simulated**  
> This prototype does not perform a real regulatory or legal publication review.

Show this disclosure on confirmation, pending, approved, and returned-for-changes states. Use a pale-blue information treatment, not an official seal or warning-red banner.

---

# 6. Design Principles

## 6.1 Property-led, not dashboard-led

Public browsing centres photography, price, location, and key facts. Do not present the marketplace as a KPI dashboard.

## 6.2 Public and private are visibly distinct

Seller publication screens explicitly explain what becomes public and what remains private. Public pages never show owner-only metadata.

## 6.3 One clear commitment

Publication confirmation has one primary action and one required acknowledgement. Avoid dense legal copy and multiple competing approvals.

## 6.4 Search first, filters second

The marketplace presents a strong search field and only the most useful filters. Advanced controls remain behind `More filters`.

## 6.5 Stable browsing

Use page-based pagination, query-string filters, stable canonical property URLs, and persistent Back behaviour. Do not use infinite scroll.

## 6.6 Calm state feedback

Save, pause, publication, and gallery actions use restrained progress and status announcements. Avoid celebratory animations and playful heart bursts.

## 6.7 Simulation without repetition

Use one clear prototype disclosure on browse and property details, plus specific publication-review disclosures in seller flows. Do not place `Demo` badges on every property card.

## 6.8 Accessibility is a product requirement

Search, filter, cards, pagination, gallery, Save, dialogs, and drawers must work with keyboard, screen reader, zoom, reduced motion, touch, and RTL.

---

# 7. Information Architecture

```text
MARKAZ Home
│
├── Public Marketplace
│   ├── Browse Properties
│   │   ├── Search
│   │   ├── Primary Filters
│   │   ├── More Filters
│   │   ├── Sort
│   │   ├── Results
│   │   └── Pagination
│   └── Public Property Details
│       ├── Gallery
│       ├── Price and Facts
│       ├── Description
│       ├── Amenities
│       ├── Property Details
│       ├── Investment Case · conditional
│       ├── Save / Share
│       └── Similar Properties · optional enhancement
│
├── Authenticated Customer
│   ├── Dashboard
│   ├── Browse Properties
│   ├── Saved Properties
│   └── My Listings
│       ├── Ready to Publish
│       │   ├── Public Preview
│       │   ├── Publication Checklist
│       │   ├── Confirmation
│       │   └── Review Status
│       ├── Live Listing
│       │   ├── View Live Listing
│       │   ├── Manage
│       │   └── Pause
│       └── Paused Listing
│           ├── Manage
│           └── Resume
│
└── Authentication Interception
    ├── Sign In
    ├── Create Account
    └── Safe return and complete Save
```

Recently viewed is excluded from Week 3 because it adds behavioural storage, consent, privacy, and cross-device decisions without being essential to the core marketplace.

---

# 8. End-to-End Seller-Publication Flow

```text
My Listings / Ready success screen
        ↓
Ready-to-publish management
        ↓
Open public preview
        ↓
Review publication checklist
        ├── Incomplete → Edit affected section → regain readiness
        └── Complete
              ↓
Publication confirmation
              ↓
Accept confirmation checkbox
              ↓
Submit for publication
              ↓
Create or reuse PENDING publication request
              ↓
Validate public projection and process public photos
        ├── Failure / returned
        │     → Changes required
        │     → Retry or edit listing
        └── Approval + all public assets ready
              ↓
Atomic transition to LIVE
              ↓
Your listing is live
              ↓
Live listing management
        ├── View live listing
        ├── Copy listing link
        ├── Minor edit
        └── Pause listing
                ↓
             PAUSED
                ↓
             Resume
                ↓
              LIVE
```

---

# 9. End-to-End Marketplace Flow

## 9.1 Anonymous visitor

```text
Landing / direct property link
        ↓
Browse properties
        ↓
Search / filter / sort / paginate
        ↓
Open public property details
        ├── Share → canonical public link
        └── Save property
              ↓
        Sign In or Create Account
              ↓
        Complete authentication/onboarding
              ↓
        Return to same public property
              ↓
        Save completes idempotently
```

## 9.2 Authenticated customer

```text
Browse or Saved Properties
        ↓
Open another customer's LIVE listing
        ├── Save / remove save
        └── Share
```

## 9.3 Owner

```text
Open own LIVE public page
        ↓
Your listing label
        ↓
No Save control
        ↓
Manage Listing
```

---

# 10. Route Recommendations

## 10.1 Public marketplace

```text
/[locale]/properties
/[locale]/properties/[publicId]/[slug]
/[locale]/saved-properties
```

### Route decision

Use a **stable opaque public identifier plus a human-readable slug**.

Example:

```text
/en/properties/mkz-7f3k9p2a/2-bedroom-apartment-dubai-marina
```

Rules:

- `publicId` is generated for public use and is not the internal listing UUID.
- `publicId` is non-sequential and unguessable enough to avoid enumeration by sequence.
- The slug is derived only from public fields.
- The public identifier remains stable when title or location copy changes.
- If a valid public ID is paired with an outdated slug, redirect to the canonical current route.
- Share actions use the canonical URL.
- Non-live, unknown, paused, or unauthorised public IDs return the same public unavailable state.

## 10.2 Seller publication and management

Keep the existing owner route tree and add explicit publication routes:

```text
/[locale]/sell/listings/[listingId]/ready
/[locale]/sell/listings/[listingId]/preview
/[locale]/sell/listings/[listingId]/publish
/[locale]/sell/listings/[listingId]/publication
/[locale]/sell/listings/[listingId]/manage
```

Route meanings:

- `/ready` — Week 2 completion state with publication entry.
- `/preview` — owner-only public projection preview.
- `/publish` — checklist and final publication confirmation.
- `/publication` — request status resolver: pending, approved, returned, processing failure.
- `/manage` — live or paused management.

A single `/publication` route should render status-specific states instead of separate URLs for pending and result states.

## 10.3 Query-string model

Marketplace state is encoded in validated query parameters:

```text
q
type
emirate
area
minPrice
maxPrice
beds
baths
minSize
maxSize
furnishing
completion
investmentCase
sort
page
```

- Unknown values are ignored or safely normalised.
- Invalid range values show a user-facing validation state.
- Filter state is shareable and survives refresh.
- `page` resets to `1` when search, filter, or sort changes.

---

# 11. Navigation

## 11.1 Public header

- MARKAZ Home wordmark
- Browse Properties
- How It Works
- For Sellers
- Sign In
- List a Property
- Language control

`Browse Properties` is active on marketplace and public property routes.

## 11.2 Authenticated customer header

Primary:

- Dashboard
- Browse Properties
- Saved
- My Listings

Existing Offers and Transactions links may remain where already implemented, but Week 3 does not redesign their destination or create offer UI.

Utilities:

- Language
- Notifications, if already present
- Account menu

Persistent action:

> List a property

## 11.3 Mobile navigation

Use the existing customer bottom navigation where implemented:

- Home
- Browse
- Saved
- Listings
- Account

Do not show the bottom navigation over full-screen gallery or modal filter sheet.

## 11.4 Anonymous Saved route

Direct access to `/saved-properties` while anonymous redirects to Sign In with a safe return path. After successful authentication, open Saved Properties; do not auto-save anything unless a specific Save intent was recorded.

---

# 12. Ready-to-Publish Management

## 12.1 Entry

Entry points:

- `READY_TO_PUBLISH` card in My Listings
- Week 2 ready success screen
- Direct owner route
- Return after publication request failure

## 12.2 Layout

Desktop uses the authenticated application shell, max width 1200 px.

```text
Breadcrumb: My Listings / Marina Gate 2

[Cover image 4:3]      Ready to publish
                       2-bedroom apartment · Dubai Marina
                       AED 2,450,000

                       Setup complete
                       Required demo checks are complete.

                       [Preview public listing]
                       [Publish listing]
                       Edit listing
```

Below:

- Completion summary
- Publication status
- Last updated
- Private/public explanation

## 12.3 Copy

**Status:** `Ready to publish`

**Title:**

> Your listing setup is complete

**Description:**

> Review the public preview, then submit the listing for simulated publication review.

**Privacy note:**

> Ownership documents, unit identifiers, and private verification information will not appear publicly.

**Primary action:** `Publish listing`

**Secondary actions:**

- `Preview public listing`
- `Edit listing`
- `Return to My Listings`

## 12.4 State behaviour

- Fetch server readiness on load.
- If readiness is no longer valid, show `Action required` and route the customer to the affected step.
- Do not trust a previously rendered ready state.
- A pending request changes the primary action to `View publication status`.
- A live listing redirects or offers `Manage live listing`.

---

# 13. Publication Checklist

## 13.1 Purpose

Explain the conditions required to publish and confirm the server has a safe public projection.

## 13.2 Checklist items

1. Property details complete
2. Ownership verification simulated
3. Asking price valid
4. Simulated Form A complete
5. Required photographs present
6. Cover photograph selected
7. Demo permit approved
8. Public information checked for private fields
9. Investment Case visibility applied

## 13.3 Item states

| State            | Treatment                                    |
| ---------------- | -------------------------------------------- |
| Complete         | Check icon, `Complete`                       |
| Optional skipped | Neutral icon, `Not included`                 |
| In progress      | Spinner, `Checking`                          |
| Missing          | Attention icon, `Action required`, Edit link |
| Failed           | Error icon, concise reason, recovery action  |

## 13.4 Public/private summary

Two-column desktop panel:

**Will be public**

- Property photographs
- Asking price
- Community, building, and public location details
- Property facts, description, and amenities
- Public Investment Case metrics, only if enabled

**Will remain private**

- Ownership document
- Unit or private property identifier
- Seller email and phone
- Private occupancy details
- Verification records and internal review information

On mobile, stack the two groups with `Public` and `Private` headings.

## 13.5 Copy

**Title:**

> Publication checklist

**Description:**

> We will check that your public listing is complete and that private information is excluded.

**Complete state:**

> Your listing is ready for publication confirmation.

**Incomplete state:**

> Complete the items marked “Action required” before publishing.

**Primary action when complete:** `Continue to confirmation`

**Primary action when incomplete:** first relevant `Review {section}` action

**Secondary:** `Preview public listing`

---

# 14. Publication Confirmation

## 14.1 Presentation

Use a dedicated page on desktop and mobile, not a small confirmation dialog. Publication is a meaningful visibility change and needs enough room for the public/private explanation.

A final compact confirmation dialog may appear after the checkbox only if engineering needs protection against accidental double activation. The page remains the primary confirmation surface.

## 14.2 Copy

**Simulation disclosure:**

> **Publication review simulated**  
> This prototype does not perform a real regulatory or legal publication review.

**Title:**

> Publish your listing

**Description:**

> Your property will become visible in the MARKAZ marketplace after the simulated review is complete.

**Privacy statement:**

> Your ownership documents and private verification information will remain private.

**Visibility bullets:**

- Property information will become searchable.
- Approved property photographs will become publicly viewable.
- The listing may be shared using a public link.
- You can pause the listing later.

**Required checkbox:**

> I have reviewed the public listing and confirm that the property information and photographs are ready to publish.

**Primary button:** `Submit for publication`

**Secondary:** `Back to preview`

## 14.3 Behaviour

- Checkbox is required.
- Re-fetch readiness immediately before submission.
- Button state: `Submitting…`
- Prevent duplicate requests.
- On checklist invalidation, do not submit; show the changed item and route to it.
- On success, navigate to Publication Pending.
- Preserve no sensitive data in the URL.

---

# 15. Simulated Publication Review

## 15.1 Pending

**Title:**

> Publication review in progress

**Description:**

> We are preparing the public listing and its photographs. You can leave this page and return later.

**Status:** `Pending · Demo`

**Progress stages:**

1. Checking public listing information
2. Preparing public photographs
3. Finalising marketplace availability

Only the current stage is highlighted. Do not show a fake percentage or countdown.

**Actions:**

- `Return to My Listings`
- `View public preview`
- `Sign out`

The preview remains owner-only until the listing is live.

## 15.2 Public-photo processing

- Copy or render public assets only after checklist validation.
- Keep all public images hidden from public query responses until the full set succeeds.
- If one required photograph fails, the listing remains non-live.
- Delete or quarantine partial public assets from the failed attempt.
- Show the seller only the affected photo count and safe guidance, never paths or provider messages.

Safe failure copy:

> We could not prepare all property photographs for publication. Your listing is still private. Try again or review the photographs.

## 15.3 Approved

A request may briefly render an approved state while the listing transition resolves.

**Title:**

> Publication review complete

**Description:**

> The demo review is complete. We are making your listing available in the marketplace.

**Status:** `Approved · Demo`

Then navigate to the Live Success screen after authoritative `LIVE` state is confirmed. Do not display success before the public query and public cover image are ready.

## 15.4 Returned for changes

Customer label: `Changes required`, not `Rejected`.

**Title:**

> Review your listing before resubmitting

**Description:**

> The simulated publication review could not be completed with the current listing information.

Reason examples:

- `The listing changed after it was submitted.`
- `One or more photographs could not be prepared.`
- `A required publication check is no longer complete.`
- `The demo review returned the listing for changes.`

**Primary action:** `Review listing`

**Secondary actions:**

- `Try publication again`, only if no edit is required
- `Return to My Listings`

## 15.5 Processing failure

Use for temporary non-review failures.

**Title:**

> We could not complete publication

**Description:**

> Your listing is still private and your saved information is unchanged. Try again shortly.

**Primary:** `Try again`

**Secondary:** `Return to My Listings`

## 15.6 Refresh and return

- Refresh re-fetches request, listing, and public-asset state.
- Sign-out and return after authentication resumes the authoritative status.
- A direct pending URL for a non-owner returns the existing anti-enumeration owner error.
- An approved request with `LIVE` listing redirects to Live Success or Manage.
- A superseded request redirects to current listing state.

---

# 16. Live-Listing Success

## 16.1 Copy

**Title — required:**

> Your listing is live

**Description — required:**

> Your property is now visible in the MARKAZ marketplace.

**Supporting copy:**

> You can open the public page, copy the listing link, or manage availability from My Listings.

**Primary:** `View live listing`

**Secondary:**

- `Manage listing`
- `Copy listing link`
- `Return to My Listings`

## 16.2 Visual treatment

- Large cover image
- Restrained success icon
- `Live` status chip
- Asking price and location
- Public URL summary
- No confetti or animated celebration
- Simulation disclosure remains in a compact supporting panel:

> Publication review was simulated for this prototype.

## 16.3 Copy-link feedback

- Default: `Copy listing link`
- Loading: no spinner normally required
- Success: `Link copied`
- Failure: `We could not copy the link. Select and copy it manually.`

Use the Web Share API on supported mobile through the separate Share control on the public page; management uses copy link.

---

# 17. Live-Listing Management

## 17.1 Layout

Desktop max width 1200 px.

```text
My Listings / Manage listing

[Cover 4:3]       LIVE
                  2-bedroom apartment · Dubai Marina
                  AED 2,450,000
                  Published 29 June 2026
                  Updated 29 June 2026
                  Saved by 12 customers

                  [View live listing]
                  [Copy listing link]
                  Edit listing
                  Pause listing
```

Below:

- Public-preview summary
- Listing status history
- Safe aggregate saved count
- Editing policy explanation

## 17.2 Saved count

Include an aggregate count only:

> Saved by 12 customers

Rules:

- Do not show customer identities.
- Show `No saves yet` for zero only if useful; otherwise omit the row.
- Count may update after refresh or Realtime if already supported.
- Do not create a trend chart in Week 3.

## 17.3 Actions

Primary:

- `View live listing`

Secondary:

- `Copy listing link`
- `Edit listing`
- `Pause listing`
- `Return to My Listings`

## 17.4 Editing policy

### May update while remaining `LIVE`

- Description wording and spelling
- Amenities selection
- Photo ordering
- Cover-photo selection using already-public approved photographs
- Investment Case visibility

These changes require server validation and update the public projection after success.

### Requires pause and republish

- Property type
- Emirate, community, building, or project
- Bedrooms, bathrooms, size, completion status, or other material facts
- Asking price
- Ownership document or ownership-sensitive information
- Adding, replacing, or deleting photograph files
- Any change that invalidates Form A, permit, or readiness

When the owner selects a material field from Edit Listing, explain:

> This change affects the published property information. Pause the listing to edit it, then submit it for publication again.

Actions:

- `Pause and edit`
- `Cancel`

This avoids introducing versioned moderation before Week 6.

---

# 18. Pause and Resume

## 18.1 Pause confirmation

Use a confirmation dialog on desktop and bottom sheet on mobile.

**Title:**

> Pause this listing?

**Body — required direction:**

> The property will no longer appear in marketplace search or public property pages. You can resume it later.

**Supporting bullets:**

- Saved relationships are retained.
- Listing information and photographs are not deleted.
- The public link will show that the property is unavailable.

**Primary destructive-neutral action:** `Pause listing`

Use amber or neutral treatment, not red destructive styling, because the action is reversible.

**Secondary:** `Keep listing live`

## 18.2 Paused state

**Status:** `Paused`

**Title:**

> This listing is paused

**Description:**

> It is hidden from marketplace results and public property pages. You can resume it when you are ready.

**Primary:** `Resume listing`

**Secondary:**

- `Manage listing`
- `Edit listing`
- `Return to My Listings`

## 18.3 Resume

If no material changes occurred and readiness remains valid:

```text
PAUSED → confirmation → LIVE
```

Resume confirmation:

**Title:**

> Resume this listing?

**Body:**

> The property will become visible again in marketplace search and through its public link.

**Primary:** `Resume listing`

**Secondary:** `Keep paused`

If material changes occurred while paused, `Resume listing` is replaced by `Submit for publication` and the listing must complete the simulated review again.

## 18.4 Failure copy

Pause failure:

> We could not pause the listing. It remains live. Try again.

Resume failure:

> We could not resume the listing. It remains paused. Try again.

---

# 19. Marketplace Browse

## 19.1 Objective

Help anonymous and authenticated customers discover live UAE residential properties through a premium, image-led experience with simple search, focused filtering, clear comparison, and stable navigation.

## 19.2 Page hierarchy

1. Marketplace title and introduction
2. Prototype disclosure
3. Search
4. Primary filter toolbar
5. Active-filter chips
6. Results count and sort
7. Property grid
8. Pagination
9. Footer

## 19.3 Desktop layout

Maximum content width: **1360 px**. Page gutters: 32–40 px.

```text
┌──────────────────────────────────────────────────────────────────────────┐
│ Public / customer header                                                 │
├──────────────────────────────────────────────────────────────────────────┤
│ Properties in the UAE                              [List a property]      │
│ Browse clear property information and compare homes across Dubai.        │
│                                                                          │
│ [ Prototype marketplace disclosure ]                                     │
│                                                                          │
│ [ Search community, area, building, property type...        ] [Search]  │
│                                                                          │
│ [Property type] [Price] [Bedrooms] [Area] [More filters]                 │
│ Active: [Dubai Marina ×] [2+ beds ×]                       [Clear all]   │
│                                                                          │
│ 48 properties                                           Sort: Newest     │
│                                                                          │
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐                          │
│ │ image 4:3   │ │ image 4:3   │ │ image 4:3   │                          │
│ │ card        │ │ card        │ │ card        │                          │
│ └─────────────┘ └─────────────┘ └─────────────┘                          │
│                                                                          │
│                         Previous  1  2  3  Next                           │
└──────────────────────────────────────────────────────────────────────────┘
```

Grid:

- 3 columns from approximately 1080 px content width
- 2 columns from 700–1079 px content width
- 1 column below 700 px
- Gap: 24 px desktop; 20 px tablet; 16 px mobile

## 19.4 Page copy

**Title:**

> Properties in the UAE

For a Dubai-only seed or launch scope, use:

> Properties in Dubai

The application should derive this from active geography support, not hard-code an inaccurate national claim.

**Description:**

> Browse clear property information, compare key details, and save homes that interest you.

**Prototype disclosure:**

> **Prototype marketplace**  
> Property verification and publication review are simulated in this demo.

**Results count:**

- `1 property`
- `{count} properties`
- `{count} properties matching “{query}”`

## 19.5 Results-loading recommendation

Use **page-based pagination**.

Reasons:

- Stable, shareable URLs
- Predictable keyboard and screen-reader navigation
- Easier comparison and return behaviour
- Straightforward server rendering and testing
- No inaccessible infinite-scroll boundary

Rules:

- 24 results per page by default
- Do not vary page size by viewport
- Scroll to the results heading after page change, not to the absolute top
- Restore focus to the results heading or pagination status
- Preserve search, filters, and sort
- Use canonical links for current query state where SEO is later enabled

## 19.6 Prototype marketplace disclosure

Show once beneath the page introduction. Do not repeat on cards. It may collapse to a single-line notice on mobile but must remain available.

---

# 20. Search

## 20.1 Supported public search fields

- Emirate
- Area or community
- Building or project
- Property type

Search must not query or suggest:

- Unit number
- Seller identity
- Seller email or phone
- Ownership-document content
- Internal IDs
- Verification records
- Private occupancy data

## 20.2 Search control

**Label:**

> Search properties

**Placeholder:**

> Search by community, area, building, or property type

Desktop:

- Full-width control within max 880 px
- Search button to logical end
- Search icon decorative
- Clear button appears when text exists

Mobile:

- Full-width input
- Search button may be integrated as an icon button only when its accessible name remains `Search`
- Clear button has a 44 px target
- Search results submit through keyboard Search/Enter

## 20.3 Suggestions

Show suggestions after at least 2 non-whitespace characters.

Suggestion groups:

- Communities and areas
- Buildings and projects
- Property types
- Emirates

Each result includes type context:

> Dubai Marina  
> Community · Dubai

Rules:

- Use only values from public live-listing facets.
- Maximum 8 suggestions.
- Keyboard Up/Down moves active suggestion.
- Enter selects; Escape closes and returns focus.
- Search may still submit free text without selecting a suggestion.
- Do not store or show recent searches in Week 3.

## 20.4 Input validation

- Trim outer whitespace.
- Maximum 100 Unicode characters.
- Allow Arabic, Latin, numbers, spaces, hyphens, apostrophes, ampersands, and common building-name punctuation.
- Reject control characters and unsafe markup.
- Normalize Arabic-Indic and Western digits only where numerical comparison is intended; preserve display text.

Error copy:

- `Search must be 100 characters or fewer.`
- `Remove unsupported symbols and try again.`

## 20.5 Search states

**Loading suggestions:**

> Searching locations…

**No suggestions:**

> No matching locations. Press Enter to search all properties.

**Search service failure:**

> Search suggestions are unavailable. You can still submit your search.

This failure is non-blocking if the main search endpoint remains available.

## 20.6 Mixed Arabic and English queries

- Search accepts both scripts in either locale.
- Building names may remain in their official English form within Arabic UI.
- Suggestion metadata is localized where data exists.
- Use Unicode-aware case folding and normalized matching server-side.
- Do not transliterate automatically in the interface.

---

# 21. Filters

## 21.1 First-version filter set

### Primary toolbar

1. Property type
2. Price range
3. Bedrooms
4. Community or area
5. More filters

### More Filters

- Emirate
- Bathrooms
- Size range
- Furnishing status
- Completion status
- Investment Case available

Parking, amenities, occupancy, floor, and map radius are excluded from Week 3 filters.

## 21.2 Desktop treatment

Use a horizontal toolbar beneath search rather than a permanent sidebar. This keeps the marketplace editorial and leaves more width for property imagery.

- Each primary filter opens an anchored popover.
- `More filters` opens a 420–480 px side sheet from logical end.
- Active controls use pale-blue background and include a count where relevant.
- Active chips appear on the next row.
- Popover changes apply when the user selects `Apply`.
- A single-select filter may apply immediately only if it does not create inconsistent multi-field state; use consistent Apply behaviour for Price and range controls.

## 21.3 Mobile filter sheet

- Full-height modal sheet from logical end or bottom according to shared mobile pattern; recommend bottom sheet that expands to full height.
- Header: `Filters`, close button, `Clear all` text action.
- Sections use accordions only if the full content would otherwise exceed manageable length. Default open: Price and Bedrooms.
- Sticky bottom bar:
  - Secondary: `Clear all`
  - Primary: `Show {count} properties`
- Count updates from a debounced preview query.
- If count cannot update, primary becomes `Apply filters`.
- Closing without Apply discards unsaved sheet changes.

## 21.4 Exact labels

- `Property type`
- `Price range`
- `Bedrooms`
- `Community or area`
- `More filters`
- `Emirate`
- `Bathrooms`
- `Property size`
- `Furnishing`
- `Completion status`
- `Investment Case available`
- `Apply filters`
- `Show {count} properties`
- `Clear all`

## 21.5 Property type options

Use values already supported by Week 2. Recommended customer labels:

- Apartment
- Villa
- Townhouse
- Penthouse
- Duplex
- Residential plot, only if supported by the listing schema

Do not invent options absent from the domain enum.

## 21.6 Bedrooms and bathrooms

Use discrete choices:

- Any
- Studio, where supported
- 1+
- 2+
- 3+
- 4+
- 5+

Bathrooms:

- Any
- 1+
- 2+
- 3+
- 4+

## 21.7 Price range

Fields:

- Minimum price
- Maximum price

Rules:

- Currency is fixed to AED.
- Whole dirhams only.
- Accept Western and Arabic-Indic digits.
- Strip grouping separators during normalization.
- Format with grouping separators on blur.
- Use numeric input mode on mobile.
- Minimum must not exceed maximum.
- Zero is allowed as an unset/empty internal value only; user-entered 0 is invalid as an active filter.

Place `AED` as a visible prefix within the field and include it in the accessible label.

## 21.8 Size range

Fields:

- Minimum size
- Maximum size

Rules:

- Whole square feet.
- Visible suffix: `sq ft`.
- Minimum must not exceed maximum.
- Numeric mobile keyboard.

## 21.9 Active-filter chips

Examples:

- `Dubai Marina`
- `AED 1M–3M`
- `2+ bedrooms`
- `Apartment`
- `Investment Case`

Each chip includes a remove action with an accessible label:

> Remove Dubai Marina filter

Chips wrap naturally; they do not horizontally scroll on desktop. On mobile, use a horizontal scroll row only when needed, with visible fade and no hidden Clear All action.

## 21.10 Filter updates

- Applying filters updates the URL and page results.
- Results count announces after completion.
- Existing results remain visible with a subtle loading veil or skeleton replacement; do not blank the page.
- Focus returns to the filter trigger on popover close.
- Mobile focus returns to `Filters` button after sheet close.

---

# 22. Sort

## 22.1 Supported options

Default:

- `Newest`

Additional:

- `Price: Low to High`
- `Price: High to Low`
- `Size: Largest First`

Do not include recommended, popular, best value, ROI, or relevance sort until the ranking logic is defined and testable.

## 22.2 Behaviour

- Sort is a labelled select or accessible menu button.
- Changing sort resets page to 1.
- Current filters remain.
- The result region announces the update.
- On mobile, Sort opens a compact bottom sheet or native accessible select based on the shared component system.

**Label:** `Sort by`

---

# 23. Property Card

## 23.1 Purpose

Provide enough information to compare properties without turning the card into a dense data dashboard.

## 23.2 Anatomy

1. Cover image, 4:3
2. Save control or owner badge
3. Asking price
4. Property headline
5. Community and emirate
6. Core facts: bedrooms, bathrooms, size
7. Optional Investment Case indicator

## 23.3 Recommended headline

Generate from public fields:

> 2-bedroom apartment in Dubai Marina

If building is useful and public:

> 2-bedroom apartment in Marina Gate 2

Do not expose unit number.

## 23.4 Card copy example

```text
AED 2,450,000
2-bedroom apartment in Marina Gate 2
Dubai Marina · Dubai
2 beds · 3 baths · 1,328 sq ft
Investment Case available
```

## 23.5 Visual specification

- White surface on off-white canvas
- 1 px border, 12 px radius
- No permanent heavy shadow
- Hover: border darkens slightly; image may scale up no more than 1.015 with reduced-motion fallback
- Image corners align with card radius
- Content padding: 16–20 px
- Price: 22–24 px, weight 600
- Headline: 16–18 px, max two lines
- Metadata: 14 px
- Facts separated by quiet dots or icons with text labels accessible to screen readers

## 23.6 Save control

- Top logical end of image
- 44 × 44 px hit target
- White or dark translucent surface with sufficient contrast
- Heart/bookmark icon plus accessible label
- State is not conveyed by colour alone; saved icon fills and accessible label changes
- Do not animate with a burst

Labels:

- `Save property`
- `Saved`
- `Remove from saved`

## 23.7 Owner card

Replace Save with a compact badge:

> Your listing

The card may include a secondary `Manage` link when shown in an authenticated browsing context, but clicking the main card always opens the public page.

## 23.8 Investment indicator

Only show when the Investment Case is enabled and public.

Label:

> Investment Case available

Do not show ROI figures on the card in Week 3. The indicator links conceptually to the detailed panel and avoids trading-platform styling.

## 23.9 Image unavailable

Use a branded neutral placeholder with the standalone MARKAZ mark and copy:

> Property image unavailable

Keep card content available. Do not replace the whole card with an error.

## 23.10 Card interaction

- The main title is the card link.
- Do not make the entire card one giant nested interactive element when Save is also present.
- Image and title may share the same destination link.
- Keyboard focus is visible around the focused link or Save control.
- Do not intercept standard open-in-new-tab behaviour.

---

# 24. Property Details

## 24.1 Page objective

Present a confident, complete, public property narrative while protecting seller and verification information.

## 24.2 Page structure

1. Breadcrumbs
2. Prototype disclosure
3. Gallery
4. Price, headline, location, Save/Share/Owner action
5. Core facts
6. Description
7. Amenities
8. Property details
9. Investment Case, conditional
10. Source and simulation note
11. Optional similar properties

## 24.3 Desktop layout

Maximum width: 1360 px.

```text
Breadcrumbs
Prototype marketplace notice

[ Cover image 8 cols       ][ two secondary images 4 cols ]
[                          ][ two secondary images         ]

AED 2,450,000                         [Save property] [Share]
2-bedroom apartment in Marina Gate 2
Dubai Marina · Dubai

[2 beds] [3 baths] [1,328 sq ft] [Furnished] [1 parking]

────────────────────────────────────────────────────────────
Main content 8 cols                 Context/action rail 4 cols
Description                         Price summary
Amenities                           Save / Share
Property details                    Direct listing note
Investment Case                     No offer control in Week 3
```

The action rail becomes sticky only after the main gallery and only when viewport height permits. It must not obscure content or footer.

## 24.4 Mobile layout

- Full-width swipeable cover gallery
- Image count overlay
- Price and headline below gallery
- Facts in two-column grid or horizontal wrap
- Sections stack
- Sticky bottom action bar contains:
  - Save or `Your listing`
  - Share
  - Owner Manage action when applicable
- No empty Offer button
- Bottom bar respects safe-area inset

## 24.5 Public headline and location

**Headline pattern:**

> {bedroom label} {property type} in {building or community}

**Location:**

> {community} · {emirate}

Use sentence case. Preserve official building and community names.

## 24.6 Core facts

Show, when available and public:

- Property type
- Bedrooms
- Bathrooms
- Size
- Furnishing status
- Completion status
- Parking spaces
- Community
- Building or project

Do not show:

- Unit number
- Private occupancy status
- Ownership document
- Seller identity
- Verification internals
- Audit data

## 24.7 Description

**Heading:** `About this property`

- Preserve paragraph breaks.
- Sanitize content.
- Truncate only on card, never on full detail page.
- Use `Show more` only if description is unusually long; default maximum collapsed height should still expose approximately 6–8 lines.

## 24.8 Amenities

**Heading:** `Features and amenities`

- Use a two- or three-column list desktop, two columns tablet, one or two mobile depending label length.
- Icons are optional and secondary to text.
- Do not invent amenities not stored in the listing.

## 24.9 Property details

**Heading:** `Property details`

Use definition-list rows with public values only.

Example:

| Label         | Value         |
| ------------- | ------------- |
| Property type | Apartment     |
| Community     | Dubai Marina  |
| Building      | Marina Gate 2 |
| Size          | 1,328 sq ft   |
| Furnishing    | Furnished     |
| Completion    | Ready         |
| Parking       | 1 space       |

## 24.10 Listing source treatment

**Label:**

> Direct listing

**Copy:**

> Published directly through MARKAZ. Ownership verification and publication review are simulated in this prototype.

Do not show owner name or contact details.

## 24.11 Future offer area

The page layout reserves an action-region component for future Week 4 controls, but Week 3 renders only Save, Share, and owner Manage actions. Do not show a disabled `Make an offer`, `Coming soon`, or false contact CTA.

## 24.12 Similar properties

Optional enhancement only. If implemented, use deterministic rules:

- Same community
- Same property type
- Asking price within ±20%
- Exclude current listing
- Maximum 3 cards

Omit the section entirely when fewer than 2 suitable properties exist. Do not call the section `Recommended for you`.

---

# 25. Image Gallery

## 25.1 Desktop gallery

- Primary cover image occupies approximately two-thirds width.
- Up to four secondary thumbnails occupy the remaining third.
- All images use consistent crop with `object-fit: cover`.
- Final visible thumbnail includes overlay `+{remaining}` when more images exist.
- Selecting any image opens full-screen gallery at that index.
- `View all {count} photos` button appears over or below the gallery.

## 25.2 Mobile gallery

- One full-width image at a time
- Swipe gesture plus visible previous/next controls where appropriate
- Image count: `{current} of {total}`
- Selecting opens full-screen gallery
- Preserve 4:3 or adaptive safe crop

## 25.3 Full-screen gallery

An accessible modal route or dialog:

- Dark neutral background, not brand-blue wash
- Close button at logical end/top
- Large current image
- Previous and Next controls
- Thumbnail strip desktop; optional and collapsible on mobile
- Counter
- Optional caption based on ordered image label, not user-entered sensitive text

Keyboard:

- Left/Right arrows navigate according to image sequence; visual arrows mirror in RTL but sequence remains deterministic
- Escape closes
- Tab remains within modal
- Close returns focus to the triggering thumbnail

Touch:

- Swipe left/right
- Pinch zoom is optional; do not implement custom zoom unless accessible and tested

## 25.4 Image alternative text

Use generated contextual alt text based on public metadata and image order:

- `Living area in a 2-bedroom apartment in Dubai Marina`
- `Kitchen in the property`
- `Property photograph 4 of 8`

Because upload does not collect image descriptions in Week 2, do not invent detailed visual claims. Prefer safe ordinal labels when content is unknown.

## 25.5 Failed images

- Show neutral placeholder in the failed tile.
- Keep gallery controls operational.
- Announce `Image {n} could not be loaded.` only when the user navigates to it.
- If cover fails, use first available public image; if none load, show page-level image placeholder without exposing asset URLs.

## 25.6 Reduced motion

- Disable image-scale transitions.
- Gallery changes immediately or with a short opacity transition.
- Do not use parallax, 3D transitions, or auto-advancing carousels.

---

# 26. Investment Case

## 26.1 Visibility rule

Render only when:

```text
investment_case_visible = true
```

and the server’s public projection includes approved calculated values.

When hidden, omit the entire section. Do not show `Investment Case unavailable`.

## 26.2 Public metrics recommendation

Show:

- Estimated ROI
- Estimated annualised return, when calculable
- Price per square foot
- Area comparison, when available
- Asking price, already present elsewhere and may be repeated for calculation context

Do not show in Week 3:

- Original purchase price
- Purchase date
- Renovation or improvement spend
- Total invested
- Private cash-flow inputs
- Exact estimated gain

This protects seller financial history and avoids exposing inputs from which sensitive details are too easily inferred.

## 26.3 Panel layout

**Heading:**

> Investment Case

**Introduction:**

> Seller-provided information and estimated calculations to help explain the property’s investment context.

Desktop:

- Four metric cells in one row or two-by-two grid
- A compact comparison bar only if area comparison data is available and well-defined
- No trading charts, green/red ticker language, or performance arrows

Example:

```text
Estimated ROI               8.4%
Estimated annualised return 5.1%
Price per sq ft             AED 1,845
Area comparison             3% below area average
```

## 26.4 Metric labels and states

- Positive values use standard text, not celebratory green.
- Negative values use a minus sign and explanatory neutral copy; red is not required because this is not an error.
- Missing annualised return:
  > Not available from the information provided
- Missing comparison:
  > Area comparison unavailable
- Percentages: one decimal place
- AED per square foot: whole dirham

## 26.5 Required disclosure

> Investment figures are seller-provided and calculated from the information entered. They are estimates, not financial advice or guaranteed returns.

Place directly beneath the metrics in 13–14 px readable text. Do not hide it in a tooltip.

## 26.6 Accessibility

- Metrics use semantic definition lists.
- Comparison graphics repeat values in text.
- Screen readers announce `Estimated ROI, 8.4 percent`, not isolated symbols.
- Currency and percentages use locale-aware formatting while preserving coherent number direction.

---

# 27. Save Property

## 27.1 Product rules

- Authenticated `CUSTOMER` may save another customer’s `LIVE` listing.
- Owner cannot save own listing.
- Anonymous Save starts authentication interception.
- Duplicate save requests do not create duplicates.
- Save state is server-authoritative.
- A non-live listing cannot be newly saved.

## 27.2 States

| State       | Label           | Behaviour                                            |
| ----------- | --------------- | ---------------------------------------------------- |
| Unsaved     | `Save property` | Starts save or auth interception                     |
| Saving      | `Saving…`       | Disable repeat activation                            |
| Saved       | `Saved`         | Button state selected                                |
| Removing    | `Removing…`     | Disable repeat activation                            |
| Removed     | `Save property` | Polite announcement `Removed from saved properties.` |
| Error       | `Save property` | Restore previous state and show error                |
| Unavailable | Hidden/disabled | Explain listing unavailable                          |
| Owner       | `Your listing`  | Manage action replaces Save                          |

## 27.3 Optimistic behaviour

A subtle optimistic icon change is allowed only when rollback is reliable. Required behaviour:

- Preserve previous state.
- Send idempotent request.
- On success, announce result.
- On failure, restore previous state and show:
  > We could not save this property. Try again.
- If listing became unavailable:
  > This property is no longer available.

## 27.4 Announcements

Polite live-region messages:

- `Property saved.`
- `Removed from saved properties.`
- `We could not save this property. Try again.`

Do not rely on toast alone; control state must also update.

## 27.5 Saved count

Saving may update the owner’s aggregate count. The saving customer does not see global popularity on the public card or details page in Week 3.

---

# 28. Anonymous Save Interception

## 28.1 Interaction model

Use an authentication-interception dialog on desktop and bottom sheet on mobile.

**Title:**

> Sign in to save this property

**Description:**

> Save properties to your MARKAZ account and return to them later.

**Primary:** `Sign in`

**Secondary:** `Create account`

**Tertiary:** `Continue browsing`

## 28.2 Intent preservation

Store a safe, short-lived intent containing only:

- Action: `SAVE_PROPERTY`
- Public listing ID
- Allowlisted relative return route
- Locale
- Expiry timestamp

Never store private listing data, credentials, auth tokens, or arbitrary URLs.

## 28.3 Return behaviour

After successful authentication and onboarding:

1. Validate the intent.
2. Validate that listing remains `LIVE`.
3. Complete save idempotently.
4. Return to the canonical property page.
5. Focus or announce the Saved control.
6. Show `Property saved.`
7. Consume the intent once.

If the listing is no longer live:

> This property is no longer available, so it was not saved.

Then navigate to the marketplace or unavailable property page.

## 28.4 Cancellation

Closing the dialog returns focus to Save. No save or navigation occurs.

---

# 29. Saved Properties

## 29.1 Route and access

```text
/[locale]/saved-properties
```

Requires an onboarded `CUSTOMER` session.

## 29.2 Page copy

**Title:**

> Saved properties

**Description:**

> Keep track of properties you may want to revisit.

## 29.3 Empty state

```text
[Bookmark illustration or simple icon]

No saved properties yet
Save properties while browsing to find them here later.

[Browse properties]
```

Do not use a decorative AI illustration. A restrained icon or one property image is sufficient.

## 29.4 Populated state

- Same property-card grid as marketplace
- Saved state shown
- Default order: most recently saved first
- No extra sort in Week 3
- No folders or notes
- Removing a property updates the grid without full-page reload where safe
- If last item removed, transition to empty state with announcement

## 29.5 Unavailable saved property

A save relationship may remain when the listing is paused, unpublished, or otherwise unavailable.

Do not show stale public property information. Render a restrained placeholder card:

**Title:**

> This property is no longer available

**Description:**

> It may have been paused or removed from the marketplace.

**Action:**

> Remove from saved

Optional metadata:

- `Saved on {date}`

Do not show previous price, location, image, unit, owner, or status reason.

If the listing later becomes live again, the saved card may automatically return to the normal public projection.

## 29.6 Partial failure

If some saved items load and others fail unexpectedly:

- Render successful items.
- Show an inline alert:
  > Some saved properties could not be loaded. Try again.
- Retry only failed items where possible.
- Do not expose IDs.

## 29.7 Removed feedback

Use a restrained toast/live announcement:

> Removed from saved properties.

An optional `Undo` is not required because server-side idempotent re-save is simple, but may be added later.

---

# 30. Owner Viewing Own Live Listing

## 30.1 Public-page changes

When authenticated viewer is the listing owner:

- Show badge: `Your listing`
- Hide Save
- Show `Manage listing`
- Share remains available
- Public projection remains unchanged
- No ownership document, private unit data, seller contact, or management metrics appear

## 30.2 Owner action bar

Desktop:

- Primary: `Manage listing`
- Secondary: `Share`

Mobile sticky bar:

- Primary: `Manage listing`
- Secondary icon button: `Share listing`

## 30.3 Paused owner route behaviour

If the owner opens a previously shared public URL while the listing is paused:

- Show the standard public unavailable state.
- Add owner-only action:
  > Manage listing

Do not render private listing content on the public route.

---

# 31. Loading, Empty, Failure, and Recovery States

## 31.1 Marketplace initial loading

Use a page skeleton matching final structure:

- Heading line
- Search field shell
- Filter controls
- Results-count line
- 6 property-card skeletons desktop, 4 tablet, 3 mobile

Do not show a full-page spinner.

Announcement:

> Loading properties…

## 31.2 Filter or sort refresh

- Keep existing cards visible with reduced opacity or overlay skeleton if response is fast.
- Disable only the control currently applying where appropriate.
- Announce `Updating results…` then `{count} properties found.`
- Do not reset scroll to page top.

## 31.3 Pagination loading

- Keep current page until next page succeeds.
- Disable activated pagination control.
- On success, replace results and move focus to results heading.
- On failure:
  > We could not load the next page. Try again.

## 31.4 Empty results

**Title:**

> No properties match these filters

**Description:**

> Try changing your search, price range, or property details.

**Primary:** `Clear all filters`

**Secondary:** `Browse all properties`

If only text search is active:

> No properties match “{query}”. Try a different area, building, or property type.

## 31.5 Marketplace unavailable

**Title:**

> Properties are temporarily unavailable

**Description:**

> We could not load the marketplace. Try again shortly.

**Primary:** `Try again`

**Secondary:** `Return to MARKAZ Home`

## 31.6 Property-page loading

- Gallery skeleton
- Price and headline skeleton
- Fact-row skeleton
- Content blocks
- No flash of private or unfiltered data

## 31.7 Listing unavailable

Use the same public state for unknown, non-live, paused, and removed listings.

**Title:**

> This property is no longer available

**Description:**

> It may have been paused or removed from the MARKAZ marketplace.

**Primary:** `Browse properties`

**Secondary:** `Return to MARKAZ Home`

Owner-only additional action may be `Manage listing`.

## 31.8 Gallery partial failure

- Replace only failed images with placeholders.
- Do not collapse gallery geometry unexpectedly.
- Keep successful images and navigation.
- If all fail:
  > Property photographs are temporarily unavailable.

## 31.9 Save failure

> We could not save this property. Try again.

Restore the prior saved state.

## 31.10 Saved-list loading

Use the marketplace card skeleton without search/filter controls.

Announcement:

> Loading saved properties…

## 31.11 Publication pending

Use the persistent pending panel defined in Section 15. The user may leave safely. No fake timer.

## 31.12 Photo publication failure

> We could not prepare all property photographs for publication. Your listing is still private.

Actions:

- `Try again`
- `Review photographs`

## 31.13 Pause and resume failure

- Pause: `We could not pause the listing. It remains live. Try again.`
- Resume: `We could not resume the listing. It remains paused. Try again.`

## 31.14 Session expired

Owner actions route to the existing Sign In flow with:

> Your session has expired. Sign in again to continue.

Preserve only an allowlisted owner or public return route. An interrupted Save uses the existing safe Save intent.

## 31.15 Access denied and owner anti-enumeration

For owner management routes when listing is missing or belongs to another customer:

> This listing is not available.

Actions:

- `Return to My Listings`
- `Go to Dashboard`

Do not reveal whether the listing exists.

## 31.16 Generic unexpected error

**Title:**

> Something went wrong

**Description:**

> We could not complete this request. Your saved information has not been changed.

**Primary:** `Try again`

Optional safe support reference may be shown. Never display raw SQL, storage provider, stack trace, signed URL, object path, or private ID.

---

# 32. Component Library

The following components extend the approved MARKAZ design system and reuse existing primitives where possible. All components use logical spacing, support RTL, and meet WCAG 2.2 AA.

## 32.1 Marketplace Page Shell

**Purpose:** Provide public/customer header, main content width, prototype disclosure, and footer.  
**Anatomy:** header, breadcrumb/heading region, disclosure slot, main region, footer.  
**Variants:** anonymous, authenticated, owner-view.  
**States:** default, route loading, unavailable.  
**Interaction:** preserves query state and focus after navigation.  
**Accessibility:** one `main`, skip link, one page `h1`, labelled navigation.  
**Responsive:** max 1360 px; 40/32/24 px gutters.  
**RTL:** header and breadcrumb mirror logically.  
**Reuse:** Browse, property details, Saved Properties.

## 32.2 Marketplace Search

**Purpose:** Search approved public location and property fields.  
**Anatomy:** visible label, input, search icon, clear action, submit action, suggestion list.  
**Variants:** hero-width, compact mobile.  
**States:** empty, focused, typing, loading suggestions, suggestions, no suggestions, invalid, unavailable.  
**Interaction:** keyboard combobox semantics, Enter submit, Escape close, full query preserved.  
**Accessibility:** combobox/listbox pattern; active descendant announced.  
**Responsive:** full width; submit may become icon button on mobile.  
**RTL:** UI mirrors; mixed text uses `dir=auto`; numbers remain LTR where appropriate.  
**Reuse:** Future saved-search flow.

## 32.3 Desktop Filter Popover

**Purpose:** Edit one primary filter without leaving results.  
**Anatomy:** trigger, popover heading, controls, Clear, Apply.  
**Variants:** single select, multi-select, numeric range.  
**States:** inactive, active, open, invalid, applying.  
**Interaction:** changes are staged until Apply; Escape discards and closes.  
**Accessibility:** trigger exposes expanded state; focus trapped only while popover pattern requires; returns to trigger.  
**Responsive:** replaced by mobile filter sheet below 768 px.  
**RTL:** popover aligns to logical start/end based on available space.  
**Reuse:** Property type, price, bedrooms, area.

## 32.4 Mobile Filter Sheet

**Purpose:** Edit all filters in one touch-friendly surface.  
**Anatomy:** title, close, Clear All, scrollable filter sections, sticky result action.  
**Variants:** count available, count unavailable.  
**States:** loading facets, ready, invalid range, applying, failure.  
**Interaction:** Apply commits; close discards uncommitted changes; safe-area padding.  
**Accessibility:** modal semantics, focus trap, focus restore, body-scroll lock, labelled sections.  
**Responsive:** full-height on small mobile; max 640 px width on large mobile/tablet.  
**RTL:** opens from logical end when side-sheet mode is used; sticky actions order mirrors.  
**Reuse:** Future advanced search.

## 32.5 Active Filter Chip

**Purpose:** Show and remove an active filter.  
**Anatomy:** label, remove icon.  
**Variants:** text, range, count.  
**States:** default, hover, focus, removing.  
**Interaction:** remove updates URL/results.  
**Accessibility:** remove button label includes filter name.  
**Responsive:** wraps desktop; horizontal row mobile if needed.  
**RTL:** icon at logical end.  
**Reuse:** Marketplace and future saved-search summary.

## 32.6 Sort Menu

**Purpose:** Change deterministic ordering.  
**Anatomy:** visible label and select/menu.  
**Variants:** desktop select, mobile sheet/native select.  
**States:** default, open, applying, failure.  
**Interaction:** selection applies immediately and resets page.  
**Accessibility:** native select preferred where possible.  
**RTL:** alignment mirrors; option text localized.  
**Reuse:** Saved Properties later if needed.

## 32.7 Results Count

**Purpose:** Communicate scope and update completion.  
**Anatomy:** count text, optional query context.  
**States:** loading, loaded, zero, error.  
**Interaction:** none.  
**Accessibility:** polite live region after filter/sort/page changes; not on first server render.  
**RTL:** localized number formatting.  
**Reuse:** Marketplace and filter sheet.

## 32.8 Property Card Grid

**Purpose:** Lay out property cards consistently.  
**Anatomy:** list region and cards.  
**Variants:** 3-, 2-, and 1-column; skeleton.  
**States:** loaded, loading, partial image failure.  
**Accessibility:** semantic list; heading labels results region.  
**RTL:** visual card order follows locale reading direction while source order matches reading order.  
**Reuse:** Browse, Saved, Similar Properties.

## 32.9 Property Card

**Purpose:** Compare a public listing at a glance.  
**Anatomy:** image link, Save/owner control, price, title link, location, facts, optional Investment Case indicator.  
**Variants:** default, saved, owner, unavailable only in Saved area, skeleton.  
**States:** hover, focus, image failed, saving.  
**Interaction:** image/title navigate; Save independent.  
**Accessibility:** no nested interactive card wrapper; alt text; focus visible.  
**Responsive:** 4:3 image; full width mobile.  
**RTL:** Save at logical end; metadata follows locale.  
**Reuse:** Browse, Saved, Similar.

## 32.10 Save Button

**Purpose:** Add/remove a live property from a customer’s Saved list.  
**Anatomy:** icon, optional text, live announcement.  
**Variants:** icon-only card, text+icon detail page, owner badge replacement.  
**States:** unsaved, saving, saved, removing, error.  
**Interaction:** idempotent request; anonymous interception.  
**Accessibility:** toggle state exposed with `aria-pressed` or equivalent; 44 px target; dynamic label.  
**RTL:** icon/text order logical.  
**Reuse:** Card, details, Saved.

## 32.11 Owner Listing Badge

**Purpose:** Replace Save on owner’s own property.  
**Anatomy:** small home/check icon and `Your listing`.  
**Variants:** card badge, details label.  
**States:** static.  
**Accessibility:** text is authoritative.  
**RTL:** logical placement.  
**Reuse:** Browse and public detail.

## 32.12 Empty Results State

**Purpose:** Help customers recover from restrictive search/filter state.  
**Anatomy:** restrained icon, heading, description, primary and secondary action.  
**Variants:** no results, no Saved properties.  
**Accessibility:** focused heading after state replaces results.  
**Responsive:** max 560 px centred.  
**RTL:** logical alignment.  
**Reuse:** Browse, Saved.

## 32.13 Marketplace Skeleton

**Purpose:** Prevent layout shift during initial loading.  
**Anatomy:** heading/search/filter/card placeholders.  
**States:** loading only.  
**Accessibility:** skeleton hidden from accessibility tree; one status message announces loading.  
**Reduced motion:** no shimmer required; use static or subtle pulse disabled under reduced motion.  
**Reuse:** Browse and Saved.

## 32.14 Pagination

**Purpose:** Navigate stable result pages.  
**Anatomy:** Previous, page links, current page, Next, status.  
**Variants:** full desktop, condensed mobile.  
**States:** default, current, disabled, loading, failure.  
**Interaction:** URL updates; focus moves to result heading after success.  
**Accessibility:** `nav` labelled `Property results pages`; current page exposed.  
**RTL:** arrow icons mirror; numerical page order follows locale reading expectations while URLs remain stable.  
**Reuse:** Other list pages.

## 32.15 Property Details Shell

**Purpose:** Structure gallery, public content, action rail, and footer.  
**Anatomy:** breadcrumbs, disclosure, gallery, header, facts, content grid, sticky mobile actions.  
**Variants:** anonymous, authenticated, owner, unavailable.  
**Accessibility:** logical headings and landmarks; sticky bar does not obscure focus.  
**Responsive:** 8/4 column desktop; stacked mobile.  
**RTL:** grid and action rail mirror logically.  
**Reuse:** Future offer detail extension.

## 32.16 Image Gallery

**Purpose:** Preview public property photographs.  
**Anatomy:** cover, thumbnails, count, View All.  
**Variants:** desktop mosaic, mobile carousel, placeholder.  
**States:** loading, loaded, partial failure, all failed.  
**Interaction:** open full-screen at selected image.  
**Accessibility:** buttons have image index labels; no auto-advance.  
**RTL:** mosaic mirrors; image sequence remains explicit.  
**Reuse:** Owner public preview.

## 32.17 Full-Screen Gallery

**Purpose:** View every photograph in a focused modal.  
**Anatomy:** close, current image, previous/next, counter, thumbnails.  
**States:** open, image loading, image failure.  
**Interaction:** keyboard arrows, Escape, swipe; focus trap and restore.  
**Accessibility:** dialog name `Property photographs`; inert background.  
**Responsive:** thumbnails hidden/collapsed mobile.  
**RTL:** arrows visually mirror; labels localized.  
**Reuse:** Preview and public detail.

## 32.18 Core Facts Row

**Purpose:** Present the highest-value property facts.  
**Anatomy:** icon or label, value.  
**Variants:** horizontal desktop, wrapped/mobile grid.  
**States:** missing values omitted, not shown as dashes.  
**Accessibility:** semantic list/definition list; icon decorative.  
**RTL:** order mirrors based on localized priority if approved; otherwise source order follows reading direction.  
**Reuse:** Card summary and detail header.

## 32.19 Price Block

**Purpose:** Make asking price prominent and unambiguous.  
**Anatomy:** AED price, optional price/sq ft, status context.  
**States:** loaded, unavailable.  
**Accessibility:** complete accessible name such as `Asking price, 2 million 450 thousand UAE dirhams`.  
**RTL:** currency and digits use isolated LTR run or locale formatter.  
**Reuse:** Card, detail, seller management.

## 32.20 Amenities List

**Purpose:** Show seller-selected public features.  
**Anatomy:** heading and list items.  
**Variants:** with/without icons.  
**States:** absent section omitted.  
**Accessibility:** semantic list.  
**Responsive:** 3/2/1 columns.  
**RTL:** mirrors logically.  
**Reuse:** Preview and public detail.

## 32.21 Investment Case Panel

**Purpose:** Show approved public estimates without investment-platform styling.  
**Anatomy:** heading, intro, metric list, optional comparison, disclosure.  
**Variants:** full metrics, partial metrics.  
**States:** values available, annualised unavailable, comparison unavailable.  
**Accessibility:** definition list; charts/text equivalent.  
**Responsive:** 4 cells desktop, 2x2 tablet/mobile.  
**RTL:** percentage and AED values isolated correctly.  
**Reuse:** Owner preview and public detail.

## 32.22 Investment Disclosure

**Purpose:** Explain source and limitations of estimates.  
**Anatomy:** info icon and persistent text.  
**Variants:** English, Arabic draft.  
**Accessibility:** normal readable text, not tooltip-only.  
**Reuse:** Public Investment Case.

## 32.23 Share Control

**Purpose:** Share canonical public link.  
**Anatomy:** share icon, label; copy fallback.  
**States:** default, shared/copied, failure.  
**Interaction:** native share when supported; copy link otherwise.  
**Accessibility:** announces `Listing link copied.`  
**RTL:** icon at logical start/end according to component convention.  
**Reuse:** Detail and live management.

## 32.24 Seller Manage Listing Control

**Purpose:** Let owner move from public view to private management.  
**Anatomy:** button/link and owner context.  
**States:** default, loading.  
**Security:** server verifies ownership after navigation.  
**Accessibility:** label `Manage your listing`.  
**Reuse:** Owner public detail and unavailable owner route.

## 32.25 Saved Property Card

**Purpose:** Reuse public card with saved state.  
**Anatomy:** Property Card plus selected Save.  
**States:** live, removing, error.  
**Accessibility:** list context and state announcement.  
**Reuse:** Saved Properties.

## 32.26 Unavailable Property Card

**Purpose:** Retain save relationship without leaking non-public details.  
**Anatomy:** neutral placeholder, unavailable title, saved date optional, Remove action.  
**States:** default, removing, remove failure.  
**Accessibility:** no broken link; Remove is explicit.  
**Responsive:** same card footprint but no image content.  
**RTL:** logical alignment.  
**Reuse:** Saved Properties only.

## 32.27 Publication Checklist

**Purpose:** Show server-authoritative readiness and public/private boundaries.  
**Anatomy:** heading, checklist rows, public/private panel, primary action.  
**Variants:** complete, incomplete, checking, failed.  
**Interaction:** Edit links route to owner steps.  
**Accessibility:** checklist is semantic list; status text explicit.  
**Responsive:** two-column public/private becomes stacked.  
**RTL:** status/action placement mirrors.  
**Reuse:** Republish after material edits.

## 32.28 Publication Confirmation

**Purpose:** Record informed seller confirmation before public visibility.  
**Anatomy:** simulation disclosure, visibility summary, required checkbox, actions.  
**States:** unchecked, checked, submitting, invalidated, error.  
**Accessibility:** checkbox associated with full sentence; error linked.  
**Responsive:** dedicated page; action bar sticky mobile.  
**RTL:** checkbox at logical start, sentence RTL.  
**Reuse:** Initial publish and republish.

## 32.29 Publication Status Panel

**Purpose:** Render pending, approved, changes required, or processing failure.  
**Anatomy:** simulation badge, title, description, stage/status, actions.  
**States:** PENDING, APPROVED_DEMO, REJECTED_DEMO, PROCESSING_FAILED.  
**Accessibility:** status changes announced once; no fake progress percentage.  
**Responsive:** max 680 px with property summary.  
**RTL:** stage order mirrors visually.  
**Reuse:** Publication route.

## 32.30 Live Listing Management Panel

**Purpose:** Summarize live public status and actions.  
**Anatomy:** cover, status, identity, price, dates, saves, actions.  
**States:** live, pausing, paused, resuming, republish required.  
**Accessibility:** actions grouped and labelled.  
**Responsive:** two-column to stacked.  
**RTL:** image/action columns mirror.  
**Reuse:** My Listings detail.

## 32.31 Pause Confirmation Dialog

**Purpose:** Explain reversible public removal.  
**Anatomy:** title, consequence, retained-data bullets, Pause, Cancel.  
**States:** default, submitting, failure.  
**Accessibility:** modal dialog, initial focus on title/least destructive action, Escape closes, focus restores.  
**Responsive:** desktop dialog, mobile bottom sheet.  
**RTL:** action order mirrors logically.  
**Reuse:** Pause and future unpublish-like reversible actions.

## 32.32 Mobile Sticky Actions

**Purpose:** Keep key property or publication actions reachable.  
**Anatomy:** one primary and up to two secondary actions, safe-area background.  
**Variants:** public detail, owner detail, publication confirmation.  
**States:** default, loading, disabled.  
**Accessibility:** does not cover content; page has bottom padding; 44 px targets.  
**RTL:** actions ordered by priority in locale direction.  
**Reuse:** Detail and seller confirmation.

---

# 33. Validation Matrix

| Screen      | Field/control           | Rule                                     | Trigger           | English message                                                                                 | Placement                              | Clears when                       |                        Blocking? | Arabic review         |
| ----------- | ----------------------- | ---------------------------------------- | ----------------- | ----------------------------------------------------------------------------------------------- | -------------------------------------- | --------------------------------- | -------------------------------: | --------------------- |
| Browse      | Search                  | Maximum 100 characters                   | Submit/blur       | `Search must be 100 characters or fewer.`                                                       | Under search                           | Length valid                      |            Yes for search submit | Language              |
| Browse      | Search                  | No unsupported control/markup characters | Submit            | `Remove unsupported symbols and try again.`                                                     | Under search                           | Input valid                       |                              Yes | Language/security     |
| Filters     | Minimum price           | Positive whole AED or empty              | Apply             | `Enter a valid minimum price.`                                                                  | Under field                            | Valid/empty                       |                              Yes | Language              |
| Filters     | Maximum price           | Positive whole AED or empty              | Apply             | `Enter a valid maximum price.`                                                                  | Under field                            | Valid/empty                       |                              Yes | Language              |
| Filters     | Price range             | Minimum ≤ maximum                        | Apply             | `Minimum price must not be higher than maximum price.`                                          | Range group                            | Range valid                       |                              Yes | Language              |
| Filters     | Minimum size            | Positive whole sq ft or empty            | Apply             | `Enter a valid minimum size.`                                                                   | Under field                            | Valid/empty                       |                              Yes | Language              |
| Filters     | Maximum size            | Positive whole sq ft or empty            | Apply             | `Enter a valid maximum size.`                                                                   | Under field                            | Valid/empty                       |                              Yes | Language              |
| Filters     | Size range              | Minimum ≤ maximum                        | Apply             | `Minimum size must not be higher than maximum size.`                                            | Range group                            | Range valid                       |                              Yes | Language              |
| Browse      | Results                 | Query valid but no matches               | Response          | `No properties match these filters.`                                                            | Results region                         | Filters/query change              |               Non-blocking state | Language              |
| Browse      | Filter request          | Request fails                            | Response          | `We could not update the results. Try again.`                                                   | Alert above results                    | Successful retry                  | Non-blocking; old results remain | Language              |
| Browse      | Sort request            | Request fails                            | Response          | `We could not change the sort order. Try again.`                                                | Near sort + alert                      | Successful retry                  |                     Non-blocking | Language              |
| Pagination  | Next page               | Request fails                            | Response          | `We could not load the next page. Try again.`                                                   | Pagination alert                       | Retry success                     |                     Non-blocking | Language              |
| Property    | Public availability     | Listing not `LIVE`/missing               | Load              | `This property is no longer available.`                                                         | Unavailable page                       | Listing live again/new navigation |                         Blocking | Language/security     |
| Save        | Save request            | Server failure                           | Response          | `We could not save this property. Try again.`                                                   | Toast/live message and near control    | Successful action                 |                     Non-blocking | Language              |
| Save        | Listing changed state   | Not live during request                  | Response          | `This property is no longer available.`                                                         | Alert                                  | Navigate away/live again          |                    Blocking save | Language/security     |
| Saved       | Remove unavailable item | Request failure                          | Response          | `We could not remove this property from saved items. Try again.`                                | Card alert                             | Retry success                     |                     Non-blocking | Language              |
| Publication | Checklist               | One or more required checks incomplete   | Load/submit       | `Complete the items marked “Action required” before publishing.`                                | Checklist summary                      | All complete                      |                              Yes | Language              |
| Publication | Confirmation            | Checkbox not accepted                    | Submit            | `Confirm that the public listing is ready to publish.`                                          | Under checkbox                         | Checked                           |                              Yes | Language/legal review |
| Publication | Submission              | Request fails                            | Response          | `We could not submit the listing for publication. It is still private.`                         | Form-level alert                       | Retry success                     |               Yes for transition | Language              |
| Publication | Public photos           | One or more public images fail           | Processing result | `We could not prepare all property photographs for publication. Your listing is still private.` | Status panel                           | Retry/photo edit success          |                              Yes | Language              |
| Publication | Public projection       | Private-field/check failure              | Processing result | `A required publication check is no longer complete. Review the listing and try again.`         | Status panel                           | Listing valid                     |                              Yes | Language/security     |
| Publication | Listing changed         | Version changed after submit             | Processing result | `The listing changed after it was submitted. Review the latest information and submit again.`   | Status panel                           | New submission                    |                              Yes | Language              |
| Pause       | Pause request           | Request fails                            | Response          | `We could not pause the listing. It remains live. Try again.`                                   | Dialog/panel alert                     | Retry success                     |       Non-blocking; remains live | Language              |
| Resume      | Resume request          | Request fails                            | Response          | `We could not resume the listing. It remains paused. Try again.`                                | Panel alert                            | Retry success                     |     Non-blocking; remains paused | Language              |
| Resume      | Readiness invalid       | Material edit/check invalid              | Action            | `This listing needs publication review before it can become live again.`                        | Management panel                       | Resubmission approved             |             Blocks direct resume | Language              |
| Gallery     | Image                   | Single image fails                       | Load              | `Image {number} could not be loaded.`                                                           | Image placeholder / announced on focus | Reload success                    |                     Non-blocking | Language              |
| Gallery     | All images              | No public images load                    | Load              | `Property photographs are temporarily unavailable.`                                             | Gallery region                         | Reload success                    |                Non-blocking page | Language              |

Validation principles:

- Client validation improves clarity; the server remains authoritative.
- Filter validation does not send invalid ranges.
- Publication checks are never client-only.
- Error text does not reveal private states or internal causes.

---

# 34. Responsive Behaviour

## 34.1 Global widths

| Surface            | Maximum width | Desktop gutters | Tablet gutters |            Mobile gutters |
| ------------------ | ------------: | --------------: | -------------: | ------------------------: |
| Marketplace browse |       1360 px |           40 px |          32 px |                  20–24 px |
| Property details   |       1360 px |           40 px |          32 px | 0 gallery / 20–24 content |
| Saved Properties   |       1360 px |           40 px |          32 px |                  20–24 px |
| Seller publication |       1200 px |           40 px |          32 px |                  20–24 px |
| Status panel       |        680 px |         centred |        centred |        full content width |

## 34.2 Desktop marketplace

- Search spans up to 880 px.
- Filter toolbar stays on one line where possible and wraps once if necessary.
- Three property columns.
- Sort aligns to logical end of results header.
- Pagination centred beneath grid.
- No persistent left filter sidebar.

## 34.3 Tablet marketplace

- Two columns.
- Search full width.
- Primary filter controls may horizontally scroll in a clearly bounded row or collapse into `Filters`; recommend `Property type`, `Price`, and `Filters` only.
- Sort remains beside results count when space permits, otherwise next row.

## 34.4 Mobile marketplace

- One column.
- Search directly below heading.
- One row with `Filters` and `Sort` buttons.
- Active chips below.
- Filter sheet full-height.
- Property images 4:3.
- Pagination uses `Previous`, current/total, `Next` with large targets.
- Bottom navigation remains visible unless a modal sheet is open.

## 34.5 Property details

### Desktop

- Gallery mosaic.
- Header/actions one line or two balanced rows.
- 8/4 content grid.
- Sticky action rail optional.

### Tablet

- Gallery mosaic simplifies to one large + two thumbnails.
- Content becomes single column or 7/5 if width permits.
- Action rail not sticky.

### Mobile

- Swipe gallery.
- Content stacked.
- Sticky bottom actions.
- Body bottom padding at least action-bar height + safe-area inset.
- Full-screen gallery hides customer navigation.

## 34.6 Publication screens

- Desktop: property summary beside checklist/status where useful.
- Tablet: summary above checklist.
- Mobile: cover thumbnail, compact identity, then status content.
- Confirmation action bar may stick at bottom.
- Dialogs become bottom sheets where the shared pattern exists.

## 34.7 Touch and keyboard

- Minimum 44 × 44 px target.
- Mobile numeric filter fields use decimal/numeric keyboard as appropriate, though values are normalized to whole units.
- Search uses search keyboard action.
- Safe-area insets applied to full-screen sheet, gallery, and sticky actions.

## 34.8 Zoom and reflow

- Works at 200% zoom.
- Property cards do not clip price or facts.
- Filter popovers become modal sheets when viewport cannot accommodate them.
- No fixed-height description or Investment Case panels.
- Gallery controls remain accessible at high zoom.

---

# 35. Arabic and RTL Behaviour

All Arabic product copy in this document is draft and requires professional review before release.

## 35.1 What mirrors

- Header alignment and navigation order
- Breadcrumb arrows and flow
- Search icon/control placement
- Filter-trigger order
- Filter sheet and action order
- Sort-menu alignment
- Property-card text alignment
- Save/owner control placement
- Property-details 8/4 grid
- Gallery mosaic and visual previous/next arrows
- Sticky action order
- Publication checklist status/action placement
- Dialog action order
- Pagination arrows

## 35.2 What remains LTR

- AED amounts and grouped digits
- Percentages and mathematical values
- Square-foot values where Latin unit is used
- Public IDs and URLs
- English building names when no approved Arabic name exists
- Image counters such as `2 / 8`, though surrounding copy is Arabic
- Dates when rendered in a Latin numeric format; prefer locale-formatted Arabic output where supported

Use bidirectional isolation around mixed values.

## 35.3 Search

- Arabic placeholder and label align to logical start.
- Entered text uses `dir=auto` so Arabic and English building names behave naturally.
- Suggestion name may be English; type/context metadata is Arabic.
- Search icon mirrors only if the design system treats it as directional; a magnifying glass is usually non-directional.

## 35.4 Prices and numbers

- Use the shared AED formatter.
- Accept Arabic-Indic and Western digits in filters.
- Normalize for validation and queries.
- Display according to approved locale formatting.
- Keep the currency-value sequence consistent across the Arabic product after language review.

## 35.5 Filter order and drawer

- Primary toolbar order follows RTL reading flow.
- Side sheet opens from logical end; bottom sheet requires no directional change.
- Range fields appear in locale order but maintain clear labels `Minimum` and `Maximum`; never rely on visual position alone.
- Active chips remove icon at logical end.

## 35.6 Property cards

- Save control at logical end of image.
- Price and headline align to logical start.
- Fact order follows RTL reading direction.
- Mixed building/community names use isolated spans.

## 35.7 Gallery

- Gallery mosaic mirrors visually.
- `Previous` and `Next` labels are localized.
- Arrow key behaviour follows the displayed sequence and is documented consistently; do not reverse image indices invisibly.
- Close remains at logical end.

## 35.8 Breadcrumbs

- Chevron mirrors.
- DOM order follows Arabic reading order.
- Current page remains last in reading sequence.

## 35.9 Mobile sticky actions

- Primary action occupies the dominant logical position.
- Share and Save icons mirror placement, not icon artwork unless directional.
- Safe-area behaviour is identical.

## 35.10 Screen-reader considerations

- Set page language correctly.
- Isolate English proper names.
- Provide Arabic accessible labels for icon controls.
- Read values in a coherent order, not character-by-character due to bidi errors.

---

# 36. Accessibility Requirements

## 36.1 Page and landmark structure

- One `h1` per route.
- Marketplace results have a labelled region.
- Search uses `search` landmark/form semantics.
- Filters use a labelled region or fieldset groups.
- Pagination uses a labelled navigation landmark.
- Property-details sections use logical `h2` hierarchy.

## 36.2 Search and suggestions

- Persistent visible label or accessible equivalent with visible page context.
- Combobox/listbox semantics.
- Keyboard suggestion navigation.
- Active option announced.
- Escape closes without clearing input.
- Clear action labelled.

## 36.3 Filters

- Every control has a visible label.
- Related range inputs grouped with a legend.
- Active-filter count announced.
- Apply result count announced.
- Mobile sheet traps focus and restores it.
- Clear All confirms through immediate visible state; no confirmation dialog needed.

## 36.4 Results updates

- Use a polite live region for `Updating results` and final count.
- Do not announce every skeleton card.
- Focus remains on invoking control for filter/sort changes.
- Pagination success moves focus to results heading.

## 36.5 Property cards

- Card is a semantic list item.
- Image and title links have understandable accessible names.
- Save is a separate interactive control.
- Avoid duplicate verbose link names; use hidden context where needed.
- Hover is not required to reveal essential data.

## 36.6 Gallery

- Every gallery trigger has image index context.
- Full-screen gallery uses modal semantics and focus trap.
- Escape closes.
- Close restores focus.
- Previous/Next disabled states are announced if non-looping.
- No auto-rotation.
- Failed image announced only when relevant.

## 36.7 Save states

- Toggle state programmatically available.
- Loading state announced.
- Success/error announcements are concise.
- Icon fill is not the only indicator.

## 36.8 Dialogs and sheets

- Labelled title and description.
- Initial focus on heading or least destructive action according to shared pattern.
- Background inert.
- Escape closes when safe.
- Focus restores to trigger.

## 36.9 Images

- Property images have safe descriptive or ordinal alt text.
- Decorative logo/placeholder graphics hidden from assistive technology where appropriate.
- Do not put essential text inside images.

## 36.10 Contrast and focus

- Text meets WCAG AA.
- Focus indicator at least 2 px and 3:1 against adjacent colors.
- Status chips include text and icon.
- Disabled controls remain legible but clearly unavailable.

## 36.11 Reduced motion

- Disable card-image zoom.
- No auto carousel.
- Use immediate or short opacity changes.
- Skeleton shimmer disabled or reduced.

## 36.12 Touch targets

- Save, Share, filter triggers, close, gallery controls, pagination, and chips meet 44 px target.
- Spacing prevents accidental adjacent activation.

## 36.13 Error handling

- Validation errors programmatically associated.
- Form-level error summaries focusable when multiple issues exist.
- Publication status changes announced.
- No blank route during failure.

---

# 37. Security and Privacy Rules

## 37.1 Public allowlist

Only approved public projection fields may reach anonymous or general customer clients. Recommended public fields:

- Opaque public ID
- Canonical slug
- Listing state only as needed to assert `LIVE`
- Asking price
- Property type
- Emirate
- Community/area
- Building/project
- Bedrooms
- Bathrooms
- Size
- Furnishing status
- Completion status
- Parking
- Description
- Features/amenities
- Public photo assets and order
- Cover-photo reference
- Public Investment Case metrics when enabled
- Published and public-updated timestamps

## 37.2 Never public

- Ownership documents
- Private storage bucket or object paths
- Signed private URLs
- Draft photographs
- Seller email or phone
- Seller legal name
- Unit number/private identifier
- Private occupancy details
- Verification records/outcomes beyond approved general prototype disclosure
- Form A records
- Permit internals or QR payloads
- Publication-request internals and failure notes
- Admin notes
- Audit events
- Internal listing/property/profile IDs
- Private Investment Case inputs

## 37.3 Public query rule

Anonymous and marketplace queries return only `LIVE` listings. Do not fetch other states and filter in the browser.

## 37.4 Public-photo rules

- Draft-photo bucket remains private.
- Publication creates public copies/renditions in the approved public bucket.
- Public objects use opaque paths that do not include customer email or private IDs.
- A listing does not become live until every required asset succeeds.
- Partial failed assets are not linked publicly.
- Pausing may leave public objects stored but public listing responses and normal URLs must not expose them; direct object URL policy must follow the accepted storage architecture.
- Ownership documents are never copied.

## 37.5 Save privacy

- Saved relationships are visible only to the saving customer and authorised Admin future scope.
- Seller sees only aggregate count, never identities.
- Anonymous Save intent uses only public ID and allowlisted relative route.

## 37.6 Owner routes

- Server verifies owner on every private route and mutation.
- Not found and forbidden use the same safe response.
- Public owner view does not merge private management data into the public response.

## 37.7 Search privacy

Search indexes and suggestions include only approved public fields from live listings. Do not index unit number, owner profile, document text, or internal notes.

## 37.8 Audit events

Safe events may include:

- `LISTING_PUBLICATION_SUBMITTED`
- `LISTING_PUBLICATION_APPROVED_DEMO`
- `LISTING_PUBLICATION_RETURNED_DEMO`
- `LISTING_PUBLIC_PHOTOS_PREPARED`
- `LISTING_PUBLIC_PHOTOS_FAILED`
- `LISTING_PUBLISHED`
- `LISTING_PAUSED`
- `LISTING_RESUMED`
- `PROPERTY_SAVED`
- `PROPERTY_SAVE_REMOVED`

Safe metadata: user ID, listing ID, request ID, outcome category, timestamp, counts. Never log image URLs, document paths/content, search free text if analytics is not approved, credentials, tokens, or private seller data.

---

# 38. Exact English Copy

This section is the master English copy reference. Contextual screen sections remain authoritative.

## 38.1 Marketplace browse

| Key                             | English                                                                                   |
| ------------------------------- | ----------------------------------------------------------------------------------------- |
| `marketplace.title.uae`         | Properties in the UAE                                                                     |
| `marketplace.title.dubai`       | Properties in Dubai                                                                       |
| `marketplace.description`       | Browse clear property information, compare key details, and save homes that interest you. |
| `marketplace.prototypeTitle`    | Prototype marketplace                                                                     |
| `marketplace.prototypeBody`     | Property verification and publication review are simulated in this demo.                  |
| `marketplace.searchLabel`       | Search properties                                                                         |
| `marketplace.searchPlaceholder` | Search by community, area, building, or property type                                     |
| `marketplace.searchAction`      | Search                                                                                    |
| `marketplace.clearSearch`       | Clear search                                                                              |
| `marketplace.results.one`       | 1 property                                                                                |
| `marketplace.results.many`      | {count} properties                                                                        |
| `marketplace.results.query`     | {count} properties matching “{query}”                                                     |
| `marketplace.updating`          | Updating results…                                                                         |
| `marketplace.found`             | {count} properties found.                                                                 |

## 38.2 Filters and sort

| Key                    | English                   |
| ---------------------- | ------------------------- |
| `filters.title`        | Filters                   |
| `filters.propertyType` | Property type             |
| `filters.priceRange`   | Price range               |
| `filters.minimumPrice` | Minimum price             |
| `filters.maximumPrice` | Maximum price             |
| `filters.bedrooms`     | Bedrooms                  |
| `filters.bathrooms`    | Bathrooms                 |
| `filters.community`    | Community or area         |
| `filters.emirate`      | Emirate                   |
| `filters.size`         | Property size             |
| `filters.minimumSize`  | Minimum size              |
| `filters.maximumSize`  | Maximum size              |
| `filters.furnishing`   | Furnishing                |
| `filters.completion`   | Completion status         |
| `filters.investment`   | Investment Case available |
| `filters.more`         | More filters              |
| `filters.apply`        | Apply filters             |
| `filters.showCount`    | Show {count} properties   |
| `filters.clearAll`     | Clear all                 |
| `sort.label`           | Sort by                   |
| `sort.newest`          | Newest                    |
| `sort.priceLow`        | Price: Low to High        |
| `sort.priceHigh`       | Price: High to Low        |
| `sort.sizeLarge`       | Size: Largest First       |

## 38.3 Empty and error states

| Key                      | English                                                                          |
| ------------------------ | -------------------------------------------------------------------------------- |
| `empty.resultsTitle`     | No properties match these filters                                                |
| `empty.resultsBody`      | Try changing your search, price range, or property details.                      |
| `empty.queryBody`        | No properties match “{query}”. Try a different area, building, or property type. |
| `empty.clear`            | Clear all filters                                                                |
| `empty.browseAll`        | Browse all properties                                                            |
| `error.marketplaceTitle` | Properties are temporarily unavailable                                           |
| `error.marketplaceBody`  | We could not load the marketplace. Try again shortly.                            |
| `error.retry`            | Try again                                                                        |
| `error.propertyTitle`    | This property is no longer available                                             |
| `error.propertyBody`     | It may have been paused or removed from the MARKAZ marketplace.                  |
| `error.nextPage`         | We could not load the next page. Try again.                                      |
| `error.filter`           | We could not update the results. Try again.                                      |

## 38.4 Property card and details

| Key                            | English                                                                                                           |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| `property.investmentAvailable` | Investment Case available                                                                                         |
| `property.yourListing`         | Your listing                                                                                                      |
| `property.imageUnavailable`    | Property image unavailable                                                                                        |
| `property.about`               | About this property                                                                                               |
| `property.amenities`           | Features and amenities                                                                                            |
| `property.details`             | Property details                                                                                                  |
| `property.directTitle`         | Direct listing                                                                                                    |
| `property.directBody`          | Published directly through MARKAZ. Ownership verification and publication review are simulated in this prototype. |
| `property.viewAllPhotos`       | View all {count} photos                                                                                           |
| `property.photoCount`          | {current} of {total}                                                                                              |
| `property.share`               | Share listing                                                                                                     |
| `property.copyLink`            | Copy listing link                                                                                                 |
| `property.linkCopied`          | Listing link copied.                                                                                              |
| `property.manage`              | Manage listing                                                                                                    |

## 38.5 Save and authentication interception

| Key                      | English                                                          |
| ------------------------ | ---------------------------------------------------------------- |
| `save.save`              | Save property                                                    |
| `save.saving`            | Saving…                                                          |
| `save.saved`             | Saved                                                            |
| `save.remove`            | Remove from saved                                                |
| `save.removing`          | Removing…                                                        |
| `save.success`           | Property saved.                                                  |
| `save.removed`           | Removed from saved properties.                                   |
| `save.error`             | We could not save this property. Try again.                      |
| `save.authTitle`         | Sign in to save this property                                    |
| `save.authBody`          | Save properties to your MARKAZ account and return to them later. |
| `save.signIn`            | Sign in                                                          |
| `save.createAccount`     | Create account                                                   |
| `save.continueBrowsing`  | Continue browsing                                                |
| `save.unavailableReturn` | This property is no longer available, so it was not saved.       |

## 38.6 Saved Properties

| Key                      | English                                                        |
| ------------------------ | -------------------------------------------------------------- |
| `saved.title`            | Saved properties                                               |
| `saved.description`      | Keep track of properties you may want to revisit.              |
| `saved.emptyTitle`       | No saved properties yet                                        |
| `saved.emptyBody`        | Save properties while browsing to find them here later.        |
| `saved.browse`           | Browse properties                                              |
| `saved.unavailableTitle` | This property is no longer available                           |
| `saved.unavailableBody`  | It may have been paused or removed from the marketplace.       |
| `saved.partialError`     | Some saved properties could not be loaded. Try again.          |
| `saved.removeError`      | We could not remove this property from saved items. Try again. |

## 38.7 Publication

| Key                                | English                                                                                                            |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `publication.readyStatus`          | Ready to publish                                                                                                   |
| `publication.readyTitle`           | Your listing setup is complete                                                                                     |
| `publication.readyBody`            | Review the public preview, then submit the listing for simulated publication review.                               |
| `publication.privacy`              | Ownership documents, unit identifiers, and private verification information will not appear publicly.              |
| `publication.preview`              | Preview public listing                                                                                             |
| `publication.publish`              | Publish listing                                                                                                    |
| `publication.checklistTitle`       | Publication checklist                                                                                              |
| `publication.checklistBody`        | We will check that your public listing is complete and that private information is excluded.                       |
| `publication.checklistComplete`    | Your listing is ready for publication confirmation.                                                                |
| `publication.checklistIncomplete`  | Complete the items marked “Action required” before publishing.                                                     |
| `publication.confirmTitle`         | Publish your listing                                                                                               |
| `publication.confirmBody`          | Your property will become visible in the MARKAZ marketplace after the simulated review is complete.                |
| `publication.confirmPrivacy`       | Your ownership documents and private verification information will remain private.                                 |
| `publication.checkbox`             | I have reviewed the public listing and confirm that the property information and photographs are ready to publish. |
| `publication.checkboxError`        | Confirm that the public listing is ready to publish.                                                               |
| `publication.submit`               | Submit for publication                                                                                             |
| `publication.submitting`           | Submitting…                                                                                                        |
| `publication.simTitle`             | Publication review simulated                                                                                       |
| `publication.simBody`              | This prototype does not perform a real regulatory or legal publication review.                                     |
| `publication.pendingTitle`         | Publication review in progress                                                                                     |
| `publication.pendingBody`          | We are preparing the public listing and its photographs. You can leave this page and return later.                 |
| `publication.pendingStatus`        | Pending · Demo                                                                                                     |
| `publication.approvedTitle`        | Publication review complete                                                                                        |
| `publication.approvedBody`         | The demo review is complete. We are making your listing available in the marketplace.                              |
| `publication.approvedStatus`       | Approved · Demo                                                                                                    |
| `publication.returnedTitle`        | Review your listing before resubmitting                                                                            |
| `publication.returnedBody`         | The simulated publication review could not be completed with the current listing information.                      |
| `publication.reviewListing`        | Review listing                                                                                                     |
| `publication.retry`                | Try publication again                                                                                              |
| `publication.processingErrorTitle` | We could not complete publication                                                                                  |
| `publication.processingErrorBody`  | Your listing is still private and your saved information is unchanged. Try again shortly.                          |
| `publication.photoFailure`         | We could not prepare all property photographs for publication. Your listing is still private.                      |
| `publication.liveTitle`            | Your listing is live                                                                                               |
| `publication.liveBody`             | Your property is now visible in the MARKAZ marketplace.                                                            |
| `publication.viewLive`             | View live listing                                                                                                  |
| `publication.manage`               | Manage listing                                                                                                     |

## 38.8 Pause and resume

| Key                     | English                                                                                                     |
| ----------------------- | ----------------------------------------------------------------------------------------------------------- |
| `pause.title`           | Pause this listing?                                                                                         |
| `pause.body`            | The property will no longer appear in marketplace search or public property pages. You can resume it later. |
| `pause.action`          | Pause listing                                                                                               |
| `pause.keepLive`        | Keep listing live                                                                                           |
| `pause.status`          | Paused                                                                                                      |
| `pause.pageTitle`       | This listing is paused                                                                                      |
| `pause.pageBody`        | It is hidden from marketplace results and public property pages. You can resume it when you are ready.      |
| `resume.title`          | Resume this listing?                                                                                        |
| `resume.body`           | The property will become visible again in marketplace search and through its public link.                   |
| `resume.action`         | Resume listing                                                                                              |
| `resume.keepPaused`     | Keep paused                                                                                                 |
| `pause.error`           | We could not pause the listing. It remains live. Try again.                                                 |
| `resume.error`          | We could not resume the listing. It remains paused. Try again.                                              |
| `resume.reviewRequired` | This listing needs publication review before it can become live again.                                      |

## 38.9 Investment Case

| Key                          | English                                                                                                                                             |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `investment.title`           | Investment Case                                                                                                                                     |
| `investment.intro`           | Seller-provided information and estimated calculations to help explain the property’s investment context.                                           |
| `investment.roi`             | Estimated ROI                                                                                                                                       |
| `investment.annualised`      | Estimated annualised return                                                                                                                         |
| `investment.priceSqft`       | Price per square foot                                                                                                                               |
| `investment.areaComparison`  | Area comparison                                                                                                                                     |
| `investment.unavailable`     | Not available from the information provided                                                                                                         |
| `investment.areaUnavailable` | Area comparison unavailable                                                                                                                         |
| `investment.disclosure`      | Investment figures are seller-provided and calculated from the information entered. They are estimates, not financial advice or guaranteed returns. |

---

# 39. Arabic Copy and Review Flags

## 39.1 Approval status

All Arabic below is draft. Required reviews:

- Marketplace and property copy: professional Arabic language review
- Property terminology: UAE real-estate terminology review
- Publication simulation: business/legal and language review
- Investment disclosure: legal/compliance and language review
- Confirmation checkbox: legal/product and language review

Do not represent the Arabic as approved until review is complete.

## 39.2 Draft Arabic copy

| English                                                                                                                                             | Draft Arabic                                                                                                             | Review                    |
| --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------- |
| Properties in the UAE                                                                                                                               | عقارات في دولة الإمارات                                                                                                  | Language/property         |
| Properties in Dubai                                                                                                                                 | عقارات في دبي                                                                                                            | Language/property         |
| Browse clear property information, compare key details, and save homes that interest you.                                                           | تصفّح معلومات واضحة عن العقارات، وقارن التفاصيل الأساسية، واحفظ العقارات التي تهمك.                                      | Language                  |
| Prototype marketplace                                                                                                                               | سوق تجريبي                                                                                                               | Business/language         |
| Property verification and publication review are simulated in this demo.                                                                            | التحقق من العقار ومراجعة النشر محاكاة ضمن هذا العرض التجريبي.                                                            | Business/legal/language   |
| Search properties                                                                                                                                   | البحث عن عقارات                                                                                                          | Language                  |
| Search by community, area, building, or property type                                                                                               | ابحث حسب المجمع أو المنطقة أو المبنى أو نوع العقار                                                                       | Property/language         |
| Filters                                                                                                                                             | عوامل التصفية                                                                                                            | Language                  |
| Property type                                                                                                                                       | نوع العقار                                                                                                               | Property                  |
| Price range                                                                                                                                         | نطاق السعر                                                                                                               | Language                  |
| Minimum price                                                                                                                                       | الحد الأدنى للسعر                                                                                                        | Language                  |
| Maximum price                                                                                                                                       | الحد الأقصى للسعر                                                                                                        | Language                  |
| Bedrooms                                                                                                                                            | غرف النوم                                                                                                                | Property                  |
| Bathrooms                                                                                                                                           | الحمّامات                                                                                                                | Property                  |
| Community or area                                                                                                                                   | المجمع أو المنطقة                                                                                                        | Property                  |
| Property size                                                                                                                                       | مساحة العقار                                                                                                             | Property                  |
| Furnishing                                                                                                                                          | حالة التأثيث                                                                                                             | Property                  |
| Completion status                                                                                                                                   | حالة الإنجاز                                                                                                             | Property                  |
| Investment Case available                                                                                                                           | تتوفر دراسة استثمارية                                                                                                    | Business/property         |
| Apply filters                                                                                                                                       | تطبيق عوامل التصفية                                                                                                      | Language                  |
| Show {count} properties                                                                                                                             | عرض {count} عقارًا                                                                                                       | Plural review             |
| Clear all                                                                                                                                           | مسح الكل                                                                                                                 | Language                  |
| Sort by                                                                                                                                             | الترتيب حسب                                                                                                              | Language                  |
| Newest                                                                                                                                              | الأحدث                                                                                                                   | Language                  |
| Price: Low to High                                                                                                                                  | السعر: من الأقل إلى الأعلى                                                                                               | Language                  |
| Price: High to Low                                                                                                                                  | السعر: من الأعلى إلى الأقل                                                                                               | Language                  |
| Size: Largest First                                                                                                                                 | المساحة: الأكبر أولًا                                                                                                    | Language                  |
| No properties match these filters                                                                                                                   | لا توجد عقارات تطابق عوامل التصفية هذه                                                                                   | Language                  |
| Try changing your search, price range, or property details.                                                                                         | جرّب تعديل البحث أو نطاق السعر أو تفاصيل العقار.                                                                         | Language                  |
| Save property                                                                                                                                       | حفظ العقار                                                                                                               | Language                  |
| Saved                                                                                                                                               | تم الحفظ                                                                                                                 | Language                  |
| Remove from saved                                                                                                                                   | إزالة من المحفوظات                                                                                                       | Language                  |
| Your listing                                                                                                                                        | إعلانك                                                                                                                   | Property/language         |
| Investment Case available                                                                                                                           | تتوفر دراسة استثمارية                                                                                                    | Business/property         |
| About this property                                                                                                                                 | نبذة عن العقار                                                                                                           | Property                  |
| Features and amenities                                                                                                                              | المزايا والمرافق                                                                                                         | Property                  |
| Property details                                                                                                                                    | تفاصيل العقار                                                                                                            | Property                  |
| Direct listing                                                                                                                                      | إعلان مباشر                                                                                                              | Business/property         |
| Share listing                                                                                                                                       | مشاركة الإعلان                                                                                                           | Language                  |
| Manage listing                                                                                                                                      | إدارة الإعلان                                                                                                            | Language                  |
| Sign in to save this property                                                                                                                       | سجّل الدخول لحفظ هذا العقار                                                                                              | Language                  |
| Save properties to your MARKAZ account and return to them later.                                                                                    | احفظ العقارات في حسابك على MARKAZ للعودة إليها لاحقًا.                                                                   | Language                  |
| Saved properties                                                                                                                                    | العقارات المحفوظة                                                                                                        | Language                  |
| No saved properties yet                                                                                                                             | لا توجد عقارات محفوظة بعد                                                                                                | Language                  |
| This property is no longer available                                                                                                                | هذا العقار لم يعد متاحًا                                                                                                 | Language                  |
| Ready to publish                                                                                                                                    | جاهز للنشر                                                                                                               | Business/property         |
| Your listing setup is complete                                                                                                                      | اكتمل إعداد إعلانك                                                                                                       | Language                  |
| Publication checklist                                                                                                                               | قائمة التحقق قبل النشر                                                                                                   | Business/language         |
| Publish your listing                                                                                                                                | انشر إعلانك                                                                                                              | Language                  |
| Your property will become visible in the MARKAZ marketplace after the simulated review is complete.                                                 | سيظهر عقارك في سوق MARKAZ بعد اكتمال المراجعة التجريبية.                                                                 | Business/legal/language   |
| Your ownership documents and private verification information will remain private.                                                                  | ستظل مستندات الملكية ومعلومات التحقق الخاصة سرية.                                                                        | Legal/privacy/language    |
| I have reviewed the public listing and confirm that the property information and photographs are ready to publish.                                  | لقد راجعت الإعلان العام وأؤكد أن معلومات العقار وصوره جاهزة للنشر.                                                       | Legal/product/language    |
| Submit for publication                                                                                                                              | إرسال للنشر                                                                                                              | Language                  |
| Publication review simulated                                                                                                                        | محاكاة مراجعة النشر                                                                                                      | Business/legal/language   |
| This prototype does not perform a real regulatory or legal publication review.                                                                      | لا يُجري هذا النموذج الأولي مراجعة تنظيمية أو قانونية فعلية للنشر.                                                       | Legal/language            |
| Publication review in progress                                                                                                                      | مراجعة النشر قيد التنفيذ                                                                                                 | Business/language         |
| Review your listing before resubmitting                                                                                                             | راجع إعلانك قبل إعادة الإرسال                                                                                            | Language                  |
| Your listing is live                                                                                                                                | إعلانك منشور الآن                                                                                                        | Business/property         |
| Your property is now visible in the MARKAZ marketplace.                                                                                             | أصبح عقارك ظاهرًا الآن في سوق MARKAZ.                                                                                    | Language                  |
| Pause this listing?                                                                                                                                 | هل تريد إيقاف هذا الإعلان مؤقتًا؟                                                                                        | Language                  |
| The property will no longer appear in marketplace search or public property pages. You can resume it later.                                         | لن يظهر العقار في نتائج البحث أو صفحات العقارات العامة. يمكنك استئناف الإعلان لاحقًا.                                    | Language                  |
| This listing is paused                                                                                                                              | هذا الإعلان متوقف مؤقتًا                                                                                                 | Language                  |
| Resume listing                                                                                                                                      | استئناف الإعلان                                                                                                          | Language                  |
| Investment Case                                                                                                                                     | الدراسة الاستثمارية                                                                                                      | Business/property         |
| Estimated ROI                                                                                                                                       | العائد على الاستثمار التقديري                                                                                            | Financial/legal           |
| Estimated annualised return                                                                                                                         | العائد السنوي التقديري                                                                                                   | Financial/legal           |
| Price per square foot                                                                                                                               | السعر لكل قدم مربعة                                                                                                      | Property                  |
| Area comparison                                                                                                                                     | مقارنة بالمنطقة                                                                                                          | Property                  |
| Investment figures are seller-provided and calculated from the information entered. They are estimates, not financial advice or guaranteed returns. | الأرقام الاستثمارية مقدمة من البائع ومحسوبة بناءً على المعلومات المُدخلة. وهي تقديرات وليست نصيحة مالية أو عوائد مضمونة. | Legal/compliance/language |

---

# 40. Design-to-Engineering Handoff

## 40.1 Requirement labels

Use these labels in implementation tasks:

- **[VISUAL]** Layout, typography, colour, spacing, responsive presentation
- **[INTERACTION]** Input, focus, dialog, save, gallery, pagination behaviour
- **[PRODUCT]** Account, publication, save, edit, and availability rules
- **[SECURITY]** RLS, public projection, privacy, safe routes, anti-enumeration
- **[PUBLICATION]** Checklist, request, photo processing, live transition, pause/resume
- **[SIMULATION]** Demo review disclosure and outcomes
- **[ACCESSIBILITY]** Keyboard, screen reader, contrast, announcements, reduced motion
- **[I18N]** English/Arabic catalogues, RTL, number and mixed-script behaviour
- **[OPTIONAL]** May defer without failing Week 3 acceptance

## 40.2 Seller-publication screens

| Route                             | Screen                  | User / listing state                  | Entry / required data / privacy                      | Primary / secondary                     | Components                               | Loading / empty       | Errors                                  | Success / transition        | Audit                                                    | Responsive / RTL / accessibility               | Claude Code notes                                   |
| --------------------------------- | ----------------------- | ------------------------------------- | ---------------------------------------------------- | --------------------------------------- | ---------------------------------------- | --------------------- | --------------------------------------- | --------------------------- | -------------------------------------------------------- | ---------------------------------------------- | --------------------------------------------------- |
| `/sell/listings/[id]/ready`       | Ready management        | Owner; `READY_TO_PUBLISH`             | Server readiness, public preview summary; private    | Publish / Preview, Edit, My Listings    | Management summary, status, price, cover | Checking readiness    | Not available, readiness invalid        | `/publish`                  | none                                                     | Stack mobile; logical mirroring; heading focus | [SECURITY] verify owner and readiness server-side   |
| `/sell/listings/[id]/preview`     | Public preview          | Owner; ready/pending                  | Public projection only; owner-private route          | Continue to publish / Back              | Property Details Shell, preview banner   | Projection skeleton   | Preview unavailable                     | `/publish`                  | none                                                     | Same as public detail; no private merge        | Reuse exact public mapper and components            |
| `/sell/listings/[id]/publish`     | Publication checklist   | Owner; ready                          | Readiness/checklist/public-private map               | Continue / Preview, edit links          | Checklist, disclosure                    | Checking items        | Missing/failed checks                   | Confirmation state on route | none                                                     | Public/private stack mobile; status semantics  | Do not derive readiness only in client              |
| `/sell/listings/[id]/publish`     | Confirmation            | Owner; ready                          | Confirmation checkbox                                | Submit / Back                           | Confirmation component, sticky actions   | Submitting            | Checkbox, invalidation, request failure | `/publication` PENDING      | `LISTING_PUBLICATION_SUBMITTED`                          | Checkbox RTL; error association                | Idempotent active request; version check            |
| `/sell/listings/[id]/publication` | Pending                 | Owner; ready + `PENDING`              | Request stage, safe photo counts; private            | My Listings / Preview, sign out         | Status panel, property summary           | Poll/refetch          | Processing error                        | Approved/live or returned   | stage-specific                                           | Announce changes once; no fake percentage      | Persist state; no forced stay on page               |
| same                              | Approved                | Owner; approved                       | Public readiness and asset completion                | View live / Manage                      | Status panel                             | Finalising            | Live transition failure                 | `LIVE` + live success       | `LISTING_PUBLICATION_APPROVED_DEMO`, `LISTING_PUBLISHED` | Focus success heading                          | Do not show success before public assets queryable  |
| same                              | Changes required        | Owner; `REJECTED_DEMO`, listing ready | Safe reason category only                            | Review listing / Retry, My Listings     | Failure/retry panel                      | none                  | retry failure                           | New pending request         | `LISTING_PUBLICATION_RETURNED_DEMO`                      | Actions stack mobile                           | No internal notes/provider text                     |
| same                              | Photo processing failed | Owner; request failed                 | Failed count only                                    | Try again / Review photographs          | Failure panel                            | retrying              | repeat failure                          | Pending                     | `LISTING_PUBLIC_PHOTOS_FAILED`                           | clear live status                              | Remove/quarantine partial assets                    |
| `/sell/listings/[id]/manage`      | Live management         | Owner; `LIVE`                         | Public summary + owner aggregate data; private route | View live / Copy, Edit, Pause           | Management panel                         | Loading summary/count | access, action failure                  | remains live                | none                                                     | 2-col→stack; owner-only semantics              | Saved count aggregate only                          |
| same                              | Paused management       | Owner; `PAUSED`                       | Owner summary; private                               | Resume or Submit for publication / Edit | Management panel                         | loading               | resume failure                          | `LIVE` or publish flow      | `LISTING_RESUMED`                                        | status announced                               | Revalidate readiness; material edits require review |
| dialog/sheet                      | Pause confirmation      | Owner; live                           | Public-removal consequences                          | Pause / Keep live                       | Pause dialog                             | Pausing               | pause failure                           | `PAUSED`                    | `LISTING_PAUSED`                                         | focus trap/restore; RTL actions                | Reversible neutral action, not delete               |
| dialog/sheet                      | Resume confirmation     | Owner; paused, valid                  | Public-return consequences                           | Resume / Keep paused                    | Confirmation dialog                      | Resuming              | resume failure                          | `LIVE`                      | `LISTING_RESUMED`                                        | same                                           | Direct resume only if no invalidating edits         |

## 40.3 Marketplace screens

| Route                           | Screen              | User / listing state                 | Entry / required data / privacy          | Primary / secondary                        | Components                                      | Loading / empty       | Errors                              | Success / transition    | Audit             | Responsive / RTL / accessibility             | Claude Code notes                         |
| ------------------------------- | ------------------- | ------------------------------------ | ---------------------------------------- | ------------------------------------------ | ----------------------------------------------- | --------------------- | ----------------------------------- | ----------------------- | ----------------- | -------------------------------------------- | ----------------------------------------- |
| `/properties`                   | Browse              | Anonymous/customer; only live        | Public facets and projections            | Search/open property / filters, sort, save | Shell, search, filters, count, grid, pagination | Full skeleton         | marketplace unavailable             | detail/query page       | none              | 3/2/1 cols; RTL toolbar; results live region | Public server query only `LIVE`           |
| `/properties?...`               | Filtered results    | Any                                  | Validated query params                   | Open property / remove chips               | Same                                            | update state          | filter/sort failure retains results | new query URL           | none              | focus remains trigger                        | Reset page to 1 on changes                |
| mobile sheet                    | Mobile filters      | Any                                  | Draft filter state, facet count          | Show count / Clear                         | Filter sheet                                    | facet/count loading   | count failure                       | apply and close         | none              | safe area, trap/restore, RTL                 | Discard on close without apply            |
| browse region                   | Empty results       | Any                                  | Zero result set                          | Clear filters / Browse all                 | Empty state                                     | none                  | none                                | query reset             | none              | focus heading                                | Not an error status                       |
| browse route                    | Marketplace error   | Any                                  | Safe error only                          | Retry / Home                               | Error panel                                     | retrying              | persistent failure                  | browse                  | none              | focus heading                                | No raw errors                             |
| `/properties/[publicId]/[slug]` | Property details    | Any; live                            | Public projection only                   | Save/Share; owner Manage                   | Details shell, gallery, facts, investment       | page skeleton         | unavailable, partial images         | stays/detail actions    | none              | gallery mobile; RTL mixed data               | Canonical slug redirect; no internal UUID |
| gallery modal                   | Full-screen gallery | Any; live projection loaded          | Public photos only                       | Next/previous/close                        | Gallery modal                                   | image loading         | image fail                          | close returns focus     | none              | focus trap, swipe, RTL controls              | No signed private URL                     |
| detail section                  | Investment visible  | Any; live + visible                  | Public metrics only                      | none                                       | Investment panel                                | metric load with page | partial values                      | static                  | none              | definition list; bidi values                 | Exclude private inputs                    |
| detail section                  | Investment hidden   | Any                                  | No public data                           | none                                       | none                                            | none                  | none                                | section omitted         | none              | none                                         | Do not reveal hidden existence            |
| card/detail                     | Save                | Customer; other owner’s live listing | public ID + auth                         | Toggle save                                | Save button                                     | saving/removing       | failure/unavailable                 | saved/removed           | save events       | announce state; 44 px                        | Idempotent server mutation                |
| dialog/sheet                    | Anonymous Save      | Anonymous                            | public ID + safe return                  | Sign in / Create, browse                   | Auth interception                               | none                  | intent expiry later                 | auth flow, return, save | none              | modal semantics, RTL                         | Allowlist route; consume once             |
| `/saved-properties`             | Saved empty         | Customer                             | no saves                                 | Browse                                     | Empty state                                     | saved skeleton        | page failure                        | browse                  | none              | focus heading                                | Protected route                           |
| same                            | Saved populated     | Customer                             | public projections for live saves        | Open/remove                                | Saved grid/cards                                | skeleton              | partial failure                     | detail/remove           | save remove event | same grid                                    | Most-recent-saved order                   |
| same                            | Saved unavailable   | Customer                             | relationship only; no private projection | Remove                                     | Unavailable card                                | none                  | remove failure                      | removed                 | remove event      | no broken link                               | Never show stale public details           |
| public detail                   | Owner view          | Customer owner; live                 | public projection + owner boolean only   | Manage / Share                             | Owner badge, Manage control                     | standard              | unavailable                         | owner manage            | none              | owner label announced                        | Hide Save; no private data                |

## 40.4 State transitions and publication rules

| Action              | Precondition                                             | State/result                                                          |
| ------------------- | -------------------------------------------------------- | --------------------------------------------------------------------- |
| Submit publication  | owner + ready + confirmation + no active pending         | request `PENDING`; listing remains `READY_TO_PUBLISH`                 |
| Approve demo review | request pending + projection valid + public photos ready | request `APPROVED_DEMO`; listing `LIVE` atomically                    |
| Return demo review  | request pending + safe failure                           | request `REJECTED_DEMO`; listing remains `READY_TO_PUBLISH`           |
| Pause               | owner + `LIVE`                                           | listing `PAUSED`                                                      |
| Resume unchanged    | owner + `PAUSED` + readiness/public assets valid         | listing `LIVE`                                                        |
| Material edit       | owner + `LIVE`                                           | require `Pause and edit`; listing rewinds as existing domain dictates |
| Save                | customer + other owner’s `LIVE` listing                  | saved relationship exists idempotently                                |
| Remove save         | saving customer                                          | relationship absent idempotently                                      |

---

# 41. Required High-Fidelity Mockups

All P0 mockups must be approved before engineering begins on the associated surface. P1 may proceed only after the shared components they depend on are approved. P2 is useful for polish and localisation validation.

| Priority | Mockup                         | Viewport / user state / listing state                  | Key interaction                                  | Why approval is required                                   | Engineering must not invent                                        |
| -------- | ------------------------------ | ------------------------------------------------------ | ------------------------------------------------ | ---------------------------------------------------------- | ------------------------------------------------------------------ |
| P0       | Marketplace browse             | Desktop 1440; anonymous; multiple live listings        | Search, primary filters, sort, card grid         | Establishes public visual language and information density | Search/filter layout, card size, spacing, disclosure, pagination   |
| P0       | Property card states           | Desktop component board; anonymous/authenticated/owner | Default, hover, focus, saved, image error, owner | Core reusable marketplace unit                             | Exact hierarchy, Save placement, owner badge, Investment indicator |
| P0       | Property details               | Desktop 1440; authenticated non-owner; live            | Gallery, facts, Save/Share, content rail         | Largest buyer-facing screen and Week 4 foundation          | Gallery composition, content order, action rail, public disclosure |
| P0       | Marketplace browse             | Mobile 390; anonymous                                  | Search, Filters, Sort, cards                     | Mobile is materially different from desktop                | Mobile hierarchy, card density, action placement, pagination       |
| P0       | Mobile filters                 | Mobile 390; anonymous                                  | Stage filters, count, apply/clear                | High interaction and accessibility risk                    | Sheet structure, sticky bar, section order, range inputs           |
| P0       | Property details               | Mobile 390; authenticated                              | Swipe gallery, sticky Save/Share                 | Defines core mobile browsing and future Offer slot         | Gallery height, facts layout, sticky bar, section spacing          |
| P0       | Publication checklist          | Desktop 1440; owner; ready                             | Public/private review, continue                  | Critical privacy and commitment surface                    | Checklist hierarchy, public/private treatment, edit links          |
| P0       | Publication pending            | Desktop 1440; owner; request pending                   | Leave safely, understand processing              | Must feel believable without fake official review          | Simulation disclosure, stage treatment, actions, property context  |
| P0       | Listing live success           | Desktop 1440; owner; live                              | View, copy link, manage                          | Connects private creation to public product                | Success tone, cover/identity layout, action hierarchy              |
| P0       | Live-listing management        | Desktop 1440; owner; live                              | View, copy, edit, pause                          | Defines seller control after publication                   | Saved count, dates, edit policy, action hierarchy                  |
| P1       | Full-screen gallery            | Desktop and mobile key frames; any viewer              | Next/previous/close                              | Keyboard, touch, and visual behaviour require alignment    | Controls, counter, thumbnail treatment, focus return               |
| P1       | Public Investment Case         | Desktop detail section; live + visible                 | Read metrics/disclosure                          | High risk of trading-platform or misleading styling        | Public metric set, typography, disclosure prominence               |
| P1       | Saved Properties               | Desktop 1440; authenticated; live + unavailable saves  | Remove saved item                                | Reuses cards but adds privacy-sensitive unavailable state  | Grid order, unavailable card, remove feedback                      |
| P1       | Anonymous sign-in interception | Desktop dialog + mobile sheet; anonymous               | Sign in/create/close                             | Must preserve intent without feeling coercive              | Copy, action order, modal size, return expectation                 |
| P1       | Pause confirmation             | Desktop dialog + mobile sheet; owner/live              | Pause or cancel                                  | Reversible but consequential action                        | Tone, retained-data explanation, neutral styling                   |
| P2       | Arabic RTL marketplace         | Desktop 1440; anonymous                                | Search/filter/card reading                       | Validates mixed Arabic/English and number direction        | Mirroring, price direction, chips, official names                  |
| P2       | Arabic RTL property details    | Mobile 390 or desktop 1440; authenticated              | Gallery/facts/sticky actions                     | Validates complex RTL content and action bar               | Grid mirroring, bidi values, gallery controls, sticky actions      |

## 41.1 Mockup approval order

Recommended sequence:

1. Marketplace browse desktop
2. Property card states
3. Property details desktop
4. Browse mobile
5. Mobile filters
6. Property details mobile
7. Publication checklist
8. Publication pending
9. Live success
10. Live management
11. Remaining P1 states
12. Arabic RTL validation frames

---

# 42. Open Product Decisions

The design is implementation-ready with the defaults below. Confirm these items before production rollout; engineering should use the specified default rather than inventing alternatives.

| Decision                                 | Specification default                                                                                               | Owner/review                       |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| Geographic heading                       | Derive `Properties in Dubai` while only Dubai data is supported; use UAE only when coverage exists                  | Product                            |
| Public ID format                         | Opaque, non-sequential public ID separate from UUID                                                                 | Architecture/security              |
| Canonical share domain                   | Current customer-web origin                                                                                         | Platform/product                   |
| Public object caching/CDN                | Use approved storage delivery architecture; do not expose private paths                                             | Platform/security                  |
| Direct public object access while paused | Public page/query hidden; storage policy/caching must prevent unintended continued exposure as architecture permits | Security/platform                  |
| Saved count                              | Show aggregate to owner only                                                                                        | Product/privacy                    |
| Live minor-edit list                     | Description, amenities, order, cover, investment visibility                                                         | Product                            |
| Asking-price edit                        | Material; pause and republish                                                                                       | Product                            |
| Similar properties                       | Optional, deterministic, may defer                                                                                  | Product                            |
| Arabic copy                              | Draft only                                                                                                          | Professional Arabic reviewer       |
| Investment disclosure Arabic             | Draft only                                                                                                          | Legal/compliance + Arabic reviewer |
| Publication confirmation wording         | Approved English direction; Arabic/legal review pending                                                             | Product/legal                      |
| Demo review timing                       | Persisted pending; no fake countdown; deterministic service outcome                                                 | Engineering/demo owner             |
| Public photo failure cleanup             | Remove/quarantine partial attempt before retry                                                                      | Architecture/security              |
| SEO indexing                             | Routes are SEO-ready; indexing policy may remain off for prototype                                                  | Product/SEO                        |

---

# 43. Final Acceptance Checklist

## State and publication

- [ ] `READY_TO_PUBLISH → LIVE` is implemented only through publication confirmation and approved demo request.
- [ ] Publication request has `NOT_SUBMITTED`, `PENDING`, `APPROVED_DEMO`, and `REJECTED_DEMO`.
- [ ] Publication request status is separate from listing state.
- [ ] Listing remains private while publication is pending.
- [ ] Server readiness is revalidated before submission and live transition.
- [ ] Seller confirmation checkbox is required.
- [ ] Simulation disclosure is visible and non-official.
- [ ] Public-photo processing completes before `LIVE`.
- [ ] Partial public-photo failure does not expose listing or partial assets.
- [ ] Publication failure is recoverable.
- [ ] Live success copy is exactly `Your listing is live`.
- [ ] No government, legal, DLD, official permit, or official approval claim appears.

## Live management

- [ ] Live management shows cover, price, status, published date, updated date, and public link.
- [ ] Aggregate saved count is owner-only if included.
- [ ] View Live Listing works.
- [ ] Copy Listing Link works.
- [ ] Minor edits remain live only for the approved list.
- [ ] Material edits require pause and republish.
- [ ] Pause confirmation explains public removal and retained data.
- [ ] `LIVE → PAUSED → LIVE` works when readiness remains valid.
- [ ] Paused listing does not appear in marketplace or normal public pages.
- [ ] Saved relationships survive pause.

## Marketplace

- [ ] Anonymous visitors can browse `LIVE` listings.
- [ ] Marketplace title, search, filters, sort, count, grid, and pagination are implemented.
- [ ] Page-based pagination is used; no infinite scroll.
- [ ] Search uses only approved public fields.
- [ ] Search suggestions exclude private fields.
- [ ] Filters include the approved focused set.
- [ ] Invalid price and size ranges are blocked with exact copy.
- [ ] Default sort is Newest.
- [ ] Property cards support default, focus, hover, saved, owner, image-failure, and skeleton states.
- [ ] Card does not expose unit, owner, verification internals, or private occupancy.
- [ ] Marketplace loading, empty, error, and retry states exist.

## Property details and gallery

- [ ] Public detail route uses opaque public ID plus slug.
- [ ] Only `LIVE` listings resolve publicly.
- [ ] Public page includes gallery, price, headline, location, facts, description, amenities, details, actions, and source note.
- [ ] Public page excludes private fields.
- [ ] No disabled or coming-soon Offer control appears in Week 3.
- [ ] Desktop gallery and mobile gallery match specification.
- [ ] Full-screen gallery supports keyboard, focus trap, swipe, close, and focus restoration.
- [ ] Partial image failure is graceful.
- [ ] Reduced motion is respected.
- [ ] Image alternative text is safe and not fabricated.

## Investment Case

- [ ] Investment Case renders only when visibility is enabled.
- [ ] Public panel excludes original purchase price, purchase date, renovation spend, total invested, and private inputs.
- [ ] Public metrics use approved labels and rounding.
- [ ] Required estimate/financial-advice disclosure is always visible.
- [ ] Panel does not resemble a trading product.

## Save and Saved Properties

- [ ] Authenticated customer can save another customer’s live listing.
- [ ] Owner sees `Your listing` instead of Save.
- [ ] Save and remove are idempotent.
- [ ] Save state is keyboard and screen-reader accessible.
- [ ] Anonymous Save opens sign-in/create interception.
- [ ] Safe intent returns to the same property and completes Save once.
- [ ] Saved Properties requires authentication.
- [ ] Empty, populated, loading, partial-failure, and generic-failure states exist.
- [ ] Unavailable saved card reveals no stale property details.
- [ ] Unavailable save can be removed.

## Privacy and security

- [ ] Public queries filter to `LIVE` server-side.
- [ ] Public response uses an allowlisted projection.
- [ ] Ownership documents never enter public storage or response.
- [ ] Draft photographs remain private.
- [ ] Public assets use opaque non-sensitive paths.
- [ ] Seller email, phone, legal name, private unit data, verification records, Admin notes, and audit events are absent publicly.
- [ ] Non-owner private routes use safe anti-enumeration response.
- [ ] Save intent uses allowlisted relative routes and expires.
- [ ] No raw SQL, storage, signed URL, stack trace, internal path, or private ID appears.

## Responsive, Arabic, and accessibility

- [ ] Desktop, tablet, and mobile layouts match specified widths and grids.
- [ ] Mobile filter sheet has focus trap, safe area, staged state, and sticky actions.
- [ ] Mobile detail has swipe gallery and sticky actions.
- [ ] English copy catalogue is complete.
- [ ] Arabic draft copy exists and is flagged for review.
- [ ] RTL mirrors the approved elements.
- [ ] AED, percentages, IDs, and mixed English names display coherently.
- [ ] WCAG 2.2 AA contrast is met.
- [ ] Heading and landmark structure is valid.
- [ ] Search combobox is accessible.
- [ ] Filter labels and errors are associated.
- [ ] Results updates are announced.
- [ ] Property cards have valid focus behaviour and no nested interactive conflict.
- [ ] Gallery is fully keyboard accessible.
- [ ] Save updates are announced.
- [ ] Dialogs/sheets trap and restore focus.
- [ ] Touch targets are at least 44 × 44 px.
- [ ] Reduced motion is respected.
- [ ] 200% zoom and 320 px mobile width are supported.

## Handoff and mockups

- [ ] All required routes and state transitions are documented.
- [ ] Reusable components are defined.
- [ ] Validation messages are implemented exactly or through reviewed translations.
- [ ] Handoff tables are reflected in implementation tasks.
- [ ] P0 high-fidelity mockups are approved before associated engineering begins.
- [ ] Arabic RTL frames are reviewed before release.
- [ ] Offers, transactions, full Admin moderation, and real regulatory integrations remain out of scope.

---

## Appendix A — Visual Foundation Reference

Use the approved MARKAZ visual system:

- **Direction:** Architectural Blue — Quiet Editorial Intelligence
- **Primary blue:** `#1F4E73`
- **Deep blue:** `#0F2A44`
- **Pale blue:** `#EAF2F7`
- **Canvas:** `#F6F8FB`
- **Surface:** `#FFFFFF`
- **Text:** `#142332`
- **Borders:** `#D9E3EA`
- **Display:** Source Serif 4 for selected public headings
- **Interface:** Manrope
- **Card radius:** 10–12 px
- **Large image radius:** 12–16 px
- **Spacing:** 8-point system
- **Shadows:** minimal, used for overlays and elevated controls only
- **Logo:** M + architectural home/arch symbol replacing A + RKAZ

The marketplace should be warmer and more image-led than the customer workspace while remaining recognisably the same product.

## Appendix B — Week 3 Product Boundary

The milestone ends with:

- A seller-owned listing published to `LIVE`
- Live-listing management and reversible `PAUSED` state
- Anonymous public browsing and detail pages
- Authenticated Save and Saved Properties

It does not include any user-facing action that starts negotiation or transaction. Week 4 may add Make Offer to the action region without restructuring the public property page.
