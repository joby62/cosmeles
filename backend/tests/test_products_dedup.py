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
            "vision_text": f"【品牌】{plan['brand']}\n【产品名】{plan['name']}\n【品类】{plan['category']}",
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
    assert stage2.json()["id"] == trace_id
    return trace_id


def test_products_dedup_suggest_groups_duplicates(test_client, monkeypatch: pytest.MonkeyPatch):
    client, _ = test_client
    plans = [
        {
            "category": "bodywash",
            "brand": "Dove",
            "name": "DEEP MOISTURE BODY WASH",
            "one_sentence": "保湿沐浴露",
            "ingredients": ["甘氨酸", "香精", "椰油酰胺丙基甜菜碱"],
        },
        {
            "category": "bodywash",
            "brand": "DOVE",
            "name": "Deep Moisture Body Wash",
            "one_sentence": "深层保湿沐浴露",
            "ingredients": ["甘氨酸", "香精", "椰油酰胺丙基甜菜碱"],
        },
        {
            "category": "bodywash",
            "brand": "CeraVe",
            "name": "Hydrating Cleanser",
            "one_sentence": "温和洁面",
            "ingredients": ["神经酰胺", "透明质酸钠"],
        },
    ]
    _install_fake_ingest_pipeline(monkeypatch, plans)

    product_ids = [
        _ingest_one(client, "a.jpg"),
        _ingest_one(client, "b.jpg"),
        _ingest_one(client, "c.jpg"),
    ]

    def fake_run_capability_now(capability: str, input_payload: dict, trace_id: str | None = None, event_callback=None):
        assert capability == "doubao.product_dedup_group"
        anchor_id = input_payload["anchor_product"]["id"]
        candidate_ids = [item["id"] for item in input_payload["candidate_products"]]
        related_ids = {anchor_id, *candidate_ids}
        if product_ids[0] in related_ids and product_ids[1] in related_ids:
            return {
                "keep_id": product_ids[0],
                "duplicates": [{"id": product_ids[1], "confidence": 95, "reason": "品牌与主名称高度重合"}],
                "reason": "同款不同写法",
                "analysis_text": "判定第二条为重复项。",
            }
        return {
            "keep_id": anchor_id,
            "duplicates": [],
            "reason": "无重复",
            "analysis_text": "未发现重复项。",
        }

    monkeypatch.setattr(products_routes, "run_capability_now", fake_run_capability_now)

    resp = client.post(
        "/api/products/dedup/suggest",
        json={
            "category": "bodywash",
            "max_scan_products": 50,
            "compare_batch_size": 10,
            "min_confidence": 70,
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert body["scanned_products"] >= 2
    assert len(body["suggestions"]) == 1
    assert body["suggestions"][0]["keep_id"] == product_ids[0]
    assert body["suggestions"][0]["remove_ids"] == [product_ids[1]]
    assert body["suggestions"][0]["confidence"] == 95


def test_products_dedup_suggest_stream_returns_progress_and_result(test_client, monkeypatch: pytest.MonkeyPatch):
    client, _ = test_client
    plans = [
        {
            "category": "bodywash",
            "brand": "Dove",
            "name": "DEEP MOISTURE BODY WASH",
            "one_sentence": "保湿沐浴露",
            "ingredients": ["甘氨酸", "香精", "椰油酰胺丙基甜菜碱"],
        },
        {
            "category": "bodywash",
            "brand": "DOVE",
            "name": "Deep Moisture Body Wash",
            "one_sentence": "深层保湿沐浴露",
            "ingredients": ["甘氨酸", "香精", "椰油酰胺丙基甜菜碱"],
        },
    ]
    _install_fake_ingest_pipeline(monkeypatch, plans)
    first_id = _ingest_one(client, "s1.jpg")
    second_id = _ingest_one(client, "s2.jpg")

    def fake_run_capability_now(capability: str, input_payload: dict, trace_id: str | None = None, event_callback=None):
        assert capability == "doubao.product_dedup_group"
        if event_callback:
            event_callback({"type": "delta", "stage": "product_dedup_group", "delta": "stream-text"})
        return {
            "keep_id": first_id,
            "duplicates": [{"id": second_id, "confidence": 98, "reason": "高度重合"}],
            "reason": "同款重复",
            "analysis_text": "建议删除第二条。",
        }

    monkeypatch.setattr(products_routes, "run_capability_now", fake_run_capability_now)

    resp = client.post(
        "/api/products/dedup/suggest/stream",
        json={"category": "bodywash", "min_confidence": 95},
    )
    assert resp.status_code == 200
    assert "event: progress" in resp.text
    assert "event: result" in resp.text
    assert first_id in resp.text
    assert second_id in resp.text


def test_products_batch_delete_keeps_selected_and_removes_artifacts(test_client, monkeypatch: pytest.MonkeyPatch):
    client, storage_dir = test_client
    plans = [
        {
            "category": "shampoo",
            "brand": "A",
            "name": "A-keep",
            "one_sentence": "keep",
            "ingredients": ["成分A"],
        },
        {
            "category": "shampoo",
            "brand": "B",
            "name": "B-delete",
            "one_sentence": "delete",
            "ingredients": ["成分B"],
        },
    ]
    _install_fake_ingest_pipeline(monkeypatch, plans)

    keep_id = _ingest_one(client, "keep.jpg")
    delete_id = _ingest_one(client, "delete.jpg")

    delete_artifact_dir = Path(storage_dir) / "doubao_runs" / delete_id
    assert delete_artifact_dir.exists()

    resp = client.post(
        "/api/products/batch-delete",
        json={
            "ids": [keep_id, delete_id],
            "keep_ids": [keep_id],
            "remove_doubao_artifacts": True,
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert body["deleted_ids"] == [delete_id]
    assert body["skipped_ids"] == [keep_id]
    assert delete_id not in body["missing_ids"]
    assert body["removed_files"] >= 2
    assert body["removed_dirs"] >= 1

    products = client.get("/api/products")
    assert products.status_code == 200
    ids_left = {item["id"] for item in products.json()}
    assert keep_id in ids_left
    assert delete_id not in ids_left

    assert not delete_artifact_dir.exists()
