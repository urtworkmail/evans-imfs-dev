from rest_framework import serializers
from .models import PurchaseOrder, PurchaseOrderItem


class PurchaseOrderItemSerializer(serializers.ModelSerializer):
    total_cost = serializers.ReadOnlyField()

    class Meta:
        model  = PurchaseOrderItem
        fields = '__all__'


class PurchaseOrderSerializer(serializers.ModelSerializer):
    items         = PurchaseOrderItemSerializer(many=True, read_only=True)
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)
    created_by_name = serializers.SerializerMethodField()
    status_label  = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model  = PurchaseOrder
        fields = '__all__'

    def get_created_by_name(self, obj):
        if obj.created_by:
            return f"{obj.created_by.first_name} {obj.created_by.last_name}".strip() or obj.created_by.username
        return None


class CreatePurchaseOrderSerializer(serializers.Serializer):
    """Used when placing an order from the Reorder Planner."""
    item_type    = serializers.ChoiceField(choices=['finished_goods', 'fabric'])
    item_label   = serializers.CharField()
    product_id   = serializers.IntegerField(required=False, allow_null=True)
    fabric_color = serializers.CharField(required=False, allow_blank=True)
    quantity     = serializers.FloatField()
    unit         = serializers.CharField()
    unit_cost    = serializers.FloatField(required=False, default=0)
    supplier_id  = serializers.IntegerField(required=False, allow_null=True)
    notes        = serializers.CharField(required=False, allow_blank=True)
