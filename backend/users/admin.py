from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User

@admin.register(User)
class UserAdmin(BaseUserAdmin):
    fieldsets = BaseUserAdmin.fieldsets + (
        ('Role & Permissions', {'fields': ('role', 'permissions_json')}),
    )
    list_display = ['username', 'email', 'role', 'is_active']
    list_filter = ['role', 'is_active']
