from django.urls import path
from .views import forecast, reorder_alerts

urlpatterns = [
    path('forecast/', forecast),
    path('alerts/reorder/', reorder_alerts),
]
