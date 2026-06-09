from rest_framework import serializers
from .models import FabricStock, FinishedGoodsInventory, InventoryLog
from products.models import Product
from products.serializers import ProductSerializer


class FabricStockSerializer(serializers.ModelSerializer):
    class Meta:
        model = FabricStock
        fields = '__all__'


class FinishedGoodsSerializer(serializers.ModelSerializer):
    product = ProductSerializer(read_only=True)
    product_id = serializers.PrimaryKeyRelatedField(
        queryset=Product.objects.all(),
        source='product',
        write_only=True
    )

    class Meta:
        model = FinishedGoodsInventory
        fields = '__all__'


class InventoryLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = InventoryLog
        fields = '__all__'
        read_only_fields = ['created_at', 'created_by']
