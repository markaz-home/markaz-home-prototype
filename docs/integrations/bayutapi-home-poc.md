# BayutAPI marketplace-feed POC

## Status and scope

This is an **opt-in development/staging POC**, disabled by default. It adds selected Dubai
apartment and villa sale listings to the customer-app home and browse pages through the third-party
[BayutAPI on RapidAPI](https://docs.bayutapi.com/). MARKAZ's own `LIVE` listings remain the
first-party source.

BayutAPI describes itself as scraping Bayut. Bayut is not affiliated with MARKAZ, and this
repository does not establish permission to copy or redistribute Bayut data. Do not enable
this integration in a public or production deployment until the product owner has obtained
written data-redistribution permission and legal approval. Bayut's current
[Terms of Use](https://www.bayut.com/terms.html) must be reviewed as part of that decision.

## Home-page behaviour

- The feed shows up to three newest internal MARKAZ listings first.
- External results fill the remaining spaces, up to six cards in total.
- Equivalent external units are collapsed by image or community/layout signature, and the
  remaining apartment and villa results are selected round-robin when both are available.
- External cards say **External via BayutAPI**, include an unaffiliated-source disclosure,
  and open the source listing on Bayut in a new tab.
- External cards cannot be saved or offered on inside MARKAZ. Only internal `LIVE` listings
  participate in MARKAZ journeys.
- If either source is unavailable, the other may still render. If both are unavailable, the
  optional section disappears and the primary home page remains usable.

## Browse-page behaviour

- Direct MARKAZ results continue to use the internal marketplace search and security-barrier view.
- A separate, clearly labelled external section shows up to twelve selected BayutAPI apartments
  and villas, so third-party cards are not mistaken for direct MARKAZ listings.
- Search, property type, bedroom, bathroom, price, size, community, and sort controls are applied
  client-side to this selected external set. Filters that cannot be verified from the public
  provider projection hide the external set rather than returning misleading matches.
- External cards open on Bayut and expose no MARKAZ Save or Make-an-Offer controls.

## Configuration

Create or update the root `.env` file (never commit the real key):

```dotenv
BAYUT_API_MODE=rapidapi
BAYUT_API_KEY=your-rapidapi-key
```

Restart `pnpm dev` after changing the environment. `BAYUT_API_MODE` accepts only
`rapidapi` as an enabled value; unset, `disabled`, or any other value fails closed with no
network call. Both values are server-only and must never use a `NEXT_PUBLIC_` prefix.

To switch the integration off, set `BAYUT_API_MODE=disabled` or remove both variables.

## Technical and security boundaries

- The upstream host is fixed to `uae-real-estate2.p.rapidapi.com`; callers cannot supply a
  URL or hostname.
- Searches are fixed to the latest Dubai apartments and villas for sale. The browser cannot
  send arbitrary upstream search fields.
- Only an explicit card allowlist crosses the public tRPC boundary: provider ID, title,
  price, type, emirate, community, beds, baths, size, approved image URL, Bayut URL, and the
  provider's verification flag. Agent/contact data, descriptions, permits, and raw payloads
  are neither exposed nor persisted.
- External links and images use HTTPS hostname allowlists. External links use
  `noopener noreferrer nofollow`, and image requests omit the page referrer.
- Requests time out after five seconds. Provider failures return no external results and
  logs contain only a stable error code, never the API key or provider response.
- Successful results use a one-hour in-memory cache to reduce use of the RapidAPI quota.
  The cache is per running app instance and is intentionally not a database of scraped data.
- Unit/component tests mock all provider calls; CI makes no BayutAPI network requests.

## Known POC limitations

- RapidAPI plans and quotas can change. Confirm the current plan before enabling a shared
  staging deployment.
- In-memory cache entries are lost on deploy/restart and are not shared across instances.
- Upstream field/URL changes can make individual results disappear from the allowlisted
  projection.
- Arabic copy is a draft and requires business review.
- Production needs an approved/contracted source, documented takedown and freshness
  processes, monitoring, privacy/security review, and a decision on whether source data may
  be cached or indexed.
