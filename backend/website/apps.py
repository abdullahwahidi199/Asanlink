from django.apps import AppConfig


class WebsiteConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "website"
    verbose_name = "Public website"

    def ready(self):
        from . import signals  # noqa: F401

