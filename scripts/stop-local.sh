#!/usr/bin/env bash
# Stop the local app (keeps DB containers running; pass --services to stop those too)
cd "$(dirname "$0")/.."
PIDS=$(lsof -t -nP -iTCP:"${PORT:-3001}" -sTCP:LISTEN 2>/dev/null || true)
[ -n "$PIDS" ] && kill $PIDS && echo "stopped app on :${PORT:-3001}"
if [ "${1:-}" = "--services" ]; then
  docker --context colima stop starpath-postgres starpath-redis 2>/dev/null || true
  echo "stopped postgres + redis containers"
fi
