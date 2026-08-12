from django.core.management.base import BaseCommand
from settings_app.backup import run_backup


class Command(BaseCommand):
    help = 'Dump the database, gzip it, and prune to the last BACKUP_KEEP backups.'

    def handle(self, *args, **options):
        path = run_backup(reason='manual')
        self.stdout.write(self.style.SUCCESS(f'Backup written: {path}'))
