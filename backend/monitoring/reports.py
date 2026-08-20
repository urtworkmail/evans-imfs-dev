import logging

from django.utils import timezone

logger = logging.getLogger(__name__)

# Fixed recipients per the client's requirements — not admin-configurable,
# unlike the Slack webhook (which lives in SystemSetting since it's an
# operational integration detail, not a security-sensitive credential).
DELIVERY_RECIPIENT = 'matt@evansgolfcompany.com'
ISSUE_RECIPIENT     = 'silicatelabs@gmail.com'


def _endpoint_rows():
    from .models import EndpointCheck
    from .endpoints import get_monitored_endpoints

    rows = []
    for ep in get_monitored_endpoints():
        latest = EndpointCheck.objects.filter(name=ep['name']).order_by('-checked_at').first()
        rows.append({
            'name':        ep['name'],
            'path':        ep['path'],
            'is_up':       latest.is_up if latest else None,
            'status_code': latest.status_code if latest else None,
            'checked_at':  latest.checked_at if latest else None,
            'error':       latest.error if latest else '',
        })
    return rows


def _render_report_text(rows, down_rows):
    now = timezone.now()
    lines = [
        'Evans Golf IMFS — Daily Status Report',
        f'Generated: {now:%Y-%m-%d %H:%M} UTC',
        '',
    ]
    if down_rows:
        lines.append(f'Summary: {len(rows) - len(down_rows)}/{len(rows)} endpoints operational — {len(down_rows)} DOWN')
    else:
        lines.append(f'Summary: {len(rows)}/{len(rows)} endpoints operational')
    lines.append('')
    lines.append('Endpoints:')
    for r in rows:
        state = 'UP  ' if r['is_up'] else 'DOWN'
        checked = f"{r['checked_at']:%Y-%m-%d %H:%M} UTC" if r['checked_at'] else 'never checked'
        code = r['status_code'] if r['status_code'] is not None else '-'
        line = f"  [{state}] {r['name']:<22} {r['path']:<32} {code!s:<5} checked {checked}"
        if not r['is_up'] and r['error']:
            line += f"\n           error: {r['error']}"
        lines.append(line)
    return '\n'.join(lines)


def _send_email(subject, body, recipients):
    from django.conf import settings
    from django.core.mail import send_mail
    if not settings.EMAIL_HOST:
        logger.warning(f"EMAIL_HOST not configured — skipping status email to {recipients}")
        return
    try:
        send_mail(subject, body, settings.DEFAULT_FROM_EMAIL, recipients, fail_silently=False)
    except Exception:
        logger.exception(f"Failed to send status report email to {recipients}")


def _send_slack(subject, body):
    from settings_app.models import SystemSetting
    try:
        webhook = SystemSetting.objects.get(key='slack_webhook_url').value
    except SystemSetting.DoesNotExist:
        return
    if not webhook:
        return
    import requests
    try:
        requests.post(webhook, json={'text': f"*{subject}*\n```{body}```"}, timeout=10)
    except Exception:
        logger.exception("Failed to post status report to Slack")


def send_daily_report():
    rows = _endpoint_rows()
    down_rows = [r for r in rows if not r['is_up']]
    has_issues = len(down_rows) > 0

    if has_issues:
        subject = f"[Evans Golf IMFS] ALERT — {len(down_rows)} endpoint(s) down"
    else:
        subject = f"[Evans Golf IMFS] Daily Status Report — All Systems Operational ({len(rows)} endpoints)"

    body = _render_report_text(rows, down_rows)

    # Delivery report — always, every 24h, to Matt + Slack (if configured).
    _send_email(subject, body, [DELIVERY_RECIPIENT])
    _send_slack(subject, body)

    # Issue report vs all-clear report — always exactly one email to Silicate Labs.
    if has_issues:
        _send_email(subject, body, [ISSUE_RECIPIENT, DELIVERY_RECIPIENT])
    else:
        _send_email(subject, body, [ISSUE_RECIPIENT])

    return {'has_issues': has_issues, 'down_count': len(down_rows), 'total': len(rows)}
