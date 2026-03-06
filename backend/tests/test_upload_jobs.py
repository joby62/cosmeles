import json
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
from fastapi import HTTPException

from app.routes import ingest as ingest_routes
from backend.tests.support_images import VALID_TEST_IMAGE_BYTES


def _wait_upload_job_status(client, job_id: str, expected: set[str], timeout_sec: float = 4.0) -> dict:
    deadline = time.time() + timeout_sec
    last = None
    while time.time() < deadline:
        resp = client.get(f"/api/upload/jobs/{job_id}")
        assert resp.status_code == 200
        last = resp.json()
        if last.get("status") in expected:
            return last
        time.sleep(0.05)
    raise AssertionError(f"upload job {job_id} did not reach {expected}, last={last}")


def _install_fake_convert(monkeypatch: pytest.MonkeyPatch, storage_dir: Path) -> None:
    def fake_convert(temp_rel_path: str, *, image_id: str, subdir: str | None = None) -> str:
        rel_suffix = f"/{subdir.strip('/')}" if subdir else ""
        webp_rel = f"images/webp{rel_suffix}/{image_id}.webp"
        jpg_rel = f"images/jpg{rel_suffix}/{image_id}.jpg"
        temp_abs = storage_dir / temp_rel_path
        payload = temp_abs.read_bytes() if temp_abs.exists() else b"img"
        temp_abs.unlink(missing_ok=True)

        webp_abs = storage_dir / webp_rel
        jpg_abs = storage_dir / jpg_rel
        webp_abs.parent.mkdir(parents=True, exist_ok=True)
        jpg_abs.parent.mkdir(parents=True, exist_ok=True)
        webp_abs.write_bytes(payload)
        jpg_abs.write_bytes(payload)
        return webp_rel

    monkeypatch.setattr(ingest_routes, "convert_temp_upload_to_storage_image", fake_convert)


def test_upload_job_can_run_to_done(test_client, monkeypatch: pytest.MonkeyPatch):
    client, storage_dir = test_client
    _install_fake_convert(monkeypatch, storage_dir)

    def fake_stage1(image_rel: str, trace_id: str, image_paths=None, model_tier=None, event_callback=None):
        _ = image_paths
        _ = model_tier
        if event_callback:
            event_callback({"type": "step", "stage": "stage1_vision", "message": "stage1"})
            event_callback({"type": "delta", "stage": "stage1_vision", "delta": "【品牌】测试品牌"})
        return {
            "vision_text": "【品牌】测试品牌\n【产品名】测试产品\n【成分表原文】水、甘油",
            "model": "doubao-stage1-mini",
            "artifact": f"doubao_runs/{trace_id}/stage1_vision.json",
        }

    def fake_stage2(*, trace_id: str, category: str | None, brand: str | None, name: str | None, model_tier: str | None, db, event_callback=None):
        _ = category
        _ = brand
        _ = name
        _ = model_tier
        _ = db
        if event_callback:
            event_callback({"type": "step", "stage": "stage2_struct", "message": "stage2"})
            event_callback({"type": "delta", "stage": "stage2_struct", "delta": "{\"ok\":true}"})
        return {
            "id": trace_id,
            "status": "ok",
            "mode": "doubao_two_stage",
            "category": "shampoo",
            "image_path": f"images/webp/tmp/{trace_id}.webp",
            "json_path": f"products/{trace_id}.json",
            "doubao": {
                "models": {"vision": "doubao-stage1-mini", "struct": "doubao-stage2-mini"},
                "struct_text": "{\"ok\":true}",
                "vision_text": "【品牌】测试品牌",
                "artifacts": {
                    "vision": f"doubao_runs/{trace_id}/stage1_vision.json",
                    "struct": f"doubao_runs/{trace_id}/stage2_struct.json",
                    "context": f"doubao_runs/{trace_id}/stage1_context.json",
                },
            },
        }

    monkeypatch.setattr(ingest_routes, "_invoke_stage1_analyzer", fake_stage1)
    monkeypatch.setattr(ingest_routes, "_finalize_stage2", fake_stage2)

    created = client.post(
        "/api/upload/jobs",
        files={"image": ("sample.tiff", VALID_TEST_IMAGE_BYTES, "image/tiff")},
    )
    assert created.status_code == 200
    job_id = created.json()["job_id"]

    done = _wait_upload_job_status(client, job_id=job_id, expected={"done"})
    assert done["status"] == "done"
    assert done["result"]["id"] == job_id

    tmp_dir = Path(storage_dir) / "tmp_uploads"
    leftovers = list(tmp_dir.glob(f"{job_id}*"))
    assert leftovers == []


def test_upload_job_can_run_with_initial_two_images(test_client, monkeypatch: pytest.MonkeyPatch):
    client, storage_dir = test_client
    _install_fake_convert(monkeypatch, storage_dir)
    captured: dict[str, object] = {}

    def fake_stage1(image_rel: str, trace_id: str, image_paths=None, model_tier=None, event_callback=None):
        _ = model_tier
        captured["trace_id"] = trace_id
        captured["image_rel"] = image_rel
        captured["image_paths"] = image_paths
        if event_callback:
            event_callback({"type": "step", "stage": "stage1_vision", "message": "stage1"})
        return {
            "vision_text": "【品牌】测试品牌\n【产品名】测试产品\n【成分表原文】水、甘油",
            "model": "doubao-stage1-mini",
            "artifact": f"doubao_runs/{trace_id}/stage1_vision.json",
        }

    def fake_stage2(*, trace_id: str, category: str | None, brand: str | None, name: str | None, model_tier: str | None, db, event_callback=None):
        _ = category
        _ = brand
        _ = name
        _ = model_tier
        _ = db
        _ = event_callback
        return {
            "id": trace_id,
            "status": "ok",
            "mode": "doubao_two_stage",
            "category": "shampoo",
            "image_path": f"images/webp/tmp/{trace_id}.webp",
            "json_path": f"products/{trace_id}.json",
            "doubao": {
                "models": {"vision": "doubao-stage1-mini", "struct": "doubao-stage2-mini"},
                "struct_text": "{\"ok\":true}",
                "vision_text": "【品牌】测试品牌",
                "artifacts": {
                    "vision": f"doubao_runs/{trace_id}/stage1_vision.json",
                    "struct": f"doubao_runs/{trace_id}/stage2_struct.json",
                    "context": f"doubao_runs/{trace_id}/stage1_context.json",
                },
            },
        }

    monkeypatch.setattr(ingest_routes, "_invoke_stage1_analyzer", fake_stage1)
    monkeypatch.setattr(ingest_routes, "_finalize_stage2", fake_stage2)

    created = client.post(
        "/api/upload/jobs",
        files=[
            ("image", ("sample-front.jpg", VALID_TEST_IMAGE_BYTES, "image/jpeg")),
            ("supplement_image", ("sample-back.jpg", VALID_TEST_IMAGE_BYTES, "image/jpeg")),
        ],
    )
    assert created.status_code == 200
    job_id = created.json()["job_id"]

    done = _wait_upload_job_status(client, job_id=job_id, expected={"done"})
    assert done["status"] == "done"
    assert done["result"]["id"] == job_id
    image_paths = done.get("image_paths") or []
    assert len(image_paths) == 2

    stage1_paths = captured.get("image_paths")
    assert isinstance(stage1_paths, list)
    assert len(stage1_paths) == 2
    assert all(str(item).startswith("images/webp/tmp/") for item in stage1_paths)

    tmp_dir = Path(storage_dir) / "tmp_uploads"
    leftovers = list(tmp_dir.glob(f"{job_id}*"))
    assert leftovers == []


def test_upload_job_waiting_more_can_resume_with_manual_brand(test_client, monkeypatch: pytest.MonkeyPatch):
    client, storage_dir = test_client
    _install_fake_convert(monkeypatch, storage_dir)

    def fake_stage1(image_rel: str, trace_id: str, image_paths=None, model_tier=None, event_callback=None):
        _ = image_rel
        _ = image_paths
        _ = model_tier
        _ = event_callback
        return {
            "vision_text": "【品牌】未识别\n【产品名】测试产品\n【成分表原文】水、甘油",
            "model": "doubao-stage1-mini",
            "artifact": f"doubao_runs/{trace_id}/stage1_vision.json",
        }

    def fake_stage2(*, trace_id: str, category: str | None, brand: str | None, name: str | None, model_tier: str | None, db, event_callback=None):
        _ = category
        _ = name
        _ = model_tier
        _ = db
        _ = event_callback
        if not brand:
            raise HTTPException(status_code=422, detail="brand is required in this test")
        return {
            "id": trace_id,
            "status": "ok",
            "mode": "doubao_two_stage",
            "category": "shampoo",
            "image_path": f"images/webp/tmp/{trace_id}.webp",
            "json_path": f"products/{trace_id}.json",
            "doubao": {
                "models": {"vision": "doubao-stage1-mini", "struct": "doubao-stage2-mini"},
                "struct_text": "{\"ok\":true}",
                "vision_text": "【品牌】测试品牌",
                "artifacts": {
                    "vision": f"doubao_runs/{trace_id}/stage1_vision.json",
                    "struct": f"doubao_runs/{trace_id}/stage2_struct.json",
                    "context": f"doubao_runs/{trace_id}/stage1_context.json",
                },
            },
        }

    monkeypatch.setattr(ingest_routes, "_invoke_stage1_analyzer", fake_stage1)
    monkeypatch.setattr(ingest_routes, "_finalize_stage2", fake_stage2)

    created = client.post(
        "/api/upload/jobs",
        files={"image": ("sample.png", VALID_TEST_IMAGE_BYTES, "image/png")},
    )
    assert created.status_code == 200
    job_id = created.json()["job_id"]

    waiting = _wait_upload_job_status(client, job_id=job_id, expected={"waiting_more"})
    assert "brand" in (waiting.get("missing_fields") or [])

    resumed = client.post(
        f"/api/upload/jobs/{job_id}/resume",
        data={"brand": "手动补录品牌"},
    )
    assert resumed.status_code == 200

    done = _wait_upload_job_status(client, job_id=job_id, expected={"done"})
    assert done["status"] == "done"
    assert done["brand_override"] == "手动补录品牌"


def test_upload_job_can_cancel_running(test_client, monkeypatch: pytest.MonkeyPatch):
    client, storage_dir = test_client
    _install_fake_convert(monkeypatch, storage_dir)

    def fake_stage1(image_rel: str, trace_id: str, image_paths=None, model_tier=None, event_callback=None):
        _ = image_rel
        _ = trace_id
        _ = image_paths
        _ = model_tier
        if event_callback:
            event_callback({"type": "step", "stage": "stage1_vision", "message": "stage1"})
        time.sleep(0.2)
        return {
            "vision_text": "【品牌】测试品牌\n【产品名】测试产品\n【成分表原文】水、甘油",
            "model": "doubao-stage1-mini",
            "artifact": f"doubao_runs/{trace_id}/stage1_vision.json",
        }

    def fake_stage2(*, trace_id: str, category: str | None, brand: str | None, name: str | None, model_tier: str | None, db, event_callback=None):
        _ = trace_id
        _ = category
        _ = brand
        _ = name
        _ = model_tier
        _ = db
        _ = event_callback
        time.sleep(0.2)
        return {
            "id": trace_id,
            "status": "ok",
            "category": "shampoo",
            "doubao": {"models": {"vision": "v", "struct": "s"}},
        }

    monkeypatch.setattr(ingest_routes, "_invoke_stage1_analyzer", fake_stage1)
    monkeypatch.setattr(ingest_routes, "_finalize_stage2", fake_stage2)

    created = client.post(
        "/api/upload/jobs",
        files={"image": ("sample.png", VALID_TEST_IMAGE_BYTES, "image/png")},
    )
    assert created.status_code == 200
    job_id = created.json()["job_id"]

    cancelled = client.post(f"/api/upload/jobs/{job_id}/cancel")
    assert cancelled.status_code == 200

    final = _wait_upload_job_status(client, job_id=job_id, expected={"cancelled"}, timeout_sec=6.0)
    assert final["status"] == "cancelled"
    assert final["cancel_requested"] is True


def test_upload_job_orphan_running_will_be_marked_failed(test_client, monkeypatch: pytest.MonkeyPatch):
    client, _ = test_client

    def fake_run(*, job_id: str, db, resume: bool):
        _ = resume
        rec = db.get(ingest_routes.UploadIngestJob, job_id)
        assert rec is not None
        rec.status = "running"
        rec.stage = "stage1"
        rec.stage_label = ingest_routes._upload_ingest_job_stage_label("stage1")
        rec.message = "fake running"
        rec.percent = 37
        rec.updated_at = ingest_routes.now_iso()
        db.add(rec)
        db.commit()

    monkeypatch.setattr(ingest_routes, "_run_upload_ingest_job", fake_run)

    created = client.post(
        "/api/upload/jobs",
        files={"image": ("sample.png", VALID_TEST_IMAGE_BYTES, "image/png")},
    )
    assert created.status_code == 200
    job_id = created.json()["job_id"]
    _wait_upload_job_status(client, job_id=job_id, expected={"running"})

    monkeypatch.setattr(
        ingest_routes,
        "UPLOAD_INGEST_JOB_PROCESS_STARTED_AT",
        datetime.now(timezone.utc) + timedelta(hours=1),
    )

    rec = client.get(f"/api/upload/jobs/{job_id}")
    assert rec.status_code == 200
    body = rec.json()
    assert body["status"] == "failed"
    assert body["error"] is not None
    assert body["error"]["code"] == "upload_job_orphaned"
