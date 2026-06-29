# MARKAZ Home — Property Listing Journey Design Specification

**File:** `MARKAZ-PROPERTY-LISTING-DESIGN-SPEC.md`  
**Status:** Implementation-ready design specification  
**Milestone:** Week 2 — Property Listing Creation  
**Product:** MARKAZ Home  
**Application:** Customer Web  
**Account type:** `CUSTOMER`  
**Primary languages:** English and Arabic  
**Accessibility target:** WCAG 2.2 AA  
**Last updated:** June 2026

---

## Milestone Understanding

This milestone builds the complete customer property-listing creation journey on top of the stable Week 1 and Week 1.5 foundations. It begins inside the existing unified customer experience and ends when the listing has completed all required information, private-document, simulated verification, simulated legal, photograph, and simulated permit steps and is ready for a future publication action.

The journey must support draft creation, autosave, safe resumption, direct links, refresh, sign-out and sign-in recovery, simulation failures and retries, English and Arabic, responsive layouts, and strict customer ownership boundaries.

The milestone ends at:

```text
READY_TO_PUBLISH
```

It does **not** publish a listing, display it in the public marketplace, accept offers, or create transactions.

The listing journey is part of the same unified `CUSTOMER` account already used to browse property. It must never ask the customer to become a Seller, create a second account, or select a Buyer/Seller role.

---

# 1. Executive Summary

The MARKAZ listing journey should feel like a guided property setup workspace rather than a long portal form. It should communicate three things continuously:

1. **Where the customer is** in the listing process
2. **What is required next**
3. **Whether their work has been saved**

The recommended experience uses a persistent desktop step rail, a compact mobile progress indicator, a focused form canvas, and a sticky action area. Each screen has one dominant task and one clear next action. Required and optional information are visibly distinguished. Simulated government and legal steps look credible but never official.

The visual language follows the approved MARKAZ **Architectural Blue — Quiet Editorial Intelligence** foundation:

- Cool off-white page canvas
- White form surfaces
- Deep architectural blue navigation and headings
- Clear blue primary actions
- Pale-blue information and simulation panels
- Manrope for functional UI
- Source Serif 4 used sparingly for major editorial headings
- Restrained borders and shadows
- Generous spacing
- No glassmorphism, neon, gold luxury styling, or generic SaaS progress graphics

## 1.1 Source precedence

Use the following precedence when implementation details appear to conflict:

1. This Week 2 listing design specification governs the customer-facing flow, visual design, copy, validation, and interaction behaviour.
2. The final technical architecture governs state ownership, RLS, database authority, private/public storage, service boundaries, audit events, and valid listing transitions.
3. The final corrected Week 1.5 report governs authentication, onboarding completion, session handling, and protected customer access.
4. The approved design foundation governs brand, colour, typography, spacing, logo, responsive behaviour, and shared visual patterns.
5. The original workshop stories provide product intent but are narrowed by the approved prototype scope.

## 1.2 Required state-machine interpretation

The canonical listing states remain:

```text
DRAFT
DETAILS_COMPLETE
DOCUMENT_UPLOADED
OWNERSHIP_REVIEW
OWNERSHIP_VERIFIED
FORM_A_COMPLETE
PHOTOS_COMPLETE
PERMIT_PENDING
READY_TO_PUBLISH
```

The wizard contains more visual steps than the state enum. Listing Settings, Investment Case, and Review are saved sub-states and completion requirements rather than new listing enum values.

Two implementation clarifications are required for a retryable prototype:

- A failed simulated ownership check updates the verification record to `FAILED`; it does not permanently move the listing to the later-stage `REJECTED` state. The listing remains recoverable and the customer may replace the document and retry.
- A failed simulated Trakheesi attempt updates the permit record to `FAILED`; it does not permanently move the listing to `REJECTED`. The customer may review information and retry.

`REJECTED` remains reserved for a future Admin decision outside this milestone.

A permit record may become `APPROVED` before the final customer review. The listing moves to `READY_TO_PUBLISH` only after all required sections are complete and the customer confirms listing readiness on the Review screen. This preserves the required journey:

```text
Simulated Trakheesi approved → Review → READY_TO_PUBLISH
```

---

# 2. Scope

## 2.1 Included

- My Listings entry and empty state
- My Listings draft and progress cards
- Starting a new listing
- Multiple listing drafts
- Resume draft
- Draft deletion
- Autosave
- Save and Exit
- Property Details
- Private ownership-document selection and upload
- Simulated ownership verification
- Listing price and minimum offer-notification threshold
- Optional Investment Case
- Simulated Form A
- Property photograph upload and organisation
- Simulated Trakheesi
- Final Review
- Listing Preview from private draft data
- `READY_TO_PUBLISH` completion
- English and Arabic
- RTL behaviour
- Desktop, tablet, and mobile
- Loading, success, failure, retry, session, access, and not-found states
- Reusable listing components
- Non-sensitive audit-event guidance

## 2.2 Excluded

- Publication to `LIVE`
- Public marketplace results
- Public property-detail page
- Saving properties
- Buyer offers
- Seller offer management
- Counter-offers
- Transactions
- Real legal agreements
- Real ownership verification
- Real Trakheesi submission
- Real Madmoun QR
- Real government records
- Premium Managed Service
- Agent assignment
- Professional photography booking
- Property tours or viewing scheduling
- Rental listings
- Multiple legal owners
- Company-owned property
- Power-of-attorney flows
- Mortgage and finance applications
- Full Admin listing management

Excluded features must not appear as active or disabled upsells in the listing journey.

---

# 3. Product and Account Rules

1. A listing is created by an authenticated, onboarding-complete `CUSTOMER`.
2. Every customer can browse and list property from the same account.
3. Buyer and Seller are activities, not roles.
4. There is no Seller onboarding or second account.
5. The customer may access only listings they own. Client-side hiding is not a security boundary; RLS and server authorisation remain mandatory.
6. A listing begins as `DRAFT` as soon as the customer confirms creation.
7. Multiple drafts are allowed because a customer may own multiple properties.
8. When a customer starts a new listing while a recently edited, nearly empty draft exists, show a resume choice to prevent accidental duplicates. Do not block creation of another listing.
9. Every saved draft remains private.
10. Ownership documents remain private to the owning customer and authorised Admin users.
11. Listing photographs are stored in the listing-photo bucket and may become public only in a later publication milestone.
12. Private ownership files must never appear in Listing Preview.
13. Only fictional sample ownership documents may be uploaded in this prototype.
14. Listing setup does not make a listing live.
15. `READY_TO_PUBLISH` means setup is complete, not published.
16. The customer can revisit completed wizard steps before publication.
17. Required steps cannot be skipped.
18. Investment Case is optional and may be skipped or added later.
19. Simulation outcomes persist across refresh and sign-in.
20. All displayed market comparisons are demo data and must be labelled accordingly.

---

# 4. Listing State Model

## 4.1 Canonical state transitions

| Current state | Trigger | Next state | Customer-visible meaning |
|---|---|---|---|
| None | Create listing | `DRAFT` | Listing draft created |
| `DRAFT` | Required property details saved and valid | `DETAILS_COMPLETE` | Property information complete |
| `DETAILS_COMPLETE` | Active ownership document uploaded | `DOCUMENT_UPLOADED` | Private document received |
| `DOCUMENT_UPLOADED` | Simulated check started | `OWNERSHIP_REVIEW` | Ownership check in progress |
| `OWNERSHIP_REVIEW` | Verification record becomes verified | `OWNERSHIP_VERIFIED` | Ownership verification simulated |
| `OWNERSHIP_REVIEW` | Verification record fails | Remains recoverable | Replace document or retry |
| `OWNERSHIP_VERIFIED` | Settings complete and simulated Form A completed | `FORM_A_COMPLETE` | Simulated Form A complete |
| `FORM_A_COMPLETE` | At least one valid photo and cover selected | `PHOTOS_COMPLETE` | Photo requirement complete |
| `PHOTOS_COMPLETE` | Simulated permit submitted | `PERMIT_PENDING` | Demo permit application pending |
| `PERMIT_PENDING` | Permit approved | Remains pending review until final confirmation | Demo permit approved; review required |
| `PERMIT_PENDING` | Permit failed | Remains recoverable | Review and retry |
| `PERMIT_PENDING` | Permit approved + all requirements complete + customer confirms review | `READY_TO_PUBLISH` | Setup complete; not live |

## 4.2 Derived section statuses

Each wizard section also has a derived UI status:

```text
NOT_STARTED
IN_PROGRESS
COMPLETE
OPTIONAL_SKIPPED
PENDING
FAILED
REQUIRES_ATTENTION
```

These statuses drive the stepper and Review screen but do not replace the canonical database state.

## 4.3 State labels shown to customers

Do not show raw enum names in normal customer UI.

| Domain value | Customer label |
|---|---|
| `DRAFT` | Draft started |
| `DETAILS_COMPLETE` | Property details complete |
| `DOCUMENT_UPLOADED` | Document uploaded |
| `OWNERSHIP_REVIEW` | Ownership check in progress |
| `OWNERSHIP_VERIFIED` | Ownership verification simulated |
| `FORM_A_COMPLETE` | Simulated Form A complete |
| `PHOTOS_COMPLETE` | Photos complete |
| `PERMIT_PENDING` | Demo permit in progress / Review required after approval |
| `READY_TO_PUBLISH` | Ready to publish |

---

# 5. Design Principles

## 5.1 One clear task per step

Each wizard page should ask the customer to complete one coherent group of information. Avoid a single extremely long form.

## 5.2 Always show save status

Customers must never wonder whether their work is safe. The autosave indicator is persistent in the wizard header.

## 5.3 Explain why information is needed

Private, financial, and simulated steps require plain-language explanations before input or action.

## 5.4 Required versus optional is explicit

- Required fields use `Required` in accessible helper text where ambiguity exists.
- Optional sections use a visible `Optional` label.
- Do not mark every required label with an asterisk without explanation.

## 5.5 Simulations are believable, not official

Use the approved labels exactly. Simulation disclosures stay visible on every simulated screen but use calm pale-blue styling rather than warning-red styling.

## 5.6 Property context persists

After Property Details are complete, the wizard header shows a compact property identity:

> Marina Gate 2 · Apartment · Dubai Marina

Before this information exists, show:

> New property listing

## 5.7 Errors enable recovery

Every failure tells the customer:

- What did not complete
- Whether their data remains saved
- What they can do next

## 5.8 Review before commitment

The customer reviews all required sections before the system records `READY_TO_PUBLISH`.

---

# 6. Listing Information Architecture

```text
My Listings
│
├── Empty State
├── Draft Listing Cards
├── Ready-to-Publish Cards
└── Create New Listing
    │
    └── Listing Wizard
        ├── 1. Property Details
        ├── 2. Ownership Document
        ├── 3. Ownership Check
        ├── 4. Listing Settings
        ├── 5. Investment Case · Optional
        ├── 6. Simulated Form A
        ├── 7. Property Photos
        ├── 8. Simulated Trakheesi
        └── 9. Review
             └── Ready to Publish
```

## 6.1 Recommended routes

Use explicit step routes because they provide reliable refresh, deep-link, browser-history, testing, and recovery behaviour.

```text
/[locale]/sell
/[locale]/sell/new
/[locale]/sell/listings/[listingId]
/[locale]/sell/listings/[listingId]/details
/[locale]/sell/listings/[listingId]/ownership
/[locale]/sell/listings/[listingId]/verification
/[locale]/sell/listings/[listingId]/settings
/[locale]/sell/listings/[listingId]/investment-case
/[locale]/sell/listings/[listingId]/form-a
/[locale]/sell/listings/[listingId]/photos
/[locale]/sell/listings/[listingId]/trakheesi
/[locale]/sell/listings/[listingId]/review
/[locale]/sell/listings/[listingId]/ready
/[locale]/sell/listings/[listingId]/preview
```

### Route behaviour

- `/sell` is My Listings.
- `/sell/new` performs a preflight check for a recent empty draft and then creates or resumes a listing.
- `/sell/listings/[listingId]` resolves the authoritative listing state and redirects to the recommended next step.
- Every step route verifies customer ownership server-side.
- A direct route to a future locked step redirects to the earliest unmet required step with an explanatory notice.
- Completed earlier steps remain directly accessible.
- Preview is private and requires ownership.

---

# 7. End-to-End Flow Diagram

```text
Dashboard or My Listings
        ↓
List Your Property / Create New Listing
        ↓
Recent empty draft exists?
   ├── Yes → Resume existing / Create another
   └── No  → Create DRAFT
        ↓
Property Details
        ↓ DETAILS_COMPLETE
Ownership Document
        ↓ DOCUMENT_UPLOADED
Start Simulated Ownership Check
        ↓ OWNERSHIP_REVIEW
   ├── Failed → Replace / Retry
   └── Verified → OWNERSHIP_VERIFIED
        ↓
Listing and Offer Settings
        ↓
Investment Case
   ├── Add and save
   └── Skip for now
        ↓
Simulated Form A
   ├── Failed → Retry
   └── Complete → FORM_A_COMPLETE
        ↓
Property Photos
   ├── Upload
   ├── Reorder
   └── Select cover → PHOTOS_COMPLETE
        ↓
Simulated Trakheesi
   ├── Failed → Review / Retry
   └── Demo permit approved
        ↓
Final Review
   ├── Missing item → Edit section
   └── Confirm readiness
        ↓
READY_TO_PUBLISH
        ↓
Preview or Return to My Listings
```

---

# 8. Entry Points and Resumption

## 8.1 Dashboard — List Your Property

Selecting `List Your Property` routes to `/sell/new`.

- No draft: create a new listing and open Property Details.
- Recent empty draft: show Resume Listing prompt.
- Existing progressed drafts do not block new-listing creation; they remain visible in My Listings.

## 8.2 My Listings — Create New Listing

Primary action:

> Create new listing

Use the same `/sell/new` preflight behaviour.

## 8.3 Existing incomplete draft

Card primary action:

> Continue listing

Card also shows the exact next task:

> Next: Upload a fictional sample ownership document

## 8.4 Direct link

When the customer owns the listing:

- Load the requested completed/current step.
- If the step is locked, redirect to the earliest unmet requirement.
- Show: `Complete the previous step before continuing.`

When the customer does not own the listing, do not reveal whether it exists. Show the generic Not Available state defined later.

## 8.5 Return after sign-out

- Sign-in uses a safe relative return route.
- After authentication and onboarding checks, return to the requested listing step only if the customer owns the listing.
- Otherwise route to My Listings.

## 8.6 Return after failed simulation

Route to the failure state for the relevant step and show persisted status and recovery action.

## 8.7 Browser refresh

- Fetch the database state.
- Rehydrate fields from saved server data.
- Restore no sensitive local file bytes.
- If an upload was interrupted before completion, show the file as not uploaded and request reselection.
- Never infer completion from client state alone.

---

# 9. Screen Inventory

| ID | Screen / state | Route |
|---|---|---|
| L-01 | My Listings empty | `/sell` |
| L-02 | My Listings with drafts | `/sell` |
| L-03 | Resume Listing prompt | `/sell/new` dialog/state |
| L-04 | Property Details | `/details` |
| L-05 | Ownership Document selection and upload | `/ownership` |
| L-06 | Ownership Check introduction | `/verification` |
| L-07 | Ownership Check pending | `/verification` |
| L-08 | Ownership Check success | `/verification` |
| L-09 | Ownership Check failure / mismatch | `/verification` |
| L-10 | Listing and Offer Settings | `/settings` |
| L-11 | Investment Case introduction / skipped | `/investment-case` |
| L-12 | Investment Case form and preview | `/investment-case` |
| L-13 | Simulated Form A review | `/form-a` |
| L-14 | Simulated Form A pending | `/form-a` |
| L-15 | Simulated Form A success | `/form-a` |
| L-16 | Simulated Form A failure | `/form-a` |
| L-17 | Property Photos empty / upload | `/photos` |
| L-18 | Property Photos grid / organisation | `/photos` |
| L-19 | Simulated Trakheesi introduction | `/trakheesi` |
| L-20 | Simulated Trakheesi pending | `/trakheesi` |
| L-21 | Demo permit approved | `/trakheesi` |
| L-22 | Simulated Trakheesi failed | `/trakheesi` |
| L-23 | Final Review complete | `/review` |
| L-24 | Final Review missing requirements | `/review` |
| L-25 | Ready to Publish | `/ready` |
| L-26 | Private Listing Preview | `/preview` |
| L-27 | Loading existing draft | Any listing route |
| L-28 | Session expired | Any listing route → Sign In |
| L-29 | Listing unavailable | Any listing route |
| L-30 | Network / save failure | Inline/persistent state |

---

# 10. Wizard Shell and Navigation

## 10.1 Desktop layout

Maximum page width: **1360 px**.

```text
┌────────────────────────────────────────────────────────────────────────────┐
│ Customer Header: Logo · Dashboard · Browse · My Listings · Offers · ...   │
├────────────────────────────────────────────────────────────────────────────┤
│ New property listing                    Saving… / Saved just now            │
│ Dubai Marina · Apartment                Save and exit                       │
├───────────────────┬───────────────────────────────────────┬────────────────┤
│ Step navigation   │ Main step content                     │ Optional help  │
│ 240 px            │ 680–760 px                            │ 240–280 px     │
│                   │                                       │                │
│ 1 Details         │ Step title                            │ Why we ask     │
│ 2 Document        │ Description                           │ / summary      │
│ 3 Verification    │                                       │                │
│ 4 Settings        │ Form                                  │                │
│ 5 Investment opt. │                                       │                │
│ 6 Form A demo     │                                       │                │
│ 7 Photos          │                                       │                │
│ 8 Trakheesi demo  │                                       │                │
│ 9 Review          │                                       │                │
├───────────────────┴───────────────────────────────────────┴────────────────┤
│                 Back                     Save and continue                 │
└────────────────────────────────────────────────────────────────────────────┘
```

- Main horizontal padding: 32–40 px.
- Wizard body gap: 32 px.
- Step rail remains sticky below the customer header.
- Main form content should not exceed 760 px.
- Optional help rail appears only where useful and hides below 1200 px.
- Sticky footer action bar appears at the bottom of the viewport when the form is longer than one viewport.

## 10.2 Tablet

- Hide the help rail.
- Step navigation becomes a horizontal scrollable summary or compact dropdown above content.
- Form max width: 720 px.
- Page padding: 32 px.
- Sticky bottom action bar remains.

## 10.3 Mobile

```text
MARKAZ HOME                         Account

Step 2 of 9 · Ownership document
━━━━━━━━━━━━━━────────────

Ownership document
Upload a fictional sample document...

[ step content ]

┌──────────────────────────────────┐
│ Back           Save and continue │
└──────────────────────────────────┘
```

- Header uses compact logo and account action.
- Customer bottom navigation is hidden inside the wizard to avoid conflict with wizard actions.
- Progress uses `Step X of 9` and a thin line.
- Page padding: 20–24 px.
- Sticky bottom action bar respects device safe-area inset.
- Primary action is full-width when it is the only action.
- When Back and Continue coexist, Continue receives approximately two-thirds width.

## 10.4 Step states

| Visual state | Treatment |
|---|---|
| Current | Deep-blue label, pale-blue background, current-step marker |
| Complete | Check icon, standard text, clickable |
| Optional skipped | `Skipped` text, neutral icon, clickable |
| Future available | Standard text, clickable only when prerequisites allow |
| Locked | Muted text, lock icon, non-clickable |
| Pending | Spinner/status icon and `In progress` |
| Failed | Attention icon and `Action required`; no aggressive red rail |

## 10.5 Navigation rules

- Back saves valid dirty fields before navigation.
- Continue validates current required content and performs a blocking save.
- Save and Exit saves valid current data and returns to My Listings.
- Completed steps may be revisited.
- Optional Investment Case may be skipped.
- Required future steps cannot be selected before prerequisites.
- Review may be opened only after the permit is approved and all earlier required sections can be evaluated.
- Browser Back behaves like wizard Back for completed/current routes; state is fetched after navigation.


---

# 11. My Listings Specification

## 11.1 My Listings empty state

### Objective

Help a customer begin their first property listing without implying that they need a separate Seller account.

### Layout

- Standard authenticated customer header
- Page max width: 1280 px
- Header row: title and primary action
- Empty state sits inside a wide, low-emphasis surface rather than a small centred card
- Optional architectural line illustration or high-quality property crop may appear at the logical end on desktop

### Copy

**Page title:**

> My listings

**Description:**

> Create and manage the properties you want to list on MARKAZ.

**Empty-state title:**

> List your first property

**Body:**

> Add the property details, complete the demo verification steps, upload photographs, and prepare your listing for publication.

**Primary action:**

> Create new listing

**Supporting note:**

> You can save your progress and return at any time.

### Mobile

- Illustration removed or placed below copy
- Primary action full width
- Empty state uses no fixed height

## 11.2 My Listings with incomplete drafts

### Information hierarchy

1. Listing title or fallback `Untitled property`
2. Community/building, if available
3. Status: `Draft`
4. Progress: completed sections out of required sections
5. Next required action
6. Last saved time
7. Primary action
8. Overflow actions

### Draft card example

> **Marina Gate 2, Unit 2205**  
> Apartment · Dubai Marina  
> **5 of 8 required sections complete**  
> Next: Add property photographs  
> Saved 12 minutes ago

Actions:

- `Continue listing`
- Overflow: `Preview draft`, `Delete draft`

### Progress calculation

The progress bar is based on eight required completion groups:

1. Property Details
2. Ownership Document
3. Ownership Verification
4. Listing Settings
5. Simulated Form A
6. Property Photos
7. Simulated Trakheesi
8. Final Review

Investment Case does not affect percentage because it is optional. If included, show a separate `Investment Case added` line.

### Deleting a draft

Dialog title:

> Delete this listing draft?

Body:

> This will permanently remove the draft, its fictional ownership document, uploaded photographs, and saved listing information. This action cannot be undone.

Buttons:

- `Keep draft`
- `Delete draft`

Deletion is available for any pre-publication draft in this milestone. The server must verify ownership and remove associated private/public storage objects through authorised server operations.

## 11.3 Resume Listing prompt

Show only when `/sell/new` finds a recently edited draft that has no completed Property Details or is less than 24 hours old and remains at the initial step.

**Title:**

> Continue your recent listing?

**Body:**

> You already started a property listing. Continue where you left off or create another draft.

Actions:

- Primary: `Continue recent listing`
- Secondary: `Create another listing`
- Link: `View all listings`

Do not show this prompt every time when existing drafts contain meaningful progress; My Listings already makes them visible.

---

# 12. Property Details Specification

## 12.1 Objective

Collect the minimum information needed to identify and describe one residential property, support later verification, calculate price per square foot, and prepare a future public listing.

## 12.2 Page copy

**Step:**

> Step 1 of 9 · Property details

**Title:**

> Tell us about the property

**Description:**

> Start with the essential information buyers will use to understand the property. You can return and update these details before publication.

## 12.3 Field hierarchy

### Section A — Property type and location

| Field | Required | Visibility | Notes |
|---|---:|---|---|
| Property type | Yes | Public later | Apartment, Villa, Townhouse, Penthouse |
| Emirate | Yes | Public later | Dubai only in this prototype |
| Area or community | Yes | Public later | Searchable combobox using seeded options plus free-text fallback |
| Building or project | Conditional | Public later | Required for Apartment/Penthouse; optional for Villa/Townhouse |
| Unit or property identifier | Yes | Private | Unit number, villa number, or internal property reference; never shown publicly |

### Section B — Property facts

| Field | Required | Visibility | Options / rule |
|---|---:|---|---|
| Bedrooms | Yes | Public later | Studio or 1–10; Studio stored as 0 |
| Bathrooms | Yes | Public later | 1–10 whole numbers |
| Property size | Yes | Public later | Square feet; 200–50,000 |
| Furnishing status | Yes | Public later | Unfurnished, Partly furnished, Furnished |
| Occupancy status | Yes | Private by default | Vacant, Owner occupied, Tenant occupied |
| Completion status | Yes | Public later | Ready, Off-plan |
| Parking spaces | Optional | Public later | 0–10 |

### Section C — Description and amenities

| Field | Required | Visibility | Rule |
|---|---:|---|---|
| Property description | Yes | Public later | 80–2,000 characters |
| Features and amenities | Optional | Public later | Curated multi-select, max 15 |

## 12.4 Dubai-only decision

The Trakheesi simulation is Dubai-specific. To avoid presenting an incorrect regulatory journey, this milestone supports Dubai residential property only.

**Emirate field:** read-only or single-option select showing:

> Dubai

Helper:

> This prototype currently supports residential property listings in Dubai.

Do not show disabled UAE emirates as if support is imminent.

## 12.5 Exact field copy

### Property type

Label:

> Property type

Options:

- Apartment
- Villa
- Townhouse
- Penthouse

Use four selectable tiles with simple line icons. One selection only.

### Area or community

Label:

> Area or community

Placeholder:

> Search for an area, such as Dubai Marina

Helper:

> Choose the community buyers are most likely to recognise.

### Building or project

Label:

> Building or project

Placeholder:

> Enter the building or project name

Conditional helper for villa/townhouse:

> Optional if the property is identified by its community and villa number.

### Unit or property identifier

Label:

> Unit or property identifier

Placeholder:

> For example, Unit 2205 or Villa 27

Private helper:

> Kept private. This helps connect your fictional sample document to the listing.

### Bedrooms

Label:

> Bedrooms

Options use a segmented/select control:

> Studio, 1, 2, 3, 4, 5, 6+

If `6+` is selected, reveal a numeric field up to 10.

### Bathrooms

Label:

> Bathrooms

Options:

> 1, 2, 3, 4, 5, 6+

### Property size

Label:

> Property size

Suffix:

> sq ft

Placeholder:

> 1,250

Helper:

> Enter the internal property area shown in your fictional sample document.

### Furnishing status

Label:

> Furnishing status

Options:

- Unfurnished
- Partly furnished
- Furnished

### Occupancy status

Label:

> Occupancy status

Options:

- Vacant
- Owner occupied
- Tenant occupied

Helper:

> This information is kept private during this prototype milestone.

Do not request tenant details.

### Completion status

Label:

> Completion status

Options:

- Ready
- Off-plan

Selection informs the recommended ownership-document type but does not automatically change it.

### Parking spaces

Label:

> Parking spaces

Placeholder:

> 1

### Description

Label:

> Property description

Placeholder:

> Describe the layout, condition, views, natural light, recent improvements, and what makes the property distinctive.

Character counter:

> {count} / 2,000

Helper:

> Use clear factual language. Do not include phone numbers, email addresses, or unsupported claims.

### Amenities

Label:

> Features and amenities

Suggested options:

- Balcony
- Private garden
- Private pool
- Shared pool
- Gym
- Concierge
- Security
- Covered parking
- Built-in wardrobes
- Walk-in wardrobe
- Study
- Maid’s room
- Storage room
- Sea view
- Marina view
- City view
- Community view
- Near public transport
- Pet friendly building

Do not include unsupported or legal claims such as “guaranteed view”.

## 12.6 Form layout

Desktop:

- Property type tiles: four-column row
- Location fields: two-column where logical
- Facts: two-column grid
- Description: full width
- Amenities: full width searchable checkbox popover or grouped selector
- Form max width: 760 px

Mobile:

- Property type tiles: two columns
- All other fields stack
- Numeric inputs use numeric keyboard
- Amenities open a full-screen sheet with search and selected count

## 12.7 Continue behaviour

Primary action:

> Save and continue

Loading:

> Saving property details…

On success:

- Save property and listing fields
- Transition to `DETAILS_COMPLETE`
- Route to Ownership Document
- Announce: `Property details saved.`

---

# 13. Ownership Document Specification

## 13.1 Objective

Collect one fictional sample Title Deed or Oqood file in the private ownership-document bucket for a simulated ownership check.

## 13.2 Page copy

**Step:**

> Step 2 of 9 · Ownership document

**Title:**

> Add a fictional ownership document

**Description:**

> Choose the document type and upload one fictional sample file for the simulated ownership check.

## 13.3 Mandatory safety notice

Use a prominent pale-amber or pale-blue privacy panel before the uploader.

> **Use a fictional sample document only**
>
> For this prototype, use a fictional sample document only.
>
> Do not upload a real Title Deed, Oqood, Emirates ID, passport, or other sensitive document.

This wording must not be collapsed or hidden behind a tooltip.

## 13.4 Document type selector

Two selectable tiles:

### Title Deed

> For a completed property with a fictional title document.

### Oqood

> For an off-plan property with a fictional registration document.

Do not auto-select based on Completion Status. Offer a recommendation:

> Based on your completion status, Title Deed may be the appropriate sample document.

or:

> Based on your completion status, Oqood may be the appropriate sample document.

The customer remains in control.

## 13.5 Private-document explanation

> **Private document**
>
> This file is visible only to you and authorised MARKAZ Operations users. It will not appear on the public listing or listing preview. The check is simulated and does not connect to official property or government records.

## 13.6 Upload rules

- Exactly one active ownership document per listing
- Formats: PDF, JPG/JPEG, PNG
- Maximum size: 10 MB
- Suggested PDF page count: up to 10 pages; do not block by page count unless safely detected
- File name displayed after upload
- Never show a public storage URL
- Do not extract or display real document data
- No OCR is required in this milestone
- Replace creates a new active file and removes the previous object after successful replacement
- Remove deletes the active file and returns the listing to the document-required state

## 13.7 Upload area

Desktop copy:

> Drag a fictional sample file here, or **choose a file**
>
> PDF, JPG or PNG · Maximum 10 MB

Mobile copy:

> Choose a fictional sample file
>
> Select a PDF or image from your device. Maximum 10 MB.

Mobile file picker should accept files and image library. Do not open the camera by default for private documents.

## 13.8 Upload progress

File row anatomy:

- File-type icon
- File name
- Human-readable size
- Progress bar
- Progress text
- Cancel while upload is active, if supported safely

Copy:

> Uploading… {percent}%

After upload:

> Uploaded privately

Actions:

- `Replace file`
- `Remove file`

## 13.9 Replace behaviour

1. Customer selects Replace.
2. New file is validated locally.
3. New upload completes.
4. Server atomically marks the new object active.
5. Previous object is deleted.
6. Existing verification is invalidated and must be rerun.

Confirmation before replacing a verified document:

> **Replace the verified sample document?**
>
> Replacing this file will reset the simulated ownership result. You will need to run the check again.

Actions:

- `Keep current file`
- `Replace and reset verification`

## 13.10 Remove behaviour

Dialog:

> **Remove this document?**
>
> The listing cannot continue without an ownership document. Any simulated verification result will also be reset.

Actions:

- `Keep document`
- `Remove document`

## 13.11 Errors

Unsupported:

> This file type is not supported. Upload a PDF, JPG, or PNG file.

Too large:

> This file is larger than 10 MB. Choose a smaller file.

Upload failure:

> We could not upload this file. Your listing draft is still saved. Try again.

Connection interrupted:

> The upload was interrupted. Choose the file again when your connection is restored.

## 13.12 Continue

Primary action after active upload:

> Save and continue

On success:

- State becomes `DOCUMENT_UPLOADED`
- Route to Ownership Check

---

# 14. Simulated Ownership Verification Specification

## 14.1 Required disclosure

Show on every state:

> **Ownership verification simulated**
>
> This prototype does not connect to official property or government records.

## 14.2 Introduction — `NOT_STARTED`

**Step:**

> Step 3 of 9 · Ownership check

**Title:**

> Run the simulated ownership check

**Description:**

> We will compare the fictional sample document with the private property information in this listing.

Summary panel:

- Document type
- File name
- Property identifier, partially masked if needed
- Community/building

**Primary action:**

> Start simulated check

**Secondary action:**

> Replace document

Helper:

> You can safely leave after starting. The result will remain available when you return.

## 14.3 Pending — `PENDING`

**Title:**

> Ownership check in progress

**Description:**

> The simulated check is reviewing the fictional document and listing details. You can leave this page and return later.

Status:

> In progress · Demo

Use a restrained progress sequence rather than a fake percentage:

- Document received — Complete
- Listing details compared — In progress
- Demo result recorded — Not started

Actions:

- Primary: `Return to My Listings`
- Secondary: `Refresh status`

Do not promise a real duration. If the demo worker is configured to resolve after a known short delay, copy may say:

> Demo checks usually complete within a minute.

only if true in the implementation.

## 14.4 Success — `VERIFIED`

**Title:**

> Ownership verification simulated

**Description:**

> The fictional document and listing details matched for this demo.

Status:

> Verified · Demo

Summary:

- Document type
- Property identifier match
- Community/building match
- Completed time

**Primary action:**

> Continue to listing settings

**Secondary action:**

> View document details

The secondary action shows metadata only, never a public URL.

## 14.5 Failure — `FAILED`

Use one of two customer-facing reasons where supported:

### Document mismatch

**Title:**

> The demo details did not match

**Description:**

> The property identifier or location in the fictional document did not match the listing information.

Actions:

- Primary: `Review property details`
- Secondary: `Replace document`
- Link: `Try the check again`

### Incomplete or unreadable sample

**Title:**

> The fictional sample could not be reviewed

**Description:**

> Choose a clearer fictional sample file or confirm that the document type is correct.

Actions:

- Primary: `Replace document`
- Secondary: `Try again`

### Generic failure

> We could not complete the simulated ownership check. Your listing and document remain saved.

Actions:

- `Try again`
- `Return to My Listings`

## 14.6 Support / Admin-review treatment

Full Admin review is outside this milestone. Do not create an active support case workflow.

A neutral optional message may appear after repeated failures:

> Need help with the demo? Contact the MARKAZ team or use another fictional sample document.

Only link to Support if an existing route exists.

## 14.7 State and retry rules

- Start sets verification to `PENDING` and listing to `OWNERSHIP_REVIEW`.
- Success sets verification to `VERIFIED` and listing to `OWNERSHIP_VERIFIED`.
- Failure sets verification to `FAILED` and preserves recoverability.
- Retry creates a new attempt or updates the current service record according to the domain service design, while preserving an audit history.
- Replacing document invalidates the previous result.
- Refresh fetches authoritative status.

---

# 15. Listing and Offer Settings Specification

## 15.1 Objective

Set the future public asking price and define which offer amounts should trigger an immediate simulated notification.

## 15.2 Page copy

**Step:**

> Step 4 of 9 · Listing settings

**Title:**

> Set your price and offer preference

**Description:**

> Choose the asking price and the lowest offer amount you want to be notified about.

## 15.3 Asking price

Label:

> Asking price

Currency prefix:

> AED

Placeholder:

> 2,100,000

Helper:

> This will be the advertised price when the listing is published in a later step.

Rules:

- Required
- AED only
- Whole dirhams only
- Greater than zero
- Maximum 999,999,999 AED
- Commas displayed after blur
- While focused, preserve understandable editing and caret behaviour
- Arabic pages may display locale-formatted numerals, but the control must accept Arabic-Indic and Western digits and normalise to a numeric value

## 15.4 Minimum offer notification

Label:

> Minimum offer notification

Currency prefix:

> AED

Placeholder:

> 1,950,000

Required explanation:

> Choose the lowest offer amount you want to be notified about. Lower offers may still appear in your offer history, but you will not receive an immediate notification.

Rules:

- Required
- Whole AED amount
- Greater than zero
- Must not exceed Asking price
- May equal Asking price
- Do not automatically discard lower offers
- Do not imply that notifications are real in this milestone

Supporting demo note:

> Offer notifications will be simulated in a later milestone.

## 15.5 Price guidance placeholder

If seeded demo comparison data exists, show a restrained card:

> **Demo area comparison**
>
> Similar 2-bedroom listings in Dubai Marina are shown between AED 1.9M and AED 2.3M in this demonstration dataset.

Label every comparison:

> Demo data

If no data exists:

> Area price guidance is not available for this demo property.

Do not fabricate a range on the client.

## 15.6 Unrealistic price warning

Do not block based on market opinion. When a reliable seeded comparison exists and asking price is more than 25% outside the demo range, show a non-blocking warning:

> Your asking price is outside the demo comparison range. You can continue, but you may want to review it.

Action:

> Review demo comparison

## 15.7 Listing visibility

Do not show a public/private listing toggle. Every listing is private until the future publication milestone.

Display a fixed informational row:

> **Current visibility: Private draft**
>
> The listing will not appear publicly during this milestone.

Investment Case visibility is configured separately in its optional step.

## 15.8 Validation

- Missing asking price: `Enter an asking price.`
- Invalid asking price: `Enter a valid whole AED amount greater than zero.`
- Asking price too high: `Asking price must be below AED 1,000,000,000.`
- Missing threshold: `Enter a minimum offer-notification amount.`
- Invalid threshold: `Enter a valid whole AED amount greater than zero.`
- Threshold above price: `The notification amount cannot be higher than the asking price.`

## 15.9 Save and continue

Primary:

> Save and continue

Loading:

> Saving listing settings…

Success route:

> Investment Case

Settings completion is a derived requirement; it does not introduce a new listing enum state.

---

# 16. Investment Case Specification

## 16.1 Objective

Allow customers to optionally present a simple, understandable financial history and estimated return summary without making the product feel like an investment-trading platform.

## 16.2 Introduction state

**Step:**

> Step 5 of 9 · Investment Case · Optional

**Title:**

> Add an Investment Case

**Description:**

> Share optional purchase-history information and an estimated return summary with future buyers.

Privacy note:

> Purchase history is optional. You choose whether the calculated Investment Case will appear on the future public listing.

Actions:

- Primary: `Add Investment Case`
- Secondary: `Skip for now`

Skip confirmation is not required. Mark the section `Optional · Skipped` and continue to Simulated Form A.

## 16.3 Fields

### Original purchase price

Label:

> Original purchase price

Prefix:

> AED

Helper:

> Enter the fictional or demonstration purchase price used for this prototype.

Required when adding Investment Case.

### Purchase date

Label:

> Purchase date

Helper:

> Used to estimate the annualised return.

Rules:

- Required for annualised return
- Cannot be in the future
- Cannot be before 1970 for the prototype
- If less than 30 days ago, calculate gain and ROI but show annualised return as unavailable

### Renovation or improvement spend

Label:

> Renovation or improvement spend

Prefix:

> AED

Helper:

> Optional. Include major improvements you want reflected in the estimate.

Default:

> 0

### Show on future listing

Toggle label:

> Show the Investment Case on the future public listing

Helper:

> When off, the inputs remain private and the calculated card will not appear publicly.

Default: Off until the customer intentionally enables it.

## 16.4 Calculations

```text
Total invested
= Original purchase price + Renovation or improvement costs

Estimated gain
= Asking price − Total invested

Estimated ROI
= Estimated gain ÷ Total invested × 100

Estimated annualised return
= (Asking price ÷ Total invested)^(1 ÷ years held) − 1

Price per square foot
= Asking price ÷ Property size in square feet
```

### Rules

- Calculate using decimal-safe server/domain utilities.
- Do not label annualised return as IRR.
- Recalculate after a 300 ms debounce and on blur.
- Asking price and size are read from saved listing data and shown as linked source values.
- If Total invested is zero or invalid, do not calculate.
- If years held is less than approximately 30 days, annualised return is `Not available`.
- If demo area average is unavailable, area comparison is `Not available`.

## 16.5 Formatting

- AED totals: whole dirhams with separators
- Percentages: one decimal place
- Price per sq ft: whole AED
- Positive: plus sign and restrained success colour
- Negative: minus sign and restrained error colour
- Neutral zero: standard text
- Always include text such as `Estimated`, never imply guaranteed return

## 16.6 Calculation summary

Card title:

> Estimated Investment Case

Metrics:

- Total invested
- Estimated gain
- Estimated ROI
- Estimated annualised return
- Asking price per sq ft
- Demo area average per sq ft, when available

Disclaimer:

> Estimates are based only on the values entered for this demo. They do not include transaction costs, financing, rental income, taxes, service charges, or market changes.

## 16.7 Preview card

Show a compact representation of how the future public card may look:

> **Investment Case**  
> Estimated ROI: 14.2%  
> Estimated annualised return: 4.8%  
> Asking price: AED 1,680 per sq ft  
> Based on seller-provided demo information

If visibility is off, overlay or label:

> Private · Not shown on future listing

## 16.8 Missing and invalid data

- Invalid original price: `Enter a valid whole AED amount greater than zero.`
- Negative renovation amount: `Renovation spend cannot be negative.`
- Future date: `Purchase date cannot be in the future.`
- Annualisation unavailable: `Annualised return is not available for a holding period under 30 days.`
- Asking price unavailable: route user to Listing Settings with `Add an asking price before calculating the Investment Case.`
- Size unavailable: route to Property Details with `Add the property size before calculating price per square foot.`

## 16.9 Actions

- Primary: `Save Investment Case`
- Secondary: `Skip for now` or `Remove Investment Case`
- Tertiary: `Back to listing settings`

Removing requires confirmation if previously saved:

> Remove the Investment Case? The purchase-history inputs and calculated values will be deleted from this draft.

---

# 17. Simulated Form A Specification

## 17.1 Required disclosure

> **Simulated Form A**
>
> This prototype does not create or submit a legal Form A.

## 17.2 Introduction and explanation

**Step:**

> Step 6 of 9 · Simulated Form A

**Title:**

> Review the simulated listing agreement

**Description:**

> Form A is normally used to document the relationship between a property owner and a real-estate brokerage. This prototype shows a simplified, non-legal simulation of that step.

Do not use actual legal contract wording.

## 17.3 Review summary

### Customer

- Full name from profile
- Verified email

### Property

- Property type
- Community
- Building/project
- Private unit identifier shown only to the customer

### Listing

- Asking price
- Minimum offer-notification amount
- Investment Case visibility

### Demo statement

> I confirm that the fictional information in this prototype listing is accurate for demonstration purposes and that I understand no legal agreement will be created.

Required checkbox:

> I confirm the demo listing details above.

## 17.4 Primary action

> Complete simulated Form A

Loading:

> Completing simulated Form A…

## 17.5 Pending

**Title:**

> Simulated Form A in progress

**Description:**

> The prototype is recording the demo confirmation. No legal document is being created or submitted.

Status:

> In progress · Demo

If asynchronous, allow safe exit. If immediate, show this state only for actual request time and do not add an artificial delay.

## 17.6 Success

**Title:**

> Simulated Form A complete

**Description:**

> The demo confirmation has been recorded for this listing.

Status:

> Complete · Demo

Summary:

- Confirmed by customer name
- Completed date and time
- Listing price at confirmation

Primary:

> Continue to property photos

Secondary:

> Review confirmed details

## 17.7 Failure

**Title:**

> We could not complete the Form A simulation

**Description:**

> Your listing details remain saved. Review the information and try again.

Actions:

- `Try again`
- `Review listing details`
- `Save and exit`

## 17.8 Change-after-completion behaviour

If the customer changes Asking Price, property identity, or another material Form A summary field after completion:

- Mark Form A as `Requires update`
- Do not silently keep it complete
- Route to Form A before Photos/Review can complete

Copy:

> Listing details changed after the simulated Form A was completed. Review and confirm the updated information.

---

# 18. Property Photographs Specification

## 18.1 Objective

Collect and organise a practical set of listing photographs, require a cover photograph, and prepare a premium future listing preview.

## 18.2 Page copy

**Step:**

> Step 7 of 9 · Property photos

**Title:**

> Add property photographs

**Description:**

> Upload clear photographs that show the property accurately. Choose the strongest landscape image as the cover.

## 18.3 Requirements

- Minimum to advance: **1 valid photograph**, matching the existing state machine
- Recommended: **5–12 photographs**
- Maximum: **20 photographs**
- Accepted formats: JPG/JPEG, PNG, WebP
- Maximum file size: 12 MB each
- Recommended resolution: at least 1,600 × 1,200 pixels
- Cover photograph required
- Professional photography booking is excluded

Quality guidance:

> For the strongest listing, include the living area, bedrooms, kitchen, bathrooms, exterior or balcony, and any important view or amenity.

> Use landscape images where possible. Avoid screenshots, watermarks, contact details, people, or heavily edited photographs.

## 18.4 Empty upload area

Desktop:

> Drag photographs here, or **choose photographs**
>
> JPG, PNG or WebP · Up to 20 files · Maximum 12 MB each

Mobile:

Buttons:

- `Choose from gallery`
- `Take a photo`

Camera capture is allowed for property photographs, unlike private ownership documents.

## 18.5 Upload progress

Each upload tile displays:

- Local preview
- File name truncated visually but available accessibly
- Progress
- `Uploading…`
- Retry or Remove on failure

Global status:

> Uploading 3 of 8 photographs…

The customer may continue organising completed uploads while others remain in progress, but cannot complete the step until all active uploads finish or failed items are removed.

## 18.6 Photo grid

Desktop:

- Four columns at wide desktop
- Three columns at standard desktop/tablet
- Two columns mobile
- Cover photo spans two columns only in the preview summary, not during reorder if that harms predictability

Photo tile anatomy:

- Image
- Order number
- Cover badge, when selected
- Drag handle
- Overflow menu
- Upload or warning status

Actions:

- `Set as cover`
- `Replace photograph`
- `Remove photograph`

## 18.7 Reordering

### Pointer interaction

- Drag using a visible handle
- Other tiles shift with restrained motion
- Save order after drop
- Announce new position in a polite live region

### Keyboard alternative

Each tile overflow menu includes:

- Move earlier
- Move later
- Move to first
- Move to last

Optional direct keyboard shortcuts must not be the only method.

### Mobile alternative

Use `Reorder photographs` mode with up/down controls and a `Done` action. Do not rely exclusively on touch drag.

## 18.8 Cover photograph

- First successful upload becomes provisional cover only if no cover exists.
- Customer must explicitly confirm or retain it before continuing.
- Cover tile receives a blue outline and badge:

> Cover photograph

Helper:

> The cover photograph will be the first image buyers see after publication.

## 18.9 Remove and replace

Remove confirmation is required only when removing the cover or the last remaining photograph.

Cover removal:

> Choose a new cover photograph before removing this one.

Last photo:

> Removing this photograph will make the Photos step incomplete.

Replace preserves position and cover status after successful replacement.

## 18.10 Quality warnings

Low resolution:

> This photograph may appear soft on larger screens. For better quality, use an image at least 1,600 × 1,200 pixels.

Portrait:

> Landscape photographs work best as the cover. You can still use this image in the gallery.

Duplicate:

> This photograph appears to be a duplicate.

Duplicate detection is an optional enhancement. It must be non-blocking.

## 18.11 Errors

Unsupported:

> This file type is not supported. Upload a JPG, PNG, or WebP image.

Too large:

> This photograph is larger than 12 MB. Choose a smaller file.

Too many:

> You can upload up to 20 photographs.

Upload failure:

> This photograph could not be uploaded. Try again or remove it.

## 18.12 Accessibility and alt text

Do not require customers to write alt text in this milestone. Generate a neutral future alt-text fallback from property context and image order, for example:

> Photograph 3 of Marina Gate 2 apartment

This is not image-content recognition. Future public listing work should define richer alt-text management.

## 18.13 Continue

Blocking requirements:

- At least one successful upload
- Exactly one cover photograph
- No active upload in progress
- No unresolved failed tile included in the active set

Primary:

> Save photos and continue

Success:

- Save order and cover
- Transition to `PHOTOS_COMPLETE`
- Route to Simulated Trakheesi


---

# 19. Simulated Trakheesi Specification

## 19.1 Objective

Demonstrate the permit stage required before a Dubai property advertisement can be prepared, without connecting to or imitating the official Trakheesi service.

## 19.2 Required disclosure

Show on every state:

> **Simulated Trakheesi**
>
> This prototype does not submit information to the official Trakheesi service.

Do not use an official seal, government crest, official Trakheesi interface, or government approval colour treatment.

## 19.3 Introduction — `NOT_STARTED`

**Step:**

> Step 8 of 9 · Simulated Trakheesi

**Title:**

> Prepare the demo permit application

**Description:**

> Review the listing information that will be used for this simulated permit step.

Review summary:

- Property type
- Community and building/project
- Private property identifier
- Asking price
- Ownership check: `Verified · Demo`
- Simulated Form A: `Complete · Demo`
- Number of photographs
- Cover photograph thumbnail

Required checkbox:

> I confirm the demo listing information is ready for the simulated permit step.

Primary:

> Submit simulated application

Secondary:

> Review listing details

## 19.4 Submission confirmation

Before submission, use a concise confirmation dialog:

> **Submit the simulated application?**
>
> The prototype will record a demo permit request. No information will be sent to an official government service.

Actions:

- `Cancel`
- `Submit demo application`

## 19.5 Pending — `PENDING`

**Title:**

> Demo permit application in progress

**Description:**

> The prototype is processing the simulated Trakheesi application. You can leave this page and return later.

Status:

> Pending · Demo

Progress sequence:

- Listing information received — Complete
- Demo application reviewed — In progress
- Demo permit result recorded — Not started

Actions:

- Primary: `Return to My Listings`
- Secondary: `Refresh status`

Do not show a fake guaranteed duration. If the implementation resolves automatically within a configured period, describe the actual behaviour only.

## 19.6 Approved — `APPROVED`

**Title — required:**

> Demo permit approved

**Description:**

> The simulated Trakheesi step is complete. Review the full listing before marking it ready to publish.

Status:

> Approved · Demo

Primary:

> Review listing

Secondary:

> View demo permit details

### Simulated Madmoun QR

A QR-like demo asset may be shown only when it adds demonstration value.

Required label immediately beside it:

> Simulated Madmoun QR · Demo only

Supporting copy:

> This code is a non-functional demo asset and is not connected to an official permit.

Rules:

- It must not resolve to a government site.
- Prefer a non-scannable visual pattern or a QR that resolves only to an internal local demo explanation page.
- Never embed personal or private property information.
- Do not show it on public preview in this milestone unless clearly labelled.

## 19.7 Failed — `FAILED`

**Title:**

> The demo permit step was not completed

**Description:**

> Review the listing information and try the simulation again. No official application was submitted.

When a safe demo reason exists, show one of:

- `The cover photograph is missing.`
- `The simulated Form A needs to be updated.`
- `The ownership verification is no longer current.`
- `The demo service could not complete the request.`

Actions:

- Primary: `Review required information`
- Secondary: `Try again`
- Link: `Save and exit`

## 19.8 State rules

- Submit creates or updates a permit record with `PENDING` and listing state `PERMIT_PENDING`.
- Approval sets permit record to `APPROVED` and routes to Review, but the listing is not yet presented as ready.
- Failure sets permit record to `FAILED` and preserves retry.
- Material changes to Property Details, Asking Price, Ownership result, Form A, or Photos after approval invalidate the permit result and require resubmission.
- Refresh and return fetch authoritative permit status.

---

# 20. Review Specification

## 20.1 Objective

Provide one inspectable summary of the listing, clearly show complete, optional, missing, pending, failed, and attention-required sections, and prevent readiness confirmation until all required items are valid.

## 20.2 Page copy

**Step:**

> Step 9 of 9 · Review

**Title:**

> Review your listing

**Description:**

> Check the property information, demo verification steps, price, and photographs before marking the listing ready to publish.

## 20.3 Overall progress

Complete state:

> **All required sections are complete**
>
> Review the information below and confirm when the listing is ready for the next publication stage.

Incomplete state:

> **{count} items need attention**
>
> Complete the highlighted sections before marking the listing ready.

## 20.4 Section status vocabulary

| Status | Label | Meaning |
|---|---|---|
| Complete | `Complete` | Required section satisfies rules |
| Optional added | `Added` | Optional Investment Case included |
| Optional skipped | `Skipped · Optional` | Does not block readiness |
| Missing | `Missing` | Required data absent |
| In progress | `In progress` | Async simulation pending |
| Failed | `Action required` | Retry or correction needed |
| Invalidated | `Update required` | Later edit invalidated confirmation/result |

Use status text plus icon; do not rely on colour.

## 20.5 Review layout

Desktop:

```text
┌─────────────────────────────────────────────────────────────────────┐
│ Overall progress + readiness notice                                 │
├───────────────────────────────────────┬─────────────────────────────┤
│ Property summary                      │ Cover photograph            │
│ Apartment · Dubai Marina              │                             │
│ 2 bed · 3 bath · 1,284 sq ft          │                             │
│ Asking AED 2,100,000                  │                             │
├───────────────────────────────────────┴─────────────────────────────┤
│ Property Details            Complete                    Edit        │
│ Ownership Document          Complete · Private          Review      │
│ Ownership Verification      Verified · Demo             Review      │
│ Listing Settings            Complete                    Edit        │
│ Investment Case             Skipped · Optional          Add         │
│ Simulated Form A            Complete · Demo             Review      │
│ Property Photos             8 photos · Cover selected   Edit        │
│ Simulated Trakheesi         Approved · Demo             Review      │
├─────────────────────────────────────────────────────────────────────┤
│ Disclosures and readiness confirmation                              │
│ [ Mark listing ready ]                                              │
└─────────────────────────────────────────────────────────────────────┘
```

Mobile:

- Property summary first
- Cover image full width
- Section cards stack
- Edit action remains visible in each card header
- Sticky bottom action contains `Mark listing ready`

## 20.6 Review section details

### Property summary

Show:

- Cover photo
- Property type
- Community
- Building/project
- Bedrooms
- Bathrooms
- Size
- Furnishing
- Asking price

Do not show private unit identifier in the visual public-style summary. Show it inside Property Details review under a `Private` row.

### Ownership

Show metadata only:

- Document type
- File name
- Uploaded date
- `Private document`
- Verification result

Do not render the document inside the main review page.

### Listing Settings

Show:

- Asking price
- Minimum offer-notification threshold
- Private draft visibility

### Investment Case

If added:

- Visibility state
- Estimated ROI
- Estimated annualised return
- Price per sq ft
- Demo comparison label

If skipped:

> Not added · Optional

Action:

> Add Investment Case

### Form A

Show:

- `Simulated Form A complete`
- Confirmation time
- Update-required state if material fields changed

### Photos

Show:

- Cover thumbnail
- Count
- First four thumbnails
- `View all photographs`

### Trakheesi

Show:

- `Demo permit approved`
- Demo reference, if generated
- Optional simulated QR with label

## 20.7 Required disclosures

Place before final confirmation:

> **Prototype listing**
>
> Ownership verification, Form A, Trakheesi, and permit results in this prototype are simulated. They do not represent official government, legal, or property approval.

> **Not yet public**
>
> Marking the listing ready does not publish it. Publication will be handled in a later product stage.

Required checkbox:

> I have reviewed the listing and understand it will remain private until a future publication step.

## 20.8 Missing-requirement behaviour

- Primary readiness action is disabled only when the reason is visible immediately above it.
- Each missing status card includes an action such as `Complete property details`.
- Selecting the action opens the relevant step.
- After correction, returning to Review scrolls to the corrected card and announces the new status.

Missing summary example:

> Complete these items:
>
> - Select a cover photograph
> - Retry the simulated permit step

## 20.9 Confirm readiness

Primary:

> Mark listing ready

Loading:

> Checking listing readiness…

Before mutation, revalidate all required server-side conditions. Do not trust UI completion alone.

Success:

- Transition listing to `READY_TO_PUBLISH`
- Write audit event
- Route to Ready screen

Failure because data changed in another tab:

> This listing changed while you were reviewing it. Review the highlighted section before continuing.

---

# 21. `READY_TO_PUBLISH` Specification

## 21.1 Required copy

**Title:**

> Your listing is ready

**Description:**

> You have completed the required property details, demo verification steps, photographs, and listing settings.

**Important note:**

> Your listing is not live yet. Review the preview before publishing in the next product stage.

## 21.2 Visual treatment

- Calm success icon, not confetti
- Property cover image and compact summary
- Status chip:

> Ready to publish

- Separate pale-blue note:

> Private · Not live

## 21.3 Actions

Primary:

> View listing preview

Secondary:

> Return to My Listings

Tertiary text:

> Continue later

`Continue later` routes to My Listings and does not change state.

## 21.4 Future Publish action treatment

Do not show an enabled Publish button.

A non-interactive future-stage note may appear:

> **Next stage: Publication**
>
> Publishing the listing will be added in the next product milestone.

Do not use a disabled button labelled `Publish now`; disabled calls to action are frustrating and may imply unfinished functionality during a stakeholder demo.

## 21.5 Private listing preview

Preview uses future public-listing presentation while remaining authenticated and private.

Top banner:

> **Private preview**
>
> Only you can view this draft. The listing is not live.

Preview includes:

- Cover and gallery
- Public property facts
- Asking price
- Description
- Amenities
- Investment Case only when visibility is on
- Demo status wording that is appropriate for future public view

Preview excludes:

- Ownership file
- Private unit identifier
- Occupancy status unless later approved for public display
- Original purchase inputs when Investment Case visibility is off
- Internal audit and simulation controls

Actions:

- `Back to ready listing`
- `Edit listing`

---

# 22. Draft Saving and Recovery

## 22.1 Autosave triggers

- 800 ms after the last valid field change
- Immediately on field blur when dirty
- Immediately before navigating Back or to another completed step
- Blocking save on Continue
- Blocking save on Save and Exit
- After photo reorder, cover change, or delete
- After optional-step skip or visibility-toggle change

Do not autosave every keystroke.

## 22.2 Save indicators

Persistent in wizard header:

- `Saving…`
- `Saved just now`
- `Saved {relativeTime}`
- `Couldn’t save changes`
- `Offline · Changes not saved`

Use no toast on successful autosave.

## 22.3 Save failure

Persistent inline banner:

> **We could not save your latest changes**
>
> Your previously saved listing is safe. Check your connection and try again before leaving this page.

Actions:

- `Try again`
- `Review unsaved changes`

The primary Continue action remains blocked until current required changes save.

## 22.4 Offline behaviour

- Detect offline state when possible.
- Do not claim local persistence unless deliberately implemented and tested.
- Keep unsaved values in active memory while the page remains open.
- Show `Offline · Changes not saved`.
- Disable upload and simulation actions.
- Allow retry when connection returns.

## 22.5 Save and Exit

Always available in the wizard header and mobile overflow/action menu.

Copy:

> Save and exit

Behaviour:

- Save valid dirty data
- If current fields contain invalid or incomplete input, preserve only values allowed by draft schema and explain which values could not be saved
- Return to My Listings
- Focus the resumed draft card

## 22.6 Leave confirmation

Show only when unsaved changes remain because save is pending, failed, or offline.

**Title:**

> Leave without saving your latest changes?

**Body:**

> Your earlier saved progress is safe, but the latest changes on this page may be lost.

Actions:

- Primary: `Stay and try saving`
- Secondary: `Leave without latest changes`

Do not show this dialog after a confirmed save.

## 22.7 Browser close and refresh

- Use browser leave protection only while unsaved changes exist.
- After refresh, load server state.
- Uploaded files that did not complete must be selected again.
- Never restore ownership-document bytes from general browser storage.

## 22.8 Multiple tabs

If another tab saves a newer version:

> **This listing was updated in another tab**
>
> Refresh to load the latest version before continuing.

Actions:

- `Refresh listing`
- `Keep editing` only if conflict-safe merging is supported; otherwise do not offer it

Use optimistic concurrency/version checks for state-changing saves.

## 22.9 Draft resumption on My Listings

Each draft card shows:

- Exact next step
- Section progress
- Save time
- Simulation status when pending or failed
- `Continue listing`

Pending card example:

> Ownership check in progress · You can return when the result is ready.

Failed card example:

> Ownership check needs attention · Review the fictional document and retry.

---

# 23. Component Library

## 23.1 Listing Wizard Shell

| Attribute | Specification |
|---|---|
| Purpose | Provides customer header, property context, save status, step navigation, form canvas, optional help, and actions |
| Anatomy | Header, listing identity, autosave, stepper, main, help rail, action bar |
| Variants | Standard, loading, review, ready |
| States | Saving, saved, failed, offline, RTL |
| Interaction | Routes between allowed steps; blocks unsafe leave only when dirty |
| Accessibility | One main landmark; skip link; logical headings; stepper labelled |
| Responsive | Three-column desktop, one-column mobile |
| RTL | Columns mirror; DOM order remains meaningful |
| Reuse | All listing steps |

## 23.2 Desktop Step Navigation

| Attribute | Specification |
|---|---|
| Purpose | Shows nine-step position and status |
| Anatomy | Ordered list, marker, label, optional status text |
| Variants | Current, complete, optional skipped, locked, pending, failed |
| Interaction | Completed/available items are links; locked are not interactive |
| Accessibility | Ordered list; `aria-current=step`; explicit status text |
| Responsive | Hidden/replaced below tablet threshold |
| RTL | Visual sequence mirrors; reading order follows locale |
| Reuse | Listing wizard |

## 23.3 Mobile Progress Indicator

| Attribute | Specification |
|---|---|
| Purpose | Compact current-step context |
| Anatomy | `Step X of 9`, title, thin progress line |
| States | Standard, optional, attention |
| Accessibility | Current and total announced as text |
| RTL | Fill direction mirrors |
| Reuse | Mobile wizard |

## 23.4 Step Header

| Attribute | Specification |
|---|---|
| Anatomy | Eyebrow step label, h1, description, optional badge/disclosure |
| States | Standard, optional, simulated, failed |
| Accessibility | One h1; badge text not colour-only |
| Responsive | Description wraps; no fixed height |
| Reuse | Every step |

## 23.5 Draft Status Indicator

| Attribute | Specification |
|---|---|
| Purpose | Shows private draft / ready state |
| Variants | Draft, pending demo, action required, ready to publish |
| Accessibility | Text label always present |
| Reuse | My Listings, wizard header, ready screen |

## 23.6 Autosave Indicator

| Attribute | Specification |
|---|---|
| Anatomy | Status icon, text, optional retry |
| States | Saving, saved, failed, offline |
| Interaction | Retry on failed state |
| Accessibility | Polite announcements; do not announce every successful debounce |
| RTL | Logical alignment |
| Reuse | Wizard header and action bar |

## 23.7 Form Section

| Attribute | Specification |
|---|---|
| Purpose | Groups related fields without excessive card stacking |
| Anatomy | h2, description, content, optional divider |
| Visual | Mostly borderless sections; cards reserved for privacy/simulation/summary |
| Accessibility | Semantic fieldset/legend when controls form a choice group |
| Reuse | Details, Settings, Investment Case |

## 23.8 Field Group

| Attribute | Specification |
|---|---|
| Anatomy | Label, optional/required text, control, helper, error |
| States | Default, focus, valid, invalid, disabled, read-only |
| Accessibility | Persistent label; described-by; invalid state |
| Responsive | Full width mobile |
| Reuse | All forms |

## 23.9 Select and Combobox

| Attribute | Specification |
|---|---|
| Purpose | Controlled choice or searchable location selection |
| States | Empty, selected, open, loading, no results, invalid |
| Interaction | Keyboard navigation; typeahead; clear where allowed |
| Accessibility | Accessible listbox/combobox semantics |
| RTL | Popup alignment uses logical edges |
| Reuse | Property facts and location |

## 23.10 Number Input

| Attribute | Specification |
|---|---|
| Purpose | Bedrooms, bathrooms, size, parking |
| Interaction | Accept locale digits; normalise; prevent mouse-wheel accidental change where appropriate |
| Accessibility | Unit included in label or described-by |
| Mobile | Numeric keyboard |
| RTL | Numeric value LTR or bidi-isolated |
| Reuse | Details |

## 23.11 AED Currency Input

| Attribute | Specification |
|---|---|
| Anatomy | Label, `AED` prefix, numeric field, helper/error |
| States | Empty, focus raw edit, blur formatted, invalid, read-only |
| Interaction | Accept Western and Arabic-Indic digits; whole dirhams; retain caret predictably |
| Accessibility | Screen reader label includes `Amount in UAE dirhams` |
| RTL | `AED` and value isolated; prefix appears at logical field start without reversing digits |
| Reuse | Settings and Investment Case |

## 23.12 Date Input

| Attribute | Specification |
|---|---|
| Purpose | Purchase date |
| Interaction | Native or accessible date picker plus typed entry |
| Accessibility | Expected format described; error clear |
| RTL | Locale presentation; stored ISO date hidden from user |
| Reuse | Investment Case |

## 23.13 Text Area

| Attribute | Specification |
|---|---|
| Anatomy | Label, control, helper, counter, error |
| Interaction | Counter updates; no auto-resize beyond sensible max without scroll |
| Accessibility | Counter not announced every keystroke; announce near limit |
| Reuse | Description |

## 23.14 Checkbox, Toggle, and Radio Group

| Component | Use |
|---|---|
| Checkbox | Required confirmations and legal/demo acknowledgements |
| Toggle | Investment Case public visibility |
| Radio / selectable tile | Property type, document type, furnishing, occupancy, completion |

All use visible labels, 44 px targets, keyboard input, and explicit selected state.

## 23.15 Document-Type Selector

| Attribute | Specification |
|---|---|
| Anatomy | Two tiles with icon, title, description, selected marker |
| States | Default, hover, focus, selected, recommended |
| Accessibility | Radio group |
| Reuse | Ownership Document |

## 23.16 File Uploader

| Attribute | Specification |
|---|---|
| Variants | Private document, public-future photo |
| States | Empty, drag active, validating, uploading, success, failure, offline |
| Interaction | Click, keyboard, drag/drop; no drag-only requirement |
| Accessibility | Native file input available; instructions and errors connected |
| Security | Private variant never exposes public URL |
| Reuse | Document and Photos |

## 23.17 File Metadata Card

| Attribute | Specification |
|---|---|
| Anatomy | Type icon, file name, size, date, privacy/status, actions |
| States | Uploading, uploaded, failed, verified, invalidated |
| Accessibility | Full file name available; action labels include file context |
| Reuse | Ownership |

## 23.18 Verification Status Panel

| Attribute | Specification |
|---|---|
| Variants | Intro, pending, verified, failed, invalidated |
| Anatomy | Disclosure, status icon/text, explanation, summary, actions |
| Accessibility | Status is announced; no colour-only state |
| Reuse | Ownership, Form A, Trakheesi |

## 23.19 Simulation Badge

| Attribute | Specification |
|---|---|
| Label | `Demo simulation` or context-specific `Demo` |
| Visual | Pale blue, information icon, restrained pill/ribbon |
| Rules | Never resembles government seal; always paired with disclosure on step page |
| Reuse | Ownership, Form A, Trakheesi |

## 23.20 Pending, Success, Failure and Retry Panels

| Variant | Required content |
|---|---|
| Pending | Status, what is happening, safe-leave guidance, refresh/exit |
| Success | Completed wording, demo label where needed, next action |
| Failure | Safe reason, saved-data reassurance, retry/correction actions |

Reuse across all simulations.

## 23.21 Investment Metric

| Attribute | Specification |
|---|---|
| Anatomy | Plain-language label, formatted value, optional source/explanation |
| Variants | Positive, negative, neutral, unavailable |
| Accessibility | Sign and value announced; colour supplementary |
| Reuse | Investment Case and future property detail |

## 23.22 Calculation Summary Card

| Attribute | Specification |
|---|---|
| Anatomy | Heading, 2–3 column metrics, disclaimer, visibility state |
| Responsive | Metrics stack to two columns then one |
| Reuse | Investment Case preview and Review |

## 23.23 Photo Uploader and Photo Tile

| Attribute | Specification |
|---|---|
| Photo uploader | Multi-file selection, limits, guidance, progress |
| Photo tile | Preview, order, cover, drag handle, menu, warnings |
| Accessibility | Keyboard reorder alternative; contextual action names |
| RTL | Grid visual order follows locale, persisted order remains explicit numeric order |
| Reuse | Photos and future gallery management |

## 23.24 Cover-Photo Badge

Label:

> Cover photograph

Deep-blue badge with white text; text always present.

## 23.25 Photo Reorder Control

- Pointer drag handle
- Keyboard menu actions
- Mobile reorder mode
- Live-region position announcement
- Persist after operation

## 23.26 Review Section Card

| Attribute | Specification |
|---|---|
| Anatomy | Section title, status, short summary, Edit/Review action |
| Variants | Complete, skipped, missing, pending, failed, update required |
| Interaction | Action deep-links to section and preserves Review return target |
| Reuse | Final Review and My Listings detail later |

## 23.27 Completion Checklist

Ordered list of required groups with status icon and text. Used on Review and Ready summary.

## 23.28 Wizard Actions

- Primary: `Save and continue`, context-specific simulation action, or readiness action
- Secondary: `Back`
- Tertiary: `Save and exit`
- Destructive actions never share the primary action cluster
- Loading labels are progressive and stable-width

## 23.29 Leave-With-Unsaved-Changes Dialog

Defined in Draft Saving. Focus-trapped, initial focus on `Stay and try saving`, Escape cancels leaving.

## 23.30 Mobile Bottom Action Bar

- Sticky to viewport bottom
- White surface, top border, subtle elevation
- Safe-area padding
- Maximum two visible actions plus overflow
- Never overlays focused input; page reserves equivalent bottom padding

---

# 24. Form and Validation Matrix

All copy below is approved English product copy. Arabic requires professional review as marked.

| Step | Field / state | Req. | Rule | Trigger | English error copy | Placement | Clears when | Blocks progression | Arabic review |
|---|---|---:|---|---|---|---|---|---:|---|
| Details | Property type | Yes | One supported type | Continue / blur group | Select a property type. | Under tile group | Selected | Yes | Language/property |
| Details | Emirate | Yes | Dubai in prototype | Load / continue | This prototype currently supports Dubai listings. | Field/help | Dubai set | Yes | Language/property |
| Details | Area/community | Yes | 2–100 chars | Blur / continue | Enter the area or community. | Under field | Valid value | Yes | Language/property |
| Details | Building/project | Conditional | Required for apartment/penthouse; max 120 | Blur / continue | Enter the building or project name. | Under field | Valid or not applicable | Yes | Language/property |
| Details | Unit/property identifier | Yes | 1–50 chars | Blur / continue | Enter a private unit or property identifier. | Under field | Valid | Yes | Language/property |
| Details | Bedrooms | Yes | Studio/0 or 1–10 | Continue | Select the number of bedrooms. | Under control | Valid | Yes | Language/property |
| Details | Bathrooms | Yes | Integer 1–10 | Continue | Select the number of bathrooms. | Under control | Valid | Yes | Language/property |
| Details | Size | Yes | 200–50,000 sq ft | Blur / continue | Enter a property size between 200 and 50,000 sq ft. | Under field | Valid | Yes | Language/property |
| Details | Furnishing | Yes | One option | Continue | Select the furnishing status. | Under group | Selected | Yes | Language/property |
| Details | Occupancy | Yes | One option | Continue | Select the occupancy status. | Under group | Selected | Yes | Language/property |
| Details | Completion | Yes | Ready or off-plan | Continue | Select the completion status. | Under group | Selected | Yes | Language/property |
| Details | Parking | No | Integer 0–10 | Blur | Enter a number from 0 to 10. | Under field | Empty or valid | No if empty | Language/property |
| Details | Description | Yes | 80–2,000 chars | Blur / continue | Add at least 80 characters describing the property. | Under field | ≥80 | Yes | Language/property |
| Details | Description too long | Yes | Max 2,000 | Input / continue | Description must be 2,000 characters or fewer. | Under field | ≤2,000 | Yes | Language/property |
| Details | Amenities | No | Max 15 | Select | Choose up to 15 features and amenities. | Selector | ≤15 | No if ≤15 | Language/property |
| Ownership | Document type | Yes | Title Deed or Oqood | Continue | Choose Title Deed or Oqood. | Under tiles | Selected | Yes | Legal/property |
| Ownership | File missing | Yes | One active file | Continue | Upload a fictional sample ownership document. | Uploader | Upload succeeds | Yes | Security/language |
| Ownership | Unsupported file | Yes | PDF/JPG/PNG | Selection | This file type is not supported. Upload a PDF, JPG, or PNG file. | Uploader/file row | New valid file | Yes | Security/language |
| Ownership | Oversized file | Yes | ≤10 MB | Selection | This file is larger than 10 MB. Choose a smaller file. | Uploader/file row | New valid file | Yes | Security/language |
| Ownership | Upload failed | Yes | Successful private upload | Response | We could not upload this file. Your listing draft is still saved. Try again. | File row + alert | Retry succeeds | Yes | Security/language |
| Verification | Check failed | Yes | Verification record verified | Result | The simulated ownership check was not completed. Review the details and try again. | Status panel | Verified | Yes | Legal/simulation |
| Settings | Asking price empty | Yes | Required | Blur / continue | Enter an asking price. | Under input | Valid | Yes | Language/property |
| Settings | Asking price invalid | Yes | Whole AED >0 | Blur / continue | Enter a valid whole AED amount greater than zero. | Under input | Valid | Yes | Language/property |
| Settings | Asking price maximum | Yes | <1,000,000,000 | Blur / continue | Asking price must be below AED 1,000,000,000. | Under input | Valid | Yes | Language/property |
| Settings | Threshold empty | Yes | Required | Blur / continue | Enter a minimum offer-notification amount. | Under input | Valid | Yes | Language/product |
| Settings | Threshold invalid | Yes | Whole AED >0 | Blur / continue | Enter a valid whole AED amount greater than zero. | Under input | Valid | Yes | Language/product |
| Settings | Threshold above asking | Yes | ≤ asking | Blur / continue | The notification amount cannot be higher than the asking price. | Under threshold | ≤ asking | Yes | Language/product |
| Investment | Original price | If added | Whole AED >0 | Blur / save | Enter a valid original purchase price. | Under input | Valid | Yes when added | Finance/language |
| Investment | Renovation spend | No | Whole AED ≥0 | Blur / save | Renovation spend cannot be negative. | Under input | Empty/valid | Yes when invalid | Finance/language |
| Investment | Purchase date empty | If added | Required | Save | Enter the purchase date. | Under date | Valid | Yes when added | Finance/language |
| Investment | Future date | If added | Not future | Blur / save | Purchase date cannot be in the future. | Under date | Valid | Yes | Finance/language |
| Investment | Date too old | If added | ≥1970 | Blur / save | Enter a purchase date from 1970 onwards. | Under date | Valid | Yes | Finance/language |
| Investment | Annualisation unavailable | No | Held <30 days | Calculate | Annualised return is not available for a holding period under 30 days. | Metric helper | Date gives valid period | No | Finance/language |
| Investment | Missing asking price | Dependency | Settings required | Enter step | Add an asking price before calculating the Investment Case. | Dependency alert | Settings complete | Yes to add | Finance/language |
| Investment | Missing size | Dependency | Details required | Enter step | Add the property size before calculating price per square foot. | Dependency alert | Details complete | Yes to full calc | Finance/language |
| Form A | Confirmation unchecked | Yes | Checkbox checked | Submit | Confirm the demo listing details to continue. | Under checkbox | Checked | Yes | Legal/simulation |
| Form A | Completion failed | Yes | Service success | Response | We could not complete the Form A simulation. Your listing details remain saved. | Status panel | Retry succeeds | Yes | Legal/simulation |
| Photos | Too few | Yes | At least one | Continue | Upload at least one property photograph. | Grid summary | ≥1 | Yes | Language |
| Photos | Unsupported format | Yes | JPG/PNG/WebP | Selection | This file type is not supported. Upload a JPG, PNG, or WebP image. | Tile/uploader | Valid file | Yes for file | Language |
| Photos | Oversized photo | Yes | ≤12 MB | Selection | This photograph is larger than 12 MB. Choose a smaller file. | Tile/uploader | Valid file | Yes for file | Language |
| Photos | Too many | Yes | Max 20 | Selection | You can upload up to 20 photographs. | Uploader | ≤20 | Yes | Language |
| Photos | No cover | Yes | One cover | Continue | Select a cover photograph. | Grid summary | Cover set | Yes | Language |
| Photos | Upload failed | Yes | All active uploads complete | Response | This photograph could not be uploaded. Try again or remove it. | Tile | Retry/remove | Yes if active | Language |
| Trakheesi | Confirmation unchecked | Yes | Checkbox checked | Submit | Confirm the demo listing information to continue. | Under checkbox | Checked | Yes | Legal/simulation |
| Trakheesi | Permit failed | Yes | Permit approved | Result | The demo permit step was not completed. Review the listing information and try again. | Status panel | Approved | Yes | Legal/simulation |
| Review | Listing incomplete | Yes | All required groups complete | Load/confirm | Complete the highlighted sections before marking the listing ready. | Top summary | All complete | Yes | Language |
| Review | Acknowledgement unchecked | Yes | Checkbox checked | Confirm | Confirm that the listing will remain private until a future publication step. | Under checkbox | Checked | Yes | Legal/language |
| Global | Session expired | Yes | Valid session | Request | Your session has expired. Sign in again to continue. | Route notice | Reauthenticated | Yes | Security/language |
| Global | Access denied/unavailable | Yes | Owner access | Load | This listing is not available. Return to My Listings. | Blocking panel | Correct route/account | Yes | Security/language |

---

# 25. Loading, Success, Failure, and Retry Patterns

## 25.1 Loading an existing draft

Skeleton structure must match the wizard shell:

- Listing identity skeleton
- Step rail skeleton
- Heading and field skeletons
- Action bar disabled

Accessible status:

> Loading your listing draft…

If loading exceeds 10 seconds:

> This is taking longer than expected.

Actions:

- `Try again`
- `Return to My Listings`

## 25.2 State-changing action labels

- Creating listing…
- Saving property details…
- Uploading document…
- Starting simulated check…
- Saving listing settings…
- Saving Investment Case…
- Completing simulated Form A…
- Uploading photographs…
- Saving photograph order…
- Submitting demo application…
- Refreshing status…
- Checking listing readiness…
- Deleting draft…

## 25.3 Pending simulations

Pending pages include:

- Exact process name
- Demo badge
- What is happening
- Safe-to-leave guidance
- No fake progress percentage
- Return to My Listings
- Refresh status

## 25.4 Failure panels

Every failure panel contains:

1. Human title
2. Safe explanation
3. Saved-data reassurance
4. Primary recovery action
5. Secondary exit
6. Optional support reference

Never show raw database, storage, worker, or provider messages.

## 25.5 Network unavailable

Persistent banner:

> **You are offline**
>
> Previously saved listing information is safe. Reconnect before uploading files, running demo checks, or saving new changes.

## 25.6 Listing unavailable

Use for not found, another customer's listing, or inaccessible record. Do not distinguish these cases.

**Title:**

> This listing is not available

**Description:**

> It may have been removed, or you may not have access to it.

Actions:

- `Return to My Listings`
- `Go to dashboard`

## 25.7 Session expired

Route to customer Sign In with safe `returnTo`.

Notice:

> Your session has expired. Sign in again to return to your saved listing where possible.

Do not show private document metadata on the expired-session page.

## 25.8 Unexpected error

**Title:**

> We could not load this part of your listing

**Description:**

> Your previously saved progress is safe. Try again or return to My Listings.

Actions:

- `Try again`
- `Return to My Listings`

An optional support reference may be shown. It must contain no customer data.


---

# 26. Responsive Behaviour

## 26.1 Shared measurements

| Context | Maximum page width | Main form width | Page padding | Stepper |
|---|---:|---:|---:|---|
| Wide desktop ≥1440 px | 1360 px | 760 px | 40 px | 240 px side rail |
| Desktop 1024–1439 px | 1200–1280 px | 720 px | 32 px | 220–240 px side rail |
| Tablet 768–1023 px | 760 px | 100% | 32 px | Compact top navigator |
| Mobile <768 px | 100% | 100% | 20–24 px | Step X of 9 + progress line |

## 26.2 Sticky actions

- Desktop/tablet: action bar sticks below viewport when page content exceeds viewport height.
- Mobile: bottom action bar is always available after the user scrolls past the first field, without covering inputs.
- Add bottom content padding equal to action-bar height plus safe-area inset.
- When the mobile keyboard is open, the bar may become non-sticky if necessary to avoid covering the active input.

## 26.3 Upload behaviour

### Desktop

- Drag and drop plus button
- Document uploader full width within form
- Photos grid three or four columns

### Tablet

- Drag/drop remains available
- Photos grid three columns

### Mobile

- File-selection buttons are primary; drag/drop language is removed
- Document upload uses file picker, not camera by default
- Photo upload offers Gallery and Camera
- Photo grid two columns
- Reorder mode uses explicit controls

## 26.4 Review cards

- Desktop section cards may use a single wide list with compact summaries.
- Property summary uses two columns with cover image.
- Tablet and mobile stack all content.
- Edit action remains at logical end of card header.

## 26.5 Numeric keyboards

Use numeric or decimal-appropriate mobile keyboards for:

- Bedrooms custom number
- Bathrooms custom number
- Size
- Parking
- Asking price
- Notification threshold
- Purchase price
- Renovation spend

Do not use a decimal keyboard for whole-AED amounts unless the browser platform provides no better option; decimals are rejected or rounded only after explicit user correction, never silently.

## 26.6 Safe areas

Mobile bottom action bars and dialogs must account for:

- iOS home indicator
- Android gesture navigation
- Browser toolbars
- Landscape orientation

## 26.7 200% zoom and text scaling

- Layout reflows into single column.
- Stepper may become compact.
- No content clipping.
- No fixed-height cards for descriptions or errors.
- Buttons grow vertically for wrapped labels.
- Photo actions remain accessible without hover.

---

# 27. Arabic and RTL Behaviour

All Arabic product, property, financial, legal, and regulatory terminology in this document is draft and requires professional review before release.

## 27.1 What mirrors

- Wizard side rail moves to logical inline start in RTL
- Help rail moves to the opposite side
- Step progress flows right to left
- Back and Continue positions mirror using logical action order
- Directional arrows mirror
- Edit and overflow actions align to logical end
- Form labels, errors, and helper text align to logical start
- Simulation and privacy panels mirror icon placement
- Review layout and property summary mirror
- Mobile action-bar arrangement mirrors

## 27.2 What remains left-to-right

- Western file names when authored LTR
- File extensions
- URLs
- Storage or support reference codes
- Decimal values and percentages as isolated numeric runs
- `AED` when Latin abbreviation is retained
- Square-foot values
- QR reference tokens
- Dates when shown in ISO only in internal/debug contexts

User-facing dates should use locale formatting rather than ISO.

## 27.3 Currency input

- Page and label are RTL.
- Numeric value is bidi-isolated.
- Accept Arabic-Indic digits (`٠١٢٣٤٥٦٧٨٩`) and Western digits.
- Normalize internally to standard numeric values.
- Display locale-formatted numbers after blur.
- Announce `المبلغ بالدرهم الإماراتي` after professional review.
- Do not reverse commas, digits, or decimal symbols.

## 27.4 Numbers and calculations

- Metric order follows RTL layout.
- Positive and negative signs remain attached to the number.
- Percentage symbol placement follows locale formatting.
- Screen-reader accessible labels must announce the metric name before value.
- `Price per sq ft` requires reviewed Arabic property terminology.

## 27.5 File names

Use bidi isolation around file names and preserve original direction. File action labels remain Arabic and include the file context.

## 27.6 Date input

- Calendar and labels mirror.
- User-facing date uses Arabic locale.
- Underlying ISO storage is not exposed.
- Numeric segments remain predictable and screen-reader labelled.

## 27.7 Photo grid order

Persist a numeric photo order independent of visual direction.

- In English, order 1 begins at visual inline start on the left.
- In Arabic, order 1 begins at visual inline start on the right.
- The cover image remains order-independent; it may be any tile.
- Reorder announcements state explicit position numbers.

## 27.8 Mixed property names

Dubai building and community names may be entered in English or Arabic.

- Preserve customer-entered spelling.
- Use bidi isolation for mixed names.
- Do not auto-translate proper names.
- Seeded location options should include reviewed Arabic display labels where available.

## 27.9 Step names

Step labels should be translated, while raw domain enum values must never appear to users.

## 27.10 Mobile RTL

- Progress line fills from the right.
- Back action appears at logical start according to RTL conventions.
- Continue remains the visually dominant action.
- Long Arabic action labels may wrap; do not reduce text below accessible sizing.
- Full-width mobile sheets open and close consistently with RTL direction.

---

# 28. Accessibility Requirements

Target WCAG 2.2 AA.

## 28.1 Headings and landmarks

- Customer header uses `header` landmark.
- Wizard step rail uses labelled `nav`.
- Form content uses one `main`.
- One `h1` per route.
- Form sections use `h2` in logical order.
- Footer/action region is distinguishable but does not create duplicate main landmarks.

## 28.2 Stepper semantics

- Render as an ordered list.
- Current step uses `aria-current="step"`.
- Completed, optional skipped, pending, failed, and locked states are included in accessible text.
- Locked steps are not focusable links.
- Do not communicate completion through check icons alone.

## 28.3 Form labels and errors

- Every field has a persistent visible label.
- Helper and error messages are connected through described-by relationships.
- Invalid controls expose invalid state.
- Required state is programmatic and visible.
- On failed Continue, focus moves to an error summary.
- Summary links move focus to the relevant field.
- Errors clear only after the condition resolves.

## 28.4 Focus movement

- Route change focuses the new `h1`.
- Opening a dialog moves focus into it.
- Closing returns focus to the trigger.
- Returning from an edited Review section focuses the relevant Review card.
- Simulation completion focuses the status heading.
- Upload failure focuses or announces the failed file row without unexpectedly moving keyboard focus while typing elsewhere.

## 28.5 Upload accessibility

- A native file input is available.
- Drag and drop is never the only upload method.
- Accepted type and size rules are visible and announced.
- Upload progress uses progress semantics where determinate.
- Multiple file statuses are individually named.
- Remove and Replace controls include file context.

## 28.6 Photo reordering

- Pointer drag is optional convenience.
- Keyboard and mobile controls provide Move earlier/later/first/last.
- Each operation announces: `Photograph moved to position {n} of {total}.`
- Focus remains on the moved photograph control.

## 28.7 Status and live regions

- Autosave failures use assertive alert once.
- Successful autosaves are not announced repeatedly.
- Explicit blocking save completion may use polite status.
- Pending/success/failure changes are announced once.
- Countdown-free simulation pending states avoid noisy announcements.

## 28.8 Currency and calculations

- Currency input label includes UAE dirhams.
- Formatted visual separators do not prevent accurate screen-reader output.
- Investment metrics expose full values, not abbreviations such as `2.1M` as the only text.
- Changes to calculation summary use a polite region after the user pauses, not per keystroke.
- Positive/negative meaning is included in text.

## 28.9 Contrast and focus

- Text meets 4.5:1 normal contrast.
- Large text and UI boundaries meet applicable AA requirements.
- Focus indicator is at least 2 px and clearly visible on blue, white, and off-white surfaces.
- Muted text uses the corrected accessible shared token, not the earlier low-contrast value.
- Disabled action reason is visible nearby.

## 28.10 Touch targets

- All buttons, icon controls, tiles, checkboxes, menus, and reorder actions: minimum 44 × 44 px.
- Photo tile overflow is not smaller than 44 px.
- Mobile sticky actions have at least 48 px height.

## 28.11 Reduced motion

- Respect reduced-motion settings.
- Remove animated step transitions and drag shifting where possible.
- Use static spinners or text alternatives where required.
- No celebratory animation.

## 28.12 Screen-reader RTL considerations

- Set page language correctly.
- Isolate LTR file names, prices, and references.
- Avoid reading raw English enum values inside Arabic sentences.
- Test stepper, currency, photo order, and mixed community names with Arabic screen-reader settings.

---

# 29. Exact English Copy

The detailed screen sections are authoritative. This table provides implementation catalogue keys and primary copy.

## 29.1 Global and wizard

| Key | English |
|---|---|
| `listing.myListings.title` | My listings |
| `listing.myListings.description` | Create and manage the properties you want to list on MARKAZ. |
| `listing.create` | Create new listing |
| `listing.continue` | Continue listing |
| `listing.saveExit` | Save and exit |
| `listing.back` | Back |
| `listing.saveContinue` | Save and continue |
| `listing.saving` | Saving… |
| `listing.savedNow` | Saved just now |
| `listing.saveFailed` | Couldn’t save changes |
| `listing.offline` | Offline · Changes not saved |
| `listing.privateDraft` | Private draft |
| `listing.actionRequired` | Action required |
| `listing.optional` | Optional |
| `listing.skipped` | Skipped · Optional |
| `listing.complete` | Complete |
| `listing.inProgress` | In progress |
| `listing.ready` | Ready to publish |

## 29.2 Property Details

| Key | English |
|---|---|
| `details.step` | Step 1 of 9 · Property details |
| `details.title` | Tell us about the property |
| `details.description` | Start with the essential information buyers will use to understand the property. You can return and update these details before publication. |
| `details.type` | Property type |
| `details.emirate` | Emirate |
| `details.dubaiOnly` | This prototype currently supports residential property listings in Dubai. |
| `details.community` | Area or community |
| `details.communityPlaceholder` | Search for an area, such as Dubai Marina |
| `details.building` | Building or project |
| `details.buildingPlaceholder` | Enter the building or project name |
| `details.identifier` | Unit or property identifier |
| `details.identifierPlaceholder` | For example, Unit 2205 or Villa 27 |
| `details.identifierPrivate` | Kept private. This helps connect your fictional sample document to the listing. |
| `details.bedrooms` | Bedrooms |
| `details.bathrooms` | Bathrooms |
| `details.size` | Property size |
| `details.sizeUnit` | sq ft |
| `details.furnishing` | Furnishing status |
| `details.occupancy` | Occupancy status |
| `details.completion` | Completion status |
| `details.parking` | Parking spaces |
| `details.descriptionLabel` | Property description |
| `details.descriptionPlaceholder` | Describe the layout, condition, views, natural light, recent improvements, and what makes the property distinctive. |
| `details.amenities` | Features and amenities |
| `details.submitLoading` | Saving property details… |

## 29.3 Ownership Document

| Key | English |
|---|---|
| `ownership.step` | Step 2 of 9 · Ownership document |
| `ownership.title` | Add a fictional ownership document |
| `ownership.description` | Choose the document type and upload one fictional sample file for the simulated ownership check. |
| `ownership.safetyTitle` | Use a fictional sample document only |
| `ownership.safetyBody1` | For this prototype, use a fictional sample document only. |
| `ownership.safetyBody2` | Do not upload a real Title Deed, Oqood, Emirates ID, passport, or other sensitive document. |
| `ownership.titleDeed` | Title Deed |
| `ownership.oqood` | Oqood |
| `ownership.privateTitle` | Private document |
| `ownership.privateBody` | This file is visible only to you and authorised MARKAZ Operations users. It will not appear on the public listing or listing preview. The check is simulated and does not connect to official property or government records. |
| `ownership.drop` | Drag a fictional sample file here, or choose a file |
| `ownership.types` | PDF, JPG or PNG · Maximum 10 MB |
| `ownership.uploading` | Uploading… {percent}% |
| `ownership.uploaded` | Uploaded privately |
| `ownership.replace` | Replace file |
| `ownership.remove` | Remove file |

## 29.4 Ownership Verification

| Key | English |
|---|---|
| `verification.step` | Step 3 of 9 · Ownership check |
| `verification.disclosureTitle` | Ownership verification simulated |
| `verification.disclosureBody` | This prototype does not connect to official property or government records. |
| `verification.introTitle` | Run the simulated ownership check |
| `verification.introBody` | We will compare the fictional sample document with the private property information in this listing. |
| `verification.start` | Start simulated check |
| `verification.pendingTitle` | Ownership check in progress |
| `verification.pendingBody` | The simulated check is reviewing the fictional document and listing details. You can leave this page and return later. |
| `verification.successTitle` | Ownership verification simulated |
| `verification.successBody` | The fictional document and listing details matched for this demo. |
| `verification.failedMismatchTitle` | The demo details did not match |
| `verification.failedUnreadableTitle` | The fictional sample could not be reviewed |
| `verification.retry` | Try the check again |

## 29.5 Listing Settings

| Key | English |
|---|---|
| `settings.step` | Step 4 of 9 · Listing settings |
| `settings.title` | Set your price and offer preference |
| `settings.description` | Choose the asking price and the lowest offer amount you want to be notified about. |
| `settings.asking` | Asking price |
| `settings.askingHelp` | This will be the advertised price when the listing is published in a later step. |
| `settings.threshold` | Minimum offer notification |
| `settings.thresholdHelp` | Choose the lowest offer amount you want to be notified about. Lower offers may still appear in your offer history, but you will not receive an immediate notification. |
| `settings.notificationDemo` | Offer notifications will be simulated in a later milestone. |
| `settings.comparison` | Demo area comparison |
| `settings.visibilityTitle` | Current visibility: Private draft |
| `settings.visibilityBody` | The listing will not appear publicly during this milestone. |
| `settings.submitLoading` | Saving listing settings… |

## 29.6 Investment Case

| Key | English |
|---|---|
| `investment.step` | Step 5 of 9 · Investment Case · Optional |
| `investment.title` | Add an Investment Case |
| `investment.description` | Share optional purchase-history information and an estimated return summary with future buyers. |
| `investment.privacy` | Purchase history is optional. You choose whether the calculated Investment Case will appear on the future public listing. |
| `investment.add` | Add Investment Case |
| `investment.skip` | Skip for now |
| `investment.originalPrice` | Original purchase price |
| `investment.purchaseDate` | Purchase date |
| `investment.renovation` | Renovation or improvement spend |
| `investment.visibility` | Show the Investment Case on the future public listing |
| `investment.totalInvested` | Total invested |
| `investment.gain` | Estimated gain |
| `investment.roi` | Estimated ROI |
| `investment.annualised` | Estimated annualised return |
| `investment.priceSqft` | Asking price per sq ft |
| `investment.areaAverage` | Demo area average per sq ft |
| `investment.cardTitle` | Estimated Investment Case |
| `investment.disclaimer` | Estimates are based only on the values entered for this demo. They do not include transaction costs, financing, rental income, taxes, service charges, or market changes. |
| `investment.save` | Save Investment Case |
| `investment.remove` | Remove Investment Case |

## 29.7 Simulated Form A

| Key | English |
|---|---|
| `formA.step` | Step 6 of 9 · Simulated Form A |
| `formA.disclosureTitle` | Simulated Form A |
| `formA.disclosureBody` | This prototype does not create or submit a legal Form A. |
| `formA.title` | Review the simulated listing agreement |
| `formA.description` | Form A is normally used to document the relationship between a property owner and a real-estate brokerage. This prototype shows a simplified, non-legal simulation of that step. |
| `formA.confirm` | I confirm the demo listing details above. |
| `formA.complete` | Complete simulated Form A |
| `formA.pendingTitle` | Simulated Form A in progress |
| `formA.successTitle` | Simulated Form A complete |
| `formA.successBody` | The demo confirmation has been recorded for this listing. |
| `formA.failureTitle` | We could not complete the Form A simulation |

## 29.8 Photos

| Key | English |
|---|---|
| `photos.step` | Step 7 of 9 · Property photos |
| `photos.title` | Add property photographs |
| `photos.description` | Upload clear photographs that show the property accurately. Choose the strongest landscape image as the cover. |
| `photos.guidance` | For the strongest listing, include the living area, bedrooms, kitchen, bathrooms, exterior or balcony, and any important view or amenity. |
| `photos.drop` | Drag photographs here, or choose photographs |
| `photos.rules` | JPG, PNG or WebP · Up to 20 files · Maximum 12 MB each |
| `photos.gallery` | Choose from gallery |
| `photos.camera` | Take a photo |
| `photos.cover` | Cover photograph |
| `photos.setCover` | Set as cover |
| `photos.replace` | Replace photograph |
| `photos.remove` | Remove photograph |
| `photos.reorder` | Reorder photographs |
| `photos.save` | Save photos and continue |

## 29.9 Simulated Trakheesi

| Key | English |
|---|---|
| `permit.step` | Step 8 of 9 · Simulated Trakheesi |
| `permit.disclosureTitle` | Simulated Trakheesi |
| `permit.disclosureBody` | This prototype does not submit information to the official Trakheesi service. |
| `permit.title` | Prepare the demo permit application |
| `permit.description` | Review the listing information that will be used for this simulated permit step. |
| `permit.confirm` | I confirm the demo listing information is ready for the simulated permit step. |
| `permit.submit` | Submit simulated application |
| `permit.pendingTitle` | Demo permit application in progress |
| `permit.approvedTitle` | Demo permit approved |
| `permit.approvedBody` | The simulated Trakheesi step is complete. Review the full listing before marking it ready to publish. |
| `permit.failedTitle` | The demo permit step was not completed |
| `permit.qr` | Simulated Madmoun QR · Demo only |

## 29.10 Review and Ready

| Key | English |
|---|---|
| `review.step` | Step 9 of 9 · Review |
| `review.title` | Review your listing |
| `review.description` | Check the property information, demo verification steps, price, and photographs before marking the listing ready to publish. |
| `review.completeTitle` | All required sections are complete |
| `review.incompleteTitle` | {count} items need attention |
| `review.prototypeTitle` | Prototype listing |
| `review.prototypeBody` | Ownership verification, Form A, Trakheesi, and permit results in this prototype are simulated. They do not represent official government, legal, or property approval. |
| `review.notPublicTitle` | Not yet public |
| `review.notPublicBody` | Marking the listing ready does not publish it. Publication will be handled in a later product stage. |
| `review.acknowledge` | I have reviewed the listing and understand it will remain private until a future publication step. |
| `review.readyAction` | Mark listing ready |
| `review.checking` | Checking listing readiness… |
| `ready.title` | Your listing is ready |
| `ready.description` | You have completed the required property details, demo verification steps, photographs, and listing settings. |
| `ready.notLive` | Your listing is not live yet. Review the preview before publishing in the next product stage. |
| `ready.preview` | View listing preview |
| `ready.myListings` | Return to My Listings |
| `ready.continueLater` | Continue later |
| `ready.nextTitle` | Next stage: Publication |
| `ready.nextBody` | Publishing the listing will be added in the next product milestone. |
| `preview.bannerTitle` | Private preview |
| `preview.bannerBody` | Only you can view this draft. The listing is not live. |

---

# 30. Arabic Copy and Review Flags

## 30.1 Status

All Arabic below is **draft**. It must receive professional Arabic review. Property, legal, government, investment, and permit terminology requires business/legal review as noted.

| English | Draft Arabic | Review |
|---|---|---|
| My listings | عقاراتي المدرجة | Property/language |
| Create new listing | إنشاء إعلان عقاري جديد | Property/language |
| Continue listing | متابعة إعداد الإعلان | Property/language |
| Save and exit | حفظ وخروج | Language |
| Save and continue | حفظ ومتابعة | Language |
| Saved just now | تم الحفظ الآن | Language |
| Couldn’t save changes | تعذّر حفظ التغييرات | Language |
| Private draft | مسودة خاصة | Property/language |
| Step {current} of 9 | الخطوة {current} من 9 | Language |
| Property details | تفاصيل العقار | Property/language |
| Tell us about the property | أخبرنا عن العقار | Property/language |
| Property type | نوع العقار | Property/language |
| Apartment | شقة | Property/language |
| Villa | فيلا | Property/language |
| Townhouse | تاون هاوس | Property/language |
| Penthouse | بنتهاوس | Property/language |
| Emirate | الإمارة | Property/language |
| Area or community | المنطقة أو المجمع | Property/language |
| Building or project | المبنى أو المشروع | Property/language |
| Unit or property identifier | رقم الوحدة أو معرّف العقار | Property/security/language |
| Bedrooms | غرف النوم | Property/language |
| Studio | استوديو | Property/language |
| Bathrooms | الحمّامات | Property/language |
| Property size | مساحة العقار | Property/language |
| sq ft | قدم مربع | Property/language |
| Furnishing status | حالة التأثيث | Property/language |
| Occupancy status | حالة الإشغال | Property/language |
| Completion status | حالة الإنجاز | Property/language |
| Parking spaces | مواقف السيارات | Property/language |
| Property description | وصف العقار | Property/language |
| Features and amenities | المزايا والمرافق | Property/language |
| Ownership document | مستند الملكية | Legal/property/language |
| Add a fictional ownership document | أضف مستند ملكية افتراضيًا | Legal/property/language |
| Use a fictional sample document only | استخدم مستندًا تجريبيًا وهميًا فقط | Security/legal/language |
| Do not upload a real Title Deed, Oqood, Emirates ID, passport, or other sensitive document. | لا ترفع سند ملكية حقيقيًا أو مستند عقود أو هوية إماراتية أو جواز سفر أو أي مستند حساس آخر. | Legal/security/professional review |
| Title Deed | سند الملكية | Legal/property |
| Oqood | عقود | Legal/property |
| Private document | مستند خاص | Security/language |
| Uploaded privately | تم الرفع بشكل خاص | Security/language |
| Ownership verification simulated | محاكاة التحقق من الملكية | Legal/simulation/language |
| This prototype does not connect to official property or government records. | هذا النموذج الأولي غير متصل بسجلات العقارات أو الجهات الحكومية الرسمية. | Legal/simulation/language |
| Start simulated check | بدء الفحص التجريبي | Simulation/language |
| Ownership check in progress | فحص الملكية التجريبي قيد التنفيذ | Simulation/language |
| Verified · Demo | تم التحقق · تجريبي | Simulation/language |
| Listing settings | إعدادات الإعلان | Property/language |
| Asking price | السعر المطلوب | Property/language |
| Minimum offer notification | الحد الأدنى لإشعار العرض | Product/property/language |
| Private draft | مسودة خاصة | Property/language |
| Investment Case | ملخص الاستثمار | Finance/product review |
| Add an Investment Case | إضافة ملخص استثماري | Finance/product review |
| Original purchase price | سعر الشراء الأصلي | Finance/language |
| Purchase date | تاريخ الشراء | Finance/language |
| Renovation or improvement spend | تكاليف التجديد أو التحسين | Finance/language |
| Total invested | إجمالي المبلغ المستثمر | Finance/language |
| Estimated gain | الربح التقديري | Finance/legal/language |
| Estimated ROI | العائد التقديري على الاستثمار | Finance/legal/language |
| Estimated annualised return | العائد السنوي التقديري | Finance/legal/language |
| Asking price per sq ft | السعر المطلوب لكل قدم مربع | Finance/property/language |
| Simulated Form A | نموذج A تجريبي | Legal/business/language |
| This prototype does not create or submit a legal Form A. | هذا النموذج الأولي لا ينشئ أو يقدّم نموذج A قانونيًا. | Legal/professional review |
| Simulated Form A complete | اكتمل نموذج A التجريبي | Legal/simulation/language |
| Property photographs | صور العقار | Property/language |
| Add property photographs | أضف صور العقار | Property/language |
| Cover photograph | الصورة الرئيسية | Property/language |
| Set as cover | تعيين كصورة رئيسية | Property/language |
| Reorder photographs | إعادة ترتيب الصور | Language |
| Simulated Trakheesi | ترخيصي تجريبي | Legal/government/professional review |
| This prototype does not submit information to the official Trakheesi service. | هذا النموذج الأولي لا يرسل معلومات إلى خدمة ترخيصي الرسمية. | Legal/government/professional review |
| Submit simulated application | إرسال الطلب التجريبي | Simulation/language |
| Demo permit approved | تمت الموافقة على التصريح التجريبي | Legal/government/professional review |
| Simulated Madmoun QR · Demo only | رمز مضمون تجريبي · للعرض فقط | Legal/government/professional review |
| Review your listing | راجع إعلانك العقاري | Property/language |
| All required sections are complete | اكتملت جميع الأقسام المطلوبة | Language |
| Mark listing ready | تعيين الإعلان كجاهز | Product/property/language |
| Your listing is ready | إعلانك جاهز | Property/language |
| Your listing is not live yet. | إعلانك غير منشور بعد. | Property/language |
| View listing preview | عرض معاينة الإعلان | Property/language |
| Return to My Listings | العودة إلى عقاراتي المدرجة | Property/language |
| Private preview | معاينة خاصة | Property/language |

## 30.2 Arabic review rules

- Do not represent these translations as legally approved.
- Confirm the official preferred Arabic rendering of Title Deed, Oqood, Form A, Trakheesi, and Madmoun with a UAE property/legal reviewer.
- Keep `MARKAZ` brand rendering consistent with the approved brand decision.
- Do not automatically translate building names entered in English.

---

# 31. Security and Privacy Design Rules

1. Display the fictional-document warning before every private ownership upload.
2. Do not accept an interface flow that encourages real Emirates ID, passport, or identity-document upload.
3. Ownership documents use the private bucket and signed access only.
4. Do not show public URLs, storage paths, object keys, or raw metadata.
5. Do not include document content, file bytes, extracted text, or document file names in analytics.
6. Avoid file name in audit metadata; use document ID and type only.
7. Listing photographs are separate from private documents and may later become public.
8. Preview excludes private files and identifiers.
9. Server and RLS checks determine listing ownership on every query and mutation.
10. Not-found and forbidden states share generic copy to prevent record enumeration.
11. State-changing actions use server validation and idempotency where required by architecture.
12. Autosave does not place private data in general local storage unless separately security-reviewed.
13. Session expiry clears sensitive in-memory upload selections.
14. Simulation services cannot make official claims.
15. Madmoun demo assets contain no personal or private listing data.
16. Never log raw storage errors, presigned URLs, private object paths, or uploaded file contents.
17. Photo previews must not allow script execution through unsafe file formats; SVG is not accepted.
18. Replacements and deletions remove orphaned objects through authorised server operations.
19. Customer-facing errors never expose database tables, Supabase internals, bucket names, or worker names.
20. Only non-sensitive audit events listed below should be considered.

## 31.1 Meaningful audit events

| Event | Trigger | Safe metadata |
|---|---|---|
| `listing.created` | New draft created | Listing ID, customer ID, timestamp |
| `listing.details_completed` | Details first become valid | Listing ID, property ID, timestamp |
| `listing.ownership_document_uploaded` | Active file saved | Listing ID, document ID, document type, timestamp |
| `listing.ownership_document_replaced` | Active file replaced | Listing ID, old/new document IDs, timestamp |
| `listing.ownership_document_removed` | File removed | Listing ID, document ID, timestamp |
| `listing.ownership_verification_started` | Demo check begins | Listing ID, verification ID, timestamp |
| `listing.ownership_verification_verified` | Demo success | Listing ID, verification ID, timestamp |
| `listing.ownership_verification_failed` | Demo failure | Listing ID, verification ID, safe reason category, timestamp |
| `listing.settings_updated` | Price/threshold saved | Listing ID, timestamp; avoid unnecessary full value duplication if DB already stores it |
| `listing.investment_case_added` | Optional case saved | Listing ID, visibility flag, timestamp |
| `listing.investment_case_removed` | Optional case removed | Listing ID, timestamp |
| `listing.form_a_completed_demo` | Simulation completes | Listing ID, record ID, timestamp |
| `listing.form_a_failed_demo` | Simulation fails | Listing ID, record ID, safe reason category |
| `listing.photo_uploaded` | Photo saved | Listing ID, photo ID, timestamp |
| `listing.photo_removed` | Photo removed | Listing ID, photo ID, timestamp |
| `listing.photos_reordered` | Order saved | Listing ID, photo IDs/order, timestamp |
| `listing.cover_photo_changed` | Cover changed | Listing ID, photo ID, timestamp |
| `listing.permit_submitted_demo` | Demo permit starts | Listing ID, permit ID, timestamp |
| `listing.permit_approved_demo` | Demo approval | Listing ID, permit ID, timestamp |
| `listing.permit_failed_demo` | Demo failure | Listing ID, permit ID, safe reason category |
| `listing.ready_to_publish` | Customer confirms Review | Listing ID, customer ID, timestamp |
| `listing.draft_deleted` | Customer deletes draft | Listing ID, timestamp |

Never capture:

- Ownership-document contents
- Real identity information
- Signed URLs
- Storage paths intended to be private
- Image binary data
- Free-text description in audit payloads
- Browser local file paths
- Session tokens

---

# 32. Design-to-Engineering Handoff Tables

## 32.1 Core screen handoff

| ID | Route / screen | Listing state | Entry conditions | Required data | Primary action | Secondary actions | Components | Validation | Loading | Failure | Success / transition | Audit | Responsive / RTL / A11y | Claude Code notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| L-01 | `/[locale]/sell` Empty | None | Authenticated complete CUSTOMER, no listings | Customer profile | Create new listing | Dashboard | Customer shell, empty state | None | Listing list skeleton | Generic list error | `/sell/new` | None | Stack mobile; RTL mirror; h1 focus | Reuse existing customer nav; no seller role gate |
| L-02 | `/[locale]/sell` Drafts | Mixed pre-live | Customer owns listings | Listings, derived progress, next step | Continue listing | Preview, delete, create | Listing cards, progress, status | Ownership enforced server-side | Card skeleton | Generic unavailable | Step resolver | Delete only | Single-column mobile; status text | Query own listings through RLS |
| L-03 | `/sell/new` Resume prompt | Recent `DRAFT` | Recent near-empty draft exists | Draft ID/time | Continue recent listing | Create another, view all | Dialog | Ownership and state | Creating/resolving | Creation error | Existing/new `/details` | `listing.created` if new | Mobile full-screen dialog; focus trap | Multiple drafts allowed |
| L-04 | `/details` | `DRAFT` | Owner, onboarding complete | Property fields | Save and continue | Back, Save and exit | Wizard, fields, tiles | Details matrix | Saving | Save/validation | `DETAILS_COMPLETE` → ownership | details completed | 2-col desktop, stack mobile; RTL logical | Extend schema for approved fields if absent; server schema authoritative |
| L-05 | `/ownership` | `DETAILS_COMPLETE` / `DOCUMENT_UPLOADED` | Details complete | Document type/file metadata | Save and continue | Replace/remove, Back, exit | Private uploader, type selector, privacy panel | Type/file/size | Upload progress | Upload error | `DOCUMENT_UPLOADED` → verification | upload/replace/remove | Mobile picker; filename bidi; native file input | Private bucket; one active document; no OCR |
| L-06 | `/verification` Intro | `DOCUMENT_UPLOADED` | Active document | Property/document summary | Start simulated check | Replace document, exit | Simulation panel | Active doc and details | Starting | Start failure | `OWNERSHIP_REVIEW` | verification started | Status semantics; disclosure visible | Service interface; idempotent start |
| L-07 | `/verification` Pending | `OWNERSHIP_REVIEW` | Verification `PENDING` | Attempt status | Return to My Listings | Refresh | Pending panel | None | Refreshing | Provider unavailable | Success/failure state | None | No fake percent; live status | Re-fetch authoritative result; Realtime optional |
| L-08 | `/verification` Success | `OWNERSHIP_VERIFIED` | Verification `VERIFIED` | Summary/time | Continue to settings | View metadata | Success panel | None | None | Invalidation state | Settings | verification verified | Demo label announced | Never say official verified |
| L-09 | `/verification` Failure | Recoverable review | Verification `FAILED` | Safe reason category | Correct/replace | Retry, exit | Failure panel | Correct prerequisite | Retrying | Retry failure | Pending/success | verification failed | Action text; no colour-only | Do not transition listing to permanent REJECTED |
| L-10 | `/settings` | `OWNERSHIP_VERIFIED` | Ownership verified | Asking, threshold, optional demo comparison | Save and continue | Back, exit | AED inputs, info cards | Price matrix | Saving | Save/validation | Investment Case | settings updated | Numeric mobile; bidi currency | No visibility toggle; private draft fixed |
| L-11 | `/investment-case` Intro | `OWNERSHIP_VERIFIED` | Settings complete; no case | Asking, size | Add Investment Case | Skip, Back | Optional intro, dependency alerts | Dependencies | Loading sources | Source unavailable | Form or Form A | optional skipped only if audited by design | Stack; clear optional label | Skip does not block state transition |
| L-12 | `/investment-case` Form | Same | User adds/edits case | Purchase data, asking, size, area demo | Save Investment Case | Remove/skip, Back | Currency/date, metrics, preview | Investment matrix | Calculating/saving | Calculation/save | Form A | added/removed | Metric announcements; RTL number isolation | Use decimal-safe shared utilities; annualised return, not IRR |
| L-13 | `/form-a` Review | `OWNERSHIP_VERIFIED` | Settings complete | Profile/property/settings | Complete simulated Form A | Back, exit | Disclosure, summary, checkbox | Confirmation; material field currency | Completing | Failure | `FORM_A_COMPLETE` | form A complete | Legal copy review; focus | No legal document or signature capture |
| L-14 | `/form-a` Pending | Transitional | Service pending | Record status | Return/refresh | Exit | Pending panel | None | Pending | Service failure | Success/failure | None | Status announcements | Avoid artificial delay |
| L-15 | `/form-a` Success | `FORM_A_COMPLETE` | Record signed demo | Summary/time | Continue to photos | Review details | Success panel | None | None | Invalidation | Photos | None | Demo status text | Material edits invalidate completion |
| L-16 | `/form-a` Failure | Recoverable | Service failed | Safe reason | Try again | Review details, exit | Failure panel | Prerequisites | Retrying | Retry failure | Pending/success | form A failed | Clear recovery | Preserve listing data |
| L-17 | `/photos` Empty | `FORM_A_COMPLETE` | Form A current | Upload rules | Choose photographs | Back, exit | Photo uploader/guidance | Files | Uploading | File failures | Organise grid | photo uploaded | Camera/gallery mobile; native input | Public-future bucket; not public until publication |
| L-18 | `/photos` Grid | `FORM_A_COMPLETE` / `PHOTOS_COMPLETE` | ≥1 photo | Photos/order/cover | Save photos and continue | Reorder, replace, remove | Photo grid/tiles | ≥1, cover, no active errors | Saving order/uploads | Individual failures | `PHOTOS_COMPLETE` → Trakheesi | photo/reorder/cover | Keyboard reorder; grid RTL | Existing state machine min one; recommend 5–12 |
| L-19 | `/trakheesi` Intro | `PHOTOS_COMPLETE` | Required sections current | Summary, confirmations | Submit simulated application | Review details | Disclosure, summary, dialog | Prerequisites/checkbox | Submitting | Submission fail | `PERMIT_PENDING` | permit submitted | Legal/government review | Service interface; no official calls |
| L-20 | `/trakheesi` Pending | `PERMIT_PENDING` | Permit `PENDING` | Permit status | Return to My Listings | Refresh | Pending panel | None | Refreshing | Service failure | Approved/failed | None | No fake duration | Persist result; Realtime optional |
| L-21 | `/trakheesi` Approved | `PERMIT_PENDING`, record approved | Permit `APPROVED` | Permit/demo QR | Review listing | View details | Success panel, optional QR | All earlier current | None | Invalidation | Review | permit approved | QR labelled demo; screen-reader status | Do not set/live-display READY until Review confirm |
| L-22 | `/trakheesi` Failed | Recoverable | Permit `FAILED` | Safe reason | Review required info | Retry, exit | Failure panel | Correct prerequisites | Retrying | Retry failure | Pending/approved | permit failed | No official rejection wording | Do not permanent-REJECT listing |
| L-23 | `/review` Complete | Permit approved | All required complete | Full projection + private summaries | Mark listing ready | Edit sections, preview | Review cards, checklist, disclosures | Server readiness | Checking | Stale/incomplete | `READY_TO_PUBLISH` | listing ready | Mobile stack; status text; focus | Server revalidation and idempotent transition |
| L-24 | `/review` Incomplete | Any unmet requirement | Review accessed from resolver | Status list | Complete first item | Edit others | Missing summary, review cards | Derived completion | Loading statuses | Section errors | Remains review/step | None | Disabled reason visible | Normally redirect locked direct access; allow review summary when useful |
| L-25 | `/ready` | `READY_TO_PUBLISH` | Readiness transition complete | Property summary | View listing preview | Return to My Listings, Continue later | Success, property summary | State verified | Loading summary | Error | Preview/My Listings | None | No confetti; RTL mirror | No Publish button, no LIVE transition |
| L-26 | `/preview` | Pre-live owner-only | Own listing, adequate data | Public projection | Back to ready listing | Edit listing | Preview banner/gallery/details | Owner access | Skeleton | Not available | Ready/Edit | None | Responsive future listing; private banner | Exclude document, identifier, private inputs |

## 32.2 Global state handoff

| State | Entry | UI | Recovery | Security / implementation |
|---|---|---|---|---|
| Loading draft | Listing route opens | Wizard skeleton + `Loading your listing draft…` | Retry / My Listings after delay | Verify owner before rendering data |
| Save failed | Autosave/blocking save fails | Persistent banner; dirty status | Retry before leaving | Do not claim saved; version check |
| Offline | Browser/network unavailable | Persistent offline banner | Auto-detect reconnect + retry | No uploads/simulations; no unsafe local persistence |
| Session expired | Protected request fails auth | Redirect Sign In notice | Reauthenticate + safe return | Do not leak listing existence/details |
| Listing unavailable | Not found or not owner | Generic blocking panel | My Listings / Dashboard | Same response for not found and forbidden |
| Conflict | Newer version exists | Another-tab notice | Refresh | Optimistic concurrency required |
| Unexpected | Error boundary | Safe error panel/reference | Retry / My Listings | No raw provider/database/storage details |

## 32.3 Requirement labels for implementation tickets

- **[VISUAL]** Layout, type, colour, spacing, imagery, responsive presentation
- **[INTERACTION]** Input behaviour, autosave, step navigation, upload, reorder, focus
- **[PRODUCT]** Unified customer, required/optional rules, readiness, copy meaning
- **[SECURITY]** RLS, ownership, private files, safe routes, non-enumeration
- **[SIMULATION]** Disclosure, service state, non-official wording, retry
- **[ACCESSIBILITY]** Keyboard, semantics, announcements, contrast, target size
- **[I18N]** Message catalogue, RTL, locale numerals, bidi isolation
- **[OPTIONAL]** Non-blocking enhancement such as duplicate-photo detection

---

# 33. Required High-Fidelity Mockups

Mockups are required before implementation for the screens below. They should use the approved MARKAZ logo, architectural-blue system, existing customer navigation, realistic Dubai demo data, and exact copy from this specification.

## Priority 0 — approve before core UI implementation

| Mockup | Viewport | Key state | Why important | Must approve |
|---|---|---|---|---|
| 1. My Listings empty | Desktop 1440 px | First-time empty | Establishes seller-journey entry without a seller role | Page hierarchy, empty-state composition, customer nav continuity, CTA |
| 2. Property Details | Desktop 1440 px | Partially completed form | Defines wizard shell and core form language used everywhere | Side stepper, widths, field hierarchy, autosave, sticky actions, type tiles |
| 3. Ownership Document Upload | Desktop 1440 px | Document type selected, uploader empty | Highest privacy and trust risk | Fictional-file warning, private-document panel, upload styling, step navigation |
| 4. Ownership Verification Pending | Desktop 1440 px | `PENDING` | Establishes all simulation pending patterns | Demo disclosure, progress treatment, safe-leave messaging, actions |
| 5. Ownership Verification Success | Desktop 1440 px | `VERIFIED` | Establishes believable but non-official success | Status language, summary density, demo badge, next action |
| 6. Listing and Offer Settings | Desktop 1440 px | Valid asking/threshold with demo comparison | Key product concept and currency interaction | AED controls, threshold explanation, private status, comparison card |
| 7. Investment Case | Desktop 1440 px | Completed inputs, negative or positive example, visibility off/on | Most data-dense and calculation-sensitive screen | Metric styling, privacy, toggle, disclaimer, non-trading visual tone |
| 8. Simulated Form A | Desktop 1440 px | Review before confirmation | Legal-simulation risk | Disclosure, summary, confirmation checkbox, action hierarchy |
| 9. Property Photo Upload | Desktop 1440 px | 8 photos, uploads complete, cover selected | Complex upload and organisation | Grid, cover, reorder, menus, guidance, progress, sticky actions |
| 10. Simulated Trakheesi Pending | Desktop 1440 px | `PENDING` | Second critical simulation pattern | Disclosure, pending structure, safe return, distinction from ownership check |
| 11. Simulated Trakheesi Success | Desktop 1440 px | `APPROVED` with optional demo QR | Government-imitation risk | Demo permit wording, QR labelling, route to Review |
| 12. Final Review | Desktop 1440 px | Complete with Investment Case | Integrates all components and readiness decision | Section cards, statuses, disclosures, property summary, confirmation |
| 13. Ready to Publish | Desktop 1440 px | `READY_TO_PUBLISH` | Defines milestone completion without publication | Private/not-live hierarchy, preview CTA, no enabled publish action |

## Priority 1 — approve responsive and language patterns

| Mockup | Viewport | Key state | Why important | Must approve |
|---|---|---|---|---|
| 14. Key mobile screen: Property Photos | Mobile 390 × 844 | Two-column grid, reorder mode, sticky actions | Most interaction-heavy mobile screen | Safe-area action bar, camera/gallery controls, reorder accessibility, tile menus |
| 15. Arabic RTL screen: Listing Settings | Desktop 1440 px and mobile 390 px | Valid AED values | Validates mixed RTL, AED, numbers, stepper, and action order | Currency direction, labels, progress direction, helper/error alignment |

## Priority 2 — recommended polish mockups

- My Listings with three draft states: normal, pending simulation, action required
- Ownership failure/mismatch
- Form A success
- Trakheesi failure
- Review with missing requirements
- Mobile Property Details
- Private Listing Preview

## Mockup approval sequence

1. Wizard shell + Property Details
2. Private upload + ownership simulation
3. Settings + Investment Case
4. Form A + Photos
5. Trakheesi
6. Review + Ready
7. Mobile + Arabic RTL audit

Engineering may build domain/service groundwork in parallel, but should not finalise shared listing components before the relevant Priority 0 visual pattern is approved.

---

# 34. Open Design Decisions

| Decision | Current specification | Owner / required review |
|---|---|---|
| Production logo SVG | Approved concept only | Brand/design |
| Dubai-only listing support | Dubai only because Trakheesi journey is Dubai-specific | Product |
| Building requirement for villas/townhouses | Optional; community + private identifier sufficient | Product/property SME |
| Minimum photo count | 1 required to preserve existing state machine; 5 recommended | Product/engineering |
| Maximum photo count | 20 | Product/storage |
| Document max size | 10 MB | Security/storage |
| Photo max size | 12 MB each | Performance/storage |
| Photo minimum resolution warning | 1,600 × 1,200 recommended; non-blocking | Design/performance |
| File-virus or malware scanning | Not represented as complete; architecture/security decision needed before real uploads | Security/platform |
| Verification simulation resolution | Service-controlled; no fake duration | Engineering/demo owner |
| Permit simulation resolution | Service-controlled; no fake duration | Engineering/demo owner |
| Simulation failure state vs listing `REJECTED` | Keep retryable sub-record failure; reserve `REJECTED` for future Admin | Product/architecture |
| READY transition timing | Review confirmation after permit approval | Product/architecture |
| Area comparison dataset | Show only if seeded data exists and label Demo data | Product/data |
| Investment Case visibility default | Off | Product/privacy |
| Occupancy public visibility | Private in this milestone | Product/legal |
| Support route | Only show link if route exists | Product/operations |
| Arabic terminology | Draft only | Professional Arabic + UAE property/legal reviewer |
| Simulated Madmoun QR | Optional, non-functional, explicitly labelled | Product/legal/design |
| Autosave debounce | 800 ms | Engineering/UX validation |
| Multiple draft cap | No artificial cap | Product/platform |
| Local offline draft persistence | Not assumed or required | Security/product |

No unresolved item allows engineering to invent a user-facing interaction. Use the current decision unless the owner explicitly changes it.

---

# 35. Final Acceptance Checklist

## Account and access

- [ ] The listing journey is available to an onboarding-complete `CUSTOMER`.
- [ ] No Buyer/Seller role selection appears.
- [ ] No second account is requested.
- [ ] No Seller-only account or onboarding exists.
- [ ] Customer can access only their own listing drafts.
- [ ] Not-found and access-denied copy does not enumerate listings.

## Entry and drafts

- [ ] My Listings empty state is implemented.
- [ ] My Listings draft cards show progress, next step, and saved time.
- [ ] Create new listing creates `DRAFT`.
- [ ] Recent empty-draft resume prompt works.
- [ ] Multiple drafts are supported.
- [ ] Continue Listing resolves the correct step.
- [ ] Direct links verify ownership and prerequisite state.
- [ ] Draft delete removes related storage objects safely.

## Wizard navigation

- [ ] Nine visual steps are implemented.
- [ ] Desktop persistent step navigation works.
- [ ] Mobile Step X of 9 progress works.
- [ ] Current, complete, skipped, locked, pending, and failed states are visible in text.
- [ ] Completed steps can be revisited.
- [ ] Required future steps cannot be skipped.
- [ ] Save and Exit is available.
- [ ] Browser refresh resumes from database state.

## Property Details

- [ ] Property type is captured.
- [ ] Dubai-only prototype rule is visible.
- [ ] Community is captured.
- [ ] Building/project conditional validation works.
- [ ] Private unit/property identifier is captured and excluded from preview.
- [ ] Bedrooms, bathrooms, size, furnishing, occupancy, completion, and parking work.
- [ ] Description limits and counter work.
- [ ] Amenities work.
- [ ] Required/public/private distinctions are implemented.
- [ ] Completion transitions to `DETAILS_COMPLETE`.

## Ownership Document

- [ ] Title Deed and Oqood are supported.
- [ ] Fictional-document warning uses required copy.
- [ ] Real identity and sensitive document warning is visible.
- [ ] Private-document explanation is visible.
- [ ] PDF, JPG, and PNG validation works.
- [ ] 10 MB maximum is enforced.
- [ ] One active document is enforced.
- [ ] Upload progress works.
- [ ] Replace and remove work.
- [ ] Replacement invalidates verification.
- [ ] Private document never appears in preview.
- [ ] Successful upload transitions to `DOCUMENT_UPLOADED`.

## Ownership Verification

- [ ] Required simulation disclosure appears in every state.
- [ ] NOT_STARTED, PENDING, VERIFIED, and FAILED are implemented.
- [ ] Pending allows safe exit and return.
- [ ] Success wording is `Ownership verification simulated`.
- [ ] No official/DLD/legal verification wording appears.
- [ ] Failure offers correction and retry.
- [ ] Failed simulation remains recoverable.
- [ ] Success transitions to `OWNERSHIP_VERIFIED`.

## Listing Settings

- [ ] Asking price in AED is required.
- [ ] Whole-AED formatting works.
- [ ] Arabic-Indic and Western digits are accepted.
- [ ] Minimum offer notification is required.
- [ ] Threshold explanation uses approved copy.
- [ ] Threshold above asking price is blocked.
- [ ] Lower offers are not described as discarded.
- [ ] Notification simulation note is visible.
- [ ] Listing visibility is fixed as Private draft.
- [ ] Demo comparison appears only with seeded data.

## Investment Case

- [ ] Investment Case is explicitly optional.
- [ ] Add, Skip, Return later, Remove, and Edit work.
- [ ] Original purchase price, date, and renovation spend work.
- [ ] Total invested formula is correct.
- [ ] Estimated gain formula is correct.
- [ ] Estimated ROI formula is correct.
- [ ] Estimated annualised return formula is correct.
- [ ] True IRR wording is not used.
- [ ] Price per square foot formula is correct.
- [ ] Missing annualisation data is handled.
- [ ] Positive, neutral, negative, and unavailable states exist.
- [ ] Visibility toggle defaults off.
- [ ] Public preview respects visibility.
- [ ] Estimates disclaimer is visible.

## Simulated Form A

- [ ] Required Form A simulation disclosure appears.
- [ ] Purpose is explained in plain language.
- [ ] Customer, property, and listing summary is shown.
- [ ] Required demo confirmation checkbox exists.
- [ ] Pending, success, failure, and retry work.
- [ ] Success wording is `Simulated Form A complete`.
- [ ] No legal, official, binding, or DLD-submitted claims appear.
- [ ] Material later edits invalidate Form A.
- [ ] Completion transitions to `FORM_A_COMPLETE`.

## Property Photos

- [ ] Minimum one photo is enforced.
- [ ] Five to twelve is recommended.
- [ ] Maximum twenty is enforced.
- [ ] JPG, PNG, and WebP work.
- [ ] 12 MB limit works.
- [ ] Upload progress and retry work.
- [ ] Photo grid works.
- [ ] Cover photo is required.
- [ ] Reorder works with pointer, keyboard, and mobile alternative.
- [ ] Delete and Replace work.
- [ ] Low-resolution and portrait warnings are non-blocking.
- [ ] Mobile gallery and camera options work.
- [ ] Completion transitions to `PHOTOS_COMPLETE`.

## Simulated Trakheesi

- [ ] Required simulation disclosure appears in every state.
- [ ] NOT_STARTED, PENDING, APPROVED, and FAILED are implemented.
- [ ] Submission confirmation states no official service is used.
- [ ] Pending allows safe exit and return.
- [ ] Success wording is `Demo permit approved`.
- [ ] Failure offers correction and retry.
- [ ] No official/government/legal approval claims appear.
- [ ] Optional QR is labelled as simulated and contains no private data.
- [ ] Material edits invalidate approval.
- [ ] Listing remains unready until Review confirmation.

## Review and completion

- [ ] Review shows overall progress.
- [ ] Every section has status and Edit/Review action.
- [ ] Complete, optional skipped, missing, in progress, failed, and update-required states exist.
- [ ] Property summary and cover are visible.
- [ ] Ownership document is metadata-only and private.
- [ ] Simulation disclosures are visible.
- [ ] Not-yet-public disclosure is visible.
- [ ] Required acknowledgement exists.
- [ ] Server revalidates readiness.
- [ ] Incomplete listing cannot reach `READY_TO_PUBLISH`.
- [ ] Successful confirmation transitions to `READY_TO_PUBLISH`.
- [ ] Ready screen uses approved wording.
- [ ] Ready screen states listing is not live.
- [ ] Private preview works.
- [ ] No enabled Publish action exists.
- [ ] No `LIVE` transition exists in this milestone.

## Autosave and recovery

- [ ] Autosave occurs after stable changes and blur.
- [ ] Blocking save occurs on Continue and Save and Exit.
- [ ] Saving, Saved, Failed, and Offline states exist.
- [ ] Successful autosave does not show disruptive toasts.
- [ ] Save failure blocks unsafe progression.
- [ ] Leave dialog appears only with unsaved changes.
- [ ] Refresh loads authoritative server state.
- [ ] Incomplete file uploads require reselection.
- [ ] Multiple-tab conflict is handled.
- [ ] Session expiry safely returns after sign-in where allowed.

## Responsive, Arabic, and accessibility

- [ ] Desktop, tablet, and mobile layouts match the specification.
- [ ] Mobile sticky actions respect safe areas.
- [ ] Upload and photo grids adapt correctly.
- [ ] Arabic catalogue is present and flagged for review.
- [ ] RTL stepper, forms, actions, review, and grid are implemented.
- [ ] AED, numbers, dates, file names, and mixed names use bidi isolation.
- [ ] WCAG 2.2 AA contrast is met.
- [ ] One h1 and logical headings exist.
- [ ] Stepper uses ordered-list semantics and current-step state.
- [ ] All fields have visible labels and associated errors.
- [ ] Error summary and focus movement work.
- [ ] Upload is keyboard accessible.
- [ ] Photo reordering has non-drag alternatives.
- [ ] Loading and status changes are announced.
- [ ] Touch targets are at least 44 × 44 px.
- [ ] Reduced motion is respected.
- [ ] Currency and investment metrics are accessible.
- [ ] Automated axe checks cover key routes in English and Arabic.

## Security and audit

- [ ] Private-document bucket rules are preserved.
- [ ] Photo and document storage are not confused.
- [ ] Private URLs and paths are not exposed.
- [ ] Document contents are not logged or tracked.
- [ ] Preview excludes private content.
- [ ] RLS is tested for own and cross-customer listing access.
- [ ] State transitions and simulation actions write safe audit events.
- [ ] Audit payloads contain no document contents, signed URLs, local paths, or tokens.
- [ ] Raw database/storage/provider errors never appear in the interface.

## Visual approval

- [ ] All Priority 0 high-fidelity mockups are approved.
- [ ] Key mobile photo screen is approved.
- [ ] Arabic RTL Listing Settings screen is approved.
- [ ] Approved mockups use the production-ready MARKAZ SVG when available.

---

## Appendix A — Recommended Demo Listing Data

Use fictional data consistently in visuals and tests:

```text
Property: Marina Gate 2, Unit 2205
Type: Apartment
Community: Dubai Marina
Bedrooms: 2
Bathrooms: 3
Size: 1,284 sq ft
Furnishing: Furnished
Occupancy: Vacant
Completion: Ready
Parking: 1
Asking price: AED 2,100,000
Minimum offer notification: AED 1,950,000
Original purchase price: AED 1,750,000
Purchase date: 15 March 2022
Renovation spend: AED 50,000
Photos: 8 fictional property images
Ownership document: Fictional_Title_Deed_Marina_Gate_2205.pdf
```

All names, identifiers, documents, images, comparison values, QR assets, and records must be fictional and clearly safe for demonstration.

## Appendix B — Final Design Intent

The listing journey should communicate:

> Your property listing is progressing through a clear, private, and understandable setup process. Your work is saved, every required step is visible, and simulated checks are identified honestly.

It should not communicate:

- That the customer has become a separate Seller account
- That a government body verified ownership
- That Form A is legally binding
- That a real permit was issued
- That the listing is already public
- That financial estimates are guaranteed
- That private documents will be shown to buyers
- That a customer must complete a generic, bureaucratic portal form without guidance
