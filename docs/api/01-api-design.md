# SokoOS — API Design (OpenAPI-Oriented)

| Field | Value |
| --- | --- |
| **Document ID** | SOKO-API-001 |
| **Version** | 1.0.0 |
| **Status** | Baseline for Implementation |
| **Depends on** | SOKO-SRS-001, SOKO-ARCH-001…004, SOKO-DB-001, ADR-002 |
| **OpenAPI artifact** | `services/api/openapi/openapi.yaml` (generated + authored; source of truth after codegen lands) |

---

## 1. Purpose

Define the cloud REST API contract for SokoOS clients (`desktop-pos`, `admin-dashboard`, future portals). This document is the baseline for NestJS route modules, Zod/OpenAPI schemas in `packages/types`, and sync protocol alignment in `packages/sync-protocol`.

Normative constraints: **REQ-API-001…005**, **REQ-NFR-SEC-***, **REQ-SYNC-***, and ADR-002 (REST + OpenAPI).

---

## 2. Conventions

### 2.1 Base URL and versioning

| Item | Rule |
| --- | --- |
| Version prefix | All public routes under `/v1` (**REQ-API-002**) |
| Breaking changes | New major path (`/v2`) or negotiated via `Accept` only after ADR |
| Additive changes | Allowed in `/v1` (new optional fields, new endpoints) |
| Deprecation | `Deprecation` + `Sunset` response headers; min 90 days notice |

```http
https://api.sokoos.example/v1/...
```

Plugin routes mount under `/v1/plugins/{pluginId}/...` (see architecture plugin doc).

### 2.2 Resource style

- Plural nouns: `/v1/products`, `/v1/sales`
- UUID path params: `/v1/products/{id}`
- Nested only when subordinate lifecycle is clear: `/v1/sales/{id}/payments`
- Prefer query filters over deep nesting for lists

### 2.3 Content types

| Direction | Type |
| --- | --- |
| Request / response | `application/json; charset=utf-8` |
| Multipart (P1 attachments) | `multipart/form-data` |
| OpenAPI | OAS 3.1 |

### 2.4 Money and time

- Money: integer **minor units** + tenant currency (ISO 4217) from tenant settings
- Tax rates: basis points (`tax_rate_bps`) where applicable
- Timestamps: ISO-8601 UTC in API responses; clients may send local `occurredAt` on sync/device writes
- IDs: UUIDv7 strings

### 2.5 Tenant and branch context

- `tenant_id` is taken from the JWT (immutable for the session). Clients **must not** supply a conflicting tenant.
- Branch scope via `X-Branch-Id` header and/or query `branchId` where the resource is branch-scoped.
- Platform Owner APIs omit tenant claim and use explicit `{tenantId}` path segments under `/v1/platform/...`.

### 2.6 Standard headers

| Header | Required | Purpose |
| --- | --- | --- |
| `Authorization` | Yes (except auth login/refresh) | `Bearer <access_jwt>` |
| `X-Branch-Id` | When branch-scoped | Active branch context |
| `X-Device-Id` | POS / sync | Registered device UUID |
| `Idempotency-Key` | Mutating non-sync writes (recommended) | Client-generated UUID; 24h replay window |
| `X-Request-Id` | Optional | Correlation; echoed in response |
| `Accept-Language` | Optional | Locale hint (English first) |

Sync push/pull use envelope/change IDs for idempotency (**REQ-API-003**); `Idempotency-Key` is still accepted as transport-level duplicate protection.

---

## 3. Error Envelope

All non-2xx JSON errors use a single envelope:

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Human-readable summary",
    "requestId": "01932f3a-…",
    "details": [
      { "path": "items[0].quantity", "message": "Must be >= 1", "code": "too_small" }
    ],
    "docsUrl": "https://docs.sokoos.example/errors/VALIDATION_FAILED"
  }
}
```

| Field | Rules |
| --- | --- |
| `code` | Stable machine code (`SCREAMING_SNAKE`) |
| `message` | Safe for UI; no stack traces or SQL |
| `details` | Optional field-level issues |
| `requestId` | Matches `X-Request-Id` when provided |

### 3.1 HTTP status mapping

| Status | When |
| --- | --- |
| `400` | Malformed JSON / bad query types |
| `401` | Missing/invalid/expired token |
| `403` | Authenticated but not permitted / wrong tenant |
| `404` | Resource not found **in tenant scope** (no cross-tenant leak) |
| `409` | Version conflict, duplicate business key (SKU), state conflict |
| `422` | Semantic validation failed |
| `429` | Rate limited |
| `500` | Unexpected server failure |
| `503` | Dependency unavailable |

### 3.2 Common error codes

`UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `VALIDATION_FAILED`, `CONFLICT`, `IDEMPOTENCY_REPLAY`, `RATE_LIMITED`, `TENANT_SUSPENDED`, `DEVICE_DISABLED`, `AUTHZ_STALE`, `SYNC_CONFLICT`, `NEGATIVE_STOCK_BLOCKED`

---

## 4. Pagination, Filtering, Sorting

### 4.1 Cursor pagination (default for lists)

```http
GET /v1/products?limit=50&cursor=eyJ… 
```

Response:

```json
{
  "data": [ /* resources */ ],
  "meta": {
    "nextCursor": "eyJ…",
    "hasMore": true,
    "limit": 50
  }
}
```

| Param | Default | Max | Notes |
| --- | --- | --- | --- |
| `limit` | 50 | 200 | Reports may allow higher with permission |
| `cursor` | — | — | Opaque; do not parse client-side |

Offset pagination (`page` / `pageSize`) is allowed only for admin report UIs that need page numbers; prefer cursor for sync-adjacent and large catalogs.

### 4.2 Filtering and sorting

- Filters: snake_case query params (`status=active`, `categoryId=…`, `q=` for search)
- Sort: `sort=updated_at:desc` (allowlist per resource)
- Date ranges: `from` / `to` ISO-8601 on time-series resources (sales, expenses, movements)

---

## 5. Idempotency

| Surface | Key | Behavior |
| --- | --- | --- |
| Sync changes | `changeId` | Unique; replay returns original ACK (**REQ-API-003**, **REQ-NFR-REL-003**) |
| Sync envelopes | `envelopeId` | Unique transport unit |
| Admin/POS REST mutations | `Idempotency-Key` | Same key + same body hash → cached response; body mismatch → `409` |
| Stock movements | Movement `id` | Append-only; duplicate UUID is no-op |

Stored idempotency records: Redis + durable row for money paths (sales, payments, purchases).

---

## 6. Security

### 6.1 Authentication (JWT)

Aligned with **REQ-AUTH-001…007** and SOKO-ARCH-004.

| Token | Lifetime (target) | Storage |
| --- | --- | --- |
| Access JWT | 15 minutes | Memory / secure session |
| Refresh | 30 days rotating | HttpOnly cookie (admin) or encrypted device store (POS) |

Access claims (minimum): `sub`, `tenant_id` (nullable for platform), `session_id`, `authz_version`, `device_id?`, `typ=access`.

Refresh rotation with reuse detection: reuse of a revoked refresh family → revoke session.

### 6.2 Authorization

Permission keys: `domain.action` (e.g. `sales.create`, `inventory.adjust`). Guards run on every mutating endpoint (**REQ-API-005**, **REQ-RBAC-003**).

### 6.3 Rate limits (Redis)

| Bucket | Limit (initial) | Notes |
| --- | --- | --- |
| `POST /v1/auth/login` | 10 / 15 min / IP+email | **REQ-AUTH-005** |
| Refresh | 60 / min / user | |
| Sync push/pull | 120 / min / device | Soft + hard caps; envelope size limits |
| General authenticated | 600 / min / user | Burst token bucket |
| Platform admin | Separate higher tier | Audited |

`429` responses include `Retry-After`.

### 6.4 Transport

TLS 1.2+ only (**REQ-NFR-SEC-001**). No sensitive data in query strings.

---

## 7. Auth Endpoints

**REQ-AUTH-001…007**

| Method | Path | Description | Auth |
| --- | --- | --- | --- |
| `POST` | `/v1/auth/login` | Email/password → access + refresh | Public (rate-limited) |
| `POST` | `/v1/auth/refresh` | Rotate refresh → new token pair | Refresh credential |
| `POST` | `/v1/auth/logout` | Revoke refresh / session | Bearer |
| `POST` | `/v1/auth/devices/register` | Register POS/admin device; bind branch | Bearer + permission |
| `GET` | `/v1/auth/me` | Current user, roles, authz version | Bearer |
| `POST` | `/v1/auth/password-reset/request` | Start reset (P1) | Public |
| `POST` | `/v1/auth/password-reset/confirm` | Complete reset (P1) | Public |
| `POST` | `/v1/auth/invites/accept` | Invite onboarding (P1) | Invite token |

### 7.1 Login request / response (sketch)

```json
// POST /v1/auth/login
{
  "email": "amina@shop.example",
  "password": "••••••••",
  "deviceId": "01932f…",
  "branchId": "01932e…"
}
```

```json
{
  "data": {
    "accessToken": "eyJ…",
    "refreshToken": "eyJ…",
    "expiresIn": 900,
    "user": { "id": "…", "name": "Amina", "email": "…" },
    "tenant": { "id": "…", "currency": "KES", "timezone": "Africa/Nairobi" },
    "authzVersion": 42,
    "permissions": ["sales.create", "sales.receipt.print"]
  }
}
```

Device register body: `name`, `branchId`, optional device attestation metadata. Disabled devices cannot sync (**SOKO-ARCH-004**).

---

## 8. Tenants, Branches, Users, Roles, Permissions

### 8.1 Tenants — **REQ-TEN-001…005**

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/v1/platform/tenants` | Platform Owner list |
| `POST` | `/v1/platform/tenants` | Create tenant |
| `GET` | `/v1/platform/tenants/{tenantId}` | |
| `PATCH` | `/v1/platform/tenants/{tenantId}` | Settings, status |
| `POST` | `/v1/platform/tenants/{tenantId}/suspend` | Lifecycle |
| `GET` | `/v1/tenant` | Current tenant profile (business users) |
| `PATCH` | `/v1/tenant` | Currency, tax, timezone, locale, negative-stock policy |

### 8.2 Branches — **REQ-BR-001…004**

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/v1/branches` | List for tenant |
| `POST` | `/v1/branches` | Create |
| `GET` | `/v1/branches/{id}` | |
| `PATCH` | `/v1/branches/{id}` | Settings overrides (P1) |
| `POST` | `/v1/branches/{id}/archive` | Soft archive |

### 8.3 Users — **REQ-RBAC-*** / **REQ-AUTH-006**

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/v1/users` | Paginated; filter by branch/role |
| `POST` | `/v1/users` | Create / invite |
| `GET` | `/v1/users/{id}` | |
| `PATCH` | `/v1/users/{id}` | Profile, status |
| `POST` | `/v1/users/{id}/roles` | Assign role(+branch scope) |
| `DELETE` | `/v1/users/{id}/roles/{userRoleId}` | Remove binding |

### 8.4 Roles & permissions — **REQ-RBAC-001…005**

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/v1/roles` | System + tenant roles |
| `POST` | `/v1/roles` | Custom role (least privilege default) |
| `GET` | `/v1/roles/{id}` | |
| `PATCH` | `/v1/roles/{id}` | Name; not platform-owner |
| `PUT` | `/v1/roles/{id}/permissions` | Replace permission set |
| `GET` | `/v1/permissions` | Catalog (`domain.action`) |
| `GET` | `/v1/authz/version` | Current `authzVersion` for cache busting |

Mutations bump `authz_versions` so devices refresh permission snapshots (**REQ-RBAC-004**).

---

## 9. Catalog — Products, Categories, Brands, Units

**REQ-PRD-001…005**

### 9.1 Categories / brands / units

| Method | Path |
| --- | --- |
| `GET/POST` | `/v1/categories` |
| `GET/PATCH` | `/v1/categories/{id}` |
| `GET/POST` | `/v1/brands` |
| `GET/PATCH` | `/v1/brands/{id}` |
| `GET/POST` | `/v1/units` |
| `GET/PATCH` | `/v1/units/{id}` |

Archive via `POST .../archive` or `status=archived` patch. Soft-delete only.

### 9.2 Products

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/v1/products` | `q`, `barcode`, `sku`, `categoryId`, `status` |
| `POST` | `/v1/products` | Create; client may supply `id` (UUIDv7) |
| `GET` | `/v1/products/{id}` | |
| `PATCH` | `/v1/products/{id}` | Optimistic `If-Match` / `version` |
| `POST` | `/v1/products/{id}/archive` | Forbidden if hard-delete requested |
| `GET` | `/v1/products/{id}/branch-prices` | P1 |
| `PUT` | `/v1/products/{id}/branch-prices` | P1 |

Product resource fields (core): `id`, `sku`, `barcode`, `name`, `description`, `categoryId`, `brandId`, `unitId`, `priceMinor`, `costMinor`, `taxRateBps`, `trackInventory`, `status`, `version`, `extensions`.

---

## 10. Inventory — Movements & Balances

**REQ-INV-001…007**, ADR-004

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/v1/warehouses` | Default per branch |
| `POST` | `/v1/warehouses` | |
| `GET` | `/v1/stock/balances` | Projection; filter `warehouseId`, `productId`, low-stock |
| `GET` | `/v1/stock/movements` | Append-only history; filter type, product, dates |
| `POST` | `/v1/stock/movements` | Online adjustment/damage/transfer; **append only** |
| `POST` | `/v1/stock/transfers` | Creates paired movements + `correlationId` |

Movement types: `purchase` | `sale` | `return` | `damage` | `transfer` | `adjustment`.

```json
// POST /v1/stock/movements
{
  "id": "01932f…",
  "warehouseId": "…",
  "productId": "…",
  "type": "adjustment",
  "quantityDelta": -2,
  "reason": "Cycle count correction",
  "referenceType": null,
  "referenceId": null
}
```

Balances are never PATCH-writable. Negative stock policy enforced per tenant (**REQ-INV-007**): `allow` | `warn` | `block` → `NEGATIVE_STOCK_BLOCKED` when blocked.

---

## 11. Sales, Returns, Payments

**REQ-SALES-001…009**, **REQ-RET-001…002**, **REQ-PAY-001**

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/v1/sales` | Branch/date/cashier filters |
| `POST` | `/v1/sales` | Online sale create (POS prefers sync push) |
| `GET` | `/v1/sales/{id}` | Includes items + payments |
| `POST` | `/v1/sales/{id}/void` | Permission `sales.void`; audited |
| `POST` | `/v1/sales/{id}/payments` | Additional tender / settlement |
| `GET` | `/v1/returns` | |
| `POST` | `/v1/returns` | Partial lines; references `saleId` |
| `GET` | `/v1/returns/{id}` | |

Sale create is transactional: sale + items + payments + stock movements + balance projection (+ audit). Receipt number unique per `(tenant, branch)`.

Payment methods: `cash` | `mobile_money` | `card` | `other` (split tender = multiple payment rows).

---

## 12. Customers, Suppliers, Purchases, Expenses

### 12.1 Customers — **REQ-CUS-001…003**

| Method | Path |
| --- | --- |
| `GET/POST` | `/v1/customers` |
| `GET/PATCH` | `/v1/customers/{id}` |
| `GET` | `/v1/customers/{id}/sales` | Online history (P1) |

Walk-in represented as `customerId: null` on sales.

### 12.2 Suppliers & purchases — **REQ-SUP-001…003**

| Method | Path | Notes |
| --- | --- | --- |
| `GET/POST` | `/v1/suppliers` | |
| `GET/PATCH` | `/v1/suppliers/{id}` | |
| `GET/POST` | `/v1/purchases` | Draft → received |
| `GET/PATCH` | `/v1/purchases/{id}` | Before receive |
| `POST` | `/v1/purchases/{id}/receive` | Creates purchase stock movements |
| `POST` | `/v1/purchases/{id}/payments` | **REQ-PAY-001** |

### 12.3 Expenses — **REQ-EXP-001**

| Method | Path |
| --- | --- |
| `GET/POST` | `/v1/expenses` |
| `GET/PATCH` | `/v1/expenses/{id}` |
| `POST` | `/v1/expenses/{id}/archive` |

Fields: `category`, `amountMinor`, `branchId`, `occurredAt`, attachment metadata (P1).

---

## 13. Sync — Push / Pull / Status

**REQ-SYNC-001…006**, SOKO-ARCH-002

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/v1/sync/push` | Upload `SyncEnvelope`; idempotent by `changeId` / `envelopeId` |
| `POST` | `/v1/sync/pull` | Download changes since device `serverSeq` |
| `GET` | `/v1/sync/status` | Current device queue health summary |
| `GET` | `/v1/sync/devices/{id}/status` | Admin: lag, last ACK, failure rates (**REQ-SYNC-005**) |
| `POST` | `/v1/sync/force` | Support-only force sync trigger (P1; **REQ-SYNC-006**) |

### 13.1 Push ACK (sketch)

```json
{
  "data": {
    "acceptedChangeIds": ["…"],
    "conflicts": [
      {
        "changeId": "…",
        "entityType": "product",
        "entityId": "…",
        "reason": "VERSION_CONFLICT"
      }
    ],
    "serverSeq": 184422,
    "authzVersion": 42,
    "skewWarnings": []
  }
}
```

### 13.2 Pull request (sketch)

```json
{
  "serverSeq": 184400,
  "limit": 200,
  "entityTypes": ["product", "category", "stock_movement", "authz_snapshot"]
}
```

WebSocket notifications (P1, **REQ-API-004**): `catalog.updated`, `permissions.updated`, `sync.available` — never used to commit sales.

---

## 14. Reports

**REQ-RPT-001…004**

All under `/v1/reports/...`. Query: `from`, `to`, `branchId` (omit = consolidated online), `groupBy` where relevant. Cross-branch consolidation requires online cloud data (**REQ-RPT-003**).

| Method | Path | Priority |
| --- | --- | --- |
| `GET` | `/v1/reports/sales` | P0 |
| `GET` | `/v1/reports/daily-summary` | P0 |
| `GET` | `/v1/reports/monthly-summary` | P0 |
| `GET` | `/v1/reports/cashier-performance` | P0 |
| `GET` | `/v1/reports/profit` | P0/P1 |
| `GET` | `/v1/reports/expenses` | P0 |
| `GET` | `/v1/reports/inventory` | P0 |
| `GET` | `/v1/reports/inventory-valuation` | P0 |
| `GET` | `/v1/reports/low-stock` | P1 |
| `GET` | `/v1/reports/dead-stock` | P1 |
| `GET` | `/v1/reports/cash-flow` | P1 |
| `GET` | `/v1/reports/tax` | P0 |
| `GET` | `/v1/reports/customers` | P1 |
| `GET` | `/v1/reports/suppliers` | P1 |
| `GET` | `/v1/reports/branches/comparison` | P0 |
| `POST` | `/v1/reports/exports` | Async export job (P1) |

POS offline daily/cashier summaries are **local-only** and do not require these endpoints (**REQ-RPT-002**).

---

## 15. Notifications

**REQ-NOT-001…002**

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/v1/notifications` | In-app inbox; unread filter |
| `POST` | `/v1/notifications/{id}/read` | Mark read |
| `POST` | `/v1/notifications/read-all` | |
| `GET` | `/v1/notification-preferences` | Channel prefs (P1) |
| `PATCH` | `/v1/notification-preferences` | Provider-abstracted |

Event types (core): `low_stock`, `sync_failure`, `security_alert`, `device_disabled`. Delivery: in-app first; email/SMS via swappable providers (P1/P2).

---

## 16. Audit (read APIs)

**REQ-AUD-001…002**

| Method | Path |
| --- | --- |
| `GET` | `/v1/audit-logs` | Filter actor, entity, action, date; Auditor/Owner only |

Append-only; no delete/patch endpoints for normal roles.

---

## 17. Settings

**REQ-SET-001…002**

| Method | Path |
| --- | --- |
| `GET/PATCH` | `/v1/settings/tenant` | Tax, currency, negative stock, receipt defaults |
| `GET/PATCH` | `/v1/settings/branches/{branchId}` | Overrides, POS prefs |

Changes audited and syncable to devices.

---

## 18. Health & Meta

| Method | Path | Auth |
| --- | --- | --- |
| `GET` | `/v1/health` | Public liveness |
| `GET` | `/v1/ready` | Dependencies (DB, Redis) |
| `GET` | `/v1/version` | Build / API version |

---

## 19. OpenAPI Delivery

1. Hand-authored path inventory in this doc (baseline).  
2. NestJS decorators + Zod schemas generate OAS 3.1.  
3. CI fails if generated spec drifts from published artifact.  
4. `packages/types` exports shared DTOs consumed by POS and admin.

---

## 20. Phase Gate

Implementation of Auth module may begin when:

- This baseline is accepted  
- OpenAPI stub exists for auth + sync paths  
- Error envelope, pagination, and idempotency middleware are scaffolded  

---

## Document Control

| Version | Date | Notes |
| --- | --- | --- |
| 1.0.0 | 2026-07-21 | Initial API design baseline |
