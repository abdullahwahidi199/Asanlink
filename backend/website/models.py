import uuid
from pathlib import Path

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator, RegexValidator
from django.db import models
from django.db.models import Q
from django.db.models.functions import Lower
from django.utils import timezone

from .validators import (
    validate_json_object,
    validate_public_link,
    validate_string_list,
    validate_website_file,
)


hex_color_validator = RegexValidator(
    regex=r"^#[0-9a-fA-F]{6}$",
    message="Use a six-digit hexadecimal color such as #0B63F6.",
)
integration_type_validator = RegexValidator(
    regex=r"^[a-z0-9]+(?:[._-][a-z0-9]+)*$",
    message="Use lowercase letters, numbers, dots, underscores, or hyphens.",
)


def website_asset_upload_path(instance, filename):
    extension = Path(filename).suffix.lower()
    today = timezone.localdate()
    return f"website/{instance.kind}/{today:%Y/%m}/{uuid.uuid4().hex}{extension}"


class TimeStampedModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class OrderedModel(models.Model):
    display_order = models.PositiveIntegerField(default=0)

    class Meta:
        abstract = True
        constraints = [
            models.CheckConstraint(
                condition=Q(display_order__gte=0),
                name="%(app_label)s_%(class)s_order_nonnegative",
            )
        ]


class PublishableModel(TimeStampedModel):
    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        PUBLISHED = "published", "Published"
        ARCHIVED = "archived", "Archived"

    status = models.CharField(max_length=16, choices=Status.choices, default=Status.DRAFT)
    is_visible = models.BooleanField(default=True)
    published_at = models.DateTimeField(blank=True, null=True, editable=False)

    class Meta:
        abstract = True

    def save(self, *args, **kwargs):
        if self.status == self.Status.PUBLISHED and self.published_at is None:
            self.published_at = timezone.now()
        elif self.status == self.Status.DRAFT:
            self.published_at = None
        super().save(*args, **kwargs)


class SingletonModel(TimeStampedModel):
    singleton_key = models.CharField(max_length=24, default="default", unique=True, editable=False)

    class Meta:
        abstract = True

    def save(self, *args, **kwargs):
        self.singleton_key = "default"
        super().save(*args, **kwargs)


class MediaAsset(TimeStampedModel):
    class Kind(models.TextChoices):
        IMAGE = "image", "Image"
        LOGO = "logo", "Logo"
        ICON = "icon", "Icon"
        FAVICON = "favicon", "Favicon"
        DOCUMENT = "document", "Document"

    title = models.CharField(max_length=160)
    alt_text = models.CharField(max_length=240, blank=True)
    kind = models.CharField(max_length=16, choices=Kind.choices, default=Kind.IMAGE)
    file = models.FileField(upload_to=website_asset_upload_path, validators=(validate_website_file,))
    original_name = models.CharField(max_length=255, blank=True, editable=False)
    mime_type = models.CharField(max_length=120, blank=True, editable=False)
    file_size = models.PositiveBigIntegerField(default=0, editable=False)
    is_public = models.BooleanField(default=True)
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        blank=True,
        null=True,
        on_delete=models.SET_NULL,
        related_name="website_media_uploads",
    )

    class Meta:
        ordering = ("-created_at", "title")

    def clean(self):
        super().clean()
        if not self.file:
            return
        extension = Path(self.file.name).suffix.lower()
        if self.kind != self.Kind.DOCUMENT and extension == ".pdf":
            raise ValidationError({"file": "PDF files can only be stored as document assets."})
        if self.kind == self.Kind.FAVICON and extension not in {".ico", ".png"}:
            raise ValidationError({"file": "Favicons must be ICO or PNG files."})

    def __str__(self):
        return self.title


class WebsiteSettings(SingletonModel):
    default_language = models.CharField(max_length=12, default="en")
    announcement_text = models.CharField(max_length=280, blank=True)
    announcement_url = models.CharField(
        max_length=500, blank=True, validators=(validate_public_link,)
    )
    show_announcement = models.BooleanField(default=False)

    class Meta:
        verbose_name_plural = "website settings"

    def __str__(self):
        return "Website settings"


class CompanyProfile(SingletonModel):
    name = models.CharField(max_length=160, default="Asanlink")
    legal_name = models.CharField(max_length=200, blank=True)
    tagline = models.CharField(max_length=240, blank=True)
    short_description = models.TextField(blank=True)
    long_description = models.TextField(blank=True)
    website = models.URLField(blank=True)
    founded_year = models.PositiveSmallIntegerField(
        blank=True, null=True, validators=(MinValueValidator(1000),)
    )
    copyright_text = models.CharField(max_length=280, blank=True)

    class Meta:
        verbose_name_plural = "company profile"

    def __str__(self):
        return self.name


class BrandingSettings(SingletonModel):
    primary_color = models.CharField(max_length=7, default="#0B63F6", validators=(hex_color_validator,))
    secondary_color = models.CharField(max_length=7, default="#14213D", validators=(hex_color_validator,))
    accent_color = models.CharField(max_length=7, default="#16825D", validators=(hex_color_validator,))
    background_color = models.CharField(max_length=7, default="#F4F7FB", validators=(hex_color_validator,))
    text_color = models.CharField(max_length=7, default="#14213D", validators=(hex_color_validator,))
    dark_primary_color = models.CharField(max_length=7, default="#5B9CFF", validators=(hex_color_validator,))
    dark_secondary_color = models.CharField(max_length=7, default="#A9B7CA", validators=(hex_color_validator,))
    dark_accent_color = models.CharField(max_length=7, default="#55D6A4", validators=(hex_color_validator,))
    dark_background_color = models.CharField(max_length=7, default="#09111F", validators=(hex_color_validator,))
    dark_text_color = models.CharField(max_length=7, default="#EDF4FF", validators=(hex_color_validator,))
    logo = models.ForeignKey(
        MediaAsset, blank=True, null=True, on_delete=models.SET_NULL, related_name="brand_logo_for"
    )
    dark_logo = models.ForeignKey(
        MediaAsset, blank=True, null=True, on_delete=models.SET_NULL, related_name="dark_brand_logo_for"
    )
    favicon = models.ForeignKey(
        MediaAsset, blank=True, null=True, on_delete=models.SET_NULL, related_name="favicon_for"
    )

    class Meta:
        verbose_name_plural = "branding settings"

    def __str__(self):
        return "Website branding"


class ContactSettings(SingletonModel):
    contact_title = models.CharField(max_length=200, blank=True)
    contact_description = models.TextField(blank=True)
    general_email = models.EmailField(blank=True)
    sales_email = models.EmailField(blank=True)
    support_email = models.EmailField(blank=True)
    primary_phone = models.CharField(max_length=48, blank=True)
    address_line_1 = models.CharField(max_length=240, blank=True)
    address_line_2 = models.CharField(max_length=240, blank=True)
    city = models.CharField(max_length=120, blank=True)
    region = models.CharField(max_length=120, blank=True)
    country = models.CharField(max_length=120, blank=True)
    postal_code = models.CharField(max_length=24, blank=True)
    business_hours = models.TextField(blank=True)

    class Meta:
        verbose_name_plural = "contact settings"

    def __str__(self):
        return "Website contact information"


class SEOSettings(SingletonModel):
    site_title = models.CharField(max_length=200, default="Asanlink")
    meta_description = models.CharField(max_length=320, blank=True)
    keywords = models.JSONField(default=list, blank=True, validators=(validate_string_list,))
    open_graph_title = models.CharField(max_length=200, blank=True)
    open_graph_description = models.CharField(max_length=320, blank=True)
    open_graph_image = models.ForeignKey(
        MediaAsset, blank=True, null=True, on_delete=models.SET_NULL, related_name="site_open_graph_for"
    )
    canonical_url = models.URLField(blank=True)
    robots = models.CharField(max_length=120, default="index, follow")

    class Meta:
        verbose_name_plural = "SEO settings"

    def __str__(self):
        return self.site_title


class FooterSettings(SingletonModel):
    is_visible = models.BooleanField(default=True)
    show_logo = models.BooleanField(default=True)
    show_navigation = models.BooleanField(default=True)
    show_social_links = models.BooleanField(default=True)
    legal_text = models.TextField(blank=True)

    class Meta:
        verbose_name_plural = "footer settings"

    def __str__(self):
        return "Website footer"


class ContactChannel(TimeStampedModel, OrderedModel):
    class ChannelType(models.TextChoices):
        EMAIL = "email", "Email"
        PHONE = "phone", "Phone"
        ADDRESS = "address", "Address"
        SOCIAL = "social", "Social media"
        MESSAGING = "messaging", "Messaging"
        HOURS = "hours", "Business hours"
        OTHER = "other", "Other"

    channel_type = models.CharField(max_length=16, choices=ChannelType.choices)
    label = models.CharField(max_length=120)
    value = models.CharField(max_length=280)
    url = models.CharField(max_length=500, blank=True, validators=(validate_public_link,))
    icon_name = models.CharField(max_length=80, blank=True)
    icon = models.ForeignKey(
        MediaAsset, blank=True, null=True, on_delete=models.SET_NULL, related_name="contact_channels"
    )
    is_visible = models.BooleanField(default=True)

    class Meta(OrderedModel.Meta):
        abstract = False
        ordering = ("display_order", "id")

    def __str__(self):
        return f"{self.label}: {self.value}"


class NavigationMenu(TimeStampedModel):
    class Location(models.TextChoices):
        HEADER = "header", "Header"
        FOOTER = "footer", "Footer"
        UTILITY = "utility", "Utility"

    name = models.CharField(max_length=120)
    slug = models.SlugField(max_length=120, unique=True)
    location = models.CharField(max_length=16, choices=Location.choices)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ("location", "name")
        constraints = [
            models.UniqueConstraint(Lower("slug"), name="website_navigation_menu_slug_ci_unique"),
            models.UniqueConstraint(
                fields=("location",),
                condition=Q(is_active=True),
                name="website_one_active_menu_per_location",
            ),
        ]

    def save(self, *args, **kwargs):
        self.slug = self.slug.strip().lower()
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name


class NavigationItem(TimeStampedModel, OrderedModel):
    class LinkType(models.TextChoices):
        INTERNAL = "internal", "Internal route or anchor"
        EXTERNAL = "external", "External URL"

    menu = models.ForeignKey(NavigationMenu, on_delete=models.CASCADE, related_name="items")
    parent = models.ForeignKey(
        "self", blank=True, null=True, on_delete=models.PROTECT, related_name="children"
    )
    label = models.CharField(max_length=120)
    link_type = models.CharField(max_length=16, choices=LinkType.choices, default=LinkType.INTERNAL)
    internal_path = models.CharField(
        max_length=500, blank=True, validators=(validate_public_link,)
    )
    external_url = models.URLField(blank=True)
    open_in_new_tab = models.BooleanField(default=False)
    is_enabled = models.BooleanField(default=True)

    class Meta(OrderedModel.Meta):
        abstract = False
        ordering = ("display_order", "id")

    def clean(self):
        super().clean()
        errors = {}
        if self.link_type == self.LinkType.INTERNAL:
            if not self.internal_path:
                errors["internal_path"] = "An internal route or anchor is required."
            elif not self.internal_path.startswith(("/", "#")):
                errors["internal_path"] = "Internal navigation must begin with / or #."
            if self.external_url:
                errors["external_url"] = "Remove the external URL for an internal item."
        else:
            if not self.external_url:
                errors["external_url"] = "An external URL is required."
            if self.internal_path:
                errors["internal_path"] = "Remove the internal path for an external item."
        if self.parent_id:
            if self.pk and self.parent_id == self.pk:
                errors["parent"] = "A navigation item cannot be its own parent."
            if self.menu_id and self.parent.menu_id != self.menu_id:
                errors["parent"] = "Parent and child navigation items must belong to the same menu."
            seen = {self.pk} if self.pk else set()
            ancestor = self.parent
            depth = 1
            while ancestor:
                if ancestor.pk in seen:
                    errors["parent"] = "Navigation items cannot contain a cycle."
                    break
                seen.add(ancestor.pk)
                ancestor = ancestor.parent
                depth += 1
                if depth > 3:
                    errors["parent"] = "Navigation supports at most three levels."
                    break
        if errors:
            raise ValidationError(errors)

    @property
    def href(self):
        return self.external_url if self.link_type == self.LinkType.EXTERNAL else self.internal_path

    def __str__(self):
        return self.label


class CallToAction(PublishableModel, OrderedModel):
    name = models.CharField(max_length=120, help_text="Internal management name")
    slug = models.SlugField(max_length=120, unique=True)
    title = models.CharField(max_length=220, blank=True)
    description = models.TextField(blank=True)
    primary_label = models.CharField(max_length=100, blank=True)
    primary_url = models.CharField(max_length=500, blank=True, validators=(validate_public_link,))
    secondary_label = models.CharField(max_length=100, blank=True)
    secondary_url = models.CharField(max_length=500, blank=True, validators=(validate_public_link,))

    class Meta(OrderedModel.Meta):
        abstract = False
        ordering = ("display_order", "name")
        constraints = OrderedModel.Meta.constraints + [
            models.UniqueConstraint(Lower("slug"), name="website_cta_slug_ci_unique")
        ]

    def clean(self):
        super().clean()
        errors = {}
        if bool(self.primary_label) != bool(self.primary_url):
            errors["primary_url"] = "Primary button text and URL must be provided together."
        if bool(self.secondary_label) != bool(self.secondary_url):
            errors["secondary_url"] = "Secondary button text and URL must be provided together."
        if errors:
            raise ValidationError(errors)

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        self.slug = self.slug.strip().lower()
        super().save(*args, **kwargs)


class LandingSection(PublishableModel, OrderedModel):
    class SectionType(models.TextChoices):
        HERO = "hero", "Hero"
        ABOUT = "about", "About / company"
        PRODUCTS = "products", "Products"
        FEATURES = "features", "Features / benefits"
        INTEGRATIONS = "integrations", "Integrations / ecosystem"
        CTA = "cta", "Call to action"
        CONTACT = "contact", "Contact"
        CUSTOM = "custom", "Custom structured content"

    key = models.SlugField(max_length=120, unique=True)
    section_type = models.CharField(max_length=20, choices=SectionType.choices)
    title = models.CharField(max_length=220, blank=True)
    subtitle = models.CharField(max_length=280, blank=True)
    description = models.TextField(blank=True)
    image = models.ForeignKey(
        MediaAsset, blank=True, null=True, on_delete=models.SET_NULL, related_name="landing_sections"
    )
    call_to_action = models.ForeignKey(
        CallToAction, blank=True, null=True, on_delete=models.SET_NULL, related_name="sections"
    )
    content = models.JSONField(default=dict, blank=True, validators=(validate_json_object,))

    class Meta(OrderedModel.Meta):
        abstract = False
        ordering = ("display_order", "id")
        constraints = OrderedModel.Meta.constraints + [
            models.UniqueConstraint(Lower("key"), name="website_landing_section_key_ci_unique")
        ]

    def save(self, *args, **kwargs):
        self.key = self.key.strip().lower()
        super().save(*args, **kwargs)

    def __str__(self):
        return self.title or self.key


class Feature(PublishableModel, OrderedModel):
    section = models.ForeignKey(LandingSection, on_delete=models.PROTECT, related_name="features")
    title = models.CharField(max_length=180)
    description = models.TextField(blank=True)
    icon_name = models.CharField(max_length=80, blank=True)
    icon = models.ForeignKey(
        MediaAsset, blank=True, null=True, on_delete=models.SET_NULL, related_name="landing_features"
    )

    class Meta(OrderedModel.Meta):
        abstract = False
        ordering = ("display_order", "id")

    def clean(self):
        super().clean()
        if self.section_id and self.section.section_type != LandingSection.SectionType.FEATURES:
            raise ValidationError({"section": "Features must belong to a features section."})

    def __str__(self):
        return self.title


class ProductCategory(PublishableModel, OrderedModel):
    name = models.CharField(max_length=140)
    slug = models.SlugField(max_length=140, unique=True)
    description = models.TextField(blank=True)

    class Meta(OrderedModel.Meta):
        abstract = False
        ordering = ("display_order", "name")
        verbose_name_plural = "product categories"
        constraints = OrderedModel.Meta.constraints + [
            models.UniqueConstraint(Lower("slug"), name="website_product_category_slug_ci_unique")
        ]

    def save(self, *args, **kwargs):
        self.slug = self.slug.strip().lower()
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name


class Product(PublishableModel, OrderedModel):
    name = models.CharField(max_length=180)
    slug = models.SlugField(max_length=180, unique=True)
    short_description = models.CharField(max_length=320, blank=True)
    full_description = models.TextField(blank=True)
    category = models.ForeignKey(
        ProductCategory, blank=True, null=True, on_delete=models.SET_NULL, related_name="products"
    )
    logo = models.ForeignKey(
        MediaAsset, blank=True, null=True, on_delete=models.SET_NULL, related_name="product_logos"
    )
    cover_image = models.ForeignKey(
        MediaAsset, blank=True, null=True, on_delete=models.SET_NULL, related_name="product_covers"
    )
    product_url = models.URLField(blank=True)
    is_featured = models.BooleanField(default=False)
    cta_label = models.CharField(max_length=100, blank=True)
    cta_url = models.CharField(max_length=500, blank=True, validators=(validate_public_link,))
    technical_information = models.JSONField(
        default=dict, blank=True, validators=(validate_json_object,)
    )
    seo_title = models.CharField(max_length=200, blank=True)
    seo_description = models.CharField(max_length=320, blank=True)
    seo_keywords = models.JSONField(default=list, blank=True, validators=(validate_string_list,))
    canonical_url = models.URLField(blank=True)
    open_graph_image = models.ForeignKey(
        MediaAsset,
        blank=True,
        null=True,
        on_delete=models.SET_NULL,
        related_name="product_open_graph_images",
    )

    class Meta(OrderedModel.Meta):
        abstract = False
        ordering = ("display_order", "name")
        constraints = OrderedModel.Meta.constraints + [
            models.UniqueConstraint(Lower("slug"), name="website_product_slug_ci_unique")
        ]

    def clean(self):
        super().clean()
        errors = {}
        if bool(self.cta_label) != bool(self.cta_url):
            errors["cta_url"] = "CTA text and URL must be provided together."
        if (
            self.status == self.Status.PUBLISHED
            and self.category_id
            and (
                self.category.status != ProductCategory.Status.PUBLISHED
                or not self.category.is_visible
            )
        ):
            errors["category"] = "Publish and show the category before publishing this product."
        if errors:
            raise ValidationError(errors)

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        self.slug = self.slug.strip().lower()
        super().save(*args, **kwargs)


class ProductFeature(TimeStampedModel, OrderedModel):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="features")
    title = models.CharField(max_length=180)
    description = models.TextField(blank=True)
    is_visible = models.BooleanField(default=True)

    class Meta(OrderedModel.Meta):
        abstract = False
        ordering = ("display_order", "id")

    def __str__(self):
        return f"{self.product}: {self.title}"


class ProductMedia(TimeStampedModel, OrderedModel):
    class Kind(models.TextChoices):
        SCREENSHOT = "screenshot", "Screenshot"
        GALLERY = "gallery", "Gallery image"
        DIAGRAM = "diagram", "Technical diagram"

    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="media_items")
    asset = models.ForeignKey(MediaAsset, on_delete=models.PROTECT, related_name="product_placements")
    kind = models.CharField(max_length=16, choices=Kind.choices, default=Kind.SCREENSHOT)
    caption = models.CharField(max_length=240, blank=True)
    is_visible = models.BooleanField(default=True)

    class Meta(OrderedModel.Meta):
        abstract = False
        ordering = ("display_order", "id")
        verbose_name_plural = "product media"
        constraints = OrderedModel.Meta.constraints + [
            models.UniqueConstraint(
                fields=("product", "asset"), name="website_product_media_asset_unique"
            )
        ]

    def __str__(self):
        return f"{self.product}: {self.asset}"


class Integration(PublishableModel, OrderedModel):
    class OperationalStatus(models.TextChoices):
        PLANNED = "planned", "Planned"
        ACTIVE = "active", "Active"
        PAUSED = "paused", "Paused"
        DEPRECATED = "deprecated", "Deprecated"

    name = models.CharField(max_length=180)
    slug = models.SlugField(max_length=180, unique=True)
    source_product = models.ForeignKey(
        Product, on_delete=models.PROTECT, related_name="outgoing_integrations"
    )
    destination_product = models.ForeignKey(
        Product, on_delete=models.PROTECT, related_name="incoming_integrations"
    )
    description = models.TextField(blank=True)
    operational_status = models.CharField(
        max_length=16, choices=OperationalStatus.choices, default=OperationalStatus.PLANNED
    )
    integration_type = models.CharField(
        max_length=100, default="api", validators=(integration_type_validator,)
    )
    is_bidirectional = models.BooleanField(default=False)
    icon = models.ForeignKey(
        MediaAsset, blank=True, null=True, on_delete=models.SET_NULL, related_name="integrations"
    )
    documentation_url = models.URLField(blank=True)
    api_information = models.JSONField(default=dict, blank=True, validators=(validate_json_object,))

    class Meta(OrderedModel.Meta):
        abstract = False
        ordering = ("display_order", "name")
        constraints = OrderedModel.Meta.constraints + [
            models.UniqueConstraint(Lower("slug"), name="website_integration_slug_ci_unique"),
            models.CheckConstraint(
                condition=~Q(source_product=models.F("destination_product")),
                name="website_integration_distinct_products",
            )
        ]

    def clean(self):
        super().clean()
        errors = {}
        if self.source_product_id and self.source_product_id == self.destination_product_id:
            errors["destination_product"] = "Source and destination products must be different."
        if self.status == self.Status.PUBLISHED:
            if self.source_product_id and (
                self.source_product.status != Product.Status.PUBLISHED
                or not self.source_product.is_visible
            ):
                errors["source_product"] = "The source product must be published and visible."
            if self.destination_product_id and (
                self.destination_product.status != Product.Status.PUBLISHED
                or not self.destination_product.is_visible
            ):
                errors["destination_product"] = "The destination product must be published and visible."
        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        self.slug = self.slug.strip().lower()
        self.integration_type = self.integration_type.strip().lower()
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name
