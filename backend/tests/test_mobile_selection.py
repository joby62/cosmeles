import json

import pytest
from fastapi.testclient import TestClient

from app.ai import capabilities as ai_capabilities
from app.routes import ingest as ingest_routes
from app.routes import products as products_routes
from app.services import mobile_selection_result_builder as selection_result_builder_service
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
                        "name": "甘油",
                        "rank": 1,
                        "abundance_level": "major",
                        "order_confidence": 96,
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


def _install_fake_route_mapping_builder(monkeypatch: pytest.MonkeyPatch) -> None:
    def fake_run_capability_now(*, capability, input_payload, trace_id=None, event_callback=None):
        if event_callback:
            event_callback({"type": "step", "stage": capability, "message": "mock route mapping"})
        if capability == "doubao.route_mapping_shampoo":
            return {
                "category": "shampoo",
                "rules_version": "2026-03-03.1",
                "primary_route": {
                    "route_key": "moisture-balance",
                    "route_title": "水油平衡型",
                    "confidence": 93,
                    "reason": "mock",
                },
                "secondary_route": {
                    "route_key": "deep-oil-control",
                    "route_title": "深层控油型",
                    "confidence": 72,
                    "reason": "mock",
                },
                "route_scores": [
                    {"route_key": "moisture-balance", "route_title": "水油平衡型", "confidence": 93, "reason": "mock"},
                    {"route_key": "deep-oil-control", "route_title": "深层控油型", "confidence": 72, "reason": "mock"},
                    {"route_key": "gentle-soothing", "route_title": "温和舒缓型", "confidence": 36, "reason": "mock"},
                    {"route_key": "anti-hair-loss", "route_title": "防脱强韧型", "confidence": 24, "reason": "mock"},
                    {"route_key": "anti-dandruff-itch", "route_title": "去屑止痒型", "confidence": 10, "reason": "mock"},
                ],
                "evidence": {"positive": [], "counter": []},
                "confidence_reason": "mock",
                "needs_review": False,
                "analysis_text": "{\"mock\":true}",
                "model": "mock-pro",
            }
        if capability == "doubao.route_mapping_bodywash":
            return {
                "category": "bodywash",
                "rules_version": "2026-03-03.1",
                "primary_route": {
                    "route_key": "rescue",
                    "route_title": "恒温舒缓修护型",
                    "confidence": 95,
                    "reason": "mock",
                },
                "secondary_route": {
                    "route_key": "shield",
                    "route_title": "脂类补充油膏型",
                    "confidence": 60,
                    "reason": "mock",
                },
                "route_scores": [
                    {"route_key": "rescue", "route_title": "恒温舒缓修护型", "confidence": 95, "reason": "mock"},
                    {"route_key": "shield", "route_title": "脂类补充油膏型", "confidence": 60, "reason": "mock"},
                    {"route_key": "vibe", "route_title": "轻盈香氛平衡型", "confidence": 52, "reason": "mock"},
                    {"route_key": "glow", "route_title": "氨基酸亮肤型", "confidence": 44, "reason": "mock"},
                    {"route_key": "purge", "route_title": "水杨酸净彻控油型", "confidence": 31, "reason": "mock"},
                    {"route_key": "polish", "route_title": "乳酸尿素更新型", "confidence": 20, "reason": "mock"},
                ],
                "evidence": {"positive": [], "counter": []},
                "confidence_reason": "mock",
                "needs_review": False,
                "analysis_text": "{\"mock\":true}",
                "model": "mock-pro",
            }
        raise AssertionError(f"unexpected capability: {capability}")

    monkeypatch.setattr(products_routes, "run_capability_now", fake_run_capability_now)


def _install_fake_selection_result_builder(
    monkeypatch: pytest.MonkeyPatch,
    *,
    hero_title: str | None = None,
    hero_subtitle: str | None = None,
    hero_items: list[str] | None = None,
) -> None:
    def fake_run_capability_now(*, capability, input_payload, trace_id=None, event_callback=None):
        assert capability.startswith("doubao.mobile_selection_result_")
        if event_callback:
            event_callback({"type": "step", "stage": capability, "message": "mock selection result"})
        context = json.loads(input_payload["selection_result_context_json"])
        route_title = context["route"]["title"]
        product_name = context["recommended_product"].get("name") or "当前主推"
        resolved_hero_title = hero_title or f"你当前更偏向{route_title}这条日常护理主线"
        resolved_hero_subtitle = hero_subtitle or "系统先根据你的题目选择和路线分差判断当前最该优先的护理方向，再用主推产品把这个方向接住。"
        resolved_hero_items = hero_items if hero_items is not None else [
            "当前结果先回答你现在更像什么情况，再承接产品方向。",
            "系统不会只堆商品，而是先讲清楚为什么会落到这条路。",
            "后续若矩阵或主推变化，这类场景内容也会随之重建更新。",
        ]
        return {
            "schema_version": "selection_result_content.v2",
            "renderer_variant": "selection_result_default",
            "micro_summary": f"{route_title}先稳住",
            "share_copy": {
                "title": f"你的本命路线是{route_title}",
                "subtitle": f"我现在更适合先走{route_title}这条线",
                "caption": f"予选先把我现在的情况讲明白，再把更适合的方向和 {product_name} 这类方案接上了。",
            },
            "display_order": ["hero", "situation", "attention", "pitfalls", "evidence", "product_bridge", "ctas"],
            "blocks": [
                {
                    "id": "hero",
                    "kind": "hero",
                    "version": "v1",
                    "payload": {
                        "eyebrow": "予选先帮你看懂自己",
                        "title": resolved_hero_title,
                        "subtitle": resolved_hero_subtitle,
                        "items": resolved_hero_items,
                    },
                },
                {
                    "id": "situation",
                    "kind": "explanation",
                    "version": "v1",
                    "payload": {
                        "title": "你现在更像什么情况",
                        "subtitle": "从当前答案组合看，你更接近这条主线，说明系统认为这才是你当下更需要先处理的核心矛盾。",
                        "items": [
                            "当前路线先锚定核心问题，而不是随机给产品。",
                            "系统会结合 top1 与 top2 分差，避免只看单题表面现象。",
                            "如果有 veto，说明某些看起来像的方向其实被明确排除了。",
                        ],
                        "note": "这里先把你的情况讲明白，再把产品放到后面承接。",
                    },
                },
                {
                    "id": "attention",
                    "kind": "strategy",
                    "version": "v1",
                    "payload": {
                        "title": "你当前最该抓住什么",
                        "subtitle": "先把当前最关键的护理优先级抓住，再谈额外诉求，会比一上来追求面面俱到更稳。",
                        "items": [
                            "先沿着当前主线解决最核心矛盾，少被次要诉求带偏。",
                            "题目收敛结果代表的是日常护理优先级，不是一次性终局判断。",
                            "当前主推只是先承接这条方向，不代表你只有这一款能用。",
                        ],
                        "note": "平台优先级是适配度，不是把更多商品直接堆到你面前。",
                    },
                },
                {
                    "id": "pitfalls",
                    "kind": "warning",
                    "version": "v1",
                    "payload": {
                        "title": "你现在最该少踩的坑",
                        "subtitle": "很多人会因为只盯一个表面症状或一句营销话术，就把自己带到并不适合的方向上。",
                        "items": [
                            "不要把看起来也像的次要问题，误当成当前真正要先处理的问题。",
                            "不要把产品宣传词当结论，还是要回到路线和证据本身。",
                            "不要把当前推荐理解成万能方案，它只是更贴近你当前状态。",
                        ],
                        "note": "这一步的重点是少踩坑，而不是把所有需求一次性叠满。",
                    },
                },
                {
                    "id": "evidence",
                    "kind": "explanation",
                    "version": "v1",
                    "payload": {
                        "title": "为什么系统这样判断",
                        "subtitle": "系统会同时看答案、路线得分、top2 差距和 veto 屏蔽，再决定为什么当前路线更站得住。",
                        "items": [
                            "不是只凭单题命中，而是看整套答案如何把路线分数推高或压低。",
                            "top2 对比能帮助解释为什么相近路线没有赢过当前主线。",
                            "被 veto 的路线会被明确挡掉，避免结果页讲得含糊不清。",
                        ],
                        "note": "如果产品分析暂缺，也会如实保留证据不足，而不是伪造完整解释。",
                    },
                },
                {
                    "id": "product_bridge",
                    "kind": "strategy",
                    "version": "v1",
                    "payload": {
                        "title": "为什么先给你这类或这款",
                        "subtitle": "当前主推会优先承接这条路线，目标是让产品服务于你的情况解释，而不是反过来用产品定义你。",
                        "items": [
                            "当前主推先接住这条路线的核心诉求，而不是抢走结果页主线。",
                            "如果产品分析证据不足，结果页也必须明确标注，而不是假装很完整。",
                            "后续如果主推变化或证据更新，同一场景会按最新依赖重建内容。",
                        ],
                        "note": "予选的优先级是适配度，不是把更多商品堆给你。",
                    },
                },
            ],
            "ctas": [
                {"id": "open_product", "label": "查看产品详情", "action": "product", "href": "", "payload": {}},
                {"id": "open_wiki", "label": "查看成分百科", "action": "wiki", "href": "", "payload": {}},
                {"id": "restart", "label": "重新判断一次", "action": "restart", "href": "", "payload": {}},
            ],
            "model": "mock-pro",
        }

    monkeypatch.setattr(selection_result_builder_service, "run_capability_now", fake_run_capability_now)


def _sample_selection_result_content() -> dict:
    return {
        "schema_version": "selection_result_content.v2",
        "renderer_variant": "selection_result_default",
        "micro_summary": "主线先稳住吧",
        "share_copy": {
            "title": "你的本命路线是平衡修护",
            "subtitle": "我现在更适合先走平衡修护这条线",
            "caption": "先把我当前的情况讲清楚，再把更适合的护理方向和产品承接起来。",
        },
        "display_order": ["hero", "situation", "attention", "pitfalls", "evidence", "product_bridge", "ctas"],
        "blocks": [
            {
                "id": "hero",
                "kind": "hero",
                "version": "v1",
                "payload": {
                    "eyebrow": "结果先讲人再讲产品",
                    "title": "你当前更该先走平衡修护主线",
                    "subtitle": "系统会先根据你的答案判断当前更该优先处理哪条护理主线，再把产品承接进来。",
                    "items": [
                        "先把当前情况讲明白，再讲产品为什么承接这条路线。",
                        "结果页会解释为什么这条路线赢过其他相近方向。",
                        "如果证据不完整，也会直接说明，不会伪造完整结论。",
                    ],
                },
            },
            {
                "id": "situation",
                "kind": "explanation",
                "version": "v1",
                "payload": {
                    "title": "你现在更像什么情况",
                    "subtitle": "先把你当前更像什么状态讲清楚，避免还没理解自己就被产品和营销词带跑。",
                    "items": [
                        "优先描述当前最突出的状态，而不是把所有问题混在一起讲。",
                        "真正该先处理的核心矛盾，需要被单独拎出来说明。",
                        "如果某些相近路线其实不成立，也要顺手解释清楚。",
                    ],
                    "note": "这里先解释你的状态，再进入推荐，不会一上来只讲产品。",
                },
            },
            {
                "id": "attention",
                "kind": "strategy",
                "version": "v1",
                "payload": {
                    "title": "你当前最该抓住什么",
                    "subtitle": "当前主线代表的是你此刻最该优先处理的矛盾，不是把所有诉求一次性叠满。",
                    "items": [
                        "要先说清当前应该优先解决什么，再谈次级诉求。",
                        "建议用户把精力放在当前最影响体验的那条主线上。",
                        "提醒用户这是一条当前优先级判断，不是假装一步到位。",
                    ],
                    "note": "重点是先抓主线，别把注意力浪费在次要方向上。",
                },
            },
            {
                "id": "pitfalls",
                "kind": "warning",
                "version": "v1",
                "payload": {
                    "title": "你现在最该少踩的坑",
                    "subtitle": "很多人会被相似症状或一句卖点带偏，所以这里要先讲哪些方向现在不该乱冲。",
                    "items": [
                        "要指出最容易被误判的相近路线，以及为什么现在不适合。",
                        "如果有 veto，要把被屏蔽路线翻译成人话讲清楚。",
                        "不要只说不推荐，还要说明背后的真实判断依据。",
                    ],
                    "note": "这一步是帮用户少踩坑，不是堆更多术语和吓人的判断。",
                },
            },
            {
                "id": "evidence",
                "kind": "explanation",
                "version": "v1",
                "payload": {
                    "title": "为什么系统这样判断",
                    "subtitle": "系统会同时看答案、路线分差、top2 和 veto，而不是只凭一题就下结论。",
                    "items": [
                        "要明确 top1 为什么赢过 top2，而不是只重复最终路线名。",
                        "要把题目贡献、路线分差和 veto 一起翻译成人能懂的话。",
                        "如果产品分析缺失，也要明确说明当前证据还不完整。",
                    ],
                    "note": "证据层要让用户看懂判断过程，而不是只看到一个神秘结论。",
                },
            },
            {
                "id": "product_bridge",
                "kind": "strategy",
                "version": "v1",
                "payload": {
                    "title": "为什么先给你这类或这款",
                    "subtitle": "主推产品只负责承接这条路线，目的是让产品服务于解释，而不是反过来定义你。",
                    "items": [
                        "先讲这类或这款为什么能承接当前主线，不要抢走结果页主线。",
                        "如果产品分析证据不足，必须如实写明，不准假装完整。",
                        "推荐语要回到适配度和证据，不要写成营销话术。",
                    ],
                    "note": "产品承接是最后一步，始终要让解释层站在产品前面。",
                },
            },
        ],
        "ctas": [
            {"id": "open_product", "label": "查看产品详情", "action": "product", "href": "", "payload": {}},
            {"id": "open_wiki", "label": "查看成分百科", "action": "wiki", "href": "", "payload": {}},
            {"id": "restart", "label": "重新判断一次", "action": "restart", "href": "", "payload": {}},
        ],
    }


def _build_route_mapping(client, category: str) -> None:
    resp = client.post(
        "/api/products/route-mapping/build",
        json={"category": category, "force_regenerate": True},
    )
    assert resp.status_code == 200
    payload = resp.json()
    assert payload["failed"] == 0
    assert payload["submitted_to_model"] >= 1


def _find_first_product_id(client, category: str) -> str:
    resp = client.get("/api/products")
    assert resp.status_code == 200
    payload = resp.json()
    items = payload.get("items", []) if isinstance(payload, dict) else payload
    for item in items:
        if str(item.get("category", "")).strip().lower() == category:
            return str(item["id"])
    raise AssertionError(f"no product found for category={category}")


def _set_featured_slot(client, category: str, target_type_key: str, product_id: str | None = None) -> str:
    pid = product_id or _find_first_product_id(client, category)
    resp = client.post(
        "/api/products/featured-slots",
        json={
            "category": category,
            "target_type_key": target_type_key,
            "product_id": pid,
            "updated_by": "pytest",
        },
    )
    assert resp.status_code == 200
    return pid


def test_product_featured_slots_get_route_is_not_shadowed_by_product_detail(test_client, monkeypatch: pytest.MonkeyPatch):
    client, _ = test_client
    _install_fake_ingest_pipeline(
        monkeypatch,
        {
            "category": "shampoo",
            "brand": "Dove",
            "name": "Shampoo Featured Slot Route",
            "one_sentence": "featured slot route test",
        },
    )
    product_id = _ingest_one(client, "featured-slot-route.jpg")
    _set_featured_slot(client, "shampoo", "moisture-balance", product_id)

    resp = client.get("/api/products/featured-slots", params={"category": "shampoo"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert body["category"] == "shampoo"
    assert body["total"] >= 1
    assert any(
        item["product_id"] == product_id and item["target_type_key"] == "moisture-balance"
        for item in body["items"]
    )


def test_mobile_selection_resolve_without_featured_slot_uses_fallback(test_client, monkeypatch: pytest.MonkeyPatch):
    client, _ = test_client
    _install_fake_ingest_pipeline(
        monkeypatch,
        {
            "category": "shampoo",
            "brand": "Dove",
            "name": "Shampoo Strict",
            "one_sentence": "strict 主推测试",
        },
    )
    _ingest_one(client, "shampoo-strict.jpg")
    _install_fake_route_mapping_builder(monkeypatch)
    _build_route_mapping(client, "shampoo")

    resp = client.post(
        "/api/mobile/selection/resolve",
        json={
            "category": "shampoo",
            "answers": {"q1": "A", "q2": "C", "q3": "B"},
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert body["recommended_product"]["id"]
    assert body["recommended_product"]["category"] == "shampoo"
    assert body["recommendation_source"] == "route_mapping"
    assert body["matrix_analysis"]["routes"][0]["route_key"]
    assert len(body["matrix_analysis"]["routes"]) == 5


def test_mobile_selection_resolve_shampoo_route_mapping(test_client, monkeypatch: pytest.MonkeyPatch):
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
    _ingest_one(client, "shampoo.jpg")
    _install_fake_route_mapping_builder(monkeypatch)
    _build_route_mapping(client, "shampoo")
    _set_featured_slot(client, "shampoo", "deep-oil-control")

    resp = client.post(
        "/api/mobile/selection/resolve",
        json={
            "category": "shampoo",
            "answers": {"q1": "A", "q2": "C", "q3": "B"},
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert body["route"]["key"] == "deep-oil-control"
    assert body["route"]["title"] == "深层控油型"
    assert body["links"]["wiki"].endswith("focus=deep-oil-control")
    assert body["recommended_product"]["category"] == "shampoo"
    assert body["recommended_product"]["id"]
    assert body["recommendation_source"] == "featured_slot"
    assert body["matrix_analysis"]["top2"][0]["route_key"] == "deep-oil-control"
    assert body["matrix_analysis"]["routes"][0]["route_title"]


def test_mobile_selection_resolve_bodywash_fastpath(test_client, monkeypatch: pytest.MonkeyPatch):
    client, _ = test_client
    _install_fake_ingest_pipeline(
        monkeypatch,
        {
            "category": "bodywash",
            "brand": "CeraVe",
            "name": "BodyWash B",
            "one_sentence": "沐浴测试",
        },
    )
    _ingest_one(client, "bodywash.jpg")
    _install_fake_route_mapping_builder(monkeypatch)
    _build_route_mapping(client, "bodywash")
    _set_featured_slot(client, "bodywash", "rescue")

    resp = client.post(
        "/api/mobile/selection/resolve",
        json={
            "category": "bodywash",
            "answers": {"q1": "B", "q2": "A", "q3": "A", "q4": "A", "q5": "B"},
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["route"]["key"] == "rescue"
    assert body["route"]["title"] == "恒温舒缓修护型"
    assert [item["key"] for item in body["choices"]] == ["q1", "q2", "q3", "q4", "q5"]


def test_mobile_selection_resolve_conditioner_matrix(test_client, monkeypatch: pytest.MonkeyPatch):
    client, _ = test_client
    _install_fake_ingest_pipeline(
        monkeypatch,
        {
            "category": "conditioner",
            "brand": "Pantene",
            "name": "Conditioner Matrix",
            "one_sentence": "护发素矩阵测试",
        },
    )
    _ingest_one(client, "conditioner.jpg")
    _set_featured_slot(client, "conditioner", "__category__")

    resp = client.post(
        "/api/mobile/selection/resolve",
        json={
            "category": "conditioner",
            "answers": {"c_q1": "A", "c_q2": "A", "c_q3": "A"},
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["route"]["key"] == "c-color-lock"
    assert body["route"]["title"] == "锁色固色型"
    assert [item["key"] for item in body["choices"]] == ["c_q1", "c_q2", "c_q3"]
    assert any(item["rule"] == "veto" for item in body["rule_hits"])
    assert len(body["matrix_analysis"]["triggered_vetoes"]) >= 1


def test_mobile_selection_resolve_cleanser_matrix(test_client, monkeypatch: pytest.MonkeyPatch):
    client, _ = test_client
    _install_fake_ingest_pipeline(
        monkeypatch,
        {
            "category": "cleanser",
            "brand": "Freeplus",
            "name": "Cleanser Matrix",
            "one_sentence": "洁面矩阵测试",
        },
    )
    _ingest_one(client, "cleanser-matrix.jpg")
    _set_featured_slot(client, "cleanser", "__category__")

    resp = client.post(
        "/api/mobile/selection/resolve",
        json={
            "category": "cleanser",
            "answers": {"q1": "B", "q2": "A", "q3": "B", "q4": "E", "q5": "D"},
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["route"]["key"] == "pure_amino"
    assert body["route"]["title"] == "纯氨基酸温和型"
    assert [item["key"] for item in body["choices"]] == ["q1", "q2", "q3", "q4", "q5"]
    assert any(item["rule"] == "veto" for item in body["rule_hits"])


def test_mobile_selection_resolve_lotion_matrix(test_client, monkeypatch: pytest.MonkeyPatch):
    client, _ = test_client
    _install_fake_ingest_pipeline(
        monkeypatch,
        {
            "category": "lotion",
            "brand": "CeraVe",
            "name": "Lotion Matrix",
            "one_sentence": "身体乳矩阵测试",
        },
    )
    _ingest_one(client, "lotion-matrix.jpg")
    _set_featured_slot(client, "lotion", "__category__")

    resp = client.post(
        "/api/mobile/selection/resolve",
        json={
            "category": "lotion",
            "answers": {"q1": "A", "q2": "A", "q3": "A", "q4": "C", "q5": "A"},
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["route"]["key"] == "heavy_repair"
    assert body["route"]["title"] == "重度修护型"
    assert [item["key"] for item in body["choices"]] == ["q1", "q2", "q3", "q4", "q5"]
    assert any(item["rule"] == "veto" for item in body["rule_hits"])


def test_mobile_selection_resolve_reuse_existing_session(test_client, monkeypatch: pytest.MonkeyPatch):
    client, _ = test_client
    _install_fake_ingest_pipeline(
        monkeypatch,
        {
            "category": "cleanser",
            "brand": "Freeplus",
            "name": "Cleanser C",
            "one_sentence": "洁面测试",
        },
    )
    _ingest_one(client, "cleanser.jpg")
    _set_featured_slot(client, "cleanser", "__category__")

    payload = {
        "category": "cleanser",
        "answers": {
            "q1": "B",
            "q2": "B",
            "q3": "B",
            "q4": "E",
            "q5": "C",
        },
        "reuse_existing": True,
    }
    first = client.post("/api/mobile/selection/resolve", json=payload)
    assert first.status_code == 200
    first_body = first.json()
    assert first_body["reused"] is False

    second = client.post("/api/mobile/selection/resolve", json=payload)
    assert second.status_code == 200
    second_body = second.json()
    assert second_body["reused"] is True
    assert second_body["session_id"] == first_body["session_id"]
    assert len(second_body["matrix_analysis"]["routes"]) == 6


def test_mobile_selection_isolated_by_device_cookie(test_client, monkeypatch: pytest.MonkeyPatch):
    client, _ = test_client
    _install_fake_ingest_pipeline(
        monkeypatch,
        {
            "category": "shampoo",
            "brand": "Dove",
            "name": "Shampoo Z",
            "one_sentence": "隔离测试",
        },
    )
    _ingest_one(client, "isolation.jpg")
    _install_fake_route_mapping_builder(monkeypatch)
    _build_route_mapping(client, "shampoo")
    _set_featured_slot(client, "shampoo", "deep-oil-control")

    payload = {
        "category": "shampoo",
        "answers": {"q1": "A", "q2": "C", "q3": "B"},
        "reuse_existing": True,
    }
    first = client.post("/api/mobile/selection/resolve", json=payload)
    assert first.status_code == 200
    first_body = first.json()
    assert first_body["reused"] is False

    with TestClient(client.app) as another_device:
        second = another_device.post("/api/mobile/selection/resolve", json=payload)
        assert second.status_code == 200
        second_body = second.json()
        assert second_body["reused"] is False
        assert second_body["session_id"] != first_body["session_id"]

        listed = another_device.get("/api/mobile/selection/sessions")
        assert listed.status_code == 200
        listed_ids = {item["session_id"] for item in listed.json()}
        assert first_body["session_id"] not in listed_ids


def test_mobile_selection_batch_delete_scoped_by_owner(test_client, monkeypatch: pytest.MonkeyPatch):
    client, _ = test_client
    _install_fake_ingest_pipeline(
        monkeypatch,
        {
            "category": "bodywash",
            "brand": "CeraVe",
            "name": "BodyWash D",
            "one_sentence": "删除测试",
        },
    )
    _ingest_one(client, "delete.jpg")
    _install_fake_route_mapping_builder(monkeypatch)
    _build_route_mapping(client, "bodywash")
    _set_featured_slot(client, "bodywash", "rescue")

    payload = {"category": "bodywash", "answers": {"q1": "B", "q2": "A", "q3": "A", "q4": "A", "q5": "B"}}

    first = client.post("/api/mobile/selection/resolve", json=payload)
    assert first.status_code == 200
    first_session_id = first.json()["session_id"]

    with TestClient(client.app) as another_device:
        second = another_device.post("/api/mobile/selection/resolve", json=payload)
        assert second.status_code == 200
        second_session_id = second.json()["session_id"]

        deleted = another_device.post(
            "/api/mobile/selection/sessions/batch/delete",
            json={"ids": [second_session_id, first_session_id, "missing-id"]},
        )
        assert deleted.status_code == 200
        body = deleted.json()
        assert body["deleted_ids"] == [second_session_id]
        assert body["forbidden_ids"] == [first_session_id]
        assert body["not_found_ids"] == ["missing-id"]

        listed = another_device.get("/api/mobile/selection/sessions")
        assert listed.status_code == 200
        listed_ids = [item["session_id"] for item in listed.json()]
        assert second_session_id not in listed_ids

    listed_self = client.get("/api/mobile/selection/sessions")
    assert listed_self.status_code == 200
    listed_self_ids = [item["session_id"] for item in listed_self.json()]
    assert first_session_id in listed_self_ids


def test_mobile_selection_resolve_with_forwarded_device_header(test_client, monkeypatch: pytest.MonkeyPatch):
    client, _ = test_client
    _install_fake_ingest_pipeline(
        monkeypatch,
        {
            "category": "lotion",
            "brand": "CeraVe",
            "name": "Lotion Header",
            "one_sentence": "header 归属测试",
        },
    )
    _ingest_one(client, "lotion.jpg")
    _set_featured_slot(client, "lotion", "__category__")

    headers = {"x-mobile-device-id": "device-header-001"}
    payload = {
        "category": "lotion",
        "answers": {
            "q1": "D",
            "q2": "B",
            "q3": "E",
            "q4": "B",
            "q5": "C",
        },
    }
    resolved = client.post("/api/mobile/selection/resolve", json=payload, headers=headers)
    assert resolved.status_code == 200
    session_id = resolved.json()["session_id"]

    listed_same_owner = client.get("/api/mobile/selection/sessions", headers=headers)
    assert listed_same_owner.status_code == 200
    ids_same_owner = [item["session_id"] for item in listed_same_owner.json()]
    assert session_id in ids_same_owner

    listed_other_owner = client.get(
        "/api/mobile/selection/sessions",
        headers={"x-mobile-device-id": "device-header-002"},
    )
    assert listed_other_owner.status_code == 200
    ids_other_owner = [item["session_id"] for item in listed_other_owner.json()]
    assert session_id not in ids_other_owner


def test_mobile_selection_pin_and_list_order(test_client, monkeypatch: pytest.MonkeyPatch):
    client, _ = test_client
    _install_fake_ingest_pipeline(
        monkeypatch,
        {
            "category": "shampoo",
            "brand": "Dove",
            "name": "Pin Order",
            "one_sentence": "置顶排序测试",
        },
    )
    _ingest_one(client, "pin-order.jpg")
    _install_fake_route_mapping_builder(monkeypatch)
    _build_route_mapping(client, "shampoo")
    _set_featured_slot(client, "shampoo", "deep-oil-control")

    first = client.post(
        "/api/mobile/selection/resolve",
        json={"category": "shampoo", "answers": {"q1": "A", "q2": "C", "q3": "B"}, "reuse_existing": False},
    )
    assert first.status_code == 200
    first_id = first.json()["session_id"]

    second = client.post(
        "/api/mobile/selection/resolve",
        json={"category": "shampoo", "answers": {"q1": "A", "q2": "C", "q3": "B"}, "reuse_existing": False},
    )
    assert second.status_code == 200
    second_id = second.json()["session_id"]
    assert first_id != second_id

    pin_resp = client.post(
        f"/api/mobile/selection/sessions/{first_id}/pin",
        json={"pinned": True},
    )
    assert pin_resp.status_code == 200
    pinned = pin_resp.json()
    assert pinned["session_id"] == first_id
    assert pinned["is_pinned"] is True
    assert pinned["pinned_at"]

    listed = client.get("/api/mobile/selection/sessions")
    assert listed.status_code == 200
    rows = listed.json()
    assert rows[0]["session_id"] == first_id
    assert rows[0]["is_pinned"] is True
    assert rows[1]["session_id"] == second_id

    unpin_resp = client.post(
        f"/api/mobile/selection/sessions/{first_id}/pin",
        json={"pinned": False},
    )
    assert unpin_resp.status_code == 200
    unpinned = unpin_resp.json()
    assert unpinned["is_pinned"] is False
    assert unpinned["pinned_at"] is None


def test_mobile_selection_result_publish_and_lookup(test_client, monkeypatch: pytest.MonkeyPatch):
    client, storage_dir = test_client
    _install_fake_ingest_pipeline(
        monkeypatch,
        {
            "category": "shampoo",
            "brand": "Dove",
            "name": "Scenario Publish",
            "one_sentence": "预生成结果发布测试",
        },
    )
    _ingest_one(client, "selection-result-publish.jpg")

    payload = {
        "category": "shampoo",
        "answers": {"q1": "A", "q2": "C", "q3": "B"},
        "micro_summary": "先稳住油脂分泌",
        "blocks": [
            {
                "id": "hero",
                "kind": "hero",
                "version": "v1",
                "payload": {
                    "title": "先稳住油脂分泌",
                    "subtitle": "这是第一版发布稿",
                },
            },
            {
                "id": "situation",
                "kind": "explanation",
                "version": "v1",
                "payload": {
                    "title": "你现在更像什么情况",
                    "subtitle": "当前答案更偏向头皮油脂管理优先，先稳住出油再谈附加诉求。",
                },
            },
            {
                "id": "attention",
                "kind": "strategy",
                "version": "v1",
                "payload": {
                    "title": "你当前最该抓住什么",
                    "subtitle": "优先把高频出油带来的负担拉平，先把稳定性做好。",
                },
            },
            {
                "id": "pitfalls",
                "kind": "warning",
                "version": "v1",
                "payload": {
                    "title": "你现在最该少踩的坑",
                    "subtitle": "不要只追求即时清爽感，避免把刺激性推得过高。",
                },
            },
        ],
        "ctas": [
            {
                "id": "open_product",
                "label": "查看产品",
                "action": "product",
                "href": "/product/mock",
                "payload": {},
            },
            {
                "id": "open_wiki",
                "label": "查看百科",
                "action": "wiki",
                "href": "/m/wiki/shampoo",
                "payload": {},
            },
            {
                "id": "restart_compare",
                "label": "重新测评",
                "action": "compare",
                "href": "/m/compare?category=shampoo",
                "payload": {},
            },
        ],
        "display_order": ["hero", "situation", "attention", "pitfalls", "ctas"],
        "raw_payload": {
            "headline": "draft hero",
            "notes": ["draft"],
        },
        "prompt_key": "mobile.selection.result",
        "prompt_version": "v1",
        "model": "mock-model",
    }
    published = client.post("/api/mobile/selection/results/publish", json=payload)
    assert published.status_code == 200
    published_body = published.json()
    item = published_body["item"]
    assert item["status"] == "ready"
    assert item["route_key"] == "deep-oil-control"
    assert item["storage_path"]
    assert item["published_version_path"]
    assert item["raw_storage_path"]
    assert (storage_dir / item["storage_path"]).exists()
    assert (storage_dir / item["published_version_path"]).exists()
    assert (storage_dir / item["raw_storage_path"]).exists()

    looked_up = client.post(
        "/api/mobile/selection/result",
        json={"category": "shampoo", "answers": {"q1": "A", "q2": "C", "q3": "B"}},
    )
    assert looked_up.status_code == 200
    result_item = looked_up.json()["item"]
    assert result_item["category"] == "shampoo"
    assert result_item["renderer_variant"] == "selection_result_default"
    assert result_item["blocks"][0]["payload"]["title"] == "先稳住油脂分泌"
    assert result_item["ctas"][0]["id"] == "open_product"
    assert result_item["meta"]["contract_version"] == "selection_result.v3"
    assert result_item["recommended_product"]["category"] == "shampoo"
    assert result_item["recommendation_source"] == "category_fallback"
    raw_doc = json.loads((storage_dir / item["raw_storage_path"]).read_text(encoding="utf-8"))
    assert raw_doc["selection_result_v3_contract"]["schema_version"] == "selection_result.v3"
    assert len(raw_doc["selection_result_v3_contract"]["reasons"]) == 3


def test_mobile_selection_result_republish_overwrites_active_payload(test_client, monkeypatch: pytest.MonkeyPatch):
    client, storage_dir = test_client
    _install_fake_ingest_pipeline(
        monkeypatch,
        {
            "category": "bodywash",
            "brand": "Aveeno",
            "name": "Scenario Republish",
            "one_sentence": "预生成结果覆盖更新测试",
        },
    )
    _ingest_one(client, "selection-result-republish.jpg")

    base_payload = {
        "category": "bodywash",
        "answers": {"q1": "A", "q2": "A", "q3": "A", "q4": "A", "q5": "A"},
        "micro_summary": "先稳住屏障修护",
        "blocks": [
            {
                "id": "hero",
                "kind": "hero",
                "version": "v1",
                "payload": {"title": "第一版标题", "subtitle": "第一版副标题"},
            },
            {
                "id": "situation",
                "kind": "explanation",
                "version": "v1",
                "payload": {
                    "title": "你现在更像什么情况",
                    "subtitle": "皮肤屏障状态更需要优先修护，避免频繁波动。",
                },
            },
            {
                "id": "attention",
                "kind": "strategy",
                "version": "v1",
                "payload": {
                    "title": "你当前最该抓住什么",
                    "subtitle": "先稳住干痒和泛红触发点，再逐步优化肤感细节。",
                },
            },
            {
                "id": "pitfalls",
                "kind": "warning",
                "version": "v1",
                "payload": {
                    "title": "你现在最该少踩的坑",
                    "subtitle": "避免只堆清洁强度，导致短期舒适但长期更敏感。",
                },
            },
        ],
        "ctas": [
            {
                "id": "open_product",
                "label": "查看产品",
                "action": "product",
                "href": "/product/mock-bodywash",
                "payload": {},
            },
            {
                "id": "open_wiki",
                "label": "查看百科",
                "action": "wiki",
                "href": "/m/wiki/bodywash",
                "payload": {},
            },
            {
                "id": "restart_compare",
                "label": "重新测评",
                "action": "compare",
                "href": "/m/compare?category=bodywash",
                "payload": {},
            },
        ],
        "display_order": ["hero", "situation", "attention", "pitfalls", "ctas"],
        "prompt_key": "mobile.selection.result",
        "prompt_version": "v1",
        "model": "mock-model",
        "raw_payload": {"revision": 1},
    }
    first = client.post("/api/mobile/selection/results/publish", json=base_payload)
    assert first.status_code == 200
    first_item = first.json()["item"]

    second_payload = dict(base_payload)
    second_payload["blocks"] = [
        {
            "id": "hero",
            "kind": "hero",
            "version": "v2",
            "payload": {"title": "第二版标题", "subtitle": "第二版副标题"},
        },
        *base_payload["blocks"][1:],
    ]
    second_payload["prompt_version"] = "v2"
    second_payload["raw_payload"] = {"revision": 2}
    second = client.post("/api/mobile/selection/results/publish", json=second_payload)
    assert second.status_code == 200
    second_item = second.json()["item"]
    assert first_item["scenario_id"] == second_item["scenario_id"]
    assert first_item["published_version_path"] != second_item["published_version_path"]
    assert (storage_dir / second_item["published_version_path"]).exists()

    active_doc = json.loads((storage_dir / second_item["storage_path"]).read_text(encoding="utf-8"))
    assert active_doc["blocks"][0]["payload"]["title"] == "第二版标题"
    assert active_doc["meta"]["prompt_version"] == "v2"
    assert active_doc["meta"]["contract_version"] == "selection_result.v3"
    second_raw_doc = json.loads((storage_dir / second_item["raw_storage_path"]).read_text(encoding="utf-8"))
    assert second_raw_doc["revision"] == 2
    assert second_raw_doc["selection_result_v3_contract"]["summary"]["headline"] == "第二版标题"

    looked_up = client.post(
        "/api/mobile/selection/result",
        json={"category": "bodywash", "answers": {"q1": "A", "q2": "A", "q3": "A", "q4": "A", "q5": "A"}},
    )
    assert looked_up.status_code == 200
    assert looked_up.json()["item"]["blocks"][0]["payload"]["title"] == "第二版标题"


def test_mobile_selection_result_build_generates_v2_content(test_client, monkeypatch: pytest.MonkeyPatch):
    client, _storage_dir = test_client
    _install_fake_ingest_pipeline(
        monkeypatch,
        {
            "category": "shampoo",
            "brand": "Dove",
            "name": "Selection Build Source",
            "one_sentence": "selection result build source",
        },
    )
    _ingest_one(client, "selection-result-build.jpg")
    _install_fake_route_mapping_builder(monkeypatch)
    _build_route_mapping(client, "shampoo")
    _install_fake_selection_result_builder(monkeypatch)

    built = client.post(
        "/api/products/selection-results/build",
        json={"category": "shampoo", "force_regenerate": True},
    )
    assert built.status_code == 200
    body = built.json()
    assert body["status"] == "ok"
    assert body["scanned_scenarios"] == 36
    assert body["created"] == 36
    assert body["updated"] == 0
    assert body["failed"] == 0
    assert body["submitted_to_model"] == 36

    looked_up = client.post(
        "/api/mobile/selection/result",
        json={"category": "shampoo", "answers": {"q1": "A", "q2": "C", "q3": "B"}},
    )
    assert looked_up.status_code == 200
    result_item = looked_up.json()["item"]
    assert result_item["schema_version"] == "selection_result_content.v2"
    assert result_item["micro_summary"]
    assert result_item["share_copy"]["title"]
    assert result_item["blocks"][0]["id"] == "hero"
    assert result_item["ctas"][0]["id"] == "open_product"


def test_selection_result_normalizer_allows_hero_without_items():
    payload = _sample_selection_result_content()
    payload["blocks"][0]["payload"].pop("items")

    normalized = ai_capabilities._normalize_mobile_selection_result_content(payload)

    assert normalized["blocks"][0]["id"] == "hero"
    assert "items" not in normalized["blocks"][0]["payload"]


def test_mobile_selection_result_build_accepts_relaxed_hero_contract(test_client, monkeypatch: pytest.MonkeyPatch):
    client, _storage_dir = test_client
    _install_fake_ingest_pipeline(
        monkeypatch,
        {
            "category": "shampoo",
            "brand": "Dove",
            "name": "Selection Build Relaxed Hero",
            "one_sentence": "selection result relaxed hero source",
        },
    )
    _ingest_one(client, "selection-result-relaxed-hero.jpg")
    _install_fake_route_mapping_builder(monkeypatch)
    _build_route_mapping(client, "shampoo")
    _install_fake_selection_result_builder(
        monkeypatch,
        hero_title="你当前更该先走平衡修护主线",
        hero_subtitle="系统会先根据你的答案判断当前更该优先处理哪条护理主线，再把产品承接进来。",
        hero_items=[],
    )

    built = client.post(
        "/api/products/selection-results/build",
        json={"category": "shampoo", "force_regenerate": True},
    )
    assert built.status_code == 200
    body = built.json()
    assert body["status"] == "ok"
    assert body["failed"] == 0
    assert body["submitted_to_model"] == 36


def test_mobile_selection_result_missing_returns_strict_error(test_client):
    client, _ = test_client
    missing = client.post(
        "/api/mobile/selection/result",
        json={"category": "shampoo", "answers": {"q1": "A", "q2": "C", "q3": "B"}},
    )
    assert missing.status_code == 404
    body = missing.json()
    assert body["detail"]["code"] == "SELECTION_RESULT_PRECOMPUTED_MISSING"
    assert body["detail"]["stage"] == "selection_result_lookup"
    assert body["detail"]["category"] == "shampoo"
