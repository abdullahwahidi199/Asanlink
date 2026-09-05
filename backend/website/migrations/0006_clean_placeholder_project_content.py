from django.db import migrations
from django.db.models import Q


def clean_placeholder_project_content(apps, schema_editor):
    Product = apps.get_model("website", "Product")
    ProductMedia = apps.get_model("website", "ProductMedia")

    pakhlai = Product.objects.filter(slug__iexact="pakhlai").first()
    if pakhlai:
        changed_fields = []
        if pakhlai.short_description == "Ordering and restaurant mangement system.":
            pakhlai.short_description = "Restaurant Management System"
            changed_fields.append("short_description")
        if "asdf" in pakhlai.full_description.lower():
            pakhlai.full_description = ""
            changed_fields.append("full_description")
        if changed_fields:
            pakhlai.save(update_fields=changed_fields)

        ProductMedia.objects.filter(
            product_id=pakhlai.pk,
            asset__title__iexact="df",
            caption="",
        ).delete()

    school = Product.objects.filter(
        Q(slug__iexact="aasdf") | Q(name__iexact="SchoolMS")
    ).first()
    if school:
        changed_fields = []
        if school.name == "SchoolMS":
            school.name = "School Management System"
            changed_fields.append("name")
        if school.slug.lower() == "aasdf" and not Product.objects.exclude(pk=school.pk).filter(
            slug__iexact="school-management-system"
        ).exists():
            school.slug = "school-management-system"
            changed_fields.append("slug")
        if "asdf" in school.short_description.lower():
            school.short_description = ""
            changed_fields.append("short_description")
        if "asdf" in school.full_description.lower():
            school.full_description = ""
            changed_fields.append("full_description")
        if school.logo_id and school.logo.title.lower() == "school image":
            school.logo_id = None
            changed_fields.append("logo_id")
        if school.cover_image_id and school.cover_image.title.lower() == "df":
            school.cover_image_id = None
            changed_fields.append("cover_image_id")
        if changed_fields:
            school.save(update_fields=changed_fields)


class Migration(migrations.Migration):
    dependencies = [
        ("website", "0005_navigationmenu_website_one_active_menu_per_location"),
    ]

    operations = [
        migrations.RunPython(clean_placeholder_project_content, migrations.RunPython.noop),
    ]
