from django.db import models


class Supplier(models.Model):
    name = models.CharField(max_length=200)
    contact_email = models.EmailField(blank=True, null=True)
    lead_time_days = models.IntegerField(default=0)
    moq = models.FloatField(null=True, blank=True, help_text="Minimum order quantity")
    cost_per_unit = models.FloatField(null=True, blank=True)
    notes = models.TextField(blank=True)

    def __str__(self):
        return self.name


class ProductCategory(models.Model):
    CATEGORY_CHOICES = [('bag', 'Bag'), ('strap', 'Strap'), ('towel', 'Towel')]
    name = models.CharField(max_length=50, unique=True, choices=CATEGORY_CHOICES)

    def __str__(self):
        return self.name


class Product(models.Model):
    sku = models.CharField(max_length=100, unique=True)
    name = models.CharField(max_length=200)
    category = models.ForeignKey(ProductCategory, on_delete=models.PROTECT, related_name='products')
    color = models.CharField(max_length=100)
    fabric_consumption_sq_yards = models.FloatField(null=True, blank=True)
    supplier = models.ForeignKey(Supplier, on_delete=models.SET_NULL, null=True, blank=True)
    is_limited_edition = models.BooleanField(default=False)
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.sku} – {self.name}"
