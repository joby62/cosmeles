import hashlib
import json
from typing import Any

from sqlalchemy import inspect, select, text
from sqlalchemy.orm import Session

from app.db.models import MobileSelectionResultIndex, ProductAnalysisIndex
from app.platform.lock_backend import get_runtime_lock_backend
from app.platform.selection_result_repository import (
    SelectionResultArtifactPaths,
    get_selection_result_repository,
)
from app.platform.storage_backend import get_runtime_storage
from app.schemas import (
    MobileSelectionLinks,
    MobileSelectionResultContractV3,
    MobileSelectionResultFixedContractVersion,
    MobileSelectionPublishedResult,
    MobileSelectionResultSchemaVersion,
    MobileSelectionResultBlock,
    MobileSelectionResultCTA,
    MobileSelectionResultIndexItem,
    MobileSelectionResultMeta,
    MobileSelectionResultMetaV3,
    MobileSelectionResultNextStepV3,
    MobileSelectionResultReasonV3,
    MobileSelectionResultShareCopy,
    MobileSelectionResultSecondaryLoopV3,
    MobileSelectionResultSummaryV3,
    MobileSelectionRoute,
    ProductCard,
)
from app.services.storage import (
    now_iso,
    selection_result_published_rel_path,
    selection_result_published_version_rel_path,
    selection_result_raw_version_rel_path,
)

DEFAULT_SELECTION_RESULT_SCHEMA_VERSION = "selection_result_content.v1"
FIXED_SELECTION_RESULT_CONTRACT_VERSION: MobileSelectionResultFixedContractVersion = "selection_result.v3"
ALLOWED_SELECTION_RESULT_SECONDARY_LOOP_ACTIONS = {"compare", "wiki", "me"}
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
    if "published_payload_json" not in columns:
        statements.append("ALTER TABLE mobile_selection_result_index ADD COLUMN published_payload_json TEXT")
    if "fixed_contract_json" not in columns:
        statements.append("ALTER TABLE mobile_selection_result_index ADD COLUMN fixed_contract_json TEXT")
    if "artifact_manifest_json" not in columns:
        statements.append("ALTER TABLE mobile_selection_result_index ADD COLUMN artifact_manifest_json TEXT")
    if "payload_backend" not in columns:
        statements.append(
            "ALTER TABLE mobile_selection_result_index "
            "ADD COLUMN payload_backend VARCHAR(32) NOT NULL DEFAULT 'postgres_payload'"
        )
    indexes = [
        "CREATE INDEX IF NOT EXISTS ix_mobile_selection_result_index_fingerprint "
        "ON mobile_selection_result_index (fingerprint)",
        "CREATE INDEX IF NOT EXISTS ix_mobile_selection_result_index_payload_backend "
        "ON mobile_selection_result_index (payload_backend)",
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
            contract_version=FIXED_SELECTION_RESULT_CONTRACT_VERSION,
            raw_storage_path=None,
            published_version_path=published_version_path,
            generated_at=generated_at,
        ),
    )
    contract_v3 = build_mobile_selection_result_contract_v3(published)

    raw_storage_path = None
    normalized_raw_payload = None
    if raw_payload is not None:
        normalized_raw_payload = dict(raw_payload)
        raw_storage_path = selection_result_raw_version_rel_path(
            category=category,
            rules_version=rules_version,
            answers_hash=answers_hash,
            version_id=version_id,
        )
        published.meta.raw_storage_path = raw_storage_path

    doc = published.model_dump(mode="json")
    if normalized_raw_payload is not None:
        normalized_raw_payload["selection_result_v3_contract"] = contract_v3.model_dump(mode="json")

    artifact_paths = SelectionResultArtifactPaths(
        latest_path=storage_path,
        version_path=published_version_path,
        raw_path=raw_storage_path,
    )
    runtime_storage = get_runtime_storage()
    artifact_manifest = {
        "strategy": "artifact_copy_only",
        "storage_backend": runtime_storage.backend_name,
        "latest_path": storage_path,
        "version_path": published_version_path,
        "raw_path": raw_storage_path,
        "latest_object_key": runtime_storage.object_key(storage_path),
        "version_object_key": runtime_storage.object_key(published_version_path),
        "raw_object_key": runtime_storage.object_key(raw_storage_path),
    }
    repository = get_selection_result_repository()
    with get_runtime_lock_backend().named(f"selection-result:{scenario_id}"):
        repository.persist(
            paths=artifact_paths,
            published_doc=doc,
            raw_doc=normalized_raw_payload,
        )

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
    rec.published_payload_json = json.dumps(doc, ensure_ascii=False)
    rec.fixed_contract_json = json.dumps(contract_v3.model_dump(mode="json"), ensure_ascii=False)
    rec.artifact_manifest_json = json.dumps(artifact_manifest, ensure_ascii=False)
    rec.payload_backend = "postgres_payload"
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

    raw_doc = _parse_json_object(str(rec.published_payload_json or "").strip())
    if raw_doc is None:
        raise MobileSelectionResultLookupError(
            code="SELECTION_RESULT_PAYLOAD_MISSING",
            http_status=409,
            stage="selection_result_payload",
            detail=(
                "Selection result payload is missing in PostgreSQL index row. "
                f"scenario_id='{rec.scenario_id}', category='{category}', answers_hash='{answers_hash}'."
            ),
        )

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
    try:
        build_mobile_selection_result_contract_v3(item)
    except ValueError as exc:
        raise MobileSelectionResultLookupError(
            code="SELECTION_RESULT_FIXED_CONTRACT_INVALID",
            http_status=500,
            stage="selection_result_contract",
            detail=(
                f"Published selection result cannot adapt to {FIXED_SELECTION_RESULT_CONTRACT_VERSION}: {exc}"
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


def build_mobile_selection_result_contract_v3(item: MobileSelectionPublishedResult) -> MobileSelectionResultContractV3:
    summary = _extract_selection_result_summary(item)
    reasons = _extract_selection_result_reasons(item)
    next_step, secondary_loops = _extract_selection_result_ctas(item)
    return MobileSelectionResultContractV3(
        schema_version=FIXED_SELECTION_RESULT_CONTRACT_VERSION,
        scenario_id=item.scenario_id,
        category=item.category,
        route=item.route,
        summary=summary,
        recommended_product=item.recommended_product,
        reasons=reasons,
        next_step=next_step,
        secondary_loops=secondary_loops,
        meta=MobileSelectionResultMetaV3(
            rules_version=item.rules_version,
            generated_at=item.meta.generated_at,
            source=item.recommendation_source,
        ),
    )


def _extract_selection_result_summary(item: MobileSelectionPublishedResult) -> MobileSelectionResultSummaryV3:
    hero_payload = _find_block_payload(item=item, block_id="hero")
    headline = _normalize_text(hero_payload.get("title")) or _normalize_text(item.micro_summary)
    body = _normalize_text(hero_payload.get("subtitle")) or _normalize_text(item.micro_summary)
    if not headline or not body:
        raise ValueError("selection_result.v3 summary requires hero.title and hero.subtitle (or micro_summary).")
    return MobileSelectionResultSummaryV3(headline=headline, body=body)


def _extract_selection_result_reasons(item: MobileSelectionPublishedResult) -> list[MobileSelectionResultReasonV3]:
    reasons: list[MobileSelectionResultReasonV3] = []
    for block in _ordered_blocks(item):
        if str(block.id or "").strip() == "hero":
            continue
        payload = block.payload if isinstance(block.payload, dict) else {}
        title = _normalize_text(payload.get("title")) or _normalize_text(payload.get("eyebrow"))
        body = (
            _normalize_text(payload.get("subtitle"))
            or _normalize_text(payload.get("note"))
            or _first_non_empty_text(payload.get("items"))
        )
        if not title or not body:
            continue
        reasons.append(MobileSelectionResultReasonV3(title=title, body=body))
        if len(reasons) >= 3:
            break
    if len(reasons) != 3:
        raise ValueError(
            f"selection_result.v3 requires exactly 3 reasons, got {len(reasons)} "
            f"for scenario_id='{item.scenario_id}'."
        )
    return reasons


def _extract_selection_result_ctas(
    item: MobileSelectionPublishedResult,
) -> tuple[MobileSelectionResultNextStepV3, list[MobileSelectionResultSecondaryLoopV3]]:
    if not item.ctas:
        raise ValueError("selection_result.v3 requires at least one CTA for next_step.")
    primary = item.ctas[0]
    primary_href = _resolve_cta_href(item=item, cta=primary)
    next_step = MobileSelectionResultNextStepV3(
        label=_require_text(primary.label, field_name="ctas[0].label"),
        action=_require_text(primary.action, field_name="ctas[0].action"),
        href=_require_text(primary_href, field_name="ctas[0].href"),
    )

    secondary: list[MobileSelectionResultSecondaryLoopV3] = []
    for cta in item.ctas[1:]:
        label = _normalize_text(cta.label)
        href = _resolve_cta_href(item=item, cta=cta)
        if not label or not href:
            continue
        action = _resolve_secondary_loop_action(action=cta.action, href=href)
        if not action:
            continue
        secondary.append(MobileSelectionResultSecondaryLoopV3(action=action, label=label, href=href))
    return next_step, secondary


def _ordered_blocks(item: MobileSelectionPublishedResult) -> list[MobileSelectionResultBlock]:
    by_id: dict[str, MobileSelectionResultBlock] = {}
    for block in item.blocks:
        key = str(block.id or "").strip()
        if key and key not in by_id:
            by_id[key] = block
    ordered: list[MobileSelectionResultBlock] = []
    seen: set[str] = set()
    for block_id in item.display_order:
        key = str(block_id or "").strip()
        if not key or key == "ctas" or key in seen:
            continue
        block = by_id.get(key)
        if block is None:
            continue
        ordered.append(block)
        seen.add(key)
    for block in item.blocks:
        key = str(block.id or "").strip()
        if not key or key in seen:
            continue
        ordered.append(block)
        seen.add(key)
    return ordered


def _find_block_payload(*, item: MobileSelectionPublishedResult, block_id: str) -> dict[str, Any]:
    for block in _ordered_blocks(item):
        if str(block.id or "").strip() != block_id:
            continue
        if isinstance(block.payload, dict):
            return block.payload
        return {}
    return {}


def _resolve_secondary_loop_action(*, action: str, href: str) -> str | None:
    action_key = _normalize_text(action).lower()
    href_key = _normalize_text(href).lower()
    if action_key in ALLOWED_SELECTION_RESULT_SECONDARY_LOOP_ACTIONS:
        return action_key
    if action_key in {"restart", "rerun", "retry"} or "compare" in action_key or "/compare" in href_key:
        return "compare"
    if "wiki" in action_key or "/wiki" in href_key:
        return "wiki"
    if action_key in {"me", "profile", "history"} or "/m/me" in href_key:
        return "me"
    return None


def _resolve_cta_href(*, item: MobileSelectionPublishedResult, cta: MobileSelectionResultCTA) -> str:
    href = _normalize_text(cta.href)
    if href:
        return href
    action_key = _normalize_text(cta.action).lower()
    if action_key in {"product", "open_product"}:
        return _normalize_text(item.links.product)
    if action_key in {"wiki", "open_wiki"}:
        return _normalize_text(item.links.wiki)
    if action_key in {"restart", "rerun", "retry"} or "compare" in action_key:
        category = _normalize_text(item.category)
        return f"/m/compare?category={category}" if category else "/m/compare"
    if action_key in {"me", "profile", "history"}:
        return "/m/me"
    return ""


def _first_non_empty_text(values: Any) -> str:
    if not isinstance(values, list):
        return ""
    for item in values:
        text = _normalize_text(item)
        if text:
            return text
    return ""


def _normalize_text(value: Any) -> str:
    return str(value or "").strip()


def _require_text(value: Any, *, field_name: str) -> str:
    text = _normalize_text(value)
    if not text:
        raise ValueError(f"{field_name} is required for selection_result.v3.")
    return text


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


def _parse_json_object(value: str) -> dict[str, Any] | None:
    if not value:
        return None
    try:
        parsed = json.loads(value)
    except Exception:
        return None
    if not isinstance(parsed, dict):
        return None
    return parsed


def _ensure_unique(values: list[str], *, field_name: str) -> None:
    seen: set[str] = set()
    for item in values:
        if item in seen:
            raise ValueError(f"{field_name} contains duplicate id '{item}'.")
        seen.add(item)
