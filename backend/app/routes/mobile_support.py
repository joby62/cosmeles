from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import uuid4

from fastapi import HTTPException, Request, Response

from app.constants import ROUTE_MAPPING_SUPPORTED_CATEGORIES, VALID_CATEGORIES

MOBILE_OWNER_COOKIE_NAME = "mx_device_id"
MOBILE_OWNER_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365 * 2
MOBILE_OWNER_TYPE_DEVICE = "device"

CATEGORY_LABELS_ZH: dict[str, str] = {
    "shampoo": "洗发水",
    "bodywash": "沐浴露",
    "conditioner": "护发素",
    "lotion": "润肤霜",
    "cleanser": "洗面奶",
}
ROUTE_MAPPED_CATEGORIES = set(ROUTE_MAPPING_SUPPORTED_CATEGORIES)
CATEGORY_LEVEL_TARGET_KEY = "__category__"

CATEGORY_ALIASES: dict[str, str] = {
    "shampoo": "shampoo",
    "洗发水": "shampoo",
    "bodywash": "bodywash",
    "沐浴露": "bodywash",
    "沐浴乳": "bodywash",
    "conditioner": "conditioner",
    "护发素": "conditioner",
    "lotion": "lotion",
    "润肤霜": "lotion",
    "身体乳": "lotion",
    "cleanser": "cleanser",
    "洗面奶": "cleanser",
    "洁面乳": "cleanser",
}


def _featured_slot_schema_http_error(exc: Exception) -> HTTPException:
    return HTTPException(
        status_code=500,
        detail=(
            "Failed to query featured slots. "
            "Database schema may be outdated (missing table 'product_featured_slots'). "
            f"Raw error: {exc}"
        ),
    )


def _normalize_required_category(raw: str | None) -> str:
    value = str(raw or "").strip().lower()
    if not value:
        raise HTTPException(status_code=400, detail="category is required.")
    if value not in VALID_CATEGORIES:
        raise HTTPException(status_code=400, detail=f"Invalid category: {value}.")
    return value


def _normalize_session_ids(raw_ids: list[str]) -> list[str]:
    normalized: list[str] = []
    seen: set[str] = set()
    for item in raw_ids or []:
        value = str(item or "").strip()
        if not value or value in seen:
            continue
        seen.add(value)
        normalized.append(value)
    return normalized


def _mobile_cleanup_cutoff_iso(older_than_days: int) -> str:
    return (datetime.now(timezone.utc) - timedelta(days=max(1, older_than_days))).strftime(
        "%Y-%m-%dT%H:%M:%S.%fZ"
    )


def _resolve_owner(request: Request) -> tuple[str, str, bool]:
    existing = _normalize_owner_id(request.cookies.get(MOBILE_OWNER_COOKIE_NAME))
    if existing:
        return MOBILE_OWNER_TYPE_DEVICE, existing, False
    forwarded = _normalize_owner_id(request.headers.get("x-mobile-device-id"))
    if forwarded:
        return MOBILE_OWNER_TYPE_DEVICE, forwarded, False
    return MOBILE_OWNER_TYPE_DEVICE, str(uuid4()), True


def _set_owner_cookie(response: Response, owner_id: str, request: Request) -> None:
    response.set_cookie(
        key=MOBILE_OWNER_COOKIE_NAME,
        value=owner_id,
        max_age=MOBILE_OWNER_COOKIE_MAX_AGE_SECONDS,
        httponly=True,
        samesite="lax",
        secure=_is_secure_request(request),
        path="/",
    )


def _is_secure_request(request: Request) -> bool:
    if request.url.scheme == "https":
        return True
    forwarded_proto = str(request.headers.get("x-forwarded-proto") or "").lower()
    return "https" in forwarded_proto


def _normalize_owner_id(raw: str | None) -> str:
    value = str(raw or "").strip()
    if not value:
        return ""
    if len(value) > 128:
        return ""
    return value
