from __future__ import annotations

from typing import Any

from app.settings import settings


ROLLOUT_ORDER: tuple[str, str, str, str] = ("worker", "db", "api", "web")


def _normalize_rollout_step(raw: str | None, *, default: str) -> str:
    value = str(raw or "").strip().lower()
    if value in ROLLOUT_ORDER:
        return value
    return default


def _rollout_index(step: str) -> int:
    try:
        return ROLLOUT_ORDER.index(step)
    except ValueError:
        return 0


def describe_rollout_contract(
    *,
    deploy_profile: str,
    runtime_role: str,
    database_contract: dict[str, Any],
) -> dict[str, Any]:
    current_step = _normalize_rollout_step(getattr(settings, "rollout_step", None), default="worker")
    target_step = _normalize_rollout_step(getattr(settings, "rollout_target_step", None), default="web")
    current_idx = _rollout_index(current_step)
    target_idx = _rollout_index(target_step)
    active_driver = str(database_contract.get("active_driver") or "").strip().lower() or "unknown"
    active_database_truth = "postgresql" if active_driver.startswith("postgresql") else "sqlite"
    return {
        "phase": "runtime-phase-6",
        "fixed_order": list(ROLLOUT_ORDER),
        "fixed_order_csv": "worker->db->api->web",
        "current_step": current_step,
        "target_step": target_step,
        "transition": {
            "non_parallel_cutover_required": True,
            "forward_only": target_idx >= current_idx,
            "next_allowed_step": ROLLOUT_ORDER[min(current_idx + 1, len(ROLLOUT_ORDER) - 1)],
        },
        "service_boundary": {
            "worker": {
                "owns": ["job_execution", "poller", "background_tasks"],
                "must_not_own": ["public_http_routes", "frontend_serving"],
            },
            "db": {
                "owns": ["transactional_truth", "job_status_truth", "selection_result_truth"],
                "must_not_own": ["application_cache_truth", "frontend_serving"],
            },
            "api": {
                "owns": ["http_routes", "sse_streaming", "job_creation"],
                "must_not_own": ["background_job_execution", "frontend_rendering"],
            },
            "web": {
                "owns": ["frontend_rendering", "asset_proxying", "edge_headers"],
                "must_not_own": ["job_execution", "transactional_truth"],
            },
        },
        "rollback": {
            "enabled": bool(getattr(settings, "rollout_rollback_enabled", True)),
            "order": ["web", "api", "db", "worker"],
            "single_layer_only": True,
        },
        "consistency": {
            "enforced": bool(getattr(settings, "rollout_consistency_enforced", True)),
            "database_truth": active_database_truth,
            "redis_truth": "lock_cache_only",
            "job_execution_truth": "worker",
        },
        "runtime": {
            "deploy_profile": str(deploy_profile or "").strip() or "single_node",
            "runtime_role": str(runtime_role or "").strip() or "api",
        },
    }
