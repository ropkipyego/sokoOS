# ADR-004: Inventory Event Sourcing via Stock Movements

| Field | Value |
| --- | --- |
| **Status** | Accepted |
| **Date** | 2026-07-15 |

## Context

SRS forbids overwriting stock as source of truth. Concurrent offline devices will sell the same SKU.

## Options

1. Mutable `quantity_on_hand` column only  
2. **Append-only stock movements + materialized balance projection**  
3. Full event store for all domains

## Decision

Adopt **option 2**. All inventory changes are immutable movements. Balances are projections updated in the same transaction and rebuildable.

## Consequences

- Correct multi-device sync (commutative appends).  
- Slightly more complex reads/rebuild tooling.  
- Auditable inventory history by default.
