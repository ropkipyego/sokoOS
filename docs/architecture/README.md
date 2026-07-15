# Architecture

System design baselines for SokoOS. These documents gate the **Database** phase.

## Documents

| ID | Document | Status |
| --- | --- | --- |
| SOKO-ARCH-001 | [System Architecture](./01-system-architecture.md) | Baseline v1.0.0 |
| SOKO-ARCH-002 | [Synchronization Engine](./02-sync-engine.md) | Baseline v1.0.0 |
| SOKO-ARCH-003 | [Plugin System](./03-plugin-system.md) | Baseline v1.0.0 |
| SOKO-ARCH-004 | [Security Architecture](./04-security-architecture.md) | Baseline v1.0.0 |

## Architecture Decision Records

| ADR | Title |
| --- | --- |
| [ADR-001](./adrs/ADR-001-modular-monolith.md) | Modular monolith for cloud API |
| [ADR-002](./adrs/ADR-002-rest-openapi.md) | REST/OpenAPI as primary API style |
| [ADR-003](./adrs/ADR-003-shared-db-tenancy.md) | Shared database multi-tenancy with `tenant_id` |
| [ADR-004](./adrs/ADR-004-inventory-movements.md) | Inventory event sourcing via stock movements |
| [ADR-005](./adrs/ADR-005-plugin-sdk.md) | First-party plugin SDK with manifest registration |

## Key Decisions (Summary)

1. **Modular NestJS monolith** now; extract services later if needed.  
2. **Electron POS + SQLite** is the offline edge; cloud PostgreSQL is system of record.  
3. **Transactional outbox + per-entity merge rules** for sync.  
4. **Append-only stock movements** for inventory truth.  
5. **Plugin SDK contracts** before industry implementations.

## Next Phase

**Database design** — physical PostgreSQL + SQLite schemas, indexes, projection tables, and migration strategy.
