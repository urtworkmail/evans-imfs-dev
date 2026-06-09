from django.contrib import admin
from .models import SalesOrder, SalesOrderItem, FetchLog

class SalesOrderItemInline(admin.TabularInline):
    model = SalesOrderItem
    extra = 0

@admin.register(SalesOrder)
class SalesOrderAdmin(admin.ModelAdmin):
    list_display = ['external_id', 'source', 'channel', 'order_date', 'total_revenue']
    list_filter = ['source', 'channel']
    inlines = [SalesOrderItemInline]

@admin.register(FetchLog)
class FetchLogAdmin(admin.ModelAdmin):
    list_display = ['source', 'fetched_at', 'orders_fetched', 'status']
