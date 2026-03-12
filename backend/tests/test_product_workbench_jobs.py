import pytest

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
