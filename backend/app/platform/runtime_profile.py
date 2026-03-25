from __future__ import annotations

from typing import Any

from app.db.init_db import describe_init_db_contract
from app.db.models import (
    POSTGRESQL_PHASE_23,
    POSTGRESQL_PHASE_24,
    POSTGRESQL_PHASE_25,
    describe_postgresql_migration_boundary,
)
from app.db.session import (
    describe_database_default_contract,
    describe_database_engine_contract,
    describe_phase_23_pg_only_truth_contract,
    describe_phase_24_mobile_state_pg_only_truth_contract,
    describe_phase_25_sqlite_closure_contract,
)
from app.platform.cache_backend import get_runtime_cache_backend
from app.platform.lock_backend import get_runtime_lock_backend
from app.platform.selection_result_repository import get_selection_result_repository
from app.platform.storage_backend import get_runtime_storage
from app.platform.task_queue import get_runtime_task_queue
from app.settings import settings
from app.services.runtime_rollout import describe_rollout_contract
from app.services.runtime_topology import (
    api_routes_enabled,
    compare_dispatch_mode,
    is_worker_runtime,
    product_workbench_dispatch_mode,
    upload_ingest_dispatch_mode,
)
from app.services.runtime_worker import describe_runtime_worker_state


def describe_runtime_profile() -> dict[str, Any]:
    storage = get_runtime_storage()
    selection_results = get_selection_result_repository()
    queue = get_runtime_task_queue()
    lock = get_runtime_lock_backend()
    cache = get_runtime_cache_backend()
    database_contract = describe_database_engine_contract()
    database_default_contract = describe_database_default_contract()
    phase_23_contract = describe_phase_23_pg_only_truth_contract()
    phase_24_contract = describe_phase_24_mobile_state_pg_only_truth_contract()
    phase_25_contract = describe_phase_25_sqlite_closure_contract()
    migration_boundary = describe_postgresql_migration_boundary()
    init_contract = describe_init_db_contract()
    deploy_profile = str(settings.deploy_profile or "single_node").strip() or "single_node"
    runtime_role = str(settings.runtime_role or "api").strip() or "api"
    return {
        "deploy_profile": deploy_profile,
        "runtime_role": runtime_role,
        "backends": {
            "database": str(database_contract.get("active_driver") or "unknown"),
            "storage": storage.backend_name,
            "selection_results": selection_results.backend_name,
            "queue": queue.backend_name,
            "lock": lock.backend_name,
            "cache": cache.backend_name,
        },
        "database_contract": database_contract,
        "postgresql_migration_contract": {
            "phase": POSTGRESQL_PHASE_24,
            "target_boundary": migration_boundary,
            "engine_session_default_contract": database_default_contract,
            "init_bootstrap_contract": init_contract,
            "phase_23_pg_only_truth_contract": phase_23_contract,
            "phase_24_mobile_state_pg_only_truth_contract": phase_24_contract,
            "phase_25_sqlite_closure_contract": phase_25_contract,
            "table_payload_migration_phase_locked": POSTGRESQL_PHASE_23,
            "mobile_state_migration_phase_locked": POSTGRESQL_PHASE_24,
            "phase_25_closure_phase_locked": POSTGRESQL_PHASE_25,
        },
        "rollout_contract": describe_rollout_contract(
            deploy_profile=deploy_profile,
            runtime_role=runtime_role,
            database_contract=database_contract,
        ),
        "selection_result_payload_model": {
            "table": "mobile_selection_result_index",
            "online_payload_column": "published_payload_json",
            "fixed_contract_column": "fixed_contract_json",
            "artifact_manifest_column": "artifact_manifest_json",
            "payload_backend_column": "payload_backend",
        },
        "selection_result_contract": selection_results.contract(),
        "storage_contract": storage.contract(),
        "queue_contract": queue.contract(),
        "lock_contract": lock.contract(),
        "cache_contract": cache.contract(),
        "origins": {
            "api_public_origin": str(settings.api_public_origin or "").strip() or None,
            "api_internal_origin": str(settings.api_internal_origin or "").strip() or None,
            "asset_public_origin": str(settings.asset_public_origin or "").strip() or None,
        },
        "topology": {
            "api_routes_enabled": api_routes_enabled(),
            "worker_runtime_expected": is_worker_runtime(),
            "upload_ingest_dispatch_mode": upload_ingest_dispatch_mode(),
            "compare_dispatch_mode": compare_dispatch_mode(),
            "product_workbench_dispatch_mode": product_workbench_dispatch_mode(),
            "worker_state": describe_runtime_worker_state(),
        },
    }
