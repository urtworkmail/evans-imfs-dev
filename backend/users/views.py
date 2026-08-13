import base64
import io

import pyotp
import qrcode
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.conf import settings
from django.utils import timezone
from .models import User, LoginSession
from .serializers import UserSerializer


class IsAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == 'admin'


class UserViewSet(viewsets.ModelViewSet):
    queryset           = User.objects.all().order_by('id')
    serializer_class   = UserSerializer
    permission_classes = [IsAdmin]

    @action(detail=False, methods=['get'], permission_classes=[permissions.IsAuthenticated])
    def me(self, request):
        serializer = self.get_serializer(request.user)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], permission_classes=[permissions.IsAuthenticated])
    def permission_config(self, request):
        """
        Returns permission module tree + persona presets for the UI.
        Used by the granular permissions editor.
        """
        personas = []
        for key, data in settings.PERMISSION_PERSONAS.items():
            personas.append({
                'key':         key,
                'label':       data['label'],
                'description': data['description'],
                'permissions': data['permissions'],
            })

        return Response({
            'modules':  settings.PERMISSION_MODULES,
            'personas': personas,
        })

    @action(detail=False, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def totp_setup(self, request):
        """
        Generate a new (unconfirmed) TOTP secret + QR code for the current user.
        Not enabled until confirmed via totp_verify.
        """
        if request.user.role != 'admin':
            return Response({'detail': 'Two-factor authentication is only available for admin accounts.'},
                             status=status.HTTP_403_FORBIDDEN)

        secret = pyotp.random_base32()
        request.user.totp_secret = secret
        request.user.totp_enabled = False
        request.user.save(update_fields=['totp_secret', 'totp_enabled'])

        uri = pyotp.TOTP(secret).provisioning_uri(
            name=request.user.username, issuer_name='Evans Golf IMFS'
        )
        img = qrcode.make(uri)
        buf = io.BytesIO()
        img.save(buf, format='PNG')
        qr_b64 = base64.b64encode(buf.getvalue()).decode()

        return Response({
            'secret':  secret,
            'qr_code': f'data:image/png;base64,{qr_b64}',
        })

    @action(detail=False, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def totp_verify(self, request):
        """Confirm setup: check a code against the pending secret, then enable it."""
        code = (request.data.get('code') or '').strip()
        if not request.user.totp_secret:
            return Response({'detail': 'No two-factor setup in progress — start setup first.'},
                             status=status.HTTP_400_BAD_REQUEST)
        if not pyotp.TOTP(request.user.totp_secret).verify(code, valid_window=1):
            return Response({'detail': 'Invalid code. Check your app and try again.'},
                             status=status.HTTP_400_BAD_REQUEST)

        request.user.totp_enabled = True
        request.user.save(update_fields=['totp_enabled'])
        return Response({'detail': 'Two-factor authentication enabled.'})

    @action(detail=False, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def totp_disable(self, request):
        """Disable TOTP for the current user — requires the current password to confirm."""
        password = request.data.get('password') or ''
        if not request.user.check_password(password):
            return Response({'detail': 'Incorrect password.'}, status=status.HTTP_400_BAD_REQUEST)

        request.user.totp_secret = None
        request.user.totp_enabled = False
        request.user.save(update_fields=['totp_secret', 'totp_enabled'])
        return Response({'detail': 'Two-factor authentication disabled.'})

    @action(detail=False, methods=['get'])
    def sessions(self, request):
        """Active logins across all users — Super Admin only (default IsAdmin)."""
        now = timezone.now()
        qs = (LoginSession.objects
              .filter(revoked_at__isnull=True, expires_at__gt=now)
              .select_related('user'))
        data = [{
            'id':         s.id,
            'username':   s.user.username,
            'full_name':  f"{s.user.first_name} {s.user.last_name}".strip() or s.user.username,
            'role':       s.user.get_role_display(),
            'ip_address': s.ip_address,
            'user_agent': s.user_agent,
            'created_at': s.created_at,
            'expires_at': s.expires_at,
            'is_you':     s.user_id == request.user.id,
        } for s in qs]
        return Response({'total_active': len(data), 'sessions': data})

    @action(detail=False, methods=['post'])
    def revoke_session(self, request):
        """Ends a specific login early (e.g. a lost/stolen device)."""
        session_id = request.data.get('session_id')
        updated = LoginSession.objects.filter(id=session_id, revoked_at__isnull=True).update(revoked_at=timezone.now())
        if not updated:
            return Response({'detail': 'Session not found or already ended.'}, status=status.HTTP_404_NOT_FOUND)
        return Response({'detail': 'Session ended.'})
