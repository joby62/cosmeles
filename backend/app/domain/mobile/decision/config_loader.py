from __future__ import annotations

import json
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path


@dataclass(frozen=True)
class MobileDecisionCategory:
    key: str
    label_zh: str
    label_en: str
    question_count: int
    estimated_seconds: int


@dataclass(frozen=True)
class MobileDecisionCatalog:
    schema_version: str
    primary_entry: str
    capabilities: tuple[str, ...]
    categories: tuple[MobileDecisionCategory, ...]


@lru_cache(maxsize=1)
def load_mobile_decision_catalog() -> MobileDecisionCatalog:
    raw = json.loads(_catalog_path().read_text(encoding="utf-8"))
    schema_version = str(raw.get("schema_version") or "").strip()
    primary_entry = str(raw.get("primary_entry") or "").strip()
    capabilities = tuple(
        str(item or "").strip()
        for item in raw.get("capabilities") or []
        if str(item or "").strip()
    )
    categories = tuple(_parse_category(item) for item in raw.get("categories") or [])

    if not schema_version:
        raise ValueError("shared/mobile/decision/categories.json missing schema_version")
    if not primary_entry:
        raise ValueError("shared/mobile/decision/categories.json missing primary_entry")
    if not categories:
        raise ValueError("shared/mobile/decision/categories.json must define categories")

    return MobileDecisionCatalog(
        schema_version=schema_version,
        primary_entry=primary_entry,
        capabilities=capabilities,
        categories=categories,
    )


def get_mobile_decision_category_keys() -> tuple[str, ...]:
    return tuple(item.key for item in load_mobile_decision_catalog().categories)


def _catalog_path() -> Path:
    return Path(__file__).resolve().parents[5] / "shared" / "mobile" / "decision" / "categories.json"


def _parse_category(raw: object) -> MobileDecisionCategory:
    if not isinstance(raw, dict):
        raise ValueError("Decision category entry must be an object")

    key = str(raw.get("key") or "").strip().lower()
    label_zh = str(raw.get("label_zh") or "").strip()
    label_en = str(raw.get("label_en") or "").strip()
    question_count = int(raw.get("question_count") or 0)
    estimated_seconds = int(raw.get("estimated_seconds") or 0)

    if not key:
        raise ValueError("Decision category entry missing key")
    if not label_zh or not label_en:
        raise ValueError(f"Decision category '{key}' missing localized labels")
    if question_count <= 0:
        raise ValueError(f"Decision category '{key}' has invalid question_count")
    if estimated_seconds <= 0:
        raise ValueError(f"Decision category '{key}' has invalid estimated_seconds")

    return MobileDecisionCategory(
        key=key,
        label_zh=label_zh,
        label_en=label_en,
        question_count=question_count,
        estimated_seconds=estimated_seconds,
    )
