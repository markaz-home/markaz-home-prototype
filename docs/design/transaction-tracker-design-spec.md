# MARKAZ Home — Accepted Offer and Transaction Tracker Design Specification

**File:** `MARKAZ-TRANSACTION-TRACKER-DESIGN-SPEC.md`  
**Status:** Implementation-ready design specification  
**Milestone:** Week 5 — Accepted Offer and Transaction Tracker  
**Application:** MARKAZ Home customer web  
**Account type:** `CUSTOMER`  
**Primary languages:** English and Arabic  
**Accessibility target:** WCAG 2.2 AA  
**Last updated:** July 2026

---

## Milestone Understanding

Week 5 begins when Week 4 has atomically accepted one proposal, closed competing negotiations, blocked new offers, and derived the listing as **Under offer**. It turns that accepted offer into one private, shared transaction workspace for the buyer and seller.

The transaction tracker is a guided prototype. It records confirmations, fictional files, simulated deposit, simulated document review, simulated due-diligence checks, transfer readiness, a simulated appointment, completion, cancellation, and recoverable failures. It does not process money, create binding documents, verify identities or ownership, perform conveyancing, book a government appointment, or transfer property.

The design preserves the existing unified `CUSTOMER` account, accepted offer thread and proposal, participant-only RLS model, in-app notification system, Realtime refetch pattern, English and Arabic localisation, RTL behaviour, and the approved MARKAZ **Architectural Blue — Quiet Editorial Intelligence** visual language.

---

# 1. Executive Summary

The MARKAZ transaction experience should feel like a calm shared checklist for a high-value property process. It must answer five questions immediately:

1. Where is the transaction now?
2. What do I need to do?
3. What is the other participant doing?
4. What is blocking progress?
5. What happens next?

## 1.1 Final product decisions

1. **Automatic, idempotent transaction creation.** Acceptance triggers one transaction for the accepted offer thread and exact accepted proposal. The accepted-state and transaction routes also run a safe `ensure transaction` operation so a transient creation failure cannot create duplicates or strand the user.
2. **One shared transaction route.** Buyer and seller use the same participant-authorised workspace. Content and actions change by perspective.
3. **Six grouped stages.** The primary progress tracker uses: Confirm transaction, Deposit, Documents, Demo checks, Transfer, Completion. Detailed tasks sit inside each stage.
4. **Stage plus task model.** A transaction has one overall state, while each task/milestone has its own state and actor. This prevents an unmanageable thirteen-step primary stepper.
5. **Actor values.** `BUYER`, `SELLER`, `BOTH`, `SYSTEM`, and `NONE` are the only next-actor categories.
6. **Purchase route is required.** Buyer selects Cash purchase or Financing. Financing remains a simple demo status and never imitates a bank application.
7. **Deposit is display-only.** The demo deposit is server-calculated as 10% of the accepted amount. The buyer confirms it in demo; no money or payment details are collected.
8. **Documents are private by default.** Buyer and seller see the other participant’s completion status, not their private files. The shared transaction summary is the only participant-shared document-like artefact.
9. **Simulated Form F is a structured review, not a generated contract.** It contains no legal signatures, government branding, downloadable official form, or binding language.
10. **Due diligence is a system simulation.** It checks prototype prerequisites only and is explicitly not legal, financial, structural, title, or regulatory verification.
11. **Transfer date is a proposal, not a booking.** Seller selects a preferred date; buyer and seller confirm readiness; MARKAZ then records a simulated appointment.
12. **Completion requires both participants.** Buyer and seller separately confirm completion in demo. The transaction becomes read-only only after both confirmations and a final server check.
13. **Use `SOLD_DEMO` after completion.** This state already belongs to the approved future listing model and clearly removes the property from active search without claiming a real sale.
14. **Cancellation never republishes automatically.** A cancelled transaction pauses the listing. The seller must review and explicitly resume or republish it later.
15. **No shared Week 5 demo seed.** Implementation and testing use isolated fixtures, lightweight factories, per-test records, and optional manually created UI records.

---

# 2. Scope

## 2.1 Included

- Accepted-offer handoff
- Automatic and idempotent transaction creation
- My Transactions
- Buyer and seller perspectives in one workspace
- Transaction header and progress
- Details confirmation by both participants
- Buyer purchase route
- Simulated deposit
- Buyer and seller document checklists
- Private fictional document uploads
- Simulated Form F / transaction summary review
- Simulated due diligence
- Transfer preparation and readiness
- Simulated transfer appointment
- Completion confirmation
- `COMPLETED_DEMO`
- Listing transition to `SOLD_DEMO`
- Cancellation request, confirmation, and cancelled outcome
- Failed and blocked states
- Transaction timeline
- In-app notifications
- Realtime refetch behaviour
- English and draft Arabic
- Responsive desktop, tablet, and mobile
- Accessibility and privacy requirements
- Engineering handoff and required visual mockups

## 2.2 Excluded

- Real payment, card, bank transfer, IBAN, receipt, or escrow
- Real deposit or refund
- Mortgage application, credit assessment, bank integration, or bank branding
- Official Form F, MOU, NOC, conveyancing, or legal signature
- Real DLD, Trakheesi, Madmoun, or government booking
- Real identity or ownership verification
- Official property transfer or handover
- Contact-detail exchange or unrestricted messaging
- Viewing bookings
- Agent workflow
- Full Admin Portal or Admin transaction intervention
- Disputes
- Email, SMS, or push notifications
- Real document generation
- Legal or financial advice

---

# 3. Product and Account Rules

1. Account types remain `CUSTOMER` and `ADMIN`.
2. Buyer and Seller are transaction perspectives, never account roles.
3. One customer may be a buyer in one transaction and a seller in another.
4. There is no account-mode switch.
5. A transaction is accessible only to its buyer, seller, and a future authorised Admin.
6. Anonymous users cannot read transaction data.
7. The property, buyer, seller, accepted amount, accepted proposal, and accepted offer thread are immutable transaction facts.
8. A transaction may be created only from an `ACCEPTED` offer thread and its accepted proposal.
9. One accepted offer may create one transaction only.
10. Transaction actions are server-authorised and server-validated.
11. Participants see safe labels, not contact information or full legal identity.
12. No transaction action silently changes the accepted amount.
13. Realtime improves freshness; persisted server state remains authoritative.
14. A completed or cancelled transaction is read-only except for permitted document viewing/removal policy and navigation.
15. A failed milestone does not automatically fail the entire transaction.
16. Ordinary participant cancellation is not represented as a system failure.

---

# 4. Legal and Simulation Boundary

Display the following disclosure at the transaction entry and persist a compact version in the workspace:

> **Transaction process simulated**  
> This prototype does not process real payments, create legally binding documents, or perform an official property transfer.

Use:

- Confirmed in demo
- Completed in demo
- Simulated document review
- Simulated appointment
- Prototype checklist
- Demo deposit amount

Do not use:

- Payment received
- Escrow funded
- Contract executed
- Official Form F
- Official NOC
- Official transfer booked
- Ownership transferred
- Legally completed
- DLD approved
- Mortgage approved

Simulation disclosure is an information treatment, not a red warning. Use Pale Blue, an information icon, 14–16 px text, and no official seals or government styling.

---

# 5. Week 5 Entry and Exit Boundaries

## 5.1 Entry

Required conditions:

- Offer thread state is `ACCEPTED`.
- Accepted proposal exists and is current accepted proposal.
- Listing remains associated with that accepted thread.
- Buyer and seller still match the accepted thread.
- No transaction already exists for the accepted thread/proposal pair.

## 5.2 Exit

Week 5 may end in:

```text
COMPLETED_DEMO
CANCELLED
FAILED
```

`FAILED` is reserved for a terminal system/workflow failure. Most errors remain task-level `FAILED` or `BLOCKED` and are retryable.

## 5.3 Week 6 boundary

Week 6 may add operational review, manual resolution, and Admin controls. Week 5 may show:

> MARKAZ Operations review will be available in the next stage.

It must not expose Admin routes, notes, or controls in customer web.

---

# 6. Canonical Transaction Model

## 6.1 Transaction identity

One transaction per:

```text
accepted offer thread + accepted proposal
```

The recommended user-facing reference is:

```text
MKZ-TXN-{YEAR}-{6 DIGITS}
```

Example:

> MKZ-TXN-2026-004281

This is a display reference, not the database primary key.

## 6.2 Immutable facts

- Listing and property reference
- Buyer ID
- Seller ID
- Accepted offer-thread ID
- Accepted proposal ID
- Accepted amount AED
- Offer acceptance timestamp
- Transaction creation timestamp

## 6.3 Mutable transaction fields

- Overall status
- Current stage
- Next actor
- Purchase route
- Stage/task states
- Demo deposit confirmation
- Transaction documents and visibility metadata
- Preferred transfer date
- Buyer/seller readiness
- Completion confirmations
- Cancellation request and outcome
- Version
- Last updated

## 6.4 Related records

Recommended conceptual records:

- Transaction
- Transaction task / milestone
- Transaction confirmation
- Transaction document
- Transaction event
- Cancellation request
- Existing notification and audit-event records

No screen should expose these raw entity names or identifiers.

---

# 7. Transaction Creation

## 7.1 Recommended model

Use **automatic creation with an idempotent entry fallback**.

```text
Offer accepted
→ server ensures transaction exists
→ acceptance response includes transaction reference
→ buyer and seller see Continue to Transaction
```

On any accepted-offer or transaction-handoff load, the server safely ensures the same transaction exists. The unique accepted-thread/proposal constraint prevents duplicates.

## 7.2 Handoff screen

**Title:**

> Your transaction is ready

**Body:**

> The accepted offer has moved into the transaction stage. You and the other participant can now complete the required demo steps.

Show:

- Property cover and headline
- Accepted amount
- `You are buying` or `You are selling`
- Transaction reference
- First stage: Confirm transaction
- Simulation disclosure

Actions:

- Primary: `Continue to Transaction`
- Secondary: `Return to Offers`
- Tertiary: `View property`

## 7.3 Creation loading

> **Preparing your transaction…**  
> We are creating the shared transaction workspace.

If creation exceeds 10 seconds:

> This is taking longer than expected. Your accepted offer is safe.

Actions:

- `Try again`
- `Return to Offers`

## 7.4 Creation failure

> **We could not prepare the transaction workspace**  
> Your accepted offer has been preserved. Try again shortly.

No second transaction may be created through repeated retry.

---

# 8. Transaction State Model

## 8.1 Internal states

| State | Entry | Exit | User label | Reversible |
|---|---|---|---|---|
| `INITIATED` | Transaction created | First participant confirmation | Transaction created | No |
| `CONFIRMATION` | Workspace active | Both confirm + purchase route selected | Confirming transaction | Yes until complete |
| `DEPOSIT` | Confirmation complete | Buyer confirms demo deposit | Confirming demo deposit | No after completion |
| `DOCUMENTS` | Deposit complete | Required documents + shared review complete | Completing documents | Task-level only |
| `DUE_DILIGENCE` | Documents complete | Simulated checks complete | Demo checks in progress | Retryable |
| `TRANSFER` | Demo checks complete | Both ready + appointment simulated | Preparing transfer | Readiness can change before appointment |
| `COMPLETION` | Appointment simulated | Both completion confirmations | Confirming completion | No after complete |
| `COMPLETED_DEMO` | Final server validation | Terminal | Completed in demo | No |
| `CANCELLATION_PENDING` | Mutual cancellation required | Confirmed / declined / future review | Cancellation requested | Yes until resolved |
| `CANCELLED` | Cancellation completed | Terminal | Transaction cancelled | No |
| `FAILED` | Terminal workflow/system failure | Future Admin intervention | Transaction needs review | No customer progression |

## 8.2 User-facing status

Do not expose raw enums. Use:

- Your action is required
- Waiting for buyer
- Waiting for seller
- Waiting for both participants
- Waiting for system
- In progress
- Completed in demo
- Blocked
- Cancellation requested
- Transaction cancelled
- Transaction needs review

## 8.3 State-transition rules

- Only the current stage may accept normal progress actions.
- Completed stage tasks are immutable unless specifically marked replaceable, such as a private uploaded file before the Documents stage completes.
- Cancellation may interrupt any non-terminal state.
- Completion cannot occur while cancellation is pending.
- Version conflicts trigger authoritative refresh.

---

# 9. Milestone Model

## 9.1 Task states

```text
PENDING
ACTION_REQUIRED
IN_PROGRESS
COMPLETED_DEMO
BLOCKED
FAILED
SKIPPED
```

## 9.2 Grouped stages and tasks

### Stage 1 — Confirm transaction

- Buyer confirms transaction details
- Seller confirms transaction details
- Buyer selects purchase route

### Stage 2 — Deposit

- Buyer reviews demo deposit
- Buyer confirms deposit in demo

### Stage 3 — Documents

- Buyer private document checklist
- Seller private document checklist
- Financing confirmation, conditional
- Buyer reviews simulated transaction summary
- Seller reviews simulated transaction summary

### Stage 4 — Demo checks

- Prototype prerequisites check
- Simulated document-completeness check
- Simulated NOC requirement acknowledgement
- Simulated due-diligence outcome

### Stage 5 — Transfer

- Seller proposes preferred transfer date
- Buyer confirms readiness/date
- Seller confirms readiness
- Simulated transfer appointment recorded

### Stage 6 — Completion

- Buyer confirms completion in demo
- Seller confirms completion in demo
- System completes transaction and listing treatment

## 9.3 Task ownership

Every task displays one of:

- Your action required
- Buyer action required
- Seller action required
- Both participants required
- Waiting for system
- Completed in demo

Never show only `Pending`.

## 9.4 Progress calculation

Overall progress uses completed required tasks divided by all required tasks for the chosen purchase route. Optional/skipped tasks do not reduce progress.

Display progress as stage completion and a text value, not only a percentage.

Example:

> 3 of 6 stages complete

---

# 10. Actor and Next-Action Model

## 10.1 Values

```text
BUYER
SELLER
BOTH
SYSTEM
NONE
```

## 10.2 Determination

The server derives next actor from incomplete required tasks in the current stage.

- One buyer task open → `BUYER`
- One seller task open → `SELLER`
- Tasks required from both → `BOTH`
- Simulation processing → `SYSTEM`
- Terminal state → `NONE`

## 10.3 Perspective copy

| Next actor | Current participant | Copy |
|---|---|---|
| Buyer | Buyer | Your action is required |
| Buyer | Seller | Waiting for buyer |
| Seller | Seller | Your action is required |
| Seller | Buyer | Waiting for seller |
| Both | Either | Action required from both participants |
| System | Either | Waiting for demo processing |
| None | Either | No action required |

---

# 11. Design Principles

1. **One clear next action.** The current task dominates the workspace.
2. **Property first.** Property image, location, and accepted amount anchor every transaction screen.
3. **Stage clarity over raw progress.** Show meaningful stages, not a dense technical state machine.
4. **Shared process, private data.** Participants see shared status without unnecessary files or identities.
5. **Simulation is visible.** Financial, legal, due-diligence, and transfer actions are labelled as demo actions.
6. **No banking or government imitation.** Avoid receipts, seals, official forms, and official appointment layouts.
7. **No chat.** Use task states and a structured timeline.
8. **Consequences before confirmation.** Completion and cancellation dialogs explain listing and transaction effects.
9. **Calm blocked states.** Explain who or what is blocking progress and how it can be resolved.
10. **Server authority.** Stale screens refresh instead of guessing.
11. **Accessible is premium.** Status, actor, and progress are conveyed with text, semantics, and strong focus states.

---

# 12. Information Architecture

```text
Authenticated Customer
├── Dashboard
├── Offers
├── Transactions
│   ├── My Transactions
│   └── Transaction Workspace
│       ├── Overview
│       ├── Current Stage
│       ├── Tasks
│       ├── Documents
│       ├── Timeline
│       └── Cancellation
├── My Listings
└── Notifications
```

The workspace is one route with anchored sections and focusable milestone links. It is not a multi-page wizard.

---

# 13. Route Recommendations

## 13.1 Final routes

```text
/[locale]/transactions
/[locale]/transactions/[transactionId]
```

Supported safe deep links:

```text
/[locale]/transactions/[transactionId]?focus=confirmation
/[locale]/transactions/[transactionId]?focus=deposit
/[locale]/transactions/[transactionId]?focus=documents
/[locale]/transactions/[transactionId]?focus=checks
/[locale]/transactions/[transactionId]?focus=transfer
/[locale]/transactions/[transactionId]?focus=completion
```

## 13.2 Why one workspace route

- Preserves property and transaction context
- Avoids fragmented back navigation
- Supports Realtime refresh consistently
- Makes mobile progress understandable
- Reduces duplicated participant authorisation
- Allows notifications to deep-link to a task without creating many routes

Uploads and confirmations use dialogs, drawers, or inline panels rather than separate public routes.

## 13.3 Security

- `transactionId` is opaque.
- Server verifies participant access before returning any transaction projection.
- Missing and forbidden return the same unavailable state.
- Focus query is allowlisted.

---

# 14. Navigation

## 14.1 Desktop authenticated header

Primary:

- Dashboard
- Browse
- My Listings
- Offers
- Transactions

Utilities:

- Saved
- Notifications
- List a property
- Account

Do not create separate `Offers Made`, `Offers Received`, `Buying`, or `Selling` navigation modes. Those are views inside Offers and perspective labels inside Transactions.

## 14.2 Badges

- Transactions badge = number of transactions requiring the current user’s action.
- Notification bell count = unread notifications.
- Marking a notification read does not clear a Transactions action badge.

## 14.3 Mobile navigation

Five items:

1. Home
2. Browse
3. Listings
4. Offers
5. Transactions

Saved, Notifications, and Account remain in top utilities/account sheet.

---

# 15. Offer-Accepted Handoff

## 15.1 Buyer variant

**Eyebrow:** `Offer accepted`

**Title:**

> Your transaction is ready

**Body:**

> The accepted offer has moved into the transaction stage. You and the seller can now complete the required demo steps.

Perspective:

> You are buying

## 15.2 Seller variant

Body:

> The accepted offer has moved into the transaction stage. You and the buyer can now complete the required demo steps.

Perspective:

> You are selling

## 15.3 Required content

- Property cover
- Property headline and location
- Accepted amount
- Accepted date
- Transaction reference
- Six-stage preview
- Simulation disclosure

## 15.4 Actions

- Primary: `Continue to Transaction`
- Secondary: `Return to Offers`
- Link: `View accepted offer`

---

# 16. My Transactions

## 16.1 Page structure

Route:

```text
/[locale]/transactions
```

Title:

> My Transactions

Description:

> Track property purchases and sales from accepted offer to demo completion.

Filters:

- All
- Needs your action
- Waiting
- Completed
- Closed

Default:

- `Needs your action` when at least one exists
- otherwise `All`

Sort:

- Latest activity — default
- Newest transaction
- Oldest transaction

## 16.2 Transaction card

Show:

- Property cover and headline
- Community and emirate
- Accepted amount
- Perspective: `You are buying` / `You are selling`
- Current stage
- Stage progress
- Next-action statement
- Last activity
- Overall status
- Primary CTA

Do not show participant names, contact details, private documents, or unrelated offer history.

## 16.3 Empty state

> **No transactions yet**  
> Transactions appear here after an offer is accepted.

Actions:

- `Browse properties`
- `View Offers`

## 16.4 Buyer action required

> Your action is required: Confirm transaction details

CTA:

> Continue transaction

## 16.5 Seller action required

> Your action is required: Confirm transfer readiness

## 16.6 Waiting

> Waiting for seller to confirm the transaction details.

CTA:

> View progress

## 16.7 Completed

> Completed in demo

CTA:

> View transaction summary

## 16.8 Cancelled

> Transaction cancelled

CTA:

> View history

## 16.9 Partial failure

Render available cards and show:

> Some transactions could not be loaded. Try again to refresh the list.


---

# 17. Shared Transaction Workspace

## 17.1 Desktop layout

Maximum width: 1320 px.

```text
┌─────────────────────────────────────────────────────────────────────┐
│ Breadcrumb · Transaction reference · Last updated                  │
│ Property summary · Accepted amount · You are buying/selling        │
│ Simulation disclosure                                               │
├─────────────────────────────────────────────────────────────────────┤
│ Six-stage progress tracker                                          │
├──────────────────────────────────────┬──────────────────────────────┤
│ Current milestone and tasks          │ Next action panel            │
│ Buyer and seller status              │ Property / amount summary    │
│ Documents                            │ Help and cancellation        │
│ Timeline                             │                              │
└──────────────────────────────────────┴──────────────────────────────┘
```

- Main column: 760–840 px
- Side panel: 340–380 px
- Gap: 40–48 px
- Next-action panel may be sticky below the customer header.

## 17.2 Tablet

- Single main column, max 760 px
- Next-action panel moves directly below progress
- Property summary becomes a compact horizontal card
- Stage details use accordions only for future/completed sections

## 17.3 Mobile

Order:

1. Compact transaction header
2. Current stage label
3. Mobile progress control
4. Next-action panel
5. Current tasks
6. Buyer/seller task summary
7. Documents
8. Timeline
9. Cancellation

Use a sticky bottom action bar only when the current user has one clear action.

## 17.4 Workspace header

Show:

- Transaction reference
- Property cover, headline, and location
- Accepted amount
- `You are buying` or `You are selling`
- Overall status
- Current stage
- Last updated

Do not show participant contact details, full identity, internal IDs, or private listing fields.

## 17.5 Section navigation

Desktop may include a compact anchor navigation:

- Overview
- Tasks
- Documents
- Timeline

It must not look like an Admin sidebar.

---

# 18. Progress Tracker

## 18.1 Desktop

Use a six-stage horizontal tracker:

```text
✓ Confirm → ● Deposit → ○ Documents → ○ Demo checks → ○ Transfer → ○ Completion
```

Each stage contains:

- Icon or number
- Label
- State text
- Optional task count

States:

- Complete
- Current
- Upcoming
- Action required
- Blocked
- Failed
- Cancelled

## 18.2 Mobile

Use:

> Stage 2 of 6 · Deposit

with a segmented progress line and an expandable `View all stages` control. Expanded view is a vertical ordered list.

## 18.3 Interaction

- Completed and current stages may be opened.
- Future stages open a preview explaining purpose and prerequisites; they are not actionable.
- Blocked stages link to the blocking task.
- Do not allow skipping required stages.

## 18.4 Future-stage preview copy

> **Documents**  
> Buyer and seller complete private prototype document checklists. This stage becomes available after the demo deposit is confirmed.

## 18.5 Accessibility

- Use an ordered list.
- Expose current stage with `aria-current="step"` semantics.
- Include state text in each item.
- Do not rely on connecting-line colour.

---

# 19. Transaction-Details Confirmation

## 19.1 Purpose

Both participants confirm the immutable property and accepted-offer facts before the transaction progresses.

## 19.2 Information shown

- Property cover, type, and public location
- Accepted amount
- Acceptance date
- Transaction reference
- Buyer-safe label: `Buyer participant`
- Seller-safe label: `Seller participant`
- Current perspective
- Purchase route, after buyer chooses it
- Simulation disclosure

Do not show legal names, phone numbers, email, unit number, identity details, or ownership files.

## 19.3 Buyer actions

1. Review details
2. Select purchase route
3. Check confirmation:

> I confirm that the property and accepted amount shown are correct for this demo transaction.

4. `Confirm transaction details`

## 19.4 Seller actions

Check confirmation:

> I confirm that the property and accepted amount shown are correct for this demo transaction.

Primary:

> Confirm transaction details

## 19.5 One participant confirmed

Buyer sees:

> **Your details are confirmed**  
> Waiting for the seller to confirm the transaction details.

Seller sees corresponding buyer copy.

The confirmed participant cannot unconfirm directly. If something is wrong, use `Report a transaction issue`.

## 19.6 Incorrect details

Link:

> Something looks incorrect

Panel:

> **Report a transaction issue**  
> You cannot edit the accepted amount or property. Flag the transaction so it can be reviewed in MARKAZ Operations during the next product stage.

Structured categories:

- Property details appear incorrect
- Accepted amount appears incorrect
- I am not the correct participant
- Other transaction information issue

No free-form accusation field. Optional short neutral detail may be omitted in Week 5.

Submitting marks the task `BLOCKED` and transaction next actor `SYSTEM` without exposing Admin controls.

---

# 20. Purchase Route

## 20.1 Buyer selection

Required radio group:

- Cash purchase
- Financing

Title:

> How do you plan to purchase this property?

Helper:

> This selection is used only to shape the prototype transaction checklist.

## 20.2 Cash purchase

Description:

> Continue without a mortgage-related demo step.

Confirmation:

> I confirm this cash purchase route for the prototype.

No proof-of-funds upload is required in Week 5.

## 20.3 Financing

Description:

> Track a simple financing status without applying to a bank or assessing credit.

Statuses:

- Not started
- In progress
- Confirmed in demo
- Unable to proceed

Buyer action after selection:

> Update financing status

`Confirmed in demo` is required before Due Diligence can complete.

`Unable to proceed` blocks progress and offers `Request transaction cancellation`.

Required disclosure:

> No mortgage application, bank approval, or credit assessment is performed.

## 20.4 Route changes

Buyer may change route only before the demo deposit is confirmed. Changing from Cash to Financing adds the financing task. Changing from Financing to Cash requires confirmation and records a timeline event.

Dialog:

> **Change purchase route?**  
> The transaction checklist will update. Previously uploaded financing files will remain private but will no longer be required.

---

# 21. Deposit Simulation

## 21.1 Amount

Use a fixed display-only demo deposit of **10% of the accepted amount**, calculated server-side.

Show:

- Accepted amount
- Demo deposit percentage: 10%
- Demo deposit amount
- No-payment disclosure

Currency formatting supports two decimals where calculation requires them, although accepted offers are stored in whole dirhams.

## 21.2 Buyer state

Title:

> Confirm deposit in demo

Body:

> Review the demo amount and confirm the step. No real payment will be processed and no funds will be held.

Required checkbox:

> I understand that this is a simulated deposit confirmation and no money will be transferred.

Primary:

> Confirm demo deposit

## 21.3 Seller waiting state

> **Waiting for buyer**  
> The buyer needs to confirm the demo deposit before the document stage can begin.

The seller cannot confirm on the buyer’s behalf.

## 21.4 Processing

Button:

> Confirming demo deposit…

Do not show payment-processing animation, card icon, banking logo, receipt, or transaction authorization language.

## 21.5 Success

> **Deposit confirmed in demo**  
> No real payment has been processed.

Show timestamp and amount.

## 21.6 Duplicate confirmation

Return the existing completed state without creating a second event or changing amount.

---

# 22. Document Checklist

## 22.1 Required buyer documents

### All purchase routes

1. Fictional buyer identity sample — required, private to buyer
2. Buyer transaction confirmation file — optional, private to buyer

### Financing only

3. Fictional financing confirmation — required, private to buyer

## 22.2 Required seller documents

1. Fictional seller identity sample — required, private to seller
2. Seller transaction confirmation file — optional, private to seller

Do not request the Week 2 ownership document again and do not expose it inside the transaction.

## 22.3 Shared document-like record

The generated **Simulated transaction summary** is shared with both participants. It is a structured screen, not a file upload or official document.

## 22.4 Upload notice — required

> **Use fictional sample files only**  
> Do not upload a real Emirates ID, passport, bank statement, mortgage approval, Title Deed, Oqood, or other sensitive document.

## 22.5 Supported files

- PDF
- JPG/JPEG
- PNG
- Maximum 10 MB per file
- One active file per required document type
- Original filename shown only to uploader after sanitisation

## 22.6 File states

- Not uploaded
- Uploading
- Uploaded
- Processing
- Accepted in demo
- Needs replacement
- Upload failed
- Replacing
- Removing

`Accepted in demo` means the prototype received the file; it does not mean identity, financing, or legal verification.

## 22.7 Upload card

Show:

- Document type
- Required/optional
- Privacy label
- Accepted formats and size
- Select file / Replace / Remove
- Upload progress
- Safe filename to uploader only
- Uploaded time
- Status and error

## 22.8 Other participant view

The other participant sees only:

- Buyer documents: Complete / Incomplete
- Seller documents: Complete / Incomplete
- Financing confirmation: Complete / Incomplete, if required

They do not see filenames, previews, download actions, rejection details, or signed URLs.

## 22.9 Remove and replace

- Uploader may replace before the Documents stage completes.
- Removing a required file returns the task to Action required.
- After Documents stage completion, files are read-only; future changes require operations review.
- Confirmation dialog explains if removal blocks progress.

## 22.10 Mobile upload

Use system file picker:

- Choose file
- Take photo, where browser supports and the user intentionally selects it

Do not default to camera. Show the fictional-file warning before picker activation.

---

# 23. Document Privacy

## 23.1 Visibility categories

### `PRIVATE_TO_UPLOADER`

- Fictional buyer identity sample
- Fictional seller identity sample
- Fictional financing confirmation
- Optional participant confirmation files

Visible to uploader and future authorised Admin only. Other participant sees completion status.

### `SHARED_WITH_TRANSACTION_PARTICIPANTS`

- Simulated transaction summary
- Simulated appointment summary
- Final demo completion summary

These are structured records generated by MARKAZ, not uploaded personal documents.

### `ADMIN_ONLY_FUTURE`

Reserved for future operational records. Do not display in customer web.

## 23.2 Private document copy

> Your uploaded file is private to you and future authorised MARKAZ Operations reviewers. The other participant can see only whether your checklist is complete.

## 23.3 Storage rules

- Private transaction bucket
- Owner/participant-scoped RLS
- Short-lived signed access only for uploader/future Admin
- No public URL
- No storage path in UI or logs
- Files scoped to transaction and uploader
- No cross-transaction access

## 23.4 Sensitive data minimisation

The prototype should encourage blank fictional samples. It must not parse, extract, OCR, index, or analyse document content.

---

# 24. Simulated MOU / Form F Review

## 24.1 Recommendation

Include this as one shared **Simulated transaction summary** task inside Documents, not as a separate official-looking form or downloadable contract.

## 24.2 Content

- Property headline and public location
- Accepted amount
- Acceptance date
- Buyer-safe participant label
- Seller-safe participant label
- Purchase route
- Demo deposit amount and status
- Explicit non-binding disclosure

Exclude:

- Legal names
- Contact details
- Identity numbers
- Signatures
- Government branding
- Official clauses
- Detailed legal terms

## 24.3 Disclosure — required

> **Document review simulated**  
> This is not an official Form F or legally binding agreement.

## 24.4 Actions

Buyer:

> Confirm I reviewed the demo summary

Seller:

> Confirm I reviewed the demo summary

The task completes when both confirm.

## 24.5 One participant confirmed

> You reviewed the demo summary. Waiting for the seller.

No signature image, signing animation, or downloadable certificate.

---

# 25. Due-Diligence Simulation

## 25.1 Entry gate

- Both transaction details confirmed
- Purchase route valid
- Demo deposit confirmed
- Required buyer and seller files present
- Simulated transaction summary reviewed by both
- Financing status `Confirmed in demo`, if financing

## 25.2 Checks

Display a restrained checklist:

- Required transaction details present
- Required prototype documents present
- Purchase route confirmed
- Demo deposit step complete
- Simulated NOC requirement acknowledged

## 25.3 Disclosure

> **Due-diligence checks simulated**  
> These prototype checks are not legal, financial, structural, title, or regulatory advice.

## 25.4 States

### In progress

> Running demo checks…

The interface may poll/refetch a persisted simulation. It must not use an unnecessarily long fake delay.

### Completed

> **Due diligence completed in demo**  
> The prototype prerequisites are complete. No legal or regulatory clearance has been performed.

### Blocked

> **Demo checks are blocked**  
> Complete the highlighted transaction tasks before trying again.

Show links to missing tasks.

### Failed

> **We could not complete the demo checks**  
> Your transaction information has been preserved. Try the checks again.

Primary:

> Retry demo checks

### Future review

For a safe terminal category:

> This transaction needs MARKAZ Operations review. Operational review will be available in the next product stage.

Do not expose raw failure details.

---

# 26. Transfer Preparation

## 26.1 Entry gate

Due diligence must be `COMPLETED_DEMO`.

## 26.2 Seller preferred date

Seller field:

> Preferred transfer date

Rules:

- Required
- Date must be 3–30 calendar days from current server date
- No time selection
- It is a preference, not a booking

Helper:

> Choose a preferred date for this prototype. No official appointment will be booked.

## 26.3 Buyer response

Buyer sees date and chooses:

- This date works for me
- I am not ready yet

`I am not ready yet` does not cancel; it keeps the stage blocked and allows later change.

## 26.4 Seller readiness

Required confirmation:

> I confirm the seller tasks are ready for the simulated transfer stage.

## 26.5 Buyer readiness

Required confirmation:

> I confirm the buyer tasks are ready for the simulated transfer stage.

## 26.6 Both ready

> **Both participants are ready**  
> MARKAZ can now create the simulated transfer appointment.

Primary for either participant when both ready:

> Create simulated appointment

The server operation is idempotent.

## 26.7 Appointment

> **Transfer appointment simulated**  
> No official appointment has been booked.

Show:

- Preferred date
- Property
- Buyer/seller readiness timestamps
- Demo location: `Dubai transfer centre · Demo only`, only if a fictional neutral location is desired

Do not imitate DLD booking screens or show official reference numbers.

---

# 27. Buyer and Seller Readiness

## 27.1 Status summary

Use two rows:

```text
Buyer readiness  — Ready / Action required / Not ready
Seller readiness — Ready / Action required / Not ready
```

Do not place buyer and seller in competitive columns. On mobile, stack rows.

## 27.2 Changing readiness

A participant may change `Ready` to `Not ready` until the simulated appointment is created. Require confirmation:

> **Change your readiness status?**  
> The simulated appointment cannot be created until both participants are ready again.

After appointment creation, readiness is read-only.

## 27.3 Notifications

- Buyer ready → notify seller if seller action remains
- Seller ready → notify buyer if buyer action remains
- Both ready → notify both that appointment can be created
- Appointment created → notify both

---

# 28. Simulated Completion

## 28.1 Entry gate

- Simulated appointment exists
- Transaction not cancelled or failed
- All required earlier milestones complete

## 28.2 Completion overview

Show:

- Property
- Accepted amount
- Six completed/current stages
- Buyer confirmation status
- Seller confirmation status
- Simulation disclosure

## 28.3 Buyer confirmation

> I confirm completion of this transaction in the demo.

Primary:

> Confirm completion in demo

## 28.4 Seller confirmation

Same perspective-specific action.

## 28.5 One participant confirmed

> **Your completion is confirmed**  
> Waiting for the seller to confirm completion in demo.

## 28.6 Final server completion

After both confirmations, the server revalidates all required milestones and atomically:

- sets transaction `COMPLETED_DEMO`;
- sets listing `SOLD_DEMO`;
- records transaction and listing events;
- sends participant notifications.

## 28.7 Final success

> **Transaction completed in demo**  
> This prototype has not processed a real payment or official property transfer.

Show:

- Completion date
- Property
- Accepted amount
- Completed stages
- Transaction reference

Actions:

- `Return to My Transactions`
- `View transaction history`
- `View property summary`

No confetti, keys animation, “Congratulations on your new home”, or real-sale language.

---

# 29. Listing Treatment After Completion

## 29.1 Final model

Use explicit listing state:

```text
SOLD_DEMO
```

This preserves publication history while removing the listing from active marketplace results and blocking offers.

## 29.2 Marketplace

- Exclude from browse/search/filter results.
- Direct former public URL may show an archival public-safe state:

> **Sold in demo**  
> This property is no longer available in the MARKAZ marketplace.

- Do not display accepted amount or buyer.
- Retain only the same public-safe property projection already published.

## 29.3 Saved Properties

Retain the saved relationship and show:

> Sold in demo

Users may remove the save.

## 29.4 Seller

My Listings shows:

- Sold in demo
- Demo completion date
- View transaction

The seller cannot republish the same completed listing.

## 29.5 Reversal

A completed transaction cannot be cancelled or returned to LIVE in Week 5. Future Admin intervention is outside scope.

---

# 30. Cancellation

## 30.1 Who may request

Buyer or seller may request cancellation before `COMPLETED_DEMO`.

## 30.2 Stage policy

### Unilateral immediate cancellation

Allowed while transaction is `INITIATED` or `CONFIRMATION` and before both details confirmations are complete.

### Mutual cancellation required

Required from Deposit onward.

The requesting participant creates `CANCELLATION_PENDING`; progress stops until the other participant confirms or declines.

### After simulated appointment

Mutual confirmation is still required. Explain that future Operations review may be needed if participants disagree.

### After completion

Cancellation is unavailable.

## 30.3 Structured reasons

- Buyer unable to proceed
- Seller unable to proceed
- Financing could not proceed
- Required prototype documents incomplete
- Both participants agreed to stop
- Other structured reason

Do not provide unrestricted accusation text.

## 30.4 Request dialog

> **Request transaction cancellation?**  
> The transaction will stop progressing while the cancellation is confirmed or reviewed.

Show:

- Stage
- Reason
- Whether the cancellation is immediate or requires the other participant
- Listing outcome: paused, not republished

Primary:

> Request cancellation

Secondary:

> Keep transaction active

## 30.5 Other participant response

Title:

> Cancellation requested

Body:

> The other participant requested to stop this demo transaction.

Actions:

- `Confirm cancellation`
- `Keep transaction active`

Declining returns the transaction to the prior stage and records the event. If the issue cannot be resolved, show future Operations-review guidance.

## 30.6 Cancellation pending

- All progression actions disabled
- Documents remain private and viewable according to permissions
- Timeline remains visible
- Listing remains Under offer until cancellation resolves

## 30.7 Cancelled

> **Transaction cancelled**  
> The transaction has stopped. The listing is paused and will not return to the marketplace automatically.

Actions:

Buyer:

- `Return to My Transactions`
- `View transaction history`

Seller:

- `Review paused listing`
- `Return to My Transactions`

---

# 31. Listing Treatment After Cancellation

On final cancellation, atomically:

- set transaction `CANCELLED`;
- keep accepted offer thread historically `ACCEPTED`;
- mark the accepted transaction link as cancelled so it no longer derives `UNDER_OFFER`;
- set listing to `PAUSED`;
- keep competing Week 4 offer threads closed;
- retain publication and transaction history;
- retain private transaction documents according to retention policy;
- notify both participants.

The seller must explicitly review and resume/re-publish the listing. Resuming may allow new offer threads because the cancelled transaction no longer blocks availability.

Public users see the normal unavailable state while the listing is paused. Do not expose cancellation details.

---

# 32. Failed Transaction

## 32.1 Definition

Use transaction-level `FAILED` only for a terminal workflow/system issue that cannot be recovered by retrying one task. Participant cancellation is never failure.

## 32.2 Task-level recoverable failures

- Document upload failed
- Demo check failed
- Milestone update failed
- Simulated appointment creation failed
- Completion recording failed

Copy:

> **We could not complete this step**  
> Your transaction information has been preserved. Try again or return later.

Primary:

> Try again

## 32.3 Terminal failure

> **This transaction needs review**  
> Progress is paused because the transaction could not be updated safely. MARKAZ Operations review will be available in the next product stage.

Actions:

- `Return to My Transactions`
- `View transaction history`

The listing remains `PAUSED` or Under offer according to the last safe committed state; never silently return it to marketplace.


---

# 33. Transaction Timeline

## 33.1 Visual model

Use a vertical, chronological event list. It must not resemble chat.

Each event includes:

- Actor: Buyer, Seller, Both participants, or MARKAZ system
- Action
- Stage
- Date and time
- Optional safe amount or document-type label
- Status icon

## 33.2 Event examples

- Offer accepted
- Transaction created
- Buyer confirmed transaction details
- Seller confirmed transaction details
- Buyer selected Cash purchase
- Buyer selected Financing
- Financing confirmed in demo
- Demo deposit confirmed
- Buyer document checklist completed
- Seller document checklist completed
- Buyer reviewed the simulated transaction summary
- Seller reviewed the simulated transaction summary
- Due diligence completed in demo
- Seller proposed a preferred transfer date
- Buyer confirmed readiness
- Seller confirmed readiness
- Transfer appointment simulated
- Buyer confirmed completion in demo
- Seller confirmed completion in demo
- Transaction completed in demo
- Cancellation requested
- Cancellation declined
- Transaction cancelled
- Transaction needs review

## 33.3 Actor treatment

- Buyer: outlined blue marker
- Seller: deep-blue filled marker
- Shared: dual-circle or neutral linked marker
- System: slate marker
- Success: restrained green check plus text
- Failure: restrained red icon plus text

Text is authoritative. Do not use colour alone.

## 33.4 Ordering

Oldest to newest. On load, keep the current stage and action visible rather than auto-scrolling to the bottom.

## 33.5 Accessibility

- Ordered list semantics
- Each event reads as one complete sentence
- Use machine-readable date/time
- Newly received meaningful events are announced politely
- No announcement for background heartbeat or duplicate event

---

# 34. Notifications

## 34.1 Reuse

Use the canonical Week 4 in-app `notifications` system. Do not create a parallel transaction-notification store.

## 34.2 Notification types

| Recipient | Trigger | Copy |
|---|---|---|
| Both | Transaction created | `Your transaction workspace is ready.` |
| Buyer | Buyer task required | `Your action is required for {property}.` |
| Seller | Seller task required | `Your action is required for {property}.` |
| Seller | Deposit confirmed | `The buyer confirmed the demo deposit.` |
| Participant | Document required | `Complete your document checklist for {property}.` |
| Participant | Other checklist complete | `The other participant completed their document checklist.` |
| Both | Demo checks complete | `Due diligence was completed in demo.` |
| Buyer | Seller ready | `The seller confirmed transfer readiness.` |
| Seller | Buyer ready | `The buyer confirmed transfer readiness.` |
| Both | Appointment simulated | `A transfer appointment was simulated.` |
| Other participant | Cancellation requested | `A transaction cancellation was requested.` |
| Both | Cancelled | `The transaction was cancelled.` |
| Both | Completed | `The transaction was completed in demo.` |
| Both | Failed | `The transaction needs review.` |

## 34.3 Header bell

Each notification item contains:

- Safe icon
- Short copy
- Property headline
- Relative time
- Unread marker
- Deep link to transaction and `focus` section

Do not show filenames, private document types beyond a generic checklist label, accepted offer history, contact details, or cancellation allegations in the bell menu.

## 34.4 Transactions badge

Action-needed badge derives from authoritative task state and current participant. It is independent of notification read state.

## 34.5 Duplicate handling

Notifications use a transaction/event idempotency key. Duplicate Realtime/refetch events do not create repeated visible notifications.

---

# 35. Realtime

## 35.1 Events that refresh the workspace

- Participant confirmation
- Purchase-route change
- Demo deposit confirmation
- Document registered, replaced, removed, or status changed
- Shared summary review
- Demo checks started/completed/failed
- Preferred date changed
- Buyer/seller readiness changed
- Appointment simulated
- Completion confirmation
- Cancellation requested/resolved
- Transaction completed/cancelled/failed

## 35.2 Correctness pattern

1. Receive a participant-scoped event.
2. De-duplicate by event id/version.
3. Refetch authorised transaction projection.
4. Replace local state with server state.
5. Announce a meaningful visible change.

Never advance a task solely from the Realtime payload.

## 35.3 Connection states

Healthy: no indicator.

Reconnecting:

> Reconnecting to transaction updates…

Stale:

> Updates may be delayed. Refresh to check the latest transaction status.

Recovered:

> Transaction status is up to date.

## 35.4 Missed events

Refetch on:

- window focus;
- route resume;
- reconnection;
- mutation success;
- version conflict;
- manual Refresh.

## 35.5 Screen-reader announcements

Examples:

- `Seller confirmed the transaction details.`
- `Demo deposit confirmed.`
- `Buyer document checklist completed.`
- `Cancellation requested. Your response is required.`
- `Transaction completed in demo.`

Do not repeatedly announce reconnect attempts.

---

# 36. Loading, Empty, Error, and Conflict States

## 36.1 Loading

### Transaction creation

Property and accepted-amount skeleton plus `Preparing your transaction…`.

### My Transactions

Six card skeletons on desktop; three on mobile.

### Workspace

Header, six-stage tracker, current action, and timeline skeletons. Do not show a blank page.

### Documents

Checklist-row skeletons; existing files remain visible during a background status refresh.

## 36.2 Empty

### My Transactions

> No transactions yet

### Timeline

A valid transaction always begins with Offer accepted and Transaction created. If missing, show a safe loading/failure state rather than an empty timeline.

### Documents

> No file uploaded yet

## 36.3 Safe unavailable state

For missing or unauthorised transaction:

> **This transaction is not available**  
> It may no longer exist, or you may not have permission to view it.

Actions:

- `Return to My Transactions`
- `Go to Dashboard`

Do not reveal which condition applies.

## 36.4 Stale conflict

> **This transaction has changed**  
> Another action was completed before yours. We have refreshed the latest status.

Primary:

> Review latest status

Do not replay the original action automatically.

## 36.5 Session expiry

> **Your session has expired**  
> Sign in again to continue. Your completed transaction progress has been preserved.

Safe return to the same transaction. Uploads or consequential confirmations must be manually restarted/reconfirmed.

## 36.6 Network unavailable

> **You appear to be offline**  
> Reconnect to continue. Completed transaction progress is stored securely.

Preserve non-sensitive unsaved form values in memory only, such as selected purchase route or date. Never persist files, checkboxes, or completion confirmation locally.

## 36.7 Document removed during view

> This file is no longer available. The document checklist has been refreshed.

## 36.8 Transaction completed/cancelled in another tab

Replace actions with the final read-only state and announce it.

## 36.9 Generic error

> **We could not load the transaction**  
> Try again. If the problem continues, return to My Transactions.

Never show raw SQL, storage errors, stack traces, signed URLs, object paths, or provider names.

---

# 37. Component Library

All components use shared MARKAZ colour, typography, spacing, radius, focus, and localisation tokens.

| Component | Purpose and anatomy | Variants and states | Interaction, accessibility, responsive and RTL |
|---|---|---|---|
| Transaction Handoff Panel | Accepted offer, property, amount, perspective, next stage | Buyer, seller, loading, error | Focus heading after acceptance; stacks mobile; amounts LTR |
| Transaction Card | Property, amount, perspective, stage, progress, next action | Active, waiting, completed, cancelled, failed | Explicit CTA; card not one giant link; mobile single column |
| Perspective Badge | `You are buying/selling` | Buyer, seller | Text plus icon; never account role; logical placement |
| Transaction Header | Reference, property, amount, status, last updated | Active, terminal | One h1; compact mobile variant; mixed names bidi-isolated |
| Simulation Disclosure | Persistent legal/simulation boundary | Full, compact | Pale-blue information panel; text always visible |
| Stage Progress Tracker | Six grouped stages | Complete, current, future, blocked, failed, cancelled | Ordered list; aria-current; horizontal desktop, compact mobile |
| Stage Preview Panel | Explains future stage and prerequisites | Future, blocked | Non-actionable; link to blocker when allowed |
| Current Milestone Card | Stage title, status, actor, tasks, action | Buyer, seller, both, system | Main workspace focus; sticky action separated |
| Next Action Panel | Dominant current action and waiting explanation | Action, waiting, blocked, terminal | Sticky desktop; mobile bottom bar; no ambiguous Pending |
| Participant Status Rows | Buyer and seller task/readiness states | Action, waiting, complete | Stack mobile; no contact details; text state |
| Task List | Required and optional tasks | Pending, action, progress, complete, blocked, failed, skipped | Semantic list; filter not required; actor announced |
| Task Row | Icon, title, actor, helper, status, action | All milestone states | 44 px target; status text; logical icon order |
| Accepted Offer Summary | Property and accepted proposal facts | Compact, expanded | Immutable; links to accepted offer history |
| Purchase Route Selector | Cash/Financing radio group | Default, selected, disabled | Fieldset/legend; LTR financial terms isolated as needed |
| Financing Status Panel | Simple demo financing state | Not started, progress, confirmed, unable | No bank branding; explicit simulation text |
| Demo Deposit Card | Accepted amount, 10%, demo amount, disclosure | Action, processing, complete | Definition list; no payment UI; amount announced fully |
| Document Checklist | Participant-specific required files | Buyer, seller, financing | Uploader sees files; other participant sees status only |
| Document Upload Control | Drop/select, requirements, privacy | Empty, uploading, uploaded, failed, replacing | Keyboard file input; no drag-only dependency; mobile picker |
| File Metadata Card | Type, safe name, size, date, status, actions | Private, processing, accepted-demo, replace | Filename LTR; remove/replace confirmation; uploader only |
| Document Privacy Badge | Visibility category | Private to you, shared status, shared summary | Full accessible label; no tooltip-only privacy |
| Shared Summary Panel | Simulated Form F summary and dual review | Waiting, one confirmed, complete | Structured data; no signature styling; both perspectives |
| Demo Check Panel | Prerequisites and simulated outcome | Blocked, progress, complete, failed | Status live region; retry; no official clearance language |
| Preferred Date Field | Seller’s transfer-date preference | Empty, valid, invalid, read-only | Native date/input fallback; server-date validation; RTL label |
| Readiness Control | Participant readiness confirmation | Not ready, ready, locked | Consequence dialog on change; status announced |
| Appointment Summary | Simulated date and participant readiness | Processing, created | Clear no-booking disclosure; shared record |
| Completion Checklist | Completed stage summary and dual confirmation | Buyer/seller waiting, ready, complete | No confetti; confirmation dialog; terminal read-only |
| Cancellation Trigger | Low-emphasis transaction action | Available, unavailable | Not primary; explanatory label; keyboard accessible |
| Cancellation Dialog | Reason, consequences, mutual/unilateral rule | Request, respond, processing | Focus trap, structured reasons, no free-form accusation |
| Cancellation Status Panel | Requesting/responding/final status | Pending, declined, cancelled | Stops progression; clear listing outcome |
| Transaction Timeline | Chronological structured events | Active, terminal | Ordered list; no chat; polite inserted-event announcement |
| Realtime Status Banner | Degraded live-update status | Reconnecting, stale, recovered | Hidden when healthy; manual refresh in stale state |
| Mobile Transaction Action Bar | Current participant action | Confirm, upload, retry, respond | Safe-area padding; 48 px controls; logical RTL order |
| Unavailable Transaction Panel | Unified safe missing/forbidden state | Standard | No enumeration; heading focused |
| Transaction Error Panel | Retryable or terminal failure | Retry, future review | Safe reference optional; no raw details |

## 37.1 Reuse from prior milestones

- Property mini-summary
- AED formatter
- Status panel
- Loading button
- Dialog and bottom sheet
- File uploader and file card foundations
- Skeleton and empty state
- Notification menu
- Realtime stale banner
- Mobile sticky action pattern
- Account/session guard

---

# 38. Validation Matrix

| Screen | Field/action | Rule | Trigger | English error or warning | Placement | Clears when | Blocking? | Arabic review |
|---|---|---|---|---|---|---|---|---|
| Transaction entry | Access | Buyer or seller participant only | Route load | `This transaction is not available.` | Page panel | Authorised route | Yes | Security + language |
| Creation | Accepted offer | Thread/proposal must remain accepted | Ensure/create | `The accepted offer is no longer available for transaction setup.` | Page panel | Valid accepted offer | Yes | Security + language |
| Creation | Duplicate | One transaction per accepted thread/proposal | Repeated request | No error; return existing transaction | N/A | N/A | No | N/A |
| Any action | Participant turn | Current participant must own task | Action | `This action is not available for your transaction perspective.` | Form alert | Correct task | Yes | Security + language |
| Details | Confirmation missing | Required checkbox | Submit | `Confirm the transaction details to continue.` | Under checkbox | Checked | Yes | Legal + language |
| Purchase route | Missing | Cash or Financing required | Submit | `Select a purchase route.` | Under group | Selected | Yes | Language |
| Financing | Invalid status | Approved demo status only | Submit | `Select a valid financing status.` | Panel | Valid state | Yes | Language |
| Deposit | Not available | Confirmation stage complete | Open/action | `Complete the transaction confirmation stage first.` | Panel | Prerequisite complete | Yes | Language |
| Deposit | Checkbox missing | Simulation acknowledgement required | Submit | `Confirm that no real payment will be processed.` | Under checkbox | Checked | Yes | Legal + language |
| Deposit | Already complete | Idempotent | Repeat | No error; show completed state | N/A | N/A | No | N/A |
| Document | Unsupported type | PDF/JPG/PNG only | Select/upload | `Upload a PDF, JPG, or PNG file.` | Upload control | Supported file | Yes | Language |
| Document | Too large | ≤10 MB | Select/upload | `File size must be 10 MB or less.` | Upload control | Smaller file | Yes | Language |
| Document | Upload failed | Storage/register operation succeeds | Upload | `We could not upload this file. Try again.` | File card | Retry succeeds | Yes for required | Language |
| Document | Replace failed | Existing file remains active | Replace | `The replacement could not be uploaded. Your current file is unchanged.` | File card | Retry/cancel | No if existing valid | Language |
| Documents | Required missing | Required files by route | Continue | `Complete the required document checklist to continue.` | Stage alert | All present | Yes | Language |
| Shared review | Confirmation missing | Both reviews required | Progress | `Review and confirm the simulated transaction summary.` | Task row | Confirmed | Yes | Legal + language |
| Demo checks | Prerequisites | Deposit/docs/route complete | Start | `Complete the highlighted transaction tasks before starting demo checks.` | Check panel | Requirements complete | Yes | Language |
| Demo checks | Failure | Simulation resolves safely | Result | `We could not complete the demo checks. Try again.` | Check panel | Retry succeeds | Yes | Language |
| Transfer | Date missing | Required seller date | Submit | `Choose a preferred transfer date.` | Under date | Date selected | Yes | Language |
| Transfer | Date too soon | ≥3 days | Submit | `Choose a date at least 3 days from today.` | Under date | Valid date | Yes | Language |
| Transfer | Date too late | ≤30 days | Submit | `Choose a date within the next 30 days.` | Under date | Valid date | Yes | Language |
| Transfer | Buyer readiness | Required | Appointment action | `The buyer must confirm readiness first.` | Status panel | Buyer ready | Yes | Language |
| Transfer | Seller readiness | Required | Appointment action | `The seller must confirm readiness first.` | Status panel | Seller ready | Yes | Language |
| Appointment | Duplicate | One active simulated appointment | Repeat | No error; show existing appointment | N/A | N/A | No | N/A |
| Completion | Too early | All required stages complete | Open/submit | `Complete all required transaction stages before confirming completion.` | Completion panel | Requirements complete | Yes | Legal + language |
| Completion | Buyer confirmation missing | Both required | Finalise | `Waiting for the buyer to confirm completion in demo.` | Status row | Buyer confirms | Yes | Language |
| Completion | Seller confirmation missing | Both required | Finalise | `Waiting for the seller to confirm completion in demo.` | Status row | Seller confirms | Yes | Language |
| Cancellation | Reason missing | Structured reason required | Submit | `Select a cancellation reason.` | Under group | Selected | Yes | Legal + language |
| Cancellation | Already pending | One active request | Request | `A cancellation request is already in progress.` | Panel | Resolve request | Yes | Language |
| Cancellation | Terminal state | Not after completion/cancelled | Request | `Cancellation is not available for this transaction.` | Panel | N/A | Yes | Legal + language |
| Cancellation | Response stale | Current request/version required | Confirm/decline | `The cancellation request has changed. Review the latest status.` | Alert | Refresh | Yes | Security + language |
| Any action | Version conflict | Expected version matches | Mutation | `This transaction has changed. Review the latest status.` | Page alert | Refetch | Yes | Language |
| Upload | Session expired | Active session required | Upload/register | `Your session has expired. Sign in again before uploading.` | Session alert | Sign in | Yes | Security + language |
| Realtime | Stale | Connection unavailable | Connection | `Updates may be delayed. Refresh to check the latest transaction status.` | Banner | Reconnected/refreshed | No | Language |

---

# 39. Responsive Behaviour

## 39.1 Breakpoints

Use the shared Tailwind breakpoints:

- Mobile: below 768 px
- Tablet: 768–1023 px
- Desktop: 1024 px and above

## 39.2 My Transactions

Desktop:

- Max width 1280 px
- Two-column card grid when card content remains readable
- Filter toolbar above grid

Tablet:

- One or two columns based on available width
- Filters may use horizontal scroll only for short chips

Mobile:

- One column
- Filter button opens full-height sheet
- Sort in separate compact sheet
- Property image ratio 4:3

## 39.3 Workspace

Desktop:

- Max width 1320 px
- Main + sticky side panel
- Six-stage horizontal tracker

Tablet:

- One column max 760 px
- Next action directly below tracker
- Horizontal tracker may remain if labels fit; otherwise compact control

Mobile:

- One column
- Compact progress
- Current action before supporting sections
- Sticky bottom action only when actionable
- Timeline and documents stack

## 39.4 Documents

Desktop:

- Buyer and seller checklist summaries may use two equal columns
- Current participant upload controls remain in main column

Mobile:

- Stack checklist rows
- Filename wraps or middle-truncates visually while accessible name remains complete
- Upload progress remains visible
- File actions use labelled buttons, not icon-only controls

## 39.5 Timeline

- Desktop rail at logical start
- Mobile rail compact with 16–20 px inset
- Event body never narrower than 240 px
- No horizontal scroll

## 39.6 Dialogs and sheets

- Desktop dialogs 480–600 px
- Mobile consequential dialogs use bottom sheet or full-screen dialog
- Focus trap and Escape support
- Primary/secondary buttons stack on narrow screens
- Add safe-area bottom inset

## 39.7 Keyboard and touch

- Minimum 44 × 44 px targets
- Primary mobile actions 48 px high
- Native date and file controls remain keyboard accessible
- Sticky bars must not cover the final task or timeline event

---

# 40. Arabic and RTL Behaviour

All Arabic is draft and requires professional review. Legal, financial, property-transfer, cancellation, and simulation terminology requires legal/business review as well.

## 40.1 Mirrors

- Main/side-column placement
- Breadcrumbs
- Progress visual direction
- Timeline rail
- Task icon placement
- Dialog action visual order
- Drawer/sheet origin
- Sticky action alignment
- Directional arrows

## 40.2 Remains LTR

- AED amounts
- Percentages
- Transaction reference
- Dates when numeric-only
- Times
- Filenames
- File extensions
- Opaque identifiers
- English building/project names

Use bidi isolation around every mixed-direction value.

## 40.3 Progress

Arabic stages flow right-to-left visually. Semantic ordered-list reading follows Arabic locale order. Current stage remains explicitly labelled.

## 40.4 Buyer and seller task rows

Rows align to logical start. Buyer/seller distinction is text-based, not left-versus-right placement.

## 40.5 Date field

Label and helper RTL; date value follows browser/localised date behaviour. Stored and validated server-side. Do not force an ambiguous numeric format; use a formatted text confirmation below the input.

## 40.6 Files

- Filename and extension LTR
- Privacy/status copy RTL
- File action buttons follow logical reading order
- Long filenames are visually truncated but available to assistive technology

## 40.7 Confirmation actions

Primary and secondary visual placement mirrors. DOM/tab order follows Arabic reading order while preserving action priority.

## 40.8 Mixed property names

Do not machine-translate registered building names. Wrap them with correct language metadata inside Arabic copy.

---

# 41. Accessibility

Target WCAG 2.2 AA.

## 41.1 Page structure

- One `h1` per route
- Header, navigation, main, complementary, and footer landmarks
- Workspace sections use logical `h2` headings
- Skip link to current transaction task where appropriate

## 41.2 Progress semantics

- Ordered list
- Current stage identified programmatically
- Completed/current/future/blocked text included
- Stage preview button has descriptive name

## 41.3 Task ownership

Screen-reader text includes actor:

> Buyer action required: Confirm demo deposit.

Do not rely on icons or colour.

## 41.4 Forms and validation

- Persistent labels
- Fieldset/legend for radio and checkbox groups
- Helper and error associations
- Error summary on multi-field failure
- Focus moves to summary then linked invalid control

## 41.5 Uploads

- Native file input available
- Drag-and-drop is optional enhancement only
- Progress announced at useful intervals, not every percentage point
- Upload completion/failure announced
- Replace/remove buttons have document-type names

## 41.6 Dialogs

- Focus moves to heading
- Focus trapped
- Escape closes when not processing
- Trigger focus restored
- Consequence and simulation disclosure precede primary action in DOM order

## 41.7 Timeline

- Ordered list
- Complete event sentence
- Date/time semantics
- New event announced politely once

## 41.8 Currency

Accessible label reads complete currency phrase, for example:

> Demo deposit amount, 250 thousand UAE dirhams.

Do not make screen readers read separator punctuation as individual characters.

## 41.9 Realtime

- No announcement for healthy connection
- Meaningful participant/status updates only
- Reconnecting/stale state announced once
- Manual refresh available

## 41.10 Reduced motion

- No confetti
- No animated money transfer
- No pulsing current stage
- No mandatory transition animation
- Respect reduced-motion preference

---

# 42. Security and Privacy Rules

## 42.1 Never expose

- Buyer or seller email/phone
- Full legal identity
- Identity numbers
- Listing ownership documents
- Private verification data
- Other transactions
- Unrelated offer threads or proposals
- Private uploaded files belonging to the other participant
- Storage paths or signed URLs
- Authentication tokens
- Admin notes
- Raw audit events
- Raw failure details
- Internal database IDs in visible copy

## 42.2 Participant projections

Buyer and seller may see:

- Shared immutable transaction facts
- Their perspective and permitted actions
- Other participant’s safe task-completion status
- Shared generated summaries
- Their own private uploaded files
- Safe transaction events

## 42.3 RLS

- Buyer/seller participant reads only
- Participant writes only through authorised server operations or uploader-scoped storage policies
- No anonymous access
- Cross-transaction file and row access denied
- Future Admin access remains separate

## 42.4 Concurrency

Every consequential mutation validates:

- participant identity;
- transaction state;
- current stage/task;
- expected version;
- terminal/cancellation status;
- prerequisites.

## 42.5 Safe unavailable state

Missing and forbidden use the same message. Do not reveal whether an opaque transaction ID exists.

## 42.6 Audit events

Recommended safe events:

- `TRANSACTION_CREATED`
- `TRANSACTION_DETAILS_CONFIRMED`
- `PURCHASE_ROUTE_SELECTED`
- `FINANCING_STATUS_UPDATED`
- `DEMO_DEPOSIT_CONFIRMED`
- `TRANSACTION_DOCUMENT_UPLOADED`
- `TRANSACTION_DOCUMENT_REPLACED`
- `TRANSACTION_DOCUMENT_REMOVED`
- `TRANSACTION_SUMMARY_REVIEWED`
- `DUE_DILIGENCE_SIMULATION_STARTED`
- `DUE_DILIGENCE_SIMULATION_COMPLETED`
- `DUE_DILIGENCE_SIMULATION_FAILED`
- `TRANSFER_DATE_PROPOSED`
- `TRANSFER_READINESS_CONFIRMED`
- `TRANSFER_APPOINTMENT_SIMULATED`
- `TRANSACTION_COMPLETION_CONFIRMED`
- `TRANSACTION_COMPLETED_DEMO`
- `TRANSACTION_CANCELLATION_REQUESTED`
- `TRANSACTION_CANCELLATION_RESOLVED`
- `TRANSACTION_CANCELLED`
- `TRANSACTION_FAILED`
- `TRANSACTION_ACCESS_DENIED`

Never audit file content, raw filenames where avoidable, signed URLs, identity numbers, tokens, or unrestricted text.

---

# 43. Exact English Copy

## 43.1 Handoff and navigation

| Key | English |
|---|---|
| `transaction.continue` | Continue to Transaction |
| `transaction.readyTitle` | Your transaction is ready |
| `transaction.readyBuyerBody` | The accepted offer has moved into the transaction stage. You and the seller can now complete the required demo steps. |
| `transaction.readySellerBody` | The accepted offer has moved into the transaction stage. You and the buyer can now complete the required demo steps. |
| `transaction.preparing` | Preparing your transaction… |
| `transactions.title` | My Transactions |
| `transactions.description` | Track property purchases and sales from accepted offer to demo completion. |
| `transaction.perspective.buying` | You are buying |
| `transaction.perspective.selling` | You are selling |

## 43.2 Status and action ownership

| Key | English |
|---|---|
| `transaction.action.yours` | Your action is required |
| `transaction.waitingBuyer` | Waiting for buyer |
| `transaction.waitingSeller` | Waiting for seller |
| `transaction.waitingBoth` | Action required from both participants |
| `transaction.waitingSystem` | Waiting for demo processing |
| `transaction.noAction` | No action required |
| `transaction.inProgress` | In progress |
| `transaction.blocked` | Blocked |
| `transaction.completedDemo` | Completed in demo |

## 43.3 Stages

| Key | English |
|---|---|
| `stage.confirm` | Confirm transaction |
| `stage.deposit` | Deposit |
| `stage.documents` | Documents |
| `stage.checks` | Demo checks |
| `stage.transfer` | Transfer |
| `stage.completion` | Completion |
| `stage.progress` | Stage {current} of {total} · {stage} |

## 43.4 Confirmation and purchase route

| Key | English |
|---|---|
| `confirmation.title` | Confirm transaction details |
| `confirmation.body` | Review the property and accepted amount before the transaction progresses. |
| `confirmation.checkbox` | I confirm that the property and accepted amount shown are correct for this demo transaction. |
| `confirmation.action` | Confirm transaction details |
| `confirmation.done` | Your details are confirmed |
| `confirmation.issue` | Something looks incorrect |
| `route.title` | How do you plan to purchase this property? |
| `route.help` | This selection is used only to shape the prototype transaction checklist. |
| `route.cash` | Cash purchase |
| `route.financing` | Financing |
| `route.financingDisclosure` | No mortgage application, bank approval, or credit assessment is performed. |
| `financing.notStarted` | Not started |
| `financing.inProgress` | In progress |
| `financing.confirmed` | Confirmed in demo |
| `financing.unable` | Unable to proceed |

## 43.5 Deposit

| Key | English |
|---|---|
| `deposit.title` | Confirm deposit in demo |
| `deposit.body` | Review the demo amount and confirm the step. No real payment will be processed and no funds will be held. |
| `deposit.amount` | Demo deposit amount |
| `deposit.checkbox` | I understand that this is a simulated deposit confirmation and no money will be transferred. |
| `deposit.action` | Confirm demo deposit |
| `deposit.processing` | Confirming demo deposit… |
| `deposit.successTitle` | Deposit confirmed in demo |
| `deposit.successBody` | No real payment has been processed. |

## 43.6 Documents

| Key | English |
|---|---|
| `documents.title` | Transaction documents |
| `documents.privateTitle` | Use fictional sample files only |
| `documents.privateBody` | Do not upload a real Emirates ID, passport, bank statement, mortgage approval, Title Deed, Oqood, or other sensitive document. |
| `documents.upload` | Upload document |
| `documents.replace` | Replace document |
| `documents.remove` | Remove document |
| `documents.uploading` | Uploading… |
| `documents.processing` | Processing in demo |
| `documents.accepted` | Accepted in demo |
| `documents.privateBadge` | Private to you |
| `documents.otherStatus` | The other participant can see only whether this checklist is complete. |
| `documents.missing` | Complete the required document checklist to continue. |

## 43.7 Shared summary and checks

| Key | English |
|---|---|
| `summary.title` | Simulated transaction summary |
| `summary.disclosureTitle` | Document review simulated |
| `summary.disclosureBody` | This is not an official Form F or legally binding agreement. |
| `summary.confirm` | Confirm I reviewed the demo summary |
| `checks.title` | Due-diligence checks simulated |
| `checks.disclosure` | These prototype checks are not legal, financial, structural, title, or regulatory advice. |
| `checks.start` | Start demo checks |
| `checks.running` | Running demo checks… |
| `checks.successTitle` | Due diligence completed in demo |
| `checks.successBody` | The prototype prerequisites are complete. No legal or regulatory clearance has been performed. |
| `checks.blockedTitle` | Demo checks are blocked |
| `checks.retry` | Retry demo checks |

## 43.8 Transfer

| Key | English |
|---|---|
| `transfer.title` | Prepare for transfer |
| `transfer.date` | Preferred transfer date |
| `transfer.dateHelp` | Choose a preferred date for this prototype. No official appointment will be booked. |
| `transfer.buyerReady` | I confirm the buyer tasks are ready for the simulated transfer stage. |
| `transfer.sellerReady` | I confirm the seller tasks are ready for the simulated transfer stage. |
| `transfer.dateWorks` | This date works for me |
| `transfer.notReady` | I am not ready yet |
| `transfer.bothReady` | Both participants are ready |
| `transfer.createAppointment` | Create simulated appointment |
| `transfer.appointmentTitle` | Transfer appointment simulated |
| `transfer.appointmentBody` | No official appointment has been booked. |

## 43.9 Completion

| Key | English |
|---|---|
| `completion.title` | Complete transaction in demo |
| `completion.buyerCheckbox` | I confirm completion of this transaction in the demo. |
| `completion.sellerCheckbox` | I confirm completion of this transaction in the demo. |
| `completion.action` | Confirm completion in demo |
| `completion.waitingBuyer` | Waiting for the buyer to confirm completion in demo. |
| `completion.waitingSeller` | Waiting for the seller to confirm completion in demo. |
| `completion.successTitle` | Transaction completed in demo |
| `completion.successBody` | This prototype has not processed a real payment or official property transfer. |
| `listing.soldDemo` | Sold in demo |

## 43.10 Cancellation and errors

| Key | English |
|---|---|
| `cancellation.request` | Request cancellation |
| `cancellation.title` | Request transaction cancellation? |
| `cancellation.body` | The transaction will stop progressing while the cancellation is confirmed or reviewed. |
| `cancellation.pending` | Cancellation requested |
| `cancellation.confirm` | Confirm cancellation |
| `cancellation.keep` | Keep transaction active |
| `cancellation.cancelledTitle` | Transaction cancelled |
| `cancellation.cancelledBody` | The transaction has stopped. The listing is paused and will not return to the marketplace automatically. |
| `transaction.failedTitle` | This transaction needs review |
| `transaction.failedBody` | Progress is paused because the transaction could not be updated safely. |
| `error.stepTitle` | We could not complete this step |
| `error.stepBody` | Your transaction information has been preserved. Try again or return later. |
| `error.unavailableTitle` | This transaction is not available |
| `error.unavailableBody` | It may no longer exist, or you may not have permission to view it. |
| `error.conflictTitle` | This transaction has changed |
| `error.conflictBody` | Another action was completed before yours. We have refreshed the latest status. |
| `realtime.reconnecting` | Reconnecting to transaction updates… |
| `realtime.stale` | Updates may be delayed. Refresh to check the latest transaction status. |
| `session.expired` | Your session has expired. Sign in again to continue. |

---

# 44. Arabic Copy and Review Flags

**Status:** Draft only. Professional Arabic review is required for all copy. Legal, financial, cancellation, Form F, deposit, due-diligence, and transfer terminology also requires legal/business review.

| English | Draft Arabic | Review |
|---|---|---|
| Continue to Transaction | المتابعة إلى المعاملة | Language + property |
| Your transaction is ready | معاملتك جاهزة | Language |
| My Transactions | معاملاتي | Language |
| You are buying | أنت المشتري في هذه المعاملة | Language |
| You are selling | أنت البائع في هذه المعاملة | Language |
| Your action is required | يتطلب الأمر إجراءً منك | Language |
| Waiting for buyer | بانتظار المشتري | Language |
| Waiting for seller | بانتظار البائع | Language |
| Confirm transaction | تأكيد المعاملة | Legal + language |
| Deposit | الدفعة المقدّمة | Legal + financial |
| Documents | المستندات | Legal + language |
| Demo checks | الفحوصات التجريبية | Legal + language |
| Transfer | نقل الملكية التجريبي | Legal + property |
| Completion | الإكمال التجريبي | Legal + language |
| Confirm transaction details | تأكيد تفاصيل المعاملة | Legal + language |
| Cash purchase | شراء نقدي | Financial |
| Financing | تمويل | Financial |
| Confirm deposit in demo | تأكيد الدفعة المقدّمة في العرض التجريبي | Legal + financial |
| Deposit confirmed in demo | تم تأكيد الدفعة المقدّمة تجريبيًا | Legal + financial |
| Use fictional sample files only | استخدم ملفات تجريبية غير حقيقية فقط | Privacy + language |
| Private to you | خاص بك | Privacy |
| Simulated transaction summary | ملخص المعاملة التجريبي | Legal + language |
| Document review simulated | مراجعة المستندات محاكاة تجريبية | Legal + language |
| Due-diligence checks simulated | فحوصات العناية الواجبة محاكاة تجريبية | Legal + professional language |
| Prepare for transfer | الاستعداد للنقل التجريبي | Legal + property |
| Buyer ready | المشتري جاهز | Language |
| Seller ready | البائع جاهز | Language |
| Transfer appointment simulated | تمت محاكاة موعد النقل | Legal + language |
| Transaction completed in demo | اكتملت المعاملة تجريبيًا | Legal + language |
| Sold in demo | تم البيع تجريبيًا | Legal + property |
| Request cancellation | طلب إلغاء المعاملة | Legal + language |
| Cancellation requested | تم طلب الإلغاء | Legal + language |
| Transaction cancelled | تم إلغاء المعاملة | Legal + language |
| This transaction needs review | تحتاج هذه المعاملة إلى مراجعة | Language |
| This transaction is not available | هذه المعاملة غير متاحة | Security + language |

## 44.1 Draft simulation disclosure

> **محاكاة لعملية المعاملة**  
> لا يعالج هذا النموذج الأولي مدفوعات حقيقية، ولا ينشئ مستندات ملزمة قانونًا، ولا ينفذ نقلًا رسميًا لملكية العقار.

Requires professional legal and Arabic review.

## 44.2 Draft deposit disclosure

> لن تتم معالجة أي دفعة حقيقية ولن يتم الاحتفاظ بأي أموال.

Requires legal and financial review.

## 44.3 Draft Form F disclosure

> هذه ليست استمارة F رسمية ولا اتفاقية ملزمة قانونًا.

Requires UAE property/legal and Arabic review.

---

# 45. Design-to-Engineering Handoff

## 45.1 Screen handoff table

| # | Route/state | Screen | Perspective | Transaction / milestone state | Primary action | Secondary actions | Loading/error/conflict | Transition and events | Privacy and implementation notes |
|---:|---|---|---|---|---|---|---|---|---|
| 1 | Accepted offer | Offer accepted handoff | Buyer/Seller | Accepted, no/ensured transaction | Continue to Transaction | Offers, property | Creation loading/failure | Ensure transaction; `TRANSACTION_CREATED` | No contact details; perspective copy |
| 2 | Handoff loading | Transaction creation loading | Both | Creating | Retry | Offers | Slow/error | Idempotent ensure | No duplicate transaction |
| 3 | Handoff success | Transaction created | Both | INITIATED | Open workspace | Offers | N/A | Notification to both | Safe reference only |
| 4 | `/transactions` | Empty | Customer | None | Browse properties | Offers | Load/error | None | Unified buyer/seller page |
| 5 | `/transactions` | Populated | Customer | Mixed | Continue/View | Filters/sort | Partial failure | None | Cards use participant projection |
| 6 | Card state | Buyer action required | Buyer | Active | Continue | View summary | N/A | None | Badge from task state |
| 7 | Card state | Seller action required | Seller | Active | Continue | View summary | N/A | None | No separate seller dashboard |
| 8 | Card state | Waiting | Both | Active | View progress | None | Realtime stale | None | Explain who is acting |
| 9 | `/transactions/[id]` | Workspace overview | Both | Any active | Current action | Anchors, cancellation | Skeleton/unavailable | Refetch | Server participant guard |
| 10 | Workspace | Progress tracker | Both | Any | Open current | Preview stages | Load/stale | None | Ordered semantics |
| 11 | Workspace | Current milestone | Both | Current stage | Perspective action | None | Task error | Per task | One dominant action |
| 12 | Workspace | Buyer task list | Both | Mixed | Buyer actions | None | Partial load | Task transitions | Seller sees safe status only |
| 13 | Workspace | Seller task list | Both | Mixed | Seller actions | None | Partial load | Task transitions | Buyer sees safe status only |
| 14 | Workspace | Timeline | Both | Any | None | None | Partial load | Realtime refetch | Safe event projection |
| 15 | Confirmation | Buyer confirms details | Buyer | CONFIRMATION | Confirm details | Report issue | Conflict/session | Confirmation event | Immutable amount/property |
| 16 | Confirmation | Seller confirms details | Seller | CONFIRMATION | Confirm details | Report issue | Conflict/session | Confirmation event | Same shared facts |
| 17 | Confirmation | One confirmed | Both | CONFIRMATION | Other participant acts | View progress | Realtime | Notification | No re-edit by confirmer |
| 18 | Confirmation | Both confirmed | Both | CONFIRMATION | Continue/route task | None | State conflict | Stage gate | Purchase route also required |
| 19 | Purchase route | Cash | Buyer | CONFIRMATION | Select/confirm | Change | Validation | Route event | No proof-of-funds upload |
| 20 | Purchase route | Financing | Buyer | CONFIRMATION | Select/confirm | Change | Validation | Route event | No bank integration |
| 21 | Financing | In progress | Buyer | CONFIRMATION/DOCUMENTS | Update status | Cancellation | Error | Financing event | Blocks demo checks until confirmed |
| 22 | Deposit | Simulation overview | Buyer | DEPOSIT, action | Confirm demo deposit | Back | Validation/conflict | Deposit event | Display-only 10% |
| 23 | Deposit | Confirmation dialog | Buyer | DEPOSIT | Confirm | Cancel | Session/stale | Idempotent confirm | No payment UI |
| 24 | Deposit | Confirmed | Both | DEPOSIT complete | Continue | View timeline | N/A | Notify seller | Explicit no-payment copy |
| 25 | Documents | Buyer checklist | Buyer | DOCUMENTS | Upload required file | Replace/remove | Upload errors | File events | Private to buyer |
| 26 | Documents | Seller checklist | Seller | DOCUMENTS | Upload required file | Replace/remove | Upload errors | File events | Private to seller |
| 27 | Upload dialog | Upload document | Uploader | DOCUMENTS | Select/upload | Cancel | Type/size/session | Register document | Fictional warning before picker |
| 28 | File state | Upload processing | Uploader | DOCUMENTS | None | Cancel if safe | Failure | Status event | No raw storage status |
| 29 | File state | Upload failure | Uploader | DOCUMENTS | Retry | Remove | Error | None | Existing file retained on replace failure |
| 30 | File state | Replace document | Uploader | DOCUMENTS | Replace | Keep current | Failure | Replace event | One active file/type |
| 31 | Documents | Private notice | Both | DOCUMENTS | None | Learn more | N/A | None | Other participant sees status only |
| 32 | Documents | Shared status | Other participant | DOCUMENTS | None | Timeline | Realtime | Checklist event | No filename/preview |
| 33 | Shared summary | Simulated MOU/Form F review | Both | DOCUMENTS | Confirm review | Back | Conflict | Review event | Not a legal document |
| 34 | Checks | Due diligence in progress | Both | DUE_DILIGENCE | None | Return later | Processing error | Simulation start | System actor |
| 35 | Checks | Completed in demo | Both | DUE_DILIGENCE complete | Continue | Timeline | N/A | Simulation complete | No clearance claim |
| 36 | Checks | Blocked | Both | DUE_DILIGENCE blocked | Complete missing task | Return later | N/A | None | Links to blockers |
| 37 | Transfer | Preparation | Seller/Buyer | TRANSFER | Perspective action | Cancellation | Validation | Date/readiness events | Date preference only |
| 38 | Transfer | Buyer ready | Buyer | TRANSFER | Confirm readiness | Not ready | Conflict | Readiness event | Change until appointment |
| 39 | Transfer | Seller ready | Seller | TRANSFER | Confirm readiness | Not ready | Conflict | Readiness event | Same |
| 40 | Transfer | Both ready | Both | TRANSFER | Create simulated appointment | None | Duplicate/conflict | Appointment event | Idempotent |
| 41 | Transfer | Appointment simulated | Both | TRANSFER complete | Continue | Timeline | Failure | Notify both | No official booking |
| 42 | Completion | Confirmation overview | Both | COMPLETION | Confirm completion | Cancellation | Incomplete/conflict | Completion confirmation | Disclosure visible |
| 43 | Completion | Completed in demo | Both | COMPLETED_DEMO | Transactions | History/property | N/A | Listing `SOLD_DEMO` | Read-only; no real-sale claim |
| 44 | Cancellation | Request | Buyer/Seller | Non-terminal | Request cancellation | Keep active | Validation | Cancellation event | Structured reason only |
| 45 | Cancellation | Pending | Both | CANCELLATION_PENDING | Other confirms/declines | History | Conflict | Notification | All progress disabled |
| 46 | Cancellation | Confirmed | Other participant | CANCELLATION_PENDING | Confirm cancellation | Keep active | Stale | Resolve request | Consequence summary |
| 47 | Cancellation | Cancelled | Both | CANCELLED | Transactions / Review listing | History | N/A | Listing PAUSED | No auto-republish |
| 48 | Failure | Transaction failed | Both | FAILED | Transactions | History | N/A | Failure event | Future Operations review only |
| 49 | Error | Recoverable step error | Both | Task FAILED | Retry | Return later | Generic safe error | Retry | Preserve data |
| 50 | Error | Unauthorised/unavailable | Unknown | N/A | Transactions | Dashboard | N/A | Access-denied audit | Unified safe copy |
| 51 | Responsive | Mobile workspace | Both | Active | Sticky current action | Menu | Same states | Same | 390×844 minimum target |
| 52 | Responsive | Mobile upload | Uploader | DOCUMENTS | Choose file | Cancel | Upload errors | Same | Safe-area and native picker |
| 53 | Responsive | Mobile deposit | Buyer | DEPOSIT | Confirm | Back | Same | Same | No banking imitation |
| 54 | Localisation | Arabic workspace | Both | Active | Same | Same | Same | Same | Mirrored; amounts/references LTR |
| 55 | Localisation | Arabic checklist | Uploader | DOCUMENTS | Same | Same | Same | Same | Filenames LTR |
| 56 | Localisation | Arabic completion | Both | COMPLETED_DEMO | Transactions | History | Same | Same | Legal copy unapproved |

## 45.2 Requirement labels

Use these labels in Claude Code tasks:

- `[VISUAL]` layout, hierarchy, colour, spacing, responsive presentation
- `[INTERACTION]` focus, dialogs, task actions, uploads, filters
- `[PRODUCT]` unified account, stages, purchase route, cancellation policy
- `[STATE]` transaction/task transitions, actor, listing outcome
- `[SECURITY]` participant authorisation, conflicts, safe routes
- `[PRIVACY]` document visibility, safe participant projections
- `[SIMULATION]` deposit, Form F, due diligence, appointment, completion wording
- `[ACCESSIBILITY]` semantics, keyboard, announcements, focus
- `[I18N]` English/Arabic/RTL and bidi isolation
- `[OPTIONAL]` non-blocking enhancement

---

# 46. Required High-Fidelity Mockups

## Priority P0 — approve before engineering begins

| # | Mockup | View | Perspective | Transaction / milestone | Key interaction | Why approval is required | Engineering must not invent |
|---:|---|---|---|---|---|---|---|
| 1 | Offer accepted handoff | Desktop | Buyer and seller variants | INITIATED | Continue | Connects Week 4 and Week 5 | Copy hierarchy, property summary, disclosure |
| 2 | My Transactions | Desktop | Mixed | Multiple | Filter and continue | Establishes unified buying/selling architecture | Card anatomy, badges, filters |
| 3 | Transaction workspace | Desktop | Buyer | CONFIRMATION | Current action | Core product shell | 8/4 layout, progress, next-action placement |
| 4 | Transaction workspace | Mobile | Buyer | Active | Sticky action | Validates hierarchy at 390 px | Section order, sticky safe area |
| 5 | Progress tracker | Desktop/mobile | Shared | Mixed | Open stage/preview | Central navigation model | Stage states, labels, responsive collapse |
| 6 | Buyer action required | Desktop | Buyer | CONFIRMATION/DEPOSIT | Confirm | Defines actor ownership | Status language and action hierarchy |
| 7 | Seller action required | Desktop | Seller | CONFIRMATION/TRANSFER | Confirm | Validates shared shell variant | Perspective differences |
| 8 | Transaction-details confirmation | Desktop | Buyer | CONFIRMATION | Confirm + report issue | Locks immutable accepted facts | Data grouping and issue treatment |
| 9 | Deposit simulation | Desktop/mobile | Buyer | DEPOSIT | Confirm demo deposit | High simulation/legal risk | No-payment treatment, amount hierarchy |
| 10 | Buyer document checklist | Desktop | Buyer | DOCUMENTS | Upload/replace/remove | Establishes private-document design | Visibility, file states, warnings |
| 11 | Seller document checklist | Desktop | Seller | DOCUMENTS | Upload/status | Ensures coordinated privacy | Other-participant status treatment |
| 12 | Simulated Form F review | Desktop | Both variants | DOCUMENTS | Dual confirmation | Prevents official-contract imitation | Shared summary, disclosure, no signature UI |
| 13 | Due-diligence state | Desktop | Shared | DUE_DILIGENCE | Processing/block/retry | Defines believable simulation | Check states and failure treatment |
| 14 | Transfer preparation | Desktop | Seller/buyer variants | TRANSFER | Date + readiness | Most complex shared stage | Date model, dual readiness, appointment |
| 15 | Completion confirmation | Desktop | Both | COMPLETION | Confirm | Consequential terminal action | Summary, dual confirmation, disclosure |
| 16 | Transaction completed in demo | Desktop | Both | COMPLETED_DEMO | Read-only summary | Defines final product tone | `SOLD_DEMO` wording and actions |
| 17 | Cancellation confirmation | Desktop/mobile | Buyer or seller | Active | Request/confirm | High-consequence branch | Mutual/unilateral explanation, listing outcome |
| 18 | Transaction cancelled | Desktop | Seller/buyer | CANCELLED | Exit/review listing | Defines post-cancellation policy | Paused listing and historical offer treatment |

## Priority P1 — approve during implementation

| # | Mockup | View | Perspective | State | Key interaction | Why | Must not invent |
|---:|---|---|---|---|---|---|---|
| 19 | My Transactions | Mobile | Mixed | Multiple | Filter/card | Mobile navigation and card density | Card content/order |
| 20 | Deposit confirmed | Desktop | Seller | DEPOSIT complete | Waiting/continue | Other-participant view | Amount and no-payment copy |
| 21 | Upload states | Desktop/mobile | Uploader | DOCUMENTS | Progress/error/replace | Upload recovery consistency | File card states |
| 22 | Cancellation pending | Desktop | Other participant | CANCELLATION_PENDING | Confirm/decline | Stops progression safely | Disabled actions and copy |
| 23 | Arabic RTL workspace | Desktop | Buyer | Active | Current action | Most complex RTL shell | Mirroring and amount isolation |
| 24 | Arabic RTL document checklist | Mobile | Seller | DOCUMENTS | Upload | Validates file/bidi handling | Filename direction and controls |

---

# 47. Open Product Decisions

| Decision | Recommendation in this specification | Owner/review |
|---|---|---|
| Transaction creation | Automatic plus idempotent ensure fallback | Engineering/product |
| Overall stage model | Six grouped stages with task records | Product/engineering |
| Demo deposit | Fixed 10%, server-calculated, display-only | Product/legal |
| Purchase route | Cash or Financing; simple status only | Product |
| Required identity sample | Fictional sample required for each participant | Product/privacy |
| Proof of funds | Not required in Week 5 | Product |
| Shared documents | Structured transaction summary only | Legal/privacy |
| Form F terminology | Use simulated summary; no generated official file | Legal/product |
| Due diligence | Prototype prerequisite simulation | Legal/product |
| Preferred transfer date | Seller selects 3–30 days; buyer confirms readiness | Product |
| Completion listing state | `SOLD_DEMO` | Architecture/product |
| Direct sold page | Archival safe `Sold in demo`, excluded from search | Marketplace/product |
| Cancellation before confirmations | Unilateral | Product/legal |
| Cancellation after confirmations | Mutual | Product/legal |
| Cancellation listing state | `PAUSED`, never auto-LIVE | Product |
| Accepted thread after cancellation | Historical accepted; cancelled transaction no longer blocks availability | Architecture |
| Document retention after cancellation | Retain privately for prototype history; deletion policy later | Privacy/legal |
| Arabic wording | Draft only | Professional Arabic + legal |
| Future Operations review | Customer-facing status only; controls in Week 6 | Product |
| Shared demo seed | Not required; use isolated fixtures/factories | Engineering/QA |

---

# 48. Final Acceptance Checklist

## Entry and model

- [ ] Accepted-offer handoff exists
- [ ] Transaction is created automatically and idempotently
- [ ] One transaction exists per accepted thread and proposal
- [ ] Buyer, seller, property, amount, and proposal are immutable
- [ ] Safe user-facing transaction reference exists
- [ ] No shared Week 5 demo seed is required

## Workspace and stages

- [ ] My Transactions supports empty, active, waiting, completed, cancelled, failed, loading, partial-error, and generic-error states
- [ ] Buyer and seller transactions appear in one page
- [ ] Perspective labels say You are buying / You are selling
- [ ] Shared transaction workspace exists
- [ ] Six-stage tracker exists
- [ ] Current stage and next actor are explicit
- [ ] Buyer and seller task lists exist
- [ ] Future and blocked stage previews exist

## Confirmation and purchase route

- [ ] Buyer confirms transaction details
- [ ] Seller confirms transaction details
- [ ] One-participant and both-confirmed states exist
- [ ] Accepted amount cannot be edited
- [ ] Safe issue-report flow exists
- [ ] Cash route exists
- [ ] Financing route and simple demo status exist
- [ ] No mortgage application or bank branding exists

## Deposit

- [ ] Demo deposit is 10% and server-calculated
- [ ] No real payment controls exist
- [ ] Buyer confirms demo deposit
- [ ] Seller waiting and confirmed states exist
- [ ] Duplicate confirmation is idempotent
- [ ] Required no-payment disclosure is visible

## Documents

- [ ] Buyer checklist exists
- [ ] Seller checklist exists
- [ ] Financing document is conditional
- [ ] Fictional-file warning appears before upload
- [ ] PDF/JPG/PNG and 10 MB rules are defined
- [ ] Upload, progress, failure, replace, remove, and accepted-demo states exist
- [ ] Private-to-uploader visibility is enforced
- [ ] Other participant sees completion status only
- [ ] Ownership documents from the listing journey are not exposed
- [ ] Storage paths and signed URLs are not exposed

## Simulated process

- [ ] Simulated transaction summary exists
- [ ] No official Form F or legal signature UI exists
- [ ] Buyer and seller review confirmations exist
- [ ] Due-diligence simulation has in-progress, completed, blocked, failed, and retry states
- [ ] No legal/regulatory clearance claim exists
- [ ] Transfer preferred date exists
- [ ] Buyer readiness exists
- [ ] Seller readiness exists
- [ ] Simulated appointment exists
- [ ] No official booking claim exists

## Completion and listing outcome

- [ ] Buyer completion confirmation exists
- [ ] Seller completion confirmation exists
- [ ] Completion is blocked until prerequisites and both confirmations are complete
- [ ] `Transaction completed in demo` is used
- [ ] No real payment or official transfer claim exists
- [ ] Transaction becomes read-only
- [ ] Listing moves to `SOLD_DEMO`
- [ ] Sold-demo property is excluded from active search
- [ ] Saved-property and archival public treatment are defined
- [ ] Completed listing cannot be republished in Week 5

## Cancellation and failure

- [ ] Buyer and seller may request cancellation before completion
- [ ] Structured reasons only are used
- [ ] Unilateral and mutual stage policies are defined
- [ ] Cancellation pending stops progression
- [ ] Cancellation confirmation/decline exists
- [ ] Cancelled transaction remains read-only
- [ ] Listing becomes `PAUSED`
- [ ] Listing never republishes automatically
- [ ] Old offers remain historical and closed
- [ ] Recoverable step failure exists
- [ ] Terminal transaction failure exists
- [ ] Failure is distinct from cancellation

## Timeline, notifications, and Realtime

- [ ] Structured transaction timeline exists
- [ ] Timeline is not chat-styled
- [ ] Canonical in-app notifications are reused
- [ ] Action badge derives from task state, not unread notifications
- [ ] Notification payloads are safe
- [ ] Realtime triggers authoritative refetch
- [ ] Reconnecting, stale, recovered, and missed-event states exist
- [ ] Duplicate events are handled

## Security and privacy

- [ ] Only buyer, seller, and future authorised Admin may access transaction
- [ ] Anonymous access is denied
- [ ] Cross-transaction access is denied
- [ ] Missing and forbidden use unified safe copy
- [ ] Contact details and legal identities never appear
- [ ] Other participant’s private documents never appear
- [ ] Raw errors, IDs, paths, tokens, audit events, and Admin notes never appear
- [ ] Version conflicts and stale actions fail safely
- [ ] Session expiry requires manual reconfirmation of consequential actions

## Quality

- [ ] Desktop, tablet, and mobile layouts follow this specification
- [ ] English copy catalogue is implemented
- [ ] Arabic draft copy exists and is flagged unapproved
- [ ] RTL mirrors logical layout
- [ ] AED, references, dates, times, and filenames use safe bidi treatment
- [ ] WCAG 2.2 AA requirements are met
- [ ] Progress and task ownership are screen-reader accessible
- [ ] Uploads are keyboard accessible
- [ ] Dialog focus and restoration work
- [ ] Touch targets are at least 44 × 44 px
- [ ] Reduced motion is respected
- [ ] Loading, empty, blocked, failure, conflict, and unavailable states exist
- [ ] Required P0 mockups are approved before engineering invents layout decisions
- [ ] No real payment, escrow, mortgage, legal document, government transfer, chat, or full Admin Portal is included

---

## Final Design Intent

Week 5 should communicate:

> A clear, private, shared view of what happens after an offer is accepted, with each participant always knowing the current stage and next action.

It must not communicate:

- that real money has moved;
- that a binding property agreement exists;
- that official legal or government checks have been completed;
- that property ownership has actually transferred;
- that MARKAZ is acting as a bank, escrow provider, law firm, conveyancer, or government portal.

The final experience should retain the approved Architectural Blue system, spacious property-first composition, precise progress hierarchy, calm task ownership, and visible simulation boundaries across desktop, mobile, English, and Arabic.
