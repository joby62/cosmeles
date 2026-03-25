from __future__ import annotations

from app.settings import settings


def normalize_runtime_role() -> str:
    role = str(settings.runtime_role or "api").strip().lower()
    return role if role in {"api", "worker"} else "api"


def normalize_deploy_profile() -> str:
    profile = str(settings.deploy_profile or "single_node").strip().lower()
    return profile if profile in {"single_node", "split_runtime", "multi_node"} else "single_node"


def is_worker_runtime() -> bool:
    return normalize_runtime_role() == "worker"


def api_routes_enabled() -> bool:
    return not is_worker_runtime()


def upload_ingest_dispatch_mode() -> str:
    # phase-15: split/multi profile should move execution to dedicated worker process.
    profile = normalize_deploy_profile()
    role = normalize_runtime_role()
    if role == "worker":
        return "worker_poller"
    if profile in {"split_runtime", "multi_node"}:
        return "worker_poller"
    return "inline_local_queue"


def should_inline_dispatch_upload_job() -> bool:
    return upload_ingest_dispatch_mode() == "inline_local_queue"


def compare_dispatch_mode() -> str:
    profile = normalize_deploy_profile()
    role = normalize_runtime_role()
    if role == "worker":
        return "worker_poller"
    if profile in {"split_runtime", "multi_node"}:
        return "worker_poller"
    return "inline_local_queue"


def should_inline_dispatch_compare_job() -> bool:
    return compare_dispatch_mode() == "inline_local_queue"


def product_workbench_dispatch_mode() -> str:
    profile = normalize_deploy_profile()
    role = normalize_runtime_role()
    if role == "worker":
        return "worker_poller"
    if profile in {"split_runtime", "multi_node"}:
        return "worker_poller"
    return "inline_local_queue"


def should_inline_dispatch_product_workbench_job() -> bool:
    return product_workbench_dispatch_mode() == "inline_local_queue"
