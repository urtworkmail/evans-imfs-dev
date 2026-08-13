from django.contrib import admin
from django.urls import path, include
from rest_framework_simplejwt.views import TokenRefreshView
from users.auth_views import TOTPTokenObtainPairView, logout_view

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/token/',         TOTPTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/auth/token/refresh/', TokenRefreshView.as_view(),    name='token_refresh'),
    path('api/auth/logout/',        logout_view,                    name='logout'),
    path('api/', include('products.urls')),
    path('api/', include('inventory.urls')),
    path('api/', include('sales.urls')),
    path('api/', include('users.urls')),
    path('api/', include('settings_app.urls')),
    path('api/', include('forecasting.urls')),
    path('api/', include('purchasing.urls')),
]
