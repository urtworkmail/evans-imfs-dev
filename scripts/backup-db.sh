#!/bin/bash
# ──────────────────────────────────────────────────────
#  Evans Golf IMFS — Manual PostgreSQL Backup
#  Usage:  ./scripts/backup-db.sh
#
#  Backups are normally triggered automatically whenever a Shopify/
#  QuickBooks fetch actually creates new orders (see
#  backend/sales/views.py + backend/settings_app/backup.py) — there's
#  no fixed daily schedule anymore. This script is only for a manual,
#  on-demand backup (e.g. right before a risky deploy). It shares the
#  exact same backup code (and the same keep-last-4 retention) as the
#  automatic one, run inside the backend container.
# ──────────────────────────────────────────────────────

set -e

docker compose exec -T backend python manage.py backup_db
