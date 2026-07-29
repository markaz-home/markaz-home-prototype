# POST-WEEK-6 RELEASE-READINESS AUDIT

**Date:** 2026-07-19
**Branch audited:** `codex/document-main-ci-followup` (HEAD `710d2a6`)
**Type:** Decision-gate audit (read-only). No features built. No code changed.
**Question:** Do we need a **Week 7 (hardening/UAT/RC)** and a **Week 8 (production deployment)**, or is the prototype already sufficiently complete?

---

## 1. Executive recommendation

**The Weeks 1–6 feature build is complete and, at the last documented full run, green** (typecheck 12/12 · lint 11/11 · **258** unit/component/integration · **36** E2E · **5** axe, web + admin builds passing). All six Week-6 closure items are resolved and verified in code. The security model is internally consistent and enforced at the database boundary. **No unfinished product feature blocks an internal demo.**

Two things are true at once:

1. **For an internal prototype demo, the project is effectively done.** The only live issue is CI hygiene, not a product defect (see §6). A demo runs locally where every flow already passes.
2. **The project's own trajectory has already moved past "feature-complete prototype"** — post-Week-6 work (UAE PASS staging POC, BayutAPI POC, a two-branch CI pipeline, a provider-neutral deployment runbook) has landed, and the current handoff is explicitly aimed at a **first dev/staging deployment**. That direction is what pulls in real Week-7/Week-8 work.

**Chosen recommendation: B** — _Do a short Week-7 release-candidate/closure pass. Week 8 is not required unless deploying externally or to production._ If the goal is purely an internal demo, this collapses toward **A** (closure only). If the goal is real production, it escalates to **D**. See §23.

**~~The single most time-sensitive item~~ (RESOLVED 2026-07-19):** the previously-red `main` CI (listing-wizard E2E timeout — CI navigation latency, not an app regression) is now **green**. The 20 s navigation-waits repair merged `develop → main` as `00bb03f` (PRs #14/#15); the latest `main` run **#29685009701** at `7c42059` completed **success** across quality + Supabase integration + web & admin E2E. The protected pipeline is green; this is no longer a blocker.

---

## 2. Current feature-completion status

| Feature                                                                                | Status                                                                                        | Basis                                                        |
| -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Auth / onboarding (email+password, 6-digit verify, link recovery, verified-email gate) | **Done**                                                                                      | WEEK-1.5 §19                                                 |
| Listing creation (`DRAFT → READY_TO_PUBLISH`, resumable, bilingual)                    | **Done**                                                                                      | WEEK-2                                                       |
| Publication (`READY_TO_PUBLISH → review → LIVE ↔ PAUSED`, compensated pipeline)        | **Done**                                                                                      | WEEK-3                                                       |
| Marketplace (public, anon-or-auth, security-barrier view)                              | **Done**                                                                                      | WEEK-3                                                       |
| Saved Properties (RLS-gated, anon-save intent)                                         | **Done**                                                                                      | WEEK-3                                                       |
| Offers / negotiation (immutable proposals, single-accept, expiry)                      | **Done**                                                                                      | WEEK-4 (approved to close)                                   |
| Transactions (simulated 6-stage/17-task workspace)                                     | **Done (functional)**; pixel-level §37 gallery polish deferred                                | WEEK-5                                                       |
| Admin Portal (16 capabilities, audit, doc access)                                      | **Done**                                                                                      | WEEK-6 (all phases A–E green)                                |
| Notifications (single reused table, discriminated-union kinds)                         | **Done**                                                                                      | WEEK-4/5                                                     |
| Realtime (offers, transactions, **admin queue**)                                       | **Done**                                                                                      | verified: `packages/realtime/src/use-admin-queue-channel.ts` |
| Audit logs (grant-level immutable)                                                     | **Done**                                                                                      | WEEK-6 Phase A                                               |
| Documents — transaction                                                                | **Partial (real gap):** storage + audited admin read done; **customer upload API/UI pending** | ADR-0023                                                     |
| English                                                                                | **Done**                                                                                      | full i18n parity                                             |
| Arabic                                                                                 | **Partial: machine-draft, unreviewed** (flagged everywhere)                                   | README / ADR-0009                                            |
| RTL                                                                                    | **Done** (`dir`, logical CSS, `dir="ltr"` money)                                              | WEEK-4 §19                                                   |
| Mobile                                                                                 | **Done (functional)**; no automated mobile-viewport E2E                                       | WEEK-4 §20                                                   |
| Accessibility                                                                          | **Done** (axe 0 serious/critical)                                                             | WEEK-4/6                                                     |
| Admin controls                                                                         | **Done** (server-authoritative, capability-gated)                                             | WEEK-6                                                       |

**Only one genuinely unfinished _feature_:** transaction **document upload** (ADR-0023: "Storage foundation built; upload API/UI pending"). Everything else is complete or is explicitly-deferred visual polish (not feature work, does not block understanding).

---

## 3. Is Week 7 required?

**Classification: RECOMMENDED (not Required for internal demo; Required for UAT).**

Week 7 as a _hardening/UAT/release-candidate_ pass is justified, but it is **small and adds no features**. Against the decision framework's "Week 7 is required for a demo only if…" triggers:

- Main flows unreliable? **No** — all green at last run.
- Full root validation not run? **No** — it was run (258/36/5), though pinned to the now-stale chain label "0100→0815" (see §11).
- Major E2E gaps? **No** — admin private-document access and transaction-recovery E2E both exist and were verified.
- Admin/transaction recovery paths broken? **No** — verified in `apps/admin/e2e/admin.spec.ts`.
- Visible broken screens? **None found.**
- Security gaps exposable in demo? **None found.**

So Week 7 is **not required for a demo**. It becomes **required before UAT** because UAT needs accurate documentation, a green pipeline, and a decision on the document-upload gap. Recommended Week-7 scope is in §20.

---

## 4. Is Week 8 required?

**Classification: REQUIRED ONLY BEFORE PRODUCTION. Not needed for the current prototype/demo goal.**

Week 8 (production environment, backups, monitoring, rate limits, security headers, email domain, secret management, incident response) maps to concerns the repo **deliberately does not implement yet** and largely **hands to a separate platform-engineering workstream** (`infra/` is contracts/placeholders only; AWS is not provisioned; self-hosted-Supabase-on-RDS is "NOT VALIDATED" per ADR-0006). None of it is needed for an internal demo. A **reduced subset** (the "first dev deployment" definition-of-ready in the handoff) is needed only if you stand up a shared dev/staging environment. The full set is required before real users. Scope in §21.

---

## 5. Recommended release target

**Primary: A — Internal prototype demo → READY NOW** (pending the CI-green confirmation in §6).

**Secondary (project's stated direction): B — External pilot / first dev deployment → a short Week-7 closure pass + the reduced Week-8 "first dev deployment" subset.**

**Not the current goal: C — Production** (would require full Week 7 + Week 8).

The docs consistently frame this as a **prototype** where "only the regulated integrations (UAE PASS, DLD, Trakheesi, payment) are simulated." Do **not** apply production standards to the demo target.

---

## 6. Stop-now risk assessment

If you stop feature development now (which is the correct call), the residual risks are:

| Risk                                                                                                       | Severity for **demo**      | Severity for **UAT**                          | Severity for **prod**          |
| ---------------------------------------------------------------------------------------------------------- | -------------------------- | --------------------------------------------- | ------------------------------ |
| ~~`main` CI red (listing-wizard E2E timeout)~~ **RESOLVED** — `main` run #29685009701 (`7c42059`) is green | **None**                   | **None**                                      | Resolved                       |
| Transaction document-upload API/UI missing (ADR-0023)                                                      | Low (avoid in demo script) | **Medium** (blocks any doc-exchange UAT path) | High                           |
| Documentation drift (CLAUDE.md / AGENTS.md / ADR-0003 / architecture docs stale vs code)                   | Low                        | **Medium** (reviewers trust stale claims)     | Medium                         |
| Arabic copy unreviewed                                                                                     | Low (flagged)              | Medium (if Arabic in UAT scope)               | **High** (legal/transactional) |
| No production ops (backups/monitoring/rate limits/headers/email domain)                                    | None                       | Low–Medium                                    | **Blocker**                    |
| RDS/self-hosted-Supabase not validated (ADR-0006)                                                          | None                       | Medium (if dev uses it)                       | **Blocker**                    |
| No automated mobile-viewport E2E / no two-subscriber realtime delivery test                                | Low                        | Low                                           | Medium                         |

**Nothing here is a product-correctness defect.** The build is sound; the risks are release-plumbing, documentation accuracy, and production operations.

---

## 7. Must-fix before demo

1. ~~**Land the CI follow-up.**~~ **DONE (2026-07-19)** — the navigation-waits fix merged to `main` (`00bb03f`, PRs #14/#15) and the latest `main` run **#29685009701** (`7c42059`) is green across quality + Supabase integration + web/admin E2E.
2. **Prep a demo script that avoids the transaction document-upload step** (the one unfinished feature) and states which integrations are simulated. The seed-free demo runbook (`docs/runbooks/demo-runbook.md`) already supports this.

With item 1 resolved, this is the entire remaining pre-demo list — and item 2 is script prep, not code. **The prototype is demo-ready now.**

---

## 8. Must-fix before UAT

1. Everything in §7.
2. **Reconcile documentation drift** (§18) so UAT reviewers aren't reading contradictory claims.
3. **Decide the document-upload gap:** build the register/remove/signed-URL API + upload control (ADR-0023) **or** explicitly scope document exchange out of UAT.
4. **Re-run full validation on the actual current tree** (including migration `0817`), **serially** on constrained Docker, and record it — the recorded run predates `0817`.
5. **Arabic:** either keep it visibly flagged as unreviewed draft to UAT users, or get a review if Arabic is in UAT scope.
6. **Basic dev-environment monitoring + a confirmed rollback path** (the handoff's "first dev deployment" readiness).
7. _(Recommended)_ add a mobile-viewport E2E and a two-subscriber realtime delivery test.

---

## 9. Must-fix before production (Week 8 core)

- Select production hosting provider + **approved UAE data-residency region**.
- **Validate self-hosted-Supabase-on-RDS (§6A.1 gate, ADR-0006)** or adopt the documented managed-Postgres fallback.
- Configure + validate **production server-side GoTrue password policy** (ADR-0009 — local CLI can't).
- **Env-schema validation** (today only a single runtime guard in `packages/auth/src/env.ts`; no zod/t3-env schema).
- **Security response headers** — CSP, HSTS, X-Frame-Options (none present in either `next.config.mjs`).
- **Application/API rate limiting** (none; only Supabase's built-in email-send limit).
- **Automated backups + PITR + a restore drill** (only named as a checklist item, unvalidated).
- **Monitoring / alerting / uptime + error tracking** (pino structured logging with redaction exists; no Sentry-class error tracking, no alert thresholds, no uptime checks).
- **Production email provider + sender domain** (SES/DKIM/SPF/DMARC) and verified signup-code + recovery delivery.
- **Storage bucket production policy verification**; **secret management + rotation** (policy documented; no mechanism/runbook).
- **Incident-response playbook** + **admin operational runbook** (neither exists; only a 6-line generic rollback section).
- **Legal/compliance copy review** (Arabic legal/transactional).
- **UAE PASS production onboarding**; **replace/approve or keep-disabled BayutAPI** (scrapes Bayut — keep `BAYUT_API_MODE=disabled` in prod).
- **Connect the deployment pipeline to CI** + production **smoke tests** (runbook is provider-neutral; the deploy step is intentionally absent pending provider selection).

---

## 10. Deferrable work

- **`REJECTED` listing state is dead/unreachable** — intentional (reserved for a future admin decision). Leave as-is; note it.
- **Migration `0816` gap** — a harmless skipped sequence number (nothing references it). No action beyond a one-line note.
- **`REJECTED` label collision** (listing vs offer state sets) — docs-only disambiguation; cosmetic.
- **`apps/worker`** — documented placeholder; do not deploy.
- **Pixel-level §37 transaction gallery visual polish** — explicitly deferred (WEEK-5).
- **Durable job queue** — out of scope; expiry/simulation are correctly lazy-on-read.

---

## 11. Full-system validation evidence

**CI pipeline exists** (`.github/workflows/ci.yml`): a no-Docker `quality` job (prettier, eslint, typecheck, unit/component tests, web+admin build) and a Docker `full-stack` job (real Supabase, integration suite gated so a vacuous run fails, web + admin E2E). Runs on `develop` and `main`.

**Last recorded full run (WEEK-6):** `typecheck` 12/12 · `lint` 11/11 · `test` **258** (0 failed, 0 skipped) · `build` web 64 pages + admin 36 · `test:e2e` **36** (web 21 + admin 15, 0 failed/skipped) · **5 axe**, fresh chain **0100→0815**.

**Live gaps in the evidence:**

- The recorded run is pinned to **"0100→0815"**, but the tree now carries migration **`0817` (`oauth_optional_email`, a UAE PASS email-less OAuth fix)** — an **undocumented post-Week-6 addition referenced in no doc.** CI's comment also still says "0100→0815". The headline numbers predate `0817` and should be re-run.
- The recorded run required **serial** execution on constrained Docker; a concurrent run once produced flaky timeouts + a wedged daemon — the same class of latency that previously reddened `main` (now fixed via the 20 s navigation waits; `main` #29685009701 is green).
- **Accepted fresh-stack path** (for the known `supabase db reset` hang): `pnpm supabase stop --no-backup && pnpm supabase start` → migrations auto-apply → optional `pnpm db:setup` → sign up in app. **Documented in README.md / CLAUDE.md but NOT in `docs/runbooks/database-reset.md`** (a doc-placement gap, §18).

---

## 12. Test gaps

- **No automated mobile-viewport E2E** (functional mobile is code-reviewed only).
- **No automated two-subscriber realtime delivery test** (realtime is code-reviewed; refetch-on-event is correct-by-design).
- **One permanent intentional skip:** `apps/web/e2e/auth-password.spec.ts:163` ("a customer cannot reach the admin application") — the web Playwright `webServer` starts only port 3000, so the cross-app negative test never runs here. **Documented** (`apps/web/e2e/FOLLOWUP-selfprovision.md`); would run in an environment that starts both apps. All other skips are runtime env-guards (stack-down), not disabled tests. **No `.only` anywhere** (no CI hazard).
- **"5 axe" under-counts actual coverage** — axe assertions live in **8 spec files / 18 `.analyze()` calls**; the "5" is a Week-6 subset. Not a gap, but the reported figure is misleadingly low.

---

## 13. Security and RLS gaps

**No security defects found.** The model is internally consistent across all 29 ADRs and the architecture docs:

- CUSTOMER/ADMIN separation enforced twice (profile gate + `is_admin()` RLS; separate app/origin/port — ADR-0002/0008).
- RLS **enabled and forced** on all tables; client/route guards are UX-only (ADR-0004).
- All offer/transaction/admin writes go through `SECURITY DEFINER` functions that re-derive the actor from `auth.uid()`; customers hold read-only RLS (ADR-0014/0019/0026).
- Public/offer/transaction/admin DTOs use **explicit allow-list projections** (ADR-0013).
- Audit events **immutable at the grant level** (ADR-0026).
- Notification privacy (recipient-only RLS; seller threshold never in buyer DTO).
- Realtime is a **refetch trigger only**; payload never trusted; RLS scopes delivery (ADR-0018/0029).
- **No service-role for customer requests**, with exactly two named/bounded exceptions: the public-photo copy pipeline (ADR-0012) and the audited admin document-URL mint.

**Self-declared (not defects, production follow-ups):** production server-side password policy not yet configured/validated (ADR-0009); session-expiry detection best-effort; RDS topology not validated (ADR-0006).

---

## 14. Storage and document-access gaps

- **Draft photo privacy** (private bucket + signed URLs, ADR-0011) and the **compensated public-photo pipeline** (ADR-0012) are complete and integration-tested (`publication-security.test.ts`).
- **Admin private-document access** is complete with the exact **request→granted/failed lifecycle audit** (migration `0815`, ADR-0027) and an E2E flow.
- **Gap:** **transaction customer document upload** — register/remove/signed-URL API + upload control **pending** (ADR-0023). This is the one functional hole.
- **Production storage-bucket policy verification** is not done (Week-8 item).

---

## 15. Realtime gaps

- Offer, transaction, and **admin queue** channels are all **implemented and verified** (`use-admin-queue-channel.ts`: subscribes to `listing_publication_requests` + `transactions`, debounced authoritative refetch, connection-status tracking). The Week-6 "admin queue realtime" closure item is **done, not deferred.**
- **Only gap:** no automated multi-subscriber delivery test (design-safe because state is always a fresh RLS-scoped refetch).

---

## 16. Accessibility gaps

- Axe passing with **0 serious/critical** across 8 spec files / 18 scans (auth, marketplace, listing, offers, transactions, admin).
- **No open accessibility gaps** for the demo/UAT bar. (Optional: broaden axe to any screens not yet scanned.)

---

## 17. Mobile and RTL gaps

- **RTL: done** — `dir="rtl"` on `<html>` for `ar`, logical CSS properties, money forced `dir="ltr"`.
- **Mobile: functionally done** (responsive layouts, sticky action bars) but **no automated mobile-viewport E2E** — a recommended-not-required test gap.

---

## 18. Documentation gaps (stale / contradictory — report, do not silently trust)

1. **CLAUDE.md** Week-5 section lists **"Known gaps: document file-upload API/control, Playwright E2E, axe"** — the last two are **completed** in WEEK-5/WEEK-6; only file-upload remains. Stale.
2. **AGENTS.md** still says **"This repo is the Week 1 application foundation"** and lists the admin surface as out of scope. Stale by five weeks.
3. **ADR-0003** still asserts **demo customers/data are seeded** and lists the now-dropped `offers`/`counter_offers`/`transaction_stage_history` tables — **reversed by ADR-0009** and `application-overview.md`, yet still marked "Accepted" with no supersession note.
4. **`docs/architecture/auth-and-rls.md`** policy matrix references the **removed `transaction_stage_history`** and omits the Week-5 transaction tables.
5. **`docs/architecture/application-overview.md`** lists **OTP as the "real" auth** in one section (superseded by email+password, ADR-0009).
6. **ADR-0007** context text still says "Inbucket"/OTP (decision still valid; text stale).
7. **Migration chain label "0100→0815"** in CLAUDE.md / WEEK-6 / CI is stale — the tree has **`0817`** (and a harmless `0816` numbering gap), referenced in no doc.
8. **Admin i18n key count:** ADR-0028 + `admin-portal.md` say **446**; CLAUDE.md says **454**. One is wrong.
9. **Reset-hang fresh-stack workaround** is in README/CLAUDE.md but **missing from `docs/runbooks/database-reset.md`**, where an operator would look first.

_Note: per the audit constraint, these are reported, not fixed. Reconciling them is the natural content of a short Week-7 closure pass._

---

## 19. Deployment-readiness gaps

- **Deployment runbook exists but is provider-neutral by design** — real branch/env mapping, CI gates, rollback section, per-integration prod policy; the actual "deploy to X" step is intentionally absent pending provider selection.
- **`infra/` is contracts/placeholders only** — no real Terraform (`main.tf.placeholder`), AWS not provisioned, self-hosted-Supabase-on-RDS "NOT YET VALIDATED."
- **Absent / named-but-not-operationalized:** env-schema validation; automated backups/PITR; monitoring/alerting/uptime + error tracking; app/API rate limiting; security headers; email sender-domain/deliverability; incident-response playbook; admin operational runbook; a CI-connected deploy step + prod smoke tests.
- All of this is **consistent with the stated prototype posture** and mostly a **platform-team workstream** — it is Week-8 work, not a gap in the application build.

---

## 20. Recommended Week 7 scope (if run) — a short RC / closure pass, no features

1. ~~**Land + verify the CI repair**~~ **DONE** — `main` is green (#29685009701, `7c42059`) after the navigation-timeout fix. If it ever re-flakes, inspect the Playwright trace/tRPC mutation before widening timeouts.
2. **Re-run full validation on the current tree including `0817`, serially**, and record it as the canonical evidence (replacing the "0100→0815" figures).
3. **Reconcile documentation drift** — the nine items in §18 (CLAUDE.md, AGENTS.md, ADR-0003, auth-and-rls.md, application-overview.md, ADR-0007, migration-chain label, i18n count, database-reset.md).
4. **Decide the transaction document-upload gap** — build the ADR-0023 API + upload control, or explicitly scope it out.
5. **Cross-feature regression + bug bash** across the six journeys; write the **UAT script** and the **demo script** (seed-free).
6. _(Recommended)_ add a **mobile-viewport E2E** and a **two-subscriber realtime delivery** test; broaden axe if any screen is unscanned.
7. **Arabic review flag** — confirm draft-copy is visibly flagged wherever a reviewer/UAT user sees it.
8. Produce a **release-candidate report.**

This is days, not a full week, and contains **no new product features.**

---

## 21. Recommended Week 8 scope (if run) — deployment readiness, no features

Two tiers:

**8a — "First dev deployment" (only if standing up shared dev/staging):** provider + region selection; separate dev Supabase project; env vars in the hosting dashboard; dev domains + Supabase redirects + email templates; UAE PASS staging redirect registration; run migrations + admin bootstrap + smoke checks; confirm signup-code + recovery delivery on the dev domain. (This is the handoff's documented "definition of ready.")

**8b — Production (before real users):** the full §9 list — RDS/§6A.1 validation, production password policy, env-schema validation, security headers, rate limits, automated backups + restore drill, monitoring/alerting/error-tracking, production email domain (SES/DKIM/SPF/DMARC), storage prod policies, secret management + rotation, incident-response + admin operational runbooks, legal/Arabic copy review, UAE PASS production onboarding, BayutAPI resolution, CI-connected deploy + smoke tests.

---

## 22. Suggested combined plan (if Week 7 and Week 8 are merged)

If the decision is to go straight for a **shared dev/staging deployment for a small pilot**, merge into a single **~1-week "Release-Candidate + Dev-Deployment Readiness" pass**:

- **Days 1–2 (RC / closure):** §20 items 1–5 (CI green, re-validate incl. `0817`, doc reconciliation, document-upload decision, UAT/demo scripts).
- **Days 3–4 (dev-deployment readiness — Week-8a):** §21 tier 8a (provider/region, dev Supabase project, env config, domains/redirects, migrations + bootstrap + smoke checks, verified email delivery on dev).
- **Day 5 (guardrails + hand-off to platform):** add env-schema validation, security headers, and basic rate limiting at the app layer (cheap, high-value, and they also serve prod); formally hand the §21 tier 8b production-ops backlog (RDS validation, backups, monitoring, email domain, incident runbooks, legal review) to the platform-engineering workstream.

Full production (§21 8b) stays a **separate, gated** effort — it must **not** be collapsed into this pass, since ADR-0006 (RDS not validated) and the legal/compliance review are hard gates.

---

## 23. Clear final decision

**Recommendation B:**
**Do a short Week-7 release-candidate/closure pass. Week 8 is not required unless deploying externally or to production.**

- The **feature build is complete** — stop building product features now.
- For an **internal demo**, this reduces to **Recommendation A** (closure only): the CI repair is **already green** on `main` (#29685009701), so all that remains is prepping a seed-free demo script and recording one fresh-tree validation run. **Demo-ready now.**
- For an **external pilot / first dev deployment** (the project's stated direction), run the §20 Week-7 pass plus the §21-8a dev-deployment subset.
- For **production**, escalate to **Recommendation D** — full Week 7 **and** Week 8, with ADR-0006 (RDS) validation and legal/compliance review as non-negotiable gates.

---

## Proposed next prompt to run

**If internal demo is the goal (Recommendation A — closure only):** _(CI-green item already done; `main` #29685009701 is green.)_

> "Close out the prototype for an internal demo. Do NOT build features. (1) Re-run `pnpm typecheck && pnpm lint && pnpm test && pnpm test:e2e && pnpm build` on a fresh Supabase stack (`supabase stop --no-backup && supabase start`, serial E2E) against the CURRENT `main` tree including migration 0817, and record the results as the canonical evidence (the WEEK-6 figures predate 0817). (2) Write a seed-free demo script from `docs/runbooks/demo-runbook.md` that avoids the unbuilt transaction document-upload step and states which integrations are simulated. Report results; change no product code."

**If external pilot / first dev deployment is the goal (Recommendation B — the primary):**

> "Run a short Week-7 release-candidate + closure pass. Add NO product features. Deliverables: (1) [already done — `main` CI is green after the navigation-timeout repair, run #29685009701] re-run and record full validation on the current `main` tree including migration 0817, serially; (3) reconcile the documentation drift in §18 of POST-WEEK-6-RELEASE-READINESS-AUDIT.md — CLAUDE.md Week-5 gap line, AGENTS.md 'Week 1' framing, ADR-0003 supersession note, auth-and-rls.md policy matrix, application-overview.md OTP claim, migration-chain label 0100→0815→0817, admin i18n count 446 vs 454, and add the reset-hang fresh-stack workaround to docs/runbooks/database-reset.md; (4) decide the transaction document-upload gap (build per ADR-0023 or explicitly scope out); (5) add a mobile-viewport E2E and a two-subscriber realtime delivery test; (6) write the UAT + demo scripts and a release-candidate report. Then scope the Week-8a dev-deployment subset. Report; do not start production hardening."

**If production is the goal (Recommendation D):**

> "Plan and execute full Week 7 (release-candidate/closure per §20) then Week 8 (production readiness per §21-8b) before any external use. Treat ADR-0006 self-hosted-Supabase-on-RDS validation and the Arabic legal/compliance copy review as hard gates. Coordinate the AWS/Terraform/RDS/SES/monitoring provisioning with the platform-engineering workstream (infra/ is contracts-only). Do not deploy production from anything but a green `main`."
