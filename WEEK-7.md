# Week 7 — UAT hardening and release-candidate assessment

Date: 2026-07-27; RC freeze addendum 2026-07-28
Branch: `feature/auth-flow-gold`
Starting commit: `2a88f3df1f7b`
Target: controlled local/internal prototype UAT, not production

## Outcome

The Week 7 engineering hardening pass is complete. The implemented customer and Admin
journeys build successfully, the full automated stack is green, and every accessibility
defect found during execution was fixed and reverified.

The technical baseline is ready to freeze as `rc-week-7`. UAT-67–70 remain explicitly
partial, non-blocking RC evidence gaps, and all cross-functional sign-offs remain Pending
because no named approvals have been received. See `RELEASE-CANDIDATE.md` for the bounded
“Go with documented limitations” decision.

## Environment and isolation

| Item                       | Value                                           |
| -------------------------- | ----------------------------------------------- |
| Host                       | macOS, Apple Silicon                            |
| Node                       | `v22.19.0`                                      |
| pnpm                       | `9.15.4`                                        |
| Docker                     | `29.4.3`                                        |
| Supabase CLI               | `2.109.1`                                       |
| Browser                    | Playwright Chromium                             |
| Customer app               | loopback `:3000`                                |
| Admin app                  | loopback `:3001`                                |
| Database/Auth/Storage/Mail | isolated local Supabase stack only              |
| BayutAPI                   | `disabled`                                      |
| UAE PASS                   | `simulated`/off boundary; no real provider call |

The canonical migrations replayed successfully from a fresh isolated stack through
`20260301000819_permit_verification.sql`; the security-boundary hardening migration
`20260301000820_security_boundary_hardening.sql` was then applied and exercised by the
complete live integration suite. The original local Supabase volume was preserved after
its interrupted reset; no customer data volume was deleted.

## Hardening implemented

- Updated stale auth E2E flows for the combined legal consent and the authoritative UAE
  PASS checkpoint.
- Enabled a real cross-application CUSTOMER-to-Admin denial test.
- Updated listing-wizard E2E to operate the current accessible custom listboxes.
- Updated marketplace assertions to the current public design.
- Added both customer and Admin Playwright servers to the web E2E harness where required.
- Added browser tests for buyer and seller fictional transaction-document uploads,
  uploader-only privacy, and removal.
- Added a timed Storage integration test proving signed URLs are scoped to one object and
  expire.
- Added a four-subscriber Realtime integration test proving only the buyer and seller
  receive the authoritative offer event and that its payload contains no private
  profile/contact/threshold fields.
- Added customer keyboard-only offer submission and Admin keyboard-only restriction
  coverage.
- Added a compact Admin mobile navigation and responsive portal/action layouts.
- Added targeted mobile Arabic transaction upload/rotation and mobile Admin publication
  review coverage with horizontal-overflow assertions.
- Added desktop Admin Arabic RTL/navigation coverage.
- Split the customer and Admin tRPC roots so customer routes cannot reach Admin or audit
  procedures.
- Removed customer-callable identity-status and audit-write procedures; protected
  customer mutations now require the trusted API transaction context in addition to RLS.
- Revoked implicit `PUBLIC` execution of database functions and explicitly granted only
  reviewed offer, transaction, permit, identity, and Admin entry points.
- Hardened notification updates, offer-closing functions, private seller-threshold
  projection, and audit actor classification at the database/API boundaries.
- Added a dedicated live security-boundary integration suite and router-surface tests.
- Added real Admin search keyboard behavior and visible audit-log filters.
- Made browse filters follow Back/Forward URL changes and corrected overlapping price
  bands.
- Made the root browser-test command sequential and environment-aware so both apps can
  share the local Supabase stack without false concurrency failures.
- Removed visible legacy “demo identity” copy and localized the verification-success
  message.
- Localized transaction upload type/size validation in English and Arabic.
- Fixed customer listing-wizard contrast defects in ownership selection and the current
  step indicator.
- Fixed Admin overview warning-label contrast.
- Reworked shared Admin status badges so the text always meets contrast requirements while
  the icon retains the semantic color.
- Added explicit lint rationales for dynamic signed/external images and root font loading;
  lint now passes without warnings.
- Suppressed jsdom-only navigation noise in the notification unit test without changing
  product behavior.

## Final automated evidence

| Gate                                       | Result                                       |
| ------------------------------------------ | -------------------------------------------- |
| `pnpm format:check`                        | PASS                                         |
| `pnpm typecheck`                           | PASS — 12 workspaces                         |
| `pnpm lint`                                | PASS — 11 linting workspaces, zero warnings  |
| Unit/component/domain/API/Auth/i18n        | PASS — 303 tests                             |
| Live integration/RLS/Storage/state-machine | PASS — 118 tests, zero skips                 |
| Total Vitest                               | PASS — 421 tests                             |
| Customer Playwright                        | PASS — 60 tests, zero failures/skips/retries |
| Admin Playwright                           | PASS — 20 tests, zero failures/skips/retries |
| Total automated tests                      | PASS — 501                                   |
| Customer production build                  | PASS — 71 routes generated                   |
| Admin production build                     | PASS — 36 routes generated                   |
| Diff whitespace check                      | PASS                                         |

The browser suites cover auth and recovery, customer/Admin separation, listing creation,
publication, marketplace, offers, transactions, document privacy, cancellation,
completion, accessibility, selected mobile screens, and selected Arabic RTL screens.

The 2026-07-28 freeze validation replayed every migration through `0820` from a fresh local
reset, then ran all gates again. The canonical final runs had zero failed and zero skipped
tests. Five stale negative-test assertions were updated to accept the stronger grant-level
denial introduced by `0820`. A cold Next development cache proved unsafe with three
simultaneous customer Playwright workers, so the release E2E harness is now deliberately
serial; the exact root `pnpm test:e2e` command then passed from clean caches.

## UAT catalogue status

`PASS` means the scenario’s authoritative product behavior is covered by the executed
browser/integration/unit evidence. `PARTIAL` means relevant assertions passed but the
complete manual script in the Week 7 plan was not executed. `PENDING` is an evidence gap,
not a known product failure.

| ID     | Scenario                               | Status  | Primary evidence or remaining gap                                              |
| ------ | -------------------------------------- | ------- | ------------------------------------------------------------------------------ |
| UAT-01 | Signup and email verification          | PASS    | Mailpit code E2E reaches UAE PASS checkpoint                                   |
| UAT-02 | Returning customer sign-in             | PASS    | Auth E2E                                                                       |
| UAT-03 | Password recovery                      | PASS    | Recovery-link E2E                                                              |
| UAT-04 | Customer denied Admin                  | PASS    | Cross-app E2E                                                                  |
| UAT-05 | Create listing draft                   | PASS    | Listing E2E/integration                                                        |
| UAT-06 | Upload ownership document              | PASS    | Listing E2E/integration                                                        |
| UAT-07 | Ownership simulation passes            | PASS    | Listing E2E/integration                                                        |
| UAT-08 | Complete listing settings              | PASS    | Listing E2E                                                                    |
| UAT-09 | Upload/order photos                    | PASS    | Listing E2E and keyboard alternative                                           |
| UAT-10 | Reach READY_TO_PUBLISH                 | PASS    | Listing E2E                                                                    |
| UAT-11 | Submit publication                     | PASS    | Publication E2E                                                                |
| UAT-12 | Approved listing becomes LIVE          | PASS    | Publication E2E/integration                                                    |
| UAT-13 | Anonymous marketplace browse           | PASS    | Marketplace E2E                                                                |
| UAT-14 | Save property                          | PASS    | Marketplace E2E/integration                                                    |
| UAT-15 | Owner cannot save own listing          | PASS    | Detail E2E/RLS integration                                                     |
| UAT-16 | Paused listing not offerable           | PASS    | Publication/offer integration                                                  |
| UAT-17 | SOLD_DEMO listing not offerable        | PASS    | Transaction/offer integration                                                  |
| UAT-18 | Buyer submits offer                    | PASS    | Offer E2E/integration                                                          |
| UAT-19 | Seller counters                        | PASS    | Offer E2E/integration                                                          |
| UAT-20 | Buyer counters                         | PASS    | Offer E2E/integration                                                          |
| UAT-21 | Seller accepts buyer proposal          | PASS    | Offer E2E/integration                                                          |
| UAT-22 | Buyer accepts seller counter           | PASS    | Offer integration                                                              |
| UAT-23 | Competing offers close                 | PASS    | Concurrency/integration                                                        |
| UAT-24 | Offers blocked Under Offer             | PASS    | Offer integration                                                              |
| UAT-25 | Buyer withdraws offer                  | PASS    | Offer E2E                                                                      |
| UAT-26 | Seller rejects offer                   | PASS    | Offer integration                                                              |
| UAT-27 | Threshold remains buyer-private        | PASS    | Offer integration/projection                                                   |
| UAT-28 | Acceptance creates one transaction     | PASS    | Transaction integration                                                        |
| UAT-29 | Transaction creation idempotent        | PASS    | Transaction integration                                                        |
| UAT-30 | Buyer confirms details                 | PASS    | Transaction E2E                                                                |
| UAT-31 | Seller confirms details                | PASS    | Transaction lifecycle integration                                              |
| UAT-32 | Demo deposit                           | PASS    | Transaction integration/axe screen                                             |
| UAT-33 | Buyer uploads fictional document       | PASS    | New upload/privacy/removal E2E                                                 |
| UAT-34 | Seller uploads fictional document      | PASS    | Seller upload/privacy/removal E2E                                              |
| UAT-35 | Due diligence completes                | PASS    | Transaction lifecycle integration                                              |
| UAT-36 | Transfer readiness completes           | PASS    | Transaction lifecycle integration                                              |
| UAT-37 | COMPLETED_DEMO                         | PASS    | Transaction E2E/integration                                                    |
| UAT-38 | Early cancellation                     | PASS    | Transaction E2E                                                                |
| UAT-39 | Cancelled listing remains PAUSED       | PASS    | Transaction integration                                                        |
| UAT-40 | Completed listing becomes SOLD_DEMO    | PASS    | Transaction integration                                                        |
| UAT-41 | Admin dashboard                        | PASS    | Admin E2E                                                                      |
| UAT-42 | Admin customer search                  | PASS    | Keyboard search/clear/navigation covered in Admin E2E                          |
| UAT-43 | Restrict customer                      | PASS    | Admin E2E/integration                                                          |
| UAT-44 | Restricted customer action blocked     | PASS    | DB-enforced integration                                                        |
| UAT-45 | Restore customer                       | PASS    | Admin E2E                                                                      |
| UAT-46 | Admin approves publication             | PASS    | Admin E2E                                                                      |
| UAT-47 | Admin returns publication              | PASS    | Admin E2E                                                                      |
| UAT-48 | Admin pauses listing                   | PASS    | Admin E2E                                                                      |
| UAT-49 | Admin resumes listing                  | PASS    | Admin E2E                                                                      |
| UAT-50 | Offer history read-only                | PASS    | Admin E2E                                                                      |
| UAT-51 | Admin cannot edit proposal             | PASS    | Admin E2E                                                                      |
| UAT-52 | Reasoned private-document access       | PASS    | Admin E2E                                                                      |
| UAT-53 | Document access audited truthfully     | PASS    | Admin E2E/integration                                                          |
| UAT-54 | Admin transaction recovery             | PASS    | Admin E2E                                                                      |
| UAT-55 | Audit log and filters                  | PASS    | Immutable log plus visible action/entity filters covered in Admin E2E          |
| UAT-56 | Customer denied Admin data             | PASS    | E2E and RLS integration                                                        |
| UAT-57 | Anonymous private-route denial         | PASS    | Foundation E2E                                                                 |
| UAT-58 | Cross-customer offer denial            | PASS    | Offer E2E/RLS                                                                  |
| UAT-59 | Cross-customer transaction denial      | PASS    | Transaction E2E/RLS                                                            |
| UAT-60 | Buyer cannot perform seller action     | PASS    | Offer/transaction integration                                                  |
| UAT-61 | Seller cannot perform buyer action     | PASS    | Offer/transaction integration                                                  |
| UAT-62 | Status/identity forgery blocked        | PASS    | RLS and UAE PASS integration                                                   |
| UAT-63 | Private Storage path denied            | PASS    | Storage integration                                                            |
| UAT-64 | Audit mutation denied                  | PASS    | Admin integration                                                              |
| UAT-65 | Signed URLs scoped and expiring        | PASS    | Timed Storage integration proves object scope and expiry                       |
| UAT-66 | Realtime two-subscriber privacy        | PASS    | Buyer/seller delivery plus outsider/anon zero-delivery integration             |
| UAT-67 | Full customer Arabic RTL journey       | PARTIAL | Core RTL screens and mobile transaction upload pass; full stage script remains |
| UAT-68 | Full Admin Arabic RTL journey          | PARTIAL | RTL overview/navigation pass; full controlled-action script remains            |
| UAT-69 | Mobile customer transaction journey    | PARTIAL | 390px Arabic upload/rotation passes; full 320–430 stage matrix remains         |
| UAT-70 | Mobile Admin publication review        | PARTIAL | 390px shell/review/actions/overflow pass; full EN/AR action matrix remains     |
| UAT-71 | Keyboard-only offer flow               | PASS    | Keyboard-only amount, review, and submit E2E                                   |
| UAT-72 | Keyboard-only Admin action             | PASS    | Keyboard-only reason-coded restriction E2E                                     |
| UAT-73 | Axe scans on major pages               | PASS    | Customer and Admin axe suites green                                            |
| UAT-74 | Homepage search contract               | PASS    | Unit assertion and browser URL handoff                                         |
| UAT-75 | Safe permit projection                 | PASS    | Live integration and component tests                                           |
| UAT-76 | Bayut disabled/fail-closed             | PASS    | Adapter tests; automated mode disabled                                         |
| UAT-77 | External cards separate/non-actionable | PASS    | Component and adapter allowlist tests                                          |
| UAT-78 | UAE PASS off-mode/boundary             | PASS    | Unit, integration, and signup E2E                                              |
| UAT-79 | Homepage/footer coherence              | PASS    | Component tests and desktop/mobile EN/AR browser review                        |

### UAT-67–70 release-candidate disposition

These rows remain `PARTIAL`; the complete scripts were not executed and are not represented
as complete. They are non-blocking for this internal prototype RC because the corresponding
English authoritative journeys, security boundaries, and targeted RTL/mobile states are
green. They move to Week 8 production-readiness validation.

| ID     | Already covered                                                                                                                        | Still uncovered                                                                                                | RC blocker | Week 8 | Evidence                                                                                                                |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ---------- | ------ | ----------------------------------------------------------------------------------------------------------------------- |
| UAT-67 | Arabic `lang`/`dir`, landing, listing settings, marketplace/detail, buyer offer form, and transaction-document state; EN/AR key parity | One uninterrupted Arabic signup → listing → publication → offer → transaction script; professional copy review | No         | Yes    | `foundation.spec.ts`, `listing-quality.spec.ts`, `marketplace-detail.spec.ts`, `offers.spec.ts`, `transactions.spec.ts` |
| UAT-68 | Arabic Admin overview, RTL direction, localized operations navigation, and localized dashboard metrics                                 | Full Arabic restriction, publication, offer, document-access, transaction-recovery, and audit actions          | No         | Yes    | `apps/admin/e2e/admin.spec.ts` — Arabic operations overview                                                             |
| UAT-69 | 390×844 listing and marketplace/detail checks; 390×844 Arabic transaction document upload; 844×390 rotation and overflow checks        | Complete transaction across all stages at the planned 320–430 px portrait/landscape device matrix              | No         | Yes    | `listing-quality.spec.ts`, `marketplace-detail.spec.ts`, `transactions.spec.ts`                                         |
| UAT-70 | 390×844 Admin publication detail, compact navigation, visible approve action, and horizontal-overflow assertion                        | Complete EN/AR approve/return action matrix across the planned mobile device widths                            | No         | Yes    | `apps/admin/e2e/admin.spec.ts` — mobile publication review                                                              |

## Defect log

| ID             | Severity       | Area                                                              | Resolution                                                                     |
| -------------- | -------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| W7-ENV-001     | S2 environment | Docker failed with host disk exhaustion                           | Resolved by removing only regenerable build caches; isolated stack then passed |
| W7-A11Y-001    | S2             | Ownership choice contrast 4.21:1                                  | Fixed and axe-verified                                                         |
| W7-A11Y-002    | S2             | Wizard current-step contrast 4.09:1                               | Fixed and axe-verified                                                         |
| W7-A11Y-003    | S2             | Admin queue label contrast 4.12:1                                 | Fixed and axe-verified                                                         |
| W7-A11Y-004    | S2             | Admin status badge contrast 4.29:1                                | Shared fix; five Admin axe pages passed                                        |
| W7-I18N-001    | S2             | Hardcoded/legacy identity success copy                            | Localized and corrected                                                        |
| W7-I18N-002    | S2             | Transaction upload errors hardcoded in English                    | Localized EN/AR                                                                |
| W7-TEST-001    | S2             | Auth E2E used obsolete consent controls                           | Updated                                                                        |
| W7-TEST-002    | S2             | Listing E2E assumed native selects                                | Updated to accessible listbox behavior                                         |
| W7-TEST-003    | S3             | Marketplace assertion used removed copy                           | Updated                                                                        |
| W7-TEST-004    | S1 evidence    | Cross-app Admin denial was permanently skipped                    | Enabled and passing                                                            |
| W7-COVER-001   | S1 evidence    | No browser proof for transaction document upload/privacy          | Added and passing                                                              |
| W7-COVER-002   | S1 evidence    | Signed-URL expiry and object scope were not timed                 | Added and passing                                                              |
| W7-COVER-003   | S1 evidence    | Realtime participant/outsider delivery was not asserted           | Added and passing                                                              |
| W7-COVER-004   | S2 evidence    | Keyboard and targeted mobile/RTL paths were missing               | Added and passing in the executed matrix                                       |
| W7-ENV-002     | S3 environment | Local gateway template server and browser cache stalled           | Stack recovered from preserved volume; pinned Chromium restored                |
| W7-RC-TEST-001 | S2 evidence    | Negative tests expected RLS-hidden rows after grants were revoked | Corrected to assert grant/RLS denial; 118/118 live tests passed                |
| W7-RC-E2E-001  | S2 environment | Cold Next cache corrupted under three customer E2E workers        | Customer release suite made serial; cold-cache root run passed 80/80           |

No open S0/S1 product, Security, RLS, Storage-privacy, or data-integrity defect was found.
The partial UAT rows above are accepted as non-blocking internal-RC evidence gaps.

## Known limitations and Week 8 risks

- UAE PASS Staging credentials/app are required to complete a brand-new identity round
  trip. Local mode intentionally does not provide a legacy demo bypass.
- Arabic translation keys are complete, but Arabic legal and transactional copy remains
  draft and professionally unreviewed.
- The RC is an internal prototype validation baseline, not production certification.
- Deployment topology is not final. Monitoring, backup, restore, incident response, and
  secrets management remain Week 8 work.
- Host disk pressure interrupted one local run. Regenerable Next/Turbo caches were removed,
  macOS reclaimed space, and the final gates then passed; repeatable CI should still manage
  build artifacts explicitly.
- Playwright dev-server output emits `NO_COLOR`/`FORCE_COLOR` and occasional
  color-configuration noise. No test failed; the suites now run sequentially to avoid
  overloading their shared local services.
- Next build reports the upstream Supabase browser-client Edge-runtime warning. Builds
  succeed, but the dependency/runtime boundary should be rechecked during deployment.
- The largest first-load routes are approximately 298–300 kB (listing wizard/reset
  password) and transaction/offer workspaces are approximately 292–293 kB. Treat these as
  Week 8 performance baselines, not production budgets.
- Real DLD/Trakheesi/Madmoun/payment integrations, production UAE PASS, production email,
  escrow, legal integrations, provider redistribution approval, and production compliance
  remain outside this Week 7 prototype certification.

## RC freeze note

- RC tag: `rc-week-7`
- RC commit: the immutable commit targeted by `rc-week-7` (resolve with
  `git rev-parse rc-week-7^{commit}`; the concrete SHA is recorded in the freeze handoff)
- Validation: 421 Vitest/integration + 80 Playwright = 501 automated tests; zero final
  failures, skips, or retries; web 71 pages and Admin 36 pages built
- UAT: 75 PASS, 4 PARTIAL (`UAT-67`–`UAT-70`), 0 failed
- Open non-blocking gaps: complete Arabic/mobile matrices, professional Arabic/legal review,
  provider credentials/approvals, and Week 8 operational readiness
- Sign-offs: Product, Engineering, QA, Design, Security, and Release owner all Pending
- Week 8 readiness decision: **Go with documented limitations**

The SHA is intentionally resolved from the tag rather than embedded literally in its own
commit; a Git commit cannot contain its own content-derived SHA.
