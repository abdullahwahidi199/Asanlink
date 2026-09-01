"""System-owned authorization definitions.

Future modules extend this registry with additional database records; the
authorization engine itself does not need module-specific code.
"""

ADMIN_ROLE_NAME = "ADMIN"

PERMISSION_DEFINITIONS = (
    {
        "name": "View dashboard",
        "codename": "dashboard.view",
        "description": "View the central dashboard.",
        "module": "dashboard",
        "action": "view",
    },
    {
        "name": "View users",
        "codename": "users.view",
        "description": "List and view user accounts.",
        "module": "users",
        "action": "view",
    },
    {
        "name": "Create users",
        "codename": "users.create",
        "description": "Create user accounts.",
        "module": "users",
        "action": "create",
    },
    {
        "name": "Update users",
        "codename": "users.update",
        "description": "Edit accounts, roles, status, and reset passwords.",
        "module": "users",
        "action": "update",
    },
    {
        "name": "Delete users",
        "codename": "users.delete",
        "description": "Permanently delete user accounts.",
        "module": "users",
        "action": "delete",
    },
    {
        "name": "View roles",
        "codename": "roles.view",
        "description": "List roles and their assigned permissions.",
        "module": "roles",
        "action": "view",
    },
    {
        "name": "Create roles",
        "codename": "roles.create",
        "description": "Create new roles.",
        "module": "roles",
        "action": "create",
    },
    {
        "name": "Update roles",
        "codename": "roles.update",
        "description": "Edit roles and permission assignments.",
        "module": "roles",
        "action": "update",
    },
    {
        "name": "Delete roles",
        "codename": "roles.delete",
        "description": "Deactivate or permanently delete roles.",
        "module": "roles",
        "action": "delete",
    },
    {
        "name": "View permissions",
        "codename": "permissions.view",
        "description": "View the system permission registry.",
        "module": "permissions",
        "action": "view",
    },
    {
        "name": "View settings",
        "codename": "settings.view",
        "description": "View company and application settings.",
        "module": "settings",
        "action": "view",
    },
    {
        "name": "Update settings",
        "codename": "settings.update",
        "description": "Update company and application settings.",
        "module": "settings",
        "action": "update",
    },
)

DEFAULT_ROLE_PERMISSIONS = {
    "ADMIN": tuple(item["codename"] for item in PERMISSION_DEFINITIONS),
    "MANAGER": (
        "dashboard.view",
        "users.view",
        "users.create",
        "users.update",
        "roles.view",
        "permissions.view",
        "settings.view",
    ),
    "DATA_ENTRY": (
        "dashboard.view",
    ),
}

DEFAULT_ROLE_DESCRIPTIONS = {
    "ADMIN": "Full system administration. This role dynamically receives every active permission.",
    "MANAGER": "Operational user and role visibility with user-management access.",
    "DATA_ENTRY": "Restricted access suitable for future data-entry workflows.",
}

