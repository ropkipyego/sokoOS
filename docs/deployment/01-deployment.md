# SokoOS — Deployment Guide

| Field | Value |
| --- | --- |
| **Document ID** | SOKO-DEP-001 |
| **Version** | 1.0.0 |
| **Status** | Complete |

---

## 1. Local stack with Docker Compose

From the repo root:

```bash
cp .env.example .env
docker compose up -d postgres redis          # data plane
# optional object storage
docker compose --profile storage up -d minio
# optional: build & run the API image
docker compose --profile api up -d --build api
```

| Service | Default URL / port | Profile |
| --- | --- | --- |
| PostgreSQL 16 | `localhost:5432` | default |
| Redis 7 | `localhost:6379` | default |
| API | `http://localhost:3000` | `api` |
| MinIO | `localhost:9000` (console `:9001`) | `storage` |

Health (API): `GET /health/live`, `GET /health/ready` (body includes `{ postgres, redis }` — Postgres required for 200; Redis optional).

### Redis, BullMQ, and WebSockets

- **Redis** — used by BullMQ and reported on `/health/ready` as `redis: boolean`. Local demo works without Redis: omit `REDIS_URL` or leave Redis down (ready stays 200 if Postgres is up).
- **BullMQ** — registered only when `REDIS_URL` is set. Queues: `notifications` (create Notification rows), `sync-fanout` (post-sync placeholder). Sync/sales never hard-fail if Redis is unavailable; enqueue is best-effort after successful sync push.
- **WebSockets** — `SyncGateway` namespace `/sync` (Socket.IO). Authenticate with JWT in handshake `auth.token`; clients join a `tenant:{tenantId}` room and receive `sync.available` after accepted sync pushes.

### Build API image alone

```bash
# monorepo context (recommended)
docker build -t sokoos-api .
# equivalent path-discoverable Dockerfile
docker build -f services/api/Dockerfile -t sokoos-api .
```

Image is multi-stage Node 22 + pnpm; production CMD is `node dist/main.js`.

---

## 2. Environment variables

Copy `.env.example` → `.env`. Critical keys:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Prisma Postgres connection string |
| `REDIS_URL` | Redis for BullMQ queues + health probe (optional; omit to disable workers) |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | ≥32 chars each |
| `JWT_ACCESS_TTL` / `JWT_REFRESH_TTL` | e.g. `15m`, `30d` |
| `API_HOST` / `API_PORT` | Bind address (default `0.0.0.0:3000`) |
| `API_PUBLIC_URL` | Public base URL for clients |
| `CORS_ORIGINS` | Comma-separated admin + POS origins |
| `POSTGRES_*` / `REDIS_PORT` | Compose service wiring |
| `MINIO_*` | Optional object storage |

Never commit real secrets. Rotate JWT secrets before any shared environment.

---

## 3. Database migrate + seed

With Postgres healthy and `DATABASE_URL` set:

```bash
pnpm install
pnpm --filter @sokoos/database build
pnpm --filter @sokoos/database db:push    # or db:migrate in CI/prod
pnpm --filter @sokoos/api seed
```

Demo credentials (seed):

- Email: `demo@sokoos.local`
- Password: `Demo123!`
- Tenant slug: `demo`

---

## 4. Run API, Admin, and POS locally

```bash
# API (hot reload)
pnpm --filter @sokoos/api start:dev
# → http://localhost:3000/v1  |  OpenAPI: services/api/openapi/openapi.yaml

# Admin dashboard
pnpm --filter @sokoos/admin-dashboard dev
# → http://localhost:5173

# Desktop POS
pnpm --filter @sokoos/desktop-pos dev
# → http://localhost:5174
```

Ensure `CORS_ORIGINS` includes both Vite origins. Point admin/POS API clients at `API_PUBLIC_URL`.

---

## 5. CI overview

GitHub Actions workflow: [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml).

On every push / PR:

1. Checkout + setup pnpm (`10.33.3`) and Node (`.nvmrc` → 22)
2. `pnpm install --frozen-lockfile`
3. `pnpm typecheck`
4. `pnpm build`
5. `pnpm test`

No deploy job yet — promote images from a tagged build when environments exist. Add DB migration + smoke health checks before production cutover.

---

## 6. Production checklist (minimal)

- [ ] Strong unique JWT secrets and Postgres credentials  
- [ ] TLS termination in front of API  
- [ ] Managed Postgres + Redis with backups  
- [ ] Run migrations before rolling new API pods  
- [ ] Restrict `CORS_ORIGINS` to real admin/POS origins  
- [ ] Monitor `/health/ready` and sync lag metrics  
