"""
Curated list of endpoints the status checker exercises. Intentionally a
static, hand-picked list of safe, side-effect-free GET endpoints covering
every app, rather than every route in the URLConf — action endpoints like
fetch/place-order/delete and detail routes needing a specific PK aren't
meaningful "is the app up" signals and would need production data to test
safely.
"""
from datetime import date, timedelta


def get_monitored_endpoints():
    today = date.today()
    period2_end   = today - timedelta(days=30)
    period1_start = (today - timedelta(days=29)).isoformat()
    period1_end   = today.isoformat()
    period2_start = (period2_end - timedelta(days=29)).isoformat()

    return [
        {'name': 'Products',            'path': '/api/products/'},
        {'name': 'Product Categories',  'path': '/api/categories/'},
        {'name': 'Suppliers',           'path': '/api/suppliers/'},
        {'name': 'Fabric Inventory',    'path': '/api/inventory/fabric/'},
        {'name': 'Finished Inventory',  'path': '/api/inventory/finished/'},
        {'name': 'Current Stock',       'path': '/api/inventory/current-stock/'},
        {'name': 'Inventory Logs',      'path': '/api/inventory/logs/'},
        {'name': 'Sales Orders',        'path': '/api/sales/orders/'},
        {'name': 'Sales Analysis',      'path': '/api/sales/analysis/'},
        {'name': 'Comparison Analysis', 'path': '/api/analysis/comparison/', 'params': {
            'start1': period1_start, 'end1': period1_end,
            'start2': period2_start, 'end2': period2_end.isoformat(),
        }},
        {'name': 'Forecast',            'path': '/api/forecast/'},
        {'name': 'Reorder Alerts',      'path': '/api/alerts/reorder/'},
        {'name': 'Purchase Orders',     'path': '/api/purchase-orders/'},
        {'name': 'Users',               'path': '/api/users/'},
        {'name': 'Current User',        'path': '/api/users/me/'},
        {'name': 'Active Sessions',     'path': '/api/users/sessions/'},
        {'name': 'Fetch Schedule',      'path': '/api/settings/fetch-schedule/'},
        {'name': 'System Settings',     'path': '/api/settings/system/'},
        {'name': 'Audit Log',           'path': '/api/audit-log/'},
        {'name': 'Fetch Status',        'path': '/api/fetch/status/'},
    ]
