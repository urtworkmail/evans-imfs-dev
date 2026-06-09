from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import FabricStockViewSet, FinishedGoodsViewSet, InventoryLogViewSet, current_stock

router = DefaultRouter()
router.register(r'inventory/fabric',   FabricStockViewSet,   basename='fabric')
router.register(r'inventory/finished', FinishedGoodsViewSet, basename='finished')
router.register(r'inventory/logs',     InventoryLogViewSet,  basename='inventory-log')

urlpatterns = [
    path('', include(router.urls)),
    path('inventory/current-stock/', current_stock),
]
