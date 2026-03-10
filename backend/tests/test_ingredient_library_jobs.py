import json
import time
from pathlib import Path
from datetime import datetime, timedelta, timezone

import pytest

from app.routes import products as products_routes
from app.schemas import IngredientLibraryBuildResponse


def _wait_for_job_status(client, job_id: str, expected: set[str], timeout_sec: float = 3.0) -> dict:
    deadline = time.time() + timeout_sec
    last = None
    while time.time() < deadline:
        resp = client.get(f"/api/products/ingredients/library/jobs/{job_id}")
        assert resp.status_code == 200
        last = resp.json()
        if last.get("status") in expected:
            return last
        time.sleep(0.03)
    raise AssertionError(f"job {job_id} did not reach {expected}, last={last}")


def test_ingredient_library_background_job_done(test_client, monkeypatch: pytest.MonkeyPatch):
    client, _ = test_client

    def fake_build(payload, db, event_callback=None, stop_checker=None):
        if event_callback:
            event_callback(
                {
                    "step": "ingredient_build_start",
                    "scanned_products": 2,
                    "unique_ingredients": 1,
                    "text": "start",
                }
            )
            event_callback(
                {
                    "step": "ingredient_start",
                    "index": 1,
                    "total": 1,
                    "ingredient_id": "ing-1",
                    "text": "running",
                }
            )
        return IngredientLibraryBuildResponse(
            status="ok",
            scanned_products=2,
            unique_ingredients=1,
            backfilled_from_storage=0,
            submitted_to_model=1,
            created=1,
            updated=0,
            skipped=0,
            failed=0,
            items=[],
            failures=[],
        )

    monkeypatch.setattr(products_routes, "_build_ingredient_library_impl", fake_build)

    created = client.post("/api/products/ingredients/library/jobs", json={})
    assert created.status_code == 200
    job_id = created.json()["job_id"]

    done = _wait_for_job_status(client, job_id=job_id, expected={"done"})
    assert done["percent"] == 100
    assert done["counters"]["created"] == 1
    assert done["counters"]["submitted_to_model"] == 1
    assert done["result"]["status"] == "ok"


def test_ingredient_library_background_job_can_cancel(test_client, monkeypatch: pytest.MonkeyPatch):
    client, _ = test_client

    def fake_build(payload, db, event_callback=None, stop_checker=None):
        if event_callback:
            event_callback(
                {
                    "step": "ingredient_build_start",
                    "scanned_products": 20,
                    "unique_ingredients": 20,
                    "text": "start",
                }
            )
        for i in range(1, 30):
            if stop_checker and stop_checker():
                raise products_routes.IngredientLibraryBuildCancelledError("cancelled by test")
            if event_callback:
                event_callback(
                    {
                        "step": "ingredient_start",
                        "index": i,
                        "total": 30,
                        "ingredient_id": f"ing-{i}",
                        "text": f"running-{i}",
                    }
                )
            time.sleep(0.01)
        return IngredientLibraryBuildResponse(
            status="ok",
            scanned_products=20,
            unique_ingredients=20,
            backfilled_from_storage=0,
            submitted_to_model=20,
            created=20,
            updated=0,
            skipped=0,
            failed=0,
            items=[],
            failures=[],
        )

    monkeypatch.setattr(products_routes, "_build_ingredient_library_impl", fake_build)

    created = client.post("/api/products/ingredients/library/jobs", json={})
    assert created.status_code == 200
    job_id = created.json()["job_id"]

    # wait until running, then cancel
    _wait_for_job_status(client, job_id=job_id, expected={"running", "cancelling"})
    cancelled = client.post(f"/api/products/ingredients/library/jobs/{job_id}/cancel")
    assert cancelled.status_code == 200
    assert cancelled.json()["job"]["cancel_requested"] is True

    final = _wait_for_job_status(client, job_id=job_id, expected={"cancelled"})
    assert final["status"] == "cancelled"
    assert final["cancel_requested"] is True


def test_ingredient_library_background_job_failed_can_retry_with_same_packages(test_client, monkeypatch: pytest.MonkeyPatch):
    client, _ = test_client
    calls: list[list[str]] = []

    def fake_build(payload, db, event_callback=None, stop_checker=None):
        _ = db
        _ = stop_checker
        calls.append(list(payload.normalization_packages or []))
        if event_callback:
            event_callback(
                {
                    "step": "ingredient_build_start",
                    "scanned_products": 3,
                    "unique_ingredients": 2,
                    "text": "start",
                }
            )
        if len(calls) == 1:
            raise RuntimeError("synthetic ingredient retry failure")
        return IngredientLibraryBuildResponse(
            status="ok",
            scanned_products=3,
            unique_ingredients=2,
            backfilled_from_storage=0,
            submitted_to_model=2,
            created=2,
            updated=0,
            skipped=0,
            failed=0,
            items=[],
            failures=[],
        )

    monkeypatch.setattr(products_routes, "_build_ingredient_library_impl", fake_build)

    created = client.post("/api/products/ingredients/library/jobs", json={"normalization_packages": ["unicode_nfkc", "whitespace_fold"]})
    assert created.status_code == 200
    job_id = created.json()["job_id"]
    assert created.json()["normalization_packages"] == ["unicode_nfkc", "whitespace_fold"]

    failed = _wait_for_job_status(client, job_id=job_id, expected={"failed"})
    assert failed["status"] == "failed"
    assert failed["normalization_packages"] == ["unicode_nfkc", "whitespace_fold"]

    retried = client.post(f"/api/products/ingredients/library/jobs/{job_id}/retry")
    assert retried.status_code == 200
    assert retried.json()["status"] in {"queued", "running"}
    assert retried.json()["normalization_packages"] == ["unicode_nfkc", "whitespace_fold"]

    done = _wait_for_job_status(client, job_id=job_id, expected={"done"})
    assert done["status"] == "done"
    assert done["normalization_packages"] == ["unicode_nfkc", "whitespace_fold"]
    assert calls == [
        ["unicode_nfkc", "whitespace_fold"],
        ["unicode_nfkc", "whitespace_fold"],
    ]


def test_ingredient_library_orphan_running_job_is_failed_with_context(test_client, monkeypatch: pytest.MonkeyPatch):
    client, _ = test_client

    def fake_run_job(*, job_id, payload, db):
        rec = db.get(products_routes.IngredientLibraryBuildJob, job_id)
        assert rec is not None
        now = products_routes.now_iso()
        rec.status = "running"
        rec.stage = "ingredient_start"
        rec.stage_label = products_routes._ingredient_build_stage_label("ingredient_start")
        rec.message = "fake running"
        rec.percent = 36
        rec.started_at = now
        rec.updated_at = now
        db.add(rec)
        db.commit()

    monkeypatch.setattr(products_routes, "_run_ingredient_library_build_job", fake_run_job)

    created = client.post("/api/products/ingredients/library/jobs", json={})
    assert created.status_code == 200
    job_id = created.json()["job_id"]
    _wait_for_job_status(client, job_id=job_id, expected={"running"})

    monkeypatch.setattr(
        products_routes,
        "INGREDIENT_BUILD_JOB_PROCESS_STARTED_AT",
        datetime.now(timezone.utc) + timedelta(hours=1),
    )

    rec = client.get(f"/api/products/ingredients/library/jobs/{job_id}")
    assert rec.status_code == 200
    body = rec.json()
    assert body["status"] == "failed"
    assert body["error"] is not None
    assert body["error"]["code"] == "ingredient_build_orphaned"
    assert "reason=service_restarted" in str(body["message"])
    assert "stage=ingredient_start" in str(body["message"])


def test_ingredient_library_orphan_cancelling_job_is_auto_cancelled(test_client, monkeypatch: pytest.MonkeyPatch):
    client, _ = test_client

    def fake_run_job(*, job_id, payload, db):
        rec = db.get(products_routes.IngredientLibraryBuildJob, job_id)
        assert rec is not None
        now = products_routes.now_iso()
        rec.status = "running"
        rec.stage = "ingredient_start"
        rec.stage_label = products_routes._ingredient_build_stage_label("ingredient_start")
        rec.message = "fake running"
        rec.percent = 64
        rec.started_at = now
        rec.updated_at = now
        db.add(rec)
        db.commit()

    monkeypatch.setattr(products_routes, "_run_ingredient_library_build_job", fake_run_job)

    created = client.post("/api/products/ingredients/library/jobs", json={})
    assert created.status_code == 200
    job_id = created.json()["job_id"]
    _wait_for_job_status(client, job_id=job_id, expected={"running"})

    cancelled = client.post(f"/api/products/ingredients/library/jobs/{job_id}/cancel")
    assert cancelled.status_code == 200
    assert cancelled.json()["job"]["status"] == "cancelling"

    monkeypatch.setattr(
        products_routes,
        "INGREDIENT_BUILD_JOB_PROCESS_STARTED_AT",
        datetime.now(timezone.utc) + timedelta(hours=1),
    )

    listed = client.get("/api/products/ingredients/library/jobs")
    assert listed.status_code == 200
    row = next(item for item in listed.json() if item["job_id"] == job_id)
    assert row["status"] == "cancelled"
    assert "reason=service_restarted" in str(row["message"])


def test_ingredient_library_batch_delete_can_remove_profile_without_index(test_client):
    client, storage_dir = test_client
    ingredient_id = "ing-test-delete-1"
    rel_path = Path("ingredients/bodywash") / f"{ingredient_id}.json"
    abs_path = Path(storage_dir) / rel_path
    abs_path.parent.mkdir(parents=True, exist_ok=True)
    abs_path.write_text(
        json.dumps(
            {
                "id": ingredient_id,
                "category": "bodywash",
                "ingredient_name": "甘油",
                "source_trace_ids": [],
                "source_count": 0,
                "profile": {"summary": ""},
            },
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    assert abs_path.exists()

    resp = client.post(
        "/api/products/ingredients/library/batch-delete",
        json={"ingredient_ids": [ingredient_id], "remove_doubao_artifacts": False},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert ingredient_id in body["deleted_ids"]
    assert not body["failed_items"]
    assert not abs_path.exists()
