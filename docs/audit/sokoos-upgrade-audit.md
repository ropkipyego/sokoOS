# SokoOS Upgrade Audit

**Document:** SOKO-AUDIT-001  
**Updated:** 2026-10-30 (re-audit against live tree)  
**Scope:** Existing monorepo only — additive changes  
**Constraint:** No DB reset, no table drops, no duplicate LPO tables

---

## 1. Current architecture

| Layer | Location | Stack | Maturity |
| --- | --- | --- | --- |
| Cloud API | `services/api` | NestJS 11, Prisma 6, PostgreSQL, Redis/BullMQ, Socket.IO | Production-shaped modular monolith |
| Admin UI | `apps/admin-dashboard` | React 19, Vite 6, TanStack Router, Zustand, Tailwind 4, Lucide | Broad sidebar + most CRUD live |
| POS UI | `apps/desktop-pos` | React 19, Vite, Zustand, MemoryLocalDb + outbox | Login, cart, images, customer, cash change, barcode |
| Shared | `packages/*` | types, utils, shared, sync-protocol, ui, database | Solid contracts |
| Media | `services/api/src/media` | Disk under `UPLOAD_ROOT` / `uploads/` | URLs on Product — no Media table |

**Money:** integer minor units. **Tenancy:** shared DB + `tenantId`. **Inventory:** append-only `StockMovement` + `StockBalance`.

---

## 2. What already works (extend, do not rewrite)

### API
- Auth JWT, RBAC (`PermissionsGuard`), catalog CRUD, product image upload, featured, min stock, CSV import/export
- Inventory balances, movements, transfers, warehouses
- Sales with cashier JWT attribution, snapshots, optional customer, multi-payment DTO, tendered/change, pending M-Pesa status
- Purchases **as LPOs**: create → issue → **partial/full receive on same `purchases.id`**, cancel if nothing received
- Returns, customers, suppliers, expenses, deliveries, announcements/messages
- Reports dashboard aggregations + CSV export
- Sync push + Socket.IO gateway present
- Tenant settings JSON (business, receipts, M-Pesa, eTIMS config shells)

### Admin
- Collapsible sidebar (Overview → System), login against API
- Dashboard KPIs from `/reports/dashboard`
- Products (image, featured, import/export), Inventory adjustments, Sales (+ create delivery), Purchases/LPO UI
- Customers, suppliers, expenses, branches, users, messages, settings
- Thin list pages: categories, brands, roles, returns, devices, notifications
- Stubs: Intelligence, Transfers form, Integrations copy

### POS
- Session login, live catalog when online, product images, featured filter
- Customer search/create, cash tendered/change, barcode wedge, browser print overlay
- Offline cash via MemoryLocalDb + SyncWorker (needs auth + port fix)

### LPO (explicit answer)
**Yes — create an LPO and receive against that same LPO.**  
`Purchase.lpoNumber` assigned at create; `PurchaseItem.quantity` = ordered; `quantityReceived` incremented on receive; stock movements `referenceId = purchase.id`. Admin page at `/purchases`. Gaps: cancel button in UI, print/PDF of LPO, stronger integration tests.

---

## 3. Remaining gaps (honest)

| Area | Status | Priority |
| --- | --- | --- |
| Real image thumbnails (resize) | Same file as full image | Medium |
| POS online sale also writes offline → **double stock risk** | Bug | **Critical** |
| SyncWorker unauthenticated + default port 3000 | Bug | **Critical** |
| Split tender UI on POS | API ready, UI single tender | High |
| Receipt profiles / A4 PDF / ESC-POS | Browser print only | High |
| LPO cancel in admin UI | API exists | High |
| Stock transfers UI | API exists, page stub | High |
| Dashboard charts + payment breakdown render | Data present | High |
| Sidebar RBAC fail-open when `permissions=[]` | Bug | High |
| Live sale WebSocket toasts | Gateway exists, no admin client | Medium |
| Categories/brands create, roles permission editor | List-only | Medium |
| Expense receipt upload via media | Schema field only | Medium |
| M-Pesa Daraja STK + callback | Config UI only | Stage 12 — do not fake paid |
| KRA eTIMS OSCU/VSCU submit | Config + `fiscalStatus` only | Stage 12 — unverified |
| Hardware X-80 ESC/POS proof | Not claimed | Document only |

**eTIMS:** Official KRA OSCU/VSCU paths exist; local receipts are **not** fiscal invoices. No fabricated CU numbers.  
**M-Pesa:** STK initiate ≠ paid until callback/reconcile.

---

## 4. Test posture

- `services/api/test/purchases.lpo.test.ts` — math only
- POS offline sale unit test exists
- Need: LPO receive service tests, sales payment reconciliation, no double-stock regression

---

## 5. Files of record

| Area | Paths |
| --- | --- |
| Schema | `packages/database/prisma/schema.prisma` |
| LPO | `services/api/src/purchases/*`, `apps/admin-dashboard/src/pages/PurchasesPage.tsx` |
| POS | `apps/desktop-pos/src/PosApp.tsx`, `lib/completeSale.ts`, `sync/SyncWorker.ts` |
| Media | `services/api/src/media/*`, catalog `setImage` |
| Admin shell | `apps/admin-dashboard/src/components/AppShell.tsx` |
| Reports | `services/api/src/reports/*`, `DashboardPage.tsx` |
