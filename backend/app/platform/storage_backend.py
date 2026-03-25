from __future__ import annotations

import hashlib
import hmac
from functools import lru_cache
import time
from typing import Any, Protocol
from urllib.parse import quote

from app.services import storage as legacy_storage
from app.settings import settings

DEFAULT_PRIVATE_PREFIXES = (
    "user-images/",
    "user-uploads/",
    "user-products/",
    "user-route-mappings/",
    "user-product-profiles/",
    "user-doubao-runs/",
    "user-compare-results/",
)


class RuntimeStorage(Protocol):
    backend_name: str

    def ensure_dirs(self) -> None: ...

    def load_json(self, rel_path: str) -> dict[str, Any]: ...

    def save_json(self, rel_path: str, doc: dict[str, Any]) -> None: ...

    def read_bytes(self, rel_path: str) -> bytes: ...

    def exists(self, rel_path: str | None) -> bool: ...

    def public_url(self, rel_path: str | None) -> str | None: ...

    def signed_url(self, rel_path: str | None, *, ttl_seconds: int | None = None) -> str | None: ...

    def object_key(self, rel_path: str | None) -> str | None: ...

    def is_private_asset(self, rel_path: str | None) -> bool: ...

    def contract(self) -> dict[str, Any]: ...


def _normalize_public_path(rel_path: str | None) -> str | None:
    value = str(rel_path or "").strip()
    if not value:
        return None
    if value.startswith("http://") or value.startswith("https://"):
        return value
    normalized = value.lstrip("/")
    return f"/{normalized}" if normalized else None


def _normalize_rel_path(rel_path: str | None) -> str | None:
    normalized = _normalize_public_path(rel_path)
    if normalized is None or normalized.startswith("http://") or normalized.startswith("https://"):
        return None
    return normalized.lstrip("/")


def _asset_origin() -> str:
    return str(settings.asset_public_origin or "").strip().rstrip("/")


def _private_prefixes() -> tuple[str, ...]:
    raw = str(getattr(settings, "asset_private_prefixes_csv", "") or "").strip()
    if not raw:
        return DEFAULT_PRIVATE_PREFIXES
    parts = [f"{item.strip().lstrip('/').rstrip('/')}/" for item in raw.split(",") if item.strip()]
    return tuple(parts) if parts else DEFAULT_PRIVATE_PREFIXES


def _is_private_rel_path(rel_path: str | None) -> bool:
    normalized = _normalize_rel_path(rel_path)
    if not normalized:
        return False
    return normalized.startswith(_private_prefixes())


def _object_key_for_rel_path(rel_path: str | None) -> str | None:
    normalized = _normalize_rel_path(rel_path)
    if not normalized:
        return None
    prefix = str(getattr(settings, "asset_object_key_prefix", "mobile") or "").strip().strip("/")
    return f"{prefix}/{normalized}" if prefix else normalized


def _signed_ttl_seconds(ttl_seconds: int | None = None) -> int:
    default_ttl = int(getattr(settings, "asset_signed_url_ttl_seconds", 900) or 900)
    ttl = int(ttl_seconds if ttl_seconds is not None else default_ttl)
    return max(30, ttl)


def _signed_token(object_key: str, expires_at: int) -> str:
    secret = str(getattr(settings, "asset_signing_secret", "") or "").strip() or "phase16-local-signing-secret"
    payload = f"{object_key}:{expires_at}".encode("utf-8")
    return hmac.new(secret.encode("utf-8"), payload, hashlib.sha256).hexdigest()


class LocalFileRuntimeStorage:
    backend_name = "local_fs"

    def ensure_dirs(self) -> None:
        legacy_storage.ensure_dirs()

    def load_json(self, rel_path: str) -> dict[str, Any]:
        return legacy_storage.load_json(rel_path)

    def save_json(self, rel_path: str, doc: dict[str, Any]) -> None:
        legacy_storage.save_json_at(rel_path, doc)

    def read_bytes(self, rel_path: str) -> bytes:
        return legacy_storage.read_rel_bytes(rel_path)

    def exists(self, rel_path: str | None) -> bool:
        return legacy_storage.exists_rel_path(rel_path)

    def public_url(self, rel_path: str | None) -> str | None:
        normalized = _normalize_public_path(rel_path)
        if normalized is None:
            return None
        if normalized.startswith("http://") or normalized.startswith("https://"):
            return normalized
        asset_origin = str(settings.asset_public_origin or "").strip().rstrip("/")
        if asset_origin:
            return f"{asset_origin}{normalized}"
        return normalized

    def signed_url(self, rel_path: str | None, *, ttl_seconds: int | None = None) -> str | None:
        normalized = _normalize_public_path(rel_path)
        if normalized is None:
            return None
        if normalized.startswith("http://") or normalized.startswith("https://"):
            return normalized
        base_url = self.public_url(normalized) or normalized
        object_key = self.object_key(normalized) or normalized.lstrip("/")
        expires_at = int(time.time()) + _signed_ttl_seconds(ttl_seconds)
        token = _signed_token(object_key, expires_at)
        sep = "&" if "?" in base_url else "?"
        return f"{base_url}{sep}expires={expires_at}&sig={token}&access=signed"

    def object_key(self, rel_path: str | None) -> str | None:
        return _object_key_for_rel_path(rel_path)

    def is_private_asset(self, rel_path: str | None) -> bool:
        return _is_private_rel_path(rel_path)

    def contract(self) -> dict[str, Any]:
        return {
            "backend": self.backend_name,
            "asset_public_origin": _asset_origin() or None,
            "object_key_prefix": str(getattr(settings, "asset_object_key_prefix", "mobile") or "mobile").strip(),
            "private_prefixes": list(_private_prefixes()),
            "signed_url_ttl_seconds": _signed_ttl_seconds(None),
            "signed_url_enforced": bool(getattr(settings, "asset_signed_url_enforced", False)),
        }


class ObjectStorageRuntimeStorage(LocalFileRuntimeStorage):
    backend_name = "object_storage_contract"

    def public_url(self, rel_path: str | None) -> str | None:
        normalized = _normalize_public_path(rel_path)
        if normalized is None:
            return None
        if normalized.startswith("http://") or normalized.startswith("https://"):
            return normalized
        if self.is_private_asset(normalized) and bool(getattr(settings, "asset_signed_url_enforced", False)):
            return self.signed_url(normalized)
        object_key = self.object_key(normalized)
        if object_key is None:
            return None
        origin = _asset_origin()
        if origin:
            return f"{origin}/{quote(object_key, safe='/')}"
        # Keep local fallback path when object storage public origin is not configured yet.
        return normalized

    def signed_url(self, rel_path: str | None, *, ttl_seconds: int | None = None) -> str | None:
        normalized = _normalize_public_path(rel_path)
        if normalized is None:
            return None
        if normalized.startswith("http://") or normalized.startswith("https://"):
            return normalized
        object_key = self.object_key(normalized)
        if object_key is None:
            return None
        expires_at = int(time.time()) + _signed_ttl_seconds(ttl_seconds)
        token = _signed_token(object_key, expires_at)
        origin = _asset_origin()
        if origin:
            base = f"{origin}/{quote(object_key, safe='/')}"
        else:
            base = normalized
        return f"{base}?expires={expires_at}&sig={token}&access=signed"


@lru_cache
def get_runtime_storage() -> RuntimeStorage:
    backend = str(settings.storage_backend or "local_fs").strip().lower()
    if backend in {"local", "local_fs"}:
        return LocalFileRuntimeStorage()
    if backend in {"object_storage", "object_storage_contract"}:
        return ObjectStorageRuntimeStorage()
    raise ValueError(f"Unsupported storage backend: {backend}")
