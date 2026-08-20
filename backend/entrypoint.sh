#!/bin/sh
set -e

echo "==> Waiting for PostgreSQL..."
until pg_isready -h "${DB_HOST:-db}" -p "${DB_PORT:-5432}" -U "${DB_USER:-greenway}" -d "${DB_NAME:-greenway_db}" -q; do
  echo "   Postgres not ready — retrying in 2s..."
  sleep 2
done
echo "==> PostgreSQL is ready."

echo "==> Running migrations..."
python manage.py migrate users --noinput
python manage.py migrate --noinput

echo "==> Seeding initial data..."
#python manage.py seed_data || echo "   Seed skipped (data may already exist)"

# docker-compose sets a different `command:` for the celery/celery-beat
# services (same image, same entrypoint) — run that instead of Gunicorn
# when one was passed. Without this, every container using this image
# starts Gunicorn regardless of what it was actually meant to run.
if [ "$#" -gt 0 ]; then
  echo "==> Running: $@"
  exec "$@"
fi

echo "==> Starting Gunicorn..."
exec gunicorn greenway.wsgi:application \
  --bind 0.0.0.0:8000 \
  --workers "${GUNICORN_WORKERS:-3}" \
  --timeout 120 \
  --access-logfile - \
  --error-logfile -
