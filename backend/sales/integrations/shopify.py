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

The function `fetch_orders(since_date, up_to_date)` returns
(orders, log_entries) — orders in the same dict format the mock
generator used to return, and log_entries as a list of (level, message)
tuples for persisting to FetchLogDetail (see sales/views.py).

Matching priority: SKU field first, then a name-based fallback
(sales.integrations.sku_lookup.NAME_TO_SKU) for items with no SKU at
all — some personalization/decoration items aren't SKU-tagged.
"""
import requests
import logging
from datetime import date
from decimal import Decimal
from django.conf import settings

from .sku_lookup import NAME_TO_SKU

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


def fetch_orders(since_date: date, up_to_date: date) -> tuple:
    """
    Fetch Shopify orders between since_date and up_to_date.
    Returns (orders, log_entries) — orders is a list of dicts compatible
    with sales/views.py _run_fetch(); log_entries is a list of
    (level, message) tuples describing what happened, for persistence.
    Raises requests.HTTPError on API failure.
    """
    if not settings.SHOPIFY_SHOP_URL or not settings.SHOPIFY_ACCESS_TOKEN:
        raise ValueError(
            "Shopify not configured. Set SHOPIFY_SHOP_URL and SHOPIFY_ACCESS_TOKEN in .env"
        )

    orders = []
    log_entries = []
    url    = f"{_shopify_base_url()}/orders.json"
    params = {
        'status':          'any',
        'created_at_min':  f"{since_date}T00:00:00Z",
        'created_at_max':  f"{up_to_date}T23:59:59Z",
        'limit':           250,
        'fields':          'id,name,created_at,line_items,financial_status,total_price',
    }

    while url:
        resp = requests.get(url, headers=_shopify_headers(), params=params, timeout=30)
        resp.raise_for_status()

        data = resp.json()
        raw_orders = data.get('orders', [])

        for order in raw_orders:
            order_date  = order['created_at'][:10]  # YYYY-MM-DD
            order_label = order.get('name') or order['id']

            for item in order.get('line_items', []):
                sku       = item.get('sku') or ''
                item_name = item.get('name') or item.get('title') or ''
                product   = _get_product_by_sku(sku) if sku else None

                # Fallback: some items (personalization add-ons, and at
                # least one bag variant) have no SKU set in Shopify at all.
                if product is None and item_name in NAME_TO_SKU:
                    product = _get_product_by_sku(NAME_TO_SKU[item_name])

                if product is None:
                    msg = f"Order {order_label}: item '{item_name}' (SKU='{sku}') not matched — skipping"
                    logger.warning(msg)
                    log_entries.append(('warning', msg))
                    continue

                qty        = int(item.get('quantity', 1))
                unit_price = Decimal(str(item.get('price', '0')))

                orders.append({
                    # item['id'] (Shopify's own line-item id) keeps this
                    # unique even when two items on the same order both
                    # have a blank SKU — using sku alone would collide.
                    'external_id':  f"{order['id']}_{item['id']}",
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

    summary = f"Shopify: fetched {len(orders)} line items from {since_date} to {up_to_date}"
    logger.info(summary)
    log_entries.append(('info', summary))
    return orders, log_entries
