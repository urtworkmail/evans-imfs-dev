from django.urls import path
from .views import status_view, server_usage

urlpatterns = [
    path('monitoring/status/', status_view),
    path('monitoring/server-usage/', server_usage),
]
