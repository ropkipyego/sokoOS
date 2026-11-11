# SokoOS Architecture Decisions Log

**Document:** SOKO-IMPL-ADRLOG-001

## D-001 — One platform, feature packs
**Decision:** Industry capabilities are module flags on the tenant, not separate applications.  
**Why:** Matches product vision and existing Nest modular monolith.  
**Status:** Accepted

## D-002 — Platform console lives in admin app under `/platform`
**Decision:** Phase 1 ships platform UI as a gated route group with `PlatformShell`, reusable later as `apps/platform-console` if needed.  
**Why:** Faster delivery without new Vite app/CI; clear UX separation via shell + permissions.  
**Status:** Accepted

## D-003 — Business profile stored as additive tenant fields + settings merge
**Decision:** `businessTypes` (Json array) and `modulesEnabled` (Json object) on Tenant; deep-merge settings on PATCH.  
**Why:** Queryable without parsing opaque blobs; backward compatible with existing `settings`.  
**Status:** Accepted

## D-004 — Onboarding uses draft rows + single activation transaction
**Decision:** `OnboardingDraft` persists wizard progress; activation creates tenant/branch/admin/warehouse atomically.  
**Why:** Resume later; no half-created tenants on failure.  
**Status:** Accepted

## D-005 — Admin invite uses one-time activation token, not logged passwords
**Decision:** Create admin with random unusable hash + `activationToken` stored hashed; return invite URL once to platform operator UI only.  
**Why:** Directive forbids predictable passwords and credential logging.  
**Status:** Accepted

## D-006 — Tenant isolation hard rule
**Decision:** JWT `tenantId` is the only scope for tenant data. Platform routes require `platform.*` permissions and use explicit tenantId path params after permission check. Cross-tenant IDs in bodies are ignored for authZ.  
**Status:** Accepted

## D-007 — Departments are Phase 2 (not skipped)
**Decision:** Phase 1 may collect intended departments in onboarding draft payload but persists Department rows in Phase 2 schema/API.  
**Why:** Roadmap order; avoid half-wired department FKs on sales before item architecture.  
**Status:** Accepted (Phase 1 drafts only; Phase 2 materializes)

## D-008 — Folio / prepared-item rules
**Decision:** `FolioCharge.saleId` is unique; posting links an existing sale and must not create a second sale or double-count revenue. Prepared/composite items deduct recipe ingredients only (idempotent `correlationId`), never the prepared parent SKU as stock.  
**Status:** Accepted (implemented Phases 5–7)

## D-009 — Department attribution is server-authorized
**Decision:** Sales may accept `departmentId` but the API resolves/validates tenant ownership, branch compatibility, and membership before persist. Device and user membership preferred over trusting the client alone.  
**Status:** Accepted (Phase 4)

## D-010 — Rooms are not product inventory
**Decision:** Hotel room availability uses `Room.status` + transactional stay uniqueness, not warehouse stock balances.  
**Status:** Accepted (Phase 6)

## D-011 — Industry packs extend shared commerce
**Decision:** Pharmacy, wholesale, and other packs reuse Product/Sale/Inventory with additive domain tables (batches, price lists, etc.), not separate apps.  
**Status:** Accepted (Phase 8)

## D-012 — Configuration inheritance with explicit sources
**Decision:** Effective config merges platform defaults ← tenant ← branch ← department ← device. Overrides stored in `ConfigSetting` with `scopeKey`. Changes never rewrite historical transactions.  
**Status:** Accepted (Phase 9)

## D-013 — Integrations never fake confirmation
**Decision:** M-Pesa STK creates pending payments only; callbacks require verified trust. eTIMS queues without inventing fiscal numbers. Printer jobs queue until terminal ack.

## D-014 — SaaS hostname is resolution, not authorization
**Decision:** `TenantDomain` maps verified hostnames to tenants. `GET /v1/public/resolve-host` and login `host` binding select a candidate tenant for UX/session boundaries. JWT `tenantId`, membership, and permissions remain authoritative. Custom domains stay `pending` until token verification; TLS status stays `unknown` until real provisioning evidence exists.
**Status:** Accepted (SaaS-01)

## D-015 — Dual onboarding + paid subscriptions (locked product)
**Decision:** Self-registration with platform approval and platform-created clients; commercial model is paid plans/subscriptions with central `EntitlementService` (SaaS-05). Platform console remains `/platform` in admin app until a dedicated host is wired.
**Status:** Accepted

## D-016 — Email outbox honesty
**Decision:** Provider acceptance → `sent`. `delivered` only with webhook/evidence. Dev adapter logs subject/recipient only (no tokens).
**Status:** Accepted (SaaS-03)

## D-017 — Entitlements central gate
**Decision:** `EntitlementsService.snapshot/assertWrite` is the server-side plan gate. Legacy tenants without subscriptions keep write until commercially migrated. Suspension does not delete data.
**Status:** Accepted (SaaS-05)

## D-018 — Public website is a separate Vite app
**Decision:** `apps/public-web` on `:5176` for marketing/registration; pricing loads `GET /public/plans`.
**Status:** Accepted (SaaS-08)  
**Status:** Accepted (Phase 10)
