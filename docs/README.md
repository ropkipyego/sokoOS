# SokoOS Documentation

Africa's Offline-First Commerce Platform.

## Development Order (Mandatory)

Do not skip phases. Implementation of business modules begins only after Architecture, Database, API, and UI Design System baselines exist.

| Phase | Document | Status |
| --- | --- | --- |
| 1 | [Software Requirements Specification](./requirements/01-software-requirements-specification.md) | **Complete (v1.0.0)** |
| 2 | [System Architecture](./architecture/README.md) | **Complete (v1.0.0)** |
| 3 | [Database Design](./database/README.md) | **Complete (v1.0.0)** |
| 4 | [API Design (OpenAPI)](./api/README.md) | **Complete (v1.0.0)** |
| 5 | [UI Design System](./design-system/README.md) | **Complete (v1.0.0)** |
| 6 | Authentication | **Implemented (API)** — [modules/auth.md](./modules/auth.md) |
| 7 | Tenant Management | **Implemented (API)** |
| 8 | Branch Management | **Implemented (API)** |
| 9 | Permissions (RBAC) | **Implemented (API)** |
| 10 | Synchronization Engine | **Implemented (API)** — [modules/sync.md](./modules/sync.md) |
| 11 | Inventory | **Implemented (API)** — [modules/inventory.md](./modules/inventory.md) |
| 12 | Products | **Implemented (API catalog)** |
| 13 | Sales (+ Returns) | **Implemented (API)** — [modules/sales.md](./modules/sales.md) |
| 14 | Customers | **Implemented (API)** |
| 15 | Suppliers | **Implemented (API)** |
| 16 | Purchases | **Implemented (API)** |
| 17 | Expenses | **Implemented (API)** |
| 18 | Reports | **Implemented (API)** |
| 19 | Notifications | **Implemented (API)** |
| 20 | Plugins | **Contracts + pharmacy stub** — `@sokoos/plugin-sdk`, [`plugins/pharmacy`](../plugins/pharmacy) |
| 21 | AI | **Deferred** — [ai/01-ai-roadmap.md](./ai/01-ai-roadmap.md) |
| 22 | Deployment | **Complete** — [deployment/01-deployment.md](./deployment/01-deployment.md) |
| 23 | Testing | **Complete** — [testing/01-testing-strategy.md](./testing/01-testing-strategy.md) |
| 24 | Module Documentation | **In progress** — auth, sync, inventory, sales (+ returns) |

## Folder Layout

```
docs/
  requirements/     # SRS and requirement addenda
  architecture/     # ADRs and system architecture
  database/         # PostgreSQL + SQLite design
  api/              # OpenAPI-oriented API design
  design-system/    # UI tokens, POS/admin patterns
  modules/          # Per-module documentation
  deployment/       # Local/prod runbooks
  testing/          # QA strategy mapped to REQ-QA-*
  ai/               # Deferred AI roadmap
```

## Module Documentation Standard

Every implemented module must document:

1. Purpose  
2. Architecture  
3. Database  
4. API  
5. UI  
6. Business Rules  
7. Testing  
8. Security  
9. Future Improvements  

## Core Principles

1. Offline First  
2. Cloud Sync  
3. Multi Tenant  
4. Multi Branch  
5. Modular (plugins)  
6. Secure (audited)  
7. Fast  
8. Clean Architecture  
9. Simplicity (< 30 min cashier training)  
10. Extensible without core rewrites  
