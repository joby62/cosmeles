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
