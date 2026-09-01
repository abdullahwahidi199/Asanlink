from django.db.models import Count
from django.db.models.deletion import ProtectedError
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.exceptions import ValidationError
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from .authorization import HasSystemPermission
from .models import Permission, Role, User
from .serializers import (
    ChangePasswordSerializer,
    CurrentUserSerializer,
    LoginSerializer,
    LogoutSerializer,
    PermissionSerializer,
    ResetPasswordSerializer,
    RolePermissionAssignmentSerializer,
    RoleSerializer,
    SetRoleSerializer,
    UserCreateSerializer,
    UserReadSerializer,
    UserUpdateSerializer,
)
from .services import (
    ensure_admin_continuity,
    ensure_permission_assignment_allowed,
    ensure_role_assignment_allowed,
    ensure_role_operation_allowed,
    ensure_target_manageable,
    revoke_user_refresh_tokens,
)


class LoginView(APIView):
    permission_classes = (AllowAny,)
    authentication_classes = ()

    def post(self, request):
        serializer = LoginSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        return Response(
            {
                "access": data["access"],
                "refresh": data["refresh"],
                "user": CurrentUserSerializer(data["user"]).data,
            },
            status=status.HTTP_200_OK,
        )


class LogoutView(APIView):
    permission_classes = (IsAuthenticated,)

    def post(self, request):
        serializer = LogoutSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            RefreshToken(serializer.validated_data["refresh"]).blacklist()
        except TokenError as exc:
            raise ValidationError({"refresh": "The refresh token is invalid or expired."}) from exc
        return Response(status=status.HTTP_204_NO_CONTENT)


class MeView(APIView):
    permission_classes = (IsAuthenticated,)

    def get(self, request):
        return Response(CurrentUserSerializer(request.user).data)


class ChangePasswordView(APIView):
    permission_classes = (IsAuthenticated,)

    def post(self, request):
        serializer = ChangePasswordSerializer(
            data=request.data,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        request.user.set_password(serializer.validated_data["new_password"])
        request.user.save(update_fields=("password", "updated_at"))
        revoke_user_refresh_tokens(request.user)
        return Response(
            {
                "message": "Password changed successfully. Please sign in again.",
                "reauthentication_required": True,
            }
        )


class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.select_related("role").all()
    permission_classes = (IsAuthenticated, HasSystemPermission)
    permission_map = {
        "list": "users.view",
        "retrieve": "users.view",
        "create": "users.create",
        "update": "users.update",
        "partial_update": "users.update",
        "destroy": "users.delete",
        "activate": "users.update",
        "deactivate": "users.update",
        "set_role": "users.update",
        "reset_password": "users.update",
    }
    search_fields = ("username", "email", "first_name", "last_name", "phone")
    ordering_fields = ("username", "email", "date_joined", "is_active", "updated_at")
    ordering = ("-date_joined",)

    def get_serializer_class(self):
        if self.action == "create":
            return UserCreateSerializer
        if self.action in {"update", "partial_update"}:
            return UserUpdateSerializer
        return UserReadSerializer

    def perform_create(self, serializer):
        role = serializer.validated_data.get("role")
        ensure_role_assignment_allowed(self.request.user, role)
        serializer.save()

    def perform_update(self, serializer):
        target = self.get_object()
        ensure_target_manageable(self.request.user, target)
        role_is_changing = "role" in serializer.validated_data
        new_role = serializer.validated_data.get("role") if role_is_changing else target.role
        new_is_active = serializer.validated_data.get("is_active", target.is_active)
        if role_is_changing:
            ensure_role_assignment_allowed(self.request.user, new_role)
        ensure_admin_continuity(
            target,
            actor=self.request.user,
            new_role=new_role,
            role_is_changing=role_is_changing,
            new_is_active=new_is_active,
        )
        serializer.save()

    def perform_destroy(self, instance):
        ensure_target_manageable(self.request.user, instance)
        ensure_admin_continuity(instance, actor=self.request.user, deleting=True)
        instance.delete()

    @action(detail=True, methods=("post",))
    def activate(self, request, pk=None):
        user = self.get_object()
        ensure_target_manageable(request.user, user)
        if not user.is_active:
            user.is_active = True
            user.save(update_fields=("is_active", "updated_at"))
        return Response(UserReadSerializer(user).data)

    @action(detail=True, methods=("post",))
    def deactivate(self, request, pk=None):
        user = self.get_object()
        ensure_target_manageable(request.user, user)
        ensure_admin_continuity(user, actor=request.user, new_is_active=False)
        if user.is_active:
            user.is_active = False
            user.save(update_fields=("is_active", "updated_at"))
            revoke_user_refresh_tokens(user)
        return Response(UserReadSerializer(user).data)

    @action(detail=True, methods=("post",), url_path="set-role")
    def set_role(self, request, pk=None):
        user = self.get_object()
        ensure_target_manageable(request.user, user)
        serializer = SetRoleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        role = serializer.validated_data["role"]
        ensure_role_assignment_allowed(request.user, role)
        ensure_admin_continuity(
            user,
            actor=request.user,
            new_role=role,
            role_is_changing=True,
        )
        user.role = role
        user.save(update_fields=("role", "updated_at"))
        return Response(UserReadSerializer(user).data)

    @action(detail=True, methods=("post",), url_path="reset-password")
    def reset_password(self, request, pk=None):
        user = self.get_object()
        ensure_target_manageable(request.user, user)
        serializer = ResetPasswordSerializer(
            data=request.data,
            context={"target_user": user},
        )
        serializer.is_valid(raise_exception=True)
        user.set_password(serializer.validated_data["new_password"])
        user.save(update_fields=("password", "updated_at"))
        revoke_user_refresh_tokens(user)
        return Response({"message": "Password reset successfully."})


class RoleViewSet(viewsets.ModelViewSet):
    queryset = Role.objects.prefetch_related("permissions").annotate(users_count=Count("users"))
    serializer_class = RoleSerializer
    permission_classes = (IsAuthenticated, HasSystemPermission)
    permission_map = {
        "list": "roles.view",
        "retrieve": "roles.view",
        "create": "roles.create",
        "update": "roles.update",
        "partial_update": "roles.update",
        "destroy": "roles.delete",
        "activate": "roles.update",
        "deactivate": "roles.delete",
        "permissions": {"GET": "roles.view", "PUT": "roles.update"},
    }
    search_fields = ("name", "description")
    ordering_fields = ("name", "created_at", "updated_at", "is_active")
    ordering = ("name",)

    def perform_create(self, serializer):
        permissions = serializer.validated_data.get("permissions", [])
        ensure_permission_assignment_allowed(self.request.user, permissions)
        serializer.save()

    def perform_update(self, serializer):
        role = self.get_object()
        new_name = serializer.validated_data.get("name", role.name)
        new_is_active = serializer.validated_data.get("is_active", role.is_active)
        permissions = serializer.validated_data.get("permissions")
        ensure_role_operation_allowed(
            role,
            "update",
            new_name=new_name,
            new_is_active=new_is_active,
        )
        if permissions is not None:
            ensure_permission_assignment_allowed(self.request.user, permissions)
        serializer.save()

    def perform_destroy(self, instance):
        ensure_role_operation_allowed(instance, "delete")
        try:
            instance.delete()
        except ProtectedError as exc:
            raise ValidationError(
                "This role is assigned to users. Reassign those users before deleting it."
            ) from exc

    @action(detail=True, methods=("post",))
    def activate(self, request, pk=None):
        role = self.get_object()
        if not role.is_active:
            role.is_active = True
            role.save(update_fields=("is_active", "updated_at"))
        return Response(RoleSerializer(role).data)

    @action(detail=True, methods=("post",))
    def deactivate(self, request, pk=None):
        role = self.get_object()
        ensure_role_operation_allowed(role, "deactivate")
        if role.is_active:
            role.is_active = False
            role.save(update_fields=("is_active", "updated_at"))
        return Response(RoleSerializer(role).data)

    @action(detail=True, methods=("get", "put"))
    def permissions(self, request, pk=None):
        role = self.get_object()
        if request.method == "GET":
            return Response(PermissionSerializer(role.permissions.all(), many=True).data)

        serializer = RolePermissionAssignmentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        permissions = serializer.validated_data["permission_ids"]
        ensure_permission_assignment_allowed(request.user, permissions)
        role.permissions.set(permissions)
        return Response(RoleSerializer(role).data)


class PermissionViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    queryset = Permission.objects.filter(is_active=True)
    serializer_class = PermissionSerializer
    permission_classes = (IsAuthenticated, HasSystemPermission)
    permission_map = {
        "list": "permissions.view",
        "retrieve": "permissions.view",
    }
    search_fields = ("name", "codename", "description", "module", "action")
    ordering_fields = ("module", "action", "codename", "name")
    ordering = ("module", "action", "codename")
