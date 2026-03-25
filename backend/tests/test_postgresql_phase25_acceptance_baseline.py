from __future__ import annotations

import pytest

from app.db.models import (
    POSTGRESQL_PHASE_23,
    POSTGRESQL_PHASE_24,
    POSTGRESQL_PHASE_25,
    describe_postgresql_migration_boundary,
)
from app.db.session import describe_database_default_contract, describe_database_engine_contract
from app.platform.cache_backend import get_runtime_cache_backend
from app.platform.lock_backend import get_runtime_lock_backend
from app.platform.runtime_profile import describe_runtime_profile
from app.platform.selection_result_repository import get_selection_result_repository
from app.platform.storage_backend import get_runtime_storage
from app.platform.task_queue import get_runtime_task_queue
from app.settings import settings


def _clear_runtime_adapter_caches() -> None:
    get_runtime_storage.cache_clear()
    get_selection_result_repository.cache_clear()
    get_runtime_task_queue.cache_clear()
    get_runtime_lock_backend.cache_clear()
    get_runtime_cache_backend.cache_clear()


def test_phase25_sqlite_closure_locks_are_visible_in_boundary_and_runtime_profile(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    boundary = describe_postgresql_migration_boundary()
    assert boundary["phase_25_locked_scope"] == "sqlite_closure"
    assert boundary["phase_25_locked_phase"] == POSTGRESQL_PHASE_25

    monkeypatch.setattr(settings, "deploy_profile", "split_runtime")
    monkeypatch.setattr(settings, "runtime_role", "api")
    monkeypatch.setattr(settings, "storage_backend", "object_storage_contract")
    monkeypatch.setattr(settings, "selection_result_repository_backend", "postgres_payload")
    monkeypatch.setattr(settings, "queue_backend", "local")
    monkeypatch.setattr(settings, "lock_backend", "local")
    monkeypatch.setattr(settings, "cache_backend", "none")
    _clear_runtime_adapter_caches()

    profile = describe_runtime_profile()
    migration_contract = profile["postgresql_migration_contract"]
    phase_24_contract = migration_contract["phase_24_mobile_state_pg_only_truth_contract"]

    assert migration_contract["table_payload_migration_phase_locked"] == POSTGRESQL_PHASE_23
    assert migration_contract["mobile_state_migration_phase_locked"] == POSTGRESQL_PHASE_24
    assert migration_contract["phase_25_closure_phase_locked"] == POSTGRESQL_PHASE_25
    assert phase_24_contract["phase_25_locked_scope"] == "sqlite_closure"
    assert phase_24_contract["phase_25_locked_phase"] == POSTGRESQL_PHASE_25


@pytest.mark.parametrize(
    ("deploy_profile", "downgrade_enabled_expected"),
    [
        ("single_node", True),
        ("split_runtime", False),
        ("multi_node", False),
    ],
)
def test_phase25_production_profile_parity_and_emergency_fallback_semantics(
    monkeypatch: pytest.MonkeyPatch,
    deploy_profile: str,
    downgrade_enabled_expected: bool,
) -> None:
    monkeypatch.setattr(settings, "deploy_profile", deploy_profile)
    monkeypatch.setattr(settings, "db_downgrade_to_sqlite_on_error", True)

    default_contract = describe_database_default_contract()
    engine_contract = describe_database_engine_contract()

    assert default_contract["production_default_driver"] == "postgresql"
    assert default_contract["production_profiles_requiring_postgresql_default"] == ["split_runtime", "multi_node"]
    assert default_contract["single_node_profile_role"] == "dev_or_emergency_fallback"
    assert default_contract["downgrade_policy"]["phase_22_target"] == "dev_or_emergency_only"

    assert engine_contract["phase"] == POSTGRESQL_PHASE_24
    assert engine_contract["downgrade"]["enabled"] is downgrade_enabled_expected
    assert engine_contract["downgrade"]["target_driver"] == "sqlite"
    assert engine_contract["default_contract"]["single_node_profile_role"] == "dev_or_emergency_fallback"


@pytest.mark.parametrize("runtime_role", ["api", "worker"])
def test_phase25_readiness_observability_contract_is_role_consistent(
    monkeypatch: pytest.MonkeyPatch,
    runtime_role: str,
) -> None:
    monkeypatch.setattr(settings, "deploy_profile", "split_runtime")
    monkeypatch.setattr(settings, "runtime_role", runtime_role)
    monkeypatch.setattr(settings, "storage_backend", "object_storage_contract")
    monkeypatch.setattr(settings, "selection_result_repository_backend", "postgres_payload")
    monkeypatch.setattr(settings, "queue_backend", "local")
    monkeypatch.setattr(settings, "lock_backend", "local")
    monkeypatch.setattr(settings, "cache_backend", "none")
    _clear_runtime_adapter_caches()

    profile = describe_runtime_profile()
    migration_contract = profile["postgresql_migration_contract"]
    default_contract = profile["database_contract"]["default_contract"]

    assert migration_contract["phase_25_closure_phase_locked"] == POSTGRESQL_PHASE_25
    assert migration_contract["mobile_state_migration_phase_locked"] == POSTGRESQL_PHASE_24
    assert default_contract["single_node_profile_role"] == "dev_or_emergency_fallback"
    assert default_contract["production_profiles_requiring_postgresql_default"] == ["split_runtime", "multi_node"]
