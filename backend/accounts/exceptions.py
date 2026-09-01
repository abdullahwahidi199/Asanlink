from rest_framework.exceptions import APIException
from rest_framework.views import exception_handler


def api_exception_handler(exc, context):
    """Return a stable error envelope while retaining DRF validation details."""

    response = exception_handler(exc, context)
    if response is None:
        return None

    status_code = response.status_code
    data = response.data
    if isinstance(data, dict) and set(data) == {"detail"}:
        message = str(data["detail"])
        details = None
    else:
        message = "The request could not be completed."
        details = data

    default_code = getattr(exc, "default_code", None)
    if isinstance(exc, APIException):
        try:
            codes = exc.get_codes()
            if isinstance(codes, str):
                default_code = codes
        except (AttributeError, TypeError):
            pass

    response.data = {
        "error": {
            "code": default_code or f"http_{status_code}",
            "message": message,
            "details": details,
        }
    }
    return response

