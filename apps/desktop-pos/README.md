# SokoOS Desktop POS

Vite + React 19 one-screen checkout for SokoOS (`@sokoos/desktop-pos`).

Runs as a standalone web app. An Electron main-process stub lives in `electron/main.ts` for future packaging.

## Layout (mandatory)

One screen — no nested checkout menus:

- **Left:** search, categories, product grid
- **Right:** cart, totals, payment tenders, complete sale / receipt

Shortcuts (shown in the top bar): **F2** focus search · **F9** pay.

## Offline-first sale flow

1. Cashier completes sale locally via `LocalDb.completeSale`
2. Adapter writes **sale + stock movements + outbox** in one local commit
3. `SyncWorker.enqueueFlush()` posts to `/v1/sync/push` in the background
4. Checkout never waits on the network

Adapters:

- `MemoryLocalDb` — in-memory + localStorage durability (default demo)
- `SqliteLocalDb` — stub implementing the same `LocalDb` interface

## Run (web)

```bash
pnpm install
pnpm --filter @sokoos/ui build
pnpm --filter @sokoos/desktop-pos dev
```

Open [http://localhost:5174](http://localhost:5174).

## Environment

```bash
VITE_API_URL=http://localhost:3000/v1
```

## Electron stub

```bash
pnpm --filter @sokoos/desktop-pos build
# Compile/adapt electron/main.ts, then launch with Electron against dist/
```

## Scripts

```bash
pnpm --filter @sokoos/desktop-pos typecheck
pnpm --filter @sokoos/desktop-pos build
pnpm --filter @sokoos/desktop-pos test
```
