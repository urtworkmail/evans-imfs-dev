from rest_framework import viewsets, permissions, status
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.response import Response
from django.utils import timezone
from datetime import date, timedelta

from .models import PurchaseOrder, PurchaseOrderItem
from .serializers import PurchaseOrderSerializer, CreatePurchaseOrderSerializer
from products.models import Supplier, Product
from users.permissions import ActionPermission, require_permission


def _next_po_number():
    last = PurchaseOrder.objects.order_by('-id').first()
    n = (last.id + 1) if last else 1
    return f"PO-{date.today().strftime('%Y%m')}-{n:04d}"


class PurchaseOrderViewSet(viewsets.ModelViewSet):
    queryset           = PurchaseOrder.objects.prefetch_related('items').select_related('supplier', 'created_by')
    serializer_class   = PurchaseOrderSerializer
    permission_classes = [ActionPermission]
    permission_map = {
        'create':         'reorder.order',
        'update':         'reorder.order',
        'partial_update': 'reorder.order',
        'destroy':        'reorder.order',
        'mark_received':  'reorder.order',
        'update_status':  'reorder.order',
    }

    def get_queryset(self):
        qs = super().get_queryset()
        status_filter = self.request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter)
        return qs

    @action(detail=True, methods=['post'])
    def mark_received(self, request, pk=None):
        """Mark a PO as received and update inventory."""
        po = self.get_object()
        if po.status == 'received':
            return Response({'error': 'Already received.'}, status=400)

        from inventory.models import FabricStock, FinishedGoodsInventory, InventoryLog

        for item in po.items.all():
            if item.fabric_color:
                fab, _ = FabricStock.objects.get_or_create(
                    color=item.fabric_color,
                    defaults={'on_hand_sq_yards': 0}
                )
                fab.on_hand_sq_yards += item.quantity
                fab.save()
                InventoryLog.objects.create(
                    fabric_color=item.fabric_color,
                    quantity_change_sq_yards=item.quantity,
                    log_type='fabric_receipt',
                    note=f"Received via PO#{po.po_number}",
                )
                item.received_qty = item.quantity
                item.save()

            elif item.product:
                inv, _ = FinishedGoodsInventory.objects.get_or_create(
                    product=item.product,
                    defaults={'on_hand_units': 0}
                )
                inv.on_hand_units += int(item.quantity)
                inv.save()
                InventoryLog.objects.create(
                    product=item.product,
                    quantity_change_units=int(item.quantity),
                    log_type='finished_receipt',
                    note=f"Received via PO#{po.po_number}",
                )
                item.received_qty = item.quantity
                item.save()

        po.status      = 'received'
        po.received_at = timezone.now()
        po.save()
        return Response(PurchaseOrderSerializer(po).data)

    @action(detail=True, methods=['post'])
    def update_status(self, request, pk=None):
        po = self.get_object()
        new_status = request.data.get('status')
        valid = [s[0] for s in PurchaseOrder.STATUS_CHOICES]
        if new_status not in valid:
            return Response({'error': f'Invalid status. Choose from {valid}'}, status=400)
        po.status = new_status
        po.save()
        return Response(PurchaseOrderSerializer(po).data)


@api_view(['POST'])
@permission_classes([require_permission('reorder.order')])
def place_order(request):
    """
    Called from the Reorder Planner 'Order Now' button.
    Creates a PurchaseOrder with one item and returns the PO.
    """
    ser = CreatePurchaseOrderSerializer(data=request.data)
    if not ser.is_valid():
        return Response(ser.errors, status=400)

    d = ser.validated_data

    supplier = None
    if d.get('supplier_id'):
        try:
            supplier = Supplier.objects.get(id=d['supplier_id'])
        except Supplier.DoesNotExist:
            pass

    product = None
    if d.get('product_id'):
        try:
            product = Product.objects.get(id=d['product_id'])
        except Product.DoesNotExist:
            pass

    lead_days = supplier.lead_time_days if supplier else 14

    po = PurchaseOrder.objects.create(
        po_number      = _next_po_number(),
        supplier       = supplier,
        order_type     = d['item_type'],
        status         = 'sent',
        notes          = d.get('notes', ''),
        estimated_cost = d['unit_cost'] * d['quantity'],
        created_by     = request.user,
        expected_date  = date.today() + timedelta(days=lead_days),
    )

    PurchaseOrderItem.objects.create(
        purchase_order = po,
        product        = product,
        fabric_color   = d.get('fabric_color', ''),
        item_label     = d['item_label'],
        quantity       = d['quantity'],
        unit           = d['unit'],
        unit_cost      = d['unit_cost'],
    )

    return Response(PurchaseOrderSerializer(po).data, status=201)
