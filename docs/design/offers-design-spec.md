# MARKAZ Home — Buyer Offers and Seller Offer Management Design Specification

**File:** `MARKAZ-OFFERS-DESIGN-SPEC.md`  
**Status:** Implementation-ready design specification  
**Milestone:** Week 4 — Buyer Offers and Seller Offer Management  
**Applications:** MARKAZ Home customer web  
**Primary languages:** English and Arabic  
**Accessibility target:** WCAG 2.2 AA  
**Last updated:** June 2026  

---

## Milestone Understanding

Week 4 adds a complete, non-binding negotiation experience to the existing MARKAZ marketplace. A single authenticated `CUSTOMER` may make an offer on another customer’s `LIVE` property and may also receive and manage offers on their own `LIVE` listings. Buyer and Seller remain activities within one account.

The experience begins from the Week 3 public property page, continues through offer creation and structured negotiation, and may end with one accepted offer. It does not create a transaction, payment, escrow, MOU, Form F, legal commitment, viewing workflow, or direct buyer-seller communication. Acceptance creates a clear Week 5 handoff only.

This specification preserves the implemented Week 3 marketplace, public/private projection boundary, anonymous browsing, safe authentication return, `LIVE` and `PAUSED` listing behaviour, RLS identity model, Realtime foundation, English/Arabic localisation, RTL support, and the approved Architectural Blue design language.

---

# 1. Executive Summary

MARKAZ offers should feel like a private, structured decision process—not an auction, bidding war, chat thread, or trading interface.

The approved interaction model is:

- One offer thread per buyer and listing
- Immutable chronological proposals within that thread
- One current actionable proposal at a time
- Explicit next-action ownership
- Non-binding disclosure throughout
- Private threshold handling
- Seller may negotiate with multiple buyers
- Seller may accept only one offer per listing
- Acceptance closes all competing threads atomically
- The listing remains `LIVE` but receives a derived `UNDER_OFFER` availability status
- No new offers may be created while `UNDER_OFFER`
- Week 5 will create the transaction experience later

## 1.1 Final product decisions

1. **Unified Offers hub:** one authenticated `/offers` area with two tabs:
   - Made by me
   - Received on my listings
2. **Shared thread route:** buyer and seller use the same offer-thread route. Controls are perspective-aware and server-authorised.
3. **No free-form chat:** negotiation is represented by proposals and structured events.
4. **No offer note in Week 4:** defer free-form buyer/seller notes to avoid moderation, contact leakage, and chat-like behaviour.
5. **Expiry is included:** each current proposal has a server-authoritative expiry. Options are 48 hours, 3 days, 7 days, or no expiry. Default is 7 days.
6. **Counters do not overwrite:** every counter creates a new immutable proposal and supersedes the prior actionable proposal.
7. **Buyer-safe identity:** sellers see stable labels such as `Buyer 01`, paired with `Verified customer`; no personal identity or ID-derived suffix is displayed.
8. **Rejection reasons are seller-private:** buyer sees neutral rejection copy; no free-form rejection message.
9. **Under Offer is derived:** do not add a new listing publication state. Derive `UNDER_OFFER` from an accepted offer attached to a `LIVE` listing.
10. **Accepted listing remains publicly visible:** show `Under offer`; remove Make an Offer; keep Save and Share where otherwise allowed.
11. **Threshold remains private:** below-threshold offers are listed but generate no prominent immediate notification.
12. **Server state is authoritative:** Realtime improves immediacy but never determines correctness.

---

# 2. Scope

## 2.1 In scope

### Buyer

- Make an Offer from a live property
- Anonymous authentication interception
- Offer amount entry
- Asking-price comparison
- Low/high amount warning
- Expiry selection
- Review before submission
- Offer submitted state
- Buyer Offers list
- Waiting state
- Seller counter response
- Buyer counter
- Buyer accepts seller counter
- Buyer rejects seller counter
- Buyer withdrawal
- Expiry
- Listing unavailable and other-offer-accepted states

### Seller

- Cross-listing Offers inbox
- Listing-specific offer management
- Above/below threshold classification
- Offer comparison
- Offer detail
- Accept
- Counter
- Reject
- Multiple active offers
- Single accepted-offer enforcement
- Other-thread closure
- Paused/materially changed listing behaviour

### Shared

- Negotiation timeline
- Realtime refresh
- In-app notifications and action badges
- Responsive desktop/tablet/mobile UI
- English and draft Arabic
- RTL
- WCAG 2.2 AA behaviour
- Privacy-safe identity and thread access
- Loading, empty, error, conflict, stale, and session states
- Audit-event recommendations

## 2.2 Out of scope

- Transaction creation or tracker
- Escrow
- Deposits or payments
- Mortgage processing
- Conveyancing
- MOU, Form F, or legal signing
- Property transfer
- Viewing bookings
- Free-form chat
- Contact exchange
- Phone or email sharing
- Full Admin Portal
- Admin offer intervention
- Disputes
- Email, SMS, or push delivery
- Agent workflows
- Premium Managed Service
- Binding agreements
- Legal acceptance
- Offer analytics or buyer scoring

---

# 3. Product and Account Rules

1. Account types remain `CUSTOMER` and `ADMIN`.
2. Buyer and Seller are not account roles.
3. A customer never switches account mode.
4. A customer may make an offer only when:
   - authenticated and fully onboarded;
   - listing state is `LIVE`;
   - listing availability is `AVAILABLE`;
   - customer is not the owner;
   - no accepted offer exists;
   - listing is configured to receive offers.
5. Anonymous users may view property pages but must authenticate before entering an amount.
6. A customer may not access another buyer’s thread.
7. A seller may access threads only for listings they own.
8. A seller may accept one and only one offer for a listing.
9. The seller threshold does not reject or hide lower offers.
10. Buyers never see threshold values or classification.
11. Proposal amounts use AED only.
12. Offer acceptance is explicitly non-binding in this prototype.
13. The public marketplace never exposes negotiation data.
14. Offer thread data is available only to participating buyer, owning seller, and future authorised Admin.
15. The seller cannot counter or accept while the listing is paused or materially changed.
16. All state-changing actions must revalidate listing and thread state on the server.

---

# 4. Week 4 Offer Model

## 4.1 Domain structure

```text
Offer Thread
├── listing
├── buyer
├── seller
├── thread status
├── next action party
├── current proposal
├── proposal history
├── created at
├── updated at
└── closed reason, when applicable

Proposal
├── amount AED
├── submitted by BUYER or SELLER
├── submitted at
├── expires at or no expiry
├── proposal status
└── supersedes proposal
```

## 4.2 One-thread rule

There is at most one non-closed offer thread per:

```text
buyer + listing
```

If a buyer returns to a listing with an active thread:

- Replace `Make an offer` with `View your offer`
- Route to the existing thread
- Do not create a parallel thread

After a buyer withdraws, is rejected, or expires, a new thread may be created only while the listing remains `LIVE` and `AVAILABLE`. The new thread must not erase prior history.

## 4.3 No chat

Do not provide:

- Message composer
- Contact request
- Seller note
- Buyer note
- Attachments
- Read receipts styled as messaging
- Typing indicators

Negotiation history is a structured event log.

---

# 5. Offer State Model

## 5.1 Internal thread states

Use the following internal states:

| State | Meaning | Next action |
|---|---|---|
| `DRAFT` | Buyer has not submitted | Buyer |
| `AWAITING_SELLER` | Current proposal was submitted by buyer | Seller |
| `AWAITING_BUYER` | Current proposal was submitted by seller | Buyer |
| `ACCEPTED` | Current proposal was accepted | None |
| `REJECTED` | Seller or buyer rejected the current negotiation | None |
| `WITHDRAWN` | Buyer withdrew the thread | None |
| `EXPIRED` | Current proposal expired server-side | None |
| `CLOSED_OTHER_ACCEPTED` | Another thread for the listing was accepted | None |
| `CLOSED_LISTING_UNAVAILABLE` | Listing paused, unpublished, or materially invalidated | None |

`VIEWED` must be metadata/event information, not a thread state.

`SUPERSEDED` must be a proposal state, not a thread state.

## 5.2 Proposal states

| State | Meaning |
|---|---|
| `CURRENT` | Proposal currently awaits action |
| `SUPERSEDED` | Replaced by a newer counter |
| `ACCEPTED` | Selected proposal |
| `REJECTED` | Proposal ended by rejection |
| `EXPIRED` | Proposal expired |
| `WITHDRAWN` | Thread withdrawn while this was current |
| `CLOSED` | Closed because listing became unavailable or another offer won |

## 5.3 User-facing status language

| Internal state | Buyer copy | Seller copy |
|---|---|---|
| `DRAFT` | Draft offer | Not visible |
| `AWAITING_SELLER` | Waiting for seller | Response needed |
| `AWAITING_BUYER` | Your response is needed | Waiting for buyer |
| `ACCEPTED` | Offer accepted | Offer accepted |
| `REJECTED` | Offer declined | Offer declined |
| `WITHDRAWN` | Offer withdrawn | Buyer withdrew |
| `EXPIRED` | Offer expired | Offer expired |
| `CLOSED_OTHER_ACCEPTED` | Property is under offer | Another offer was selected |
| `CLOSED_LISTING_UNAVAILABLE` | Property is no longer available | Listing unavailable |

## 5.4 Next-action logic

- `AWAITING_SELLER`: seller may Accept, Counter, Reject.
- `AWAITING_BUYER`: buyer may Accept, Counter, Reject, or Withdraw.
- `DRAFT`: buyer may edit, review, submit, or discard.
- Closed states: no negotiation action.
- Withdraw is allowed for the buyer in either active waiting state, except while an accept/counter/reject request is processing.
- A stale client action must be rejected and replaced by refreshed authoritative state.

---

# 6. Listing Availability and Accepted-Offer Model

## 6.1 Derived availability

Keep the Week 3 listing state unchanged:

```text
LIVE | PAUSED
```

Add a derived offer availability:

```text
AVAILABLE
UNDER_OFFER
OFFERS_DISABLED
```

Rules:

- `LIVE` + no accepted offer + offer settings enabled = `AVAILABLE`
- `LIVE` + accepted offer = `UNDER_OFFER`
- `PAUSED` or invalidated publication = `OFFERS_DISABLED`

Do not add `UNDER_OFFER` to the publication state enum.

## 6.2 Acceptance transaction boundary

Acceptance must be one server-side atomic operation:

1. Revalidate seller ownership.
2. Revalidate listing is `LIVE` and `AVAILABLE`.
3. Revalidate current proposal is actionable and unexpired.
4. Ensure no accepted offer already exists.
5. Mark selected thread/proposal `ACCEPTED`.
6. Close all other active threads as `CLOSED_OTHER_ACCEPTED`.
7. Derive listing availability as `UNDER_OFFER`.
8. Create audit and in-app notification records.
9. Return final authoritative state.

Two concurrent accepts must result in one success and one safe conflict.

## 6.3 Public listing treatment

A public listing under offer:

- remains visible in marketplace and Saved Properties;
- displays `Under offer`;
- does not show Make an Offer;
- may still be saved or shared;
- explains: `The seller has selected an offer and is not accepting new offers.`;
- does not reveal accepted amount, buyer, or number of negotiations.

## 6.4 Week 5 handoff

After acceptance show:

> Transaction setup will be available in the next stage.

Do not show:

- Create transaction
- Pay deposit
- Upload MOU
- Contact buyer/seller
- Transaction timeline

---

# 7. Design Principles

1. **Financial clarity:** amounts, differences, expiry, and next action are explicit.
2. **Private by default:** no competing offers, thresholds, contact details, or identities leak.
3. **Structured, not conversational:** use proposal cards and timeline events, not chat bubbles.
4. **One current decision:** every active thread presents one dominant next action area.
5. **No pressure mechanics:** no flashing timers, auction labels, rankings, or scarcity prompts.
6. **Consequential actions require review:** Accept, Reject, Withdraw, and Submit Counter use clear confirmation.
7. **Past proposals remain visible:** never silently overwrite.
8. **State changes explain why:** closed, stale, unavailable, and expired states include recovery or exit.
9. **Property context remains present:** cover, location, asking price, and listing status anchor every thread.
10. **Realtime is supportive:** interface updates quickly, but actions always revalidate server-side.
11. **Accessible is premium:** amounts and status changes are understandable beyond colour and animation.

---

# 8. Information Architecture

```text
Public Property
└── Make an Offer
    ├── Authentication interception
    ├── Offer amount
    └── Review and submit

Authenticated Customer
├── Offers
│   ├── Made by me
│   └── Received on my listings
│
├── Offer Thread
│   ├── Property summary
│   ├── Current proposal
│   ├── Next action
│   └── Negotiation history
│
├── My Listings
│   └── Listing-specific Offers
│
└── Notifications
    └── Links into Offer Thread
```

## 8.1 Navigation update

Authenticated header:

- Dashboard
- Browse
- Saved
- My Listings
- Offers
- Transactions remains hidden until Week 5
- List a property
- Notifications
- Account

Offers uses an action-needed count badge, not total thread count.

The Offers landing uses tabs:

- `Made by me`
- `Received on my listings`

No Buyer/Seller mode switch.

---

# 9. Route Recommendations

## 9.1 Final routes

```text
/[locale]/properties/[publicId]/[slug]/offer
/[locale]/offers
/[locale]/offers/[offerThreadId]
/[locale]/sell/listings/[listingId]/offers
```

Query parameters:

```text
/[locale]/offers?view=made
/[locale]/offers?view=received
/[locale]/offers?view=received&listing=[ownedListingId]
```

## 9.2 Shared thread route

Use one thread route:

```text
/[locale]/offers/[offerThreadId]
```

The server determines perspective:

- participating buyer → buyer controls;
- listing owner → seller controls;
- neither → unified safe not-available state.

Benefits:

- one timeline implementation;
- no duplicated buyer/seller detail page;
- notifications share one target;
- easier security testing;
- same customer may naturally switch between buying and selling journeys.

Internal thread IDs must be opaque, unguessable identifiers. They may appear in the authenticated route but never in public marketplace projection.

## 9.3 Property offer route

The property route begins or resumes an offer:

- anonymous → interception;
- owner → public owner treatment, no offer route;
- active thread → redirect to thread;
- eligible buyer → offer amount form;
- unavailable → safe availability state.

---

# 10. Buyer End-to-End Flow

```text
LIVE + AVAILABLE property
→ Make an offer
→ Authenticated?
   ├─ No → Sign in / Create account → return → recheck
   └─ Yes
→ Eligible?
   ├─ No → owner / unavailable / under-offer state
   └─ Yes
→ Enter amount and expiry
→ Non-blocking amount warning, if applicable
→ Review offer
→ Submit
→ AWAITING_SELLER
→ Seller action
   ├─ Accept → ACCEPTED
   ├─ Reject → REJECTED
   └─ Counter → AWAITING_BUYER
→ Buyer action
   ├─ Accept → ACCEPTED
   ├─ Reject → REJECTED
   ├─ Counter → AWAITING_SELLER
   └─ Withdraw → WITHDRAWN
```

## 10.1 Buyer entry-point treatment

| Entry | Behaviour |
|---|---|
| Property page | Make an Offer or View Your Offer |
| Saved Properties | Card action opens property; offer CTA remains on detail |
| Buyer Offers | Resume next action |
| Deep link | Authenticate, authorise, load thread |
| Seller counter notification | Opens thread with next-action panel focused |
| Listing paused | Closed/unavailable panel |
| Other offer accepted | Property Under Offer; thread closed |
| Return after sign-out | Safe return to same authorised thread |

---

# 11. Seller End-to-End Flow

```text
Offer submitted
→ Threshold classification computed privately
→ Seller inbox
→ Prominent notification only if at/above threshold
→ Seller opens thread
→ Review current proposal and history
→ Accept / Counter / Reject
→ If Counter:
   AWAITING_BUYER
   → buyer accepts / rejects / counters / withdraws
→ If Accept:
   selected thread ACCEPTED
   all competing active threads CLOSED_OTHER_ACCEPTED
   listing derived UNDER_OFFER
```

## 11.1 Seller entry-point treatment

| Entry | Behaviour |
|---|---|
| My Listings | Show `View offers` and action-needed count |
| Live listing management | Offers summary panel |
| Offers tab | Cross-listing inbox |
| Listing-specific route | Comparison view for one listing |
| Notification | Deep link to relevant thread |
| Below-threshold manual review | Visible in All / Below threshold filter |
| Return after sign-out | Safe authenticated return |
| Buyer counter | Thread opens with response needed |

---

# 12. Authentication Interception

## 12.1 Anonymous flow

Dialog or bottom sheet:

**Title:**  
> Sign in to make an offer

**Body:**  
> Create or sign in to your MARKAZ account, then return to this property to continue.

**Primary:**  
> Sign in

**Secondary:**  
> Create account

**Tertiary:**  
> Not now

## 12.2 Intent preservation

Preserve:

- public listing `publicId`;
- slug for readable return URL;
- intended action `make-offer`.

Do not preserve:

- offer amount;
- expiry;
- unsubmitted note;
- internal listing ID.

After authentication:

1. Resolve safe relative return.
2. Re-fetch public listing.
3. Recheck owner, `LIVE`, availability, and onboarding.
4. If eligible, show offer form.
5. If not eligible, show a specific safe state.

Prevent open redirects by allowlisting only customer-web relative routes.

## 12.3 Listing changes during authentication

| New condition | Copy |
|---|---|
| Listing paused/unavailable | `This property is no longer available for offers.` |
| User is owner | `This is your listing. Manage offers from My Listings.` |
| Another offer accepted | `This property is now under offer and is not accepting new offers.` |
| Existing active thread found | Redirect to `View your offer` |

---

# 13. Offer Creation

## 13.1 Desktop layout

Maximum width: 1180 px.

Two-column layout:

- Main form: 680–720 px
- Sticky property summary: 340–380 px
- Gap: 48 px

```text
┌─────────────────────────────────────────────────────────────┐
│ Breadcrumb: Property / Make an offer                        │
│                                                             │
│ Make an offer                    ┌────────────────────────┐  │
│ Enter the amount...              │ Cover photo            │  │
│                                  │ AED 2,400,000 asking    │  │
│ Your offer                       │ 2 bed · 2 bath · 1,250  │  │
│ AED [____________________]       │ Dubai Marina            │  │
│ Difference from asking           └────────────────────────┘  │
│                                                             │
│ Offer validity                                             │
│ [7 days ▼]                                                  │
│                                                             │
│ Non-binding disclosure                                      │
│                                                             │
│ [Review offer]                                              │
└─────────────────────────────────────────────────────────────┘
```

## 13.2 Mobile layout

- Single column
- Property summary becomes compact top card
- 24 px page padding
- Amount input uses decimal/numeric keyboard
- Sticky bottom action: `Review offer`
- Safe-area padding included

## 13.3 Copy

**Title:**  
> Make an offer

**Description:**  
> Enter the amount you would like the seller to consider.

**Amount label:**  
> Your offer

**Placeholder:**  
> 2,250,000

**Asking price:**  
> Asking price: AED {amount}

**Difference labels:**

- `AED {amount} below asking`
- `AED {amount} above asking`
- `Matches the asking price`

**Expiry label:**  
> Offer validity

**Expiry helper:**  
> The seller must respond before this proposal expires.

**Primary:**  
> Review offer

**Secondary:**  
> Cancel

## 13.4 AED input behaviour

- Currency fixed to AED and not selectable
- Display grouping separators while editing without changing numeric meaning
- Store whole dirhams only
- No decimal places
- Accept Western and Arabic-Indic digits
- Normalise to canonical numeric value server-side
- Input and numbers remain LTR in Arabic
- Maximum amount: AED 999,999,999
- Do not accept scientific notation, currency letters, negative signs, or separators in invalid positions

## 13.5 Comparison behaviour

Update after valid input:

- absolute difference;
- percentage difference rounded to one decimal;
- neutral language;
- no aggressive red/green gain/loss styling.

Example:

> AED 150,000 below asking · 6.3%

The percentage is supplementary and must not be the only explanation.

## 13.6 Low/high warnings

Non-blocking low warning triggers at more than 20% below asking:

> **This offer is significantly below the asking price.**  
> You can still submit it, but the seller may be less likely to respond.

Non-blocking high warning triggers at more than 20% above asking:

> **This offer is significantly above the asking price.**  
> Review the amount before continuing.

Do not reveal threshold.

---

# 14. Offer Validation

Validation is performed client-side for immediate guidance and server-side for authority.

## 14.1 Amount rules

- Required
- Integer AED
- Greater than zero
- Maximum AED 999,999,999
- No unsupported currency
- No decimal precision
- Warning only for unusual comparison
- Never block solely because amount is below notification threshold

## 14.2 Eligibility revalidation

On opening, review, and submit:

- listing exists in public/owner-safe projection;
- listing is `LIVE`;
- offer availability is `AVAILABLE`;
- buyer is not owner;
- buyer is fully onboarded;
- no accepted offer;
- active thread rule respected.

## 14.3 Existing active thread

If an active thread exists:

**Title:**  
> You already have an active offer

**Body:**  
> Continue the existing negotiation to review its latest status or propose a new amount.

**Primary:**  
> View your offer

No second thread is created.

---

# 15. Offer Review and Submission

## 15.1 Review page

Use the same route with a review mode or nested UI state; do not create an externally deep-linkable confirmation route containing unsubmitted amount.

Sections:

1. Property summary
2. Your offer
3. Asking-price comparison
4. Valid until / no expiry
5. Non-binding disclosure
6. Edit
7. Submit

## 15.2 Copy

**Title:**  
> Review your offer

**Description:**  
> Check the amount and validity before sending it to the seller.

**Disclosure — required:**  
> This offer is an expression of interest for this prototype. It does not create a legally binding property agreement.

**Primary:**  
> Submit offer

**Secondary:**  
> Edit offer

## 15.3 Submission

- Button label becomes `Submitting offer…`
- Disable repeated action
- Revalidate state server-side
- Create thread/proposal atomically
- On duplicate request, return existing result idempotently
- Clear local draft after success
- Route to thread success state

## 15.4 Offer submitted

**Title:**  
> Your offer has been sent

**Body:**  
> The seller can review, accept, reject, or propose a different amount.

Status:

> Waiting for seller

Actions:

- `View offer details`
- `Return to property`
- `View My Offers`

Do not show seller notification threshold result.

---

# 16. Buyer Offers

## 16.1 Page structure

Route:

```text
/[locale]/offers?view=made
```

Header:

> **Offers**

Tabs:

- Made by me
- Received on my listings

Filters:

- All
- Needs your action
- Waiting
- Accepted
- Closed

Default: `All`.

Sort: `Newest activity`.

## 16.2 Buyer offer card

Show:

- cover photo;
- property headline;
- community and emirate;
- current proposal amount;
- asking price;
- status;
- next action;
- last updated;
- availability;
- primary action.

Do not show seller identity or competing activity.

## 16.3 States

### Empty

> **You have not made any offers yet**  
> Browse properties and make an offer when you find the right home.

Primary:

> Browse properties

### Waiting

> Waiting for seller

Primary:

> View offer

### Seller counter

> Your response is needed

Primary:

> Review counteroffer

### Accepted

> Offer accepted

Primary:

> View accepted offer

### Closed

Use reason-specific neutral copy.

### Partial failure

Render successful cards and an inline alert:

> Some offers could not be loaded. Try again to refresh the list.

---

# 17. Seller Offers Inbox

## 17.1 Page structure

Route:

```text
/[locale]/offers?view=received
```

Page title:

> Offers received

Description:

> Review and respond to offers across your live listings.

Desktop:

- Filter toolbar
- Sort control
- Table-like rows with image and structured columns
- No dense admin-table treatment

Mobile:

- Offer cards
- Filter sheet
- Sort sheet
- Sticky action only inside thread, not inbox

## 17.2 Filters

- All listings
- Specific owned listing
- Needs response
- Waiting for buyer
- At or above threshold
- Below threshold
- Accepted
- Closed

Default: `Needs response` when there is at least one actionable above-threshold offer; otherwise `All`.

## 17.3 Sort

- Newest activity — default
- Highest offer
- Closest to asking price
- Oldest unanswered

## 17.4 Seller offer row

Show:

- listing cover and location;
- buyer-safe label;
- current amount;
- asking price;
- difference and percentage;
- threshold classification;
- status;
- next action;
- latest activity;
- received time.

### Buyer-safe label

Use:

> Buyer 01  
> Verified customer

The sequence number is stable per listing and not based on real identifiers.

## 17.5 Threshold treatments

At/above:

> At or above notification threshold

Below:

> Below notification threshold

Use small seller-only text or a restrained icon; do not use success/failure language.

---

# 18. Listing-Specific Offer Management

Route:

```text
/[locale]/sell/listings/[listingId]/offers
```

## 18.1 Summary header

Show:

- property cover;
- property headline;
- `LIVE`, `PAUSED`, or `Under offer`;
- asking price;
- notification threshold;
- number of active threads;
- highest current proposal;
- offers requiring response;
- public property link;
- manage listing link.

## 18.2 Comparison list

Each row:

- Buyer 01 / Verified customer
- Current proposal
- Difference from asking
- Threshold classification
- Next action
- Last activity
- Expiry
- `Review offer`

Do not produce a winner ranking or “best buyer” recommendation.

## 18.3 Multiple active offers

Show an information note:

> You can negotiate with more than one buyer, but you can accept only one offer for this property.

No buyer can see this view.

---

# 19. Offer Detail

## 19.1 Desktop layout

Max width: 1240 px.

- Main history column: 760–800 px
- Sticky decision panel: 340–380 px
- Property summary above or at top of sidebar
- Gap: 48 px

## 19.2 Header

- Breadcrumb
- Property mini-summary
- Perspective-aware page title
- Status and next-action statement
- Realtime connection indicator only when degraded

Buyer title:

> Offer for {property headline}

Seller title:

> Offer from Buyer 01

## 19.3 Current proposal

Large amount:

> AED 2,250,000

Supporting data:

- Proposed by buyer/seller
- Asking price
- Difference
- Submitted timestamp
- Valid until
- Current status

## 19.4 Seller controls

When `AWAITING_SELLER`:

- Accept offer
- Make counteroffer
- Reject offer

Order desktop:

1. Accept offer — primary
2. Make counteroffer — secondary
3. Reject offer — quiet/destructive text

Order mobile sticky bar:

- Counter
- Accept
- More menu → Reject

Reject must never be an equally prominent adjacent red button.

## 19.5 Buyer controls

When `AWAITING_BUYER`:

- Accept counteroffer
- Make counteroffer
- Reject counteroffer
- Withdraw offer

Mobile:

- Accept
- Counter
- More → Reject / Withdraw

---

# 20. Negotiation Timeline

## 20.1 Visual model

Use a vertical structured activity timeline.

Each event includes:

- actor label;
- action;
- amount where relevant;
- date and time;
- expiry where relevant;
- status icon;
- optional system explanation.

Do not use speech bubbles or avatars.

## 20.2 Actor treatment

- Buyer action: blue outlined marker
- Seller action: deep-blue filled marker
- System action: neutral grey marker
- Accepted: restrained green check
- Closed: neutral icon
- Error: red only when action failed, not for ordinary rejection

Text labels remain authoritative.

## 20.3 Event copy

- `You submitted an offer of AED {amount}.`
- `Buyer 01 submitted an offer of AED {amount}.`
- `The seller proposed AED {amount}.`
- `You proposed AED {amount}.`
- `The seller viewed the offer.` — optional, shown only if consistently supported
- `The offer was accepted.`
- `The offer was declined.`
- `The buyer withdrew the offer.`
- `This proposal expired.`
- `The listing became unavailable.`
- `Another offer was selected for this property.`

## 20.4 Semantics

- Use an ordered list
- Use chronological oldest-to-newest order
- On mobile, scroll to current proposal heading, not automatically to page bottom
- Announce newly inserted event politely
- Do not announce every Realtime heartbeat

---

# 21. Counteroffers

## 21.1 Form

Open as:

- desktop side panel or inline decision panel;
- mobile full-height bottom sheet/page section.

Fields:

- Counteroffer amount
- Offer validity

Context:

- Previous proposal
- Asking price
- Difference from previous
- Difference from asking

## 21.2 Copy

**Seller title:**  
> Make a counteroffer

**Buyer title:**  
> Propose a different amount

**Description:**  
> Enter a new amount for the other party to consider.

**Primary:**  
> Review counteroffer

**Review primary:**  
> Submit counteroffer

**Disclosure:**  
> This counteroffer remains part of a non-binding prototype negotiation.

## 21.3 Rules

- Same AED validation as offer amount
- New amount may equal asking price
- New amount may not equal current proposal; if equal, instruct user to Accept instead
- New proposal supersedes current proposal
- New expiry starts from server submission time
- Counter submission changes next action to other party
- Every proposal remains in history
- Counter request is idempotent

## 21.4 Equal amount message

> This matches the current proposal. Accept it instead, or enter a different amount.

Blocking.

---

# 22. Accept

## 22.1 Accept confirmation

**Title:**  
> Accept this offer?

**Body:**  
> This will select this buyer’s offer and close other active negotiations for the property.

Summary:

- property;
- Buyer 01;
- amount;
- current proposal source;
- active competing thread count;
- listing becomes Under offer.

**Week 5 note:**  
> Transaction setup will continue in the next stage.

**Disclosure:**  
> This prototype acceptance does not create a legally binding property agreement.

**Primary:**  
> Accept offer

**Secondary:**  
> Cancel

## 22.2 Buyer accepts seller counter

Title:

> Accept this counteroffer?

Body:

> You are selecting the seller’s proposed amount of AED {amount}.

Disclosure remains identical.

Primary:

> Accept counteroffer

## 22.3 Success

**Title:**  
> Offer accepted

Seller body:

> This buyer’s offer has been selected. The transaction setup will continue in the next stage.

Buyer body:

> The seller’s proposal has been accepted. Transaction setup will continue in the next stage.

Status:

> Under offer

Actions:

- View property
- Return to Offers
- Seller: Manage listing

No confetti or payment CTA.

---

# 23. Reject

## 23.1 Seller rejection

Dialog:

**Title:**  
> Reject this offer?

**Body:**  
> This negotiation will close. The buyer will see that the offer was declined.

Optional seller-private reason:

- Amount too low
- Property no longer available
- Selected another offer
- Terms not suitable
- Other

Do not show free-form input.

**Primary:**  
> Reject offer

**Secondary:**  
> Keep offer open

Use a restrained destructive button.

## 23.2 Buyer rejects counter

**Title:**  
> Reject this counteroffer?

**Body:**  
> This negotiation will close and the seller will no longer be able to accept your previous proposal.

Primary:

> Reject counteroffer

Secondary:

> Continue negotiating

## 23.3 Sharing policy

Rejection category remains seller-private. Buyer sees:

> The seller declined this offer.

No undo. A new thread may be started later only if the listing remains available.

---

# 24. Withdraw

## 24.1 Rule

Buyer may withdraw any active thread before acceptance.

Withdrawal closes the thread immediately. Seller cannot respond afterward.

## 24.2 Dialog copy

**Title:**  
> Withdraw this offer?

**Body:**  
> The seller will no longer be able to accept or respond to this offer.

**Primary:**  
> Withdraw offer

**Secondary:**  
> Keep offer open

## 24.3 Success

> **Offer withdrawn**  
> This negotiation is now closed.

If the listing remains available:

> You may make a new offer from the property page.

Do not provide one-click undo.

---

# 25. Expiry

## 25.1 Options

- 48 hours
- 3 days
- 7 days — default
- No expiry

## 25.2 Behaviour

- Server stores UTC expiry
- Display in customer locale and timezone
- Counteroffer creates a new expiry
- Expiry is authoritative server-side
- Any action at or after expiry is rejected safely
- No second-by-second countdown
- Under 24 hours, show `Expires in about {hours} hours`
- Otherwise show date/time
- Under 1 hour, show `Expires soon` plus exact time, without pulsing animation

## 25.3 Expired state

> **This offer has expired**  
> The proposal is no longer available to accept or counter.

Buyer may create a new thread if listing remains available.

Seller cannot revive an expired thread.

---

# 26. Multiple Active Offers

## 26.1 Seller view

- Compare current proposals privately
- Sort and filter
- Counter multiple buyers
- Accept only one
- Show confirmation count of threads to close
- No recommendation algorithm

## 26.2 Buyer view

Buyers do not see:

- number of competing offers;
- highest offer;
- another buyer’s amount;
- another buyer identity;
- ranking.

Optional neutral copy on active thread:

> The seller may be reviewing other offers.

This appears only as general context, not urgency.

## 26.3 Other threads after acceptance

Buyer copy:

> **Property is under offer**  
> The seller selected another offer, so this negotiation is now closed.

Seller copy:

> **Another offer was selected**  
> This negotiation closed when you accepted a different offer for the property.

---

# 27. Threshold Behaviour

## 27.1 Seller-only classification

Compare each new buyer proposal with the listing’s minimum offer-notification threshold.

At/above threshold:

- create in-app notification;
- increment action-needed Offers badge;
- show classification in seller inbox.

Below threshold:

- store normally;
- show in All and Below threshold filters;
- no notification-menu item on initial submission;
- do not increment prominent action badge solely for initial below-threshold submission;
- seller can respond normally when viewed.

Buyer counters after seller has engaged always create a response notification, regardless of threshold, because the seller is already in an active negotiation.

## 27.2 Copy

> At or above notification threshold

> Below notification threshold

Helper:

> The threshold controls immediate notifications only. It does not prevent or hide lower offers.

Never include this helper in buyer UI.

---

# 28. Listing Pause and Material Edits

## 28.1 Pausing a listing

When seller pauses `LIVE`:

- new offers blocked;
- public route unavailable under Week 3 rule;
- active threads move to `CLOSED_LISTING_UNAVAILABLE`;
- they do not automatically resume;
- buyer receives neutral in-app notification;
- seller sees closed history;
- saved relationships remain as Week 3 defines.

Reason: automatically reviving proposals after a listing disappears could surprise buyers.

Copy:

> The listing was paused, so this negotiation is now closed.

## 28.2 Returning to LIVE

Old threads remain closed. Buyers may create a new offer after the listing returns to `AVAILABLE`.

## 28.3 Material edits

Material edits include:

- asking price;
- property type;
- emirate/community/building;
- bedroom/bathroom/size;
- ownership document or ownership verification;
- cover or substantive photo replacement where Week 3 requires review.

Before material edit:

> **Active offers will close**  
> Buyers should not continue negotiating against property details that are about to change.

Require seller confirmation.

After edit:

- active threads close `CLOSED_LISTING_UNAVAILABLE`;
- listing follows Week 3 review/publication rules;
- buyers receive neutral notification;
- no automatic reactivation.

Non-material edits such as spelling, amenity selection, photo order, and investment visibility follow Week 3 and do not invalidate active offers unless the publication rules classify them as material.

---

# 29. Realtime Updates

## 29.1 Events

Realtime may notify the UI of:

- offer submitted;
- counter submitted;
- accepted;
- rejected;
- withdrawn;
- expired;
- listing paused;
- listing under offer;
- thread closed.

## 29.2 Correctness pattern

1. Receive event.
2. De-duplicate using event/record version.
3. Re-fetch authoritative thread or list.
4. Replace client state.
5. Announce meaningful user-visible change.

Do not apply irreversible state based only on payload.

## 29.3 Connection states

Normal: no indicator.

Reconnecting:

> Reconnecting to live updates…

Stale:

> Updates may be delayed. Refresh to check the latest offer status.

Recovered:

> Offer status is up to date.

Provide `Refresh` action in stale state.

## 29.4 Screen-reader announcements

Polite announcements:

- `Seller counteroffer received. Your response is needed.`
- `Offer accepted.`
- `Offer declined.`
- `Buyer withdrew the offer.`
- `Listing is no longer available.`

Do not announce background reconnect attempts repeatedly.

---

# 30. In-App Notifications

## 30.1 Approved scope

Use:

1. Header bell with unread count
2. Compact notification menu
3. Action-needed count badge on Offers navigation
4. Optional dashboard activity item only if the existing dashboard already has activity structure

Do not build preferences or a full notification centre.

## 30.2 Notification types

| Recipient | Trigger | Copy |
|---|---|---|
| Seller | Initial offer at/above threshold | `New offer received for {property}.` |
| Buyer | Seller counter | `The seller proposed a different amount.` |
| Buyer | Accepted | `Your offer was accepted.` |
| Buyer | Rejected | `Your offer was declined.` |
| Seller | Buyer counter | `Buyer 01 proposed a different amount.` |
| Seller | Buyer withdrawal | `Buyer 01 withdrew their offer.` |
| Both | Listing unavailable | `This offer closed because the listing is no longer available.` |
| Non-selected buyer | Other offer accepted | `The property is now under offer.` |

## 30.3 Notification menu

Each item:

- type icon;
- short copy;
- property name;
- relative time;
- unread marker;
- opens relevant thread;
- marks read after successful navigation or explicit action.

Do not include full offer amount in the header menu. Amount appears after entering the authorised thread.

---

# 31. Loading, Empty, Error, and Conflict States

| State | UX |
|---|---|
| Creating offer form | Property-summary skeleton + field skeleton |
| Submitting | Button loading; fields read-only |
| Loading thread | Header, current-proposal, timeline skeletons |
| Loading seller inbox | 6 structured row skeletons |
| Empty buyer offers | Browse Properties CTA |
| Empty seller offers | Explain offers will appear when buyers submit |
| Counter submitting | Counter panel disabled; `Submitting counteroffer…` |
| Accepting | Confirmation button `Accepting offer…` |
| Rejecting | `Rejecting offer…` |
| Withdrawing | `Withdrawing offer…` |
| Expired | Closed panel with exact expiry |
| Listing unavailable | Unified safe closed panel |
| Superseded proposal | Show in history; no action |
| Another offer accepted | Closed neutral panel |
| Stale action | Refresh state and explain action changed |
| Two-tab conflict | Latest server state replaces stale tab |
| Network unavailable | Preserve form amount in memory; Retry |
| Realtime disconnected | Non-blocking stale banner |
| Generic error | Safe retry panel |
| Session expired | Existing sign-in flow with safe return |

## 31.1 Safe not-available copy

For unauthorised, missing, or inaccessible thread:

> **This offer is not available**  
> It may no longer exist, or you may not have permission to view it.

Do not reveal which condition applies.

## 31.2 Stale-action conflict

> **This offer has changed**  
> Another action was completed before yours. We have refreshed the latest status.

Primary:

> Review latest status

## 31.3 Session expiry during confirmation

- Do not submit action
- Close dialog
- Route to Sign In with safe return
- After sign-in, re-fetch and require the user to confirm again
- Never replay Accept, Reject, Counter, or Withdraw automatically

---

# 32. Component Library

Each component must use existing MARKAZ colour, spacing, typography, radius, focus, and i18n tokens.

| Component | Purpose and anatomy | Variants / states | Behaviour, accessibility, responsive and RTL |
|---|---|---|---|
| Make Offer CTA | Primary property action; label + optional amount icon | Eligible, loading, active-thread, under-offer, owner | 44 px min; anonymous opens auth dialog; mobile sticky; logical icon placement |
| Offer Amount Input | AED prefix, numeric input, helper, error | Empty, valid, warning, invalid, disabled | LTR amount in RTL; numeric keyboard; described-by comparison and errors |
| AED Comparison Block | Asking, proposed, absolute and % difference | Below, equal, above | Neutral styling; values announced as complete phrases |
| Offer Warning | Non-blocking unusual amount warning | Low, high | `role=status`, not error; no threshold disclosure |
| Offer Review Summary | Property, amount, expiry, disclosure | Buyer offer, seller counter, buyer counter | Read-only definition list; edit action; stacks mobile |
| Non-Binding Disclosure | Information icon + approved text | Offer, counter, acceptance | Always text, not tooltip; pale blue treatment |
| Offer Status Badge | Short current status | Waiting, action, accepted, closed, expired | Text + icon; no colour-only meaning; limited use |
| Offer Card | Property context + current status + action | Buyer, seller, closed, unavailable | Whole card not one giant link; explicit action link; mobile stack |
| Buyer Offers List | Tabs/filters + cards | Empty, loading, partial error | Announce result count; keyboard filter controls |
| Seller Offers Inbox | Structured comparison rows | Desktop rows, mobile cards | Column headers; mobile semantic cards; no horizontal-scroll dependency |
| Listing Offer Summary | Listing-level stats and links | Live, paused, under offer | Stats use plain text; hides private info outside seller routes |
| Offer Comparison Row | Buyer-safe label, amount, difference, threshold, action | Above/below threshold, waiting, closed | Not a ranking; accessible table/list semantics |
| Offer Detail Header | Breadcrumb, property, title, state | Buyer, seller | One `h1`; status and next action beneath |
| Buyer-Safe Identity | Buyer number + verified label | Standard | No real identity/ID derivation; stable per listing |
| Negotiation Timeline | Ordered list of immutable events | Active, closed | Structured list; latest change announced; no chat styling |
| Timeline Event | Marker, actor, action, amount, time | Buyer, seller, system | Complete textual event; datetime element |
| Counteroffer Form | Context, amount, expiry, comparison | Buyer, seller, review | Focus first field; mobile sheet; close restores focus |
| Accept Confirmation Dialog | Consequence summary + disclosure | Seller accepts buyer; buyer accepts counter | Focus trap; primary consequential but blue, not green celebration |
| Reject Confirmation Dialog | Explanation + private reason | Seller, buyer | Focus trap; restrained destructive treatment |
| Withdraw Confirmation Dialog | Consequence + actions | Buyer | Focus trap; no undo promise |
| Expiry Selector | Four radio/select options | 48h, 3d, 7d, none | Native/select semantics; exact resulting date shown |
| Threshold Indicator | Seller-only classification | At/above, below | Never sent/rendered for buyer projection |
| Next Action Panel | Current proposal + dominant actions | Buyer action, seller action, waiting, closed | Sticky desktop; mobile bottom bar; status announced |
| Offer Notification Badge | Unread/action count | 0, 1–99, 99+ | Accessible name includes count; not threshold count leak to buyer |
| Realtime Status Indicator | Degraded connection banner | Reconnecting, stale, recovered | Hidden when healthy; polite announcement |
| Closed Offer Panel | Reason and allowed next step | Rejected, withdrawn, expired, unavailable, other accepted | Calm neutral surface; no active controls |
| Accepted Offer Success Panel | Accepted amount + Week 5 handoff | Buyer, seller | No confetti; focus success heading |
| Mobile Offer Action Bar | Primary action controls | Buyer, seller, waiting | Safe-area inset; 48 px actions; logical order in RTL |

## 32.1 Reuse

Reuse existing:

- Property mini-summary
- Price formatting
- Authentication interception pattern
- Status panel
- Dialog
- Form error
- Loading button
- Skeleton
- Empty state
- Tabs
- Filter sheet
- Marketplace header
- Notification shell
- Mobile sticky action pattern

---

# 33. Validation Matrix

| Screen | Field/action | Rule | Trigger | English copy | Placement | Clears when | Blocking? | Arabic review |
|---|---|---|---|---|---|---|---|---|
| Offer form | Amount empty | Required | Blur/submit | `Enter your offer amount.` | Under field | Valid amount | Yes | Language |
| Offer form | Zero | > 0 | Blur/submit | `Offer amount must be greater than zero.` | Under field | > 0 | Yes | Language |
| Offer form | Negative | Positive only | Input/submit | `Enter a positive offer amount.` | Under field | Positive | Yes | Language |
| Offer form | Invalid number | Whole AED number | Input/submit | `Enter a valid amount in AED.` | Under field | Valid | Yes | Language |
| Offer form | Amount too large | ≤ 999,999,999 | Submit | `Offer amount must be AED 999,999,999 or less.` | Under field | Within max | Yes | Language |
| Offer form | Decimals | Whole dirhams | Input/submit | `Enter the amount in whole dirhams.` | Under field | Integer | Yes | Language |
| Offer form | Low warning | >20% below asking | Valid input | `This offer is significantly below the asking price. You can still submit it, but the seller may be less likely to respond.` | Below comparison | Amount changes | No | Language |
| Offer form | High warning | >20% above asking | Valid input | `This offer is significantly above the asking price. Review the amount before continuing.` | Below comparison | Amount changes | No | Language |
| Eligibility | Own listing | Buyer must not own | Open/submit | `This is your listing. Manage offers from My Listings.` | Page panel | Different listing | Yes | Language |
| Eligibility | Non-LIVE/paused | Must be LIVE/available | Open/submit | `This property is no longer available for offers.` | Page panel | Listing available | Yes | Language |
| Eligibility | Under offer | No accepted offer | Open/submit | `This property is under offer and is not accepting new offers.` | Page panel | Not reversible in Week 4 | Yes | Language |
| Offer form | Existing active thread | One active thread | Open/submit | `You already have an active offer for this property.` | Page alert | Open thread | Yes | Language |
| Submit | Duplicate request | Idempotent | Double request | No error; route to existing submitted thread | N/A | N/A | No | N/A |
| Counter | Amount invalid | Same rules | Blur/submit | `Enter a valid counteroffer amount in AED.` | Under field | Valid | Yes | Language |
| Counter | Same as current | Must differ | Submit | `This matches the current proposal. Accept it instead, or enter a different amount.` | Under field | Different | Yes | Language |
| Thread action | Proposal expired | Before action | Server response | `This proposal has expired and can no longer be acted on.` | Form alert | Refresh/new thread | Yes | Language |
| Thread action | Already acted on | Current version required | Server response | `This offer has changed. We have refreshed the latest status.` | Page alert | Refresh | Yes | Language |
| Accept | Stale proposal | Current proposal required | Confirm | `A newer proposal is available. Review it before accepting.` | Dialog/page alert | Review current | Yes | Language |
| Accept | Second accepted offer | Only one per listing | Server conflict | `Another offer has already been accepted for this property.` | Dialog/page alert | Refresh | Yes | Security + language |
| Withdraw | Already accepted | Active only | Confirm | `This offer has already been accepted and cannot be withdrawn.` | Dialog alert | N/A | Yes | Language |
| Negotiation | Listing paused | Listing available | Event/action | `The listing was paused, so this negotiation is now closed.` | Closed panel | New listing cycle | Yes | Language |
| Negotiation | Material change | Original facts invalidated | Event/action | `The property details changed, so this negotiation is now closed.` | Closed panel | New offer | Yes | Language |
| Realtime | Conflict | Version mismatch | Mutation | `Another action was completed first. Review the latest status.` | Page alert | Refresh | Yes | Language |
| Session | Expired | Active auth required | Any mutation | `Your session has expired. Sign in again to continue.` | Session notice | Sign in | Yes | Security + language |

---

# 34. Responsive Behaviour

## 34.1 Breakpoints

Follow shared Tailwind breakpoints.

- Mobile: below 768 px
- Tablet: 768–1023 px
- Desktop: 1024 px and above

## 34.2 Offer form

Desktop:

- 2 columns
- 1180 px max
- 680–720 px form
- sticky property summary

Tablet:

- single column
- property summary above form
- 640 px max form

Mobile:

- full width
- compact property header
- sticky bottom Review button
- AED numeric keyboard
- no horizontal scroll

## 34.3 Offer detail

Desktop:

- 8/4 column layout
- timeline main
- sticky current decision panel

Tablet:

- current proposal above timeline
- action panel below proposal, not sticky if vertical space limited

Mobile:

- property mini-summary
- current proposal
- status
- timeline
- bottom sticky action bar
- dialogs become bottom sheets where appropriate

## 34.4 Seller inbox

Desktop:

- structured rows with aligned amounts
- filter toolbar
- sort at logical end

Tablet:

- condensed rows
- hide secondary timestamps behind detail

Mobile:

- card list
- filter and sort buttons
- full-screen filter sheet
- no table horizontal scroll

## 34.5 Confirmation dialogs

- Desktop width 480–560 px
- Mobile bottom sheet or full-width dialog
- Consequence summary remains visible before action
- Primary and secondary stack on narrow screens
- Safe-area bottom padding

## 34.6 Amount display

- Keep `AED` and digits together through bidi isolation
- Use tabular numbers
- Avoid truncating amounts
- Scale large amount typography down at narrow widths without reducing below 28 px for primary amount

## 34.7 Touch and keyboard

- 44 × 44 px minimum targets
- Mobile primary controls 48 px high
- Enter submits only when appropriate
- Escape closes dialogs/sheets
- Sticky bars do not hide final timeline content

---

# 35. Arabic and RTL Behaviour

All Arabic copy is draft and requires professional review.

## 35.1 Mirrors

- Page layout columns
- Breadcrumb direction
- Navigation
- Filters and sort placement
- Drawer/sheet origin
- Timeline visual rail
- Action-group alignment
- Directional arrows
- Dialog button visual order
- Sticky action alignment

## 35.2 Remains LTR

- AED amounts
- Digits
- Percentages
- Date/time numeric fragments
- Opaque route/reference identifiers
- Mixed Latin building/community names where source is Latin

Use bidi isolation around mixed content.

## 35.3 Amount input

- Label and helper RTL
- Input value LTR
- AED prefix visually stable
- Arabic-Indic digits accepted and normalised
- Caret follows numeric LTR behaviour

## 35.4 Timeline

- Timeline rail mirrors to logical start
- Actor labels and text align RTL
- Amounts remain isolated LTR
- Chronological order remains oldest to newest
- Buyer/seller distinction is text-based, not side-based

## 35.5 Action order

Logical priority remains:

- Accept
- Counter
- Reject

In RTL, visual placement mirrors but semantic tab order follows the Arabic reading sequence. Destructive actions remain lower emphasis.

## 35.6 Dates and expiry

Display translated date text with isolated numeric fragments. Screen readers receive full localised phrases.

## 35.7 Mixed property names

Do not translate registered building names automatically. Wrap English names with correct language/direction metadata inside Arabic sentences.

---

# 36. Accessibility

Target WCAG 2.2 AA.

## 36.1 Structure

- One `h1` per route
- Main, navigation, complementary, and footer landmarks
- Offer list result count announced after filtering
- Thread uses heading hierarchy: current proposal, next action, history

## 36.2 Forms

- Persistent visible labels
- AED input described by asking-price and comparison text
- Errors programmatically associated
- Error summary after failed submit
- Warnings use status semantics, not error semantics
- Expiry options have full labels and resulting date helper

## 36.3 Dialogs

- Focus moves to dialog heading
- Focus trapped
- Escape closes unless action is processing
- Close restores trigger focus
- Consequence and disclosure read before primary action in DOM order

## 36.4 Timeline

- Ordered list
- Each event is a list item
- Actor, action, amount, and time form one coherent accessible sentence
- Icons decorative when text duplicates meaning
- Newly received event announced politely

## 36.5 Realtime

- No announcement for healthy heartbeats
- One announcement for meaningful state transition
- Reconnecting not repeated continuously
- Manual Refresh available

## 36.6 Status

- Colour never sole indicator
- Current next action expressed in text
- Accepted/rejected/expired include explicit labels
- Buyer/seller perspective not represented only through marker colour

## 36.7 Amount announcement

Screen-reader labels should read complete amounts as UAE dirhams, not separator characters.

## 36.8 Motion

- Respect reduced motion
- No pulsing expiry
- No celebratory acceptance animation
- Timeline insertion uses no required motion

---

# 37. Security and Privacy Rules

## 37.1 Never expose

- Buyer email or phone
- Buyer full legal identity
- Seller email or phone
- Ownership documents
- Verification internals
- Private unit number
- Other buyers’ amounts
- Other buyer identities
- Notification threshold to buyers
- Internal database IDs in rendered copy
- Audit events
- Admin notes
- Raw rejection notes
- Storage paths
- Authentication tokens
- Realtime private-channel credentials

## 37.2 Authorisation

- Anonymous: no offer reads/writes
- Buyer: own threads only
- Seller: threads for owned listings only
- Customer cannot query another buyer’s thread
- Owner cannot make offer on own listing
- Thread actions validated server-side
- Listing ownership validated server-side
- RLS must enforce participant access, not only UI/API checks

## 37.3 Safe failures

Missing and forbidden thread use the same copy:

> This offer is not available.

Do not disclose whether a thread ID exists.

## 37.4 Concurrency

Every mutation includes expected current version/proposal where supported. Server prevents:

- double accept;
- action on superseded proposal;
- withdraw after acceptance;
- counter after expiry;
- action after pause;
- duplicate proposal from double-click.

## 37.5 Audit events

Safe events may include:

- `OFFER_THREAD_CREATED`
- `OFFER_PROPOSAL_SUBMITTED`
- `OFFER_VIEWED`
- `OFFER_COUNTERED`
- `OFFER_ACCEPTED`
- `OFFER_REJECTED`
- `OFFER_WITHDRAWN`
- `OFFER_EXPIRED`
- `OFFER_CLOSED_OTHER_ACCEPTED`
- `OFFER_CLOSED_LISTING_UNAVAILABLE`
- `OFFER_ACCESS_DENIED`

Never audit tokens, contact information, raw request bodies, free-form text, or Realtime credentials.

---

# 38. Exact English Copy

## 38.1 Property and offer creation

| Key | English |
|---|---|
| `offer.cta.make` | Make an offer |
| `offer.cta.view` | View your offer |
| `offer.cta.underOffer` | Under offer |
| `offer.form.title` | Make an offer |
| `offer.form.description` | Enter the amount you would like the seller to consider. |
| `offer.form.amount` | Your offer |
| `offer.form.asking` | Asking price: AED {amount} |
| `offer.form.expiry` | Offer validity |
| `offer.form.expiryHelp` | The seller must respond before this proposal expires. |
| `offer.form.review` | Review offer |
| `offer.form.cancel` | Cancel |
| `offer.warning.low` | This offer is significantly below the asking price. You can still submit it, but the seller may be less likely to respond. |
| `offer.warning.high` | This offer is significantly above the asking price. Review the amount before continuing. |

## 38.2 Review and submission

| Key | English |
|---|---|
| `offer.review.title` | Review your offer |
| `offer.review.description` | Check the amount and validity before sending it to the seller. |
| `offer.disclosure.nonBinding` | This offer is an expression of interest for this prototype. It does not create a legally binding property agreement. |
| `offer.review.edit` | Edit offer |
| `offer.review.submit` | Submit offer |
| `offer.review.submitting` | Submitting offer… |
| `offer.submitted.title` | Your offer has been sent |
| `offer.submitted.body` | The seller can review, accept, reject, or propose a different amount. |
| `offer.status.waitingSeller` | Waiting for seller |
| `offer.action.viewDetails` | View offer details |
| `offer.action.myOffers` | View My Offers |

## 38.3 Offers hub

| Key | English |
|---|---|
| `offers.title` | Offers |
| `offers.tab.made` | Made by me |
| `offers.tab.received` | Received on my listings |
| `offers.filter.all` | All |
| `offers.filter.action` | Needs your action |
| `offers.filter.waiting` | Waiting |
| `offers.filter.accepted` | Accepted |
| `offers.filter.closed` | Closed |
| `offers.buyer.emptyTitle` | You have not made any offers yet |
| `offers.buyer.emptyBody` | Browse properties and make an offer when you find the right home. |
| `offers.seller.title` | Offers received |
| `offers.seller.description` | Review and respond to offers across your live listings. |
| `offers.seller.emptyTitle` | No offers received yet |
| `offers.seller.emptyBody` | Offers from interested customers will appear here. |
| `offers.action.browse` | Browse properties |

## 38.4 Status and next action

| Key | English |
|---|---|
| `offer.status.responseNeeded` | Your response is needed |
| `offer.status.waitingBuyer` | Waiting for buyer |
| `offer.status.accepted` | Offer accepted |
| `offer.status.rejected` | Offer declined |
| `offer.status.withdrawn` | Offer withdrawn |
| `offer.status.expired` | Offer expired |
| `offer.status.unavailable` | Listing unavailable |
| `offer.status.otherAccepted` | Property is under offer |
| `offer.context.otherOffers` | The seller may be reviewing other offers. |
| `offer.threshold.above` | At or above notification threshold |
| `offer.threshold.below` | Below notification threshold |
| `offer.threshold.help` | The threshold controls immediate notifications only. It does not prevent or hide lower offers. |

## 38.5 Counter

| Key | English |
|---|---|
| `counter.seller.title` | Make a counteroffer |
| `counter.buyer.title` | Propose a different amount |
| `counter.description` | Enter a new amount for the other party to consider. |
| `counter.review` | Review counteroffer |
| `counter.submit` | Submit counteroffer |
| `counter.submitting` | Submitting counteroffer… |
| `counter.disclosure` | This counteroffer remains part of a non-binding prototype negotiation. |
| `counter.equalError` | This matches the current proposal. Accept it instead, or enter a different amount. |
| `counter.received` | The seller proposed a different amount. |
| `counter.buyerSubmitted` | Your counteroffer has been sent to the seller. |

## 38.6 Accept, reject, withdraw

| Key | English |
|---|---|
| `accept.title` | Accept this offer? |
| `accept.body` | This will select this buyer’s offer and close other active negotiations for the property. |
| `accept.week5` | Transaction setup will continue in the next stage. |
| `accept.disclosure` | This prototype acceptance does not create a legally binding property agreement. |
| `accept.action` | Accept offer |
| `accept.counterTitle` | Accept this counteroffer? |
| `accept.counterAction` | Accept counteroffer |
| `accept.successTitle` | Offer accepted |
| `accept.sellerSuccess` | This buyer’s offer has been selected. The transaction setup will continue in the next stage. |
| `accept.buyerSuccess` | The seller’s proposal has been accepted. Transaction setup will continue in the next stage. |
| `reject.title` | Reject this offer? |
| `reject.body` | This negotiation will close. The buyer will see that the offer was declined. |
| `reject.action` | Reject offer |
| `reject.keep` | Keep offer open |
| `reject.counterTitle` | Reject this counteroffer? |
| `reject.counterAction` | Reject counteroffer |
| `withdraw.title` | Withdraw this offer? |
| `withdraw.body` | The seller will no longer be able to accept or respond to this offer. |
| `withdraw.action` | Withdraw offer |
| `withdraw.keep` | Keep offer open |

## 38.7 Closed and error states

| Key | English |
|---|---|
| `closed.expiredTitle` | This offer has expired |
| `closed.expiredBody` | The proposal is no longer available to accept or counter. |
| `closed.otherAcceptedTitle` | Property is under offer |
| `closed.otherAcceptedBody` | The seller selected another offer, so this negotiation is now closed. |
| `closed.pausedBody` | The listing was paused, so this negotiation is now closed. |
| `closed.changedBody` | The property details changed, so this negotiation is now closed. |
| `error.notAvailableTitle` | This offer is not available |
| `error.notAvailableBody` | It may no longer exist, or you may not have permission to view it. |
| `error.staleTitle` | This offer has changed |
| `error.staleBody` | Another action was completed before yours. We have refreshed the latest status. |
| `error.generic` | We could not complete this action. Review the latest offer status and try again. |
| `error.session` | Your session has expired. Sign in again to continue. |
| `realtime.reconnecting` | Reconnecting to live updates… |
| `realtime.stale` | Updates may be delayed. Refresh to check the latest offer status. |
| `realtime.recovered` | Offer status is up to date. |

## 38.8 Authentication interception

| Key | English |
|---|---|
| `offer.auth.title` | Sign in to make an offer |
| `offer.auth.body` | Create or sign in to your MARKAZ account, then return to this property to continue. |
| `offer.auth.signIn` | Sign in |
| `offer.auth.create` | Create account |
| `offer.auth.cancel` | Not now |

---

# 39. Arabic Copy and Review Flags

**Status:** All Arabic below is draft. Professional Arabic review is required. Non-binding, acceptance, property, and financial terminology also require legal/business review.

| English | Draft Arabic | Review |
|---|---|---|
| Make an offer | تقديم عرض | Language + property |
| View your offer | عرض تفاصيل عرضك | Language |
| Under offer | قيد التفاوض على عرض | Product + language |
| Your offer | عرضك | Language |
| Asking price | السعر المطلوب | Property |
| Offer validity | مدة صلاحية العرض | Legal + language |
| Review offer | مراجعة العرض | Language |
| Submit offer | إرسال العرض | Language |
| Your offer has been sent | تم إرسال عرضك | Language |
| Waiting for seller | بانتظار رد البائع | Language |
| Offers | العروض | Language |
| Made by me | العروض التي قدّمتها | Language |
| Received on my listings | العروض الواردة على عقاراتي | Property + language |
| Needs your action | يتطلب إجراءً منك | Language |
| Offer accepted | تم قبول العرض | Legal + language |
| Offer declined | تم رفض العرض | Language |
| Offer withdrawn | تم سحب العرض | Language |
| Offer expired | انتهت صلاحية العرض | Legal + language |
| Make a counteroffer | تقديم عرض مقابل | Legal + property |
| Propose a different amount | اقتراح مبلغ مختلف | Language |
| Accept offer | قبول العرض | Legal |
| Reject offer | رفض العرض | Legal |
| Withdraw offer | سحب العرض | Legal |
| At or above notification threshold | عند حد الإشعار أو أعلى منه | Product + language |
| Below notification threshold | أقل من حد الإشعار | Product + language |
| Buyer 01 | المشتري 01 | Product + language |
| Verified customer | عميل تم التحقق منه تجريبيًا | Business + language |
| Property is under offer | العقار قيد التفاوض على عرض | Product + language |
| Sign in to make an offer | سجّل الدخول لتقديم عرض | Language |
| This offer is not available | هذا العرض غير متاح | Security + language |
| Reconnecting to live updates… | جارٍ إعادة الاتصال بالتحديثات المباشرة… | Language |

Draft non-binding wording:

> هذا العرض هو تعبير عن الاهتمام ضمن هذا النموذج الأولي، ولا ينشئ اتفاقًا عقاريًا ملزمًا قانونًا.

Requires legal and professional Arabic review.

---

# 40. Design-to-Engineering Handoff

## 40.1 Screen handoff table

| Route / state | Screen | Perspective | Listing / offer state | Primary action | Secondary actions | Loading / error / conflict | Transition | Key implementation notes |
|---|---|---|---|---|---|---|---|---|
| Public property | Property with Make an Offer | Buyer/anon | LIVE + AVAILABLE | Make an offer | Save, Share | Eligibility refresh | Open auth/form | Reuse Week 3 detail; owner/under-offer variants |
| Property dialog | Anonymous interception | Anonymous | LIVE + AVAILABLE | Sign in | Create account, Not now | Listing recheck after auth | Safe return | Do not preserve amount |
| `/properties/.../offer` | Offer amount | Buyer | No active thread | Review offer | Cancel | Validation, unavailable | Local review state | AED whole dirhams; expiry default 7d |
| Same | Warning state | Buyer | Unusual valid amount | Review offer | Edit | Non-blocking warning | Review | Never expose threshold |
| Same | Review Offer | Buyer | Draft | Submit offer | Edit | Submit conflict/session | `AWAITING_SELLER` | Idempotent create |
| `/offers/[id]` | Offer submitted | Buyer | AWAITING_SELLER | View details | Property, My Offers | Thread load | Same thread | Success focus |
| `/offers?view=made` | Buyer Offers empty | Buyer | None | Browse properties | Switch tab | Load/error | Marketplace | Empty state |
| Same | Buyer Offers populated | Buyer | Mixed | Open next action | Filters | Partial load | Thread | Result announcement |
| `/offers/[id]` | Waiting for seller | Buyer | AWAITING_SELLER | Withdraw | Property | Realtime/stale | WITHDRAWN | No counter while own proposal current |
| Same | Seller counter received | Buyer | AWAITING_BUYER | Accept counter | Counter, Reject, Withdraw | Expiry/conflict | ACCEPTED/AWAITING_SELLER/REJECTED/WITHDRAWN | Sticky action panel |
| Same | Buyer counter form | Buyer | AWAITING_BUYER | Review counter | Cancel | Validation | Review | Immutable proposal |
| Same | Buyer accepts counter | Buyer | AWAITING_BUYER | Accept counteroffer | Cancel | Concurrent accept | ACCEPTED | Listing UNDER_OFFER |
| Same | Buyer rejects counter | Buyer | AWAITING_BUYER | Reject counteroffer | Continue negotiating | Stale | REJECTED | Closed |
| Same | Buyer withdrawal | Buyer | Active | Withdraw offer | Keep open | Stale/accepted | WITHDRAWN | Closed |
| Same | Accepted | Buyer | ACCEPTED | Return to Offers | View property | N/A | Week 5 future | No transaction UI |
| Same | Rejected/expired/unavailable | Buyer | Closed | Return to Offers | New offer if eligible | N/A | Closed | Reason-specific safe panel |
| `/offers?view=received` | Seller Offers empty | Seller | No threads | Return to listings | Switch tab | Load/error | My Listings | Clear explanation |
| Same | Seller Offers inbox | Seller | Mixed | Review offer | Filters/sort | Partial load | Thread | Threshold seller-only |
| `/sell/listings/[id]/offers` | Listing-specific offers | Seller | LIVE | Review offer | Manage/View public | Listing state conflict | Thread | Private comparison |
| `/offers/[id]` | Seller detail | Seller | AWAITING_SELLER | Accept | Counter, Reject | Stale/expired | Selected action | Buyer-safe identity |
| Dialog | Accept confirmation | Seller | Current proposal | Accept offer | Cancel | Double accept | ACCEPTED | Atomic close competing |
| Thread | Accept success | Seller | ACCEPTED | Manage listing | Return Offers | N/A | Under Offer | Week 5 handoff only |
| Panel | Counter form | Seller | AWAITING_SELLER | Review counter | Cancel | Validation | Review | Expiry reset |
| Thread | Counter submitted | Seller | AWAITING_BUYER | Return Offers | View thread | N/A | AWAITING_BUYER | Notification to buyer |
| Dialog | Reject confirmation | Seller | AWAITING_SELLER | Reject | Keep open | Stale | REJECTED | Reason private |
| Thread | Reject success | Seller | REJECTED | Return Offers | N/A | N/A | Closed | No undo |
| Listing view | Multiple active offers | Seller | LIVE + AVAILABLE | Review thread | Sort/filter | One may change live | Per thread | No ranking |
| Thread | Another offer accepted | Both | CLOSED_OTHER_ACCEPTED | Return Offers | View property | N/A | Closed | No selected details |
| Thread | Listing paused | Both | CLOSED_LISTING_UNAVAILABLE | Return Offers | Seller Manage | N/A | Closed | Old thread never resumes |
| Thread | Negotiation timeline | Both | Any | Context action | N/A | Skeleton/partial | N/A | Ordered immutable events |
| Banner | Realtime reconnecting | Both | Any | Refresh when stale | N/A | Connection | N/A | Server refetch |
| Thread | Stale conflict | Both | Changed | Review latest | N/A | Version mismatch | Refetch | Never replay action |
| Auth | Session expired | Both | Any active | Sign in | Cancel | N/A | Safe return | Require reconfirmation |
| Mobile | Offer action bar | Both | Actionable | Perspective action | More | Loading/conflict | Per action | Safe-area and RTL |
| RTL | Arabic offer detail | Both | Any | Same logic | Same | Same | Same | Amounts LTR; layout mirrored |

## 40.2 Requirement labels

Use:

- `[VISUAL]` layout, colour, typography, status styling
- `[INTERACTION]` input, dialog, filter, focus, Realtime behaviour
- `[PRODUCT]` account model, one-thread rule, expiry, no chat
- `[SECURITY]` authorisation, safe errors, return URL, concurrency
- `[PRIVACY]` buyer-safe identity, threshold and competing-offer secrecy
- `[STATE]` thread/proposal/listing availability transitions
- `[ACCESSIBILITY]` semantics, keyboard, announcements
- `[I18N]` English/Arabic/RTL
- `[OPTIONAL]` deferrable enhancement

---

# 41. Required High-Fidelity Mockups

## Priority P0 — approve before implementation

| Mockup | View | Perspective | Listing / offer state | Key interaction | Why approval is required | Engineering must not invent |
|---|---|---|---|---|---|---|
| 1. Property detail with Make an Offer | Desktop | Buyer | LIVE + AVAILABLE | Entry CTA | Integrates Week 4 into approved Week 3 page | CTA hierarchy, sticky placement, owner/under-offer variants |
| 2. Buyer offer form | Desktop | Buyer | Draft | AED entry + expiry | Defines financial hierarchy and warning treatment | Widths, comparison presentation, warning style |
| 3. Review Offer | Desktop | Buyer | Draft review | Submit | Consequence and disclosure hierarchy | Summary layout, copy placement, action order |
| 4. Buyer Offers dashboard | Desktop | Buyer | Mixed | Filter/action | Establishes unified Offers architecture | Card anatomy, filter hierarchy, status treatment |
| 5. Seller Offers inbox | Desktop | Seller | Multiple active | Compare and open | Most information-dense new screen | Row columns, buyer-safe identity, threshold visibility |
| 6. Listing-specific comparison | Desktop | Seller | LIVE, multiple threads | Compare | Defines private multiple-offer experience | Summary metrics, no ranking, responsive columns |
| 7. Seller offer detail | Desktop | Seller | AWAITING_SELLER | Accept/counter/reject | Core negotiation decision screen | 8/4 layout, action hierarchy, timeline placement |
| 8. Negotiation timeline | Desktop | Shared | Multi-counter | Understand history | Prevents chat-like interpretation | Actor styling, event spacing, chronology |
| 9. Counteroffer form | Desktop | Both variants | Active | Enter/review counter | Must work for buyer and seller | Comparison content, panel behaviour, expiry |
| 10. Accept confirmation | Desktop modal | Seller | Multiple active | Accept one | Highest-consequence action | Competing-thread warning, disclosure, button treatment |
| 11. Offer accepted | Desktop | Buyer and seller variants | ACCEPTED | Week 5 handoff | Defines end of milestone | No transaction UI, under-offer treatment |

## Priority P1 — approve during implementation

| Mockup | View | Perspective | State | Key interaction | Why | Must not invent |
|---|---|---|---|---|---|---|
| 12. Offer submitted | Desktop | Buyer | AWAITING_SELLER | Success/withdraw | Sets waiting-state tone | Success density and actions |
| 13. Below-threshold offer | Desktop | Seller | AWAITING_SELLER | Manual review | Protects threshold privacy and avoids negative styling | Indicator language and prominence |
| 14. Multiple-offer seller view | Desktop | Seller | Multiple | Filter/sort | Validates comparison without auction cues | No leaderboard/ranking |
| 15. Mobile buyer offer flow | Mobile | Buyer | Draft → review | Amount and sticky action | Ensures keyboard and safe-area behaviour | Form stacking, sticky CTA, review transition |
| 16. Mobile seller offer detail | Mobile | Seller | AWAITING_SELLER | Accept/counter/more | Consequential actions on small screen | Action order, bottom sheet, timeline |
| 17. Arabic RTL Buyer Offers | Desktop/mobile | Buyer | Mixed | Filters/open | Validates bidirectional amounts and status | Mirroring, amount isolation, text wrapping |
| 18. Arabic RTL Seller Offers | Desktop | Seller | Multiple | Compare | Most complex RTL information layout | Column order, threshold text, identity labels |

---

# 42. Open Product Decisions

| Decision | Recommendation in this spec | Required owner |
|---|---|---|
| Offer expiry | Include; default 7 days; 48h/3d/7d/none | Product |
| Offer notes | Exclude Week 4 | Product |
| Buyer-safe identity | Stable per-listing `Buyer 01` label + Verified customer | Product/privacy |
| Viewed event | Include only if consistently persisted; otherwise omit | Engineering/product |
| Accepted listing visibility | Remains public as Under offer | Product |
| Rejection reason | Predefined, seller-private | Product/legal |
| New offer after rejection/withdrawal | Allowed as new thread if listing available | Product |
| Paused listing threads | Close permanently; never auto-resume | Product |
| Material edit threads | Close permanently | Product |
| Under-offer Saved Properties | Remain visible with Under offer | Product |
| Full notification centre | Deferred; header menu + badges only | Product |
| Arabic copy | Draft only | Professional Arabic + legal |
| “Verified customer” wording | Demo verification meaning must be reviewed | Legal/business |
| Production Realtime channel policy | Participant-only private channels | Engineering/security |

---

# 43. Final Acceptance Checklist

## Model and account

- [ ] Only `CUSTOMER` and `ADMIN` account types exist
- [ ] No Buyer/Seller role switch exists
- [ ] One offer thread per buyer and listing is enforced
- [ ] Proposals are immutable and chronological
- [ ] User-facing and internal states match this specification
- [ ] Buyer-safe identity does not expose personal data

## Buyer

- [ ] Make an Offer appears only for eligible non-owners
- [ ] Anonymous interception preserves safe intent
- [ ] AED amount validation works
- [ ] Low/high warnings are non-blocking
- [ ] Threshold is never exposed
- [ ] Review and non-binding disclosure appear before submission
- [ ] Duplicate submit is idempotent
- [ ] Buyer Offers empty and populated states exist
- [ ] Seller counter supports Accept, Reject, Counter, and Withdraw
- [ ] Offer withdrawal works only before acceptance
- [ ] Expiry is server-authoritative
- [ ] Listing unavailable and other-offer-accepted states exist

## Seller

- [ ] Seller Offers inbox exists
- [ ] Listing-specific offer management exists
- [ ] Threshold classifications are seller-only
- [ ] Below-threshold offers remain visible
- [ ] Seller can Accept, Counter, or Reject
- [ ] Rejection reason is predefined and private
- [ ] Multiple threads may be negotiated separately
- [ ] Only one offer may be accepted
- [ ] Accept closes other active threads atomically
- [ ] Listing derives `UNDER_OFFER`
- [ ] New offers are blocked after acceptance

## Shared

- [ ] Negotiation timeline is not chat-styled
- [ ] Realtime events trigger authoritative refetch
- [ ] Reconnecting and stale states exist
- [ ] In-app notifications follow threshold rules
- [ ] No email, SMS, or push is implemented
- [ ] Pause closes active negotiations
- [ ] Material edits close active negotiations
- [ ] Closed threads do not auto-resume
- [ ] Week 5 handoff is shown without transaction UI

## Privacy and security

- [ ] Buyer and seller contact details never appear
- [ ] Buyers never see competing offers
- [ ] Buyers never see seller threshold
- [ ] Anonymous users cannot access offer data
- [ ] Participants and future authorised Admin only may access threads
- [ ] Missing and forbidden threads use unified safe copy
- [ ] Cross-buyer access is denied
- [ ] Owner-only seller routes are enforced server-side
- [ ] Stale and concurrent actions fail safely
- [ ] Tokens, internal errors, IDs, and raw notes are not exposed

## Quality

- [ ] Desktop, tablet, and mobile layouts follow the spec
- [ ] English catalogue is complete
- [ ] Arabic draft catalogue exists and is flagged
- [ ] RTL mirrors logical layout
- [ ] AED and numeric content remain LTR
- [ ] WCAG 2.2 AA requirements are met
- [ ] Dialog focus and restoration work
- [ ] Timeline semantics work
- [ ] Realtime announcements are restrained
- [ ] Touch targets meet 44 × 44 px
- [ ] Reduced motion is respected
- [ ] Loading, empty, error, session, and conflict states are implemented
- [ ] No raw technical errors or blank screens appear
- [ ] High-fidelity P0 mockups are approved before engineering invents layout decisions
- [ ] No transaction, payment, escrow, legal transfer, chat, or full Admin UI is included

---

## Final Design Intent

The Week 4 experience should communicate:

> A private, structured way for a buyer and seller to explore a price and reach a clear non-binding outcome.

It must not communicate:

- an auction;
- a bidding war;
- a legal contract;
- a chat relationship;
- financial trading;
- urgency or pressure;
- a completed property transaction.

The final implementation should retain MARKAZ’s calm Architectural Blue system, property-first visual context, precise amount hierarchy, and transparent next actions while protecting every participant’s identity, negotiation, and competing-offer information.
