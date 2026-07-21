# Database

Physical data model for SokoOS cloud (PostgreSQL) and device (SQLite) stores.

## Documents

| ID | Document | Status |
| --- | --- | --- |
| SOKO-DB-001 | [Database Design](./01-database-design.md) | Baseline for API Phase |

## Scope

- Multi-tenant PostgreSQL schema domains (tenancy, RBAC, catalog, inventory, sales, sync, audit)
- SQLite POS subset + outbox
- Indexes, consistency rules, migration strategy

## Downstream

Consumed by [API Design](../api/README.md). Implementation uses Prisma in `packages/database`.
