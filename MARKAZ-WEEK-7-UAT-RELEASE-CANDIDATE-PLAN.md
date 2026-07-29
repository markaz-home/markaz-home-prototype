# MARKAZ Home — Week 7 Full-System Hardening, UAT, and Release Candidate Preparation

**Document type:** Execution plan and acceptance contract
**Target:** Internal UAT release candidate; not production
**Prepared:** 27 July 2026
**Status:** Ready for Week 7 execution
**Primary question:** Does the complete MARKAZ Home prototype work as one coherent, secure, usable system?

## Source baseline and interpretation

This plan treats the final Week reports as the source of truth for completed milestone
work, then reconciles them against the current repository before defining the release
candidate:

- `WEEK-1.md` and final `WEEK-1.5.md`: foundation, email/password authentication,
  six-digit signup verification, link-based recovery, onboarding, RLS, Storage, and
  Realtime.
- `WEEK-2.md`: resumable listing creation through `READY_TO_PUBLISH`.
- Final revised `WEEK-3.md`: publication, public marketplace, saved properties, and
  public-photo compensation.
- Final approved `WEEK-4.md`: offers, immutable negotiation history, single acceptance,
  and derived Under Offer availability.
- Final corrected `WEEK-5.md`: simulated transaction workspace, participant documents,
  completion, and cancellation.
- Final corrected `WEEK-6.md`: separate Admin application, capabilities, controlled
  recovery, private-document access, and immutable audit.
- `CLAUDE.md`, `README.md`, ADR-0001 through ADR-0029, all architecture and design
  specifications, integration notes, current runbooks, and the post-Week-6
  release-readiness audit.

The current working tree contains post-Week-6 work which is not fully represented by the
Week reports: migration `0817` for optional OAuth email, `0818` for UAE PASS Staging
identity linking, `0819` for public-safe permit verification, marketplace/homepage and
BayutAPI POC changes, and broad UI revisions. Week 7 must inventory and freeze these
deltas before testing. The current tree also shows that participant transaction-document
upload/register/remove/signed-URL UI and API are implemented, even though ADR-0023 and the
post-Week-6 audit still describe them as pending. Likewise, listing and marketplace mobile
E2E checks now exist; transaction and Admin mobile depth remain the priority.

No separate file identifiable as the “final technical plan,” and no standalone approved
mockup package, is present in the supplied attachment or repository. Week 7 must not infer
approval from absent artifacts. The Week reports, accepted ADRs, implemented UI, design
specifications, and explicitly approved screenshots are the governing baseline until those
artifacts are supplied.

---

# 1. Executive summary

Week 7 is a release-candidate hardening week, not a feature-design week. It validates the
whole chain:

`Auth and onboarding → listing creation → publication → marketplace → saved properties → offers and negotiation → transaction tracker → Admin operations`

The week has five outcomes:

1. Freeze an exact, reproducible RC baseline from the current post-Week-6 tree.
2. Execute automated regression, security, RLS, Storage, accessibility, localisation,
   mobile, reliability, and performance checks against a clean local stack.
3. Execute the UAT catalogue in this document using isolated records, capturing evidence
   for every result.
4. Fix only defects, integration gaps, misleading copy, test instability, and small
   consistency problems. Any change that expands product capability goes to the backlog.
5. Produce a go/no-go decision backed by `WEEK-7.md`, `RELEASE-CANDIDATE.md`, the UAT
   results, a defect log, and reproducible evidence.

The RC is for controlled prototype UAT. It does not claim production readiness. UAE PASS
Staging, BayutAPI, DLD/Trakheesi/Madmoun, payment, escrow, and legal processes retain their
existing test/simulation boundaries. BayutAPI remains disabled unless a private POC test is
explicitly authorised. UAE PASS production use remains out of scope.

## Entry criteria

- Record the branch, exact commit SHA, Node/pnpm/Docker/Supabase versions, operating
  system, browser versions, and relevant non-secret environment modes.
- Review every dirty/uncommitted post-Week-6 change. Preserve it; either include it
  intentionally in the RC baseline or remove it through its own reviewed change. Never
  use a destructive reset to create the baseline.
- Reconcile the implemented migration chain (`0100` through `0819`, including the
  intentional `0816` numbering gap) with README, CI comments, runbooks, and reports.
- Start a fresh local Supabase stack. If `db reset` hangs, use the documented
  stop-without-backup then fresh-start path.
- Confirm local environment variables point only to loopback services. Tests must abort
  rather than touch a hosted or production database.
- Provision one isolated Admin through the env-driven Admin bootstrap and create all
  customer/domain data per test or through the UI. No shared customer/domain seed.
- Freeze UAT scope, supported browsers/viewports, English/Arabic expectations, and the
  documented UAE PASS Staging test lane.

## Exit criteria

- Every required automated command and every core UAT journey is green on the exact RC
  commit.
- All S0 and S1 defects are closed and independently verified.
- No open Security, RLS, Storage-privacy, data-integrity, or secret-exposure defect remains.
- Any accepted S2 has a documented non-core impact, workaround, owner, due date, and
  product/QA sign-off. S2s cannot be accepted on core journeys.
- Required English, Arabic-key-parity, RTL, mobile, keyboard, screen-reader-basics, and axe
  gates pass.
- Known limitations distinguish implemented behaviour, stale documentation, POC-only
  integrations, Week 8 risks, and production blockers.
- `RELEASE-CANDIDATE.md` identifies one immutable commit as `GO`, `CONDITIONAL GO`, or
  `NO-GO`. `CONDITIONAL GO` is allowed only for explicitly accepted S2/S3 limitations and
  never for a security/privacy/data-integrity issue.

## Recommended five-day execution

| Day | Focus                              | Required outcome                                                                       |
| --- | ---------------------------------- | -------------------------------------------------------------------------------------- |
| 0   | Baseline and source reconciliation | Exact RC candidate, environment manifest, delta inventory, clean-stack proof           |
| 1   | Automated regression and security  | Typecheck/lint/unit/integration/build; RLS/Storage/state suites green                  |
| 2   | Customer and Admin UAT             | Auth, seller, buyer, transaction, Admin core journeys with evidence                    |
| 3   | Quality hardening                  | Arabic/RTL, mobile, keyboard, axe, realtime, network failure, performance observations |
| 4   | Defect closure and rerun           | Fix/verify defects; rerun affected layer plus core regression                          |
| 5   | RC certification                   | Full serial E2E, final evidence pack, known limitations, Week 8 handoff, go/no-go      |

---

# 2. Week 7 scope

## In scope

- Full-system integration testing and cross-feature regression.
- Defect fixes and small hardening changes required to make implemented journeys safe,
  coherent, accessible, localised, reliable, and testable.
- Security-boundary verification at UI, API, SQL/RLS, Storage, projection, notification,
  Realtime, and audit layers.
- State-machine, idempotency, stale-version, two-tab, and concurrent-action tests.
- Loading, empty, error, retry, partial-failure, conflict, and session-expiry states.
- English consistency; EN/AR translation-key parity; explicit Arabic-draft labelling;
  RTL and mixed-direction checks.
- Keyboard, focus, screen-reader-basics, contrast, reduced-motion, touch-target, and axe
  verification.
- Mobile customer and Admin journeys, including upload, sticky actions, dialogs,
  responsive tables/cards, and mobile RTL.
- Baseline performance and reliability observations, obvious N+1/index review, and bundle
  comparison using the existing measurement runbook.
- Stabilising flaky tests without hiding failures or relaxing meaningful assertions.
- Documentation reconciliation, UAT evidence, defect tracking, RC certification, and
  Week 8 risk handoff.
- Regression coverage for accepted post-Week-6 deltas already present in the RC baseline:
  UAE PASS Staging identity linking/off-mode behaviour, the public-safe permit page,
  homepage/search query contracts, and the disabled-by-default BayutAPI POC.

## Change-control rule

A proposed Week 7 change is permitted only when it:

- repairs behaviour already promised by a Week report, accepted ADR, approved design, or
  current intentionally included post-Week-6 delta;
- closes a security, privacy, state, accessibility, localisation, responsive, reliability,
  documentation, or test-evidence gap;
- does not introduce a new role, route family, marketplace capability, offer action,
  transaction milestone, Admin module, external integration, or regulated claim; and
- has a focused regression test and traceable defect ID.

Any change failing that test is deferred to a later product milestone.

## Required Week 7 deliverables

- `WEEK-7.md`
- `RELEASE-CANDIDATE.md`
- completed UAT result register for every scenario in section 5
- defect log with severity/category/status/owner/evidence
- final automated-test and E2E totals, including skips and retries
- security/RLS/Storage, accessibility, mobile/RTL, and performance evidence
- reconciled README, CLAUDE, architecture/ADR supersession notes, and runbooks
- known-limitations register and Week 8 readiness notes

---

# 3. Out of scope

Week 7 must not plan or deliver:

- new marketplace, saved-search, offer, transaction, Admin, analytics, map, chat, contact,
  messaging, or notification-delivery features;
- a new shared demo/UAT seed or permanent fictional scenario database;
- a large visual redesign or brand-system replacement;
- production deployment or infrastructure provisioning;
- real payments, escrow, legal contracts, ownership transfer, DLD, Trakheesi, Madmoun, or
  UAE PASS production integration;
- customer impersonation, an “act as buyer/seller” Admin mode, or additional account
  types;
- a durable job system or production expiry scheduler;
- enabling BayutAPI in public/production environments or treating scraped third-party
  inventory as approved;
- production rate limiting, backup/PITR, monitoring/alerting, secret rotation, email-domain
  operations, RDS topology validation, or incident-response implementation. These are Week
  8 gates;
- professional Arabic legal/compliance approval. Week 7 verifies key parity, quality
  mechanics, layout, and the visibility of the draft/unreviewed status.

---

# 4. Workstreams

## WS0 — RC baseline, environment, and source reconciliation

**Objective:** Make every result attributable to one reproducible candidate.

**Actions**

1. Record git SHA and worktree state before any hardening change.
2. Create a post-Week-6 delta matrix covering migrations `0817`–`0819`, UAE PASS
   identity-step changes, public permit verification, homepage/search changes, BayutAPI,
   current UI revisions, and associated tests.
3. Reconcile contradictions:
   - auth is email/password; the six-digit code verifies signup only; recovery is a link;
   - no customer/domain demo seed exists;
   - transaction upload is implemented in the current tree, despite stale ADR-0023 text;
   - migration-chain labels must end at the actual highest included migration;
   - Admin key counts must be measured rather than copied from stale reports;
   - mobile E2E coverage must distinguish listing/marketplace coverage from remaining
     transaction/Admin gaps;
   - current UAE PASS identity-step behaviour supersedes legacy customer-facing simulation
     controls when included in the RC.
4. Capture a fresh-stack migration log and schema sanity report.
5. Make external modes explicit: BayutAPI disabled by default; UAE PASS Staging only in a
   separate manual POC lane; all regulated listing/transaction services remain simulated.

**Gate:** No testing begins until the exact candidate and expected behaviours are recorded.

## WS1 — Full journey regression

**Objective:** Prove that milestone-complete features compose into coherent journeys.

**Actions**

- Run the five core journeys: new account/onboarding gate, seller draft-to-LIVE, buyer
  save/offer/negotiation, accepted-offer-to-completion/cancellation, and Admin
  oversight/recovery.
- Validate transition handoffs, navigation, notifications, badges, return URLs, ownership
  perspective, and user-facing state labels.
- Test both happy paths and at least one recoverable failure at each integration boundary:
  auth email, uploads, verification simulations, publication photo preparation, offer
  mutation, transaction action, Admin action, and Realtime reconnect.
- Confirm no page depends on another test's data and every route has intentional loading,
  empty, error, and not-available behaviour.

**Evidence:** Browser traces/screenshots, record references, relevant DB state snapshots,
and matching audit-event identifiers.

## WS2 — Security and privacy

**Objective:** Re-prove database-first access control and minimal public/private projections.

**Actions**

- Exercise anon, Customer A, Customer B, owner, buyer, seller, unrelated customer, restricted
  customer, and Admin matrices at UI, tRPC, direct SQL/RLS, Storage, and Realtime layers.
- Verify every customer/admin resolver uses the RLS-scoped transaction and `ctx.tx`.
- Verify Security Definer functions derive `auth.uid()` and refuse forged actors/states.
- Diff public, buyer, seller, transaction, notification, and Admin DTOs against explicit
  allowlists. Search output and logs for secrets, private UUIDs, paths, tokens, callback
  codes, provider metadata, seller threshold, contact data, and raw errors.
- Verify signed URL purpose, lifetime, expiry, uploader/Admin scope, and audit lifecycle.
- Confirm customer app has no Admin route/nav/bundle surface; customer sessions receive no
  Admin data; Admin cannot impersonate or author customer artifacts.

**Gate:** Any reproducible unauthorised read/write, secret/path exposure, audit tampering,
or customer-to-Admin escalation is S0 and stops RC work.

## WS3 — State-machine integrity

**Objective:** Ensure server state remains authoritative under retries, stale clients, and races.

**Actions**

- Build transition tables from listing, publication, offer, proposal, transaction/task, and
  Admin recovery ADRs.
- Test valid and invalid transitions, idempotent retries, version conflicts, two-tab actions,
  simultaneous accepts, simultaneous transaction creation, completion/cancellation races,
  pause/resume conflicts, and stale publication review.
- Verify immutable identity, amount, proposal history, public ID, and audit history.
- Verify terminal outcomes and derived states: Under Offer is derived, completion produces
  `SOLD_DEMO`, cancellation produces `PAUSED`, and no cancellation auto-republishes.
- Verify fault-injection compensation for public-photo preparation and database-transition
  failure.

**Evidence:** Integration assertions plus before/after row counts, versions, status/task
snapshots, object lists, and audit events.

## WS4 — UX consistency

**Objective:** Make the implemented product feel like one system without redesigning it.

**Actions**

- Audit customer/public and Admin navigation, headings, button verbs, status/badge language,
  empty/loading/error/conflict states, confirmations, success banners, timelines, and
  simulation disclosures.
- Ensure raw enums and raw backend errors never render.
- Standardise AED, dates, references, mixed-language names, safe not-available copy, and
  reason-code labels.
- Confirm destructive/controlled actions use dialogs, explicit impact copy, no hidden default
  reason, disabled/double-submit protection, and focus restoration.
- Compare core screens to the approved Architectural Blue token foundation and available
  approved screenshots; log polish separately from functional defects.

**Gate:** A misleading legal/payment/identity claim is at least S1; a cosmetic mismatch is
S4 unless it hides state or action.

## WS5 — Arabic, RTL, and localisation

**Objective:** Verify complete mechanical localisation and usable RTL while preserving the
unreviewed-copy warning.

**Actions**

- Flatten and compare every EN/AR key; fail on missing/extra keys.
- Scan user-facing TS/TSX for new hardcoded English; review safe exceptions such as ARIA
  technical tokens, provider names, and immutable references.
- Execute core customer and Admin journeys under `ar` at desktop and mobile widths.
- Check logical alignment, mirrored navigation/chevrons, tables-to-cards, timelines, progress,
  dialogs, pagination, upload controls, mixed names, long text, and wrapping.
- Keep AED values, dates where specified, references, email, file names, and IDs readable in
  LTR islands.
- Make “Arabic is draft/unreviewed” visible in UAT documentation and any reviewer-facing
  context. Do not call the Arabic copy approved.

## WS6 — Accessibility

**Objective:** Meet a practical WCAG 2.2 AA prototype bar across all core journeys.

**Actions**

- Keyboard-only passes for auth, listing wizard, marketplace, offer negotiation, transaction
  workspace, Admin search, publication review, and controlled actions.
- Validate skip links, landmarks, heading order, form labels/instructions/errors, live regions,
  progress/timeline/list semantics, table captions, status text+icon, focus traps/restoration,
  touch targets, contrast, and reduced motion.
- Run axe with WCAG 2 A/AA tags on the required route matrix in both apps. Axe is necessary
  but not sufficient; perform VoiceOver or equivalent screen-reader smoke tests.
- Test upload controls with keyboard and error announcement; test Realtime reconnect banners
  without noisy repeated announcements.

**Gate:** Zero serious/critical axe findings on required pages. Keyboard traps, inaccessible
core controls, or missing critical status/error announcements are S1.

## WS7 — Mobile and responsive

**Objective:** Prove core journeys at small widths rather than relying on code review.

**Actions**

- Test representative 320, 375, 390, 430, 768, and desktop widths, with at least one real
  mobile-browser smoke test where available.
- Cover authenticated shell, homepage/search, marketplace cards/detail, listing wizard and
  uploads, offer thread/actions, transaction tracker/sticky action/upload, and Admin
  table-to-card/search/dialog/publication flows.
- Verify safe-area padding, no horizontal document scroll, no clipped overlays, sticky actions
  not obscuring content, 44×44 CSS-pixel minimum targets, virtual keyboard behaviour, and
  portrait/landscape resilience.
- Repeat critical screens in mobile RTL.

## WS8 — Performance and reliability

**Objective:** Establish a repeatable prototype baseline and close obvious regressions.

**Actions**

- Use production builds for measurement; record cold/warm navigation and API/query timing.
- Exercise marketplace/admin pagination and search with enough isolated fixtures to reveal
  unbounded queries, N+1 patterns, or missing indexes.
- Capture slow-request logs and `pg_stat_statements` evidence per the measurement runbook.
- Run bundle analysis and compare route chunks to the baseline; investigate unexpected growth
  or duplicated heavy dependencies.
- Test offline/slow network, rejected upload, provider timeout, Realtime disconnect/reconnect,
  expired session, duplicate submit, refresh during mutation, and retry behaviour.
- BayutAPI must fail closed within its five-second timeout, reveal no key/raw payload, and leave
  internal marketplace/homepage usable.

**Provisional observation targets:** Core local API reads should normally remain below 500 ms
warm; no single avoidable query should dominate the trace; no unbounded list may be returned;
public/customer/Admin pages should avoid layout shifts and unintentional duplicate fetching.
Where Lighthouse is used, record LCP, INP, and CLS rather than claiming production SLA. A
regression over 20% from the frozen local baseline requires explanation or a defect.

## WS9 — Documentation and release candidate

**Objective:** Make the RC reproducible and its limitations unambiguous.

**Actions**

- Update README, CLAUDE, architecture notes, ADR supersession/status notes, and runbooks only
  where current implementation has made them false or incomplete.
- Document the fresh-stack workaround in the database-reset runbook and serial E2E guidance
  for constrained Docker hosts.
- Record exact totals, skips, retries, flaky-test disposition, browser/viewports, and evidence
  locations. A skipped integration/E2E test is never reported as a pass.
- Produce `WEEK-7.md`, `RELEASE-CANDIDATE.md`, defect log, UAT results, known limitations,
  and Week 8 handoff.

---

# 5. UAT scenario catalogue

## Catalogue conventions

- **Perspectives:** `ANON`, `CUSTOMER-SELLER`, `CUSTOMER-BUYER`,
  `CUSTOMER-OTHER`, `RESTRICTED-CUSTOMER`, and `ADMIN`. Buyer/Seller are
  perspectives of a `CUSTOMER`, never account roles.
- **Fixture IDs:** use a unique run prefix such as `uat-<date>-<run>-<scenario>`. Emails,
  listings, offers, files, and references must be unique to the scenario.
- **Evidence minimum:** result status, RC SHA, browser/viewport/locale, timestamp, screenshot
  or trace, relevant public/opaque reference, and DB/audit assertion where the scenario changes
  state. Never capture passwords, tokens, callback codes, signed URLs, Storage paths, or real
  identity documents.
- **Result values:** `PASS`, `FAIL`, `BLOCKED`, or `NOT RUN`. Only `PASS` counts toward RC.
- **Severity:** the listed value is the default if the expected result fails; privacy or
  corruption can raise it.

## Customer authentication and onboarding

### UAT-01 — New customer signs up and verifies email

| Field                    | Detail                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User role or perspective | New `CUSTOMER`                                                                                                                                                                                                                                                                                                                                                                              |
| Preconditions            | Fresh local stack; Mailpit reachable; email/password signup enabled; no account exists for the generated email. Record whether UAE PASS mode is off or Staging.                                                                                                                                                                                                                             |
| Test data setup          | Generate `uat-01-<run>@example.test`; policy-compliant unique password held only by the tester; fictional full name; accept Terms and Privacy.                                                                                                                                                                                                                                              |
| Steps                    | Open `/en/sign-up`; complete the form; submit once; confirm the verify-email screen; retrieve the newest six-digit **signup** code from Mailpit; enter it through the six-cell logical input; submit; attempt reuse of the code; observe the next onboarding destination.                                                                                                                   |
| Expected result          | One CUSTOMER/profile is created; safe duplicate-submit behaviour; email is verified; code reuse fails safely; no code/token appears in app logs or URLs; routing reaches the current authoritative next gate (UAE PASS identity step or profile fallback), never Admin. With Staging off, the identity step shows configuration-unavailable/sign-out—not legacy demo verification controls. |
| Evidence to capture      | Signup/verification screenshots, Mailpit message ID only, final route, redacted profile status, audit event types, and log-secret scan.                                                                                                                                                                                                                                                     |
| Severity if failed       | S1; S0 if account type, token, or cross-account data is exposed.                                                                                                                                                                                                                                                                                                                            |
| Notes                    | This scenario does not require a real UAE PASS round trip. Downstream UAT uses isolated completed-profile fixtures when Staging is unavailable.                                                                                                                                                                                                                                             |

### UAT-02 — Returning customer signs in

| Field                    | Detail                                                                                                                                                                                                                                                                          |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User role or perspective | Verified `CUSTOMER`                                                                                                                                                                                                                                                             |
| Preconditions            | Isolated verified customer with completed onboarding status; signed out.                                                                                                                                                                                                        |
| Test data setup          | Provision through the normal helper or prior UI flow; do not reuse UAT-01 if scenario isolation would be lost.                                                                                                                                                                  |
| Steps                    | Open `/en/sign-in`; submit a wrong password; then correct credentials; refresh; open a protected route; sign out; use Back and revisit the protected URL.                                                                                                                       |
| Expected result          | Wrong credentials show one generic anti-enumerating message; correct login establishes secure-cookie session and routes to the authoritative destination; refresh retains session; sign-out invalidates access; Back/protected navigation cannot reveal cached private content. |
| Evidence to capture      | Error/success screenshots, destination, cookie-attribute inspection without values, sign-out redirect, protected-route response.                                                                                                                                                |
| Severity if failed       | S1; S0 if private content remains accessible after sign-out.                                                                                                                                                                                                                    |
| Notes                    | Verify there is no buyer/seller role choice.                                                                                                                                                                                                                                    |

### UAT-03 — Customer recovers password

| Field                    | Detail                                                                                                                                                                                                                                                              |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User role or perspective | Existing verified `CUSTOMER`                                                                                                                                                                                                                                        |
| Preconditions            | Customer is signed out; Mailpit reachable.                                                                                                                                                                                                                          |
| Test data setup          | Unique account plus new compliant password; do not record passwords in evidence.                                                                                                                                                                                    |
| Steps                    | Submit Forgot Password for an existing address and separately for a nonexistent address; compare UI; open the existing account’s recovery **link** from Mailpit; set the new password; try direct reset route, link reuse, old password, then new password.         |
| Expected result          | Both requests show identical generic copy; recovery uses a link, never a code field; invalid/reused/direct access shows safe invalid-link state; successful reset signs the user out; old password fails and new password succeeds. No token is logged or captured. |
| Evidence to capture      | Generic message comparison, redacted recovery message ID, reset-success screen, sign-in outcomes, secret scan.                                                                                                                                                      |
| Severity if failed       | S1; S0 for enumeration, token leakage, or reset without a valid recovery session.                                                                                                                                                                                   |
| Notes                    | Confirm max-128 and complexity validation on the reset form.                                                                                                                                                                                                        |

### UAT-04 — Customer cannot access Admin application

| Field                    | Detail                                                                                                                                                                                                              |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User role or perspective | Authenticated `CUSTOMER`                                                                                                                                                                                            |
| Preconditions            | Both apps running; Customer session available; no Admin session.                                                                                                                                                    |
| Test data setup          | Isolated verified customer.                                                                                                                                                                                         |
| Steps                    | Navigate directly to Admin `/en/overview`, list/detail routes, and Admin tRPC endpoints; attempt to reuse customer credentials on Admin login; inspect customer-app navigation and route inventory.                 |
| Expected result          | Admin app displays access denied or login according to session boundary; Admin API returns forbidden/not available with no data; customer app contains no Admin nav or route; no account-type mutation is possible. |
| Evidence to capture      | Admin denial screenshot, network response codes/shapes, route/nav inspection, RLS/API assertion, `ADMIN_ACCESS_DENIED` audit type if applicable.                                                                    |
| Severity if failed       | S0.                                                                                                                                                                                                                 |
| Notes                    | Run the currently intentionally skipped cross-app Playwright check in a two-app environment and remove the permanent skip if the harness now supports it.                                                           |

## Listing creation

### UAT-05 — Customer creates a listing draft

| Field                    | Detail                                                                                                                                                                                                            |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User role or perspective | `CUSTOMER-SELLER`                                                                                                                                                                                                 |
| Preconditions            | Completed customer session; no recent empty draft for this fixture.                                                                                                                                               |
| Test data setup          | Unique Dubai fictional property details and private unit identifier.                                                                                                                                              |
| Steps                    | Choose Sell/Create listing; exercise preflight; create draft; refresh and leave; return through My Listings; open the canonical draft URL.                                                                        |
| Expected result          | Exactly one owned `DRAFT` is created; resumption opens the authoritative next step; no duplicate empty drafts appear; other customers and anon cannot read it; private unit value never enters a public response. |
| Evidence to capture      | Draft/resumption screenshots, row count/state/version, owner/cross-user/anon access assertions.                                                                                                                   |
| Severity if failed       | S1; S0 for cross-customer exposure.                                                                                                                                                                               |
| Notes                    | Verify the same CUSTOMER can also browse/buy without a mode switch.                                                                                                                                               |

### UAT-06 — Customer uploads ownership document

| Field                    | Detail                                                                                                                                                                                           |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| User role or perspective | `CUSTOMER-SELLER`                                                                                                                                                                                |
| Preconditions            | Owned draft at ownership step; private bucket available.                                                                                                                                         |
| Test data setup          | Fictional PDF or allowed image within size limit; invalid MIME and oversize files for negative checks.                                                                                           |
| Steps                    | Keyboard-select valid file; upload; refresh; inspect own metadata; try invalid MIME/oversize; as another customer and anon attempt row/object access.                                            |
| Expected result          | Valid file uploads only to the owner-scoped key and private bucket; UI shows safe success metadata, not path; invalid files fail clearly; other/anon access is denied; no public URL is created. |
| Evidence to capture      | Upload success/error states, bucket/object count with path redacted, RLS/Storage denial results.                                                                                                 |
| Severity if failed       | S0 for unauthorised access/public URL; otherwise S1.                                                                                                                                             |
| Notes                    | Use fictional content only; delete it during fixture teardown.                                                                                                                                   |

### UAT-07 — Ownership verification simulation passes

| Field                    | Detail                                                                                                                                                                                          |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User role or perspective | `CUSTOMER-SELLER`                                                                                                                                                                               |
| Preconditions            | Ownership document registered; listing in valid step state.                                                                                                                                     |
| Test data setup          | Scenario-owned listing; default success simulation.                                                                                                                                             |
| Steps                    | Start verification; observe pending; refresh/poll; reach success; invoke resolve/start again; attempt to submit a client-forged status.                                                         |
| Expected result          | Pending and `VERIFIED_DEMO` are persisted; copy clearly says simulated and does not imply DLD/government verification; retry is idempotent; forged status is rejected; safe audit events exist. |
| Evidence to capture      | Pending/success screens, verification row, idempotency row counts, audit types, rejected-forgery assertion.                                                                                     |
| Severity if failed       | S1; S0 if the client can forge verified status.                                                                                                                                                 |
| Notes                    | Also run the recoverable failure path in the state-machine suite.                                                                                                                               |

### UAT-08 — Customer completes listing settings

| Field                    | Detail                                                                                                                                                                                            |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User role or perspective | `CUSTOMER-SELLER`                                                                                                                                                                                 |
| Preconditions            | Listing has required prior sections available.                                                                                                                                                    |
| Test data setup          | Asking price, optional seller-private notification threshold, visibility settings.                                                                                                                |
| Steps                    | Enter valid values; test boundary/invalid values; save; refresh; inspect owner view and public/buyer projections.                                                                                 |
| Expected result          | Valid settings persist with version bump; validation is clear; threshold stays seller-private and absent from public/buyer DTOs; AED formatting is consistent; stale save produces safe conflict. |
| Evidence to capture      | Settings/validation screenshots, redacted owner DTO and public/buyer projection diffs, version.                                                                                                   |
| Severity if failed       | S1; S0 if private threshold leaks.                                                                                                                                                                |
| Notes                    | Do not confuse threshold with an offer eligibility minimum.                                                                                                                                       |

### UAT-09 — Customer uploads and orders photos

| Field                    | Detail                                                                                                                                                                                                                             |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User role or perspective | `CUSTOMER-SELLER`                                                                                                                                                                                                                  |
| Preconditions            | Owned draft; draft-photo bucket available.                                                                                                                                                                                         |
| Test data setup          | Several fictional JPG/PNG files, including one invalid/oversize file.                                                                                                                                                              |
| Steps                    | Upload valid photos; observe progress; test invalid file; reorder; set cover; refresh; remove one; attempt cross-user and anonymous access.                                                                                        |
| Expected result          | Draft photos remain private, order/cover persist, invalid upload is recoverable, removed record/object is handled consistently, signed draft URLs are owner-scoped and short-lived, and no `public_path` can be customer-supplied. |
| Evidence to capture      | Gallery states, ordered photo/cover rows, Storage policy denials, signed-URL expiry evidence with URL redacted.                                                                                                                    |
| Severity if failed       | S0 for private-photo exposure or customer public-path write; otherwise S1.                                                                                                                                                         |
| Notes                    | Publication promotion is tested separately.                                                                                                                                                                                        |

### UAT-10 — Customer reaches `READY_TO_PUBLISH`

| Field                    | Detail                                                                                                                                                                                                                                                                       |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User role or perspective | `CUSTOMER-SELLER`                                                                                                                                                                                                                                                            |
| Preconditions            | All required details, ownership, verification, price, photos/cover, Form A, and permit simulation complete; investment case may be absent.                                                                                                                                   |
| Test data setup          | One complete scenario listing and one deliberately incomplete listing.                                                                                                                                                                                                       |
| Steps                    | Review readiness checklist; attempt mark-ready on incomplete listing; repair it; mark ready; refresh and revisit completed steps.                                                                                                                                            |
| Expected result          | Server—not the client—rejects incomplete readiness; complete listing transitions once to `READY_TO_PUBLISH`; optional investment does not block; future steps remain locked until prerequisites; edits that invalidate readiness are handled according to the state machine. |
| Evidence to capture      | Incomplete and complete checklists, server response, final state/version, audit event.                                                                                                                                                                                       |
| Severity if failed       | S1.                                                                                                                                                                                                                                                                          |
| Notes                    | Include current public-safe permit/QR data in the completeness check if `0819` is in the RC.                                                                                                                                                                                 |

## Publication and marketplace

### UAT-11 — Customer submits listing for publication

| Field                    | Detail                                                                                                                                                                                               |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User role or perspective | `CUSTOMER-SELLER`                                                                                                                                                                                    |
| Preconditions            | Owned `READY_TO_PUBLISH` listing with complete publication checklist.                                                                                                                                |
| Test data setup          | Unique listing with at least two photos and verified demo permit.                                                                                                                                    |
| Steps                    | Review disclosure/checklist; submit; double-click/repeat request; refresh; inspect seller and Admin queue.                                                                                           |
| Expected result          | One active `PENDING` publication request is created; duplicate submit is idempotent; listing remains non-public; request appears only to owner/Admin; safe simulation wording and audit event exist. |
| Evidence to capture      | Submit/pending screenshots, active-request count, anon marketplace absence, Admin queue item, audit event.                                                                                           |
| Severity if failed       | S1; S0 if non-LIVE data is public.                                                                                                                                                                   |
| Notes                    | Do not call the review regulatory approval.                                                                                                                                                          |

### UAT-12 — Listing becomes `LIVE` after approved flow

| Field                    | Detail                                                                                                                                                                                                                                             |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User role or perspective | `ADMIN` reviewer and `CUSTOMER-SELLER` observer                                                                                                                                                                                                    |
| Preconditions            | One pending, still-eligible publication request.                                                                                                                                                                                                   |
| Test data setup          | Scenario request with deterministic public ID/photo keys.                                                                                                                                                                                          |
| Steps                    | Admin approves through the controlled review; wait/refetch seller state; open public detail anonymously; repeat resolve; verify public objects and projection.                                                                                     |
| Expected result          | Phase-one photos are prepared and verified; one atomic DB transition marks request `APPROVED_DEMO` and listing `LIVE`; stable public ID/slug exists; repeat is a no-op; only allowlisted fields/public photos appear; matching audit events exist. |
| Evidence to capture      | Admin approval, seller LIVE state, public page, request/listing versions, object count/keys redacted, public DTO diff, audit chain.                                                                                                                |
| Severity if failed       | S1; S0 for partial public exposure/private data leak or duplicate public objects causing corruption.                                                                                                                                               |
| Notes                    | Fault and compensation are covered in section 7, not manually injected into this happy path.                                                                                                                                                       |

### UAT-13 — Anonymous user browses marketplace

| Field                    | Detail                                                                                                                                                                                                                                                                 |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User role or perspective | `ANON`                                                                                                                                                                                                                                                                 |
| Preconditions            | At least two scenario `LIVE` listings plus non-LIVE controls.                                                                                                                                                                                                          |
| Test data setup          | Distinct community/type/bed/price values; one paused and one sold control.                                                                                                                                                                                             |
| Steps                    | Open homepage and `/en/properties`; search/filter/sort/paginate; open detail; change query in URL; inspect public responses.                                                                                                                                           |
| Expected result          | Only `LIVE` listings with public IDs appear; canonical query keys survive navigation; filtering/sorting/pagination are correct; detail shows public allowlist only; no owner UUID/unit/document/private investment inputs; empty/error/loading states are intentional. |
| Evidence to capture      | Browse/detail screenshots, URLs, result counts/order, public projection allowlist assertion.                                                                                                                                                                           |
| Severity if failed       | S1; S0 for private/non-LIVE disclosure.                                                                                                                                                                                                                                |
| Notes                    | External POC results, if enabled privately, must be a separate labelled section with no Save/Offer controls.                                                                                                                                                           |

### UAT-14 — Authenticated customer saves property

| Field                    | Detail                                                                                                                                                                                                                           |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User role or perspective | `CUSTOMER-BUYER`                                                                                                                                                                                                                 |
| Preconditions            | Buyer is not listing owner; listing is `LIVE`.                                                                                                                                                                                   |
| Test data setup          | Unique buyer and seller/listing.                                                                                                                                                                                                 |
| Steps                    | Save from card/detail; repeat; open Saved Properties; unsave; repeat; refresh. Also test anonymous Save → sign-in → safe return/intention.                                                                                       |
| Expected result          | One buyer/listing save exists; save/unsave are idempotent; Saved Properties reflects authoritative state; anonymous intent stores only allowlisted short-lived data and never an amount/private route; post-auth return is safe. |
| Evidence to capture      | Card/detail/saved screens, row counts, sessionStorage key/value shape with no secrets, return URL.                                                                                                                               |
| Severity if failed       | S2; S1 for cross-user intent or data exposure.                                                                                                                                                                                   |
| Notes                    | Verify action state remains consistent in multiple tabs after refetch.                                                                                                                                                           |

### UAT-15 — Owner cannot save own listing

| Field                    | Detail                                                                                                                                    |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| User role or perspective | `CUSTOMER-SELLER` viewing own `LIVE` listing                                                                                              |
| Preconditions            | Owner signed in; own listing is public.                                                                                                   |
| Test data setup          | Scenario owner/listing.                                                                                                                   |
| Steps                    | Inspect card/detail actions; call save mutation directly; attempt direct DB insert under owner context.                                   |
| Expected result          | Save control is absent/disabled with appropriate owner treatment; API refuses; RLS `WITH CHECK` refuses direct insert; no row is created. |
| Evidence to capture      | UI, API error, direct RLS result, zero-row assertion.                                                                                     |
| Severity if failed       | S1 if DB rule fails; otherwise S2.                                                                                                        |
| Notes                    | The DB result is the release gate, not the hidden button.                                                                                 |

### UAT-16 — Paused listing is not offerable

| Field                    | Detail                                                                                                                                                                                     |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| User role or perspective | `CUSTOMER-BUYER`                                                                                                                                                                           |
| Preconditions            | Previously LIVE scenario listing paused by owner/Admin.                                                                                                                                    |
| Test data setup          | Buyer has saved the listing before pause.                                                                                                                                                  |
| Steps                    | Open marketplace, direct detail, saved item, and offer URL; attempt offer mutation directly.                                                                                               |
| Expected result          | Listing is absent from marketplace; saved item becomes a safe unavailable stub; direct/offer route is safely unavailable; create-offer rejects; no private data or active control appears. |
| Evidence to capture      | Marketplace absence, saved stub, direct-route result, API/DB error.                                                                                                                        |
| Severity if failed       | S1.                                                                                                                                                                                        |
| Notes                    | Pausing also closes active offers according to their state rules.                                                                                                                          |

### UAT-17 — `SOLD_DEMO` listing is not offerable

| Field                    | Detail                                                                                                                                                             |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| User role or perspective | `ANON` and `CUSTOMER-BUYER`                                                                                                                                        |
| Preconditions            | Scenario transaction completed and listing is `SOLD_DEMO`.                                                                                                         |
| Test data setup          | Completed scenario or isolated fixture driven through canonical functions.                                                                                         |
| Steps                    | Search marketplace; open saved/direct/public/offer URLs; attempt create-offer mutation.                                                                            |
| Expected result          | Sold-demo listing is excluded from marketplace; offer is unavailable; no mutation can reopen it; wording says completed/sold **in demo** and never legal transfer. |
| Evidence to capture      | Search/direct-route results, API rejection, listing state, copy screenshot.                                                                                        |
| Severity if failed       | S1.                                                                                                                                                                |
| Notes                    | `SOLD_DEMO` is terminal for Week 7.                                                                                                                                |

## Offers and negotiation

### UAT-18 — Buyer submits an offer

| Field                    | Detail                                                                                                                                                                                                                                                  |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User role or perspective | `CUSTOMER-BUYER`                                                                                                                                                                                                                                        |
| Preconditions            | Non-owner buyer; `LIVE`, available listing; no active thread for pair.                                                                                                                                                                                  |
| Test data setup          | Offer amount, expiry option, unique buyer/listing.                                                                                                                                                                                                      |
| Steps                    | Open offer form; test invalid amount; enter valid amount; review; submit once and double-submit; open My Offers and seller inbox.                                                                                                                       |
| Expected result          | One thread/current buyer proposal is persisted; status awaits seller and `next_actor=SELLER`; review values match submission; duplicate does not create a second active thread; seller sees permitted buyer-safe data; notifications/audit are correct. |
| Evidence to capture      | Form/review/submitted screens, thread/proposal row counts and versions, buyer/seller views, notification/audit types.                                                                                                                                   |
| Severity if failed       | S1.                                                                                                                                                                                                                                                     |
| Notes                    | Offer is explicitly non-binding and no contact data is exchanged.                                                                                                                                                                                       |

### UAT-19 — Seller counters

| Field                    | Detail                                                                                                                                                                                |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User role or perspective | `CUSTOMER-SELLER`                                                                                                                                                                     |
| Preconditions            | Active buyer offer awaiting seller.                                                                                                                                                   |
| Test data setup          | New seller counter amount distinct from original.                                                                                                                                     |
| Steps                    | Open thread; choose Counter; validate amount; confirm; refresh both views; attempt the same action again from stale tab.                                                              |
| Expected result          | A new immutable seller proposal is inserted; original amount remains; thread awaits buyer and version increments; buyer sees the counter; stale duplicate fails safely and refetches. |
| Evidence to capture      | Before/after timeline, all proposal amounts/statuses, version, stale-action message.                                                                                                  |
| Severity if failed       | S1; S0 if history is overwritten/corrupted.                                                                                                                                           |
| Notes                    | No chat/free text is introduced.                                                                                                                                                      |

### UAT-20 — Buyer counters

| Field                    | Detail                                                                                                                                                                           |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User role or perspective | `CUSTOMER-BUYER`                                                                                                                                                                 |
| Preconditions            | Seller counter awaiting buyer.                                                                                                                                                   |
| Test data setup          | Third amount distinct from both prior proposals.                                                                                                                                 |
| Steps                    | Open current thread; counter; confirm; inspect buyer/seller timelines and DB history; attempt out-of-turn seller/buyer calls.                                                    |
| Expected result          | Third immutable proposal is appended; prior two remain superseded/history; status awaits seller; out-of-turn actions fail; current amount and actor are consistent in all views. |
| Evidence to capture      | Three-entry timeline and proposal rows, next actor/version, out-of-turn errors.                                                                                                  |
| Severity if failed       | S1; S0 for proposal mutation/history loss.                                                                                                                                       |
| Notes                    | Test AED formatting and actor labels.                                                                                                                                            |

### UAT-21 — Seller accepts buyer proposal

| Field                    | Detail                                                                                                                                                                                                                                          |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User role or perspective | `CUSTOMER-SELLER`                                                                                                                                                                                                                               |
| Preconditions            | Current proposal awaits seller; no accepted thread on listing.                                                                                                                                                                                  |
| Test data setup          | Active thread plus at least one competing active thread for UAT-23.                                                                                                                                                                             |
| Steps                    | Open accept dialog; review impact/non-binding handoff; confirm; refresh seller/buyer/public views; repeat accept.                                                                                                                               |
| Expected result          | Thread and current proposal become accepted atomically; `next_actor=NONE`; Under Offer derives while listing stays `LIVE`; repeat is safe; accepted amount is immutable; transaction handoff appears without claiming payment/legal completion. |
| Evidence to capture      | Dialog/success/handoff/public badge, accepted rows/version, audit/notifications.                                                                                                                                                                |
| Severity if failed       | S0 for multiple/partial acceptance or amount mutation; otherwise S1.                                                                                                                                                                            |
| Notes                    | Acceptance itself must not bypass canonical transaction creation.                                                                                                                                                                               |

### UAT-22 — Buyer accepts seller counter

| Field                    | Detail                                                                                                                                                                                     |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| User role or perspective | `CUSTOMER-BUYER`                                                                                                                                                                           |
| Preconditions            | Current seller counter awaits buyer; no accepted thread.                                                                                                                                   |
| Test data setup          | Isolated thread/listing.                                                                                                                                                                   |
| Steps                    | Open accept dialog; confirm seller-counter amount and implications; accept; refresh both perspectives and public page.                                                                     |
| Expected result          | The seller counter—not an earlier proposal—is accepted; exactly one accepted thread; Under Offer derives; both perspectives show the same accepted amount/history and transaction handoff. |
| Evidence to capture      | Dialog and both views, accepted proposal ID/amount, single-accept query, public availability.                                                                                              |
| Severity if failed       | S0 for wrong/multiple accepted proposal; otherwise S1.                                                                                                                                     |
| Notes                    | Buyer can accept only when `next_actor=BUYER`.                                                                                                                                             |

### UAT-23 — Other active offers close after acceptance

| Field                    | Detail                                                                                                                                                                                                       |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| User role or perspective | Accepted buyer, other buyers, seller                                                                                                                                                                         |
| Preconditions            | At least three active buyer threads on one listing; one is accepted.                                                                                                                                         |
| Test data setup          | Unique buyers A/B/C and listing.                                                                                                                                                                             |
| Steps                    | Accept buyer A; refresh all threads/inboxes; attempt counter/accept from B/C; inspect notifications and proposal histories.                                                                                  |
| Expected result          | A is the sole accepted thread; B/C become `CLOSED_OTHER_ACCEPTED`; their histories remain immutable; no active thread survives; subsequent actions fail safely; other buyers do not see A’s amount/identity. |
| Evidence to capture      | Thread-state query, each perspective screenshot, failed-action responses, privacy projection check.                                                                                                          |
| Severity if failed       | S0 for second acceptance or private cross-buyer leak; otherwise S1.                                                                                                                                          |
| Notes                    | Also covered by concurrent database test.                                                                                                                                                                    |

### UAT-24 — New offers are blocked after Under Offer

| Field                    | Detail                                                                                                                                                                                                  |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User role or perspective | New `CUSTOMER-BUYER` and `ANON`                                                                                                                                                                         |
| Preconditions            | Listing remains `LIVE` with one accepted offer and no cancelled transaction.                                                                                                                            |
| Test data setup          | Unrelated buyer D.                                                                                                                                                                                      |
| Steps                    | Browse/detail listing; navigate directly to offer URL; sign in from anonymous offer intent; call eligibility/create directly.                                                                           |
| Expected result          | Public listing remains visible/saveable/shareable with Under Offer treatment; offer control is unavailable; server eligibility and create function both reject; no intent can bypass the current state. |
| Evidence to capture      | Public/detail/offer states, API errors, zero new-thread assertion.                                                                                                                                      |
| Severity if failed       | S1; S0 if a second accepted path becomes possible.                                                                                                                                                      |
| Notes                    | Under Offer is derived and must never be persisted as listing state.                                                                                                                                    |

### UAT-25 — Buyer withdraws an active offer

| Field                    | Detail                                                                                                                                                                             |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User role or perspective | `CUSTOMER-BUYER`                                                                                                                                                                   |
| Preconditions            | Buyer-owned active thread in a withdrawable state.                                                                                                                                 |
| Test data setup          | Isolated buyer/listing/thread.                                                                                                                                                     |
| Steps                    | Open withdraw confirmation; cancel once; confirm once; refresh both perspectives; repeat withdrawal; attempt seller withdrawal.                                                    |
| Expected result          | Cancel leaves state unchanged; confirm transitions to `WITHDRAWN`, `next_actor=NONE`, preserves proposals, writes safe event/notification; repeat/out-of-role actions fail safely. |
| Evidence to capture      | Dialog/cancel/success, thread/event rows, seller view, invalid actor response.                                                                                                     |
| Severity if failed       | S1.                                                                                                                                                                                |
| Notes                    | Withdrawal must not delete the negotiation record.                                                                                                                                 |

### UAT-26 — Seller rejects an offer

| Field                    | Detail                                                                                                                                                                                                                   |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| User role or perspective | `CUSTOMER-SELLER`                                                                                                                                                                                                        |
| Preconditions            | Active offer awaiting seller.                                                                                                                                                                                            |
| Test data setup          | Isolated seller/listing/buyer thread.                                                                                                                                                                                    |
| Steps                    | Open reject dialog; cancel once; confirm with a structured allowed reason if required; refresh both perspectives; repeat; attempt buyer-as-seller call.                                                                  |
| Expected result          | Confirm transitions thread to `REJECTED`, ends actionability, preserves proposals, uses safe customer-facing copy, and creates the correct event/notification/audit. Cancel/repeat/wrong-actor calls do not alter state. |
| Evidence to capture      | Dialog/cancel/reject screens, thread/proposal/event rows, buyer view, wrong-actor response.                                                                                                                              |
| Severity if failed       | S1.                                                                                                                                                                                                                      |
| Notes                    | No private Admin/operational reason or free-text rejection data leaks.                                                                                                                                                   |

### UAT-27 — Below-threshold offer classification remains private from buyer

| Field                    | Detail                                                                                                                                                                                                                                 |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User role or perspective | `CUSTOMER-BUYER` and `CUSTOMER-SELLER`                                                                                                                                                                                                 |
| Preconditions            | Seller has a private notification threshold; listing is available.                                                                                                                                                                     |
| Test data setup          | One offer below and one at/above threshold from different buyers.                                                                                                                                                                      |
| Steps                    | Submit both offers; inspect buyer DTO/UI/network, seller inbox/filters, notification list/count, and public projection.                                                                                                                |
| Expected result          | Both offers persist and are visible to seller; below-threshold offer creates no prominent `OFFER_RECEIVED` notification; at/above does; buyers receive no threshold/classification field or revealing copy; public output has neither. |
| Evidence to capture      | Seller inbox/notification comparison, buyer/public DTO allowlist diff, notification row counts.                                                                                                                                        |
| Severity if failed       | S0 for threshold/privacy leak; S1 for incorrect notification semantics.                                                                                                                                                                |
| Notes                    | “Private from buyer” means classification and threshold, not the buyer’s own amount/status.                                                                                                                                            |

## Transactions

### UAT-28 — Accepted offer creates one transaction

| Field                    | Detail                                                                                                                                                                                                                              |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User role or perspective | Accepted buyer and seller                                                                                                                                                                                                           |
| Preconditions            | One accepted offer with an accepted current proposal; no transaction exists.                                                                                                                                                        |
| Test data setup          | Isolated accepted thread/listing.                                                                                                                                                                                                   |
| Steps                    | Choose Continue to transaction; observe creation/loading; open from both parties’ My Transactions; compare immutable facts with accepted offer.                                                                                     |
| Expected result          | One canonical transaction plus 17 tasks and creation event is created atomically; buyer, seller, listing, thread, proposal, amount, and reference are correct; both parties reach the same shared workspace; unrelated user cannot. |
| Evidence to capture      | Handoff/workspace screenshots, transaction/task counts, immutable field comparison, notifications/audit.                                                                                                                            |
| Severity if failed       | S0 for wrong identity/amount/duplicate; otherwise S1.                                                                                                                                                                               |
| Notes                    | No payment, escrow, legal, or ownership-transfer claim appears.                                                                                                                                                                     |

### UAT-29 — Duplicate transaction creation returns the same transaction

| Field                    | Detail                                                                                                                                                                        |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User role or perspective | Accepted buyer and seller in separate tabs                                                                                                                                    |
| Preconditions            | Accepted thread; creation not yet performed or just performed.                                                                                                                |
| Test data setup          | One accepted thread/proposal.                                                                                                                                                 |
| Steps                    | Trigger Continue simultaneously from buyer and seller; repeat from both after success; compare IDs/references and row/task counts.                                            |
| Expected result          | Every call returns the same canonical transaction; unique thread/proposal constraints prevent duplicates; tasks/events are not duplicated; no partial error state is visible. |
| Evidence to capture      | Parallel request results, one transaction ID/reference, row/task/event counts, DB constraint assertion.                                                                       |
| Severity if failed       | S0.                                                                                                                                                                           |
| Notes                    | Execute with separate browser contexts and separate DB connections in automation.                                                                                             |

### UAT-30 — Buyer confirms transaction details

| Field                    | Detail                                                                                                                                                                                                                      |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User role or perspective | Transaction buyer                                                                                                                                                                                                           |
| Preconditions            | New transaction at confirmation stage; neither party confirmed.                                                                                                                                                             |
| Test data setup          | Scenario transaction.                                                                                                                                                                                                       |
| Steps                    | Review immutable details; confirm; refresh buyer/seller views; repeat; attempt seller task as buyer.                                                                                                                        |
| Expected result          | Buyer confirmation task becomes `COMPLETED_DEMO`; seller task remains actionable; transaction next actor/state accurately reflects remaining work; repeat is idempotent or safely stale; buyer cannot complete seller task. |
| Evidence to capture      | Before/after task panel, task/status/version query, seller view, invalid actor result.                                                                                                                                      |
| Severity if failed       | S1; S0 if actor/immutable facts can be forged.                                                                                                                                                                              |
| Notes                    | Error copy must identify action—not expose internal task codes.                                                                                                                                                             |

### UAT-31 — Seller confirms transaction details

| Field                    | Detail                                                                                                                                                                                               |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User role or perspective | Transaction seller                                                                                                                                                                                   |
| Preconditions            | Buyer confirmed; seller task remains open.                                                                                                                                                           |
| Test data setup          | Same isolated transaction.                                                                                                                                                                           |
| Steps                    | Review details; confirm as seller; refresh both views; observe stage progression and next action.                                                                                                    |
| Expected result          | Seller task completes; state engine advances from confirmation only when both required tasks are done; next actor is derived from the next open task; accepted amount/participants remain unchanged. |
| Evidence to capture      | Task/status/next-actor before and after, both UI perspectives, timeline event.                                                                                                                       |
| Severity if failed       | S1.                                                                                                                                                                                                  |
| Notes                    | Verify progress numerator/denominator against required non-skipped tasks.                                                                                                                            |

### UAT-32 — Buyer confirms the demo deposit

| Field                    | Detail                                                                                                                                                                                                                                                 |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| User role or perspective | Transaction buyer                                                                                                                                                                                                                                      |
| Preconditions            | Details complete; purchase route selected and financing state satisfied as applicable; deposit task active.                                                                                                                                            |
| Test data setup          | Accepted amount with exactly calculable 10% display value.                                                                                                                                                                                             |
| Steps                    | Inspect deposit disclosure/value; confirm; double-submit; refresh seller view; attempt route change afterward.                                                                                                                                         |
| Expected result          | Deposit equals server-computed 10%; task completes once; copy says confirmed **in demo** and explicitly no real payment; no payment fields/instrument are collected; seller sees waiting/completion state; route change is blocked after confirmation. |
| Evidence to capture      | Deposit panel/disclosure, amount calculation, task/status/version, rejected route change.                                                                                                                                                              |
| Severity if failed       | S1; S0 for real-payment collection or material financial misstatement.                                                                                                                                                                                 |
| Notes                    | AED formatting must be consistent and LTR in Arabic.                                                                                                                                                                                                   |

### UAT-33 — Buyer uploads a fictional transaction document

| Field                    | Detail                                                                                                                                                                                                                                                             |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| User role or perspective | Transaction buyer                                                                                                                                                                                                                                                  |
| Preconditions            | Document stage active; private transaction bucket available.                                                                                                                                                                                                       |
| Test data setup          | Fictional allowed file ≤10 MB; invalid MIME, oversize, and wrong-side document type controls.                                                                                                                                                                      |
| Steps                    | Upload allowed buyer document; register; refresh; open own short-lived preview/download; replace/remove if supported; try invalid/wrong-side file and forged cross-transaction object key.                                                                         |
| Expected result          | Object and row are buyer/uploader-scoped; server validates transaction, uploader, type, path, MIME, and size; seller sees only completeness—not filename/URL/path; own signed URL works then expires; invalid/forged cases fail without orphaned registered state. |
| Evidence to capture      | Upload/checklist states, redacted row metadata, seller projection, negative responses, expiry result, object cleanup count.                                                                                                                                        |
| Severity if failed       | S0 for cross-party/path exposure or forged registration; otherwise S1.                                                                                                                                                                                             |
| Notes                    | This verifies current implemented code and supersedes stale “upload pending” documentation.                                                                                                                                                                        |

### UAT-34 — Seller uploads a fictional transaction document

| Field                    | Detail                                                                                                                                                                                      |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User role or perspective | Transaction seller                                                                                                                                                                          |
| Preconditions            | Document stage active; seller required type available.                                                                                                                                      |
| Test data setup          | Fictional seller-side file plus wrong buyer-only type.                                                                                                                                      |
| Steps                    | Upload/register valid file; refresh both perspectives; attempt buyer-only type; buyer attempts filename/preview access; seller obtains own signed URL and waits for expiry.                 |
| Expected result          | Seller file is private to seller/Admin purpose-driven access; buyer sees completeness only; wrong-side type and buyer content access are denied; URL expires; no path enters DTO/log/audit. |
| Evidence to capture      | Seller/buyer checklist comparison, denial responses, URL-expiry result with URL redacted, log/DTO scans.                                                                                    |
| Severity if failed       | S0 for content/path leak; otherwise S1.                                                                                                                                                     |
| Notes                    | Use the same Storage-privacy assertions as UAT-33.                                                                                                                                          |

### UAT-35 — Due-diligence simulation completes

| Field                    | Detail                                                                                                                                                                                                                              |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User role or perspective | Current transaction participant triggering a system step                                                                                                                                                                            |
| Preconditions            | All required document/summary tasks complete; due-diligence task active.                                                                                                                                                            |
| Test data setup          | Scenario transaction at due-diligence stage.                                                                                                                                                                                        |
| Steps                    | Start simulation; observe loading/pending; refresh; complete; repeat; inspect both perspectives and event/audit copy.                                                                                                               |
| Expected result          | Server-authoritative simulation completes once and advances tasks; both participants see consistent state; safe disclosure says no legal, financial, structural, title, or regulatory advice; repeat is idempotent/safely terminal. |
| Evidence to capture      | Pending/success screens, task/status/version, event/audit types, copy screenshot.                                                                                                                                                   |
| Severity if failed       | S1.                                                                                                                                                                                                                                 |
| Notes                    | A recoverable simulated failure belongs in state/reliability tests.                                                                                                                                                                 |

### UAT-36 — Transfer readiness completes

| Field                    | Detail                                                                                                                                                                                                                           |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User role or perspective | Seller and buyer                                                                                                                                                                                                                 |
| Preconditions            | Due diligence complete; transfer tasks active.                                                                                                                                                                                   |
| Test data setup          | Preferred date within allowed 3–30 day range plus invalid boundaries.                                                                                                                                                            |
| Steps                    | Seller proposes invalid then valid date; both participants confirm readiness in turn; create simulated appointment; refresh both views.                                                                                          |
| Expected result          | Date validation is server-enforced; each party can complete only its task; appointment is created only after prerequisites; copy states that no official appointment was booked; next actor/progress/timeline remain consistent. |
| Evidence to capture      | Validation and readiness screens, task/status/version timeline, appointment disclosure.                                                                                                                                          |
| Severity if failed       | S1.                                                                                                                                                                                                                              |
| Notes                    | Date/reference values remain readable LTR in Arabic.                                                                                                                                                                             |

### UAT-37 — Transaction reaches `COMPLETED_DEMO`

| Field                    | Detail                                                                                                                                                                                                                                                            |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User role or perspective | Buyer and seller                                                                                                                                                                                                                                                  |
| Preconditions            | All prior required tasks complete; both completion confirmations open.                                                                                                                                                                                            |
| Test data setup          | Near-complete scenario transaction.                                                                                                                                                                                                                               |
| Steps                    | Buyer confirms completion; verify not yet terminal; seller confirms; refresh both workspaces, transaction lists, marketplace, offers, and Admin.                                                                                                                  |
| Expected result          | Only dual confirmation after every gate atomically produces `COMPLETED_DEMO`, completes terminal tasks, sets listing `SOLD_DEMO`, removes listing from marketplace, blocks offers, and preserves history. Copy says completion **in demo**, never legal transfer. |
| Evidence to capture      | Before/after tasks/status/listing, both completion screens, marketplace absence, audit/notification chain.                                                                                                                                                        |
| Severity if failed       | S0 for premature/partial completion or inconsistent listing state; otherwise S1.                                                                                                                                                                                  |
| Notes                    | Completion is irreversible in Week 7.                                                                                                                                                                                                                             |

### UAT-38 — Transaction cancels before completion

| Field                    | Detail                                                                                                                                                                                                                                     |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| User role or perspective | Buyer and seller                                                                                                                                                                                                                           |
| Preconditions            | Two isolated lanes: one early before both detail confirmations, one post-deposit.                                                                                                                                                          |
| Test data setup          | Structured cancellation reasons for each lane.                                                                                                                                                                                             |
| Steps                    | Early lane: one participant requests cancellation. Later lane: requester initiates, tries to resolve own request, other party declines once then repeat with a fresh transaction and confirms.                                             |
| Expected result          | Early valid cancellation is immediate; later cancellation becomes `CANCELLATION_PENDING` and only the other party can resolve; decline restores valid workflow; confirm yields `CANCELLED`; record/history remain; no free-text authority. |
| Evidence to capture      | Dialogs/impact copy, status/next-actor/task snapshots, invalid self-resolution response, events/audit.                                                                                                                                     |
| Severity if failed       | S1; S0 for unauthorised or corrupt terminal transition.                                                                                                                                                                                    |
| Notes                    | Cover Admin conflict resolution separately.                                                                                                                                                                                                |

### UAT-39 — Cancelled listing remains `PAUSED`

| Field                    | Detail                                                                                                                                                                                                            |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User role or perspective | Seller, buyer, Admin                                                                                                                                                                                              |
| Preconditions            | Transaction has reached `CANCELLED`.                                                                                                                                                                              |
| Test data setup          | Cancelled scenario from UAT-38.                                                                                                                                                                                   |
| Steps                    | Inspect listing/public/search/saved/offer states; refresh; verify no automatic timer/read republishes it; seller attempts explicit resume after reviewing eligibility.                                            |
| Expected result          | Cancellation atomically sets listing `PAUSED`, removes it from marketplace, blocks offers, and never auto-LIVE; cancelled transaction no longer derives Under Offer; only explicit valid resume can restore LIVE. |
| Evidence to capture      | Listing/transaction state, marketplace absence, offer eligibility, post-resume behaviour if executed, audit events.                                                                                               |
| Severity if failed       | S0 for automatic relisting or lingering Under Offer corruption; otherwise S1.                                                                                                                                     |
| Notes                    | Resuming does not reactivate closed offer threads.                                                                                                                                                                |

### UAT-40 — Completed listing becomes `SOLD_DEMO`

| Field                    | Detail                                                                                                                                                                                                                   |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| User role or perspective | Seller, buyer, `ANON`, Admin                                                                                                                                                                                             |
| Preconditions            | Transaction completed through UAT-37.                                                                                                                                                                                    |
| Test data setup          | Completed scenario.                                                                                                                                                                                                      |
| Steps                    | Inspect owner/manage, public URLs, marketplace, saved item, offer eligibility, and Admin listing/transaction detail.                                                                                                     |
| Expected result          | Listing is exactly `SOLD_DEMO`, not generic SOLD/transfer-complete; public marketplace excludes it; new offers/resume are impossible; Admin sees immutable relation to the completed transaction; audit history remains. |
| Evidence to capture      | State queries and UI screenshots from each perspective, rejection responses, audit chain.                                                                                                                                |
| Severity if failed       | S0 for relisting/offerability/data inconsistency; otherwise S1.                                                                                                                                                          |
| Notes                    | Public direct-route behaviour must be safe and documented.                                                                                                                                                               |

## Admin operations

### UAT-41 — Admin opens operations dashboard

| Field                    | Detail                                                                                                                                                                                                   |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User role or perspective | `ADMIN`                                                                                                                                                                                                  |
| Preconditions            | Admin bootstrapped through env-driven Admin API; Admin app running; scenario queues exist.                                                                                                               |
| Test data setup          | Isolated pending publication, active transaction, and recent audit record.                                                                                                                               |
| Steps                    | Sign in on port 3001; open overview; navigate all eight areas; refresh; test queue Realtime change.                                                                                                      |
| Expected result          | Admin reaches separate portal; metrics/queues are authoritative and link correctly; no customer-mode control exists; healthy Realtime indicator stays unobtrusive and changes trigger debounced refetch. |
| Evidence to capture      | Dashboard/nav screenshots, metric-to-query reconciliation, Realtime refresh trace.                                                                                                                       |
| Severity if failed       | S1; S0 if a customer could access the same data.                                                                                                                                                         |
| Notes                    | Verify exact route count/documentation after current UI revisions.                                                                                                                                       |

### UAT-42 — Admin searches for a customer

| Field                    | Detail                                                                                                                                                                                          |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User role or perspective | `ADMIN`                                                                                                                                                                                         |
| Preconditions            | Multiple isolated customers, including mixed-language names.                                                                                                                                    |
| Test data setup          | Unique name, masked email, opaque references; enough records for no-result and pagination.                                                                                                      |
| Steps                    | Open global search by mouse and keyboard; search exact/partial/mixed-language terms; choose result; search nonexistent value; clear and escape.                                                 |
| Expected result          | Results are relevant, bounded, keyboard operable, and use privacy-minimised fields; selection reaches correct detail; no-result/loading/error states are clear; raw private metadata is absent. |
| Evidence to capture      | Search result/detail/no-result screenshots, response-field allowlist, query timing.                                                                                                             |
| Severity if failed       | S2; S0 if secrets/private paths appear.                                                                                                                                                         |
| Notes                    | Search performance is measured in section 11.                                                                                                                                                   |

### UAT-43 — Admin restricts a customer

| Field                    | Detail                                                                                                                                                                                                                     |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User role or perspective | `ADMIN`                                                                                                                                                                                                                    |
| Preconditions            | Active customer; Admin has `MANAGE_CUSTOMER_STATUS`.                                                                                                                                                                       |
| Test data setup          | Customer with public listing and ability to initiate new actions.                                                                                                                                                          |
| Steps                    | Open customer detail; choose Restrict; verify no default reason; select allowed reason; review impact; confirm; repeat from stale tab.                                                                                     |
| Expected result          | Profile becomes `ACTIONS_RESTRICTED` with actor/reason/timestamp; action is audited; existing public listing/sign-in/read access remain; duplicate/stale restriction fails safely; Admin cannot enter free-text authority. |
| Evidence to capture      | Dialog/restricted banner, profile fields, audit event/metadata allowlist, stale response.                                                                                                                                  |
| Severity if failed       | S1; S0 if arbitrary/customer-authored restriction or missing audit.                                                                                                                                                        |
| Notes                    | Restriction is a narrow brake, not account deletion.                                                                                                                                                                       |

### UAT-44 — Restricted customer cannot create a new offer or listing action

| Field                    | Detail                                                                                                                                                                                                              |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User role or perspective | `RESTRICTED-CUSTOMER`                                                                                                                                                                                               |
| Preconditions            | UAT-43 complete; customer remains signed in.                                                                                                                                                                        |
| Test data setup          | Available listing to offer on and an owned draft to mutate.                                                                                                                                                         |
| Steps                    | Browse/read existing records; attempt new offer; create/update listing; submit publication; call functions directly.                                                                                                |
| Expected result          | Sign-in, browsing, public listing, and permitted reads still work; new consequential offer/listing/publication writes fail with safe customer copy; server/DB functions enforce restriction even if UI is bypassed. |
| Evidence to capture      | Allowed-read and blocked-write screens, API/DB errors, zero-new-row assertions.                                                                                                                                     |
| Severity if failed       | S1; S0 if restriction can be bypassed at DB boundary.                                                                                                                                                               |
| Notes                    | Verify existing transaction read rights are unchanged unless explicitly governed.                                                                                                                                   |

### UAT-45 — Admin restores a customer

| Field                    | Detail                                                                                                                                                                                         |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User role or perspective | `ADMIN`, then restored `CUSTOMER`                                                                                                                                                              |
| Preconditions            | Restricted scenario customer; Admin capability present.                                                                                                                                        |
| Test data setup          | Structured restore reason.                                                                                                                                                                     |
| Steps                    | Restore through dialog; inspect audit; repeat; customer refreshes and performs one previously blocked valid action.                                                                            |
| Expected result          | Profile returns to `ACTIVE`; restriction fields resolve per schema; restore is audited and duplicate-safe; customer can again perform valid consequential actions without new account/session. |
| Evidence to capture      | Restore dialog/banner, profile/audit rows, successful customer action.                                                                                                                         |
| Severity if failed       | S1.                                                                                                                                                                                            |
| Notes                    | Historic restriction audit is never removed.                                                                                                                                                   |

### UAT-46 — Admin reviews and approves publication

| Field                    | Detail                                                                                                                                                                                               |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User role or perspective | `ADMIN`                                                                                                                                                                                              |
| Preconditions            | Eligible pending publication; `REVIEW_PUBLICATION` capability.                                                                                                                                       |
| Test data setup          | Unique pending request with safe public and owner-only sections.                                                                                                                                     |
| Steps                    | Open queue/detail; compare public/private sections; approve with required reason/confirmation; observe queue and seller/public state.                                                                |
| Expected result          | Review exposes only necessary data; approval reuses canonical compensated publication service; listing becomes LIVE only after gate; Admin action and publication events are audited; queue updates. |
| Evidence to capture      | Review/approval, projection comparison, LIVE/public result, audit chain, queue refresh.                                                                                                              |
| Severity if failed       | S1; S0 for privacy leak or bypassed publication gate.                                                                                                                                                |
| Notes                    | No claim of government/regulatory approval.                                                                                                                                                          |

### UAT-47 — Admin returns publication for changes

| Field                    | Detail                                                                                                                                                                                                         |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User role or perspective | `ADMIN`, observed by `CUSTOMER-SELLER`                                                                                                                                                                         |
| Preconditions            | Pending publication; current request not resolved.                                                                                                                                                             |
| Test data setup          | Structured return reason.                                                                                                                                                                                      |
| Steps                    | Open action dialog; select explicit reason; return; inspect seller notification/status; repeat from stale tab; seller repairs and retries if supported.                                                        |
| Expected result          | Canonical Security Definer path returns request safely; listing stays recoverable/non-LIVE; owner receives safe notification; action/reason are audited; stale repeat does not duplicate/rollback incorrectly. |
| Evidence to capture      | Admin and seller states, request/listing rows, notification, audit, stale result.                                                                                                                              |
| Severity if failed       | S1; S0 if non-LIVE listing is exposed or cross-recipient notification leaks.                                                                                                                                   |
| Notes                    | Specifically regress the Week-6 RLS bug fixed in migration `0814`.                                                                                                                                             |

### UAT-48 — Admin pauses a live listing

| Field                    | Detail                                                                                                                                                                                                      |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User role or perspective | `ADMIN`, seller, buyers                                                                                                                                                                                     |
| Preconditions            | LIVE listing with active offers; capability present.                                                                                                                                                        |
| Test data setup          | Scenario listing with two active offer threads and one save.                                                                                                                                                |
| Steps                    | Pause with explicit reason; inspect public, owner, saved, offers, and audit states; repeat/stale action.                                                                                                    |
| Expected result          | Listing becomes `PAUSED`, leaves marketplace, saved item becomes unavailable, active offers close per canonical logic, owner retains management view, and reason-coded audit exists; no history is deleted. |
| Evidence to capture      | Dialog, all perspective states, listing/offer/event rows, audit.                                                                                                                                            |
| Severity if failed       | S1; S0 for partial/corrupt state.                                                                                                                                                                           |
| Notes                    | Admin does not become listing owner.                                                                                                                                                                        |

### UAT-49 — Admin resumes a paused listing

| Field                    | Detail                                                                                                                                                                 |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User role or perspective | `ADMIN`, seller, `ANON`                                                                                                                                                |
| Preconditions            | Eligible paused listing; no terminal completed transaction.                                                                                                            |
| Test data setup          | One still-eligible paused listing and one invalidated paused listing.                                                                                                  |
| Steps                    | Resume eligible listing; verify public return; attempt resume on invalidated/terminal listing; inspect audit and old offers.                                           |
| Expected result          | Eligible listing returns to LIVE with refreshed public timestamp; invalid/terminal resume is refused safely; old closed offers do not reactivate; actions are audited. |
| Evidence to capture      | Eligible and rejected dialogs/results, listing versions, marketplace, offer states, audit.                                                                             |
| Severity if failed       | S1; S0 if terminal listing is republished.                                                                                                                             |
| Notes                    | Resume cannot silently skip required re-review after material change.                                                                                                  |

### UAT-50 — Admin views offer history read-only

| Field                    | Detail                                                                                                                                                                       |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User role or perspective | `ADMIN`                                                                                                                                                                      |
| Preconditions            | Negotiated thread with at least three proposals and terminal state.                                                                                                          |
| Test data setup          | Scenario thread from counter sequence.                                                                                                                                       |
| Steps                    | Open offers list/detail; review timeline and proposals; inspect available controls/network; navigate on mobile card view.                                                    |
| Expected result          | Complete chronological history is visible with safe identity data; no edit/delete/amount-change control or API exists; raw private threshold/contact/storage data is absent. |
| Evidence to capture      | Offer list/detail/timeline, response allowlist, absence of mutation surface.                                                                                                 |
| Severity if failed       | S1; S0 if sensitive data or edit authority appears.                                                                                                                          |
| Notes                    | A narrowly allowed close-invalid-thread action is separate from editing history.                                                                                             |

### UAT-51 — Admin cannot edit proposal amount

| Field                    | Detail                                                                                                                                                           |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User role or perspective | `ADMIN`                                                                                                                                                          |
| Preconditions            | Existing current and accepted proposals.                                                                                                                         |
| Test data setup          | Record original amounts/hashes.                                                                                                                                  |
| Steps                    | Attempt direct authenticated SQL update as Admin, generic API mutation if discoverable, and client tampering; re-read proposal and audit.                        |
| Expected result          | Grant/trigger/function boundaries deny modification; every amount and proposal identity remains byte-for-byte unchanged; no misleading success audit is written. |
| Evidence to capture      | Permission/trigger errors, before/after values, row versions/counts.                                                                                             |
| Severity if failed       | S0.                                                                                                                                                              |
| Notes                    | Repeat against accepted amount in transaction immutability suite.                                                                                                |

### UAT-52 — Admin accesses a private document with explicit reason

| Field                    | Detail                                                                                                                                                                                                                           |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User role or perspective | `ADMIN`                                                                                                                                                                                                                          |
| Preconditions            | Private fictional ownership/transaction document exists; both metadata and access capabilities present.                                                                                                                          |
| Test data setup          | Scenario document; explicit allowed purpose.                                                                                                                                                                                     |
| Steps                    | Open metadata; verify no path; choose View; leave reason/acknowledgement blank; then select reason, acknowledge, request; open URL; wait/advance beyond 300 seconds and retry old URL.                                           |
| Expected result          | Access cannot start without explicit purpose and acknowledgement; metadata never contains path; authorised request returns a short-lived 300s view; URL expires; content is not parsed/indexed; UI never shows raw Storage path. |
| Evidence to capture      | Validation/access/expired states, metadata allowlist, audit event IDs, expiry response with URL redacted.                                                                                                                        |
| Severity if failed       | S0.                                                                                                                                                                                                                              |
| Notes                    | Use fictional file and do not attach its content to the evidence pack.                                                                                                                                                           |

### UAT-53 — Admin document access is truthfully audited

| Field                    | Detail                                                                                                                                                                                            |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User role or perspective | `ADMIN` and audit reviewer                                                                                                                                                                        |
| Preconditions            | One successful and one deliberately failed URL-mint attempt.                                                                                                                                      |
| Test data setup          | Valid document and missing/removed document, each with purpose.                                                                                                                                   |
| Steps                    | Perform valid access; induce safe mint failure; inspect audit log/detail and direct rows; search metadata for URL/path/raw error.                                                                 |
| Expected result          | Success records `REQUESTED` then `GRANTED`; failure records `REQUESTED` then `FAILED` and commits despite failure; actor/entity/purpose are safe; no URL/path/token/raw provider error is stored. |
| Evidence to capture      | Ordered audit rows and UI, safe metadata diff, failure response.                                                                                                                                  |
| Severity if failed       | S0 for missing/false audit or secret/path persistence.                                                                                                                                            |
| Notes                    | Regress migration `0815` transaction-rollback fix.                                                                                                                                                |

### UAT-54 — Admin retries or resumes a recoverable transaction

| Field                    | Detail                                                                                                                                                                                                                                                               |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User role or perspective | `ADMIN`, observed by buyer/seller                                                                                                                                                                                                                                    |
| Preconditions            | Transaction is progression-paused or has recoverable failed system task; capability present.                                                                                                                                                                         |
| Test data setup          | Two lanes: paused valid transaction and recoverable failed task.                                                                                                                                                                                                     |
| Steps                    | Try participant advancement while paused; Admin reviews; resumes/retries with explicit reason; participants continue; attempt stale duplicate Admin action.                                                                                                          |
| Expected result          | Participant action is blocked while paused; Admin action changes only the controlled recovery field/task; immutable participants/amount/reference remain; reason-coded audit exists; duplicate/stale action fails safely; workflow resumes from authoritative state. |
| Evidence to capture      | Paused/error/recovered screens, before/after transaction/task/immutable fields, audit, stale result.                                                                                                                                                                 |
| Severity if failed       | S1; S0 for immutable-field change or unaudited authority.                                                                                                                                                                                                            |
| Notes                    | Admin never completes a buyer/seller task on their behalf.                                                                                                                                                                                                           |

### UAT-55 — Admin opens and filters the audit log

| Field                    | Detail                                                                                                                                                                                                                      |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User role or perspective | `ADMIN` with `VIEW_AUDIT_LOGS`                                                                                                                                                                                              |
| Preconditions            | Scenario audit events from multiple entities/actions.                                                                                                                                                                       |
| Test data setup          | Known action types/timestamps/entity references.                                                                                                                                                                            |
| Steps                    | Open audit list; filter/paginate; open event detail; compare with source actions; search UI/network for disallowed metadata; try unsupported export if absent.                                                              |
| Expected result          | Events are chronologically consistent, attributable, paginated, immutable, and labelled; detail shows allowlisted metadata only; tokens, paths, URLs, raw errors, passwords, codes, and sensitive provider data are absent. |
| Evidence to capture      | List/filter/detail screenshots, safe metadata allowlist check, pagination timing.                                                                                                                                           |
| Severity if failed       | S1; S0 for secret exposure or audit tampering.                                                                                                                                                                              |
| Notes                    | Audit is operational evidence, not a customer activity-edit surface.                                                                                                                                                        |

### UAT-56 — Customer cannot access Admin data

| Field                    | Detail                                                                                                                                                                                 |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User role or perspective | `CUSTOMER-OTHER` and `ANON`                                                                                                                                                            |
| Preconditions            | Admin records exist; customer and anonymous sessions available.                                                                                                                        |
| Test data setup          | Known Admin route/entity IDs used only by the test.                                                                                                                                    |
| Steps                    | Request Admin pages, list/detail/search/audit/document tRPC procedures, Realtime queue subscriptions, and direct table reads under customer/anon context.                              |
| Expected result          | Every layer denies or returns safe not-available/empty output; no capability list, Admin metrics, masked customer list, audit data, document metadata, or Realtime event is delivered. |
| Evidence to capture      | Page/API/RLS/Realtime denial matrix and zero-payload assertions.                                                                                                                       |
| Severity if failed       | S0.                                                                                                                                                                                    |
| Notes                    | Do not treat a hidden Admin navigation link as proof.                                                                                                                                  |

## Security and isolation

### UAT-57 — Anonymous user cannot access private routes

| Field                    | Detail                                                                                                                                                                               |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| User role or perspective | `ANON`                                                                                                                                                                               |
| Preconditions            | Private customer records/routes exist.                                                                                                                                               |
| Test data setup          | Known opaque IDs for owned draft, saved list, offer thread, transaction, and private document.                                                                                       |
| Steps                    | Open protected pages directly; call protected/customer tRPC endpoints; query participant tables under anon RLS; request private objects and guessed signed paths.                    |
| Expected result          | Pages redirect to sign-in with allowlisted return intent or show safe not-available; API/RLS/Storage deny; no private data is placed in HTML, RSC payload, cache, logs, or Realtime. |
| Evidence to capture      | Route/API/RLS/Storage response matrix, page-source/network scan, zero-data assertion.                                                                                                |
| Severity if failed       | S0.                                                                                                                                                                                  |
| Notes                    | Public marketplace and public permit verification remain intentionally accessible.                                                                                                   |

### UAT-58 — Customer cannot access another customer’s offer

| Field                    | Detail                                                                                                                                                    |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User role or perspective | `CUSTOMER-OTHER`                                                                                                                                          |
| Preconditions            | Private thread between buyer A and seller; unrelated customer C signed in.                                                                                |
| Test data setup          | Known thread ID used for negative testing.                                                                                                                |
| Steps                    | Open thread URL; call get/list/mutation procedures; direct-select thread/proposals/events; subscribe to its Realtime channel.                             |
| Expected result          | UI/API use safe “not available” semantics; RLS returns no rows; mutations fail; no Realtime event arrives; no participant identity/amount/timeline leaks. |
| Evidence to capture      | UI/API/RLS/Realtime denial results.                                                                                                                       |
| Severity if failed       | S0.                                                                                                                                                       |
| Notes                    | Missing and forbidden should be indistinguishable to the unrelated customer.                                                                              |

### UAT-59 — Customer cannot access another transaction

| Field                    | Detail                                                                                                                                                      |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User role or perspective | `CUSTOMER-OTHER`                                                                                                                                            |
| Preconditions            | Transaction belongs to buyer A/seller B; customer C signed in.                                                                                              |
| Test data setup          | Known transaction ID/reference and private document IDs for negative tests.                                                                                 |
| Steps                    | Open workspace; call detail/list/action/document procedures; direct-select tables; subscribe to transaction channel; request document URL.                  |
| Expected result          | No transaction, task, event, document metadata/content, reference, amount, or participant data is revealed; every action and subscription is denied/silent. |
| Evidence to capture      | UI/API/RLS/Storage/Realtime denial matrix.                                                                                                                  |
| Severity if failed       | S0.                                                                                                                                                         |
| Notes                    | Admin access is tested separately and must be purpose/capability limited.                                                                                   |

### UAT-60 — Buyer cannot perform seller action

| Field                    | Detail                                                                                                                                                                 |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User role or perspective | Offer/transaction buyer                                                                                                                                                |
| Preconditions            | Seller-only offer action and seller-owned transaction task are current.                                                                                                |
| Test data setup          | Active counterable offer and transfer/date task.                                                                                                                       |
| Steps                    | Tamper UI request and call seller counter/accept/reject or seller task functions as buyer; use current and stale versions.                                             |
| Expected result          | Server derives actor from `auth.uid()` and returns `NOT_YOUR_TURN`/`NOT_YOUR_TASK` or safe equivalent; no row/version/audit changes; UI refetches authoritative state. |
| Evidence to capture      | Request/response and before/after row/version/audit comparison.                                                                                                        |
| Severity if failed       | S0.                                                                                                                                                                    |
| Notes                    | Hiding the seller control is not sufficient.                                                                                                                           |

### UAT-61 — Seller cannot perform buyer action

| Field                    | Detail                                                                                                                                              |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| User role or perspective | Offer/transaction seller                                                                                                                            |
| Preconditions            | Buyer-only offer action/deposit/document task is current.                                                                                           |
| Test data setup          | Seller counter awaiting buyer and transaction deposit stage.                                                                                        |
| Steps                    | Call buyer accept/counter/withdraw, deposit confirmation, buyer document type, or buyer completion as seller.                                       |
| Expected result          | Every function derives identity and denies wrong actor; no state/task/document/audit mutation occurs; seller retains allowed read-only perspective. |
| Evidence to capture      | API/SQL errors and unchanged-state assertions.                                                                                                      |
| Severity if failed       | S0.                                                                                                                                                 |
| Notes                    | Include direct function execution under seller RLS context.                                                                                         |

### UAT-62 — Customer cannot directly forge status or identity

| Field                    | Detail                                                                                                                                                                                                                 |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User role or perspective | Authenticated `CUSTOMER`                                                                                                                                                                                               |
| Preconditions            | Customer owns/participates in records across listing, publication, offer, transaction, and profile identity.                                                                                                           |
| Test data setup          | Scenario records with recorded versions/immutable values.                                                                                                                                                              |
| Steps                    | Attempt direct SQL/API updates to listing LIVE/SOLD, publication approved, offer accepted/next actor, proposal amount, transaction status/amount/participants, restriction, `VERIFIED_STAGING`, and public photo path. |
| Expected result          | RLS/grants/guards reject every forged field; controlled functions are the only write path; all values and audit remain unchanged; customer cannot self-promote to ADMIN.                                               |
| Evidence to capture      | Per-field denial table and before/after hashes/state snapshots.                                                                                                                                                        |
| Severity if failed       | S0.                                                                                                                                                                                                                    |
| Notes                    | Keep this as an explicit live-DB integration suite, not a mocked unit test.                                                                                                                                            |

### UAT-63 — Customer cannot access a private Storage path

| Field                    | Detail                                                                                                                                                                                                        |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User role or perspective | `ANON`, unrelated customer, other transaction participant                                                                                                                                                     |
| Preconditions            | Private ownership, draft-photo, and transaction-document objects exist.                                                                                                                                       |
| Test data setup          | Objects for three owners and recorded redacted keys.                                                                                                                                                          |
| Steps                    | Attempt list/download/public URL/path guessing as each unauthorised perspective; test other participant against filename/content; inspect public projections/logs.                                            |
| Expected result          | All unauthorised list/download requests fail; other transaction participant sees completeness only; private keys/paths never cross API/UI/log; public listing photos remain the only unsigned public objects. |
| Evidence to capture      | Storage response matrix, DTO/log scan, public/private bucket policy assertion.                                                                                                                                |
| Severity if failed       | S0.                                                                                                                                                                                                           |
| Notes                    | Test both Data API policies and Storage object policies.                                                                                                                                                      |

### UAT-64 — Admin cannot mutate an audit row

| Field                    | Detail                                                                                                                                                     |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User role or perspective | `ADMIN`                                                                                                                                                    |
| Preconditions            | Existing audit row; Admin authenticated under normal request role.                                                                                         |
| Test data setup          | Record full row digest.                                                                                                                                    |
| Steps                    | Attempt update, delete, and truncate through direct SQL/API; re-read row and surrounding chronology.                                                       |
| Expected result          | Grant-level permissions deny each operation, not merely a silent RLS no-op; row digest/order/count are unchanged; no application control exposes mutation. |
| Evidence to capture      | Permission errors, before/after digest/count, UI absence.                                                                                                  |
| Severity if failed       | S0.                                                                                                                                                        |
| Notes                    | Service/database-owner maintenance access is outside this customer/Admin request test.                                                                     |

### UAT-65 — Signed URLs expire and remain scope-bound

| Field                    | Detail                                                                                                                                                                                                                   |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| User role or perspective | Owner/uploader and `ADMIN` with purpose                                                                                                                                                                                  |
| Preconditions            | Draft/transaction/Admin-access documents available.                                                                                                                                                                      |
| Test data setup          | One URL of each supported private type; capture timestamps, never URL values.                                                                                                                                            |
| Steps                    | Mint under authorised context; verify access immediately; attempt reuse from another browser/account; wait beyond declared 60s participant or 300s Admin lifetime; retry; remove object and retry a newly requested URL. |
| Expected result          | URL is short-lived and object-specific; unauthorised account cannot mint it; access expires at/after configured TTL; removed/missing objects fail; URL/path is absent from logs/audit/evidence.                          |
| Evidence to capture      | Mint/access/expiry timestamps and status codes with URLs redacted; audit lifecycle for Admin.                                                                                                                            |
| Severity if failed       | S0.                                                                                                                                                                                                                      |
| Notes                    | Possession of a signed URL is inherently bearer access during its TTL; evidence handling must not leak it.                                                                                                               |

### UAT-66 — Realtime payloads expose no private data

| Field                    | Detail                                                                                                                                                                                                                                                                                    |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User role or perspective | Participants, unrelated customer, `ANON`, `ADMIN`                                                                                                                                                                                                                                         |
| Preconditions            | Offer, transaction, and Admin queue subscriptions available.                                                                                                                                                                                                                              |
| Test data setup          | Isolated channels/entities and separate browser contexts.                                                                                                                                                                                                                                 |
| Steps                    | Subscribe each perspective; trigger permitted changes; capture event envelope; disconnect/reconnect; compare refetched data; attempt broad/wrong-ID subscriptions.                                                                                                                        |
| Expected result          | Only authorised subscribers receive signals; payload is not trusted/applied and contains no sensitive entity data beyond safe event identity/time; unrelated/anon receive nothing; reconnect performs authoritative RLS-scoped refetch; duplicate/out-of-order signals do not corrupt UI. |
| Evidence to capture      | Redacted event-shape assertions, delivery matrix, network trace, post-refetch state.                                                                                                                                                                                                      |
| Severity if failed       | S0 for unauthorised delivery/private payload; S1 for reconnect/reliability only.                                                                                                                                                                                                          |
| Notes                    | Add the previously missing automated two-subscriber delivery test.                                                                                                                                                                                                                        |

## Localisation, responsive quality, and accessibility

### UAT-67 — Customer application Arabic RTL journey

| Field                    | Detail                                                                                                                                                                                                                                   |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User role or perspective | Arabic `CUSTOMER` moving through seller and buyer screens                                                                                                                                                                                |
| Preconditions            | EN/AR parity check green; Arabic remains visibly documented as draft/unreviewed.                                                                                                                                                         |
| Test data setup          | Mixed Arabic/English customer, community, and building names; representative listing/offer/transaction.                                                                                                                                  |
| Steps                    | Switch to Arabic; traverse auth gate, dashboard, marketplace/detail, listing wizard, offer thread, and transaction workspace; open forms/dialogs/timelines; switch language mid-route and refresh.                                       |
| Expected result          | Route/locale persists; document direction is RTL; layout/chevrons/actions mirror logically; money/reference/email/date/file names use readable LTR islands; mixed names wrap correctly; no missing-key/raw-enum/hardcoded-English crash. |
| Evidence to capture      | Desktop screenshots per journey, locale URLs, parity/hardcoded-string report, defect annotations.                                                                                                                                        |
| Severity if failed       | S2; S1 if core action becomes unusable or meaning is reversed.                                                                                                                                                                           |
| Notes                    | This is mechanical UAT, not Arabic legal approval.                                                                                                                                                                                       |

### UAT-68 — Admin application Arabic RTL journey

| Field                    | Detail                                                                                                                                                                                                          |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User role or perspective | Arabic `ADMIN`                                                                                                                                                                                                  |
| Preconditions            | Admin parity check green; scenario queues/data available.                                                                                                                                                       |
| Test data setup          | Mixed-language customer/listing/reference data.                                                                                                                                                                 |
| Steps                    | Switch Admin app to Arabic; navigate overview/search/lists/details; filter/paginate; perform publication and reason-coded action dialogs; inspect audit timeline and document-access flow.                      |
| Expected result          | Sidebar/header/table/card/dialog/timeline/pagination mirror correctly; values that must stay LTR remain readable; reason selection has no hidden default; status labels never show raw enum or missing message. |
| Evidence to capture      | Arabic screenshots at desktop and mobile, locale/parity report.                                                                                                                                                 |
| Severity if failed       | S2; S1 for blocked/ambiguous controlled action.                                                                                                                                                                 |
| Notes                    | Audit any English provider/product proper names as approved exceptions.                                                                                                                                         |

### UAT-69 — Mobile customer transaction journey

| Field                    | Detail                                                                                                                                                                                                                                                      |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User role or perspective | Buyer and seller at 320–430 px widths                                                                                                                                                                                                                       |
| Preconditions            | Mobile browser/project configured; scenario transaction across active stages.                                                                                                                                                                               |
| Test data setup          | Transaction with actions, long labels, timeline, upload, and dialog states.                                                                                                                                                                                 |
| Steps                    | Open list/workspace; use progress navigation and sticky next action; confirm details/deposit; upload fictional file; open cancellation/completion dialogs; rotate once; repeat a critical screen in Arabic.                                                 |
| Expected result          | No horizontal page overflow/clipping; sticky action never covers content; actions remain ≥44×44; keyboard/file picker/dialogs are usable; timeline/progress are readable; safe-area/virtual-keyboard behaviour is acceptable; mobile RTL mirrors correctly. |
| Evidence to capture      | Screenshots/video at 320/390/430 and Arabic, overflow/touch-target assertions, Playwright trace.                                                                                                                                                            |
| Severity if failed       | S2; S1 if a core task cannot complete.                                                                                                                                                                                                                      |
| Notes                    | Add automated mobile transaction coverage; listing/marketplace already have targeted mobile E2E.                                                                                                                                                            |

### UAT-70 — Mobile Admin publication review

| Field                    | Detail                                                                                                                                                                                                                         |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| User role or perspective | `ADMIN` at 320–430 px widths                                                                                                                                                                                                   |
| Preconditions            | Pending publication; mobile Admin shell active.                                                                                                                                                                                |
| Test data setup          | Long property/customer values and checklist content.                                                                                                                                                                           |
| Steps                    | Navigate mobile menu; find queue card; open review; inspect public/private sections; return/approve in separate fixtures through reason dialog; rotate; repeat critical flow in Arabic.                                        |
| Expected result          | Desktop table becomes an accessible record-card presentation; no data/action is lost; menu/dialog/focus/touch targets work; impact and simulation copy remains visible; no horizontal document scroll; mobile RTL is coherent. |
| Evidence to capture      | Mobile screenshots/traces in EN/AR, table-to-card content parity checklist.                                                                                                                                                    |
| Severity if failed       | S2; S1 if review/action becomes unsafe or impossible.                                                                                                                                                                          |
| Notes                    | Add automated Admin mobile coverage.                                                                                                                                                                                           |

### UAT-71 — Keyboard-only offer flow

| Field                    | Detail                                                                                                                                                                                                                    |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User role or perspective | `CUSTOMER-BUYER` and `CUSTOMER-SELLER`, no pointer                                                                                                                                                                        |
| Preconditions            | Available listing and active negotiation; visible focus styles enabled.                                                                                                                                                   |
| Test data setup          | Scenario offer lane.                                                                                                                                                                                                      |
| Steps                    | Tab from skip link/nav through offer form; enter/review/submit; switch tabs/filters; open counter and accept/reject/withdraw dialogs; cancel and confirm; navigate timeline.                                              |
| Expected result          | Logical focus order; all controls reachable/operable; no trap; focus enters dialogs and returns to invoker; validation/error/status changes are announced; tabs have valid ARIA relationships; timeline remains semantic. |
| Evidence to capture      | Keyboard video/trace, focus-order notes, accessibility-tree snapshots for tabs/dialog/timeline.                                                                                                                           |
| Severity if failed       | S1 for inaccessible core action/trap; otherwise S2.                                                                                                                                                                       |
| Notes                    | Do not rely on axe alone.                                                                                                                                                                                                 |

### UAT-72 — Keyboard-only Admin controlled action

| Field                    | Detail                                                                                                                                                                                                   |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User role or perspective | `ADMIN`, no pointer                                                                                                                                                                                      |
| Preconditions            | Search, list/detail, and controlled action fixtures.                                                                                                                                                     |
| Test data setup          | Customer restriction and publication review lanes.                                                                                                                                                       |
| Steps                    | Use skip link; open global search; select result; navigate table/card; open action dialog; choose reason via keyboard; review/confirm/cancel; inspect toast/banner; return focus; navigate audit result. |
| Expected result          | Search/list/dialog/reason controls have correct roles and focus; no hidden default; cancel is non-mutating; confirm is disabled during submit; errors/success announce; focus restoration is correct.    |
| Evidence to capture      | Keyboard trace/video, focus and accessibility-tree notes, resulting audit link.                                                                                                                          |
| Severity if failed       | S1 for inaccessible/unsafe controlled action; otherwise S2.                                                                                                                                              |
| Notes                    | Include document-access acknowledgement in the keyboard matrix.                                                                                                                                          |

### UAT-73 — Axe scans across required major pages

| Field                    | Detail                                                                                                                                                                                                                                                                      |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User role or perspective | `ANON`, Customer owner/buyer/seller, and `ADMIN`                                                                                                                                                                                                                            |
| Preconditions            | All target pages provisioned in representative non-empty states; axe WCAG 2 A/AA configuration fixed.                                                                                                                                                                       |
| Test data setup          | Route matrix covering auth, homepage, marketplace/listing detail, listing steps/readiness/publication, saved, offer form/hub/thread/dialog, transaction list/workspace/deposit/documents/completion, Admin dashboard/customer/publication/offer/transaction/document/audit. |
| Steps                    | Run automated scans after page settles and after critical dialog/expanded states; repeat representative Arabic/RTL and mobile states; manually triage every finding.                                                                                                        |
| Expected result          | Zero serious or critical findings on every required state; all moderate/minor findings are logged and assessed; scans are not skipped; results include exact routes/states and tool version.                                                                                |
| Evidence to capture      | Machine-readable axe reports, summary table, screenshots/traces for failures, manual disposition.                                                                                                                                                                           |
| Severity if failed       | S1 for serious/critical; S2/S3 according to impact for lower levels.                                                                                                                                                                                                        |
| Notes                    | Count actual scans/analyse calls, not the stale Week-6 “5 axe pages” headline.                                                                                                                                                                                              |

## Post-Week-6 delta guard scenarios

These scenarios are required only when the corresponding current-tree delta is intentionally
included in the frozen RC baseline. They do not authorise expansion of those features.

### UAT-74 — Homepage search contract survives navigation

| Field                    | Detail                                                                                                                                                                                                             |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| User role or perspective | `ANON` and authenticated customer                                                                                                                                                                                  |
| Preconditions            | Current homepage/search UI included; marketplace browse route available.                                                                                                                                           |
| Test data setup          | Known community, property type, price range, and bedrooms with matching internal records.                                                                                                                          |
| Steps                    | Set each hero field separately and together; submit; edit URL; use Back/Forward; compare browse controls/results and schema/router input.                                                                          |
| Expected result          | Canonical parameter names (`location`, `propertyType`, `bedrooms`, plus agreed price keys) are preserved through hero, schema, router, and browse page; no filter is silently dropped; unknown values fail safely. |
| Evidence to capture      | Homepage/browse screenshots, URLs, request input, result assertions.                                                                                                                                               |
| Severity if failed       | S2; S1 if filtering returns materially misleading records.                                                                                                                                                         |
| Notes                    | This directly guards the previously identified all-layers parameter-rename risk.                                                                                                                                   |

### UAT-75 — Public permit verification reveals only the safe projection

| Field                    | Detail                                                                                                                                                                                                                                                              |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User role or perspective | `ANON` scanning/opening a permit reference                                                                                                                                                                                                                          |
| Preconditions            | Migration `0819` included; one verified active permit on LIVE listing and non-live/failed controls.                                                                                                                                                                 |
| Test data setup          | Case/whitespace variants, invalid/unknown number, LIVE and non-LIVE permits.                                                                                                                                                                                        |
| Steps                    | Open permit page/query valid number and variants; query unknown/failed/superseded/non-live records; inspect API/page source; follow public listing link when LIVE.                                                                                                  |
| Expected result          | Valid permit verifies case-insensitively; only approved active permit is disclosed; property fields/public link appear only for LIVE listing; private unit, owner, internal IDs, paths, and verification internals never appear; unknown cases are non-enumerating. |
| Evidence to capture      | Valid/invalid pages, public DTO allowlist, SQL/RLS function result matrix.                                                                                                                                                                                          |
| Severity if failed       | S0 for private/non-approved disclosure; otherwise S1.                                                                                                                                                                                                               |
| Notes                    | The page must not claim real Madmoun/DLD production validation.                                                                                                                                                                                                     |

### UAT-76 — BayutAPI is disabled by default and fails closed

| Field                    | Detail                                                                                                                                                                                                        |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User role or perspective | `ANON`                                                                                                                                                                                                        |
| Preconditions            | Bayut POC code included; first run with mode unset/disabled, second optional private run with mocked adapter failure.                                                                                         |
| Test data setup          | Internal LIVE listings; mocked external timeout/malformed/raw-sensitive response.                                                                                                                             |
| Steps                    | Load homepage/browse with integration disabled; verify no external network call; enable only in isolated mocked test; trigger timeout/error; inspect logs/public response.                                    |
| Expected result          | Disabled mode makes no provider call; internal product remains usable; provider failure returns no external results within timeout and never exposes key/raw payload/contact data; no error breaks core page. |
| Evidence to capture      | Network/log assertions, internal page screenshots, external empty/failure response.                                                                                                                           |
| Severity if failed       | S1; S0 for key/raw-sensitive-data exposure.                                                                                                                                                                   |
| Notes                    | Never use a real RapidAPI key in CI/UAT evidence.                                                                                                                                                             |

### UAT-77 — External property cards remain clearly separate and non-actionable

| Field                    | Detail                                                                                                                                                                                                                                                                  |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User role or perspective | `ANON` and authenticated customer                                                                                                                                                                                                                                       |
| Preconditions            | Optional mocked Bayut POC mode enabled in an isolated test.                                                                                                                                                                                                             |
| Test data setup          | Allowlisted external cards plus internal LIVE cards and duplicates.                                                                                                                                                                                                     |
| Steps                    | Load home/browse; inspect source/disclosure/order/deduplication; open external card; attempt Save/Offer; inspect link/image attributes and public DTO.                                                                                                                  |
| Expected result          | Internal results remain first-party; external section/card says External via BayutAPI and unaffiliated; no MARKAZ Save/Offer; link opens allowlisted HTTPS Bayut host with `noopener noreferrer nofollow`; only card allowlist crosses API; raw/contact data is absent. |
| Evidence to capture      | Card/section screenshots, link attributes, DTO allowlist/deduping assertions.                                                                                                                                                                                           |
| Severity if failed       | S1; S0 for private/raw data or unsafe URL injection.                                                                                                                                                                                                                    |
| Notes                    | Passing does not grant redistribution/legal approval.                                                                                                                                                                                                                   |

### UAT-78 — UAE PASS Staging identity-linking off-mode and boundary

| Field                    | Detail                                                                                                                                                                                                                                                                                                              |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User role or perspective | Email/password `CUSTOMER` at identity step                                                                                                                                                                                                                                                                          |
| Preconditions            | Current identity-linking delta included; automated lane uses mode off/mocked provider; optional manual lane requires authorised Staging tester.                                                                                                                                                                     |
| Test data setup          | New verified email account; mocked cancellation/error/already-linked responses.                                                                                                                                                                                                                                     |
| Steps                    | With mode off, open step; with Staging flag in mocked lane, start link and inspect allowlisted callback/next; test cancel/error/already-linked; verify no simulation controls; test forged `VERIFIED_STAGING`. Optional manual tester completes a real Staging round trip separately.                               |
| Expected result          | Off mode shows safe unavailable/sign-out; Staging option is server-gated and uses `linkIdentity`, not new sign-in; callback next is allowlisted; failures are safe/non-enumerating/retryable; status is derived server-side from provider identity; client forgery fails; no code/token/provider payload is logged. |
| Evidence to capture      | Off/on/error screens, callback allowlist tests, server-status/RLS tests, secret scan; optional manual result without identity data.                                                                                                                                                                                 |
| Severity if failed       | S0 for account mis-link/token/provider-data leak/status forgery; otherwise S1.                                                                                                                                                                                                                                      |
| Notes                    | Real UAE PASS production integration is out of scope. Manual Staging inability must not block downstream fixture-based UAT.                                                                                                                                                                                         |

### UAT-79 — Current public footer and homepage chrome are coherent

| Field                    | Detail                                                                                                                                                                                                                                                            |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User role or perspective | `ANON` at desktop/mobile and English/Arabic                                                                                                                                                                                                                       |
| Preconditions            | Current homepage image, public layout, logo/nav/footer revisions included.                                                                                                                                                                                        |
| Test data setup          | No special domain data required.                                                                                                                                                                                                                                  |
| Steps                    | Open homepage at target widths/locales; verify logo/nav/auth actions/search/hero image attribution policy/footer quick links/contact/copyright; tab through links; open each implemented destination.                                                             |
| Expected result          | MARKAZ logo/tokens are consistent; text remains legible over image; header/footer do not obscure content; every link has a valid destination or is deliberately non-interactive; no placeholder/dead link or false contact/legal claim; RTL/mobile remain usable. |
| Evidence to capture      | Desktop/mobile EN/AR screenshots, keyboard/link audit, contrast result.                                                                                                                                                                                           |
| Severity if failed       | S3; S2 for dead primary navigation or inaccessible content.                                                                                                                                                                                                       |
| Notes                    | This is hardening of the current design, not permission for a large redesign.                                                                                                                                                                                     |

---

# 6. Security and privacy test plan

## 6.1 Test layers

Security sign-off requires all five layers. A UI-only denial is never enough.

| Layer               | Method                                                                                                                | Required proof                                                                                 |
| ------------------- | --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Route/UI            | Direct navigation, control inspection, cached/back navigation, locale variants                                        | Safe redirect/not-available; no sensitive RSC/HTML content; no unauthorised control            |
| API/projection      | tRPC calls with anon/customer/participant/Admin contexts; response allowlist snapshots                                | Correct procedure tier; minimal DTO; safe errors; no internal/private fields                   |
| Database/RLS        | Live Postgres under `anon` and per-user `authenticated` claims; direct SELECT/INSERT/UPDATE/DELETE and function calls | Expected rows only; denied writes; actor derived by DB; guards and grants active               |
| Storage/signed URL  | List/upload/download/remove/mint attempts across buckets and perspectives                                             | Private objects isolated; paths absent from DTO/log; URL lifetimes and purpose enforced        |
| Realtime/audit/logs | Multi-context subscriptions, reconnect, event inspection, audit metadata scan, structured-log scan                    | Authorised signal delivery only; payload not trusted; audit immutable; no secrets/private data |

## 6.2 Access-control matrix

Execute this matrix against live local services. “No access” means no row/payload and a
safe, non-enumerating response.

| Resource/action                              | ANON                | Owner/participant                                             | Other CUSTOMER         | ADMIN                                  |
| -------------------------------------------- | ------------------- | ------------------------------------------------------------- | ---------------------- | -------------------------------------- |
| Marketplace `LIVE` public projection         | Read                | Read                                                          | Read                   | Read                                   |
| Draft/ready/paused/sold private base rows    | No                  | Owner read/valid controlled write                             | No                     | Capability-scoped read/control         |
| Ownership document content                   | No                  | Uploader/owner short-lived access                             | No                     | Purpose + capability + audit           |
| Draft photo content                          | No                  | Owner signed access                                           | No                     | Purpose + capability + audit           |
| Public listing photos                        | Read                | Read                                                          | Read                   | Read                                   |
| Save LIVE listing                            | Sign-in intent only | Allowed only when not owner                                   | Allowed when not owner | No customer action                     |
| Offer thread/proposals/events                | No                  | Buyer and listing-owner seller read; functions for valid turn | No                     | Read; narrow close-invalid control     |
| Seller notification threshold/classification | No                  | Seller only                                                   | Buyer/other no         | Minimum required operational view only |
| Transaction/tasks/events                     | No                  | Buyer/seller read and controlled functions                    | No                     | Read/recovery capability               |
| Transaction document content                 | No                  | Uploader only; other party completeness only                  | No                     | Purpose + capability + audit           |
| Profiles                                     | No                  | Own read/allowed fields; no account-type/restriction write    | No                     | Capability-scoped, minimised           |
| Admin notes/audit/queues                     | No                  | No                                                            | No                     | Capability-scoped                      |
| Audit mutation                               | No                  | No                                                            | No                     | **No**—immutable even for Admin        |
| Customer/Admin impersonation                 | No                  | No                                                            | No                     | No                                     |

## 6.3 Required automated security suites

1. **Authentication**
   - duplicate-email anti-enumeration for both provider behaviours;
   - generic bad-credential and forgot-password responses;
   - verification code limited to signup; recovery limited to link flow;
   - invalid/reused recovery link;
   - session invalidation after password reset/sign-out;
   - no tokens/codes/passwords in logs, URLs, audit, or application tables.
2. **Identity/account**
   - CUSTOMER cannot set `account_type=ADMIN`;
   - Admin cannot be created by public signup;
   - post-auth routing verifies email before onboarding/profile/identity;
   - `VERIFIED_STAGING` can only be recorded by the server after provider identity
     confirmation when the current delta is included;
   - callback `next` accepts only explicit allowlisted routes.
3. **Marketplace/public projection**
   - security-barrier view returns only `LIVE` with non-null public ID;
   - explicit card/detail mapper allowlists;
   - no unit identifier, owner/internal UUID, document/path, private investment input,
     threshold, request/audit data, or draft photo;
   - public permit function returns only its `0819` safe fields and reveals unpublished
     property metadata to nobody.
4. **Offer/transaction/Admin functions**
   - direct customer writes denied;
   - Security Definer functions derive actor and validate state/version/turn;
   - other buyer/seller/customer reads denied;
   - proposal, accepted amount, transaction identity, and audit immutability;
   - Admin capability-required denial for every controlled procedure;
   - reason must be a closed enum and cannot default silently.
5. **Storage**
   - object-path ownership and transaction-prefix validation;
   - MIME/size/type restrictions at both UI/API and database/function boundaries;
   - customer cannot write public photo bucket or `public_path`;
   - document signed URL restricted to uploader/Admin purpose;
   - deleted/expired/missing object behaviour and no orphaned authoritative row.
6. **Notifications/Realtime/audit**
   - notification payload discriminated-union safe fallback;
   - recipient-only notification RLS;
   - no seller threshold/private provider data in payload;
   - offer/transaction/Admin queue subscriptions scoped by RLS;
   - payload used only to trigger refetch;
   - audit metadata allowlist and grant-level immutability;
   - document access `REQUESTED → GRANTED|FAILED` order and truthful result.

## 6.4 Secret and private-data scan

Run a repository and runtime scan covering:

- `.env*`, built client chunks, RSC payloads, network responses, console/server logs,
  Playwright traces, screenshots metadata, and generated reports;
- `SUPABASE_SERVICE_ROLE_KEY`, database URLs/passwords, UAE PASS client secret,
  RapidAPI key, access/refresh tokens, OAuth callback code, signup/recovery token,
  passwords, signed URLs, private Storage paths, Emirates ID/mobile/provider payload,
  private unit identifier, seller threshold, and raw provider responses;
- internal database UUIDs in customer-facing UI. Opaque `public_id`, human-safe listing/
  transaction references, and IDs required in private API routing are permitted only where
  explicitly designed; raw UUIDs must not render as customer/Admin labels.

Any secret in a committed artifact or client bundle is S0. A private internal identifier
displayed without need is at least S2 and becomes S0 if it enables or accompanies data access.

## 6.5 Security exit gate

- All live-DB/RLS/Storage integration tests execute with zero skips.
- Access matrix is fully green.
- Projection snapshots match their allowlists.
- Signed-URL expiry tests pass.
- Multi-subscriber Realtime delivery/privacy test passes.
- No unresolved Security, RLS, Storage privacy, audit integrity, auth enumeration, or
  secret-exposure defect exists.

---

# 7. State-machine test plan

## 7.1 Canonical models and invariants

| Model               | Valid progression/derivation                                                                     | Invariants to re-prove                                                                                                                        |
| ------------------- | ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Listing             | `DRAFT → READY_TO_PUBLISH → LIVE ↔ PAUSED`; completion → `SOLD_DEMO`                             | Readiness server-computed; `REJECTED` remains unreachable/reserved; material edits require pause/review; no non-LIVE public projection        |
| Publication request | `NOT_SUBMITTED → PENDING → APPROVED_DEMO or REJECTED_DEMO`; retry creates/supersedes request     | Separate from listing state; one active request; resolve-time gate; stable public ID; photo/DB compensation; idempotent resolve               |
| Offer thread        | `DRAFT → AWAITING_SELLER ⇄ AWAITING_BUYER → terminal`                                            | One active thread per buyer/listing; immutable proposals; explicit next actor; single accepted thread; expiry server-authoritative            |
| Offer availability  | `AVAILABLE`, `UNDER_OFFER`, or `OFFERS_DISABLED` derived from listing/accepted transaction state | Never stored as listing state; accepted LIVE remains public; cancellation removes Under Offer; paused/sold blocks                             |
| Transaction         | Accepted offer → 17 tasks/6 stages → `COMPLETED_DEMO`, or cancellation/failure path              | One per thread and proposal; immutable participants/amount/reference; status/next actor derived from tasks; all completion/cancellation gates |
| Admin recovery      | Restrict/restore, pause/resume, retry/recover/mark failed through reason-coded functions         | Capability/actor/state rechecked; no customer impersonation; immutable facts preserved; audit append-only                                     |

## 7.2 Transition test method

For every transition:

1. Record pre-state, version, current actor, required task/request/proposal, object count,
   and relevant immutable-row digest.
2. Execute the valid action once.
3. Assert post-state, version increment, next actor, derived availability, related
   notifications/events/audit, and UI copy.
4. Repeat the same request with the original and current version to verify idempotent or
   safe-stale behaviour.
5. Execute the action as every wrong perspective.
6. Execute from an invalid predecessor and a terminal state.
7. Re-read from a second browser/tab and direct database context.
8. Assert immutable digest and unrelated entity row counts are unchanged.

## 7.3 Conflict and concurrency matrix

| Race/conflict                      | Execution                                     | Pass condition                                                                                 |
| ---------------------------------- | --------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Two tabs save same listing step    | Same expected version, separate tabs          | One valid update; other gets safe stale conflict/refetch; no overwritten newer data            |
| Edit while publication pending     | Owner edit vs Admin/automatic resolve         | Stale request superseded/rejected; never flips ineligible listing LIVE                         |
| Publication photo failure          | Fault at selected copy index                  | All prepared public objects/paths compensated; listing non-LIVE; retry uses deterministic keys |
| DB failure after photo preparation | Fault before atomic LIVE tx                   | Public objects/paths compensated; request retryable/PENDING; no half-published listing         |
| Two competing offer accepts        | Separate DB connections, same listing         | Exactly one accepted; all others closed; no partial state                                      |
| Two accepts on same thread         | Parallel calls                                | One winner; one accepted proposal/thread only                                                  |
| Counter/accept from stale tab      | Old version/actor                             | Safe stale/not-actionable error; no appended invalid proposal                                  |
| Pause vs counter/accept            | Concurrent listing pause and offer mutation   | Serialised safe outcome; paused listing has no actionable thread                               |
| Duplicate transaction creation     | Buyer/seller parallel calls                   | Same transaction returned; one task set/event set                                              |
| Two transaction actions            | Same current task/version                     | One state change; stale call rejected; progress correct                                        |
| Completion vs cancellation         | Separate participants/tabs                    | One valid terminal path; never completed and cancelled; listing matches winner                 |
| Admin pause vs participant action  | Separate contexts                             | One authoritative result; participant cannot advance while paused                              |
| Admin action from stale queue      | Old entity version/status                     | Conflict shown; no duplicate/invalid audit                                                     |
| Realtime duplicate/out-of-order    | Inject/order signals without trusting payload | At most debounced refetch; final UI equals authoritative DB                                    |

## 7.4 State-machine evidence

- Machine-readable transition test results.
- Before/after status/version/next-actor/task snapshots.
- Immutable-row digests and row counts.
- Public/private Storage object inventories with paths redacted.
- Event, notification, and audit type sequences.
- Concurrency traces showing separate connections/contexts and the one-winner result.
- UI screenshots for conflict, unavailable, retry, returned, paused, completed, and
  cancelled states.

---

# 8. Accessibility test plan

## 8.1 Required page/state matrix

| App                   | Required states                                                                                                                                                                            |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Public/auth           | Homepage; sign-up; verify-email; sign-in error; forgot/reset; identity off/error; marketplace browse/empty/error; property detail; public permit valid/not-found                           |
| Customer seller       | Dashboard; My Listings empty/populated; listing details/ownership/photos/review; ready; publication pending/returned; manage LIVE/PAUSED                                                   |
| Customer buyer/offers | Saved empty/populated; offer form validation/review; Offers tabs; seller inbox; thread; counter/accept/reject/withdraw dialogs; accepted/Under Offer                                       |
| Transaction           | List empty/populated; workspace at confirmation/deposit/documents/transfer/completion/cancelled; upload error; cancellation dialog; Realtime reconnect                                     |
| Admin                 | Login/access-denied; dashboard; search; customer/list/detail; publication list/review/dialog; offer detail; transaction detail/recovery; document-access dialog/expired; audit list/detail |

## 8.2 Automated checks

- Run axe after content settles and again for each opened dialog, expanded navigation,
  validation-error state, and dynamic success/error banner.
- Tags: WCAG 2.0/2.1 A and AA as supported by the pinned axe version; record the exact
  tool/browser version.
- Fail immediately on serious/critical findings. Log and triage moderate/minor findings.
- Add static lint/component assertions for label associations, valid ARIA references,
  `aria-current`, live-region use, semantic list/timeline/progress structure, table caption/
  headers, and icon-plus-text statuses.
- Run representative axe scans in Arabic and mobile layouts because hidden/duplicated
  responsive markup can create different defects.

## 8.3 Manual checks

1. **Keyboard:** Tab/Shift+Tab order, Enter/Space, Escape, arrow-key tabs/menus, no
   positive tabindex, no trap outside modal, visible focus, focus restoration.
2. **Forms:** persistent labels, instructions before action, field errors associated and
   announced, error summary links where used, password requirements not colour-only,
   six-digit code exposed as one logical input.
3. **Dialogs:** title/description, initial focus, contained focus, Escape/cancel,
   submit-in-progress prevention, return focus, no hidden default reason.
4. **Dynamic status:** polite/assertive use appropriate to impact; loading/retry/success/
   conflict/Reconnect messages understandable without visual badge colour.
5. **Structure:** one page H1, ordered headings, landmarks, skip link, semantic tables and
   captions, progress `aria-current=step`, timeline ordered list with actor/time.
6. **Upload:** accessible file control, allowed-format/size instructions, progress and
   error announcements, removal confirmation.
7. **Screen reader:** VoiceOver/NVDA smoke for one complete customer offer flow and one
   Admin action; names/roles/states, reading order, dialog and live-region behaviour.
8. **Visual:** contrast in enabled/hover/focus/error/disabled states; 200% zoom and text
   spacing; content reflow at 320 CSS px; no information by colour alone.
9. **Motion/touch:** `prefers-reduced-motion` respected; no essential motion; minimum
   44×44 CSS-pixel target for core controls; adequate spacing against accidental activation.

## 8.4 Accessibility pass criteria

- Zero serious/critical axe findings on every required state.
- Zero keyboard trap or pointer-only core action.
- Core error/status/confirmation is announced and understandable.
- Screen-reader smoke journeys complete without an inaccessible blocker.
- Lower-severity findings are logged with impact and disposition; no cluster of S3 issues
  makes a core journey materially unusable.

---

# 9. Arabic and RTL test plan

## 9.1 Mechanical localisation gates

- Flatten `packages/i18n/messages/en.json` and `ar.json`; exact key parity, no duplicate
  keys, and valid interpolation/plural parameters.
- Confirm every server/client translation lookup used by the current RC exists in both
  locales, including unknown-enum fallbacks.
- Scan changed TS/TSX for user-facing hardcoded strings. Document approved technical/
  brand/reference exceptions.
- Build both locales in both apps; no `MISSING_MESSAGE`, hydration mismatch, or raw
  translation key.
- Keep a visible release-note limitation: Arabic is machine-draft and not business,
  legal, financial, regulatory, or operationally approved.

## 9.2 Visual/interaction matrix

| Pattern                 | Required checks                                                                                                                            |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Shell/navigation        | `dir=rtl`, logical spacing, sidebar/drawer/header order, language switch persistence, mirrored directional icons only                      |
| Forms/dialogs           | Labels/errors, field order, password/code/AED LTR islands, button order follows approved RTL logic, focus unaffected                       |
| Tables/cards/pagination | Column/card content parity, numeric alignment, next/previous semantics and icon mirroring, no clipped long Arabic text                     |
| Timelines/progress      | Visual direction and semantic chronological order both correct; actors/dates/references readable                                           |
| Search/filter           | Arabic/mixed-language input, chips, popovers, result navigation, URL state                                                                 |
| Upload/files            | File names remain readable LTR/auto; controls and progress align logically                                                                 |
| Currency/date/reference | AED and numbers not reversed; human reference/email/UUID-like tokens use LTR isolation; dates follow chosen locale convention consistently |
| Mixed names             | Arabic person/community plus English building/project wraps and is read in sensible order                                                  |
| Mobile RTL              | Drawer, cards, sticky action, dialog, timeline, keyboard/viewport and safe areas                                                           |

## 9.3 Arabic evidence and pass criteria

- Key parity report with counts measured from the RC, not copied from milestone reports.
- Desktop/mobile screenshots for UAT-67/68 plus core dialog/timeline/table patterns.
- Hardcoded-string scan and approved-exception list.
- No missing key, raw enum, reversed action meaning, unreadable LTR token, or blocked core
  action.
- Professional/legal review remains an explicit Week 8/production gate; Week 7 cannot
  waive it.

---

# 10. Mobile test plan

## 10.1 Viewports and devices

- Automated Chromium: 320×640, 375×812, 390×844, 430×932, 768×1024, and desktop
  reference.
- At least one WebKit mobile emulation and, where available, one physical iOS or Android
  browser smoke test.
- Test portrait and one landscape transition; 100% and 200% zoom where applicable.
- Repeat the core transaction and Admin publication flow in Arabic RTL.

## 10.2 Customer matrix

- Homepage hero image/search/header/footer, including long labels and keyboard focus.
- Marketplace filter/search/card/detail, pagination, no-results and provider-error state.
- Auth and verification forms with virtual keyboard and autofill.
- Dashboard and authenticated shell/navigation.
- Listing wizard stepper/progress, long validation errors, ownership/photo upload, preview,
  readiness, and publication/manage actions.
- Saved cards and unavailable stubs.
- Offer amount/review, Offers tabs/inbox, thread timeline, counter/accept/reject/withdraw
  dialogs.
- Transaction list/workspace, sticky action, stage progress, deposit, document upload,
  timeline, cancellation and completion.

## 10.3 Admin matrix

- Login/access-denied.
- Sidebar/drawer, header/global search, queue counters.
- Desktop table-to-mobile-card content/action parity.
- Filters/pagination/no-results/loading/error.
- Customer/listing/publication/offer/transaction/audit detail layouts.
- Reason-coded dialogs, document purpose/acknowledgement, expired signed URL, recovery
  controls.

## 10.4 Mobile pass criteria

- No horizontal page-level overflow at target widths.
- No content/control clipped behind sticky header/footer/action or safe area.
- Every core action remains visible, labelled, and ≥44×44 CSS pixels.
- Modal/drawer fits viewport, scrolls internally when needed, and works with virtual keyboard.
- Table-to-card conversion preserves every decision-critical field.
- Upload/file picker can complete and recover from error.
- Mobile RTL passes the same criteria.

---

# 11. Performance and reliability test plan

## 11.1 Measurement rules

- Measure a production build, not hot-reloading development mode.
- Record machine, CPU/RAM, Docker allocation, browser, cold/warm cache, fixture volume,
  locale, commit SHA, and external modes.
- Run three warm samples and report median plus worst; retain raw output.
- Separate application performance from Docker/resource exhaustion. Serialise web/Admin E2E
  on constrained hosts, but do not conceal a product deadlock as an environment issue.
- Establish the RC baseline before optimisation; compare any fix on the same environment.

## 11.2 Workload matrix

| Area                    | Workload                                                          | Observe                                                                                    |
| ----------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Public home/marketplace | Cold and warm home, browse, filter, sort, page changes, detail    | LCP/CLS/INP observation, RSC/API timing, image loading, duplicate requests, cache/fallback |
| Auth/session            | Sign-in, verification route, recovery callback, sign-out          | Request count, redundant session/profile fetch, redirect loops, expired-session recovery   |
| Listing                 | Open/resume/save each major step; multi-photo upload              | Query count, optimistic conflict, upload progress/retry/orphans, signed URL requests       |
| Offers                  | Inbox/listing offers/thread/action and Realtime update            | Lazy expiry query, repeated fetches, timeline payload size, reconnect/refetch              |
| Transactions            | List/workspace at multiple stages, document upload, timeline      | Task/document query count, N+1, projection size, sticky UI responsiveness                  |
| Admin                   | Dashboard, global search, paginated lists/details, queue Realtime | Query count/latency, bounded search, count queries, mobile card duplication                |
| External POC            | Disabled mode and mocked five-second timeout                      | No call when off; internal source remains usable; bounded failure                          |

## 11.3 Database/query review

- Enable/use `pg_stat_statements` per `docs/runbooks/measurement.md`.
- Capture top queries by total and mean time for the workload matrix.
- Use `EXPLAIN (ANALYZE, BUFFERS)` only on isolated local fixtures for slow queries.
- Check indexes for marketplace filters/sort, upper-trimmed permit lookup, publication
  active requests, active/accepted offer uniqueness, transaction participant/status,
  Admin filters/search, notifications recipient/read status, and audit time/entity filters.
- Look for per-row follow-up queries in marketplace cards, transaction tasks/documents,
  Admin list rows, and notification counts.
- Confirm every list is bounded/paginated and stable-sorted.

## 11.4 Failure/recovery matrix

| Failure                      | Expected behaviour                                                                                     |
| ---------------------------- | ------------------------------------------------------------------------------------------------------ |
| Slow initial data            | Intentional skeleton/status; no blank page or duplicate action                                         |
| API/network offline          | Safe error with retry; retained user input where safe; no false success                                |
| Auth session expiry          | Safe sign-in/session-expired destination; no private cached page; post-auth return only if allowlisted |
| Upload timeout/rejection     | Progress ends; clear error/retry; no authoritative orphan row; partial object cleanup documented       |
| Realtime disconnect          | Unhealthy banner; state remains correct; reconnect refetches; no payload trust                         |
| Publication photo/DB failure | Full compensation and deterministic retry                                                              |
| Stale/version conflict       | Clear conflict and authoritative refetch; no last-write-wins corruption                                |
| Provider timeout             | Fail closed; internal source remains; safe stable log code                                             |
| App refresh mid-mutation     | Idempotent result or clear recoverable state                                                           |
| Docker resource pressure     | Test reports environment evidence; serial rerun; no blanket timeout increase without root cause        |

## 11.5 Performance/reliability pass criteria

- No unbounded list, obvious N+1, missing critical index, redirect loop, repeated session
  fetch regression, blank async screen, or unrecoverable safe-network failure.
- No unexplained >20% regression from the frozen comparable baseline on a core page/action.
- Provider and upload failures are bounded and do not corrupt state.
- Realtime reconnect and session-expiry paths are demonstrably recoverable.
- Bundle warnings and route-size changes are recorded; unexpected large growth has an owner/
  explanation before RC.

---

# 12. Regression test plan

## 12.1 Clean-stack sequence

1. Record the exact RC SHA and environment manifest.
2. Verify Docker responds immediately and all configured URLs are loopback.
3. Stop the local Supabase stack without backup and start it fresh when the known reset hang
   applies; capture migration logs through the actual highest migration (`0819` if included).
4. Run the optional env-driven Admin bootstrap only for the isolated UAT Admin.
5. Confirm Mailpit, API, Postgres, Studio, web `:3000`, and Admin `:3001` health.
6. Run formatting check, typecheck, lint, full unit/component/integration suite, and both builds.
7. Run web and Admin Playwright suites **serially** on constrained Docker.
8. Run manual UAT and targeted quality tests.
9. After defect fixes, rerun the affected unit/component/integration/E2E tests, its parent
   journey, and the core smoke pack.
10. For final certification, repeat the entire sequence on the frozen RC commit.

The expected command families are:

- `pnpm format:check`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm test` with the full local stack and zero integration skips
- `pnpm build`
- web E2E workspace command
- Admin E2E workspace command

The root concurrent `pnpm test:e2e` may be recorded only on a host with sufficient Docker
memory. Serial workspace results are the authoritative local RC evidence. Any skip, retry, or
flake must appear in the report; “green after retry” is not equivalent to a clean pass.

## 12.2 Core regression journeys

| ID   | Journey                  | Minimum route/state coverage                                                                                                          |
| ---- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| RG-1 | Customer authentication  | Signup → code verify → authoritative onboarding gate; sign-in/out; recovery link; session expiry                                      |
| RG-2 | Seller                   | Create draft → ownership/photo uploads → simulated checks → ready → submit → Admin approve → LIVE → pause/resume                      |
| RG-3 | Buyer                    | Anonymous browse/save intent → authenticated save → offer → counter → accept → Under Offer                                            |
| RG-4 | Negotiation competition  | Multiple buyers → concurrent/single acceptance → other threads close → privacy preserved                                              |
| RG-5 | Transaction completion   | Idempotent creation → dual confirmations → deposit/documents/checks/transfer → `COMPLETED_DEMO`/`SOLD_DEMO`                           |
| RG-6 | Transaction cancellation | Early and mutual cancellation → `CANCELLED`/listing `PAUSED` → explicit resume rules                                                  |
| RG-7 | Admin operations         | Dashboard/search → restriction/restore → publication return/approve → offer read-only → document audit → transaction recovery → audit |
| RG-8 | Cross-cutting quality    | EN/AR parity, RTL, mobile transaction/Admin, keyboard offer/Admin, axe, Realtime reconnect                                            |
| RG-9 | Current-tree deltas      | Homepage query contract, permit safe projection, UAE PASS off/mocked boundary, Bayut disabled/fail-closed                             |

## 12.3 Test reliability rules

- No `.only`, accidental permanent skip, dependence on execution order, shared seeded customer,
  or hosted-network dependency.
- Tests generate unique fixture prefixes and wait on observable state, never arbitrary sleeps.
- A timeout increase requires trace evidence that the product is correct and the prior budget
  was environment-inappropriate; it cannot mask a missing wait/state assertion.
- A flaky test is a defect in the test or product. Quarantine is allowed only with RC lead
  approval, a linked S2/S3 defect, bounded scope, and no removal from a core release gate.
- Final core E2E pack passes twice consecutively without retry on the RC host. The complete
  serial web/Admin suites pass at least once with zero skips/retries/failures.

---

# 13. Admin operations test plan

## 13.1 Capability verification

Exercise all 16 capabilities through positive Admin and negative customer/missing-capability
contexts:

`VIEW_OVERVIEW`, `VIEW_CUSTOMERS`, `MANAGE_CUSTOMER_STATUS`, `VIEW_LISTINGS`,
`REVIEW_PUBLICATION`, `MANAGE_LISTING_AVAILABILITY`, `VIEW_OFFERS`,
`CLOSE_INVALID_OFFER`, `VIEW_TRANSACTIONS`, `MANAGE_TRANSACTION_RECOVERY`,
`VIEW_VERIFICATIONS`, `RETRY_SIMULATION`, `VIEW_PRIVATE_DOCUMENT_METADATA`,
`ACCESS_PRIVATE_DOCUMENT`, `VIEW_AUDIT_LOGS`, and `ADD_ADMIN_NOTES`.

For every controlled action assert:

- the UI reflects capability but the server independently enforces it;
- actor is derived from the Admin session;
- an explicit closed reason is required and has no hidden default;
- current state/version is re-read;
- impact copy names what will and will not happen;
- immutable/customer-authored facts remain unchanged;
- one safe audit event/lifecycle is written;
- stale, duplicate, missing-capability, wrong-state, and failure paths are safe.

## 13.2 Operational area matrix

| Area          | Positive tests                                                              | Negative/recovery tests                                                             |
| ------------- | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Overview      | Metrics, queue links, recent actions, Realtime refetch                      | Partial query failure, reconnect, stale metrics                                     |
| Customers     | Search/filter/detail, restrict/restore, notes                               | Customer denial, self/Admin target rules, duplicate/stale action, append-only notes |
| Listings      | List/detail, privacy zones, pause/resume                                    | Ineligible/terminal resume, active offers closed, no ownership change               |
| Publication   | Queue/detail, approve/return, retry preparation                             | Stale/ineligible review, photo/DB compensation, owner notification RLS              |
| Verifications | List/detail, safe retry                                                     | Raw provider/error/path absence, wrong state, customer denial                       |
| Offers        | Read-only immutable timeline, narrow invalid close                          | Proposal/amount mutation denied, valid active thread not arbitrarily rewritten      |
| Transactions  | Detail/tasks/events, pause/resume/retry/mark failed/cancellation resolution | Participant action while paused, wrong-state recovery, immutable facts              |
| Documents     | Metadata, purpose/acknowledgement, 300s access                              | Missing capability/reason, expired/failed mint, exact audit lifecycle               |
| Audit         | Filter/paginate/detail                                                      | Update/delete/truncate denied, unsafe metadata absent                               |

## 13.3 Admin quality checks

- Separate origin/app and no customer-bundle Admin surface.
- Customer credentials always denied and Admin credentials never create customer actions.
- Desktop semantic table and mobile record-card content parity.
- Search/filter/pagination URL state, focus, loading/empty/error/conflict handling.
- Status text plus icon; unknown enum fallback does not crash.
- Arabic/RTL and mixed-language search.
- References, AED, dates, file names, emails, and IDs formatted/readable without exposing
  unnecessary raw identifiers.
- Audit links connect each controlled action to its evidence.

## 13.4 Admin exit gate

- All capabilities and operational areas have positive and negative evidence.
- UAT-41 through UAT-56 and UAT-68/70/72 pass.
- No Admin mutation changes immutable offer/transaction facts or creates a customer artifact.
- No private document is viewed without purpose, acknowledgement, capability, signed URL,
  and truthful audit.
- Customer/anon receive zero Admin data through UI, API, RLS, Storage, or Realtime.

---

# 14. Defect taxonomy

## 14.1 Severity definitions

Response times apply during the active Week 7 test window. “Acknowledge” means an owner is
assigned and evidence is preserved; “triage” means severity/category/reproduction/scope are
confirmed. A failed test is not closed by rerunning it until green without understanding why.

| Severity                 | Meaning                                                                                                                                                                                                                  | MARKAZ examples                                                                                                                                                                                                                                                                                                                                                   | Required response time                                                                                                 | RC impact                                                                                                                                                                                                              | Evidence required                                                                                                                                                               | Fix verification required                                                                                                                                                                                                             |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **S0 — Release blocker** | Active or credible path to unauthorised access, secret exposure, irreversible data corruption, privilege escalation, false terminal state, or a system-wide inability to test safely. Stop affected testing immediately. | CUSTOMER reaches Admin data; cross-customer offer/transaction/document read; service-role/UAE PASS/RapidAPI secret in client/log/trace; customer forges LIVE/ACCEPTED/COMPLETED/ADMIN; two accepted offers; audit mutation; public private-path/unit disclosure; transaction both completed and cancelled; tests point to production.                             | Acknowledge within 15 minutes; triage within 30 minutes; containment immediately; fix before affected testing resumes. | Always blocks RC and go/no-go. No exception/waiver.                                                                                                                                                                    | Minimal reproducible steps; RC SHA/env; request/response; before/after state; affected identities/entities; redacted logs/trace; containment record; exposure/corruption scope. | Independent verifier; new automated regression at the lowest authoritative layer; affected security matrix and full parent journey; clean-stack full suite; evidence that leaked credentials/data were rotated/cleaned if applicable. |
| **S1 — Critical**        | Core journey is unusable or dangerously misleading; state/recovery/a11y failure has no reasonable workaround; non-exploited security control is absent or failing.                                                       | Signup/recovery impossible; draft cannot reach ready; publication cannot safely resolve; offer counter/accept broken; transaction cannot complete/cancel; Admin cannot recover; keyboard trap on core action; serious/critical axe finding; signed URL fails expiry check without demonstrated disclosure; simulated flow claims real payment/legal verification. | Acknowledge within 1 hour; triage and fix plan within 4 hours; target fix within 1 business day.                       | Always blocks RC until fixed and verified.                                                                                                                                                                             | Repro, expected/actual, scope, screenshots/trace, console/network, state/version/audit, accessibility output where relevant.                                                    | Focused automated test; independent rerun; affected UAT scenario; parent core journey; relevant security/a11y/localisation suite; no regression in full suite.                                                                        |
| **S2 — Major**           | Important function is materially degraded, inconsistent, slow, or inaccessible but a safe workaround exists and core data remains correct/private.                                                                       | Mobile transaction step needs desktop workaround; Admin filter loses URL state; recoverable upload leaves confusing UI but no orphan; significant RTL action-order issue; persistent >20% performance regression; flaky non-security E2E; non-core loading/error state absent.                                                                                    | Acknowledge within 4 hours; triage same business day; target fix within Week 7.                                        | Blocks if on a core journey, repeated, or without safe workaround. Otherwise only a documented, owned, explicitly approved conditional-RC exception is possible. Never waive a Security/RLS/Storage/data-integrity S2. | Repro and affected matrix; workaround; frequency; screenshots/trace/timing; state-integrity proof.                                                                              | Focused test and scenario rerun; adjacent responsive/locale/state checks; owner/QA approval. Accepted exception needs rationale, owner, due date, and Week 8 disposition.                                                             |
| **S3 — Minor**           | Localised defect with low impact; journey remains safe and understandable.                                                                                                                                               | One secondary empty-state inconsistency; minor focus-return issue outside core path; isolated spacing/wrapping; non-critical copy inconsistency; moderate axe issue with an accessible alternative.                                                                                                                                                               | Acknowledge/triage within 1 business day; fix if low risk during Week 7 or assign backlog owner.                       | Does not normally block. A cluster, repeated pattern, or impact on trust may be raised to S2.                                                                                                                          | Screenshot/repro, route/locale/viewport, expected reference, affected count.                                                                                                    | Focused check; component/screenshot/axe rerun as applicable; no broad regression required unless shared component changed.                                                                                                            |
| **S4 — Polish**          | Cosmetic refinement with no effect on correctness, comprehension, accessibility, privacy, or task completion.                                                                                                            | Pixel-level alignment, non-essential transition smoothness, minor visual mismatch to a reference, optional copy elegance.                                                                                                                                                                                                                                         | Triage within 2 business days or at final bug scrub.                                                                   | Does not block RC; may be deferred.                                                                                                                                                                                    | Screenshot and reference/desired outcome.                                                                                                                                       | Visual review if fixed; no formal independent sign-off unless shared tokens/components changed.                                                                                                                                       |

## 14.2 Defect categories

| Category           | Definition and minimum handling                                                                                                                                          |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Security           | Authz/authn, secret, injection, unsafe URL, provider/account-linking, or sensitive-data exposure. Any credible unauthorised access is S0; no open Security defect at RC. |
| RLS                | Database policy, role/claim propagation, grant, Security Definer, or cross-context failure. Exploitable read/write is S0; live-DB regression mandatory.                  |
| Storage privacy    | Bucket/object policy, path, public/private boundary, upload prefix, signed URL, or deletion issue. Exposure/write bypass is S0.                                          |
| Auth               | Signup, verification, sign-in, recovery, session, anti-enumeration, routing, or Admin provisioning.                                                                      |
| State machine      | Invalid transition, actor/turn, idempotency, derived state, stale/conflict, or terminal-state error.                                                                     |
| Data integrity     | Duplicate, lost history, immutable-field change, orphan, partial cross-system operation, wrong participant/amount/reference. Usually S0/S1.                              |
| Regression         | Previously verified behaviour broken by current change. Link the originating milestone/test.                                                                             |
| UX                 | Navigation, label, state feedback, dialog, timeline, formatting, or coherence problem.                                                                                   |
| Accessibility      | Keyboard, focus, semantic, announcement, contrast, zoom/reflow, reduced motion, touch target, or assistive-technology issue.                                             |
| RTL                | Mirroring, logical layout, bidi isolation, order/meaning, mixed-language, or RTL-only overflow.                                                                          |
| Mobile             | Responsive layout, safe area, virtual keyboard, touch, sticky action, table-to-card, or mobile-only task failure.                                                        |
| Performance        | Slow request/query, N+1, bundle growth, layout shift, unbounded data, timeout, memory/resource, or reliability degradation.                                              |
| Documentation      | Stale/contradictory setup, architecture, state, migration, scope, count, limitation, or runbook guidance.                                                                |
| Test reliability   | Flake, ordering/shared-data dependency, skip, retry masking, weak assertion, unsafe environment, or non-reproducible fixture.                                            |
| Copy/legal wording | False/misleading simulation, payment/legal/regulatory/identity claim; unreviewed Arabic presented as approved; unsafe operational reason copy.                           |

## 14.3 Defect record schema

Every entry in the Week 7 defect log must include:

- defect ID (`W7-<category>-<number>`);
- title, severity, category, status, owner, reporter, discovered date/time;
- RC branch/SHA, environment manifest, app/route/locale/viewport/browser;
- related UAT/test ID and originating milestone/spec/ADR;
- preconditions, isolated fixture prefix, exact steps, expected result, actual result,
  reproducibility rate;
- redacted screenshots/video/trace/log/network/query/state/audit evidence;
- security/privacy/data-integrity assessment and containment if relevant;
- workaround and affected users/journeys;
- root cause and changed files/migration, once known;
- fix commit/PR, focused regression test, verifier, verification evidence/date;
- disposition: closed, duplicate, cannot reproduce, accepted S2/S3 exception, or deferred
  S4. “Works on rerun” is not a disposition.

## 14.4 Lifecycle and triage

`NEW → TRIAGED → IN PROGRESS → READY FOR VERIFICATION → VERIFIED → CLOSED`

Alternative terminal states require QA lead approval: `DUPLICATE`, `NOT REPRODUCIBLE WITH
EVIDENCE`, or `ACCEPTED EXCEPTION`. Reopening occurs when the focused test, parent journey,
or clean-stack suite fails.

Daily bug scrub order:

1. S0 containment and fix.
2. S1 core/security/accessibility blockers.
3. S2 core journey, mobile/RTL, reliability, and documentation truthfulness.
4. S3 shared-component clusters.
5. S4 polish only after gates are safe.

---

# 15. Release-candidate checklist

Every item must carry an evidence link and named approver in `RELEASE-CANDIDATE.md`. A blank,
`NOT RUN`, skipped, or “assumed from Week 6” result is a failure for the current RC.

## 15.1 Baseline and environment

- [ ] Exact branch and commit SHA are frozen and recorded.
- [ ] Worktree/post-Week-6 delta inventory is complete; included/excluded changes are explicit.
- [ ] Migration history applies cleanly from a fresh stack through the actual highest migration.
- [ ] Drizzle typed mirror matches canonical SQL for current schema additions.
- [ ] UAT/test environment is loopback/isolated and cannot touch production.
- [ ] Node, pnpm, Docker, Supabase, OS, browsers, viewports, locale, and mode flags are recorded.
- [ ] BayutAPI is disabled by default; no real provider key is used in automated UAT.
- [ ] UAE PASS Staging is separated into an authorised manual/mocked lane; production is disabled.
- [ ] No customer/domain shared demo seed exists; Admin bootstrap is isolated and env-driven.

## 15.2 Defects and security

- [ ] All S0 and S1 defects are fixed, independently verified, and closed.
- [ ] No unresolved Security defect remains.
- [ ] No unresolved RLS defect remains.
- [ ] No unresolved Storage-privacy defect remains.
- [ ] No known data-corruption, duplicate-terminal-state, or immutable-history mutation path remains.
- [ ] CUSTOMER versus ADMIN, anon, cross-customer, buyer/seller, restricted-customer, and
      capability matrices pass at UI/API/RLS/Storage/Realtime layers.
- [ ] No secrets, tokens, callback codes, passwords, signed URLs, private paths, provider
      payloads, or unnecessary raw internal IDs appear in UI/client bundles/responses/logs/evidence.
- [ ] Public/offer/transaction/notification/Admin projections match explicit allowlists.
- [ ] Signed URLs are scoped, short-lived, expire, and are never logged/audited.
- [ ] Audit rows are immutable; document-access audit lifecycle is truthful.
- [ ] Realtime is RLS-scoped and payloads are only refetch signals.

## 15.3 Core journeys

- [ ] Core customer auth/onboarding-gate journey passes.
- [ ] Core seller draft-to-READY-to-publication-to-LIVE journey passes.
- [ ] Core buyer browse/save/offer/negotiation journey passes.
- [ ] Single acceptance, other-offer closure, and Under Offer treatment pass.
- [ ] Core transaction creation-to-`COMPLETED_DEMO` journey passes.
- [ ] Early/mutual cancellation and listing `PAUSED` treatment pass.
- [ ] Completion sets `SOLD_DEMO` and excludes/blocks listing correctly.
- [ ] Participant fictional document upload/privacy/completeness flow passes.
- [ ] Core Admin overview/search/publication/restriction/document/recovery/audit journey passes.
- [ ] Loading, empty, error, retry, session-expiry, stale, two-tab, and concurrent paths are
      safe and recoverable.

## 15.4 Localisation, accessibility, and mobile

- [ ] English works across all core journeys.
- [ ] EN/AR translation-key parity passes with measured counts.
- [ ] No unapproved user-facing hardcoded string or raw enum appears.
- [ ] Arabic remains explicitly marked draft/unreviewed; no approval claim is made.
- [ ] RTL desktop and mobile core journeys work, including mixed-language and LTR islands.
- [ ] Mobile customer core journeys work at required widths.
- [ ] Mobile Admin core journeys and table-to-card parity work.
- [ ] Keyboard-only offer and Admin action flows pass.
- [ ] Screen-reader basics pass for one customer and one Admin core flow.
- [ ] Axe has zero serious/critical findings on every required page/state.
- [ ] Focus, dialogs, announcements, contrast, touch targets, zoom/reflow, and reduced motion
      meet section 8 criteria.

## 15.5 Automated validation

- [ ] `pnpm format:check` passes.
- [ ] `pnpm typecheck` passes across all workspaces.
- [ ] `pnpm lint` passes with no unexpected warnings.
- [ ] Full unit/component/integration suite passes with final totals recorded and zero required skips.
- [ ] Full web build passes; route/build warnings are recorded and triaged.
- [ ] Full Admin build passes; route/build warnings are recorded and triaged.
- [ ] Full web E2E suite passes serially with zero failures/skips/retries.
- [ ] Full Admin E2E suite passes serially with zero failures/skips/retries.
- [ ] Core E2E pack passes twice consecutively without retry on the RC host.
- [ ] No `.only`, unexplained permanent skip, test-order dependency, hosted API dependency, or
      shared fixture dependency remains.

## 15.6 Performance, documentation, and release

- [ ] Performance/reliability workload is executed; raw observations and query/bundle review are saved.
- [ ] No unbounded list, obvious N+1, critical index gap, blank async screen, or unrecoverable
      network/Reconnect/upload path remains.
- [ ] README, CLAUDE, runbooks, architecture, and ADR status/supersession notes describe the RC accurately.
- [ ] Fresh-stack/reset workaround and serial E2E instructions are tested and documented.
- [ ] `WEEK-7.md`, `RELEASE-CANDIDATE.md`, UAT results, defect log, and evidence index are complete.
- [ ] Known limitations are current, specific, user-impacting, and distinguish demo/POC/production.
- [ ] Week 8 deployment risks and hard gates are documented with owners.
- [ ] Product, Engineering, QA, Security/Privacy, and Accessibility/localisation reviewers sign off.

## 15.7 Decision rules

- **GO:** Every checklist item passes; no S0/S1; no Security/RLS/Storage/data-integrity
  defect; any S2/S3 exception meets policy.
- **CONDITIONAL GO:** All absolute gates pass, but a small non-core set of explicitly
  accepted S2/S3 limitations remains with safe workaround/owner/due date. Not allowed for
  public/production release.
- **NO-GO:** Any S0/S1, any open Security/RLS/Storage/data-corruption risk, failed core
  journey, skipped required suite, serious/critical axe finding, missing evidence, or
  unreproducible baseline.

---

# 16. Evidence requirements

## 16.1 Required artifacts

1. **`WEEK-7.md`**
   - baseline SHA/environment;
   - work completed by workstream;
   - defect summary and fixes;
   - exact automated totals/skips/retries;
   - UAT result summary;
   - security/accessibility/mobile/RTL/performance findings;
   - known limitations and closure status.
2. **`RELEASE-CANDIDATE.md`**
   - candidate identifier/SHA/date;
   - target (internal prototype UAT);
   - checklist with evidence links and approvers;
   - open exceptions;
   - go/conditional-go/no-go decision;
   - Week 8 gates.
3. **UAT result register**
   - one row for UAT-01 through UAT-79 with tester, date, environment, status,
     defect IDs, and evidence links.
4. **Defect log**
   - schema from section 14.3, including closed and accepted exceptions.
5. **Final test totals**
   - format/typecheck/lint/unit/component/integration/build/E2E by workspace;
   - actual axe scan count;
   - zero/explicit skips, retries, flaky tests.
6. **E2E screenshots/traces**
   - trace or screenshot references for each core journey and every failure;
   - no secret/signed-URL/private-document content.
7. **Accessibility report**
   - route/state matrix, axe JSON/summary, keyboard and screen-reader notes,
     contrast/touch/reflow/reduced-motion outcomes.
8. **Security and RLS report**
   - access matrix, direct live-DB function/policy results, projection diffs, secret scan,
     concurrency outcomes.
9. **Storage privacy report**
   - bucket/object policy matrix, upload validation, public-path guard, signed URL
     lifetime/expiry, Admin purpose/audit lifecycle.
10. **Mobile and RTL report**
    - device/viewport/locale matrix, EN/AR screenshots, overflow/touch/table-card/
      sticky-action outcomes.
11. **Performance observations**
    - environment, workload, cold/warm timings, request/query/bundle evidence,
      regressions and dispositions. Do not present local observations as production SLA.
12. **Known limitations**
    - demo simulations, Arabic approval, UAE PASS/Bayut POC restrictions, platform/ops
      gaps, session detection, any accepted S2/S3.
13. **Week 8 readiness notes**
    - checklist in section 18 with owner/status/dependency/risk.

## 16.2 Evidence index and naming

Store evidence under a single location agreed before execution, for example:

`artifacts/week-7/<rc-short-sha>/`

Recommended subfolders:

- `environment/`
- `migrations/`
- `automated/`
- `e2e/web/` and `e2e/admin/`
- `uat/UAT-01/` through `uat/UAT-79/`
- `security-rls/`
- `storage/`
- `accessibility/`
- `mobile-rtl/`
- `performance/`
- `defects/`

Each filename starts with scenario/test ID, locale, viewport/browser, and timestamp. An
`INDEX.md` maps evidence to checklist and defect IDs. Large traces may remain CI artifacts,
but their immutable run URL/retention date must be recorded.

## 16.3 Evidence safety

- Redact tokens, codes, passwords, cookie values, signed URLs, private paths, API keys,
  database connection strings, and identity-provider data before saving.
- Do not screenshot actual document content; show safe metadata/state only.
- Use fictional names/files. Never put real Emirates ID, title deed, payment, or personal
  data in UAT.
- Preserve original failing trace privately only if it is safe; otherwise reproduce with
  synthetic data and rotate/revoke any exposed credential immediately.
- A test report must distinguish `PASS`, `FAIL`, `BLOCKED`, `NOT RUN`, and `SKIPPED`.

## 16.4 UAT result row template

| Field                        | Value                           |
| ---------------------------- | ------------------------------- |
| Scenario                     | UAT-XX — name                   |
| RC SHA/environment           |                                 |
| Tester/date                  |                                 |
| Role/locale/viewport/browser |                                 |
| Fixture prefix               |                                 |
| Result                       | PASS / FAIL / BLOCKED / NOT RUN |
| Evidence                     |                                 |
| Defect IDs                   |                                 |
| Notes/cleanup                |                                 |

---

# 17. Test data strategy

## 17.1 Principles

- No shared Week 7 customer/domain seed and no permanent “golden UAT” scenario.
- Each automated test owns its users, listings, documents, publication request, saves,
  offers, transaction, Admin records, notifications, and audit assertions.
- Manual records are created through the UI wherever the scenario is testing UI creation.
  Authoritative fixture helpers may establish expensive prerequisite states for focused
  negative/concurrency tests, but must call canonical functions and remain isolated.
- The optional Admin bootstrap creates only the test Admin and is idempotent. Customers are
  never bootstrapped as Admin or inserted into Auth tables by SQL.
- Never depend on test order or data from an earlier UAT scenario.

## 17.2 Fixture identity

Use a run identifier:

`w7-<yyyyMMdd>-<rcShortSha>-<worker>-<scenario>-<random>`

Apply it to:

- email aliases and fictional display names;
- property/building descriptions and safe public references;
- file names/object prefixes;
- notes/reason context where a safe free-text identifier is permitted;
- test-run metadata outside product audit payloads.

Do not put the identifier into password/token/private-path evidence. Store the mapping in
the UAT run manifest, not in public UI.

## 17.3 Per-test actor set

Create only what the scenario needs:

- owner/seller CUSTOMER;
- buyer A and, for competition, buyers B/C;
- unrelated CUSTOMER;
- restricted CUSTOMER when needed;
- one isolated ADMIN for the run or per parallel worker if bootstrap supports it.

All CUSTOMERs remain capable of buyer and seller journeys; no role field/mode is created.

## 17.4 Data creation lanes

| Lane                                | Use                                                                                                                           |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| UI lane                             | Manual UAT and E2E whose purpose is the creation journey itself                                                               |
| API/canonical-function fixture lane | Focused later-stage E2E, RLS, concurrency, performance; must preserve real validations/invariants                             |
| Direct DB assertion lane            | Read/deny/integrity proof only, or controlled negative writes under RLS; never used to fabricate a “passing” customer journey |
| External mocked lane                | Bayut/UAE PASS failure and projection tests; no live third-party dependency in CI                                             |
| Optional manual Staging lane        | Explicitly authorised UAE PASS Staging tester only; separate evidence and not a production claim                              |

## 17.5 Fixture isolation and cleanup

- Run automated tests in isolated workers with unique IDs and no global mutable “current
  listing” record.
- Prefer deletion through test-only teardown/Admin service context on the isolated local
  stack; do not weaken product RLS for cleanup.
- Remove Storage objects before/with relational cleanup where required and assert no
  orphan remains.
- Cleanup failure is a Test Reliability defect and is reported; the fresh-stack final run
  is still required.
- Manual UAT may leave records until evidence review, then destroys the entire isolated
  local stack. Do not create permanent seed entries from them.
- Tests must contain a loopback/environment guard and abort on any unapproved host.

## 17.6 Dataset sizing

Most functional scenarios use minimum isolated records. Performance/pagination scenarios create
a separately labelled ephemeral volume large enough to cross each page boundary and expose query
patterns. Record counts and generation method, then discard the stack. Do not turn this volume
into a maintained seed.

---

# 18. Week 8 readiness checklist

Week 7 records status, risk, owner, dependency, and recommended next action for every item
below. It does not implement or deploy them.

## 18.1 Platform and topology

- [ ] Production/development hosting provider and approved UAE data-residency region selected.
- [ ] Separate web and Admin origins/projects defined; worker remains undeployed.
- [ ] Self-hosted Supabase on RDS ADR-0006 checklist validated, including roles,
      extensions, Auth, Storage, migration ownership, direct Realtime replication, backup/
      restore, and RDS limitations—or an approved fallback selected.
- [ ] Pooled app path versus direct migration/Admin/Realtime paths validated.
- [ ] Development, staging, and production environments/databases/secrets isolated.

## 18.2 Security and configuration

- [ ] Typed environment-schema validation and fail-fast startup added for both apps/services.
- [ ] Production GoTrue password policy configured and tested server-side.
- [ ] CSP, HSTS, frame protection, referrer, permissions, and content-type security headers
      designed/tested without breaking Supabase/UAE PASS flows.
- [ ] Application/API/auth abuse rate limits and monitoring defined.
- [ ] Secret storage, least privilege, rotation, revocation, and break-glass process documented.
- [ ] Production Storage bucket policies and signed-URL behaviour revalidated.
- [ ] Dependency/container/image/security scanning and remediation policy established.

## 18.3 Data protection and operations

- [ ] Automated backups/PITR configured and a full restore drill completed.
- [ ] Monitoring, structured-log collection/redaction, error tracking, uptime, queue/
      Realtime health, alert thresholds, and on-call ownership established.
- [ ] Incident-response, privacy-incident, Admin operational, backup/restore, and rollback
      runbooks approved.
- [ ] Migration preflight, forward-fix/recovery plan, and deploy ordering defined.
- [ ] Data retention/deletion, audit retention, document retention, and access-review policy approved.

## 18.4 Email, integrations, and legal

- [ ] Production email provider/sender domain configured with SPF, DKIM, DMARC and delivery
      tests for signup code and recovery link.
- [ ] UAE PASS production onboarding, credentials, redirect URLs, claim minimisation,
      explicit account-linking policy, assurance level, and privacy review completed.
- [ ] DLD/Trakheesi/Madmoun/payment/escrow remain disabled/simulated until separately approved.
- [ ] BayutAPI remains disabled unless written redistribution permission, licensing/legal,
      takedown, freshness, privacy, caching/indexing, quota, and monitoring decisions are approved.
- [ ] English and Arabic legal/transactional/operational copy receives professional business/
      legal review; Arabic draft label removed only after approval.
- [ ] Terms, Privacy, support/contact, and simulation disclosures have approved owners/content.

## 18.5 Delivery and release operations

- [ ] Protected `develop`/`main` branch and required CI checks verified.
- [ ] CI-connected development/staging deploy job implemented only after provider selection.
- [ ] Exact migration/app ordering, smoke tests, health checks, rollback, and release-record
      process automated/documented.
- [ ] Production-like performance/load/capacity tests run in the approved topology.
- [ ] Production accessibility/browser/device matrix completed.
- [ ] Week 7 RC risks/exceptions either closed or explicitly accepted for the deployment target.

Any unchecked ADR-0006, backup/restore, secret, monitoring, production auth/email, legal/
Arabic, or external-integration approval item blocks production.

---

# 19. Final acceptance criteria

Week 7 is accepted only when all of the following are true on one immutable RC commit:

1. The baseline is reproducible from a fresh stack and documentation matches the included
   migration/code state.
2. UAT-01 through UAT-73 pass. UAT-74 through UAT-79 also pass for every corresponding
   post-Week-6 delta included in the RC.
3. The full customer auth, seller, buyer/offer, transaction completion/cancellation, and
   Admin operations journeys pass end to end.
4. All required format, typecheck, lint, unit, component, live integration/RLS/Storage,
   build, serial web E2E, serial Admin E2E, and axe suites pass with exact totals and no
   hidden skip/retry.
5. All S0/S1 defects are fixed and independently verified; no open Security, RLS, Storage
   privacy, data-corruption, immutable-history, secret, or audit-integrity issue remains.
6. Listing/publication/offer/transaction/Admin state machines remain authoritative under
   invalid actions, retries, stale tabs, conflicts, and concurrency.
7. English, EN/AR key parity, RTL, mobile core journeys, keyboard, screen-reader basics,
   and the required zero-serious/critical axe gate pass. Arabic is still explicitly
   unreviewed until professional approval.
8. Performance/reliability observations reveal no unbounded query, obvious N+1, critical
   index gap, unexplained core regression, blank async state, or corrupting failure/retry.
9. `WEEK-7.md`, `RELEASE-CANDIDATE.md`, UAT results, defect log, evidence index, known
   limitations, and Week 8 readiness notes are complete and safely redacted.
10. Product, Engineering, QA, Security/Privacy, and Accessibility/Localisation reviewers
    sign the same go/no-go record.

## Required sign-off record

| Responsibility                          | Name | Decision                    | Date | Evidence/exception notes |
| --------------------------------------- | ---- | --------------------------- | ---- | ------------------------ |
| Product scope and simulation boundaries |      |                             |      |                          |
| Engineering integrity and builds        |      |                             |      |                          |
| QA/UAT and defect closure               |      |                             |      |                          |
| Security, RLS, Storage, and privacy     |      |                             |      |                          |
| Accessibility, Arabic/RTL, and mobile   |      |                             |      |                          |
| Release owner                           |      | GO / CONDITIONAL GO / NO-GO |      |                          |

## Final Week 7 statement

Week 7 does not certify MARKAZ Home for production. It certifies—when every absolute gate
above passes—that the implemented prototype behaves as one coherent, secure, usable,
evidence-backed release candidate for controlled internal UAT. Week 8 remains responsible
for production topology, operations, compliance, reviewed Arabic/legal copy, real
integration approvals, deployment, monitoring, backup/restore, and incident readiness.
