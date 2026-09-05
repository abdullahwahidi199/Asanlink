from pathlib import Path

from django.core.exceptions import ValidationError


ALLOWED_FINANCE_FILE_EXTENSIONS = {".pdf", ".png", ".jpg", ".jpeg", ".webp"}
MAX_FINANCE_FILE_SIZE = 10 * 1024 * 1024


def validate_finance_file(value):
    extension = Path(value.name).suffix.lower()
    if extension not in ALLOWED_FINANCE_FILE_EXTENSIONS:
        raise ValidationError("Upload a PDF, PNG, JPG, JPEG, or WebP file.")
    if value.size > MAX_FINANCE_FILE_SIZE:
        raise ValidationError("Attachments must be 10 MB or smaller.")
