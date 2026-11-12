#!/usr/bin/env bash
# Start SokoOS API against local Postgres/Redis (dev only).
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT="$PWD"

export DATABASE_URL="${DATABASE_URL:-postgresql://sokoos:sokoos@localhost:5432/sokoos?schema=public}"
export REDIS_URL="${REDIS_URL:-redis://localhost:6379}"
export API_PORT="${API_PORT:-3001}"
export API_HOST="${API_HOST:-0.0.0.0}"
export API_PUBLIC_URL="${API_PUBLIC_URL:-http://127.0.0.1:3001}"
export CORS_ORIGINS="${CORS_ORIGINS:-http://localhost:5173,http://localhost:5174,http://localhost:5175,http://127.0.0.1:5174,http://127.0.0.1:5175,http://192.168.1.157:5174,http://192.168.1.157:5175}"
export UPLOAD_ROOT="${UPLOAD_ROOT:-$ROOT/services/api/uploads}"

echo "==> Ensuring Postgres container"
if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  if docker ps -aq --filter 'name=^/sokoos-postgres$' | grep -q .; then
    docker start sokoos-postgres >/dev/null 2>&1 || true
  else
    docker compose up -d postgres redis >/dev/null 2>&1 || true
  fi
  docker start sokoos-redis >/dev/null 2>&1 || true
fi

echo "==> Checking Postgres :5432"
ok=0
for i in $(seq 1 30); do
  if (echo >/dev/tcp/127.0.0.1/5432) >/dev/null 2>&1; then
    ok=1
    break
  fi
  sleep 1
done
if [[ "$ok" -ne 1 ]]; then
  echo "Postgres is not reachable on localhost:5432"
  echo "Fix name conflict with: docker start sokoos-postgres"
  echo "Or recreate: docker rm -f sokoos-postgres && docker compose up -d postgres redis"
  exit 1
fi

echo "==> Prisma generate + schema sync (local DB only)"
cd "$ROOT/packages/database"
pnpm exec prisma generate
pnpm exec prisma db push
cd "$ROOT"

echo "==> Building API"
cd "$ROOT/services/api"
rm -rf dist *.tsbuildinfo
pnpm exec tsc -p tsconfig.build.json
if [[ ! -f dist/main.js ]]; then
  pnpm exec nest build
fi
test -f dist/main.js

# Free old listener if any
fuser -k "${API_PORT}/tcp" 2>/dev/null || true
sleep 1

echo "==> Starting API on :${API_PORT}"
exec node dist/main.js
