import json
from pathlib import Path

import pytest

from app.db.models import MobileBagItem, MobileCompareUsageStat, MobileSelectionSession, UserProduct, UserUploadAsset
from app.db.session import get_db
from app.routes import ingest as ingest_routes
from app.routes import mobile as mobile_routes
from app.settings import settings
from backend.tests.support_images import VALID_TEST_IMAGE_BYTES, install_fake_save_image


def _install_fake_ingest_pipeline(monkeypatch: pytest.MonkeyPatch, plan: dict) -> None:
    install_fake_save_image(monkeypatch, ingest_routes, mobile_routes)

    def fake_stage1(_image_rel: str, trace_id: str, event_callback=None):
        if event_callback:
            event_callback({"type": "step", "stage": "stage1_vision", "message": "mock"})
        return {
            "vision_text": (
                f"【品牌】{plan['brand']}\n"
                f"【产品名】{plan['name']}\n"
                f"【品类】{plan['category']}\n"
                "【成分表原文】甘油，椰油酰胺丙基甜菜碱"
            ),
            "model": "doubao-stage1-mini",
            "artifact": f"doubao_runs/{trace_id}/stage1_vision.json",
        }

    def fake_stage2(_vision_text: str, trace_id: str, event_callback=None):
        if event_callback:
            event_callback({"type": "step", "stage": "stage2_struct", "message": "mock"})
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
                        "name": "甘油",
                        "rank": 1,
                        "abundance_level": "major",
                        "order_confidence": 95,
                        "type": "保湿剂",
                        "functions": ["保湿"],
                        "risk": "low",
                        "notes": "",
                    },
                    {
                        "name": "椰油酰胺丙基甜菜碱",
                        "rank": 2,
                        "abundance_level": "trace",
                        "order_confidence": 82,
                        "type": "表活",
                        "functions": ["清洁"],
                        "risk": "mid",
                        "notes": "",
                    },
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
        files={"image": (image_name, VALID_TEST_IMAGE_BYTES, "image/png")},
    )
    assert stage1.status_code == 200
    trace_id = stage1.json()["trace_id"]

    stage2 = client.post("/api/upload/stage2", data={"trace_id": trace_id})
    assert stage2.status_code == 200
    return trace_id


def _set_featured_slot(client, *, category: str, target_type_key: str, product_id: str) -> None:
    resp = client.post(
        "/api/products/featured-slots",
        json={
            "category": category,
            "target_type_key": target_type_key,
            "product_id": product_id,
            "updated_by": "pytest",
        },
    )
    assert resp.status_code == 200


def _set_shampoo_featured_slots(client, *, product_id: str) -> None:
    for target_type_key in (
        "deep-oil-control",
        "anti-dandruff-itch",
        "gentle-soothing",
        "anti-hair-loss",
        "moisture-balance",
    ):
        _set_featured_slot(client, category="shampoo", target_type_key=target_type_key, product_id=product_id)


def _parse_sse_events(raw: str) -> list[tuple[str, dict]]:
    events: list[tuple[str, dict]] = []
    for block in raw.replace("\r\n", "\n").split("\n\n"):
        text = block.strip()
        if not text or text.startswith(":"):
            continue
        event = "message"
        data_lines: list[str] = []
        for line in text.split("\n"):
            if line.startswith("event:"):
                event = line.split(":", 1)[1].strip()
            elif line.startswith("data:"):
                data_lines.append(line.split(":", 1)[1].strip())
        payload = {}
        if data_lines:
            payload = json.loads("\n".join(data_lines))
        events.append((event, payload))
    return events


def test_mobile_compare_bootstrap_without_history(test_client):
    client, _ = test_client
    resp = client.get("/api/mobile/compare/bootstrap", params={"category": "shampoo"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert body["selected_category"] == "shampoo"
    assert body["recommendation"]["exists"] is False
    assert body["profile"]["has_history_profile"] is False
    assert body["product_library"]["most_used_product_id"] is None


def test_product_detail_exposes_catalog_commerce_status(test_client, monkeypatch: pytest.MonkeyPatch):
    client, _ = test_client
    _install_fake_ingest_pipeline(
        monkeypatch,
        {
            "category": "shampoo",
            "brand": "Dove",
            "name": "Shampoo A",
            "one_sentence": "洗发测试",
        },
    )
    product_id = _ingest_one(client, "commerce-product.jpg")

    resp = client.get(f"/api/products/{product_id}")
    assert resp.status_code == 200
    body = resp.json()
    assert body["commerce"]["status"] == "catalog_only"
    assert body["commerce"]["is_purchasable"] is False
    assert "price" in body["commerce"]["missing_fields"]
    assert "inventory" in body["commerce"]["missing_fields"]
    assert "shipping_eta" in body["commerce"]["missing_fields"]


def test_product_commerce_patch_flows_into_product_and_bag(test_client, monkeypatch: pytest.MonkeyPatch):
    client, _ = test_client
    _install_fake_ingest_pipeline(
        monkeypatch,
        {
            "category": "shampoo",
            "brand": "Dove",
            "name": "Shampoo A",
            "one_sentence": "洗发测试",
        },
    )
    product_id = _ingest_one(client, "commerce-patch.jpg")

    patched = client.patch(
        f"/api/products/{product_id}",
        json={
            "commerce": {
                "price_label": "$24",
                "inventory_label": "In stock",
                "shipping_eta_label": "Ships in 2-4 business days",
                "pack_size": {
                    "label": "250 mL",
                    "unit": "mL",
                    "value": 250,
                },
            }
        },
    )
    assert patched.status_code == 200
    patched_body = patched.json()
    assert patched_body["commerce"]["status"] == "ready"
    assert patched_body["commerce"]["is_purchasable"] is True
    assert patched_body["commerce"]["price_label"] == "$24"
    assert patched_body["commerce"]["inventory_label"] == "In stock"
    assert patched_body["commerce"]["shipping_eta_label"] == "Ships in 2-4 business days"
    assert patched_body["commerce"]["pack_size"]["label"] == "250 mL"

    detail = client.get(f"/api/products/{product_id}")
    assert detail.status_code == 200
    detail_body = detail.json()
    assert detail_body["commerce"]["status"] == "ready"
    assert detail_body["commerce"]["price_label"] == "$24"
    assert detail_body["commerce"]["pack_size"]["label"] == "250 mL"

    add_to_bag = client.post("/api/mobile/bag/items", json={"product_id": product_id, "quantity": 1})
    assert add_to_bag.status_code == 200

    bag = client.get("/api/mobile/bag/items")
    assert bag.status_code == 200
    bag_body = bag.json()
    assert bag_body["items"][0]["product"]["commerce"]["status"] == "ready"
    assert bag_body["items"][0]["product"]["commerce"]["price_label"] == "$24"


def test_mobile_compare_stream_success_and_fetch_result(test_client, monkeypatch: pytest.MonkeyPatch):
    client, _ = test_client
    _install_fake_ingest_pipeline(
        monkeypatch,
        {
            "category": "shampoo",
            "brand": "Dove",
            "name": "Shampoo A",
            "one_sentence": "洗发测试",
        },
    )
    featured_product_id = _ingest_one(client, "shampoo.jpg")
    _set_shampoo_featured_slots(client, product_id=featured_product_id)

    # 先生成历史首推会话
    selection = client.post(
        "/api/mobile/selection/resolve",
        json={"category": "shampoo", "answers": {"q1": "A", "q2": "C", "q3": "B"}},
    )
    assert selection.status_code == 200
    recommendation_product_id = selection.json()["recommended_product"]["id"]

    upload = client.post(
        "/api/mobile/compare/current-product/upload",
        data={"category": "shampoo", "brand": "CurrentBrand", "name": "CurrentName"},
        files={"image": ("current.png", VALID_TEST_IMAGE_BYTES, "image/png")},
    )
    assert upload.status_code == 200
    upload_id = upload.json()["upload_id"]

    class FakePipeline:
        def analyze_stage1(self, image_path: str, trace_id: str | None = None, event_callback=None):
            if event_callback:
                event_callback({"type": "step", "stage": "stage1_vision", "message": "stage1 done"})
            return {
                "vision_text": "mock vision",
                "model": "doubao-stage1-mini",
                "artifact": f"doubao_runs/{trace_id}/stage1_vision.json",
            }

        def analyze_stage2(self, vision_text: str, trace_id: str | None = None, event_callback=None):
            if event_callback:
                event_callback({"type": "step", "stage": "stage2_struct", "message": "stage2 done"})
            return {
                "doc": {
                    "product": {
                        "category": "shampoo",
                        "brand": "CurrentBrand",
                        "name": "CurrentName",
                    },
                    "summary": {
                        "one_sentence": "当前在用品测试摘要",
                        "pros": ["即时顺滑"],
                        "cons": ["可能偏干"],
                        "who_for": ["正常发质"],
                        "who_not_for": ["极敏感头皮"],
                    },
                    "ingredients": [
                        {"name": "甘油", "type": "保湿剂", "functions": ["保湿"], "risk": "low", "notes": ""},
                        {"name": "月桂醇硫酸酯钠", "type": "表活", "functions": ["清洁"], "risk": "high", "notes": ""},
                    ],
                    "evidence": {"doubao_raw": ""},
                },
                "struct_text": "{\"ok\":true}",
                "model": "doubao-stage2-mini",
                "artifact": f"doubao_runs/{trace_id}/stage2_struct.json",
            }

    def fake_run_capability_now(capability: str, input_payload: dict, trace_id: str | None = None, event_callback=None):
        assert capability == "doubao.mobile_compare_summary"
        if event_callback:
            event_callback({"type": "step", "stage": "mobile_compare_summary", "message": "running"})
            event_callback({"type": "delta", "stage": "mobile_compare_summary", "delta": "实时输出片段。"})
        return {
            "decision": "switch",
            "headline": "更建议你换到历史首推，整体更匹配当前情况。",
            "confidence": 0.88,
            "sections": {
                "keep_benefits": ["当前产品即时顺滑反馈更明显。"],
                "keep_watchouts": ["高频使用可能放大干涩风险。"],
                "ingredient_order_diff": ["两款前排成分侧重明显不同。"],
                "profile_fit_advice": ["结合你的个人情况，首推更稳妥。"],
            },
            "model": "doubao-pro",
        }

    monkeypatch.setattr(mobile_routes, "DoubaoPipelineService", FakePipeline)
    monkeypatch.setattr(mobile_routes, "run_capability_now", fake_run_capability_now)

    stream_resp = client.post(
        "/api/mobile/compare/jobs/stream",
        json={
            "category": "shampoo",
            "profile_mode": "reuse_latest",
            "targets": [
                {"source": "upload_new", "upload_id": upload_id},
                {"source": "history_product", "product_id": recommendation_product_id},
            ],
            "options": {"include_inci_order_diff": True, "include_function_rank_diff": True},
        },
    )
    assert stream_resp.status_code == 200
    events = _parse_sse_events(stream_resp.text)
    by_event = {}
    for name, payload in events:
        by_event.setdefault(name, []).append(payload)

    assert "error" not in by_event
    assert "result" in by_event
    assert "partial_text" not in by_event
    result = by_event["result"][0]
    assert result["current_product"]["commerce"]["status"] == "catalog_only"
    assert result["recommended_product"]["commerce"]["status"] == "catalog_only"
    assert "price" in result["current_product"]["commerce"]["missing_fields"]
    assert "price" in result["recommended_product"]["commerce"]["missing_fields"]
    assert result["status"] == "ok"
    assert result["verdict"]["decision"] == "switch"
    assert result["pair_results"][0]["sections"][0]["key"] == "keep_benefits"
    assert len(result["pair_results"]) == 1
    assert result["trace_id"]

    fetched = client.get(f"/api/mobile/compare/results/{result['compare_id']}")
    assert fetched.status_code == 200
    fetched_body = fetched.json()
    assert fetched_body["compare_id"] == result["compare_id"]
    assert fetched_body["verdict"]["headline"] == result["verdict"]["headline"]

    session_detail = client.get(f"/api/mobile/compare/sessions/{result['compare_id']}")
    assert session_detail.status_code == 200
    session_payload = session_detail.json()
    assert session_payload["status"] == "done"
    assert session_payload["compare_id"] == result["compare_id"]
    assert session_payload["result"]["headline"] == result["verdict"]["headline"]
    assert len(session_payload["targets_snapshot"]) == 2
    assert session_payload["targets_snapshot"][0] == {"source": "upload_new", "upload_id": upload_id, "product_id": None}
    assert session_payload["targets_snapshot"][1] == {
        "source": "history_product",
        "upload_id": None,
        "product_id": recommendation_product_id,
    }

    session_list = client.get("/api/mobile/compare/sessions", params={"category": "shampoo", "limit": 20})
    assert session_list.status_code == 200
    listed_ids = [item["compare_id"] for item in session_list.json()]
    assert result["compare_id"] in listed_ids


def test_mobile_compare_upload_creates_private_user_product_and_reuses_cached_doc(test_client, monkeypatch: pytest.MonkeyPatch):
    client, _ = test_client
    _install_fake_ingest_pipeline(
        monkeypatch,
        {
            "category": "shampoo",
            "brand": "SeedBrand",
            "name": "SeedProduct",
            "one_sentence": "seed",
        },
    )
    featured_product_id = _ingest_one(client, "seed.jpg")
    _set_shampoo_featured_slots(client, product_id=featured_product_id)

    selection = client.post(
        "/api/mobile/selection/resolve",
        json={"category": "shampoo", "answers": {"q1": "A", "q2": "C", "q3": "B"}},
    )
    assert selection.status_code == 200
    recommendation_product_id = selection.json()["recommended_product"]["id"]

    upload = client.post(
        "/api/mobile/compare/current-product/upload",
        data={"category": "shampoo", "brand": "CacheBrand", "name": "CacheName"},
        files={"image": ("cache.png", VALID_TEST_IMAGE_BYTES, "image/png")},
    )
    assert upload.status_code == 200
    upload_body = upload.json()
    upload_id = upload_body["upload_id"]
    user_product_id = upload_body["user_product_id"]
    assert user_product_id
    assert str(upload_body["image_path"]).startswith("user-images/")

    uploaded_image_abs = Path(settings.user_storage_dir) / "images" / str(upload_body["image_path"])[len("user-images/") :]
    assert uploaded_image_abs.exists()

    listed_before = client.get("/api/mobile/user-products", params={"category": "shampoo", "limit": 20})
    assert listed_before.status_code == 200
    listed_before_body = listed_before.json()
    assert listed_before_body["total"] == 1
    assert listed_before_body["items"][0]["user_product_id"] == user_product_id
    assert listed_before_body["items"][0]["status"] == "uploaded"

    pipeline_calls = {"stage1": 0, "stage2": 0}

    class FakePipeline:
        def analyze_stage1(self, image_path: str, trace_id: str | None = None, event_callback=None):
            pipeline_calls["stage1"] += 1
            return {
                "vision_text": "mock vision",
                "model": "doubao-stage1-mini",
                "artifact": f"doubao_runs/{trace_id}/stage1_vision.json",
            }

        def analyze_stage2(self, vision_text: str, trace_id: str | None = None, event_callback=None):
            pipeline_calls["stage2"] += 1
            return {
                "doc": {
                    "product": {"category": "shampoo", "brand": "CacheBrand", "name": "CacheName"},
                    "summary": {
                        "one_sentence": "缓存命中后的用户产品",
                        "pros": ["A"],
                        "cons": ["B"],
                        "who_for": ["C"],
                        "who_not_for": ["D"],
                    },
                    "ingredients": [
                        {"name": "甘油", "type": "保湿剂", "functions": ["保湿"], "risk": "low", "notes": ""},
                    ],
                    "evidence": {"doubao_raw": ""},
                },
                "struct_text": "{\"ok\":true}",
                "model": "doubao-stage2-mini",
                "artifact": f"doubao_runs/{trace_id}/stage2_struct.json",
            }

    def fake_run_capability_now(capability: str, input_payload: dict, trace_id: str | None = None, event_callback=None):
        assert capability == "doubao.mobile_compare_summary"
        return {
            "decision": "keep",
            "headline": "继续使用即可。",
            "confidence": 0.75,
            "sections": {
                "keep_benefits": ["A"],
                "keep_watchouts": ["B"],
                "ingredient_order_diff": ["C"],
                "profile_fit_advice": ["D"],
            },
            "model": "doubao-pro",
        }

    monkeypatch.setattr(mobile_routes, "DoubaoPipelineService", FakePipeline)
    monkeypatch.setattr(mobile_routes, "run_capability_now", fake_run_capability_now)

    for _ in range(2):
        stream_resp = client.post(
            "/api/mobile/compare/jobs/stream",
            json={
                "category": "shampoo",
                "profile_mode": "reuse_latest",
                "targets": [
                    {"source": "upload_new", "upload_id": upload_id},
                    {"source": "history_product", "product_id": recommendation_product_id},
                ],
            },
        )
        assert stream_resp.status_code == 200
        events = _parse_sse_events(stream_resp.text)
        assert not [payload for name, payload in events if name == "error"]

    assert pipeline_calls == {"stage1": 1, "stage2": 1}

    listed_after = client.get("/api/mobile/user-products", params={"category": "shampoo", "limit": 20})
    assert listed_after.status_code == 200
    listed_after_body = listed_after.json()
    assert listed_after_body["items"][0]["user_product_id"] == user_product_id
    assert listed_after_body["items"][0]["status"] == "ready"
    assert str(listed_after_body["items"][0]["image_url"]).startswith("/user-images/")


def test_mobile_compare_session_detail_fallback_to_result_when_session_file_missing(
    test_client,
    monkeypatch: pytest.MonkeyPatch,
):
    client, storage_dir = test_client

    _install_fake_ingest_pipeline(
        monkeypatch,
        {
            "category": "shampoo",
            "brand": "FallbackBrand",
            "name": "FallbackA",
            "one_sentence": "fallback",
        },
    )
    featured_product_id = _ingest_one(client, "fallback.jpg")
    _set_shampoo_featured_slots(client, product_id=featured_product_id)

    selection = client.post(
        "/api/mobile/selection/resolve",
        json={"category": "shampoo", "answers": {"q1": "A", "q2": "C", "q3": "B"}},
    )
    assert selection.status_code == 200
    recommendation_product_id = selection.json()["recommended_product"]["id"]

    upload = client.post(
        "/api/mobile/compare/current-product/upload",
        data={"category": "shampoo", "brand": "FallbackBrand", "name": "FallbackUse"},
        files={"image": ("fallback-current.png", VALID_TEST_IMAGE_BYTES, "image/png")},
    )
    assert upload.status_code == 200
    upload_id = upload.json()["upload_id"]

    class FakePipeline:
        def analyze_stage1(self, image_path: str, trace_id: str | None = None, event_callback=None):
            if event_callback:
                event_callback({"type": "step", "stage": "stage1_vision", "message": "stage1 done"})
            return {
                "vision_text": "mock vision",
                "model": "doubao-stage1-mini",
                "artifact": f"doubao_runs/{trace_id}/stage1_vision.json",
            }

        def analyze_stage2(self, vision_text: str, trace_id: str | None = None, event_callback=None):
            if event_callback:
                event_callback({"type": "step", "stage": "stage2_struct", "message": "stage2 done"})
            return {
                "doc": {
                    "product": {"category": "shampoo", "brand": "FallbackBrand", "name": "FallbackUse"},
                    "summary": {
                        "one_sentence": "fallback summary",
                        "pros": ["A"],
                        "cons": ["B"],
                        "who_for": ["C"],
                        "who_not_for": ["D"],
                    },
                    "ingredients": [
                        {"name": "甘油", "type": "保湿剂", "functions": ["保湿"], "risk": "low", "notes": ""},
                        {"name": "月桂醇硫酸酯钠", "type": "表活", "functions": ["清洁"], "risk": "high", "notes": ""},
                    ],
                    "evidence": {"doubao_raw": ""},
                },
                "struct_text": "{\"ok\":true}",
                "model": "doubao-stage2-mini",
                "artifact": f"doubao_runs/{trace_id}/stage2_struct.json",
            }

    def fake_run_capability_now(capability: str, input_payload: dict, trace_id: str | None = None, event_callback=None):
        return {
            "decision": "keep",
            "headline": "可以继续使用。",
            "confidence": 0.74,
            "sections": {
                "keep_benefits": ["A"],
                "keep_watchouts": ["B"],
                "ingredient_order_diff": ["C"],
                "profile_fit_advice": ["D"],
            },
            "model": "doubao-pro",
        }

    monkeypatch.setattr(mobile_routes, "DoubaoPipelineService", FakePipeline)
    monkeypatch.setattr(mobile_routes, "run_capability_now", fake_run_capability_now)

    stream_resp = client.post(
        "/api/mobile/compare/jobs/stream",
        json={
            "category": "shampoo",
            "profile_mode": "reuse_latest",
            "targets": [
                {"source": "upload_new", "upload_id": upload_id},
                {"source": "history_product", "product_id": recommendation_product_id},
            ],
        },
    )
    assert stream_resp.status_code == 200
    events = _parse_sse_events(stream_resp.text)
    result_payload = [payload for name, payload in events if name == "result"][0]
    compare_id = result_payload["compare_id"]

    session_file = Path(storage_dir) / "doubao_runs" / compare_id / "mobile_compare_session.json"
    assert session_file.exists()
    session_file.unlink()

    fallback_detail = client.get(f"/api/mobile/compare/sessions/{compare_id}")
    assert fallback_detail.status_code == 200
    detail_payload = fallback_detail.json()
    assert detail_payload["status"] == "done"
    assert detail_payload["compare_id"] == compare_id
    assert detail_payload["result"]["headline"] == result_payload["verdict"]["headline"]


def test_mobile_compare_stream_returns_real_error_when_no_recommendation(test_client):
    client, _ = test_client
    stream_resp = client.post(
        "/api/mobile/compare/jobs/stream",
        json={
            "category": "shampoo",
            "profile_mode": "reuse_latest",
            "targets": [
                {"source": "history_product", "product_id": "missing-id-1"},
                {"source": "history_product", "product_id": "missing-id-2"},
            ],
            "options": {"include_inci_order_diff": True, "include_function_rank_diff": True},
        },
    )
    assert stream_resp.status_code == 200
    events = _parse_sse_events(stream_resp.text)
    errors = [payload for name, payload in events if name == "error"]
    assert errors
    assert errors[0]["code"] == "COMPARE_RECOMMENDATION_NOT_FOUND"


def test_mobile_compare_bootstrap_product_library_marks_recommendation_and_most_used(
    test_client,
    monkeypatch: pytest.MonkeyPatch,
):
    client, _ = test_client

    _install_fake_ingest_pipeline(
        monkeypatch,
        {
            "category": "shampoo",
            "brand": "BrandA",
            "name": "UseMe",
            "one_sentence": "在用产品",
        },
    )
    current_product_id = _ingest_one(client, "current.jpg")

    _install_fake_ingest_pipeline(
        monkeypatch,
        {
            "category": "shampoo",
            "brand": "BrandB",
            "name": "TopPick",
            "one_sentence": "历史首推",
        },
    )
    recommendation_product_id = _ingest_one(client, "recommended.jpg")
    _set_shampoo_featured_slots(client, product_id=current_product_id)

    selection = client.post(
        "/api/mobile/selection/resolve",
        json={"category": "shampoo", "answers": {"q1": "A", "q2": "C", "q3": "B"}},
    )
    assert selection.status_code == 200
    selected_recommendation_id = selection.json()["recommended_product"]["id"]
    assert selected_recommendation_id in {current_product_id, recommendation_product_id}
    usage_target_id = current_product_id if selected_recommendation_id != current_product_id else recommendation_product_id
    usage_brand, usage_name = ("BrandA", "UseMe") if usage_target_id == current_product_id else ("BrandB", "TopPick")

    def fake_run_capability_now(capability: str, input_payload: dict, trace_id: str | None = None, event_callback=None):
        assert capability == "doubao.mobile_compare_summary"
        return {
            "decision": "keep",
            "headline": "继续用当前产品即可。",
            "confidence": 0.77,
            "sections": {
                "keep_benefits": ["A"],
                "keep_watchouts": ["B"],
                "ingredient_order_diff": ["C"],
                "profile_fit_advice": ["D"],
            },
            "model": "doubao-pro",
        }

    class FakePipeline:
        def analyze_stage1(self, image_path: str, trace_id: str | None = None, event_callback=None):
            if event_callback:
                event_callback({"type": "step", "stage": "stage1_vision", "message": "stage1 done"})
            return {
                "vision_text": "mock vision",
                "model": "doubao-stage1-mini",
                "artifact": f"doubao_runs/{trace_id}/stage1_vision.json",
            }

        def analyze_stage2(self, vision_text: str, trace_id: str | None = None, event_callback=None):
            if event_callback:
                event_callback({"type": "step", "stage": "stage2_struct", "message": "stage2 done"})
            return {
                "doc": {
                    "product": {"category": "shampoo", "brand": "UploadBrand", "name": "UploadName"},
                    "summary": {
                        "one_sentence": "上传产品摘要",
                        "pros": ["即时顺滑"],
                        "cons": ["可能偏干"],
                        "who_for": ["正常发质"],
                        "who_not_for": ["极敏感头皮"],
                    },
                    "ingredients": [
                        {"name": "甘油", "type": "保湿剂", "functions": ["保湿"], "risk": "low", "notes": ""},
                        {"name": "月桂醇硫酸酯钠", "type": "表活", "functions": ["清洁"], "risk": "high", "notes": ""},
                    ],
                    "evidence": {"doubao_raw": ""},
                },
                "struct_text": "{\"ok\":true}",
                "model": "doubao-stage2-mini",
                "artifact": f"doubao_runs/{trace_id}/stage2_struct.json",
            }

    monkeypatch.setattr(mobile_routes, "DoubaoPipelineService", FakePipeline)
    monkeypatch.setattr(mobile_routes, "run_capability_now", fake_run_capability_now)

    upload = client.post(
        "/api/mobile/compare/current-product/upload",
        data={"category": "shampoo", "brand": usage_brand, "name": usage_name},
        files={"image": ("usage.png", VALID_TEST_IMAGE_BYTES, "image/png")},
    )
    assert upload.status_code == 200
    upload_id = upload.json()["upload_id"]

    stream_resp = client.post(
        "/api/mobile/compare/jobs/stream",
        json={
            "category": "shampoo",
            "profile_mode": "reuse_latest",
            "targets": [
                {"source": "upload_new", "upload_id": upload_id},
                {"source": "history_product", "product_id": selected_recommendation_id},
            ],
        },
    )
    assert stream_resp.status_code == 200
    events = _parse_sse_events(stream_resp.text)
    assert not [payload for name, payload in events if name == "error"]

    bootstrap = client.get("/api/mobile/compare/bootstrap", params={"category": "shampoo"})
    assert bootstrap.status_code == 200
    body = bootstrap.json()
    assert body["product_library"]["recommendation_product_id"] == selected_recommendation_id
    assert body["product_library"]["most_used_product_id"] == usage_target_id

    items = body["product_library"]["items"]
    assert items[0]["product"]["id"] == selected_recommendation_id
    assert items[0]["is_recommendation"] is True
    most_used_item = next((item for item in items if item["product"]["id"] == usage_target_id), None)
    assert most_used_item is not None
    assert most_used_item["is_most_used"] is True
    assert most_used_item["usage_count"] == 1


def test_mobile_compare_stream_three_targets_runs_three_pairwise_ai_calls(test_client, monkeypatch: pytest.MonkeyPatch):
    client, _ = test_client

    _install_fake_ingest_pipeline(
        monkeypatch,
        {"category": "shampoo", "brand": "BrandA", "name": "ProdA", "one_sentence": "A"},
    )
    product_a = _ingest_one(client, "a.jpg")

    _install_fake_ingest_pipeline(
        monkeypatch,
        {"category": "shampoo", "brand": "BrandB", "name": "ProdB", "one_sentence": "B"},
    )
    product_b = _ingest_one(client, "b.jpg")
    _set_shampoo_featured_slots(client, product_id=product_a)

    selection = client.post(
        "/api/mobile/selection/resolve",
        json={"category": "shampoo", "answers": {"q1": "A", "q2": "C", "q3": "B"}},
    )
    assert selection.status_code == 200
    recommended = selection.json()["recommended_product"]["id"]

    upload = client.post(
        "/api/mobile/compare/current-product/upload",
        data={"category": "shampoo", "brand": "UploadBrand", "name": "UploadName"},
        files={"image": ("upload.png", VALID_TEST_IMAGE_BYTES, "image/png")},
    )
    assert upload.status_code == 200
    upload_id = upload.json()["upload_id"]

    class FakePipeline:
        def analyze_stage1(self, image_path: str, trace_id: str | None = None, event_callback=None):
            if event_callback:
                event_callback({"type": "step", "stage": "stage1_vision", "message": "stage1 done"})
            return {
                "vision_text": "mock vision",
                "model": "doubao-stage1-mini",
                "artifact": f"doubao_runs/{trace_id}/stage1_vision.json",
            }

        def analyze_stage2(self, vision_text: str, trace_id: str | None = None, event_callback=None):
            if event_callback:
                event_callback({"type": "step", "stage": "stage2_struct", "message": "stage2 done"})
            return {
                "doc": {
                    "product": {"category": "shampoo", "brand": "UploadBrand", "name": "UploadName"},
                    "summary": {
                        "one_sentence": "上传产品摘要",
                        "pros": ["即时顺滑"],
                        "cons": ["可能偏干"],
                        "who_for": ["正常发质"],
                        "who_not_for": ["极敏感头皮"],
                    },
                    "ingredients": [
                        {"name": "甘油", "type": "保湿剂", "functions": ["保湿"], "risk": "low", "notes": ""},
                        {"name": "月桂醇硫酸酯钠", "type": "表活", "functions": ["清洁"], "risk": "high", "notes": ""},
                    ],
                    "evidence": {"doubao_raw": ""},
                },
                "struct_text": "{\"ok\":true}",
                "model": "doubao-stage2-mini",
                "artifact": f"doubao_runs/{trace_id}/stage2_struct.json",
            }

    pair_calls: list[str] = []

    def fake_run_capability_now(capability: str, input_payload: dict, trace_id: str | None = None, event_callback=None):
        assert capability == "doubao.mobile_compare_summary"
        pair_calls.append(str(input_payload.get("compare_context_json") or ""))
        return {
            "decision": "hybrid",
            "headline": "两款适合分场景使用。",
            "confidence": 0.66,
            "sections": {
                "keep_benefits": ["A"],
                "keep_watchouts": ["B"],
                "ingredient_order_diff": ["C"],
                "profile_fit_advice": ["D"],
            },
            "model": "doubao-pro",
        }

    monkeypatch.setattr(mobile_routes, "DoubaoPipelineService", FakePipeline)
    monkeypatch.setattr(mobile_routes, "run_capability_now", fake_run_capability_now)

    extra_history = product_b if recommended != product_b else product_a
    stream_resp = client.post(
        "/api/mobile/compare/jobs/stream",
        json={
            "category": "shampoo",
            "profile_mode": "reuse_latest",
            "targets": [
                {"source": "upload_new", "upload_id": upload_id},
                {"source": "history_product", "product_id": recommended},
                {"source": "history_product", "product_id": extra_history},
            ],
        },
    )
    assert stream_resp.status_code == 200
    events = _parse_sse_events(stream_resp.text)
    by_event = {}
    for name, payload in events:
        by_event.setdefault(name, []).append(payload)
    assert "error" not in by_event
    assert "result" in by_event
    result = by_event["result"][0]
    assert len(result["pair_results"]) == 3
    assert {item["pair_key"] for item in result["pair_results"]} == {"1-2", "1-3", "2-3"}
    assert len(pair_calls) == 3


def test_mobile_compare_bootstrap_uses_latest_session_even_if_older_is_pinned(test_client, monkeypatch: pytest.MonkeyPatch):
    client, _ = test_client

    _install_fake_ingest_pipeline(
        monkeypatch,
        {
            "category": "shampoo",
            "brand": "BrandP",
            "name": "PinPref",
            "one_sentence": "置顶优先",
        },
    )
    featured_product_id = _ingest_one(client, "pin-pref.jpg")
    _set_shampoo_featured_slots(client, product_id=featured_product_id)

    older = client.post(
        "/api/mobile/selection/resolve",
        json={"category": "shampoo", "answers": {"q1": "A", "q2": "C", "q3": "B"}, "reuse_existing": False},
    )
    assert older.status_code == 200
    older_session_id = older.json()["session_id"]

    latest = client.post(
        "/api/mobile/selection/resolve",
        json={"category": "shampoo", "answers": {"q1": "C", "q2": "C", "q3": "A"}, "reuse_existing": False},
    )
    assert latest.status_code == 200
    latest_session_id = latest.json()["session_id"]
    assert older_session_id != latest_session_id

    pin_resp = client.post(
        f"/api/mobile/selection/sessions/{older_session_id}/pin",
        json={"pinned": True},
    )
    assert pin_resp.status_code == 200
    assert pin_resp.json()["is_pinned"] is True

    bootstrap = client.get("/api/mobile/compare/bootstrap", params={"category": "shampoo"})
    assert bootstrap.status_code == 200
    body = bootstrap.json()
    assert body["profile"]["basis"] == "latest"
    assert body["recommendation"]["session_id"] == latest_session_id
    assert body["recommendation"]["route_key"] == latest.json()["route"]["key"]


def test_mobile_compare_sessions_reindex_backfills_from_session_file(test_client):
    client, storage_dir = test_client
    compare_id = "cmp-reindex-session-001"
    owner_id = "device-reindex-session"

    run_dir = Path(storage_dir) / "doubao_runs" / compare_id
    run_dir.mkdir(parents=True, exist_ok=True)
    session_payload = {
        "compare_id": compare_id,
        "owner_type": "device",
        "owner_id": owner_id,
        "category": "shampoo",
        "status": "done",
        "created_at": "2026-03-04T00:00:00.000000Z",
        "updated_at": "2026-03-04T00:00:01.000000Z",
        "stage": "done",
        "stage_label": "对比完成",
        "message": "历史任务完成",
        "percent": 100,
        "result": {
            "decision": "keep",
            "headline": "保持当前产品即可。",
            "confidence": 0.9,
            "created_at": "2026-03-04T00:00:01.000000Z",
        },
    }
    (run_dir / "mobile_compare_session.json").write_text(
        json.dumps(session_payload, ensure_ascii=False),
        encoding="utf-8",
    )

    client.cookies.set("mx_device_id", owner_id)
    before = client.get("/api/mobile/compare/sessions", params={"category": "shampoo", "limit": 20})
    assert before.status_code == 200
    assert before.json() == []

    reindex = client.post("/api/mobile/compare/sessions/reindex", params={"limit": 50})
    assert reindex.status_code == 200
    body = reindex.json()
    assert body["status"] == "ok"
    assert body["indexed"] == 1
    assert body["sources"]["session"] == 1
    assert body["sources"]["result_fallback"] == 0

    listed = client.get("/api/mobile/compare/sessions", params={"category": "shampoo", "limit": 20})
    assert listed.status_code == 200
    listed_ids = [item["compare_id"] for item in listed.json()]
    assert compare_id in listed_ids

    detail = client.get(f"/api/mobile/compare/sessions/{compare_id}")
    assert detail.status_code == 200
    detail_payload = detail.json()
    assert detail_payload["compare_id"] == compare_id
    assert detail_payload["status"] == "done"
    assert detail_payload["result"]["headline"] == "保持当前产品即可。"


def test_mobile_compare_sessions_reindex_uses_result_fallback_when_session_missing(
    test_client,
    monkeypatch: pytest.MonkeyPatch,
):
    client, storage_dir = test_client
    compare_id = "cmp-reindex-result-001"
    owner_id = "device-reindex-result"

    run_dir = Path(storage_dir) / "doubao_runs" / compare_id
    run_dir.mkdir(parents=True, exist_ok=True)
    result_container = {
        "owner_type": "device",
        "owner_id": owner_id,
        "result": {"mock": True},
    }
    (run_dir / "mobile_compare_result.json").write_text(
        json.dumps(result_container, ensure_ascii=False),
        encoding="utf-8",
    )

    def fake_fallback(*, compare_id: str, result_payload: dict):
        assert compare_id == "cmp-reindex-result-001"
        assert result_payload == {"mock": True}
        return mobile_routes.MobileCompareSessionResponse(
            status="done",
            compare_id=compare_id,
            category="shampoo",
            created_at="2026-03-04T01:00:00.000000Z",
            updated_at="2026-03-04T01:00:00.000000Z",
            stage="done",
            stage_label="对比完成",
            message="结果文件回填",
            percent=100,
            pair_index=None,
            pair_total=None,
            result=mobile_routes.MobileCompareSessionResultBrief(
                decision="switch",
                headline="建议替换。",
                confidence=0.8,
                created_at="2026-03-04T01:00:00.000000Z",
            ),
            error=None,
        )

    monkeypatch.setattr(mobile_routes, "_fallback_mobile_compare_session_from_result_payload", fake_fallback)

    client.cookies.set("mx_device_id", owner_id)
    reindex = client.post("/api/mobile/compare/sessions/reindex", params={"limit": 50})
    assert reindex.status_code == 200
    body = reindex.json()
    assert body["status"] == "ok"
    assert body["indexed"] == 1
    assert body["sources"]["session"] == 0
    assert body["sources"]["result_fallback"] == 1

    detail = client.get(f"/api/mobile/compare/sessions/{compare_id}")
    assert detail.status_code == 200
    detail_payload = detail.json()
    assert detail_payload["compare_id"] == compare_id
    assert detail_payload["result"]["headline"] == "建议替换。"


def test_mobile_product_ref_cleanup_scans_and_repairs_invalid_mobile_references(
    test_client,
    monkeypatch: pytest.MonkeyPatch,
):
    client, _ = test_client

    _install_fake_ingest_pipeline(
        monkeypatch,
        {
            "category": "shampoo",
            "brand": "CleanupBrand",
            "name": "CleanupProduct",
            "one_sentence": "cleanup seed",
        },
    )
    product_id = _ingest_one(client, "cleanup-seed.jpg")
    _set_shampoo_featured_slots(client, product_id=product_id)

    selection = client.post(
        "/api/mobile/selection/resolve",
        json={"category": "shampoo", "answers": {"q1": "A", "q2": "C", "q3": "B"}},
    )
    assert selection.status_code == 200

    bag = client.post("/api/mobile/bag/items", json={"product_id": product_id, "quantity": 1})
    assert bag.status_code == 200

    owner_id = str(client.cookies.get("mx_device_id") or "").strip()
    assert owner_id
    stale_product_id = "missing-product-cleanup-001"
    stale_session_id = "stale-selection-cleanup-001"
    stale_bag_id = "stale-bag-cleanup-001"

    stale_result_payload = dict(selection.json())
    stale_result_payload["session_id"] = stale_session_id
    stale_result_payload["recommended_product"] = {
        **stale_result_payload["recommended_product"],
        "id": stale_product_id,
    }

    db_gen = client.app.dependency_overrides[get_db]()
    db = next(db_gen)
    try:
        db.add(
            MobileSelectionSession(
                id=stale_session_id,
                owner_type="device",
                owner_id=owner_id,
                category="shampoo",
                rules_version="2026-03-03.1",
                answers_hash="stale-cleanup-hash",
                route_key="stale-route",
                route_title="stale-route",
                product_id=stale_product_id,
                answers_json=json.dumps({"q1": "A"}, ensure_ascii=False),
                result_json=json.dumps(stale_result_payload, ensure_ascii=False),
                is_pinned=False,
                pinned_at=None,
                deleted_at=None,
                deleted_by=None,
                created_at="2026-03-06T00:00:00.000000Z",
            )
        )
        db.add(
            MobileBagItem(
                id=stale_bag_id,
                owner_type="device",
                owner_id=owner_id,
                category="shampoo",
                product_id=stale_product_id,
                quantity=1,
                created_at="2026-03-06T00:00:00.000000Z",
                updated_at="2026-03-06T00:00:00.000000Z",
            )
        )
        db.add(
            MobileCompareUsageStat(
                owner_type="device",
                owner_id=owner_id,
                category="shampoo",
                product_id=stale_product_id,
                usage_count=2,
                updated_at="2026-03-06T00:00:00.000000Z",
            )
        )
        db.commit()
    finally:
        db_gen.close()

    preview = client.post(
        "/api/maintenance/mobile/product-refs/cleanup",
        json={"dry_run": True, "sample_limit": 5},
    )
    assert preview.status_code == 200
    preview_body = preview.json()
    assert preview_body["dry_run"] is True
    assert preview_body["total_invalid"] == 3
    assert preview_body["total_repaired"] == 0
    assert preview_body["selection_sessions"]["invalid"] == 1
    assert preview_body["bag_items"]["invalid"] == 1
    assert preview_body["compare_usage_stats"]["invalid"] == 1

    repair = client.post(
        "/api/maintenance/mobile/product-refs/cleanup",
        json={"dry_run": False, "sample_limit": 5},
    )
    assert repair.status_code == 200
    repair_body = repair.json()
    assert repair_body["dry_run"] is False
    assert repair_body["total_repaired"] == 3
    assert repair_body["selection_sessions"]["repaired"] == 1
    assert repair_body["bag_items"]["repaired"] == 1
    assert repair_body["compare_usage_stats"]["repaired"] == 1

    db_gen = client.app.dependency_overrides[get_db]()
    db = next(db_gen)
    try:
        stale_session_row = db.get(MobileSelectionSession, stale_session_id)
        assert stale_session_row is not None
        assert stale_session_row.deleted_at is not None
        assert stale_session_row.product_id is None

        assert db.get(MobileBagItem, stale_bag_id) is None
        assert db.get(MobileCompareUsageStat, ("device", owner_id, "shampoo", stale_product_id)) is None
    finally:
        db_gen.close()

    after = client.post(
        "/api/maintenance/mobile/product-refs/cleanup",
        json={"dry_run": True, "sample_limit": 5},
    )
    assert after.status_code == 200
    after_body = after.json()
    assert after_body["total_invalid"] == 0
