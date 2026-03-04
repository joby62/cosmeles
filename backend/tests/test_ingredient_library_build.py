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
        ingredient_text = "、".join(str(item or "").strip() for item in plan.get("ingredients") or [] if str(item or "").strip())
        return {
            "vision_text": (
                f"【品牌】{plan['brand']}\n"
                f"【产品名】{plan['name']}\n"
                f"【品类】{plan['category']}\n"
                f"【成分表原文】{ingredient_text or '未识别'}"
            ),
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
        en_map = {
            "甘油": "Glycerin",
            "烟酰胺": "Niacinamide",
        }
        return {
            "ingredient_name": input_payload["ingredient"],
            "ingredient_name_en": en_map.get(input_payload["ingredient"], ""),
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
        assert "ingredient_name_en" in saved


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


def test_list_ingredient_library_reads_real_storage_profiles(test_client, monkeypatch: pytest.MonkeyPatch):
    client, _ = test_client
    plans = [
        {
            "category": "bodywash",
            "brand": "Dove",
            "name": "Body Wash A",
            "one_sentence": "A",
            "ingredients": ["PEG-150 季戊四醇四硬脂酸酯", "烟酰胺"],
        },
        {
            "category": "bodywash",
            "brand": "Dove",
            "name": "Body Wash B",
            "one_sentence": "B",
            "ingredients": ["甘油"],
        },
    ]
    _install_fake_ingest_pipeline(monkeypatch, plans)
    _ingest_one(client, "list-a.jpg")
    _ingest_one(client, "list-b.jpg")

    def fake_run_capability_now(capability: str, input_payload: dict, trace_id: str | None = None, event_callback=None):
        assert capability == "doubao.ingredient_category_profile"
        return {
            "ingredient_name": input_payload["ingredient"],
            "category": input_payload["category"],
            "summary": f"{input_payload['ingredient']} summary",
            "benefits": ["保湿"],
            "risks": [],
            "usage_tips": ["按需使用"],
            "suitable_for": ["普通人群"],
            "avoid_for": [],
            "confidence": 91,
            "reason": "mock",
            "analysis_text": "{}",
            "model": "doubao-seed-2-0-pro-260215",
        }

    monkeypatch.setattr(products_routes, "run_capability_now", fake_run_capability_now)

    build = client.post("/api/products/ingredients/library/build", json={"category": "bodywash"})
    assert build.status_code == 200

    resp = client.get("/api/products/ingredients/library", params={"category": "bodywash", "limit": 50})
    assert resp.status_code == 200
    body = resp.json()

    assert body["status"] == "ok"
    assert body["category"] == "bodywash"
    assert body["total"] >= 3
    assert len(body["items"]) == body["total"]
    assert all(item["category"] == "bodywash" for item in body["items"])
    assert all(item["storage_path"].startswith("ingredients/bodywash/") for item in body["items"])
    assert all(isinstance(item["source_trace_ids"], list) for item in body["items"])

    query_resp = client.get("/api/products/ingredients/library", params={"category": "bodywash", "q": "烟酰"})
    assert query_resp.status_code == 200
    query_body = query_resp.json()
    assert query_body["total"] == 1
    assert query_body["items"][0]["ingredient_name"] == "烟酰胺"


def test_get_ingredient_library_item_returns_profile_detail(test_client, monkeypatch: pytest.MonkeyPatch):
    client, _ = test_client
    plans = [
        {
            "category": "bodywash",
            "brand": "Dove",
            "name": "Body Wash Detail",
            "one_sentence": "Detail",
            "ingredients": ["甘油"],
        }
    ]
    _install_fake_ingest_pipeline(monkeypatch, plans)
    _ingest_one(client, "detail.jpg")

    def fake_run_capability_now(capability: str, input_payload: dict, trace_id: str | None = None, event_callback=None):
        assert capability == "doubao.ingredient_category_profile"
        return {
            "ingredient_name": input_payload["ingredient"],
            "category": input_payload["category"],
            "summary": "甘油用于保湿与肤感平衡",
            "benefits": ["保湿"],
            "risks": ["高浓度可能粘腻"],
            "usage_tips": ["与温和清洁体系搭配"],
            "suitable_for": ["中性肌肤"],
            "avoid_for": ["极端油敏肌需先测"],
            "confidence": 95,
            "reason": "mock",
            "analysis_text": "{\"ok\":true}",
            "model": "doubao-seed-2-0-pro-260215",
        }

    monkeypatch.setattr(products_routes, "run_capability_now", fake_run_capability_now)

    build = client.post("/api/products/ingredients/library/build", json={"category": "bodywash"})
    assert build.status_code == 200
    build_body = build.json()
    assert build_body["items"]
    target = build_body["items"][0]

    resp = client.get(f"/api/products/ingredients/library/{target['category']}/{target['ingredient_id']}")
    assert resp.status_code == 200
    body = resp.json()
    item = body["item"]

    assert body["status"] == "ok"
    assert item["ingredient_id"] == target["ingredient_id"]
    assert item["category"] == "bodywash"
    assert item["ingredient_name"] == "甘油"
    assert item["profile"]["summary"] == "甘油用于保湿与肤感平衡"
    assert item["profile"]["benefits"] == ["保湿"]
    assert item["profile"]["confidence"] == 95
    assert item["source_count"] == 1
    assert item["source_samples"]


def test_build_ingredient_library_second_scan_skips_without_model_call(test_client, monkeypatch: pytest.MonkeyPatch):
    client, _ = test_client
    plans = [
        {
            "category": "bodywash",
            "brand": "Dove",
            "name": "Body Wash Incremental",
            "one_sentence": "Incremental",
            "ingredients": ["甘油"],
        }
    ]
    _install_fake_ingest_pipeline(monkeypatch, plans)
    _ingest_one(client, "inc.jpg")

    call_count = {"value": 0}

    def fake_run_capability_now(capability: str, input_payload: dict, trace_id: str | None = None, event_callback=None):
        assert capability == "doubao.ingredient_category_profile"
        call_count["value"] += 1
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

    first = client.post("/api/products/ingredients/library/build", json={"category": "bodywash"})
    assert first.status_code == 200
    first_body = first.json()
    assert first_body["submitted_to_model"] == 1
    assert first_body["created"] == 1
    assert call_count["value"] == 1

    def should_not_call(*args, **kwargs):
        raise AssertionError("model should not be called on second incremental scan")

    monkeypatch.setattr(products_routes, "run_capability_now", should_not_call)
    second = client.post("/api/products/ingredients/library/build", json={"category": "bodywash"})
    assert second.status_code == 200
    second_body = second.json()
    assert second_body["submitted_to_model"] == 0
    assert second_body["created"] == 0
    assert second_body["updated"] == 0
    assert second_body["failed"] == 0
    assert second_body["skipped"] == 1


def test_build_ingredient_library_backfills_history_and_skips_model(test_client, monkeypatch: pytest.MonkeyPatch):
    client, storage_dir = test_client
    plans = [
        {
            "category": "bodywash",
            "brand": "Dove",
            "name": "Body Wash History",
            "one_sentence": "History",
            "ingredients": ["烟酰胺"],
        }
    ]
    _install_fake_ingest_pipeline(monkeypatch, plans)
    trace_id = _ingest_one(client, "history.jpg")

    ingredient_name = "烟酰胺"
    category = "bodywash"
    ingredient_key = products_routes._normalize_ingredient_key(ingredient_name)
    ingredient_id = products_routes._build_ingredient_id(category=category, ingredient_key=ingredient_key)
    rel_path = f"ingredients/{category}/{ingredient_id}.json"
    abs_path = Path(storage_dir) / rel_path
    abs_path.parent.mkdir(parents=True, exist_ok=True)
    abs_path.write_text(
        json.dumps(
            {
                "id": ingredient_id,
                "category": category,
                "ingredient_name": ingredient_name,
                "ingredient_key": ingredient_key,
                "source_count": 1,
                "source_trace_ids": [trace_id],
                "source_samples": [],
                "generated_at": "2026-01-01T00:00:00Z",
                "generator": {
                    "capability": "doubao.ingredient_category_profile",
                    "model": "doubao-seed-2-0-pro-260215",
                    "prompt_key": "doubao.ingredient_category_profile",
                },
                "profile": {
                    "summary": "历史沉淀条目",
                    "benefits": [],
                    "risks": [],
                    "usage_tips": [],
                    "suitable_for": [],
                    "avoid_for": [],
                    "confidence": 88,
                    "reason": "history",
                    "analysis_text": "{}",
                },
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )

    def should_not_call(*args, **kwargs):
        raise AssertionError("model should not be called for history backfilled profile")

    monkeypatch.setattr(products_routes, "run_capability_now", should_not_call)

    resp = client.post("/api/products/ingredients/library/build", json={"category": "bodywash"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert body["backfilled_from_storage"] >= 1
    assert body["submitted_to_model"] == 0
    assert body["skipped"] == 1
    assert body["created"] == 0
    assert body["updated"] == 0
