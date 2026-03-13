from app.domain.mobile.decision import get_mobile_decision_category_keys


VALID_CATEGORIES = set(get_mobile_decision_category_keys())

VALID_SOURCES = {"manual", "doubao", "auto"}

ALLOWED_IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".heic", ".heif"}

# Mobile selection decision rules version.
MOBILE_RULES_VERSION = "2026-03-03.1"

# Categories that currently have AI route mapping capability.
ROUTE_MAPPING_SUPPORTED_CATEGORIES = set(VALID_CATEGORIES)

PRODUCT_PROFILE_SUPPORTED_CATEGORIES = set(VALID_CATEGORIES)
