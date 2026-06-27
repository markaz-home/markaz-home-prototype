# Docker

## Local development

Local development does **not** use hand-written app Dockerfiles. The only Docker
used locally is the **Supabase CLI Docker stack** (`pnpm supabase:start`), which
runs Postgres, Auth, Realtime, Storage, Studio, and Inbucket.

## Production images (owned by platform)

Production, multi-stage **Dockerfiles** for the Next.js apps are a
**platform-engineering deliverable**, not built in Week 1. The intended approach:

- **`turbo prune`** to produce a focused, per-app build context.
- **Next.js standalone output** for minimal runtime images.
- **Non-root** runtime user.
- Images published to **ECR** and run on **ECS Fargate** (see
  `../terraform/README.md`).

> These Dockerfiles are **not present** in this repository. This file records the
> intended approach and the ownership boundary only.
