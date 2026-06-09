from rest_framework import serializers
from django.conf import settings
from .models import User


class UserSerializer(serializers.ModelSerializer):
    password            = serializers.CharField(write_only=True, required=False)
    effective_permissions = serializers.SerializerMethodField()
    role_label          = serializers.CharField(source='get_role_display', read_only=True)

    class Meta:
        model  = User
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name',
            'role', 'role_label', 'permissions_json',
            'effective_permissions', 'is_active', 'date_joined', 'password',
        ]

    def get_effective_permissions(self, obj):
        return list(obj.get_effective_permissions())

    def create(self, validated_data):
        password = validated_data.pop('password', None)
        user = User(**validated_data)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save()
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if password:
            instance.set_password(password)
        instance.save()
        return instance


class PermissionModulesSerializer(serializers.Serializer):
    """Returns the permission module definitions and persona presets for the UI."""
    modules  = serializers.SerializerMethodField()
    personas = serializers.SerializerMethodField()

    def get_modules(self, obj):
        return settings.PERMISSION_MODULES

    def get_personas(self, obj):
        result = []
        for key, data in settings.PERMISSION_PERSONAS.items():
            result.append({
                'key':         key,
                'label':       data['label'],
                'description': data['description'],
                'permissions': data['permissions'],
            })
        return result
