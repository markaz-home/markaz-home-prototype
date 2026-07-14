# MARKAZ Home — Timesheet (Weeks 1–4)

**Rate:** AED 92.00/hr · **Total:** 86 hrs = **AED 7,912.00** · avg 21.5 hrs/week

---

## Week 1 — Application Foundation (auth, DB, RLS)

| Date | Day | Work description | Hours |
|---|---|---|---|
| 06/01/2026 | Mon | Monorepo scaffolding and package layout; tooling, strict TypeScript, lint, CI pipeline | 6 |
| 06/03/2026 | Wed | Local Supabase stack + canonical SQL migrations + Drizzle typed mirror; RLS auth-context (`withUserContext`) | 6 |
| 06/05/2026 | Fri | Email+password auth, sessions, onboarding gate, profile setup, simulated UAE PASS; web + admin app shells | 6 |
| 06/07/2026 | Sun | Realtime + storage proofs; RLS/storage integration tests; ADRs, architecture docs, runbooks | 4 |
| | | **Total hours** | **22** |
| | | **Total due (AED)** | **2,024.00** |

## Week 2 — Property Listing Journey (`DRAFT → READY_TO_PUBLISH`)

| Date | Day | Work description | Hours |
|---|---|---|---|
| 06/08/2026 | Mon | Listing state machine, derived section statuses, server-authoritative readiness; domain validation | 6 |
| 06/10/2026 | Wed | Migration 07 (properties/listings/investment_cases), private draft-photo bucket; tRPC listing router | 6 |
| 06/12/2026 | Fri | Wizard UI (9 steps), debounced autosave + optimistic concurrency, uploads via signed URLs, simulations | 5 |
| 06/14/2026 | Sun | Investment-case calculations, i18n (en/ar), e2e + axe accessibility + integration tests | 4 |
| | | **Total hours** | **21** |
| | | **Total due (AED)** | **1,932.00** |

## Week 3 — Publication + Customer Marketplace

| Date | Day | Work description | Hours |
|---|---|---|---|
| 06/15/2026 | Mon | Publication eligibility/checklist; idempotent compensated workflow; atomic `LIVE` transition | 6 |
| 06/17/2026 | Wed | Migrations 0800–0803; service-role public-photo pipeline; security-barrier marketplace view; RLS save guards | 6 |
| 06/19/2026 | Fri | Marketplace UI (browse/search/filter/detail/gallery), saved properties, anon save intent; projection mappers | 6 |
| 06/21/2026 | Sun | Pause/resume; material vs non-material live edits; e2e + accessibility + integration tests | 4 |
| | | **Total hours** | **22** |
| | | **Total due (AED)** | **2,024.00** |

## Week 4 — Buyer Offers & Seller Offer Management

| Date | Day | Work description | Hours |
|---|---|---|---|
| 06/22/2026 | Mon | Offer thread/proposal/event model; migration 0804; `SECURITY DEFINER` offer functions | 6 |
| 06/24/2026 | Wed | Buyer journey (make/compare/respond) + seller inbox & listing management; single-accept enforcement | 6 |
| 06/26/2026 | Fri | Shared perspective-aware thread + negotiation timeline; derived `UNDER_OFFER`; realtime refresh + notifications | 5 |
| 06/28/2026 | Sun | Offer projection mappers, lazy expiry processing; component + e2e tests; Week 5 handoff | 4 |
| | | **Total hours** | **21** |
| | | **Total due (AED)** | **1,932.00** |

---

## Summary

| Week | Milestone | Hours | AED |
|---|---|---|---|
| Week 1 | Application Foundation | 22 | 2,024.00 |
| Week 2 | Property Listing Journey | 21 | 1,932.00 |
| Week 3 | Publication + Marketplace | 22 | 2,024.00 |
| Week 4 | Offers & Negotiation | 21 | 1,932.00 |
| **Total** | | **86** | **7,912.00** |
