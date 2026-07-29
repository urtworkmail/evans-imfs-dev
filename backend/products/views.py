from rest_framework import viewsets, permissions
from .models import Supplier, ProductCategory, Product
from .serializers import SupplierSerializer, ProductCategorySerializer, ProductSerializer
from users.permissions import ActionPermission
import django_filters.rest_framework as filters


class SupplierViewSet(viewsets.ModelViewSet):
    queryset = Supplier.objects.all().order_by('name')
    serializer_class = SupplierSerializer
    permission_classes = [ActionPermission]
    permission_map = {
        'create':         'suppliers.create',
        'update':         'suppliers.edit',
        'partial_update': 'suppliers.edit',
        'destroy':        'suppliers.delete',
    }


class ProductCategoryViewSet(viewsets.ModelViewSet):
    queryset = ProductCategory.objects.all()
    serializer_class = ProductCategorySerializer
    permission_classes = [ActionPermission]
    # Categories are product configuration — gated under the products.* keys
    # since there's no dedicated category permission in the persona model.
    permission_map = {
        'create':         'products.edit',
        'update':         'products.edit',
        'partial_update': 'products.edit',
        'destroy':        'products.edit',
    }


class ProductViewSet(viewsets.ModelViewSet):
    serializer_class = ProductSerializer
    permission_classes = [ActionPermission]
    permission_map = {
        'create':         'products.create',
        'update':         'products.edit',
        'partial_update': 'products.edit',
        'destroy':        'products.delete',
    }
    filter_backends = [filters.DjangoFilterBackend]
    filterset_fields = ['active', 'category', 'color']

    def get_queryset(self):
        qs = Product.objects.select_related('category', 'supplier').order_by('sku')
        active_only = self.request.query_params.get('active_only', None)
        if active_only == 'true':
            qs = qs.filter(active=True)
        return qs
