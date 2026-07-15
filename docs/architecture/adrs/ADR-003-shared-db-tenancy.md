# ADR-003: Shared Database Multi-Tenancy with tenant_id

| Field | Value |
| --- | --- |
| **Status** | Accepted |
| **Date** | 2026-07-15 |

## Context

Thousands of tenants must be isolated. Ops complexity and cost matter for an African SaaS rollout.

## Options

1. Database-per-tenant  
2. Schema-per-tenant  
3. **Shared schema with `tenant_id` on all tenant rows** (+ optional RLS later)

## Decision

Choose **option 3** for v1. Enforce isolation in application repositories and automated tests. Plan PostgreSQL RLS as defense-in-depth hardening.

## Consequences

- Efficient ops and migrations.  
- Higher severity if a query forgets `tenant_id` — mitigated by typed tenant context and CI tests.  
- Very large tenants may later move to dedicated DB via extraction playbook.
