from __future__ import annotations

import hashlib
import json
from uuid import uuid4
from typing import Any, Callable

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from sqlalchemy import select
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session

from app.constants import MOBILE_RULES_VERSION, VALID_CATEGORIES
from app.db.models import (
    MobileSelectionSession,
    ProductAnalysisIndex,
    ProductFeaturedSlot,
    ProductIndex,
    ProductRouteMappingIndex,
)
from app.db.session import get_db
from app.domain.mobile.decision import load_mobile_decision_category_config
from app.routes.mobile_support import (
    CATEGORY_LEVEL_TARGET_KEY,
    ROUTE_MAPPED_CATEGORIES,
    _featured_slot_schema_http_error,
    _mobile_cleanup_cutoff_iso,
    _normalize_session_ids,
    _resolve_owner,
    _set_owner_cookie,
)
from app.schemas import (
    MobileSelectionBatchDeleteRequest,
    MobileSelectionBatchDeleteResponse,
    MobileSelectionChoice,
    MobileSelectionFitExplanationItem,
    MobileSelectionFitExplanationResponse,
    MobileSelectionHistoryCleanupDeleteResponse,
    MobileSelectionHistoryCleanupPreviewItem,
    MobileSelectionHistoryCleanupPreviewResponse,
    MobileSelectionHistoryCleanupRequest,
    MobileSelectionLinks,
    MobileSelectionMatrixAnalysis,
    MobileSelectionMatrixQuestionContribution,
    MobileSelectionMatrixQuestionRouteDelta,
    MobileSelectionMatrixRouteScore,
    MobileSelectionMatrixTopRoute,
    MobileSelectionMatrixTriggeredVeto,
    MobileSelectionMatrixVetoRoute,
    MobileSelectionPinRequest,
    MobileSelectionResolveRequest,
    MobileSelectionResolveResponse,
    MobileSelectionResultLookupRequest,
    MobileSelectionResultPublishRequest,
    MobileSelectionResultPublishResponse,
    MobileSelectionResultResponse,
    MobileSelectionRoute,
    MobileSelectionRuleHit,
    ProductAnalysisStoredResult,
    ProductCard,
)
from app.services.matrix_decision import (
    MatrixDecisionConfig,
    MatrixDecisionError,
    MatrixDecisionResult,
    compile_matrix_config,
    resolve_matrix_selection,
)
from app.services.mobile_selection_results import (
    MobileSelectionResultLookupError,
    load_mobile_selection_result,
    publish_mobile_selection_result,
    to_mobile_selection_result_index_item,
)
from app.services.selection_fit import RouteDiagnosticRule, get_route_diagnostic_rules
from app.services.storage import (
    exists_rel_path,
    load_json,
    now_iso,
    preferred_image_rel_path,
    product_analysis_rel_path,
)

selection_router = APIRouter(tags=["mobile"])

_SHAMPOO_SHARED_CONFIG = load_mobile_decision_category_config("shampoo")
SHAMPOO_ROUTE_TITLES = dict(_SHAMPOO_SHARED_CONFIG.route_titles)
SHAMPOO_MATRIX_MODEL = dict(_SHAMPOO_SHARED_CONFIG.matrix)
SHAMPOO_MATRIX_CONFIG = compile_matrix_config(_SHAMPOO_SHARED_CONFIG.matrix)

_BODYWASH_SHARED_CONFIG = load_mobile_decision_category_config("bodywash")
BODYWASH_ROUTE_TITLES = dict(_BODYWASH_SHARED_CONFIG.route_titles)
BODYWASH_MATRIX_MODEL = dict(_BODYWASH_SHARED_CONFIG.matrix)
BODYWASH_MATRIX_CONFIG = compile_matrix_config(_BODYWASH_SHARED_CONFIG.matrix)

_CONDITIONER_SHARED_CONFIG = load_mobile_decision_category_config("conditioner")
CONDITIONER_ROUTE_TITLES = dict(_CONDITIONER_SHARED_CONFIG.route_titles)
CONDITIONER_MATRIX_MODEL = dict(_CONDITIONER_SHARED_CONFIG.matrix)
CONDITIONER_MATRIX_CONFIG = compile_matrix_config(_CONDITIONER_SHARED_CONFIG.matrix)

_LOTION_SHARED_CONFIG = load_mobile_decision_category_config("lotion")
LOTION_ROUTE_TITLES = dict(_LOTION_SHARED_CONFIG.route_titles)
LOTION_MATRIX_MODEL = dict(_LOTION_SHARED_CONFIG.matrix)
LOTION_MATRIX_CONFIG = compile_matrix_config(_LOTION_SHARED_CONFIG.matrix)

_CLEANSER_SHARED_CONFIG = load_mobile_decision_category_config("cleanser")
CLEANSER_ROUTE_TITLES = dict(_CLEANSER_SHARED_CONFIG.route_titles)
CLEANSER_MATRIX_MODEL = dict(_CLEANSER_SHARED_CONFIG.matrix)
CLEANSER_MATRIX_CONFIG = compile_matrix_config(_CLEANSER_SHARED_CONFIG.matrix)


@selection_router.post("/selection/resolve", response_model=MobileSelectionResolveResponse)
def resolve_mobile_selection(
    payload: MobileSelectionResolveRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    category = str(payload.category or "").strip().lower()
    if category not in VALID_CATEGORIES:
        raise HTTPException(status_code=400, detail=f"Invalid category: {category}.")

    owner_type, owner_id, owner_cookie_new = _resolve_owner(request)
    answers = _normalize_answers(payload.answers)
    resolved = _resolve_selection(category=category, answers=answers)
    answers_hash = _build_answers_hash(category=category, answers=resolved["answers"])

    if payload.reuse_existing:
        existing = db.execute(
            select(MobileSelectionSession)
            .where(MobileSelectionSession.owner_type == owner_type)
            .where(MobileSelectionSession.owner_id == owner_id)
            .where(MobileSelectionSession.category == category)
            .where(MobileSelectionSession.rules_version == MOBILE_RULES_VERSION)
            .where(MobileSelectionSession.answers_hash == answers_hash)
            .where(MobileSelectionSession.deleted_at.is_(None))
            .order_by(MobileSelectionSession.created_at.desc())
            .limit(1)
        ).scalars().first()
        if existing:
            if owner_cookie_new:
                _set_owner_cookie(response, owner_id, request)
            stored = _row_to_mobile_response(existing)
            return stored.model_copy(update={"reused": True})

    product_row, recommendation_source = _resolve_selection_product_row(
        db=db,
        category=category,
        route_key=str(resolved["route_key"]),
    )
    product = _row_to_product_card(product_row)

    created_at = now_iso()
    session_id = str(uuid4())
    result = MobileSelectionResolveResponse(
        status="ok",
        session_id=session_id,
        reused=False,
        is_pinned=False,
        pinned_at=None,
        category=category,
        rules_version=MOBILE_RULES_VERSION,
        route=MobileSelectionRoute(key=resolved["route_key"], title=resolved["route_title"]),
        choices=[MobileSelectionChoice.model_validate(item) for item in resolved["choices"]],
        rule_hits=[MobileSelectionRuleHit.model_validate(item) for item in resolved["rule_hits"]],
        recommendation_source=recommendation_source,
        matrix_analysis=MobileSelectionMatrixAnalysis.model_validate(resolved.get("matrix_analysis") or {}),
        recommended_product=product,
        links=MobileSelectionLinks(
            product=f"/product/{product.id}",
            wiki=resolved["wiki_href"],
        ),
        created_at=created_at,
    )

    row = MobileSelectionSession(
        id=session_id,
        owner_type=owner_type,
        owner_id=owner_id,
        category=category,
        rules_version=MOBILE_RULES_VERSION,
        answers_hash=answers_hash,
        route_key=resolved["route_key"],
        route_title=resolved["route_title"],
        product_id=product.id,
        answers_json=json.dumps(resolved["answers"], ensure_ascii=False),
        result_json=json.dumps(result.model_dump(), ensure_ascii=False),
        is_pinned=False,
        pinned_at=None,
        created_at=created_at,
    )
    db.add(row)
    db.commit()
    if owner_cookie_new:
        _set_owner_cookie(response, owner_id, request)
    return result


@selection_router.get("/selection/sessions/{session_id}", response_model=MobileSelectionResolveResponse)
def get_mobile_selection_session(
    session_id: str,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    owner_type, owner_id, owner_cookie_new = _resolve_owner(request)
    row = db.execute(
        select(MobileSelectionSession)
        .where(MobileSelectionSession.id == session_id)
        .where(MobileSelectionSession.owner_type == owner_type)
        .where(MobileSelectionSession.owner_id == owner_id)
        .where(MobileSelectionSession.deleted_at.is_(None))
        .limit(1)
    ).scalars().first()
    if not row:
        raise HTTPException(status_code=404, detail="Selection session not found.")
    if owner_cookie_new:
        _set_owner_cookie(response, owner_id, request)
    return _row_to_mobile_response(row)


@selection_router.get("/selection/sessions", response_model=list[MobileSelectionResolveResponse])
def list_mobile_selection_sessions(
    request: Request,
    response: Response,
    category: str | None = Query(None),
    offset: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    owner_type, owner_id, owner_cookie_new = _resolve_owner(request)
    stmt = (
        select(MobileSelectionSession)
        .where(MobileSelectionSession.owner_type == owner_type)
        .where(MobileSelectionSession.owner_id == owner_id)
        .where(MobileSelectionSession.deleted_at.is_(None))
    )
    if category:
        normalized = str(category).strip().lower()
        if normalized not in VALID_CATEGORIES:
            raise HTTPException(status_code=400, detail=f"Invalid category: {normalized}.")
        stmt = stmt.where(MobileSelectionSession.category == normalized)
    rows = db.execute(
        stmt.order_by(*_selection_session_order_expr()).offset(offset).limit(limit)
    ).scalars().all()
    if owner_cookie_new:
        _set_owner_cookie(response, owner_id, request)
    return [_row_to_mobile_response(row) for row in rows]


@selection_router.post("/selection/sessions/{session_id}/pin", response_model=MobileSelectionResolveResponse)
def pin_mobile_selection_session(
    session_id: str,
    payload: MobileSelectionPinRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    owner_type, owner_id, owner_cookie_new = _resolve_owner(request)
    row = db.execute(
        select(MobileSelectionSession)
        .where(MobileSelectionSession.id == session_id)
        .where(MobileSelectionSession.owner_type == owner_type)
        .where(MobileSelectionSession.owner_id == owner_id)
        .where(MobileSelectionSession.deleted_at.is_(None))
        .limit(1)
    ).scalars().first()
    if row is None:
        raise HTTPException(status_code=404, detail="Selection session not found.")

    should_pin = bool(payload.pinned)
    row.is_pinned = should_pin
    row.pinned_at = now_iso() if should_pin else None
    db.commit()
    db.refresh(row)

    if owner_cookie_new:
        _set_owner_cookie(response, owner_id, request)
    return _row_to_mobile_response(row)


@selection_router.get("/selection/sessions/{session_id}/fit-explanation", response_model=MobileSelectionFitExplanationResponse)
def get_mobile_selection_fit_explanation(
    session_id: str,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    owner_type, owner_id, owner_cookie_new = _resolve_owner(request)
    row = db.execute(
        select(MobileSelectionSession)
        .where(MobileSelectionSession.id == session_id)
        .where(MobileSelectionSession.owner_type == owner_type)
        .where(MobileSelectionSession.owner_id == owner_id)
        .where(MobileSelectionSession.deleted_at.is_(None))
        .limit(1)
    ).scalars().first()
    if row is None:
        raise HTTPException(status_code=404, detail="Selection session not found.")

    resolved = _row_to_mobile_response(row)
    raw_payload = _safe_parse_json_dict(str(row.result_json or ""))
    recommendation_source = _determine_selection_recommendation_source(
        db=db,
        row=row,
        resolved=resolved,
        raw_payload=raw_payload,
    )
    analysis = _load_ready_product_analysis_result(
        db=db,
        product_id=str(row.product_id or ""),
    )
    item = _build_selection_fit_explanation(
        session_id=str(row.id),
        resolved=resolved,
        recommendation_source=recommendation_source,
        analysis=analysis,
    )
    if owner_cookie_new:
        _set_owner_cookie(response, owner_id, request)
    return MobileSelectionFitExplanationResponse(status="ok", item=item)


@selection_router.post("/selection/result", response_model=MobileSelectionResultResponse)
def get_mobile_selection_result(
    payload: MobileSelectionResultLookupRequest,
    db: Session = Depends(get_db),
):
    category = str(payload.category or "").strip().lower()
    if category not in VALID_CATEGORIES:
        raise HTTPException(status_code=400, detail=f"Invalid category: {category}.")

    answers = _normalize_answers(payload.answers)
    resolved = _resolve_selection(category=category, answers=answers)
    answers_hash = _build_answers_hash(category=category, answers=resolved["answers"])

    try:
        item, _rec = load_mobile_selection_result(
            db=db,
            category=category,
            rules_version=MOBILE_RULES_VERSION,
            answers_hash=answers_hash,
        )
    except MobileSelectionResultLookupError as exc:
        raise HTTPException(
            status_code=exc.http_status,
            detail={
                "code": exc.code,
                "stage": exc.stage,
                "detail": exc.detail,
                "category": category,
                "answers_hash": answers_hash,
                "rules_version": MOBILE_RULES_VERSION,
            },
        ) from exc
    return MobileSelectionResultResponse(status="ok", item=item)


@selection_router.post("/selection/results/publish", response_model=MobileSelectionResultPublishResponse)
def publish_selection_result(
    payload: MobileSelectionResultPublishRequest,
    db: Session = Depends(get_db),
):
    category = str(payload.category or "").strip().lower()
    if category not in VALID_CATEGORIES:
        raise HTTPException(status_code=400, detail=f"Invalid category: {category}.")

    answers = _normalize_answers(payload.answers)
    resolved = _resolve_selection(category=category, answers=answers)
    answers_hash = _build_answers_hash(category=category, answers=resolved["answers"])
    product_row, recommendation_source = _resolve_selection_product_row(
        db=db,
        category=category,
        route_key=str(resolved["route_key"]),
    )
    product = _row_to_product_card(product_row)

    try:
        _published, rec = publish_mobile_selection_result(
            db=db,
            category=category,
            answers_hash=answers_hash,
            rules_version=MOBILE_RULES_VERSION,
            route=MobileSelectionRoute(key=resolved["route_key"], title=resolved["route_title"]),
            recommendation_source=recommendation_source,
            recommended_product=product,
            links=MobileSelectionLinks(
                product=f"/product/{product.id}",
                wiki=str(resolved["wiki_href"]),
            ),
            schema_version=payload.schema_version,
            renderer_variant=payload.renderer_variant,
            micro_summary=payload.micro_summary,
            share_copy=payload.share_copy,
            blocks=list(payload.blocks),
            ctas=list(payload.ctas),
            display_order=list(payload.display_order),
            fingerprint=(str(payload.fingerprint or "").strip() or None),
            raw_payload=dict(payload.raw_payload) if payload.raw_payload is not None else None,
            prompt_key=payload.prompt_key,
            prompt_version=payload.prompt_version,
            model=payload.model,
            refresh_reason=payload.refresh_reason,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=422,
            detail={
                "code": "SELECTION_RESULT_PUBLISH_INVALID",
                "stage": "selection_result_publish",
                "detail": str(exc),
                "category": category,
                "answers_hash": answers_hash,
                "rules_version": MOBILE_RULES_VERSION,
            },
        ) from exc

    return MobileSelectionResultPublishResponse(status="ok", item=to_mobile_selection_result_index_item(rec))


@selection_router.post(
    "/selection/sessions/cleanup/preview",
    response_model=MobileSelectionHistoryCleanupPreviewResponse,
)
def preview_mobile_selection_history_cleanup(
    payload: MobileSelectionHistoryCleanupRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    owner_type, owner_id, owner_cookie_new = _resolve_owner(request)
    rows = _match_mobile_selection_cleanup_rows(
        db=db,
        owner_type=owner_type,
        owner_id=owner_id,
        older_than_days=payload.older_than_days,
        exclude_pinned=payload.exclude_pinned,
    )
    if owner_cookie_new:
        _set_owner_cookie(response, owner_id, request)
    return MobileSelectionHistoryCleanupPreviewResponse(
        status="ok",
        older_than_days=payload.older_than_days,
        exclude_pinned=payload.exclude_pinned,
        matched_count=len(rows),
        sample=_build_mobile_selection_cleanup_sample(rows, payload.limit_preview),
    )


@selection_router.post(
    "/selection/sessions/cleanup/delete",
    response_model=MobileSelectionHistoryCleanupDeleteResponse,
)
def delete_mobile_selection_history_cleanup(
    payload: MobileSelectionHistoryCleanupRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    owner_type, owner_id, owner_cookie_new = _resolve_owner(request)
    rows = _match_mobile_selection_cleanup_rows(
        db=db,
        owner_type=owner_type,
        owner_id=owner_id,
        older_than_days=payload.older_than_days,
        exclude_pinned=payload.exclude_pinned,
    )
    sample = _build_mobile_selection_cleanup_sample(rows, payload.limit_preview)
    deleted_at = now_iso()
    deleted_by = f"{owner_type}:{owner_id}"
    deleted_ids: list[str] = []
    for row in rows:
        row.deleted_at = deleted_at
        row.deleted_by = deleted_by
        deleted_ids.append(str(row.id))
    if rows:
        db.commit()
    if owner_cookie_new:
        _set_owner_cookie(response, owner_id, request)
    return MobileSelectionHistoryCleanupDeleteResponse(
        status="ok",
        older_than_days=payload.older_than_days,
        exclude_pinned=payload.exclude_pinned,
        matched_count=len(rows),
        sample=sample,
        deleted_ids=deleted_ids,
    )


@selection_router.post(
    "/selection/sessions/batch/delete",
    response_model=MobileSelectionBatchDeleteResponse,
)
def batch_delete_mobile_selection_sessions(
    payload: MobileSelectionBatchDeleteRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    owner_type, owner_id, owner_cookie_new = _resolve_owner(request)
    normalized_ids = _normalize_session_ids(payload.ids)
    if not normalized_ids:
        raise HTTPException(status_code=400, detail="ids cannot be empty.")

    rows = db.execute(
        select(MobileSelectionSession).where(MobileSelectionSession.id.in_(normalized_ids))
    ).scalars().all()
    by_id = {row.id: row for row in rows}

    deleted_ids: list[str] = []
    not_found_ids: list[str] = []
    forbidden_ids: list[str] = []
    deleted_at = now_iso()
    deleted_by = f"{owner_type}:{owner_id}"
    dirty = False

    for session_id in normalized_ids:
        row = by_id.get(session_id)
        if row is None or row.deleted_at is not None:
            not_found_ids.append(session_id)
            continue
        if row.owner_type != owner_type or row.owner_id != owner_id:
            forbidden_ids.append(session_id)
            continue
        row.deleted_at = deleted_at
        row.deleted_by = deleted_by
        deleted_ids.append(session_id)
        dirty = True

    if dirty:
        db.commit()
    if owner_cookie_new:
        _set_owner_cookie(response, owner_id, request)
    return MobileSelectionBatchDeleteResponse(
        status="ok",
        deleted_ids=deleted_ids,
        not_found_ids=not_found_ids,
        forbidden_ids=forbidden_ids,
    )


def _row_to_mobile_response(row: MobileSelectionSession) -> MobileSelectionResolveResponse:
    try:
        payload = json.loads(row.result_json)
    except Exception as e:  # pragma: no cover
        raise HTTPException(status_code=500, detail=f"Invalid session payload: {e}") from e
    try:
        if not isinstance(payload, dict):
            raise ValueError("session payload must be an object")
        if "matrix_analysis" not in payload or not isinstance(payload.get("matrix_analysis"), dict):
            payload["matrix_analysis"] = _rebuild_selection_matrix_analysis(
                category=str(row.category or ""),
                answers_json=str(row.answers_json or ""),
            )
        payload.setdefault("recommendation_source", "category_fallback")
        resolved = MobileSelectionResolveResponse.model_validate(payload)
        return resolved.model_copy(
            update={
                "is_pinned": bool(row.is_pinned),
                "pinned_at": row.pinned_at,
            }
        )
    except Exception as e:  # pragma: no cover
        raise HTTPException(status_code=500, detail=f"Session payload schema invalid: {e}") from e


def _build_mobile_selection_cleanup_sample(
    rows: list[MobileSelectionSession],
    limit_preview: int,
) -> list[MobileSelectionHistoryCleanupPreviewItem]:
    return [
        MobileSelectionHistoryCleanupPreviewItem(
            session_id=str(row.id),
            category=str(row.category or ""),
            created_at=str(row.created_at or ""),
            route_title=str(row.route_title or ""),
            is_pinned=bool(row.is_pinned),
        )
        for row in rows[:limit_preview]
    ]


def _match_mobile_selection_cleanup_rows(
    *,
    db: Session,
    owner_type: str,
    owner_id: str,
    older_than_days: int,
    exclude_pinned: bool,
) -> list[MobileSelectionSession]:
    cutoff_iso = _mobile_cleanup_cutoff_iso(older_than_days)
    stmt = (
        select(MobileSelectionSession)
        .where(MobileSelectionSession.owner_type == owner_type)
        .where(MobileSelectionSession.owner_id == owner_id)
        .where(MobileSelectionSession.deleted_at.is_(None))
        .where(MobileSelectionSession.created_at < cutoff_iso)
    )
    if exclude_pinned:
        stmt = stmt.where(MobileSelectionSession.is_pinned.is_(False))
    return (
        db.execute(
            stmt.order_by(
                MobileSelectionSession.created_at.asc(),
                MobileSelectionSession.id.asc(),
            )
        )
        .scalars()
        .all()
    )


def _selection_session_order_expr():
    return (
        MobileSelectionSession.is_pinned.desc(),
        MobileSelectionSession.pinned_at.desc(),
        MobileSelectionSession.created_at.desc(),
    )


def _latest_selection_session(
    *,
    db: Session,
    owner_type: str,
    owner_id: str,
    category: str,
) -> MobileSelectionSession | None:
    return (
        db.execute(
            select(MobileSelectionSession)
            .where(MobileSelectionSession.owner_type == owner_type)
            .where(MobileSelectionSession.owner_id == owner_id)
            .where(MobileSelectionSession.category == category)
            .where(MobileSelectionSession.deleted_at.is_(None))
            .order_by(MobileSelectionSession.created_at.desc())
            .limit(1)
        )
        .scalars()
        .first()
    )


def _rebuild_selection_matrix_analysis(category: str, answers_json: str) -> dict[str, Any]:
    try:
        raw_answers = json.loads(answers_json or "{}")
    except Exception:
        return MobileSelectionMatrixAnalysis().model_dump()
    if not isinstance(raw_answers, dict):
        return MobileSelectionMatrixAnalysis().model_dump()
    try:
        config, route_titles, _wiki_href = _selection_matrix_assets(category)
        decision = resolve_matrix_selection(config, _normalize_answers(raw_answers))
    except Exception:
        return MobileSelectionMatrixAnalysis().model_dump()
    return _build_mobile_selection_matrix_analysis(
        config=config,
        route_titles=route_titles,
        decision=decision,
    )


def _safe_parse_json_dict(raw_text: str) -> dict[str, Any]:
    try:
        parsed = json.loads(raw_text or "{}")
    except Exception:
        return {}
    return parsed if isinstance(parsed, dict) else {}


def _load_ready_product_analysis_result(
    *,
    db: Session,
    product_id: str,
) -> ProductAnalysisStoredResult | None:
    pid = str(product_id or "").strip()
    if not pid:
        return None
    rec = db.get(ProductAnalysisIndex, pid)
    if rec is None or str(rec.status or "").strip().lower() != "ready":
        return None
    storage_path = str(rec.storage_path or "").strip() or product_analysis_rel_path(str(rec.category or ""), pid)
    if not exists_rel_path(storage_path):
        return None
    try:
        raw_doc = load_json(storage_path)
        return ProductAnalysisStoredResult.model_validate({**raw_doc, "storage_path": storage_path})
    except Exception:
        return None


def _determine_selection_recommendation_source(
    *,
    db: Session,
    row: MobileSelectionSession,
    resolved: MobileSelectionResolveResponse,
    raw_payload: dict[str, Any],
) -> str:
    explicit = str(raw_payload.get("recommendation_source") or "").strip().lower()
    if explicit in {"featured_slot", "route_mapping", "category_fallback"}:
        return explicit

    product_id = str(row.product_id or "").strip()
    category = str(row.category or "").strip().lower()
    route_key = str(resolved.route.key or "").strip()
    if not product_id or not category or not route_key:
        return "category_fallback"

    target_type_key = _selection_target_type_key(category=category, route_key=route_key)
    if target_type_key:
        try:
            slot = db.execute(
                select(ProductFeaturedSlot)
                .where(ProductFeaturedSlot.category == category)
                .where(ProductFeaturedSlot.target_type_key == target_type_key)
                .limit(1)
            ).scalars().first()
        except OperationalError:
            slot = None
        if slot and str(slot.product_id or "").strip() == product_id:
            return "featured_slot"

    mapping = db.get(ProductRouteMappingIndex, product_id)
    if (
        mapping is not None
        and str(mapping.status or "").strip().lower() == "ready"
        and str(mapping.category or "").strip().lower() == category
        and str(mapping.primary_route_key or "").strip() == route_key
    ):
        return "route_mapping"
    return "category_fallback"


def _build_selection_fit_explanation(
    *,
    session_id: str,
    resolved: MobileSelectionResolveResponse,
    recommendation_source: str,
    analysis: ProductAnalysisStoredResult | None,
) -> MobileSelectionFitExplanationItem:
    matrix = resolved.matrix_analysis
    route_title = str(resolved.route.title or "").strip() or str(resolved.route.key or "").strip()
    route_rationale = _build_selection_route_rationale(
        route_key=str(resolved.route.key or ""),
        route_title=route_title,
        matrix=matrix,
    )
    product_fit: list[dict[str, Any]] = []
    matched_points: list[str] = []
    tradeoffs: list[str] = []
    guardrails: list[str] = _build_selection_guardrails(matrix=matrix)
    confidence = 68
    needs_review = False

    if analysis is None:
        needs_review = True
        confidence = 52
        matched_points = ["当前推荐已基于测评路线选出，但这款主推暂时缺少产品增强分析。"]
        tradeoffs = ["暂时无法从二级类目诊断维度判断它与当前路线的细颗粒匹配度。"]
        guardrails.append("先看测评路线是否准确；产品解释层缺失时，不建议把当前主推理解为唯一最优解。")
    else:
        product_fit, matched_points, tradeoffs, guardrails_extra, fit_confidence, fit_needs_review = _build_selection_product_fit(
            category=str(resolved.category or ""),
            route_key=str(resolved.route.key or ""),
            analysis=analysis,
        )
        guardrails.extend(guardrails_extra)
        confidence = fit_confidence
        needs_review = fit_needs_review

    if recommendation_source == "category_fallback":
        needs_review = True
        confidence = max(0, confidence - 8)
        guardrails.append("当前推荐来自品类兜底，不是主推槽位或 route-mapping 精准命中。")

    summary_headline, summary_text = _build_selection_summary_text(
        route_title=route_title,
        route_rationale=route_rationale,
        matched_points=matched_points,
        tradeoffs=tradeoffs,
        analysis=analysis,
    )

    return MobileSelectionFitExplanationItem(
        session_id=session_id,
        category=resolved.category,
        route_key=resolved.route.key,
        route_title=resolved.route.title,
        recommended_product_id=str(resolved.recommended_product.id or "").strip() or None,
        recommendation_source=recommendation_source if recommendation_source in {"featured_slot", "route_mapping", "category_fallback"} else "category_fallback",
        summary_headline=summary_headline,
        summary_text=summary_text,
        matrix_analysis=matrix,
        route_rationale=route_rationale,
        product_fit=product_fit,
        matched_points=matched_points[:4],
        tradeoffs=tradeoffs[:4],
        guardrails=_dedupe_texts(guardrails)[:4],
        confidence=max(0, min(100, confidence)),
        needs_review=bool(needs_review),
    )


def _build_selection_route_rationale(
    *,
    route_key: str,
    route_title: str,
    matrix: MobileSelectionMatrixAnalysis,
) -> list[dict[str, Any]]:
    entries: list[dict[str, Any]] = []
    for item in matrix.question_contributions:
        delta = 0
        for delta_item in item.route_deltas:
            if str(delta_item.route_key) == route_key:
                delta = int(delta_item.delta)
                break
        if delta > 0:
            reason = f"这题为 {route_title} 增加 {delta} 分，是结果收敛的直接推动项。"
        elif delta < 0:
            reason = f"这题对 {route_title} 形成 {delta} 分阻力，但没有改变最终收敛方向。"
        else:
            reason = f"这题没有直接拉高 {route_title}，但也没有把结果推离当前路线。"
        entries.append(
            {
                "question_key": item.question_key,
                "question_title": item.question_title,
                "answer_label": item.answer_label,
                "route_delta": delta,
                "reason": reason,
            }
        )
    entries.sort(key=lambda item: (-int(item["route_delta"]), item["question_key"]))
    return entries[:4]


def _build_selection_product_fit(
    *,
    category: str,
    route_key: str,
    analysis: ProductAnalysisStoredResult,
) -> tuple[list[dict[str, Any]], list[str], list[str], list[str], int, bool]:
    profile = analysis.profile
    diagnostics_payload = profile.diagnostics.model_dump()
    rules = get_route_diagnostic_rules(category, route_key)
    fit_items: list[dict[str, Any]] = []
    matched_points: list[str] = []
    tradeoffs: list[str] = []
    guardrails: list[str] = []
    weighted_score = 0
    weight_total = 0
    hard_mismatch = False

    for rule in rules:
        score_payload = diagnostics_payload.get(rule.diagnostic_key) or {}
        product_score = max(0, min(5, int(score_payload.get("score") or 0)))
        source_reason = str(score_payload.get("reason") or "").strip()
        fit_level = _evaluate_selection_fit_level(rule.desired_level, product_score)
        fit_reason = _selection_fit_reason(rule=rule, product_score=product_score, source_reason=source_reason, fit_level=fit_level)
        fit_items.append(
            {
                "diagnostic_key": rule.diagnostic_key,
                "diagnostic_label": rule.diagnostic_label,
                "desired_level": rule.desired_level,
                "product_score": product_score,
                "fit_level": fit_level,
                "reason": fit_reason,
            }
        )
        weight_total += max(1, int(rule.weight))
        weighted_score += _selection_fit_weight_value(fit_level) * max(1, int(rule.weight))
        if fit_level == "high" and rule.weight >= 2:
            matched_points.append(f"{rule.diagnostic_label}与当前路线高度贴合：{source_reason or f'当前分值 {product_score}/5。'}")
        if fit_level == "low":
            tradeoffs.append(f"{rule.diagnostic_label}与当前路线不完全一致：{source_reason or f'当前分值 {product_score}/5。'}")
            if rule.weight >= 3:
                hard_mismatch = True

    if profile.subtype_fit_verdict in {"fit_with_limits", "weak_fit", "mismatch"}:
        tradeoffs.append(f"产品分析本身给出的路线判断是 {profile.subtype_fit_verdict}，说明这款主推与目标子类并非毫无边界。")
    if profile.needs_review:
        guardrails.append("当前产品分析已标记为待复核，建议结合产品详情页再判断。")
    for code in profile.evidence.missing_codes[:2]:
        guardrails.append(f"产品分析存在证据缺口：{_selection_missing_code_label(code)}。")
    if not matched_points:
        matched_points.append("当前主推至少在大方向上与测评路线一致，但高强度匹配证据不算充足。")
    if not tradeoffs:
        tradeoffs.extend(profile.watchouts[:2] or ["当前主推没有明显反向信号，但仍建议结合使用习惯和季节状态判断。"])

    confidence = int(round((weighted_score / max(1, weight_total)) * 100 / 2))
    confidence = int(round((confidence + int(profile.confidence or 0)) / 2))
    needs_review = hard_mismatch or profile.needs_review or profile.subtype_fit_verdict in {"weak_fit", "mismatch"}
    return fit_items[:6], _dedupe_texts(matched_points), _dedupe_texts(tradeoffs), _dedupe_texts(guardrails), confidence, needs_review


def _build_selection_guardrails(matrix: MobileSelectionMatrixAnalysis) -> list[str]:
    items: list[str] = []
    for veto in matrix.triggered_vetoes:
        blocked = "、".join(route.route_title for route in veto.excluded_routes) or "若干路线"
        note = str(veto.note or veto.trigger).strip()
        items.append(f"{note}；系统因此排除了 {blocked}。")
    return _dedupe_texts(items)


def _build_selection_summary_text(
    *,
    route_title: str,
    route_rationale: list[dict[str, Any]],
    matched_points: list[str],
    tradeoffs: list[str],
    analysis: ProductAnalysisStoredResult | None,
) -> tuple[str, str]:
    primary_reason = route_rationale[0]["reason"] if route_rationale else f"你的答案整体更偏向 {route_title}。"
    if analysis is None:
        return (
            f"你当前更适合 {route_title} 方向",
            f"{primary_reason} 系统已先按这条路线给出主推，但产品侧的增强分析暂时缺失，所以推荐解释仍不完整。",
        )
    verdict = str(analysis.profile.subtype_fit_verdict or "").strip()
    if verdict == "strong_fit":
        headline = f"你当前更适合 {route_title}，主推与路线高度一致"
    elif verdict == "fit_with_limits":
        headline = f"你当前更偏 {route_title}，主推大方向匹配"
    else:
        headline = f"你当前落在 {route_title}，但主推仍有边界"
    summary = primary_reason
    if matched_points:
        summary += f" 产品侧最强匹配点是：{matched_points[0]}"
    if tradeoffs:
        summary += f" 需要注意的是：{tradeoffs[0]}"
    return headline, summary


def _evaluate_selection_fit_level(desired_level: str, product_score: int) -> str:
    score = max(0, min(5, int(product_score)))
    if desired_level == "high":
        if score >= 4:
            return "high"
        if score == 3:
            return "medium"
        return "low"
    if desired_level == "mid":
        if 2 <= score <= 4:
            return "high"
        if score in {1, 5}:
            return "medium"
        return "low"
    if score <= 1:
        return "high"
    if score == 2:
        return "medium"
    return "low"


def _selection_fit_reason(
    *,
    rule: RouteDiagnosticRule,
    product_score: int,
    source_reason: str,
    fit_level: str,
) -> str:
    desired_text = {"high": "应该更强", "mid": "应该适中", "low": "应该更低"}.get(rule.desired_level, "应该更贴合")
    prefix = f"{rule.diagnostic_label}当前 {product_score}/5，按路线预期它{desired_text}。"
    if source_reason:
        return f"{prefix} {source_reason}"
    return f"{prefix} 当前匹配度为 {fit_level}。"


def _selection_fit_weight_value(fit_level: str) -> int:
    if fit_level == "high":
        return 2
    if fit_level == "medium":
        return 1
    return 0


def _selection_missing_code_label(code: str) -> str:
    mapping = {
        "route_support_missing": "路线支撑不足",
        "evidence_too_sparse": "证据过少",
        "active_strength_unclear": "活性强度不明",
        "ingredient_order_unclear": "成分排序不明",
        "formula_signal_conflict": "配方信号冲突",
        "ingredient_library_absent": "缺少成分库摘要",
        "summary_signal_too_weak": "摘要信号偏弱",
    }
    return mapping.get(str(code or "").strip(), str(code or "").strip() or "未知缺口")


def _dedupe_texts(items: list[str]) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()
    for item in items:
        value = str(item or "").strip()
        if not value or value in seen:
            continue
        seen.add(value)
        out.append(value)
    return out


def _build_answers_hash(category: str, answers: dict[str, str]) -> str:
    canonical = json.dumps({"category": category, "answers": answers}, ensure_ascii=False, sort_keys=True)
    return hashlib.sha1(canonical.encode("utf-8")).hexdigest()


def _normalize_answers(raw: dict[str, str]) -> dict[str, str]:
    normalized: dict[str, str] = {}
    for k, v in (raw or {}).items():
        key = str(k or "").strip()
        value = str(v or "").strip()
        if not key or not value:
            continue
        normalized[key] = value
    return normalized


def _selection_target_type_key(category: str, route_key: str) -> str | None:
    normalized_category = str(category or "").strip().lower()
    normalized_route_key = str(route_key or "").strip()
    if normalized_category not in ROUTE_MAPPED_CATEGORIES:
        if normalized_category in VALID_CATEGORIES:
            return CATEGORY_LEVEL_TARGET_KEY
        return None
    return normalized_route_key or None


def _pick_featured_product_row(
    db: Session,
    category: str,
    target_type_key: str,
) -> ProductIndex | None:
    try:
        slot = db.execute(
            select(ProductFeaturedSlot)
            .where(ProductFeaturedSlot.category == category)
            .where(ProductFeaturedSlot.target_type_key == target_type_key)
            .limit(1)
        ).scalars().first()
    except OperationalError as exc:
        raise _featured_slot_schema_http_error(exc) from exc
    if slot is None:
        return None
    product_id = str(slot.product_id or "").strip()
    if not product_id:
        return None
    product = db.get(ProductIndex, product_id)
    if product is None:
        return None
    if str(product.category or "").strip().lower() != category:
        return None
    if not exists_rel_path(str(product.json_path or "")):
        return None
    return product


def _extract_route_score_from_mapping(scores_json: str, target_type_key: str) -> int | None:
    raw = str(scores_json or "").strip()
    if not raw:
        return None
    try:
        parsed = json.loads(raw)
    except Exception:
        return None
    if not isinstance(parsed, list):
        return None
    for item in parsed:
        if not isinstance(item, dict):
            continue
        route_key = str(item.get("route_key") or "").strip()
        if route_key != target_type_key:
            continue
        try:
            score = int(item.get("confidence"))
        except Exception:
            return None
        return max(0, min(100, score))
    return None


def _pick_route_mapped_product_row(
    db: Session,
    category: str,
    target_type_key: str,
    rules_version: str,
) -> ProductIndex | None:
    try:
        rows = db.execute(
            select(ProductRouteMappingIndex)
            .where(ProductRouteMappingIndex.category == category)
            .where(ProductRouteMappingIndex.rules_version == rules_version)
            .where(ProductRouteMappingIndex.status == "ready")
            .order_by(ProductRouteMappingIndex.last_generated_at.desc())
        ).scalars().all()
    except OperationalError:
        return None

    best_row: ProductIndex | None = None
    best_score = -1
    best_generated_at = ""
    for mapping in rows:
        score = _extract_route_score_from_mapping(str(mapping.scores_json or ""), target_type_key)
        if score is None or score <= 0:
            continue
        product = db.get(ProductIndex, str(mapping.product_id))
        if not product:
            continue
        if str(product.category or "").strip().lower() != category:
            continue
        if not exists_rel_path(str(product.json_path or "")):
            continue
        generated_at = str(mapping.last_generated_at or "")
        if score > best_score or (score == best_score and generated_at > best_generated_at):
            best_score = score
            best_generated_at = generated_at
            best_row = product
    return best_row


def _pick_product_row(db: Session, category: str) -> ProductIndex | None:
    return db.execute(
        select(ProductIndex)
        .where(ProductIndex.category == category)
        .order_by(ProductIndex.created_at.desc())
        .limit(1)
    ).scalars().first()


def _resolve_selection_product_row(
    *,
    db: Session,
    category: str,
    route_key: str,
) -> tuple[ProductIndex, str]:
    target_type_key = _selection_target_type_key(category=category, route_key=route_key)
    if not target_type_key:
        raise HTTPException(
            status_code=422,
            detail=f"Cannot resolve target_type_key for category='{category}', route='{route_key}'.",
        )

    featured_query_error: str | None = None
    recommendation_source = "category_fallback"
    try:
        product_row = _pick_featured_product_row(
            db=db,
            category=category,
            target_type_key=target_type_key,
        )
        if product_row is not None:
            recommendation_source = "featured_slot"
    except HTTPException as exc:
        featured_query_error = str(exc.detail)
        product_row = None

    if product_row is None:
        product_row = _pick_route_mapped_product_row(
            db=db,
            category=category,
            target_type_key=target_type_key,
            rules_version=MOBILE_RULES_VERSION,
        )
        if product_row is not None:
            recommendation_source = "route_mapping"
    if product_row is None:
        product_row = _pick_product_row(db=db, category=category)
        recommendation_source = "category_fallback"
    if product_row is None:
        if featured_query_error:
            raise HTTPException(status_code=500, detail=featured_query_error)
        raise HTTPException(status_code=422, detail=f"No product found for category '{category}'.")
    return product_row, recommendation_source


def _row_to_product_card(row: ProductIndex) -> ProductCard:
    preferred_image_rel = preferred_image_rel_path(str(row.image_path or "").strip())
    image_url = f"/{preferred_image_rel.lstrip('/')}" if preferred_image_rel else None
    tags: list[str] = []
    raw_tags = str(row.tags_json or "").strip()
    if raw_tags:
        try:
            parsed = json.loads(raw_tags)
            if isinstance(parsed, list):
                tags = [str(item).strip() for item in parsed if str(item).strip()]
        except Exception:
            tags = []
    return ProductCard(
        id=str(row.id),
        category=str(row.category),
        brand=row.brand,
        name=row.name,
        one_sentence=row.one_sentence,
        tags=tags,
        image_url=image_url,
        created_at=row.created_at,
    )


def _resolve_selection(category: str, answers: dict[str, str]) -> dict[str, Any]:
    config, route_titles, wiki_href = _selection_matrix_assets(category)
    try:
        decision = resolve_matrix_selection(config, answers)
    except MatrixDecisionError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return _build_resolved_selection_payload(
        category=category,
        config=config,
        route_titles=route_titles,
        decision=decision,
        wiki_href=wiki_href(decision.best_category),
    )


def _selection_matrix_assets(
    category: str,
) -> tuple[MatrixDecisionConfig, dict[str, str], Callable[[str], str]]:
    normalized = str(category or "").strip().lower()
    if normalized == "shampoo":
        return SHAMPOO_MATRIX_CONFIG, SHAMPOO_ROUTE_TITLES, lambda route_key: f"/m/wiki/shampoo?focus={route_key}"
    if normalized == "bodywash":
        return BODYWASH_MATRIX_CONFIG, BODYWASH_ROUTE_TITLES, lambda _route_key: "/m/wiki/bodywash"
    if normalized == "conditioner":
        return CONDITIONER_MATRIX_CONFIG, CONDITIONER_ROUTE_TITLES, lambda _route_key: "/m/wiki/conditioner"
    if normalized == "lotion":
        return LOTION_MATRIX_CONFIG, LOTION_ROUTE_TITLES, lambda _route_key: "/m/wiki/lotion"
    if normalized == "cleanser":
        return CLEANSER_MATRIX_CONFIG, CLEANSER_ROUTE_TITLES, lambda _route_key: "/m/wiki/cleanser"
    raise HTTPException(status_code=400, detail=f"Unsupported category: {category}.")


def _build_resolved_selection_payload(
    *,
    category: str,
    config: MatrixDecisionConfig,
    route_titles: dict[str, str],
    decision: MatrixDecisionResult,
    wiki_href: str,
) -> dict[str, Any]:
    route_key = decision.best_category
    route_title = route_titles.get(route_key, route_key)
    normalized_answers = decision.normalized_answers

    choices: list[dict[str, str]] = []
    for question in config.questions:
        value = normalized_answers.get(question.key)
        if not value:
            continue
        label = question.options.get(value) or value
        choices.append({"key": question.key, "value": value, "label": label})

    rule_hits: list[dict[str, str]] = []
    for question in config.questions:
        value = normalized_answers.get(question.key)
        if not value:
            continue
        deltas = decision.question_contributions.get(question.key) or {}
        effect = " / ".join(
            f"{category_key}:{'+' if points >= 0 else ''}{points}"
            for category_key, points in deltas.items()
        )
        rule_hits.append(
            {
                "rule": question.key,
                "effect": f"{question.title}={question.options.get(value) or value}；得分贡献 {effect}",
            }
        )

    for item in decision.triggered_vetoes:
        blocked = "、".join(item.excluded_categories) if item.excluded_categories else "-"
        note = item.note or item.trigger
        rule_hits.append({"rule": "veto", "effect": f"{note}（禁用：{blocked}）"})

    top2_text = " / ".join(
        f"{route_titles.get(route_key_item, route_key_item)}:{score}"
        for route_key_item, score in decision.top2
    ) or "-"
    rule_hits.append({"rule": "route", "effect": f"最终收敛：{route_title}（{route_key}）；Top2={top2_text}"})

    return {
        "answers": normalized_answers,
        "route_key": route_key,
        "route_title": route_title,
        "choices": choices,
        "rule_hits": rule_hits,
        "matrix_analysis": _build_mobile_selection_matrix_analysis(
            config=config,
            route_titles=route_titles,
            decision=decision,
        ),
        "wiki_href": wiki_href,
    }


def _build_mobile_selection_matrix_analysis(
    *,
    config: MatrixDecisionConfig,
    route_titles: dict[str, str],
    decision: MatrixDecisionResult,
) -> dict[str, Any]:
    best_score = int(decision.scores_after_mask.get(decision.best_category, 0))
    excluded_set = set(decision.excluded_categories)

    eligible_sorted = sorted(
        [route_key for route_key in config.categories if route_key not in excluded_set],
        key=lambda route_key: (
            -int(decision.scores_after_mask.get(route_key, 0)),
            list(config.categories).index(route_key),
        ),
    )
    rank_map = {route_key: idx + 1 for idx, route_key in enumerate(eligible_sorted)}
    excluded_rank_start = len(eligible_sorted) + 1

    routes: list[MobileSelectionMatrixRouteScore] = []
    for idx, route_key in enumerate(config.categories):
        is_excluded = route_key in excluded_set
        before_mask = int(decision.scores_before_mask.get(route_key, 0))
        after_raw = int(decision.scores_after_mask.get(route_key, 0))
        score_after_mask = None if is_excluded else after_raw
        gap_from_best = None if is_excluded else max(0, best_score - after_raw)
        routes.append(
            MobileSelectionMatrixRouteScore(
                route_key=route_key,
                route_title=route_titles.get(route_key, route_key),
                score_before_mask=before_mask,
                score_after_mask=score_after_mask,
                is_excluded=is_excluded,
                rank=(excluded_rank_start + idx) if is_excluded else rank_map.get(route_key, 0),
                gap_from_best=gap_from_best,
            )
        )

    question_contributions: list[MobileSelectionMatrixQuestionContribution] = []
    for question in config.questions:
        value = decision.normalized_answers.get(question.key)
        if not value:
            continue
        deltas = decision.question_contributions.get(question.key) or {}
        route_deltas = [
            MobileSelectionMatrixQuestionRouteDelta(
                route_key=route_key,
                route_title=route_titles.get(route_key, route_key),
                delta=int(deltas.get(route_key, 0)),
            )
            for route_key in config.categories
        ]
        question_contributions.append(
            MobileSelectionMatrixQuestionContribution(
                question_key=question.key,
                question_title=question.title,
                answer_value=value,
                answer_label=question.options.get(value) or value,
                route_deltas=route_deltas,
            )
        )

    triggered_vetoes = [
        MobileSelectionMatrixTriggeredVeto(
            trigger=item.trigger,
            note=item.note,
            excluded_routes=[
                MobileSelectionMatrixVetoRoute(
                    route_key=route_key,
                    route_title=route_titles.get(route_key, route_key),
                )
                for route_key in item.excluded_categories
            ],
        )
        for item in decision.triggered_vetoes
    ]
    top2 = [
        MobileSelectionMatrixTopRoute(
            route_key=route_key,
            route_title=route_titles.get(route_key, route_key),
            score_after_mask=int(score),
        )
        for route_key, score in decision.top2
    ]

    return MobileSelectionMatrixAnalysis(
        routes=routes,
        question_contributions=question_contributions,
        triggered_vetoes=triggered_vetoes,
        top2=top2,
    ).model_dump()
