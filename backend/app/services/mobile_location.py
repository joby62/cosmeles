import json
import threading
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from app.settings import settings

_LOCATION_CACHE_LOCK = threading.Lock()
_LOCATION_CACHE: dict[str, dict[str, Any]] = {}
_LOCATION_CACHE_MAX_SIZE = 1024


def _normalize_text(value: Any) -> str | None:
    if isinstance(value, list):
        parts = [str(item).strip() for item in value if str(item).strip()]
        return parts[0] if parts else None
    text = str(value or "").strip()
    return text or None


def _location_cache_key(provider: str, latitude: float, longitude: float) -> str:
    return f"{provider}:{latitude:.3f},{longitude:.3f}"


def _cache_get(key: str) -> dict[str, Any] | None:
    with _LOCATION_CACHE_LOCK:
        cached = _LOCATION_CACHE.get(key)
        return dict(cached) if isinstance(cached, dict) else None


def _cache_set(key: str, value: dict[str, Any]) -> None:
    with _LOCATION_CACHE_LOCK:
        if len(_LOCATION_CACHE) >= _LOCATION_CACHE_MAX_SIZE:
            _LOCATION_CACHE.clear()
        _LOCATION_CACHE[key] = dict(value)


def _amap_reverse_geocode(latitude: float, longitude: float) -> dict[str, Any]:
    provider = "amap"
    api_key = str(settings.mobile_reverse_geocode_key or "").strip()
    if not api_key:
        return {
            "status": "unconfigured",
            "provider": provider,
            "error": "mobile_reverse_geocode_key_missing",
        }
    endpoint = str(settings.mobile_reverse_geocode_endpoint or "").strip() or "https://restapi.amap.com/v3/geocode/regeo"
    cache_key = _location_cache_key(provider, latitude, longitude)
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    query = urlencode(
        {
            "key": api_key,
            "location": f"{longitude:.6f},{latitude:.6f}",
            "extensions": "base",
            "radius": 0,
            "roadlevel": 0,
            "output": "JSON",
        }
    )
    request = Request(
        f"{endpoint}?{query}",
        headers={
            "Accept": "application/json",
            "User-Agent": "cosmeles-mobile-analytics/1.0",
        },
    )
    try:
        with urlopen(request, timeout=float(settings.mobile_reverse_geocode_timeout_seconds or 3.0)) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        return {
            "status": "failed",
            "provider": provider,
            "error": f"http_{exc.code}",
        }
    except URLError as exc:
        return {
            "status": "failed",
            "provider": provider,
            "error": _normalize_text(getattr(exc, "reason", None)) or "network_error",
        }
    except Exception as exc:
        return {
            "status": "failed",
            "provider": provider,
            "error": _normalize_text(exc) or "unknown_error",
        }

    if str(payload.get("status") or "").strip() != "1":
        return {
            "status": "failed",
            "provider": provider,
            "error": _normalize_text(payload.get("info")) or _normalize_text(payload.get("infocode")) or "amap_reverse_geocode_failed",
        }

    regeocode = payload.get("regeocode")
    if not isinstance(regeocode, dict):
        return {
            "status": "failed",
            "provider": provider,
            "error": "amap_regeocode_missing",
        }
    address_component = regeocode.get("addressComponent")
    if not isinstance(address_component, dict):
        return {
            "status": "failed",
            "provider": provider,
            "error": "amap_address_component_missing",
        }

    province = _normalize_text(address_component.get("province"))
    city = _normalize_text(address_component.get("city"))
    district = _normalize_text(address_component.get("district"))
    if not city and province and province.endswith("市"):
        city = province
    result = {
        "status": "resolved",
        "provider": provider,
        "location_city": city,
        "location_district": district,
        "location_province": province,
        "location_formatted_address": _normalize_text(regeocode.get("formatted_address")),
        "location_adcode": _normalize_text(address_component.get("adcode")),
        "location_city_code": _normalize_text(address_component.get("citycode")),
    }
    _cache_set(cache_key, result)
    return result


def reverse_mobile_location(latitude: float, longitude: float) -> dict[str, Any]:
    provider = str(settings.mobile_reverse_geocode_provider or "").strip().lower()
    if not provider or provider == "none":
        return {
            "status": "unconfigured",
            "provider": None,
            "error": "mobile_reverse_geocode_provider_missing",
        }
    if provider == "amap":
        return _amap_reverse_geocode(latitude=latitude, longitude=longitude)
    return {
        "status": "failed",
        "provider": provider,
        "error": f"unsupported_provider:{provider}",
    }
