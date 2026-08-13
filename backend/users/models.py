from django.contrib.auth.models import AbstractUser
from django.db import models
from django.conf import settings


class User(AbstractUser):
    ROLE_CHOICES = [
        ('admin',           'Super Admin'),
        ('general_manager', 'General Manager'),
        ('warehouse_manager','Warehouse Manager'),
        ('sales_analyst',   'Sales Analyst'),
        ('viewer',          'Viewer'),
        ('custom',          'Custom'),
    ]
    role             = models.CharField(max_length=30, choices=ROLE_CHOICES, default='viewer')
    # Stores {permission_key: True/False} — overrides the persona defaults
    permissions_json = models.JSONField(default=dict, blank=True)
    # TOTP two-factor auth — self-hosted (pyotp), no third-party MFA service
    totp_secret      = models.CharField(max_length=64, blank=True, null=True)
    totp_enabled     = models.BooleanField(default=False)

    class Meta:
        db_table = 'users'

    def __str__(self):
        return f"{self.username} ({self.role})"

    def get_effective_permissions(self) -> set:
        """
        Returns the full set of permission keys this user has.
        Admin = everything. Others = persona defaults merged with overrides.
        """
        if self.role == 'admin' or self.is_superuser:
            # Collect all keys from PERMISSION_MODULES
            all_perms = set()
            for mod in settings.PERMISSION_MODULES:
                for p in mod['permissions']:
                    all_perms.add(p['key'])
            return all_perms

        # Start from persona defaults
        persona     = settings.PERMISSION_PERSONAS.get(self.role, {})
        base_perms  = set(persona.get('permissions', []))

        # Apply overrides from permissions_json
        for key, granted in (self.permissions_json or {}).items():
            if granted:
                base_perms.add(key)
            else:
                base_perms.discard(key)

        return base_perms

    def has_perm_key(self, key: str) -> bool:
        return key in self.get_effective_permissions()


class LoginSession(models.Model):
    """
    One row per issued login (refresh token). Lets Super Admin see who's
    currently logged in — count + per-device detail — and end a session
    early. Not a cache of live activity: "active" just means the token
    hasn't expired or been revoked yet.
    """
    user         = models.ForeignKey(User, on_delete=models.CASCADE, related_name='login_sessions')
    jti          = models.CharField(max_length=64, unique=True)
    ip_address   = models.GenericIPAddressField(null=True, blank=True)
    user_agent   = models.CharField(max_length=300, blank=True)
    created_at   = models.DateTimeField(auto_now_add=True)
    expires_at   = models.DateTimeField()
    revoked_at   = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'login_sessions'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user.username} @ {self.created_at:%Y-%m-%d %H:%M}"
