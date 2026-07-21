# Inventory Module

## Purpose

Track on-hand stock as an **append-only movement log** plus a derived balance projection. Supports purchase, sale, return, damage, transfer, and adjustment movements with per-tenant negative-stock policy (**REQ-INV-***, ADR-004).

## Architecture

`InventoryModule`:

- `InventoryService` — warehouses, balances list, movement create, transfer (paired out/in with `correlationId`)  
- `applyMovementInTx` — shared transactional primitive used by Sales, Returns, Purchases  
- `stock-balance.math.ts` — pure next-quantity + policy enforcement (`block` / `warn` / `allow`)  

Balances are never PATCH-writable; correct stock by posting movements.

## Database

- `warehouses` — per branch; one default  
- `stock_movements` — signed `quantity_delta`, `type`, optional `reference_type` / `reference_id`, `device_id`  
- `stock_balances` — unique `(tenant, warehouse, product)` projection  

Postgres is source of truth in cloud; POS mirrors via sync + local SQLite schema in `packages/database`.

## API

| Method | Path | Permission |
| --- | --- | --- |
| `GET/POST` | `/v1/inventory/warehouses` | `inventory.read` / adjust |
| `GET` | `/v1/inventory/balances` | `inventory.read` |
| `GET` | `/v1/inventory/movements` | `inventory.read` |
| `POST` | `/v1/inventory/movements` | `inventory.adjust` |
| `POST` | `/v1/inventory/transfers` | `inventory.transfer` |

Sale/return/purchase paths create movements internally (not via adjust UI).

## UI

- **Admin** — warehouse list, stock on hand, adjust/transfer forms, movement history  
- **POS** — read-through availability; no arbitrary balance edits  

## Business Rules

- Movement types include at least: `purchase`, `sale`, `return`, `damage`, `transfer`, `adjustment`  
- `block` policy → `NEGATIVE_STOCK_BLOCKED` when next qty &lt; 0  
- Idempotent movement UUID: duplicate id returns existing row  
- Transfers: negative out + positive in, same `correlationId`  
- Products with `trackInventory=false` skip movements on sale/return

## Testing

- Unit: `test/stock-balance.math.test.ts`  
- Integration: adjust + transfer + sale depletion + return restock  
- Never assert balances without corresponding movements

## Security

- Tenant-scoped warehouse/product lookups  
- Adjust/transfer permission-gated and audited  
- No client-supplied absolute quantity overwrite endpoint

## Future Improvements

- Batch/lot layers via pharmacy plugin (`pharmacy.batch_movement`)  
- Cost layers / WAC reporting  
- Cycle count workflows with variance movements  
- Reorder points as deterministic notifications (not AI)  
