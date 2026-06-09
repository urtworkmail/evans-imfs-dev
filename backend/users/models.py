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
