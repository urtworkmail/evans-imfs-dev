from rest_framework.decorators import api_view, permission_classes
from rest_framework import permissions
from rest_framework.response import Response
from django.conf import settings
from datetime import date, timedelta

from products.models import Product
from inventory.models import FabricStock, FinishedGoodsInventory
from sales.models import SalesOrderItem


def _get_weights():
    """
    Read forecast weights from SystemSetting DB (admin-configurable),
    falling back to settings.py defaults.
    """
    from settings_app.models import SystemSetting
    defaults = {
        'w1': getattr(settings, 'FORECAST_WEIGHT_MONTH1', 0.50),
        'w2': getattr(settings, 'FORECAST_WEIGHT_MONTH2', 0.30),
        'w3': getattr(settings, 'FORECAST_WEIGHT_MONTH3', 0.20),
    }
    try:
        w1 = float(SystemSetting.objects.get(key='forecast_weight_month1').value)
        w2 = float(SystemSetting.objects.get(key='forecast_weight_month2').value)
        w3 = float(SystemSetting.objects.get(key='forecast_weight_month3').value)
        total = w1 + w2 + w3
        if total > 0:
            # Normalise so they always sum to 1.0
            return w1 / total, w2 / total, w3 / total
    except Exception:
        pass
    return defaults['w1'], defaults['w2'], defaults['w3']


def _get_burn_rates(product):
    """
    Weighted moving average over last 90 days.
    Weights are configurable per month via Settings page.
    Returns (daily_burn, units_month1, units_month2, units_month3)
    """
    today = date.today()
    w1, w2, w3 = _get_weights()

    def units_in_range(s, e):
        return sum(
            i.quantity for i in SalesOrderItem.objects.filter(
                product=product,
                sales_order__order_date__gte=s,
                sales_order__order_date__lte=e,
            )
        )

    p1_start = today - timedelta(days=30)
    p2_start = today - timedelta(days=60)
    p3_start = today - timedelta(days=90)

    u1 = units_in_range(p1_start, today - timedelta(days=1))
    u2 = units_in_range(p2_start, today - timedelta(days=31))
    u3 = units_in_range(p3_start, today - timedelta(days=61))

    weighted_monthly = (u1 * w1) + (u2 * w2) + (u3 * w3)
    daily = weighted_monthly / 30 if weighted_monthly else 0
    return daily, u1, u2, u3


def _season_multiplier(month):
    peak = getattr(settings, 'PEAK_SEASON_MONTHS', [4, 5, 6, 7, 8, 9])
    mult = getattr(settings, 'PEAK_SEASON_MULTIPLIER', 1.15)
    return mult if month in peak else 1.0


def _cover_days(on_hand, daily_burn):
    if daily_burn > 0:
        return on_hand / daily_burn
    # No recent demand: treat zero stock as critical (nothing to sell if demand
    # picks up), not "overstock" — overstock only makes sense when there's
    # stock sitting unsold.
    return 9999 if on_hand > 0 else 0


def _status(cover_days_val, lead_days):
    overstock = getattr(settings, 'OVERSTOCK_DAYS', 90)
    buffer    = getattr(settings, 'SAFETY_BUFFER_DAYS', 14)
    if cover_days_val > overstock:        return 'overstock'
    if cover_days_val < lead_days + 7:    return 'critical'
    if cover_days_val < lead_days + buffer: return 'low'
    return 'healthy'


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def forecast(request):
    results = []
    today   = date.today()
    w1, w2, w3 = _get_weights()

    for product in Product.objects.select_related('supplier', 'category').filter(active=True):
        daily_burn, u1, u2, u3 = _get_burn_rates(product)
        try:
            inv     = FinishedGoodsInventory.objects.get(product=product)
            on_hand = inv.on_hand_units
        except FinishedGoodsInventory.DoesNotExist:
            on_hand = 0

        lead_days = product.supplier.lead_time_days if product.supplier else 14
        cover     = _cover_days(on_hand, daily_burn)
        status    = _status(cover, lead_days)

        projections = []
        for i in range(6):
            m          = (today.month + i - 1) % 12 + 1
            mult       = _season_multiplier(m)
            projected  = round(daily_burn * 30 * mult)
            year       = today.year + (today.month + i - 1) // 12
            month_label= date(year, m, 1).strftime('%b %Y')
            projections.append({'month': month_label, 'projected_units': projected})

        results.append({
            'product_id':   product.id,
            'sku':          product.sku,
            'name':         product.name,
            'category':     product.category.name,
            'color':        product.color,
            'fabric_consumption_sq_yards': product.fabric_consumption_sq_yards,
            'on_hand':      on_hand,
            'daily_burn':   round(daily_burn, 2),
            'weekly_burn':  round(daily_burn * 7, 1),
            'monthly_burn': round(daily_burn * 30, 1),
            'cover_days':   round(cover, 1) if cover < 9999 else None,
            'lead_days':    lead_days,
            'status':       status,
            'sales_month1': u1,
            'sales_month2': u2,
            'sales_month3': u3,
            'weight_month1': round(w1 * 100, 1),
            'weight_month2': round(w2 * 100, 1),
            'weight_month3': round(w3 * 100, 1),
            'projections':  projections,
        })

    return Response(results)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def reorder_alerts(request):
    today   = date.today()
    alerts  = []
    buffer  = getattr(settings, 'SAFETY_BUFFER_DAYS', 14)

    for product in Product.objects.select_related('supplier', 'category').filter(active=True):
        daily_burn, u1, _, _ = _get_burn_rates(product)
        try:
            inv     = FinishedGoodsInventory.objects.get(product=product)
            on_hand = inv.on_hand_units
        except FinishedGoodsInventory.DoesNotExist:
            on_hand = 0

        lead_days = product.supplier.lead_time_days if product.supplier else 14
        moq       = product.supplier.moq            if product.supplier else 1
        cost      = product.supplier.cost_per_unit  if product.supplier else 0
        cover     = _cover_days(on_hand, daily_burn)
        status    = _status(cover, lead_days)

        rec_raw   = max(0, (lead_days + buffer) * daily_burn - on_hand)
        rec_qty   = 0 if rec_raw == 0 else max(moq or 1, int(-(-rec_raw // (moq or 1)) * (moq or 1)))

        order_by_days = cover - lead_days
        if order_by_days <= 0:
            order_by_label = 'Today'
            order_by_date  = str(today)
        else:
            order_by_date  = str(today + timedelta(days=int(order_by_days)))
            order_by_label = order_by_date

        alerts.append({
            'type':             'finished_goods',
            'item':             product.name,
            'sku':              product.sku,
            'product_id':       product.id,
            'supplier_id':      product.supplier_id,
            'category':         product.category.name,
            'on_hand':          on_hand,
            'unit':             'units',
            'daily_burn':       round(daily_burn, 2),
            'cover_days':       round(cover, 1) if cover < 9999 else None,
            'status':           status,
            'order_by_date':    order_by_date,
            'order_by_label':   order_by_label,
            'recommended_qty':  rec_qty,
            'cost_estimate':    round(rec_qty * (cost or 0), 2),
            'supplier':         product.supplier.name if product.supplier else None,
            'lead_days':        lead_days,
        })

    for fabric in FabricStock.objects.all():
        products_using = Product.objects.filter(color=fabric.color, active=True).select_related('supplier')
        daily_sq = sum(
            _get_burn_rates(p)[0] * (p.fabric_consumption_sq_yards or 0)
            for p in products_using
        )
        cover     = _cover_days(fabric.on_hand_sq_yards, daily_sq)
        lead_days = 21
        if products_using.exists() and products_using.first().supplier:
            lead_days = products_using.first().supplier.lead_time_days
        status    = _status(cover, lead_days)
        moq_sq    = 50

        rec_raw   = max(0, (lead_days + buffer) * daily_sq - fabric.on_hand_sq_yards)
        rec_sq    = 0 if rec_raw == 0 else max(moq_sq, int(-(-rec_raw // moq_sq) * moq_sq))

        order_by_days = cover - lead_days
        order_by_date  = str(today) if order_by_days <= 0 else str(today + timedelta(days=int(order_by_days)))
        order_by_label = 'Today' if order_by_days <= 0 else order_by_date

        alerts.append({
            'type':            'fabric',
            'item':            f"{fabric.color} Fabric",
            'sku':             'FABRIC',
            'product_id':      None,
            'supplier_id':     None,
            'category':        'fabric',
            'on_hand':         fabric.on_hand_sq_yards,
            'unit':            'sq yd',
            'daily_burn':      round(daily_sq, 2),
            'cover_days':      round(cover, 1) if cover < 9999 else None,
            'status':          status,
            'order_by_date':   order_by_date,
            'order_by_label':  order_by_label,
            'recommended_qty': rec_sq,
            'cost_estimate':   round(rec_sq * 18.5, 2),
            'supplier':        'Lakeside Fabrics',
            'lead_days':       lead_days,
        })

    status_order = {'critical': 0, 'low': 1, 'healthy': 2, 'overstock': 3}
    alerts.sort(key=lambda x: (status_order.get(x['status'], 4), x['cover_days'] or 9999))
    return Response(alerts)
