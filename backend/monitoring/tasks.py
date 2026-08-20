from celery import shared_task
from celery.utils.log import get_task_logger

logger = get_task_logger(__name__)


@shared_task
def check_endpoints_task():
    from .checker import run_checks
    results = run_checks()
    down = [r for r in results if not r.is_up]
    if down:
        logger.warning(f"Endpoint check: {len(down)}/{len(results)} down — {', '.join(r.name for r in down)}")
    return {'checked': len(results), 'down': len(down)}


@shared_task
def send_daily_status_report_task():
    from .reports import send_daily_report
    try:
        return send_daily_report()
    except Exception:
        logger.exception("send_daily_status_report_task failed")
        raise
