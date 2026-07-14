#!/usr/bin/env bash
#
# Manual pre-migration snapshot of the production database.
# Supabase free tier has no managed backups — take one of these BEFORE any
# destructive or risky migration so you can restore if it goes wrong.
#
# Usage:
#   DIRECT_URL="postgresql://...pooler.supabase.com:5432/postgres" ./backend/scripts/db-backup.sh
#
# Requires the `pg_dump` client (PostgreSQL 17 recommended to match Supabase).
#
# Restore a dump with:
#   pg_restore --clean --if-exists --no-owner --no-privileges -d "$DIRECT_URL" <file.dump>

set -euo pipefail

: "${DIRECT_URL:?Set DIRECT_URL to the Supabase direct/session connection string (port 5432)}"

ts="$(date -u +%Y%m%d_%H%M%S)"
out="ats_backup_${ts}.dump"

echo "Dumping production database to ${out} ..."
PG_DUMP="${PG_DUMP:-$(command -v pg_dump)}"
"$PG_DUMP" --version
"$PG_DUMP" "$DIRECT_URL" --format=custom --no-owner --no-privileges --file "$out"
test -s "$out"

echo "Done. Wrote ${out} ($(du -h "$out" | cut -f1))."
echo "Store it off-site (do NOT commit it to the repo)."
echo "Restore with: pg_restore --clean --if-exists --no-owner --no-privileges -d \"\$DIRECT_URL\" ${out}"
