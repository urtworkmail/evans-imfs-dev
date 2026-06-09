"""
QuickBooks Online Integration — Real API
=========================================
Uses the QuickBooks Online REST API v3 (Intuit platform).

Setup:
1. Go to https://developer.intuit.com → Create app → QuickBooks Online + Payments
2. Get Client ID and Client Secret
3. Complete OAuth2 flow to get initial refresh token:
   - Use the Intuit OAuth Playground: https://developer.intuit.com/app/developer/playground
   - Or run: python manage.py qb_oauth  (management command below)
4. Add to .env:
   QB_CLIENT_ID=ABxxxxxxxxxxxxxxxx
   QB_CLIENT_SECRET=xxxxxxxxxxxxxxxx
   QB_REALM_ID=1234567890          # Your QuickBooks company ID
   QB_REFRESH_TOKEN=xxxxxxx        # Long-lived refresh token
   QB_ENVIRONMENT=production       # sandbox | production

Token refresh is handled automatically — the new refresh token is saved back to DB
via the SystemSetting model so it persists across restarts.

Mapping: QuickBooks Invoice line items → SalesOrderItem (wholesale channel)
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

    # Save the new refresh token
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
    Maps line item Description or ItemRef Name to product SKU.
    """
    if not settings.QB_CLIENT_ID or not settings.QB_CLIENT_SECRET:
        raise ValueError(
            "QuickBooks not configured. Set QB_CLIENT_ID, QB_CLIENT_SECRET, QB_REALM_ID, QB_REFRESH_TOKEN in .env"
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
            txn_date    = invoice['TxnDate']  # YYYY-MM-DD
            total_price = Decimal(str(invoice.get('TotalAmt', 0)))

            for line in invoice.get('Line', []):
                if line.get('DetailType') != 'SalesItemLineDetail':
                    continue

                detail     = line['SalesItemLineDetail']
                item_name  = detail.get('ItemRef', {}).get('name', '')
                # Try to match SKU — QB items should be named with SKU
                product    = _get_product_by_sku(item_name)
                if not product:
                    # Try partial match on description
                    desc = line.get('Description', '')
                    product = _get_product_by_sku(desc.split()[0] if desc else '')

                if not product:
                    logger.warning(f"QB item '{item_name}' not matched to local product — skipping")
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
                    'total_revenue': unit_price * qty,
                })

        if len(invoices) < page_size:
            break
        start_pos += page_size

    logger.info(f"QuickBooks: fetched {len(orders)} line items from {since_date} to {up_to_date}")
    return orders
