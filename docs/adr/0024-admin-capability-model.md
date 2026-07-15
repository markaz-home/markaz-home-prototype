# ADR-0024 — Server-authoritative admin capability model (Week 6)

## Status

Accepted (Week 6).

## Context

The admin portal needs fine-grained control over what an operator can do, without
introducing a second account type or a role-selection screen. Client-side guards must
never be the security boundary.

## Decision

Sixteen named **capabilities** in `packages/domain/src/admin.ts`. The prototype single
ADMIN holds all sixteen (`PROTOTYPE_ADMIN_CAPABILITIES`), but authorisation is enforced
per-procedure by `adminCapabilityProcedure(cap)` (`packages/api/src/trpc.ts`), which checks
`hasCapability(...)` and throws `FORBIDDEN 'CAPABILITY_REQUIRED'` before any work. The UI
hides controls the server would refuse, but the server check is the real gate — the UI is
only a reflection. Capabilities are additive and could later be attached to distinct admin
grants without touching call sites.

## Consequences

One check, one source of truth, no `ADMIN`-subtype proliferation. Adding a capability is a
domain-list edit + a procedure annotation. See ADR-0026 (actions), ADR-0027 (documents).
