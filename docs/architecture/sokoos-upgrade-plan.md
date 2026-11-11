# SokoOS Upgrade Plan

**Document:** SOKO-ARCH-UPG-001  
**Depends on:** [Upgrade audit](../audit/sokoos-upgrade-audit.md)  
**Rule:** Improve in place. Additive schema. No DB reset. No duplicate LPO table.

---

## Guiding decisions

1. **Purchases are LPOs.** Same `Purchase` / `PurchaseItem` row for create, issue, and every receive batch.
2. **Images** on disk behind `/v1/media/...`; URLs on `Product`.
3. **Receipts** = CSS print profiles (58/80mm + A4) + PDF download; ESC/POS prepared, not claimed without hardware.
4. **eTIMS / M-Pesa** = config + honest pending/unverified states until certified.
5. **Offline cash** keeps working; online sales must **not** also decrement local stock when already posted to API.
6. Frontends use Nest API; remove dual-path bugs before adding chrome.

---

## Stage map (progress)

| Stage | Theme | Status |
| --- | --- | --- |
| 1 | Audit + docs | **Done** |
| 2 | Images + POS cards + responsive | **Done** (thumb = validated file copy; sharp resize deferred) |
| 3 | Checkout, customer, cashier, cash change | **Done** (online sale no double stock; split tender UI) |
| 4 | Receipt engine | **Done** for browser profiles 58/80/A4; ESC/POS hardware unverified |
| 5 | Deliveries | **Done** API + admin (POS create flag optional polish) |
| 6 | Admin BI | **Done** KPIs + payment bars + intelligence page |
| 7 | Product mgmt + bulk + featured | **Done** |
| 8 | Inventory + barcode + **LPO receive** | **Done** create/issue/partial receive/cancel + tests |
| 9 | Branches / warehouses / transfers | **Done** transfer form |
| 10 | Users, roles, announcements | **Done** for MVP list/create/roles view |
| 11 | Expenses + finance | **Done** MVP (notes/ref; file upload next) |
| 12 | Settings, M-Pesa, eTIMS | Config shells only — **not** claimed live |
| 13 | Nav, theme, connectivity | **Done** (RBAC fail-closed) |
| 14 | Tests + docs | LPO tests expanded; continue E2E on hardware |

A stage is **done** only when API + DB + permissions + UI + tests agree.

---

## Immediate implementation sequence (this run)

1. Fix POS: online API sale → skip local stock path (or mark synced without re-decrement).
2. SyncWorker: JWT + `VITE_API_URL` (3001).
3. LPO: cancel button; open detail via `GET /purchases/:id`; stronger tests.
4. Transfers UI posting to `/stock/transfers`.
5. Dashboard: render payment breakdown + simple SVG trend bars.
6. AppShell: `can()` requires permission when list non-empty; if empty after login, treat as deny for write nav (or rehydrate `/auth/me`).
7. Receipt CSS profiles (thermal 80mm + A4) in POS print overlay.
8. Split payment allocations on POS (optional second method).
9. Categories/brands create; roles list permissions (read); expense note on attachment.
10. Document M-Pesa/eTIMS as unverified.

---

## LPO receive algorithm (canonical)

```
create(items[qty])           → draft, lpoNumber assigned
issue()                      → issued
receive(warehouse, lines[])  → for each line on SAME purchase id:
  remaining = quantity - quantityReceived
  assert 0 < qty <= remaining
  quantityReceived += qty
  StockMovement(type=purchase, referenceId=purchase.id, correlationId=receiveId)
  status = all received ? received : partial
cancel()                     → only if sum(quantityReceived)==0
```

Never insert a second purchase for GRN.

---

## Database change rules

- Additive columns with defaults only.
- No `PurchaseOrder` table.
- No `--force-reset`.
- Historical fully received rows: `quantityReceived` already or treated as complete via status.

---

## Risks

| Risk | Mitigation |
| --- | --- |
| Double stock on online+offline sale | Skip offline decrement when API succeeded |
| Re-receive same batch | Idempotent `receiveId` / `correlationId` |
| Claiming eTIMS/M-Pesa/X-80 | Explicit unverified in UI/docs |
| Port clash AfyaSasa | API 3001 / admin 5175 / POS 5174 |
