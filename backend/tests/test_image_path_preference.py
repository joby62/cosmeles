import json
from pathlib import Path

import pytest

from app.routes import ingest as ingest_routes
from app.routes import products as products_routes
from app.services.storage import preferred_image_rel_path, product_analysis_rel_path
from backend.tests.support_images import VALID_TEST_IMAGE_BYTES, install_fake_save_image


ROUTE_TITLES = {
    "shampoo": {
        "deep-oil-control": "深层控油型",
        "moisture-balance": "水油平衡型",
        "gentle-soothing": "温和舒缓型",
    },
    "bodywash": {
        "rescue": "舒缓修护型",
        "shield": "屏障维稳型",
        "glow": "亮肤提光型",
    },
}


def _build_manual_doc(
    category: str = "shampoo",
    *,
    brand: str = "TestBrand",
    name: str = "Test Product",
    one_sentence: str = "测试摘要",
) -> dict:
    return {
        "product": {"category": category, "brand": brand, "name": name},
        "summary": {
            "one_sentence": one_sentence,
            "pros": ["温和清洁"],
            "cons": [],
            "who_for": ["普通肤质"],
            "who_not_for": [],
        },
        "ingredients": [
            {
                "name": "甘油",
                "type": "保湿剂",
                "functions": ["保湿"],
                "risk": "low",
                "notes": "",
                "rank": 1,
                "abundance_level": "major",
                "order_confidence": 92,
            }
        ],
        "evidence": {"doubao_raw": ""},
    }


def _ingest_manual_with_image(
    client,
    *,
    category: str = "shampoo",
    brand: str = "TestBrand",
    name: str = "Test Product",
    one_sentence: str = "测试摘要",
) -> dict:
    resp = client.post(
        "/api/upload",
        data={
            "source": "manual",
            "meta_json": json.dumps(
                _build_manual_doc(
                    category=category,
                    brand=brand,
                    name=name,
                    one_sentence=one_sentence,
                ),
                ensure_ascii=False,
            ),
        },
        files={"image": ("sample.png", VALID_TEST_IMAGE_BYTES, "image/png")},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    return body


def _build_fake_route_mapping_payload(*, category: str, primary_key: str, secondary_key: str) -> dict:
    titles = ROUTE_TITLES[category]
    return {
        "category": category,
        "rules_version": "2026-03-03.1",
        "primary_route": {
            "route_key": primary_key,
            "route_title": titles[primary_key],
            "confidence": 92,
            "reason": "mock primary",
        },
        "secondary_route": {
            "route_key": secondary_key,
            "route_title": titles[secondary_key],
            "confidence": 70,
            "reason": "mock secondary",
        },
        "route_scores": [
            {
                "route_key": primary_key,
                "route_title": titles[primary_key],
                "confidence": 92,
                "reason": "mock primary",
            },
            {
                "route_key": secondary_key,
                "route_title": titles[secondary_key],
                "confidence": 70,
                "reason": "mock secondary",
            },
        ],
        "evidence": {
            "positive": [
                {
                    "ingredient_name_cn": "甘油",
                    "ingredient_name_en": "Glycerin",
                    "rank": 1,
                    "impact": "mock evidence",
                }
            ],
            "counter": [],
        },
        "confidence_reason": "mock route mapping",
        "needs_review": False,
        "analysis_text": "{\"mock\":true}",
        "model": "mock-pro",
    }


def _build_fake_analysis_payload(*, category: str, route_key: str, route_title: str) -> dict:
    base = {
        "schema_version": f"product_profile_{category}.v1",
        "category": category,
        "route_key": route_key,
        "route_title": route_title,
        "headline": f"{route_title} 产品增强分析",
        "positioning_summary": "这是一份用于 wiki 准入测试的增强分析。",
        "subtype_fit_verdict": "strong_fit",
        "subtype_fit_reason": "mock profile says the route is supported.",
        "best_for": ["适合对象A"],
        "not_ideal_for": ["不适合对象A"],
        "usage_tips": ["建议A"],
        "watchouts": ["注意A"],
        "key_ingredients": [
            {
                "ingredient_name_cn": "甘油",
                "ingredient_name_en": "Glycerin",
                "rank": 1,
                "role": "保湿",
                "impact": "提供基础保湿支持。",
            }
        ],
        "evidence": {
            "positive": [
                {
                    "ingredient_name_cn": "甘油",
                    "ingredient_name_en": "Glycerin",
                    "rank": 1,
                    "impact": "mock positive",
                }
            ],
            "counter": [],
            "missing_codes": [],
        },
        "confidence": 88,
        "confidence_reason": "mock profile",
        "needs_review": False,
    }
    if category == "shampoo":
        return {
            **base,
            "diagnostics": {
                "cleanse_intensity": {"score": 4, "reason": "mock"},
                "oil_control_support": {"score": 4, "reason": "mock"},
                "dandruff_itch_support": {"score": 1, "reason": "mock"},
                "scalp_soothing_support": {"score": 2, "reason": "mock"},
                "hair_strengthening_support": {"score": 1, "reason": "mock"},
                "moisture_balance_support": {"score": 3, "reason": "mock"},
                "daily_use_friendliness": {"score": 3, "reason": "mock"},
                "residue_weight": {"score": 1, "reason": "mock"},
            },
        }
    if category == "bodywash":
        return {
            **base,
            "diagnostics": {
                "cleanse_intensity": {"score": 3, "reason": "mock"},
                "barrier_repair_support": {"score": 3, "reason": "mock"},
                "body_acne_support": {"score": 1, "reason": "mock"},
                "keratin_softening_support": {"score": 1, "reason": "mock"},
                "brightening_support": {"score": 2, "reason": "mock"},
                "fragrance_presence": {"score": 2, "reason": "mock"},
                "rinse_afterfeel_nourishment": {"score": 3, "reason": "mock"},
            },
        }
    raise AssertionError(f"unsupported fake analysis category: {category}")


def _install_fake_wiki_capabilities(
    monkeypatch: pytest.MonkeyPatch,
    *,
    route_plans_by_product_name: dict[str, dict[str, str]],
    include_ingredient_profile: bool = False,
) -> None:
    def fake_run_capability_now(*, capability, input_payload, trace_id=None, event_callback=None):
        if capability.startswith("doubao.route_mapping_"):
            context = json.loads(input_payload["product_context_json"])
            product_name = str(context.get("name") or "").strip()
            plan = route_plans_by_product_name.get(product_name)
            assert plan is not None, f"missing route plan for {product_name}"
            return _build_fake_route_mapping_payload(
                category=plan["category"],
                primary_key=plan["primary_key"],
                secondary_key=plan["secondary_key"],
            )
        if capability.startswith("doubao.product_profile_"):
            context = json.loads(input_payload["product_analysis_context_json"])
            category = str(context["product"]["category"]).strip()
            route_key = str(context["route_mapping"]["primary_route_key"]).strip()
            route_title = str(context["route_mapping"]["primary_route_title"]).strip()
            return _build_fake_analysis_payload(
                category=category,
                route_key=route_key,
                route_title=route_title,
            )
        if capability == "doubao.ingredient_category_profile" and include_ingredient_profile:
            ingredient_name = input_payload["ingredient"]
            return {
                "ingredient_name": ingredient_name,
                "ingredient_name_en": "Glycerin",
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
                "model": "mock-pro",
            }
        raise AssertionError(f"unexpected capability: {capability}")

    monkeypatch.setattr(products_routes, "run_capability_now", fake_run_capability_now)


def _build_wiki_ready_products(client, *, category: str) -> None:
    route_resp = client.post(
        "/api/products/route-mapping/build",
        json={"category": category, "force_regenerate": True},
    )
    assert route_resp.status_code == 200
    assert route_resp.json()["failed"] == 0

    analysis_resp = client.post(
        "/api/products/analysis/build",
        json={"category": category, "force_regenerate": True},
    )
    assert analysis_resp.status_code == 200
    assert analysis_resp.json()["failed"] == 0


def test_preferred_image_rel_path_prefers_webp_then_jpg(test_client):
    _, storage_dir = test_client
    webp_rel = "images/webp/shampoo/pref-test.webp"
    jpg_rel = "images/jpg/shampoo/pref-test.jpg"
    webp_abs = Path(storage_dir) / webp_rel
    jpg_abs = Path(storage_dir) / jpg_rel
    webp_abs.parent.mkdir(parents=True, exist_ok=True)
    jpg_abs.parent.mkdir(parents=True, exist_ok=True)
    webp_abs.write_bytes(b"webp")
    jpg_abs.write_bytes(b"jpg")

    assert preferred_image_rel_path(jpg_rel) == webp_rel

    webp_abs.unlink()
    assert preferred_image_rel_path(webp_rel) == jpg_rel


def test_products_and_mobile_wiki_use_webp_then_jpg_fallback(test_client, monkeypatch: pytest.MonkeyPatch):
    client, storage_dir = test_client
    install_fake_save_image(monkeypatch, ingest_routes)

    created = _ingest_manual_with_image(client, category="shampoo")
    product_id = created["id"]
    _install_fake_wiki_capabilities(
        monkeypatch,
        route_plans_by_product_name={
            "Test Product": {
                "category": "shampoo",
                "primary_key": "deep-oil-control",
                "secondary_key": "moisture-balance",
            }
        },
    )
    _build_wiki_ready_products(client, category="shampoo")
    image_rel = str(created["image_path"])
    assert image_rel.endswith(".webp")
    webp_abs = Path(storage_dir) / image_rel
    assert webp_abs.exists()
    jpg_rel = image_rel.replace("images/webp/", "images/jpg/").replace(".webp", ".jpg")
    jpg_abs = Path(storage_dir) / jpg_rel
    assert jpg_abs.exists()

    products = client.get("/api/products")
    assert products.status_code == 200
    product_item = next(item for item in products.json() if item["id"] == product_id)
    assert str(product_item["image_url"]).endswith(".webp")
    assert "/images/webp/" in str(product_item["image_url"])

    detail = client.get(f"/api/products/{product_id}")
    assert detail.status_code == 200
    assert str(detail.json()["evidence"]["image_path"]).endswith(".webp")

    wiki_list = client.get("/api/mobile/wiki/products", params={"category": "shampoo"})
    assert wiki_list.status_code == 200
    wiki_item = next(item for item in wiki_list.json()["items"] if item["product"]["id"] == product_id)
    assert str(wiki_item["product"]["image_url"]).endswith(".webp")

    wiki_detail = client.get(f"/api/mobile/wiki/products/{product_id}")
    assert wiki_detail.status_code == 200
    assert str(wiki_detail.json()["item"]["product"]["image_url"]).endswith(".webp")
    assert str(wiki_detail.json()["item"]["doc"]["evidence"]["image_path"]).endswith(".webp")

    webp_abs.unlink()
    assert not webp_abs.exists()
    assert jpg_abs.exists()

    products_fallback = client.get("/api/products")
    assert products_fallback.status_code == 200
    product_item_fallback = next(item for item in products_fallback.json() if item["id"] == product_id)
    assert str(product_item_fallback["image_url"]).endswith(".jpg")
    assert "/images/jpg/" in str(product_item_fallback["image_url"])

    detail_fallback = client.get(f"/api/products/{product_id}")
    assert detail_fallback.status_code == 200
    assert str(detail_fallback.json()["evidence"]["image_path"]).endswith(".jpg")

    wiki_list_fallback = client.get("/api/mobile/wiki/products", params={"category": "shampoo"})
    assert wiki_list_fallback.status_code == 200
    wiki_item_fallback = next(item for item in wiki_list_fallback.json()["items"] if item["product"]["id"] == product_id)
    assert str(wiki_item_fallback["product"]["image_url"]).endswith(".jpg")

    wiki_detail_fallback = client.get(f"/api/mobile/wiki/products/{product_id}")
    assert wiki_detail_fallback.status_code == 200
    assert str(wiki_detail_fallback.json()["item"]["product"]["image_url"]).endswith(".jpg")
    assert str(wiki_detail_fallback.json()["item"]["doc"]["evidence"]["image_path"]).endswith(".jpg")


def test_mobile_wiki_product_detail_contains_resolved_ingredient_refs(test_client, monkeypatch: pytest.MonkeyPatch):
    client, _ = test_client
    install_fake_save_image(monkeypatch, ingest_routes)

    created = _ingest_manual_with_image(client, category="bodywash")
    product_id = created["id"]
    _install_fake_wiki_capabilities(
        monkeypatch,
        route_plans_by_product_name={
            "Test Product": {
                "category": "bodywash",
                "primary_key": "rescue",
                "secondary_key": "shield",
            }
        },
        include_ingredient_profile=True,
    )
    _build_wiki_ready_products(client, category="bodywash")

    build = client.post(
        "/api/products/ingredients/library/build",
        json={
            "category": "bodywash",
            "normalization_packages": ["unicode_nfkc", "punctuation_fold", "whitespace_fold", "extract_en_parenthesis", "en_exact"],
        },
    )
    assert build.status_code == 200
    build_body = build.json()
    assert build_body["items"]
    target_id = build_body["items"][0]["ingredient_id"]

    wiki_detail = client.get(f"/api/mobile/wiki/products/{product_id}")
    assert wiki_detail.status_code == 200
    refs = wiki_detail.json()["item"]["ingredient_refs"]
    assert refs
    assert refs[0]["status"] == "resolved"
    assert refs[0]["ingredient_id"] == target_id


def test_mobile_wiki_products_uses_backend_pagination(test_client, monkeypatch: pytest.MonkeyPatch):
    client, _ = test_client
    install_fake_save_image(monkeypatch, ingest_routes)

    created_ids: list[str] = []
    route_plans_by_name: dict[str, dict[str, str]] = {}
    for idx in range(30):
        name = f"Pagination Product {idx:02d}"
        resp = client.post(
            "/api/upload",
            data={
                "source": "manual",
                "meta_json": json.dumps(
                    _build_manual_doc(category="shampoo", name=name),
                    ensure_ascii=False,
                ),
            },
            files={"image": (f"pagination-{idx:02d}.png", VALID_TEST_IMAGE_BYTES, "image/png")},
        )
        assert resp.status_code == 200
        created_ids.append(resp.json()["id"])
        route_plans_by_name[name] = {
            "category": "shampoo",
            "primary_key": "deep-oil-control",
            "secondary_key": "moisture-balance",
        }

    _install_fake_wiki_capabilities(
        monkeypatch,
        route_plans_by_product_name=route_plans_by_name,
    )
    _build_wiki_ready_products(client, category="shampoo")

    first_page = client.get(
        "/api/mobile/wiki/products",
        params={"category": "shampoo", "offset": 0, "limit": 24},
    )
    assert first_page.status_code == 200
    first_body = first_page.json()
    assert first_body["total"] == 30
    assert first_body["offset"] == 0
    assert first_body["limit"] == 24
    assert len(first_body["items"]) == 24

    second_page = client.get(
        "/api/mobile/wiki/products",
        params={"category": "shampoo", "offset": 24, "limit": 24},
    )
    assert second_page.status_code == 200
    second_body = second_page.json()
    assert second_body["total"] == 30
    assert second_body["offset"] == 24
    assert second_body["limit"] == 24
    assert len(second_body["items"]) == 6

    first_ids = {item["product"]["id"] for item in first_body["items"]}
    second_ids = {item["product"]["id"] for item in second_body["items"]}
    assert len(first_ids & second_ids) == 0
    assert first_ids | second_ids == set(created_ids)


def test_mobile_wiki_excludes_products_missing_doc_or_analysis(test_client, monkeypatch: pytest.MonkeyPatch):
    client, storage_dir = test_client
    install_fake_save_image(monkeypatch, ingest_routes)

    stable = _ingest_manual_with_image(client, category="shampoo", name="Stable Product")
    missing_doc = _ingest_manual_with_image(client, category="shampoo", name="Missing Doc Product")
    missing_analysis = _ingest_manual_with_image(client, category="shampoo", name="Missing Analysis Product")

    _install_fake_wiki_capabilities(
        monkeypatch,
        route_plans_by_product_name={
            "Stable Product": {
                "category": "shampoo",
                "primary_key": "deep-oil-control",
                "secondary_key": "moisture-balance",
            },
            "Missing Doc Product": {
                "category": "shampoo",
                "primary_key": "deep-oil-control",
                "secondary_key": "moisture-balance",
            },
            "Missing Analysis Product": {
                "category": "shampoo",
                "primary_key": "deep-oil-control",
                "secondary_key": "moisture-balance",
            },
        },
    )
    _build_wiki_ready_products(client, category="shampoo")

    doc_path = Path(storage_dir) / str(missing_doc["json_path"])
    analysis_path = Path(storage_dir) / product_analysis_rel_path("shampoo", missing_analysis["id"])
    assert doc_path.exists()
    assert analysis_path.exists()
    doc_path.unlink()
    analysis_path.unlink()

    wiki_list = client.get("/api/mobile/wiki/products", params={"category": "shampoo"})
    assert wiki_list.status_code == 200
    body = wiki_list.json()
    ids = [item["product"]["id"] for item in body["items"]]
    assert ids == [stable["id"]]
    assert body["total"] == 1

    missing_doc_detail = client.get(f"/api/mobile/wiki/products/{missing_doc['id']}")
    assert missing_doc_detail.status_code == 404
    assert missing_doc_detail.json()["detail"] == f"Product doc for '{missing_doc['id']}' is missing."

    missing_analysis_detail = client.get(f"/api/mobile/wiki/products/{missing_analysis['id']}")
    assert missing_analysis_detail.status_code == 404
    assert missing_analysis_detail.json()["detail"] == f"Product analysis file missing for product '{missing_analysis['id']}'."


def test_mobile_wiki_subtype_filter_uses_primary_route_only(test_client, monkeypatch: pytest.MonkeyPatch):
    client, _ = test_client
    install_fake_save_image(monkeypatch, ingest_routes)

    secondary_match = _ingest_manual_with_image(client, category="shampoo", name="Secondary Match")
    primary_match = _ingest_manual_with_image(client, category="shampoo", name="Primary Match")

    _install_fake_wiki_capabilities(
        monkeypatch,
        route_plans_by_product_name={
            "Secondary Match": {
                "category": "shampoo",
                "primary_key": "deep-oil-control",
                "secondary_key": "moisture-balance",
            },
            "Primary Match": {
                "category": "shampoo",
                "primary_key": "moisture-balance",
                "secondary_key": "deep-oil-control",
            },
        },
    )
    _build_wiki_ready_products(client, category="shampoo")

    wiki_list = client.get(
        "/api/mobile/wiki/products",
        params={
            "category": "shampoo",
            "target_type_key": "moisture-balance",
        },
    )
    assert wiki_list.status_code == 200
    body = wiki_list.json()
    ids = [item["product"]["id"] for item in body["items"]]
    assert ids == [primary_match["id"]]
    assert secondary_match["id"] not in ids
    assert body["total"] == 1
    assert body["subtypes"][0]["key"] == "deep-oil-control"
    moisture = next(item for item in body["subtypes"] if item["key"] == "moisture-balance")
    assert moisture["count"] == 1
    assert body["items"][0]["target_type_key"] == "moisture-balance"


def test_ingredient_library_uses_backend_pagination(test_client, monkeypatch: pytest.MonkeyPatch):
    client, _ = test_client
    install_fake_save_image(monkeypatch, ingest_routes)

    def fake_run_capability_now(capability: str, input_payload: dict, trace_id: str | None = None, event_callback=None):
        assert capability == "doubao.ingredient_category_profile"
        ingredient_name = input_payload["ingredient"]
        return {
            "ingredient_name": ingredient_name,
            "ingredient_name_en": f"{ingredient_name} EN",
            "category": input_payload["category"],
            "summary": f"{ingredient_name} summary",
            "benefits": ["benefit"],
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

    for idx in range(30):
        payload = _build_manual_doc(category="bodywash")
        payload["product"]["name"] = f"Ingredient Pagination Product {idx:02d}"
        payload["ingredients"] = [
            {
                "name": f"成分{idx:02d}",
                "type": "保湿剂",
                "functions": ["保湿"],
                "risk": "low",
                "notes": "",
                "rank": 1,
                "abundance_level": "major",
                "order_confidence": 95,
            }
        ]
        resp = client.post(
            "/api/upload",
            data={
                "source": "manual",
                "meta_json": json.dumps(payload, ensure_ascii=False),
            },
            files={"image": (f"ingredient-pagination-{idx:02d}.png", VALID_TEST_IMAGE_BYTES, "image/png")},
        )
        assert resp.status_code == 200

    build = client.post(
        "/api/products/ingredients/library/build",
        json={
            "category": "bodywash",
            "force_regenerate": True,
            "normalization_packages": ["unicode_nfkc", "punctuation_fold", "whitespace_fold"],
        },
    )
    assert build.status_code == 200
    build_body = build.json()
    assert build_body["unique_ingredients"] == 30

    first_page = client.get(
        "/api/products/ingredients/library",
        params={"category": "bodywash", "offset": 0, "limit": 24},
    )
    assert first_page.status_code == 200
    first_body = first_page.json()
    assert first_body["total"] == 30
    assert len(first_body["items"]) == 24

    second_page = client.get(
        "/api/products/ingredients/library",
        params={"category": "bodywash", "offset": 24, "limit": 24},
    )
    assert second_page.status_code == 200
    second_body = second_page.json()
    assert second_body["total"] == 30
    assert len(second_body["items"]) == 6

    first_ids = {item["ingredient_id"] for item in first_body["items"]}
    second_ids = {item["ingredient_id"] for item in second_body["items"]}
    assert len(first_ids & second_ids) == 0
