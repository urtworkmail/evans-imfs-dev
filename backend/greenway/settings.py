from pathlib import Path
from datetime import timedelta
import os
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent
SECRET_KEY = os.environ.get('SECRET_KEY', 'local-dev-secret-key-not-for-production')
DEBUG = os.environ.get('DEBUG', 'True') == 'True'

_hosts = os.environ.get('ALLOWED_HOSTS', 'localhost,127.0.0.1,backend')
ALLOWED_HOSTS = [h.strip() for h in _hosts.split(',')]

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'rest_framework_simplejwt',
    'corsheaders',
    'django_filters',
    'django_celery_beat',
    'inventory',
    'products',
    'sales',
    'users',
    'settings_app',
    'forecasting',
    'purchasing',
    'auditlog',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'greenway.urls'

TEMPLATES = [{
    'BACKEND': 'django.template.backends.django.DjangoTemplates',
    'DIRS': [],
    'APP_DIRS': True,
    'OPTIONS': {'context_processors': [
        'django.template.context_processors.debug',
        'django.template.context_processors.request',
        'django.contrib.auth.context_processors.auth',
        'django.contrib.messages.context_processors.messages',
    ]},
}]

WSGI_APPLICATION = 'greenway.wsgi.application'

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME':     os.environ.get('DB_NAME',     'greenway_db'),
        'USER':     os.environ.get('DB_USER',     'greenway'),
        'PASSWORD': os.environ.get('DB_PASSWORD', 'greenway_secret'),
        'HOST':     os.environ.get('DB_HOST',     'db'),
        'PORT':     os.environ.get('DB_PORT',     '5432'),
        'CONN_MAX_AGE': 60,
    }
}

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

AUTH_USER_MODEL = 'users.User'

LANGUAGE_CODE = 'en-us'
TIME_ZONE     = 'UTC'
USE_I18N      = True
USE_TZ        = True

STATIC_URL  = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': ('rest_framework_simplejwt.authentication.JWTAuthentication',),
    'DEFAULT_PERMISSION_CLASSES':     ('rest_framework.permissions.IsAuthenticated',),
    'DEFAULT_FILTER_BACKENDS':        ['django_filters.rest_framework.DjangoFilterBackend'],
    'DEFAULT_PAGINATION_CLASS':       'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 200,
}

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME':  timedelta(hours=8),
    # Default/fallback only — the actual login session length is set per-login
    # in users.auth_views from the admin-configurable "login_lifetime_hours"
    # system setting (default 24h). Rotation is off so that value is a real,
    # fixed deadline from the moment of login, not something that quietly
    # extends every time the app refreshes the access token.
    'REFRESH_TOKEN_LIFETIME': timedelta(hours=24),
    'ROTATE_REFRESH_TOKENS':  False,
}

_cors = os.environ.get('CORS_ALLOWED_ORIGINS', 'http://localhost:8080,http://127.0.0.1:8080')
CORS_ALLOWED_ORIGINS   = [o.strip() for o in _cors.split(',')]
CORS_ALLOW_CREDENTIALS = True

# ── Celery ───────────────────────────────────────────────
REDIS_URL             = os.environ.get('REDIS_URL', 'redis://redis:6379/0')
CELERY_BROKER_URL     = REDIS_URL
CELERY_RESULT_BACKEND = REDIS_URL
CELERY_BEAT_SCHEDULER = 'django_celery_beat.schedulers:DatabaseScheduler'
CELERY_TIMEZONE       = 'UTC'

# ── Shopify ──────────────────────────────────────────────
SHOPIFY_SHOP_URL     = os.environ.get('SHOPIFY_SHOP_URL', '')
SHOPIFY_ACCESS_TOKEN = os.environ.get('SHOPIFY_ACCESS_TOKEN', '')

# ── QuickBooks ───────────────────────────────────────────
QB_CLIENT_ID      = os.environ.get('QB_CLIENT_ID', '')
QB_CLIENT_SECRET  = os.environ.get('QB_CLIENT_SECRET', '')
QB_REALM_ID       = os.environ.get('QB_REALM_ID', '')
QB_REFRESH_TOKEN  = os.environ.get('QB_REFRESH_TOKEN', '')
QB_ENVIRONMENT    = os.environ.get('QB_ENVIRONMENT', 'sandbox')  # sandbox | production

# ── Business logic ───────────────────────────────────────
OVERSTOCK_DAYS         = 90
SAFETY_BUFFER_DAYS     = 14
PEAK_SEASON_MONTHS     = [4, 5, 6, 7, 8, 9]
PEAK_SEASON_MULTIPLIER = 1.15

# How long a login session lasts before requiring re-authentication.
# Overridable at runtime via the SystemSetting 'login_lifetime_hours'
# (Settings -> Security in the UI).
LOGIN_LIFETIME_HOURS = 24

# ── Database backups ──────────────────────────────────────
# Triggered by actual data changes (a fetch that creates new orders),
# not a fixed schedule — see sales.views._run_fetch and
# settings_app.backup. Mounted to the host's backups/ dir in
# docker-compose so files survive container rebuilds.
BACKUP_DIR = os.environ.get('BACKUP_DIR', '/app/backups')
BACKUP_KEEP = int(os.environ.get('BACKUP_KEEP', '4'))

# Forecast weighting — 3 months, must sum to 1.0
# Month1 = most recent 30 days, Month2 = 31-60 days ago, Month3 = 61-90 days ago
FORECAST_WEIGHT_MONTH1 = 0.50  # 50%
FORECAST_WEIGHT_MONTH2 = 0.30  # 30%
FORECAST_WEIGHT_MONTH3 = 0.20  # 20%

# ── Permissions module definitions ───────────────────────
# These define what the UI shows in the permissions tree
PERMISSION_MODULES = [
    {
        'key': 'dashboard',
        'label': 'Dashboard',
        'permissions': [
            {'key': 'dashboard.view', 'label': 'View dashboard'},
        ],
    },
    {
        'key': 'inventory',
        'label': 'Inventory',
        'permissions': [
            {'key': 'inventory.view',   'label': 'View inventory'},
            {'key': 'inventory.log',    'label': 'Log adjustments'},
            {'key': 'inventory.export', 'label': 'Export data'},
        ],
    },
    {
        'key': 'products',
        'label': 'Products',
        'permissions': [
            {'key': 'products.view',   'label': 'View products'},
            {'key': 'products.create', 'label': 'Create products'},
            {'key': 'products.edit',   'label': 'Edit products'},
            {'key': 'products.delete', 'label': 'Deactivate products'},
        ],
    },
    {
        'key': 'suppliers',
        'label': 'Suppliers',
        'permissions': [
            {'key': 'suppliers.view',   'label': 'View suppliers'},
            {'key': 'suppliers.create', 'label': 'Add suppliers'},
            {'key': 'suppliers.edit',   'label': 'Edit suppliers'},
            {'key': 'suppliers.delete', 'label': 'Delete suppliers'},
        ],
    },
    {
        'key': 'sales',
        'label': 'Sales',
        'permissions': [
            {'key': 'sales.view',  'label': 'View sales data'},
            {'key': 'sales.fetch', 'label': 'Fetch from Shopify / QuickBooks'},
        ],
    },
    {
        'key': 'forecasting',
        'label': 'Forecasting',
        'permissions': [
            {'key': 'forecasting.view', 'label': 'View forecasts'},
        ],
    },
    {
        'key': 'reorder',
        'label': 'Reorder Planner',
        'permissions': [
            {'key': 'reorder.view',  'label': 'View reorder planner'},
            {'key': 'reorder.order', 'label': 'Place purchase orders'},
        ],
    },
    {
        'key': 'comparison',
        'label': 'Comparison Analysis',
        'permissions': [
            {'key': 'comparison.view', 'label': 'View comparison analysis'},
        ],
    },
    {
        'key': 'settings',
        'label': 'Settings',
        'permissions': [
            {'key': 'settings.view', 'label': 'View settings'},
            {'key': 'settings.edit', 'label': 'Edit settings'},
        ],
    },
    {
        'key': 'users',
        'label': 'User Management',
        'permissions': [
            {'key': 'users.view',   'label': 'View users'},
            {'key': 'users.create', 'label': 'Create users'},
            {'key': 'users.edit',   'label': 'Edit users'},
            {'key': 'users.delete', 'label': 'Delete users'},
        ],
    },
]

# Persona presets — what each role gets by default
PERMISSION_PERSONAS = {
    'admin': {
        'label': 'Super Admin',
        'description': 'Full access to everything',
        'permissions': ['*'],  # wildcard = all
    },
    'general_manager': {
        'label': 'General Manager',
        'description': 'Full visibility, can manage products/suppliers/sales, cannot manage users or system settings',
        'permissions': [
            'dashboard.view',
            'inventory.view', 'inventory.log', 'inventory.export',
            'products.view', 'products.create', 'products.edit', 'products.delete',
            'suppliers.view', 'suppliers.create', 'suppliers.edit', 'suppliers.delete',
            'sales.view', 'sales.fetch',
            'forecasting.view',
            'reorder.view', 'reorder.order',
            'comparison.view',
        ],
    },
    'warehouse_manager': {
        'label': 'Warehouse Manager',
        'description': 'Can view and log inventory, view reorder planner and place orders. No financial or sales data.',
        'permissions': [
            'dashboard.view',
            'inventory.view', 'inventory.log',
            'products.view',
            'suppliers.view',
            'reorder.view', 'reorder.order',
        ],
    },
    'viewer': {
        'label': 'Viewer / Read Only',
        'description': 'Can view everything but cannot make any changes',
        'permissions': [
            'dashboard.view',
            'inventory.view',
            'products.view',
            'suppliers.view',
            'sales.view',
            'forecasting.view',
            'reorder.view',
            'comparison.view',
        ],
    },
    'sales_analyst': {
        'label': 'Sales Analyst',
        'description': 'Access to sales, forecasting, and comparison data only',
        'permissions': [
            'dashboard.view',
            'sales.view', 'sales.fetch',
            'forecasting.view',
            'comparison.view',
        ],
    },
}
