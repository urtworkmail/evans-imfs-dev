from django.db import models
from products.models import Product


class SalesOrder(models.Model):
    SOURCE_CHOICES = [('shopify', 'Shopify'), ('quickbooks', 'QuickBooks')]
    CHANNEL_CHOICES = [('DTC', 'Direct to Consumer'), ('wholesale', 'Wholesale')]

    source = models.CharField(max_length=20, choices=SOURCE_CHOICES)
    external_id = models.CharField(max_length=200)
    order_date = models.DateField()
    channel = models.CharField(max_length=20, choices=CHANNEL_CHOICES)
    total_revenue = models.DecimalField(max_digits=10, decimal_places=2)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['source', 'external_id']
        ordering = ['-order_date']

    def __str__(self):
        return f"{self.source} #{self.external_id} ({self.order_date})"


class SalesOrderItem(models.Model):
    sales_order = models.ForeignKey(SalesOrder, on_delete=models.CASCADE, related_name='items')
    product = models.ForeignKey(Product, on_delete=models.PROTECT)
    quantity = models.IntegerField()
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    fabric_consumed_sq_yards = models.FloatField(default=0)

    def __str__(self):
        return f"{self.sales_order} — {self.product.sku} x{self.quantity}"


class FetchLog(models.Model):
    source = models.CharField(max_length=20)
    fetched_at = models.DateTimeField(auto_now_add=True)
    orders_fetched = models.IntegerField(default=0)
    status = models.CharField(max_length=20, default='success')
    message = models.TextField(blank=True)

    class Meta:
        ordering = ['-fetched_at']

    def __str__(self):
        return f"{self.source} fetch at {self.fetched_at:%Y-%m-%d %H:%M}"
