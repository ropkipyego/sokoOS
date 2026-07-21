# SokoOS — Database Design

| Field | Value |
| --- | --- |
| **Document ID** | SOKO-DB-001 |
| **Version** | 1.0.0 |
| **Status** | Baseline for API Phase |
| **Depends on** | SOKO-ARCH-001…004, ADR-003, ADR-004 |

---

## 1. Purpose

Define the physical data model for:

- **PostgreSQL** — cloud system of record (multi-tenant)
- **SQLite** — device operational store + sync outbox

Prisma owns the cloud schema (`packages/database`). SQLite schema is a deliberate subset optimized for POS + sync (`packages/database/sqlite`).

---

## 2. Design Principles

1. Every tenant row includes `tenant_id`.
2. Branch-scoped rows include `branch_id`.
3. Syncable entities include `uuid`, `version`, `created_at`, `updated_at`, `created_by`, `updated_by`, and originating `device_id` when created on device.
4. Inventory truth = append-only `stock_movements`; `stock_balances` is a projection.
5. Soft archive via `archived_at` / `status`; no hard delete of sold products or completed sales.
6. Money stored as **integer minor units** (cents/cents-equivalent) + ISO currency on tenant.
7. Primary keys: internal `id` (UUID text) equals business `uuid` for syncable entities (single identifier).

---

## 3. Identifier Strategy

| Kind | Type | Notes |
| --- | --- | --- |
| Entity id | UUIDv7 string | Client or server generated |
| Tenant slug | unique string | Human-friendly, optional |
| SKU | string per tenant unique | |
| Barcode | string, indexed per tenant | Non-unique globally |

---

## 4. Cloud Schema (PostgreSQL) — Domains

### 4.1 Platform & Tenancy

**tenants** — id, name, slug, status (`active|suspended|closed`), currency, timezone, locale, tax_config (jsonb), settings (jsonb), created_at, updated_at

**branches** — id, tenant_id, name, code, address (jsonb), status, settings (jsonb), created_at, updated_at, created_by, updated_by

**devices** — id, tenant_id, branch_id, name, status (`active|disabled`), last_seen_at, sync_cursor (jsonb), created_at, updated_at

### 4.2 Identity & Access

**users** — id, tenant_id (null for platform owners), email, phone, name, password_hash, status, created_at, updated_at

**roles** — id, tenant_id (null = system role template), key, name, is_system, created_at, updated_at

**permissions** — id, key (unique), description, category, plugin_id (nullable)

**role_permissions** — role_id, permission_id

**user_roles** — id, tenant_id, user_id, role_id, branch_id (nullable = all branches), created_at

**refresh_tokens** — id, user_id, device_id (nullable), token_hash, expires_at, revoked_at, created_at

**authz_versions** — tenant_id, version (monotonic), updated_at

### 4.3 Catalog

**categories** — syncable fields + tenant_id, parent_id, name, sort_order, status

**brands** — syncable + tenant_id, name, status

**units** — syncable + tenant_id, name, abbreviation, status

**products** — syncable + tenant_id, sku, barcode, name, description, category_id, brand_id, unit_id, price_minor, cost_minor, tax_rate_bps, track_inventory, status, extensions (jsonb)

**product_branch_prices** (optional P1) — tenant_id, branch_id, product_id, price_minor, version, …

### 4.4 Inventory

**warehouses** — syncable + tenant_id, branch_id, name, is_default, status

**stock_movements** — **append-only**

- id (uuid), tenant_id, branch_id, warehouse_id, product_id
- type: `purchase|sale|return|damage|transfer|adjustment`
- quantity_delta (int; signed; base unit)
- unit_cost_minor (nullable)
- reference_type, reference_id (sale id, purchase id, …)
- correlation_id (for transfer pairs)
- reason (nullable)
- device_id, version (always 1 for append; uniqueness on id)
- created_at, created_by
- **no updated_at mutations of quantity**

**stock_balances** — projection PK (tenant_id, warehouse_id, product_id), quantity, updated_at

### 4.5 Sales

**customers** — syncable + tenant_id, name, phone, email, status, …

**sales** — syncable immutable after commit

- tenant_id, branch_id, device_id, cashier_user_id, customer_id
- status: `completed|voided`
- subtotal_minor, tax_minor, discount_minor, total_minor
- currency, occurred_at, receipt_number
- created_at, created_by, version

**sale_items** — id, sale_id, tenant_id, product_id, name_snapshot, sku_snapshot, quantity, unit_price_minor, discount_minor, tax_minor, line_total_minor, extensions (jsonb)

**sale_payments** — id, sale_id, tenant_id, method (`cash|mobile_money|card|other`), amount_minor, reference, created_at

**returns** — id, tenant_id, branch_id, sale_id, status, total_minor, occurred_at, …  
**return_items** — …

### 4.6 Procurement & Expenses

**suppliers** — syncable master  
**purchases** / **purchase_items** — receive goods → stock_movements  
**expenses** — category, amount_minor, branch_id, occurred_at, …

### 4.7 Sync & Audit

**sync_changes** — cloud ledger of accepted change_id (idempotency), tenant_id, device_id, entity_type, entity_id, version, accepted_at, payload_hash

**sync_conflicts** — id, tenant_id, device_id, entity_type, entity_id, reason, payload (jsonb), created_at, resolved_at

**audit_logs** — append-only; tenant_id, actor_user_id, device_id, action, entity_type, entity_id, metadata (jsonb), created_at

**notifications** — id, tenant_id, user_id, type, body, read_at, created_at

---

## 5. Indexes (Critical)

- `(tenant_id)` on all tenant tables  
- Unique `(tenant_id, sku)` on products  
- `(tenant_id, barcode)` on products  
- `(tenant_id, warehouse_id, product_id)` unique on stock_balances  
- `(tenant_id, product_id, created_at)` on stock_movements  
- Unique `change_id` on sync_changes  
- `(tenant_id, occurred_at)` on sales  
- Unique `(tenant_id, branch_id, receipt_number)` on sales  

---

## 6. SQLite Device Schema (Subset)

Present locally:

- products, categories, brands, units (replica)
- warehouses, stock_movements, stock_balances
- customers (subset)
- sales, sale_items, sale_payments
- settings snapshot, users/authz snapshot (minimal)
- **outbox** — change_id, entity_type, entity_id, op, version, payload_json, status, attempts, next_attempt_at, created_at
- **sync_state** — server_seq, last_push_at, last_pull_at, authz_version

Encrypted at rest (SQLCipher or Electron-safe equivalent).

---

## 7. Migration Strategy

- Cloud: Prisma Migrate in `packages/database`
- SQLite: versioned SQL migrations applied on POS startup (`packages/database/sqlite/migrations`)
- Plugins: namespaced migrations via plugin SDK; no core table rewrites

---

## 8. Consistency Rules

| Write | Transaction includes |
| --- | --- |
| Complete sale (cloud or local) | sale + items + payments + stock_movements + balance updates (+ outbox locally) |
| Receive purchase | purchase status + movements + balances |
| Transfer | two movements + correlation_id + balances |

Rebuild balances:

```sql
SELECT warehouse_id, product_id, SUM(quantity_delta)
FROM stock_movements
WHERE tenant_id = $1
GROUP BY 1, 2;
```

---

## 9. Soft References & Snapshots

Sale lines store `name_snapshot` / `sku_snapshot` so catalog renames do not rewrite history.

---

## 10. Phase Gate

API phase may begin when this design + Prisma schema in `packages/database` are aligned.

---

## Document Control

| Version | Date | Notes |
| --- | --- | --- |
| 1.0.0 | 2026-07-21 | Initial database design |
