from django.urls import path

from .views import (
    PublicBrandingView,
    PublicCompanyView,
    PublicIntegrationsView,
    PublicNavigationView,
    PublicProductDetailView,
    PublicProductsView,
    PublicSectionsView,
    PublicSiteView,
)


urlpatterns = [
    path("site/", PublicSiteView.as_view(), name="public-site-v1"),
    path("company/", PublicCompanyView.as_view(), name="public-company-v1"),
    path("branding/", PublicBrandingView.as_view(), name="public-branding-v1"),
    path("navigation/", PublicNavigationView.as_view(), name="public-navigation-v1"),
    path("products/", PublicProductsView.as_view(), name="public-products-v1"),
    path("products/<slug:slug>/", PublicProductDetailView.as_view(), name="public-product-detail-v1"),
    path("integrations/", PublicIntegrationsView.as_view(), name="public-integrations-v1"),
    path("sections/", PublicSectionsView.as_view(), name="public-sections-v1"),
]
