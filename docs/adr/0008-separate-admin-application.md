# ADR 0008: Separate Admin Application

- **Status:** Accepted
- **Date:** 2026-03

## Context

Admin capability (reviewing verifications, moderation, operations) is sensitive.
The common shortcut is to embed admin routes in the customer app behind an
in-app role check. That keeps admin surface in the same deployment, same bundle,
and same attack surface as the public app, and makes a single guard bug an
admin-access bug.

## Decision

Admin is a **separate Next.js application** (`apps/admin`), deployed on its **own
host** (its own domain/origin, `NEXT_PUBLIC_ADMIN_URL`), running on **port 3001**
locally.

- The **customer app (`apps/web`) exposes no admin routes and no admin
  navigation.** Admin functionality is not present in the customer bundle at all.
- The admin app uses the **same OTP auth provider** (Supabase email OTP), but the
  apps are **isolated** deployments.
- After authentication the admin app **loads the profile and requires
  `account_type === 'ADMIN'`**; otherwise it shows an **access-denied** screen.
- API authorization remains enforced by `adminProcedure` + RLS `is_admin()` (see
  ADR 0004), so the database is the boundary regardless of which app calls it.

## Consequences

- Admin surface is physically separated from public surface: separate origin,
  deployment, and bundle. A bug in the customer app cannot expose admin routes
  because they do not exist there.
- The `ADMIN` account type is required at two layers: the admin app's post-auth
  profile gate, and `adminProcedure`/`is_admin()` RLS at the data layer.
- Two apps to build and deploy, and shared packages must not leak admin-only
  concerns into the customer app.
- Authentication UX is consistent (same OTP provider) without sharing
  authorization surface.
