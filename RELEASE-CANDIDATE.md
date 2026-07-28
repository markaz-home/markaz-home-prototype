# MARKAZ Home release-candidate decision

Assessment date: 2026-07-28
Candidate branch: `feature/auth-flow-gold`
Starting commit: `2a88f3df1f7b`
RC tag: `rc-week-7`
RC commit: resolve `rc-week-7^{commit}`; concrete SHA recorded in the final freeze handoff

## Decision

**GO WITH DOCUMENTED LIMITATIONS.**

The immutable Week 7 technical baseline is approved to enter Week 8 production-readiness
work. It is not approved for production deployment, production traffic, or regulatory use.

The engineering baseline is healthy: 501 automated tests pass, both applications build,
the canonical migration chain replays through `0820`, and no open Security, RLS,
Storage-privacy, data-integrity, or serious/critical accessibility defect is known. The
final canonical runs have zero failures, skips, and retries.

UAT-67–70 remain partial and are explicitly accepted as non-blocking internal-RC evidence
gaps. Named cross-functional approvals have not been supplied and remain Pending; this
record does not invent them.

## Repository state at freeze

- Branch: `feature/auth-flow-gold`
- Parent commit: `2a88f3df1f7b0b741ff4c9b1501e68b2c5f9a9cb`
- RC commit: immutable target of `rc-week-7`
- Freeze scope: 166 changed files; 9,693 insertions and 1,844 deletions relative to the
  parent commit, including the Week 7 implementation, migrations, tests, assets, and release
  evidence
- Generated build caches, Playwright output, dependencies, and environment files: excluded
- Working-tree expectation after freeze: clean

## Gate summary

| Gate                                                              | Status                                   |
| ----------------------------------------------------------------- | ---------------------------------------- |
| Fresh canonical migration replay through `0820`                   | PASS                                     |
| Loopback local environment; Bayut disabled; UAE PASS staging/safe | PASS                                     |
| `git diff --check` and `pnpm format:check`                        | PASS                                     |
| Lint                                                              | PASS — 11 workspaces, zero warnings      |
| Typecheck                                                         | PASS — 12 workspaces                     |
| Unit/component/domain/API/Auth/i18n                               | PASS — 303                               |
| Live integration/RLS/Storage/Realtime                             | PASS — 118, zero skips                   |
| Customer Playwright                                               | PASS — 60, zero failures/skips/retries   |
| Admin Playwright                                                  | PASS — 20, zero failures/skips/retries   |
| Customer production build                                         | PASS — 71 pages                          |
| Admin production build                                            | PASS — 36 pages                          |
| Serious/critical axe findings after fixes                         | PASS — zero in the executed matrix       |
| Open S0/S1 product/security/privacy defect                        | PASS — none known                        |
| UAT-01…79                                                         | 75 PASS; 4 PARTIAL; 0 failed             |
| Named cross-functional sign-offs                                  | PENDING — no names or approvals supplied |
| Production operational/compliance readiness                       | NOT CERTIFIED — Week 8 scope             |

## UAT-67–70 disposition

| ID     | Existing evidence                                                                                     | Remaining evidence                                                            | RC impact                    | Disposition                      |
| ------ | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ---------------------------- | -------------------------------- |
| UAT-67 | Targeted customer Arabic landing, listing, marketplace, offer, and transaction states; RTL assertions | One uninterrupted full Arabic customer lifecycle and professional copy review | Non-blocking for internal RC | Remains PARTIAL; moves to Week 8 |
| UAT-68 | Arabic Admin overview, direction, navigation, and localized metrics                                   | Full controlled-action journey in Arabic                                      | Non-blocking for internal RC | Remains PARTIAL; moves to Week 8 |
| UAT-69 | 390×844 customer listing/marketplace and Arabic transaction documents; 844×390 rotation               | All transaction stages across the planned 320–430 px device matrix            | Non-blocking for internal RC | Remains PARTIAL; moves to Week 8 |
| UAT-70 | 390×844 Admin publication detail, compact menu, action visibility, and no overflow                    | Complete EN/AR approve/return matrix across planned mobile widths             | Non-blocking for internal RC | Remains PARTIAL; moves to Week 8 |

The exact spec evidence is listed in `WEEK-7.md`. No complete script is claimed where only
targeted evidence exists.

## Sign-off record

Product: Pending
Engineering: Pending
QA: Pending
Design: Pending
Security: Pending
Release owner: Pending
Date: 2026-07-28
Decision: **Go with documented limitations**

The decision above is the evidence-based engineering recommendation for the internal RC;
it is not a fabricated cross-functional approval. Each Pending role must be updated by the
actual approver if organizational sign-off is required before shared UAT or deployment.

## Known limitations carried into Week 8

- UAE PASS Staging credentials and the staging app are still required.
- Arabic legal and transactional copy is draft and professionally unreviewed.
- This is internal prototype validation, not production certification.
- Deployment topology is not final.
- Monitoring, backup, restore, incident response, and secrets management are Week 8 work.
- Real DLD, Trakheesi, Madmoun, payment, escrow, and legal integrations remain outside the
  prototype.
- The Supabase browser-client Edge-runtime warning requires deployment-boundary review.
- First-load route sizes are Week 8 performance baselines, not production budgets.
- Local Supabase reports a newer CLI and service-image differences from the linked project;
  production parity must be established during Week 8.

## RC freeze note

- Tag: `rc-week-7`
- Commit: immutable tag target; resolve with `git rev-parse rc-week-7^{commit}`
- Validation: 421 Vitest/integration + 80 Playwright = 501 automated tests
- Final test result: 501 passed, 0 failed, 0 skipped, 0 retries
- UAT result: 75 PASS, 4 PARTIAL, 0 failed
- Non-blocking gaps: UAT-67–70, pending named sign-offs, provider credentials/approvals,
  professional Arabic/legal review, and production operations
- Week 8 decision: **Go with documented limitations**

A commit cannot embed its own content-derived SHA. The concrete RC SHA is therefore
recorded in the tag target and the final handoff, while this immutable file records the
deterministic command needed to resolve it.

This decision authorizes Week 8 readiness work only. It certifies neither production
readiness nor any real regulated integration.
