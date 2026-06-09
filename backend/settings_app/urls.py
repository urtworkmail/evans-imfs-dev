from django.urls import path
from .views import fetch_schedule, system_settings

urlpatterns = [
    path('settings/fetch-schedule/', fetch_schedule),
    path('settings/system/', system_settings),
]
