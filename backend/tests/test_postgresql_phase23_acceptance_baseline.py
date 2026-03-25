from __future__ import annotations

import pytest

from app.db.models import (
    PHASE_21_REMAINING_SQLITE_STRUCTURED_TABLES,
    POSTGRESQL_PHASE_23,
    POSTGRESQL_PHASE_24,
    describe_postgresql_migration_boundary,
)
from app.platform.cache_backend import get_runtime_cache_backend
from app.platform.lock_backend import get_runtime_lock_backend
from app.platform.runtime_profile import describe_runtime_profile
from app.platform.selection_result_repository import get_selection_result_repository
from app.platform.storage_backend import get_runtime_storage
from app.platform.task_queue import get_runtime_task_queue
from app.settings import settings


PHASE_23_EXPECTED_TABLES: list[str] = [
    "products",
    "ingredient_library_index",
    "ingredient_library_alias_index",
    "ingredient_library_redirects",
    "ingredient_library_build_jobs",
    "upload_ingest_jobs",
    "product_workbench_jobs",
    "ai_jobs",
    "ai_runs",
    "product_route_mapping_index",
    "product_analysis_index",
    "product_featured_slots",
]

PHASE_24_EXPECTED_TABLES: list[str] = [
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


def test_phase23_table_group_boundary_matches_frozen_migration_plan() -> None:
    boundary = describe_postgresql_migration_boundary()
    migration_groups = boundary["migration_groups"]

    phase_23_tables = migration_groups[POSTGRESQL_PHASE_23]["tables"]
    phase_24_tables = migration_groups[POSTGRESQL_PHASE_24]["tables"]

    assert boundary["target_structured_truth_driver"] == "postgresql"
    assert phase_23_tables == PHASE_23_EXPECTED_TABLES
    assert phase_24_tables == PHASE_24_EXPECTED_TABLES
    assert set(phase_23_tables).isdisjoint(set(phase_24_tables))
    assert set(PHASE_21_REMAINING_SQLITE_STRUCTURED_TABLES) == set(phase_23_tables) | set(phase_24_tables)


@pytest.mark.parametrize("deploy_profile", ["split_runtime", "multi_node"])
def test_runtime_profile_exposes_phase23_boundary_for_acceptance_gate(
    monkeypatch: pytest.MonkeyPatch,
    deploy_profile: str,
) -> None:
    monkeypatch.setattr(settings, "deploy_profile", deploy_profile)
    monkeypatch.setattr(settings, "runtime_role", "api")
    monkeypatch.setattr(settings, "storage_backend", "object_storage_contract")
    monkeypatch.setattr(settings, "selection_result_repository_backend", "postgres_payload")
    monkeypatch.setattr(settings, "queue_backend", "local")
    monkeypatch.setattr(settings, "lock_backend", "local")
    monkeypatch.setattr(settings, "cache_backend", "none")
    monkeypatch.setattr(settings, "compare_job_max_concurrency", 1)
    _clear_runtime_adapter_caches()

    profile = describe_runtime_profile()
    migration_contract = profile["postgresql_migration_contract"]
    boundary = migration_contract["target_boundary"]

    assert migration_contract["table_payload_migration_phase_locked"] == POSTGRESQL_PHASE_23
    assert boundary["migration_groups"][POSTGRESQL_PHASE_23]["tables"] == PHASE_23_EXPECTED_TABLES
    assert boundary["migration_groups"][POSTGRESQL_PHASE_24]["tables"] == PHASE_24_EXPECTED_TABLES
