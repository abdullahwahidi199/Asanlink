import copy

from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

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


class CleanModelSerializer(serializers.ModelSerializer):
    """Run model validation so API writes honor the same rules as Django admin."""

    def validate(self, attrs):
        attrs = super().validate(attrs)
        candidate = copy.copy(self.instance) if self.instance else self.Meta.model()
        for name, value in attrs.items():
            setattr(candidate, name, value)
        try:
            candidate.full_clean()
        except DjangoValidationError as exc:
            details = getattr(exc, "message_dict", None) or {
                "non_field_errors": exc.messages
            }
            raise serializers.ValidationError(details) from exc
        return attrs


class MediaAssetPublicSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()

    class Meta:
        model = MediaAsset
        fields = ("id", "title", "alt_text", "kind", "url")
        read_only_fields = fields

    def get_url(self, obj):
        if not obj.is_public or not obj.file:
            return None
        try:
            return obj.file.url
        except ValueError:
            return None

    def to_representation(self, instance):
        if not instance.is_public:
            return None
        return super().to_representation(instance)


class MediaAssetSerializer(CleanModelSerializer):
    url = serializers.SerializerMethodField()
    uploaded_by_name = serializers.CharField(source="uploaded_by.username", read_only=True)

    class Meta:
        model = MediaAsset
        fields = (
            "id",
            "title",
            "alt_text",
            "kind",
            "file",
            "url",
            "original_name",
            "mime_type",
            "file_size",
            "is_public",
            "uploaded_by",
            "uploaded_by_name",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "url",
            "original_name",
            "mime_type",
            "file_size",
            "uploaded_by",
            "uploaded_by_name",
            "created_at",
            "updated_at",
        )

    def get_url(self, obj):
        if not obj.file:
            return None
        try:
            return obj.file.url
        except ValueError:
            return None

    def _file_metadata(self, validated_data):
        uploaded = validated_data.get("file")
        if uploaded:
            validated_data["original_name"] = uploaded.name
            validated_data["mime_type"] = getattr(uploaded, "content_type", "") or ""
            validated_data["file_size"] = uploaded.size
        return validated_data

    def create(self, validated_data):
        return super().create(self._file_metadata(validated_data))

    def update(self, instance, validated_data):
        return super().update(instance, self._file_metadata(validated_data))


class AssetRelationMixin:
    asset_fields = ()

    @classmethod
    def _declared_asset_fields(cls):
        fields = {}
        for field_name in cls.asset_fields:
            fields[field_name] = MediaAssetPublicSerializer(read_only=True)
            fields[f"{field_name}_id"] = serializers.PrimaryKeyRelatedField(
                source=field_name,
                queryset=MediaAsset.objects.all(),
                allow_null=True,
                required=False,
                write_only=True,
            )
        return fields


class WebsiteSettingsSerializer(CleanModelSerializer):
    class Meta:
        model = WebsiteSettings
        exclude = ("singleton_key",)
        read_only_fields = ("id", "created_at", "updated_at")


class CompanyProfileSerializer(CleanModelSerializer):
    class Meta:
        model = CompanyProfile
        exclude = ("singleton_key",)
        read_only_fields = ("id", "created_at", "updated_at")


class BrandingSettingsSerializer(CleanModelSerializer):
    logo = MediaAssetPublicSerializer(read_only=True)
    logo_id = serializers.PrimaryKeyRelatedField(
        source="logo", queryset=MediaAsset.objects.all(), allow_null=True, required=False, write_only=True
    )
    dark_logo = MediaAssetPublicSerializer(read_only=True)
    dark_logo_id = serializers.PrimaryKeyRelatedField(
        source="dark_logo", queryset=MediaAsset.objects.all(), allow_null=True, required=False, write_only=True
    )
    favicon = MediaAssetPublicSerializer(read_only=True)
    favicon_id = serializers.PrimaryKeyRelatedField(
        source="favicon", queryset=MediaAsset.objects.all(), allow_null=True, required=False, write_only=True
    )

    class Meta:
        model = BrandingSettings
        exclude = ("singleton_key",)
        read_only_fields = ("id", "created_at", "updated_at")


class ContactSettingsSerializer(CleanModelSerializer):
    class Meta:
        model = ContactSettings
        exclude = ("singleton_key",)
        read_only_fields = ("id", "created_at", "updated_at")


class SEOSettingsSerializer(CleanModelSerializer):
    open_graph_image = MediaAssetPublicSerializer(read_only=True)
    open_graph_image_id = serializers.PrimaryKeyRelatedField(
        source="open_graph_image",
        queryset=MediaAsset.objects.all(),
        allow_null=True,
        required=False,
        write_only=True,
    )

    class Meta:
        model = SEOSettings
        exclude = ("singleton_key",)
        read_only_fields = ("id", "created_at", "updated_at")


class FooterSettingsSerializer(CleanModelSerializer):
    class Meta:
        model = FooterSettings
        exclude = ("singleton_key",)
        read_only_fields = ("id", "created_at", "updated_at")


class WebsiteSettingsPublicSerializer(serializers.ModelSerializer):
    class Meta:
        model = WebsiteSettings
        fields = (
            "default_language",
            "announcement_text",
            "announcement_url",
            "show_announcement",
        )
        read_only_fields = fields


class CompanyProfilePublicSerializer(serializers.ModelSerializer):
    class Meta:
        model = CompanyProfile
        fields = (
            "name",
            "legal_name",
            "tagline",
            "short_description",
            "long_description",
            "website",
            "founded_year",
            "copyright_text",
        )
        read_only_fields = fields


class BrandingSettingsPublicSerializer(serializers.ModelSerializer):
    logo = MediaAssetPublicSerializer(read_only=True)
    dark_logo = MediaAssetPublicSerializer(read_only=True)
    favicon = MediaAssetPublicSerializer(read_only=True)

    class Meta:
        model = BrandingSettings
        fields = (
            "primary_color",
            "secondary_color",
            "accent_color",
            "background_color",
            "text_color",
            "dark_primary_color",
            "dark_secondary_color",
            "dark_accent_color",
            "dark_background_color",
            "dark_text_color",
            "logo",
            "dark_logo",
            "favicon",
        )
        read_only_fields = fields


class ContactSettingsPublicSerializer(serializers.ModelSerializer):
    class Meta:
        model = ContactSettings
        fields = (
            "contact_title",
            "contact_description",
            "general_email",
            "sales_email",
            "support_email",
            "primary_phone",
            "address_line_1",
            "address_line_2",
            "city",
            "region",
            "country",
            "postal_code",
            "business_hours",
        )
        read_only_fields = fields


class SEOSettingsPublicSerializer(serializers.ModelSerializer):
    open_graph_image = MediaAssetPublicSerializer(read_only=True)

    class Meta:
        model = SEOSettings
        fields = (
            "site_title",
            "meta_description",
            "keywords",
            "open_graph_title",
            "open_graph_description",
            "open_graph_image",
            "canonical_url",
            "robots",
        )
        read_only_fields = fields


class FooterSettingsPublicSerializer(serializers.ModelSerializer):
    class Meta:
        model = FooterSettings
        fields = (
            "is_visible",
            "show_logo",
            "show_navigation",
            "show_social_links",
            "legal_text",
        )
        read_only_fields = fields


class ContactChannelSerializer(CleanModelSerializer):
    icon = MediaAssetPublicSerializer(read_only=True)
    icon_id = serializers.PrimaryKeyRelatedField(
        source="icon", queryset=MediaAsset.objects.all(), allow_null=True, required=False, write_only=True
    )

    class Meta:
        model = ContactChannel
        fields = "__all__"
        read_only_fields = ("id", "created_at", "updated_at")


class ContactChannelPublicSerializer(serializers.ModelSerializer):
    icon = MediaAssetPublicSerializer(read_only=True)

    class Meta:
        model = ContactChannel
        fields = (
            "id",
            "channel_type",
            "label",
            "value",
            "url",
            "icon_name",
            "icon",
            "display_order",
        )
        read_only_fields = fields


class NavigationMenuSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = NavigationMenu
        fields = ("id", "name", "slug", "location", "is_active")
        read_only_fields = fields


class NavigationItemSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = NavigationItem
        fields = ("id", "label")
        read_only_fields = fields


class NavigationItemSerializer(CleanModelSerializer):
    menu = NavigationMenuSummarySerializer(read_only=True)
    menu_id = serializers.PrimaryKeyRelatedField(source="menu", queryset=NavigationMenu.objects.all())
    parent = NavigationItemSummarySerializer(read_only=True)
    parent_id = serializers.PrimaryKeyRelatedField(
        source="parent",
        queryset=NavigationItem.objects.all(),
        allow_null=True,
        required=False,
        write_only=True,
    )
    href = serializers.CharField(read_only=True)

    class Meta:
        model = NavigationItem
        fields = (
            "id",
            "menu",
            "menu_id",
            "parent",
            "parent_id",
            "label",
            "link_type",
            "internal_path",
            "external_url",
            "href",
            "open_in_new_tab",
            "is_enabled",
            "display_order",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "href", "created_at", "updated_at")


class NavigationMenuSerializer(CleanModelSerializer):
    items_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = NavigationMenu
        fields = "__all__"
        read_only_fields = ("id", "items_count", "created_at", "updated_at")


class NavigationItemPublicSerializer(serializers.ModelSerializer):
    href = serializers.CharField(read_only=True)
    children = serializers.SerializerMethodField()

    class Meta:
        model = NavigationItem
        fields = (
            "id",
            "label",
            "link_type",
            "href",
            "open_in_new_tab",
            "display_order",
            "children",
        )
        read_only_fields = fields

    def get_children(self, obj):
        children = [item for item in obj.children.all() if item.is_enabled]
        children.sort(key=lambda item: (item.display_order, item.id))
        return NavigationItemPublicSerializer(children, many=True).data


class NavigationMenuPublicSerializer(serializers.ModelSerializer):
    items = serializers.SerializerMethodField()

    class Meta:
        model = NavigationMenu
        fields = ("id", "name", "slug", "location", "items")
        read_only_fields = fields

    def get_items(self, obj):
        roots = [item for item in obj.items.all() if item.is_enabled and item.parent_id is None]
        roots.sort(key=lambda item: (item.display_order, item.id))
        return NavigationItemPublicSerializer(roots, many=True).data


class CallToActionSerializer(CleanModelSerializer):
    class Meta:
        model = CallToAction
        fields = "__all__"
        read_only_fields = ("id", "published_at", "created_at", "updated_at")


class CallToActionPublicSerializer(serializers.ModelSerializer):
    class Meta:
        model = CallToAction
        fields = (
            "id",
            "slug",
            "title",
            "description",
            "primary_label",
            "primary_url",
            "secondary_label",
            "secondary_url",
        )
        read_only_fields = fields


class LandingSectionSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = LandingSection
        fields = ("id", "key", "section_type", "title")
        read_only_fields = fields


class FeatureSerializer(CleanModelSerializer):
    section = LandingSectionSummarySerializer(read_only=True)
    section_id = serializers.PrimaryKeyRelatedField(
        source="section", queryset=LandingSection.objects.all()
    )
    icon = MediaAssetPublicSerializer(read_only=True)
    icon_id = serializers.PrimaryKeyRelatedField(
        source="icon", queryset=MediaAsset.objects.all(), allow_null=True, required=False, write_only=True
    )

    class Meta:
        model = Feature
        fields = "__all__"
        read_only_fields = ("id", "published_at", "created_at", "updated_at")


class FeaturePublicSerializer(serializers.ModelSerializer):
    icon = MediaAssetPublicSerializer(read_only=True)

    class Meta:
        model = Feature
        fields = ("id", "title", "description", "icon_name", "icon", "display_order")
        read_only_fields = fields


class LandingSectionSerializer(CleanModelSerializer):
    image = MediaAssetPublicSerializer(read_only=True)
    image_id = serializers.PrimaryKeyRelatedField(
        source="image", queryset=MediaAsset.objects.all(), allow_null=True, required=False, write_only=True
    )
    call_to_action = CallToActionPublicSerializer(read_only=True)
    call_to_action_id = serializers.PrimaryKeyRelatedField(
        source="call_to_action",
        queryset=CallToAction.objects.all(),
        allow_null=True,
        required=False,
        write_only=True,
    )
    features = FeaturePublicSerializer(many=True, read_only=True)

    class Meta:
        model = LandingSection
        fields = "__all__"
        read_only_fields = ("id", "published_at", "created_at", "updated_at")


class LandingSectionPublicSerializer(serializers.ModelSerializer):
    image = MediaAssetPublicSerializer(read_only=True)
    call_to_action = serializers.SerializerMethodField()
    features = serializers.SerializerMethodField()

    class Meta:
        model = LandingSection
        fields = (
            "id",
            "key",
            "section_type",
            "title",
            "subtitle",
            "description",
            "image",
            "call_to_action",
            "features",
            "content",
            "display_order",
        )
        read_only_fields = fields

    def get_call_to_action(self, obj):
        cta = obj.call_to_action
        if not cta or cta.status != cta.Status.PUBLISHED or not cta.is_visible:
            return None
        return CallToActionPublicSerializer(cta).data

    def get_features(self, obj):
        features = [
            item
            for item in obj.features.all()
            if item.status == item.Status.PUBLISHED and item.is_visible
        ]
        features.sort(key=lambda item: (item.display_order, item.id))
        return FeaturePublicSerializer(features, many=True).data

class ProductCategorySerializer(CleanModelSerializer):
    class Meta:
        model = ProductCategory
        fields = "__all__"
        read_only_fields = ("id", "published_at", "created_at", "updated_at")


class ProductCategoryPublicSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductCategory
        fields = ("id", "name", "slug", "description", "display_order")
        read_only_fields = fields


class ProductSummarySerializer(serializers.ModelSerializer):
    logo = MediaAssetPublicSerializer(read_only=True)

    class Meta:
        model = Product
        fields = ("id", "name", "slug", "logo", "status", "is_visible")
        read_only_fields = fields


class ProductPublicSummarySerializer(serializers.ModelSerializer):
    logo = MediaAssetPublicSerializer(read_only=True)

    class Meta:
        model = Product
        fields = ("id", "name", "slug", "logo", "product_url")
        read_only_fields = fields


class ProductFeatureSerializer(CleanModelSerializer):
    product = ProductSummarySerializer(read_only=True)
    product_id = serializers.PrimaryKeyRelatedField(source="product", queryset=Product.objects.all())

    class Meta:
        model = ProductFeature
        fields = "__all__"
        read_only_fields = ("id", "created_at", "updated_at")


class ProductFeaturePublicSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductFeature
        fields = ("id", "title", "description", "display_order")
        read_only_fields = fields


class ProductMediaSerializer(CleanModelSerializer):
    product = ProductSummarySerializer(read_only=True)
    product_id = serializers.PrimaryKeyRelatedField(source="product", queryset=Product.objects.all())
    asset = MediaAssetPublicSerializer(read_only=True)
    asset_id = serializers.PrimaryKeyRelatedField(source="asset", queryset=MediaAsset.objects.all())

    class Meta:
        model = ProductMedia
        fields = "__all__"
        read_only_fields = ("id", "created_at", "updated_at")


class ProductMediaPublicSerializer(serializers.ModelSerializer):
    asset = MediaAssetPublicSerializer(read_only=True)

    class Meta:
        model = ProductMedia
        fields = ("id", "kind", "caption", "asset", "display_order")
        read_only_fields = fields


class ProductSerializer(CleanModelSerializer):
    category = ProductCategoryPublicSerializer(read_only=True)
    category_id = serializers.PrimaryKeyRelatedField(
        source="category",
        queryset=ProductCategory.objects.all(),
        allow_null=True,
        required=False,
        write_only=True,
    )
    logo = MediaAssetPublicSerializer(read_only=True)
    logo_id = serializers.PrimaryKeyRelatedField(
        source="logo", queryset=MediaAsset.objects.all(), allow_null=True, required=False, write_only=True
    )
    cover_image = MediaAssetPublicSerializer(read_only=True)
    cover_image_id = serializers.PrimaryKeyRelatedField(
        source="cover_image", queryset=MediaAsset.objects.all(), allow_null=True, required=False, write_only=True
    )
    open_graph_image = MediaAssetPublicSerializer(read_only=True)
    open_graph_image_id = serializers.PrimaryKeyRelatedField(
        source="open_graph_image",
        queryset=MediaAsset.objects.all(),
        allow_null=True,
        required=False,
        write_only=True,
    )
    features = ProductFeaturePublicSerializer(many=True, read_only=True)
    media_items = ProductMediaPublicSerializer(many=True, read_only=True)

    class Meta:
        model = Product
        fields = "__all__"
        read_only_fields = ("id", "published_at", "created_at", "updated_at")


class ProductPublicSerializer(serializers.ModelSerializer):
    category = ProductCategoryPublicSerializer(read_only=True)
    logo = MediaAssetPublicSerializer(read_only=True)
    cover_image = MediaAssetPublicSerializer(read_only=True)
    open_graph_image = MediaAssetPublicSerializer(read_only=True)
    features = serializers.SerializerMethodField()
    media_items = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = (
            "id",
            "name",
            "slug",
            "short_description",
            "full_description",
            "category",
            "logo",
            "cover_image",
            "product_url",
            "is_featured",
            "cta_label",
            "cta_url",
            "technical_information",
            "seo_title",
            "seo_description",
            "seo_keywords",
            "canonical_url",
            "open_graph_image",
            "features",
            "media_items",
            "display_order",
        )
        read_only_fields = fields

    def get_features(self, obj):
        features = [item for item in obj.features.all() if item.is_visible]
        features.sort(key=lambda item: (item.display_order, item.id))
        return ProductFeaturePublicSerializer(features, many=True).data

    def get_media_items(self, obj):
        media = [item for item in obj.media_items.all() if item.is_visible and item.asset.is_public]
        media.sort(key=lambda item: (item.display_order, item.id))
        return ProductMediaPublicSerializer(media, many=True).data


class IntegrationSerializer(CleanModelSerializer):
    source_product = ProductSummarySerializer(read_only=True)
    source_product_id = serializers.PrimaryKeyRelatedField(
        source="source_product", queryset=Product.objects.all()
    )
    destination_product = ProductSummarySerializer(read_only=True)
    destination_product_id = serializers.PrimaryKeyRelatedField(
        source="destination_product", queryset=Product.objects.all()
    )
    icon = MediaAssetPublicSerializer(read_only=True)
    icon_id = serializers.PrimaryKeyRelatedField(
        source="icon", queryset=MediaAsset.objects.all(), allow_null=True, required=False, write_only=True
    )

    class Meta:
        model = Integration
        fields = "__all__"
        read_only_fields = ("id", "published_at", "created_at", "updated_at")


class IntegrationPublicSerializer(serializers.ModelSerializer):
    source_product = ProductPublicSummarySerializer(read_only=True)
    destination_product = ProductPublicSummarySerializer(read_only=True)
    icon = MediaAssetPublicSerializer(read_only=True)

    class Meta:
        model = Integration
        fields = (
            "id",
            "name",
            "slug",
            "source_product",
            "destination_product",
            "description",
            "operational_status",
            "integration_type",
            "is_bidirectional",
            "icon",
            "documentation_url",
            "api_information",
            "display_order",
        )
        read_only_fields = fields
