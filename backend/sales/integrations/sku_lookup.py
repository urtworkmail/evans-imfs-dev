"""
Fallback name → SKU mapping, shared by the Shopify and QuickBooks
integrations. Used only when a line item arrives with no SKU at all
(some personalization/decoration items, and apparently at least one
bag variant, aren't SKU-tagged on the Shopify side) — matched by exact
item name as a last resort before giving up on that line item.

This is a stopgap, not a fix: the real fix is making sure every
sellable item/variant has a SKU set at the source (Shopify/QuickBooks).
Keep this mapping in sync with products.models.Product if new
unSKU'd item names show up in the fetch logs.
"""
NAME_TO_SKU = {
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
