from datetime import datetime, timedelta, timezone

import pytest

from app.db.session import get_db
from app.routes import products as products_routes


def _install_noop_submit(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(products_routes, "_submit_product_workbench_job", lambda **_: None)

def test_route_mapping_workbench_job_create_list_cancel(test_client, monkeypatch: pytest.MonkeyPatch):
    client, _ = test_client
    _install_noop_submit(monkeypatch)

    created = client.post(
        "/api/products/route-mapping/jobs",
        json={"category": "shampoo", "force_regenerate": True},
    )
    assert created.status_code == 200
    job = created.json()
    assert job["job_type"] == "route_mapping_build"
    assert job["status"] == "queued"

    listed = client.get("/api/products/route-mapping/jobs")
    assert listed.status_code == 200
    assert any(item["job_id"] == job["job_id"] for item in listed.json())

    cancelled = client.post(f"/api/products/route-mapping/jobs/{job['job_id']}/cancel")
    assert cancelled.status_code == 200
    cancelled_job = cancelled.json()["job"]
    assert cancelled_job["status"] == "cancelled"
    assert cancelled_job["job_type"] == "route_mapping_build"


def test_dedup_workbench_job_cancel_and_retry(test_client, monkeypatch: pytest.MonkeyPatch):
    client, _ = test_client
    _install_noop_submit(monkeypatch)

    created = client.post(
        "/api/products/dedup/jobs",
        json={"category": "shampoo", "max_scan_products": 10, "min_confidence": 96},
    )
    assert created.status_code == 200
    job = created.json()
    assert job["job_type"] == "dedup_suggest"
    assert job["status"] == "queued"

    cancelled = client.post(f"/api/products/dedup/jobs/{job['job_id']}/cancel")
    assert cancelled.status_code == 200
    assert cancelled.json()["job"]["status"] == "cancelled"

    retried = client.post(f"/api/products/dedup/jobs/{job['job_id']}/retry")
    assert retried.status_code == 200
    retried_job = retried.json()
    assert retried_job["status"] == "queued"
    assert retried_job["job_type"] == "dedup_suggest"


def test_selection_result_workbench_job_create_cancel_and_retry(test_client, monkeypatch: pytest.MonkeyPatch):
    client, _ = test_client
    _install_noop_submit(monkeypatch)

    created = client.post(
        "/api/products/selection-results/jobs",
        json={"category": "shampoo", "force_regenerate": True},
    )
    assert created.status_code == 200
    job = created.json()
    assert job["job_type"] == "selection_result_build"
    assert job["status"] == "queued"

    listed = client.get("/api/products/selection-results/jobs")
    assert listed.status_code == 200
    assert any(item["job_id"] == job["job_id"] for item in listed.json())

    cancelled = client.post(f"/api/products/selection-results/jobs/{job['job_id']}/cancel")
    assert cancelled.status_code == 200
    assert cancelled.json()["job"]["status"] == "cancelled"

    retried = client.post(f"/api/products/selection-results/jobs/{job['job_id']}/retry")
    assert retried.status_code == 200
    retried_job = retried.json()
    assert retried_job["status"] == "queued"
    assert retried_job["job_type"] == "selection_result_build"


def test_selection_result_workbench_job_orphan_running_is_failed_and_can_retry(
    test_client,
    monkeypatch: pytest.MonkeyPatch,
):
    client, _ = test_client
    _install_noop_submit(monkeypatch)

    created = client.post(
        "/api/products/selection-results/jobs",
        json={"category": "shampoo", "force_regenerate": True},
    )
    assert created.status_code == 200
    job_id = created.json()["job_id"]
    db_gen = client.app.dependency_overrides[get_db]()
    db = next(db_gen)
    try:
        rec = db.get(products_routes.ProductWorkbenchJob, job_id)
        assert rec is not None
        rec.status = "running"
        rec.stage = "selection_result_build_model_run"
        rec.stage_label = products_routes._product_workbench_stage_label(
            job_type="selection_result_build",
            stage="selection_result_build_model_run",
        )
        rec.message = "fake running"
        rec.percent = 37
        rec.updated_at = products_routes.now_iso()
        if not str(rec.started_at or "").strip():
            rec.started_at = rec.updated_at
        db.add(rec)
        db.commit()
    finally:
        db_gen.close()

    monkeypatch.setattr(
        products_routes,
        "PRODUCT_WORKBENCH_JOB_PROCESS_STARTED_AT",
        datetime.now(timezone.utc) + timedelta(hours=1),
    )

    failed = client.get(f"/api/products/selection-results/jobs/{job_id}")
    assert failed.status_code == 200
    failed_body = failed.json()
    assert failed_body["status"] == "failed"
    assert failed_body["error"] is not None
    assert failed_body["error"]["code"] == "product_workbench_job_orphaned"

    retried = client.post(f"/api/products/selection-results/jobs/{job_id}/retry")
    assert retried.status_code == 200
    retry_body = retried.json()
    assert retry_body["status"] == "queued"
    assert retry_body["job_type"] == "selection_result_build"


def test_selection_result_workbench_job_orphan_cancelling_is_auto_cancelled(
    test_client,
    monkeypatch: pytest.MonkeyPatch,
):
    client, _ = test_client
    _install_noop_submit(monkeypatch)

    created = client.post(
        "/api/products/selection-results/jobs",
        json={"category": "shampoo", "force_regenerate": True},
    )
    assert created.status_code == 200
    job_id = created.json()["job_id"]
    db_gen = client.app.dependency_overrides[get_db]()
    db = next(db_gen)
    try:
        rec = db.get(products_routes.ProductWorkbenchJob, job_id)
        assert rec is not None
        rec.status = "running"
        rec.stage = "selection_result_build_model_run"
        rec.stage_label = products_routes._product_workbench_stage_label(
            job_type="selection_result_build",
            stage="selection_result_build_model_run",
        )
        rec.message = "fake running"
        rec.percent = 51
        rec.updated_at = products_routes.now_iso()
        if not str(rec.started_at or "").strip():
            rec.started_at = rec.updated_at
        db.add(rec)
        db.commit()
    finally:
        db_gen.close()

    cancelled = client.post(f"/api/products/selection-results/jobs/{job_id}/cancel")
    assert cancelled.status_code == 200
    assert cancelled.json()["job"]["status"] == "cancelling"

    monkeypatch.setattr(
        products_routes,
        "PRODUCT_WORKBENCH_JOB_PROCESS_STARTED_AT",
        datetime.now(timezone.utc) + timedelta(hours=1),
    )

    reconciled = client.get(f"/api/products/selection-results/jobs/{job_id}")
    assert reconciled.status_code == 200
    row = reconciled.json()
    assert row["status"] == "cancelled"
    assert row["error"] is None


def test_selection_result_workbench_job_orphan_queued_is_failed_and_retryable(
    test_client,
    monkeypatch: pytest.MonkeyPatch,
):
    client, _ = test_client
    _install_noop_submit(monkeypatch)

    created = client.post(
        "/api/products/selection-results/jobs",
        json={"category": "shampoo", "force_regenerate": True},
    )
    assert created.status_code == 200
    job_id = created.json()["job_id"]

    monkeypatch.setattr(
        products_routes,
        "PRODUCT_WORKBENCH_JOB_PROCESS_STARTED_AT",
        datetime.now(timezone.utc) + timedelta(hours=1),
    )

    failed = client.get(f"/api/products/selection-results/jobs/{job_id}")
    assert failed.status_code == 200
    failed_body = failed.json()
    assert failed_body["status"] == "failed"
    assert failed_body["error"] is not None
    assert failed_body["error"]["code"] == "product_workbench_job_orphaned"

    retried = client.post(f"/api/products/selection-results/jobs/{job_id}/retry")
    assert retried.status_code == 200
    retry_body = retried.json()
    assert retry_body["status"] == "queued"
    assert retry_body["job_type"] == "selection_result_build"


def test_product_analysis_workbench_job_create_cancel_and_retry(test_client, monkeypatch: pytest.MonkeyPatch):
    client, _ = test_client
    _install_noop_submit(monkeypatch)

    created = client.post(
        "/api/products/analysis/jobs",
        json={"category": "shampoo", "force_regenerate": True, "only_unanalyzed": True},
    )
    assert created.status_code == 200
    job = created.json()
    assert job["job_type"] == "product_analysis_build"
    assert job["status"] == "queued"

    listed = client.get("/api/products/analysis/jobs")
    assert listed.status_code == 200
    assert any(item["job_id"] == job["job_id"] for item in listed.json())

    cancelled = client.post(f"/api/products/analysis/jobs/{job['job_id']}/cancel")
    assert cancelled.status_code == 200
    assert cancelled.json()["job"]["status"] == "cancelled"

    retried = client.post(f"/api/products/analysis/jobs/{job['job_id']}/retry")
    assert retried.status_code == 200
    retried_job = retried.json()
    assert retried_job["status"] == "queued"
    assert retried_job["job_type"] == "product_analysis_build"


@pytest.mark.parametrize(
    ("path", "payload", "job_type"),
    [
      ("/api/products/batch-delete/jobs", {"ids": ["prod-1", "prod-2"], "remove_doubao_artifacts": True}, "product_batch_delete"),
      (
          "/api/products/ingredients/library/batch-delete/jobs",
          {"ingredient_ids": ["ing-1", "ing-2"], "remove_doubao_artifacts": True},
          "ingredient_batch_delete",
      ),
      (
          "/api/maintenance/storage/orphans/jobs",
          {"dry_run": True, "min_age_minutes": 30, "max_delete": 500},
          "orphan_storage_cleanup",
      ),
      (
          "/api/maintenance/mobile/product-refs/jobs",
          {"dry_run": True, "sample_limit": 8},
          "mobile_invalid_ref_cleanup",
      ),
    ],
)
def test_governance_cleanup_workbench_jobs_create_list_cancel_retry(
    test_client,
    monkeypatch: pytest.MonkeyPatch,
    path: str,
    payload: dict,
    job_type: str,
):
    client, _ = test_client
    _install_noop_submit(monkeypatch)

    created = client.post(path, json=payload)
    assert created.status_code == 200
    job = created.json()
    assert job["job_type"] == job_type
    assert job["status"] == "queued"

    listed = client.get(path)
    assert listed.status_code == 200
    assert any(item["job_id"] == job["job_id"] for item in listed.json())

    fetched = client.get(f"{path}/{job['job_id']}")
    assert fetched.status_code == 200
    assert fetched.json()["job_id"] == job["job_id"]

    cancelled = client.post(f"{path}/{job['job_id']}/cancel")
    assert cancelled.status_code == 200
    assert cancelled.json()["job"]["status"] == "cancelled"

    retried = client.post(f"{path}/{job['job_id']}/retry")
    assert retried.status_code == 200
    retried_job = retried.json()
    assert retried_job["status"] == "queued"
    assert retried_job["job_type"] == job_type


def test_product_workbench_live_text_merges_output_and_reasoning_blocks():
    state = None
    state = products_routes._update_product_workbench_live_text_state_json(
        state,
        updated_at="2026-03-12T14:00:00Z",
        step="product_analysis_model_delta",
        stage_label="模型输出",
        text="第一段",
        item_id="prod-1",
        item_name="shampoo",
        stream_kind="output_text",
    )
    state = products_routes._update_product_workbench_live_text_state_json(
        state,
        updated_at="2026-03-12T14:00:01Z",
        step="product_analysis_model_delta",
        stage_label="模型输出",
        text="结论。",
        item_id="prod-1",
        item_name="shampoo",
        stream_kind="output_text",
    )
    state = products_routes._update_product_workbench_live_text_state_json(
        state,
        updated_at="2026-03-12T14:00:02Z",
        step="product_analysis_model_delta",
        stage_label="思考摘要",
        text="先判断成分。",
        item_id="prod-1",
        item_name="shampoo",
        stream_kind="reasoning_summary",
    )
    state = products_routes._update_product_workbench_live_text_state_json(
        state,
        updated_at="2026-03-12T14:00:03Z",
        step="product_analysis_done",
        stage_label="单项完成",
        text="[1/1] 分析完成",
        item_id="prod-1",
        item_name="shampoo",
    )

    live_text = products_routes._product_workbench_live_text_from_json(state)

    assert live_text is not None
    assert "模型输出（response.output_text）" in live_text
    assert "思考摘要（response.reasoning_summary_text）" in live_text
    assert "shampoo / prod-1" in live_text
    assert "第一段结论。" in live_text
    assert "先判断成分。" in live_text
    assert "单项完成 | [1/1] 分析完成" in live_text
