from __future__ import annotations

from functools import lru_cache
import json
import threading
import time
from typing import Any, Protocol
from urllib.parse import urlsplit

from app.settings import settings


class RuntimeCacheBackend(Protocol):
    backend_name: str

    def get_json(self, key: str) -> dict[str, Any] | None: ...

    def set_json(self, key: str, value: dict[str, Any], *, ttl_seconds: int | None = None) -> None: ...

    def delete(self, key: str) -> None: ...

    def contract(self) -> dict[str, Any]: ...


class NoopRuntimeCacheBackend:
    backend_name = "none"

    def __init__(self, *, downgraded_from: str | None = None, downgrade_reason: str | None = None) -> None:
        self._downgraded_from = downgraded_from
        self._downgrade_reason = downgrade_reason

    def get_json(self, key: str) -> dict[str, Any] | None:
        _ = key
        return None

    def set_json(self, key: str, value: dict[str, Any], *, ttl_seconds: int | None = None) -> None:
        _ = key
        _ = value
        _ = ttl_seconds

    def delete(self, key: str) -> None:
        _ = key

    def contract(self) -> dict[str, Any]:
        return {
            "backend": self.backend_name,
            "distributed": False,
            "supports_ttl": False,
            "downgraded_from": self._downgraded_from,
            "downgrade_reason": self._downgrade_reason,
        }


class LocalMemoryRuntimeCacheBackend:
    backend_name = "local_memory"

    def __init__(self) -> None:
        self._guard = threading.Lock()
        self._store: dict[str, tuple[float | None, dict[str, Any]]] = {}

    def _normalize_key(self, key: str) -> str:
        return str(key or "").strip() or "runtime-cache-default"

    def _expired(self, expires_at: float | None) -> bool:
        return expires_at is not None and expires_at <= time.time()

    def get_json(self, key: str) -> dict[str, Any] | None:
        normalized = self._normalize_key(key)
        with self._guard:
            rec = self._store.get(normalized)
            if rec is None:
                return None
            expires_at, value = rec
            if self._expired(expires_at):
                self._store.pop(normalized, None)
                return None
            return dict(value)

    def set_json(self, key: str, value: dict[str, Any], *, ttl_seconds: int | None = None) -> None:
        normalized = self._normalize_key(key)
        expires_at: float | None = None
        if ttl_seconds is not None:
            expires_at = time.time() + max(1, int(ttl_seconds))
        with self._guard:
            self._store[normalized] = (expires_at, dict(value))

    def delete(self, key: str) -> None:
        normalized = self._normalize_key(key)
        with self._guard:
            self._store.pop(normalized, None)

    def contract(self) -> dict[str, Any]:
        return {
            "backend": self.backend_name,
            "distributed": False,
            "supports_ttl": True,
            "downgraded_from": None,
            "downgrade_reason": None,
        }


class RedisContractRuntimeCacheBackend:
    backend_name = "redis_contract"

    def __init__(self) -> None:
        self._namespace = str(settings.redis_namespace or "mobile-runtime").strip() or "mobile-runtime"
        self._client = _build_redis_client()

    def _normalize_key(self, key: str) -> str:
        normalized = str(key or "").strip() or "runtime-cache-default"
        return f"{self._namespace}:cache:{normalized}"

    def get_json(self, key: str) -> dict[str, Any] | None:
        raw = self._client.get(self._normalize_key(key))
        if raw is None:
            return None
        try:
            payload = json.loads(raw)
        except Exception:
            return None
        if isinstance(payload, dict):
            return payload
        return None

    def set_json(self, key: str, value: dict[str, Any], *, ttl_seconds: int | None = None) -> None:
        key_name = self._normalize_key(key)
        encoded = json.dumps(value, ensure_ascii=False)
        if ttl_seconds is None:
            self._client.set(key_name, encoded)
            return
        self._client.setex(key_name, max(1, int(ttl_seconds)), encoded)

    def delete(self, key: str) -> None:
        self._client.delete(self._normalize_key(key))

    def contract(self) -> dict[str, Any]:
        return {
            "backend": self.backend_name,
            "distributed": True,
            "supports_ttl": True,
            "redis_url_scheme": _redis_url_scheme(),
            "namespace": self._namespace,
            "downgraded_from": None,
            "downgrade_reason": None,
        }


def _build_redis_client() -> Any:
    redis_url = str(settings.redis_url or "").strip()
    if not redis_url:
        raise RuntimeError("REDIS_URL is empty.")
    try:
        import redis  # type: ignore
    except Exception as exc:  # pragma: no cover - import path depends on runtime image.
        raise RuntimeError("redis package is not installed.") from exc
    return redis.Redis.from_url(
        redis_url,
        socket_connect_timeout=max(0.1, float(settings.redis_connect_timeout_seconds)),
        socket_timeout=max(0.1, float(settings.redis_socket_timeout_seconds)),
        decode_responses=True,
    )


def _redis_url_scheme() -> str | None:
    raw = str(settings.redis_url or "").strip()
    if not raw:
        return None
    parsed = urlsplit(raw)
    scheme = str(parsed.scheme or "").strip().lower()
    return scheme or None


@lru_cache
def get_runtime_cache_backend() -> RuntimeCacheBackend:
    backend = str(settings.cache_backend or "none").strip().lower()
    if backend in {"none", "noop"}:
        return NoopRuntimeCacheBackend()
    if backend in {"local", "memory", "local_memory"}:
        return LocalMemoryRuntimeCacheBackend()
    if backend in {"redis", "redis_contract"}:
        try:
            return RedisContractRuntimeCacheBackend()
        except Exception as exc:
            if bool(settings.cache_downgrade_to_none_on_error):
                return NoopRuntimeCacheBackend(
                    downgraded_from="redis_contract",
                    downgrade_reason=str(exc),
                )
            raise
    raise ValueError(f"Unsupported cache backend: {backend}")
