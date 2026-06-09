from rest_framework import serializers
from .models import SalesOrder, SalesOrderItem, FetchLog


class SalesOrderItemSerializer(serializers.ModelSerializer):
    product_sku = serializers.CharField(source='product.sku', read_only=True)
    product_name = serializers.CharField(source='product.name', read_only=True)

    class Meta:
        model = SalesOrderItem
        fields = '__all__'


class SalesOrderSerializer(serializers.ModelSerializer):
    items = SalesOrderItemSerializer(many=True, read_only=True)

    class Meta:
        model = SalesOrder
        fields = '__all__'


class FetchLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = FetchLog
        fields = '__all__'
