from rest_framework import viewsets, permissions
from .models import AuditLog
from .serializers import AuditLogSerializer


class IsAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == 'admin'


class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only trail of security/admin actions — Super Admin only."""
    serializer_class   = AuditLogSerializer
    permission_classes = [IsAdmin]

    def get_queryset(self):
        qs = AuditLog.objects.all()
        action   = self.request.query_params.get('action')
        username = self.request.query_params.get('username')
        if action:
            qs = qs.filter(action=action)
        if username:
            qs = qs.filter(actor_username__icontains=username)
        return qs
