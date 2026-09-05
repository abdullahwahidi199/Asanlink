from django.conf import settings
from django.core.cache import cache
from django.db.models import Prefetch, Q

from .models import (
    BrandingSettings,
    CompanyProfile,
    ContactChannel,
    ContactSettings,
    Feature,
    FooterSettings,
    Integration,
    LandingSection,
    NavigationItem,
    NavigationMenu,
    Product,
    ProductFeature,
    ProductMedia,
    SEOSettings,
    WebsiteSettings,
)
from .serializers import (
    BrandingSettingsPublicSerializer,
    CompanyProfilePublicSerializer,
    ContactChannelPublicSerializer,
    ContactSettingsPublicSerializer,
    FooterSettingsPublicSerializer,
    IntegrationPublicSerializer,
    LandingSectionPublicSerializer,
    NavigationMenuPublicSerializer,
    ProductPublicSerializer,
    SEOSettingsPublicSerializer,
    WebsiteSettingsPublicSerializer,
)


PUBLIC_CACHE_KEYS = {
    "site": "website:public:v1:site",
    "company": "website:public:v1:company",
    "branding": "website:public:v1:branding",
    "navigation": "website:public:v1:navigation",
    "products": "website:public:v1:products",
    "integrations": "website:public:v1:integrations",
    "sections": "website:public:v1:sections",
}


def public_cache_timeout():
    return int(getattr(settings, "PUBLIC_SITE_CACHE_TIMEOUT", 60))


def invalidate_public_website_cache():
    cache.delete_many(PUBLIC_CACHE_KEYS.values())


def _singleton(model):
    return model.objects.filter(singleton_key="default").first()


def public_navigation_queryset():
    items = NavigationItem.objects.filter(is_enabled=True).select_related("parent").order_by(
        "display_order", "id"
    )
    return NavigationMenu.objects.filter(is_active=True).prefetch_related(
        Prefetch("items", queryset=items)
    ).order_by("location", "name")


def public_sections_queryset():
    features = (
        Feature.objects.filter(status=Feature.Status.PUBLISHED, is_visible=True)
        .select_related("icon")
        .order_by("display_order", "id")
    )
    return (
        LandingSection.objects.filter(
            status=LandingSection.Status.PUBLISHED,
            is_visible=True,
        )
        .select_related("image", "call_to_action")
        .prefetch_related(Prefetch("features", queryset=features))
        .order_by("display_order", "id")
    )


def public_products_queryset():
    features = ProductFeature.objects.filter(is_visible=True).order_by("display_order", "id")
    media = (
        ProductMedia.objects.filter(is_visible=True, asset__is_public=True)
        .select_related("asset")
        .order_by("display_order", "id")
    )
    return (
        Product.objects.filter(status=Product.Status.PUBLISHED, is_visible=True)
        .filter(
            Q(category__isnull=True)
            | Q(
                category__status=Product.Status.PUBLISHED,
                category__is_visible=True,
            )
        )
        .select_related(
            "category",
            "logo",
            "cover_image",
            "open_graph_image",
        )
        .prefetch_related(
            Prefetch("features", queryset=features),
            Prefetch("media_items", queryset=media),
        )
        .order_by("display_order", "name")
    )


def public_integrations_queryset():
    return (
        Integration.objects.filter(
            status=Integration.Status.PUBLISHED,
            is_visible=True,
            source_product__status=Product.Status.PUBLISHED,
            source_product__is_visible=True,
            destination_product__status=Product.Status.PUBLISHED,
            destination_product__is_visible=True,
        )
        .select_related(
            "source_product",
            "source_product__logo",
            "destination_product",
            "destination_product__logo",
            "icon",
        )
        .order_by("display_order", "name")
    )


def _website_data():
    instance = _singleton(WebsiteSettings)
    return WebsiteSettingsPublicSerializer(instance).data if instance else None


def _company_data():
    profile = _singleton(CompanyProfile)
    contact = _singleton(ContactSettings)
    channels = ContactChannel.objects.filter(is_visible=True).select_related("icon").order_by(
        "display_order", "id"
    )
    return {
        "profile": CompanyProfilePublicSerializer(profile).data if profile else None,
        "contact": ContactSettingsPublicSerializer(contact).data if contact else None,
        "channels": ContactChannelPublicSerializer(channels, many=True).data,
    }


def _branding_data():
    instance = _singleton(BrandingSettings)
    return BrandingSettingsPublicSerializer(instance).data if instance else None


def _seo_data():
    instance = _singleton(SEOSettings)
    return SEOSettingsPublicSerializer(instance).data if instance else None


def _footer_data():
    instance = _singleton(FooterSettings)
    return FooterSettingsPublicSerializer(instance).data if instance else None


def build_public_navigation():
    return NavigationMenuPublicSerializer(public_navigation_queryset(), many=True).data


def build_public_sections():
    return LandingSectionPublicSerializer(public_sections_queryset(), many=True).data


def build_public_products():
    return ProductPublicSerializer(public_products_queryset(), many=True).data


def build_public_integrations():
    return IntegrationPublicSerializer(public_integrations_queryset(), many=True).data


def build_public_company():
    return _company_data()


def build_public_branding():
    return _branding_data()


def build_public_site():
    return {
        "schema_version": "1.0",
        "website": _website_data(),
        "company": _company_data(),
        "branding": _branding_data(),
        "seo": _seo_data(),
        "navigation": build_public_navigation(),
        "sections": build_public_sections(),
        "products": build_public_products(),
        "integrations": build_public_integrations(),
        "footer": _footer_data(),
    }


def cached_public_payload(name, builder):
    key = PUBLIC_CACHE_KEYS[name]
    payload = cache.get(key)
    if payload is None:
        payload = builder()
        cache.set(key, payload, public_cache_timeout())
    return payload

