from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

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
from .services import invalidate_public_website_cache


PUBLIC_CONTENT_MODELS = (
    WebsiteSettings,
    CompanyProfile,
    BrandingSettings,
    ContactSettings,
    SEOSettings,
    FooterSettings,
    MediaAsset,
    ContactChannel,
    NavigationMenu,
    NavigationItem,
    CallToAction,
    LandingSection,
    Feature,
    ProductCategory,
    Product,
    ProductFeature,
    ProductMedia,
    Integration,
)


@receiver(post_save, sender=None)
@receiver(post_delete, sender=None)
def invalidate_on_public_content_change(sender, **kwargs):
    if sender in PUBLIC_CONTENT_MODELS:
        invalidate_public_website_cache()
