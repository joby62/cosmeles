import pytest

from app.routes import ingest as ingest_routes
from app.routes import products as products_routes
from backend.tests.support_images import VALID_TEST_IMAGE_BYTES, install_fake_save_image


def _install_fake_ingest_pipeline(monkeypatch: pytest.MonkeyPatch, plan: dict) -> None:
    install_fake_save_image(monkeypatch, ingest_routes)

    def fake_stage1(_image_rel: str, trace_id: str, event_callback=None):
        if event_callback:
            event_callback({"type": "step", "stage": "stage1_vision", "message": "mock"})
        return {
            "vision_text": (
                f"【品牌】{plan['brand']}\n"
                f"【产品名】{plan['name']}\n"
                f"【品类】{plan['category']}\n"
                "【成分表原文】水、甘油"
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
                        "name": "椰油酰胺丙基甜菜碱 (Cocamidopropyl Betaine)",
                        "rank": 1,
                        "abundance_level": "major",
                        "order_confidence": 95,
                        "type": "表活",
                        "functions": ["清洁"],
                        "risk": "low",
                        "notes": "",
                    },
                    {
                        "name": "甘油 (Glycerin)",
                        "rank": 2,
                        "abundance_level": "major",
                        "order_confidence": 92,
                        "type": "保湿剂",
                        "functions": ["保湿"],
                        "risk": "low",
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


def _install_fake_route_and_profile_capabilities(monkeypatch: pytest.MonkeyPatch) -> None:
    def fake_run_capability_now(*, capability, input_payload, trace_id=None, event_callback=None):
        if event_callback:
            event_callback({"type": "step", "stage": capability, "message": "mock capability"})
        if capability == "doubao.route_mapping_shampoo":
            assert input_payload.get("product_context_json")
            return {
                "category": "shampoo",
                "rules_version": "2026-03-03.1",
                "primary_route": {
                    "route_key": "deep-oil-control",
                    "route_title": "深层控油型",
                    "confidence": 92,
                    "reason": "mock",
                },
                "secondary_route": {
                    "route_key": "moisture-balance",
                    "route_title": "水油平衡型",
                    "confidence": 70,
                    "reason": "mock",
                },
                "route_scores": [
                    {"route_key": "deep-oil-control", "route_title": "深层控油型", "confidence": 92, "reason": "mock"},
                    {"route_key": "moisture-balance", "route_title": "水油平衡型", "confidence": 70, "reason": "mock"},
                    {"route_key": "gentle-soothing", "route_title": "温和舒缓型", "confidence": 54, "reason": "mock"},
                    {"route_key": "anti-hair-loss", "route_title": "防脱强韧型", "confidence": 30, "reason": "mock"},
                    {"route_key": "anti-dandruff-itch", "route_title": "去屑止痒型", "confidence": 20, "reason": "mock"},
                ],
                "evidence": {
                    "positive": [
                        {
                            "ingredient_name_cn": "椰油酰胺丙基甜菜碱",
                            "ingredient_name_en": "Cocamidopropyl Betaine",
                            "rank": 1,
                            "impact": "清洁强度较好",
                        }
                    ],
                    "counter": [],
                },
                "confidence_reason": "mock",
                "needs_review": False,
                "analysis_text": "{\"mock\":true}",
                "model": "mock-pro",
            }
        if capability == "doubao.product_profile_shampoo":
            assert input_payload.get("product_analysis_context_json")
            return {
                "schema_version": "product_profile_shampoo.v1",
                "category": "shampoo",
                "route_key": "deep-oil-control",
                "route_title": "深层控油型",
                "headline": "典型控油清洁型洗发水",
                "positioning_summary": "这是一款以清洁与控油为主要重心的洗发水，当前 route 基本成立。",
                "subtype_fit_verdict": "strong_fit",
                "subtype_fit_reason": "主清洁体系较明确，route 证据集中在前位清洁相关成分。",
                "best_for": ["头皮偏油人群", "夏季易出油头皮", "想要清爽洗感用户"],
                "not_ideal_for": ["极干头皮", "重度受损发丝", "高敏脆弱头皮"],
                "usage_tips": ["搭配护发素平衡发尾", "可在夏季高频使用", "重点按摩头皮区域"],
                "watchouts": ["干性头皮注意频率", "染烫发尾注意后续保湿", "不主打强修护"],
                "key_ingredients": [
                    {
                        "ingredient_name_cn": "椰油酰胺丙基甜菜碱",
                        "ingredient_name_en": "Cocamidopropyl Betaine",
                        "rank": 1,
                        "role": "清洁基底",
                        "impact": "提供主要清洁支持。",
                    }
                ],
                "evidence": {
                    "positive": [
                        {
                            "ingredient_name_cn": "椰油酰胺丙基甜菜碱",
                            "ingredient_name_en": "Cocamidopropyl Betaine",
                            "rank": 1,
                            "impact": "说明配方清洁重心较靠前。",
                        }
                    ],
                    "counter": [],
                    "missing_codes": [],
                },
                "diagnostics": {
                    "cleanse_intensity": {"score": 4, "reason": "前位清洁基底较明确。"},
                    "oil_control_support": {"score": 4, "reason": "控油倾向较明显。"},
                    "dandruff_itch_support": {"score": 1, "reason": "去屑止痒支持不足。"},
                    "scalp_soothing_support": {"score": 2, "reason": "舒缓支持中等偏弱。"},
                    "hair_strengthening_support": {"score": 1, "reason": "强韧证据较少。"},
                    "moisture_balance_support": {"score": 2, "reason": "平衡感不是主重心。"},
                    "daily_use_friendliness": {"score": 3, "reason": "可日用但需看头皮状态。"},
                    "residue_weight": {"score": 1, "reason": "整体残留负担较轻。"},
                },
                "confidence": 87,
                "confidence_reason": "当前结论由前位成分和清洁定位共同支撑。",
                "needs_review": False,
                "model": "mock-pro",
            }
        raise AssertionError(f"unexpected capability: {capability}")

    monkeypatch.setattr(products_routes, "run_capability_now", fake_run_capability_now)


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


def test_product_analysis_build_and_fetch_detail(test_client, monkeypatch: pytest.MonkeyPatch):
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
    _install_fake_route_and_profile_capabilities(monkeypatch)
    trace_id = _ingest_one(client, "shampoo-analysis.jpg")

    route_resp = client.post(
        "/api/products/route-mapping/build",
        json={"category": "shampoo", "force_regenerate": True},
    )
    assert route_resp.status_code == 200
    assert route_resp.json()["created"] == 1

    build_resp = client.post(
        "/api/products/analysis/build",
        json={"category": "shampoo", "force_regenerate": True},
    )
    assert build_resp.status_code == 200
    body = build_resp.json()
    assert body["status"] == "ok"
    assert body["failed"] == 0
    assert body["created"] == 1
    assert body["submitted_to_model"] == 1
    assert len(body["items"]) == 1
    assert body["items"][0]["headline"] == "典型控油清洁型洗发水"

    product_id = trace_id
    detail = client.get(f"/api/products/{product_id}/analysis")
    assert detail.status_code == 200
    payload = detail.json()["item"]
    assert payload["product_id"] == product_id
    assert payload["category"] == "shampoo"
    assert payload["profile"]["route_key"] == "deep-oil-control"
    assert payload["profile"]["diagnostics"]["oil_control_support"]["score"] == 4

    index_resp = client.get("/api/products/analysis/index", params={"category": "shampoo"})
    assert index_resp.status_code == 200
    index_body = index_resp.json()
    assert index_body["total"] == 1
    assert index_body["items"][0]["subtype_fit_verdict"] == "strong_fit"


def test_product_analysis_build_fails_without_route_mapping(test_client, monkeypatch: pytest.MonkeyPatch):
    client, _ = test_client
    _install_fake_ingest_pipeline(
        monkeypatch,
        {
            "category": "shampoo",
            "brand": "Dove",
            "name": "Shampoo B",
            "one_sentence": "洗发测试",
        },
    )
    trace_id = _ingest_one(client, "shampoo-analysis-missing-route.jpg")

    build_resp = client.post(
        "/api/products/analysis/build",
        json={"category": "shampoo", "force_regenerate": True},
    )
    assert build_resp.status_code == 200
    body = build_resp.json()
    assert body["status"] == "partial_failed"
    assert body["failed"] == 1
    assert body["items"][0]["product_id"] == trace_id
    assert "route mapping missing" in str(body["items"][0]["error"]).lower()


def test_product_analysis_build_reject_invalid_category(test_client):
    client, _ = test_client
    build_resp = client.post(
        "/api/products/analysis/build",
        json={"category": "soap"},
    )
    assert build_resp.status_code == 400
    assert "Invalid category" in str(build_resp.json().get("detail"))
