# MARKAZ Home — Design Foundation

**Document status:** Approved working foundation  
**Product:** MARKAZ Home  
**Primary design context:** Desktop web, with responsive mobile behaviour  
**Prototype horizon:** Eight-week polished, deployable prototype  
**Last updated:** 19 July 2026

---

## 1. Purpose of This Document

This document defines the approved product-design foundation for MARKAZ Home before individual screens and flows are designed and handed to Claude Code for implementation.

It consolidates:

- The original MARKAZ Home user stories and workshop requirements
- The narrower prototype scope and updated product decisions
- The approved information architecture
- Customer and Admin navigation
- The visual and design-system direction
- The selected logo concept
- Shared interaction, status, simulation, and responsive patterns
- The authentication screen inventory
- The approved landing-page direction

This is a design-specification document, not an implementation document. It should guide future design decisions and prevent inconsistency as screens are produced.

---

## 2. Product Understanding

MARKAZ Home is a UAE-focused residential property marketplace designed to make buying, selling, offering, and progressing through a property transaction more transparent and understandable.

It is not only a property-listing portal. It combines three connected experiences:

1. **A public property marketplace**
2. **A unified customer workspace**
3. **A separate MARKAZ Operations portal**

The product should help customers understand:

- What is happening
- What they need to do next
- What information is verified or simulated
- What a non-binding offer means
- How the seller can respond
- What happens after a preferred offer is accepted
- Which transaction stages, documents, timelines, and potential costs are coming

### 2.1 Brand meaning

**MARKAZ** — مركز — means **centre, hub, or focal point** in Arabic.

The brand should therefore be positioned as:

> The central place for discovering, listing, offering on, and progressing a UAE property transaction.

“Home” identifies the residential property product. It is not the literal English translation of MARKAZ.

### 2.2 Customer model

There is one authenticated customer type.

Every customer can:

- Browse properties
- Save properties
- Save searches
- Make non-binding offers
- Respond to counter-offers
- Track transactions
- Create property listings
- Manage listings
- Receive and manage offers

**Buyer** and **Seller** are journeys or activities, not separate account types.

The product must not include:

- A Buyer/Seller role-selection screen
- A “Switch to buyer” control
- A “Switch to seller” control
- Separate buyer and seller accounts
- Restrictive role-based customer dashboards

### 2.3 Admin model

MARKAZ Admin / Operations is a separate protected portal.

Admin can:

- Review users
- Review listings
- Review simulated ownership checks
- Manage listing statuses
- Monitor offers
- Monitor transactions
- Advance simulated transaction stages
- Flag operational issues
- Prepare and reset demonstration scenarios

Admin must never appear as an option during customer onboarding.

### 2.4 Core property lifecycle

The main product story is organised around the property:

```text
Draft listing
→ Property details
→ Document upload
→ Simulated ownership verification
→ Listing configuration
→ Optional investment case
→ Simulated Form A
→ Photo upload
→ Simulated Trakheesi
→ Review
→ Demo listing live
→ Buyer discovery
→ Saved property
→ Non-binding offer
→ Seller response / counter-offer
→ Accepted as preferred offer
→ Transaction created
→ MOU
→ Deposit
→ NOC
→ Transfer
→ Handover
→ Demo completion
```

Buyer, Seller, and Admin see different controls and information, but they interact with the same underlying property, offer, and transaction records.

### 2.5 Offers and transactions are separate

An offer must not imply that a purchase has already begun.

- Submitted and countered offers remain in **Offers**
- Offer negotiation remains non-binding
- A transaction is created only when an offer is marked **Accepted as preferred offer**
- The transaction then progresses through MOU, Deposit, NOC, Transfer, and Handover

This distinction must remain clear in navigation, interface copy, status labels, and demonstrations.

---

## 3. Prototype Scope

### 3.1 Included

- Public landing page
- Public property marketplace
- Property search and filtering
- Property details
- Real customer email OTP
- First-time profile setup
- Simulated UAE PASS
- Unified customer dashboard
- Seller listing journey
- Simulated ownership verification
- Listing settings and offer threshold
- Optional investment case
- Simulated Form A
- Photo upload
- Simulated Trakheesi
- Listing review and publication
- Listing management
- Saved properties
- Saved searches
- Simulated alerts
- Simulated MARKAZ Concierge
- Buyer offers
- Seller offer responses
- Counter-offers
- Transaction tracker
- Admin portal
- Demo controls and reset states

### 3.2 Excluded

- MARKAZ Invest
- Fractional property investment
- Rental and tenant journeys
- Premium Managed Service
- External broker portal
- Agent assignment
- Professional photography booking
- Property tours and viewing scheduling
- Real UAE PASS integration
- Real Title Deed or Oqood verification
- Real Form A
- Real Trakheesi
- Real payments or escrow
- Real mortgage applications
- Real NOC
- Real title transfer
- Real property handover
- Real email, SMS, or push notifications other than authentication email OTP

Excluded features must not appear as active navigation items, upsell cards, disabled controls, or unexplained placeholders in the prototype.

---

## 4. Primary UX Principles

### 4.1 One account, multiple intentions

Customers should be presented with actions, not identities:

- Browse properties
- List a property
- Make an offer
- Manage a listing
- Track a transaction

The product should respond to the customer’s current activity without asking them to choose a permanent role.

### 4.2 Property first

Important screens should remain connected to recognisable property context:

- Property image
- Property title
- Building or community
- Price
- Listing or transaction status
- Relevant next step

Avoid dashboards composed primarily of anonymous charts and KPI cards.

### 4.3 Always show the next meaningful action

Status should be paired with a clear explanation and next action.

Avoid:

> Form A pending

Prefer:

> Complete the simulated Form A to continue your listing.

Each active listing, offer, and transaction should have one visually dominant next action.

### 4.4 Transparency before persuasion

Before customers commit to an action, show:

- What the action means
- Whether it is binding or non-binding
- What happens next
- Possible timelines
- Relevant costs or assumptions
- Whether a process is simulated

### 4.5 Plain language first

Technical and investment terminology should be supported by explanations.

Prefer:

> Estimated annual return  
> 7.2%  
> How this is calculated

Avoid presenting unexplained abbreviations as the primary information hierarchy.

### 4.6 Progressive disclosure

Show essential information first and reveal complexity when requested.

Property cards should not attempt to display every available metric. Deeper investment, comparable, document, and transaction information belongs on detailed views.

### 4.7 Believable but unmistakable simulations

Simulation wording should appear where a customer could otherwise misunderstand the legal or operational status.

Use:

- Demo identity verified
- Ownership verification simulated
- Simulated Form A
- Demo permit approved
- Demo listing live
- Non-binding offer
- Accepted as preferred offer
- Demo deposit recorded
- Demo transfer complete

Do not use:

- Official UAE PASS verification
- Legally approved
- Official Trakheesi permit
- Legal Form A signed
- Payment received
- Property purchased
- Official title transfer complete

A restrained **Prototype environment** indicator may appear in the account menu or footer. Simulation labels should not dominate every page.

### 4.8 Preserve intent across authentication

When a signed-out visitor selects an action such as:

- Save property
- Make an offer
- Save search
- List a property

the intended action and destination must be preserved through authentication.

After successful authentication, the customer should return to that activity rather than being sent to a generic dashboard.

### 4.9 Design for demonstration confidence

Every major flow needs reliable:

- Populated states
- Empty states
- Loading states
- Success states
- Failure states
- Expired states
- Completed states

Demo screens should never require a presenter to explain why content is missing or why an action cannot be completed.

### 4.10 Accessible is premium

The product should use:

- Strong colour contrast
- Clear focus states
- Keyboard-accessible controls
- Minimum 44 × 44 pixel touch targets
- Readable body text
- Labels that do not rely on placeholders
- Inline validation with recovery guidance
- Statuses that are not communicated through colour alone
- Reduced-motion support

---

## 5. Information Architecture

```text
MARKAZ Home
│
├── Public
│   ├── Landing
│   ├── Browse Properties
│   └── Property Details
│
├── Customer Authentication
│   ├── Enter Email
│   ├── Verify Email Code
│   ├── First-Time Profile Setup
│   ├── Simulated UAE PASS
│   └── Destination Restoration
│
├── Customer Workspace
│   ├── Dashboard
│   ├── Browse Properties
│   ├── Saved
│   │   ├── Saved Properties
│   │   └── Saved Searches
│   ├── My Listings
│   │   ├── Create Listing
│   │   ├── Listing Progress
│   │   └── Manage Listing
│   ├── Offers
│   │   ├── Made by Me
│   │   └── Received on My Listings
│   ├── Transactions
│   │   └── Transaction Details
│   ├── Notifications
│   └── Account
│
├── Persistent Services
│   └── MARKAZ Concierge
│
└── MARKAZ Operations
    ├── Admin Login
    ├── Overview
    ├── Review Queue
    ├── Users
    ├── Listings
    ├── Offers
    ├── Transactions
    ├── Issues
    └── Demo Controls
```

### 5.1 IA decisions

- Concierge is contextual, not a permanent primary-navigation destination.
- Notifications are a utility destination rather than a primary product section.
- Listing creation starts from a persistent **List a property** action and is managed under **My Listings**.
- Saved properties and saved searches are grouped under **Saved**.
- Offers made and offers received remain inside one Offers section.
- Admin Issues represent operational conditions affecting other entities; “Alerts” is not treated as a standalone business object.

---

## 6. Customer Navigation

### 6.1 Desktop structure

Use a horizontal header rather than a permanent sidebar.

**Primary navigation**

1. Dashboard
2. Browse
3. My Listings
4. Offers
5. Transactions

**Persistent primary action**

> List a property

**Header utilities**

- Saved
- Notifications
- Help / Concierge
- Account avatar

### 6.2 Public header

The public header should include:

- MARKAZ Home logo
- Browse Properties
- How It Works
- For Sellers
- Resources
- About
- Sign in
- List a property

The primary public call to action is **List a property**. Browse remains highly visible in the navigation and hero.

### 6.3 Mobile structure

Use a five-item bottom navigation for authenticated customers:

1. Home
2. Browse
3. Listings
4. Offers
5. Transactions

Keep Saved, Notifications, Concierge, and Account in the top utility area or account sheet.

### 6.4 Offers page structure

Use two tabs:

- Made by me
- Received on my listings

Use counts when useful, but avoid placing large notification badges on every navigation item.

---

## 7. Admin Navigation

Admin uses a persistent left sidebar because it is a denser operations environment.

### 7.1 Primary sections

1. Overview
2. Review Queue
3. Users
4. Listings
5. Offers
6. Transactions
7. Issues
8. Demo Controls

### 7.2 Bottom sidebar utilities

- Admin account
- Environment
- Seed-data version
- Sign out

### 7.3 Review Queue

Review Queue consolidates work requiring intervention:

- Simulated ownership checks
- Listings awaiting review
- Failed or flagged verification states
- Listings requiring publication intervention

### 7.4 Issues

Issues may include:

- Stalled transactions
- Expired offers
- Failed simulation steps
- Flagged listings
- Data inconsistencies

Issues should link back to the affected user, listing, offer, or transaction.

### 7.5 Demo Controls

Demo Controls should be visually separated from ordinary operations.

Supported actions may include:

- Reset complete scenario
- Prepare seller scenario
- Prepare buyer scenario
- Prepare transaction scenario
- Advance demo transaction
- Expire an offer
- Restore seeded data

Reset and destructive actions require:

- Confirmation
- Clear scope
- Explanation of what will change
- Success or failure feedback

---

## 8. Approved Visual Direction

### 8.0 July 2026 CEO direction — scoped supersession

The CEO-directed **Platform Gold** theme supersedes the earlier blue-only rule for
two customer-facing surfaces:

- The public landing page and public marketplace
- Customer authentication and onboarding

These surfaces use an accessible near-black and warm-gold token layer to align
with the wider MARKAZ platform direction. The layer is deliberately scoped at
the public and auth layouts: it does **not** change the authenticated customer
workspace or the Admin / Operations portal. Those surfaces retain the existing
Architectural Blue tokens until a later, explicitly approved migration.

Implementation rules for the scoped theme:

- Gold communicates brand hierarchy, focus, and primary action; it is not used
  for status meaning.
- Warm near-black and charcoal surfaces carry most visual weight.
- Contrast, keyboard focus, RTL, and reduced-motion behavior remain mandatory.
- Existing owned logo artwork may be tone-adjusted in code for this prototype;
  a reviewed gold/light vector export is required before production use.
- Do not import or copy imagery, logos, or proprietary assets from the separate
  MARKAZ platform implementation.
- The semantic token contract remains unchanged so the blue app/admin themes
  and the Platform Gold public/auth theme can coexist.

### 8.1 Direction name

**Architectural Blue — Quiet Editorial Intelligence** (default app/admin theme)

The product combines:

- The warmth and aspiration of premium real estate
- The clarity and precision of a transaction product
- A calm blue brand system
- Strong property imagery
- Editorial public-page typography
- Structured, accessible application UI

### 8.2 Experience by surface

**Public marketplace**

- Most image-led
- Largest editorial typography
- Generous whitespace
- Warmest presentation
- Clear paired journeys for browsing and listing

**Customer workspace**

- More structured and functional
- Sans-serif-first interface
- Property context retained throughout
- Blue used for hierarchy, actions, and active states

**Admin portal**

- Densest surface
- Persistent dark-blue sidebar
- Cooler neutral workspace
- Minimal decorative typography
- Strong tables, queues, filters, and statuses

### 8.3 What to avoid

- Generic AI dashboards
- Neon blue
- Excessive gradients
- Glowing cards
- Glassmorphism
- Unscoped or inaccessible gold-and-black styling
- Large numbers of competing cards
- Oversized border radii
- Decorative charts
- Generic house roofs and keys throughout the interface
- Regional design clichés
- Unnecessary animation

---

## 9. Brand and Logo Direction

### 9.1 Approved working logo

The approved working wordmark is:

> **M + architectural home/arch symbol + RKAZ**

The architectural symbol visually replaces the **A** in MARKAZ.

The logo may be read as:

> M [home symbol] RKAZ

### 9.2 Logo forms

**Primary wordmark**

- Thin geometric letterforms
- Deep architectural blue
- Home/arch icon replacing the A
- Optional small “HOME” descriptor where space allows

**Standalone application mark**

- Layered home/arch symbol
- White linework
- Deep-blue rounded-square background
- Used for favicon, app icon, compact mobile contexts, and branded system moments

### 9.3 Logo usage

Use the full wordmark for:

- Public header
- Auth screens
- Customer desktop header
- Footer
- Major brand moments

Use the standalone mark for:

- Favicon
- Mobile app icon
- Compact mobile header
- Admin collapsed sidebar
- Branded loading state
- Account or environment badge where appropriate

### 9.4 Logo rules

- Preserve clear space equal to at least the icon’s inner doorway width.
- Do not place the wordmark over visually busy photography without a solid or sufficiently opaque surface.
- Do not apply gradients to the wordmark.
- Outside the scoped public/auth Platform Gold theme, do not add gold accents.
- Do not rotate, distort, outline, or animate individual logo paths.
- Keep the application-mark corner radius restrained.
- Maintain consistent spacing between **M**, the symbol, and **RKAZ**.

### 9.5 Production note

The current selected logo is an approved **concept direction**, not a final production asset.

Before production use, it should be recreated as a precise vector asset with:

- Consistent line weight
- Optical spacing
- Balanced symbol width
- Small-size legibility testing
- Light and dark variants
- SVG, PNG, favicon, and app-icon exports

---

## 10. Colour System

Blue is the primary MARKAZ Home app/admin brand colour. Platform Gold is the
scoped public/auth brand layer defined in §8.0.

It should communicate trust, clarity, architecture, and calmness without becoming a generic corporate navy interface.

### 10.1 Brand palette

| Token                               |       Hex | Primary usage                                                    |
| ----------------------------------- | --------: | ---------------------------------------------------------------- |
| Brand 900 — Deep Architectural Blue | `#0F2A44` | Primary text, headers, dark navigation, strong brand moments     |
| Brand 800 — Ocean Ink               | `#163A5A` | Hover states, selected navigation, dark surfaces                 |
| Brand 700 — Clear Blue              | `#1F4E73` | Primary buttons, links, active controls                          |
| Brand 500 — Slate Blue              | `#486A8A` | Secondary icons, charts, supporting emphasis                     |
| Brand 300 — Mist Blue               | `#AFC6DA` | Borders, inactive progress, soft data visualisation              |
| Brand 100 — Pale Blue               | `#EAF2F7` | Informational panels, selected filters, active background states |
| Canvas — Cool Off-White             | `#F6F8FB` | Main page background                                             |
| Surface — White                     | `#FFFFFF` | Cards, forms, modals, content surfaces                           |
| Text — Blue Black                   | `#142332` | Primary body text                                                |
| Text Secondary — Slate              | `#647482` | Supporting copy and metadata                                     |
| Border — Blue Grey                  | `#D9E3EA` | Dividers, input borders, card outlines                           |

### 10.2 Usage proportions

Recommended visual balance:

- 65–75% white and cool off-white
- 15–25% deep and mid blue
- 5–10% pale blue
- Semantic colours only where status meaning is required

Do not fill entire customer dashboards with dark blue. Blue should create hierarchy and confidence rather than visual weight.

### 10.3 Semantic colours

| Meaning                | Direction | Example usage                                |
| ---------------------- | --------- | -------------------------------------------- |
| Success / Complete     | Green     | Demo identity verified, stage completed      |
| Attention / Waiting    | Amber     | Action required, awaiting response           |
| Failure / Blocked      | Red       | Verification failed, destructive actions     |
| Active / Informational | Blue      | In progress, selected, informational         |
| Not started / Disabled | Grey      | Future transaction step, unavailable control |

Every semantic status must include a text label or icon. Colour alone is insufficient.

---

## 11. Typography

Use a two-font system.

### 11.1 Display typography

Use an editorial serif for:

- Landing-page hero
- Major public-page section headings
- Select property-detail headings
- High-impact brand statements

Recommended direction:

- Source Serif 4
- Or a similarly restrained, high-legibility editorial serif

Do not use the serif for:

- Forms
- Small labels
- Tables
- Admin data
- Navigation
- Status chips

### 11.2 Interface typography

Use a clean sans serif for all functional UI.

Recommended direction:

- Manrope
- Inter as a fallback or alternative

Use for:

- Navigation
- Buttons
- Forms
- Property metadata
- Dashboard information
- Tables
- Filters
- Transaction stages
- Admin operations

### 11.3 Suggested desktop scale

| Style          | Size / line-height | Weight  |
| -------------- | ------------------ | ------- |
| Hero display   | 56–68 / 1.05       | 400–500 |
| H1 application | 36–44 / 1.15       | 500–600 |
| H2             | 28–34 / 1.2        | 500–600 |
| H3             | 22–26 / 1.25       | 600     |
| Body large     | 18 / 1.55          | 400     |
| Body           | 16 / 1.55          | 400     |
| Body small     | 14 / 1.45          | 400–500 |
| Label          | 13–14 / 1.3        | 500–600 |
| Caption        | 12 / 1.4           | 500     |

### 11.4 Mobile typography

- Hero: 40–48 pixels
- Application H1: 30–34 pixels
- Body remains at least 16 pixels for primary content
- Avoid reducing functional labels below 12 pixels

---

## 12. Spacing and Layout

### 12.1 Base spacing

Use an eight-point system:

```text
4, 8, 12, 16, 24, 32, 40, 48, 64, 80, 96
```

Four-pixel adjustments may be used for optical alignment, but component spacing should remain systematic.

### 12.2 Desktop grid

- Maximum content width: approximately 1280–1360 pixels
- 12-column grid
- Page gutters: 24–40 pixels depending on viewport
- Column gaps: 20–24 pixels
- Major section spacing: 64–96 pixels on public pages
- Application section spacing: 32–48 pixels

### 12.3 Form width

Forms should not stretch unnecessarily.

Recommended:

- Authentication: 400–480 pixels
- Standard form column: 560–680 pixels
- Listing wizard content: 680–760 pixels
- Review and summary layouts may use a wider two-column structure

### 12.4 Radius

- Inputs: 8–10 pixels
- Buttons: 8–10 pixels
- Cards: 10–12 pixels
- Large image containers: 12–16 pixels
- Status chips: full pill only when semantically appropriate
- App icon: restrained rounded square

Avoid large, soft, template-like radii on every component.

### 12.5 Borders and shadows

- One-pixel blue-grey borders
- Minimal shadows
- Use elevation only for overlays, menus, drawers, sticky panels, and key floating surfaces
- Do not use strong shadow stacks on ordinary cards

---

## 13. Imagery

Property imagery carries much of the product’s emotional and aspirational weight.

Use:

- High-resolution UAE residential property imagery
- Natural daylight
- Neutral colour correction
- Consistent image ratios
- Purposeful crops
- Interior, exterior, view, amenity, and community images
- Recognisable but not repetitive Dubai and UAE contexts

Avoid:

- Oversaturated skies
- Artificial HDR
- Duplicate stock imagery
- Generic luxury close-ups with no property context
- Excessive image mosaics
- Images with embedded text

### 13.1 Recommended ratios

- Property cards: 4:3 or 3:2
- Hero image: wide editorial crop
- Property gallery primary image: 16:9 or wider
- Area cards: approximately 4:3
- Mobile property hero: 4:3 or adaptive portrait-safe crop

---

## 14. Shared Component Direction

The following components should be reusable across flows.

### Navigation and structure

- Public header
- Auth header
- Customer header
- Mobile bottom navigation
- Admin sidebar
- Breadcrumbs
- Page header
- Sticky action bar

### Property

- Property card
- Area card
- Property identity header
- Property mini-summary
- Property gallery
- Price and key-facts row
- Investment metric
- Comparable-property row

### Status and workflow

- Status chip
- Simulation label
- Progress stepper
- Activity timeline
- Next-action panel
- Completion summary
- Locked-stage preview
- Issue banner

### Offers and transactions

- Offer summary card
- Offer comparison row
- Counter-offer panel
- Expiry indicator
- Transaction stage
- Cost breakdown
- Document checklist
- Participant summary

### Forms and files

- Text input
- Select
- Combobox
- Currency input
- Date input
- Radio group
- Checkbox
- File uploader
- Uploaded-document row
- Inline validation
- Review summary
- Confirmation dialog

### Feedback

- Skeleton
- Empty state
- Success state
- Error state
- Toast
- Inline alert
- Modal
- Drawer
- Tooltip
- Help popover

### Concierge

- Floating entry point
- Contextual drawer
- Suggested prompts
- Structured response block
- Source/context notice
- Escalation or unsupported-question state

---

## 15. Status and Simulation Patterns

### 15.1 Status anatomy

A status treatment may include:

1. Icon
2. Short status label
3. Optional explanatory sentence
4. Relevant next action
5. Optional timestamp

Example:

> **Ownership verification simulated**  
> The uploaded title document matches this demo property.  
> Continue to listing settings

### 15.2 Simulation label hierarchy

**Primary status**

Used when simulation changes the meaning of the action:

- Ownership verification simulated
- Simulated Form A complete
- Demo permit approved
- Demo deposit recorded

**Supporting note**

Used where the overall page is simulated but individual controls do not need repeated labels:

> Prototype simulation — no official government verification was performed.

### 15.3 Process status language

Prefer:

- Not started
- Ready to begin
- In progress
- Awaiting your action
- Awaiting buyer response
- Awaiting seller response
- Under review
- Completed
- Expired
- Unsuccessful
- Blocked

Avoid vague labels such as:

- Processing
- Pending
- Done

unless the surrounding context makes the meaning explicit.

---

## 16. Responsive Behaviour

Desktop is the primary stakeholder-demo context, but all important screens must adapt clearly to mobile.

### 16.1 General principles

- Preserve the information hierarchy rather than shrinking the desktop composition.
- Stack columns when comparison is not essential.
- Move secondary actions into menus only when discoverability remains clear.
- Keep primary actions visible or sticky where appropriate.
- Convert large side panels to full-screen sheets or drawers.
- Avoid horizontal scrolling except for explicitly tabular admin data.
- Ensure charts remain readable or replace them with key values on small screens.

### 16.2 Public mobile

- Compact logo lockup
- Menu drawer for secondary public links
- Sign in remains accessible
- Hero image and copy stack
- Search opens as a dedicated filter sheet
- Area cards use horizontal scrolling only when clearly signposted
- List a property remains a strong action

### 16.3 Customer mobile

- Bottom navigation
- Sticky primary actions for offers and listing progression
- Property cards become single-column
- Offer and transaction details stack
- Complex progress trackers become vertical
- Costs and documents use expandable sections

### 16.4 Admin mobile

Admin is desktop-first.

Mobile should support:

- Viewing key issues
- Reviewing entity details
- Performing simple approvals or stage changes

Dense operational tables may become:

- Card-based rows
- Filtered lists
- Horizontal-scroll tables only as a last resort

Demo preparation and bulk reset actions should preferably be performed on desktop.

---

## 17. Authentication Foundation

### 17.1 Approved customer flow

```text
Landing page or gated action
→ Enter email
→ Receive real email OTP
→ Verify email code
→ First-time profile setup, if required
→ Simulated UAE PASS, if required
→ Restore intended destination or open dashboard
```

Returning customers with completed profile and demo identity verification go:

```text
Enter email
→ Verify email code
→ Intended destination or Dashboard
```

### 17.2 Authentication must not include

- Password creation
- Password reset
- SMS OTP
- Buyer/Seller role selection
- Admin role selection

### 17.3 Full customer screen inventory

1. Public landing page
2. Enter email
3. Verify email code
4. Email verified / route determination
5. First-time profile setup
6. Simulated UAE PASS introduction
7. Simulated UAE PASS processing
8. Demo identity verified
9. Customer workspace loading
10. Returning-customer destination restoration
11. Session expired
12. Sign-out confirmation, when unsaved work exists
13. Signed-out confirmation
14. Authentication error states
15. Rate-limit / too-many-attempts state
16. Code-expired state
17. Resend-code success and failure states

### 17.4 Admin authentication

Recommended prototype flow:

1. Admin email entry
2. Email OTP verification
3. Admin-access check
4. Operations portal loading
5. Access denied
6. Session expired
7. Sign out

The same OTP component pattern may be reused, but Admin must remain a separate route and protected experience.

---

## 18. Approved Landing-Page Direction

The landing page is the first visual benchmark for the product.

### 18.1 Primary objective

Help visitors immediately understand that MARKAZ Home offers a clearer way to:

- Browse UAE properties
- List a property
- Understand costs and processes
- Move from discovery to handover with guided visibility

### 18.2 Approved hero direction

**Headline**

> A clearer way to buy and sell property in the UAE.

**Supporting copy**

> Transparent information. Guided processes. Confidence from listing to handover.

**Primary action**

> Browse properties

**Secondary action**

> List a property

### 18.3 Header

Left:

- Approved MARKAZ Home wordmark

Centre:

- Browse Properties
- How It Works
- For Sellers
- Resources
- About

Right:

- Sign in
- List a property

### 18.4 Hero layout

Desktop:

- Editorial headline and actions on the left
- Premium UAE property / skyline image on the right
- Soft transition between content and image
- Search bar overlapping or immediately below the hero

Avoid placing copy directly over a busy image.

### 18.5 Search module

Fields:

- City, community, or building
- Property type
- Price range
- Beds and baths

Primary action:

> Search

The search module should be useful rather than decorative.

### 18.6 Trust strip

Recommended four points:

1. Verified and simulated information
2. Guided transactions
3. Clear costs upfront
4. Built for buyers and sellers

Exact copy should be refined to prevent “verified” from implying official verification.

Preferred first item:

> **Clear property information**  
> Listing details and demo verification states presented transparently.

### 18.7 Popular areas

Initial demonstration locations may include:

- Dubai Marina
- Downtown Dubai
- Palm Jumeirah
- Jumeirah Village Circle
- Business Bay

Each card includes:

- High-quality area image
- Area name
- Available property count
- Clear hover or tap affordance

### 18.8 Why MARKAZ Home

Three value pillars:

**Browse with confidence**

> Compare properties using clear facts, market context, and available investment insights.

**List with clarity**

> Create a property listing through guided steps with visible progress and understandable requirements.

**Track every step**

> Follow offers and transaction milestones from the first response through demo handover.

### 18.9 Footer

Include:

- Compact MARKAZ Home logo
- Product links
- Buyer and seller guides
- Company links
- Terms
- Privacy
- Cookie policy
- UAE region selector

Do not display app-store badges unless an application is genuinely part of the prototype story. For the current web prototype, omit them.

### 18.10 Landing-page implementation constraints

- Use responsive grid and standard CSS layout
- Keep hero effects achievable without complex canvas or 3D work
- Use a stable image asset rather than video
- Ensure the header and search remain keyboard accessible
- Search controls must use real labels
- Do not rely on image-generated text or logo assets in production
- Recreate the approved logo as SVG
- Optimise hero and area imagery for performance

---

## 19. Data Visualisation

Use visualisation only when it helps a customer compare or understand change.

Recommended use cases:

- Price trend
- Asking price versus area average
- Price per square foot comparison
- Transaction-stage distribution in Admin
- Listing activity over time

Rules:

- Use direct labels where possible
- Use restrained blue shades
- Use semantic colours only when they represent meaning
- Always include the underlying key value
- Explain calculation assumptions
- Avoid decorative charts
- Avoid 3D charts
- Avoid showing false precision in simulated data

---

## 20. Motion and Interaction

Motion should confirm:

- A step completed
- A status changed
- A drawer opened
- A file uploaded
- A save succeeded
- A transaction stage advanced

Recommended:

- 150–250 millisecond interface transitions
- Subtle progress changes
- Reduced-motion support
- Skeletons for content loading
- Clear button loading states

Avoid:

- Animated gradients
- Floating cards
- Continuous motion
- Decorative counters
- Complex page transitions
- Confetti for legal or transaction-related actions

---

## 21. Content and Copy Rules

### 21.1 Tone

- Calm
- Direct
- Reassuring
- Transparent
- Human
- Professional
- Non-legalistic

### 21.2 Action labels

Use specific verbs:

- Browse properties
- List a property
- Continue listing
- Review offer
- Make a non-binding offer
- Send counter-offer
- Accept as preferred offer
- View transaction
- Complete simulated Form A
- Upload title document

Avoid:

- Submit
- Proceed
- Continue

when a more precise action label is available.

### 21.3 Confirmation copy

Confirm what happened and what happens next.

Example:

> **Offer sent**  
> Your non-binding offer of AED 2,150,000 has been shared with the seller. We’ll show their response here.

### 21.4 Error copy

Every error should include:

- What happened
- Whether customer data was preserved
- How to recover

Example:

> **We couldn’t verify this code**  
> Check the six digits and try again. Your email and previous progress have been preserved.

---

## 22. Accessibility Baseline

All screens should meet the following design expectations:

- WCAG AA contrast for normal text
- Visible keyboard focus
- Logical tab order
- Semantic heading hierarchy
- Persistent labels for form controls
- Error summary for multi-field forms
- Inline field errors
- Screen-reader-compatible status updates
- Alternative text for property imagery
- Decorative images hidden from assistive technology
- No interaction available only through hover
- Touch targets of at least 44 × 44 pixels
- Reduced-motion support
- Time-limited offer states clearly announced and not dependent only on colour

---

## 23. Handoff Expectations for Future Screens

For every flow, produce:

1. User objective
2. Entry points
3. Flow diagram
4. Screen inventory
5. Screen purpose
6. Information hierarchy
7. Primary and secondary actions
8. Form fields and validation
9. Empty states
10. Loading states
11. Success states
12. Failure states
13. Edge cases
14. Desktop layout
15. Mobile behaviour
16. Exact interface copy
17. Reusable components
18. Notes for Claude Code

For each individual screen, produce:

- A proper visual design
- Exact placement of important elements
- Realistic interface copy
- Component behaviour
- Interaction details
- Responsive notes
- Accessibility notes
- Design rationale
- A clean implementation brief for Claude Code

No implementation code should be produced until the relevant design is approved.

---

## 24. Approved Decisions Summary

The following decisions are now considered locked for the working prototype:

- MARKAZ Home uses a unified customer account.
- Buyer and Seller are activities, not roles.
- Customer authentication uses real email OTP.
- SMS OTP and passwords are excluded.
- UAE PASS is visibly simulated.
- Admin is a separate protected portal.
- Offers and transactions are distinct stages.
- The customer product uses horizontal navigation.
- Admin uses a persistent sidebar.
- Blue remains the default customer-workspace and Admin colour system.
- Public and customer-auth surfaces use the CEO-directed Platform Gold theme (§8.0).
- Both themes share semantic tokens and quiet editorial typography; theme scope
  must remain explicit at the layout boundary.
- The wordmark uses **M + home/arch symbol + RKAZ**.
- The home/arch symbol replaces the A.
- A standalone blue-square application mark is used for compact contexts.
- The public landing page leads with Browse Properties and List a Property.
- The headline direction is: **A clearer way to buy and sell property in the UAE.**
- Desktop is the primary demonstration context.
- All important screens require a clear mobile adaptation.
- Government, legal, financial, and transaction integrations remain simulations.
- Every simulation must be believable without appearing official.

---

## 25. Next Design Phase

The next phase is **Customer Authentication**, designed screen by screen:

1. Landing-page interaction refinement
2. Enter email
3. Verify email code
4. First-time profile setup
5. Simulated UAE PASS
6. Unified customer dashboard
7. Account menu
8. Sign-out states
9. Authentication loading and error states

The first detailed authentication screen to design should be:

> **Enter Email**

It should be designed in the context of the approved landing page and should preserve the customer’s intended action after authentication.
