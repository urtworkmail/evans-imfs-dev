from celery import shared_task
from celery.utils.log import get_task_logger

logger = get_task_logger(__name__)


@shared_task(bind=True, max_retries=3, default_retry_delay=300)
def fetch_shopify_task(self):
    """Scheduled Shopify fetch — triggered by Celery Beat."""
    try:
        from sales.views import _run_fetch
        result = _run_fetch('shopify')
        data   = result.data
        logger.info(f"Scheduled Shopify fetch: {data.get('orders_created', 0)} new orders [{data.get('mode')}]")
        return data
    except Exception as exc:
        logger.error(f"Scheduled Shopify fetch failed: {exc}")
        raise self.retry(exc=exc)


@shared_task(bind=True, max_retries=3, default_retry_delay=300)
def fetch_quickbooks_task(self):
    """Scheduled QuickBooks fetch — triggered by Celery Beat."""
    try:
        from sales.views import _run_fetch
        result = _run_fetch('quickbooks')
        data   = result.data
        logger.info(f"Scheduled QB fetch: {data.get('orders_created', 0)} new orders [{data.get('mode')}]")
        return data
    except Exception as exc:
        logger.error(f"Scheduled QB fetch failed: {exc}")
        raise self.retry(exc=exc)


@shared_task
def sync_fetch_schedule():
    """
    Reads the FetchSchedule from DB and updates Celery Beat's
    PeriodicTask entries accordingly. Called once on startup
    and whenever settings are saved.
    """
    try:
        from django_celery_beat.models import PeriodicTask, CrontabSchedule
        from settings_app.models import FetchSchedule
        import json

        schedule_obj = FetchSchedule.objects.first()
        if not schedule_obj or not schedule_obj.is_active:
            # Disable both tasks
            PeriodicTask.objects.filter(name__in=[
                'fetch-shopify-scheduled', 'fetch-quickbooks-scheduled'
            ]).update(enabled=False)
            logger.info("Scheduled fetch disabled.")
            return

        freq = schedule_obj.frequency
        t    = schedule_obj.time
        dow  = schedule_obj.day_of_week  # 0=Mon, 6=Sun

        if freq == 'daily':
            crontab_kwargs = {
                'minute':       str(t.minute),
                'hour':         str(t.hour),
                'day_of_week':  '*',
                'day_of_month': '*',
                'month_of_year':'*',
            }
        elif freq == 'weekly' and dow is not None:
            # Celery uses 0=Sunday, 1=Monday... convert from our 0=Monday
            celery_dow = (dow + 1) % 7
            crontab_kwargs = {
                'minute':       str(t.minute),
                'hour':         str(t.hour),
                'day_of_week':  str(celery_dow),
                'day_of_month': '*',
                'month_of_year':'*',
            }
        else:
            return  # manual — no schedule

        crontab, _ = CrontabSchedule.objects.get_or_create(**crontab_kwargs)

        for name, task_path in [
            ('fetch-shopify-scheduled',    'sales.tasks.fetch_shopify_task'),
            ('fetch-quickbooks-scheduled', 'sales.tasks.fetch_quickbooks_task'),
        ]:
            PeriodicTask.objects.update_or_create(
                name=name,
                defaults={
                    'crontab': crontab,
                    'task':    task_path,
                    'enabled': True,
                    'kwargs':  json.dumps({}),
                }
            )
        logger.info(f"Scheduled fetch updated: {freq} at {t}")

    except Exception as e:
        logger.error(f"sync_fetch_schedule error: {e}")
