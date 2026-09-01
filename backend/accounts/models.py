from django.contrib.auth.models import AbstractUser, UserManager
from django.core.exceptions import ValidationError
from django.core.validators import RegexValidator
from django.db import models
from django.db.models.functions import Lower

from .constants import ADMIN_ROLE_NAME


permission_codename_validator = RegexValidator(
    regex=r"^[a-z0-9_]+(?:\.[a-z0-9_]+)+$",
    message="Use lowercase dot-separated segments, for example users.view.",
)


class Permission(models.Model):
    name = models.CharField(max_length=150)
    codename = models.CharField(
        max_length=180,
        unique=True,
        validators=[permission_codename_validator],
    )
    description = models.TextField(blank=True)
    module = models.CharField(max_length=120)
    action = models.CharField(max_length=60)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("module", "action", "codename")
        indexes = [models.Index(fields=("module", "action"))]

    def clean(self):
        super().clean()
        expected = f"{self.module.strip().lower()}.{self.action.strip().lower()}"
        if self.codename.strip().lower() != expected:
            raise ValidationError(
                {"codename": f"Codename must match module and action: {expected}."}
            )

    def save(self, *args, **kwargs):
        self.codename = self.codename.strip().lower()
        self.module = self.module.strip().lower()
        self.action = self.action.strip().lower()
        super().save(*args, **kwargs)

    def __str__(self):
        return self.codename


class Role(models.Model):
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True)
    permissions = models.ManyToManyField(
        Permission,
        blank=True,
        related_name="roles",
    )
    is_active = models.BooleanField(default=True)
    is_system = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("name",)
        constraints = [
            models.UniqueConstraint(Lower("name"), name="accounts_role_name_ci_unique"),
        ]

    def save(self, *args, **kwargs):
        self.name = self.name.strip().upper().replace(" ", "_")
        super().save(*args, **kwargs)

    @property
    def is_admin(self):
        return self.name == ADMIN_ROLE_NAME

    def __str__(self):
        return self.name


class AsanlinkUserManager(UserManager):
    def _create_user(self, username, email, password, **extra_fields):
        email = (email or "").strip().lower()
        return super()._create_user(username, email, password, **extra_fields)


class User(AbstractUser):
    email = models.EmailField(unique=True)
    phone = models.CharField(max_length=32, blank=True)
    role = models.ForeignKey(
        Role,
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="users",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = AsanlinkUserManager()

    REQUIRED_FIELDS = ["email"]

    class Meta(AbstractUser.Meta):
        constraints = [
            models.UniqueConstraint(Lower("email"), name="accounts_user_email_ci_unique"),
        ]

    @property
    def is_system_admin(self):
        return bool(
            self.is_superuser
            or (
                self.role_id
                and self.role.is_active
                and self.role.name == ADMIN_ROLE_NAME
            )
        )

    def get_effective_permissions(self):
        if not self.is_active:
            return []
        if self.is_system_admin:
            return list(
                Permission.objects.filter(is_active=True)
                .order_by("codename")
                .values_list("codename", flat=True)
            )
        if not self.role_id or not self.role.is_active:
            return []
        return list(
            self.role.permissions.filter(is_active=True)
            .order_by("codename")
            .values_list("codename", flat=True)
        )

    def has_system_permission(self, codename):
        if not self.is_authenticated or not self.is_active:
            return False
        if self.is_system_admin:
            return Permission.objects.filter(codename=codename, is_active=True).exists()
        return bool(
            self.role_id
            and self.role.is_active
            and self.role.permissions.filter(codename=codename, is_active=True).exists()
        )

    def has_system_permissions(self, codenames, require_all=True):
        checks = [self.has_system_permission(codename) for codename in codenames]
        return all(checks) if require_all else any(checks)

    def save(self, *args, **kwargs):
        self.email = (self.email or "").strip().lower()
        super().save(*args, **kwargs)
