from __future__ import annotations

from contextlib import contextmanager
from functools import lru_cache
import threading
from typing import Any, Iterator, Protocol
from urllib.parse import urlsplit

from app.settings import settings


class RuntimeLockBackend(Protocol):
    backend_name: str

    def named(self, key: str) -> Iterator[None]: ...

    def contract(self) -> dict[str, Any]: ...


class LocalNamedLockBackend:
    backend_name = "local"

    def __init__(self, *, downgraded_from: str | None = None, downgrade_reason: str | None = None) -> None:
        self._registry_guard = threading.Lock()
        self._locks: dict[str, threading.Lock] = {}
        self._downgraded_from = downgraded_from
        self._downgrade_reason = downgrade_reason

    def _lock_for(self, key: str) -> threading.Lock:
        normalized = str(key or "").strip() or "runtime-default"
        with self._registry_guard:
            lock = self._locks.get(normalized)
            if lock is None:
                lock = threading.Lock()
                self._locks[normalized] = lock
            return lock

    @contextmanager
    def named(self, key: str) -> Iterator[None]:
        lock = self._lock_for(key)
        lock.acquire()
        try:
            yield
        finally:
            lock.release()

    def contract(self) -> dict[str, Any]:
        return {
            "backend": self.backend_name,
            "distributed": False,
            "downgraded_from": self._downgraded_from,
            "downgrade_reason": self._downgrade_reason,
        }


class NoopLockBackend:
    backend_name = "none"

    @contextmanager
    def named(self, key: str) -> Iterator[None]:
        yield

    def contract(self) -> dict[str, Any]:
        return {
            "backend": self.backend_name,
            "distributed": False,
            "downgraded_from": None,
            "downgrade_reason": None,
        }


class RedisNamedLockBackend:
    backend_name = "redis_contract"

    def __init__(self) -> None:
        self._namespace = str(settings.redis_namespace or "mobile-runtime").strip() or "mobile-runtime"
        self._client = _build_redis_client()
        self._lock_timeout_seconds = max(1.0, float(getattr(settings, "worker_poll_interval_seconds", 1.0) * 120))
        self._lock_blocking_timeout_seconds = max(0.5, float(getattr(settings, "worker_poll_interval_seconds", 1.0) * 2))

    def _lock_key(self, key: str) -> str:
        normalized = str(key or "").strip() or "runtime-default"
        return f"{self._namespace}:lock:{normalized}"

    @contextmanager
    def named(self, key: str) -> Iterator[None]:
        lock = self._client.lock(
            self._lock_key(key),
            timeout=self._lock_timeout_seconds,
            blocking_timeout=self._lock_blocking_timeout_seconds,
        )
        acquired = bool(lock.acquire(blocking=True))
        if not acquired:
            raise RuntimeError(f"Failed to acquire redis lock: {key}")
        try:
            yield
        finally:
            try:
                lock.release()
            except Exception:
                pass

    def contract(self) -> dict[str, Any]:
        return {
            "backend": self.backend_name,
            "distributed": True,
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
def get_runtime_lock_backend() -> RuntimeLockBackend:
    backend = str(settings.lock_backend or "local").strip().lower()
    if backend == "none":
        return NoopLockBackend()
    if backend == "local":
        return LocalNamedLockBackend()
    if backend in {"redis", "redis_contract"}:
        try:
            return RedisNamedLockBackend()
        except Exception as exc:
            if bool(settings.lock_downgrade_to_local_on_error):
                return LocalNamedLockBackend(
                    downgraded_from="redis_contract",
                    downgrade_reason=str(exc),
                )
            raise
    raise ValueError(f"Unsupported lock backend: {backend}")
