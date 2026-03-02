import os
import time
from pathlib import Path

import pytest

from app.routes import ingest as ingest_routes


def _install_fake_ingest_pipeline(monkeypatch: pytest.MonkeyPatch) -> None:
    def fake_stage1(_image_rel: str, trace_id: str, event_callback=None):
        if event_callback:
            event_callback({"type": "step", "stage": "stage1_vision", "message": "mock"})
        return {
            "vision_text": "【品牌】Dove\n【产品名】Deep Moisture Body Wash\n【品类】bodywash",
            "model": "doubao-stage1-mini",
            "artifact": f"doubao_runs/{trace_id}/stage1_vision.json",
        }

    def fake_stage2(_vision_text: str, trace_id: str, event_callback=None):
        if event_callback:
            event_callback({"type": "step", "stage": "stage2_struct", "message": "mock"})
        return {
            "doc": {
                "product": {
                    "category": "bodywash",
                    "brand": "Dove",
                    "name": "Deep Moisture Body Wash",
                },
                "summary": {
                    "one_sentence": "深层保湿沐浴露",
                    "pros": ["温和清洁"],
                    "cons": [],
                    "who_for": ["普通肤质"],
                    "who_not_for": [],
                },
                "ingredients": [
                    {
                        "name": "甘氨酸",
                        "type": "活性成分",
                        "functions": ["清洁"],
                        "risk": "low",
                        "notes": "",
                    }
                ],
                "evidence": {"doubao_raw": ""},
            },
            "struct_text": "{\"ok\":true}",
            "model": "doubao-stage2-mini",
            "artifact": f"doubao_runs/{trace_id}/stage2_struct.json",
        }

    monkeypatch.setattr(ingest_routes, "_analyze_with_doubao_stage1", fake_stage1)
    monkeypatch.setattr(ingest_routes, "_analyze_with_doubao_stage2", fake_stage2)


def _ingest_one(client, image_name: str = "sample.jpg") -> str:
    stage1 = client.post(
        "/api/upload/stage1",
        files={"image": (image_name, b"fake-jpeg-bytes", "image/jpeg")},
    )
    assert stage1.status_code == 200
    trace_id = stage1.json()["trace_id"]
    stage2 = client.post("/api/upload/stage2", data={"trace_id": trace_id})
    assert stage2.status_code == 200
    return trace_id


def test_cleanup_orphan_storage_removes_orphan_images_and_runs(test_client, monkeypatch: pytest.MonkeyPatch):
    client, storage_dir = test_client
    _install_fake_ingest_pipeline(monkeypatch)
    keep_id = _ingest_one(client, "keep.jpg")

    orphan_image = Path(storage_dir) / "images" / "orphan-x.jpg"
    orphan_image.write_bytes(b"orphan")
    orphan_run_dir = Path(storage_dir) / "doubao_runs" / "orphan-run"
    orphan_run_dir.mkdir(parents=True, exist_ok=True)
    (orphan_run_dir / "sample.json").write_text('{"ok":true}', encoding="utf-8")

    old_ts = time.time() - 3600
    os.utime(orphan_image, (old_ts, old_ts))
    os.utime(orphan_run_dir, (old_ts, old_ts))

    dry = client.post(
        "/api/maintenance/storage/orphans/cleanup",
        json={"dry_run": True, "min_age_minutes": 5, "max_delete": 500},
    )
    assert dry.status_code == 200
    dry_body = dry.json()
    assert dry_body["images"]["orphan_images"] >= 1
    assert dry_body["runs"]["orphan_runs"] >= 1

    real = client.post(
        "/api/maintenance/storage/orphans/cleanup",
        json={"dry_run": False, "min_age_minutes": 5, "max_delete": 500},
    )
    assert real.status_code == 200
    body = real.json()
    assert body["images"]["deleted_images"] >= 1
    assert body["runs"]["deleted_runs"] >= 1
    assert not orphan_image.exists()
    assert not orphan_run_dir.exists()

    keep_image_candidates = list((Path(storage_dir) / "images").glob(f"{keep_id}.*"))
    assert len(keep_image_candidates) >= 1
    assert (Path(storage_dir) / "doubao_runs" / keep_id).exists()


def test_delete_product_removes_image_variants_and_runs(test_client, monkeypatch: pytest.MonkeyPatch):
    client, storage_dir = test_client
    _install_fake_ingest_pipeline(monkeypatch)
    product_id = _ingest_one(client, "delete.jpg")

    extra_variant = Path(storage_dir) / "images" / f"{product_id}.webp"
    extra_variant.write_bytes(b"variant")
    assert extra_variant.exists()
    assert (Path(storage_dir) / "doubao_runs" / product_id).exists()

    resp = client.delete(f"/api/products/{product_id}")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "deleted"

    assert list((Path(storage_dir) / "images").glob(f"{product_id}.*")) == []
    assert not (Path(storage_dir) / "doubao_runs" / product_id).exists()
