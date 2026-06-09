from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = 'Seed initial Greenway Golf data'

    def handle(self, *args, **options):
        self._seed_users()
        self._seed_categories()
        self._seed_suppliers()
        self._seed_products()
        self._seed_inventory()
        self.stdout.write(self.style.SUCCESS('✓ Database seeded successfully'))
        self.stdout.write(self.style.SUCCESS('  Admin login: admin / admin123'))

    def _seed_users(self):
        from users.models import User
        users = [
            {'username': 'admin',   'email': 'admin@evansgolfimfs.com',   'first_name': 'Ali',   'last_name': 'Khan',   'role': 'admin',           'password': 'admin123',     'is_superuser': True, 'is_staff': True},
            {'username': 'sara',    'email': 'sara@evansgolfimfs.com',    'first_name': 'Sara',  'last_name': 'Malik',  'role': 'general_manager', 'password': 'manager123'},
            {'username': 'omar',    'email': 'omar@evansgolfimfs.com',    'first_name': 'Omar',  'last_name': 'Raza',   'role': 'viewer',          'password': 'viewer123'},
            {'username': 'zara',    'email': 'zara@evansgolfimfs.com',    'first_name': 'Zara',  'last_name': 'Ahmed',  'role': 'warehouse_manager','password': 'warehouse123'},
        ]
        for u in users:
            if not User.objects.filter(username=u['username']).exists():
                password = u.pop('password')
                is_superuser = u.pop('is_superuser', False)
                is_staff = u.pop('is_staff', False)
                user = User(**u, is_superuser=is_superuser, is_staff=is_staff)
                user.set_password(password)
                user.save()
                self.stdout.write(f'  Created user: {u["username"]}')

    def _seed_categories(self):
        from products.models import ProductCategory
        for name in ['bag', 'strap', 'towel']:
            ProductCategory.objects.get_or_create(name=name)
        self.stdout.write('  ✓ Categories seeded')

    def _seed_suppliers(self):
        from products.models import Supplier
        suppliers = [
            {'name': 'Lakeside Fabrics',    'contact_email': 'orders@lakeside.com',  'lead_time_days': 21, 'moq': 50,  'cost_per_unit': 18.50, 'notes': 'Primary fabric supplier.'},
            {'name': 'Eastern Textile Co.', 'contact_email': 'sales@eastern.com',    'lead_time_days': 14, 'moq': 30,  'cost_per_unit': 15.00, 'notes': 'Secondary supplier, faster lead time.'},
            {'name': 'Ready Goods Inc.',    'contact_email': 'contact@readygoods.com','lead_time_days': 7,  'moq': 100, 'cost_per_unit': 4.50,  'notes': 'Pre-made towel supplier.'},
        ]
        for s in suppliers:
            Supplier.objects.get_or_create(name=s['name'], defaults=s)
        self.stdout.write('  ✓ Suppliers seeded')

    def _seed_products(self):
        from products.models import Product, ProductCategory, Supplier
        lakeside  = Supplier.objects.get(name='Lakeside Fabrics')
        eastern   = Supplier.objects.get(name='Eastern Textile Co.')
        readygoods= Supplier.objects.get(name='Ready Goods Inc.')
        bag   = ProductCategory.objects.get(name='bag')
        strap = ProductCategory.objects.get(name='strap')
        towel = ProductCategory.objects.get(name='towel')

        products = [
            {'sku':'GGB-SND','name':'Sand Dune Golf Bag',         'category':bag,  'color':'Sand Dune','fabric_consumption_sq_yards':4.5, 'supplier':lakeside},
            {'sku':'GGB-BLK','name':'Black Golf Bag',             'category':bag,  'color':'Black',    'fabric_consumption_sq_yards':4.5, 'supplier':lakeside},
            {'sku':'GGB-NVY','name':'Navy Golf Bag',              'category':bag,  'color':'Navy',     'fabric_consumption_sq_yards':4.5, 'supplier':lakeside},
            {'sku':'GGB-RED','name':'Red Golf Bag',               'category':bag,  'color':'Red',      'fabric_consumption_sq_yards':4.5, 'supplier':lakeside},
            {'sku':'GGB-OLV','name':'Olive Golf Bag',             'category':bag,  'color':'Olive',    'fabric_consumption_sq_yards':4.5, 'supplier':lakeside},
            {'sku':'GGB-TAN','name':'Tan Golf Bag',               'category':bag,  'color':'Tan',      'fabric_consumption_sq_yards':4.5, 'supplier':eastern},
            {'sku':'GST-NVY','name':'Navy Carry Strap',           'category':strap,'color':'Navy',     'fabric_consumption_sq_yards':1.2, 'supplier':eastern},
            {'sku':'GST-BLK','name':'Black Carry Strap',          'category':strap,'color':'Black',    'fabric_consumption_sq_yards':1.2, 'supplier':eastern},
            {'sku':'GTW-WHT','name':'White Golf Towel',           'category':towel,'color':'White',    'fabric_consumption_sq_yards':None,'supplier':readygoods},
            {'sku':'GTW-NVY','name':'Navy Golf Towel',            'category':towel,'color':'Navy',     'fabric_consumption_sq_yards':None,'supplier':readygoods},
            {'sku':'GGB-LTD','name':'Coral Limited Edition Bag',  'category':bag,  'color':'Coral',    'fabric_consumption_sq_yards':5.0, 'supplier':lakeside,'is_limited_edition':True},
        ]
        for p in products:
            Product.objects.get_or_create(sku=p['sku'], defaults=p)
        self.stdout.write('  ✓ Products seeded')

    def _seed_inventory(self):
        from products.models import Product
        from inventory.models import FabricStock, FinishedGoodsInventory
        fabric_data = [
            ('Sand Dune',420),('Black',185),('Navy',310),('Red',55),
            ('Olive',280),('Tan',140),('Coral',30),('White',0),
        ]
        for color, qty in fabric_data:
            FabricStock.objects.get_or_create(color=color, defaults={'on_hand_sq_yards': qty})
        finished_data = {
            'GGB-SND':34,'GGB-BLK':12,'GGB-NVY':28,'GGB-RED':5,
            'GGB-OLV':19,'GGB-TAN':41,'GST-NVY':62,'GST-BLK':48,
            'GTW-WHT':200,'GTW-NVY':175,'GGB-LTD':3,
        }
        for sku, qty in finished_data.items():
            try:
                product = Product.objects.get(sku=sku)
                FinishedGoodsInventory.objects.get_or_create(product=product, defaults={'on_hand_units': qty})
            except Product.DoesNotExist:
                pass
        self.stdout.write('  ✓ Inventory seeded')
