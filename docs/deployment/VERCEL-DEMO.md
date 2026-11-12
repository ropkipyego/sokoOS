# SokoOS — Vercel demo hosting

Use this for **client demos** while the product is still being built.  
This is **not** a full production cutover.

## Decision (one project, path routing)

| Path | Service | Runtime |
| --- | --- | --- |
| `/` | `admin-dashboard` | Vite static |
| `/pos` | `desktop-pos` | Vite static |
| `/register` | `public-web` | Vite static |
| `/v1/*`, `/health/*` | `api` | Container (`Dockerfile`) |

Configured in the **repo-root** [`vercel.json`](../../vercel.json) with Vercel **Services**.

**Why this shape**

- One shareable demo URL (no three project URLs to juggle).
- Browser SPAs call same-origin `/v1` — no `VITE_API_URL` required for demos.
- Nest needs a long-running process → **container**, not a serverless function.
- **No service bindings** for Vite→API: bindings are runtime-only for functions; the browser cannot use them.

You still need **Postgres** (and Redis if you use queues) reachable from the API container via env vars.

## 1) Create one Vercel project

1. Import this monorepo at the **repository root** (so root `vercel.json` applies).
2. Enable **Services** for the project if prompted (beta).
3. Set API container env (Production + Preview as needed):

```bash
NODE_ENV=production
DATABASE_URL=postgresql://...
REDIS_URL=redis://...                 # optional for light demos
JWT_ACCESS_SECRET=...                 # ≥32 chars
JWT_REFRESH_SECRET=...                # ≥32 chars
API_HOST=0.0.0.0
# PORT is usually injected by the platform; API_PORT optional override
API_PUBLIC_URL=https://YOUR-PROJECT.vercel.app
CORS_ORIGINS=https://YOUR-PROJECT.vercel.app
SOKOOS_PUBLIC_APP_URL=https://YOUR-PROJECT.vercel.app
```

4. After the first deploy that can reach the DB:

```bash
# from a machine with DATABASE_URL pointed at the same DB
pnpm --filter @sokoos/database exec prisma db push
pnpm --filter @sokoos/api seed
```

Health:

- `GET https://YOUR-PROJECT.vercel.app/health/live`
- `GET https://YOUR-PROJECT.vercel.app/v1/...`

Vite builds default to `VITE_API_URL=/v1` in production. Only set `VITE_API_URL` if the API is hosted elsewhere.

### Fallback: API not on Vercel

If the container runtime is unavailable or too heavy for your plan, host Nest on Railway/Render/Fly and either:

- Keep the three SPA services + path rewrites, and set `VITE_API_URL=https://YOUR-API-HOST/v1` on the Vite builds, **or**
- Proxy `/v1` to that external host if your Vercel plan supports it.

## 2) Public URLs after deploy

| Surface | URL |
| --- | --- |
| Admin | `https://YOUR-PROJECT.vercel.app/` |
| POS | `https://YOUR-PROJECT.vercel.app/pos` |
| Register / marketing | `https://YOUR-PROJECT.vercel.app/register` |
| API | `https://YOUR-PROJECT.vercel.app/v1` |

## 3) Demo logins (after API seed)

| Role | How |
| --- | --- |
| Tenant demo | Tenant `demo` · `demo@sokoos.local` · `Demo123!` |
| Platform | Leave tenant blank · `platform@sokoos.local` · `Platform123!` |
| New client | Register under `/register` → approve/provision in platform → they activate |

## 4) Client demo checklist

1. `/health/live` returns OK.
2. Admin login works on `/`.
3. POS login works on `/pos`.
4. Create a **client-specific tenant** via platform (do not share the `demo` tenant with prospects).
5. Do not promise production SLAs, custom domains, or live M-Pesa until those are configured and tested.

## 5) Important limits

- Offline POS sync still needs a reachable API; browser offline only covers local outbox until sync.
- File uploads need durable object storage for anything serious.
- Email invitations need a real `MAIL_PROVIDER` / SMTP, or show the activation token from the platform UI in demos.
- Custom tenant subdomains need DNS + TLS beyond this demo layout.

## Quick “demo today” path

1. Deploy this repo as **one** Vercel project (root `vercel.json`).
2. Wire `DATABASE_URL` (+ secrets) on the `api` service; migrate + seed.
3. Share `https://YOUR-PROJECT.vercel.app/` (and `/pos`, `/register` as needed).

## Login not working on Vercel

The admin SPA talking to `/v1` is fine. Login fails when the **API container** cannot serve or has no users.

1. **Port** — Nest must listen on Vercel’s container port (`PORT`, default **80**). Do **not** set `API_PORT=3001` on Vercel unless you also set `PORT` to the same value.
2. **Env on the `api` service** (required):
   - `DATABASE_URL` → reachable Postgres (Neon/Supabase/Railway/etc.)
   - `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` (≥32 chars)
3. **Schema + seed** (against that same `DATABASE_URL`):

```bash
pnpm --filter @sokoos/database exec prisma db push
pnpm --filter @sokoos/api seed
```

4. **Smoke checks**
   - `GET https://YOUR-PROJECT.vercel.app/health/live` → OK
   - `POST https://YOUR-PROJECT.vercel.app/v1/auth/login` with demo credentials → 201

Build log noise that is **safe to ignore**: Prisma schema postinstall on Vite services, Vite chunk size, `HEALTHCHECK` OCI warning.

If `/health/live` is 502, the container is not listening on the routed port — redeploy after the PORT fix. If health is OK but login fails with invalid credentials, the DB is empty — run seed.
