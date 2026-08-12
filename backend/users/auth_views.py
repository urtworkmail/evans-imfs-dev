import pyotp
from rest_framework import serializers
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView


class TOTPTokenObtainPairSerializer(TokenObtainPairSerializer):
    """
    Same as the default JWT login, but if the account is an admin with
    two-factor enabled, also requires a valid TOTP code. Raises the same
    'totp_required' detail whether the code is missing or wrong, so a
    failed attempt can't be used to probe whether 2FA is turned on.
    """
    totp_code = serializers.CharField(required=False, allow_blank=True, write_only=True)

    def validate(self, attrs):
        totp_code = (attrs.pop('totp_code', '') or '').strip()
        data = super().validate(attrs)

        user = self.user
        if user.role == 'admin' and user.totp_enabled:
            if not totp_code or not pyotp.TOTP(user.totp_secret).verify(totp_code, valid_window=1):
                raise AuthenticationFailed('totp_required')

        return data


class TOTPTokenObtainPairView(TokenObtainPairView):
    serializer_class = TOTPTokenObtainPairSerializer
