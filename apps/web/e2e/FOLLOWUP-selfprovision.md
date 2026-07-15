# E2E self-provision — DONE

All six previously demo-seed-dependent e2e specs were ported to **self-provision**
their own data via `helpers/provision.ts` (no demo seed). They now run and pass like
the offers/transactions suites: **31 passed, 1 skipped** (serial).

| Spec                         | Status                                             |
| ---------------------------- | -------------------------------------------------- |
| `marketplace.spec.ts`        | ported — 4/4                                       |
| `marketplace-detail.spec.ts` | ported — 8/8                                       |
| `auth-password.spec.ts`      | ported — 5 pass, 1 skip                            |
| `listing-journey.spec.ts`    | ported — 3/3 (incl. the full wizard drive-through) |
| `listing-quality.spec.ts`    | ported — 4/4                                       |
| `seller-publication.spec.ts` | ported — 7/7                                       |

Each spec provisions its own customer(s) + listings (any state), photos, investment
cases, saved/paused listings, and publication-request states in a `beforeAll`, signs
in as the created customer, and tears down in `afterAll`. They self-skip cleanly
(`test.skip(!SUPABASE_SERVICE_ROLE_KEY, …)`) when the full stack is unavailable —
never a vacuous pass.

**The one intentional skip:** `auth-password.spec.ts` › "a customer cannot reach the
admin application". The web Playwright `webServer` starts only the web app (port
3000), not the admin app (3001), so the cross-app redirect check can't run reliably
here. Admin access control is covered by the admin app's own e2e suite. Un-skip this
only in an environment that starts both apps.

New provision helpers: `createListing(state)`, `addPhotos`, `addInvestmentCase`,
`saveListing`, `makePublishable`, `createPublishableListing`, `createPublicationRequest`.
