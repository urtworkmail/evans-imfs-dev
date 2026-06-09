from rest_framework import viewsets, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from django.db import transaction
from .models import FabricStock, FinishedGoodsInventory, InventoryLog
from .serializers import FabricStockSerializer, FinishedGoodsSerializer, InventoryLogSerializer


class FabricStockViewSet(viewsets.ReadOnlyModelViewSet):
    queryset           = FabricStock.objects.all().order_by('color')
    serializer_class   = FabricStockSerializer
    permission_classes = [permissions.IsAuthenticated]


class FinishedGoodsViewSet(viewsets.ReadOnlyModelViewSet):
    queryset           = FinishedGoodsInventory.objects.select_related('product').all()
    serializer_class   = FinishedGoodsSerializer
    permission_classes = [permissions.IsAuthenticated]


class InventoryLogViewSet(viewsets.ModelViewSet):
    queryset           = InventoryLog.objects.all().order_by('-created_at')
    serializer_class   = InventoryLogSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):
        log = serializer.save(created_by=self.request.user)
        self._apply_log(log)

    @transaction.atomic
    def _apply_log(self, log):
        # ── Fabric adjustment ───────────────────────────────────
        if log.fabric_color and log.quantity_change_sq_yards is not None:
            fabric, _ = FabricStock.objects.get_or_create(
                color=log.fabric_color,
                defaults={'on_hand_sq_yards': 0}
            )
            new_val = fabric.on_hand_sq_yards + log.quantity_change_sq_yards
            fabric.on_hand_sq_yards = max(0, new_val)
            fabric.save()

        # ── Finished goods adjustment ───────────────────────────
        if log.product and log.quantity_change_units is not None:
            inv, _ = FinishedGoodsInventory.objects.get_or_create(
                product=log.product,
                defaults={'on_hand_units': 0}
            )
            new_val = inv.on_hand_units + log.quantity_change_units
            inv.on_hand_units = max(0, new_val)
            inv.save()


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def current_stock(request):
    """
    Returns both finished goods and fabric in one call.
    Used by the adjustment modal to show current stock before/after preview.
    """
    finished = FinishedGoodsInventory.objects.select_related('product').all()
    fabric   = FabricStock.objects.all().order_by('color')
    return Response({
        'finished': [
            {
                'product_id':   f.product.id,
                'sku':          f.product.sku,
                'name':         f.product.name,
                'on_hand':      f.on_hand_units,
                'unit':         'units',
            }
            for f in finished
        ],
        'fabric': [
            {
                'color':    f.color,
                'on_hand':  f.on_hand_sq_yards,
                'unit':     'sq yd',
            }
            for f in fabric
        ],
    })
