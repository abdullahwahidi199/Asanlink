"""Reusable DRF authorization primitives for database permissions."""

from functools import lru_cache

from rest_framework.permissions import BasePermission


class HasSystemPermission(BasePermission):
    """Enforce a view's ``required_permissions`` or ``permission_map``.

    ``permission_map`` values may be a codename, an iterable of codenames, or
    a request-method mapping for actions that support more than one method.
    Unmapped actions are denied by default, which prevents newly added ViewSet
    actions from accidentally becoming authorized.
    """

    message = "You do not have permission to perform this action."

    def _required_permissions(self, request, view):
        if hasattr(view, "get_required_system_permissions"):
            required = view.get_required_system_permissions(request)
        else:
            action = getattr(view, "action", None) or request.method.lower()
            required = getattr(view, "permission_map", {}).get(action)
            if isinstance(required, dict):
                required = required.get(request.method.upper())
            if required is None:
                required = getattr(view, "required_permissions", None)

        if isinstance(required, str):
            return (required,)
        return tuple(required or ())

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False

        required = self._required_permissions(request, view)
        if not required:
            return bool(getattr(view, "allow_unmapped_permissions", False))

        require_all = getattr(view, "require_all_permissions", True)
        return user.has_system_permissions(required, require_all=require_all)

    def has_object_permission(self, request, view, obj):
        hook = getattr(view, "has_system_object_permission", None)
        if hook is not None:
            return bool(hook(request, obj))
        return self.has_permission(request, view)


@lru_cache(maxsize=256)
def require_permission(codename):
    """Return a reusable permission class for an APIView or function view."""

    class SingleSystemPermission(HasSystemPermission):
        def _required_permissions(self, request, view):
            return (codename,)

    SingleSystemPermission.__name__ = f"Has_{codename.replace('.', '_')}"
    return SingleSystemPermission

