from django.contrib import admin
from .models import Supplier, ProductCategory, Product

@admin.register(Supplier)
class SupplierAdmin(admin.ModelAdmin):
    list_display = ['name', 'contact_email', 'lead_time_days', 'moq', 'cost_per_unit']
    search_fields = ['name']

@admin.register(ProductCategory)
class ProductCategoryAdmin(admin.ModelAdmin):
    list_display = ['name']

@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ['sku', 'name', 'category', 'color', 'fabric_consumption_sq_yards', 'active']
    list_filter = ['category', 'active', 'is_limited_edition']
    search_fields = ['sku', 'name']
