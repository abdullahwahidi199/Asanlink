from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    BrandingSettingsView,
    CallToActionViewSet,
    CompanyProfileView,
    ContactChannelViewSet,
    ContactSettingsView,
    FeatureViewSet,
    FooterSettingsView,
    IntegrationViewSet,
    LandingSectionViewSet,
    MediaAssetViewSet,
    NavigationItemViewSet,
    NavigationMenuViewSet,
    ProductCategoryViewSet,
    ProductFeatureViewSet,
    ProductMediaViewSet,
    ProductViewSet,
    SEOSettingsView,
    WebsiteSettingsView,
)


router = DefaultRouter()
router.register("media-assets", MediaAssetViewSet, basename="website-media-asset")
router.register("navigation-menus", NavigationMenuViewSet, basename="website-navigation-menu")
router.register("navigation-items", NavigationItemViewSet, basename="website-navigation-item")
router.register("ctas", CallToActionViewSet, basename="website-cta")
router.register("landing-sections", LandingSectionViewSet, basename="website-landing-section")
router.register("features", FeatureViewSet, basename="website-feature")
router.register("product-categories", ProductCategoryViewSet, basename="website-product-category")
router.register("products", ProductViewSet, basename="website-product")
router.register("product-features", ProductFeatureViewSet, basename="website-product-feature")
router.register("product-media", ProductMediaViewSet, basename="website-product-media")
router.register("integrations", IntegrationViewSet, basename="website-integration")
router.register("contact-channels", ContactChannelViewSet, basename="website-contact-channel")

urlpatterns = [
    path("settings/", WebsiteSettingsView.as_view(), name="website-settings"),
    path("company/", CompanyProfileView.as_view(), name="website-company"),
    path("branding/", BrandingSettingsView.as_view(), name="website-branding"),
    path("contact-settings/", ContactSettingsView.as_view(), name="website-contact-settings"),
    path("seo/", SEOSettingsView.as_view(), name="website-seo"),
    path("footer/", FooterSettingsView.as_view(), name="website-footer"),
    *router.urls,
]

