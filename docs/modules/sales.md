# Sales Module

## Purpose

Record completed retail sales (items + split tenders), deplete stock via `sale` movements, support permission-gated voids, and accept **returns** that restock with compensating `return` movements (**REQ-SALES-***, **REQ-RET-***).

## Architecture

- `SalesModule` — `SalesService.create` transactional: sale + items + payments + inventory movements  
- `ReturnsModule` — `ReturnsService.create` references `saleId`, validates returnable qty, posts positive `return` movements  
- Shared `InventoryService.applyMovementInTx` keeps stock math consistent  

Receipt numbers unique per `(tenantId, branchId)`. Optional client-supplied sale/return UUIDs enable offline idempotency.

## Database

- `sales`, `sale_items`, `sale_payments`  
- `returns`, `return_items` (FK to `sales`)  
- Related `stock_movements` with `reference_type` `sale` | `return`  

Sale rows are not edited in place for corrections — void or return.

## API

| Method | Path | Permission |
| --- | --- | --- |
| `GET` | `/v1/sales` | `sales.read` |
| `POST` | `/v1/sales` | `sales.create` |
| `GET` | `/v1/sales/:id` | `sales.read` |
| `POST` | `/v1/sales/:id/void` | `sales.void` |
| `GET` | `/v1/returns` | `returns.read` |
| `POST` | `/v1/returns` | `returns.create` |
| `GET` | `/v1/returns/:id` | `returns.read` |

`POST /v1/returns` body: `{ saleId, items[{ productId, quantity }], warehouseId?, reason? }`. Partial lines allowed; qty cannot exceed sold − already returned.

## UI

- **POS** — one-screen checkout; offline outbox → sync; return/void flows gated  
- **Admin** — sale history, receipt detail, return entry for back-office  

## Business Rules

- ≥1 item and ≥1 payment; payments must cover total  
- Unit prices default from product; snapshots name/SKU on lines  
- Tracked products: sale movements negative; return movements positive  
- Voided sales cannot be returned  
- Return warehouse defaults to original sale movement warehouse, else branch default  
- Discount permission `sales.discount` reserved for stricter POS enforcement

## Testing

- Integration: create sale → balances drop → partial return → balances restore → over-return rejected  
- Sync: offline sale UUID replay (**REQ-QA-002**)  
- Security: void/return without permission → 403; audited (**REQ-QA-006**)

## Security

- All routes JWT + permission guarded  
- Tenant isolation on sale/return ids  
- Mutating routes pass through audit interceptor  
- Cashiers should not receive unconstrained adjust permissions as a substitute for returns

## Future Improvements

- Refund tender records linked to return  
- Exchange (return + sale) as single correlation  
- Fiscal/receipt printer adapters via plugins  
- Shift cash-up reconciliation reports  
