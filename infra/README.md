# Infrastructure (Boundary / Contracts Only)

> **AWS is NOT provisioned by this repository.** These files are **contracts and
> placeholders** that describe the intended production topology and the boundary
> between application development and the platform-engineering workstream. No
> real Terraform is written here, and **self-hosted Supabase on RDS is NOT
> validated** (see ADR 0006 and `supabase/rds-compatibility-checklist.md`).

## Ownership

The **platform-engineering team** owns: AWS, Terraform, RDS, ECS/ECR, ALB, SES,
ElastiCache, SonarQube, and the **self-hosted Supabase** deployment in
**me-central-1 (UAE)**.

Application development (this repo, Week 1) runs on the **official Supabase local
Docker stack**. A managed-Supabase bridge is available for **demo-only**
environments.

## In scope for Week 1

- Application monorepo, shared packages, real OTP auth, schema + RLS, storage,
  Realtime proof, canonical migrations + seed.
- These infra **boundary contracts** (intended topology, checklists, env contract).

## Out of scope for Week 1

- Provisioning any AWS resources.
- Building production Dockerfiles (a platform deliverable — see `docker/README.md`).
- Validating self-hosted-Supabase-on-RDS (the §6A.1 gate — ADR 0006).

## Intended future topology (me-central-1, UAE)

Data residency: all data stays in **me-central-1**.

| Path | Connects via | Notes |
| --- | --- | --- |
| Customer app (`apps/web`) queries | **RDS Proxy** (where compatible) | Pooled app path |
| Admin app (`apps/admin`) queries | **RDS Proxy** | Pooled app path |
| Supabase **Realtime** | **Direct RDS endpoint** | Logical replication; **never** behind RDS Proxy (ADR 0005) |
| **Migrations** | **Direct** | DDL + replication-slot management |
| **Admin maintenance ops** | **Direct** | Trusted server ops |
| Graphile Worker (`apps/worker`, future) | **Direct or a separately-validated pool** | Durable jobs; pooling must be validated for its workload |

See `environment-contract.md` for the concrete connection-path / port / env-var
requirements, and `terraform/README.md` for the intended resource inventory.
