#!/bin/bash
# ──────────────────────────────────────────────────────
#  Greenway Golf — PostgreSQL Restore Script
#  Usage:  ./scripts/restore-db.sh /path/to/backup.sql.gz
# ──────────────────────────────────────────────────────

set -e

if [ -z "$1" ]; then
  echo "Usage: $0 <backup_file.sql.gz>"
  exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "$BACKUP_FILE" ]; then
  echo "Error: File not found: $BACKUP_FILE"
  exit 1
fi

# Load env
if [ -f "$(dirname "$0")/../.env" ]; then
  source "$(dirname "$0")/../.env"
fi

DB_NAME="${DB_NAME:-greenway_db}"
DB_USER="${DB_USER:-greenway}"

echo "==> WARNING: This will REPLACE all data in '$DB_NAME'."
read -p "    Type 'yes' to continue: " confirm
if [ "$confirm" != "yes" ]; then
  echo "Aborted."
  exit 0
fi

echo "==> Restoring from: $BACKUP_FILE"

# Drop and recreate database
docker compose exec -T db psql -U "$DB_USER" -c "DROP DATABASE IF EXISTS ${DB_NAME};"
docker compose exec -T db psql -U "$DB_USER" -c "CREATE DATABASE ${DB_NAME};"

# Restore
gunzip -c "$BACKUP_FILE" | docker compose exec -T db psql -U "$DB_USER" -d "$DB_NAME"

echo "==> Restore complete!"
