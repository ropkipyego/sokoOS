# SokoOS Development Report

**Date:** 2026-11-11  
**Branch:** `main` (working tree may contain uncommitted progress)  
**Scope:** Continue SaaS completion toward local integrated testing — not a rewrite.

## Architecture (verified)

| Layer | Stack | Notes |
|-------|--------|--------|
| API | NestJS modular monolith | `services/api` — JWT auth, permission guards, Prisma |
| DB | PostgreSQL + Prisma | Shared DB multi-tenant (ADR-003); Redis for cache/queues where configured |
| Admin | Vite + React `:5175` | Tenant app + `/platform` console (`PlatformShell`) |
| POS | Vite + React `:5174` | Offline outbox + SyncWorker |
| Public | Vite `:5176` | Self-registration surface |
| Packages | `@sokoos/*` | types, database, ui, sync-protocol, shared |

**SaaS control plane (implemented):** registration → approval → idempotent provisioning → hashed invitation → activation; domains (`TenantDomain` / resolve-host); plans/subscriptions/entitlements; support; email outbox; platform console modules.

## Phase status

| Phase | Status | Evidence |
|-------|--------|----------|
| A — Audit + build baseline | **Green** | API `tsc` OK; admin/POS `--noEmit` OK; API vitest **69 passed** (16 files); turbo concurrency fixed |
| B — SaaS onboarding gaps | **Advanced** | `POST /users/invite` + Admin UI; role-scope hardening; platform perms blocked on tenant roles |
| C — Platform + tenant admin | Largely present | Screens wired to real APIs; polish remaining on UX/empty states |
| D — POS + industry | Advanced | Offline sale → SyncEnvelope aligned; device register idempotent; pending queue visible |
| E — Offline + isolation | Advanced | SyncWorker only acks `acceptedChangeIds`; isolation unit tests (7); HTTP E2E still needed |
| F — Infra + integrated E2E | **Blocked** | Docker socket / Postgres / Redis not reachable here — start compose locally then run Phase F |

## Changes in this pass

### Security / onboarding
- `POST /v1/users/invite` — creates `invited` user + hashed `TenantInvitation`, emails one-time activation link (never emails a permanent password).
- Admin Employees page uses invite flow instead of temp-password create.
- `assignRole` + role list/get: tenant-scoped only; `isTenantAssignableRole()` rejects platform / cross-tenant roles.
- Tenant roles cannot receive `platform.*` permissions; cannot create `platform_*` role keys.
- Template `employee.invitation` added.
- `turbo.json` `"concurrency": "16"` (**string** required by Turbo 2.10) + `package.json` scripts use `--concurrency=16` — fixes invalid task configuration (11 persistent tasks > default 10).

### Offline sync (critical fix)
- POS previously posted `{ deviceId, items }` — **not** a valid `SyncEnvelope` (would 422 forever).
- Now builds protocol v1 envelope; UUID change/entity ids; sale-only outbox (avoids double stock deduct).
- Ack only removes `acceptedChangeIds`; conflicts retain `lastError` and stay queued.
- Login registers/reuses POS device (`POST /auth/devices/register` now idempotent).
- Offline checkout uses session branch/warehouse (no hardcoded branch).
- Sync pill shows queued depth (pending / offline / error / synced).

### Tests
- Expanded `services/api/test/tenant-isolation.test.ts` for role-scope and JWT-authoritative tenant id.
- POS: offline sale + `buildSyncEnvelope` unit tests.

## Local startup (dev DB only)

**Root cause of “Failed to fetch”:** Admin/POS were up, but `@sokoos/api` had **no `dev` script**, so `npm run dev` never started the API. Fixed: `"dev": "nest start --watch"` on the API package.

```bash
# Terminal A — infra (Postgres must be on :5432)
docker compose up -d postgres redis

# Terminal B — API (required for login / any data)
./scripts/fix-stack.sh
# or: npm run stack:api

# Terminal C — frontends (or restart after API package got a `dev` script)
npm run dev
```

**URLs:** Admin `http://127.0.0.1:5175` · POS `http://127.0.0.1:5174` · API `http://127.0.0.1:3001/v1`  
**Health check:** `curl -s http://127.0.0.1:3001/v1/health/live`

Do not use production `DATABASE_URL`, JWT secrets, SMTP, or payment credentials in local runs.

## Tests executed (this pass)

| Check | Result |
|-------|--------|
| `services/api` `tsc -p tsconfig.build.json` | Pass |
| `@sokoos/admin-dashboard` `tsc --noEmit` | Pass |
| `@sokoos/desktop-pos` `tsc --noEmit` | Pass |
| API vitest (full suite) | **69 passed / 16 files** |
| POS unit tests | **3 passed** |
| Docker Compose / Postgres / Redis | **Unavailable** (no docker.sock; DB/Redis TCP closed) |
| Live API `/health` | Down (expected without DB) |

## Verified gaps (still open)

1. Full HTTP cross-tenant denial suite (tenant A token → tenant B resources).
2. End-to-end sequence: platform approve → provision → activate → product → stock → POS sale → return → offline sync.
3. Local Docker/Postgres/Redis must be started before Phase F can execute.
4. Payment providers: M-Pesa/card must remain non-simulated for live providers; sandbox config documented separately.
5. TLS/custom DNS not claimed operational unless configured and tested.
6. Users `POST /users` with password still exists for backwards compatibility — prefer invite in UI.
7. Industry workflows (hotel/restaurant/pharmacy) need workflow-level verification against shared sales/inventory core.

## Security findings

| Finding | Severity | Status |
|---------|----------|--------|
| Platform roles assignable via `OR: [{tenantId: null}]` | High | **Fixed** this pass |
| Employee create emailed/used permanent password UX | Medium | **Mitigated** via invite + hashed token |
| Isolation tests mostly unit-level | Medium | Expanded unit tests; HTTP E2E still required |
| Invitation tokens stored hashed | — | Confirmed (sha256) |

## Next priorities

1. Run API tests + typecheck/build after invite changes; bring up local stack.
2. Add HTTP isolation tests against seeded two-tenant fixtures.
3. Execute Phase F E2E checklist and record pass/fail evidence.
4. Harden POS offline: pending/syncing/synced/failed visibility under network interrupt.
5. Document external provider env vars without committing secrets.

## Production readiness

**Not claimed.** Packages build and critical unit tests are necessary but not sufficient. Claim readiness only after Phase F evidence and passing isolation HTTP tests.
