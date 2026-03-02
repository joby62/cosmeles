import json
from pathlib import Path

import pytest

from app.routes import ingest as ingest_routes
from app.routes import products as products_routes


def _install_fake_ingest_pipeline(monkeypatch: pytest.MonkeyPatch, plans: list[dict]) -> None:
    by_trace: dict[str, dict] = {}

    def fake_stage1(_image_rel: str, trace_id: str, event_callback=None):
        if event_callback:
            event_callback({"type": "step", "stage": "stage1_vision", "message": "mock"})
        index = len(by_trace)
        if index >= len(plans):
            raise AssertionError("No more plans available for fake stage1.")
        plan = plans[index]
        by_trace[trace_id] = plan
        return {
            "vision_text": f"【品牌】{plan['brand']}\\n【产品名】{plan['name']}\\n【品类】{plan['category']}",
            "model": "doubao-stage1-mini",
            "artifact": f"doubao_runs/{trace_id}/stage1_vision.json",
        }

    def fake_stage2(_vision_text: str, trace_id: str, event_callback=None):
        if event_callback:
            event_callback({"type": "step", "stage": "stage2_struct", "message": "mock"})
        plan = by_trace[trace_id]
        return {
            "doc": {
                "product": {
                    "category": plan["category"],
                    "brand": plan["brand"],
                    "name": plan["name"],
                },
                "summary": {
                    "one_sentence": plan["one_sentence"],
                    "pros": ["温和清洁"],
                    "cons": [],
                    "who_for": ["普通肤质"],
                    "who_not_for": [],
                },
                "ingredients": [
                    {
                        "name": ingredient,
                        "type": "活性成分",
                        "functions": ["清洁"],
                        "risk": "low",
                        "notes": "",
                    }
                    for ingredient in plan["ingredients"]
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


def test_build_ingredient_library_splits_same_name_by_category(test_client, monkeypatch: pytest.MonkeyPatch):
    client, storage_dir = test_client
    plans = [
        {
            "category": "bodywash",
            "brand": "Dove",
            "name": "Body Wash A",
            "one_sentence": "A",
            "ingredients": ["甘油", "烟酰胺"],
        },
        {
            "category": "shampoo",
            "brand": "Dove",
            "name": "Shampoo B",
            "one_sentence": "B",
            "ingredients": ["甘油"],
        },
        {
            "category": "bodywash",
            "brand": "Dove",
            "name": "Body Wash C",
            "one_sentence": "C",
            "ingredients": ["甘油"],
        },
    ]
    _install_fake_ingest_pipeline(monkeypatch, plans)

    _ingest_one(client, "a.jpg")
    _ingest_one(client, "b.jpg")
    _ingest_one(client, "c.jpg")

    def fake_run_capability_now(capability: str, input_payload: dict, trace_id: str | None = None, event_callback=None):
        assert capability == "doubao.ingredient_category_profile"
        assert input_payload.get("category") in {"bodywash", "shampoo"}
        if event_callback:
            event_callback({"type": "delta", "stage": "ingredient_category_profile", "delta": "mock-delta"})
        return {
            "ingredient_name": input_payload["ingredient"],
            "category": input_payload["category"],
            "summary": f"{input_payload['ingredient']} in {input_payload['category']}",
            "benefits": ["保湿"],
            "risks": [],
            "usage_tips": ["按需使用"],
            "suitable_for": ["普通人群"],
            "avoid_for": [],
            "confidence": 96,
            "reason": "mock",
            "analysis_text": "{}",
            "model": "doubao-seed-2-0-pro-260215",
        }

    monkeypatch.setattr(products_routes, "run_capability_now", fake_run_capability_now)

    resp = client.post("/api/products/ingredients/library/build", json={})
    assert resp.status_code == 200
    body = resp.json()

    assert body["status"] == "ok"
    assert body["unique_ingredients"] == 3
    assert body["created"] == 3
    assert body["failed"] == 0

    glycerin_items = [item for item in body["items"] if item["ingredient_name"] == "甘油"]
    assert len(glycerin_items) == 2
    assert {item["category"] for item in glycerin_items} == {"bodywash", "shampoo"}
    assert glycerin_items[0]["ingredient_id"] != glycerin_items[1]["ingredient_id"]

    for item in body["items"]:
        path = item.get("storage_path")
        assert path
        abs_path = Path(storage_dir) / path
        assert abs_path.exists()
        saved = json.loads(abs_path.read_text(encoding="utf-8"))
        assert saved["id"] == item["ingredient_id"]
        assert saved["category"] == item["category"]


def test_build_ingredient_library_stream_has_progress_and_result(test_client, monkeypatch: pytest.MonkeyPatch):
    client, _ = test_client
    plans = [
        {
            "category": "bodywash",
            "brand": "Dove",
            "name": "Body Wash A",
            "one_sentence": "A",
            "ingredients": ["甘油"],
        }
    ]
    _install_fake_ingest_pipeline(monkeypatch, plans)
    _ingest_one(client, "stream.jpg")

    def fake_run_capability_now(capability: str, input_payload: dict, trace_id: str | None = None, event_callback=None):
        assert capability == "doubao.ingredient_category_profile"
        if event_callback:
            event_callback({"type": "step", "stage": "ingredient_category_profile", "message": "model running"})
            event_callback({"type": "delta", "stage": "ingredient_category_profile", "delta": "hello"})
        return {
            "ingredient_name": input_payload["ingredient"],
            "category": input_payload["category"],
            "summary": "ok",
            "benefits": [],
            "risks": [],
            "usage_tips": [],
            "suitable_for": [],
            "avoid_for": [],
            "confidence": 90,
            "reason": "ok",
            "analysis_text": "{}",
            "model": "doubao-seed-2-0-pro-260215",
        }

    monkeypatch.setattr(products_routes, "run_capability_now", fake_run_capability_now)

    resp = client.post("/api/products/ingredients/library/build/stream", json={})
    assert resp.status_code == 200
    assert "event: progress" in resp.text
    assert "ingredient_build_start" in resp.text
    assert "ingredient_model_delta" in resp.text
    assert "event: result" in resp.text
