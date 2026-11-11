# SokoOS Multi-Industry Profiles & Departments — Architecture Audit

**Document:** SOKO-AUDIT-002  
**Date:** 2026-10-30  
**Depends on:** [SOKO-AUDIT-001](./sokoos-upgrade-audit.md), [SOKO-ARCH-UPG-001](../architecture/sokoos-upgrade-plan.md)  
**Constraint:** Additive schema only. No DB reset. No duplicate sale/stock paths. One shared commerce platform.

**Status of this document:** Audit + target architecture + staged plan. **No full module implementation in this pass.**

---

## 1. Executive verdict

SokoOS is already a **tenant → branch → warehouse → product → sale** commerce core with JWT RBAC, append-only stock movements, and a thin restaurant veneer (`DiningTable`, `Sale.orderType` / `tableCode`, tenant `businessMode` in JSON).

It is **not** yet a multi-department / multi-industry platform:

| Capability | Status |
| --- | --- |
| Multi-tenant retail commerce | **Exists** — reuse |
| Branches + warehouses + transfers | **Exists** — reuse |
| Business profile / industry types | **Partial** — ad-hoc `Tenant.settings` JSON |
| Departments | **Missing** |
| Item type taxonomy (stock / prepared / service / room / BOM) | **Missing** (only `trackInventory` boolean) |
| Department-scoped catalog & pricing | **Missing** |
| Restaurant (modifiers, recipes, KDS, waiters, split/transfer table) | **Partial** (tables + order type only) |
| Hotel (rooms, stays, folios, housekeeping) | **Missing** |
| Folio posting without second sale | **Missing** |
| Config inheritance Platform → … → Terminal | **Missing** (flat tenant/branch JSON) |
| Department permissions | **Missing** (`UserRole` is branch-scoped only) |

**Recommendation:** Extend in place with a **Department** aggregate and industry **feature packs** gated by tenant profile flags — not separate apps or parallel sales engines.

---

## 2. Audit findings (existing model)

### 2.1 Tenancy & settings

| Asset | Location | Reuse notes |
| --- | --- | --- |
| `Tenant` | `schema.prisma` L14–58 | `settings Json`, `taxConfig Json` — already holds company, receipts, M-Pesa/eTIMS shells, `businessMode`, `restaurantEnabled` (Honeywell seed) |
| `Branch` | L61–90 | `settings Json` — unused for inheritance today |
| `Device` | L113–136 | Terminal identity; no settings / department link |
| Tenants API | `services/api/src/tenants/*` | PATCH merges settings object; no typed profile schema |
| Admin Settings | `apps/admin-dashboard/src/pages/SettingsPage.tsx` | Flat editors for company/receipts/pos/mpesa/etims/lpo |

**Gap:** No first-class `businessTypes[]`, onboarding wizard, or typed config layers. POS reads `businessMode` / `restaurantEnabled` from `/auth/me` (`apps/desktop-pos/src/stores/session.ts`).

### 2.2 Organization & authZ

| Asset | Finding |
| --- | --- |
| `UserRole` | Unique on `(tenantId, userId, roleId, branchId)` — **branch optional**, **no departmentId** |
| Permissions | `packages/types/src/permissions.ts` — domain.action keys; plugin namespace foreshadowed (`pharmacy.*`) but unused |
| Audit | `AuditLog` exists; interceptor present |
| Devices | Bound to branch only |

**Gap:** Department membership, department-scoped permissions, terminal→department binding.

### 2.3 Catalog

| Asset | Finding |
| --- | --- |
| `Product` | SKU-unique per tenant; `trackInventory`, `priceMinor`, `extensions Json`, images, featured |
| `Category` | Tree via `parentId` — usable as menu groups **without** being department-aware |
| No | `itemType`, BOM/recipe, modifiers, department offers, dept price overrides |

**Reuse:** Keep one master `Product`. Add `itemType` + join tables for department availability/pricing and recipe lines. Do **not** clone products per department.

### 2.4 Inventory

| Asset | Finding |
| --- | --- |
| `Warehouse` | Per branch; default flag |
| `StockBalance` | `(tenant, warehouse, product)` |
| `StockMovement` | Append-only; `referenceType` / `referenceId` / `correlationId` — good for idempotent recipe explosions & folio links |

**Gap:** No department ownership of locations; no stock “reservation” for hotel/minibar beyond balances; shared consumption must stay movement-referenced to the originating sale/folio line.

### 2.5 Sales & dining (restaurant veneer)

| Asset | Finding |
| --- | --- |
| `Sale` | `orderType` (`retail\|dine_in\|takeaway\|delivery`), `tableCode`, payments, snapshots, fiscalStatus |
| `DiningTable` | Branch floor plan; status free/occupied/reserved/dirty |
| POS | Hybrid mode UI: order type chips, table grid, wedge scanner (`PosApp.tsx`) |
| Dining API | `services/api/src/dining/*` — list/upsert/status |

**Missing for full restaurant module:** modifiers/add-ons, recipes→ingredient movements, kitchen tickets/KDS, waiter assignment, split bill, table transfer, open checks vs completed sales.

### 2.6 Hotel / folio

**None** in schema or API. `Customer` can hold guests later via `extensions`, but rooms, stays, folios, housekeeping are greenfield additive models.

### 2.7 Admin UI / config centre

`AppShell` groups: Overview, Sales, Catalogue, Inventory, Business, Organization, Reports, System. No Departments, Rooms, Kitchen, Folios, or Business Profile onboarding. Settings is a single page, not a configuration centre with inheritance.

### 2.8 Governing rules already in force (do not violate)

From SOKO-ARCH-UPG-001:

1. Additive columns/tables only; no `--force-reset`.
2. Purchases remain LPOs on the same row.
3. Online sale must not double-decrement stock (POS + sync).
4. No fake M-Pesa/eTIMS claims.
5. Folio posting (new) must **reference** an existing sale — never invent a second sale for the same commerce event.

---

## 3. Dangerous duplication risks

| Risk | Mitigation |
| --- | --- |
| Recipe sale deducts finished good **and** ingredients | `itemType=prepared` → trackInventory false on menu item; explode BOM to ingredient movements with `referenceType=sale`, `correlationId=saleItemId` |
| Folio “transfer” creates second sale | `FolioCharge` rows point at `saleId` / `saleItemId`; settlement at checkout is payment allocation, not a new sale |
| Sync replay double stock | Keep idempotent `correlationId` / sale `id` upsert (already on sales create) |
| Department report double-count | Revenue owned by originating sale; folio charges excluded from “sales total” or tagged `posted_to_folio` payment method |
| Shared product price drift | Master `Product.priceMinor` + optional `DepartmentProduct.priceMinor` override; never fork SKU |
| Internal stock transfer counted as sale | Transfers already separate from sales — keep reporting filters strict |

---

## 4. Target architecture (names only)

### 4.1 Profile & departments

```
Tenant.settings.businessTypes: string[]   // or TenantBusinessType rows
Tenant.settings.featureFlags: { restaurant, hotel, pharmacy, ... }

Department
  tenantId, branchId?, code, name, description
  type: restaurant|bar|retail|accommodation|spa|laundry|gift_shop|wholesale|pharmacy|hardware|services|other
  status, settings Json, sortOrder

DepartmentMember (userId, departmentId, role hint)
DepartmentDevice (deviceId, departmentId)
DepartmentProduct (departmentId, productId, priceMinor?, available, sortOrder)
```

### 4.2 Item classification (additive on Product)

```
Product.itemType: stock|prepared|service|accommodation|composite|non_stock
  (default stock; map trackInventory from type)

ProductRecipeLine (parentProductId, ingredientProductId, qty)
ProductModifierGroup / ProductModifier (for restaurant)
```

### 4.3 Restaurant extensions

```
DiningTable.departmentId?          // additive FK
KitchenTicket / KitchenTicketItem  // from open or completed sale lines
Sale.departmentId?, waiterUserId?, checkStatus?
```

### 4.4 Hotel extensions

```
RoomType, Room (availability calendar separate from StockBalance)
Reservation, Stay (check-in/out)
GuestProfile (Customer link or 1:1)
Folio, FolioCharge (saleId?, amountMinor, departmentId, authorizedBy, unique(saleId) where posted)
HousekeepingTask
```

### 4.5 Config inheritance

```
ResolvedConfig = deepMerge(
  PlatformDefaults,
  Tenant.settings,
  Branch.settings,
  Department.settings,
  Device.settings   // Device.settings Json additive
)
```

Explicit override map; UI shows “inherited from …” vs “overridden”. Never silent wipe of existing keys on PATCH (merge-by-key).

### 4.6 AuthZ additions

```
departments.read|write
hotel.reservations.* / hotel.folios.*
restaurant.kitchen.* / restaurant.tables.*
UserRole.departmentId?  OR DepartmentMember + permission checks
```

Plugin-style keys remain valid (`pharmacy.manage_batches`).

---

## 5. Proposed implementation stages

Each stage must ship: audit delta, DB impact, API, UI, business rules, security, tests, file list.

| Stage | Scope | Depends on | Testable outcome |
| --- | --- | --- | --- |
| **A0** | This audit + ADR decisions locked | — | Doc accepted |
| **A1** | Business profile types on tenant + onboarding/settings UI (no departments yet) | A0 | Owner selects types; POS/admin feature flags resolve |
| **A2** | `Department` CRUD + branch link + member/device assignment + permissions | A1 | Config Centre: create dept, assign people/terminals |
| **A3** | `Product.itemType` + `DepartmentProduct` pricing/availability | A2 | Shared SKU, dept price override, POS filter by dept |
| **A4** | Sale/report `departmentId`; inventory movement optional dept tag | A3 | Reports filter by department without double count |
| **A5** | Restaurant pack: modifiers, recipes→movements, open checks, KDS MVP, table transfer/split | A3–A4 | Prepared item sale deducts ingredients once |
| **A6** | Hotel pack: rooms, reservations, stay, folio | A4 | Room inventory ≠ product stock |
| **A7** | Folio posting of existing sales (no second sale) + checkout reconcile | A5+A6 | Charge unique on saleId; checkout pays folio |
| **A8** | Config inheritance resolver + Configuration Centre IA | A2 | Overrides visible; merge-safe PATCH |
| **A9** | Industry packs polish (pharmacy batches, wholesale packs, hardware serials) as plugins | A3+ | Namespaced permissions only |

**Do not start A5–A7 until A1–A4 are stable** — they depend on department-scoped sales and item types.

---

## 6. Stage A0 decisions to lock before coding

1. **Department vs Branch:** Branch = physical site. Department = operational unit (may span one branch; hotel spa ≠ rooms). Prefer `Department.branchId` optional but **required for POS floor** operations.
2. **One Product master** across departments — confirmed.
3. **FolioCharge references Sale** — confirmed; payment method `room_charge` / status `posted_to_folio` on original sale payments allowed as alternative **only if** it does not create a second sale row.
4. **Prepared items** never decrement themselves in stock; BOM does.
5. **Rooms** are not `Product` rows of type accommodation for availability calendars (optional sellable “room night” product may exist for POS, but availability engine is `Room`/`Stay`).
6. **Additive migrations only** (`prisma db push` / migrate forward).

---

## 7. Exact files that will be touched first (Stage A1–A2 preview)

| Layer | Candidates |
| --- | --- |
| Schema | `packages/database/prisma/schema.prisma` |
| Types | `packages/types/src/permissions.ts`, new `business-profile.ts` |
| API | `tenants/*`, new `departments/*`, `auth.service` me payload, `app.module` |
| Admin | `AppShell.tsx`, new Configuration Centre routes/pages, Settings profile section |
| POS | `session.ts`, `PosApp.tsx` (dept picker / feature flags) |
| Seed | `seed.ts`, `seed-honeywell.ts` (multi-dept hotel+restaurant example) |
| Docs | this audit; follow-up `docs/architecture/sokoos-departments-adr.md` |

---

## 8. Out of scope for immediate coding (explicit)

- Generating the entire restaurant + hotel module in one PR.
- Destructive migrations or data backfills that rewrite historical sales.
- Claiming pharmacy controlled-substance or hotel PMS certification.
- Separate codebase per industry.

---

## 9. Next action

**Await acceptance of A0 decisions (Section 6).**  
Then implement **Stage A1 only** (business types + feature flags + Configuration Centre shell), with the per-stage deliverable checklist from the product brief.
