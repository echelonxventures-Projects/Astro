#!/usr/bin/env bash
# Start the self-hosted stack (colima VM, Postgres/Redis, standalone app on loopback).
# Usage: scripts/run-local.sh [--lan]   (--lan binds 0.0.0.0 for phone/LAN testing)
set -euo pipefail
cd "$(dirname "$0")/.."

docker --context colima info >/dev/null 2>&1 || colima start
docker --context colima start starpath-postgres starpath-redis >/dev/null 2>&1 || true

if [ ! -f .next/standalone/server.js ]; then
  npm ci
  npx prisma migrate deploy
  npm run build
  rm -rf .next/standalone/public .next/standalone/.next/static
  cp -R public .next/standalone/public
  cp -R .next/static .next/standalone/.next/static
fi

set -a; source .env; set +a
export PORT="${PORT:-3001}"
export NEXTAUTH_URL="${NEXTAUTH_URL:-http://localhost:3001}"
export HOSTNAME="127.0.0.1"
[ "${1:-}" = "--lan" ] && export HOSTNAME="0.0.0.0"

cd .next/standalone
echo "→ http://${HOSTNAME}:${PORT} (tenants: *.localhost:${PORT})"
exec node server.js
