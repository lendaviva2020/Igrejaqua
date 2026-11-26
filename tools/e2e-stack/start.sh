#!/usr/bin/env bash
# Sobe o ambiente isolado: banco iq_e2e (20 migrations) + PostgREST real + gateway com login de teste + dados de teste.
# Uso: PGHOST=/tmp PGPORT=54329 PGUSER=pgtest bash tools/e2e-stack/start.sh     (precisa de /tmp/stack/bin/postgrest)
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
pkill -f "tools/e2e-stack/server.ts" || true
pkill -f "bin/postgrest" || true
sleep 1
bash "$HERE/setup-db.sh"
(cd /tmp/stack && setsid nohup ./bin/postgrest postgrest.conf > postgrest.log 2>&1 < /dev/null &)
(cd "$HERE/../.." && setsid nohup node --experimental-strip-types tools/e2e-stack/server.ts > /tmp/stack/gateway.log 2>&1 < /dev/null &)
for _ in $(seq 1 30); do curl -sf http://127.0.0.1:54400/health >/dev/null && break; sleep 0.5; done
(cd "$HERE/../.." && node --experimental-strip-types tools/e2e-stack/seed.ts)
