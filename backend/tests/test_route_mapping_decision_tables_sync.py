import json
import re
from pathlib import Path

from app.ai.capabilities import _load_route_mapping_decision_table
from app.ai.prompts import load_prompt
from app.constants import ROUTE_MAPPING_SUPPORTED_CATEGORIES
from app.routes import mobile as mobile_routes


_MODEL_BY_CATEGORY = {
    "shampoo": mobile_routes.SHAMPOO_MATRIX_MODEL,
    "bodywash": mobile_routes.BODYWASH_MATRIX_MODEL,
    "conditioner": mobile_routes.CONDITIONER_MATRIX_MODEL,
    "lotion": mobile_routes.LOTION_MATRIX_MODEL,
    "cleanser": mobile_routes.CLEANSER_MATRIX_MODEL,
}

_ROUTE_TITLES_BY_CATEGORY = {
    "shampoo": mobile_routes.SHAMPOO_ROUTE_TITLES,
    "bodywash": mobile_routes.BODYWASH_ROUTE_TITLES,
    "conditioner": mobile_routes.CONDITIONER_ROUTE_TITLES,
    "lotion": mobile_routes.LOTION_ROUTE_TITLES,
    "cleanser": mobile_routes.CLEANSER_ROUTE_TITLES,
}


def test_route_mapping_decision_tables_keep_in_sync_with_mobile_matrix_models():
    """
    Guardrail:
    decision_tables/*.json must stay fully aligned with mobile matrix definitions,
    so we don't keep old residual rules in shampoo/bodywash or drift in new categories.
    """
    base = Path(__file__).resolve().parents[1] / "app" / "ai" / "decision_tables"
    rules_version = mobile_routes.MOBILE_RULES_VERSION

    for category in sorted(ROUTE_MAPPING_SUPPORTED_CATEGORIES):
        model = _MODEL_BY_CATEGORY[category]
        route_titles = _ROUTE_TITLES_BY_CATEGORY[category]
        expected = dict(model)
        expected["rules_version"] = rules_version
        expected["route_candidates"] = [
            {"route_key": key, "route_title": title}
            for key, title in route_titles.items()
        ]

        rel = Path(category) / f"v{rules_version}.json"
        path = base / rel
        assert path.exists(), f"decision table missing: {rel}"
        actual = json.loads(path.read_text(encoding="utf-8"))
        assert actual == expected, f"decision table drift detected for category '{category}'"


def test_route_mapping_prompts_use_dynamic_decision_table_contract():
    """
    Guardrail:
    route mapping prompts must not hardcode rules_version or route_key enums.
    They should describe dynamic constraints from decision_table_json.
    """
    for category in sorted(ROUTE_MAPPING_SUPPORTED_CATEGORIES):
        prompt = load_prompt(f"doubao.route_mapping_{category}").text
        assert "{{decision_table_json}}" in prompt
        assert "{{product_context_json}}" in prompt
        assert "<必须等于 decision_table_json.category>" in prompt
        assert "<必须等于 decision_table_json.rules_version>" in prompt
        assert "decision_table_json.route_candidates[*].route_key" in prompt
        assert (
            re.search(r'"rules_version"\s*:\s*"\d{4}-\d{2}-\d{2}\.\d+"', prompt) is None
        ), f"prompt still hardcodes rules_version: {category}"
        assert (
            re.search(r'"route_key"\s*:\s*"[^"\n]*\|[^"\n]*"', prompt) is None
        ), f"prompt still hardcodes route_key enum: {category}"


def test_route_mapping_decision_table_loader_matches_mobile_rules_version():
    """
    Guardrail:
    loader should resolve decision tables by current MOBILE_RULES_VERSION for all supported categories.
    """
    for category in sorted(ROUTE_MAPPING_SUPPORTED_CATEGORIES):
        table = _load_route_mapping_decision_table(category)
        assert str(table.get("category") or "").strip().lower() == category
        assert str(table.get("rules_version") or "").strip() == mobile_routes.MOBILE_RULES_VERSION
