#!/bin/bash
# ──────────────────────────────────────────────────────
#  Greenway Golf — PostgreSQL Backup Script
#  Usage:  ./scripts/backup-db.sh
#  Cron:   0 2 * * * /opt/greenway/scripts/backup-db.sh
# ──────────────────────────────────────────────────────

set -e

BACKUP_DIR="${BACKUP_DIR:-/opt/greenway/backups}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/greenway_${TIMESTAMP}.sql.gz"
RETAIN_DAYS="${RETAIN_DAYS:-30}"

# Load env
if [ -f "$(dirname "$0")/../.env" ]; then
  source "$(dirname "$0")/../.env"
fi

DB_NAME="${DB_NAME:-greenway_db}"
DB_USER="${DB_USER:-greenway}"
DB_PASSWORD="${DB_PASSWORD:-greenway_secret}"

mkdir -p "$BACKUP_DIR"

echo "==> Backing up database: $DB_NAME → $BACKUP_FILE"

# Dump from running container
docker compose exec -T db pg_dump \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  --no-owner \
  --no-acl \
  | gzip > "$BACKUP_FILE"

echo "==> Backup complete: $(du -sh "$BACKUP_FILE" | cut -f1)"

# Remove backups older than RETAIN_DAYS
find "$BACKUP_DIR" -name "greenway_*.sql.gz" -mtime +"$RETAIN_DAYS" -delete
echo "==> Old backups cleaned (kept last $RETAIN_DAYS days)"
