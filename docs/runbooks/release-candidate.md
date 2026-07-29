# Runbook: Release candidate

## Immutable baseline

The Week 7 internal prototype RC is:

```text
tag: rc-week-7
commit: 9e9bfa7c76acd33efb8b449ee5d38018f0b85ba5
branch at freeze: feature/auth-flow-gold
```

Verify rather than re-create it:

```bash
git rev-parse rc-week-7^{commit}
git status --short
git tag --points-at 9e9bfa7c76acd33efb8b449ee5d38018f0b85ba5
```

Never move/reuse an RC tag. Week 8 changes are forward preparation and require their own exact
commit/artifact identity before deployment.

## Evidence gate

From a fresh loopback stack:

```bash
git diff --check
pnpm config:check
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
pnpm security:secrets
```

Also archive migration replay, live RLS/Storage results, axe result, dependency audit, artifact/route
sizes, backup/restore evidence, smoke checklist, environment/config fingerprint without values, and
known warnings. Core skips are failures when the stack is available.

## UAT and sign-off

Do not convert targeted evidence into full UAT. UAT-67–70 remain partial until their uninterrupted
Arabic/mobile scripts are executed. Record Product, Engineering, QA, Design, Security, Release
owner, date, and one explicit go/no-go decision; `Pending` is preferable to invented approval.

The current bounded decision is local/internal demonstration only and **no-go for public
production**. See `RELEASE-CANDIDATE.md`, `WEEK-8.md`, and `PRODUCTION-READINESS.md`.
