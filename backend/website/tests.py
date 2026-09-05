import tempfile

from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.constants import ADMIN_ROLE_NAME
from accounts.models import Role, User
from accounts.services import seed_authorization

from .models import (
    Integration,
    LandingSection,
    MediaAsset,
    NavigationItem,
    NavigationMenu,
    Product,
    ProductCategory,
)


PASSWORD = "ValidPassword!234"


class WebsiteCMSAPITests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        seed_authorization(reset_defaults=True)
        cls.admin_role = Role.objects.get(name=ADMIN_ROLE_NAME)
        cls.manager_role = Role.objects.get(name="MANAGER")
        cls.restricted_role = Role.objects.create(name="WEBSITE_RESTRICTED")
        cls.admin = User.objects.create_user(
            username="site-admin",
            email="site-admin@example.com",
            password=PASSWORD,
            role=cls.admin_role,
        )
        cls.manager = User.objects.create_user(
            username="site-viewer",
            email="site-viewer@example.com",
            password=PASSWORD,
            role=cls.manager_role,
        )
        cls.restricted = User.objects.create_user(
            username="no-site-access",
            email="no-site-access@example.com",
            password=PASSWORD,
            role=cls.restricted_role,
        )

    def setUp(self):
        cache.clear()

    def authenticate(self, user):
        self.client.force_authenticate(user=user)

    def create_product(self, *, name, slug, publication_status=Product.Status.PUBLISHED, **kwargs):
        is_visible = kwargs.pop("is_visible", True)
        return Product.objects.create(
            name=name,
            slug=slug,
            status=publication_status,
            is_visible=is_visible,
            **kwargs,
        )

    def test_public_site_is_anonymous_and_contains_only_public_shape(self):
        response = self.client.get(reverse("public-site-v1"))
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(response.data["schema_version"], "1.0")
        self.assertIn("products", response.data)
        self.assertIn("integrations", response.data)
        self.assertIn("sections", response.data)
        self.assertNotIn("created_at", response.data["company"]["profile"])
        self.assertIn("public, max-age=", response["Cache-Control"])

    def test_public_product_endpoints_exclude_drafts_archives_and_hidden_records(self):
        published = self.create_product(name="Published", slug="published")
        self.create_product(name="Draft", slug="draft", publication_status=Product.Status.DRAFT)
        self.create_product(
            name="Archived", slug="archived", publication_status=Product.Status.ARCHIVED
        )
        self.create_product(name="Hidden", slug="hidden", is_visible=False)

        response = self.client.get(reverse("public-products-v1"))
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual([item["slug"] for item in response.data], [published.slug])
        self.assertNotIn("status", response.data[0])
        self.assertNotIn("published_at", response.data[0])

        self.assertEqual(
            self.client.get(reverse("public-product-detail-v1", args=("draft",))).status_code,
            status.HTTP_404_NOT_FOUND,
        )

    def test_unpublished_category_hides_its_otherwise_published_products(self):
        category = ProductCategory.objects.create(
            name="Private category",
            slug="private-category",
            status=ProductCategory.Status.DRAFT,
        )
        self.create_product(name="Nested product", slug="nested-product", category=category)

        response = self.client.get(reverse("public-products-v1"))
        self.assertEqual(response.data, [])

    def test_integrations_require_public_relationship_and_distinct_products(self):
        source = self.create_product(name="Source", slug="source")
        destination = self.create_product(name="Destination", slug="destination")
        Integration.objects.create(
            name="Public connection",
            slug="public-connection",
            source_product=source,
            destination_product=destination,
            status=Integration.Status.PUBLISHED,
            operational_status=Integration.OperationalStatus.ACTIVE,
        )
        hidden_destination = self.create_product(
            name="Hidden destination", slug="hidden-destination", publication_status=Product.Status.DRAFT
        )
        Integration.objects.create(
            name="Private connection",
            slug="private-connection",
            source_product=source,
            destination_product=hidden_destination,
            status=Integration.Status.PUBLISHED,
        )

        response = self.client.get(reverse("public-integrations-v1"))
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual([item["slug"] for item in response.data], ["public-connection"])
        self.assertNotIn("api_information", response.data[0]["source_product"])

        self.authenticate(self.admin)
        invalid = self.client.post(
            reverse("website-integration-list"),
            {
                "name": "Invalid",
                "slug": "invalid",
                "source_product_id": source.pk,
                "destination_product_id": source.pk,
                "integration_type": "api",
            },
            format="json",
        )
        self.assertEqual(invalid.status_code, status.HTTP_400_BAD_REQUEST, invalid.data)

    def test_management_permissions_distinguish_view_and_manage(self):
        list_url = reverse("website-product-list")
        payload = {"name": "Managed", "slug": "managed", "status": "draft"}

        self.assertEqual(self.client.get(list_url).status_code, status.HTTP_401_UNAUTHORIZED)

        self.authenticate(self.restricted)
        self.assertEqual(self.client.get(list_url).status_code, status.HTTP_403_FORBIDDEN)

        self.authenticate(self.manager)
        self.assertEqual(self.client.get(list_url).status_code, status.HTTP_200_OK)
        self.assertEqual(
            self.client.post(list_url, payload, format="json").status_code,
            status.HTTP_403_FORBIDDEN,
        )

        self.authenticate(self.admin)
        response = self.client.post(list_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)

    def test_singleton_settings_update_requires_specific_permission(self):
        url = reverse("website-company")
        self.authenticate(self.manager)
        self.assertEqual(self.client.get(url).status_code, status.HTTP_200_OK)
        self.assertEqual(
            self.client.patch(url, {"name": "Changed"}, format="json").status_code,
            status.HTTP_403_FORBIDDEN,
        )

        self.authenticate(self.admin)
        response = self.client.patch(url, {"name": "Changed"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(response.data["name"], "Changed")

    def test_publish_action_and_cache_invalidation_make_content_public(self):
        product = self.create_product(
            name="Pending", slug="pending", publication_status=Product.Status.DRAFT
        )
        self.assertEqual(self.client.get(reverse("public-products-v1")).data, [])

        self.authenticate(self.admin)
        response = self.client.post(reverse("website-product-publish", args=(product.pk,)))
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)

        self.client.force_authenticate(user=None)
        response = self.client.get(reverse("public-products-v1"))
        self.assertEqual([item["slug"] for item in response.data], ["pending"])

    def test_reorder_validates_payload_and_updates_all_items(self):
        first = self.create_product(name="First", slug="first", display_order=10)
        second = self.create_product(name="Second", slug="second", display_order=20)
        self.authenticate(self.admin)
        url = reverse("website-product-reorder")

        invalid = self.client.post(
            url,
            {"items": [{"id": first.pk, "display_order": -1}]},
            format="json",
        )
        self.assertEqual(invalid.status_code, status.HTTP_400_BAD_REQUEST)

        response = self.client.post(
            url,
            {
                "items": [
                    {"id": first.pk, "display_order": 50},
                    {"id": second.pk, "display_order": 0},
                ]
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        first.refresh_from_db()
        second.refresh_from_db()
        self.assertEqual((first.display_order, second.display_order), (50, 0))

    def test_unique_slugs_are_enforced_through_the_api(self):
        self.create_product(name="Existing", slug="same")
        self.authenticate(self.admin)
        response = self.client.post(
            reverse("website-product-list"),
            {"name": "Duplicate", "slug": "SAME"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST, response.data)

    def test_navigation_rejects_wrong_menu_parent_and_cycles(self):
        first_menu = NavigationMenu.objects.create(name="One", slug="one", location="utility")
        second_menu = NavigationMenu.objects.create(
            name="Two", slug="two", location="utility", is_active=False
        )
        parent = NavigationItem.objects.create(
            menu=first_menu,
            label="Parent",
            link_type="internal",
            internal_path="#parent",
        )
        child = NavigationItem.objects.create(
            menu=first_menu,
            parent=parent,
            label="Child",
            link_type="internal",
            internal_path="#child",
        )
        self.authenticate(self.admin)

        wrong_menu = self.client.post(
            reverse("website-navigation-item-list"),
            {
                "menu_id": second_menu.pk,
                "parent_id": parent.pk,
                "label": "Wrong",
                "link_type": "internal",
                "internal_path": "#wrong",
            },
            format="json",
        )
        self.assertEqual(wrong_menu.status_code, status.HTTP_400_BAD_REQUEST, wrong_menu.data)

        conflicting_menu = self.client.post(
            reverse("website-navigation-menu-list"),
            {"name": "Conflicting", "slug": "conflicting", "location": "utility", "is_active": True},
            format="json",
        )
        self.assertEqual(conflicting_menu.status_code, status.HTTP_400_BAD_REQUEST, conflicting_menu.data)

        cycle = self.client.patch(
            reverse("website-navigation-item-detail", args=(parent.pk,)),
            {"parent_id": child.pk},
            format="json",
        )
        self.assertEqual(cycle.status_code, status.HTTP_400_BAD_REQUEST, cycle.data)

    def test_media_upload_validation_and_private_asset_filtering(self):
        with tempfile.TemporaryDirectory() as media_root, self.settings(MEDIA_ROOT=media_root):
            self.authenticate(self.admin)
            invalid_file = SimpleUploadedFile("script.svg", b"<svg></svg>", content_type="image/svg+xml")
            invalid = self.client.post(
                reverse("website-media-asset-list"),
                {"title": "Unsafe SVG", "kind": "image", "file": invalid_file},
                format="multipart",
            )
            self.assertEqual(invalid.status_code, status.HTTP_400_BAD_REQUEST, invalid.data)

            valid_file = SimpleUploadedFile("private.png", b"not-a-real-image", content_type="image/png")
            uploaded = self.client.post(
                reverse("website-media-asset-list"),
                {"title": "Private logo", "kind": "logo", "file": valid_file, "is_public": False},
                format="multipart",
            )
            self.assertEqual(uploaded.status_code, status.HTTP_201_CREATED, uploaded.data)
            asset = MediaAsset.objects.get(pk=uploaded.data["id"])
            self.create_product(name="Private asset product", slug="private-asset-product", logo=asset)

            self.client.force_authenticate(user=None)
            public = self.client.get(reverse("public-products-v1"))
            self.assertIsNone(public.data[0]["logo"])

    def test_product_referenced_by_integration_cannot_be_deleted(self):
        source = self.create_product(name="Protected source", slug="protected-source")
        destination = self.create_product(name="Protected destination", slug="protected-destination")
        Integration.objects.create(
            name="Protected connection",
            slug="protected-connection",
            source_product=source,
            destination_product=destination,
        )
        self.authenticate(self.admin)
        response = self.client.delete(reverse("website-product-detail", args=(source.pk,)))
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST, response.data)

    def test_public_sections_exclude_draft_sections(self):
        LandingSection.objects.create(
            key="private-section",
            section_type=LandingSection.SectionType.CUSTOM,
            title="Private",
            status=LandingSection.Status.DRAFT,
        )
        response = self.client.get(reverse("public-sections-v1"))
        self.assertNotIn("private-section", [item["key"] for item in response.data])
