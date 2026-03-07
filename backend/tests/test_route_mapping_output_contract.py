from __future__ import annotations

from copy import deepcopy

import pytest

from app.ai import capabilities
from app.ai.errors import AIServiceError
from app.constants import MOBILE_RULES_VERSION, ROUTE_MAPPING_SUPPORTED_CATEGORIES


def _build_valid_payload(category: str, decision_table: dict) -> dict:
    candidates = decision_table.get("route_candidates") or []
    scores: list[dict] = []
    for idx, item in enumerate(candidates):
        route_key = str(item.get("route_key") or "").strip()
        if not route_key:
            continue
        scores.append(
            {
                "route_key": route_key,
                "confidence": max(0, 100 - idx * 9),
                "reason": f"score reason for {route_key}",
            }
        )
    ranked = sorted(scores, key=lambda row: (-int(row["confidence"]), str(row["route_key"])))
    return {
        "category": category,
        "rules_version": str(decision_table.get("rules_version") or ""),
        "primary_route": {
            "route_key": str(ranked[0]["route_key"]),
            "confidence": int(ranked[0]["confidence"]),
            "reason": "primary reason",
        },
        "secondary_route": {
            "route_key": str(ranked[1]["route_key"]),
            "confidence": int(ranked[1]["confidence"]),
            "reason": "secondary reason",
        },
        "route_scores": scores,
        "evidence": {"positive": [], "counter": []},
        "confidence_reason": "confidence from ingredient-order evidence",
        "needs_review": False,
    }


def test_route_mapping_output_contract_accepts_valid_payload_for_all_categories():
    for category in sorted(ROUTE_MAPPING_SUPPORTED_CATEGORIES):
        table = capabilities._load_route_mapping_decision_table(category)
        payload = _build_valid_payload(category, table)
        normalized = capabilities._normalize_route_mapping_result(category, table, payload)
        assert normalized["category"] == category
        assert normalized["rules_version"] == MOBILE_RULES_VERSION
        assert len(normalized["route_scores"]) == len(table["route_candidates"])
        assert {item["route_key"] for item in normalized["route_scores"]} == {
            str(item["route_key"]) for item in table["route_candidates"]
        }


def test_route_mapping_output_contract_rejects_rules_version_mismatch():
    category = "shampoo"
    table = capabilities._load_route_mapping_decision_table(category)
    payload = _build_valid_payload(category, table)
    payload["rules_version"] = "2099-01-01.1"
    with pytest.raises(AIServiceError, match="rules_version mismatch"):
        capabilities._normalize_route_mapping_result(category, table, payload)


def test_route_mapping_output_contract_rejects_incomplete_route_scores():
    category = "bodywash"
    table = capabilities._load_route_mapping_decision_table(category)
    payload = _build_valid_payload(category, table)
    broken = deepcopy(payload)
    broken["route_scores"] = broken["route_scores"][:-1]
    with pytest.raises(AIServiceError, match="route_scores missing candidates"):
        capabilities._normalize_route_mapping_result(category, table, broken)
