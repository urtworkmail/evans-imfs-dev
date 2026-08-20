import os

from django.utils import timezone
from rest_framework import permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response


class IsAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == 'admin'


@api_view(['GET'])
@permission_classes([IsAdmin])
def status_view(request):
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
            'response_ms': latest.response_ms if latest else None,
            'error':       latest.error if latest else '',
            'checked_at':  latest.checked_at if latest else None,
        })
    down = [r for r in rows if r['is_up'] is not True]
    return Response({
        'total':      len(rows),
        'up':         len(rows) - len(down),
        'down':       len(down),
        'endpoints':  rows,
        'checked_at': max((r['checked_at'] for r in rows if r['checked_at']), default=None),
    })


@api_view(['GET'])
@permission_classes([IsAdmin])
def server_usage(request):
    import psutil

    # If the host's /proc and / are bind-mounted read-only into this
    # container (production only — see docker-compose.prod.yml), report
    # real host-wide figures instead of this container's own cgroup view.
    host_proc = '/host/proc'
    if os.path.isdir(host_proc):
        psutil.PROCFS_PATH = host_proc
    disk_path = '/host' if os.path.isdir('/host') else '/'

    mem  = psutil.virtual_memory()
    disk = psutil.disk_usage(disk_path)
    try:
        load1, load5, load15 = os.getloadavg()
    except (OSError, AttributeError):
        load1 = load5 = load15 = None

    return Response({
        'cpu_percent': psutil.cpu_percent(interval=0.3),
        'cpu_count':   psutil.cpu_count(),
        'load_avg':    {'1m': load1, '5m': load5, '15m': load15},
        'memory': {
            'total':   mem.total,
            'used':    mem.used,
            'percent': mem.percent,
        },
        'disk': {
            'total':   disk.total,
            'used':    disk.used,
            'percent': disk.percent,
        },
        'measured_at': timezone.now(),
    })
