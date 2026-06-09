from django.contrib import admin
from .models import PurchaseOrder, PurchaseOrderItem

class POItemInline(admin.TabularInline):
    model = PurchaseOrderItem
    extra = 0

@admin.register(PurchaseOrder)
class PurchaseOrderAdmin(admin.ModelAdmin):
    list_display  = ['po_number', 'supplier', 'order_type', 'status', 'estimated_cost', 'created_at']
    list_filter   = ['status', 'order_type']
    inlines       = [POItemInline]
