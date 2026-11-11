#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT="$PWD"

export DATABASE_URL="${DATABASE_URL:-postgresql://sokoos:sokoos@localhost:5432/sokoos?schema=public}"
export API_PORT=3001
export API_HOST=0.0.0.0
export API_PUBLIC_URL="${API_PUBLIC_URL:-http://127.0.0.1:3001}"
export CORS_ORIGINS="${CORS_ORIGINS:-http://localhost:5173,http://localhost:5174,http://localhost:5175,http://127.0.0.1:5174,http://127.0.0.1:5175}"
export UPLOAD_ROOT="${UPLOAD_ROOT:-$ROOT/services/api/uploads}"

echo "==> Prisma db push"
cd "$ROOT/packages/database"
pnpm exec prisma db push
pnpm exec prisma generate
cd "$ROOT"
pnpm --filter @sokoos/database build

echo "==> Seed Honeywell + sample images"
mkdir -p "$UPLOAD_ROOT/samples"
cd "$ROOT/services/api"
pnpm exec tsx src/seed/seed-honeywell.ts

echo "==> Rebuild API"
rm -f *.tsbuildinfo
pnpm exec tsc -p tsconfig.build.json
test -f dist/main.js

echo "==> Restart listeners"
fuser -k 3001/tcp 5174/tcp 5175/tcp 2>/dev/null || true
sleep 1

cd "$ROOT"
API_PORT=3001 API_HOST=0.0.0.0 API_PUBLIC_URL="$API_PUBLIC_URL" CORS_ORIGINS="$CORS_ORIGINS" UPLOAD_ROOT="$UPLOAD_ROOT" \
  pnpm --filter @sokoos/api start &
sleep 2
pnpm --filter @sokoos/desktop-pos exec vite --host 0.0.0.0 --port 5174 --strictPort &
pnpm --filter @sokoos/admin-dashboard exec vite --host 0.0.0.0 --port 5175 --strictPort &
sleep 3

echo "==> Health"
curl -sf http://127.0.0.1:3001/health/live || curl -sf http://127.0.0.1:3001/v1/health/live || true
echo
echo "Demo ready."
echo "  Admin: http://127.0.0.1:5175"
echo "  POS:   http://127.0.0.1:5174"
echo "  API:   http://127.0.0.1:3001/v1"
echo "  Honeywell login: tenant=honeywell / owner@honeywell.demo / Honeywell123!"
