# Ongoing notes

Use this file for current release, environment, and operational notes that do not belong to a
completed weekly milestone or represent a confirmed product defect. Add the newest entry first.

## 2026-08-06 — provider-first authentication release and GitHub Actions outage

### Release state

- `develop` was updated to `b79b682bc466934a801af427b2bdb83bbb023688`.
- Develop CI run
  [31116590800](https://github.com/markaz-home/markaz-home-prototype/actions/runs/31116590800)
  passed completely: formatting, lint, typecheck, unit/component tests, builds, migration replay,
  126 integration tests with zero skips, customer web E2E, and Admin E2E.
- `main` was updated with merge commit `c81783d6358639d722e6c9b0ab48533883a7e7cd`.
- Vercel reported successful deployments for both `markaz-home-web` and `markaz-home-admin` from
  that main commit.

### Main CI interruption

Main CI run
[31117827646](https://github.com/markaz-home/markaz-home-prototype/actions/runs/31117827646)
did not produce valid application-failure evidence:

- On attempt 1, the quality job failed during GitHub's `Set up job` phase, before checkout or any
  repository command ran.
- The attempt-1 full-stack job successfully applied migrations `0100` through `0821`, passed all
  126 integration tests with zero skips, and passed the first 44 of 63 customer E2E tests. GitHub
  then terminated the running command with `The operation was canceled`; Admin E2E consequently
  did not run.
- On attempt 2, the full-stack job again failed during GitHub's `Set up job` phase. The quality job
  remained queued without an assigned runner. The attempt was cancelled rather than repeatedly
  consuming unreliable runners.

GitHub's official status incident identified a major GitHub Actions outage affecting hosted
runners: workflows could fail to start, fail partway through, remain queued, or time out. The
observed MARKAZ failures match that incident exactly and should not be logged as confirmed product
defects.

### Follow-up required

1. Wait until GitHub reports Actions as operational or the incident as monitoring/resolved.
2. Rerun the complete `main` workflow against the unchanged commit
   `c81783d6358639d722e6c9b0ab48533883a7e7cd`.
3. Require both `quality (no Docker)` and `full-stack (Supabase + integration + E2E)` to pass.
4. Add the successful replacement run URL and completion time to this entry.
5. If the post-recovery run exposes a reproducible assertion failure, investigate it separately
   and only then add it to `DEFECT-LOG.md`.
