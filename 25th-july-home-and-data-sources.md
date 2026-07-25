# 25 July 2026 — Home page rebuild + external data-source decisions

Continues `15th-july-start-from-here.md`. Branch: `codex/stabilize-auth-home` (not pushed).

## What changed today

The customer home page was rebuilt toward the `markaz-platform` visual direction (that repo is a
**visual reference only** — see the asset-provenance note below), and the third-party listing text
was cleaned up.

### Platform Gold tokens retuned

`packages/ui/src/styles/globals.css`, one place:

- Accent is now the warm copper gold `#C8A27A` (`--primary: 31 41% 63%`); it was a yellower
  `hsl(42 54% 64%)`.
- Canvas is neutral near-black `#0C0C0C` (`--background: 0 0% 5%`); it was warm-tinted.
- Muted body text `0 0% 62%` — 7.3:1 on the canvas.
- New `--hero-search*` roles for the one inverted (light) control on this theme.

This theme is shared by the public **and** auth layouts, so the sign-in/sign-up screens changed
colour too (verified, they render correctly). The authenticated workspace and admin portal still
use Architectural Blue.

### Hero

- Full-bleed cover band. **The cover photograph is deliberately blank** — set
  `--hero-cover-image` on `.platform-gold-hero-cover` when approved artwork exists. Nothing else
  about the hero needs to change.
- Legibility scrim `.platform-gold-hero-scrim`, with an explicit RTL mirror (CSS gradients cannot
  take logical directions).
- Headline "Home starts **here.**" via `t.rich` so the accent survives translation.
- Height is capped so the featured properties stay above the fold on a laptop.
- Nothing above the hero may set `overflow-hidden` — it clips the search dropdowns.

### Header

Three-part: brand at the inline start, the three primary destinations centred **in brand gold**,
Login + Sign Up at the inline end. `PUBLIC_LINKS`/`AUTHED_LINKS` now carry an optional `match`
prefix; links without one never render as active.

**Open item:** "How It Works" points at `/` because the landing explainer cards were removed. It
needs a real page or section.

### Hero search

`apps/web/src/components/landing/hero-search.tsx`.

- Location combobox with typeahead (ARIA 1.2: list popup, `aria-activedescendant`, free text still
  allowed), plus three custom listbox selects — native `<select>` popups cannot be themed and
  rendered as system menus against the light bar.
- `buildPropertySearchQuery` maps the controls onto the query params `/properties` already reads
  (`q`, `type`, `beds`, `minPrice`, `maxPrice`), so the hero is a real filter entry point.
- Suggestions come from `apps/web/src/lib/dubai-communities.ts` (~90 hand-maintained community
  names) merged with communities on LIVE Markaz listings via `marketplace.getFilterOptions`.
- **Deliberately no external-provider query here.** An earlier version fetched the provider with a
  different `limit`, which meant two upstream calls per page load and emptied the featured section.

### Third-party (BayutAPI) listing text

The provider `title` is agent marketing copy — ALL CAPS, typos, promo claims
("4% DLD Waiver | High ROI"), separator spam ("Best Deal / Prime Location / Iconic Structure").

- It is **no longer displayed anywhere**. Cards compose their own headline from structured fields
  via `apps/web/src/lib/external-listing.ts` → "Apartment in Auresta Tower".
- The provider title is still carried in the DTO, for text-search matching only.
- The duplicate type chip (which showed the raw `"Apartments"`) and the repeated community line
  are gone.
- The adapter now classifies townhouses and penthouses (`packages/api/src/integrations/bayut.ts`),
  which also fixes browse filters that could never match them. Every category needs a bucket in
  `selectDiverseCards` or its cards are silently dropped.
- Featured cards are grouped **one property type per row** with a quiet uppercase heading; direct
  Markaz listings sort ahead of external ones inside a group. Two rows max.
- `property.beds` / `property.baths` now use ICU plurals (was "1 beds").

### Copy

- Brand casing is **Markaz**, not MARKAZ, in all user-facing copy: 74 strings across the EN/AR
  catalogues plus page titles and hardcoded component strings. Code comments still say MARKAZ.
- Removed: the three landing explainer cards, and the featured section's
  "Explore recently published Markaz listings…" line.

### Verified

`pnpm typecheck` 12/12 · `pnpm lint` 0 errors (9 pre-existing `<img>` warnings) · `pnpm test`
99 web + 104 integration + all package suites passing. Live browser checks at 1440×900, 390×844,
and RTL. No console or page errors.

## Asset provenance — unresolved

`apps/web/public/markaz-logo-gold.png` is byte-identical to the same file in `markaz-platform`.
`docs/design/markaz-design-foundation.md` §8 says **not** to import imagery, logos, or proprietary
assets from that implementation without documented ownership. It is committed because
`brand-logo.tsx` references it and a fresh checkout would 404 otherwise, but it still needs either
ownership sign-off or replacement with a reviewed gold vector export before production. The hero
photograph was **not** copied for the same reason.

## Next: external data sources (in progress elsewhere)

Being handled with Codex; resume after.

### Locations

- The listing provider host we are pinned to, `uae-real-estate2.p.rapidapi.com`, has **no**
  locations endpoint (probed: `locations_search`, `locations`, `auto_complete`, `autocomplete`,
  `locations_tree`, `areas`, `communities`, `suggestions`, `search_locations` — all 404).
- The same provider family's **v3** (`uae-real-estate3.p.rapidapi.com`) does expose
  `GET /autocomplete` ("search locations across Dubai and UAE, get location IDs"). Our key returns
  401 there — it needs its own subscription (free tier 900 req/month). Same legal caveat as the
  listing scraper.
- **Intended production source:** the DLD area/community register published on Dubai Pulse (now
  `data.dubai`, run by Dubai Data & Statistics Establishment under Digital Dubai) — machine-readable
  and register-grade under Dubai Data Law. Import once into Postgres, query locally: no
  per-keystroke external call, works in CI and when the provider is disabled.
- Caveat: DLD names are administrative ("Al Thanyah Third"), buyers type market names
  ("The Meadows"). Needs the register **plus an alias layer** — roughly what
  `dubai-communities.ts` already is.
- `dubailand.gov.ae` open data is dashboards + per-query CSV, no API; it points to Dubai Pulse for
  history. Use Dubai Pulse to ingest, the DLD portal to verify definitions. Confirm which access
  tier the register sits in — Dubai Pulse has a restricted government-only exchange hub.
- Neither DLD nor Dubai Pulse provides **listings**; they provide transactions, rents, valuations
  and indices — good for price benchmarks, comparables, and the Investment Case.

### More listing sources

1. **Licensed broker & developer XML/JSON feeds — the sustainable answer.** This is how the portals
   themselves fill up; they receive feeds, they do not hand listings out. Legally clean, richer than
   scraped cards, and carries Trakheesi permit numbers.
2. **Commercial market data** — Property Monitor (Cavendish Maxwell), Property Finder market data.
   Licensed, paid, market data rather than inventory.
3. **Scraper APIs (where Bayut sits today)** — instant but redistribution rights are the blocker,
   and three scrapers is three times the exposure, not diversification. Keep behind
   `MODE=disabled` in production.
4. **Reelly** (Dubai off-plan developer inventory) — API terms unverified; needs direct enquiry.

**Do not build on** the Apify "Dubai Property Unit Finder", which markets itself as an anti-bot
bypass for PropertyFinder/Bayut/Dubizzle. Circumventing bot protection is a different category of
problem from scraping.

### Refactor to do regardless of provider choice

The Bayut adapter is hardwired: one fixed host, one query shape, one badge, one dedupe pass. Turn it
into an `ExternalListingProvider` interface (fetch + normalise to one DTO) with a registry so
provider #2 is config rather than surgery, per-provider host/image allowlists, **cross-provider
dedupe** (the same unit appears on several portals; today's signature dedupe only works within one
source), and per-source badges instead of the hardcoded "External via BayutAPI".

## Still untracked

`POST-WEEK-6-RELEASE-READINESS-AUDIT.md` (dated 19 July) is deliberately left untracked — commit it
if it should be part of the repo.

---

## Later on 25 July — auth screens + real UAE PASS identity

### Auth screens on the Platform Gold direction

Sign-up, sign-in and the status screens now use the near-black card treatment: centred card
(`AuthShell` sizes it — 430 narrow / 500 default / 620 wide), uppercase micro-labels, translucent
fields focusing to gold, gold pill primary action, circular gold checkbox. **All of it is scoped CSS
under `.platform-gold-auth-card`** in `packages/ui/src/styles/globals.css`, so the shared `Input`
and `Button` components are untouched and the rest of the app keeps its normal sizing.

Sign-up specifics: single column, sized to fit 1440×900 unscrolled, support panel removed,
`STEP 01 · ACCOUNT DETAILS` eyebrow over a three-segment progress bar, and **one combined consent
control** — the UI is a single checkbox but it still writes `acceptTerms` and `acceptPrivacy`
separately, so the schema and the separate accepted-at timestamps are unchanged.

**The error-summary panel was removed** from all four auth forms (component deleted). Inline field
errors already carry `role="alert"`, and react-hook-form's `shouldFocusError` now moves focus to the
first invalid field — the summary was stealing that focus. The consent box is controlled, so it has
no ref for RHF to focus; `sign-up-form.tsx` focuses it explicitly when it is the only thing left to
fix. `validation.errorSummaryTitle` stays in the catalogue — the listing wizard still uses it.

Two layout bugs found and fixed by looking at screenshots, worth remembering:

- Nothing above the hero may set `overflow-hidden` — it clipped the search dropdowns.
- `min-h-full` on the auth shell never resolved, because `main` was `flex-1` with `height: auto` and
  a percentage min-height needs a definite parent. Short cards hugged the top while the tall sign-up
  card looked fine. `main` is now a flex column and the shell takes `flex-1`.

### Real UAE PASS Staging identity step

Spec: `docs/integrations/uae-pass-identity-step.md`. The identity step now performs a **real UAE
PASS Staging round trip** via `supabase.auth.linkIdentity()` — never `signInWithOAuth()`, which
would start a new session and could silently move the customer into a different account.

**The customer-facing simulation is gone.** Consequence: anyone without the UAE PASS staging mobile
app and a test account cannot complete onboarding. Fine for device-based demos; reconsider before
showing this to anyone who does not have it.

Still open, and not Codex's to decide: `enable_manual_linking` on the **hosted** Supabase project
(it 422s in staging without it), whether a customer can unlink, and what happens if the Emirates ID
behind a staging account is not theirs.

### Local-stack gotcha that cost an hour

Sign-up hung on "Creating account…" with no response. Root cause was **not** the app: GoTrue blocks
sending mail when it cannot fetch its templates, logging
`Get "http://supabase_kong_markaz-home:8088/email/confirmation.html": context deadline exceeded`.
Kong serves those templates on **port 8088** and that listener had died after ~10 days uptime; the
container had also wedged so hard that `docker kill -s KILL` returned "did not receive an exit
event". Fixing it needed a full Docker Desktop restart (`open -a Docker` silently did nothing —
launching `/Applications/Docker.app` by full path worked), after which Kong and edge-runtime had to
be started manually. The database volume was untouched.

If sign-up ever hangs again, check `docker logs supabase_auth_markaz-home | tail` first — that
template line appears immediately.

Verified after all of the above: `pnpm typecheck` 12/12 · `pnpm lint` 0 errors · `pnpm test` 8/8
packages (53 files) · `pnpm build` web + admin. Plus a live end-to-end sign-up on localhost: account
created → real six-digit code delivered to Mailpit → verified → `/verify-email/success`.
