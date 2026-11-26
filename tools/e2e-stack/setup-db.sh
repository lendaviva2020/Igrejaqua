#!/usr/bin/env bash
# Cria o banco isolado iq_e2e com o schema auth de teste e TODAS as migrations do projeto.
# Uso: PGHOST=/tmp PGPORT=54329 PGUSER=pgtest bash tools/e2e-stack/setup-db.sh
set -euo pipefail
DB=iq_e2e
HERE="$(cd "$(dirname "$0")" && pwd)"
psql -v ON_ERROR_STOP=1 -q -d postgres -c "drop database if exists $DB" -c "create database $DB"
psql -v ON_ERROR_STOP=1 -q -d $DB -f "$HERE/db-setup.sql"
for f in "$HERE"/../../supabase/migrations/*.sql; do psql -v ON_ERROR_STOP=1 -q -d $DB -f "$f" >/dev/null; done
echo "banco $DB pronto com $(ls "$HERE"/../../supabase/migrations/*.sql | wc -l) migrations"
