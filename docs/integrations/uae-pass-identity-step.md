# Retired: post-sign-up UAE PASS identity step

**Status:** Retired by [ADR-0030](../adr/0030-optional-uae-pass-sign-in.md) on
2026-08-02.

The former `/[locale]/onboarding/uae-pass` checkpoint is no longer part of
customer signup. Email/password customers complete account details, verify the
six-digit email code, see Welcome, and continue to Dashboard. The old route now
redirects to Dashboard so existing bookmarks are safe; the normal server guard
still enforces authentication, email verification, profile completeness, and
the customer/admin boundary.

UAE PASS Staging remains available on the Sign In screen as an optional Supabase
custom OAuth provider. See [uae-pass-staging-poc.md](./uae-pass-staging-poc.md).
The persisted identity enum, existing audit history, and verified server synchronization function
remain available for future regulated work. Optional sign-in itself is represented by Supabase Auth;
profile identity status is not an onboarding or dashboard-access gate.
