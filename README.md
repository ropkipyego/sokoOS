# SokoOS

**Africa's Offline-First Commerce Platform**

SokoOS is a commercial-grade, multi-tenant commerce operating system for African businesses. It keeps selling, inventory, and daily operations running without internet, then synchronizes to the cloud automatically.

## Status

| Phase | Status |
| --- | --- |
| Software Requirements Specification | Complete — [`docs/requirements/…`](./docs/requirements/01-software-requirements-specification.md) |
| Architecture | Complete — [`docs/architecture/`](./docs/architecture/README.md) |
| Database Design | Complete — [`docs/database/`](./docs/database/01-database-design.md) + Prisma schemas in [`packages/database`](./packages/database) |
| API Design | Complete — [`docs/api/`](./docs/api/README.md); NestJS API under [`services/api`](./services/api) |
| UI Design System | Complete — [`docs/design-system/`](./docs/design-system/README.md) + [`packages/ui`](./packages/ui) |
| Platform / business modules | Auth → Notifications implemented in API; Returns included |
| Plugins | SDK contracts + [`plugins/pharmacy`](./plugins/pharmacy) stub |
| AI | Deferred — [`docs/ai/01-ai-roadmap.md`](./docs/ai/01-ai-roadmap.md) |
| Deployment / Testing docs | Complete — [`docs/deployment/`](./docs/deployment/01-deployment.md), [`docs/testing/`](./docs/testing/01-testing-strategy.md) |
| Admin dashboard | Scaffolded — [`apps/admin-dashboard`](./apps/admin-dashboard) |
| Desktop POS | Scaffolded — [`apps/desktop-pos`](./apps/desktop-pos) |

## Who It Serves

Retail shops, supermarket, restaurants, hardware stores, pharmacies, electronics stores, bookshops, wholesale, agrovet, salons, beauty shops — with hotels and manufacturing planned via plugins.

## Core Principles

1. **Offline First** — business operations work without internet  
2. **Cloud Sync** — background synchronization when online  
3. **Multi Tenant / Multi Branch** — one platform, many businesses and locations  
4. **Modular Plugins** — industry features without rewriting core  
5. **Secure & Audited** — every action traceable  
6. **Fast & Simple** — cashiers productive in under 30 minutes  

## Monorepo Layout

```
apps/
  admin-dashboard/     # Vite React 19 admin console
  desktop-pos/         # Vite React POS (Electron-ready stub)
services/
  api/                 # Modular NestJS monolith
plugins/
  pharmacy/            # @sokoos/plugin-pharmacy stub
packages/
  types/               # Zod schemas + shared domain types
  sync-protocol/       # Envelope helpers, conflict codes, versioning
  utils/               # uuidv7, money (minor units), tenant asserts
  shared/              # Result, AppError, system roles
  plugin-sdk/          # PluginManifest + registration contracts
  database/            # Prisma (Postgres) + SQLite POS schema
  ui/                  # Design system (Button, Input, tokens)
docs/
```

## Quick start

```bash
pnpm install
cp .env.example .env

# Data plane
docker compose up -d postgres redis
# optional: docker compose --profile storage up -d minio
# optional API container: docker compose --profile api up -d --build api

pnpm build
pnpm --filter @sokoos/database db:push
pnpm --filter @sokoos/api seed

# API
pnpm --filter @sokoos/api start:dev          # http://localhost:3000

# Admin + POS
pnpm --filter @sokoos/admin-dashboard dev    # http://localhost:5173
pnpm --filter @sokoos/desktop-pos dev        # http://localhost:5174
```

Demo login (after seed): `demo@sokoos.local` / `Demo123!` (tenant `demo`).

Logical service boundaries (auth, sales, returns, inventory, sync, reporting, notifications) live as modules inside `services/api` until extraction is justified.

## Technology Stack (Target)

| Layer | Technologies |
| --- | --- |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS, TanStack Router/Query, Zustand, RHF, Zod, Electron, PWA |
| Backend | NestJS, PostgreSQL, Prisma, Redis, BullMQ, WebSockets |
| Local | SQLite (encrypted) |
| Infra | Docker, GitHub Actions, Object Storage, OpenAPI |

## Documentation

Start here: [`docs/README.md`](./docs/README.md)

## Development Order

SRS → Architecture → Database → API → UI Design System → Authentication → Tenant → Branch → Permissions → Sync → Inventory → Products → Sales → … → Deployment → Testing → Documentation

Do not implement business modules before the design phases above are complete.

## License

Proprietary — all rights reserved unless otherwise stated.
