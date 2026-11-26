#!/usr/bin/env bash
# Aplica shim + migrations num banco descartável e roda os testes SQL.
# Uso: PGHOST=/tmp PGPORT=54329 PGUSER=pgtest bash supabase/tests/run.sh
set -euo pipefail
DB=iq_test
HERE="$(cd "$(dirname "$0")" && pwd)"
psql -v ON_ERROR_STOP=1 -q -d postgres -c "drop database if exists $DB" -c "create database $DB"
psql -v ON_ERROR_STOP=1 -q -d $DB -f "$HERE/00_supabase_shim.sql"
for f in "$HERE"/../migrations/*.sql; do echo "== migration $(basename "$f")"; psql -v ON_ERROR_STOP=1 -q -d $DB -f "$f"; done
for f in "$HERE"/[1-9]*.sql; do echo "== teste $(basename "$f")"; psql -v ON_ERROR_STOP=1 -q -d $DB -f "$f"; done
echo "TODOS OS TESTES SQL PASSARAM"
