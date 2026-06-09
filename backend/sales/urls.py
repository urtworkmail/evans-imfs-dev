from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import SalesOrderViewSet, fetch_shopify, fetch_quickbooks, fetch_status, sales_analysis, comparison

router = DefaultRouter()
router.register(r'sales/orders', SalesOrderViewSet, basename='sales-order')

urlpatterns = [
    path('', include(router.urls)),
    path('fetch/shopify/', fetch_shopify),
    path('fetch/quickbooks/', fetch_quickbooks),
    path('fetch/status/', fetch_status),
    path('sales/analysis/', sales_analysis),
    path('analysis/comparison/', comparison),
]
