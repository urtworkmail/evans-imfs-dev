from rest_framework import viewsets, permissions
from .models import Supplier, ProductCategory, Product
from .serializers import SupplierSerializer, ProductCategorySerializer, ProductSerializer
import django_filters.rest_framework as filters


class SupplierViewSet(viewsets.ModelViewSet):
    queryset = Supplier.objects.all().order_by('name')
    serializer_class = SupplierSerializer
    permission_classes = [permissions.IsAuthenticated]


class ProductCategoryViewSet(viewsets.ModelViewSet):
    queryset = ProductCategory.objects.all()
    serializer_class = ProductCategorySerializer
    permission_classes = [permissions.IsAuthenticated]


class ProductViewSet(viewsets.ModelViewSet):
    serializer_class = ProductSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [filters.DjangoFilterBackend]
    filterset_fields = ['active', 'category', 'color']

    def get_queryset(self):
        qs = Product.objects.select_related('category', 'supplier').order_by('sku')
        active_only = self.request.query_params.get('active_only', None)
        if active_only == 'true':
            qs = qs.filter(active=True)
        return qs
