def _client_ip(request):
    forwarded = request.META.get('HTTP_X_FORWARDED_FOR')
    if forwarded:
        return forwarded.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR')


def log_action(request, action, target='', details=None):
    """Best-effort audit trail write — never let a logging failure break the
    actual request it's describing."""
    from .models import AuditLog
    try:
        user = getattr(request, 'user', None)
        authed = bool(user and user.is_authenticated)
        AuditLog.objects.create(
            actor=user if authed else None,
            actor_username=user.username if authed else '',
            action=action,
            target=target,
            details=details or {},
            ip_address=_client_ip(request),
            user_agent=request.META.get('HTTP_USER_AGENT', '')[:300],
        )
    except Exception:
        import logging
        logging.getLogger(__name__).exception(f"Failed to write audit log for action={action}")
