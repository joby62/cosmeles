import json
from pathlib import Path

import pytest

from app.routes import ingest as ingest_routes
from app.routes import products as products_routes
from app.services.storage import preferred_image_rel_path
from backend.tests.support_images import VALID_TEST_IMAGE_BYTES, install_fake_save_image


def _build_manual_doc(category: str = "shampoo") -> dict:
    return {
        "product": {"category": category, "brand": "TestBrand", "name": "Test Product"},
        "summary": {
            "one_sentence": "测试摘要",
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


def _ingest_manual_with_image(client, *, category: str = "shampoo") -> dict:
    resp = client.post(
        "/api/upload",
        data={
            "source": "manual",
            "meta_json": json.dumps(_build_manual_doc(category=category), ensure_ascii=False),
        },
        files={"image": ("sample.png", VALID_TEST_IMAGE_BYTES, "image/png")},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    return body


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

    def fake_run_capability_now(capability: str, input_payload: dict, trace_id: str | None = None, event_callback=None):
        assert capability == "doubao.ingredient_category_profile"
        return {
            "ingredient_name": input_payload["ingredient"],
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
            "model": "doubao-seed-2-0-pro-260215",
        }

    monkeypatch.setattr(products_routes, "run_capability_now", fake_run_capability_now)

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
