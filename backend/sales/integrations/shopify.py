"""
Shopify Integration — Real API
================================
Uses the Shopify REST Admin API (2024-01) to fetch orders.

Setup:
1. In your Shopify Admin → Settings → Apps → Develop apps
2. Create a private app, enable "Orders" read permission
3. Get the Access Token
4. Add to .env:
   SHOPIFY_SHOP_URL=yourshop.myshopify.com
   SHOPIFY_ACCESS_TOKEN=shpat_xxxxxxxxxxxxxxxxxx

The function `fetch_orders(since_date, up_to_date)` returns a list of
order dicts in the same format the mock generator returns — drop-in replacement.
"""
import requests
import logging
from datetime import date, timedelta
from decimal import Decimal
from django.conf import settings

logger = logging.getLogger(__name__)

SHOPIFY_API_VERSION = '2024-01'


def _shopify_headers():
    return {
        'X-Shopify-Access-Token': settings.SHOPIFY_ACCESS_TOKEN,
        'Content-Type': 'application/json',
    }


def _shopify_base_url():
    return f"https://{settings.SHOPIFY_SHOP_URL}/admin/api/{SHOPIFY_API_VERSION}"


def _get_product_by_sku(sku):
    """Resolve a Shopify SKU to our local Product FK."""
    from products.models import Product
    try:
        return Product.objects.get(sku=sku)
    except Product.DoesNotExist:
        return None


def fetch_orders(since_date: date, up_to_date: date) -> list:
    """
    Fetch Shopify orders between since_date and up_to_date.
    Returns list of order dicts compatible with sales/views.py _run_fetch().
    Raises requests.HTTPError on API failure.
    """
    if not settings.SHOPIFY_SHOP_URL or not settings.SHOPIFY_ACCESS_TOKEN:
        raise ValueError(
            "Shopify not configured. Set SHOPIFY_SHOP_URL and SHOPIFY_ACCESS_TOKEN in .env"
        )

    orders = []
    url    = f"{_shopify_base_url()}/orders.json"
    params = {
        'status':          'any',
        'created_at_min':  f"{since_date}T00:00:00Z",
        'created_at_max':  f"{up_to_date}T23:59:59Z",
        'limit':           250,
        'fields':          'id,created_at,line_items,financial_status,total_price',
    }

    while url:
        resp = requests.get(url, headers=_shopify_headers(), params=params, timeout=30)
        resp.raise_for_status()

        data = resp.json()
        raw_orders = data.get('orders', [])

        for order in raw_orders:
            order_date = order['created_at'][:10]  # YYYY-MM-DD
            total_rev  = Decimal(order.get('total_price', '0'))

            for item in order.get('line_items', []):
                sku     = item.get('sku', '')
                product = _get_product_by_sku(sku)
                if not product:
                    logger.warning(f"Shopify SKU '{sku}' not found in local products — skipping")
                    continue

                qty        = int(item.get('quantity', 1))
                unit_price = Decimal(str(item.get('price', '0')))

                orders.append({
                    'external_id':  str(order['id']) + f"_{sku}",
                    'order_date':   date.fromisoformat(order_date),
                    'channel':      'DTC',
                    'product':      product,
                    'quantity':     qty,
                    'unit_price':   unit_price,
                    'total_revenue': unit_price * qty,
                })

        # Handle pagination via Link header
        link_header = resp.headers.get('Link', '')
        url = None
        params = {}  # params are embedded in the next page URL
        if 'rel="next"' in link_header:
            for part in link_header.split(','):
                if 'rel="next"' in part:
                    url = part.split(';')[0].strip().strip('<>')
                    break

    logger.info(f"Shopify: fetched {len(orders)} line items from {since_date} to {up_to_date}")
    return orders
