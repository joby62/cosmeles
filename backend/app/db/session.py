from __future__ import annotations

import os

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db.models import (
    POSTGRESQL_PHASE_22,
    POSTGRESQL_PHASE_23,
    POSTGRESQL_PHASE_24,
    POSTGRESQL_PHASE_25,
    MOBILE_USER_STATE_STRUCTURED_TABLES,
    PRODUCT_WORKBENCH_STRUCTURED_TABLES,
    describe_postgresql_migration_boundary,
)
from app.settings import settings


DEFAULT_PRODUCTION_PROFILES: tuple[str, str] = ("split_runtime", "multi_node")


def _normalize_deploy_profile(raw: str | None) -> str:
    profile = str(raw or "").strip().lower()
    return profile or "single_node"


def _production_profiles() -> tuple[str, ...]:
    raw = str(getattr(settings, "database_production_profiles_csv", "") or "")
    profiles = tuple(item.strip().lower() for item in raw.split(",") if item.strip())
    return profiles or DEFAULT_PRODUCTION_PROFILES


def _default_sqlite_database_url() -> str:
    configured = str(getattr(settings, "database_url_sqlite_fallback", "") or "").strip()
    if configured:
        return configured
    return f"sqlite:///{settings.storage_dir.rstrip('/')}/app.db"


def _default_postgresql_database_url() -> str:
    configured = str(getattr(settings, "database_url_postgresql_default", "") or "").strip()
    if configured:
        return configured
    return "postgresql+psycopg://postgres:postgres@postgres:5432/cosmeles"


def _normalize_database_url(value: str | None) -> str:
    url = str(value or "").strip()
    if url:
        return url
    return _default_sqlite_database_url()


def _is_sqlite_url(url: str) -> bool:
    return str(url or "").strip().lower().startswith("sqlite")


def _driver_name(url: str) -> str:
    head = str(url or "").split("://", 1)[0].strip().lower()
    return head or "unknown"


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


def _resolve_configured_database_url() -> tuple[str, str, str, tuple[str, ...]]:
    deploy_profile = _normalize_deploy_profile(getattr(settings, "deploy_profile", None))
    production_profiles = _production_profiles()
    explicit_url = str(getattr(settings, "database_url", "") or "").strip()
    if explicit_url:
        return explicit_url, "env_or_settings", deploy_profile, production_profiles
    if deploy_profile in production_profiles:
        return _default_postgresql_database_url(), "profile_default_postgresql", deploy_profile, production_profiles
    return _default_sqlite_database_url(), "profile_default_sqlite", deploy_profile, production_profiles


def _parse_bool_env(name: str) -> bool | None:
    raw = os.getenv(name)
    if raw is None:
        return None
    value = raw.strip().lower()
    if value in {"1", "true", "yes", "on"}:
        return True
    if value in {"0", "false", "no", "off"}:
        return False
    return None


def _resolve_downgrade_policy(
    *,
    deploy_profile: str,
    production_profiles: tuple[str, ...],
) -> tuple[bool, bool, str]:
    configured_enabled = bool(getattr(settings, "db_downgrade_to_sqlite_on_error", False))
    explicit_env_override = _parse_bool_env("DB_DOWNGRADE_TO_SQLITE_ON_ERROR")
    if deploy_profile in production_profiles:
        if explicit_env_override is not None:
            return configured_enabled, False, "phase_25_production_forced_off_env_override"
        return configured_enabled, False, "phase_25_production_forced_off"
    if explicit_env_override is not None:
        return configured_enabled, explicit_env_override, "env_override"
    return configured_enabled, configured_enabled, "single_node_default"


def _build_engine_with_optional_downgrade():
    configured_url, database_url_source, deploy_profile, production_profiles = _resolve_configured_database_url()
    configured_enabled, effective_downgrade_enabled, downgrade_policy_source = _resolve_downgrade_policy(
        deploy_profile=deploy_profile,
        production_profiles=production_profiles,
    )
    try:
        created = create_engine(configured_url, **_engine_kwargs_for(configured_url))
        return (
            created,
            configured_url,
            configured_url,
            False,
            None,
            database_url_source,
            deploy_profile,
            production_profiles,
            configured_enabled,
            effective_downgrade_enabled,
            downgrade_policy_source,
        )
    except Exception as exc:
        downgrade_url = _normalize_database_url(settings.db_downgrade_sqlite_url)
        if (not effective_downgrade_enabled) or _is_sqlite_url(configured_url):
            raise
        created = create_engine(downgrade_url, **_engine_kwargs_for(downgrade_url))
        reason = f"{type(exc).__name__}: {exc}"
        return (
            created,
            configured_url,
            downgrade_url,
            True,
            reason,
            database_url_source,
            deploy_profile,
            production_profiles,
            configured_enabled,
            effective_downgrade_enabled,
            downgrade_policy_source,
        )


(
    engine,
    _configured_database_url,
    _active_database_url,
    _db_downgraded,
    _db_downgrade_reason,
    _database_url_source,
    _active_deploy_profile,
    _production_profiles_requiring_postgresql_default,
    _downgrade_configured_enabled,
    _downgrade_effective_enabled,
    _downgrade_policy_source,
) = _build_engine_with_optional_downgrade()
is_sqlite = _is_sqlite_url(_active_database_url)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def describe_database_default_contract() -> dict:
    runtime_deploy_profile = _normalize_deploy_profile(getattr(settings, "deploy_profile", None))
    runtime_production_profiles = _production_profiles()
    runtime_configured_enabled, runtime_effective_enabled, runtime_policy_source = _resolve_downgrade_policy(
        deploy_profile=runtime_deploy_profile,
        production_profiles=runtime_production_profiles,
    )
    runtime_requires_postgresql_default = runtime_deploy_profile in runtime_production_profiles
    configured_driver = _driver_name(_configured_database_url)
    production_default_compliant = (not runtime_requires_postgresql_default) or configured_driver.startswith("postgresql")
    return {
        "phase": POSTGRESQL_PHASE_22,
        "active_deploy_profile": runtime_deploy_profile,
        "production_profiles_requiring_postgresql_default": list(runtime_production_profiles),
        "requires_postgresql_default_now": runtime_requires_postgresql_default,
        "configured_default_driver": configured_driver,
        "configured_database_url_source": _database_url_source,
        "production_default_driver": "postgresql",
        "single_node_default_driver": "sqlite",
        "single_node_profile_role": "dev_or_emergency_fallback",
        "production_default_compliant": production_default_compliant,
        "phase_22_status": "completed",
        "phase_22_contract_scope": {
            "phase": POSTGRESQL_PHASE_22,
            "database_url_default_driver": "postgresql",
            "engine_pool_required_when_postgresql": True,
            "sessionmaker_bound_to_single_active_engine": True,
            "init_db_bootstrap_bound_to_active_engine": True,
        },
        "downgrade_policy": {
            "configured_enabled": runtime_configured_enabled,
            "effective_enabled": runtime_effective_enabled,
            "policy_source": runtime_policy_source,
            "production_default_enabled": False,
            "sqlite_target_driver": _driver_name(_normalize_database_url(settings.db_downgrade_sqlite_url)),
            "phase_22_target": "dev_or_emergency_only",
            "phase_25_production_forced_off": runtime_deploy_profile in runtime_production_profiles,
            "boot_configured_enabled": _downgrade_configured_enabled,
            "boot_effective_enabled": _downgrade_effective_enabled,
            "boot_policy_source": _downgrade_policy_source,
        },
    }


def describe_phase_23_pg_only_truth_contract() -> dict:
    active_driver = _driver_name(_active_database_url)
    configured_driver = _driver_name(_configured_database_url)
    production_profile_active = _active_deploy_profile in _production_profiles_requiring_postgresql_default
    pg_only_required_now = bool(production_profile_active)
    pg_only_compliant = (not pg_only_required_now) or active_driver.startswith("postgresql")
    violation_reason = None
    if not pg_only_compliant:
        violation_reason = (
            "phase-23 requires PostgreSQL active driver for production profiles; "
            f"got active_driver={active_driver} profile={_active_deploy_profile}."
        )
    return {
        "phase": POSTGRESQL_PHASE_23,
        "phase_23_truth_status": "completed",
        "table_group_focus": "product_workbench_and_backend_jobs",
        "pg_only_online_truth_tables": list(PRODUCT_WORKBENCH_STRUCTURED_TABLES),
        "pg_only_online_truth_table_count": len(PRODUCT_WORKBENCH_STRUCTURED_TABLES),
        "active_deploy_profile": _active_deploy_profile,
        "production_profiles_requiring_pg_only": list(_production_profiles_requiring_postgresql_default),
        "single_node_profile_role": "dev_or_emergency_fallback",
        "configured_driver": configured_driver,
        "active_driver": active_driver,
        "database_url_source": _database_url_source,
        "downgrade_applied": bool(_db_downgraded),
        "pg_only_required_now": pg_only_required_now,
        "pg_only_compliant": pg_only_compliant,
        "violation_reason": violation_reason,
        "phase_24_locked_table_group": "mobile_state_tables",
    }


def assert_phase_23_pg_only_truth_contract() -> None:
    contract = describe_phase_23_pg_only_truth_contract()
    if bool(contract.get("pg_only_compliant")):
        return
    raise RuntimeError(str(contract.get("violation_reason") or "phase-23 PG-only truth contract violated"))


def _phase_24_mobile_state_pg_only_required_now() -> tuple[bool, str, tuple[str, ...]]:
    runtime_deploy_profile = _normalize_deploy_profile(getattr(settings, "deploy_profile", None))
    runtime_production_profiles = _production_profiles()
    required = runtime_deploy_profile in runtime_production_profiles
    return required, runtime_deploy_profile, runtime_production_profiles


def allow_phase_24_mobile_state_legacy_fallback() -> bool:
    required, _runtime_deploy_profile, _runtime_production_profiles = _phase_24_mobile_state_pg_only_required_now()
    return not required


def describe_phase_24_mobile_state_pg_only_truth_contract() -> dict:
    active_driver = _driver_name(_active_database_url)
    configured_driver = _driver_name(_configured_database_url)
    pg_only_required_now, runtime_deploy_profile, runtime_production_profiles = _phase_24_mobile_state_pg_only_required_now()
    pg_only_compliant = (not pg_only_required_now) or active_driver.startswith("postgresql")
    violation_reason = None
    if not pg_only_compliant:
        violation_reason = (
            "phase-24 requires PostgreSQL active driver for production profiles; "
            f"got active_driver={active_driver} profile={runtime_deploy_profile}."
        )
    return {
        "phase": POSTGRESQL_PHASE_24,
        "table_group_focus": "mobile_state_tables",
        "pg_only_online_truth_tables": list(MOBILE_USER_STATE_STRUCTURED_TABLES),
        "pg_only_online_truth_table_count": len(MOBILE_USER_STATE_STRUCTURED_TABLES),
        "active_deploy_profile": runtime_deploy_profile,
        "production_profiles_requiring_pg_only": list(runtime_production_profiles),
        "single_node_profile_role": "dev_or_emergency_fallback",
        "configured_driver": configured_driver,
        "active_driver": active_driver,
        "database_url_source": _database_url_source,
        "downgrade_applied": bool(_db_downgraded),
        "pg_only_required_now": pg_only_required_now,
        "legacy_artifact_fallback_allowed": not pg_only_required_now,
        "pg_only_compliant": pg_only_compliant,
        "violation_reason": violation_reason,
        "phase_25_locked_scope": "sqlite_closure",
        "phase_25_locked_phase": POSTGRESQL_PHASE_25,
    }


def assert_phase_24_mobile_state_pg_only_truth_contract() -> None:
    contract = describe_phase_24_mobile_state_pg_only_truth_contract()
    if bool(contract.get("pg_only_compliant")):
        return
    raise RuntimeError(str(contract.get("violation_reason") or "phase-24 PG-only truth contract violated"))


def describe_phase_25_sqlite_closure_contract() -> dict:
    runtime_deploy_profile = _normalize_deploy_profile(getattr(settings, "deploy_profile", None))
    runtime_production_profiles = _production_profiles()
    production_profile_active = runtime_deploy_profile in runtime_production_profiles
    configured_driver = _driver_name(_configured_database_url)
    active_driver = _driver_name(_active_database_url)
    runtime_configured_enabled, runtime_effective_enabled, runtime_policy_source = _resolve_downgrade_policy(
        deploy_profile=runtime_deploy_profile,
        production_profiles=runtime_production_profiles,
    )
    explicit_env_override = _parse_bool_env("DB_DOWNGRADE_TO_SQLITE_ON_ERROR")
    sqlite_online_truth_allowed_now = runtime_deploy_profile == "single_node"
    active_driver_compliant = (not production_profile_active) or active_driver.startswith("postgresql")
    configured_driver_compliant = (not production_profile_active) or configured_driver.startswith("postgresql")
    downgrade_policy_compliant = (not production_profile_active) or (not runtime_effective_enabled)
    violation_reasons: list[str] = []
    if not active_driver_compliant:
        violation_reasons.append(
            "phase-25 closure requires production profile active driver to be PostgreSQL; "
            f"got active_driver={active_driver} profile={runtime_deploy_profile}."
        )
    if not configured_driver_compliant:
        violation_reasons.append(
            "phase-25 closure requires production profile configured driver to be PostgreSQL default; "
            f"got configured_driver={configured_driver} profile={runtime_deploy_profile}."
        )
    if not downgrade_policy_compliant:
        violation_reasons.append(
            "phase-25 closure forbids enabling SQLite downgrade in production profiles; "
            f"got policy_source={runtime_policy_source} effective_enabled={runtime_effective_enabled}."
        )
    closure_compliant = not violation_reasons
    return {
        "phase": POSTGRESQL_PHASE_25,
        "phase_25_truth_status": "in_execution",
        "closure_scope": "sqlite_closure",
        "active_deploy_profile": runtime_deploy_profile,
        "production_profiles": list(runtime_production_profiles),
        "single_node_profile_role": "dev_or_emergency_fallback",
        "configured_driver": configured_driver,
        "active_driver": active_driver,
        "database_url_source": _database_url_source,
        "sqlite_online_truth_allowed_now": sqlite_online_truth_allowed_now,
        "production_sqlite_online_truth_forbidden": production_profile_active,
        "downgrade_policy": {
            "configured_enabled": bool(runtime_configured_enabled),
            "effective_enabled": bool(runtime_effective_enabled),
            "policy_source": runtime_policy_source,
            "explicit_env_override": explicit_env_override,
            "boot_effective_enabled": bool(_downgrade_effective_enabled),
            "boot_policy_source": _downgrade_policy_source,
        },
        "closure_rules": {
            "production_profile_no_sqlite_online_truth": True,
            "production_profile_no_implicit_sqlite_downgrade": True,
            "single_node_only_dev_or_emergency_fallback": True,
            "phase_23_reopen_forbidden": True,
            "phase_24_reopen_forbidden": True,
        },
        "closure_compliant": closure_compliant,
        "violation_reasons": violation_reasons,
    }


def assert_phase_25_sqlite_closure_contract() -> None:
    contract = describe_phase_25_sqlite_closure_contract()
    if bool(contract.get("closure_compliant")):
        return
    violations = contract.get("violation_reasons")
    if isinstance(violations, list) and violations:
        raise RuntimeError("; ".join(str(item) for item in violations))
    raise RuntimeError("phase-25 SQLite closure contract violated")


def describe_database_engine_contract() -> dict:
    runtime_deploy_profile = _normalize_deploy_profile(getattr(settings, "deploy_profile", None))
    runtime_production_profiles = _production_profiles()
    runtime_configured_enabled, runtime_effective_enabled, runtime_policy_source = _resolve_downgrade_policy(
        deploy_profile=runtime_deploy_profile,
        production_profiles=runtime_production_profiles,
    )
    default_contract = describe_database_default_contract()
    phase_23_contract = describe_phase_23_pg_only_truth_contract()
    phase_24_contract = describe_phase_24_mobile_state_pg_only_truth_contract()
    phase_25_contract = describe_phase_25_sqlite_closure_contract()
    return {
        "phase": POSTGRESQL_PHASE_24,
        "configured_driver": _driver_name(_configured_database_url),
        "active_driver": _driver_name(_active_database_url),
        "active_is_sqlite": is_sqlite,
        "engine_url_source": _database_url_source,
        "pool": {
            "enabled": not is_sqlite,
            "pool_size": max(1, int(settings.db_pool_size)),
            "max_overflow": max(0, int(settings.db_max_overflow)),
            "pool_timeout_seconds": max(1, int(settings.db_pool_timeout_seconds)),
            "pool_recycle_seconds": max(30, int(settings.db_pool_recycle_seconds)),
            "pool_pre_ping": bool(settings.db_pool_pre_ping),
        },
        "downgrade": {
            "enabled": bool(runtime_effective_enabled),
            "configured_enabled": bool(runtime_configured_enabled),
            "applied": bool(_db_downgraded),
            "reason": _db_downgrade_reason,
            "policy_source": runtime_policy_source,
            "target_driver": _driver_name(_normalize_database_url(settings.db_downgrade_sqlite_url)),
            "boot_effective_enabled": bool(_downgrade_effective_enabled),
            "boot_policy_source": _downgrade_policy_source,
        },
        "session_contract": {
            "session_local_bound_to_single_active_engine": True,
            "session_local_bind_driver": _driver_name(_active_database_url),
        },
        "default_contract": default_contract,
        "phase_23_pg_only_truth_contract": phase_23_contract,
        "phase_24_mobile_state_pg_only_truth_contract": phase_24_contract,
        "phase_25_sqlite_closure_contract": phase_25_contract,
        "postgresql_migration_boundary": describe_postgresql_migration_boundary(),
    }


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
