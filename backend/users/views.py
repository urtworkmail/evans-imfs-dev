from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.conf import settings
from .models import User
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
