from rest_framework import serializers
from .models import Supplier, ProductCategory, Product


class SupplierSerializer(serializers.ModelSerializer):
    class Meta:
        model = Supplier
        fields = '__all__'


class ProductCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductCategory
        fields = '__all__'


class ProductSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)
    supplier_lead_days = serializers.IntegerField(source='supplier.lead_time_days', read_only=True)

    class Meta:
        model = Product
        fields = '__all__'
