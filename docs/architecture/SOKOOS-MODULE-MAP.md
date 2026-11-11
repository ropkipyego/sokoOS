# SokoOS Module Map

**Document:** SOKO-ARCH-MODMAP-001  
**Maps:** code locations ↔ product capabilities

## Foundation (live)

| Module | API | Admin UI | POS | Schema |
| --- | --- | --- | --- | --- |
| Auth / JWT / RBAC | `services/api/src/auth`, `roles`, `common/guards` | Login + `stores/auth` | `stores/session` | User, Role, Permission, UserRole |
| Tenants | `tenants` | Settings | — | Tenant |
| Branches / Devices | `branches`, inventory warehouses | Branches, Devices | branch resolve | Branch, Device, Warehouse |
| Catalog | `catalog`, `media` | Products, Categories, Brands | grid + images | Product, Category, Brand, Unit |
| Inventory | `inventory` | Inventory, Movements, Transfers | balances | StockMovement, StockBalance |
| Sales / Payments | `sales` | Sales | cart + pay | Sale, SaleItem, SalePayment |
| Returns | `returns` | Credit notes | — | Return |
| Purchases / LPO | `purchases` | PurchasesPage | — | Purchase, PurchaseItem |
| Customers / Suppliers | `customers`, `suppliers` | pages | customer search | Customer, Supplier |
| Expenses | `expenses` | Expenses | — | Expense |
| Deliveries | `deliveries` | Deliveries | — | Delivery |
| Reports | `reports` | Dashboard, Reports | — | aggregations |
| Sync | `sync` | — | SyncWorker | SyncChange, SyncConflict |
| Dining (thin) | `dining` | — | tables + orderType | DiningTable, Sale.orderType |

## Phase 1 targets

| Module | Location plan |
| --- | --- |
| Business profile + modules | `packages/types/src/business-profile.ts`, tenant settings/columns, Settings + Config Centre |
| Platform console | `apps/admin-dashboard` `/platform/*` + `PlatformShell` |
| Onboarding | `services/api/src/platform/onboarding.*`, `OnboardingDraft` |
| Config Centre | `/config/*` tenant routes |

## Later phases (planned)

| Phase | Module | Primary new code |
| --- | --- | --- |
| 2 | Departments | `departments/*`, Department* models |
| 3 | Item types + dept catalog | Product.itemType, DepartmentProduct |
| 4 | Sale.departmentId | sales + reports |
| 5 | Restaurant pack | recipes, modifiers, KDS |
| 6–7 | Hotel + folios | rooms, stays, FolioCharge |
| 8+ | Pharmacy / wholesale / services | namespaced packs |
