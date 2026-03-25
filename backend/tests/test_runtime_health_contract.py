from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI
from fastapi.testclient import TestClient
import pytest

import app.main as backend_main
from app.platform.cache_backend import get_runtime_cache_backend
from app.platform.lock_backend import get_runtime_lock_backend
from app.platform.selection_result_repository import get_selection_result_repository
from app.platform.storage_backend import get_runtime_storage
from app.platform.task_queue import get_runtime_task_queue
from app.settings import settings


PROJECT_ROOT = Path(__file__).resolve().parents[2]


def _clear_runtime_adapter_caches() -> None:
    get_runtime_storage.cache_clear()
    get_selection_result_repository.cache_clear()
    get_runtime_task_queue.cache_clear()
    get_runtime_lock_backend.cache_clear()
    get_runtime_cache_backend.cache_clear()


def _build_health_probe_app() -> FastAPI:
    app = FastAPI()
    app.add_api_route("/healthz", backend_main.healthz, methods=["GET"])
    app.add_api_route("/readyz", backend_main.readyz, methods=["GET"])
    return app


def _parse_env_file(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        key, sep, value = line.partition("=")
        if not sep:
            continue
        values[key.strip()] = value.strip()
    return values


class _EngineConnectionOK:
    def __enter__(self) -> "_EngineConnectionOK":
        return self

    def __exit__(self, exc_type, exc, tb) -> bool:
        return False

    def execute(self, *_args, **_kwargs) -> int:
        return 1


class _EngineOK:
    def connect(self) -> _EngineConnectionOK:
        return _EngineConnectionOK()


class _EngineDown:
    def connect(self):
        raise RuntimeError("db connect failed")


class _StorageDown:
    def ensure_dirs(self) -> None:
        raise RuntimeError("storage init failed")


def _raise_runtime_contract_error() -> dict[str, str]:
    raise RuntimeError("runtime profile unavailable")


def test_healthz_and_readyz_report_self_consistent_runtime_profile(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "deploy_profile", "single_node")
    monkeypatch.setattr(settings, "runtime_role", "api")
    monkeypatch.setattr(settings, "storage_backend", "local_fs")
    monkeypatch.setattr(settings, "selection_result_repository_backend", "postgres_payload")
    monkeypatch.setattr(settings, "queue_backend", "local")
    monkeypatch.setattr(settings, "lock_backend", "local")
    monkeypatch.setattr(settings, "cache_backend", "none")
    monkeypatch.setattr(settings, "compare_job_max_concurrency", 1)
    monkeypatch.setattr(settings, "api_public_origin", "")
    monkeypatch.setattr(settings, "api_internal_origin", "http://backend:8000")
    monkeypatch.setattr(settings, "asset_public_origin", "")
    monkeypatch.setattr(settings, "storage_dir", str(tmp_path / "storage"))
    monkeypatch.setattr(settings, "user_storage_dir", str(tmp_path / "user_storage"))
    monkeypatch.setattr(backend_main, "engine", _EngineOK())
    _clear_runtime_adapter_caches()

    with TestClient(_build_health_probe_app()) as client:
        health = client.get("/healthz")
        ready = client.get("/readyz")

    assert health.status_code == 200
    assert ready.status_code == 200

    health_payload = health.json()
    ready_payload = ready.json()
    assert health_payload["status"] == "ok"
    assert ready_payload["status"] == "ready"

    health_runtime = health_payload["runtime"]
    ready_runtime = ready_payload["runtime"]
    assert health_runtime == ready_runtime
    assert ready_runtime["deploy_profile"] == "single_node"
    assert ready_runtime["runtime_role"] == "api"
    assert ready_runtime["backends"] == {
        "database": "sqlite",
        "storage": "local_fs",
        "selection_results": "postgres_payload",
        "queue": "local_thread",
        "lock": "local",
        "cache": "none",
    }
    assert ready_runtime["database_contract"]["active_is_sqlite"] is True
    assert ready_runtime["database_contract"]["pool"]["enabled"] is False
    assert ready_runtime["database_contract"]["downgrade"]["enabled"] is True
    assert ready_runtime["selection_result_payload_model"] == {
        "table": "mobile_selection_result_index",
        "online_payload_column": "published_payload_json",
        "fixed_contract_column": "fixed_contract_json",
        "artifact_manifest_column": "artifact_manifest_json",
        "payload_backend_column": "payload_backend",
    }
    assert ready_runtime["selection_result_contract"]["online_truth"] == "postgres_payload"
    assert ready_runtime["selection_result_contract"]["artifact_copy_only"] is True
    assert ready_runtime["selection_result_contract"]["online_read_from_artifact"] is False
    assert ready_runtime["queue_contract"]["supports"]["mobile_compare"] == "submit_compare_job"
    assert ready_runtime["queue_contract"]["mobile_compare_max_workers"] == 1
    assert ready_runtime["queue_contract"]["supports"]["product_workbench"] == "submit_product_workbench_job"
    assert ready_runtime["queue_contract"]["product_workbench_max_workers"] == 1
    assert ready_runtime["lock_contract"]["backend"] == "local"
    assert ready_runtime["cache_contract"]["backend"] == "none"
    assert ready_runtime["topology"]["compare_dispatch_mode"] == "inline_local_queue"
    assert ready_runtime["topology"]["product_workbench_dispatch_mode"] == "inline_local_queue"
    assert ready_runtime["rollout_contract"]["phase"] == "runtime-phase-6"
    assert ready_runtime["rollout_contract"]["fixed_order_csv"] == "worker->db->api->web"
    assert ready_runtime["rollout_contract"]["rollback"]["enabled"] is True
    assert ready_runtime["rollout_contract"]["consistency"]["enforced"] is True
    assert ready_runtime["origins"] == {
        "api_public_origin": None,
        "api_internal_origin": "http://backend:8000",
        "asset_public_origin": None,
    }


def test_readyz_returns_503_when_database_is_not_ready(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(backend_main, "engine", _EngineDown())
    _clear_runtime_adapter_caches()

    with TestClient(_build_health_probe_app()) as client:
        response = client.get("/readyz")

    assert response.status_code == 503
    assert "Database not ready" in response.json()["detail"]


def test_readyz_returns_503_when_storage_is_not_ready(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(backend_main, "engine", _EngineOK())
    monkeypatch.setattr(backend_main, "get_runtime_storage", lambda: _StorageDown())
    _clear_runtime_adapter_caches()

    with TestClient(_build_health_probe_app()) as client:
        response = client.get("/readyz")

    assert response.status_code == 503
    assert "Storage not ready" in response.json()["detail"]


def test_healthz_surfaces_runtime_contract_error_for_alertability(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(backend_main, "describe_runtime_profile", _raise_runtime_contract_error)

    with TestClient(_build_health_probe_app()) as client:
        response = client.get("/healthz")

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert payload["runtime"]["deploy_profile"] == str(settings.deploy_profile or "single_node").strip() or "single_node"
    assert payload["runtime"]["runtime_role"] == str(settings.runtime_role or "api").strip() or "api"
    assert "runtime profile unavailable" in payload["runtime"]["error"]


def test_readyz_fails_when_runtime_contract_cannot_be_built(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "storage_dir", str(tmp_path / "storage"))
    monkeypatch.setattr(settings, "user_storage_dir", str(tmp_path / "user_storage"))
    monkeypatch.setattr(backend_main, "engine", _EngineOK())
    monkeypatch.setattr(backend_main, "describe_runtime_profile", _raise_runtime_contract_error)
    _clear_runtime_adapter_caches()

    with TestClient(_build_health_probe_app(), raise_server_exceptions=False) as client:
        response = client.get("/readyz")

    assert response.status_code == 500


@pytest.mark.parametrize(
    ("profile", "env_file_name"),
    [
        ("single_node", ".env.single-node.example"),
        ("split_runtime", ".env.split-runtime.example"),
        ("multi_node", ".env.multi-node.example"),
    ],
)
def test_env_skeleton_runtime_profile_contract_is_self_consistent(profile: str, env_file_name: str) -> None:
    env_values = _parse_env_file(PROJECT_ROOT / env_file_name)

    required_keys = {
        "DEPLOY_PROFILE",
        "RUNTIME_ROLE",
        "STORAGE_BACKEND",
        "SELECTION_RESULT_REPOSITORY_BACKEND",
        "QUEUE_BACKEND",
        "LOCK_BACKEND",
        "CACHE_BACKEND",
        "REDIS_URL",
        "LOCK_DOWNGRADE_TO_LOCAL_ON_ERROR",
        "CACHE_DOWNGRADE_TO_NONE_ON_ERROR",
        "COMPARE_JOB_MAX_CONCURRENCY",
        "DATABASE_URL",
        "DB_POOL_SIZE",
        "DB_MAX_OVERFLOW",
        "DB_POOL_TIMEOUT_SECONDS",
        "DB_POOL_RECYCLE_SECONDS",
        "DB_POOL_PRE_PING",
        "DB_DOWNGRADE_TO_SQLITE_ON_ERROR",
        "DB_DOWNGRADE_SQLITE_URL",
        "ROLLOUT_STEP",
        "ROLLOUT_TARGET_STEP",
        "ROLLOUT_ROLLBACK_ENABLED",
        "ROLLOUT_CONSISTENCY_ENFORCED",
        "API_PUBLIC_ORIGIN",
        "API_INTERNAL_ORIGIN",
        "ASSET_PUBLIC_ORIGIN",
        "ASSET_OBJECT_KEY_PREFIX",
        "ASSET_SIGNED_URL_TTL_SECONDS",
        "ASSET_SIGNED_URL_ENFORCED",
        "ASSET_SIGNING_SECRET",
        "COOKIE_DOMAIN",
        "NEXT_PUBLIC_RUNTIME_PROFILE",
        "NEXT_PUBLIC_API_BASE",
        "NEXT_PUBLIC_ASSET_BASE",
        "INTERNAL_API_BASE",
        "NEXT_COMPRESS",
    }
    assert required_keys.issubset(set(env_values.keys()))

    assert env_values["DEPLOY_PROFILE"] == profile
    assert env_values["NEXT_PUBLIC_RUNTIME_PROFILE"] == profile
    assert env_values["RUNTIME_ROLE"] == "api"
    expected_storage_backend = "local_fs" if profile == "single_node" else "object_storage_contract"
    assert env_values["STORAGE_BACKEND"] == expected_storage_backend
    if profile in {"split_runtime", "multi_node"}:
        assert env_values["STORAGE_BACKEND"] != "local_fs"
    assert env_values["SELECTION_RESULT_REPOSITORY_BACKEND"] == "postgres_payload"
    assert env_values["QUEUE_BACKEND"] == "local"
    assert int(env_values["DB_POOL_SIZE"]) > 0
    assert int(env_values["DB_MAX_OVERFLOW"]) >= 0
    assert int(env_values["DB_POOL_TIMEOUT_SECONDS"]) > 0
    assert int(env_values["DB_POOL_RECYCLE_SECONDS"]) > 0
    assert env_values["DB_POOL_PRE_PING"] in {"true", "false"}
    assert int(env_values["COMPARE_JOB_MAX_CONCURRENCY"]) > 0
    assert env_values["INTERNAL_API_BASE"] == env_values["API_INTERNAL_ORIGIN"]
    assert env_values["NEXT_PUBLIC_API_BASE"] == env_values["API_PUBLIC_ORIGIN"]
    assert env_values["NEXT_PUBLIC_ASSET_BASE"] == env_values["ASSET_PUBLIC_ORIGIN"]
    assert env_values["ASSET_OBJECT_KEY_PREFIX"].strip() == "mobile-v2"
    assert env_values["ROLLOUT_STEP"] == "worker"
    assert env_values["ROLLOUT_TARGET_STEP"] == "web"
    assert env_values["ROLLOUT_ROLLBACK_ENABLED"] == "true"
    assert env_values["ROLLOUT_CONSISTENCY_ENFORCED"] == "true"
    assert int(env_values["ASSET_SIGNED_URL_TTL_SECONDS"]) > 0
    assert env_values["ASSET_SIGNED_URL_ENFORCED"] in {"true", "false"}

    if profile == "single_node":
        assert env_values["LOCK_BACKEND"] == "local"
        assert env_values["CACHE_BACKEND"] == "none"
        assert env_values["REDIS_URL"] == ""
        assert env_values["LOCK_DOWNGRADE_TO_LOCAL_ON_ERROR"] == "true"
        assert env_values["CACHE_DOWNGRADE_TO_NONE_ON_ERROR"] == "true"
        assert env_values["DB_DOWNGRADE_TO_SQLITE_ON_ERROR"] == "true"
        assert env_values["DB_DOWNGRADE_SQLITE_URL"].startswith("sqlite:///")
        assert env_values["ASSET_SIGNED_URL_ENFORCED"] == "false"
        assert env_values["ASSET_SIGNING_SECRET"] == ""
    else:
        assert env_values["LOCK_BACKEND"] == "redis_contract"
        assert env_values["CACHE_BACKEND"] == "redis_contract"
        assert env_values["REDIS_URL"].startswith("redis://")
        assert env_values["LOCK_DOWNGRADE_TO_LOCAL_ON_ERROR"] == "false"
        assert env_values["CACHE_DOWNGRADE_TO_NONE_ON_ERROR"] == "false"
        assert env_values["DB_DOWNGRADE_TO_SQLITE_ON_ERROR"] == "false"
        assert env_values["DB_DOWNGRADE_SQLITE_URL"].startswith("sqlite:///")
        assert env_values["ASSET_SIGNED_URL_ENFORCED"] == "true"
        assert env_values["ASSET_SIGNING_SECRET"].strip() != ""
        assert env_values["ASSET_PUBLIC_ORIGIN"].startswith("https://")
        assert env_values["NEXT_PUBLIC_ASSET_BASE"].startswith("https://")

    expected_compress = "false" if profile == "single_node" else "true"
    assert env_values["NEXT_COMPRESS"] == expected_compress
