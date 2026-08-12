"""
Database backups, triggered by actual data changes rather than a fixed
schedule (see sales.views._run_fetch, which calls run_backup() after a
fetch creates new orders) plus available for manual/cron use via the
backup_db management command.

Runs pg_dump directly over the network to the db container — the
backend/celery images already have the postgresql-client package
installed (see backend/Dockerfile), so no docker socket access is
needed.
"""
import gzip
import logging
import os
import subprocess
from datetime import datetime, timezone
from pathlib import Path

from django.conf import settings

logger = logging.getLogger(__name__)


def run_backup(reason: str = 'manual') -> Path:
    """Dump the database, gzip it, and prune to the last BACKUP_KEEP files.
    Returns the path to the new backup file."""
    backup_dir = Path(settings.BACKUP_DIR)
    backup_dir.mkdir(parents=True, exist_ok=True)

    db = settings.DATABASES['default']
    timestamp = datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')
    dump_file = backup_dir / f"greenway_{timestamp}.sql.gz"

    env = {**os.environ, 'PGPASSWORD': db['PASSWORD']}
    dump_cmd = [
        'pg_dump',
        '-h', db['HOST'],
        '-p', str(db['PORT']),
        '-U', db['USER'],
        '-d', db['NAME'],
        '--no-owner', '--no-acl',
    ]

    proc = subprocess.run(dump_cmd, env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if proc.returncode != 0:
        raise RuntimeError(f"pg_dump failed: {proc.stderr.decode(errors='replace')}")

    with gzip.open(dump_file, 'wb') as gz:
        gz.write(proc.stdout)

    logger.info(f"Backup written ({reason}): {dump_file} ({dump_file.stat().st_size} bytes)")
    _prune(backup_dir)
    return dump_file


def _prune(backup_dir: Path):
    """Keep only the BACKUP_KEEP most recent backups."""
    keep = getattr(settings, 'BACKUP_KEEP', 4)
    files = sorted(backup_dir.glob('greenway_*.sql.gz'), key=lambda p: p.stat().st_mtime, reverse=True)
    for old in files[keep:]:
        old.unlink()
        logger.info(f"Pruned old backup: {old}")
