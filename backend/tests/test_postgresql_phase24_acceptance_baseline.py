from __future__ import annotations

import pytest

from app.db.models import (
    POSTGRESQL_PHASE_23,
    POSTGRESQL_PHASE_24,
    POSTGRESQL_PHASE_25,
    describe_postgresql_migration_boundary,
)
from app.db.session import describe_phase_24_mobile_state_pg_only_truth_contract
from app.platform.cache_backend import get_runtime_cache_backend
from app.platform.lock_backend import get_runtime_lock_backend
from app.platform.runtime_profile import describe_runtime_profile
from app.platform.selection_result_repository import get_selection_result_repository
from app.platform.storage_backend import get_runtime_storage
from app.platform.task_queue import get_runtime_task_queue
from app.settings import settings


PHASE_24_MOBILE_STATE_TABLES: list[str] = [
    "mobile_selection_sessions",
    "mobile_compare_session_index",
    "mobile_compare_usage_stats",
    "mobile_bag_items",
    "mobile_client_events",
    "user_upload_assets",
    "user_products",
]


def _clear_runtime_adapter_caches() -> None:
    get_runtime_storage.cache_clear()
    get_selection_result_repository.cache_clear()
    get_runtime_task_queue.cache_clear()
    get_runtime_lock_backend.cache_clear()
    get_runtime_cache_backend.cache_clear()


def test_phase24_mobile_state_table_group_boundary_matches_frozen_contract() -> None:
    boundary = describe_postgresql_migration_boundary()
    phase_24_group = boundary["migration_groups"][POSTGRESQL_PHASE_24]

    assert boundary["phase"] == POSTGRESQL_PHASE_24
    assert phase_24_group["focus"] == "mobile_session_history_bag_events_user_assets"
    assert phase_24_group["tables"] == PHASE_24_MOBILE_STATE_TABLES
    assert len(phase_24_group["tables"]) == 7


@pytest.mark.parametrize(
    ("deploy_profile", "required_now"),
    [
        ("single_node", False),
        ("split_runtime", True),
        ("multi_node", True),
    ],
)
def test_phase24_mobile_state_pg_only_truth_contract_gates_by_profile(
    monkeypatch: pytest.MonkeyPatch,
    deploy_profile: str,
    required_now: bool,
) -> None:
    monkeypatch.setattr(settings, "deploy_profile", deploy_profile)

    contract = describe_phase_24_mobile_state_pg_only_truth_contract()

    assert contract["phase"] == POSTGRESQL_PHASE_24
    assert contract["table_group_focus"] == "mobile_state_tables"
    assert contract["pg_only_online_truth_tables"] == PHASE_24_MOBILE_STATE_TABLES
    assert contract["pg_only_online_truth_table_count"] == 7
    assert contract["single_node_profile_role"] == "dev_or_emergency_fallback"
    assert contract["production_profiles_requiring_pg_only"] == ["split_runtime", "multi_node"]
    assert contract["pg_only_required_now"] is required_now
    assert contract["legacy_artifact_fallback_allowed"] is (not required_now)
    assert contract["phase_25_locked_scope"] == "sqlite_closure"
    assert contract["phase_25_locked_phase"] == POSTGRESQL_PHASE_25
    if required_now and not contract["pg_only_compliant"]:
        assert "phase-24 requires PostgreSQL active driver" in str(contract["violation_reason"] or "")


@pytest.mark.parametrize("deploy_profile", ["split_runtime", "multi_node"])
@pytest.mark.parametrize("runtime_role", ["api", "worker"])
def test_runtime_profile_exposes_phase24_mobile_state_locks_and_worker_api_consistency(
    monkeypatch: pytest.MonkeyPatch,
    deploy_profile: str,
    runtime_role: str,
) -> None:
    monkeypatch.setattr(settings, "deploy_profile", deploy_profile)
    monkeypatch.setattr(settings, "runtime_role", runtime_role)
    monkeypatch.setattr(settings, "storage_backend", "object_storage_contract")
    monkeypatch.setattr(settings, "selection_result_repository_backend", "postgres_payload")
    monkeypatch.setattr(settings, "queue_backend", "local")
    monkeypatch.setattr(settings, "lock_backend", "local")
    monkeypatch.setattr(settings, "cache_backend", "none")
    monkeypatch.setattr(settings, "compare_job_max_concurrency", 1)
    _clear_runtime_adapter_caches()

    profile = describe_runtime_profile()
    migration_contract = profile["postgresql_migration_contract"]
    phase_24_contract = migration_contract["phase_24_mobile_state_pg_only_truth_contract"]
    topology = profile["topology"]

    assert migration_contract["phase"] == POSTGRESQL_PHASE_24
    assert migration_contract["table_payload_migration_phase_locked"] == POSTGRESQL_PHASE_23
    assert migration_contract["mobile_state_migration_phase_locked"] == POSTGRESQL_PHASE_24
    assert migration_contract["phase_25_closure_phase_locked"] == POSTGRESQL_PHASE_25
    assert phase_24_contract["pg_only_online_truth_tables"] == PHASE_24_MOBILE_STATE_TABLES
    assert phase_24_contract["pg_only_online_truth_table_count"] == 7
    assert topology["compare_dispatch_mode"] == "worker_poller"
    assert topology["product_workbench_dispatch_mode"] == "worker_poller"
