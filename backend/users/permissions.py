from rest_framework.permissions import BasePermission


class ActionPermission(BasePermission):
    """
    Requires request.user.has_perm_key() for the permission mapped to the
    current viewset action. Set `permission_map = {'create': 'products.create', ...}`
    on the view. Actions not present in the map only require authentication
    (used for list/retrieve, which every persona that can see the resource gets).
    """
    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        required = getattr(view, 'permission_map', {}).get(view.action)
        if required is None:
            return True
        return request.user.has_perm_key(required)


def require_permission(key):
    """For plain @api_view functions that need a single fixed permission key."""
    class _RequirePermission(BasePermission):
        def has_permission(self, request, view):
            return bool(
                request.user and request.user.is_authenticated
                and request.user.has_perm_key(key)
            )
    return _RequirePermission
