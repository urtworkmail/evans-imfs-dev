from django.urls import path
from .views import fetch_schedule, system_settings, reveal_credentials

urlpatterns = [
    path('settings/fetch-schedule/', fetch_schedule),
    path('settings/system/', system_settings),
    path('settings/system/reveal/', reveal_credentials),
]
