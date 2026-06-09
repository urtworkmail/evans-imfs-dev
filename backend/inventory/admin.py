from django.contrib import admin
from .models import FabricStock, FinishedGoodsInventory, InventoryLog

@admin.register(FabricStock)
class FabricStockAdmin(admin.ModelAdmin):
    list_display = ['color', 'on_hand_sq_yards', 'last_updated']

@admin.register(FinishedGoodsInventory)
class FinishedGoodsAdmin(admin.ModelAdmin):
    list_display = ['product', 'on_hand_units', 'last_updated']

@admin.register(InventoryLog)
class InventoryLogAdmin(admin.ModelAdmin):
    list_display = ['log_type', 'product', 'fabric_color', 'quantity_change_units', 'quantity_change_sq_yards', 'created_at']
    list_filter = ['log_type']
