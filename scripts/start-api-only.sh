#!/usr/bin/env bash
# Start only the API with a clean compiled build (Nest needs emitDecoratorMetadata).
# Do NOT use tsx for Nest bootstrap — DI breaks (ConfigService undefined).
set -euo pipefail
cd "$(dirname "$0")/.."

export DATABASE_URL="${DATABASE_URL:-postgresql://sokoos:sokoos@localhost:5432/sokoos?schema=public}"
export REDIS_URL="${REDIS_URL:-redis://localhost:6379}"
export API_PORT="${API_PORT:-3001}"
export API_HOST="${API_HOST:-0.0.0.0}"
export API_PUBLIC_URL="${API_PUBLIC_URL:-http://127.0.0.1:3001}"
export CORS_ORIGINS="${CORS_ORIGINS:-http://localhost:5173,http://localhost:5174,http://localhost:5175,http://127.0.0.1:5174,http://127.0.0.1:5175,http://192.168.1.157:5174,http://192.168.1.157:5175}"
export UPLOAD_ROOT="${UPLOAD_ROOT:-$PWD/services/api/uploads}"

if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  docker start sokoos-postgres sokoos-redis >/dev/null 2>&1 || true
fi

echo "==> Waiting for Postgres"
for i in $(seq 1 30); do
  if (echo >/dev/tcp/127.0.0.1/5432) >/dev/null 2>&1; then break; fi
  sleep 1
  if [[ $i -eq 30 ]]; then
    echo "Postgres down. Run: docker start sokoos-postgres"
    exit 1
  fi
done

cd services/api
rm -rf dist *.tsbuildinfo
pnpm exec tsc -p tsconfig.build.json
test -f dist/main.js

fuser -k "${API_PORT}/tcp" 2>/dev/null || true
sleep 1
echo "API starting on :${API_PORT} (keep this terminal open)"
exec node dist/main.js
