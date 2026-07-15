# SokoOS — System Architecture

| Field | Value |
| --- | --- |
| **Document ID** | SOKO-ARCH-001 |
| **Version** | 1.0.0 |
| **Status** | Baseline for Database Phase |
| **Depends on** | [SOKO-SRS-001](../requirements/01-software-requirements-specification.md) |
| **Audience** | Engineering, Security, DevOps, QA |

---

## 1. Purpose

This document defines the system architecture for SokoOS: how applications, services, data stores, and cross-cutting concerns collaborate to deliver an offline-first, multi-tenant commerce platform.

It answers:

- How do clients and services communicate?
- Where does truth live (local vs cloud)?
- How is tenant isolation enforced?
- How do we scale without rewriting core modules?
- Which architectural style do we choose, and why?

Detailed sync mechanics → [02-sync-engine.md](./02-sync-engine.md)  
Plugin contracts → [03-plugin-system.md](./03-plugin-system.md)  
Security → [04-security-architecture.md](./04-security-architecture.md)  
Decision records → [adrs/](./adrs/)

---

## 2. Architectural Goals

| Goal | Measure |
| --- | --- |
| Offline sales never blocked by network | Sale commit + receipt path has zero cloud dependency |
| Tenant isolation | Cross-tenant reads/writes impossible via application APIs |
| Extensibility | Industry plugins register without core source changes |
| Operability | Health, metrics, traces, sync queues visible |
| Maintainability | Clear bounded contexts; no duplicated domain logic |
| Performance | Local POS search/sale feels instant on mid-range hardware |

---

## 3. Recommended Style: Modular Monolith + Sync Edge

### 3.1 Options compared

| Approach | Pros | Cons | Verdict |
| --- | --- | --- | --- |
| **Many microservices from day one** | Independent deploy, team scale | High ops cost, distributed transactions, premature for early product | Reject for v1 |
| **Single ball-of-mud Nest app** | Fast start | Spaghetti risk, hard plugin boundaries | Reject |
| **Modular monolith (Nest modules) with clear packages + optional extractable services** | Strong boundaries, one deploy unit early, extract later | Discipline required | **Recommend** |
| **Event-sourced everything in cloud** | Perfect audit | Overkill for catalog/settings; complexity | Hybrid: inventory/sales events; CRUD for catalog with versioning |

### 3.2 Decision

**Adopt a modular monolith for cloud APIs** (NestJS application composed of domain modules that map 1:1 to future extractable services), plus:

- Dedicated **sync ingestion** path (can be a module or separate process later)
- **Electron POS** as a thick offline client with SQLite
- **Admin dashboard** as a thin online client

Logical services from the SRS (`auth-service`, `sales-service`, etc.) remain **bounded contexts** inside `services/` packages/apps. Physical split is deferred until scale or team boundaries require it (see ADR-001).

---

## 4. High-Level Context

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                              Operators / Staff                           │
└───────────────┬─────────────────────────────┬───────────────────────────┘
                │                             │
                ▼                             ▼
     ┌──────────────────┐          ┌─────────────────────┐
     │  desktop-pos     │          │  admin-dashboard    │
     │  Electron + React│          │  React (online)     │
     │  SQLite (local)  │          │  TanStack Query     │
     └────────┬─────────┘          └──────────┬──────────┘
              │ sync (when online)            │ HTTPS / WSS
              ▼                               ▼
     ┌────────────────────────────────────────────────────┐
     │              SokoOS Cloud API (NestJS)             │
     │  Auth │ Tenants │ Catalog │ Inventory │ Sales │ … │
     │  Sync Ingest │ Reports │ Notifications │ Plugins  │
     └───────┬───────────────┬───────────────┬────────────┘
             ▼               ▼               ▼
        PostgreSQL         Redis          Object Storage
                           BullMQ
```

Portals (`customer-portal`, `supplier-portal`) attach later to the same API with restricted scopes.

---

## 5. Monorepo Structure (Normative)

```text
apps/
  admin-dashboard/     # Online management UI
  desktop-pos/         # Electron offline POS
  mobile-app/          # Deferred shell
  customer-portal/     # Phased
  supplier-portal/     # Phased
services/
  api/                 # Modular NestJS monolith (v1 deployable)
  # Future extractions (keep folders as packages until split):
  # auth-service/, sales-service/, inventory-service/,
  # sync-service/, reporting-service/, notification-service/
packages/
  ui/                  # Design system components
  database/            # Prisma schema, migrations, client
  shared/              # Cross-cutting helpers
  types/               # Shared domain types + Zod schemas
  utils/               # Pure utilities
  sync-protocol/       # Sync envelopes, versioning, conflict types
  plugin-sdk/          # Plugin registration contracts
docs/
```

**Rationale:** One Nest deployable (`services/api`) avoids distributed complexity while preserving folder boundaries that mirror SRS services. Extraction becomes a move, not a rewrite.

---

## 6. Bounded Contexts

| Context | Owns | Does not own |
| --- | --- | --- |
| **Identity & Access** | Users, credentials, sessions, devices, roles, permissions | Business documents |
| **Tenant & Org** | Tenants, branches, tenant settings | Sales totals |
| **Catalog** | Products, categories, brands, units, prices | Stock quantities as source of truth |
| **Inventory** | Warehouses, stock movements, projections | Sale payment details |
| **Sales** | Sales, sale items, returns, tenders | Supplier master |
| **Procurement** | Suppliers, purchases, purchase items | POS UI |
| **Finance Ops** | Expenses, payment records (as domain events/docs) | Bank integrations (later) |
| **Sync** | Queues, acknowledgements, conflict records, device cursors | Business rule authorship |
| **Reporting** | Read models, aggregations | Mutating sales |
| **Notifications** | Delivery of alerts | Deciding business policy |
| **Audit** | Append-only audit stream | Domain writes themselves |
| **Plugins** | Registry, manifests, extension wiring | Core domain invariants |

Cross-context communication inside the monolith uses **application services / domain events** (in-process), not shared mutable tables without ownership.

---

## 7. Client Architectures

### 7.1 Desktop POS (offline-first)

```text
UI (React)
  → Application commands (create sale, search products)
    → Local domain services
      → SQLite repositories
      → Sync outbox (same DB transaction when possible)
    → Print adapter
Background sync worker
  → Reads outbox → HTTPS sync API → applies acks / inbound changes
```

**Rules:**

- UI never calls cloud for sale commit.
- Local schema mirrors sync protocol entities, not every cloud table.
- Encrypted SQLite; secrets in OS keychain where available.
- Zustand for ephemeral UI state; SQLite for durable state; TanStack Query optional for cloud-only screens when online.

### 7.2 Admin Dashboard (online)

- Standard BFF-less SPA against versioned REST/OpenAPI.
- TanStack Router + Query for server state.
- WebSocket subscription for live sync health / catalog push notifications (P1).

---

## 8. Cloud API Architecture (NestJS)

### 8.1 Layering (per module)

```text
Controllers (HTTP/WS)     — transport, DTO validation
Application services      — use cases / workflows
Domain                    — entities, invariants, pure policies
Infrastructure            — Prisma, Redis, queues, storage
```

### 8.2 Cross-cutting middleware / guards

1. TLS terminated at edge  
2. Rate limiting (Redis)  
3. JWT authentication  
4. Tenant context binding  
5. Permission guard (`resource:action`)  
6. Idempotency middleware on sync ingest  
7. Audit interceptor on mutations  

### 8.3 API style

- **REST + OpenAPI** for resource and sync endpoints (ADR-002)
- **WebSockets** for server→device notifications (not for sale commits)
- Version prefix: `/v1/...`

---

## 9. Data Architecture (Overview)

> Full physical model is the **Database** phase. This section locks logical decisions.

### 9.1 Dual-store model

| Store | Role |
| --- | --- |
| **SQLite (device)** | Operational truth while offline; outbox; local projections |
| **PostgreSQL (cloud)** | Multi-tenant system of record; reporting source; device reconciliation |

### 9.2 Identity of records

- Client-generated **UUIDv7** (time-ordered) for syncable entities created on device or server.
- Cloud may allocate UUIDs for online-only admin creates; same UUID space.

### 9.3 Inventory

- **Append-only stock_movements** are the source of truth.
- `stock_balances` (or equivalent) is a **projection** maintained transactionally on write and rebuildable.
- Never “SET quantity = N” as the only write.

### 9.4 Multi-tenancy

- Shared PostgreSQL database, shared schemas, mandatory `tenant_id` on tenant data (ADR-003).
- Every query path passes through tenant-scoped repositories.
- Optional PostgreSQL RLS as defense-in-depth in a later hardening pass.

### 9.5 Sync metadata (all syncable rows)

`uuid`, `tenant_id`, `branch_id?`, `device_id?`, `version`, `sync_status` (local), `created_at`, `updated_at`, `created_by`, `updated_by`

---

## 10. Synchronization (Summary)

Normative offline sale path:

```text
Sale → SQLite commit + stock movement + outbox
    → Receipt print
    → Background worker uploads envelope
    → Cloud validates, persists, ACK
    → Local marks synced
```

Conflict policy (defaults from SRS):

- **Stock movements:** commutative append; conflicts are rare; duplicate UUID = idempotent no-op.
- **Catalog / settings:** monotonic `version`; higher version wins; loser retained in conflict log for audit.
- **Sales:** immutable after commit; corrections via returns/voids, not edits.

Full design: [02-sync-engine.md](./02-sync-engine.md).

---

## 11. Plugin Architecture (Summary)

Core exposes a **Plugin SDK** with registration for:

- Routes (API + UI menu contributions)
- Migrations (namespaced)
- Permissions
- Menus
- Reports
- Background jobs
- Settings schemas

Plugins are packages that the host loads via manifest; core business modules do not `import` plugin internals.

Full design: [03-plugin-system.md](./03-plugin-system.md).

---

## 12. Security Architecture (Summary)

- JWT access + rotating refresh tokens  
- Device registration binding  
- Encrypted local DB  
- RBAC with granular permissions  
- Append-only audit log  
- OWASP-aligned validation and rate limits  

Full design: [04-security-architecture.md](./04-security-architecture.md).

---

## 13. Observability

| Signal | Approach |
| --- | --- |
| Logs | Structured JSON; `tenant_id`, `request_id`, `device_id` correlation |
| Metrics | RED for APIs; queue depth; sync success/fail; sale commit latency (local) |
| Traces | OpenTelemetry instrumentation in API |
| Health | `/health/live`, `/health/ready` (DB, Redis) |
| Crash reporting | Electron + web client reporters |
| Sync monitoring | Per-device last ack, outbox lag, conflict counts |

---

## 14. Deployment Topology (v1)

```text
GitHub Actions → build & test → container image
Docker Compose / K8s:
  - api (Nest modular monolith)
  - worker (BullMQ consumers; can be same image different command)
  - postgres
  - redis
  - object storage (MinIO/S3-compatible)
Admin & POS artifacts:
  - admin-dashboard static assets / container
  - desktop-pos Electron installers (CI artifacts)
```

Horizontal scale: stateless `api` + `worker` replicas; Postgres primary; Redis shared.

---

## 15. Performance Strategy

| Surface | Strategy |
| --- | --- |
| POS search | Local FTS/indexed columns; warm catalog in memory optional |
| POS sale commit | Single SQLite transaction: sale + lines + movements + outbox |
| Cloud reads | Tenant+branch indexes; pagination; read replicas later |
| Reports | Async materialization for heavy reports; POS daily summary from local |

---

## 16. Testing Architecture

| Layer | Focus |
| --- | --- |
| Unit | Domain invariants, conflict merge, permission checks |
| Integration | Prisma modules, sync ingest idempotency |
| E2E | Admin flows; POS sale→outbox→ack (with test double cloud) |
| Offline / sync suites | Network flap, duplicate delivery, version conflicts |
| Security | Tenant isolation fuzz; authz bypass attempts |
| Load | Sync ingest and multi-tenant API |

---

## 17. Risks and Mitigations

| Risk | Mitigation |
| --- | --- |
| Modular monolith erodes into spaghetti | Lint boundaries, package import rules, CODEOWNERS per context |
| Sync bugs lose money/stock | Idempotent envelopes, extensive sync tests, durable outbox |
| Plugin migrations break core | Namespaced migrations, compatibility tests, signed manifests later |
| Clock skew | UUIDv7 + server ack time; reject extreme skew with warning path |
| Local DB corruption | Backup/export hooks; integrity checks on startup |

---

## 18. Phase Gate — Architecture Complete When

1. This document + sync + plugin + security docs accepted.  
2. ADRs 001–005 accepted.  
3. Open questions either closed or explicitly deferred.  
4. **Next phase:** Database design (`docs/architecture/05-database-design.md` or `docs/database/`).

---

## 19. Traceability to SRS

| SRS theme | Architecture coverage |
| --- | --- |
| Offline-first sales | §7.1, §10, Sync Engine doc |
| Multi-tenant | §9.4, ADR-003, Security doc |
| Event-sourced inventory | §9.3 |
| Plugin extensibility | §11, Plugin System doc |
| RBAC + audit | Security doc |
| Observability | §13 |
| Monorepo + stack | §5, ADR-001/002 |

---

## Document Control

| Version | Date | Notes |
| --- | --- | --- |
| 1.0.0 | 2026-07-15 | Initial system architecture baseline |
