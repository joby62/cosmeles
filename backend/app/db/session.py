from __future__ import annotations

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.settings import settings


def _normalize_database_url(value: str | None) -> str:
    url = str(value or "").strip()
    if url:
        return url
    return f"sqlite:///{settings.storage_dir.rstrip('/')}/app.db"


def _is_sqlite_url(url: str) -> bool:
    return str(url or "").strip().lower().startswith("sqlite")


def _engine_kwargs_for(url: str) -> dict:
    is_sqlite = _is_sqlite_url(url)
    kwargs: dict = {
        "connect_args": {"check_same_thread": False} if is_sqlite else {},
    }
    if not is_sqlite:
        kwargs.update(
            {
                "pool_size": max(1, int(settings.db_pool_size)),
                "max_overflow": max(0, int(settings.db_max_overflow)),
                "pool_timeout": max(1, int(settings.db_pool_timeout_seconds)),
                "pool_recycle": max(30, int(settings.db_pool_recycle_seconds)),
                "pool_pre_ping": bool(settings.db_pool_pre_ping),
            }
        )
    return kwargs


def _driver_name(url: str) -> str:
    head = str(url or "").split("://", 1)[0].strip().lower()
    return head or "unknown"


def _build_engine_with_optional_downgrade():
    configured_url = _normalize_database_url(settings.database_url)
    try:
        created = create_engine(configured_url, **_engine_kwargs_for(configured_url))
        return created, configured_url, configured_url, False, None
    except Exception as exc:
        allow_downgrade = bool(settings.db_downgrade_to_sqlite_on_error)
        downgrade_url = _normalize_database_url(settings.db_downgrade_sqlite_url)
        if (not allow_downgrade) or _is_sqlite_url(configured_url):
            raise
        created = create_engine(downgrade_url, **_engine_kwargs_for(downgrade_url))
        reason = f"{type(exc).__name__}: {exc}"
        return created, configured_url, downgrade_url, True, reason


engine, _configured_database_url, _active_database_url, _db_downgraded, _db_downgrade_reason = _build_engine_with_optional_downgrade()
is_sqlite = _is_sqlite_url(_active_database_url)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def describe_database_engine_contract() -> dict:
    return {
        "configured_driver": _driver_name(_configured_database_url),
        "active_driver": _driver_name(_active_database_url),
        "active_is_sqlite": is_sqlite,
        "pool": {
            "enabled": not is_sqlite,
            "pool_size": max(1, int(settings.db_pool_size)),
            "max_overflow": max(0, int(settings.db_max_overflow)),
            "pool_timeout_seconds": max(1, int(settings.db_pool_timeout_seconds)),
            "pool_recycle_seconds": max(30, int(settings.db_pool_recycle_seconds)),
            "pool_pre_ping": bool(settings.db_pool_pre_ping),
        },
        "downgrade": {
            "enabled": bool(settings.db_downgrade_to_sqlite_on_error),
            "applied": bool(_db_downgraded),
            "reason": _db_downgrade_reason,
            "target_driver": _driver_name(_normalize_database_url(settings.db_downgrade_sqlite_url)),
        },
    }


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
