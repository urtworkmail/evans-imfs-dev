import time
import logging

from django.utils import timezone
from rest_framework.test import APIClient

from .endpoints import get_monitored_endpoints

logger = logging.getLogger(__name__)

MONITOR_USERNAME = 'system-monitor'


def _monitor_client():
    """In-process authenticated client — runs each check through the real
    URL routing, middleware, permissions, and DB, without a real network
    hop or a live JWT to manage/rotate.

    SERVER_NAME must be a host that's actually in ALLOWED_HOSTS — Django's
    test client defaults to 'testserver', which isn't, so without this every
    request gets rejected by the ALLOWED_HOSTS check before it even reaches
    the view (every endpoint reads as "down" for a reason that has nothing
    to do with whether the endpoint actually works)."""
    from users.models import User
    client = APIClient(raise_request_exception=False, SERVER_NAME='backend')
    user = User.objects.filter(username=MONITOR_USERNAME).first()
    if user:
        client.force_authenticate(user=user)
    return client


def run_checks():
    from .models import EndpointCheck

    client = _monitor_client()
    results = []

    for ep in get_monitored_endpoints():
        start = time.monotonic()
        try:
            resp = client.get(ep['path'], ep.get('params'))
            elapsed_ms = int((time.monotonic() - start) * 1000)
            is_up = resp.status_code == 200
            error = '' if is_up else str(resp.data)[:300] if hasattr(resp, 'data') else ''
            status_code = resp.status_code
        except Exception as exc:
            elapsed_ms = int((time.monotonic() - start) * 1000)
            is_up = False
            status_code = None
            error = str(exc)[:300]
            logger.error(f"Endpoint check failed for {ep['name']} ({ep['path']}): {exc}")

        check = EndpointCheck.objects.create(
            name=ep['name'], path=ep['path'], method='GET',
            status_code=status_code, is_up=is_up,
            response_ms=elapsed_ms, error=error,
        )
        results.append(check)

    # Keep the log from growing unbounded — 7 days is enough for the daily
    # report and for spotting recent flapping.
    cutoff = timezone.now() - timezone.timedelta(days=7)
    EndpointCheck.objects.filter(checked_at__lt=cutoff).delete()

    return results
