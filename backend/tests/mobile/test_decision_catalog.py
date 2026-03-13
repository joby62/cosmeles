from app.constants import (
    PRODUCT_PROFILE_SUPPORTED_CATEGORIES,
    ROUTE_MAPPING_SUPPORTED_CATEGORIES,
    VALID_CATEGORIES,
)
from app.domain.mobile.decision import get_mobile_decision_category_keys, load_mobile_decision_catalog


def test_mobile_decision_catalog_matches_constants() -> None:
    keys = set(get_mobile_decision_category_keys())
    assert keys == VALID_CATEGORIES
    assert keys == ROUTE_MAPPING_SUPPORTED_CATEGORIES
    assert keys == PRODUCT_PROFILE_SUPPORTED_CATEGORIES


def test_mobile_decision_catalog_shape() -> None:
    catalog = load_mobile_decision_catalog()
    assert catalog.schema_version == "mobile_decision_catalog.v1"
    assert catalog.primary_entry == "choose"
    assert catalog.capabilities == ("choose", "compare", "wiki", "me")
    assert len(catalog.categories) == 5
    for category in catalog.categories:
        assert category.label_zh
        assert category.label_en
        assert category.question_count > 0
        assert category.estimated_seconds > 0
