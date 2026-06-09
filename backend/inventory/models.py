from django.db import models
from products.models import Product


class FabricStock(models.Model):
    color = models.CharField(max_length=100, unique=True)
    on_hand_sq_yards = models.FloatField(default=0)
    last_updated = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.color}: {self.on_hand_sq_yards} sq yd"


class FinishedGoodsInventory(models.Model):
    product = models.OneToOneField(Product, on_delete=models.CASCADE, related_name='inventory')
    on_hand_units = models.IntegerField(default=0)
    last_updated = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.product.sku}: {self.on_hand_units} units"

    class Meta:
        verbose_name_plural = "Finished Goods Inventory"


class InventoryLog(models.Model):
    LOG_TYPE_CHOICES = [
        ('fabric_receipt', 'Fabric Receipt'),
        ('finished_receipt', 'Finished Goods Receipt'),
        ('waste', 'Waste'),
        ('adjustment', 'Manual Adjustment'),
    ]
    product = models.ForeignKey(Product, on_delete=models.SET_NULL, null=True, blank=True)
    fabric_color = models.CharField(max_length=100, blank=True)
    quantity_change_units = models.IntegerField(null=True, blank=True)
    quantity_change_sq_yards = models.FloatField(null=True, blank=True)
    log_type = models.CharField(max_length=30, choices=LOG_TYPE_CHOICES)
    note = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(
        'users.User', on_delete=models.SET_NULL, null=True, blank=True
    )

    def __str__(self):
        return f"{self.log_type} at {self.created_at:%Y-%m-%d}"

    class Meta:
        ordering = ['-created_at']
