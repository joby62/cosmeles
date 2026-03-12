import hashlib
from typing import Any

from sqlalchemy import inspect, select, text
from sqlalchemy.orm import Session

from app.db.models import MobileSelectionResultIndex, ProductAnalysisIndex
from app.schemas import (
    MobileSelectionLinks,
    MobileSelectionPublishedResult,
    MobileSelectionResultSchemaVersion,
    MobileSelectionResultBlock,
    MobileSelectionResultCTA,
    MobileSelectionResultIndexItem,
    MobileSelectionResultMeta,
    MobileSelectionResultShareCopy,
    MobileSelectionRoute,
    ProductCard,
)
from app.services.storage import (
    load_json,
    now_iso,
    save_json_at,
    selection_result_published_rel_path,
    selection_result_published_version_rel_path,
    selection_result_raw_version_rel_path,
)

DEFAULT_SELECTION_RESULT_SCHEMA_VERSION = "selection_result_content.v1"
SELECTION_RESULT_STATUS_READY = "ready"


class MobileSelectionResultLookupError(Exception):
    def __init__(self, *, code: str, http_status: int, stage: str, detail: str):
        super().__init__(detail)
        self.code = code
        self.http_status = http_status
        self.stage = stage
        self.detail = detail


def ensure_mobile_selection_result_index_table(db: Session) -> None:
    bind = db.get_bind()
    MobileSelectionResultIndex.__table__.create(bind=bind, checkfirst=True)
    inspector = inspect(bind)
    if "mobile_selection_result_index" not in inspector.get_table_names():
        return
    columns = {item["name"] for item in inspector.get_columns("mobile_selection_result_index")}
    statements: list[str] = []
    if "fingerprint" not in columns:
        statements.append("ALTER TABLE mobile_selection_result_index ADD COLUMN fingerprint VARCHAR(64)")
    indexes = [
        "CREATE INDEX IF NOT EXISTS ix_mobile_selection_result_index_fingerprint "
        "ON mobile_selection_result_index (fingerprint)",
    ]
    with bind.begin() as conn:
        for stmt in statements:
            conn.execute(text(stmt))
        for stmt in indexes:
            conn.execute(text(stmt))


def build_mobile_selection_result_scenario_id(*, category: str, rules_version: str, answers_hash: str) -> str:
    category_safe = _safe_token(category)
    rules_safe = _safe_token(rules_version)
    digest = hashlib.sha1(f"{category}::{rules_version}::{answers_hash}".encode("utf-8")).hexdigest()[:16]
    return f"selres-{category_safe}-{rules_safe}-{digest}"


def publish_mobile_selection_result(
    *,
    db: Session,
    category: str,
    answers_hash: str,
    rules_version: str,
    route: MobileSelectionRoute,
    recommendation_source: str,
    recommended_product: ProductCard,
    links: MobileSelectionLinks,
    schema_version: MobileSelectionResultSchemaVersion = DEFAULT_SELECTION_RESULT_SCHEMA_VERSION,
    renderer_variant: str,
    micro_summary: str = "",
    share_copy: MobileSelectionResultShareCopy | None = None,
    blocks: list[MobileSelectionResultBlock],
    ctas: list[MobileSelectionResultCTA],
    display_order: list[str],
    fingerprint: str | None = None,
    raw_payload: dict[str, Any] | None,
    prompt_key: str,
    prompt_version: str,
    model: str,
    refresh_reason: str,
) -> tuple[MobileSelectionPublishedResult, MobileSelectionResultIndex]:
    ensure_mobile_selection_result_index_table(db)

    generated_at = now_iso()
    version_id = _version_token(generated_at)
    scenario_id = build_mobile_selection_result_scenario_id(
        category=category,
        rules_version=rules_version,
        answers_hash=answers_hash,
    )
    normalized_display_order = _normalize_display_order(blocks=blocks, ctas=ctas, display_order=display_order)

    raw_storage_path = None
    if raw_payload is not None:
        raw_storage_path = selection_result_raw_version_rel_path(
            category=category,
            rules_version=rules_version,
            answers_hash=answers_hash,
            version_id=version_id,
        )
        save_json_at(raw_storage_path, raw_payload)

    storage_path = selection_result_published_rel_path(
        category=category,
        rules_version=rules_version,
        answers_hash=answers_hash,
    )
    published_version_path = selection_result_published_version_rel_path(
        category=category,
        rules_version=rules_version,
        answers_hash=answers_hash,
        version_id=version_id,
    )

    published = MobileSelectionPublishedResult(
        schema_version=schema_version,
        renderer_variant=renderer_variant.strip() or "selection_result_default",
        scenario_id=scenario_id,
        category=category,
        answers_hash=answers_hash,
        rules_version=rules_version,
        route=route,
        recommendation_source=recommendation_source.strip() or "category_fallback",
        recommended_product=recommended_product,
        links=links,
        micro_summary=str(micro_summary or "").strip(),
        share_copy=share_copy or MobileSelectionResultShareCopy(),
        display_order=normalized_display_order,
        blocks=blocks,
        ctas=ctas,
        meta=MobileSelectionResultMeta(
            prompt_key=prompt_key.strip(),
            prompt_version=prompt_version.strip(),
            model=model.strip(),
            refresh_reason=refresh_reason.strip(),
            raw_storage_path=raw_storage_path,
            published_version_path=published_version_path,
            generated_at=generated_at,
        ),
    )

    doc = published.model_dump(mode="json")
    save_json_at(published_version_path, doc)
    save_json_at(storage_path, doc)

    rec = db.get(MobileSelectionResultIndex, scenario_id)
    if rec is None:
        rec = MobileSelectionResultIndex(
            scenario_id=scenario_id,
            category=category,
            answers_hash=answers_hash,
            rules_version=rules_version,
            route_key=route.key,
            route_title=route.title,
            updated_at=generated_at,
        )
        db.add(rec)

    rec.category = category
    rec.answers_hash = answers_hash
    rec.rules_version = rules_version
    rec.route_key = route.key
    rec.route_title = route.title
    rec.status = SELECTION_RESULT_STATUS_READY
    rec.fingerprint = str(fingerprint or "").strip() or None
    rec.renderer_variant = published.renderer_variant
    rec.schema_version = published.schema_version
    rec.recommended_product_id = str(recommended_product.id or "").strip() or None
    rec.prompt_key = prompt_key.strip() or None
    rec.prompt_version = prompt_version.strip() or None
    rec.model = model.strip() or None
    rec.raw_storage_path = raw_storage_path
    rec.storage_path = storage_path
    rec.published_version_path = published_version_path
    rec.refresh_reason = refresh_reason.strip() or None
    rec.product_analysis_fingerprint = _product_analysis_fingerprint(db=db, product_id=rec.recommended_product_id)
    rec.error_json = None
    rec.generated_at = generated_at
    rec.updated_at = generated_at

    db.commit()
    db.refresh(rec)
    return published, rec


def load_mobile_selection_result(
    *,
    db: Session,
    category: str,
    rules_version: str,
    answers_hash: str,
) -> tuple[MobileSelectionPublishedResult, MobileSelectionResultIndex]:
    ensure_mobile_selection_result_index_table(db)
    rec = (
        db.execute(
            select(MobileSelectionResultIndex)
            .where(MobileSelectionResultIndex.category == category)
            .where(MobileSelectionResultIndex.rules_version == rules_version)
            .where(MobileSelectionResultIndex.answers_hash == answers_hash)
            .limit(1)
        )
        .scalars()
        .first()
    )
    if rec is None:
        raise MobileSelectionResultLookupError(
            code="SELECTION_RESULT_PRECOMPUTED_MISSING",
            http_status=404,
            stage="selection_result_lookup",
            detail=(
                "No published selection result found for "
                f"category='{category}', rules_version='{rules_version}', answers_hash='{answers_hash}'."
            ),
        )

    status = str(rec.status or "").strip().lower()
    if status != SELECTION_RESULT_STATUS_READY:
        raise MobileSelectionResultLookupError(
            code="SELECTION_RESULT_PRECOMPUTED_NOT_READY",
            http_status=409,
            stage="selection_result_lookup",
            detail=(
                f"Selection result scenario is not ready: status='{status or 'unknown'}', "
                f"category='{category}', answers_hash='{answers_hash}'."
            ),
        )

    storage_path = str(rec.storage_path or "").strip() or selection_result_published_rel_path(
        category=category,
        rules_version=rules_version,
        answers_hash=answers_hash,
    )
    try:
        raw_doc = load_json(storage_path)
    except Exception as exc:
        raise MobileSelectionResultLookupError(
            code="SELECTION_RESULT_PUBLISHED_FILE_MISSING",
            http_status=500,
            stage="selection_result_storage",
            detail=f"Failed to load published selection result from '{storage_path}': {exc}",
        ) from exc

    try:
        item = MobileSelectionPublishedResult.model_validate(raw_doc)
    except Exception as exc:
        raise MobileSelectionResultLookupError(
            code="SELECTION_RESULT_SCHEMA_INVALID",
            http_status=500,
            stage="selection_result_schema",
            detail=(
                f"Published selection result schema invalid for category='{category}', "
                f"answers_hash='{answers_hash}': {exc}"
            ),
        ) from exc
    return item, rec


def to_mobile_selection_result_index_item(rec: MobileSelectionResultIndex) -> MobileSelectionResultIndexItem:
    return MobileSelectionResultIndexItem(
        scenario_id=str(rec.scenario_id or ""),
        category=str(rec.category or ""),
        answers_hash=str(rec.answers_hash or ""),
        rules_version=str(rec.rules_version or ""),
        route_key=str(rec.route_key or ""),
        route_title=str(rec.route_title or ""),
        status=str(rec.status or ""),
        fingerprint=str(rec.fingerprint or "").strip() or None,
        renderer_variant=str(rec.renderer_variant or ""),
        schema_version=str(rec.schema_version or ""),
        recommended_product_id=str(rec.recommended_product_id or "").strip() or None,
        product_analysis_fingerprint=str(rec.product_analysis_fingerprint or "").strip() or None,
        prompt_key=str(rec.prompt_key or "").strip() or None,
        prompt_version=str(rec.prompt_version or "").strip() or None,
        model=str(rec.model or "").strip() or None,
        raw_storage_path=str(rec.raw_storage_path or "").strip() or None,
        storage_path=str(rec.storage_path or "").strip() or None,
        published_version_path=str(rec.published_version_path or "").strip() or None,
        refresh_reason=str(rec.refresh_reason or "").strip() or None,
        generated_at=str(rec.generated_at or "").strip() or None,
        updated_at=str(rec.updated_at or "").strip() or None,
    )


def _normalize_display_order(
    *,
    blocks: list[MobileSelectionResultBlock],
    ctas: list[MobileSelectionResultCTA],
    display_order: list[str],
) -> list[str]:
    block_ids = [_non_empty_token(item.id, field_name="blocks[].id") for item in blocks]
    cta_ids = [_non_empty_token(item.id, field_name="ctas[].id") for item in ctas]
    _ensure_unique(block_ids, field_name="blocks[].id")
    _ensure_unique(cta_ids, field_name="ctas[].id")

    expected = list(block_ids)
    if ctas:
        expected.append("ctas")
    if not display_order:
        return expected

    normalized = [_non_empty_token(item, field_name="display_order[]") for item in display_order]
    _ensure_unique(normalized, field_name="display_order[]")
    if normalized != expected:
        raise ValueError(
            "display_order must match all block ids in order and append 'ctas' when CTA items exist. "
            f"expected={expected}, got={normalized}"
        )
    return normalized


def _product_analysis_fingerprint(*, db: Session, product_id: str | None) -> str | None:
    pid = str(product_id or "").strip()
    if not pid:
        return None
    rec = db.get(ProductAnalysisIndex, pid)
    if rec is None:
        return None
    value = str(rec.fingerprint or "").strip()
    return value or None


def _safe_token(value: str) -> str:
    token = "".join(ch for ch in str(value or "").strip().lower() if ch.isalnum() or ch in {"-", "_"})
    return token.strip("_-") or "x"


def _version_token(value: str) -> str:
    token = "".join(ch if ch.isalnum() else "-" for ch in str(value or "").strip().lower())
    token = "-".join(part for part in token.split("-") if part)
    return token or "v0"


def _non_empty_token(value: str, *, field_name: str) -> str:
    token = str(value or "").strip()
    if not token:
        raise ValueError(f"{field_name} cannot be empty.")
    return token


def _ensure_unique(values: list[str], *, field_name: str) -> None:
    seen: set[str] = set()
    for item in values:
        if item in seen:
            raise ValueError(f"{field_name} contains duplicate id '{item}'.")
        seen.add(item)
