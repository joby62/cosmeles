from __future__ import annotations

import json
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any


@dataclass(frozen=True)
class MobileDecisionCategoryConfig:
    schema_version: str
    category: str
    route_titles: dict[str, str]
    matrix: dict[str, Any]


@lru_cache(maxsize=8)
def load_mobile_decision_category_config(category: str) -> MobileDecisionCategoryConfig:
    normalized = str(category or "").strip().lower()
    if not normalized:
        raise ValueError("mobile decision category is required")

    raw = json.loads(_category_path(normalized).read_text(encoding="utf-8"))
    schema_version = str(raw.get("schema_version") or "").strip()
    raw_category = str(raw.get("category") or "").strip().lower()
    raw_route_titles = raw.get("route_titles")
    raw_matrix = raw.get("matrix")

    if not schema_version:
        raise ValueError(f"shared/mobile/decision/{normalized}.json missing schema_version")
    if raw_category != normalized:
        raise ValueError(
            f"shared/mobile/decision/{normalized}.json has mismatched category '{raw_category or '-'}'"
        )
    if not isinstance(raw_route_titles, dict) or not raw_route_titles:
        raise ValueError(f"shared/mobile/decision/{normalized}.json missing route_titles")
    if not isinstance(raw_matrix, dict):
        raise ValueError(f"shared/mobile/decision/{normalized}.json missing matrix object")

    route_titles = {
        str(key or "").strip(): str(value or "").strip()
        for key, value in raw_route_titles.items()
        if str(key or "").strip() and str(value or "").strip()
    }
    if not route_titles:
        raise ValueError(f"shared/mobile/decision/{normalized}.json has no valid route_titles")

    matrix_category = str(raw_matrix.get("category") or "").strip().lower()
    if matrix_category != normalized:
        raise ValueError(
            f"shared/mobile/decision/{normalized}.json matrix.category mismatch '{matrix_category or '-'}'"
        )

    return MobileDecisionCategoryConfig(
        schema_version=schema_version,
        category=normalized,
        route_titles=route_titles,
        matrix=raw_matrix,
    )


def _category_path(category: str) -> Path:
    return Path(__file__).resolve().parents[5] / "shared" / "mobile" / "decision" / f"{category}.json"
