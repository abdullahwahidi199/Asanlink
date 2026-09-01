from django.db import transaction
from django.db.models import Q
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken

from .constants import (
    ADMIN_ROLE_NAME,
    DEFAULT_ROLE_DESCRIPTIONS,
    DEFAULT_ROLE_PERMISSIONS,
    PERMISSION_DEFINITIONS,
)
from .models import Permission, Role, User


def active_admins():
    return User.objects.filter(is_active=True).filter(
        Q(is_superuser=True)
        | Q(role__name=ADMIN_ROLE_NAME, role__is_active=True)
    ).distinct()


def ensure_admin_continuity(
    target,
    *,
    actor=None,
    new_role=None,
    role_is_changing=False,
    new_is_active=None,
    deleting=False,
):
    """Prevent self-destruction and removal of the last active administrator."""

    if actor and actor.pk == target.pk and (deleting or new_is_active is False):
        raise ValidationError("You cannot delete or deactivate your own account.")

    loses_admin = deleting or new_is_active is False
    if role_is_changing and not target.is_superuser and (
        new_role is None or new_role.name != ADMIN_ROLE_NAME
    ):
        loses_admin = True

    if (
        actor
        and actor.pk == target.pk
        and target.is_system_admin
        and role_is_changing
        and not target.is_superuser
        and (new_role is None or new_role.name != ADMIN_ROLE_NAME)
    ):
        raise ValidationError("You cannot remove your own administrative role.")

    if target.is_active and target.is_system_admin and loses_admin:
        if active_admins().exclude(pk=target.pk).count() == 0:
            raise ValidationError("The last active administrator cannot be removed or demoted.")


def ensure_role_operation_allowed(role, operation, *, new_name=None, new_is_active=None):
    if operation == "delete" and role.is_system:
        raise ValidationError("System roles cannot be deleted; deactivate a non-ADMIN role instead.")
    if role.name != ADMIN_ROLE_NAME:
        return
    if operation in {"delete", "deactivate"} or new_is_active is False:
        raise ValidationError("The system ADMIN role cannot be deleted or deactivated.")
    if new_name and new_name.strip().upper().replace(" ", "_") != ADMIN_ROLE_NAME:
        raise ValidationError("The system ADMIN role cannot be renamed.")


def ensure_target_manageable(actor, target):
    if target.is_system_admin and not actor.is_system_admin:
        raise PermissionDenied("Only an administrator can manage an administrator account.")


def ensure_role_assignment_allowed(actor, role):
    if role is None or actor.is_system_admin:
        return
    if role.name == ADMIN_ROLE_NAME:
        raise PermissionDenied("Only an administrator can assign the ADMIN role.")
    actor_permissions = set(actor.get_effective_permissions())
    role_permissions = set(
        role.permissions.filter(is_active=True).values_list("codename", flat=True)
    )
    if not role_permissions.issubset(actor_permissions):
        raise PermissionDenied("You cannot assign a role with permissions you do not have.")


def ensure_permission_assignment_allowed(actor, permissions):
    if actor.is_system_admin:
        return
    actor_permissions = set(actor.get_effective_permissions())
    requested = {permission.codename for permission in permissions}
    if not requested.issubset(actor_permissions):
        raise PermissionDenied("You cannot grant permissions you do not have.")


def revoke_user_refresh_tokens(user):
    for token in OutstandingToken.objects.filter(user=user):
        BlacklistedToken.objects.get_or_create(token=token)


@transaction.atomic
def seed_authorization(*, reset_defaults=False):
    permissions = {}
    for definition in PERMISSION_DEFINITIONS:
        values = {key: value for key, value in definition.items() if key != "codename"}
        permission, _ = Permission.objects.update_or_create(
            codename=definition["codename"],
            defaults={**values, "is_active": True},
        )
        permissions[permission.codename] = permission

    roles = {}
    for role_name, codenames in DEFAULT_ROLE_PERMISSIONS.items():
        role, created = Role.objects.get_or_create(
            name=role_name,
            defaults={
                "description": DEFAULT_ROLE_DESCRIPTIONS[role_name],
                "is_active": True,
                "is_system": True,
            },
        )
        changed_fields = []
        if not role.is_system:
            role.is_system = True
            changed_fields.append("is_system")
        if role_name == ADMIN_ROLE_NAME and not role.is_active:
            role.is_active = True
            changed_fields.append("is_active")
        if changed_fields:
            changed_fields.append("updated_at")
            role.save(update_fields=changed_fields)

        if created or reset_defaults or role_name == ADMIN_ROLE_NAME:
            role.permissions.set(permissions[codename] for codename in codenames)
        roles[role_name] = role

    return permissions, roles
