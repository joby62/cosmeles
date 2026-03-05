import json
from pathlib import Path

import pytest

from app.routes import ingest as ingest_routes
from backend.tests.support_images import VALID_TEST_IMAGE_BYTES, install_fake_save_image


def _read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def test_stage1_saves_context_artifact(test_client, monkeypatch: pytest.MonkeyPatch):
    client, storage_dir = test_client
    install_fake_save_image(monkeypatch, ingest_routes)

    def fake_stage1(image_rel: str, trace_id: str):
        assert image_rel.startswith("images/")
        return {
            "vision_text": "【品牌】测试品牌\n【产品名】测试产品\n【成分表原文】水、甘油",
            "model": "doubao-stage1-mini",
            "artifact": f"doubao_runs/{trace_id}/stage1_vision.json",
        }

    monkeypatch.setattr(ingest_routes, "_analyze_with_doubao_stage1", fake_stage1)

    resp = client.post(
        "/api/upload/stage1",
        files={"image": ("sample.png", VALID_TEST_IMAGE_BYTES, "image/png")},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert body["next"] == "/api/upload/stage2"
    trace_id = body["trace_id"]

    context_path = storage_dir / "doubao_runs" / trace_id / "stage1_context.json"
    assert context_path.exists()

    context = _read_json(context_path)
    assert context["trace_id"] == trace_id
    assert context["vision_model"] == "doubao-stage1-mini"
    assert "测试品牌" in context["vision_text"]

def test_stage1_keeps_heic_extension_in_storage(test_client, monkeypatch: pytest.MonkeyPatch):
    client, storage_dir = test_client
    install_fake_save_image(monkeypatch, ingest_routes)

    def fake_stage1(image_rel: str, trace_id: str):
        assert image_rel.endswith(".webp")
        return {
            "vision_text": "【品牌】测试品牌\n【产品名】测试产品\n【成分表原文】水、甘油",
            "model": "doubao-stage1-mini",
            "artifact": f"doubao_runs/{trace_id}/stage1_vision.json",
        }

    monkeypatch.setattr(ingest_routes, "_analyze_with_doubao_stage1", fake_stage1)

    resp = client.post(
        "/api/upload/stage1",
        files={"image": ("IMG_4396.HEIC", VALID_TEST_IMAGE_BYTES, "image/heic")},
    )
    assert resp.status_code == 200
    trace_id = resp.json()["trace_id"]
    webp_path = storage_dir / "images" / "webp" / f"{trace_id}.webp"
    jpg_path = storage_dir / "images" / "jpg" / f"{trace_id}.jpg"
    assert webp_path.exists()
    assert jpg_path.exists()


def test_stage1_converts_png_to_jpg_in_storage(test_client, monkeypatch: pytest.MonkeyPatch):
    client, storage_dir = test_client
    install_fake_save_image(monkeypatch, ingest_routes)

    def fake_stage1(image_rel: str, trace_id: str):
        assert image_rel.endswith(".webp")
        return {
            "vision_text": "【品牌】测试品牌\n【产品名】测试产品\n【成分表原文】水、甘油",
            "model": "doubao-stage1-mini",
            "artifact": f"doubao_runs/{trace_id}/stage1_vision.json",
        }

    monkeypatch.setattr(ingest_routes, "_analyze_with_doubao_stage1", fake_stage1)

    resp = client.post(
        "/api/upload/stage1",
        files={"image": ("sample.png", VALID_TEST_IMAGE_BYTES, "image/png")},
    )
    assert resp.status_code == 200
    trace_id = resp.json()["trace_id"]
    webp_path = storage_dir / "images" / "webp" / f"{trace_id}.webp"
    jpg_path = storage_dir / "images" / "jpg" / f"{trace_id}.jpg"
    assert webp_path.exists()
    assert jpg_path.exists()


def test_stage1_rejects_unsupported_extension_with_unknown_content_type(test_client):
    client, _ = test_client
    resp = client.post(
        "/api/upload/stage1",
        files={"image": ("sample.tiff", b"fake-tiff-bytes", "image/tiff")},
    )
    assert resp.status_code == 400
    assert "Unsupported image extension" in resp.text


def test_stage2_creates_product_and_exposes_in_products_api(test_client, monkeypatch: pytest.MonkeyPatch):
    client, _ = test_client
    install_fake_save_image(monkeypatch, ingest_routes)

    def fake_stage1(image_rel: str, trace_id: str):
        return {
            "vision_text": "【品牌】测试品牌\n【产品名】测试产品\n【品类】洗发水\n【成分表原文】水、甘油",
            "model": "doubao-stage1-mini",
            "artifact": f"doubao_runs/{trace_id}/stage1_vision.json",
        }

    def fake_stage2(_vision_text: str, trace_id: str):
        return {
            "doc": {
                "product": {"category": "shampoo", "brand": "测试品牌", "name": "测试产品"},
                "summary": {
                    "one_sentence": "测试一句话",
                    "pros": ["温和清洁"],
                    "cons": [],
                    "who_for": ["油性头皮"],
                    "who_not_for": [],
                },
                "ingredients": [
                    {
                        "name": "椰油酰胺丙基甜菜碱",
                        "rank": 1,
                        "abundance_level": "major",
                        "order_confidence": 95,
                        "type": "表活",
                        "functions": "清洁",
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

    stage1 = client.post(
        "/api/upload/stage1",
        files={"image": ("sample.png", VALID_TEST_IMAGE_BYTES, "image/png")},
    )
    assert stage1.status_code == 200
    trace_id = stage1.json()["trace_id"]

    stage2 = client.post("/api/upload/stage2", data={"trace_id": trace_id})
    assert stage2.status_code == 200
    stage2_body = stage2.json()
    assert stage2_body["id"] == trace_id
    assert stage2_body["status"] == "ok"
    assert stage2_body["category"] == "shampoo"
    assert stage2_body["doubao"]["models"]["struct"] == "doubao-stage2-mini"

    products = client.get("/api/products")
    assert products.status_code == 200
    product_items = products.json()
    assert len(product_items) == 1
    assert product_items[0]["id"] == trace_id
    assert product_items[0]["category"] == "shampoo"
    assert product_items[0]["name"] == "测试产品"

    detail = client.get(f"/api/products/{trace_id}")
    assert detail.status_code == 200
    detail_body = detail.json()
    assert detail_body["product"]["category"] == "shampoo"
    assert detail_body["evidence"]["doubao_pipeline_mode"] == "two-stage"
    assert detail_body["evidence"]["doubao_models"]["vision"] == "doubao-stage1-mini"
    assert detail_body["evidence"]["doubao_models"]["struct"] == "doubao-stage2-mini"


def test_stage2_returns_404_when_context_missing(test_client):
    client, _ = test_client
    resp = client.post("/api/upload/stage2", data={"trace_id": "not-exists"})
    assert resp.status_code == 404


def test_stage1_requires_supplement_then_reruns_with_two_images(test_client, monkeypatch: pytest.MonkeyPatch):
    client, _ = test_client
    install_fake_save_image(monkeypatch, ingest_routes)
    calls: list[dict[str, object]] = []

    def fake_stage1(image_rel: str, trace_id: str, image_paths=None):
        paths = image_paths if isinstance(image_paths, list) else [image_rel]
        calls.append({"trace_id": trace_id, "paths": list(paths)})
        if len(paths) == 1:
            return {
                "vision_text": "【品牌】未识别\n【产品名】未识别\n【成分表原文】水、甘油",
                "model": "doubao-stage1-mini",
                "artifact": f"doubao_runs/{trace_id}/stage1_vision.json",
            }
        return {
            "vision_text": "【品牌】测试品牌\n【产品名】测试产品\n【成分表原文】水、甘油",
            "model": "doubao-stage1-mini",
            "artifact": f"doubao_runs/{trace_id}/stage1_vision.json",
        }

    def fake_stage2(_vision_text: str, trace_id: str):
        return {
            "doc": {
                "product": {"category": "shampoo", "brand": "测试品牌", "name": "测试产品"},
                "summary": {
                    "one_sentence": "测试一句话",
                    "pros": ["温和清洁"],
                    "cons": [],
                    "who_for": ["油性头皮"],
                    "who_not_for": [],
                },
                "ingredients": [
                    {
                        "name": "甘油",
                        "rank": 1,
                        "abundance_level": "major",
                        "order_confidence": 92,
                        "type": "保湿",
                        "functions": ["保湿"],
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

    stage1 = client.post(
        "/api/upload/stage1",
        files={"image": ("sample-a.png", VALID_TEST_IMAGE_BYTES, "image/png")},
    )
    assert stage1.status_code == 200
    stage1_body = stage1.json()
    assert stage1_body["status"] == "needs_more_images"
    assert stage1_body["next"] == "/api/upload/stage1/supplement"
    trace_id = stage1_body["trace_id"]

    stage2_before = client.post("/api/upload/stage2", data={"trace_id": trace_id})
    assert stage2_before.status_code == 422
    assert "supplement image" in stage2_before.text

    supplement = client.post(
        "/api/upload/stage1/supplement",
        data={"trace_id": trace_id},
        files={"image": ("sample-b.png", VALID_TEST_IMAGE_BYTES, "image/png")},
    )
    assert supplement.status_code == 200
    supplement_body = supplement.json()
    assert supplement_body["status"] == "ok"
    assert supplement_body["next"] == "/api/upload/stage2"
    assert supplement_body["trace_id"] == trace_id
    assert len(supplement_body.get("image_paths") or []) == 2

    stage2_after = client.post("/api/upload/stage2", data={"trace_id": trace_id})
    assert stage2_after.status_code == 200
    assert stage2_after.json()["status"] == "ok"

    assert len(calls) >= 2
    assert len(calls[0]["paths"]) == 1
    assert len(calls[1]["paths"]) == 2


def test_stage1_and_stage2_stream_endpoints(test_client, monkeypatch: pytest.MonkeyPatch):
    client, _ = test_client
    install_fake_save_image(monkeypatch, ingest_routes)

    def fake_stage1(image_rel: str, trace_id: str, event_callback=None):
        if event_callback:
            event_callback({"type": "step", "stage": "stage1_vision", "message": "start"})
            event_callback({"type": "delta", "stage": "stage1_vision", "delta": "视觉文本"})
        return {
            "vision_text": "【品牌】测试品牌\n【产品名】测试产品\n【品类】洗发水\n【成分表原文】水、甘油",
            "model": "doubao-stage1-mini",
            "artifact": f"doubao_runs/{trace_id}/stage1_vision.json",
        }

    def fake_stage2(_vision_text: str, trace_id: str, event_callback=None):
        if event_callback:
            event_callback({"type": "step", "stage": "stage2_struct", "message": "start"})
            event_callback({"type": "delta", "stage": "stage2_struct", "delta": "{\"ok\":true}"})
        return {
            "doc": {
                "product": {"category": "shampoo", "brand": "测试品牌", "name": "测试产品"},
                "summary": {
                    "one_sentence": "测试一句话",
                    "pros": ["温和清洁"],
                    "cons": [],
                    "who_for": ["油性头皮"],
                    "who_not_for": [],
                },
                "ingredients": [
                    {
                        "name": "甘油",
                        "rank": 1,
                        "abundance_level": "major",
                        "order_confidence": 90,
                        "type": "保湿剂",
                        "functions": ["保湿"],
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

    s1 = client.post(
        "/api/upload/stage1/stream",
        files={"image": ("sample.png", VALID_TEST_IMAGE_BYTES, "image/png")},
    )
    assert s1.status_code == 200
    assert "event: progress" in s1.text
    assert "event: result" in s1.text
    assert "trace_id" in s1.text

    # 从流文本里取 trace_id（避免引入 SSE 解析器依赖）
    marker = '"trace_id": "'
    idx = s1.text.find(marker)
    assert idx > 0
    trace_id = s1.text[idx + len(marker) :].split('"', 1)[0]

    s2 = client.post("/api/upload/stage2/stream", data={"trace_id": trace_id})
    assert s2.status_code == 200
    assert "event: progress" in s2.text
    assert "event: result" in s2.text
    assert '"status": "ok"' in s2.text
