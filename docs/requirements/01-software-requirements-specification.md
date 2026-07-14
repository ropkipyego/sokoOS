# SokoOS — Software Requirements Specification (SRS)

| Field | Value |
| --- | --- |
| **Document ID** | SOKO-SRS-001 |
| **Version** | 1.0.0 |
| **Status** | Approved for Architecture Phase |
| **Product** | SokoOS |
| **Tagline** | Africa's Offline-First Commerce Platform |
| **Audience** | Architecture, Engineering, Product, Security, QA |

---

## 1. Introduction

### 1.1 Purpose

This Software Requirements Specification defines the functional and non-functional requirements for **SokoOS**, a commercial-grade, multi-tenant, offline-first commerce operating system for African businesses.

It is the authoritative requirements baseline. Architecture, database design, API contracts, UI systems, and implementation must derive from this document. No module may be implemented until its requirements in this SRS (or an approved module addendum) are satisfied by design artifacts in later phases.

### 1.2 Scope

SokoOS enables businesses to sell, manage inventory, handle purchases, track expenses, and report performance **with or without internet connectivity**. Cloud synchronization occurs automatically in the background when connectivity is available.

**In scope (v1 core platform):**

- Multi-tenant business and branch management
- Authentication, RBAC, and audit logging
- Offline-first desktop POS (Electron + local SQLite)
- Progressive Web App capabilities for selected web surfaces
- Inventory (event-sourced stock movements)
- Products, categories, brands, units
- Sales, returns, payments, receipts
- Customers and suppliers
- Purchases and expenses
- Reporting and notifications (core set)
- Plugin architecture contracts (core must not require modification to add plugins)
- Admin dashboard for platform and business operators
- Sync engine between local devices and cloud services

**Out of scope for v1 (explicitly deferred):**

- Hotel property management
- Manufacturing / MRP
- Full clinic or school ERP
- Native mobile app beyond shared web/PWA foundations (mobile-app app shell may be scaffolded later)
- AI forecasting and recommendations (reserved for AI phase)
- Marketplace monetization beyond plugin registration contracts

Industry-specific depth (restaurant tables/KDS, pharmacy batch/expiry, salon appointments, etc.) is delivered via **plugins**, not by forking the core.

### 1.3 Product Vision

Build a modern, scalable commerce OS that African retailers, wholesalers, and service businesses can trust for daily operations—especially in environments with intermittent connectivity—while remaining competitive with Square, Toast, and Lightspeed on speed, clarity, and reliability.

### 1.4 Definitions and Acronyms

| Term | Definition |
| --- | --- |
| **Tenant** | A business organization isolated from all other businesses on the platform |
| **Branch** | A physical or logical location belonging to a tenant |
| **Device** | A registered POS or admin client that participates in sync |
| **Offline-first** | Core business operations succeed without network; sync is background |
| **Stock movement** | Immutable inventory event (purchase, sale, return, damage, transfer, adjustment) |
| **Plugin** | Industry or feature extension registered via core extension points |
| **Sync status** | Lifecycle of a local record relative to cloud (`pending`, `syncing`, `synced`, `conflict`, `failed`) |
| **RBAC** | Role-Based Access Control with granular permissions |
| **UUID** | Universally unique identifier for syncable entities |
| **POS** | Point of Sale client used primarily by cashiers |
| **SRS** | This Software Requirements Specification |

### 1.5 References

- Project master principles: Offline First, Cloud Sync, Multi Tenant, Multi Branch, Modular, Secure, Fast, Clean Architecture, Simplicity, Extensible
- Target stack: React 19, TypeScript, Vite, Tailwind CSS, TanStack Router/Query, Zustand, React Hook Form, Zod, Electron, PWA, NestJS, PostgreSQL, Prisma, Redis, BullMQ, WebSockets, SQLite, Docker, GitHub Actions, OpenAPI

### 1.6 Document Conventions

- Requirements are identified as **REQ-AREA-NNN** (e.g., `REQ-SALES-012`).
- Priority: **P0** (must ship for core release), **P1** (required soon after core), **P2** (planned enhancement).
- “Shall” = mandatory. “Should” = strongly recommended. “May” = optional.

---

## 2. Stakeholders and Personas

### 2.1 Stakeholders

| Stakeholder | Interest |
| --- | --- |
| Platform Owner | Operate multi-tenant SaaS, billing readiness, system health |
| Business Owner | Run one or many branches profitably with reliable ops |
| Branch Manager | Daily operations, staff, stock, cash discipline |
| Cashier | Fast, simple checkout with minimal training |
| Inventory / Purchasing Officers | Accurate stock and replenishment |
| Accountant / Auditor | Traceable financial and inventory history |
| Customers / Suppliers (portal users) | Self-service views of orders, statements (phased) |
| Engineering / Security | Maintainable, secure, observable system |

### 2.2 Primary Personas

**Cashier (Amina)**  
Works at a busy retail counter with intermittent internet. Needs one-screen checkout, large touch targets, keyboard shortcuts, and receipts without waiting for cloud.

**Business Owner (David)**  
Owns 3 branches. Needs consolidated sales, stock visibility, staff permissions, and confidence that offline sales are not lost.

**Branch Manager (Grace)**  
Opens/closes shifts, manages local users, investigates voids/returns, and monitors low stock.

**Platform Operator**  
Creates tenants, monitors sync health, manages platform-level configuration and incident response.

### 2.3 Training Constraint

Cashiers shall be able to perform standard sales after less than **30 minutes** of training. UI complexity that violates this constraint is a requirements defect.

---

## 3. System Context

### 3.1 Applications

| Application | Role |
| --- | --- |
| `desktop-pos` | Offline-first Electron POS; primary sales surface |
| `admin-dashboard` | Cloud web console for owners, managers, platform ops |
| `customer-portal` | Customer-facing statements/history (phased) |
| `supplier-portal` | Supplier collaboration (phased) |
| `mobile-app` | Future field operations; not required for SRS v1 acceptance |

### 3.2 Backend Services (logical)

| Service | Responsibility |
| --- | --- |
| `auth-service` | Identity, sessions, tokens, device registration |
| `sales-service` | Sales, returns, payments (cloud projection) |
| `inventory-service` | Products, warehouses, stock movements |
| `sync-service` | Ingest local events, conflict handling, acknowledgements |
| `reporting-service` | Aggregations and report APIs |
| `notification-service` | In-app, email/SMS hooks (provider-abstracted) |

Services may be deployed as modular NestJS applications within a monorepo. Physical deployment topology is decided in Architecture; logical boundaries in this SRS remain mandatory.

### 3.3 Data Stores

| Store | Use |
| --- | --- |
| PostgreSQL | System of record in cloud (multi-tenant) |
| SQLite | Local encrypted store on POS devices |
| Redis | Caching, rate limits, job/pubsub coordination |
| Object Storage | Receipts, exports, attachments |
| BullMQ | Background jobs including sync and notifications |

---

## 4. Core Platform Principles (Normative)

These principles are mandatory constraints on all requirements and designs.

1. **Offline First** — Every critical business operation must work without internet.
2. **Cloud Sync** — Synchronization happens automatically in the background.
3. **Multi Tenant** — One platform serves thousands of businesses with hard isolation.
4. **Multi Branch** — Tenants may have unlimited branches.
5. **Modular** — Industry-specific features are plugins.
6. **Secure** — Every mutating action is audited.
7. **Fast** — UI must feel instant for checkout and search.
8. **Clean Architecture** — No spaghetti; clear boundaries and dependencies.
9. **Simplicity** — Cashiers learn standard flows in under 30 minutes.
10. **Extensible** — Future modules plug in without rewriting core.

---

## 5. Functional Requirements

### 5.1 Authentication and Sessions

| ID | Requirement | Priority |
| --- | --- | --- |
| REQ-AUTH-001 | System shall authenticate users with credentials and issue JWT access tokens plus refresh tokens. | P0 |
| REQ-AUTH-002 | Desktop POS shall support local offline login for previously authenticated users on a registered device (cached credentials/session material protected at rest). | P0 |
| REQ-AUTH-003 | System shall support logout, token revocation, and refresh rotation. | P0 |
| REQ-AUTH-004 | System shall register devices and bind syncable operations to `device_id`. | P0 |
| REQ-AUTH-005 | Failed authentication attempts shall be rate-limited and logged. | P0 |
| REQ-AUTH-006 | Password reset and invite-based user onboarding shall be supported for online admin flows. | P1 |
| REQ-AUTH-007 | Sessions shall include tenant and branch context where applicable. | P0 |

**Business workflow (auth):** Invite/create user → assign roles → user signs in on device → device registered → offline re-auth allowed for that device until credentials rotated or access revoked (revocation enforced on next online sync).

### 5.2 Tenants (Businesses)

| ID | Requirement | Priority |
| --- | --- | --- |
| REQ-TEN-001 | Platform shall create and manage tenants with unique identity and isolation boundaries. | P0 |
| REQ-TEN-002 | Every business data record shall include `tenant_id`. | P0 |
| REQ-TEN-003 | Cross-tenant data access shall be impossible via application APIs under normal and adversarial inputs (enforced server-side). | P0 |
| REQ-TEN-004 | Tenant settings shall include currency, tax regime defaults, timezone, and locale. | P0 |
| REQ-TEN-005 | Tenant lifecycle states shall include `active`, `suspended`, `closed`. | P0 |

### 5.3 Branches

| ID | Requirement | Priority |
| --- | --- | --- |
| REQ-BR-001 | Tenants shall create unlimited branches. | P0 |
| REQ-BR-002 | Every branch-scoped record shall include `branch_id` where the domain is location-specific. | P0 |
| REQ-BR-003 | Users may be assigned to one or more branches with scoped permissions. | P0 |
| REQ-BR-004 | Branch settings may override tenant defaults where allowed (e.g., receipt header). | P1 |

### 5.4 Users, Roles, and Permissions

| ID | Requirement | Priority |
| --- | --- | --- |
| REQ-RBAC-001 | System shall provide default roles: Platform Owner, Business Owner, Regional Manager, Branch Manager, Supervisor, Cashier, Inventory Officer, Purchasing Officer, Accountant, Auditor, Customer, Supplier. | P0 |
| REQ-RBAC-002 | Permissions shall be granular (resource + action), configurable per tenant (except platform-level permissions). | P0 |
| REQ-RBAC-003 | Authorization checks shall occur on server and on POS for offline-capable actions. | P0 |
| REQ-RBAC-004 | Role changes shall take effect for online sessions promptly and for offline devices on next successful sync of authz material. | P0 |
| REQ-RBAC-005 | Least privilege shall be default for new custom roles. | P0 |

### 5.5 Products Catalog

| ID | Requirement | Priority |
| --- | --- | --- |
| REQ-PRD-001 | System shall manage products with SKU/barcode, name, pricing, tax flags, status, and media references. | P0 |
| REQ-PRD-002 | System shall support categories, brands, and units of measure. | P0 |
| REQ-PRD-003 | Products shall be searchable by name, SKU, and barcode with sub-second UX on local POS catalogs of typical retail size. | P0 |
| REQ-PRD-004 | Products may be branch-priced or tenant-priced according to tenant policy. | P1 |
| REQ-PRD-005 | Soft-delete / archive shall be used; hard delete of sold products is forbidden. | P0 |

### 5.6 Inventory (Event-Sourced)

| ID | Requirement | Priority |
| --- | --- | --- |
| REQ-INV-001 | Inventory shall be event-sourced via immutable stock movements. Current stock is always derived from movements (materialized projections allowed). | P0 |
| REQ-INV-002 | Supported movement types shall include at least: Purchase, Sale, Return, Damage, Transfer, Adjustment. | P0 |
| REQ-INV-003 | Stock levels shall never be overwritten as a sole source of truth. | P0 |
| REQ-INV-004 | Warehouses/locations shall be supported (at least one default per branch). | P0 |
| REQ-INV-005 | Low-stock thresholds shall trigger notifications/report inclusion. | P1 |
| REQ-INV-006 | Transfers between branches/warehouses shall create paired immutable movements with correlation IDs. | P0 |
| REQ-INV-007 | Negative stock policy shall be tenant-configurable (allow, warn, block). | P0 |

**Business workflow (inventory):** Goods received → Purchase movement +100 → Sales create Sale movements −qty → Returns create Return movements +qty → Damage/transfer/adjustment recorded as separate events → Reports read projections rebuilt from events.

### 5.7 Sales and Checkout

| ID | Requirement | Priority |
| --- | --- | --- |
| REQ-SALES-001 | Desktop POS shall provide one-screen checkout: search, categories, products, cart, totals, payment, receipt. | P0 |
| REQ-SALES-002 | Completing a sale offline shall persist the sale to local SQLite, update local stock movements, queue sync, and allow receipt printing without internet. | P0 |
| REQ-SALES-003 | Sales shall support multiple payment methods (cash, mobile money, card, split tender) as configured. | P0 |
| REQ-SALES-004 | Sales shall capture cashier, device, branch, tenant, timestamps, and line items with quantities and prices. | P0 |
| REQ-SALES-005 | Voids and returns shall be permission-gated and audited. | P0 |
| REQ-SALES-006 | Keyboard shortcuts and touch-friendly large controls shall be supported. | P0 |
| REQ-SALES-007 | Nested menus shall not be required for standard checkout. | P0 |
| REQ-SALES-008 | Discounts shall be permission-controlled and auditable. | P0 |
| REQ-SALES-009 | Tax calculation shall follow tenant/branch tax configuration. | P0 |

**Offline sale workflow (normative):**

1. User creates sale  
2. Sale stored in SQLite  
3. Receipt printed  
4. Sync queue updated  
5. Background synchronization  
6. Cloud receives event  
7. Cloud acknowledges  
8. Local database marks synced  

Users shall never be required to manually synchronize for normal operations.

### 5.8 Customers

| ID | Requirement | Priority |
| --- | --- | --- |
| REQ-CUS-001 | System shall create and manage customers (walk-in default allowed). | P0 |
| REQ-CUS-002 | Sales may optionally attach a customer. | P0 |
| REQ-CUS-003 | Customer purchase history shall be available online; offline POS shall retain recent/local subset as configured. | P1 |

### 5.9 Suppliers and Purchases

| ID | Requirement | Priority |
| --- | --- | --- |
| REQ-SUP-001 | System shall manage suppliers and purchase orders/receipts. | P0 |
| REQ-SUP-002 | Receiving goods shall create immutable purchase stock movements. | P0 |
| REQ-SUP-003 | Purchase documents shall support line items, costs, and payment status. | P0 |

### 5.10 Expenses and Payments

| ID | Requirement | Priority |
| --- | --- | --- |
| REQ-EXP-001 | System shall record business expenses with category, amount, branch, and attachments metadata. | P0 |
| REQ-PAY-001 | Payments against sales and purchases shall be recorded with method, amount, reference, and audit fields. | P0 |

### 5.11 Returns

| ID | Requirement | Priority |
| --- | --- | --- |
| REQ-RET-001 | Returns shall reference original sale when available and create compensating stock and financial records. | P0 |
| REQ-RET-002 | Partial returns shall be supported. | P0 |

### 5.12 Reports

| ID | Requirement | Priority |
| --- | --- | --- |
| REQ-RPT-001 | System shall provide reports for: Sales, Profit, Expenses, Inventory, Cash Flow, Tax, Customer Analysis, Supplier Analysis, Cashier Performance, Branch Comparison, Daily Summary, Monthly Summary, Inventory Valuation, Low Stock, Dead Stock. | P0/P1 |
| REQ-RPT-002 | Daily and cashier summaries shall be available on POS from local data while offline. | P0 |
| REQ-RPT-003 | Cross-branch consolidated reports require online cloud data. | P0 |
| REQ-RPT-004 | Forecast reports are deferred to AI phase (P2). | P2 |

### 5.13 Notifications

| ID | Requirement | Priority |
| --- | --- | --- |
| REQ-NOT-001 | System shall notify relevant roles of low stock, sync failures, and security-sensitive events. | P1 |
| REQ-NOT-002 | Notification channels shall be provider-abstracted (in-app first). | P1 |

### 5.14 Audit Logs

| ID | Requirement | Priority |
| --- | --- | --- |
| REQ-AUD-001 | Every mutating business action shall produce an audit log entry with actor, tenant, branch (if any), action, entity, before/after or event payload reference, device, and timestamp. | P0 |
| REQ-AUD-002 | Audit logs shall be immutable to normal users and queryable by Auditor/Owner roles. | P0 |

### 5.15 Settings

| ID | Requirement | Priority |
| --- | --- | --- |
| REQ-SET-001 | Tenant and branch settings shall cover receipt templates, tax, currency, negative stock policy, and POS preferences. | P0 |
| REQ-SET-002 | Settings changes shall be audited and syncable to devices. | P0 |

### 5.16 Synchronization Engine

| ID | Requirement | Priority |
| --- | --- | --- |
| REQ-SYNC-001 | Every synchronized record shall include: `uuid`, `device_id`, `version`, `sync_status`, `created_at`, `updated_at`, `created_by`, `updated_by`, plus `tenant_id` and `branch_id` when applicable. | P0 |
| REQ-SYNC-002 | Sync shall be automatic, background, and resilient to intermittent connectivity. | P0 |
| REQ-SYNC-003 | Cloud shall acknowledge accepted events; local store shall mark records synced only after acknowledgement. | P0 |
| REQ-SYNC-004 | Conflict detection and resolution rules shall be deterministic, documented, and testable. | P0 |
| REQ-SYNC-005 | Sync monitoring shall expose queue depth, failure rates, and last successful sync per device. | P0 |
| REQ-SYNC-006 | Manual “force sync” may exist for support, but must not be required for cashiers. | P1 |

**Edge cases:** duplicate event delivery, clock skew, partial upload, device reinstall, role revocation while offline, conflicting product edits, concurrent stock movements on same SKU across devices.

### 5.17 Plugins and Extensibility

| ID | Requirement | Priority |
| --- | --- | --- |
| REQ-PLG-001 | Core shall expose extension points for: routes, database migrations, permissions, menus, reports, background jobs, settings. | P0 (contracts) |
| REQ-PLG-002 | Adding a plugin shall not require modifying core business logic modules. | P0 |
| REQ-PLG-003 | Plugin examples (restaurant, pharmacy, hardware, salon, hotel, manufacturing, clinic, school shop) shall be supportable by the contract even if implementations are later. | P0 (architecture) / P2 (implementations) |
| REQ-PLG-004 | Plugins shall declare required permissions and be installable per tenant. | P1 |

### 5.18 Admin Dashboard

| ID | Requirement | Priority |
| --- | --- | --- |
| REQ-ADM-001 | Admin dashboard shall support tenant ops: users, branches, catalog, inventory visibility, sales history, reports, settings. | P0 |
| REQ-ADM-002 | Platform owner views shall include tenant list, health, and suspension controls. | P0 |
| REQ-ADM-003 | UI shall support light and dark themes, responsive layouts, and consistent design tokens. | P0 |

### 5.19 Portals (Phased)

| ID | Requirement | Priority |
| --- | --- | --- |
| REQ-POR-001 | Customer and supplier portals shall authenticate distinct identities and expose limited read/write surfaces. | P2 |

### 5.20 Developer Portal / Marketplace (Phased)

| ID | Requirement | Priority |
| --- | --- | --- |
| REQ-DEV-001 | Developer portal and marketplace for third-party plugins are future capabilities; core must not preclude them. | P2 |

---

## 6. Non-Functional Requirements

### 6.1 Performance

| ID | Requirement | Priority |
| --- | --- | --- |
| REQ-NFR-PERF-001 | POS product search against local catalog shall feel instant (< 100 ms typical for local indexed queries on mid-range hardware). | P0 |
| REQ-NFR-PERF-002 | Completing a local sale persist + queue enqueue shall complete without perceptible UI stall under normal load. | P0 |
| REQ-NFR-PERF-003 | Cloud APIs for common reads shall target p95 < 300 ms under nominal load (excluding cold starts). | P1 |
| REQ-NFR-PERF-004 | System design shall support millions of transactions over time per large tenants via partitioning/indexing and event projections. | P0 |

### 6.2 Reliability and Offline

| ID | Requirement | Priority |
| --- | --- | --- |
| REQ-NFR-REL-001 | No internet shall not block sale completion, receipt printing, or local inventory deduction. | P0 |
| REQ-NFR-REL-002 | Local data shall survive app restarts; crash recovery shall not lose committed sales. | P0 |
| REQ-NFR-REL-003 | Sync retries shall use backoff and idempotency keys / event UUIDs. | P0 |

### 6.3 Security

| ID | Requirement | Priority |
| --- | --- | --- |
| REQ-NFR-SEC-001 | Transport shall use HTTPS/TLS for all cloud communication. | P0 |
| REQ-NFR-SEC-002 | Local SQLite shall be encrypted at rest on POS devices. | P0 |
| REQ-NFR-SEC-003 | Input validation shall use schema validation (Zod on clients; equivalent on servers). | P0 |
| REQ-NFR-SEC-004 | APIs shall implement rate limiting and OWASP ASVS-aligned controls for authn/authz, injection, and sensitive data exposure. | P0 |
| REQ-NFR-SEC-005 | Secrets shall never be committed; environment-based configuration only. | P0 |
| REQ-NFR-SEC-006 | PII and financial data access shall be permission-scoped and audited. | P0 |

### 6.4 Scalability and Multi-Tenancy

| ID | Requirement | Priority |
| --- | --- | --- |
| REQ-NFR-SCALE-001 | Data model and queries shall always be tenant-scoped. | P0 |
| REQ-NFR-SCALE-002 | Architecture shall allow horizontal scale of stateless API nodes. | P0 |
| REQ-NFR-SCALE-003 | Background work shall be queue-based (BullMQ). | P0 |

### 6.5 Usability and Accessibility

| ID | Requirement | Priority |
| --- | --- | --- |
| REQ-NFR-UX-001 | Checkout UI shall be cleaner and less cluttered than typical legacy POS; large buttons; minimal modals. | P0 |
| REQ-NFR-UX-002 | Accessibility: keyboard operable primary flows; sufficient contrast; focus states. | P0 |
| REQ-NFR-UX-003 | Dark and light themes shall be supported. | P0 |
| REQ-NFR-UX-004 | Desktop and mobile-responsive admin layouts are required. | P0 |

### 6.6 Observability

| ID | Requirement | Priority |
| --- | --- | --- |
| REQ-NFR-OBS-001 | Structured logging, metrics, tracing, health checks, and crash reporting shall be supported. | P0 |
| REQ-NFR-OBS-002 | Background jobs and synchronization shall be monitorable. | P0 |

### 6.7 Compliance and Auditability

| ID | Requirement | Priority |
| --- | --- | --- |
| REQ-NFR-CMP-001 | Financial and inventory history shall be reconstructable from immutable events/audit trails. | P0 |
| REQ-NFR-CMP-002 | Tax report inputs shall be derivable from recorded sales and configured rates. | P0 |

### 6.8 Internationalization (Africa-ready)

| ID | Requirement | Priority |
| --- | --- | --- |
| REQ-NFR-I18N-001 | Currency, tax, and locale shall be tenant-configurable. | P0 |
| REQ-NFR-I18N-002 | UI string externalization should be prepared; English first. | P1 |

---

## 7. Data Requirements (Logical)

### 7.1 Mandatory Sync Metadata

All synchronized business entities shall carry:

- `uuid`
- `tenant_id`
- `branch_id` (when branch-scoped)
- `device_id` (originating device when created/updated on device)
- `version`
- `sync_status`
- `created_at`, `updated_at`
- `created_by`, `updated_by`

### 7.2 Inventory Truth Model

- Stock movements are append-only.
- Projections (on-hand quantities) may be cached but must be rebuildable.
- Corrections use compensating movements, not silent edits of historical movements.

### 7.3 Isolation

- Application queries shall include tenant predicates.
- Database design should support row-level enforcement strategies decided in Architecture (application-enforced minimum; DB policies optional hardening).

---

## 8. User Interface Requirements

### 8.1 Design System Goals

- Professional typography and consistent spacing
- Shared `packages/ui` component library
- No clutter; one job per section on marketing/admin surfaces
- POS prioritizes density-appropriate clarity for speed, not decorative chrome

### 8.2 Sales Screen Composition

Must keep visible without nested navigation:

1. Search  
2. Categories  
3. Products  
4. Cart  
5. Totals  
6. Payment  
7. Receipt action  

### 8.3 Interaction Rules

- Prefer inline flows over unnecessary modals
- Touch targets sized for fingers
- Keyboard shortcuts documented and discoverable
- Theme toggle without losing cashier context

Detailed wireframes and design tokens belong to the **UI Design System** phase after Architecture/API baselines.

---

## 9. API Requirements (Contract-Level)

| ID | Requirement | Priority |
| --- | --- | --- |
| REQ-API-001 | Cloud APIs shall be documented with OpenAPI. | P0 |
| REQ-API-002 | APIs shall be versioned. | P0 |
| REQ-API-003 | Sync ingestion APIs shall be idempotent per event `uuid`. | P0 |
| REQ-API-004 | Real-time channels (WebSockets) may notify devices of remote catalog/permission updates. | P1 |
| REQ-API-005 | All mutating endpoints shall enforce authn/authz and emit audit events. | P0 |

Detailed endpoint catalogs are produced in the **API** phase; this SRS constrains their behavior.

---

## 10. Integration Requirements

| ID | Requirement | Priority |
| --- | --- | --- |
| REQ-INT-001 | Receipt printers shall be supported via POS device integrations (OS/print bridges). | P0 |
| REQ-INT-002 | Payment provider integrations (mobile money/card) shall be abstracted behind interfaces. | P1 |
| REQ-INT-003 | Object storage shall store exports and attachments. | P1 |
| REQ-INT-004 | SMS/email providers shall be swappable. | P2 |

---

## 11. Constraints

1. Monorepo structure as specified (`apps/`, `services/`, `packages/`, `docs/`).
2. Technology stack choices in the master prompt are normative unless an Architecture Decision Record (ADR) supersedes with explicit justification.
3. No internet dependency for core POS selling path.
4. Plugins must not require core rewrites.
5. Development order is mandatory: SRS → Architecture → Database → API → UI Design System → Auth → Tenant → Branch → Permissions → Sync → Inventory → Products → Sales → … → Deployment → Testing → Documentation.

---

## 12. Assumptions and Dependencies

### 12.1 Assumptions

- Target POS hardware is contemporary x86/ARM laptops/tablets capable of running Electron.
- Businesses can periodically connect to the internet for sync (hours/days offline acceptable; indefinite offline with unbounded local growth needs operational policies).
- Platform operators manage tenant provisioning initially (self-serve billing later).

### 12.2 Dependencies

- PostgreSQL, Redis, object storage, and container runtime for cloud environments
- CI via GitHub Actions
- Certificate/TLS termination in deployment environment

---

## 13. Edge Cases and Failure Modes (Cross-Cutting)

| Scenario | Expected behavior |
| --- | --- |
| Internet drops mid-sale | Sale completes locally; sync retries later |
| Duplicate sync upload | Cloud accepts once (idempotent); local marked synced |
| Conflicting product name/price edits | Deterministic conflict policy (version vectors / last-write with audit / domain rules)—exact algorithm in Architecture |
| Offline role revocation | Enforced on next authz sync; high-risk actions may require online confirmation (policy) |
| Device restore | Re-register device; pull snapshot + resume queue carefully to avoid duplicates |
| Clock skew | Server timestamps authoritative for cloud; local times retained; skew bounded/warned |
| Negative stock blocked | Sale line rejected with clear cashier guidance |
| Printer failure | Sale remains committed; reprint available |

---

## 14. Security Concerns (Requirements View)

- Tenant isolation failures are Sev-0 class defects.
- Offline credential storage must resist casual extraction (OS keychain / SQLCipher-class encryption).
- Privilege escalation via plugin permissions must be prevented through signed/declared permission manifests (design in Architecture).
- Audit logs must not be editable by Business Owner for covering tracks (append-only; platform retention controls).

---

## 15. Testing Requirements

| ID | Requirement | Priority |
| --- | --- | --- |
| REQ-QA-001 | Unit, integration, and end-to-end tests are mandatory for core modules. | P0 |
| REQ-QA-002 | Offline sale + sync acknowledgement path shall have automated tests. | P0 |
| REQ-QA-003 | Conflict resolution shall have dedicated tests. | P0 |
| REQ-QA-004 | Performance tests for POS search and sale commit are required before release candidates. | P1 |
| REQ-QA-005 | Load tests for sync ingestion and multi-tenant API fan-out are required before scale launch. | P1 |
| REQ-QA-006 | Security tests for authz bypass and tenant isolation are mandatory. | P0 |

---

## 16. Documentation Requirements

Every module delivered after Architecture shall include documentation covering:

1. Purpose  
2. Architecture  
3. Database  
4. API  
5. UI  
6. Business Rules  
7. Testing  
8. Security  
9. Future Improvements  

This SRS is the root requirements document; module docs refine it without contradicting it unless versioned change control updates this SRS.

---

## 17. Acceptance Criteria for Leaving SRS Phase

Architecture phase may begin when:

1. This SRS is reviewed and accepted as the requirements baseline.  
2. Open questions below are either resolved or explicitly deferred with owners.  
3. No implementation of business modules precedes Architecture + Database + API design artifacts.

---

## 18. Open Questions (Deferred to Architecture with Defaults)

| # | Question | Default until decided |
| --- | --- | --- |
| 1 | Exact conflict resolution algorithm for catalog vs stock events | Versioned events; stock = commutative movements; catalog = higher version wins with audit of loser |
| 2 | Multi-currency within one tenant | Single functional currency per tenant in v1 |
| 3 | Fiscal device / e-invoicing country packs | Plugin/country pack later; abstract tax engine now |
| 4 | Soft vs hard tenancy isolation in PostgreSQL | Shared DB + `tenant_id` + strict app enforcement in v1; evaluate RLS hardening |
| 5 | Mobile money providers per country | Interface + one reference adapter later |

---

## 19. Phased Delivery Map

| Phase | Deliverable |
| --- | --- |
| 0 | SRS (this document) |
| 1 | Architecture (system, sync, plugins, ADRs) |
| 2 | Database model |
| 3 | API / OpenAPI |
| 4 | UI Design System |
| 5 | Auth, Tenant, Branch, Permissions |
| 6 | Synchronization Engine |
| 7 | Inventory, Products, Sales, Customers, Suppliers, Purchases, Expenses |
| 8 | Reports, Notifications |
| 9 | Plugins (contracts → first industry plugins) |
| 10 | AI (forecasts/recommendations) |
| 11 | Deployment, Hardening |
| 12 | Testing program completion |
| 13 | Operator & developer documentation |

---

## 20. Requirement Traceability Summary

| Domain | Requirement IDs |
| --- | --- |
| Auth | REQ-AUTH-* |
| Tenant | REQ-TEN-* |
| Branch | REQ-BR-* |
| RBAC | REQ-RBAC-* |
| Products | REQ-PRD-* |
| Inventory | REQ-INV-* |
| Sales | REQ-SALES-* |
| Customers | REQ-CUS-* |
| Suppliers/Purchases | REQ-SUP-* |
| Expenses/Payments | REQ-EXP-*, REQ-PAY-* |
| Returns | REQ-RET-* |
| Reports | REQ-RPT-* |
| Notifications | REQ-NOT-* |
| Audit | REQ-AUD-* |
| Settings | REQ-SET-* |
| Sync | REQ-SYNC-* |
| Plugins | REQ-PLG-* |
| Admin | REQ-ADM-* |
| API | REQ-API-* |
| NFR | REQ-NFR-* |
| QA | REQ-QA-* |

---

## Document Control

| Version | Date | Author Role | Notes |
| --- | --- | --- | --- |
| 1.0.0 | 2026-07-14 | Lead Software Architect | Initial commercial SRS baseline for SokoOS |

**Next document:** `docs/architecture/01-system-architecture.md` (to be authored in Architecture phase).
