# API

Cloud REST / OpenAPI contracts for SokoOS clients and sync.

## Documents

| ID | Document | Status |
| --- | --- | --- |
| SOKO-API-001 | [API Design](./01-api-design.md) | Baseline for Implementation |

## Scope

- `/v1` versioning, auth, tenancy, RBAC
- Catalog, inventory, sales, procurement, expenses
- Sync push/pull/status
- Reports, notifications
- Error envelope, pagination, idempotency, JWT & rate limits

## Downstream

Paired with [UI Design System](../design-system/README.md). OpenAPI artifact lands under `services/api/openapi/`.
