from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.routes import products as products_routes


def test_collect_category_ingredients_builds_source_json_and_signature(monkeypatch: pytest.MonkeyPatch):
    docs = {
        "products/p-1.json": {
            "product": {"category": "bodywash"},
            "ingredients": [
                {"name": "甘油", "rank": 1, "abundance_level": "major", "order_confidence": 95},
                {"name": "烟酰胺", "rank": 2, "abundance_level": "trace", "order_confidence": 82},
            ],
        },
        "products/p-2.json": {
            "product": {"category": "bodywash"},
            "ingredients": [
                {"name": "甘油", "rank": 3, "abundance_level": "trace", "order_confidence": 71},
            ],
        },
    }

    monkeypatch.setattr(products_routes, "exists_rel_path", lambda rel: rel in docs)
    monkeypatch.setattr(products_routes, "load_json", lambda rel: docs[rel])

    rows = [
        SimpleNamespace(
            id="p-1",
            json_path="products/p-1.json",
            category="bodywash",
            brand="A",
            name="X",
            one_sentence="x",
        ),
        SimpleNamespace(
            id="p-2",
            json_path="products/p-2.json",
            category="bodywash",
            brand="B",
            name="Y",
            one_sentence="y",
        ),
    ]

    grouped, meta = products_routes._collect_category_ingredients(rows=rows, max_sources_per_ingredient=8)
    key = "bodywash::甘油"
    assert key in grouped

    item = grouped[key]
    source_json = item["source_json"]
    stats = source_json["stats"]
    assert int(stats["product_count"]) == 2
    assert int(stats["mention_count"]) == 2
    assert stats["rank"]["min"] == 1
    assert stats["rank"]["max"] == 3
    assert int(stats["abundance"]["major_count"]) == 1
    assert int(stats["abundance"]["trace_count"]) == 1
    assert source_json["samples"]
    assert isinstance(item["source_signature"], str) and len(item["source_signature"]) == 40
    assert int(meta["raw_unique_ingredients"]) == 2
    assert int(meta["unique_ingredients"]) == 2


def test_collect_category_ingredients_raises_on_missing_rank(monkeypatch: pytest.MonkeyPatch):
    docs = {
        "products/p-1.json": {
            "product": {"category": "bodywash"},
            "ingredients": [
                {"name": "甘油", "abundance_level": "major", "order_confidence": 95},
            ],
        },
    }
    monkeypatch.setattr(products_routes, "exists_rel_path", lambda rel: rel in docs)
    monkeypatch.setattr(products_routes, "load_json", lambda rel: docs[rel])

    rows = [
        SimpleNamespace(
            id="p-1",
            json_path="products/p-1.json",
            category="bodywash",
            brand="A",
            name="X",
            one_sentence="x",
        )
    ]

    with pytest.raises(HTTPException) as exc_info:
        products_routes._collect_category_ingredients(rows=rows, max_sources_per_ingredient=8)

    assert exc_info.value.status_code == 422
    assert "stage=ingredient_stats_aggregate" in str(exc_info.value.detail)
    assert "product_id=p-1" in str(exc_info.value.detail)


def test_source_signature_changes_when_stats_change():
    source_json_a = {
        "stats": {"product_count": 1, "mention_count": 1, "rank": {}, "abundance": {}, "order_confidence": {}, "cooccurrence_top": [], "data_quality": {}},
        "samples": [{"trace_id": "p-1"}],
    }
    source_json_b = {
        "stats": {"product_count": 2, "mention_count": 2, "rank": {}, "abundance": {}, "order_confidence": {}, "cooccurrence_top": [], "data_quality": {}},
        "samples": [{"trace_id": "p-1"}, {"trace_id": "p-2"}],
    }

    sig_a = products_routes._build_ingredient_source_signature(
        category="bodywash",
        ingredient_key="甘油",
        source_json=source_json_a,
    )
    sig_b = products_routes._build_ingredient_source_signature(
        category="bodywash",
        ingredient_key="甘油",
        source_json=source_json_b,
    )
    assert sig_a != sig_b


def test_collect_category_ingredients_merges_same_en_name_when_en_exact_enabled(monkeypatch: pytest.MonkeyPatch):
    docs = {
        "products/p-1.json": {
            "product": {"category": "bodywash"},
            "ingredients": [
                {"name": "甘油 (Glycerin)", "rank": 1, "abundance_level": "major", "order_confidence": 95},
            ],
        },
        "products/p-2.json": {
            "product": {"category": "bodywash"},
            "ingredients": [
                {"name": "丙三醇 (Glycerin)", "rank": 2, "abundance_level": "major", "order_confidence": 93},
            ],
        },
    }
    monkeypatch.setattr(products_routes, "exists_rel_path", lambda rel: rel in docs)
    monkeypatch.setattr(products_routes, "load_json", lambda rel: docs[rel])

    rows = [
        SimpleNamespace(
            id="p-1",
            json_path="products/p-1.json",
            category="bodywash",
            brand="A",
            name="X",
            one_sentence="x",
        ),
        SimpleNamespace(
            id="p-2",
            json_path="products/p-2.json",
            category="bodywash",
            brand="B",
            name="Y",
            one_sentence="y",
        ),
    ]

    grouped, meta = products_routes._collect_category_ingredients(
        rows=rows,
        max_sources_per_ingredient=8,
        normalization_packages=["unicode_nfkc", "punctuation_fold", "whitespace_fold", "extract_en_parenthesis", "en_exact"],
    )

    assert int(meta["raw_unique_ingredients"]) == 2
    assert int(meta["unique_ingredients"]) == 1
    key = next(iter(grouped.keys()))
    assert key.startswith("bodywash::en::glycerin")
