#!/usr/bin/env bash
# One-shot local bring-up for SokoOS (run in YOUR machine terminal).
set -euo pipefail
cd "$(dirname "$0")/.."

ensure_container() {
  local name="$1"
  if ! command -v docker >/dev/null 2>&1; then
    echo "Docker not installed — ensure ${name} is already reachable."
    return 0
  fi
  if ! docker info >/dev/null 2>&1; then
    echo "Docker daemon unavailable — ensure ${name} is already reachable."
    return 0
  fi

  local id
  id="$(docker ps -aq --filter "name=^/${name}$" | head -n1 || true)"
  if [[ -n "$id" ]]; then
    local status
    status="$(docker inspect -f '{{.State.Status}}' "$id" 2>/dev/null || echo missing)"
    if [[ "$status" != "running" ]]; then
      echo "==> Starting existing container ${name} (${id})"
      docker start "$id" >/dev/null
    else
      echo "==> Container ${name} already running"
    fi
    return 0
  fi

  echo "==> No existing ${name}; compose will create it"
}

echo "==> 1) Postgres + Redis"
ensure_container sokoos-postgres
ensure_container sokoos-redis

# Prefer starting existing containers; compose only creates missing ones.
# Name conflicts happen when a container was created outside this compose project.
if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  set +e
  out="$(docker compose up -d postgres redis 2>&1)"
  code=$?
  set -e
  if [[ $code -ne 0 ]]; then
    if echo "$out" | grep -qi 'already in use'; then
      echo "Compose name conflict — reusing existing containers instead."
      docker start sokoos-postgres sokoos-redis >/dev/null 2>&1 || true
    else
      echo "$out"
      exit $code
    fi
  else
    echo "$out"
  fi
fi

echo "==> 2) Wait for Postgres :5432"
for i in $(seq 1 40); do
  if (echo >/dev/tcp/127.0.0.1/5432) >/dev/null 2>&1; then
    echo "Postgres is up"
    break
  fi
  sleep 1
  if [[ $i -eq 40 ]]; then
    echo "Postgres still not reachable on :5432"
    echo "Try: docker start sokoos-postgres && docker ps -a --filter name=sokoos-postgres"
    exit 1
  fi
done

echo "==> 3) API on :3001"
export DATABASE_URL="${DATABASE_URL:-postgresql://sokoos:sokoos@localhost:5432/sokoos?schema=public}"
export REDIS_URL="${REDIS_URL:-redis://localhost:6379}"
export API_PORT="${API_PORT:-3001}"
export API_HOST="${API_HOST:-0.0.0.0}"
export API_PUBLIC_URL="${API_PUBLIC_URL:-http://127.0.0.1:3001}"
export CORS_ORIGINS="${CORS_ORIGINS:-http://localhost:5173,http://localhost:5174,http://localhost:5175,http://127.0.0.1:5174,http://127.0.0.1:5175,http://192.168.1.157:5174,http://192.168.1.157:5175}"
export UPLOAD_ROOT="${UPLOAD_ROOT:-$PWD/services/api/uploads}"

cd packages/database
pnpm exec prisma generate
pnpm exec prisma db push
cd ../..

cd services/api
# Incremental dist can be stale/partial — always clean before emit
# (Nest DI requires tsc emitDecoratorMetadata — do not use tsx to boot Nest)
rm -rf dist tsconfig.build.tsbuildinfo *.tsbuildinfo
pnpm exec tsc -p tsconfig.build.json --incremental false
test -f dist/main.js
fuser -k "${API_PORT}/tcp" 2>/dev/null || true
sleep 1
echo "Starting API (keep this terminal open)…"
exec node dist/main.js
