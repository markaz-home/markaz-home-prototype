# Week 7 defect log

Assessment closed: 2026-07-28
Scope: Week 7 internal prototype release-candidate hardening
RC tag: `rc-week-7`

## Status

No open S0/S1 product, Security, RLS, Storage-privacy, data-integrity, or serious/critical
accessibility defect is known. UAT-67–70 are evidence limitations, not confirmed defects;
their exact disposition is recorded in `WEEK-7.md` and `RELEASE-CANDIDATE.md`.

## Closed defects and evidence gaps

| ID             | Severity       | Area                                                                  | Final resolution                                                     |
| -------------- | -------------- | --------------------------------------------------------------------- | -------------------------------------------------------------------- |
| W7-ENV-001     | S2 environment | Docker failed with host disk exhaustion                               | Removed regenerable caches; fresh isolated stack subsequently passed |
| W7-A11Y-001    | S2             | Ownership choice contrast 4.21:1                                      | Fixed and axe-verified                                               |
| W7-A11Y-002    | S2             | Wizard current-step contrast 4.09:1                                   | Fixed and axe-verified                                               |
| W7-A11Y-003    | S2             | Admin queue label contrast 4.12:1                                     | Fixed and axe-verified                                               |
| W7-A11Y-004    | S2             | Admin status badge contrast 4.29:1                                    | Shared fix; Admin axe pages passed                                   |
| W7-I18N-001    | S2             | Hardcoded/legacy identity success copy                                | Localized and corrected                                              |
| W7-I18N-002    | S2             | Transaction upload errors hardcoded in English                        | Localized in English and Arabic                                      |
| W7-TEST-001    | S2             | Auth E2E used obsolete consent controls                               | Updated                                                              |
| W7-TEST-002    | S2             | Listing E2E assumed native selects                                    | Updated to accessible listbox behavior                               |
| W7-TEST-003    | S3             | Marketplace assertion used removed copy                               | Updated                                                              |
| W7-TEST-004    | S1 evidence    | Cross-app Admin denial was permanently skipped                        | Enabled and passing                                                  |
| W7-COVER-001   | S1 evidence    | No browser proof for transaction document upload/privacy              | Added and passing                                                    |
| W7-COVER-002   | S1 evidence    | Signed-URL expiry and object scope were not timed                     | Added and passing                                                    |
| W7-COVER-003   | S1 evidence    | Realtime participant/outsider delivery was not asserted               | Added and passing                                                    |
| W7-COVER-004   | S2 evidence    | Keyboard and targeted mobile/RTL paths were missing                   | Added and passing in the executed matrix                             |
| W7-ENV-002     | S3 environment | Local gateway/template server and browser cache stalled               | Stack recovered; pinned Chromium restored                            |
| W7-RC-TEST-001 | S2 evidence    | Negative tests expected filtered rows after write grants were revoked | Assertions now accept grant/RLS denial; live suite passed 118/118    |
| W7-RC-E2E-001  | S2 environment | Cold Next cache corrupted under three customer E2E workers            | Release harness made serial; clean-cache root run passed 80/80       |

## Final canonical validation

- Fresh local migration replay: PASS through `20260301000820_security_boundary_hardening.sql`
- Format, diff whitespace, lint, and typecheck: PASS
- Unit/component/domain/API/Auth/i18n: 303 passed
- Live integration/RLS/Storage/Realtime: 118 passed
- Customer Playwright: 60 passed
- Admin Playwright: 20 passed
- Final failed tests: 0
- Final skipped tests: 0
- Production builds: web 71 pages; Admin 36 pages

## Non-defect environment observations

- A superseded cache-bypass command accidentally forwarded `--force` to Vitest and exited
  before running tests. The corrected Turbo-layer command executed the entire uncached
  matrix successfully.
- One loaded diagnostic run observed a Realtime event timeout. The proof passed immediately
  in isolation and again in the final full uncached matrix.
- The local CLI reports newer available tooling and local container versions that differ
  from the linked project. Deployment-boundary parity is Week 8 work.
- Playwright/Next emits `NO_COLOR`/`FORCE_COLOR`, large-cache-string, and occasional
  listener-count warnings. The final suites and builds pass.
