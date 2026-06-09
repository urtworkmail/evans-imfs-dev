from rest_framework import viewsets, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from django.db import transaction
from django.conf import settings
from datetime import date, timedelta
from decimal import Decimal
from collections import defaultdict

from .models import SalesOrder, SalesOrderItem, FetchLog
from .serializers import SalesOrderSerializer, FetchLogSerializer
from inventory.models import FabricStock, FinishedGoodsInventory


class SalesOrderViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class   = SalesOrderSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = SalesOrder.objects.prefetch_related('items__product').order_by('-order_date')
        for param, field in [('start','order_date__gte'),('end','order_date__lte'),
                              ('channel','channel'),('source','source')]:
            val = self.request.query_params.get(param)
            if val:
                qs = qs.filter(**{field: val})
        return qs


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def fetch_shopify(request):
    return _run_fetch('shopify')


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def fetch_quickbooks(request):
    return _run_fetch('quickbooks')


@transaction.atomic
def _run_fetch(source):
    last_log = FetchLog.objects.filter(source=source).first()
    since    = last_log.fetched_at.date() if last_log else (date.today() - timedelta(days=365))
    up_to    = date.today()

    # ── Choose real API or mock based on credentials ─────────────
    try:
        if source == 'shopify':
            if settings.SHOPIFY_SHOP_URL and settings.SHOPIFY_ACCESS_TOKEN:
                from .integrations.shopify import fetch_orders as real_fetch
                raw_orders = real_fetch(since, up_to)
                mode = 'live'
            else:
                from .mock_data import generate_shopify_orders
                raw_orders = generate_shopify_orders(since, up_to)
                mode = 'mock'
        else:
            if settings.QB_CLIENT_ID and settings.QB_CLIENT_SECRET and settings.QB_REALM_ID:
                from .integrations.quickbooks import fetch_orders as real_fetch
                raw_orders = real_fetch(since, up_to)
                mode = 'live'
            else:
                from .mock_data import generate_quickbooks_orders
                raw_orders = generate_quickbooks_orders(since, up_to)
                mode = 'mock'
    except Exception as exc:
        FetchLog.objects.create(
            source=source, orders_fetched=0, status='error', message=str(exc)
        )
        return Response({'status': 'error', 'message': str(exc)}, status=502)

    created_count = 0
    for o in raw_orders:
        obj, created = SalesOrder.objects.get_or_create(
            source=source,
            external_id=o['external_id'],
            defaults={
                'order_date':    o['order_date'],
                'channel':       o['channel'],
                'total_revenue': o['total_revenue'],
            }
        )
        if created:
            fabric_consumed = 0.0
            if o['product'].fabric_consumption_sq_yards:
                fabric_consumed = o['quantity'] * o['product'].fabric_consumption_sq_yards

            SalesOrderItem.objects.create(
                sales_order=obj, product=o['product'],
                quantity=o['quantity'], unit_price=o['unit_price'],
                fabric_consumed_sq_yards=fabric_consumed,
            )

            try:
                inv = FinishedGoodsInventory.objects.select_for_update().get(product=o['product'])
                inv.on_hand_units = max(0, inv.on_hand_units - o['quantity'])
                inv.save()
            except FinishedGoodsInventory.DoesNotExist:
                pass

            if fabric_consumed > 0 and o['product'].color:
                try:
                    fab = FabricStock.objects.select_for_update().get(color=o['product'].color)
                    fab.on_hand_sq_yards = max(0, fab.on_hand_sq_yards - fabric_consumed)
                    fab.save()
                except FabricStock.DoesNotExist:
                    pass

            created_count += 1

    FetchLog.objects.create(
        source=source, orders_fetched=created_count,
        status='success',
        message=f"[{mode.upper()}] {created_count} new orders from {since} to {up_to}.",
    )

    return Response({
        'status':         'success',
        'mode':           mode,
        'source':         source,
        'orders_created': created_count,
        'from_date':      str(since),
        'to_date':        str(up_to),
    })


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def fetch_status(request):
    logs = FetchLog.objects.order_by('-fetched_at')[:10]
    return Response(FetchLogSerializer(logs, many=True).data)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def sales_analysis(request):
    start   = request.query_params.get('start', str(date.today() - timedelta(days=365)))
    end     = request.query_params.get('end',   str(date.today()))
    channel = request.query_params.get('channel')

    qs = SalesOrderItem.objects.select_related('sales_order', 'product').filter(
        sales_order__order_date__gte=start,
        sales_order__order_date__lte=end,
    )
    if channel:
        qs = qs.filter(sales_order__channel=channel)

    sku_stats = {}
    for item in qs:
        sku = item.product.sku
        if sku not in sku_stats:
            sku_stats[sku] = {
                'sku': sku, 'name': item.product.name,
                'category': item.product.category_id,
                'units': 0, 'revenue': Decimal('0'),
                'fabric_consumed': 0.0,
                'dtc_units': 0, 'wholesale_units': 0,
            }
        sku_stats[sku]['units']           += item.quantity
        sku_stats[sku]['revenue']         += item.unit_price * item.quantity
        sku_stats[sku]['fabric_consumed'] += item.fabric_consumed_sq_yards
        if item.sales_order.channel == 'DTC':
            sku_stats[sku]['dtc_units']       += item.quantity
        else:
            sku_stats[sku]['wholesale_units'] += item.quantity

    monthly = defaultdict(lambda: {'dtc_units': 0, 'wholesale_units': 0,
                                    'dtc_revenue': Decimal('0'), 'wholesale_revenue': Decimal('0')})
    for item in qs:
        key = item.sales_order.order_date.strftime('%Y-%m')
        if item.sales_order.channel == 'DTC':
            monthly[key]['dtc_units']    += item.quantity
            monthly[key]['dtc_revenue']  += item.unit_price * item.quantity
        else:
            monthly[key]['wholesale_units']   += item.quantity
            monthly[key]['wholesale_revenue'] += item.unit_price * item.quantity

    return Response({
        'sku_stats': list(sku_stats.values()),
        'monthly':   [{'month': k, **v} for k, v in sorted(monthly.items())],
    })


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def comparison(request):
    def period_stats(s, e):
        items     = SalesOrderItem.objects.select_related('sales_order', 'product').filter(
            sales_order__order_date__gte=s, sales_order__order_date__lte=e,
        )
        total_units  = sum(i.quantity for i in items)
        total_rev    = sum(i.unit_price * i.quantity for i in items)
        total_fabric = sum(i.fabric_consumed_sq_yards for i in items)
        sku_bd = {}
        for i in items:
            sku = i.product.sku
            if sku not in sku_bd:
                sku_bd[sku] = {'sku': sku, 'name': i.product.name, 'units': 0, 'revenue': Decimal('0')}
            sku_bd[sku]['units']   += i.quantity
            sku_bd[sku]['revenue'] += i.unit_price * i.quantity
        return {
            'start': s, 'end': e,
            'total_units': total_units,
            'total_revenue': float(total_rev),
            'total_fabric_consumed': total_fabric,
            'sku_breakdown': list(sku_bd.values()),
        }

    return Response({
        'period1': period_stats(request.query_params.get('start1'), request.query_params.get('end1')),
        'period2': period_stats(request.query_params.get('start2'), request.query_params.get('end2')),
    })
