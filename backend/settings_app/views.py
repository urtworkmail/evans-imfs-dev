import pyotp
from rest_framework import permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework import status as drf_status
from .models import FetchSchedule, SystemSetting


class IsAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == 'admin'


# API integration credentials — blurred in the regular GET, only shown in
# full via reveal_credentials() after the admin re-confirms their password
# (and TOTP code, if they have 2FA enabled).
CREDENTIAL_KEYS = {
    'shopify_shop_url', 'shopify_access_token',
    'qb_client_id', 'qb_client_secret', 'qb_realm_id', 'qb_refresh_token', 'qb_environment',
}
CREDENTIAL_MASK = '••••••••'


@api_view(['GET', 'PUT'])
@permission_classes([IsAdmin])
def fetch_schedule(request):
    schedule, _ = FetchSchedule.objects.get_or_create(id=1, defaults={})
    if request.method == 'GET':
        return Response({
            'id': schedule.id,
            'frequency': schedule.frequency,
            'day_of_week': schedule.day_of_week,
            'time': str(schedule.time),
            'is_active': schedule.is_active,
        })
    # PUT
    data = request.data
    schedule.frequency = data.get('frequency', schedule.frequency)
    schedule.day_of_week = data.get('day_of_week', schedule.day_of_week)
    schedule.time = data.get('time', schedule.time)
    schedule.is_active = data.get('is_active', schedule.is_active)
    schedule.save()
    from auditlog.utils import log_action
    log_action(request, 'settings.fetch_schedule_updated', target='fetch_schedule')
    return Response({'status': 'saved'})


@api_view(['GET', 'PUT'])
@permission_classes([IsAdmin])
def system_settings(request):
    if request.method == 'GET':
        rows = {s.key: s.value for s in SystemSetting.objects.all()}
        masked = {k: (CREDENTIAL_MASK if k in CREDENTIAL_KEYS and v else v) for k, v in rows.items()}
        return Response(masked)
    # PUT
    from auditlog.utils import log_action
    for key, value in request.data.items():
        SystemSetting.objects.update_or_create(key=key, defaults={'value': str(value)})
    # Never log the actual values here — credentials in particular must not
    # end up in the audit trail, only which setting keys were touched.
    log_action(request, 'settings.updated', target=', '.join(sorted(request.data.keys())))
    return Response({'status': 'saved'})


@api_view(['POST'])
@permission_classes([IsAdmin])
def reveal_credentials(request):
    """Step-up re-auth before showing real API integration credential values.
    Requires the admin's current password, plus their TOTP code if they have
    two-factor enabled. Every reveal is written to the audit log."""
    password  = request.data.get('password') or ''
    totp_code = (request.data.get('totp_code') or '').strip()
    user = request.user

    if not user.check_password(password):
        return Response({'detail': 'Incorrect password.'}, status=drf_status.HTTP_400_BAD_REQUEST)
    if user.totp_enabled:
        if not totp_code or not pyotp.TOTP(user.totp_secret).verify(totp_code, valid_window=1):
            return Response({'detail': 'Invalid authentication code.'}, status=drf_status.HTTP_400_BAD_REQUEST)

    values = {s.key: s.value for s in SystemSetting.objects.filter(key__in=CREDENTIAL_KEYS)}
    from auditlog.utils import log_action
    log_action(request, 'settings.credentials_revealed', target=user.username, details={'keys': sorted(values.keys())})
    return Response(values)
