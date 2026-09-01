from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from .constants import ADMIN_ROLE_NAME
from .models import Permission, Role, User
from .services import seed_authorization


PASSWORD = "ValidPassword!234"


class AuthorizationAPITests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        seed_authorization(reset_defaults=True)
        cls.admin_role = Role.objects.get(name=ADMIN_ROLE_NAME)
        cls.manager_role = Role.objects.get(name="MANAGER")
        cls.data_entry_role = Role.objects.get(name="DATA_ENTRY")
        cls.empty_role = Role.objects.create(name="AUDITOR", description="No access")

        cls.admin = User.objects.create_user(
            username="admin",
            email="admin@example.com",
            password=PASSWORD,
            role=cls.admin_role,
        )
        cls.manager = User.objects.create_user(
            username="manager",
            email="manager@example.com",
            password=PASSWORD,
            role=cls.manager_role,
        )
        cls.restricted = User.objects.create_user(
            username="restricted",
            email="restricted@example.com",
            password=PASSWORD,
            role=cls.empty_role,
        )

    def authenticate(self, user):
        self.client.force_authenticate(user=user)

    def test_unauthenticated_and_forbidden_are_distinct(self):
        response = self.client.get(reverse("user-list"))
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

        self.authenticate(self.restricted)
        response = self.client.get(reverse("user-list"))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_role_permissions_enforce_each_user_action(self):
        self.authenticate(self.manager)
        self.assertEqual(self.client.get(reverse("user-list")).status_code, status.HTTP_200_OK)
        self.assertEqual(
            self.client.delete(reverse("user-detail", args=(self.restricted.pk,))).status_code,
            status.HTTP_403_FORBIDDEN,
        )

        payload = {
            "username": "created",
            "email": "created@example.com",
            "first_name": "Created",
            "last_name": "User",
            "role_id": self.data_entry_role.pk,
            "password": PASSWORD,
            "password_confirm": PASSWORD,
        }
        response = self.client.post(reverse("user-list"), payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        created = User.objects.get(username="created")
        self.assertTrue(created.check_password(PASSWORD))
        self.assertNotEqual(created.password, PASSWORD)
        self.assertNotIn("password", response.data)

    def test_admin_role_dynamically_allows_new_active_permissions(self):
        permission = Permission.objects.create(
            name="View future module",
            codename="school.students.view",
            description="Future permission",
            module="school.students",
            action="view",
        )
        self.assertFalse(self.admin_role.permissions.filter(pk=permission.pk).exists())
        self.assertTrue(self.admin.has_system_permission(permission.codename))
        self.assertIn(permission.codename, self.admin.get_effective_permissions())
        self.assertFalse(self.admin.has_system_permission("misspelled.permission"))

    def test_login_accepts_email_and_returns_effective_permissions(self):
        response = self.client.post(
            reverse("auth-login"),
            {"identifier": "ADMIN@EXAMPLE.COM", "password": PASSWORD},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)
        self.assertIn("users.delete", response.data["user"]["permissions"])
        self.assertNotIn("password", response.data["user"])

    def test_non_admin_cannot_assign_admin_role(self):
        self.authenticate(self.manager)
        response = self.client.post(
            reverse("user-set-role", args=(self.restricted.pk,)),
            {"role_id": self.admin_role.pk},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN, response.data)

    def test_non_admin_cannot_reset_an_administrator_password(self):
        self.authenticate(self.manager)
        response = self.client.post(
            reverse("user-reset-password", args=(self.admin.pk,)),
            {
                "new_password": "AttemptedPassword!456",
                "new_password_confirm": "AttemptedPassword!456",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN, response.data)
        self.admin.refresh_from_db()
        self.assertTrue(self.admin.check_password(PASSWORD))

    def test_admin_cannot_deactivate_own_account(self):
        self.authenticate(self.admin)
        response = self.client.post(reverse("user-deactivate", args=(self.admin.pk,)))
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST, response.data)
        self.admin.refresh_from_db()
        self.assertTrue(self.admin.is_active)

    def test_role_permission_assignment_is_backend_enforced(self):
        self.authenticate(self.admin)
        permission_ids = list(
            Permission.objects.filter(codename__in=("dashboard.view", "users.view"))
            .order_by("id")
            .values_list("id", flat=True)
        )
        response = self.client.put(
            reverse("role-permissions", args=(self.empty_role.pk,)),
            {"permission_ids": permission_ids},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertSetEqual(
            set(self.empty_role.permissions.values_list("id", flat=True)),
            set(permission_ids),
        )

    def test_password_change_revokes_existing_jwt(self):
        login = self.client.post(
            reverse("auth-login"),
            {"identifier": self.manager.username, "password": PASSWORD},
            format="json",
        )
        access = login.data["access"]
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
        response = self.client.post(
            reverse("auth-change-password"),
            {
                "current_password": PASSWORD,
                "new_password": "AnotherValidPassword!456",
                "new_password_confirm": "AnotherValidPassword!456",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        response = self.client.get(reverse("auth-me"))
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
