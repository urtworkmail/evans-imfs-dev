from datetime import timedelta

import pyotp
from django.conf import settings
from django.utils import timezone
from rest_framework import serializers, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from django.contrib.auth.models import update_last_login
from rest_framework_simplejwt.serializers import TokenObtainSerializer, TokenObtainPairSerializer
from rest_framework_simplejwt.settings import api_settings
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView


def get_client_ip(request):
    forwarded = request.META.get('HTTP_X_FORWARDED_FOR')
    if forwarded:
        return forwarded.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR')


def get_login_lifetime() -> timedelta:
    """Admin-configurable session length (Settings -> Security), falls back to
    settings.LOGIN_LIFETIME_HOURS."""
    from settings_app.models import SystemSetting
    try:
        hours = float(SystemSetting.objects.get(key='login_lifetime_hours').value)
        if hours > 0:
            return timedelta(hours=hours)
    except Exception:
        pass
    return timedelta(hours=getattr(settings, 'LOGIN_LIFETIME_HOURS', 24))


class TOTPTokenObtainPairSerializer(TokenObtainPairSerializer):
    """
    Same as the default JWT login, but:
    - if the account is an admin with two-factor enabled, also requires a
      valid TOTP code. Raises the same 'totp_required' detail whether the
      code is missing or wrong, so a failed attempt can't be used to probe
      whether 2FA is turned on.
    - the issued refresh token's lifetime (i.e. how long the login lasts
      before requiring re-auth) is set from the admin-configurable
      login_lifetime_hours setting, not the static Django default.
    """
    totp_code = serializers.CharField(required=False, allow_blank=True, write_only=True)

    def validate(self, attrs):
        totp_code = (attrs.pop('totp_code', '') or '').strip()
        # Call the auth-only base validate (sets self.user) — we build the
        # tokens ourselves below instead of the parent's, so we control exp.
        TokenObtainSerializer.validate(self, attrs)

        user = self.user
        if user.role == 'admin' and user.totp_enabled:
            if not totp_code or not pyotp.TOTP(user.totp_secret).verify(totp_code, valid_window=1):
                raise AuthenticationFailed('totp_required')

        refresh = self.get_token(user)
        lifetime = get_login_lifetime()
        refresh.set_exp(lifetime=lifetime)

        if api_settings.UPDATE_LAST_LOGIN:
            update_last_login(None, user)

        request = self.context.get('request')
        from .models import LoginSession
        LoginSession.objects.create(
            user=user,
            jti=refresh['jti'],
            ip_address=get_client_ip(request) if request else None,
            user_agent=(request.META.get('HTTP_USER_AGENT', '') if request else '')[:300],
            expires_at=timezone.now() + lifetime,
        )

        return {
            'refresh': str(refresh),
            'access':  str(refresh.access_token),
        }


class TOTPTokenObtainPairView(TokenObtainPairView):
    serializer_class = TOTPTokenObtainPairSerializer


@api_view(['POST'])
@permission_classes([AllowAny])
def logout_view(request):
    """Ends the current login early by revoking its LoginSession. Best-effort:
    since refresh tokens aren't blacklisted, a client that keeps the token
    could technically keep using it, but the app always discards it on
    logout, and this makes the "who's logged in" view accurate."""
    refresh = request.data.get('refresh')
    if refresh:
        from .models import LoginSession
        try:
            jti = RefreshToken(refresh)['jti']
        except Exception:
            jti = None
        if jti:
            LoginSession.objects.filter(jti=jti, revoked_at__isnull=True).update(revoked_at=timezone.now())
    return Response(status=status.HTTP_204_NO_CONTENT)
