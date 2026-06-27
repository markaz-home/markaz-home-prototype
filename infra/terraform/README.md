# Terraform (Placeholder — Owned by Platform)

> **No Terraform is written in this repository.** Terraform for MARKAZ Home is
> **owned by the platform-engineering team**. This directory documents the
> *intended* resource inventory only. `main.tf.placeholder` is a text placeholder,
> **not** a `.tf` file, and is intentionally not applied.

## Intended resources (to be authored by platform, NOT here)

- **VPC** — subnets, route tables, NAT, security groups (me-central-1).
- **RDS for PostgreSQL** — Multi-AZ, the production database.
- **RDS Proxy** — pooled app/API query path **only** (never in front of Realtime
  or migrations — ADR 0005).
- **ECS Fargate** — service compute for `web`, `admin`, and the future `worker`.
- **ALB** — ingress / routing to the apps.
- **S3** — object storage / artifacts as needed.
- **SES** — transactional email (OTP delivery in deployed demos).
- **ElastiCache** — caching layer (future).
- **ECR** — container image registry.
- **Secrets Manager** — DB credentials, service-role key, app secrets.
- **KMS** — encryption keys (data residency in me-central-1).
- **Route 53** — DNS for the customer and admin hosts.
- **ACM** — TLS certificates.
- **CloudWatch** — logs / metrics / alarms.

## Status

`NOT PROVISIONED.` These are intentions, not state. See ADR 0006 for the
self-hosted-Supabase-on-RDS validation gate that must pass before this topology
is production-ready.
