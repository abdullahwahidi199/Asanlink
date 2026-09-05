from pathlib import Path

from django.core.exceptions import ValidationError
from django.core.validators import URLValidator


ALLOWED_WEBSITE_FILE_EXTENSIONS = {
    ".gif",
    ".ico",
    ".jpeg",
    ".jpg",
    ".pdf",
    ".png",
    ".webp",
}
MAX_WEBSITE_FILE_SIZE = 10 * 1024 * 1024
validate_http_url = URLValidator(schemes=("http", "https"))


def validate_website_file(value):
    extension = Path(value.name).suffix.lower()
    if extension not in ALLOWED_WEBSITE_FILE_EXTENSIONS:
        raise ValidationError("Upload a PNG, JPG, JPEG, WebP, GIF, ICO, or PDF file.")
    if value.size > MAX_WEBSITE_FILE_SIZE:
        raise ValidationError("Website files must be 10 MB or smaller.")


def validate_public_link(value):
    """Accept an internal route/anchor or a fully qualified HTTP(S) URL."""

    if not value:
        return
    if value.startswith(("/", "#", "mailto:", "tel:")):
        return
    try:
        validate_http_url(value)
    except ValidationError as exc:
        raise ValidationError(
            "Enter an internal path, anchor, email/phone link, or a valid HTTP(S) URL."
        ) from exc


def validate_json_object(value):
    if not isinstance(value, dict):
        raise ValidationError("Enter a JSON object.")


def validate_string_list(value):
    if not isinstance(value, list) or any(not isinstance(item, str) for item in value):
        raise ValidationError("Enter a JSON list containing only text values.")

