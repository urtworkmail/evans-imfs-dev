from django.db import models
from products.models import Supplier, Product
from inventory.models import FabricStock


class PurchaseOrder(models.Model):
    STATUS_CHOICES = [
        ('draft',     'Draft'),
        ('sent',      'Sent to Supplier'),
        ('confirmed', 'Confirmed'),
        ('received',  'Received'),
        ('cancelled', 'Cancelled'),
    ]
    TYPE_CHOICES = [
        ('finished_goods', 'Finished Goods'),
        ('fabric',         'Fabric'),
    ]

    po_number       = models.CharField(max_length=50, unique=True)
    supplier        = models.ForeignKey(Supplier, on_delete=models.PROTECT, null=True, blank=True)
    order_type      = models.CharField(max_length=20, choices=TYPE_CHOICES, default='finished_goods')
    status          = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    notes           = models.TextField(blank=True)
    estimated_cost  = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    created_by      = models.ForeignKey('users.User', on_delete=models.SET_NULL, null=True, blank=True)
    created_at      = models.DateTimeField(auto_now_add=True)
    updated_at      = models.DateTimeField(auto_now=True)
    expected_date   = models.DateField(null=True, blank=True)
    received_at     = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"PO#{self.po_number} — {self.supplier} ({self.status})"


class PurchaseOrderItem(models.Model):
    purchase_order  = models.ForeignKey(PurchaseOrder, on_delete=models.CASCADE, related_name='items')
    # For finished goods
    product         = models.ForeignKey(Product, on_delete=models.SET_NULL, null=True, blank=True)
    # For fabric
    fabric_color    = models.CharField(max_length=100, blank=True)
    item_label      = models.CharField(max_length=200)  # display name
    quantity        = models.FloatField()
    unit            = models.CharField(max_length=20, default='units')  # units | sq yd
    unit_cost       = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    received_qty    = models.FloatField(default=0)

    @property
    def total_cost(self):
        return float(self.unit_cost) * self.quantity

    def __str__(self):
        return f"{self.item_label} x{self.quantity}"
