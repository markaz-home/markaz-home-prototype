# Runbook: Email readiness

## Message inventory

- **Signup verification:** confirmation template renders the Supabase six-digit `Token`; the app
  verifies it as `type: signup`.
- **Password recovery:** recovery template renders the official link to
  `<web-origin>/auth/confirm?token_hash=…&type=recovery`; the handler verifies the token before
  password reset.
- The app never creates, persists, or logs codes, links, passwords, or token hashes.

Local email is captured by Mailpit at `http://127.0.0.1:54324`. It is not delivery evidence.

## Staging/production setup

1. Select an approved provider and sending region.
2. Verify sender domain, SPF, DKIM, DMARC, return path, and sender/reply-to addresses.
3. Set exact HTTPS Site URL and redirect allow-list before sending a test.
4. Install the repository templates, preserving code vs link semantics.
5. Configure and document provider/GoTrue rate limits and bounce/complaint handling.
6. Test delivery to representative providers, spam placement, expiry, single use, resend, invalid
   links/codes, and support escalation.
7. Review English and Arabic copy, wrapping, directionality, legal language, and accessible link
   labels. Arabic copy is currently draft.
8. Route provider failures to monitoring without logging recipient data or token-bearing URLs.

## Failure behavior

The UI exposes safe resend/retry/recovery states and generic provider errors. A delivery outage must
not bypass email verification. Operations may inspect provider metadata under approved access but
must not ask users for passwords, codes, or links.

## Readiness decision

Local templates and full Auth E2E are validated. Production email is **not ready** until provider
credentials, verified domain/sender, redirects, deliverability, rate limits, monitoring, owner, and
Arabic review are confirmed.
