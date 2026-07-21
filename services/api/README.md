# @sokoos/api

NestJS modular monolith for SokoOS cloud REST (`/v1`) + sync.

## Run

```bash
# from repo root
pnpm install
pnpm --filter @sokoos/database build
pnpm --filter @sokoos/api typecheck
pnpm --filter @sokoos/api test

# with Postgres up (see docker-compose / .env)
pnpm --filter @sokoos/database db:push
pnpm --filter @sokoos/api seed
pnpm --filter @sokoos/api start:dev
```

Docker (from monorepo root):

```bash
docker build -t sokoos-api .
# or: docker compose --profile api up -d --build api
```

- Health: `GET /health/live`, `GET /health/ready`
- API: `http://localhost:3000/v1/...`
- Demo login: `demo@sokoos.local` / `Demo123!`
- OpenAPI: `openapi/openapi.yaml`
- Modules include Auth, Catalog, Inventory, Sales, **Returns**, Sync, Purchases, Expenses, Reports, Notifications
