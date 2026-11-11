# SokoOS Target Architecture

**Document:** SOKO-ARCH-TARGET-001  
**Aligned with:** live monorepo + [SOKO-AUDIT-002](../audit/sokoos-multi-industry-audit.md)  
**Rule:** Extend in place. Additive schema. One platform, modular industry packs.

---

## 1. What exists today (ground truth)

| Layer | Path | Role |
| --- | --- | --- |
| API | `services/api` | NestJS modular monolith, JWT + RBAC, Prisma/Postgres, Redis/BullMQ |
| Tenant admin | `apps/admin-dashboard` | Business operations UI |
| POS | `apps/desktop-pos` | Offline-capable terminal |
| Schema | `packages/database/prisma/schema.prisma` | Shared DB, `tenantId` on all business tables |
| Contracts | `packages/types`, `sync-protocol`, `shared` | Permissions, DTOs, sync envelope |

**Organizational spine today:** Platform (implicit) → Tenant → Branch → Warehouse / Device / UserRole(branch?).

**Missing spine pieces:** first-class Department, typed business profile, platform console UX, config inheritance, hotel/folio, full restaurant pack, pharmacy batches.

---

## 2. Target organizational model

```
Platform
  └── Tenant (Business)
        ├── settings / businessTypes / modulesEnabled
        ├── Branch (physical site)
        │     ├── Warehouse / Stock locations
        │     ├── Device (terminal)
        │     └── Department (operational unit)  [NEW]
        │           ├── members, catalog offers, settings
        │           └── floor assets (tables, rooms…) by pack
        └── Users + Roles (tenant) / UserRole(branch?, department?)
```

Departments are **not** tenants. Cross-department reporting rolls up to branch/business.

---

## 3. Industry capabilities

Delivered as **feature packs** gated by `modulesEnabled`, not separate apps:

| Pack | Key entities (additive) |
| --- | --- |
| Retail / supermarket | Product, barcode, LPO, transfers, shifts |
| Restaurant | DiningTable, modifiers, recipes, KDS, orderType |
| Hotel | RoomType, Room, Reservation, Stay, FolioCharge→saleId |
| Pharmacy | Batch, expiry, prescription (regulated — verified later) |
| Wholesale | Price lists, credit limits, statements |
| Hardware / electronics | Serials, warranty |
| Services | Appointments, staff assignment |

---

## 4. Transaction integrity (non-negotiable)

1. **Tenant isolation:** every query scopes `tenantId` from JWT — never from client body for authorization.
2. **Stock:** append-only `StockMovement` + `StockBalance`; idempotent via `correlationId` / sale id.
3. **Prepared items:** BOM deducts ingredients only — not the menu SKU.
4. **Folio charges:** reference existing `saleId`; unique posting; never a second sale for the same commerce event.
5. **Reports:** transfers and folio posts are not extra revenue.

---

## 5. Applications

| App | Audience |
| --- | --- |
| Platform console (`/platform/*` in admin app Phase 1; extractable later) | Platform operators |
| Tenant admin | Business owners / managers |
| POS / reception / kitchen workspaces | Frontline staff — module-filtered |

---

## 6. Config inheritance

Effective config = merge(Platform defaults → Tenant → Branch → Department → Device), with explicit override metadata. Settings changes never rewrite historical sale snapshots.
