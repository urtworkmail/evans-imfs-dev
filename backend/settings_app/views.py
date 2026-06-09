from rest_framework import permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework import status as drf_status
from .models import FetchSchedule, SystemSetting


class IsAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == 'admin'


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
    return Response({'status': 'saved'})


@api_view(['GET', 'PUT'])
@permission_classes([IsAdmin])
def system_settings(request):
    if request.method == 'GET':
        settings = {s.key: s.value for s in SystemSetting.objects.all()}
        return Response(settings)
    # PUT
    for key, value in request.data.items():
        SystemSetting.objects.update_or_create(key=key, defaults={'value': str(value)})
    return Response({'status': 'saved'})
