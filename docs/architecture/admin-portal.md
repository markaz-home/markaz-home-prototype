# Admin portal & operational controls (Week 6)

The `apps/admin` operations portal and the server machinery behind it. This is the
authoritative architecture note; see `WEEK-6.md` for the build log and
ADR-0024…0029 for the decisions.

## 1. Shape

A **separate Next.js app** (`apps/admin`, port 3001). The customer app exposes **no**
admin route or link. Admin pages live under `[locale]/(portal)/*` behind `requireAdmin`
(cookie session → `account_type === 'ADMIN'`, else access-denied). Eight fixed nav areas
(§8): Overview (list only) + 7 areas each with a list + detail page = 15 operational routes, plus a
root `[locale]/page.tsx` redirect to `/overview`. A header hosts global search; a dark-blue
sidebar hosts the nav, language switch, and sign-out.

## 2. Security boundary (unchanged model)

RLS remains **the** boundary. The admin session uses the same `withUserContext`
transaction pattern as customers (`SET LOCAL role authenticated` + JWT claims), so
`auth.uid()` resolves and **admin RLS policies** (via `public.is_admin()`, SECURITY
DEFINER) grant cross-account read. Admins have **read** access through RLS; every
consequential **write** goes through an `is_admin()`-gated `SECURITY DEFINER` function —
never a direct table write from the request role. The service-role key is never used for
an admin request except the dedicated, audited document-URL mint.

## 3. Capabilities (server-authoritative)

`packages/domain/src/admin.ts` defines 16 capabilities. The tRPC tier
`adminCapabilityProcedure(cap)` (`packages/api/src/trpc.ts`) checks
`hasCapability(PROTOTYPE_ADMIN_CAPABILITIES, cap)` and throws `FORBIDDEN
'CAPABILITY_REQUIRED'` before any work. The prototype ADMIN holds all 16, but the check is
real: the UI only _reflects_ server capability (hides a control), it never _is_ the gate.
See ADR-0024.

## 4. Controlled actions (reason-coded + audited)

Every mutation is: capability-gated → parameterised by a **closed reason enum** (no
free-text authority; no hidden default in the UI selector) → executed by a SECURITY
DEFINER function that re-derives the actor from `auth.uid()`, validates state, and writes
an `audit_events` row. Actions: restrict/restore customer, pause/resume listing, approve
(reuses the canonical Week-3 compensated `PublicationReviewService.resolve`) / return
publication, retry verification, close offer thread, pause/resume/retry-step/mark-failed/
resolve-cancellation transaction, add note. See ADR-0026.

### Restriction (ADR-0025)

Two-state (`ACTIVE`/`ACTIONS_RESTRICTED`) flag on `profiles`. `is_restricted(uid)` is
folded into offer/listing/publication write functions → `ACCOUNT_RESTRICTED`. Restriction
blocks **new consequential actions only** — never sign-in, browsing, or public listings.
`guard_profile_restriction()` prevents the request role from setting the flag directly.

### Progression pause

`transactions.progression_paused_at` + `tx_lock` raising `PROGRESSION_PAUSED` freezes
milestone advancement without touching immutable identity.

## 5. Immutability

- Proposal amounts, accepted offers, and transaction identity are guarded by the Week-4/5
  triggers — no admin path can alter them.
- `audit_events` is immutable at the **grant** level: `revoke update, delete, truncate …
from authenticated`, so even an RLS-passing admin gets permission-denied, not a silent
  zero-row update.

## 6. Privacy projections

`packages/api/src/admin-projection.ts` maps rows to DTOs with an explicit allow-list, even
for admins: emails are masked in lists; audit metadata is filtered to a safe key allow-list
(never tokens, storage paths, signed URLs, or raw errors); document metadata **never**
includes the storage path. Raw enums never reach the UI as text — the client maps them to
i18n keys + a semantic tone.

## 7. Private-document access (ADR-0027)

Two capabilities: `VIEW_PRIVATE_DOCUMENT_METADATA` (safe metadata list) and
`ACCESS_PRIVATE_DOCUMENT` (open). Opening requires an explicit purpose (reason enum) + an
acknowledgement checkbox. The audit is an **exact lifecycle** (migration `…0815`):
`ADMIN_DOCUMENT_ACCESS_REQUESTED` before minting a 300-second signed URL (via the allow-listed
`adminPrivateSignedUrl`), then `GRANTED` on success or `FAILED` on mint failure — and the procedure
**returns** rather than throws on failure so the FAILED audit commits (a throw would roll back the
whole request transaction). The path/URL is never returned, logged, or shown.

## 8. Realtime (ADR-0029)

Live operational queues: `useAdminQueueChannel` (`@markaz/realtime`) subscribes to
`listing_publication_requests` (published in `…0812`) and `transactions`, and on any change refetches
authoritative dashboard metrics (a server-component refresh). Realtime signals a **refetch**, never
the source of truth; the payload is not read, and admin RLS scopes delivery. A `QueueLive` indicator
surfaces only a reconnecting/stale connection (hidden while healthy).

## 9. UI system

Shared kit under `apps/admin/src/components/admin/`: responsive **data-table** (desktop
semantic table → mobile record cards, no bulk actions), **status badge** (text + icon,
never colour-only), **action-dialog** shell + **reason selector**, **notes panel**,
**document panel**, **global search** combobox, **filter tabs** + **pagination** (URL
state), public/private **data sections**. i18n is 446 nested `admin.*` keys with exact
EN/AR parity (Arabic draft/unreviewed). a11y: skip link, `aria-current`, semantic tables,
LTR-safe references/amounts, RTL logical properties. See ADR-0028.
