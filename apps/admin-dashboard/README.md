# SokoOS Admin Dashboard

Vite + React 19 + TypeScript admin console for SokoOS (`@sokoos/admin-dashboard`).

## Stack

- Vite, React 19, TypeScript
- Tailwind CSS v4
- TanStack Router + TanStack Query
- Zustand (auth, theme, demo data)
- `@sokoos/ui` tokens, Button, Input

## Routes

| Path | Purpose |
| --- | --- |
| `/login` | Brand-first sign-in |
| `/` | Sales summary dashboard |
| `/products` | Product list + create form |
| `/inventory` | Stock balances / low stock |
| `/sales` | Sales list |
| `/branches` | Branches |
| `/users` | Users |
| `/settings` | Theme + API base |

## Run

From the monorepo root:

```bash
pnpm install
pnpm --filter @sokoos/ui build
pnpm --filter @sokoos/admin-dashboard dev
```

Open [http://localhost:5173](http://localhost:5173).

## Environment

Copy `.env.example` if needed:

```bash
VITE_API_URL=http://localhost:3000/v1
```

Default API base is `http://localhost:3000/v1`. Login falls back to a local demo session when the API is unavailable.

## Auth note

Access tokens stay in memory. Refresh tokens are stored in `localStorage` for demo only — prefer httpOnly cookies in production.

## Scripts

```bash
pnpm --filter @sokoos/admin-dashboard typecheck
pnpm --filter @sokoos/admin-dashboard build
pnpm --filter @sokoos/admin-dashboard test
```
