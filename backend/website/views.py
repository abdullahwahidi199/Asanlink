from django.db import transaction
from django.db.models import Count
from django.db.models.deletion import ProtectedError
from django.shortcuts import get_object_or_404
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.authorization import HasSystemPermission

from .models import (
    BrandingSettings,
    CallToAction,
    CompanyProfile,
    ContactChannel,
    ContactSettings,
    Feature,
    FooterSettings,
    Integration,
    LandingSection,
    MediaAsset,
    NavigationItem,
    NavigationMenu,
    Product,
    ProductCategory,
    ProductFeature,
    ProductMedia,
    SEOSettings,
    WebsiteSettings,
)
from .serializers import (
    BrandingSettingsSerializer,
    CompanyProfileSerializer,
    ContactChannelSerializer,
    ContactSettingsSerializer,
    FeatureSerializer,
    FooterSettingsSerializer,
    IntegrationSerializer,
    LandingSectionSerializer,
    MediaAssetSerializer,
    NavigationItemSerializer,
    NavigationMenuSerializer,
    ProductCategorySerializer,
    ProductFeatureSerializer,
    ProductMediaSerializer,
    ProductPublicSerializer,
    ProductSerializer,
    SEOSettingsSerializer,
    WebsiteSettingsSerializer,
    CallToActionSerializer,
)
from .services import (
    build_public_branding,
    build_public_company,
    build_public_integrations,
    build_public_navigation,
    build_public_products,
    build_public_sections,
    build_public_site,
    cached_public_payload,
    invalidate_public_website_cache,
    public_cache_timeout,
    public_products_queryset,
)


class SingletonConfigView(APIView):
    permission_classes = (IsAuthenticated, HasSystemPermission)
    model = None
    serializer_class = None
    manage_permission = None

    def get_required_system_permissions(self, request):
        return ("website.view",) if request.method == "GET" else (self.manage_permission,)

    def get_object(self):
        return get_object_or_404(self.model, singleton_key="default")

    def get(self, request):
        return Response(self.serializer_class(self.get_object()).data)

    def put(self, request):
        return self._update(request, partial=False)

    def patch(self, request):
        return self._update(request, partial=True)

    def _update(self, request, *, partial):
        serializer = self.serializer_class(
            self.get_object(), data=request.data, partial=partial
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class WebsiteSettingsView(SingletonConfigView):
    model = WebsiteSettings
    serializer_class = WebsiteSettingsSerializer
    manage_permission = "website.settings.manage"


class CompanyProfileView(SingletonConfigView):
    model = CompanyProfile
    serializer_class = CompanyProfileSerializer
    manage_permission = "website.company.manage"


class BrandingSettingsView(SingletonConfigView):
    model = BrandingSettings
    serializer_class = BrandingSettingsSerializer
    manage_permission = "website.branding.manage"


class ContactSettingsView(SingletonConfigView):
    model = ContactSettings
    serializer_class = ContactSettingsSerializer
    manage_permission = "website.contact.manage"


class SEOSettingsView(SingletonConfigView):
    model = SEOSettings
    serializer_class = SEOSettingsSerializer
    manage_permission = "website.seo.manage"


class FooterSettingsView(SingletonConfigView):
    model = FooterSettings
    serializer_class = FooterSettingsSerializer
    manage_permission = "website.settings.manage"


class ProtectedDestroyMixin:
    protected_delete_message = "This item is still referenced and cannot be deleted. Archive or detach it first."

    def perform_destroy(self, instance):
        try:
            instance.delete()
        except ProtectedError as exc:
            raise ValidationError(self.protected_delete_message) from exc


class WebsiteModelViewSet(ProtectedDestroyMixin, viewsets.ModelViewSet):
    permission_classes = (IsAuthenticated, HasSystemPermission)
    manage_permission = None

    def get_required_system_permissions(self, request):
        if self.action in {"list", "retrieve"}:
            return ("website.view",)
        return (self.manage_permission,)


class ReorderMixin:
    @action(detail=False, methods=("post",))
    def reorder(self, request):
        items = request.data.get("items")
        if not isinstance(items, list) or not items:
            raise ValidationError({"items": "Provide a non-empty list of id/display_order values."})

        normalized = []
        ids = set()
        for item in items:
            if not isinstance(item, dict) or "id" not in item or "display_order" not in item:
                raise ValidationError({"items": "Each item requires id and display_order."})
            try:
                item_id = int(item["id"])
                display_order = int(item["display_order"])
            except (TypeError, ValueError) as exc:
                raise ValidationError({"items": "IDs and display orders must be integers."}) from exc
            if item_id in ids:
                raise ValidationError({"items": "Each item may appear only once."})
            if display_order < 0:
                raise ValidationError({"items": "Display order cannot be negative."})
            ids.add(item_id)
            normalized.append((item_id, display_order))

        objects = {item.pk: item for item in self.queryset.model.objects.filter(pk__in=ids)}
        if len(objects) != len(ids):
            raise ValidationError({"items": "One or more items do not exist."})
        for item_id, display_order in normalized:
            objects[item_id].display_order = display_order
        with transaction.atomic():
            self.queryset.model.objects.bulk_update(objects.values(), ("display_order",))
        invalidate_public_website_cache()
        return Response({"updated": len(objects)})


class PublicationActionsMixin:
    def _set_publication_status(self, request, value):
        instance = self.get_object()
        instance.status = value
        instance.full_clean()
        instance.save()
        return Response(self.get_serializer(instance).data)

    @action(detail=True, methods=("post",))
    def publish(self, request, pk=None):
        return self._set_publication_status(request, self.queryset.model.Status.PUBLISHED)

    @action(detail=True, methods=("post",))
    def unpublish(self, request, pk=None):
        return self._set_publication_status(request, self.queryset.model.Status.DRAFT)

    @action(detail=True, methods=("post",))
    def archive(self, request, pk=None):
        return self._set_publication_status(request, self.queryset.model.Status.ARCHIVED)


class MediaAssetViewSet(WebsiteModelViewSet):
    queryset = MediaAsset.objects.select_related("uploaded_by").all()
    serializer_class = MediaAssetSerializer
    manage_permission = "website.media.manage"
    search_fields = ("title", "alt_text", "original_name")
    ordering_fields = ("title", "kind", "is_public", "created_at", "updated_at")
    ordering = ("-created_at",)

    def perform_create(self, serializer):
        serializer.save(uploaded_by=self.request.user)


class NavigationMenuViewSet(WebsiteModelViewSet):
    queryset = NavigationMenu.objects.annotate(items_count=Count("items"))
    serializer_class = NavigationMenuSerializer
    manage_permission = "website.navigation.manage"
    search_fields = ("name", "slug")
    ordering_fields = ("name", "location", "is_active", "created_at", "updated_at")
    ordering = ("location", "name")


class NavigationItemViewSet(ReorderMixin, WebsiteModelViewSet):
    queryset = NavigationItem.objects.select_related("menu", "parent").all()
    serializer_class = NavigationItemSerializer
    manage_permission = "website.navigation.manage"
    search_fields = ("label", "internal_path", "external_url", "menu__name")
    ordering_fields = ("label", "display_order", "is_enabled", "created_at", "updated_at")
    ordering = ("menu", "parent_id", "display_order", "id")


class CallToActionViewSet(PublicationActionsMixin, ReorderMixin, WebsiteModelViewSet):
    queryset = CallToAction.objects.all()
    serializer_class = CallToActionSerializer
    manage_permission = "website.landing.manage"
    search_fields = ("name", "slug", "title", "description")
    ordering_fields = ("name", "display_order", "status", "is_visible", "updated_at")
    ordering = ("display_order", "name")


class LandingSectionViewSet(PublicationActionsMixin, ReorderMixin, WebsiteModelViewSet):
    queryset = LandingSection.objects.select_related("image", "call_to_action").prefetch_related("features")
    serializer_class = LandingSectionSerializer
    manage_permission = "website.landing.manage"
    search_fields = ("key", "title", "subtitle", "description")
    ordering_fields = ("key", "section_type", "display_order", "status", "is_visible", "updated_at")
    ordering = ("display_order", "id")


class FeatureViewSet(PublicationActionsMixin, ReorderMixin, WebsiteModelViewSet):
    queryset = Feature.objects.select_related("section", "icon").all()
    serializer_class = FeatureSerializer
    manage_permission = "website.landing.manage"
    search_fields = ("title", "description", "section__title", "section__key")
    ordering_fields = ("title", "display_order", "status", "is_visible", "updated_at")
    ordering = ("section", "display_order", "id")


class ProductCategoryViewSet(PublicationActionsMixin, ReorderMixin, WebsiteModelViewSet):
    queryset = ProductCategory.objects.all()
    serializer_class = ProductCategorySerializer
    manage_permission = "website.products.manage"
    search_fields = ("name", "slug", "description")
    ordering_fields = ("name", "display_order", "status", "is_visible", "updated_at")
    ordering = ("display_order", "name")


class ProductViewSet(PublicationActionsMixin, ReorderMixin, WebsiteModelViewSet):
    queryset = (
        Product.objects.select_related(
            "category", "logo", "cover_image", "open_graph_image"
        )
        .prefetch_related("features", "media_items__asset")
        .all()
    )
    serializer_class = ProductSerializer
    manage_permission = "website.products.manage"
    search_fields = ("name", "slug", "short_description", "full_description", "category__name")
    ordering_fields = ("name", "display_order", "status", "is_visible", "is_featured", "updated_at")
    ordering = ("display_order", "name")
    protected_delete_message = "This product is used by an integration. Archive it or remove the integration first."


class ProductFeatureViewSet(ReorderMixin, WebsiteModelViewSet):
    queryset = ProductFeature.objects.select_related("product").all()
    serializer_class = ProductFeatureSerializer
    manage_permission = "website.products.manage"
    search_fields = ("title", "description", "product__name")
    ordering_fields = ("title", "display_order", "is_visible", "updated_at")
    ordering = ("product", "display_order", "id")


class ProductMediaViewSet(ReorderMixin, WebsiteModelViewSet):
    queryset = ProductMedia.objects.select_related("product", "asset").all()
    serializer_class = ProductMediaSerializer
    manage_permission = "website.products.manage"
    search_fields = ("product__name", "asset__title", "caption")
    ordering_fields = ("display_order", "kind", "is_visible", "updated_at")
    ordering = ("product", "display_order", "id")


class IntegrationViewSet(PublicationActionsMixin, ReorderMixin, WebsiteModelViewSet):
    queryset = Integration.objects.select_related(
        "source_product",
        "source_product__logo",
        "destination_product",
        "destination_product__logo",
        "icon",
    ).all()
    serializer_class = IntegrationSerializer
    manage_permission = "website.integrations.manage"
    search_fields = (
        "name",
        "slug",
        "description",
        "integration_type",
        "source_product__name",
        "destination_product__name",
    )
    ordering_fields = ("name", "display_order", "status", "operational_status", "is_visible", "updated_at")
    ordering = ("display_order", "name")


class ContactChannelViewSet(ReorderMixin, WebsiteModelViewSet):
    queryset = ContactChannel.objects.select_related("icon").all()
    serializer_class = ContactChannelSerializer
    manage_permission = "website.contact.manage"
    search_fields = ("label", "value", "url", "channel_type")
    ordering_fields = ("label", "display_order", "channel_type", "is_visible", "updated_at")
    ordering = ("display_order", "id")


class PublicAPIView(APIView):
    permission_classes = (AllowAny,)
    authentication_classes = ()
    cache_name = None
    builder = None

    def get(self, request):
        payload = cached_public_payload(self.cache_name, self.builder)
        response = Response(payload)
        timeout = public_cache_timeout()
        response["Cache-Control"] = f"public, max-age={timeout}, stale-while-revalidate={timeout * 5}"
        return response


class PublicSiteView(PublicAPIView):
    cache_name = "site"
    builder = staticmethod(build_public_site)


class PublicCompanyView(PublicAPIView):
    cache_name = "company"
    builder = staticmethod(build_public_company)


class PublicBrandingView(PublicAPIView):
    cache_name = "branding"
    builder = staticmethod(build_public_branding)


class PublicNavigationView(PublicAPIView):
    cache_name = "navigation"
    builder = staticmethod(build_public_navigation)


class PublicProductsView(PublicAPIView):
    cache_name = "products"
    builder = staticmethod(build_public_products)


class PublicIntegrationsView(PublicAPIView):
    cache_name = "integrations"
    builder = staticmethod(build_public_integrations)


class PublicSectionsView(PublicAPIView):
    cache_name = "sections"
    builder = staticmethod(build_public_sections)


class PublicProductDetailView(APIView):
    permission_classes = (AllowAny,)
    authentication_classes = ()

    def get(self, request, slug):
        product = get_object_or_404(public_products_queryset(), slug=slug)
        response = Response(ProductPublicSerializer(product).data)
        timeout = public_cache_timeout()
        response["Cache-Control"] = f"public, max-age={timeout}, stale-while-revalidate={timeout * 5}"
        return response
