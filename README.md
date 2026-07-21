# SokoOS

**Africa's Offline-First Commerce Platform**

SokoOS is a commercial-grade, multi-tenant commerce operating system for African businesses. It keeps selling, inventory, and daily operations running without internet, then synchronizes to the cloud automatically.

## Status

| Phase | Status |
| --- | --- |
| Software Requirements Specification | Complete — [`docs/requirements/…`](./docs/requirements/01-software-requirements-specification.md) |
| Architecture | Complete — [`docs/architecture/`](./docs/architecture/README.md) |
| Database Design | Complete — [`docs/database/`](./docs/database/01-database-design.md) |
| Platform foundation | In progress — pnpm + Turborepo packages under `packages/` |

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
  admin-dashboard/     # Vite React 19 (scaffold later)
  desktop-pos/         # Vite React + Electron-ready (scaffold later)
services/
  api/                 # Modular NestJS monolith (scaffold later)
plugins/               # First-party industry plugins
packages/
  types/               # Zod schemas + shared domain types
  sync-protocol/       # Envelope helpers, conflict codes, versioning
  utils/               # uuidv7, money (minor units), tenant asserts
  shared/              # Result, AppError, system roles
  plugin-sdk/          # PluginManifest + registration contracts
  database/            # Prisma (Postgres) + SQLite POS schema
  ui/                  # Minimal design system (Button, Input, tokens)
docs/
```

### Quick start

```bash
pnpm install
cp .env.example .env
docker compose up -d postgres redis   # optional: --profile storage for MinIO
pnpm build
```

Logical service boundaries (auth, sales, inventory, sync, reporting, notifications) live as modules inside `services/api` until extraction is justified.

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
