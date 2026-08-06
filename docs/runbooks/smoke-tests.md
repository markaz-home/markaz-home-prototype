# Runbook: Deployment smoke tests

Record environment, release SHA/tag, tester, time, result, evidence link, and cleanup. Use newly
created disposable accounts and fictional documents only. Never run destructive test data against
production without approval.

## System preflight

- [ ] `pnpm config:check` passes without revealing values.
- [ ] Customer and Admin health/pages answer over HTTPS with expected security headers.
- [ ] Database app and direct paths are reachable by their intended identities.
- [ ] Supabase Auth and Storage endpoints are reachable.
- [ ] A test verification email is delivered; a recovery link returns to the exact customer origin.
- [ ] A safe tRPC query succeeds; a cross-origin mutation receives 403.
- [ ] Logs contain procedure/type, duration, safe outcome/error code, and no secrets or raw tokens;
      add and verify request/trace IDs when the selected monitoring platform is integrated.

## Customer app

- [ ] Landing page, signup, login, marketplace, and a property detail load in English and Arabic.
- [ ] Signup → email code → welcome → dashboard works; incomplete profile metadata uses the profile
      fallback before the dashboard.
- [ ] A new UAE PASS identity creates exactly one CUSTOMER/Auth profile and opens prefilled Profile Setup.
- [ ] Provider onboarding records MARKAZ Terms/Privacy once and reaches Dashboard.
- [ ] Returning with the same UAE PASS identity resolves the same Auth/profile ID.
- [ ] An existing password customer can link UAE PASS and still resolves the same Auth/profile ID.
- [ ] Google signup/sign-in resolves one CUSTOMER when that environment enables Google.
- [ ] A provider identity collision shows safe copy and creates no duplicate profile.
- [ ] Recovery link → reset → forced fresh sign-in works.
- [ ] Anonymous/private route guards redirect safely.
- [ ] Customer can create a listing, upload an approved fictional document/photo, and reach readiness.
- [ ] Marketplace save/offer and accepted-offer transaction handoff work for distinct customers.
- [ ] Private documents remain participant-scoped; public listing images remain readable.

## Admin app

- [ ] Admin login and dashboard load; no signup route exists.
- [ ] A customer is denied Admin access.
- [ ] Publication queue/detail and audit log load.
- [ ] One low-risk controlled action records its closed reason and immutable audit event.
- [ ] Admin document request records requested/granted or requested/failed; DTO/log contains no raw
      path or signed URL.

## Automated equivalent

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
pnpm security:secrets
```

Skipped core integration/E2E tests are a failed controlled-deployment gate. Stop and use the
rollback runbook on incorrect Auth origin, authorization/privacy failure, migration failure, data
corruption, missing audit events, or significant error-rate regression.
