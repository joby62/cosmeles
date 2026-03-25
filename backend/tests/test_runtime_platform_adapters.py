import threading

import pytest

from app.platform.cache_backend import get_runtime_cache_backend
from app.platform.lock_backend import get_runtime_lock_backend
from app.platform.runtime_profile import describe_runtime_profile
from app.platform.selection_result_repository import (
    SelectionResultArtifactPaths,
    get_selection_result_repository,
)
from app.routes import ingest as ingest_routes
from app.routes import products as products_routes
from app.platform.storage_backend import get_runtime_storage
from app.platform.task_queue import get_runtime_task_queue
from app.settings import settings
from app.services.runtime_topology import (
    should_inline_dispatch_product_workbench_job,
    should_inline_dispatch_upload_job,
)


def _clear_runtime_adapter_caches() -> None:
    get_runtime_storage.cache_clear()
    get_selection_result_repository.cache_clear()
    get_runtime_task_queue.cache_clear()
    get_runtime_lock_backend.cache_clear()
    get_runtime_cache_backend.cache_clear()


def test_runtime_storage_round_trip_and_public_url(tmp_path, monkeypatch) -> None:
    storage_dir = tmp_path / "storage"
    user_storage_dir = tmp_path / "user_storage"
    monkeypatch.setattr(settings, "storage_dir", str(storage_dir))
    monkeypatch.setattr(settings, "user_storage_dir", str(user_storage_dir))
    monkeypatch.setattr(settings, "storage_backend", "local_fs")
    monkeypatch.setattr(settings, "asset_public_origin", "https://assets.example.com")
    _clear_runtime_adapter_caches()

    storage = get_runtime_storage()
    storage.ensure_dirs()
    storage.save_json("selection_results/published/mock.json", {"status": "ok"})

    assert storage.load_json("selection_results/published/mock.json") == {"status": "ok"}
    assert storage.public_url("images/demo.png") == "https://assets.example.com/images/demo.png"


def test_selection_result_repository_persists_latest_and_versioned_docs(tmp_path, monkeypatch) -> None:
    storage_dir = tmp_path / "storage"
    user_storage_dir = tmp_path / "user_storage"
    monkeypatch.setattr(settings, "storage_dir", str(storage_dir))
    monkeypatch.setattr(settings, "user_storage_dir", str(user_storage_dir))
    monkeypatch.setattr(settings, "storage_backend", "local_fs")
    monkeypatch.setattr(settings, "selection_result_repository_backend", "local_fs")
    _clear_runtime_adapter_caches()

    repo = get_selection_result_repository()
    storage = get_runtime_storage()
    payload = {"scenario_id": "selres-1"}
    raw_payload = {"raw": True}
    paths = SelectionResultArtifactPaths(
        latest_path="selection_results/published/shampoo/v1/hash.json",
        version_path="selection_results/published_versions/shampoo/v1/hash/version-1.json",
        raw_path="selection_results/raw/shampoo/v1/hash/version-1.json",
    )

    repo.persist(paths=paths, published_doc=payload, raw_doc=raw_payload)

    assert repo.load(rel_path=paths.latest_path) == payload
    assert storage.load_json(paths.version_path) == payload
    assert storage.load_json(paths.raw_path or "") == raw_payload


def test_runtime_task_queue_executes_stream_and_upload_tasks(monkeypatch) -> None:
    monkeypatch.setattr(settings, "queue_backend", "local")
    monkeypatch.setattr(settings, "upload_ingest_max_concurrency", 1)
    monkeypatch.setattr(settings, "compare_job_max_concurrency", 1)
    _clear_runtime_adapter_caches()

    runtime_queue = get_runtime_task_queue()
    stream_done = threading.Event()
    upload_done = threading.Event()
    compare_done = threading.Event()
    workbench_done = threading.Event()

    runtime_queue.start_stream_task(lambda: stream_done.set(), task_name="runtime-stream-test")
    runtime_queue.submit_upload_job(lambda: upload_done.set(), task_name="runtime-upload-test")
    runtime_queue.submit_compare_job(lambda: compare_done.set(), task_name="runtime-compare-test")
    runtime_queue.submit_product_workbench_job(
        lambda: workbench_done.set(),
        task_name="runtime-product-workbench-test",
    )

    assert stream_done.wait(2)
    assert upload_done.wait(2)
    assert compare_done.wait(2)
    assert workbench_done.wait(2)


def test_runtime_profile_reports_active_backends(monkeypatch) -> None:
    monkeypatch.setattr(settings, "deploy_profile", "split_runtime")
    monkeypatch.setattr(settings, "runtime_role", "api")
    monkeypatch.setattr(settings, "storage_backend", "local_fs")
    monkeypatch.setattr(settings, "selection_result_repository_backend", "postgres_payload")
    monkeypatch.setattr(settings, "queue_backend", "local")
    monkeypatch.setattr(settings, "lock_backend", "local")
    monkeypatch.setattr(settings, "cache_backend", "none")
    monkeypatch.setattr(settings, "compare_job_max_concurrency", 1)
    monkeypatch.setattr(settings, "api_public_origin", "https://api.example.com")
    monkeypatch.setattr(settings, "api_internal_origin", "http://api:8000")
    monkeypatch.setattr(settings, "asset_public_origin", "https://assets.example.com")
    _clear_runtime_adapter_caches()

    profile = describe_runtime_profile()

    assert profile["deploy_profile"] == "split_runtime"
    assert profile["runtime_role"] == "api"
    assert profile["backends"] == {
        "database": "sqlite",
        "storage": "local_fs",
        "selection_results": "postgres_payload",
        "queue": "local_thread",
        "lock": "local",
        "cache": "none",
    }
    assert profile["database_contract"]["active_is_sqlite"] is True
    assert profile["database_contract"]["pool"]["enabled"] is False
    assert profile["selection_result_payload_model"] == {
        "table": "mobile_selection_result_index",
        "online_payload_column": "published_payload_json",
        "fixed_contract_column": "fixed_contract_json",
        "artifact_manifest_column": "artifact_manifest_json",
        "payload_backend_column": "payload_backend",
    }
    assert profile["selection_result_contract"]["online_truth"] == "postgres_payload"
    assert profile["selection_result_contract"]["artifact_copy_only"] is True
    assert profile["selection_result_contract"]["online_read_from_artifact"] is False
    assert profile["queue_contract"]["supports"]["mobile_compare"] == "submit_compare_job"
    assert profile["queue_contract"]["mobile_compare_max_workers"] == 1
    assert profile["queue_contract"]["supports"]["product_workbench"] == "submit_product_workbench_job"
    assert profile["queue_contract"]["product_workbench_max_workers"] == 1
    assert profile["lock_contract"]["backend"] == "local"
    assert profile["cache_contract"]["backend"] == "none"
    assert profile["topology"]["compare_dispatch_mode"] == "worker_poller"
    assert profile["topology"]["product_workbench_dispatch_mode"] == "worker_poller"
    assert profile["origins"]["asset_public_origin"] == "https://assets.example.com"
    rollout = profile["rollout_contract"]
    assert rollout["phase"] == "runtime-phase-6"
    assert rollout["fixed_order"] == ["worker", "db", "api", "web"]
    assert rollout["fixed_order_csv"] == "worker->db->api->web"
    assert rollout["current_step"] == "worker"
    assert rollout["target_step"] == "web"
    assert rollout["transition"]["non_parallel_cutover_required"] is True
    assert rollout["transition"]["forward_only"] is True
    assert rollout["transition"]["next_allowed_step"] == "db"
    assert rollout["rollback"] == {
        "enabled": True,
        "order": ["web", "api", "db", "worker"],
        "single_layer_only": True,
    }
    assert rollout["consistency"]["enforced"] is True
    assert rollout["consistency"]["redis_truth"] == "lock_cache_only"
    assert rollout["consistency"]["job_execution_truth"] == "worker"
    assert rollout["runtime"] == {"deploy_profile": "split_runtime", "runtime_role": "api"}


@pytest.mark.parametrize(
    ("deploy_profile", "storage_backend"),
    [
        ("single_node", "local_fs"),
        ("split_runtime", "object_storage_contract"),
        ("multi_node", "object_storage_contract"),
    ],
)
def test_runtime_profile_selection_result_contract_is_self_consistent_across_profiles(
    monkeypatch,
    deploy_profile: str,
    storage_backend: str,
) -> None:
    monkeypatch.setattr(settings, "deploy_profile", deploy_profile)
    monkeypatch.setattr(settings, "runtime_role", "api")
    monkeypatch.setattr(settings, "storage_backend", storage_backend)
    monkeypatch.setattr(settings, "selection_result_repository_backend", "postgres_payload")
    monkeypatch.setattr(settings, "queue_backend", "local")
    monkeypatch.setattr(settings, "lock_backend", "local")
    monkeypatch.setattr(settings, "cache_backend", "none")
    monkeypatch.setattr(settings, "api_public_origin", "https://api.example.com")
    monkeypatch.setattr(settings, "api_internal_origin", "http://api:8000")
    monkeypatch.setattr(settings, "asset_public_origin", "https://assets.example.com")
    monkeypatch.setattr(settings, "asset_object_key_prefix", "mobile-v2")
    monkeypatch.setattr(settings, "asset_signed_url_enforced", deploy_profile != "single_node")
    _clear_runtime_adapter_caches()

    profile = describe_runtime_profile()

    assert profile["deploy_profile"] == deploy_profile
    assert profile["backends"]["storage"] == storage_backend
    assert profile["backends"]["selection_results"] == "postgres_payload"
    assert profile["backends"]["cache"] == "none"
    assert profile["selection_result_contract"]["online_truth"] == "postgres_payload"
    assert profile["selection_result_contract"]["artifact_copy_only"] is True
    assert profile["selection_result_contract"]["online_read_from_artifact"] is False
    assert profile["selection_result_contract"]["artifact_storage_backend"] == storage_backend
    assert profile["storage_contract"]["backend"] == storage_backend


def test_upload_dispatch_mode_switches_with_runtime_profile(monkeypatch) -> None:
    monkeypatch.setattr(settings, "runtime_role", "api")
    monkeypatch.setattr(settings, "deploy_profile", "single_node")
    assert should_inline_dispatch_upload_job() is True
    assert should_inline_dispatch_product_workbench_job() is True

    monkeypatch.setattr(settings, "deploy_profile", "split_runtime")
    assert should_inline_dispatch_upload_job() is False
    assert should_inline_dispatch_product_workbench_job() is False

    monkeypatch.setattr(settings, "runtime_role", "worker")
    assert should_inline_dispatch_upload_job() is False
    assert should_inline_dispatch_product_workbench_job() is False


def test_upload_submit_skips_inline_dispatch_when_split_runtime(monkeypatch) -> None:
    monkeypatch.setattr(settings, "runtime_role", "api")
    monkeypatch.setattr(settings, "deploy_profile", "split_runtime")

    class _UnexpectedQueue:
        def submit_upload_job(self, *_args, **_kwargs):  # pragma: no cover - should never be reached
            raise AssertionError("inline queue dispatch should be skipped in split_runtime api role")

    monkeypatch.setattr(ingest_routes, "get_runtime_task_queue", lambda: _UnexpectedQueue())

    ingest_routes._submit_upload_ingest_job(bind=None, job_id="job-test", resume=False)


def test_product_workbench_submit_skips_inline_dispatch_when_split_runtime(monkeypatch) -> None:
    monkeypatch.setattr(settings, "runtime_role", "api")
    monkeypatch.setattr(settings, "deploy_profile", "split_runtime")

    class _UnexpectedQueue:
        def submit_product_workbench_job(self, *_args, **_kwargs):  # pragma: no cover - should never be reached
            raise AssertionError("inline queue dispatch should be skipped in split_runtime api role")

    monkeypatch.setattr(products_routes, "get_runtime_task_queue", lambda: _UnexpectedQueue())

    products_routes._submit_product_workbench_job(bind=None, job_id="job-test")


def test_runtime_profile_exposes_worker_topology(monkeypatch) -> None:
    monkeypatch.setattr(settings, "runtime_role", "worker")
    monkeypatch.setattr(settings, "deploy_profile", "split_runtime")
    monkeypatch.setattr(settings, "storage_backend", "local_fs")
    monkeypatch.setattr(settings, "selection_result_repository_backend", "postgres_payload")
    monkeypatch.setattr(settings, "queue_backend", "local")
    monkeypatch.setattr(settings, "lock_backend", "local")
    monkeypatch.setattr(settings, "cache_backend", "none")
    monkeypatch.setattr(settings, "compare_job_max_concurrency", 1)
    _clear_runtime_adapter_caches()

    profile = describe_runtime_profile()

    assert profile["topology"]["api_routes_enabled"] is False
    assert profile["topology"]["worker_runtime_expected"] is True
    assert profile["topology"]["upload_ingest_dispatch_mode"] == "worker_poller"
    assert profile["topology"]["compare_dispatch_mode"] == "worker_poller"
    assert profile["topology"]["product_workbench_dispatch_mode"] == "worker_poller"


@pytest.mark.parametrize("deploy_profile", ["split_runtime", "multi_node"])
def test_worker_dark_start_profile_disables_api_routes_and_keeps_worker_poller(
    monkeypatch: pytest.MonkeyPatch,
    deploy_profile: str,
) -> None:
    monkeypatch.setattr(settings, "runtime_role", "worker")
    monkeypatch.setattr(settings, "deploy_profile", deploy_profile)
    monkeypatch.setattr(settings, "storage_backend", "object_storage_contract")
    monkeypatch.setattr(settings, "selection_result_repository_backend", "postgres_payload")
    monkeypatch.setattr(settings, "queue_backend", "local")
    monkeypatch.setattr(settings, "lock_backend", "local")
    monkeypatch.setattr(settings, "cache_backend", "none")
    monkeypatch.setattr(settings, "asset_public_origin", "https://assets.example.com")
    _clear_runtime_adapter_caches()

    profile = describe_runtime_profile()
    topology = profile["topology"]
    worker_state = topology["worker_state"]

    assert profile["deploy_profile"] == deploy_profile
    assert profile["runtime_role"] == "worker"
    assert topology["api_routes_enabled"] is False
    assert topology["worker_runtime_expected"] is True
    assert topology["upload_ingest_dispatch_mode"] == "worker_poller"
    assert topology["compare_dispatch_mode"] == "worker_poller"
    assert topology["product_workbench_dispatch_mode"] == "worker_poller"
    assert worker_state["enabled"] is True
    assert worker_state["running"] is False
    assert worker_state["poll_interval_seconds"] > 0
    assert worker_state["capabilities"] == ["upload_ingest", "mobile_compare", "product_workbench"]


def test_lock_backend_redis_contract_downgrades_to_local_when_enabled(monkeypatch) -> None:
    monkeypatch.setattr(settings, "lock_backend", "redis_contract")
    monkeypatch.setattr(settings, "redis_url", "")
    monkeypatch.setattr(settings, "lock_downgrade_to_local_on_error", True)
    _clear_runtime_adapter_caches()

    lock = get_runtime_lock_backend()
    contract = lock.contract()

    assert lock.backend_name == "local"
    assert contract["downgraded_from"] == "redis_contract"
    assert contract["downgrade_reason"]


def test_lock_backend_redis_contract_raises_without_downgrade(monkeypatch) -> None:
    monkeypatch.setattr(settings, "lock_backend", "redis_contract")
    monkeypatch.setattr(settings, "redis_url", "")
    monkeypatch.setattr(settings, "lock_downgrade_to_local_on_error", False)
    _clear_runtime_adapter_caches()

    with pytest.raises(RuntimeError, match="REDIS_URL is empty"):
        get_runtime_lock_backend()


def test_cache_backend_redis_contract_downgrades_to_none_when_enabled(monkeypatch) -> None:
    monkeypatch.setattr(settings, "cache_backend", "redis_contract")
    monkeypatch.setattr(settings, "redis_url", "")
    monkeypatch.setattr(settings, "cache_downgrade_to_none_on_error", True)
    _clear_runtime_adapter_caches()

    cache = get_runtime_cache_backend()
    contract = cache.contract()

    assert cache.backend_name == "none"
    assert contract["downgraded_from"] == "redis_contract"
    assert contract["downgrade_reason"]


def test_cache_backend_redis_contract_raises_without_downgrade(monkeypatch) -> None:
    monkeypatch.setattr(settings, "cache_backend", "redis_contract")
    monkeypatch.setattr(settings, "redis_url", "")
    monkeypatch.setattr(settings, "cache_downgrade_to_none_on_error", False)
    _clear_runtime_adapter_caches()

    with pytest.raises(RuntimeError, match="REDIS_URL is empty"):
        get_runtime_cache_backend()


def test_runtime_profile_surfaces_database_pool_and_downgrade_config(monkeypatch) -> None:
    monkeypatch.setattr(settings, "deploy_profile", "single_node")
    monkeypatch.setattr(settings, "runtime_role", "api")
    monkeypatch.setattr(settings, "storage_backend", "local_fs")
    monkeypatch.setattr(settings, "selection_result_repository_backend", "postgres_payload")
    monkeypatch.setattr(settings, "queue_backend", "local")
    monkeypatch.setattr(settings, "lock_backend", "local")
    monkeypatch.setattr(settings, "cache_backend", "none")
    monkeypatch.setattr(settings, "db_pool_size", 12)
    monkeypatch.setattr(settings, "db_max_overflow", 6)
    monkeypatch.setattr(settings, "db_pool_timeout_seconds", 45)
    monkeypatch.setattr(settings, "db_pool_recycle_seconds", 2400)
    monkeypatch.setattr(settings, "db_pool_pre_ping", False)
    monkeypatch.setattr(settings, "db_downgrade_to_sqlite_on_error", False)
    monkeypatch.setattr(settings, "db_downgrade_sqlite_url", "sqlite:////tmp/runtime-phase-19.db")
    _clear_runtime_adapter_caches()

    profile = describe_runtime_profile()
    pool = profile["database_contract"]["pool"]
    downgrade = profile["database_contract"]["downgrade"]

    assert pool["pool_size"] == 12
    assert pool["max_overflow"] == 6
    assert pool["pool_timeout_seconds"] == 45
    assert pool["pool_recycle_seconds"] == 2400
    assert pool["pool_pre_ping"] is False
    assert downgrade["enabled"] is False
    assert downgrade["target_driver"] == "sqlite"


def test_runtime_profile_rollout_contract_exposes_rollback_and_consistency_switches(monkeypatch) -> None:
    monkeypatch.setattr(settings, "deploy_profile", "multi_node")
    monkeypatch.setattr(settings, "runtime_role", "api")
    monkeypatch.setattr(settings, "storage_backend", "object_storage_contract")
    monkeypatch.setattr(settings, "selection_result_repository_backend", "postgres_payload")
    monkeypatch.setattr(settings, "queue_backend", "local")
    monkeypatch.setattr(settings, "lock_backend", "local")
    monkeypatch.setattr(settings, "cache_backend", "none")
    monkeypatch.setattr(settings, "rollout_step", "api")
    monkeypatch.setattr(settings, "rollout_target_step", "db")
    monkeypatch.setattr(settings, "rollout_rollback_enabled", False)
    monkeypatch.setattr(settings, "rollout_consistency_enforced", False)
    _clear_runtime_adapter_caches()

    profile = describe_runtime_profile()
    rollout = profile["rollout_contract"]

    assert rollout["current_step"] == "api"
    assert rollout["target_step"] == "db"
    assert rollout["transition"]["forward_only"] is False
    assert rollout["transition"]["next_allowed_step"] == "web"
    assert rollout["rollback"]["enabled"] is False
    assert rollout["consistency"]["enforced"] is False
    assert rollout["consistency"]["job_execution_truth"] == "worker"
    assert rollout["runtime"] == {"deploy_profile": "multi_node", "runtime_role": "api"}


def test_postgres_payload_repository_disallows_online_artifact_read(tmp_path, monkeypatch) -> None:
    storage_dir = tmp_path / "storage"
    user_storage_dir = tmp_path / "user_storage"
    monkeypatch.setattr(settings, "storage_dir", str(storage_dir))
    monkeypatch.setattr(settings, "user_storage_dir", str(user_storage_dir))
    monkeypatch.setattr(settings, "storage_backend", "local_fs")
    monkeypatch.setattr(settings, "selection_result_repository_backend", "postgres_payload")
    _clear_runtime_adapter_caches()

    repo = get_selection_result_repository()
    assert repo.backend_name == "postgres_payload"

    try:
        repo.load(rel_path="selection_results/published/shampoo/v1/hash.json")
    except RuntimeError as exc:
        assert "must come from PostgreSQL payload" in str(exc)
    else:  # pragma: no cover - explicit safety net
        raise AssertionError("postgres_payload repository should not allow online artifact read fallback")


def test_object_storage_contract_public_url_uses_object_key(monkeypatch) -> None:
    monkeypatch.setattr(settings, "storage_backend", "object_storage_contract")
    monkeypatch.setattr(settings, "asset_public_origin", "https://assets.example.com")
    monkeypatch.setattr(settings, "asset_object_key_prefix", "mobile-v2")
    monkeypatch.setattr(settings, "asset_signed_url_enforced", False)
    _clear_runtime_adapter_caches()

    storage = get_runtime_storage()
    url = storage.public_url("images/demo.png")

    assert storage.backend_name == "object_storage_contract"
    assert url == "https://assets.example.com/mobile-v2/images/demo.png"
    assert storage.object_key("images/demo.png") == "mobile-v2/images/demo.png"


def test_object_storage_contract_signed_url_for_private_assets(monkeypatch) -> None:
    monkeypatch.setattr(settings, "storage_backend", "object_storage_contract")
    monkeypatch.setattr(settings, "asset_public_origin", "https://assets.example.com")
    monkeypatch.setattr(settings, "asset_object_key_prefix", "mobile-v2")
    monkeypatch.setattr(settings, "asset_signing_secret", "unit-test-secret")
    monkeypatch.setattr(settings, "asset_signed_url_ttl_seconds", 300)
    monkeypatch.setattr(settings, "asset_signed_url_enforced", True)
    _clear_runtime_adapter_caches()

    storage = get_runtime_storage()
    signed = storage.public_url("user-images/webp/uploads/device/demo.webp")

    assert signed is not None
    assert signed.startswith("https://assets.example.com/mobile-v2/user-images/webp/uploads/device/demo.webp?")
    assert "expires=" in signed
    assert "sig=" in signed
    assert "access=signed" in signed
