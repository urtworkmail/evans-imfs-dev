"""
QuickBooks Online Integration — Real API
=========================================
Uses the QuickBooks Online REST API v3 (Intuit platform).

Setup:
1. Go to https://developer.intuit.com → Create app → QuickBooks Online + Payments
2. Get Client ID and Client Secret
3. Complete OAuth2 flow to get initial refresh token
4. Add to .env:
   QB_CLIENT_ID=ABxxxxxxxxxxxxxxxx
   QB_CLIENT_SECRET=xxxxxxxxxxxxxxxx
   QB_REALM_ID=1234567890          # Your QuickBooks company ID
   QB_REFRESH_TOKEN=xxxxxxx        # Long-lived refresh token
   QB_ENVIRONMENT=production       # sandbox | production

Matching: first tries the SKU field from the QuickBooks item,
then falls back to a temporary name‑based mapping (for items without SKU).
"""
import requests
import logging
from datetime import date
from decimal import Decimal
from django.conf import settings

logger = logging.getLogger(__name__)

QB_TOKEN_URL = {
    'sandbox':    'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer',
    'production': 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer',
}

QB_API_BASE = {
    'sandbox':    'https://sandbox-quickbooks.api.intuit.com/v3/company',
    'production': 'https://quickbooks.api.intuit.com/v3/company',
}

# ── TEMP FALLBACK: QuickBooks item name → local product SKU ─────
# Only used when the QuickBooks item has no SKU.
QB_NAME_TO_SKU = {
    'Evans Bag - Navy':           'EVN-GLFBAG-NVY',
    'Evans Bag - Black':          'EVN-GLFBAG-BLK',
    'Evans Bag - Green':          'EVN-GLFBAG-GRN',
    'Evans Bag - Maroon':         'EVN-GLFBAG-MAROON',
    'Evans Bag - Carolina Blue':  'EVN-GLFBAG-CAROLINA_BLUE',
    'Evans Bag - Light Grey':     'EVN-GLFBAG-LIGHT_GREY',
    'Evans Bag - Forest Green':   'EVN-GLFBAG-FOREST_GREEN',
    'Evans Bag - Red':            'EVN-GLFBAG-RED',
    'Towel Personalization':      'EVN-DEC-TWL',
    'Bag Personalization - Text': 'EVN-DEC-BAG-TEXT',
    'Bag Personalization - Logo': 'EVN-DEC-BAG-LOGO',
}


def _get_stored_refresh_token():
    """Read refresh token from DB (updated after each refresh)."""
    from settings_app.models import SystemSetting
    try:
        s = SystemSetting.objects.get(key='qb_refresh_token')
        return s.value
    except SystemSetting.DoesNotExist:
        return settings.QB_REFRESH_TOKEN


def _save_refresh_token(token: str):
    """Persist the new refresh token so the next call works."""
    from settings_app.models import SystemSetting
    SystemSetting.objects.update_or_create(
        key='qb_refresh_token',
        defaults={'value': token, 'description': 'QuickBooks OAuth2 refresh token (auto-updated)'}
    )


def _refresh_access_token() -> str:
    """Exchange refresh token for a new access token. Returns access token string."""
    refresh_token = _get_stored_refresh_token()
    if not refresh_token:
        raise ValueError("QuickBooks refresh token not set. Run OAuth flow first.")

    env = settings.QB_ENVIRONMENT
    resp = requests.post(
        QB_TOKEN_URL[env],
        auth=(settings.QB_CLIENT_ID, settings.QB_CLIENT_SECRET),
        data={
            'grant_type':    'refresh_token',
            'refresh_token': refresh_token,
        },
        headers={'Accept': 'application/json'},
        timeout=30,
    )
    resp.raise_for_status()
    token_data = resp.json()

    _save_refresh_token(token_data['refresh_token'])
    return token_data['access_token']


def _qb_headers(access_token: str) -> dict:
    return {
        'Authorization': f'Bearer {access_token}',
        'Accept':        'application/json',
        'Content-Type':  'application/json',
    }


def _get_product_by_sku(sku: str):
    from products.models import Product
    try:
        return Product.objects.get(sku=sku)
    except Product.DoesNotExist:
        return None


def fetch_orders(since_date: date, up_to_date: date) -> list:
    """
    Fetch QuickBooks Invoices between since_date and up_to_date.
    Returns list of order dicts compatible with sales/views.py _run_fetch().

    QuickBooks Invoices = wholesale orders (channel='wholesale')
    Matching priority:
      1) Use the SKU from the QuickBooks item (ItemRef.Sku).
      2) Fall back to a name‑based temporary mapping.
    """
    if not settings.QB_CLIENT_ID or not settings.QB_CLIENT_SECRET:
        raise ValueError(
            "QuickBooks not configured. Set QB_CLIENT_ID, QB_CLIENT_SECRET, "
            "QB_REALM_ID, QB_REFRESH_TOKEN in .env"
        )

    env    = settings.QB_ENVIRONMENT
    realm  = settings.QB_REALM_ID
    base   = f"{QB_API_BASE[env]}/{realm}"

    access_token = _refresh_access_token()
    headers      = _qb_headers(access_token)

    orders = []
    start_pos = 1
    page_size = 100

    while True:
        query = (
            f"SELECT * FROM Invoice "
            f"WHERE TxnDate >= '{since_date}' "
            f"AND TxnDate <= '{up_to_date}' "
            f"STARTPOSITION {start_pos} MAXRESULTS {page_size}"
        )
        resp = requests.get(
            f"{base}/query",
            headers=headers,
            params={'query': query, 'minorversion': '65'},
            timeout=30,
        )
        resp.raise_for_status()

        data     = resp.json()
        invoices = data.get('QueryResponse', {}).get('Invoice', [])

        if not invoices:
            break

        for invoice in invoices:
            invoice_id  = str(invoice['Id'])
            txn_date    = invoice['TxnDate']
            total_price = Decimal(str(invoice.get('TotalAmt', 0)))

            for line in invoice.get('Line', []):
                if line.get('DetailType') != 'SalesItemLineDetail':
                    continue

                detail     = line['SalesItemLineDetail']
                item_ref   = detail.get('ItemRef', {})
                item_name  = item_ref.get('name', '')
                item_sku   = item_ref.get('sku')            # ← the SKU field you saw

                # 1) Try the SKU field first (most reliable)
                product = _get_product_by_sku(item_sku) if item_sku else None

                # 2) Fall back to the temporary name‑based mapping
                if product is None:
                    mapped_sku = QB_NAME_TO_SKU.get(item_name)
                    if mapped_sku:
                        product = _get_product_by_sku(mapped_sku)

                if product is None:
                    logger.warning(f"QB item '{item_name}' (SKU={item_sku}) not matched — skipping")
                    continue

                qty        = float(detail.get('Qty', 1))
                unit_price = Decimal(str(detail.get('UnitPrice', 0)))

                orders.append({
                    'external_id':   f"QB-{invoice_id}_{item_name}",
                    'order_date':    date.fromisoformat(txn_date),
                    'channel':       'wholesale',
                    'product':       product,
                    'quantity':      int(qty),
                    'unit_price':    unit_price,
                    'total_revenue': unit_price * Decimal(str(qty)),
                })

        if len(invoices) < page_size:
            break
        start_pos += page_size

    logger.info(f"QuickBooks: fetched {len(orders)} line items from {since_date} to {up_to_date}")
    return orders
