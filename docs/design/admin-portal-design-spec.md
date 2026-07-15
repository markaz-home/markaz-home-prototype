# MARKAZ Home — Admin Portal and Operational Controls Design Specification

**File:** `MARKAZ-ADMIN-PORTAL-DESIGN-SPEC.md`  
**Status:** Implementation-ready design specification  
**Milestone:** Week 6 — Admin Portal and Operational Controls  
**Application:** Separate `apps/admin` deployment  
**Primary languages:** English and Arabic  
**Accessibility target:** WCAG 2.2 AA  
**Design direction:** Architectural Blue — Operational Precision  
**Last updated:** July 2026

---

## Milestone Understanding

Week 6 makes the existing separate MARKAZ Operations application genuinely operational. It does not redesign or duplicate the customer marketplace, listing wizard, publication, offer, or transaction experiences. Instead, it gives authorised Admin users a controlled oversight layer across the records and workflows already created in Weeks 1–5.

The portal must help an Admin answer four questions quickly:

1. **What needs attention?**
2. **What is the current verified system state?**
3. **What operational action is permitted?**
4. **What customer-visible and audit consequences will follow?**

The Admin portal is not a customer impersonation tool, unrestricted database editor, analytics warehouse, or developer console. It is a calm, auditable operations product with explicit capabilities, reason-coded interventions, strong privacy boundaries, and controlled state transitions.

The final experience covers:

- Operational overview and queues
- Customers and narrow account restrictions
- Listings and publication review
- Verification and document metadata oversight
- Read-only offer monitoring with limited operational closure
- Transaction monitoring and recovery
- Admin-only notes
- Entity activity history
- Global audit logs
- Realtime queue refresh
- English, Arabic, RTL, responsive and accessible behaviour

No shared Week 6 demo seed is required. Testing uses isolated fixtures, per-test records, and lightweight factories.

---

# 1. Executive Summary

MARKAZ Operations uses one `ADMIN` account type with server-controlled capability flags. All Admin routes are protected by the existing Admin authentication and server-side account-type guard. A customer opening the Admin application receives a safe Access Denied state.

The portal is organised around operational queues and entity investigation:

```text
Overview
├── Customers
├── Listings
├── Publication
├── Offers
├── Transactions
├── Verifications
└── Audit
```

The final product model is:

- **Read before acting:** entity screens prioritise current state, participant impact, and history.
- **Capabilities govern controls:** hidden or disabled controls never substitute for server enforcement.
- **Consequential actions require confirmation and reason codes.**
- **Admin notes and audit events remain separate.**
- **No arbitrary state dropdowns:** every action has explicit preconditions and allowed transitions.
- **Sensitive document content is metadata-only by default.**
- **Document access is temporary, reason-required, capability-controlled, and audited.**
- **Realtime updates trigger authoritative refetches.**
- **Customer-visible effects are previewed before action.**
- **Partial operational failures are represented honestly.**

## 1.1 Final product decisions

1. Keep one `ADMIN` account type; use capabilities rather than new account roles.
2. No customer impersonation or customer-mode switch.
3. Use a persistent dark-blue desktop sidebar and a compact mobile navigation sheet.
4. Use one global search that returns grouped, permission-filtered entity results.
5. Use page-based pagination for operational tables.
6. Use entity-specific timelines plus one global Audit area.
7. Admin notes are append-only; correction creates a new note referencing the prior note.
8. Customer restriction is narrow and operational rather than punitive.
9. Manual publication review uses the existing publication-request model; no second review model.
10. Offers are read-only by default; Admin cannot negotiate or accept for participants.
11. Transaction recovery controls act only on recoverable system tasks, never participant confirmations.
12. Private document access uses a five-minute signed viewing session, with access reason and audit event.
13. Action-needed counts come from authoritative entity state, not unread notifications.
14. No bulk consequential actions.
15. No shared Week 6 demo seed.

---

# 2. Scope

## 2.1 Included

### Admin foundation

- Admin sign-in continuity
- Access denied
- Admin shell
- Navigation
- Global search
- Operational dashboard
- Realtime queue refresh
- Permission-denied states

### Customers

- Customer list and search
- Customer profile
- Account and onboarding status
- Related listings, offers and transactions
- Narrow account restriction and restoration
- Admin notes
- Customer activity timeline

### Listings and publication

- Listing list and filters
- Listing detail
- Public/private data separation
- Verification and document metadata
- Publication queue
- Publication review
- Approve in demo
- Return for changes
- Retry public-photo preparation
- Pause and resume
- Block publication
- Publication history

### Verifications and documents

- Verification queue and detail
- Ownership, Form A, permit and transaction-document status
- Safe metadata
- Retry or mark-for-review controls where supported
- Temporary private-document viewing
- Document-access history

### Offers

- Offer-thread list and search
- Offer detail and proposal timeline
- Threshold classification
- Accepted offer and related transaction
- Read-only oversight
- Strict invalid-thread operational closure

### Transactions

- Transaction list and filters
- Transaction detail
- Current stage and next actor
- Participant task status
- Deposit simulation state
- Document completion
- Due diligence and transfer state
- Cancellation and completion
- Recoverable system-step retry
- Pause/resume progression
- Mark failed with reason
- Notes and audit

### Audit and operations

- Global audit log
- Entity activity timelines
- Admin action history
- Notifications
- Loading, empty, error, conflict and stale states
- English, Arabic and RTL
- Desktop, tablet and mobile
- WCAG 2.2 AA interaction requirements

## 2.2 Excluded

- Customer impersonation
- Acting as a buyer or seller
- Creating, countering or accepting offers for customers
- Editing accepted amounts or immutable participants
- Completing customer transaction tasks
- Real government or legal review
- Real payments, escrow or refunds
- Real identity verification
- Fraud, sanctions or credit scoring
- Production infrastructure monitoring
- Custom Admin role builder
- Complex multi-team permissions UI
- Bulk destructive actions
- Deleting audit records
- Deleting customer history
- Unrestricted document browsing
- Customer support chat
- Full BI or analytics warehouse
- Email, SMS or push delivery platform

---

# 3. Product and Account Rules

1. Account types remain `CUSTOMER` and `ADMIN`.
2. The Admin portal is a separate application and deployment.
3. There is no public Admin registration.
4. Customer credentials may authenticate with the provider but must fail the Admin account-type guard.
5. Admin controls never appear in customer routes or public marketplace UI.
6. An Admin cannot act as a customer.
7. Admin cannot directly edit immutable customer, listing, offer or transaction facts.
8. Every mutation revalidates current entity state and capability server-side.
9. Missing and forbidden entities use safe non-enumerating states when appropriate.
10. Admin actions never bypass the canonical domain transition rules.
11. Audit records are immutable and read-only.
12. Admin notes are operational records, not system facts.
13. Realtime is a refresh signal; server state is authoritative.
14. Sensitive data is displayed only when required for the specific operation.
15. All consequential Admin actions record actor, reason, prior state, resulting state and outcome.

---

# 4. Admin Operating Principles

## 4.1 Oversight before intervention

Every detail page leads with:

- current state;
- why it is in that state;
- customer or system action currently expected;
- latest meaningful event;
- whether Admin intervention is available.

## 4.2 Controlled transitions

Never show a generic `Change status` control. Use explicit actions such as:

- Return for changes
- Pause listing
- Retry photo preparation
- Restrict customer actions
- Retry failed system step
- Mark transaction failed

## 4.3 Facts, notes and audit remain distinct

- **System facts:** current state and persisted domain data.
- **Admin notes:** operational context written by Admin users.
- **Audit history:** immutable record of actions and transitions.

These must not be combined into one ambiguous timeline.

## 4.4 Explain impact before action

A confirmation must state:

- what changes;
- what remains unchanged;
- what the customer sees;
- whether notifications are created;
- whether the action is reversible.

## 4.5 Minimal sensitive exposure

List screens show safe summaries. Sensitive information appears only inside authorised detail sections or a controlled document-access flow.

## 4.6 Operational language

Prefer:

> Return this listing for changes

Avoid:

> Reject listing

Prefer:

> Retry public-photo preparation

Avoid:

> Re-run storage job

---

# 5. Permission and Capability Model

## 5.1 Recommended capabilities

```text
VIEW_OVERVIEW
VIEW_CUSTOMERS
MANAGE_CUSTOMER_STATUS
VIEW_LISTINGS
REVIEW_PUBLICATION
MANAGE_LISTING_AVAILABILITY
VIEW_OFFERS
CLOSE_INVALID_OFFER
VIEW_TRANSACTIONS
MANAGE_TRANSACTION_RECOVERY
VIEW_VERIFICATIONS
RETRY_SIMULATION
VIEW_PRIVATE_DOCUMENT_METADATA
ACCESS_PRIVATE_DOCUMENT
VIEW_AUDIT_LOGS
ADD_ADMIN_NOTES
```

One Admin account may hold all capabilities in the prototype, but every action and route must still call capability checks so the architecture can evolve without redesign.

## 5.2 Capability behaviour

| Capability                       | Read or action | Key controls               |
| -------------------------------- | -------------- | -------------------------- |
| `VIEW_OVERVIEW`                  | Read           | Dashboard and queues       |
| `VIEW_CUSTOMERS`                 | Read           | Customer list/profile      |
| `MANAGE_CUSTOMER_STATUS`         | Consequential  | Restrict/restore           |
| `VIEW_LISTINGS`                  | Read           | Listings/detail            |
| `REVIEW_PUBLICATION`             | Consequential  | Approve, return, retry     |
| `MANAGE_LISTING_AVAILABILITY`    | Consequential  | Pause/resume/block         |
| `VIEW_OFFERS`                    | Read           | Offer list/detail          |
| `CLOSE_INVALID_OFFER`            | Consequential  | Operational close only     |
| `VIEW_TRANSACTIONS`              | Read           | Transaction list/detail    |
| `MANAGE_TRANSACTION_RECOVERY`    | Consequential  | Retry, pause, resume, fail |
| `VIEW_VERIFICATIONS`             | Read           | Verification queue/detail  |
| `RETRY_SIMULATION`               | Consequential  | Retry supported simulation |
| `VIEW_PRIVATE_DOCUMENT_METADATA` | Read           | Metadata and status        |
| `ACCESS_PRIVATE_DOCUMENT`        | Sensitive      | Temporary view session     |
| `VIEW_AUDIT_LOGS`                | Read           | Global and entity audit    |
| `ADD_ADMIN_NOTES`                | Write          | Append operational note    |

## 5.3 Missing capability

Do not depend on a disabled button alone.

- Hide controls the Admin cannot use when their absence does not reduce understanding.
- Show a disabled control with explanatory text only when seeing the possible operational path helps investigation.
- Server rejection always wins.

Copy:

> **Permission required**  
> Your Admin account can view this record but cannot perform this action.

## 5.4 Confirmation and reason policy

| Action                        |                     Confirmation |   Reason required |                  Reversible |
| ----------------------------- | -------------------------------: | ----------------: | --------------------------: |
| Restrict customer             |                              Yes |               Yes |                         Yes |
| Restore customer              |                              Yes |               Yes |                         N/A |
| Approve publication           |                              Yes | No; optional note | No direct undo; pause later |
| Return for changes            |                              Yes |               Yes |          Customer resubmits |
| Retry publication preparation |                              Yes |                No |                  Retry-safe |
| Pause listing                 |                              Yes |               Yes |                         Yes |
| Resume listing                |                              Yes |               Yes |             Yes if eligible |
| Block publication             |                              Yes |               Yes |          Yes through review |
| Access private document       |                              Yes |               Yes |              Access expires |
| Close invalid offer           |                              Yes |               Yes |            No casual reopen |
| Retry transaction step        |                              Yes | No; optional note |                  Retry-safe |
| Pause transaction             |                              Yes |               Yes |                         Yes |
| Resume transaction            |                              Yes |               Yes |                Yes if valid |
| Mark transaction failed       |                              Yes |               Yes |    Restricted recovery only |
| Add Admin note                | Submit confirmation not required | Category required |      Append correction only |

---

# 6. Week 6 Entry and Exit Boundary

## 6.1 Entry

Week 6 begins with the existing system already supporting:

- customer authentication and onboarding;
- listing creation to `READY_TO_PUBLISH`;
- publication to `LIVE` and `PAUSED`;
- marketplace and Saved Properties;
- offer negotiation and accepted offers;
- derived `UNDER_OFFER` availability;
- one shared transaction per accepted proposal;
- transaction stages through `COMPLETED_DEMO`, cancellation or failure;
- canonical notifications, audit events, Realtime and private storage.

## 6.2 Exit

Week 6 is complete when an authorised Admin can:

- see operational queues;
- investigate any authorised customer, listing, publication request, offer or transaction;
- perform only the approved operational controls;
- access private documents through a controlled audit path;
- understand and search audit history;
- use the portal in English and Arabic across desktop, tablet and mobile;
- recover from stale, conflicted and partial states without raw technical errors.

## 6.3 What remains future

- specialised Admin roles and teams;
- formal case management;
- customer support messaging;
- production compliance tooling;
- advanced reporting and exports;
- real government, payment or legal integrations.

---

# 7. Design Principles

1. **Queues before charts:** surface operational work, not vanity statistics.
2. **Dense but breathable:** Admin is the densest MARKAZ surface, but not spreadsheet overload.
3. **One primary action per context:** avoid action clusters with equal emphasis.
4. **State and reason together:** never show a status without why or what is next.
5. **Customer impact is visible:** preview customer-facing consequences.
6. **Public/private separation:** label information zones clearly.
7. **Simulation is explicit:** use `in demo` or `simulated` where meaning could be misunderstood.
8. **Safe colour usage:** blue for action, amber for attention, red for failed/blocking conditions, green for completed states.
9. **No technical-console aesthetic:** hide stack traces and internal storage concepts.
10. **Auditability is visible:** consequential actions show actor and time afterward.
11. **Desktop first, not desktop only:** all required actions remain usable on mobile.
12. **Accessible is operational reliability:** focus, table semantics and status announcements are mandatory.

---

# 8. Information Architecture

```text
MARKAZ Operations
│
├── Overview
│   ├── Operational metrics
│   ├── Action-needed queues
│   └── Recent Admin actions
│
├── Customers
│   ├── Customer list
│   └── Customer profile
│
├── Listings
│   ├── Listing list
│   └── Listing detail
│
├── Publication
│   ├── Review queue
│   └── Review detail
│
├── Offers
│   ├── Offer-thread list
│   └── Offer detail
│
├── Transactions
│   ├── Transaction list
│   └── Transaction detail
│
├── Verifications
│   ├── Verification queue
│   └── Verification detail
│
├── Audit
│   ├── Global event list
│   └── Event detail
│
└── Utilities
    ├── Global search
    ├── Notification menu
    ├── Language
    └── Admin account
```

Admin notes are embedded in entity detail pages rather than a standalone primary section.

Documents are accessed from related listing, verification or transaction entities; do not add a global document browser in Week 6.

---

# 9. Route Recommendations

```text
/[locale]/overview
/[locale]/search
/[locale]/customers
/[locale]/customers/[customerId]
/[locale]/listings
/[locale]/listings/[listingId]
/[locale]/publication
/[locale]/publication/[publicationRequestId]
/[locale]/offers
/[locale]/offers/[offerThreadId]
/[locale]/transactions
/[locale]/transactions/[transactionId]
/[locale]/verifications
/[locale]/verifications/[verificationId]
/[locale]/audit
/[locale]/audit/[auditEventId]
/[locale]/access-denied
/[locale]/signed-out
```

Route identifiers are opaque and authenticated. They must not be exposed in visible copy unless the entity has an approved human-readable reference.

## 9.1 Reference display

Use:

- Public property ID for public listing context
- Transaction reference for transaction context
- Human-safe offer reference generated for Admin display
- Verification reference generated for Admin display

Do not display raw database UUIDs in headings, table cells or copy-to-clipboard controls.

---

# 10. Admin Navigation

## 10.1 Desktop sidebar

Width:

- Expanded: 256 px
- Collapsed: 72 px

Surface: Deep Architectural Blue `#0F2A44`.

Order:

1. Overview
2. Customers
3. Listings
4. Publication
5. Offers
6. Transactions
7. Verifications
8. Audit

Bottom utilities:

- Language
- Admin account
- Environment label in non-production only
- Sign out

## 10.2 Badges

Show action-needed counts on:

- Publication
- Transactions
- Verifications

Offers may show actionable stale/conflict count only if operational intervention exists; do not show total offer volume as a badge.

Counts come from authoritative queries.

## 10.3 Collapsed state

- Icons remain visible.
- Tooltip shows section name and count.
- Current section uses a clear filled indicator.
- Collapse preference may persist locally; it is not security-sensitive.

## 10.4 Mobile

Use a top bar with:

- compact MARKAZ Operations mark;
- page title;
- search button;
- notifications;
- menu button.

Menu opens a full-height navigation sheet from logical start. It includes the complete navigation, capability-filtered.

## 10.5 Keyboard and accessibility

- Sidebar is a labelled navigation landmark.
- Skip link moves to main content.
- Current item uses `aria-current="page"`.
- Collapsed icon buttons retain accessible names.
- Mobile sheet traps focus and restores it to menu trigger.

---

# 11. Admin Dashboard

Route: `/[locale]/overview`

## 11.1 Page objective

Help Admin identify operational work and move to the correct queue in under ten seconds.

## 11.2 Desktop layout

Max content width: 1600 px.

```text
Page header: Operations overview         Last refreshed / Refresh

Operational metrics: 4 compact cards

Action needed
├── Publication reviews
├── Publication failures
├── Transaction issues
└── Verification failures

Current activity
├── Listings by state
├── Active / under-offer listings
├── Active transactions
└── Completed demo transactions

Recent Admin actions
```

Do not use pie charts. Use counts, change text where meaningful, and queue previews.

## 11.3 Operational metric cards

Recommended metrics:

- Active customers
- Live listings
- Active offer threads
- Active transactions

Each card includes:

- label;
- current count;
- one contextual subline;
- direct destination.

Example:

> **Active transactions**  
> 18  
> 3 need operational attention

## 11.4 Queue cards

Required:

- Publication reviews pending
- Failed publication attempts
- Transactions blocked or failed
- Verification failures
- Listings paused by Admin

Each queue card shows up to five records and a `View queue` link.

## 11.5 Recent Admin actions

Show:

- action;
- entity;
- Admin display name;
- relative time;
- result.

Do not show raw audit metadata.

## 11.6 Loading and partial failure

- Metric skeletons retain card size.
- Queue skeletons use three rows.
- If one query fails, render other sections and show section-level retry.

Copy:

> Some operational information could not be loaded. The available sections are still current.

## 11.7 Realtime

On queue-relevant event:

- show subtle `Updated` indicator;
- refetch affected count and preview;
- do not reorder while Admin is interacting with a menu or dialog;
- announce only meaningful count changes.

---

# 12. Global Search

## 12.1 Search scope

Search permission-filtered records by:

- customer display name;
- customer email;
- public property ID;
- listing reference or slug;
- transaction reference;
- offer reference;
- verification reference;
- community or building;
- Admin note reference where indexed.

Do not search document contents.

## 12.2 Interaction

Desktop search opens from header shortcut or `Ctrl/Cmd + K`.

Mobile opens a dedicated search page.

Placeholder:

> Search customers, listings, offers or transactions

Minimum query:

- two characters for partial text;
- exact reference may search from one complete recognised pattern.

## 12.3 Results

Group results:

- Customers
- Listings
- Offers
- Transactions
- Verifications

Each result shows safe context only.

Example:

> **Transaction TXN-2026-00421**  
> Dubai Marina · Deposit stage · Action required

## 12.4 Keyboard

- Arrow keys move through results.
- Enter opens.
- Escape closes.
- Group labels are announced.
- Search loading uses polite status.

## 12.5 No results

> **No matching records**  
> Check the spelling, use a full reference, or try a broader search.

## 12.6 Mixed-language search

- Arabic and English text accepted.
- Email and references remain LTR.
- Building names match stored Arabic or Latin values where available.
- Do not auto-translate the query.

---

# 13. Customer List

Route: `/[locale]/customers`

## 13.1 Columns

- Customer
- Account status
- Onboarding
- Listings
- Active offers
- Active transactions
- Created
- Last activity
- Attention

Customer cell:

- display name;
- partially masked or permission-approved email;
- no phone or identity number.

## 13.2 Filters

- Active
- Restricted
- Onboarding incomplete
- Has live listing
- Has accepted offer
- Has active transaction
- Created date
- Last activity date

Default sort: Last activity, newest first.

## 13.3 Account status language

- Active
- Actions restricted

Do not use `Banned`, `Fraud`, or `Suspicious` without a formal approved policy.

## 13.4 Action-needed indicator

Show only when:

- onboarding inconsistency;
- restricted account with active transaction;
- failed system-linked customer record;
- operational follow-up note due.

Do not calculate an opaque risk score.

## 13.5 Mobile

Transform rows to cards showing:

- customer;
- status;
- onboarding;
- related-record counts;
- last activity;
- `View customer`.

---

# 14. Customer Profile

Route: `/[locale]/customers/[customerId]`

## 14.1 Header

Show:

- display name;
- safe email;
- Active / Actions restricted;
- onboarding status;
- created date;
- last activity;
- primary operational action.

Do not show a customer avatar generated from initials as if it were verified identity. A neutral account icon is sufficient.

## 14.2 Sections

1. Overview
2. Listings
3. Offers made
4. Offers received
5. Transactions
6. Notifications summary
7. Admin notes
8. Activity

Use tabs or anchored sections. On mobile use an accessible section selector.

## 14.3 Overview

Display:

- account type: Customer;
- email verification status;
- demo identity status;
- onboarding completion;
- account operational status;
- active-session status only if safely available as aggregate;
- related record counts.

Never show password or authentication token information.

## 14.4 Related records

Each section uses compact records and links to authoritative entity detail. Do not duplicate every field.

## 14.5 Notification summary

Show counts by state:

- unread;
- recent failed delivery record only if in-app creation failed;
- no notification content containing sensitive amounts unless already authorised on the destination entity.

---

# 15. Account Restriction

## 15.1 Final Week 6 model

Use one narrow operational status:

```text
ACTIVE
ACTIONS_RESTRICTED
```

Restriction does **not** delete the account or change identity data.

## 15.2 What restriction blocks

| Area                                       | Behaviour                                                               |
| ------------------------------------------ | ----------------------------------------------------------------------- |
| Sign-in                                    | Allowed so customer can view existing records and required notices      |
| New listing creation                       | Blocked                                                                 |
| Listing publication/resume                 | Blocked                                                                 |
| New offers                                 | Blocked                                                                 |
| Counter, accept, reject or withdraw offers | Blocked pending review                                                  |
| Existing transaction access                | Allowed                                                                 |
| Required transaction tasks                 | Allowed unless transaction is separately paused                         |
| Saved properties                           | Read/remove allowed; new save may remain allowed                        |
| Public listing visibility                  | Unchanged automatically                                                 |
| New offers on customer-owned listings      | Blocked through derived availability until restored or listing reviewed |

This avoids silently pausing or deleting public records while preventing new negotiation activity.

## 15.3 Restrict confirmation

**Title:**

> Restrict customer actions?

**Body:**

> The customer will still be able to sign in and view existing records, but they will not be able to create listings, publish listings, or take part in offer negotiations until access is restored.

Required reason:

- Account review
- Listing investigation
- Offer investigation
- Transaction issue
- Verification issue
- Operational follow-up
- Other approved operational reason

Optional Admin note: maximum 1,000 characters.

Primary:

> Restrict actions

## 15.4 Customer-visible copy

> **Some account actions are temporarily unavailable**  
> You can still view your existing records and complete permitted transaction steps. Contact MARKAZ support for assistance.

Do not expose internal reason or note.

## 15.5 Restore

**Title:**

> Restore customer actions?

**Body:**

> The customer will be able to create listings and participate in offers again. Existing listing and transaction states will not change automatically.

Reason required:

- Review completed
- Issue resolved
- Restriction applied in error
- Other approved reason

Primary:

> Restore actions

## 15.6 Conflict

If another Admin already changed status:

> **Customer status has changed**  
> Review the latest status before taking another action.

---

# 16. Admin Notes

## 16.1 Data model and policy

Admin notes are:

- Admin-only;
- timestamped;
- authored;
- categorised;
- append-only;
- attached to one entity;
- searchable only within authorised scope.

Categories:

- Review note
- Customer support note
- Listing investigation
- Offer investigation
- Transaction issue
- Verification issue
- Follow-up required

## 16.2 Add note

Fields:

- Category — required
- Note — required, 3–1,000 characters
- Follow-up date — optional

Privacy warning:

> Do not include passwords, authentication tokens, payment details, identity numbers, or document contents.

Primary:

> Add note

## 16.3 Editing and deletion

- No hard delete.
- No silent edit.
- To correct a note, create a new note with category `Correction` and reference the previous note.
- A clearly erroneous note may be hidden from default display only with an elevated audit action; the record remains preserved.

## 16.4 Display

Each note shows:

- category;
- author;
- timestamp;
- content;
- follow-up state;
- correction reference where applicable.

Admin notes do not appear in the immutable product-event timeline.

---

# 17. Listing List

Route: `/[locale]/listings`

## 17.1 Columns

- Property
- Owner
- Listing state
- Publication
- Verification
- Offer availability
- Active offers
- Transaction
- Published / updated
- Attention

## 17.2 Filters

- Draft
- Ready to publish
- Publication pending
- Live
- Paused
- Sold in demo
- Verification failed
- Publication failed
- Has active offers
- Under offer
- Has active transaction
- Owner
- Emirate
- Community
- Updated date

Default sort: Attention first, then latest updated.

## 17.3 Privacy

List view excludes:

- unit number;
- ownership-document data;
- seller contact details beyond authorised owner summary;
- private occupancy;
- raw verification metadata.

## 17.4 Row action

One row action:

> View listing

Do not put Pause, Approve and Retry directly in the list row.

---

# 18. Listing Detail

Route: `/[locale]/listings/[listingId]`

## 18.1 Header

Show:

- cover image;
- property headline;
- owner-safe summary;
- listing state;
- publication state;
- offer availability;
- transaction state;
- last updated;
- public page link where available.

## 18.2 Information zones

Use labelled sections:

### Public marketplace data

Information visible to public customers.

### Owner-only listing data

Private fields the seller can access.

### Admin-only operational data

Review state, failures and notes.

### Verification and document metadata

Simulation records and safe file metadata.

Do not render one undifferentiated data grid.

## 18.3 Required sections

1. Summary
2. Publication
3. Public preview
4. Private details
5. Verification
6. Documents
7. Photos
8. Investment Case visibility
9. Offers
10. Transaction
11. Activity
12. Admin notes
13. Operational actions

## 18.4 Public/private comparison

Use a two-column comparison on desktop:

- `Publicly visible`
- `Private / operational`

Examples:

| Field              | Public                 | Private / Admin            |
| ------------------ | ---------------------- | -------------------------- |
| Community          | Visible                | —                          |
| Building           | Visible if approved    | Source value               |
| Unit number        | Not visible            | Owner/Admin only           |
| Asking price       | Visible                | Change history             |
| Ownership document | Not visible            | Metadata only              |
| Permit result      | Public-safe demo label | Internal simulation record |

Mobile uses stacked field groups.

---

# 19. Publication Queue

Route: `/[locale]/publication`

## 19.1 Relationship to Week 3

Use the existing `listing_publication_requests` record and statuses. Do not create another review entity.

Final Week 6 behaviour:

- `PENDING` requests enter the Admin queue.
- Admin may approve, return for changes, or retry preparation where appropriate.
- The existing simulated automatic resolver remains available only as a non-production/test mechanism and must call the same canonical service.
- Manual and automatic resolution must never compete; row/version locking determines one winner.

## 19.2 Queue columns

- Listing
- Owner
- Submitted
- Checklist
- Verification
- Photos
- Prior attempts
- Failure category
- Queue age
- Action

## 19.3 Filters

- Pending
- Returned for changes
- Photo preparation failed
- Checklist incomplete
- Approved in demo
- Recently resolved

Default: Pending and failed attention states.

## 19.4 Queue age

Use calm labels:

- Submitted today
- 1 day in queue
- 3 days in queue

Do not use alarming SLA colours unless an SLA is formally defined.

---

# 20. Publication Review

Route: `/[locale]/publication/[publicationRequestId]`

## 20.1 Layout

Desktop max width: 1480 px.

- Main preview and checklist: 9 columns
- Sticky review action panel: 3 columns

Mobile:

- summary;
- preview;
- checklist;
- history;
- sticky action button opens review sheet.

## 20.2 Sections

1. Public listing preview
2. Publication checklist
3. Public/private field comparison
4. Verification summary
5. Photo readiness
6. Public-photo preparation status
7. Prior attempts
8. Failure category
9. Admin notes
10. Review actions

## 20.3 Simulation disclosure

> **Publication review simulated**  
> This prototype does not perform a real regulatory or legal publication review.

## 20.4 Approve

Available only when:

- request is current and pending;
- server checklist passes;
- verification and permit requirements pass;
- public projection is safe;
- required public photos are prepared or preparation can complete atomically.

Confirmation:

> **Approve this listing in demo?**  
> The property will become visible in the MARKAZ marketplace after public-photo preparation completes.

Primary:

> Approve in demo

Customer-visible result:

> Your listing is live.

## 20.5 Return for changes

Required reason categories:

- Property information incomplete
- Public photographs need changes
- Verification requires correction
- Asking price requires review
- Public/private field issue
- Other approved review reason

Customer-facing summary is selected from approved text. Optional Admin-only note is separate.

Confirmation:

> **Return this listing for changes?**  
> The owner will be asked to update the selected areas before submitting again.

Primary:

> Return for changes

## 20.6 Retry preparation

Available only for retryable photo or processing failure.

Copy:

> **Retry publication preparation?**  
> MARKAZ will retry creating the public photo set. The listing will remain unavailable until every required photograph is ready.

Primary:

> Retry preparation

## 20.7 Conflict

If already resolved:

> **Publication review already completed**  
> Another Admin or system process resolved this request. The latest result is shown below.

---

# 21. Listing Controls

## 21.1 Pause live listing

Precondition: `LIVE`.

Reason categories:

- Customer request recorded
- Listing information under review
- Verification issue
- Publication issue
- Offer or transaction issue
- Operational safety

Confirmation:

> **Pause this listing?**  
> The property will leave marketplace search and public property pages. Active offer negotiations will close according to the offer rules. Existing transaction records will remain available.

Customer-visible copy:

> This listing has been paused by MARKAZ Operations.

Reversible: yes, if eligibility passes.

## 21.2 Resume

Preconditions:

- listing is paused;
- publication eligibility passes;
- no unresolved block;
- customer account state permits it;
- material changes have completed required review.

Confirmation:

> **Resume this listing?**  
> The property will return to the marketplace. Closed offer negotiations will not reopen.

## 21.3 Block publication

Use an operational block flag, not a new arbitrary listing state.

Effects:

- blocks submit/resolution;
- listing remains in its current non-live state or is separately paused if live;
- requires reason;
- customer sees a safe correction/follow-up message;
- removal requires capability and reason.

## 21.4 Return ready listing for changes

Precondition: `READY_TO_PUBLISH` and no active resolved request.

Use the existing listing invalidation/rewind rules. Do not directly assign a draft step without canonical domain logic.

## 21.5 Action result banner

> **Listing paused**  
> The marketplace and offer availability have been updated. The action was recorded in the audit history.

---

# 22. Verification Oversight

Route: `/[locale]/verifications`

## 22.1 Included records

- Ownership verification simulation
- Form A simulation
- Permit simulation
- Publication review
- Transaction due-diligence simulation
- Transaction-document processing status

## 22.2 List fields

- Verification type
- Related entity
- Current outcome
- Started
- Completed
- Failure category
- Retry count
- Superseded
- Attention

## 22.3 User-facing outcomes

- Not started
- In progress
- Completed in demo
- Failed in demo
- Returned for correction
- Superseded
- Blocked

Never use `Officially verified`.

## 22.4 Detail

Show:

- type;
- related entity;
- simulation disclosure;
- current status;
- safe result category;
- timestamps;
- retry history;
- superseded link;
- permitted action;
- notes;
- audit timeline.

## 22.5 Retry

Only supported for simulation records with retryable failure.

Confirmation:

> **Retry this simulated check?**  
> The existing result will remain in history and a new attempt will be recorded.

Do not overwrite prior result.

---

# 23. Document Oversight

## 23.1 Default presentation

Metadata-only by default:

- document type;
- uploader role;
- related entity;
- original display filename, sanitised;
- file type;
- file size;
- uploaded time;
- processing status;
- visibility category;
- latest access time;
- access count where available.

Never show raw object path.

## 23.2 Visibility categories

- Private to uploader
- Shared with transaction participants
- Admin-only future record

Admin access does not change the underlying category.

## 23.3 View private document

Requires `ACCESS_PRIVATE_DOCUMENT`.

Dialog:

**Title:**

> View private document?

**Body:**

> Access is temporary and will be recorded. View this file only for the selected operational purpose.

Reason categories:

- Verification review
- Listing investigation
- Transaction issue
- Document-processing issue
- Customer support request

Required confirmation checkbox:

> I understand that this document may contain private information and that my access will be audited.

Primary:

> Open secure view

## 23.4 Secure viewing session

- Signed URL validity: five minutes.
- Open in an authenticated in-app viewer or new secure tab.
- Do not display or copy the signed URL.
- Download is disabled by default.
- If browser cannot preview, show metadata and `Request another secure view`; do not automatically download.
- Expired link cannot be refreshed without a new reason-confirmed access event.

## 23.5 Expired state

> **Secure document access has expired**  
> Request a new temporary view if you still need this document for an authorised operational purpose.

## 23.6 Failure

> We could not create a secure document view. No document content was exposed. Try again or return to the related record.

---

# 24. Offer Oversight

Route: `/[locale]/offers`

## 24.1 Read-only default

Admin may inspect but cannot:

- alter amount;
- submit counter;
- accept;
- reject for a participant;
- rewrite proposal history;
- reopen terminal threads casually.

## 24.2 List fields

- Offer reference
- Property
- Buyer-safe reference
- Seller-safe reference
- Current proposal
- Asking price
- Thread status
- Next actor
- Last activity
- Accepted
- Listing availability
- Transaction

## 24.3 Filters

- Active
- Waiting for buyer
- Waiting for seller
- Accepted
- Rejected
- Withdrawn
- Expired
- Other offer selected
- Listing unavailable
- Has transaction
- Updated date

Default sort: Latest activity.

## 24.4 Sensitive information

List view does not show full participant contact details. Admin may navigate to customer profiles when capability permits.

Threshold classification may be visible on detail, not required in every list row.

---

# 25. Offer Detail

Route: `/[locale]/offers/[offerThreadId]`

## 25.1 Sections

1. Property
2. Buyer summary
3. Seller summary
4. Current proposal
5. Asking-price comparison
6. Proposal history
7. Thread state
8. Next actor
9. Threshold classification
10. Listing availability
11. Accepted proposal
12. Related transaction
13. Product timeline
14. Audit history
15. Admin notes
16. Operational controls

## 25.2 Proposal history

Use the same immutable structured timeline as customer offers, with additional safe operational fields. Do not expose database enum names as primary copy.

## 25.3 Invalid-thread operational close

Available only with `CLOSE_INVALID_OFFER` when a thread is active but cannot legally or operationally continue due to a proven system inconsistency.

Reason categories:

- Listing no longer available
- Participant mismatch
- Duplicate active thread
- Invalid proposal state
- Operational data repair

Confirmation:

> **Close this offer thread?**  
> The negotiation will become non-actionable. Proposal history and audit records will remain unchanged.

Customer-visible copy:

> This offer is no longer available.

No reopen control in Week 6.

## 25.4 Conflict

> **Offer state has changed**  
> A participant or another Admin completed an action before this review. The latest thread state has been loaded.

---

# 26. Transaction Oversight

Route: `/[locale]/transactions`

## 26.1 Columns

- Transaction reference
- Property
- Buyer-safe reference
- Seller-safe reference
- Accepted amount
- Stage
- Next actor
- Progress
- Status
- Last activity
- Attention
- Created

## 26.2 Filters

- Active
- Buyer action required
- Seller action required
- Both action required
- Waiting for system
- Confirm
- Deposit
- Documents
- Demo checks
- Transfer
- Cancellation pending
- Cancelled
- Failed
- Completed in demo
- Last activity
- Transaction age

Default sort: Attention first, then oldest unresolved action.

## 26.3 Attention reasons

- Recoverable system failure
- Failed document processing
- Cancellation conflict
- Completion conflict
- Stale system task
- Notification failure requiring follow-up

Do not assign risk scores.

---

# 27. Transaction Detail

Route: `/[locale]/transactions/[transactionId]`

## 27.1 Header

Show:

- transaction reference;
- property;
- buyer and seller safe summaries;
- accepted amount;
- current stage;
- status;
- next actor;
- progress;
- last updated.

Buyer, seller, property and accepted amount are immutable.

## 27.2 Layout

Desktop max width: 1560 px.

- Main transaction workspace: 9 columns
- Sticky operational panel: 3 columns

Mobile:

- summary;
- stage tracker;
- current issue;
- task sections;
- operational action sheet.

## 27.3 Sections

1. Summary
2. Progress
3. Current milestone
4. Buyer tasks
5. Seller tasks
6. Documents
7. Deposit simulation
8. Due diligence
9. Transfer readiness
10. Completion or cancellation
11. Product timeline
12. Notifications
13. Audit
14. Admin notes
15. Operational controls

## 27.4 Action distinctions

Use labels:

- Customer action
- System action
- Admin action
- Simulation result

Never present an Admin recovery action as if the customer completed a task.

## 27.5 Simulation disclosure

> **Transaction process simulated**  
> This prototype does not process real payments, create legally binding documents, or perform an official property transfer.

---

# 28. Transaction Recovery Controls

## 28.1 Retry failed system task

Allowed only when:

- task is system-owned;
- failure is categorised as retryable;
- prerequisite customer tasks remain valid;
- no later milestone completed;
- transaction is not cancelled or completed.

Confirmation:

> **Retry this system step?**  
> MARKAZ will retry the failed prototype process. Customer confirmations will not be changed.

Primary:

> Retry step

## 28.2 Pause progression

Use a separate operational progression flag, not arbitrary transaction state reassignment.

Effects:

- blocks new milestone transitions;
- preserves participant access and history;
- customer sees a safe notice;
- existing uploads remain accessible by policy;
- reason required.

Customer copy:

> **Transaction progress is temporarily paused**  
> Existing information remains available. MARKAZ Operations is reviewing the next step.

## 28.3 Resume progression

Preconditions:

- operational pause exists;
- underlying issue resolved;
- current state still valid;
- no cancellation/completion conflict.

Confirmation:

> **Resume transaction progress?**  
> Participants will be able to continue from the current milestone.

## 28.4 Mark failed

Use only for unrecoverable workflow/system failure, not ordinary participant cancellation.

Reason categories:

- Unrecoverable data inconsistency
- Repeated system processing failure
- Invalid transaction relationship
- Completion conflict
- Other approved technical failure

Confirmation:

> **Mark this transaction as failed?**  
> The transaction will stop progressing. Participant records and history will remain available.

Customer copy:

> **Transaction could not continue in this demo**  
> MARKAZ Operations has recorded an issue. No real payment or property transfer occurred.

## 28.5 Cancellation conflict

Admin may resolve only a system conflict where participant cancellation decisions already exist. Admin cannot invent customer consent.

Allowed outcomes:

- Apply already-confirmed mutual cancellation
- Return to pending participant confirmation
- Mark system failure

Each requires evidence from persisted participant actions.

---

# 29. Failed and Blocked States

## 29.1 Failure detail panel

Show:

- safe failure category;
- affected task;
- last successful milestone;
- retry count;
- last attempt;
- participant impact;
- recommended available action;
- related audit events.

## 29.2 Do not show

- stack trace;
- SQL error;
- storage object path;
- service key;
- raw provider payload.

## 29.3 Diagnostic panel

An optional collapsed `Technical reference` may show:

- safe error code;
- correlation reference;
- service category;
- timestamp.

It must not contain secrets or raw exception text.

## 29.4 Partial recovery

If state transition succeeds but notification creation fails:

> **Action completed with a notification issue**  
> The entity state was updated. The customer notification could not be created and has been recorded for follow-up.

Do not roll back a valid domain transition solely because a non-critical notification failed unless architecture explicitly requires atomic delivery.

---

# 30. Audit Log

Route: `/[locale]/audit`

## 30.1 Purpose

Provide immutable operational investigation across system, customer and Admin events.

## 30.2 Filters

- Entity type
- Entity reference
- Customer
- Admin actor
- Event category
- Date range
- Result
- Listing
- Offer
- Transaction
- Verification
- Document access

Default date range: latest 30 days. Admin can expand within retention policy.

## 30.3 Event row

Show:

- time;
- actor type;
- safe actor reference;
- event label;
- entity;
- safe summary;
- result.

## 30.4 Event detail

Show approved metadata as a definition list:

- event reference;
- occurred at;
- actor;
- entity;
- previous state;
- resulting state;
- reason category;
- action result;
- linked notification status;
- correlation reference.

No editable controls.

## 30.5 Export

Not required for Week 6. Do not include an inactive Export button.

---

# 31. Entity Activity Timelines

## 31.1 Purpose

Entity detail pages show a filtered operational timeline for context. The global Audit area remains the deep investigation tool.

## 31.2 Event categories

- Customer action
- Admin action
- System event
- Simulation result
- Notification event

## 31.3 Timeline rules

- Chronological, newest first in Admin detail pages for quick investigation.
- Full timestamps available.
- Event labels are human-readable.
- Links open related records where authorised.
- Timeline does not combine Admin notes.
- Pagination or `Load earlier activity` after 25 events.

---

# 32. Notifications

## 32.1 Architecture

Reuse the canonical notification infrastructure when it can safely target Admin recipients. Do not create a second notification platform.

## 32.2 Admin notification kinds

- Publication review required
- Publication failed
- Verification failed
- Transaction failed
- Cancellation conflict
- Document review required
- Operational follow-up due

## 32.3 Header menu

Each notification shows:

- kind icon;
- short copy;
- entity reference;
- relative time;
- unread state;
- destination.

No private document content or full customer details.

## 32.4 Action counts

Sidebar and queue counts derive from current entity state. Marking a notification read does not clear unresolved queue count.

## 32.5 Failure

If an Admin action succeeds but Admin notification creation fails, show the partial-success pattern and record audit follow-up.

---

# 33. Realtime

## 33.1 Supported queue updates

- New publication request
- Publication resolved
- Accepted offer
- Transaction stage changed
- Transaction failed or blocked
- Listing paused
- Verification failed
- Admin note added

## 33.2 Correctness pattern

1. Receive minimal authorised event.
2. De-duplicate.
3. Refetch affected entity or queue count.
4. Replace state from server.
5. Announce meaningful change.

Never apply sensitive event payload directly.

## 33.3 Connection states

Healthy: no persistent indicator.

Reconnecting:

> Reconnecting to operational updates…

Stale:

> Live updates are delayed. Refresh to confirm the latest operational state.

Recovered:

> Operational data is up to date.

## 33.4 Out-of-order events

Version and updated timestamps determine latest state. An older event never reverses UI state.

---

# 34. Data Tables and List Patterns

## 34.1 Desktop pattern

- Sticky table header
- Page-based pagination
- Row hover and keyboard focus
- One primary row action
- Secondary actions in an overflow menu only when safe
- Column priority and controlled wrapping
- No required horizontal scrolling at 1280 px

## 34.2 Pagination

- Default 25 rows
- Options 25, 50, 100 where query performance permits
- Previous / Next and page numbers
- Results summary
- Filters reset page to 1
- URL stores search, filter, sort and page state

## 34.3 Sorting

- Sortable headers are buttons
- Current direction announced
- Use stable tie-breaker
- Do not expose unsupported ranking

## 34.4 Tablet

- Hide low-priority columns
- Keep key state, entity, attention and action
- Details available through row expansion or entity page

## 34.5 Mobile

Transform into record cards. Do not force desktop table scrolling for required workflows.

Each card:

- entity heading;
- two to four critical facts;
- attention/status;
- primary action;
- optional detail disclosure.

## 34.6 Row selection

Not required unless a safe bulk action exists. Default tables have no checkboxes.

---

# 35. Bulk-Action Policy

Week 6 does not include bulk consequential actions.

Allowed only if already supported:

- Mark Admin notifications read

Potential future actions, not shown now:

- Audit export
- Shared follow-up categorisation

Never include bulk:

- restrict;
- publish;
- pause;
- resume;
- accept/reject;
- transaction completion;
- delete.

---

# 36. Loading, Empty, Error and Conflict States

| Context                   | State and copy                                                                        |
| ------------------------- | ------------------------------------------------------------------------------------- |
| Dashboard loading         | Metric and queue skeletons; announce `Loading operational overview.`                  |
| Partial dashboard failure | `Some operational information could not be loaded.`                                   |
| Search loading            | Inline results skeleton; preserve query                                               |
| No search results         | `No matching records.`                                                                |
| Customer unavailable      | `This customer record is not available.`                                              |
| Listing unavailable       | `This listing is not available or you do not have permission to view it.`             |
| Publication loading       | Preview/checklist skeleton                                                            |
| Publication conflict      | `Publication review already completed.`                                               |
| Offer unavailable         | `This offer is not available.`                                                        |
| Transaction unavailable   | `This transaction is not available.`                                                  |
| Document access loading   | `Preparing secure document view…`                                                     |
| Signed link failure       | `We could not create a secure document view.`                                         |
| Retry failure             | `The system step could not be retried. Review the latest status before trying again.` |
| Action pending            | Progressive button label and disabled repeat                                          |
| Action completed          | Result banner with audit note                                                         |
| Action conflict           | `This record changed before your action completed.`                                   |
| Realtime disconnected     | Non-blocking stale banner + Refresh                                                   |
| Session expired           | Existing Admin sign-in with safe return                                               |
| Permission denied         | Capability-specific safe state                                                        |
| Generic failure           | `We could not complete this operational action.`                                      |

Never render blank screens or raw technical error bodies.

---

# 37. Component Library

Every component uses shared MARKAZ tokens and logical CSS properties.

| Component                      | Purpose / anatomy                                   | Variants and states                    | Behaviour, permission, accessibility, responsive and RTL                  |
| ------------------------------ | --------------------------------------------------- | -------------------------------------- | ------------------------------------------------------------------------- |
| Admin Application Shell        | Sidebar, header, main, utility region               | Expanded, collapsed, mobile            | Landmarks; skip link; mirrored RTL; capability-filtered nav               |
| Admin Sidebar                  | Primary operations navigation                       | Expanded/collapsed, badges             | `aria-current`; tooltip labels; mobile sheet reuse                        |
| Admin Header                   | Page context, global search, notifications, account | Desktop/mobile                         | Search shortcut; logical placement; sticky only if content remains usable |
| Global Search                  | Query field and grouped results                     | Loading, results, empty, error         | Combobox semantics; keyboard navigation; LTR references                   |
| Action-Needed Badge            | Authoritative unresolved count                      | Zero/number/99+                        | Accessible count label; not tied to unread state                          |
| Operational Metric Card        | Count, context, destination                         | Standard/attention/partial             | No vanity charts; link has descriptive label                              |
| Queue Card                     | Queue name, count, preview rows                     | Empty/loading/error                    | Refetch on Realtime; mobile full-width                                    |
| Filter Bar                     | Search, filters, clear                              | Desktop toolbar/mobile sheet           | Labels persistent; URL state; RTL ordering                                |
| Filter Chip                    | Active filter summary and remove                    | Default/focus                          | Remove button labelled; logical close icon                                |
| Admin Data Table               | Structured operational records                      | Loading/empty/partial                  | Semantic table; sortable headers; mobile card transform                   |
| Responsive Record Card         | Mobile equivalent of table row                      | Default/attention/closed               | Clear heading and one primary action                                      |
| Status Badge                   | Short state label                                   | Info/attention/failed/complete/neutral | Text + icon; no colour-only meaning                                       |
| Attention Indicator            | Explains why action is needed                       | Warning/failure/follow-up              | Tooltip not sole explanation                                              |
| Entity Summary Header          | Identity, state, facts, primary action              | Customer/listing/offer/transaction     | One `h1`; compact mobile arrangement                                      |
| Customer Summary               | Name, safe email, status, counts                    | Active/restricted                      | No personal identity overreach                                            |
| Listing Summary                | Cover, location, state, owner                       | Draft/live/paused/sold-demo            | Image alt; public link where safe                                         |
| Offer Summary                  | Property, current amount, state, next actor         | Active/accepted/closed                 | Amount LTR in RTL; read-only Admin default                                |
| Transaction Summary            | Reference, property, participants, stage            | Active/failed/completed                | Immutable facts visually separated                                        |
| Verification Summary           | Type, outcome, attempts, entity                     | Pending/failed/completed/superseded    | Simulation badge required                                                 |
| Public/Private Data Section    | Separates field visibility                          | Public/owner/Admin                     | Clear headings; stacked mobile                                            |
| Admin Note Panel               | Note list and add form                              | Empty/follow-up/correction             | Separate from audit; privacy warning                                      |
| Add-Note Form                  | Category, content, follow-up                        | Valid/error/submitting                 | 1,000-char count; reason association                                      |
| Entity Activity Timeline       | Filtered immutable events                           | Loading/earlier events                 | List semantics; newest first in Admin                                     |
| Audit Event Row                | Time, actor, event, entity, result                  | Success/failure/partial                | Read-only; safe metadata                                                  |
| Publication Checklist          | Eligibility rows                                    | Pass/fail/warning                      | Text and icon; links to evidence                                          |
| Review Action Panel            | Review state, consequences, actions                 | Approve/return/retry/resolved          | Sticky desktop; sheet mobile; capability gating                           |
| Return-for-Changes Dialog      | Reason, customer summary, Admin note                | Validation/loading/conflict            | Focus trap; preview customer copy                                         |
| Pause Confirmation Dialog      | Consequences, reason, notification                  | Listing/transaction                    | Explicit impact; no generic state dropdown                                |
| Resume Confirmation Dialog     | Eligibility and result                              | Listing/transaction                    | Disabled if server eligibility fails                                      |
| Document Metadata Row          | Safe file metadata and access                       | Available/processing/removed           | No path; access capability check                                          |
| Private-Document Access Dialog | Purpose, warning, checkbox                          | Ready/loading/error                    | Reason required; focus trap; access audited                               |
| Retry System-Step Dialog       | Failure context and retry action                    | Publication/verification/transaction   | Retry-safe only; no customer task completion                              |
| Mark-Failed Dialog             | Reason and customer effect                          | Transaction only                       | Consequential red restrained; explicit irreversibility                    |
| Admin Reason Selector          | Approved categories                                 | Required/invalid                       | Radio/select with helper; no hidden default                               |
| Admin Action Result Banner     | Result and secondary issue                          | Success/partial/failure                | Focus after navigation; linked audit event optional                       |
| Realtime Queue Indicator       | Connection state                                    | Reconnecting/stale/recovered           | Hidden healthy; polite announcements                                      |
| Access-Denied State            | Blocks customer or missing capability               | Account/capability                     | No protected content rendered first                                       |
| Mobile Admin Navigation        | Full-height navigation sheet                        | Open/closed                            | Focus trap; safe-area; mirrors RTL                                        |

---

# 38. Validation Matrix

| Screen       | Field/action           | Rule                              | Trigger              | English message                                                           | Placement          | Clear condition    | Blocking? | Capability                  | Arabic review         |
| ------------ | ---------------------- | --------------------------------- | -------------------- | ------------------------------------------------------------------------- | ------------------ | ------------------ | --------: | --------------------------- | --------------------- |
| Search       | Customer not found     | No accessible match               | Submit/results       | `No matching customer record was found.`                                  | Results state      | New query          |        No | Relevant view               | Language              |
| Customer     | Restrict active status | Only ACTIVE → RESTRICTED          | Confirm              | `Customer actions are already restricted.`                                | Dialog alert       | Refresh            |       Yes | MANAGE_CUSTOMER_STATUS      | Language              |
| Customer     | Restore not allowed    | Must be restricted                | Confirm              | `This customer does not currently have an action restriction.`            | Dialog             | Refresh            |       Yes | MANAGE_CUSTOMER_STATUS      | Language              |
| Listing      | State changed          | Expected version/state            | Action               | `The listing state changed before this action completed.`                 | Page alert         | Refresh            |       Yes | Action capability           | Language              |
| Publication  | Checklist incomplete   | Server checklist pass             | Approve              | `Complete or resolve the failed publication checks before approval.`      | Review panel       | Checks pass        |       Yes | REVIEW_PUBLICATION          | Language              |
| Publication  | Already resolved       | Pending only                      | Approve/return       | `This publication review has already been resolved.`                      | Page alert         | Refresh            |       Yes | REVIEW_PUBLICATION          | Language              |
| Publication  | Photo retry failed     | Retryable preparation             | Retry result         | `Public-photo preparation failed again. The listing remains unavailable.` | Result banner      | Later success      |       Yes | REVIEW_PUBLICATION          | Language              |
| Publication  | Reason missing         | Return requires category          | Submit               | `Select a reason for returning this listing.`                             | Under selector     | Reason selected    |       Yes | REVIEW_PUBLICATION          | Language + compliance |
| Listing      | Pause conflict         | Must be LIVE                      | Confirm              | `This listing can no longer be paused from its current state.`            | Dialog alert       | Refresh            |       Yes | MANAGE_LISTING_AVAILABILITY | Language              |
| Listing      | Resume invalid         | Eligibility required              | Confirm              | `Resolve the listing requirements before resuming it.`                    | Dialog + checklist | Eligible           |       Yes | MANAGE_LISTING_AVAILABILITY | Language              |
| Offer        | Terminal               | Operational close active-only     | Confirm              | `This offer thread is already closed.`                                    | Dialog             | Refresh            |       Yes | CLOSE_INVALID_OFFER         | Language              |
| Offer        | Owner mismatch         | Related listing ownership invalid | Load/action          | `The offer relationship could not be verified.`                           | Safe error panel   | Data corrected     |       Yes | VIEW_OFFERS                 | Security + language   |
| Transaction  | State changed          | Expected version                  | Action               | `The transaction progressed before this action completed.`                | Page alert         | Refresh            |       Yes | Recovery capability         | Language              |
| Transaction  | Retry not allowed      | System task retryable             | Open/confirm         | `This step cannot be retried from the current transaction state.`         | Dialog             | Valid state        |       Yes | MANAGE_TRANSACTION_RECOVERY | Language              |
| Transaction  | Completion missing     | Required tasks complete           | Resolve              | `Required participant and system tasks are still incomplete.`             | Milestone panel    | Complete           |       Yes | MANAGE_TRANSACTION_RECOVERY | Language              |
| Cancellation | Already resolved       | Pending only                      | Resolve              | `This cancellation has already been resolved.`                            | Dialog alert       | Refresh            |       Yes | MANAGE_TRANSACTION_RECOVERY | Language              |
| Document     | Unavailable            | File exists and permitted         | Open                 | `This document is no longer available.`                                   | Metadata row/panel | New document       |       Yes | ACCESS_PRIVATE_DOCUMENT     | Security + language   |
| Document     | Access reason missing  | Reason required                   | Submit               | `Select an operational reason for accessing this document.`               | Under selector     | Selected           |       Yes | ACCESS_PRIVATE_DOCUMENT     | Compliance + language |
| Note         | Empty                  | 3–1,000 chars                     | Submit               | `Enter an Admin note.`                                                    | Under field        | Valid note         |       Yes | ADD_ADMIN_NOTES             | Language              |
| Note         | Too long               | ≤1,000 chars                      | Input/submit         | `Admin note must be 1,000 characters or fewer.`                           | Under field        | Within max         |       Yes | ADD_ADMIN_NOTES             | Language              |
| Any action   | Capability missing     | Capability required               | Open/server response | `Your Admin account does not have permission to perform this action.`     | Permission panel   | Capability granted |       Yes | Varies                      | Security + language   |
| Any action   | Session expired        | Valid Admin session               | Request              | `Your Admin session has expired. Sign in again to continue.`              | Session notice     | Sign in            |       Yes | N/A                         | Security + language   |
| Realtime     | Disconnected           | Connection unavailable            | Connection event     | `Live updates are delayed. Refresh to confirm the latest state.`          | Page banner        | Reconnected        |        No | View capability             | Language              |
| Any action   | Stale two-tab action   | Version mismatch                  | Mutation             | `Another action was completed first. Review the latest state.`            | Result alert       | Refresh            |       Yes | Varies                      | Language              |

---

# 39. Responsive Behaviour

## 39.1 Desktop

- Persistent sidebar
- Content max width 1600 px
- 12-column grid
- Tables as primary list format
- Sticky action panel on detail pages
- Global search command surface
- Dialogs 520–640 px depending on content

## 39.2 Tablet

- Sidebar collapsed by default at narrower widths
- Expandable overlay or icon rail
- Hide low-priority table columns
- Detail pages stack action panel below summary when needed
- Filters open in side sheet

## 39.3 Mobile

- No persistent sidebar
- Top app bar and navigation sheet
- Tables become record cards
- Filter and sort use full-height sheet
- Detail sections use accordion only for secondary content; critical status remains open
- Consequential actions open a bottom sheet or full-screen dialog
- Sticky bottom action respects safe area
- Document viewer uses new secure tab where in-app preview is not practical

## 39.4 Maximum widths

| Screen                     | Max width |
| -------------------------- | --------: |
| Dashboard                  |   1600 px |
| List/table pages           |   1600 px |
| Customer detail            |   1440 px |
| Listing detail             |   1520 px |
| Publication review         |   1480 px |
| Offer detail               |   1440 px |
| Transaction detail         |   1560 px |
| Audit log                  |   1600 px |
| Focused error/access state |    560 px |

## 39.5 Touch and safe areas

- Minimum 44 × 44 px target
- Primary mobile actions at least 48 px high
- Bottom sheets include `env(safe-area-inset-bottom)` spacing
- Sticky bars do not cover final content

## 39.6 Keyboard

Every action available by pointer is available by keyboard. Tables do not implement custom spreadsheet arrow navigation; standard Tab navigation is preferred.

---

# 40. Arabic and RTL Behaviour

All Arabic copy is draft and requires professional review. Compliance, account restriction, publication, private-document access, transaction failure and audit terminology require business/legal review.

## 40.1 Mirrors

- Sidebar and collapse control
- Page grid and action-panel placement
- Filter and sort controls
- Table visual column order where semantically appropriate
- Breadcrumb arrows
- Navigation sheet direction
- Dialog button layout
- Timeline rail
- Pagination arrows

## 40.2 Remains LTR

- Email values
- AED amounts
- Percentages
- Numeric references
- Transaction and offer references
- Public IDs
- Dates when rendered in numeric ISO-like form
- File names where source is Latin
- Technical correlation references

Use bidi isolation.

## 40.3 Tables

- Text columns align logical start.
- Amount columns retain LTR numeric alignment.
- Status columns follow reading direction.
- Sort icons appear at logical end of header label.
- Mobile cards avoid awkward mirrored tables.

## 40.4 Search

- Query field follows entered script.
- Email/reference queries remain LTR.
- Mixed property names are isolated correctly.
- Results groups align RTL but references remain LTR.

## 40.5 Dialogs

- Reason selector and consequence copy RTL.
- Numeric values isolated.
- Button visual order mirrors while DOM order follows logical reading and priority.

## 40.6 File names

Display sanitised source filename using bidi isolation and allow wrapping. Do not reverse extensions.

---

# 41. Accessibility

Target WCAG 2.2 AA.

## 41.1 Landmarks and headings

- Sidebar navigation landmark
- Header/banner landmark
- One main landmark
- One `h1` per route
- Logical section headings
- Skip link

## 41.2 Search and filters

- Global search uses combobox/listbox semantics
- Entity search has visible label
- Filter controls have persistent labels
- Applied filter count announced
- Clearing filters announces new result count

## 41.3 Tables

- Proper table, header and row semantics
- Sort buttons announce current direction
- Pagination navigation labelled
- Row action label includes entity context
- Avoid clickable entire rows when nested actions exist

## 41.4 Status and queues

- Status never conveyed by colour alone
- Queue count changes announced politely
- Attention reason included in text
- Realtime healthy state remains silent

## 41.5 Dialogs

- Focus moves to dialog heading
- Focus trapped
- Escape closes unless request is processing
- Focus returns to trigger
- Error summary focused after invalid submission
- Consequence copy precedes action in DOM order

## 41.6 Document access

- Privacy warning announced
- Confirmation checkbox clearly associated
- Secure viewer has descriptive title
- Expiry announced as text, not timer-only

## 41.7 Timelines and audit

- Timelines use ordered or unordered lists as appropriate
- Event time uses semantic datetime
- Actor and event are read as one sentence
- Audit metadata uses definition lists

## 41.8 Loading and errors

- Loading announcements use polite live regions
- Do not repeatedly announce skeleton changes
- Error headings receive focus after route-level failures
- Partial failure does not remove accessible successful content

## 41.9 Motion and contrast

- Respect reduced motion
- No pulsing risk indicators
- Focus indicator minimum 2 px and 3:1 contrast
- Normal text meets 4.5:1
- UI boundaries meet 3:1

---

# 42. Security and Privacy Rules

## 42.1 Never expose

- Passwords or hashes
- Authentication tokens
- Secret or service keys
- Raw storage paths
- Full signed URLs
- Unnecessary identity-document content
- Unrelated customer data
- Raw SQL errors
- Service-role credentials
- Unapproved audit metadata
- Document contents in notifications
- Permanent private-document access

## 42.2 Purpose-driven access

Sensitive data requires:

- related entity context;
- required capability;
- explicit user action;
- approved reason;
- short-lived access;
- audit event.

## 42.3 Customer in Admin app

Render Access Denied before any portal data:

> **Access denied**  
> This account does not have permission to access MARKAZ Operations.

Actions:

- Sign out
- Return to MARKAZ Home

## 42.4 Missing capability

Do not reveal hidden data in the denial message. Route may remain visible with read-only data only when `VIEW_*` capability exists.

## 42.5 State conflicts

Mutations use expected state/version. UI never assumes success until authoritative response.

## 42.6 Signed URL expiry

Expired URL is not displayed. Requesting another view creates a new access event.

## 42.7 Notification payload

Admin notifications contain only kind, safe entity reference and route target. They do not contain private document metadata or raw failure details.

---

# 43. Admin Action Auditability

Every consequential action records:

- Admin actor ID
- Admin display reference
- Capability used
- Entity type and ID
- Human-safe entity reference
- Previous state
- Resulting state
- Reason category
- Optional note reference
- Timestamp
- Result
- Related notification result
- Customer-visible effect category
- Reversibility metadata

## 43.1 Required events

- `ADMIN_CUSTOMER_ACTIONS_RESTRICTED`
- `ADMIN_CUSTOMER_ACTIONS_RESTORED`
- `ADMIN_PUBLICATION_APPROVED_DEMO`
- `ADMIN_PUBLICATION_RETURNED_FOR_CHANGES`
- `ADMIN_PUBLICATION_RETRY_REQUESTED`
- `ADMIN_LISTING_PAUSED`
- `ADMIN_LISTING_RESUMED`
- `ADMIN_PUBLICATION_BLOCKED`
- `ADMIN_VERIFICATION_RETRY_REQUESTED`
- `ADMIN_PRIVATE_DOCUMENT_ACCESSED`
- `ADMIN_OFFER_THREAD_CLOSED`
- `ADMIN_TRANSACTION_STEP_RETRY_REQUESTED`
- `ADMIN_TRANSACTION_PAUSED`
- `ADMIN_TRANSACTION_RESUMED`
- `ADMIN_TRANSACTION_MARKED_FAILED`
- `ADMIN_CANCELLATION_CONFLICT_RESOLVED`
- `ADMIN_NOTE_ADDED`

## 43.2 Partial action result

Audit distinguishes:

- domain transition succeeded;
- notification failed;
- audit write failed.

A consequential operation must not be presented as fully successful if its required audit record failed. Architecture should prefer atomic domain + audit persistence where possible.

---

# 44. Exact English Copy

## 44.1 Foundation

| Key                          | English                                                                 |
| ---------------------------- | ----------------------------------------------------------------------- |
| `admin.brand`                | MARKAZ Operations                                                       |
| `admin.overview.title`       | Operations overview                                                     |
| `admin.overview.description` | Review operational activity and records that need attention.            |
| `admin.refresh`              | Refresh                                                                 |
| `admin.updated`              | Updated just now                                                        |
| `admin.search.placeholder`   | Search customers, listings, offers or transactions                      |
| `admin.accessDenied.title`   | Access denied                                                           |
| `admin.accessDenied.body`    | This account does not have permission to access MARKAZ Operations.      |
| `admin.permission.title`     | Permission required                                                     |
| `admin.permission.body`      | Your Admin account can view this record but cannot perform this action. |

## 44.2 Queues and empty states

| Key                       | English                                                            |
| ------------------------- | ------------------------------------------------------------------ |
| `queue.publication`       | Publication reviews pending                                        |
| `queue.publicationFailed` | Failed publication attempts                                        |
| `queue.transaction`       | Transactions blocked or failed                                     |
| `queue.verification`      | Verification failures                                              |
| `queue.pausedListings`    | Listings paused by Admin                                           |
| `queue.empty`             | No records currently need attention.                               |
| `search.emptyTitle`       | No matching records                                                |
| `search.emptyBody`        | Check the spelling, use a full reference, or try a broader search. |

## 44.3 Customers

| Key                                 | English                                                                                                                                                                                            |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `customers.title`                   | Customers                                                                                                                                                                                          |
| `customers.search`                  | Search customers                                                                                                                                                                                   |
| `customer.status.active`            | Active                                                                                                                                                                                             |
| `customer.status.restricted`        | Actions restricted                                                                                                                                                                                 |
| `customer.restrict.title`           | Restrict customer actions?                                                                                                                                                                         |
| `customer.restrict.body`            | The customer will still be able to sign in and view existing records, but they will not be able to create listings, publish listings, or take part in offer negotiations until access is restored. |
| `customer.restrict.action`          | Restrict actions                                                                                                                                                                                   |
| `customer.restore.title`            | Restore customer actions?                                                                                                                                                                          |
| `customer.restore.body`             | The customer will be able to create listings and participate in offers again. Existing listing and transaction states will not change automatically.                                               |
| `customer.restore.action`           | Restore actions                                                                                                                                                                                    |
| `customer.restricted.customerTitle` | Some account actions are temporarily unavailable                                                                                                                                                   |
| `customer.restricted.customerBody`  | You can still view your existing records and complete permitted transaction steps. Contact MARKAZ support for assistance.                                                                          |

## 44.4 Notes

| Key             | English                                                                                                   |
| --------------- | --------------------------------------------------------------------------------------------------------- |
| `note.title`    | Admin notes                                                                                               |
| `note.add`      | Add note                                                                                                  |
| `note.category` | Note category                                                                                             |
| `note.label`    | Operational note                                                                                          |
| `note.privacy`  | Do not include passwords, authentication tokens, payment details, identity numbers, or document contents. |
| `note.empty`    | No Admin notes have been added.                                                                           |

## 44.5 Listings and publication

| Key                           | English                                                                                                                        |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `listings.title`              | Listings                                                                                                                       |
| `listing.review`              | Review listing                                                                                                                 |
| `publication.title`           | Publication review                                                                                                             |
| `publication.queueTitle`      | Publication queue                                                                                                              |
| `publication.pending`         | Awaiting review                                                                                                                |
| `publication.disclosureTitle` | Publication review simulated                                                                                                   |
| `publication.disclosureBody`  | This prototype does not perform a real regulatory or legal publication review.                                                 |
| `publication.approve`         | Approve in demo                                                                                                                |
| `publication.approveTitle`    | Approve this listing in demo?                                                                                                  |
| `publication.approveBody`     | The property will become visible in the MARKAZ marketplace after public-photo preparation completes.                           |
| `publication.return`          | Return for changes                                                                                                             |
| `publication.returnTitle`     | Return this listing for changes?                                                                                               |
| `publication.returnBody`      | The owner will be asked to update the selected areas before submitting again.                                                  |
| `publication.retry`           | Retry preparation                                                                                                              |
| `publication.retryTitle`      | Retry publication preparation?                                                                                                 |
| `publication.retryBody`       | MARKAZ will retry creating the public photo set. The listing will remain unavailable until every required photograph is ready. |
| `listing.pause`               | Pause listing                                                                                                                  |
| `listing.pauseTitle`          | Pause this listing?                                                                                                            |
| `listing.resume`              | Resume listing                                                                                                                 |
| `listing.resumeTitle`         | Resume this listing?                                                                                                           |
| `listing.blocked`             | Publication blocked                                                                                                            |

## 44.6 Verification and documents

| Key                       | English                                                                                             |
| ------------------------- | --------------------------------------------------------------------------------------------------- |
| `verification.title`      | Verifications                                                                                       |
| `verification.failed`     | Failed in demo                                                                                      |
| `verification.retry`      | Retry simulated check                                                                               |
| `verification.disclosure` | This is a prototype simulation and not an official verification.                                    |
| `document.metadata`       | Document metadata                                                                                   |
| `document.view`           | View private document                                                                               |
| `document.accessTitle`    | View private document?                                                                              |
| `document.accessBody`     | Access is temporary and will be recorded. View this file only for the selected operational purpose. |
| `document.accessCheckbox` | I understand that this document may contain private information and that my access will be audited. |
| `document.open`           | Open secure view                                                                                    |
| `document.expiredTitle`   | Secure document access has expired                                                                  |
| `document.expiredBody`    | Request a new temporary view if you still need this document for an authorised operational purpose. |

## 44.7 Offers

| Key                       | English                                                                                               |
| ------------------------- | ----------------------------------------------------------------------------------------------------- |
| `adminOffers.title`       | Offer oversight                                                                                       |
| `adminOffers.description` | Review negotiation state and related operational records.                                             |
| `adminOffers.close`       | Close invalid thread                                                                                  |
| `adminOffers.closeTitle`  | Close this offer thread?                                                                              |
| `adminOffers.closeBody`   | The negotiation will become non-actionable. Proposal history and audit records will remain unchanged. |
| `adminOffers.readOnly`    | Offer negotiation is read-only in MARKAZ Operations.                                                  |

## 44.8 Transactions

| Key                               | English                                                                                       |
| --------------------------------- | --------------------------------------------------------------------------------------------- |
| `adminTransactions.title`         | Transactions                                                                                  |
| `transaction.blocked`             | Transaction blocked                                                                           |
| `transaction.retry`               | Retry system step                                                                             |
| `transaction.retryTitle`          | Retry this system step?                                                                       |
| `transaction.retryBody`           | MARKAZ will retry the failed prototype process. Customer confirmations will not be changed.   |
| `transaction.pause`               | Pause transaction progress                                                                    |
| `transaction.pauseTitle`          | Pause transaction progress?                                                                   |
| `transaction.resume`              | Resume transaction progress                                                                   |
| `transaction.resumeTitle`         | Resume transaction progress?                                                                  |
| `transaction.markFailed`          | Mark transaction failed                                                                       |
| `transaction.markFailedTitle`     | Mark this transaction as failed?                                                              |
| `transaction.markFailedBody`      | The transaction will stop progressing. Participant records and history will remain available. |
| `transaction.customerPausedTitle` | Transaction progress is temporarily paused                                                    |
| `transaction.customerPausedBody`  | Existing information remains available. MARKAZ Operations is reviewing the next step.         |
| `transaction.customerFailedTitle` | Transaction could not continue in this demo                                                   |
| `transaction.customerFailedBody`  | MARKAZ Operations has recorded an issue. No real payment or property transfer occurred.       |

## 44.9 Audit and system

| Key                     | English                                                                                                           |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `audit.title`           | Audit log                                                                                                         |
| `audit.description`     | Review immutable system, customer, and Admin activity.                                                            |
| `realtime.reconnecting` | Reconnecting to operational updates…                                                                              |
| `realtime.stale`        | Live updates are delayed. Refresh to confirm the latest operational state.                                        |
| `realtime.recovered`    | Operational data is up to date.                                                                                   |
| `error.staleTitle`      | This record has changed                                                                                           |
| `error.staleBody`       | Another action was completed first. Review the latest state before continuing.                                    |
| `error.genericTitle`    | Operational action could not be completed                                                                         |
| `error.genericBody`     | Review the latest entity state and try again.                                                                     |
| `error.partialTitle`    | Action completed with a notification issue                                                                        |
| `error.partialBody`     | The entity state was updated. The customer notification could not be created and has been recorded for follow-up. |

---

# 45. Arabic Copy and Review Flags

**Status:** Draft only. Professional Arabic review is required. Compliance, legal, privacy, account restriction, document access, publication and transaction-failure wording require specialist review.

| English                                            | Draft Arabic                                       | Review                |
| -------------------------------------------------- | -------------------------------------------------- | --------------------- |
| MARKAZ Operations                                  | عمليات MARKAZ                                      | Brand + language      |
| Operations overview                                | نظرة عامة على العمليات                             | Language              |
| Customers                                          | العملاء                                            | Language              |
| Listings                                           | العقارات المدرجة                                   | Property + language   |
| Publication                                        | النشر                                              | Property + compliance |
| Offers                                             | العروض                                             | Property + legal      |
| Transactions                                       | المعاملات                                          | Property + legal      |
| Verifications                                      | عمليات التحقق                                      | Compliance + language |
| Audit log                                          | سجل التدقيق                                        | Compliance + language |
| Search customers, listings, offers or transactions | ابحث عن العملاء أو العقارات أو العروض أو المعاملات | Language              |
| Access denied                                      | تم رفض الوصول                                      | Security + language   |
| Permission required                                | صلاحية إضافية مطلوبة                               | Security + language   |
| Actions restricted                                 | الإجراءات مقيّدة                                   | Compliance + language |
| Restrict customer actions?                         | هل تريد تقييد إجراءات العميل؟                      | Compliance + legal    |
| Restore customer actions?                          | هل تريد استعادة إجراءات العميل؟                    | Compliance + legal    |
| Admin notes                                        | ملاحظات الإدارة                                    | Language              |
| Add note                                           | إضافة ملاحظة                                       | Language              |
| Publication review                                 | مراجعة النشر                                       | Property + compliance |
| Publication review simulated                       | محاكاة مراجعة النشر                                | Compliance + legal    |
| Approve in demo                                    | اعتماد ضمن العرض التجريبي                          | Compliance + language |
| Return for changes                                 | إعادة لإجراء تعديلات                               | Language              |
| Retry preparation                                  | إعادة محاولة التجهيز                               | Language              |
| Pause listing                                      | إيقاف عرض العقار مؤقتًا                            | Property + language   |
| Resume listing                                     | استئناف عرض العقار                                 | Property + language   |
| Failed in demo                                     | فشل ضمن المحاكاة                                   | Language              |
| View private document                              | عرض مستند خاص                                      | Privacy + language    |
| Open secure view                                   | فتح عرض آمن                                        | Security + language   |
| Offer oversight                                    | الإشراف على العروض                                 | Legal + language      |
| Close invalid thread                               | إغلاق مسار عرض غير صالح                            | Product + legal       |
| Transaction blocked                                | المعاملة متوقفة                                    | Legal + language      |
| Retry system step                                  | إعادة محاولة خطوة النظام                           | Language              |
| Pause transaction progress                         | إيقاف تقدم المعاملة مؤقتًا                         | Legal + language      |
| Mark transaction failed                            | تسجيل تعذر استمرار المعاملة                        | Legal + language      |
| Reconnecting to operational updates…               | جارٍ إعادة الاتصال بالتحديثات التشغيلية…           | Language              |
| Operational action could not be completed          | تعذر إكمال الإجراء التشغيلي                        | Language              |

Do not represent these translations as approved until reviewed.

---

# 46. Design-to-Engineering Handoff

## 46.1 Screen handoff table

| Route                 | Screen                        | Capability                     | Entity/state        | Sensitive data                | Primary action              | Loading / empty / errors | Transition / event                 | Key implementation notes         |
| --------------------- | ----------------------------- | ------------------------------ | ------------------- | ----------------------------- | --------------------------- | ------------------------ | ---------------------------------- | -------------------------------- |
| `/login`              | Admin sign-in                 | None                           | No session          | Credentials                   | Sign in                     | Generic auth states      | Admin session                      | Reuse final auth spec; no signup |
| `/access-denied`      | Access denied                 | None                           | Non-Admin           | None                          | Sign out                    | Static                   | None                               | Render before portal data        |
| `/overview`           | Dashboard                     | VIEW_OVERVIEW                  | Mixed               | Safe aggregates               | Open queue                  | Partial failures         | Realtime refetch                   | Counts authoritative             |
| `/search`             | Global search                 | Relevant view                  | Mixed               | Safe previews                 | Open result                 | Loading/empty/error      | None                               | Permission-filtered grouping     |
| Global mobile         | Mobile nav                    | Varies                         | N/A                 | None                          | Navigate                    | Open/closed              | None                               | Full-height sheet                |
| `/customers`          | Customer list                 | VIEW_CUSTOMERS                 | Mixed               | Safe email                    | View customer               | Loading/empty/error      | None                               | Page pagination                  |
| Customer filters      | Filter sheet                  | VIEW_CUSTOMERS                 | Mixed               | None                          | Apply filters               | Validation               | URL state                          | Mobile full sheet                |
| `/customers/[id]`     | Customer profile              | VIEW_CUSTOMERS                 | Active/restricted   | Profile + related summaries   | Contextual                  | Missing/forbidden        | None                               | Sections/tabs                    |
| Dialog                | Restrict customer             | MANAGE_CUSTOMER_STATUS         | ACTIVE              | Operational reason            | Restrict actions            | Validation/conflict      | Restriction + notification + audit | Expected version                 |
| Dialog                | Restore customer              | MANAGE_CUSTOMER_STATUS         | RESTRICTED          | Operational reason            | Restore actions             | Validation/conflict      | Restore + notification + audit     | No automatic listing transition  |
| Customer section      | Admin notes                   | ADD_ADMIN_NOTES                | Any                 | Admin-only note               | Add note                    | Empty/validation         | Note + audit                       | Append-only                      |
| Customer section      | Activity timeline             | VIEW_AUDIT_LOGS or scoped view | Any                 | Safe events                   | Load earlier                | Loading                  | None                               | Notes excluded                   |
| `/listings`           | Listing list                  | VIEW_LISTINGS                  | Mixed               | Safe list fields              | View listing                | Loading/empty/error      | None                               | No row mutation                  |
| Listing filters       | Filter sheet                  | VIEW_LISTINGS                  | Mixed               | None                          | Apply                       | Validation               | URL                                | Mobile cards                     |
| `/listings/[id]`      | Listing detail                | VIEW_LISTINGS                  | Any                 | Public/owner/Admin zones      | Contextual                  | Missing/error            | None                               | Label visibility zones           |
| Listing section       | Public/private comparison     | VIEW_LISTINGS                  | Any                 | Private fields                | None                        | Loading                  | None                               | Never in public route            |
| `/publication`        | Publication queue             | REVIEW_PUBLICATION             | Pending/failed      | Review summaries              | Open review                 | Loading/empty            | Realtime queue                     | Same request model               |
| `/publication/[id]`   | Publication review            | REVIEW_PUBLICATION             | PENDING/failed      | Private review data           | Approve/return/retry        | Conflict                 | Publication transition             | Sticky action panel              |
| Dialog                | Approve publication           | REVIEW_PUBLICATION             | Eligible PENDING    | None extra                    | Approve in demo             | Eligibility/conflict     | LIVE + audit/notification          | Canonical service                |
| Dialog                | Return for changes            | REVIEW_PUBLICATION             | PENDING             | Reason + note                 | Return                      | Validation/conflict      | REJECTED_DEMO request outcome      | Customer summary separate        |
| Review state          | Photo-processing failure      | REVIEW_PUBLICATION             | Retryable failure   | Safe category                 | Retry                       | Retry failure            | New attempt/audit                  | No raw storage error             |
| Dialog                | Retry publication             | REVIEW_PUBLICATION             | Retryable           | None                          | Retry preparation           | Loading/conflict         | Pipeline retry                     | Idempotent                       |
| Dialog                | Pause listing                 | MANAGE_LISTING_AVAILABILITY    | LIVE                | Reason                        | Pause                       | Conflict                 | PAUSED + offers close              | Explain effects                  |
| Dialog                | Resume listing                | MANAGE_LISTING_AVAILABILITY    | PAUSED eligible     | Reason                        | Resume                      | Eligibility error        | LIVE                               | Closed offers stay closed        |
| Listing state         | Blocked                       | MANAGE_LISTING_AVAILABILITY    | Non-live/review     | Reason                        | Review block                | Conflict                 | Block flag                         | Not arbitrary enum               |
| `/verifications`      | Verification queue            | VIEW_VERIFICATIONS             | Mixed               | Safe status                   | Open                        | Loading/empty            | Realtime                           | Simulation labels                |
| `/verifications/[id]` | Verification detail           | VIEW_VERIFICATIONS             | Any                 | Safe metadata                 | Retry if allowed            | Error/conflict           | New attempt                        | Prior immutable                  |
| Entity section        | Ownership metadata            | VIEW_PRIVATE_DOCUMENT_METADATA | Any                 | Metadata                      | Request view                | Removed/unavailable      | Access audit if opened             | No path                          |
| Entity section        | Transaction-document metadata | VIEW_PRIVATE_DOCUMENT_METADATA | Any                 | Metadata                      | Request view                | Processing/error         | Access audit                       | Visibility category              |
| Dialog                | Private document access       | ACCESS_PRIVATE_DOCUMENT        | Available           | Document content after action | Open secure view            | Reason/error             | Access event                       | Five-minute URL                  |
| State                 | Signed-link expired           | ACCESS_PRIVATE_DOCUMENT        | Expired             | None                          | Request new view            | Static                   | New access event                   | Never expose URL                 |
| `/offers`             | Offer list                    | VIEW_OFFERS                    | Mixed               | Negotiation summaries         | View offer                  | Loading/empty            | Realtime                           | Read-only                        |
| Offer filters         | Filters                       | VIEW_OFFERS                    | Mixed               | None                          | Apply                       | N/A                      | URL                                | No action ranking                |
| `/offers/[id]`        | Offer detail                  | VIEW_OFFERS                    | Any                 | Participants/proposals        | Related record              | Missing/conflict         | None                               | Allow-list projection            |
| Offer section         | Proposal timeline             | VIEW_OFFERS                    | Any                 | Amount/history                | None                        | Loading                  | None                               | Immutable                        |
| Offer detail          | Accepted view                 | VIEW_OFFERS                    | ACCEPTED            | Accepted amount               | View transaction            | Missing tx               | None                               | No mutation                      |
| Offer detail          | Closed thread                 | VIEW_OFFERS                    | Terminal            | Safe reason                   | Return                      | N/A                      | None                               | Read-only                        |
| Dialog                | Invalid close                 | CLOSE_INVALID_OFFER            | Active inconsistent | Reason                        | Close thread                | Conflict                 | CLOSED + audit/notification        | Strict categories                |
| `/transactions`       | Transaction list              | VIEW_TRANSACTIONS              | Mixed               | Safe summaries                | View transaction            | Loading/empty            | Realtime                           | Attention-first sort             |
| Transaction filters   | Filters                       | VIEW_TRANSACTIONS              | Mixed               | None                          | Apply                       | N/A                      | URL                                | Mobile sheet                     |
| `/transactions/[id]`  | Transaction detail            | VIEW_TRANSACTIONS              | Any                 | Participant and workflow data | Contextual recovery         | Missing/conflict         | None                               | Immutable facts                  |
| Transaction section   | Current milestone             | VIEW_TRANSACTIONS              | Active              | Tasks                         | None                        | Loading                  | None                               | Actor labels                     |
| Transaction section   | Buyer/seller tasks            | VIEW_TRANSACTIONS              | Active              | Completion status             | None                        | Partial                  | None                               | Admin cannot complete            |
| Transaction section   | Documents                     | VIEW_PRIVATE_DOCUMENT_METADATA | Active              | Metadata                      | Request view                | Unavailable              | Access                             | Privacy categories               |
| Transaction section   | Deposit state                 | VIEW_TRANSACTIONS              | Deposit             | Demo amount/status            | None                        | Failure                  | None                               | No real payment claims           |
| Transaction section   | Cancellation pending          | VIEW_TRANSACTIONS              | Pending             | Reason/status                 | Resolve conflict if allowed | Conflict                 | Canonical cancellation             | No invented consent              |
| Transaction state     | Failed                        | VIEW_TRANSACTIONS              | FAILED              | Safe failure                  | Review recovery             | N/A                      | None                               | Customer-safe copy               |
| Dialog                | Retry step                    | MANAGE_TRANSACTION_RECOVERY    | Retryable           | Failure category              | Retry                       | Conflict/retry failure   | Task attempt + audit               | System tasks only                |
| Dialog                | Pause transaction             | MANAGE_TRANSACTION_RECOVERY    | Active              | Reason                        | Pause                       | Conflict                 | Operational pause                  | Participant access remains       |
| Dialog                | Resume transaction            | MANAGE_TRANSACTION_RECOVERY    | Paused eligible     | Reason                        | Resume                      | Eligibility              | Progress resumes                   | No task completion               |
| Dialog                | Mark failed                   | MANAGE_TRANSACTION_RECOVERY    | Unrecoverable       | Reason                        | Mark failed                 | Conflict                 | FAILED + notification/audit        | Consequential                    |
| Transaction state     | Completed demo                | VIEW_TRANSACTIONS              | COMPLETED_DEMO      | History                       | None                        | N/A                      | None                               | Read-only                        |
| `/audit`              | Global audit                  | VIEW_AUDIT_LOGS                | Mixed               | Approved metadata             | Filter/open                 | Loading/empty            | None                               | Read-only                        |
| Audit filters         | Filters                       | VIEW_AUDIT_LOGS                | Mixed               | None                          | Apply                       | Validation               | URL                                | 30-day default                   |
| `/audit/[id]`         | Audit detail                  | VIEW_AUDIT_LOGS                | Event               | Safe metadata                 | Related entity              | Missing                  | None                               | No raw payload                   |
| Banner                | Realtime disconnected         | Any view                       | Stale               | None                          | Refresh                     | Connection               | Refetch                            | Non-blocking                     |
| Alert                 | Stale Admin action            | Action capability              | Version conflict    | None                          | Review latest               | Conflict                 | None                               | Never replay automatically       |
| State                 | Permission denied             | Missing capability             | Any                 | None                          | Return                      | Static                   | None                               | No sensitive disclosure          |
| Boundary              | Generic operational failure   | Any                            | Any                 | Safe reference                | Retry                       | Error                    | None                               | No stack trace                   |
| RTL                   | Arabic dashboard              | VIEW_OVERVIEW                  | Mixed               | Safe                          | Queue navigation            | Same states              | None                               | Mirrored layout                  |
| RTL                   | Arabic publication review     | REVIEW_PUBLICATION             | PENDING             | Review data                   | Approve/return              | Same                     | Same                               | Bidi-safe refs                   |
| RTL                   | Arabic transaction detail     | VIEW_TRANSACTIONS              | Active              | Workflow data                 | Recovery where allowed      | Same                     | Same                               | Amounts and refs LTR             |

## 46.2 Requirement labels

Use these labels in engineering tickets:

- `[VISUAL]`
- `[INTERACTION]`
- `[PRODUCT]`
- `[SECURITY]`
- `[PRIVACY]`
- `[PERMISSION]`
- `[STATE]`
- `[AUDIT]`
- `[SIMULATION]`
- `[ACCESSIBILITY]`
- `[I18N]`
- `[OPTIONAL]`

---

# 47. Required High-Fidelity Mockups

## Priority P0 — approve before engineering begins

| Mockup                          | View          | Capability                  | Entity state      | Key interaction          | Sensitive-data considerations     | Why approval is required               | Engineering must not invent                     |
| ------------------------------- | ------------- | --------------------------- | ----------------- | ------------------------ | --------------------------------- | -------------------------------------- | ----------------------------------------------- |
| 1. Admin dashboard              | Desktop       | VIEW_OVERVIEW               | Mixed             | Queue navigation         | Safe aggregates only              | Establishes entire Admin visual system | Metric hierarchy, queue layout, density         |
| 2. Customer list                | Desktop       | VIEW_CUSTOMERS              | Mixed             | Search/filter/open       | Safe email and counts             | Defines table pattern                  | Columns, attention treatment, filter density    |
| 3. Customer profile             | Desktop       | VIEW_CUSTOMERS              | Active/restricted | Investigate/restrict     | Profile boundaries                | Establishes entity-detail pattern      | Section order, summary density, notes placement |
| 4. Listing list                 | Desktop       | VIEW_LISTINGS               | Mixed             | Filter/open              | No private unit data              | Core operational table                 | Columns, status balance, attention priority     |
| 5. Listing detail               | Desktop       | VIEW_LISTINGS               | LIVE/PAUSED       | Investigate              | Public/owner/Admin separation     | Most complex listing oversight screen  | Visibility zones, sections, action panel        |
| 6. Publication queue            | Desktop       | REVIEW_PUBLICATION          | Pending/failed    | Open review              | Safe review summary               | Defines primary operational queue      | Row hierarchy, failure categories, queue age    |
| 7. Publication review           | Desktop       | REVIEW_PUBLICATION          | PENDING           | Approve/return/retry     | Private review data               | Consequential workflow                 | Preview/checklist/action layout                 |
| 8. Return-for-changes dialog    | Desktop modal | REVIEW_PUBLICATION          | PENDING           | Select reason            | Customer vs Admin note separation | Critical customer communication        | Reason pattern, note boundaries, copy preview   |
| 9. Private-document access      | Desktop modal | ACCESS_PRIVATE_DOCUMENT     | Available         | Reason + acknowledgement | Highly sensitive                  | Security-critical interaction          | Warning, reason, checkbox, action order         |
| 10. Offer-thread list           | Desktop       | VIEW_OFFERS                 | Mixed             | Filter/open              | Competing offer privacy           | Defines read-only offer oversight      | Columns and identity treatment                  |
| 11. Offer detail                | Desktop       | VIEW_OFFERS                 | Active/accepted   | Investigate              | Participant and amount data       | Must remain non-interventionist        | Timeline and operational boundaries             |
| 12. Transaction list            | Desktop       | VIEW_TRANSACTIONS           | Mixed             | Attention filtering      | Participant-safe data             | High-volume queue                      | Stage, next actor, progress, issue columns      |
| 13. Transaction detail          | Desktop       | VIEW_TRANSACTIONS           | Active            | Investigate/recovery     | Documents and participant tasks   | Densest Admin screen                   | Stage tracker, task grouping, recovery panel    |
| 14. Failed transaction recovery | Desktop       | MANAGE_TRANSACTION_RECOVERY | Retryable failure | Retry/pause/fail         | Safe diagnostics                  | Consequential operational logic        | Failure hierarchy and action limits             |
| 15. Audit log                   | Desktop       | VIEW_AUDIT_LOGS             | Mixed             | Filter/open              | Safe metadata                     | Defines auditability surface           | Columns, filters, detail interaction            |

## Priority P1 — approve during implementation

| Mockup                            | View           | Capability         | Entity state | Key interaction  | Why                                        | Engineering must not invent              |
| --------------------------------- | -------------- | ------------------ | ------------ | ---------------- | ------------------------------------------ | ---------------------------------------- |
| 16. Admin dashboard               | Tablet         | VIEW_OVERVIEW      | Mixed        | Queue navigation | Validates collapsed navigation and density | Breakpoint behaviour                     |
| 17. Mobile Admin navigation       | Mobile         | Mixed              | N/A          | Open/navigate    | Ensures portal remains usable              | Sheet hierarchy and counts               |
| 18. Arabic RTL dashboard          | Desktop        | VIEW_OVERVIEW      | Mixed        | Queue navigation | Validates overall RTL foundation           | Sidebar mirroring, metrics, mixed refs   |
| 19. Arabic RTL publication review | Desktop        | REVIEW_PUBLICATION | PENDING      | Approve/return   | Complex RTL action layout                  | Preview/checklist/dialog direction       |
| 20. Arabic RTL transaction detail | Desktop/mobile | VIEW_TRANSACTIONS  | Active       | Investigate      | Most complex mixed numeric screen          | Stage order, amounts, refs, action panel |

---

# 48. Open Product Decisions

| Decision                                 | Recommendation                                                 | Owner                                  |
| ---------------------------------------- | -------------------------------------------------------------- | -------------------------------------- |
| Capability assignment UI                 | Not included; capabilities provisioned server-side             | Engineering/product                    |
| Customer restriction model               | Narrow `ACTIONS_RESTRICTED` overlay as defined                 | Product/security                       |
| Publication auto-resolution              | Non-production/test only; manual queue uses same request model | Product/engineering                    |
| Document download                        | Disabled by default; temporary view only                       | Security/legal                         |
| Signed view duration                     | Five minutes                                                   | Security                               |
| Audit retention/date range               | UI defaults 30 days; backend policy required                   | Security/legal                         |
| Admin note correction                    | Append-only correction note                                    | Product/compliance                     |
| Offer operational close                  | Strict inconsistency repair only                               | Product/legal                          |
| Transaction notification partial failure | Domain state remains; follow-up recorded                       | Architecture                           |
| Admin notification recipient support     | Reuse canonical notification table if safe                     | Engineering                            |
| Arabic copy                              | Draft only                                                     | Professional Arabic + legal/compliance |
| Admin support contact wording            | Requires operational owner                                     | Operations                             |
| Shared demo seed                         | Explicitly not required                                        | Locked decision                        |

---

# 49. Final Acceptance Checklist

## Access and foundation

- [ ] Admin app remains separate
- [ ] Only authenticated `ADMIN` accounts enter
- [ ] Customer receives Access Denied before protected data renders
- [ ] No public Admin signup
- [ ] Capability checks exist server-side
- [ ] No customer impersonation or mode switch
- [ ] Sidebar, header, global search and mobile navigation work

## Dashboard and queues

- [ ] Operational metrics are actionable
- [ ] Publication, verification and transaction queues exist
- [ ] Partial dashboard failure is handled
- [ ] Queue counts are authoritative
- [ ] Realtime triggers refetch

## Customers

- [ ] Customer list and filters work
- [ ] Customer profile includes related records
- [ ] Restrict and restore use controlled transitions
- [ ] Restriction behaviour matches this specification
- [ ] Admin notes are separate and append-only
- [ ] Customer activity timeline works

## Listings and publication

- [ ] Listings list and filters work
- [ ] Listing detail separates public, owner and Admin data
- [ ] Publication queue uses existing request model
- [ ] Publication review shows checklist and preview
- [ ] Approve in demo is controlled
- [ ] Return for changes requires structured reason
- [ ] Photo preparation retry is safe and idempotent
- [ ] Pause and resume follow canonical listing rules
- [ ] Block publication is not arbitrary state assignment

## Verifications and documents

- [ ] Verification list/detail exists
- [ ] Simulation labels are explicit
- [ ] Retry preserves prior attempt history
- [ ] Document metadata is default
- [ ] Private document access requires capability and reason
- [ ] Access lasts five minutes
- [ ] Access is audited
- [ ] Raw paths and signed URLs never render

## Offers

- [ ] Offer list and filters work
- [ ] Offer detail is read-only by default
- [ ] Proposal history is immutable
- [ ] Admin cannot negotiate for participants
- [ ] Operational close is strictly reason-coded
- [ ] Cross-entity privacy is maintained

## Transactions

- [ ] Transaction list and filters work
- [ ] Transaction detail shows stage, next actor and participant tasks
- [ ] Admin cannot complete participant tasks
- [ ] Retry applies only to recoverable system steps
- [ ] Pause/resume progression is controlled
- [ ] Mark failed requires reason and confirmation
- [ ] Cancellation conflicts use persisted participant intent
- [ ] Completed demo transaction is read-only

## Audit and operations

- [ ] Global Audit area is read-only
- [ ] Entity activity timelines are consistent
- [ ] Admin notes are not mixed with audit events
- [ ] Consequential actions include actor, reason and effects
- [ ] Partial notification failure is represented honestly
- [ ] No audit deletion exists

## Quality and safety

- [ ] English copy catalogue is implemented
- [ ] Arabic copy is flagged as unreviewed
- [ ] RTL uses logical positioning
- [ ] Amounts, emails, file names and references remain readable LTR where required
- [ ] Desktop, tablet and mobile requirements are met
- [ ] Tables transform to mobile cards
- [ ] WCAG 2.2 AA requirements are met
- [ ] Loading, empty, partial, error, conflict and session states exist
- [ ] No stack traces, raw SQL, tokens, storage keys or blank screens appear
- [ ] Realtime is not used as source of truth
- [ ] P0 mockups are approved before layout invention
- [ ] No shared Week 6 demo seed is required
- [ ] Tests use isolated fixtures, factories and per-test records

---

## Final Design Intent

The MARKAZ Admin Portal should communicate:

> A precise, auditable operations environment where authorised Admin users understand the current system state and take only controlled, necessary action.

It must not communicate:

- unrestricted database access;
- customer impersonation;
- a generic analytics dashboard;
- a developer console;
- real legal, government or payment authority;
- an ability to rewrite customer history.

The final implementation should feel visibly connected to MARKAZ through its architectural-blue palette and disciplined typography, while being denser, more operational and more explicit about permissions, consequences and auditability than the customer application.
