# SokoOS — Vercel demo hosting

Use this for **client demos** while the product is still being built.  
This is **not** a full production cutover.

## What goes where

| Surface | Host | Why |
| --- | --- | --- |
| Admin dashboard | **Vercel** | Static Vite SPA |
| POS | **Vercel** | Static Vite SPA |
| Public registration site | **Vercel** | Static Vite SPA |
| Nest API + Postgres + Redis | **Not Vercel** | Long-running Node, Prisma, Redis/BullMQ, Socket.IO |

Put the API on **Railway**, **Render**, or **Fly.io** (or keep a small VPS). Point the Vercel apps at that API URL.

## 1) Host the API (required first)

Minimum env on the API host:

```bash
NODE_ENV=production
DATABASE_URL=postgresql://...
REDIS_URL=redis://...          # optional for light demos
JWT_ACCESS_SECRET=...          # ≥32 chars
JWT_REFRESH_SECRET=...         # ≥32 chars
API_HOST=0.0.0.0
API_PORT=3001
API_PUBLIC_URL=https://YOUR-API-HOST
CORS_ORIGINS=https://admin-xxx.vercel.app,https://pos-xxx.vercel.app,https://web-xxx.vercel.app
SOKOOS_PUBLIC_APP_URL=https://admin-xxx.vercel.app
```

Then migrate/seed:

```bash
pnpm --filter @sokoos/database exec prisma db push
pnpm --filter @sokoos/api seed
```

Health checks:

- `GET https://YOUR-API-HOST/health/live`
- `GET https://YOUR-API-HOST/health/ready`

`*.vercel.app` origins are allowed by the API CORS helper for demos. Still set `CORS_ORIGINS` to your exact project URLs when you have them.

## 2) Deploy three Vercel projects from this monorepo

Create **three** Vercel projects, all linked to the same Git repo, with different root directories:

### Admin

- **Root directory:** `apps/admin-dashboard`
- **Framework:** Vite (auto from `vercel.json`)
- **Env:**
  - `VITE_API_URL=https://YOUR-API-HOST/v1`

### POS

- **Root directory:** `apps/desktop-pos`
- **Env:**
  - `VITE_API_URL=https://YOUR-API-HOST/v1`

### Public web (registration / marketing)

- **Root directory:** `apps/public-web`
- **Env:**
  - `VITE_API_URL=https://YOUR-API-HOST/v1`
  - `VITE_ADMIN_URL=https://YOUR-ADMIN.vercel.app`
  - `VITE_PLATFORM_URL=https://YOUR-ADMIN.vercel.app/platform`

Each app already has a `vercel.json` with monorepo install/build and SPA rewrites.

### CLI alternative

```bash
# from repo root, after vercel login
cd apps/admin-dashboard && vercel --yes
cd ../desktop-pos && vercel --yes
cd ../public-web && vercel --yes
```

Set the `VITE_*` env vars in the Vercel dashboard (Production + Preview), then redeploy.

## 3) Demo logins (after API seed)

| Role | How |
| --- | --- |
| Tenant demo | Tenant `demo` · `demo@sokoos.local` · `Demo123!` |
| Platform | Leave tenant blank · `platform@sokoos.local` · `Platform123!` |
| New client | Register on public-web → you approve/provision in platform → they activate |

## 4) Client demo checklist

1. API health returns OK.
2. Admin login works from the Vercel URL.
3. POS login works from the Vercel URL.
4. Create a **client-specific tenant** via platform (do not share the `demo` tenant with prospects).
5. Do not promise production SLAs, custom domains, or live M-Pesa until those are configured and tested.

## 5) Important limits for this setup

- Offline POS sync still needs a reachable API; browser offline only covers local outbox until sync.
- File uploads need durable storage (local disk on a single API instance is fragile — use object storage for anything serious).
- Email invitations need a real `MAIL_PROVIDER` / SMTP in the API env, or show the one-time activation token from the platform UI in demos.
- Custom tenant subdomains (`client.sokoos.com`) need DNS + TLS — not provided by Vercel static apps alone.

## Quick “demo today” path

1. Deploy API to Railway/Render with Postgres.
2. Seed demo + create the client tenant.
3. Deploy admin + POS + public-web to Vercel with `VITE_API_URL`.
4. Share the admin URL + that client’s invite/activation link.
