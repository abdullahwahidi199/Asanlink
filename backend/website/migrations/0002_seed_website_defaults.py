from django.db import migrations


PERMISSIONS = (
    ("View website CMS", "website.view", "View public website content and configuration in the management system.", "website", "view"),
    ("Manage website settings", "website.settings.manage", "Manage general public website and footer settings.", "website.settings", "manage"),
    ("Manage company information", "website.company.manage", "Manage the public company profile.", "website.company", "manage"),
    ("Manage website branding", "website.branding.manage", "Manage public brand assets and theme tokens.", "website.branding", "manage"),
    ("Manage website media", "website.media.manage", "Upload and manage reusable public website media.", "website.media", "manage"),
    ("Manage website navigation", "website.navigation.manage", "Manage public navigation menus and items.", "website.navigation", "manage"),
    ("Manage landing-page content", "website.landing.manage", "Manage landing sections, features, and calls to action.", "website.landing", "manage"),
    ("Manage website products", "website.products.manage", "Manage public products, categories, features, and screenshots.", "website.products", "manage"),
    ("Manage product integrations", "website.integrations.manage", "Manage public ecosystem relationships between products.", "website.integrations", "manage"),
    ("Manage website contacts", "website.contact.manage", "Manage public contact details and communication channels.", "website.contact", "manage"),
    ("Manage website SEO", "website.seo.manage", "Manage site-wide and product search metadata.", "website.seo", "manage"),
)


def seed_website_defaults(apps, schema_editor):
    Permission = apps.get_model("accounts", "Permission")
    Role = apps.get_model("accounts", "Role")
    WebsiteSettings = apps.get_model("website", "WebsiteSettings")
    CompanyProfile = apps.get_model("website", "CompanyProfile")
    BrandingSettings = apps.get_model("website", "BrandingSettings")
    ContactSettings = apps.get_model("website", "ContactSettings")
    SEOSettings = apps.get_model("website", "SEOSettings")
    FooterSettings = apps.get_model("website", "FooterSettings")
    NavigationMenu = apps.get_model("website", "NavigationMenu")
    NavigationItem = apps.get_model("website", "NavigationItem")
    CallToAction = apps.get_model("website", "CallToAction")
    LandingSection = apps.get_model("website", "LandingSection")

    permission_objects = {}
    for name, codename, description, module, action in PERMISSIONS:
        permission, _ = Permission.objects.update_or_create(
            codename=codename,
            defaults={
                "name": name,
                "description": description,
                "module": module,
                "action": action,
                "is_active": True,
            },
        )
        permission_objects[codename] = permission

    admin_role = Role.objects.filter(name="ADMIN").first()
    if admin_role:
        admin_role.permissions.add(*permission_objects.values())
    manager_role = Role.objects.filter(name="MANAGER").first()
    if manager_role:
        manager_role.permissions.add(permission_objects["website.view"])

    WebsiteSettings.objects.get_or_create(
        singleton_key="default",
        defaults={"default_language": "en"},
    )
    CompanyProfile.objects.get_or_create(
        singleton_key="default",
        defaults={
            "name": "Asanlink",
            "tagline": "Connected products. One ecosystem.",
            "short_description": "A connected platform for products that work better together.",
            "copyright_text": "Asanlink. All rights reserved.",
        },
    )
    BrandingSettings.objects.get_or_create(singleton_key="default")
    ContactSettings.objects.get_or_create(
        singleton_key="default",
        defaults={"contact_title": "Contact", "contact_description": "Connect with our team."},
    )
    SEOSettings.objects.get_or_create(
        singleton_key="default",
        defaults={
            "site_title": "Asanlink",
            "meta_description": "Explore the Asanlink product ecosystem and integrations.",
        },
    )
    FooterSettings.objects.get_or_create(singleton_key="default")

    header, _ = NavigationMenu.objects.get_or_create(
        slug="primary", defaults={"name": "Primary navigation", "location": "header"}
    )
    footer, _ = NavigationMenu.objects.get_or_create(
        slug="footer", defaults={"name": "Footer navigation", "location": "footer"}
    )
    navigation = (
        ("Home", "#home", 0),
        ("Products", "#products", 10),
        ("Integrations", "#integrations", 20),
        ("Company", "#about", 30),
        ("Contact", "#contact", 40),
    )
    for label, path, display_order in navigation:
        NavigationItem.objects.get_or_create(
            menu=header,
            label=label,
            defaults={
                "link_type": "internal",
                "internal_path": path,
                "display_order": display_order,
                "is_enabled": True,
            },
        )
    for label, path, display_order in navigation[1:]:
        NavigationItem.objects.get_or_create(
            menu=footer,
            label=label,
            defaults={
                "link_type": "internal",
                "internal_path": path,
                "display_order": display_order,
                "is_enabled": True,
            },
        )

    hero_cta, _ = CallToAction.objects.get_or_create(
        slug="landing-hero",
        defaults={
            "name": "Landing hero",
            "primary_label": "Explore products",
            "primary_url": "#products",
            "secondary_label": "Contact us",
            "secondary_url": "#contact",
            "status": "published",
            "is_visible": True,
        },
    )
    sections = (
        ("home", "hero", "", "", "", 0, hero_cta, {}),
        ("about", "about", "Company", "", "", 10, None, {}),
        ("products", "products", "Products", "", "Discover the products available across the Asanlink ecosystem.", 20, None, {"empty_message": "Published products will appear here."}),
        ("features", "features", "Why Asanlink", "", "", 30, None, {}),
        ("integrations", "integrations", "Connected ecosystem", "", "See how products exchange capabilities across the platform.", 40, None, {"empty_message": "Published integrations will appear here."}),
        ("contact", "contact", "Contact", "", "", 50, None, {}),
    )
    for key, section_type, title, subtitle, description, display_order, cta, content in sections:
        LandingSection.objects.get_or_create(
            key=key,
            defaults={
                "section_type": section_type,
                "title": title,
                "subtitle": subtitle,
                "description": description,
                "display_order": display_order,
                "call_to_action": cta,
                "content": content,
                "status": "published",
                "is_visible": True,
            },
        )


def preserve_managed_content(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0002_seed_initial_authorization"),
        ("website", "0001_initial"),
    ]

    operations = [migrations.RunPython(seed_website_defaults, preserve_managed_content)]
