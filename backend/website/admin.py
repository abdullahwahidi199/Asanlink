from django.contrib import admin

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


class SingletonAdmin(admin.ModelAdmin):
    def has_add_permission(self, request):
        return not self.model.objects.exists() and super().has_add_permission(request)

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(WebsiteSettings)
class WebsiteSettingsAdmin(SingletonAdmin):
    list_display = ("__str__", "default_language", "show_announcement", "updated_at")


@admin.register(CompanyProfile)
class CompanyProfileAdmin(SingletonAdmin):
    list_display = ("name", "legal_name", "website", "updated_at")
    search_fields = ("name", "legal_name", "tagline")


@admin.register(BrandingSettings)
class BrandingSettingsAdmin(SingletonAdmin):
    list_display = ("__str__", "primary_color", "secondary_color", "accent_color", "updated_at")
    autocomplete_fields = ("logo", "dark_logo", "favicon")


@admin.register(ContactSettings)
class ContactSettingsAdmin(SingletonAdmin):
    list_display = ("__str__", "general_email", "primary_phone", "country", "updated_at")


@admin.register(SEOSettings)
class SEOSettingsAdmin(SingletonAdmin):
    list_display = ("site_title", "canonical_url", "robots", "updated_at")
    autocomplete_fields = ("open_graph_image",)


@admin.register(FooterSettings)
class FooterSettingsAdmin(SingletonAdmin):
    list_display = ("__str__", "is_visible", "show_navigation", "show_social_links", "updated_at")


@admin.register(MediaAsset)
class MediaAssetAdmin(admin.ModelAdmin):
    list_display = ("title", "kind", "original_name", "file_size", "is_public", "created_at")
    list_filter = ("kind", "is_public")
    search_fields = ("title", "alt_text", "original_name")
    readonly_fields = ("original_name", "mime_type", "file_size", "uploaded_by", "created_at", "updated_at")


class NavigationItemInline(admin.TabularInline):
    model = NavigationItem
    extra = 0
    fields = ("label", "parent", "link_type", "internal_path", "external_url", "open_in_new_tab", "display_order", "is_enabled")


@admin.register(NavigationMenu)
class NavigationMenuAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "location", "is_active", "updated_at")
    list_filter = ("location", "is_active")
    search_fields = ("name", "slug")
    prepopulated_fields = {"slug": ("name",)}
    inlines = (NavigationItemInline,)


@admin.register(NavigationItem)
class NavigationItemAdmin(admin.ModelAdmin):
    list_display = ("label", "menu", "parent", "link_type", "display_order", "is_enabled")
    list_filter = ("menu", "link_type", "is_enabled")
    search_fields = ("label", "internal_path", "external_url")
    autocomplete_fields = ("menu", "parent")


@admin.register(CallToAction)
class CallToActionAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "status", "is_visible", "display_order", "updated_at")
    list_filter = ("status", "is_visible")
    search_fields = ("name", "title", "description")
    prepopulated_fields = {"slug": ("name",)}


class FeatureInline(admin.TabularInline):
    model = Feature
    extra = 0
    fields = ("title", "icon_name", "display_order", "status", "is_visible")


@admin.register(LandingSection)
class LandingSectionAdmin(admin.ModelAdmin):
    list_display = ("key", "section_type", "title", "status", "is_visible", "display_order")
    list_filter = ("section_type", "status", "is_visible")
    search_fields = ("key", "title", "subtitle", "description")
    autocomplete_fields = ("image", "call_to_action")
    inlines = (FeatureInline,)


@admin.register(Feature)
class FeatureAdmin(admin.ModelAdmin):
    list_display = ("title", "section", "status", "is_visible", "display_order")
    list_filter = ("status", "is_visible", "section")
    search_fields = ("title", "description")
    autocomplete_fields = ("section", "icon")


@admin.register(ProductCategory)
class ProductCategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "status", "is_visible", "display_order")
    list_filter = ("status", "is_visible")
    search_fields = ("name", "slug", "description")
    prepopulated_fields = {"slug": ("name",)}


class ProductFeatureInline(admin.TabularInline):
    model = ProductFeature
    extra = 0
    fields = ("title", "description", "display_order", "is_visible")


class ProductMediaInline(admin.TabularInline):
    model = ProductMedia
    extra = 0
    fields = ("asset", "kind", "caption", "display_order", "is_visible")
    autocomplete_fields = ("asset",)


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ("name", "category", "status", "is_visible", "is_featured", "display_order")
    list_filter = ("status", "is_visible", "is_featured", "category")
    search_fields = ("name", "slug", "short_description", "full_description")
    prepopulated_fields = {"slug": ("name",)}
    autocomplete_fields = ("category", "logo", "cover_image", "open_graph_image")
    inlines = (ProductFeatureInline, ProductMediaInline)


@admin.register(ProductFeature)
class ProductFeatureAdmin(admin.ModelAdmin):
    list_display = ("title", "product", "is_visible", "display_order")
    list_filter = ("is_visible", "product")
    search_fields = ("title", "description", "product__name")
    autocomplete_fields = ("product",)


@admin.register(ProductMedia)
class ProductMediaAdmin(admin.ModelAdmin):
    list_display = ("product", "asset", "kind", "is_visible", "display_order")
    list_filter = ("kind", "is_visible", "product")
    search_fields = ("product__name", "asset__title", "caption")
    autocomplete_fields = ("product", "asset")


@admin.register(Integration)
class IntegrationAdmin(admin.ModelAdmin):
    list_display = ("name", "source_product", "destination_product", "operational_status", "status", "is_visible", "display_order")
    list_filter = ("operational_status", "integration_type", "status", "is_visible", "is_bidirectional")
    search_fields = ("name", "slug", "description", "source_product__name", "destination_product__name")
    prepopulated_fields = {"slug": ("name",)}
    autocomplete_fields = ("source_product", "destination_product", "icon")


@admin.register(ContactChannel)
class ContactChannelAdmin(admin.ModelAdmin):
    list_display = ("label", "channel_type", "value", "is_visible", "display_order")
    list_filter = ("channel_type", "is_visible")
    search_fields = ("label", "value", "url")
    autocomplete_fields = ("icon",)
