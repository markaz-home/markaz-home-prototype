# E2E self-provision follow-up

The **integration** test layer (`tests/integration/`) was fully rewritten to
self-provision (no demo seed) — see `WEEK-6.md` / the review-response notes. Seven
suites there now genuinely run (101 tests, 0 skipped).

These **six e2e specs** still assume the removed demo seed (fixed
`customer-a@markaz.demo` / `Markaz!Demo1`, fixed listing UUIDs, and `mkz-…`
publicIds). They are marked `test.describe.skip` with this file referenced, so they
are **honestly reported as skipped** (never a vacuous green) until ported. The
self-provision toolkit already exists in `apps/web/e2e/helpers/provision.ts`
(`createCustomer`, `createLiveListing`, `acceptedTransaction`, `driveTo*`) — the
same pattern the offers/transactions specs already use and pass with.

| Spec                         | What it needs to self-provision                                                                                                             | Effort |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| `marketplace.spec.ts`        | A LIVE listing (browse) + a saved available/unavailable pair. Swap `mkz-` selectors for the provisioned `publicId`.                         | Medium |
| `marketplace-detail.spec.ts` | Two LIVE listings — one with a **visible** investment case + photos, one without. Extend `createLiveListing` with photos + investment case. | Medium |
| `auth-password.spec.ts`      | A confirmed customer with a **known password** (`createCustomer` already gives `DEFAULT_PASSWORD`). Replace demo email/password constants.  | Medium |
| `listing-journey.spec.ts`    | Self-provisioned DRAFT(s) in specific wizard states owned by the signed-in customer.                                                        | Heavy  |
| `listing-quality.spec.ts`    | DRAFT / OWNERSHIP_REVIEW / READY_TO_PUBLISH listings owned by the customer.                                                                 | Heavy  |
| `seller-publication.spec.ts` | READY / returned-for-changes / photo-fail / LIVE listings + publication-request states, driven through the UI.                              | Heavy  |

**Helper extensions required** (add to `provision.ts`): create a listing in an
arbitrary lifecycle state; attach photos (draft + public) and an investment case;
create a saved-property row (available + paused/unavailable stub); create a
publication request in `RETURNED`/`PHOTO_PROCESSING_FAILED` states.

`foundation.spec.ts`, `offers*.spec.ts`, and `transactions*.spec.ts` already
self-provision (or need no data) and run in CI.
