from datetime import timedelta

import pyotp
from django.conf import settings
from rest_framework import serializers
from rest_framework.exceptions import AuthenticationFailed
from django.contrib.auth.models import update_last_login
from rest_framework_simplejwt.serializers import TokenObtainSerializer, TokenObtainPairSerializer
from rest_framework_simplejwt.settings import api_settings
from rest_framework_simplejwt.views import TokenObtainPairView


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
        refresh.set_exp(lifetime=get_login_lifetime())

        if api_settings.UPDATE_LAST_LOGIN:
            update_last_login(None, user)

        return {
            'refresh': str(refresh),
            'access':  str(refresh.access_token),
        }


class TOTPTokenObtainPairView(TokenObtainPairView):
    serializer_class = TOTPTokenObtainPairSerializer
