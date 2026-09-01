from django.contrib.auth import authenticate, password_validation
from django.contrib.auth.models import update_last_login
from django.db.models import Q
from rest_framework import serializers
from rest_framework_simplejwt.tokens import RefreshToken

from .constants import ADMIN_ROLE_NAME
from .models import Permission, Role, User


class PermissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Permission
        fields = (
            "id",
            "name",
            "codename",
            "description",
            "module",
            "action",
            "is_active",
        )
        read_only_fields = fields


class RoleSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = Role
        fields = ("id", "name", "description", "is_active")
        read_only_fields = fields


class RoleSerializer(serializers.ModelSerializer):
    permissions = PermissionSerializer(many=True, read_only=True)
    permission_ids = serializers.PrimaryKeyRelatedField(
        source="permissions",
        many=True,
        queryset=Permission.objects.filter(is_active=True),
        write_only=True,
        required=False,
    )
    users_count = serializers.SerializerMethodField()

    class Meta:
        model = Role
        fields = (
            "id",
            "name",
            "description",
            "permissions",
            "permission_ids",
            "is_active",
            "is_system",
            "users_count",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "is_system", "users_count", "created_at", "updated_at")

    def get_users_count(self, obj):
        annotated = getattr(obj, "users_count", None)
        return annotated if annotated is not None else obj.users.count()

    def validate_name(self, value):
        normalized = value.strip().upper().replace(" ", "_")
        if not normalized:
            raise serializers.ValidationError("A role name is required.")
        queryset = Role.objects.filter(name__iexact=normalized)
        if self.instance:
            queryset = queryset.exclude(pk=self.instance.pk)
        if queryset.exists():
            raise serializers.ValidationError("A role with this name already exists.")
        if self.instance and self.instance.name == ADMIN_ROLE_NAME and normalized != ADMIN_ROLE_NAME:
            raise serializers.ValidationError("The system ADMIN role cannot be renamed.")
        return normalized


class RolePermissionAssignmentSerializer(serializers.Serializer):
    permission_ids = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=Permission.objects.filter(is_active=True),
    )


class UserReadSerializer(serializers.ModelSerializer):
    role = RoleSummarySerializer(read_only=True)
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "full_name",
            "phone",
            "is_active",
            "is_staff",
            "is_superuser",
            "date_joined",
            "last_login",
            "role",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields

    def get_full_name(self, obj):
        return obj.get_full_name() or obj.username


class CurrentUserSerializer(UserReadSerializer):
    permissions = serializers.SerializerMethodField()
    is_admin = serializers.SerializerMethodField()

    class Meta(UserReadSerializer.Meta):
        fields = UserReadSerializer.Meta.fields + ("permissions", "is_admin")

    def get_permissions(self, obj):
        return obj.get_effective_permissions()

    def get_is_admin(self, obj):
        return obj.is_system_admin


class UserCreateSerializer(serializers.ModelSerializer):
    role_id = serializers.PrimaryKeyRelatedField(
        source="role",
        queryset=Role.objects.filter(is_active=True),
        allow_null=True,
        required=False,
    )
    password = serializers.CharField(write_only=True, trim_whitespace=False)
    password_confirm = serializers.CharField(write_only=True, trim_whitespace=False)

    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "phone",
            "role_id",
            "is_active",
            "password",
            "password_confirm",
        )
        read_only_fields = ("id",)

    def validate_email(self, value):
        normalized = value.strip().lower()
        if User.objects.filter(email__iexact=normalized).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return normalized

    def validate(self, attrs):
        password = attrs.get("password")
        if password != attrs.pop("password_confirm", None):
            raise serializers.ValidationError({"password_confirm": "Passwords do not match."})
        candidate = User(
            username=attrs.get("username", ""),
            email=attrs.get("email", ""),
            first_name=attrs.get("first_name", ""),
            last_name=attrs.get("last_name", ""),
        )
        password_validation.validate_password(password, user=candidate)
        return attrs

    def create(self, validated_data):
        password = validated_data.pop("password")
        return User.objects.create_user(password=password, **validated_data)


class UserUpdateSerializer(serializers.ModelSerializer):
    role_id = serializers.PrimaryKeyRelatedField(
        source="role",
        queryset=Role.objects.filter(is_active=True),
        allow_null=True,
        required=False,
    )

    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "phone",
            "role_id",
            "is_active",
        )
        read_only_fields = ("id",)

    def validate_email(self, value):
        normalized = value.strip().lower()
        queryset = User.objects.filter(email__iexact=normalized)
        if self.instance:
            queryset = queryset.exclude(pk=self.instance.pk)
        if queryset.exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return normalized


class LoginSerializer(serializers.Serializer):
    identifier = serializers.CharField(max_length=254, trim_whitespace=True)
    password = serializers.CharField(write_only=True, trim_whitespace=False)

    default_error_messages = {
        "invalid_credentials": "Unable to sign in with the supplied credentials.",
    }

    def validate(self, attrs):
        identifier = attrs["identifier"].strip()
        user = (
            User.objects.filter(Q(username__iexact=identifier) | Q(email__iexact=identifier))
            .order_by("id")
            .first()
        )
        authenticated = None
        if user:
            authenticated = authenticate(
                request=self.context.get("request"),
                username=user.username,
                password=attrs["password"],
            )
        if not authenticated or not authenticated.is_active:
            self.fail("invalid_credentials")

        refresh = RefreshToken.for_user(authenticated)
        update_last_login(None, authenticated)
        return {
            "user": authenticated,
            "access": str(refresh.access_token),
            "refresh": str(refresh),
        }


class LogoutSerializer(serializers.Serializer):
    refresh = serializers.CharField(trim_whitespace=False)


class ChangePasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True, trim_whitespace=False)
    new_password = serializers.CharField(write_only=True, trim_whitespace=False)
    new_password_confirm = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate_current_password(self, value):
        if not self.context["request"].user.check_password(value):
            raise serializers.ValidationError("The current password is incorrect.")
        return value

    def validate(self, attrs):
        if attrs["new_password"] != attrs["new_password_confirm"]:
            raise serializers.ValidationError({"new_password_confirm": "Passwords do not match."})
        password_validation.validate_password(
            attrs["new_password"],
            user=self.context["request"].user,
        )
        return attrs


class ResetPasswordSerializer(serializers.Serializer):
    new_password = serializers.CharField(write_only=True, trim_whitespace=False)
    new_password_confirm = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate(self, attrs):
        if attrs["new_password"] != attrs["new_password_confirm"]:
            raise serializers.ValidationError({"new_password_confirm": "Passwords do not match."})
        password_validation.validate_password(
            attrs["new_password"],
            user=self.context.get("target_user"),
        )
        return attrs


class SetRoleSerializer(serializers.Serializer):
    role_id = serializers.PrimaryKeyRelatedField(
        source="role",
        queryset=Role.objects.filter(is_active=True),
        allow_null=True,
    )

