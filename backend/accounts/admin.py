from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import Permission, Role, User


@admin.register(User)
class AsanlinkUserAdmin(UserAdmin):
    list_display = (
        "username",
        "email",
        "first_name",
        "last_name",
        "role",
        "is_active",
        "is_staff",
    )
    list_filter = ("is_active", "is_staff", "is_superuser", "role")
    search_fields = ("username", "email", "first_name", "last_name", "phone")
    ordering = ("username",)
    fieldsets = UserAdmin.fieldsets + (
        ("Asanlink authorization", {"fields": ("phone", "role")}),
        ("Audit timestamps", {"fields": ("created_at", "updated_at")}),
    )
    readonly_fields = ("created_at", "updated_at", "date_joined", "last_login")
    add_fieldsets = UserAdmin.add_fieldsets + (
        (
            "Asanlink profile",
            {
                "fields": (
                    "email",
                    "first_name",
                    "last_name",
                    "phone",
                    "role",
                )
            },
        ),
    )


@admin.register(Role)
class RoleAdmin(admin.ModelAdmin):
    list_display = ("name", "is_active", "is_system", "created_at", "updated_at")
    list_filter = ("is_active", "is_system")
    search_fields = ("name", "description")
    filter_horizontal = ("permissions",)
    readonly_fields = ("created_at", "updated_at")


@admin.register(Permission)
class PermissionAdmin(admin.ModelAdmin):
    list_display = ("codename", "name", "module", "action", "is_active")
    list_filter = ("module", "action", "is_active")
    search_fields = ("codename", "name", "description")
    readonly_fields = ("created_at", "updated_at")
