#!/usr/bin/env bash
# Restore a reliable local demo (does NOT wipe the database).
# Run in a second terminal while the API stays up.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> Ensure Postgres + Redis containers are running"
if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  docker start sokoos-postgres sokoos-redis >/dev/null 2>&1 || true
  docker compose up -d postgres redis >/dev/null 2>&1 || true
fi

echo "==> Wait for Postgres"
for i in $(seq 1 30); do
  if (echo >/dev/tcp/127.0.0.1/5432) >/dev/null 2>&1; then break; fi
  sleep 1
  if [[ $i -eq 30 ]]; then
    echo "Postgres not reachable. Start it first: docker start sokoos-postgres"
    exit 1
  fi
done

echo "==> Seed demo + platform users (safe upsert — does not delete client data)"
export DATABASE_URL="${DATABASE_URL:-postgresql://sokoos:sokoos@localhost:5432/sokoos?schema=public}"
pnpm --filter @sokoos/api seed

echo "==> Verify login"
demo="$(curl -sS -o /tmp/soko-demo-login.json -w '%{http_code}' \
  -X POST http://127.0.0.1:3001/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"demo@sokoos.local","password":"Demo123!","tenantSlug":"demo"}')"
plat="$(curl -sS -o /tmp/soko-plat-login.json -w '%{http_code}' \
  -X POST http://127.0.0.1:3001/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"platform@sokoos.local","password":"Platform123!"}')"

echo "Demo login HTTP $demo"
echo "Platform login HTTP $plat"

# Nest often returns 201 Created for login — treat 2xx as success
ok_demo=0
ok_plat=0
[[ "$demo" == 2* ]] && ok_demo=1
[[ "$plat" == 2* ]] && ok_plat=1
if [[ "$ok_demo" -ne 1 || "$ok_plat" -ne 1 ]]; then
  echo "Login verify failed — is the API running? ./scripts/start-api-only.sh"
  cat /tmp/soko-demo-login.json 2>/dev/null || true
  exit 1
fi
echo "Login OK — demo and platform accounts work."

cat <<'EOF'

Demo is ready. Keep API terminal open.

  Admin:    http://127.0.0.1:5175
  POS:      http://127.0.0.1:5174
  Register: http://127.0.0.1:5176  (business self-registration)

  Tenant login:   demo / demo@sokoos.local / Demo123!
  Platform login: (leave tenant blank) platform@sokoos.local / Platform123!

Client account creation:
  1) Client registers at :5176  OR  you create them in Platform → Clients/Onboarding
  2) Platform approves + provisions
  3) Client activates via email invitation link (/activate)
  They cannot skip approval — that is intentional for SaaS control.

EOF
