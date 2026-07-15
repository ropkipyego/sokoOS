# SokoOS Documentation

Africa's Offline-First Commerce Platform.

## Development Order (Mandatory)

Do not skip phases. Implementation of business modules begins only after Architecture, Database, API, and UI Design System baselines exist.

| Phase | Document | Status |
| --- | --- | --- |
| 1 | [Software Requirements Specification](./requirements/01-software-requirements-specification.md) | **Complete (v1.0.0)** |
| 2 | [System Architecture](./architecture/README.md) | **Complete (v1.0.0)** |
| 3 | Database Design | Next |
| 4 | API Design (OpenAPI) | Pending |
| 5 | UI Design System | Pending |
| 6 | Authentication | Pending |
| 7 | Tenant Management | Pending |
| 8 | Branch Management | Pending |
| 9 | Permissions (RBAC) | Pending |
| 10 | Synchronization Engine | Pending |
| 11 | Inventory | Pending |
| 12 | Products | Pending |
| 13 | Sales | Pending |
| 14 | Customers | Pending |
| 15 | Suppliers | Pending |
| 16 | Purchases | Pending |
| 17 | Expenses | Pending |
| 18 | Reports | Pending |
| 19 | Notifications | Pending |
| 20 | Plugins | Pending |
| 21 | AI | Pending |
| 22 | Deployment | Pending |
| 23 | Testing | Pending |
| 24 | Module Documentation | Pending |

## Folder Layout

```
docs/
  requirements/     # SRS and requirement addenda
  architecture/     # ADRs and system architecture
  modules/          # Per-module documentation (after implementation phases)
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
