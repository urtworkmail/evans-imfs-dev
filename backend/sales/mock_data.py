"""
Mock data generator for Shopify and QuickBooks sales.
Real API integrations replace generate_shopify_orders() and generate_quickbooks_orders().
"""
import random
from datetime import date, timedelta
from decimal import Decimal


PRODUCT_CONFIGS = {
    'GGB-SND': {'price': 149.00, 'peak_weight': 1.3, 'channel_mix': 0.65},
    'GGB-BLK': {'price': 149.00, 'peak_weight': 1.2, 'channel_mix': 0.60},
    'GGB-NVY': {'price': 149.00, 'peak_weight': 1.25, 'channel_mix': 0.65},
    'GGB-RED': {'price': 149.00, 'peak_weight': 1.1, 'channel_mix': 0.70},
    'GGB-OLV': {'price': 159.00, 'peak_weight': 1.15, 'channel_mix': 0.55},
    'GGB-TAN': {'price': 149.00, 'peak_weight': 1.2, 'channel_mix': 0.60},
    'GST-NVY': {'price': 45.00, 'peak_weight': 1.4, 'channel_mix': 0.50},
    'GST-BLK': {'price': 45.00, 'peak_weight': 1.35, 'channel_mix': 0.50},
    'GTW-WHT': {'price': 12.00, 'peak_weight': 1.5, 'channel_mix': 0.40},
    'GTW-NVY': {'price': 12.00, 'peak_weight': 1.45, 'channel_mix': 0.40},
    'GGB-LTD': {'price': 199.00, 'peak_weight': 0.8, 'channel_mix': 0.80},
}

BASE_MONTHLY_UNITS = {
    'GGB-SND': 18, 'GGB-BLK': 14, 'GGB-NVY': 16, 'GGB-RED': 6,
    'GGB-OLV': 10, 'GGB-TAN': 22, 'GST-NVY': 34, 'GST-BLK': 28,
    'GTW-WHT': 80, 'GTW-NVY': 70, 'GGB-LTD': 4,
}

PEAK_MONTHS = {4, 5, 6, 7, 8, 9}


def _seasonal_factor(month):
    return 1.2 if month in PEAK_MONTHS else 0.85


def generate_orders(source, since_date, up_to_date, channel):
    """
    Returns a list of dicts representing orders.
    source: 'shopify' or 'quickbooks'
    channel: 'DTC' or 'wholesale'
    """
    from products.models import Product
    products = {p.sku: p for p in Product.objects.filter(active=True)}
    orders = []
    current = since_date
    order_counter = 10000 + random.randint(0, 999)

    while current <= up_to_date:
        month = current.month
        sf = _seasonal_factor(month)

        for sku, cfg in PRODUCT_CONFIGS.items():
            product = products.get(sku)
            if not product:
                continue

            base = BASE_MONTHLY_UNITS[sku]
            daily_base = base / 30 * sf * cfg['peak_weight']

            # Channel split
            if channel == 'DTC':
                daily = daily_base * cfg['channel_mix']
            else:
                daily = daily_base * (1 - cfg['channel_mix'])

            # Stochastic: order happens if random threshold met
            if random.random() < daily:
                qty = random.randint(1, max(1, int(daily * 3)))
                order_counter += 1
                orders.append({
                    'external_id': f"{source.upper()}-{order_counter}",
                    'order_date': current,
                    'channel': channel,
                    'sku': sku,
                    'product': product,
                    'quantity': qty,
                    'unit_price': Decimal(str(cfg['price'])),
                    'total_revenue': Decimal(str(cfg['price'] * qty)),
                })

        current += timedelta(days=1)

    return orders


def generate_shopify_orders(since_date, up_to_date):
    return generate_orders('shopify', since_date, up_to_date, 'DTC')


def generate_quickbooks_orders(since_date, up_to_date):
    return generate_orders('quickbooks', since_date, up_to_date, 'wholesale')
