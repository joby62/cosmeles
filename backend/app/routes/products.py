import json
import queue
import threading
import hashlib
import re
import io
import zipfile
import unicodedata
from datetime import datetime, timezone
from pathlib import Path
from collections import defaultdict
from typing import Any, Callable

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select, func
from sqlalchemy.exc import OperationalError
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import sessionmaker

from app.ai.orchestrator import run_capability_now
from app.ai.prompts import load_prompt
from app.constants import VALID_CATEGORIES, MOBILE_RULES_VERSION, ROUTE_MAPPING_SUPPORTED_CATEGORIES
from app.db.session import get_db
from app.db.models import (
    ProductIndex,
    IngredientLibraryIndex,
    IngredientLibraryAlias,
    IngredientLibraryRedirect,
    IngredientLibraryBuildJob,
    ProductRouteMappingIndex,
    ProductFeaturedSlot,
    MobileSelectionSession,
    MobileBagItem,
    MobileCompareUsageStat,
)
from app.settings import settings
from app.services.storage import (
    load_json,
    read_rel_bytes,
    save_json_at,
    now_iso,
    new_id,
    save_ingredient_profile,
    ingredient_profile_rel_path,
    exists_rel_path,
    remove_rel_path,
    remove_rel_dir,
    remove_product_images,
    image_variant_rel_paths,
    preferred_image_rel_path,
    cleanup_orphan_storage,
    save_product_route_mapping,
    product_route_mapping_rel_path,
)
from app.schemas import (
    ProductCard,
    ProductListResponse,
    ProductListMeta,
    CategoryCount,
    ProductRouteMappingIndexListResponse,
    ProductRouteMappingIndexItem,
    ProductFeaturedSlotItem,
    ProductFeaturedSlotListResponse,
    ProductFeaturedSlotUpsertRequest,
    ProductFeaturedSlotClearRequest,
    ProductFeaturedSlotClearResponse,
    ProductUpdateRequest,
    ProductDedupSuggestRequest,
    ProductDedupSuggestResponse,
    ProductDedupSuggestion,
    ProductBatchDeleteRequest,
    ProductBatchDeleteResponse,
    OrphanStorageCleanupRequest,
    OrphanStorageCleanupResponse,
    MobileInvalidProductRefCleanupRequest,
    MobileInvalidProductRefCleanupResponse,
    IngredientLibraryBuildRequest,
    IngredientLibraryBuildResponse,
    IngredientLibraryBuildItem,
    IngredientLibraryPreflightRequest,
    IngredientLibraryPreflightResponse,
    IngredientLibraryNormalizationPackage,
    IngredientLibraryPreflightSummary,
    IngredientLibraryMergeCandidate,
    IngredientLibraryBuildJobCreateRequest,
    IngredientLibraryBuildJobView,
    IngredientLibraryBuildJobCounters,
    IngredientLibraryBuildJobError,
    IngredientLibraryBuildJobCancelResponse,
    IngredientLibraryBatchDeleteRequest,
    IngredientLibraryBatchDeleteResponse,
    IngredientLibraryDeleteFailureItem,
    IngredientLibraryListResponse,
    IngredientLibraryListItem,
    IngredientLibrarySourceSample,
    IngredientLibraryProfile,
    IngredientLibraryDetailItem,
    IngredientLibraryDetailResponse,
    ProductRouteMappingBuildRequest,
    ProductRouteMappingBuildResponse,
    ProductRouteMappingBuildItem,
    ProductRouteMappingScore,
    ProductRouteMappingResult,
    ProductRouteMappingDetailResponse,
)

router = APIRouter(prefix="/api", tags=["products"])

INGREDIENT_SOURCE_SCHEMA_VERSION = "v2026-03-05.1"
INGREDIENT_SOURCE_COOCCURRENCE_TOP_N = 15
INGREDIENT_BUILD_JOB_HEARTBEAT_SECONDS = 2
INGREDIENT_NORMALIZATION_PACKAGE_VERSION = "v2026-03-06.1"
INGREDIENT_NORMALIZATION_PACKAGES: tuple[dict[str, Any], ...] = (
    {
        "id": "unicode_nfkc",
        "label": "Unicode 规范化",
        "description": "统一全半角和兼容字符（NFKC），降低同字形差异。",
        "default_enabled": True,
        "mode": "auto_merge",
    },
    {
        "id": "whitespace_fold",
        "label": "空白折叠",
        "description": "连续空白折叠为一个空格，去除首尾空白。",
        "default_enabled": True,
        "mode": "auto_merge",
    },
    {
        "id": "punctuation_fold",
        "label": "标点归一",
        "description": "统一中英文括号/连接符/分隔符写法。",
        "default_enabled": True,
        "mode": "auto_merge",
    },
    {
        "id": "extract_en_parenthesis",
        "label": "括号英文提取",
        "description": "从“中文(English)”中提取英文别名用于映射。",
        "default_enabled": True,
        "mode": "auto_merge",
    },
    {
        "id": "en_exact",
        "label": "英文名精确归一",
        "description": "英文/INCI 完全一致时归并为同一 ingredient_key。",
        "default_enabled": True,
        "mode": "auto_merge",
    },
)
INGREDIENT_PUNCTUATION_FOLD_TABLE = str.maketrans(
    {
        "（": "(",
        "）": ")",
        "【": "[",
        "】": "]",
        "，": ",",
        "、": ",",
        "。": ".",
        "；": ";",
        "：": ":",
        "／": "/",
        "－": "-",
        "—": "-",
        "–": "-",
        "·": " ",
        "・": " ",
    }
)


class IngredientLibraryBuildCancelledError(RuntimeError):
    pass

@router.get("/products", response_model=list[ProductCard])
def list_products(
    category: str | None = Query(None),
    q: str | None = Query(None, description="search brand/name contains"),
    offset: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
    db: Session = Depends(get_db),
):
    if category:
        category = category.strip().lower()
        if category not in VALID_CATEGORIES:
            raise HTTPException(status_code=400, detail=f"Invalid category: {category}.")

    stmt = select(ProductIndex)
    if category:
        stmt = stmt.where(ProductIndex.category == category)
    if q:
        like = f"%{q}%"
        stmt = stmt.where((ProductIndex.name.like(like)) | (ProductIndex.brand.like(like)))

    stmt = stmt.order_by(ProductIndex.created_at.desc()).offset(offset).limit(limit)
    rows = db.execute(stmt).scalars().all()
    return [_row_to_card(r) for r in rows]

@router.get("/products/page", response_model=ProductListResponse)
def list_products_page(
    category: str | None = Query(None),
    q: str | None = Query(None, description="search brand/name contains"),
    offset: int = Query(0, ge=0),
    limit: int = Query(30, ge=1, le=200),
    db: Session = Depends(get_db),
):
    if category:
        category = category.strip().lower()
        if category not in VALID_CATEGORIES:
            raise HTTPException(status_code=400, detail=f"Invalid category: {category}.")

    stmt = select(ProductIndex)
    count_stmt = select(func.count()).select_from(ProductIndex)

    if category:
        stmt = stmt.where(ProductIndex.category == category)
        count_stmt = count_stmt.where(ProductIndex.category == category)
    if q:
        like = f"%{q}%"
        where_clause = (ProductIndex.name.like(like)) | (ProductIndex.brand.like(like))
        stmt = stmt.where(where_clause)
        count_stmt = count_stmt.where(where_clause)

    total = db.execute(count_stmt).scalar_one()
    rows = db.execute(stmt.order_by(ProductIndex.created_at.desc()).offset(offset).limit(limit)).scalars().all()

    return ProductListResponse(
        items=[_row_to_card(r) for r in rows],
        meta=ProductListMeta(total=total, offset=offset, limit=limit),
    )

@router.get("/categories/counts", response_model=list[CategoryCount])
def category_counts(db: Session = Depends(get_db)):
    rows = db.execute(
        select(ProductIndex.category, func.count(ProductIndex.id))
        .group_by(ProductIndex.category)
        .order_by(ProductIndex.category.asc())
    ).all()
    return [CategoryCount(category=category, count=count) for category, count in rows]

@router.get("/products/{product_id}")
def get_product(product_id: str, db: Session = Depends(get_db)):
    rec = db.get(ProductIndex, product_id)
    if not rec:
        raise HTTPException(status_code=404, detail="Not found")
    if not exists_rel_path(rec.json_path):
        raise HTTPException(status_code=404, detail="Product json file is missing.")
    doc = load_json(rec.json_path)
    preferred_image_rel = preferred_image_rel_path(str(rec.image_path or "").strip())
    if preferred_image_rel and isinstance(doc, dict):
        evidence = doc.setdefault("evidence", {})
        if isinstance(evidence, dict):
            evidence["image_path"] = preferred_image_rel
    return doc

@router.patch("/products/{product_id}", response_model=ProductCard)
def update_product(product_id: str, payload: ProductUpdateRequest, db: Session = Depends(get_db)):
    rec = db.get(ProductIndex, product_id)
    if not rec:
        raise HTTPException(status_code=404, detail="Not found")

    tags = None
    if payload.tags is not None:
        tags = _normalize_tags(payload.tags)
        rec.tags_json = json.dumps(tags, ensure_ascii=False)

    if payload.category is not None:
        cat = payload.category.strip().lower()
        if cat not in VALID_CATEGORIES:
            raise HTTPException(status_code=400, detail=f"Invalid category: {cat}.")
        rec.category = cat
    if payload.brand is not None:
        rec.brand = payload.brand.strip() or None
    if payload.name is not None:
        rec.name = payload.name.strip() or None
    if payload.one_sentence is not None:
        rec.one_sentence = payload.one_sentence.strip() or None

    if exists_rel_path(rec.json_path):
        doc = load_json(rec.json_path)
        doc.setdefault("product", {})
        doc.setdefault("summary", {})
        if payload.category is not None:
            doc["product"]["category"] = rec.category
        if payload.brand is not None:
            doc["product"]["brand"] = rec.brand
        if payload.name is not None:
            doc["product"]["name"] = rec.name
        if payload.one_sentence is not None:
            doc["summary"]["one_sentence"] = rec.one_sentence or ""
        if tags is not None:
            doc["tags"] = tags
        save_json_at(rec.json_path, doc)

    db.add(rec)
    db.commit()
    db.refresh(rec)
    return _row_to_card(rec)

@router.delete("/products/{product_id}")
def delete_product(product_id: str, db: Session = Depends(get_db)):
    rec = db.get(ProductIndex, product_id)
    if not rec:
        raise HTTPException(status_code=404, detail="Not found")

    removed = 0
    if remove_rel_path(rec.json_path):
        removed += 1
    image_removed, _ = remove_product_images(product_id=product_id, image_path=rec.image_path)
    removed += image_removed
    run_files, run_dirs = remove_rel_dir(f"doubao_runs/{product_id}")
    removed += run_files + run_dirs
    route_mapping_rec = db.get(ProductRouteMappingIndex, product_id)
    if route_mapping_rec:
        route_mapping_path = str(route_mapping_rec.storage_path or "").strip() or product_route_mapping_rel_path(
            str(route_mapping_rec.category or ""),
            product_id,
        )
        if route_mapping_path and remove_rel_path(route_mapping_path):
            removed += 1
        db.delete(route_mapping_rec)
    try:
        featured_slots = db.execute(
            select(ProductFeaturedSlot).where(ProductFeaturedSlot.product_id == product_id)
        ).scalars().all()
    except OperationalError as exc:
        raise _featured_slot_schema_http_error(exc) from exc
    for slot in featured_slots:
        db.delete(slot)

    db.delete(rec)
    db.commit()
    return {"id": product_id, "status": "deleted", "removed_files": removed}


@router.post("/products/dedup/suggest", response_model=ProductDedupSuggestResponse)
def suggest_product_duplicates(payload: ProductDedupSuggestRequest, db: Session = Depends(get_db)):
    return _suggest_product_duplicates_impl(payload, db, event_callback=None)


@router.post("/products/dedup/suggest/stream")
def suggest_product_duplicates_stream(payload: ProductDedupSuggestRequest, db: Session = Depends(get_db)):
    events: queue.Queue[tuple[str, dict[str, Any]] | None] = queue.Queue()
    SessionMaker = sessionmaker(autocommit=False, autoflush=False, bind=db.get_bind())

    def emit(event: str, body: dict[str, Any]) -> None:
        events.put((event, body))

    def worker() -> None:
        local_db = SessionMaker()
        try:
            result = _suggest_product_duplicates_impl(payload, local_db, event_callback=lambda e: emit("progress", e))
            emit("result", result.model_dump())
        except HTTPException as e:
            emit("error", {"status": e.status_code, "detail": e.detail})
        except Exception as e:  # pragma: no cover
            emit("error", {"status": 500, "detail": f"dedup suggest failed: {e}"})
        finally:
            emit("done", {"status": "done"})
            events.put(None)
            local_db.close()

    threading.Thread(target=worker, daemon=True).start()
    return StreamingResponse(
        _sse_iter(events),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Pragma": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/products/ingredients/library/build", response_model=IngredientLibraryBuildResponse)
def build_ingredient_library(payload: IngredientLibraryBuildRequest, db: Session = Depends(get_db)):
    return _build_ingredient_library_impl(payload, db, event_callback=None)


@router.post("/products/ingredients/library/build/stream")
def build_ingredient_library_stream(payload: IngredientLibraryBuildRequest, db: Session = Depends(get_db)):
    events: queue.Queue[tuple[str, dict[str, Any]] | None] = queue.Queue()
    SessionMaker = sessionmaker(autocommit=False, autoflush=False, bind=db.get_bind())

    def emit(event: str, body: dict[str, Any]) -> None:
        events.put((event, body))

    def worker() -> None:
        local_db = SessionMaker()
        try:
            result = _build_ingredient_library_impl(payload, local_db, event_callback=lambda e: emit("progress", e))
            emit("result", result.model_dump())
        except HTTPException as e:
            emit("error", {"status": e.status_code, "detail": e.detail})
        except Exception as e:  # pragma: no cover
            emit("error", {"status": 500, "detail": f"ingredient library build failed: {e}"})
        finally:
            emit("done", {"status": "done"})
            events.put(None)
            local_db.close()

    threading.Thread(target=worker, daemon=True).start()
    return StreamingResponse(
        _sse_iter(events),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Pragma": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/products/ingredients/library/preflight", response_model=IngredientLibraryPreflightResponse)
def preview_ingredient_library_preflight(payload: IngredientLibraryPreflightRequest, db: Session = Depends(get_db)):
    return _ingredient_library_preflight(payload=payload, db=db)


@router.post("/products/ingredients/library/jobs", response_model=IngredientLibraryBuildJobView)
def create_ingredient_library_build_job(
    payload: IngredientLibraryBuildJobCreateRequest,
    db: Session = Depends(get_db),
):
    normalized_category = _normalize_optional_category(payload.category)
    normalized_packages = _normalize_ingredient_normalization_packages(payload.normalization_packages)
    _ensure_ingredient_build_job_table(db)

    now = now_iso()
    rec = IngredientLibraryBuildJob(
        job_id=new_id(),
        status="queued",
        category=normalized_category,
        force_regenerate=bool(payload.force_regenerate),
        max_sources_per_ingredient=int(payload.max_sources_per_ingredient),
        stage="queued",
        stage_label=_ingredient_build_stage_label("queued"),
        message="任务已创建，等待执行。",
        percent=0,
        current_index=None,
        current_total=None,
        current_ingredient_id=None,
        current_ingredient_name=None,
        scanned_products=0,
        unique_ingredients=0,
        backfilled_from_storage=0,
        submitted_to_model=0,
        created_count=0,
        updated_count=0,
        skipped_count=0,
        failed_count=0,
        cancel_requested=False,
        result_json=None,
        error_json=None,
        created_at=now,
        updated_at=now,
        started_at=None,
        finished_at=None,
    )
    db.add(rec)
    db.commit()
    db.refresh(rec)

    SessionMaker = sessionmaker(autocommit=False, autoflush=False, bind=db.get_bind())

    def worker() -> None:
        local_db = SessionMaker()
        try:
            build_payload = IngredientLibraryBuildRequest(
                category=normalized_category,
                force_regenerate=bool(payload.force_regenerate),
                max_sources_per_ingredient=int(payload.max_sources_per_ingredient),
                normalization_packages=normalized_packages,
            )
            _run_ingredient_library_build_job(job_id=rec.job_id, payload=build_payload, db=local_db)
        finally:
            local_db.close()

    threading.Thread(target=worker, daemon=True).start()
    return _to_ingredient_build_job_view(rec)


@router.get("/products/ingredients/library/jobs", response_model=list[IngredientLibraryBuildJobView])
def list_ingredient_library_build_jobs(
    status: str | None = Query(None),
    category: str | None = Query(None),
    offset: int = Query(0, ge=0),
    limit: int = Query(30, ge=1, le=200),
    db: Session = Depends(get_db),
):
    _ensure_ingredient_build_job_table(db)
    normalized_category = _normalize_optional_category(category)
    normalized_status = str(status or "").strip().lower() or None
    if normalized_status and normalized_status not in {"queued", "running", "cancelling", "cancelled", "done", "failed"}:
        raise HTTPException(status_code=400, detail=f"Invalid status: {normalized_status}.")

    stmt = select(IngredientLibraryBuildJob)
    if normalized_status:
        stmt = stmt.where(IngredientLibraryBuildJob.status == normalized_status)
    if normalized_category:
        stmt = stmt.where(IngredientLibraryBuildJob.category == normalized_category)
    rows = db.execute(
        stmt.order_by(IngredientLibraryBuildJob.updated_at.desc()).offset(offset).limit(limit)
    ).scalars().all()
    return [_to_ingredient_build_job_view(row) for row in rows]


@router.get("/products/ingredients/library/jobs/{job_id}", response_model=IngredientLibraryBuildJobView)
def get_ingredient_library_build_job(job_id: str, db: Session = Depends(get_db)):
    _ensure_ingredient_build_job_table(db)
    rec = db.get(IngredientLibraryBuildJob, job_id)
    if rec is None:
        raise HTTPException(status_code=404, detail=f"Ingredient build job '{job_id}' not found.")
    return _to_ingredient_build_job_view(rec)


@router.post("/products/ingredients/library/jobs/{job_id}/cancel", response_model=IngredientLibraryBuildJobCancelResponse)
def cancel_ingredient_library_build_job(job_id: str, db: Session = Depends(get_db)):
    _ensure_ingredient_build_job_table(db)
    rec = db.get(IngredientLibraryBuildJob, job_id)
    if rec is None:
        raise HTTPException(status_code=404, detail=f"Ingredient build job '{job_id}' not found.")

    status = str(rec.status or "").strip().lower()
    if status in {"done", "failed", "cancelled"}:
        return IngredientLibraryBuildJobCancelResponse(status="ok", job=_to_ingredient_build_job_view(rec))

    rec.cancel_requested = True
    rec.updated_at = now_iso()
    if status == "queued":
        rec.status = "cancelled"
        rec.stage = "cancelled"
        rec.stage_label = _ingredient_build_stage_label("cancelled")
        rec.message = "任务在启动前已取消。"
        rec.percent = 0
        rec.finished_at = rec.updated_at
    else:
        rec.status = "cancelling"
        rec.stage = "cancelling"
        rec.stage_label = _ingredient_build_stage_label("cancelling")
        rec.message = "已收到取消请求，当前成分处理结束后停止。"
    db.add(rec)
    db.commit()
    db.refresh(rec)
    return IngredientLibraryBuildJobCancelResponse(status="ok", job=_to_ingredient_build_job_view(rec))


@router.post("/products/ingredients/library/batch-delete", response_model=IngredientLibraryBatchDeleteResponse)
def batch_delete_ingredient_library(
    payload: IngredientLibraryBatchDeleteRequest,
    db: Session = Depends(get_db),
):
    _ensure_ingredient_index_table(db)
    _ensure_ingredient_alias_tables(db)
    ingredient_ids = _normalize_ingredient_id_list(payload.ingredient_ids)
    if not ingredient_ids:
        raise HTTPException(status_code=400, detail="ingredient_ids cannot be empty.")

    rows = db.execute(
        select(IngredientLibraryIndex).where(IngredientLibraryIndex.ingredient_id.in_(ingredient_ids))
    ).scalars().all()
    by_id = {str(row.ingredient_id): row for row in rows}

    deleted_ids: list[str] = []
    missing_ids: list[str] = []
    failed_items: list[IngredientLibraryDeleteFailureItem] = []
    removed_files = 0
    removed_dirs = 0
    dirty = False

    for ingredient_id in ingredient_ids:
        rec = by_id.get(ingredient_id)
        try:
            profile_path = _resolve_ingredient_profile_path_for_delete(rec=rec, ingredient_id=ingredient_id)
            profile_deleted = False
            if profile_path and exists_rel_path(profile_path):
                if remove_rel_path(profile_path):
                    profile_deleted = True
                    removed_files += 1

            if rec is not None:
                alias_rows = db.execute(
                    select(IngredientLibraryAlias)
                    .where(IngredientLibraryAlias.category == str(rec.category or "").strip().lower())
                    .where(IngredientLibraryAlias.ingredient_id == ingredient_id)
                ).scalars().all()
                for alias_row in alias_rows:
                    db.delete(alias_row)
                redirect_rows = db.execute(
                    select(IngredientLibraryRedirect).where(
                        (IngredientLibraryRedirect.old_ingredient_id == ingredient_id)
                        | (IngredientLibraryRedirect.new_ingredient_id == ingredient_id)
                    )
                ).scalars().all()
                for redirect_row in redirect_rows:
                    db.delete(redirect_row)
                db.delete(rec)
                dirty = True

            if bool(payload.remove_doubao_artifacts):
                run_files, run_dirs = remove_rel_dir(f"doubao_runs/{ingredient_id}")
                removed_files += run_files
                removed_dirs += run_dirs

            if rec is None and not profile_deleted:
                missing_ids.append(ingredient_id)
                continue
            deleted_ids.append(ingredient_id)
        except Exception as e:
            failed_items.append(IngredientLibraryDeleteFailureItem(ingredient_id=ingredient_id, error=str(e)))

    if dirty:
        db.commit()

    return IngredientLibraryBatchDeleteResponse(
        status="ok",
        deleted_ids=deleted_ids,
        missing_ids=missing_ids,
        failed_items=failed_items,
        removed_files=removed_files,
        removed_dirs=removed_dirs,
    )


@router.get("/products/ingredients/library", response_model=IngredientLibraryListResponse)
def list_ingredient_library(
    category: str | None = Query(None),
    q: str | None = Query(None, description="search ingredient name/summary"),
    offset: int = Query(0, ge=0),
    limit: int = Query(80, ge=1, le=500),
):
    normalized_category = _normalize_optional_category(category)
    query = str(q or "").strip()
    query_lc = query.lower()

    items: list[IngredientLibraryListItem] = []
    for rel_path in _iter_ingredient_profile_rel_paths(category=normalized_category):
        try:
            doc = _load_ingredient_profile_doc(rel_path=rel_path)
            item = _to_ingredient_library_list_item(doc=doc, rel_path=rel_path)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Invalid ingredient profile '{rel_path}': {e}") from e

        haystack = f"{item.ingredient_name} {item.summary}".lower()
        if query_lc and query_lc not in haystack:
            continue
        items.append(item)

    items.sort(key=lambda item: (item.generated_at or "", item.ingredient_name.lower(), item.ingredient_id), reverse=True)
    total = len(items)
    paged = items[offset : offset + limit]
    return IngredientLibraryListResponse(
        status="ok",
        category=normalized_category,
        query=(query or None),
        total=total,
        offset=offset,
        limit=limit,
        items=paged,
    )


@router.get("/products/ingredients/library/{category}/{ingredient_id}", response_model=IngredientLibraryDetailResponse)
def get_ingredient_library_item(category: str, ingredient_id: str, db: Session = Depends(get_db)):
    normalized_category = _normalize_required_category(category)
    normalized_ingredient_id = str(ingredient_id or "").strip().lower()
    if not normalized_ingredient_id:
        raise HTTPException(status_code=400, detail="ingredient_id is required.")
    _ensure_ingredient_alias_tables(db)
    resolved_ingredient_id = _resolve_ingredient_id_redirect(
        db=db,
        category=normalized_category,
        ingredient_id=normalized_ingredient_id,
    )

    rel_path = ingredient_profile_rel_path(normalized_category, resolved_ingredient_id)
    if not exists_rel_path(rel_path):
        raise HTTPException(
            status_code=404,
            detail=(
                f"Ingredient profile not found: {normalized_category}/{normalized_ingredient_id}."
                if resolved_ingredient_id == normalized_ingredient_id
                else (
                    f"Ingredient profile not found after redirect: {normalized_category}/{normalized_ingredient_id} "
                    f"-> {resolved_ingredient_id}."
                )
            ),
        )

    try:
        doc = _load_ingredient_profile_doc(rel_path=rel_path)
        item = _to_ingredient_library_detail_item(doc=doc, rel_path=rel_path)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Invalid ingredient profile '{rel_path}': {e}") from e

    return IngredientLibraryDetailResponse(status="ok", item=item)


@router.post("/products/route-mapping/build", response_model=ProductRouteMappingBuildResponse)
def build_product_route_mapping(payload: ProductRouteMappingBuildRequest, db: Session = Depends(get_db)):
    return _build_product_route_mapping_impl(payload, db=db, event_callback=None)


@router.post("/products/route-mapping/build/stream")
def build_product_route_mapping_stream(payload: ProductRouteMappingBuildRequest, db: Session = Depends(get_db)):
    events: queue.Queue[tuple[str, dict[str, Any]] | None] = queue.Queue()
    SessionMaker = sessionmaker(autocommit=False, autoflush=False, bind=db.get_bind())

    def emit(event: str, body: dict[str, Any]) -> None:
        events.put((event, body))

    def worker() -> None:
        local_db = SessionMaker()
        try:
            result = _build_product_route_mapping_impl(payload, local_db, event_callback=lambda e: emit("progress", e))
            emit("result", result.model_dump())
        except HTTPException as e:
            emit("error", {"status": e.status_code, "detail": e.detail})
        except Exception as e:  # pragma: no cover
            emit("error", {"status": 500, "detail": f"route mapping build failed: {e}"})
        finally:
            emit("done", {"status": "done"})
            events.put(None)
            local_db.close()

    threading.Thread(target=worker, daemon=True).start()
    return StreamingResponse(
        _sse_iter(events),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Pragma": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/products/{product_id}/route-mapping", response_model=ProductRouteMappingDetailResponse)
def get_product_route_mapping(product_id: str, db: Session = Depends(get_db)):
    rec = db.get(ProductRouteMappingIndex, product_id)
    if not rec or str(rec.status or "").strip().lower() != "ready":
        raise HTTPException(status_code=404, detail=f"Route mapping not found for product '{product_id}'.")
    storage_path = str(rec.storage_path or "").strip() or product_route_mapping_rel_path(str(rec.category or ""), product_id)
    if not exists_rel_path(storage_path):
        raise HTTPException(status_code=404, detail=f"Route mapping file missing for product '{product_id}'.")
    try:
        doc = load_json(storage_path)
        item = _to_product_route_mapping_result(doc=doc, storage_path=storage_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Invalid route mapping for product '{product_id}': {e}") from e
    return ProductRouteMappingDetailResponse(status="ok", item=item)


@router.get("/products/route-mapping/index", response_model=ProductRouteMappingIndexListResponse)
def list_product_route_mapping_index(
    category: str | None = Query(None),
    db: Session = Depends(get_db),
):
    normalized_category = _normalize_optional_category(category)
    stmt = select(ProductRouteMappingIndex)
    if normalized_category:
        stmt = stmt.where(ProductRouteMappingIndex.category == normalized_category)
    rows = db.execute(stmt.order_by(ProductRouteMappingIndex.last_generated_at.desc())).scalars().all()
    items = [
        ProductRouteMappingIndexItem(
            product_id=str(row.product_id),
            category=str(row.category),
            status=str(row.status or ""),
            primary_route_key=str(row.primary_route_key or ""),
            primary_route_title=str(row.primary_route_title or ""),
            primary_confidence=int(row.primary_confidence or 0),
            secondary_route_key=str(row.secondary_route_key or "").strip() or None,
            secondary_route_title=str(row.secondary_route_title or "").strip() or None,
            secondary_confidence=(int(row.secondary_confidence) if row.secondary_confidence is not None else None),
            needs_review=bool(row.needs_review),
            rules_version=str(row.rules_version or ""),
            last_generated_at=str(row.last_generated_at or "").strip() or None,
        )
        for row in rows
    ]
    return ProductRouteMappingIndexListResponse(
        status="ok",
        category=normalized_category,
        total=len(items),
        items=items,
    )


@router.get("/products/featured-slots", response_model=ProductFeaturedSlotListResponse)
def list_product_featured_slots(
    category: str | None = Query(None),
    db: Session = Depends(get_db),
):
    normalized_category = _normalize_optional_category(category)
    stmt = select(ProductFeaturedSlot)
    if normalized_category:
        stmt = stmt.where(ProductFeaturedSlot.category == normalized_category)
    try:
        rows = db.execute(stmt.order_by(ProductFeaturedSlot.category.asc(), ProductFeaturedSlot.target_type_key.asc())).scalars().all()
    except OperationalError as exc:
        raise _featured_slot_schema_http_error(exc) from exc
    items = [
        ProductFeaturedSlotItem(
            category=str(row.category or "").strip().lower(),
            target_type_key=str(row.target_type_key or "").strip(),
            product_id=str(row.product_id or "").strip(),
            updated_at=str(row.updated_at or "").strip(),
            updated_by=str(row.updated_by or "").strip() or None,
        )
        for row in rows
    ]
    return ProductFeaturedSlotListResponse(
        status="ok",
        category=normalized_category,
        total=len(items),
        items=items,
    )


@router.post("/products/featured-slots", response_model=ProductFeaturedSlotItem)
def upsert_product_featured_slot(
    payload: ProductFeaturedSlotUpsertRequest,
    db: Session = Depends(get_db),
):
    category = _normalize_required_category(payload.category)
    target_type_key = _normalize_target_type_key(payload.target_type_key)
    product_id = str(payload.product_id or "").strip()
    if not product_id:
        raise HTTPException(status_code=400, detail="product_id is required.")
    rec = db.get(ProductIndex, product_id)
    if not rec:
        raise HTTPException(status_code=404, detail=f"Product '{product_id}' not found.")
    if str(rec.category or "").strip().lower() != category:
        raise HTTPException(
            status_code=400,
            detail=f"Product '{product_id}' category mismatch: expected '{category}', got '{rec.category}'.",
        )

    try:
        row = db.execute(
            select(ProductFeaturedSlot)
            .where(ProductFeaturedSlot.category == category)
            .where(ProductFeaturedSlot.target_type_key == target_type_key)
            .limit(1)
        ).scalars().first()
        now = now_iso()
        updated_by = str(payload.updated_by or "").strip() or None
        if row is None:
            row = ProductFeaturedSlot(
                category=category,
                target_type_key=target_type_key,
                product_id=product_id,
                updated_at=now,
                updated_by=updated_by,
            )
        else:
            row.product_id = product_id
            row.updated_at = now
            row.updated_by = updated_by
        db.add(row)
        db.commit()
    except OperationalError as exc:
        raise _featured_slot_schema_http_error(exc) from exc
    return ProductFeaturedSlotItem(
        category=category,
        target_type_key=target_type_key,
        product_id=product_id,
        updated_at=row.updated_at,
        updated_by=row.updated_by,
    )


@router.post("/products/featured-slots/clear", response_model=ProductFeaturedSlotClearResponse)
def clear_product_featured_slot(
    payload: ProductFeaturedSlotClearRequest,
    db: Session = Depends(get_db),
):
    category = _normalize_required_category(payload.category)
    target_type_key = _normalize_target_type_key(payload.target_type_key)
    deleted = False
    try:
        row = db.execute(
            select(ProductFeaturedSlot)
            .where(ProductFeaturedSlot.category == category)
            .where(ProductFeaturedSlot.target_type_key == target_type_key)
            .limit(1)
        ).scalars().first()
        if row is not None:
            db.delete(row)
            deleted = True
        db.commit()
    except OperationalError as exc:
        raise _featured_slot_schema_http_error(exc) from exc
    return ProductFeaturedSlotClearResponse(
        status="ok",
        category=category,
        target_type_key=target_type_key,
        deleted=deleted,
    )


@router.post("/products/batch-delete", response_model=ProductBatchDeleteResponse)
def batch_delete_products(payload: ProductBatchDeleteRequest, db: Session = Depends(get_db)):
    ids = list(dict.fromkeys([str(item).strip() for item in payload.ids if str(item).strip()]))
    keep_ids = {str(item).strip() for item in payload.keep_ids if str(item).strip()}
    if not ids:
        raise HTTPException(status_code=400, detail="ids is required.")

    deleted_ids: list[str] = []
    skipped_ids: list[str] = []
    missing_ids: list[str] = []
    removed_files = 0
    removed_dirs = 0

    for product_id in ids:
        if product_id in keep_ids:
            skipped_ids.append(product_id)
            continue
        rec = db.get(ProductIndex, product_id)
        if not rec:
            missing_ids.append(product_id)
            continue

        if remove_rel_path(rec.json_path):
            removed_files += 1
        image_removed, _ = remove_product_images(product_id=product_id, image_path=rec.image_path)
        removed_files += image_removed
        if payload.remove_doubao_artifacts:
            f_count, d_count = remove_rel_dir(f"doubao_runs/{product_id}")
            removed_files += f_count
            removed_dirs += d_count

        route_mapping_rec = db.get(ProductRouteMappingIndex, product_id)
        if route_mapping_rec:
            route_mapping_path = str(route_mapping_rec.storage_path or "").strip() or product_route_mapping_rel_path(
                str(route_mapping_rec.category or ""),
                product_id,
            )
            if route_mapping_path and remove_rel_path(route_mapping_path):
                removed_files += 1
            db.delete(route_mapping_rec)
        try:
            featured_slots = db.execute(
                select(ProductFeaturedSlot).where(ProductFeaturedSlot.product_id == product_id)
            ).scalars().all()
        except OperationalError as exc:
            raise _featured_slot_schema_http_error(exc) from exc
        for slot in featured_slots:
            db.delete(slot)

        db.delete(rec)
        deleted_ids.append(product_id)

    if deleted_ids:
        _cleanup_mobile_invalid_product_refs(
            db=db,
            dry_run=False,
            sample_limit=3,
            invalid_product_ids=set(deleted_ids),
            selection_deleted_by="products:batch_delete",
        )

    db.commit()
    return ProductBatchDeleteResponse(
        status="ok",
        deleted_ids=deleted_ids,
        skipped_ids=skipped_ids,
        missing_ids=missing_ids,
        removed_files=removed_files,
        removed_dirs=removed_dirs,
    )


def _cleanup_mobile_invalid_product_refs(
    *,
    db: Session,
    dry_run: bool,
    sample_limit: int,
    invalid_product_ids: set[str] | None = None,
    selection_deleted_by: str,
) -> MobileInvalidProductRefCleanupResponse:
    normalized_invalid_ids: set[str] | None = None
    if invalid_product_ids is not None:
        normalized_invalid_ids = {
            str(item or "").strip()
            for item in invalid_product_ids
            if str(item or "").strip()
        }

    targeted_mode = normalized_invalid_ids is not None
    valid_product_ids: set[str] = set()
    if not targeted_mode:
        valid_product_ids = {
            str(item or "").strip()
            for item in db.execute(select(ProductIndex.id)).scalars().all()
            if str(item or "").strip()
        }

    def _empty_scope() -> dict[str, Any]:
        return {
            "scanned": 0,
            "invalid": 0,
            "repaired": 0,
            "sample_refs": [],
        }

    def _mark_invalid(scope: dict[str, Any], sample_ref: str) -> None:
        scope["invalid"] += 1
        if len(scope["sample_refs"]) < sample_limit:
            scope["sample_refs"].append(sample_ref)

    result: dict[str, Any] = {
        "status": "ok",
        "dry_run": bool(dry_run),
        "product_count": int(db.execute(select(func.count(ProductIndex.id))).scalar() or 0),
        "selection_sessions": _empty_scope(),
        "bag_items": _empty_scope(),
        "compare_usage_stats": _empty_scope(),
    }
    if targeted_mode and not normalized_invalid_ids:
        result["total_invalid"] = 0
        result["total_repaired"] = 0
        return MobileInvalidProductRefCleanupResponse.model_validate(result)

    selection_stmt = select(MobileSelectionSession).where(MobileSelectionSession.deleted_at.is_(None))
    if targeted_mode and normalized_invalid_ids:
        selection_stmt = selection_stmt.where(MobileSelectionSession.product_id.in_(sorted(normalized_invalid_ids)))
    selection_rows = db.execute(selection_stmt).scalars().all()
    result["selection_sessions"]["scanned"] = len(selection_rows)
    for row in selection_rows:
        product_id = str(row.product_id or "").strip()
        if not product_id:
            continue
        if (not targeted_mode) and product_id in valid_product_ids:
            continue
        _mark_invalid(result["selection_sessions"], f"{row.id}:{product_id}")
        if dry_run:
            continue
        if not row.deleted_at:
            row.deleted_at = now_iso()
        row.deleted_by = row.deleted_by or selection_deleted_by
        row.is_pinned = False
        row.pinned_at = None
        row.product_id = None
        result["selection_sessions"]["repaired"] += 1

    bag_stmt = select(MobileBagItem)
    if targeted_mode and normalized_invalid_ids:
        bag_stmt = bag_stmt.where(MobileBagItem.product_id.in_(sorted(normalized_invalid_ids)))
    bag_rows = db.execute(bag_stmt).scalars().all()
    result["bag_items"]["scanned"] = len(bag_rows)
    for row in bag_rows:
        product_id = str(row.product_id or "").strip()
        if not product_id:
            continue
        if (not targeted_mode) and product_id in valid_product_ids:
            continue
        _mark_invalid(result["bag_items"], f"{row.id}:{product_id}")
        if dry_run:
            continue
        db.delete(row)
        result["bag_items"]["repaired"] += 1

    usage_stmt = select(MobileCompareUsageStat)
    if targeted_mode and normalized_invalid_ids:
        usage_stmt = usage_stmt.where(MobileCompareUsageStat.product_id.in_(sorted(normalized_invalid_ids)))
    usage_rows = db.execute(usage_stmt).scalars().all()
    result["compare_usage_stats"]["scanned"] = len(usage_rows)
    for row in usage_rows:
        product_id = str(row.product_id or "").strip()
        if not product_id:
            continue
        if (not targeted_mode) and product_id in valid_product_ids:
            continue
        _mark_invalid(
            result["compare_usage_stats"],
            f"{row.owner_type}/{row.owner_id}/{row.category}:{product_id}",
        )
        if dry_run:
            continue
        db.delete(row)
        result["compare_usage_stats"]["repaired"] += 1

    result["total_invalid"] = (
        result["selection_sessions"]["invalid"]
        + result["bag_items"]["invalid"]
        + result["compare_usage_stats"]["invalid"]
    )
    result["total_repaired"] = (
        result["selection_sessions"]["repaired"]
        + result["bag_items"]["repaired"]
        + result["compare_usage_stats"]["repaired"]
    )
    return MobileInvalidProductRefCleanupResponse.model_validate(result)


@router.post("/maintenance/mobile/product-refs/cleanup", response_model=MobileInvalidProductRefCleanupResponse)
def cleanup_invalid_mobile_product_refs(
    payload: MobileInvalidProductRefCleanupRequest,
    db: Session = Depends(get_db),
):
    result = _cleanup_mobile_invalid_product_refs(
        db=db,
        dry_run=bool(payload.dry_run),
        sample_limit=int(payload.sample_limit),
        selection_deleted_by="maintenance:mobile_product_ref_cleanup",
    )
    if (not payload.dry_run) and result.total_repaired > 0:
        db.commit()
    return result


@router.post("/maintenance/storage/orphans/cleanup", response_model=OrphanStorageCleanupResponse)
def cleanup_orphan_storage_assets(payload: OrphanStorageCleanupRequest, db: Session = Depends(get_db)):
    rows = db.execute(select(ProductIndex.id, ProductIndex.image_path)).all()
    keep_product_ids: set[str] = set()
    keep_image_paths: set[str] = set()
    for pid, image_path in rows:
        pid_text = str(pid or "").strip()
        if not pid_text:
            continue
        keep_product_ids.add(pid_text)
        for rel_path in image_variant_rel_paths(str(image_path or "").strip()):
            keep_image_paths.add(rel_path)

    result = cleanup_orphan_storage(
        keep_product_ids=keep_product_ids,
        keep_image_paths=keep_image_paths,
        min_age_minutes=payload.min_age_minutes,
        dry_run=payload.dry_run,
        max_delete=payload.max_delete,
    )
    return OrphanStorageCleanupResponse.model_validate(result)


@router.get("/maintenance/storage/images/download")
def download_all_product_images(db: Session = Depends(get_db)):
    rows = db.execute(
        select(ProductIndex.id, ProductIndex.image_path).order_by(ProductIndex.created_at.desc())
    ).all()
    if not rows:
        raise HTTPException(status_code=404, detail="No products found, image archive unavailable.")

    zip_buffer = io.BytesIO()
    seen_paths: set[str] = set()
    missing_paths: list[str] = []
    added_count = 0

    with zipfile.ZipFile(zip_buffer, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:
        for product_id, image_path in rows:
            primary_rel = str(image_path or "").strip().lstrip("/")
            if not primary_rel:
                continue
            for rel_path in image_variant_rel_paths(primary_rel):
                if rel_path in seen_paths:
                    continue
                seen_paths.add(rel_path)
                is_primary = rel_path == primary_rel
                if not is_primary and not exists_rel_path(rel_path):
                    continue
                try:
                    image_bytes = read_rel_bytes(rel_path)
                except Exception as exc:
                    if is_primary:
                        missing_paths.append(f"{product_id}:{rel_path}:{exc}")
                    continue
                zf.writestr(rel_path, image_bytes)
                added_count += 1

    if missing_paths:
        preview = "; ".join(missing_paths[:20])
        if len(missing_paths) > 20:
            preview += f"; ...(+{len(missing_paths) - 20} more)"
        raise HTTPException(
            status_code=500,
            detail=f"Image archive failed: missing/unreadable image files: {preview}",
        )
    if added_count <= 0:
        raise HTTPException(status_code=404, detail="No product images found, image archive unavailable.")

    zip_buffer.seek(0)
    ts = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    filename = f"cosmeles-product-images-{ts}.zip"
    headers = {
        "Content-Disposition": f'attachment; filename="{filename}"',
        "X-Image-Count": str(added_count),
    }
    return StreamingResponse(zip_buffer, media_type="application/zip", headers=headers)


def _build_ingredient_library_impl(
    payload: IngredientLibraryBuildRequest,
    db: Session,
    event_callback: Callable[[dict[str, Any]], None] | None,
    stop_checker: Callable[[], bool] | None = None,
) -> IngredientLibraryBuildResponse:
    category = (payload.category or "").strip().lower()
    if category and category not in VALID_CATEGORIES:
        raise HTTPException(status_code=400, detail=f"Invalid category: {category}.")
    normalization_packages = _normalize_ingredient_normalization_packages(payload.normalization_packages)

    _ensure_ingredient_index_table(db)
    _ensure_ingredient_alias_tables(db)
    backfilled_from_storage = _backfill_ingredient_index_from_storage(db=db, category=category)

    stmt = select(ProductIndex).order_by(ProductIndex.created_at.desc())
    if category:
        stmt = stmt.where(ProductIndex.category == category)

    rows = db.execute(stmt).scalars().all()
    grouped, aggregate_meta = _collect_category_ingredients(
        rows=rows,
        max_sources_per_ingredient=int(payload.max_sources_per_ingredient),
        normalization_packages=normalization_packages,
    )
    grouped_items = sorted(grouped.values(), key=lambda item: (item["category"], item["ingredient_name"]))
    raw_unique = int(aggregate_meta.get("raw_unique_ingredients") or len(grouped_items))
    merged_delta = max(0, raw_unique - len(grouped_items))

    _emit_progress(
        event_callback,
        {
            "step": "ingredient_build_start",
            "scanned_products": len(rows),
            "unique_ingredients": len(grouped_items),
            "raw_unique_ingredients": raw_unique,
            "merged_delta": merged_delta,
            "normalization_packages": normalization_packages,
            "backfilled_from_storage": backfilled_from_storage,
            "text": (
                f"开始生成成分库：产品 {len(rows)} 条，唯一成分 {len(grouped_items)} 条，"
                f"原始唯一 {raw_unique}（归并 {merged_delta}），历史回填 {backfilled_from_storage} 条。"
            ),
        },
    )

    ingredient_ids = [str(item["ingredient_id"]) for item in grouped_items]
    index_map = _load_ingredient_index_map(db=db, ingredient_ids=ingredient_ids)

    submitted_to_model = 0
    created = 0
    updated = 0
    skipped = 0
    failed = 0
    failures: list[str] = []
    items: list[IngredientLibraryBuildItem] = []
    force_regenerate = bool(payload.force_regenerate)

    total = len(grouped_items)
    for idx, item in enumerate(grouped_items, start=1):
        if stop_checker is not None and stop_checker():
            _emit_progress(
                event_callback,
                {
                    "step": "ingredient_build_cancelled",
                    "index": idx,
                    "total": total,
                    "text": f"任务取消：已处理到 {idx - 1}/{total}。",
                },
            )
            raise IngredientLibraryBuildCancelledError("ingredient build cancelled by operator.")

        ingredient_id = item["ingredient_id"]
        ingredient_name = item["ingredient_name"]
        ingredient_name_en = str(item.get("ingredient_name_en") or "").strip() or None
        category_name = item["category"]
        source_trace_ids = sorted(item["source_trace_ids"])
        source_json = item["source_json"]
        source_signature = str(item["source_signature"])
        source_schema_version = str(item["source_schema_version"])
        alias_names = _collect_item_alias_names(item=item)
        source_count = _source_product_count_from_source_json(source_json=source_json, fallback=len(source_trace_ids))

        storage_rel = ingredient_profile_rel_path(category_name, ingredient_id)
        index_rec = _upsert_ingredient_index_from_scan(
            existing=index_map.get(ingredient_id),
            category=category_name,
            ingredient_id=ingredient_id,
            ingredient_name=ingredient_name,
            ingredient_key=str(item["ingredient_key"]),
            source_trace_ids=source_trace_ids,
        )
        index_map[ingredient_id] = index_rec
        db.add(index_rec)

        ready_storage_path = str(index_rec.storage_path or "").strip()
        if ready_storage_path and not exists_rel_path(ready_storage_path) and exists_rel_path(storage_rel):
            ready_storage_path = storage_rel
        if not ready_storage_path:
            ready_storage_path = storage_rel
        is_ready = str(index_rec.status or "").strip().lower() == "ready"
        existing_source_signature = ""
        if is_ready and exists_rel_path(ready_storage_path):
            existing_source_signature = _load_profile_source_signature(ready_storage_path)

        if (
            is_ready
            and exists_rel_path(ready_storage_path)
            and not force_regenerate
            and existing_source_signature
            and existing_source_signature == source_signature
        ):
            index_rec.storage_path = ready_storage_path
            skipped += 1
            _upsert_ingredient_aliases(
                db=db,
                category=category_name,
                ingredient_id=ingredient_id,
                alias_names=alias_names,
                resolver="ingredient_build",
            )
            build_item = IngredientLibraryBuildItem(
                ingredient_id=ingredient_id,
                category=category_name,
                ingredient_name=ingredient_name,
                ingredient_name_en=ingredient_name_en,
                source_count=source_count,
                source_trace_ids=source_trace_ids,
                storage_path=ready_storage_path,
                status="skipped",
                model=index_rec.model,
                error=None,
            )
            items.append(build_item)
            _emit_progress(
                event_callback,
                {
                    "step": "ingredient_skip",
                    "ingredient_id": ingredient_id,
                    "ingredient_name": ingredient_name,
                    "category": category_name,
                    "index": idx,
                    "total": total,
                    "skipped": skipped,
                    "text": f"[{idx}/{total}] 跳过（统计签名未变化）：{category_name} / {ingredient_name}",
                },
            )
            continue

        submitted_to_model += 1
        _emit_progress(
            event_callback,
            {
                "step": "ingredient_start",
                "ingredient_id": ingredient_id,
                "ingredient_name": ingredient_name,
                "category": category_name,
                "index": idx,
                "total": total,
                "submitted_to_model": submitted_to_model,
                "text": f"[{idx}/{total}] 生成成分：{category_name} / {ingredient_name}",
            },
        )
        try:
            ai_result = run_capability_now(
                capability="doubao.ingredient_category_profile",
                input_payload={
                    "ingredient": ingredient_name,
                    "category": category_name,
                    "source_json": source_json,
                    "source_samples": item["source_samples"],
                },
                trace_id=ingredient_id,
                event_callback=lambda e, _iid=ingredient_id, _cat=category_name: _forward_ingredient_model_event(
                    event_callback=event_callback,
                    ingredient_id=_iid,
                    category=_cat,
                    payload=e,
                ),
            )
            normalized_ingredient_name = str(ai_result.get("ingredient_name") or ingredient_name).strip() or ingredient_name
            normalized_ingredient_name_en = str(ai_result.get("ingredient_name_en") or "").strip() or None
            _upsert_ingredient_aliases(
                db=db,
                category=category_name,
                ingredient_id=ingredient_id,
                alias_names=[normalized_ingredient_name, normalized_ingredient_name_en, *alias_names],
                resolver="ingredient_model",
            )
            profile_doc = {
                "id": ingredient_id,
                "category": category_name,
                "ingredient_name": normalized_ingredient_name,
                "ingredient_name_en": normalized_ingredient_name_en,
                "ingredient_key": item["ingredient_key"],
                "source_count": source_count,
                "source_trace_ids": source_trace_ids,
                "source_samples": item["source_samples"],
                "source_json": source_json,
                "generated_at": now_iso(),
                "generator": {
                    "capability": "doubao.ingredient_category_profile",
                    "model": str(ai_result.get("model") or ""),
                    "prompt_key": "doubao.ingredient_category_profile",
                    "source_signature": source_signature,
                    "source_schema_version": source_schema_version,
                },
                "profile": {
                    "summary": str(ai_result.get("summary") or "").strip(),
                    "benefits": _safe_str_list(ai_result.get("benefits")),
                    "risks": _safe_str_list(ai_result.get("risks")),
                    "usage_tips": _safe_str_list(ai_result.get("usage_tips")),
                    "suitable_for": _safe_str_list(ai_result.get("suitable_for")),
                    "avoid_for": _safe_str_list(ai_result.get("avoid_for")),
                    "confidence": int(ai_result.get("confidence") or 0),
                    "reason": str(ai_result.get("reason") or "").strip(),
                    "analysis_text": str(ai_result.get("analysis_text") or "").strip(),
                },
            }
            existed_before = exists_rel_path(storage_rel)
            storage_path = save_ingredient_profile(category_name, ingredient_id, profile_doc)
            status = "updated" if existed_before else "created"
            if status == "updated":
                updated += 1
            else:
                created += 1

            index_rec.status = "ready"
            index_rec.ingredient_name = normalized_ingredient_name
            index_rec.storage_path = storage_path
            index_rec.model = str(ai_result.get("model") or "").strip() or None
            index_rec.last_generated_at = now_iso()
            index_rec.last_error = None
            db.add(index_rec)

            items.append(
                IngredientLibraryBuildItem(
                    ingredient_id=ingredient_id,
                    category=category_name,
                    ingredient_name=normalized_ingredient_name,
                    ingredient_name_en=normalized_ingredient_name_en,
                    source_count=source_count,
                    source_trace_ids=source_trace_ids,
                    storage_path=storage_path,
                    status=status,
                    model=index_rec.model,
                    error=None,
                )
            )
            _emit_progress(
                event_callback,
                {
                    "step": "ingredient_done",
                    "ingredient_id": ingredient_id,
                    "ingredient_name": normalized_ingredient_name,
                    "category": category_name,
                    "index": idx,
                    "total": total,
                    "status": status,
                    "created": created,
                    "updated": updated,
                    "text": f"[{idx}/{total}] 完成：{category_name} / {ingredient_name}（{status}）",
                },
            )
        except Exception as e:
            failed += 1
            message = f"{ingredient_id} ({category_name}/{ingredient_name}): {e}"
            failures.append(message)
            index_rec.status = "failed"
            index_rec.last_error = str(e)
            db.add(index_rec)
            items.append(
                IngredientLibraryBuildItem(
                    ingredient_id=ingredient_id,
                    category=category_name,
                    ingredient_name=ingredient_name,
                    ingredient_name_en=None,
                    source_count=source_count,
                    source_trace_ids=source_trace_ids,
                    storage_path=None,
                    status="failed",
                    model=None,
                    error=str(e),
                )
            )
            _emit_progress(
                event_callback,
                {
                    "step": "ingredient_error",
                    "ingredient_id": ingredient_id,
                    "ingredient_name": ingredient_name,
                    "category": category_name,
                    "index": idx,
                    "total": total,
                    "failed": failed,
                    "text": f"[{idx}/{total}] 失败：{category_name} / {ingredient_name} | {e}",
                },
            )

    db.commit()

    status = "ok" if failed == 0 else "partial_failed"
    _emit_progress(
        event_callback,
        {
            "step": "ingredient_build_done",
            "status": status,
            "backfilled_from_storage": backfilled_from_storage,
            "submitted_to_model": submitted_to_model,
            "created": created,
            "updated": updated,
            "skipped": skipped,
            "failed": failed,
            "text": (
                "成分库生成完成："
                f"backfilled={backfilled_from_storage}, submitted={submitted_to_model}, "
                f"created={created}, updated={updated}, skipped={skipped}, failed={failed}"
            ),
        },
    )
    return IngredientLibraryBuildResponse(
        status=status,
        scanned_products=len(rows),
        unique_ingredients=len(grouped_items),
        backfilled_from_storage=backfilled_from_storage,
        submitted_to_model=submitted_to_model,
        created=created,
        updated=updated,
        skipped=skipped,
        failed=failed,
        items=items,
        failures=failures[:200],
    )


def _ingredient_library_preflight(
    *,
    payload: IngredientLibraryPreflightRequest,
    db: Session,
) -> IngredientLibraryPreflightResponse:
    category = (payload.category or "").strip().lower()
    if category and category not in VALID_CATEGORIES:
        raise HTTPException(status_code=400, detail=f"Invalid category: {category}.")
    selected_packages = _normalize_ingredient_normalization_packages(payload.normalization_packages)
    baseline_packages = [pkg for pkg in selected_packages if pkg != "en_exact"]
    if not baseline_packages:
        baseline_packages = ["unicode_nfkc", "punctuation_fold", "whitespace_fold"]

    stmt = select(ProductIndex).order_by(ProductIndex.created_at.desc())
    if category:
        stmt = stmt.where(ProductIndex.category == category)
    rows = db.execute(stmt).scalars().all()
    records = _collect_category_ingredient_records(rows=rows)

    _, meta = _aggregate_category_ingredients(
        records=records,
        max_sources_per_ingredient=int(payload.max_sources_per_ingredient),
        normalization_packages=selected_packages,
    )
    merge_candidates = _build_ingredient_preflight_merge_candidates(
        records=records,
        selected_packages=selected_packages,
        baseline_packages=baseline_packages,
        limit=int(payload.max_merge_preview),
    )

    raw_unique = int(meta.get("raw_unique_ingredients") or 0)
    unique_after = int(meta.get("unique_ingredients") or 0)
    merged_delta = max(0, raw_unique - unique_after)
    summary = IngredientLibraryPreflightSummary(
        scanned_products=int(meta.get("scanned_products") or len(rows)),
        total_mentions=int(meta.get("total_mentions") or 0),
        raw_unique_ingredients=raw_unique,
        unique_ingredients_after=unique_after,
        merged_delta=merged_delta,
        merged_groups=len(merge_candidates),
        unresolved_conflicts=0,
    )
    return IngredientLibraryPreflightResponse(
        status="ok",
        category=category or None,
        available_packages=[
            IngredientLibraryNormalizationPackage(
                id=str(pkg["id"]),
                label=str(pkg["label"]),
                description=str(pkg["description"]),
                default_enabled=bool(pkg.get("default_enabled")),
                mode=str(pkg.get("mode") or "auto_merge"),
            )
            for pkg in INGREDIENT_NORMALIZATION_PACKAGES
        ],
        selected_packages=selected_packages,
        summary=summary,
        new_merges=merge_candidates,
        warnings=[],
    )


def _build_ingredient_preflight_merge_candidates(
    *,
    records: list[dict[str, Any]],
    selected_packages: list[str],
    baseline_packages: list[str],
    limit: int,
) -> list[IngredientLibraryMergeCandidate]:
    merged: dict[str, dict[str, Any]] = {}
    for record in records:
        category = str(record.get("category") or "").strip().lower()
        product_id = str(record.get("product_id") or "").strip()
        for parsed in record.get("items") or []:
            selected_key = _resolve_ingredient_key(
                ingredient_key_base=str(parsed.get("ingredient_key_base") or ""),
                ingredient_name_en_key_field=str(parsed.get("ingredient_name_en_key_field") or ""),
                ingredient_name_en_key_paren=str(parsed.get("ingredient_name_en_key_paren") or ""),
                normalization_packages=selected_packages,
            )
            baseline_key = _resolve_ingredient_key(
                ingredient_key_base=str(parsed.get("ingredient_key_base") or ""),
                ingredient_name_en_key_field=str(parsed.get("ingredient_name_en_key_field") or ""),
                ingredient_name_en_key_paren=str(parsed.get("ingredient_name_en_key_paren") or ""),
                normalization_packages=baseline_packages,
            )
            scope_key = f"{category}::{selected_key}"
            bucket = merged.get(scope_key)
            if bucket is None:
                bucket = {
                    "category": category,
                    "canonical_key": selected_key,
                    "base_keys": set(),
                    "names": defaultdict(int),
                    "product_ids": set(),
                    "mention_count": 0,
                    "triggered_by": set(),
                }
                merged[scope_key] = bucket
            bucket["base_keys"].add(baseline_key)
            bucket["mention_count"] = int(bucket["mention_count"]) + 1
            bucket["product_ids"].add(product_id)
            name = str(parsed.get("ingredient_name") or "").strip()
            if name:
                bucket["names"][name] += 1
            if selected_key != baseline_key and selected_key.startswith("en::"):
                bucket["triggered_by"].add("en_exact")

    out: list[IngredientLibraryMergeCandidate] = []
    for bucket in merged.values():
        if len(bucket["base_keys"]) <= 1:
            continue
        names_counter: dict[str, int] = dict(bucket["names"])
        names_sorted = sorted(names_counter.items(), key=lambda item: (-int(item[1]), len(str(item[0])), str(item[0])))
        merged_names = [str(item[0]) for item in names_sorted[:8]]
        canonical_name = merged_names[0] if merged_names else str(bucket["canonical_key"])
        confidence = 95 if "en_exact" in bucket["triggered_by"] else 80
        out.append(
            IngredientLibraryMergeCandidate(
                category=str(bucket["category"]),
                canonical_key=str(bucket["canonical_key"]),
                canonical_name=canonical_name,
                merged_names=merged_names,
                source_product_count=len(bucket["product_ids"]),
                mention_count=int(bucket["mention_count"]),
                confidence=confidence,
                triggered_by=sorted(str(x) for x in bucket["triggered_by"]),
            )
        )

    out.sort(key=lambda item: (-int(item.mention_count), item.category, item.canonical_name))
    return out[: max(10, min(1000, int(limit)))]


def _run_ingredient_library_build_job(
    *,
    job_id: str,
    payload: IngredientLibraryBuildRequest,
    db: Session,
) -> None:
    _ensure_ingredient_build_job_table(db)
    rec = db.get(IngredientLibraryBuildJob, job_id)
    if rec is None:
        return

    now = now_iso()
    if bool(rec.cancel_requested):
        rec.status = "cancelled"
        rec.stage = "cancelled"
        rec.stage_label = _ingredient_build_stage_label("cancelled")
        rec.message = "任务在启动前已取消。"
        rec.finished_at = now
        rec.updated_at = now
        db.add(rec)
        db.commit()
        return

    rec.status = "running"
    rec.stage = "prepare"
    rec.stage_label = _ingredient_build_stage_label("prepare")
    rec.message = "任务启动，准备扫描成分。"
    rec.percent = max(1, int(rec.percent or 0))
    rec.started_at = now
    rec.finished_at = None
    rec.updated_at = now
    rec.error_json = None
    rec.result_json = None
    db.add(rec)
    db.commit()

    ProgressSessionMaker = sessionmaker(autocommit=False, autoflush=False, bind=db.get_bind())
    CancelSessionMaker = sessionmaker(autocommit=False, autoflush=False, bind=db.get_bind())

    def on_progress(event: dict[str, Any]) -> None:
        progress_db = ProgressSessionMaker()
        try:
            _apply_ingredient_build_job_progress(db=progress_db, job_id=job_id, payload=event)
        finally:
            progress_db.close()

    def stop_checker() -> bool:
        cancel_db = CancelSessionMaker()
        try:
            row = cancel_db.get(IngredientLibraryBuildJob, job_id)
            return bool(row and row.cancel_requested)
        finally:
            cancel_db.close()

    try:
        result = _build_ingredient_library_impl(
            payload=payload,
            db=db,
            event_callback=on_progress,
            stop_checker=stop_checker,
        )
        _mark_ingredient_build_job_done(job_id=job_id, result=result, bind=db.get_bind())
    except IngredientLibraryBuildCancelledError as e:
        db.rollback()
        _mark_ingredient_build_job_cancelled(job_id=job_id, message=str(e), bind=db.get_bind())
    except HTTPException as e:
        db.rollback()
        _mark_ingredient_build_job_failed(
            job_id=job_id,
            code="ingredient_build_http_error",
            detail=str(e.detail),
            http_status=e.status_code,
            bind=db.get_bind(),
        )
    except Exception as e:  # pragma: no cover
        db.rollback()
        _mark_ingredient_build_job_failed(
            job_id=job_id,
            code="ingredient_build_internal_error",
            detail=str(e),
            http_status=500,
            bind=db.get_bind(),
        )


def _apply_ingredient_build_job_progress(
    *,
    db: Session,
    job_id: str,
    payload: dict[str, Any],
) -> None:
    rec = db.get(IngredientLibraryBuildJob, job_id)
    if rec is None:
        return

    step = str(payload.get("step") or "").strip().lower()
    now = now_iso()
    text = str(payload.get("text") or "").strip()
    if text:
        rec.message = text

    if step:
        rec.stage = step
        rec.stage_label = _ingredient_build_stage_label(step)

    if step == "ingredient_build_start":
        rec.scanned_products = _safe_positive_int(payload.get("scanned_products"), fallback=rec.scanned_products)
        rec.unique_ingredients = _safe_positive_int(payload.get("unique_ingredients"), fallback=rec.unique_ingredients)
        rec.backfilled_from_storage = _safe_positive_int(
            payload.get("backfilled_from_storage"),
            fallback=rec.backfilled_from_storage,
        )
    if step == "ingredient_start":
        rec.submitted_to_model = _safe_positive_int(
            payload.get("submitted_to_model"),
            fallback=rec.submitted_to_model,
        )
    if step == "ingredient_skip":
        rec.skipped_count = _safe_positive_int(payload.get("skipped"), fallback=rec.skipped_count)
    if step == "ingredient_done":
        rec.created_count = _safe_positive_int(payload.get("created"), fallback=rec.created_count)
        rec.updated_count = _safe_positive_int(payload.get("updated"), fallback=rec.updated_count)
    if step == "ingredient_error":
        rec.failed_count = _safe_positive_int(payload.get("failed"), fallback=rec.failed_count)
    if step == "ingredient_build_done":
        rec.submitted_to_model = _safe_positive_int(payload.get("submitted_to_model"), fallback=rec.submitted_to_model)
        rec.created_count = _safe_positive_int(payload.get("created"), fallback=rec.created_count)
        rec.updated_count = _safe_positive_int(payload.get("updated"), fallback=rec.updated_count)
        rec.skipped_count = _safe_positive_int(payload.get("skipped"), fallback=rec.skipped_count)
        rec.failed_count = _safe_positive_int(payload.get("failed"), fallback=rec.failed_count)

    rec.current_ingredient_id = str(payload.get("ingredient_id") or rec.current_ingredient_id or "").strip() or rec.current_ingredient_id
    rec.current_ingredient_name = str(payload.get("ingredient_name") or rec.current_ingredient_name or "").strip() or rec.current_ingredient_name

    index_value = _safe_positive_int(payload.get("index"), fallback=rec.current_index or 0)
    total_value = _safe_positive_int(payload.get("total"), fallback=rec.current_total or 0)
    rec.current_index = index_value if index_value > 0 else None
    rec.current_total = total_value if total_value > 0 else None
    rec.percent = _ingredient_build_progress_percent(
        current=int(rec.percent or 0),
        step=step,
        index=rec.current_index,
        total=rec.current_total,
    )
    rec.updated_at = now
    db.add(rec)
    db.commit()


def _mark_ingredient_build_job_done(
    *,
    job_id: str,
    result: IngredientLibraryBuildResponse,
    bind: Any,
) -> None:
    SessionMaker = sessionmaker(autocommit=False, autoflush=False, bind=bind)
    db = SessionMaker()
    try:
        rec = db.get(IngredientLibraryBuildJob, job_id)
        if rec is None:
            return
        now = now_iso()
        rec.status = "done"
        rec.stage = "done"
        rec.stage_label = _ingredient_build_stage_label("done")
        rec.message = (
            "成分库生成完成："
            f"created={result.created}, updated={result.updated}, skipped={result.skipped}, failed={result.failed}"
        )
        rec.percent = 100
        rec.scanned_products = int(result.scanned_products)
        rec.unique_ingredients = int(result.unique_ingredients)
        rec.backfilled_from_storage = int(result.backfilled_from_storage)
        rec.submitted_to_model = int(result.submitted_to_model)
        rec.created_count = int(result.created)
        rec.updated_count = int(result.updated)
        rec.skipped_count = int(result.skipped)
        rec.failed_count = int(result.failed)
        rec.result_json = json.dumps(result.model_dump(), ensure_ascii=False)
        rec.error_json = None
        rec.finished_at = now
        rec.updated_at = now
        db.add(rec)
        db.commit()
    finally:
        db.close()


def _mark_ingredient_build_job_cancelled(
    *,
    job_id: str,
    message: str,
    bind: Any,
) -> None:
    SessionMaker = sessionmaker(autocommit=False, autoflush=False, bind=bind)
    db = SessionMaker()
    try:
        rec = db.get(IngredientLibraryBuildJob, job_id)
        if rec is None:
            return
        now = now_iso()
        rec.status = "cancelled"
        rec.stage = "cancelled"
        rec.stage_label = _ingredient_build_stage_label("cancelled")
        rec.message = message.strip() or "任务已取消。"
        rec.percent = max(0, min(99, int(rec.percent or 0)))
        rec.finished_at = now
        rec.updated_at = now
        db.add(rec)
        db.commit()
    finally:
        db.close()


def _mark_ingredient_build_job_failed(
    *,
    job_id: str,
    code: str,
    detail: str,
    http_status: int,
    bind: Any,
) -> None:
    SessionMaker = sessionmaker(autocommit=False, autoflush=False, bind=bind)
    db = SessionMaker()
    try:
        rec = db.get(IngredientLibraryBuildJob, job_id)
        if rec is None:
            return
        now = now_iso()
        rec.status = "failed"
        rec.stage = "failed"
        rec.stage_label = _ingredient_build_stage_label("failed")
        rec.message = detail
        rec.error_json = json.dumps(
            {
                "code": str(code or "ingredient_build_failed"),
                "detail": str(detail or "ingredient build failed."),
                "http_status": int(http_status or 500),
            },
            ensure_ascii=False,
        )
        rec.finished_at = now
        rec.updated_at = now
        db.add(rec)
        db.commit()
    finally:
        db.close()


def _ingredient_build_progress_percent(
    *,
    current: int,
    step: str,
    index: int | None,
    total: int | None,
) -> int:
    value = max(0, min(100, int(current)))
    if step in {"queued", "prepare"}:
        return max(value, 1)
    if step == "ingredient_build_start":
        return max(value, 5)
    if step in {"ingredient_start", "ingredient_done", "ingredient_skip", "ingredient_error", "ingredient_model_step", "ingredient_model_delta"}:
        if index is not None and total is not None and total > 0:
            computed = 15 + int((max(0, min(total, index)) / total) * 80)
            return max(value, min(95, computed))
        return max(value, 15)
    if step in {"ingredient_build_cancelled", "cancelling"}:
        return max(value, 10)
    if step in {"ingredient_build_done", "done"}:
        return 100
    if step in {"failed", "cancelled"}:
        return max(value, 0)
    return value


def _ingredient_build_stage_label(stage: str) -> str:
    mapping = {
        "queued": "待执行",
        "prepare": "准备中",
        "ingredient_build_start": "扫描成分",
        "ingredient_start": "生成成分画像",
        "ingredient_model_step": "模型执行",
        "ingredient_model_delta": "模型输出",
        "ingredient_done": "单项完成",
        "ingredient_skip": "跳过未变化项",
        "ingredient_error": "单项失败",
        "ingredient_build_done": "任务完成",
        "ingredient_build_cancelled": "任务取消",
        "cancelling": "取消中",
        "cancelled": "已取消",
        "done": "已完成",
        "failed": "失败",
    }
    key = str(stage or "").strip().lower()
    return mapping.get(key, key or "处理中")


def _to_ingredient_build_job_view(rec: IngredientLibraryBuildJob) -> IngredientLibraryBuildJobView:
    result_obj: IngredientLibraryBuildResponse | None = None
    error_obj: IngredientLibraryBuildJobError | None = None

    result_raw = _safe_load_json_object(rec.result_json)
    if result_raw is not None:
        try:
            result_obj = IngredientLibraryBuildResponse.model_validate(result_raw)
        except Exception:
            result_obj = None

    error_raw = _safe_load_json_object(rec.error_json)
    if error_raw is not None:
        try:
            error_obj = IngredientLibraryBuildJobError.model_validate(error_raw)
        except Exception:
            error_obj = IngredientLibraryBuildJobError(
                code="ingredient_build_error",
                detail=str(error_raw),
                http_status=500,
            )

    return IngredientLibraryBuildJobView(
        status=str(rec.status or "queued").strip().lower() or "queued",
        job_id=str(rec.job_id),
        category=str(rec.category or "").strip() or None,
        force_regenerate=bool(rec.force_regenerate),
        max_sources_per_ingredient=int(rec.max_sources_per_ingredient or 8),
        stage=str(rec.stage or "").strip() or None,
        stage_label=str(rec.stage_label or "").strip() or None,
        message=str(rec.message or "").strip() or None,
        percent=max(0, min(100, int(rec.percent or 0))),
        current_index=int(rec.current_index) if rec.current_index is not None else None,
        current_total=int(rec.current_total) if rec.current_total is not None else None,
        current_ingredient_id=str(rec.current_ingredient_id or "").strip() or None,
        current_ingredient_name=str(rec.current_ingredient_name or "").strip() or None,
        counters=IngredientLibraryBuildJobCounters(
            scanned_products=int(rec.scanned_products or 0),
            unique_ingredients=int(rec.unique_ingredients or 0),
            backfilled_from_storage=int(rec.backfilled_from_storage or 0),
            submitted_to_model=int(rec.submitted_to_model or 0),
            created=int(rec.created_count or 0),
            updated=int(rec.updated_count or 0),
            skipped=int(rec.skipped_count or 0),
            failed=int(rec.failed_count or 0),
        ),
        result=result_obj,
        error=error_obj,
        cancel_requested=bool(rec.cancel_requested),
        created_at=str(rec.created_at or ""),
        updated_at=str(rec.updated_at or ""),
        started_at=str(rec.started_at or "").strip() or None,
        finished_at=str(rec.finished_at or "").strip() or None,
    )


def _safe_load_json_object(raw: str | None) -> dict[str, Any] | None:
    text = str(raw or "").strip()
    if not text:
        return None
    try:
        parsed = json.loads(text)
    except Exception:
        return {"detail": text}
    if not isinstance(parsed, dict):
        return {"value": parsed}
    return parsed


def _build_product_route_mapping_impl(
    payload: ProductRouteMappingBuildRequest,
    db: Session,
    event_callback: Callable[[dict[str, Any]], None] | None,
) -> ProductRouteMappingBuildResponse:
    category = (payload.category or "").strip().lower()
    if category:
        if category not in VALID_CATEGORIES:
            raise HTTPException(status_code=400, detail=f"Invalid category: {category}.")
        if category not in ROUTE_MAPPING_SUPPORTED_CATEGORIES:
            raise HTTPException(
                status_code=400,
                detail=f"Route mapping does not support category '{category}'.",
            )
        target_categories = [category]
    else:
        target_categories = sorted(ROUTE_MAPPING_SUPPORTED_CATEGORIES)

    _ensure_product_route_mapping_index_table(db)
    prompt_versions = {
        cat: load_prompt(f"doubao.route_mapping_{cat}").version
        for cat in target_categories
    }

    rows = db.execute(
        select(ProductIndex)
        .where(ProductIndex.category.in_(target_categories))
        .order_by(ProductIndex.created_at.desc())
    ).scalars().all()

    scanned_products = len(rows)
    _emit_progress(
        event_callback,
        {
            "step": "route_mapping_build_start",
            "scanned_products": scanned_products,
            "categories": target_categories,
            "text": f"开始构建产品类型映射：扫描产品 {scanned_products} 条。",
        },
    )

    submitted_to_model = 0
    created = 0
    updated = 0
    skipped = 0
    failed = 0
    items: list[ProductRouteMappingBuildItem] = []
    failures: list[str] = []

    force_regenerate = bool(payload.force_regenerate)
    only_unmapped = bool(payload.only_unmapped)
    total = len(rows)

    for idx, row in enumerate(rows, start=1):
        product_id = str(row.id)
        row_category = str(row.category or "").strip().lower()
        if row_category not in ROUTE_MAPPING_SUPPORTED_CATEGORIES:
            continue

        rec = db.get(ProductRouteMappingIndex, product_id)
        storage_path_existing = ""
        if rec:
            storage_path_existing = str(rec.storage_path or "").strip()
        if not storage_path_existing:
            storage_path_existing = product_route_mapping_rel_path(row_category, product_id)

        is_ready_existing = bool(
            rec
            and str(rec.status or "").strip().lower() == "ready"
            and str(rec.rules_version or "").strip() == MOBILE_RULES_VERSION
            and exists_rel_path(storage_path_existing)
        )

        if only_unmapped and is_ready_existing:
            skipped += 1
            items.append(
                ProductRouteMappingBuildItem(
                    product_id=product_id,
                    category=row_category,
                    status="skipped",
                    primary_route=_score_or_none(
                        route_key=str(rec.primary_route_key or ""),
                        route_title=str(rec.primary_route_title or ""),
                        confidence=int(rec.primary_confidence or 0),
                        reason="",
                    ),
                    secondary_route=_score_or_none(
                        route_key=str(rec.secondary_route_key or ""),
                        route_title=str(rec.secondary_route_title or ""),
                        confidence=int(rec.secondary_confidence or 0),
                        reason="",
                    ),
                    route_scores=_safe_route_score_models(rec.scores_json),
                    storage_path=storage_path_existing,
                    model=rec.model,
                    error=None,
                )
            )
            _emit_progress(
                event_callback,
                {
                    "step": "route_mapping_skip",
                    "product_id": product_id,
                    "category": row_category,
                    "index": idx,
                    "total": total,
                    "text": f"[{idx}/{total}] 跳过（已有映射）：{row_category} / {product_id}",
                },
            )
            continue

        try:
            if not exists_rel_path(row.json_path):
                raise ValueError(f"product json missing: {row.json_path}")
            doc = load_json(row.json_path)
            context = _build_route_mapping_product_context(row=row, doc=doc)
            fingerprint = _build_route_mapping_fingerprint(context)
        except Exception as e:
            failed += 1
            message = f"{product_id} ({row_category}): invalid product context | {e}"
            failures.append(message)
            now = now_iso()
            rec = _ensure_route_mapping_record(rec=rec, product_id=product_id, category=row_category)
            rec.rules_version = MOBILE_RULES_VERSION
            rec.fingerprint = rec.fingerprint or _fallback_route_mapping_fingerprint(row_category, product_id)
            rec.status = "failed"
            rec.prompt_key = f"doubao.route_mapping_{row_category}"
            rec.prompt_version = prompt_versions.get(row_category)
            rec.last_error = str(e)
            rec.last_generated_at = now
            db.add(rec)
            items.append(
                ProductRouteMappingBuildItem(
                    product_id=product_id,
                    category=row_category,
                    status="failed",
                    primary_route=None,
                    secondary_route=None,
                    route_scores=[],
                    storage_path=None,
                    model=None,
                    error=f"invalid product context: {e}",
                )
            )
            _emit_progress(
                event_callback,
                {
                    "step": "route_mapping_error",
                    "product_id": product_id,
                    "category": row_category,
                    "index": idx,
                    "total": total,
                    "text": f"[{idx}/{total}] 失败：{row_category} / {product_id} | {e}",
                },
            )
            continue

        if is_ready_existing and not force_regenerate and str(rec.fingerprint or "").strip() == fingerprint:
            skipped += 1
            items.append(
                ProductRouteMappingBuildItem(
                    product_id=product_id,
                    category=row_category,
                    status="skipped",
                    primary_route=_score_or_none(
                        route_key=str(rec.primary_route_key or ""),
                        route_title=str(rec.primary_route_title or ""),
                        confidence=int(rec.primary_confidence or 0),
                        reason="",
                    ),
                    secondary_route=_score_or_none(
                        route_key=str(rec.secondary_route_key or ""),
                        route_title=str(rec.secondary_route_title or ""),
                        confidence=int(rec.secondary_confidence or 0),
                        reason="",
                    ),
                    route_scores=_safe_route_score_models(rec.scores_json),
                    storage_path=storage_path_existing,
                    model=rec.model,
                    error=None,
                )
            )
            _emit_progress(
                event_callback,
                {
                    "step": "route_mapping_skip",
                    "product_id": product_id,
                    "category": row_category,
                    "index": idx,
                    "total": total,
                    "text": f"[{idx}/{total}] 跳过（指纹未变化）：{row_category} / {product_id}",
                },
            )
            continue

        submitted_to_model += 1
        _emit_progress(
            event_callback,
            {
                "step": "route_mapping_start",
                "product_id": product_id,
                "category": row_category,
                "index": idx,
                "total": total,
                "text": f"[{idx}/{total}] 开始映射：{row_category} / {product_id}",
            },
        )

        capability = f"doubao.route_mapping_{row_category}"
        prompt_key = capability
        prompt_version = prompt_versions[row_category]
        try:
            ai_result = run_capability_now(
                capability=capability,
                input_payload={"product_context_json": json.dumps(context, ensure_ascii=False)},
                trace_id=product_id,
                event_callback=lambda event, _pid=product_id, _cat=row_category: _forward_route_mapping_model_event(
                    event_callback=event_callback,
                    product_id=_pid,
                    category=_cat,
                    payload=event,
                ),
            )

            generated_at = now_iso()
            profile_doc = {
                "product_id": product_id,
                "category": row_category,
                "rules_version": str(ai_result.get("rules_version") or MOBILE_RULES_VERSION),
                "fingerprint": fingerprint,
                "generated_at": generated_at,
                "prompt_key": prompt_key,
                "prompt_version": prompt_version,
                "model": str(ai_result.get("model") or "").strip(),
                "primary_route": ai_result.get("primary_route") or {},
                "secondary_route": ai_result.get("secondary_route") or {},
                "route_scores": ai_result.get("route_scores") or [],
                "evidence": ai_result.get("evidence") or {"positive": [], "counter": []},
                "confidence_reason": str(ai_result.get("confidence_reason") or "").strip(),
                "needs_review": bool(ai_result.get("needs_review")),
                "analysis_text": str(ai_result.get("analysis_text") or "").strip(),
            }
            result_item = _to_product_route_mapping_result(doc=profile_doc, storage_path="")
            storage_path = save_product_route_mapping(row_category, product_id, profile_doc)
            result_item = result_item.model_copy(update={"storage_path": storage_path})

            existed_before = rec is not None
            status = "updated" if existed_before else "created"
            if status == "updated":
                updated += 1
            else:
                created += 1

            rec = _ensure_route_mapping_record(rec=rec, product_id=product_id, category=row_category)
            rec.rules_version = result_item.rules_version
            rec.fingerprint = result_item.fingerprint
            rec.status = "ready"
            rec.storage_path = storage_path
            rec.primary_route_key = result_item.primary_route.route_key
            rec.primary_route_title = result_item.primary_route.route_title
            rec.primary_confidence = int(result_item.primary_route.confidence)
            rec.secondary_route_key = result_item.secondary_route.route_key
            rec.secondary_route_title = result_item.secondary_route.route_title
            rec.secondary_confidence = int(result_item.secondary_route.confidence)
            rec.scores_json = json.dumps([score.model_dump() for score in result_item.route_scores], ensure_ascii=False)
            rec.needs_review = bool(result_item.needs_review)
            rec.prompt_key = result_item.prompt_key
            rec.prompt_version = result_item.prompt_version
            rec.model = result_item.model
            rec.last_generated_at = result_item.generated_at
            rec.last_error = None
            db.add(rec)

            items.append(
                ProductRouteMappingBuildItem(
                    product_id=product_id,
                    category=row_category,
                    status=status,
                    primary_route=result_item.primary_route,
                    secondary_route=result_item.secondary_route,
                    route_scores=result_item.route_scores,
                    storage_path=storage_path,
                    model=result_item.model,
                    error=None,
                )
            )
            _emit_progress(
                event_callback,
                {
                    "step": "route_mapping_done",
                    "product_id": product_id,
                    "category": row_category,
                    "index": idx,
                    "total": total,
                    "status": status,
                    "text": f"[{idx}/{total}] 完成：{row_category} / {product_id}（{status}）",
                },
            )
        except Exception as e:
            failed += 1
            message = f"{product_id} ({row_category}): {e}"
            failures.append(message)
            rec = _ensure_route_mapping_record(rec=rec, product_id=product_id, category=row_category)
            rec.rules_version = MOBILE_RULES_VERSION
            rec.fingerprint = fingerprint or _fallback_route_mapping_fingerprint(row_category, product_id)
            rec.status = "failed"
            rec.prompt_key = prompt_key
            rec.prompt_version = prompt_version
            rec.last_error = str(e)
            rec.last_generated_at = now_iso()
            db.add(rec)
            items.append(
                ProductRouteMappingBuildItem(
                    product_id=product_id,
                    category=row_category,
                    status="failed",
                    primary_route=None,
                    secondary_route=None,
                    route_scores=[],
                    storage_path=None,
                    model=None,
                    error=str(e),
                )
            )
            _emit_progress(
                event_callback,
                {
                    "step": "route_mapping_error",
                    "product_id": product_id,
                    "category": row_category,
                    "index": idx,
                    "total": total,
                    "text": f"[{idx}/{total}] 失败：{row_category} / {product_id} | {e}",
                },
            )

    db.commit()

    status = "ok" if failed == 0 else "partial_failed"
    _emit_progress(
        event_callback,
        {
            "step": "route_mapping_build_done",
            "status": status,
            "scanned_products": scanned_products,
            "submitted_to_model": submitted_to_model,
            "created": created,
            "updated": updated,
            "skipped": skipped,
            "failed": failed,
            "text": (
                "产品类型映射构建完成："
                f"submitted={submitted_to_model}, created={created}, "
                f"updated={updated}, skipped={skipped}, failed={failed}"
            ),
        },
    )
    return ProductRouteMappingBuildResponse(
        status=status,
        scanned_products=scanned_products,
        submitted_to_model=submitted_to_model,
        created=created,
        updated=updated,
        skipped=skipped,
        failed=failed,
        items=items,
        failures=failures[:200],
    )


def _to_product_route_mapping_result(doc: dict[str, Any], storage_path: str) -> ProductRouteMappingResult:
    if not isinstance(doc, dict):
        raise ValueError("route mapping document is not an object.")
    product_id = _required_text_field(doc, "product_id")
    category = _required_text_field(doc, "category").lower()
    if category not in ROUTE_MAPPING_SUPPORTED_CATEGORIES:
        raise ValueError(f"route mapping category unsupported: {category}")

    rules_version = _required_text_field(doc, "rules_version")
    fingerprint = _required_text_field(doc, "fingerprint")
    generated_at = _required_text_field(doc, "generated_at")
    prompt_key = _required_text_field(doc, "prompt_key")
    prompt_version = _required_text_field(doc, "prompt_version")
    model = _required_text_field(doc, "model")
    confidence_reason = _required_text_field(doc, "confidence_reason")

    needs_review_raw = doc.get("needs_review")
    if not isinstance(needs_review_raw, bool):
        raise ValueError("needs_review must be boolean.")

    primary_route = _parse_route_mapping_score(doc.get("primary_route"), "primary_route")
    secondary_route = _parse_route_mapping_score(doc.get("secondary_route"), "secondary_route")

    route_scores_raw = doc.get("route_scores")
    if not isinstance(route_scores_raw, list) or not route_scores_raw:
        raise ValueError("route_scores must be a non-empty list.")
    route_scores = [_parse_route_mapping_score(item, f"route_scores[{idx}]") for idx, item in enumerate(route_scores_raw)]

    evidence = _parse_route_mapping_evidence(doc.get("evidence"))
    analysis_text = str(doc.get("analysis_text") or "").strip()

    out_storage_path = str(storage_path or "").strip()
    return ProductRouteMappingResult(
        product_id=product_id,
        category=category,
        rules_version=rules_version,
        fingerprint=fingerprint,
        generated_at=generated_at,
        prompt_key=prompt_key,
        prompt_version=prompt_version,
        model=model,
        primary_route=primary_route,
        secondary_route=secondary_route,
        route_scores=route_scores,
        evidence=evidence,
        confidence_reason=confidence_reason,
        needs_review=bool(needs_review_raw),
        analysis_text=analysis_text,
        storage_path=out_storage_path,
    )


def _parse_route_mapping_score(value: Any, field_name: str) -> ProductRouteMappingScore:
    if not isinstance(value, dict):
        raise ValueError(f"{field_name} must be an object.")
    route_key = str(value.get("route_key") or "").strip()
    route_title = str(value.get("route_title") or "").strip()
    reason = str(value.get("reason") or "").strip()
    if not route_key:
        raise ValueError(f"{field_name}.route_key is required.")
    if not route_title:
        raise ValueError(f"{field_name}.route_title is required.")
    try:
        confidence = int(value.get("confidence"))
    except Exception as e:
        raise ValueError(f"{field_name}.confidence must be integer.") from e
    confidence = max(0, min(100, confidence))
    return ProductRouteMappingScore(
        route_key=route_key,
        route_title=route_title,
        confidence=confidence,
        reason=reason,
    )


def _parse_route_mapping_evidence(value: Any) -> dict[str, list[dict[str, Any]]]:
    if not isinstance(value, dict):
        return {"positive": [], "counter": []}

    def normalize_items(key: str) -> list[dict[str, Any]]:
        rows = value.get(key)
        if not isinstance(rows, list):
            return []
        out: list[dict[str, Any]] = []
        for idx, item in enumerate(rows):
            if not isinstance(item, dict):
                continue
            try:
                rank = int(item.get("rank"))
            except Exception:
                rank = 0
            out.append(
                {
                    "ingredient_name_cn": str(item.get("ingredient_name_cn") or "").strip(),
                    "ingredient_name_en": str(item.get("ingredient_name_en") or "").strip(),
                    "rank": max(0, rank),
                    "impact": str(item.get("impact") or "").strip(),
                }
            )
            if idx >= 30:
                break
        return out

    return {"positive": normalize_items("positive"), "counter": normalize_items("counter")}


def _safe_route_score_models(scores_json: str | None) -> list[ProductRouteMappingScore]:
    raw = str(scores_json or "").strip()
    if not raw:
        return []
    try:
        parsed = json.loads(raw)
    except Exception:
        return []
    if not isinstance(parsed, list):
        return []
    out: list[ProductRouteMappingScore] = []
    for idx, item in enumerate(parsed):
        try:
            out.append(_parse_route_mapping_score(item, f"scores_json[{idx}]"))
        except Exception:
            continue
    return out


def _score_or_none(
    *,
    route_key: str,
    route_title: str,
    confidence: int,
    reason: str,
) -> ProductRouteMappingScore | None:
    if not route_key.strip() or not route_title.strip():
        return None
    return ProductRouteMappingScore(
        route_key=route_key.strip(),
        route_title=route_title.strip(),
        confidence=max(0, min(100, int(confidence))),
        reason=reason,
    )


def _forward_route_mapping_model_event(
    event_callback: Callable[[dict[str, Any]], None] | None,
    product_id: str,
    category: str,
    payload: dict[str, Any],
) -> None:
    event_type = str(payload.get("type") or "").strip()
    if event_type == "delta":
        delta = str(payload.get("delta") or "")
        if not delta:
            return
        _emit_progress(
            event_callback,
            {
                "step": "route_mapping_model_delta",
                "product_id": product_id,
                "category": category,
                "delta": delta,
                "text": delta,
            },
        )
        return

    if event_type != "step":
        return
    message = str(payload.get("message") or "").strip()
    if not message:
        return
    _emit_progress(
        event_callback,
        {
            "step": "route_mapping_model_step",
            "product_id": product_id,
            "category": category,
            "text": f"{product_id} | {message}",
        },
    )


def _ensure_route_mapping_record(
    *,
    rec: ProductRouteMappingIndex | None,
    product_id: str,
    category: str,
) -> ProductRouteMappingIndex:
    if rec is not None:
        rec.category = category
        return rec
    return ProductRouteMappingIndex(
        product_id=product_id,
        category=category,
        rules_version=MOBILE_RULES_VERSION,
        fingerprint=_fallback_route_mapping_fingerprint(category, product_id),
        status="pending",
        storage_path=None,
        primary_route_key="",
        primary_route_title="",
        primary_confidence=0,
        secondary_route_key=None,
        secondary_route_title=None,
        secondary_confidence=None,
        scores_json="[]",
        needs_review=False,
        prompt_key=None,
        prompt_version=None,
        model=None,
        last_generated_at=None,
        last_error=None,
    )


def _fallback_route_mapping_fingerprint(category: str, product_id: str) -> str:
    raw = f"{category}:{product_id}:fallback"
    return hashlib.sha1(raw.encode("utf-8")).hexdigest()


def _build_route_mapping_product_context(*, row: ProductIndex, doc: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(doc, dict):
        raise ValueError("product doc must be an object.")

    summary_raw = doc.get("summary")
    summary = summary_raw if isinstance(summary_raw, dict) else {}

    ingredients_raw = doc.get("ingredients")
    if not isinstance(ingredients_raw, list):
        raise ValueError("ingredients must be a list.")

    ingredients: list[dict[str, Any]] = []
    for rank, raw in enumerate(ingredients_raw, start=1):
        if isinstance(raw, dict):
            name_raw = str(raw.get("name") or "").strip()
            type_value = str(raw.get("type") or "").strip()
            functions = _safe_str_list(raw.get("functions"))
            risk = str(raw.get("risk") or "").strip()
            notes = str(raw.get("notes") or "").strip()
            rank_value = _parse_positive_int(raw.get("rank")) or rank
            abundance_level = _normalize_abundance_level(raw.get("abundance_level"))
            order_confidence = _parse_confidence_0_100(raw.get("order_confidence"))
        else:
            name_raw = str(raw or "").strip()
            type_value = ""
            functions = []
            risk = ""
            notes = ""
            rank_value = rank
            abundance_level = None
            order_confidence = None
        if not name_raw:
            continue

        ingredient_name_cn, ingredient_name_en = _split_ingredient_names(name_raw)
        ingredients.append(
            {
                "rank": rank_value,
                "ingredient_name_cn": ingredient_name_cn,
                "ingredient_name_en": ingredient_name_en,
                "ingredient_name_raw": name_raw,
                "abundance_level": abundance_level,
                "order_confidence": order_confidence,
                "type": type_value,
                "functions": functions,
                "risk": risk,
                "notes": notes,
            }
        )

    if not ingredients:
        raise ValueError("ingredients is empty.")

    return {
        "product_id": str(row.id),
        "category": str(row.category or "").strip().lower(),
        "rules_version": MOBILE_RULES_VERSION,
        "brand": str(row.brand or "").strip(),
        "name": str(row.name or "").strip(),
        "one_sentence": str(row.one_sentence or "").strip(),
        "summary": {
            "one_sentence": str(summary.get("one_sentence") or "").strip(),
            "pros": _safe_str_list(summary.get("pros")),
            "cons": _safe_str_list(summary.get("cons")),
            "who_for": _safe_str_list(summary.get("who_for")),
            "who_not_for": _safe_str_list(summary.get("who_not_for")),
        },
        "ingredients": ingredients,
    }


def _build_route_mapping_fingerprint(product_context: dict[str, Any]) -> str:
    canonical = {
        "category": str(product_context.get("category") or "").strip().lower(),
        "rules_version": str(product_context.get("rules_version") or "").strip(),
        "brand": str(product_context.get("brand") or "").strip(),
        "name": str(product_context.get("name") or "").strip(),
        "one_sentence": str(product_context.get("one_sentence") or "").strip(),
        "summary": product_context.get("summary") if isinstance(product_context.get("summary"), dict) else {},
        "ingredients": [],
    }
    ingredients = product_context.get("ingredients")
    if isinstance(ingredients, list):
        for item in ingredients:
            if not isinstance(item, dict):
                continue
            canonical["ingredients"].append(
                {
                    "rank": int(item.get("rank") or 0),
                    "ingredient_name_cn": str(item.get("ingredient_name_cn") or "").strip(),
                    "ingredient_name_en": str(item.get("ingredient_name_en") or "").strip(),
                    "ingredient_name_raw": str(item.get("ingredient_name_raw") or "").strip(),
                    "abundance_level": str(item.get("abundance_level") or "").strip().lower(),
                    "order_confidence": _parse_confidence_0_100(item.get("order_confidence")) or 0,
                    "type": str(item.get("type") or "").strip(),
                    "functions": _safe_str_list(item.get("functions")),
                    "risk": str(item.get("risk") or "").strip(),
                    "notes": str(item.get("notes") or "").strip(),
                }
            )
    raw = json.dumps(canonical, ensure_ascii=False, sort_keys=True)
    return hashlib.sha1(raw.encode("utf-8")).hexdigest()


def _split_ingredient_names(raw_name: str) -> tuple[str, str]:
    text = str(raw_name or "").strip()
    if not text:
        return "", ""

    english_candidates: list[str] = []
    for match in re.finditer(r"[A-Za-z][A-Za-z0-9\-\s_/.,]*", text):
        token = str(match.group(0) or "").strip(" ,.;，；")
        if token:
            english_candidates.append(token)

    cn = re.sub(r"\([^)]*[A-Za-z][^)]*\)", "", text)
    cn = re.sub(r"（[^）]*[A-Za-z][^）]*）", "", cn)
    cn = re.sub(r"[A-Za-z][A-Za-z0-9\-\s_/.,]*", "", cn)
    cn = cn.replace("[", "").replace("]", "")
    cn = re.sub(r"\s+", "", cn).strip("，,;；()（）")

    en = " ".join(dict.fromkeys(english_candidates)).strip()
    return cn, en


def _suggest_product_duplicates_impl(
    payload: ProductDedupSuggestRequest,
    db: Session,
    event_callback: Callable[[dict[str, Any]], None] | None,
) -> ProductDedupSuggestResponse:
    category = (payload.category or "").strip().lower()
    if category and category not in VALID_CATEGORIES:
        raise HTTPException(status_code=400, detail=f"Invalid category: {category}.")

    stmt = select(ProductIndex).order_by(ProductIndex.created_at.desc())
    if category:
        stmt = stmt.where(ProductIndex.category == category)

    rows = db.execute(stmt).scalars().all()
    docs: list[dict[str, Any]] = []
    for row in rows:
        if not exists_rel_path(row.json_path):
            continue
        try:
            doc = load_json(row.json_path)
        except Exception:
            continue
        docs.append({"row": row, "doc": doc})

    filtered = _filter_docs_for_dedup(
        docs,
        title_query=(payload.title_query or "").strip(),
        ingredient_hints=payload.ingredient_hints or [],
    )
    filtered = filtered[: payload.max_scan_products]
    grouped = _group_docs_by_category(filtered)
    batch_size = int(payload.compare_batch_size or 1)
    min_confidence = max(0, min(100, int(payload.min_confidence)))
    requested_model_tier = str(payload.model_tier or "").strip().lower() or None
    resolved_model: str | None = None

    _emit_progress(
        event_callback,
        {
            "step": "dedup_scan_start",
            "category": category or None,
            "scanned_products": len(filtered),
            "category_groups": len(grouped),
            "min_confidence": min_confidence,
            "batch_size": batch_size,
            "requested_model_tier": requested_model_tier,
        },
    )

    directed_relations: list[dict[str, Any]] = []
    failures: list[str] = []

    for cat, items in grouped.items():
        if len(items) < 2:
            continue
        _emit_progress(
            event_callback,
            {
                "step": "dedup_category_start",
                "category": cat,
                "products": len(items),
            },
        )
        anchor_total = len(items) - 1
        for idx, anchor in enumerate(items[:-1]):
            anchor_id = str(anchor["row"].id)
            candidates = items[idx + 1 :]
            if not candidates:
                continue
            _emit_progress(
                event_callback,
                {
                    "step": "dedup_anchor_start",
                    "category": cat,
                    "anchor_id": anchor_id,
                    "anchor_index": idx + 1,
                    "anchor_total": anchor_total,
                    "candidate_total": len(candidates),
                },
            )

            chunk_hits = 0
            for chunk_start in range(0, len(candidates), batch_size):
                chunk = candidates[chunk_start : chunk_start + batch_size]
                chunk_ids = [str(item["row"].id) for item in chunk]
                for c in chunk:
                    c_cat = str(getattr(c["row"], "category", "") or "").strip().lower()
                    if c_cat != cat:
                        failures.append(f"{anchor_id}: category mismatch with candidate {c['row'].id}.")
                        chunk = []
                        chunk_ids = []
                        break
                if not chunk:
                    continue
                ai_input = {
                    "anchor_product": _compact_product_for_dedup(anchor),
                    "candidate_products": [_compact_product_for_dedup(item) for item in chunk],
                }
                if requested_model_tier:
                    ai_input["model_tier"] = requested_model_tier
                try:
                    ai_result = run_capability_now(
                        capability="doubao.product_dedup_group",
                        input_payload=ai_input,
                        trace_id=f"dedup-{anchor_id}",
                        event_callback=lambda e, _cat=cat, _anchor=anchor_id: _forward_dedup_model_event(
                            event_callback=event_callback,
                            category=_cat,
                            anchor_id=_anchor,
                            payload=e,
                        ),
                    )
                    model_name = str(ai_result.get("model") or "").strip()
                    if model_name and not resolved_model:
                        resolved_model = model_name
                    relations = _extract_dedup_relations(
                        ai_result=ai_result,
                        anchor_id=anchor_id,
                        candidate_ids=chunk_ids,
                        min_confidence=min_confidence,
                    )
                    directed_relations.extend(relations)
                    chunk_hits += len(relations)

                    for candidate_id in chunk_ids:
                        pair_relation = _find_pair_relation(relations=relations, a_id=anchor_id, b_id=candidate_id)
                        _emit_progress(
                            event_callback,
                            {
                                "step": "dedup_pair_result",
                                "category": cat,
                                "anchor_id": anchor_id,
                                "candidate_id": candidate_id,
                                "duplicate": bool(pair_relation),
                                "keep_id": pair_relation.get("keep_id") if pair_relation else None,
                                "remove_id": pair_relation.get("remove_id") if pair_relation else None,
                                "confidence": int(pair_relation.get("confidence") or 0) if pair_relation else 0,
                                "reason": str(pair_relation.get("reason") or "") if pair_relation else "",
                                "text": _pair_result_text(
                                    anchor_id=anchor_id,
                                    candidate_id=candidate_id,
                                    relation=pair_relation,
                                ),
                            },
                        )
                except Exception as e:
                    failures.append(f"{anchor_id}: {e}")
                    for candidate_id in chunk_ids:
                        _emit_progress(
                            event_callback,
                            {
                                "step": "dedup_pair_error",
                                "category": cat,
                                "anchor_id": anchor_id,
                                "candidate_id": candidate_id,
                                "text": f"{anchor_id} vs {candidate_id} | error: {e}",
                            },
                        )
                finally:
                    _emit_progress(
                        event_callback,
                        {
                            "step": "dedup_chunk_done",
                            "category": cat,
                            "anchor_id": anchor_id,
                            "chunk_start": chunk_start,
                            "chunk_size": len(chunk),
                            "chunk_hits": chunk_hits,
                        },
                    )

            _emit_progress(
                event_callback,
                {
                    "step": "dedup_anchor_done",
                    "category": cat,
                    "anchor_id": anchor_id,
                    "high_conf_pairs": chunk_hits,
                },
            )

    item_by_id = {str(item["row"].id): item for item in filtered}
    suggestions = _build_suggestions_from_relations(relations=directed_relations, item_by_id=item_by_id)
    involved_ids: set[str] = set()
    for item in suggestions:
        involved_ids.add(item.keep_id)
        involved_ids.update(item.remove_ids)

    _emit_progress(
        event_callback,
        {
            "step": "dedup_scan_done",
            "suggestions": len(suggestions),
            "high_conf_relations": len(directed_relations),
            "failures": len(failures),
        },
    )

    involved_rows = [item["row"] for item in filtered if str(item["row"].id) in involved_ids]
    return ProductDedupSuggestResponse(
        status="ok",
        scanned_products=len(filtered),
        requested_model_tier=requested_model_tier,
        model=resolved_model,
        suggestions=suggestions,
        involved_products=[_row_to_card(row) for row in involved_rows],
        failures=failures[:50],
    )


def _filter_docs_for_dedup(docs: list[dict], title_query: str, ingredient_hints: list[str]) -> list[dict]:
    query = title_query.strip().lower()
    hints = [h.strip().lower() for h in ingredient_hints if h and h.strip()]
    if not query and not hints:
        return docs

    out: list[dict] = []
    for item in docs:
        row = item["row"]
        doc = item["doc"]
        name = (row.name or "").lower()
        brand = (row.brand or "").lower()
        one_sentence = (row.one_sentence or "").lower()
        ingredient_names = _ingredient_names(doc)

        title_hit = bool(query and (query in name or query in brand or query in one_sentence))
        ingredient_hit = any(any(h in ing for ing in ingredient_names) for h in hints) if hints else False
        if title_hit or ingredient_hit:
            out.append(item)
    return out


def _group_docs_by_category(items: list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for item in items:
        row = item["row"]
        category = str(getattr(row, "category", "") or "").strip().lower() or "unknown"
        grouped[category].append(item)
    for cat_items in grouped.values():
        cat_items.sort(
            key=lambda item: (
                str(getattr(item["row"], "created_at", "") or ""),
                str(getattr(item["row"], "id", "") or ""),
            )
        )
    return grouped


def _extract_dedup_relations(
    ai_result: dict[str, Any],
    anchor_id: str,
    candidate_ids: list[str],
    min_confidence: int,
) -> list[dict[str, Any]]:
    allowed_ids = {anchor_id, *candidate_ids}
    keep_id = str(ai_result.get("keep_id") or "").strip()
    if not keep_id or keep_id not in allowed_ids:
        raise ValueError("invalid dedup output (keep_id).")

    duplicates_raw = ai_result.get("duplicates")
    if not isinstance(duplicates_raw, list):
        raise ValueError("invalid dedup output (duplicates).")

    analysis_text = _normalize_analysis_text_for_ui(str(ai_result.get("analysis_text") or ""))
    relations: list[dict[str, Any]] = []
    for item in duplicates_raw:
        if not isinstance(item, dict):
            continue
        remove_id = str(item.get("id") or "").strip()
        if not remove_id or remove_id == keep_id or remove_id not in allowed_ids:
            continue
        try:
            confidence = int(item.get("confidence"))
        except Exception:
            confidence = 0
        confidence = max(0, min(100, confidence))
        if confidence < min_confidence:
            continue
        relations.append(
            {
                "keep_id": keep_id,
                "remove_id": remove_id,
                "confidence": confidence,
                "reason": str(item.get("reason") or "").strip(),
                "analysis_text": analysis_text,
            }
        )
    return relations


def _build_suggestions_from_relations(
    relations: list[dict[str, Any]],
    item_by_id: dict[str, dict[str, Any]],
) -> list[ProductDedupSuggestion]:
    directed_best: dict[tuple[str, str], dict[str, Any]] = {}
    for item in relations:
        keep_id = str(item.get("keep_id") or "").strip()
        remove_id = str(item.get("remove_id") or "").strip()
        if not keep_id or not remove_id or keep_id == remove_id:
            continue
        key = (remove_id, keep_id)
        old = directed_best.get(key)
        if old is None or int(item.get("confidence") or 0) > int(old.get("confidence") or 0):
            directed_best[key] = item

    adjacency: dict[str, set[str]] = defaultdict(set)
    for rel in directed_best.values():
        keep_id = str(rel["keep_id"])
        remove_id = str(rel["remove_id"])
        adjacency[keep_id].add(remove_id)
        adjacency[remove_id].add(keep_id)

    suggestions: list[ProductDedupSuggestion] = []
    visited: set[str] = set()
    for start in sorted(adjacency.keys()):
        if start in visited:
            continue
        stack = [start]
        component: list[str] = []
        while stack:
            node = stack.pop()
            if node in visited:
                continue
            visited.add(node)
            component.append(node)
            stack.extend(list(adjacency.get(node, set()) - visited))

        if len(component) < 2:
            continue

        comp_set = set(component)
        comp_relations = [
            rel
            for rel in directed_best.values()
            if str(rel["keep_id"]) in comp_set and str(rel["remove_id"]) in comp_set
        ]
        if not comp_relations:
            continue

        keep_id = _pick_keep_id(component, comp_relations, item_by_id)
        remove_ids = sorted(
            [pid for pid in component if pid != keep_id],
            key=lambda pid: (str(getattr(item_by_id.get(pid, {}).get("row"), "created_at", "") or ""), pid),
            reverse=True,
        )

        max_confidence = max(max(0, min(100, int(rel.get("confidence") or 0))) for rel in comp_relations)
        reason = _component_reason(comp_relations)
        analysis_text = _component_analysis_text(comp_relations)
        compared_ids = sorted(
            component,
            key=lambda pid: (str(getattr(item_by_id.get(pid, {}).get("row"), "created_at", "") or ""), pid),
            reverse=True,
        )

        suggestions.append(
            ProductDedupSuggestion(
                group_id=f"group-{len(suggestions) + 1}",
                keep_id=keep_id,
                remove_ids=remove_ids,
                confidence=max_confidence,
                reason=reason,
                analysis_text=analysis_text or None,
                compared_ids=compared_ids,
            )
        )

    suggestions.sort(key=lambda item: item.confidence, reverse=True)
    return suggestions


def _pick_keep_id(
    component: list[str],
    comp_relations: list[dict[str, Any]],
    item_by_id: dict[str, dict[str, Any]],
) -> str:
    incoming: dict[str, int] = defaultdict(int)
    outgoing: dict[str, int] = defaultdict(int)
    for rel in comp_relations:
        keep_id = str(rel.get("keep_id") or "").strip()
        remove_id = str(rel.get("remove_id") or "").strip()
        confidence = max(0, min(100, int(rel.get("confidence") or 0)))
        incoming[keep_id] += confidence
        outgoing[remove_id] += confidence

    quality: dict[str, int] = {}
    for pid in component:
        quality[pid] = _info_completeness_score(item_by_id.get(pid, {}))

    ranked = sorted(
        component,
        key=lambda pid: (
            -quality.get(pid, 0),
            -incoming.get(pid, 0),
            outgoing.get(pid, 0),
            str(getattr(item_by_id.get(pid, {}).get("row"), "created_at", "") or ""),
            pid,
        ),
    )
    return ranked[0]


def _info_completeness_score(item: dict[str, Any]) -> int:
    row = item.get("row")
    doc = item.get("doc") if isinstance(item.get("doc"), dict) else {}
    score = 0

    brand = str(getattr(row, "brand", "") or "").strip()
    name = str(getattr(row, "name", "") or "").strip()
    one_sentence = str(getattr(row, "one_sentence", "") or "").strip()
    if brand:
        score += 4
    if name:
        score += 6
    if one_sentence:
        score += 4
        score += min(4, max(0, len(one_sentence) // 24))

    ingredients = _ingredient_names(doc)
    score += min(12, len(ingredients))

    summary = doc.get("summary")
    if isinstance(summary, dict):
        for key in ("pros", "cons", "who_for", "who_not_for"):
            value = summary.get(key)
            if isinstance(value, list):
                score += min(2, len([v for v in value if str(v).strip()]))

    evidence = doc.get("evidence")
    if isinstance(evidence, dict):
        image_path = str(evidence.get("image_path") or "").strip()
        if image_path:
            score += 2

    return score


def _find_pair_relation(relations: list[dict[str, Any]], a_id: str, b_id: str) -> dict[str, Any] | None:
    ids = {a_id, b_id}
    for item in relations:
        keep_id = str(item.get("keep_id") or "").strip()
        remove_id = str(item.get("remove_id") or "").strip()
        if {keep_id, remove_id} == ids:
            return item
    return None


def _pair_result_text(anchor_id: str, candidate_id: str, relation: dict[str, Any] | None) -> str:
    if not relation:
        return f"{anchor_id} vs {candidate_id} | non-duplicate"
    keep_id = str(relation.get("keep_id") or "").strip()
    remove_id = str(relation.get("remove_id") or "").strip()
    confidence = max(0, min(100, int(relation.get("confidence") or 0)))
    reason = str(relation.get("reason") or "").strip()
    text = f"{anchor_id} vs {candidate_id} | duplicate | keep={keep_id} remove={remove_id} confidence={confidence}"
    if reason:
        text += f" | reason={reason}"
    return text


def _forward_dedup_model_event(
    event_callback: Callable[[dict[str, Any]], None] | None,
    category: str,
    anchor_id: str,
    payload: dict[str, Any],
) -> None:
    event_type = str(payload.get("type") or "").strip()
    if event_type == "delta":
        delta = str(payload.get("delta") or "")
        if not delta:
            return
        _emit_progress(
            event_callback,
            {
                "step": "dedup_model_delta",
                "category": category,
                "anchor_id": anchor_id,
                "delta": delta,
                "text": delta,
            },
        )
        return
    if event_type != "step":
        return
    message = str(payload.get("message") or "").strip()
    if not message:
        return
    _emit_progress(
        event_callback,
        {
            "step": "dedup_model_event",
            "category": category,
            "anchor_id": anchor_id,
            "text": f"{anchor_id} | {message}",
        },
    )


def _forward_ingredient_model_event(
    event_callback: Callable[[dict[str, Any]], None] | None,
    ingredient_id: str,
    category: str,
    payload: dict[str, Any],
) -> None:
    event_type = str(payload.get("type") or "").strip()
    if event_type == "delta":
        delta = str(payload.get("delta") or "")
        if not delta:
            return
        _emit_progress(
            event_callback,
            {
                "step": "ingredient_model_delta",
                "ingredient_id": ingredient_id,
                "category": category,
                "delta": delta,
                "text": delta,
            },
        )
        return
    if event_type != "step":
        return
    message = str(payload.get("message") or "").strip()
    if not message:
        return
    _emit_progress(
        event_callback,
        {
            "step": "ingredient_model_step",
            "ingredient_id": ingredient_id,
            "category": category,
            "text": f"{ingredient_id} | {message}",
        },
    )


def _normalize_analysis_text_for_ui(text: str) -> str:
    raw = (text or "").strip()
    if not raw:
        return ""
    try:
        parsed = json.loads(raw)
        return json.dumps(parsed, ensure_ascii=False)
    except Exception:
        pass

    first = raw.find("{")
    last = raw.rfind("}")
    if first >= 0 and last > first:
        snippet = raw[first : last + 1]
        try:
            parsed = json.loads(snippet)
            return json.dumps(parsed, ensure_ascii=False)
        except Exception:
            return ""
    return ""


def _component_reason(comp_relations: list[dict[str, Any]]) -> str:
    reasons: list[str] = []
    for rel in sorted(comp_relations, key=lambda item: int(item.get("confidence") or 0), reverse=True):
        reason = str(rel.get("reason") or "").strip()
        if reason and reason not in reasons:
            reasons.append(reason)
        if len(reasons) >= 3:
            break
    return "；".join(reasons)


def _component_analysis_text(comp_relations: list[dict[str, Any]]) -> str:
    lines: list[str] = []
    for rel in sorted(comp_relations, key=lambda item: int(item.get("confidence") or 0), reverse=True):
        keep_id = str(rel.get("keep_id") or "").strip()
        remove_id = str(rel.get("remove_id") or "").strip()
        confidence = max(0, min(100, int(rel.get("confidence") or 0)))
        reason = str(rel.get("reason") or "").strip()
        line = f"{remove_id} -> {keep_id} | confidence={confidence}"
        if reason:
            line += f" | reason={reason}"
        lines.append(line)
        if len(lines) >= 12:
            break

    ai_texts: list[str] = []
    for rel in comp_relations:
        text = str(rel.get("analysis_text") or "").strip()
        if not text or text in ai_texts:
            continue
        ai_texts.append(text)
        if len(ai_texts) >= 2:
            break

    if not lines and not ai_texts:
        return ""

    out = ["同品类两两重合分析（高置信命中）", *lines]
    if ai_texts:
        out.append("")
        out.append("模型原文片段：")
        out.extend(ai_texts)
    return "\n".join(out).strip()


def _compact_product_for_dedup(item: dict) -> dict:
    row = item["row"]
    doc = item["doc"]
    return {
        "id": row.id,
        "category": row.category,
        "brand": row.brand,
        "name": row.name,
        "one_sentence": row.one_sentence,
        "ingredients": _ingredient_names(doc)[:30],
    }


def _ingredient_names(doc: dict) -> list[str]:
    ingredients = doc.get("ingredients")
    if not isinstance(ingredients, list):
        return []
    out: list[str] = []
    for item in ingredients:
        if not isinstance(item, dict):
            continue
        name = str(item.get("name") or "").strip().lower()
        if name:
            out.append(name)
    return list(dict.fromkeys(out))


def _collect_category_ingredients(
    *,
    rows: list[ProductIndex],
    max_sources_per_ingredient: int,
    normalization_packages: list[str] | None = None,
) -> tuple[dict[str, dict[str, Any]], dict[str, Any]]:
    records = _collect_category_ingredient_records(rows=rows)
    return _aggregate_category_ingredients(
        records=records,
        max_sources_per_ingredient=max_sources_per_ingredient,
        normalization_packages=normalization_packages,
    )


def _collect_category_ingredient_records(
    *,
    rows: list[ProductIndex],
) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    for row in rows:
        product_id = str(getattr(row, "id", "") or "").strip()
        json_path = str(getattr(row, "json_path", "") or "").strip()
        if not json_path or not exists_rel_path(json_path):
            raise HTTPException(
                status_code=422,
                detail=(
                    f"[stage=ingredient_stats_aggregate] product_id={product_id} "
                    f"json_missing path={json_path or '-'}"
                ),
            )
        try:
            doc = load_json(json_path)
        except Exception as e:
            raise HTTPException(
                status_code=422,
                detail=(
                    f"[stage=ingredient_stats_aggregate] product_id={product_id} "
                    f"json_load_failed path={json_path} error={e}"
                ),
            ) from e

        row_category = str(getattr(row, "category", "") or "").strip().lower()
        doc_category = ""
        if isinstance(doc.get("product"), dict):
            doc_category = str((doc.get("product") or {}).get("category") or "").strip().lower()
        category = row_category or doc_category or "unknown"

        ingredients = doc.get("ingredients")
        if not isinstance(ingredients, list) or not ingredients:
            raise HTTPException(
                status_code=422,
                detail=(
                    f"[stage=ingredient_stats_aggregate] category={category} product_id={product_id} "
                    "ingredients should be a non-empty list."
                ),
            )

        product_items: list[dict[str, Any]] = []
        issues: list[str] = []
        for idx, raw in enumerate(ingredients, start=1):
            if not isinstance(raw, dict):
                issues.append(f"ingredients[{idx}] should be an object.")
                continue

            ingredient_name = str(raw.get("name") or "").strip()
            ingredient_key_base = _normalize_ingredient_key(ingredient_name)
            ingredient_name_en_field = _extract_ingredient_name_en_from_fields(raw=raw)
            ingredient_name_en_paren = _extract_ingredient_name_en_from_parenthesis(ingredient_name=ingredient_name)
            ingredient_name_en = ingredient_name_en_field or ingredient_name_en_paren
            ingredient_name_en_key_field = _normalize_ingredient_en_key(ingredient_name_en_field)
            ingredient_name_en_key_paren = _normalize_ingredient_en_key(ingredient_name_en_paren)
            rank = _parse_positive_int(raw.get("rank"))
            abundance_level = _normalize_ingredient_abundance_level(
                raw.get("abundance_level") or raw.get("abundance") or raw.get("major_minor")
            )
            order_confidence = _parse_ingredient_order_confidence(raw.get("order_confidence"))

            item_issues: list[str] = []
            if not ingredient_name:
                item_issues.append(f"ingredients[{idx}].name is required.")
            if not ingredient_key_base:
                item_issues.append(f"ingredients[{idx}].name should be non-empty after normalization.")
            if rank is None:
                item_issues.append(f"ingredients[{idx}].rank should be a positive integer.")
            if abundance_level is None:
                item_issues.append(f"ingredients[{idx}].abundance_level should be major|trace.")
            if order_confidence is None:
                item_issues.append(f"ingredients[{idx}].order_confidence should be an integer in [0,100].")
            if item_issues:
                issues.extend(item_issues)
                continue

            product_items.append(
                {
                    "ingredient_name": ingredient_name,
                    "ingredient_name_en": ingredient_name_en,
                    "ingredient_name_en_key_field": ingredient_name_en_key_field,
                    "ingredient_name_en_key_paren": ingredient_name_en_key_paren,
                    "ingredient_key_base": ingredient_key_base,
                    "rank": int(rank),
                    "abundance_level": str(abundance_level),
                    "order_confidence": int(order_confidence),
                    "raw": raw,
                }
            )

        if issues:
            issue_preview = "; ".join(issues[:12])
            if len(issues) > 12:
                issue_preview += f"; ...(+{len(issues) - 12} more)"
            raise HTTPException(
                status_code=422,
                detail=(
                    f"[stage=ingredient_stats_aggregate] category={category} product_id={product_id} "
                    f"invalid_stage2_ingredient_fields: {issue_preview}"
                ),
            )

        records.append(
            {
                "product_id": product_id,
                "category": category,
                "brand": str(row.brand or "").strip(),
                "name": str(row.name or "").strip(),
                "one_sentence": str(row.one_sentence or "").strip(),
                "items": product_items,
            }
        )
    return records


def _aggregate_category_ingredients(
    *,
    records: list[dict[str, Any]],
    max_sources_per_ingredient: int,
    normalization_packages: list[str] | None = None,
) -> tuple[dict[str, dict[str, Any]], dict[str, Any]]:
    grouped: dict[str, dict[str, Any]] = {}
    max_sources = max(1, min(30, int(max_sources_per_ingredient)))
    selected_packages = _normalize_ingredient_normalization_packages(normalization_packages)
    raw_group_keys: set[str] = set()
    total_mentions = 0

    for record in records:
        category = str(record["category"])
        product_id = str(record["product_id"])
        product_key_to_name: dict[str, str] = {}
        items = record["items"]

        for parsed in items:
            ingredient_name = str(parsed["ingredient_name"])
            ingredient_name_en = str(parsed.get("ingredient_name_en") or "").strip() or None
            ingredient_key_base = str(parsed["ingredient_key_base"])
            ingredient_key = _resolve_ingredient_key(
                ingredient_key_base=ingredient_key_base,
                ingredient_name_en_key_field=str(parsed.get("ingredient_name_en_key_field") or ""),
                ingredient_name_en_key_paren=str(parsed.get("ingredient_name_en_key_paren") or ""),
                normalization_packages=selected_packages,
            )
            raw_group_keys.add(f"{category}::{ingredient_key_base}")
            total_mentions += 1

            ingredient_id = _build_ingredient_id(category=category, ingredient_key=ingredient_key)
            group_key = f"{category}::{ingredient_key}"
            item = grouped.get(group_key)
            if item is None:
                item = {
                    "ingredient_id": ingredient_id,
                    "ingredient_name": ingredient_name,
                    "ingredient_name_en": ingredient_name_en,
                    "ingredient_key": ingredient_key,
                    "category": category,
                    "source_trace_ids": set(),
                    "source_samples": [],
                    "_mention_count": 0,
                    "_rank_values": [],
                    "_major_count": 0,
                    "_trace_count": 0,
                    "_order_confidence_values": [],
                    "_cooccurrence_counts": {},
                    "_cooccurrence_names": {},
                    "_name_counts": defaultdict(int),
                    "_name_en_counts": defaultdict(int),
                    "_alias_names": set(),
                }
                grouped[group_key] = item

            item["source_trace_ids"].add(product_id)
            item["_mention_count"] = int(item["_mention_count"]) + 1
            item["_rank_values"].append(int(parsed["rank"]))
            item["_order_confidence_values"].append(int(parsed["order_confidence"]))
            if parsed["abundance_level"] == "major":
                item["_major_count"] = int(item["_major_count"]) + 1
            else:
                item["_trace_count"] = int(item["_trace_count"]) + 1
            item["_name_counts"][ingredient_name] += 1
            if ingredient_name_en:
                item["_name_en_counts"][ingredient_name_en] += 1
            for alias_name in _collect_alias_names_from_parsed_item(parsed):
                item["_alias_names"].add(alias_name)
            if len(item["source_samples"]) < max_sources:
                item["source_samples"].append(
                    {
                        "trace_id": product_id,
                        "brand": str(record["brand"]),
                        "name": str(record["name"]),
                        "one_sentence": str(record["one_sentence"]),
                        "rank": int(parsed["rank"]),
                        "abundance_level": str(parsed["abundance_level"]),
                        "order_confidence": int(parsed["order_confidence"]),
                        "ingredient": parsed["raw"],
                    }
                )
            if ingredient_key not in product_key_to_name:
                product_key_to_name[ingredient_key] = ingredient_name

        product_keys = sorted(product_key_to_name.keys())
        for ingredient_key in product_keys:
            group_key = f"{category}::{ingredient_key}"
            item = grouped[group_key]
            co_counts = item["_cooccurrence_counts"]
            co_names = item["_cooccurrence_names"]
            for other_key in product_keys:
                if other_key == ingredient_key:
                    continue
                prev = int(co_counts.get(other_key) or 0)
                co_counts[other_key] = prev + 1
                if other_key not in co_names:
                    co_names[other_key] = str(product_key_to_name.get(other_key) or other_key)

    for item in grouped.values():
        source_trace_ids = sorted(item["source_trace_ids"])
        mention_count = int(item.pop("_mention_count", 0))
        rank_values = sorted(int(v) for v in item.pop("_rank_values", []))
        major_count = int(item.pop("_major_count", 0))
        trace_count = int(item.pop("_trace_count", 0))
        order_confidence_values = sorted(int(v) for v in item.pop("_order_confidence_values", []))
        cooccurrence_counts = item.pop("_cooccurrence_counts", {})
        cooccurrence_names = item.pop("_cooccurrence_names", {})
        name_counts = dict(item.pop("_name_counts", {}))
        name_en_counts = dict(item.pop("_name_en_counts", {}))
        alias_names = sorted(str(x) for x in item.pop("_alias_names", set()) if str(x).strip())

        if mention_count <= 0 or not source_trace_ids:
            raise HTTPException(
                status_code=422,
                detail=(
                    f"[stage=ingredient_stats_aggregate] category={item.get('category')} "
                    f"ingredient_key={item.get('ingredient_key')} has empty aggregated stats."
                ),
            )
        if len(rank_values) != mention_count or len(order_confidence_values) != mention_count:
            raise HTTPException(
                status_code=422,
                detail=(
                    f"[stage=ingredient_stats_aggregate] category={item.get('category')} "
                    f"ingredient_key={item.get('ingredient_key')} stats_count_mismatch "
                    f"mention_count={mention_count} rank_values={len(rank_values)} "
                    f"order_confidence_values={len(order_confidence_values)}"
                ),
            )

        item["ingredient_name"] = _pick_preferred_name(name_counts) or str(item["ingredient_name"])
        item["ingredient_name_en"] = _pick_preferred_name(name_en_counts) or item.get("ingredient_name_en")
        item["alias_names"] = alias_names

        product_count = len(source_trace_ids)
        source_json = {
            "stats": {
                "product_count": product_count,
                "mention_count": mention_count,
                "rank": _build_rank_stats(rank_values),
                "abundance": _build_abundance_stats(major_count=major_count, trace_count=trace_count),
                "order_confidence": _build_order_confidence_stats(order_confidence_values),
                "cooccurrence_top": _build_cooccurrence_top(
                    counts=cooccurrence_counts,
                    names=cooccurrence_names,
                    limit=INGREDIENT_SOURCE_COOCCURRENCE_TOP_N,
                ),
                "data_quality": {
                    "missing_rank": 0,
                    "missing_abundance": 0,
                    "missing_order_confidence": 0,
                    "invalid_items": 0,
                },
            },
            "samples": item["source_samples"],
        }
        category = str(item["category"])
        ingredient_key = str(item["ingredient_key"])
        item["source_json"] = source_json
        item["source_schema_version"] = INGREDIENT_SOURCE_SCHEMA_VERSION
        item["source_signature"] = _build_ingredient_source_signature(
            category=category,
            ingredient_key=ingredient_key,
            source_json=source_json,
        )

    meta = {
        "scanned_products": len(records),
        "total_mentions": total_mentions,
        "raw_unique_ingredients": len(raw_group_keys),
        "unique_ingredients": len(grouped),
        "normalization_packages": selected_packages,
    }
    return grouped, meta


def _ingredient_normalization_package_map() -> dict[str, dict[str, Any]]:
    return {str(item["id"]): item for item in INGREDIENT_NORMALIZATION_PACKAGES}


def _default_ingredient_normalization_packages() -> list[str]:
    out: list[str] = []
    for item in INGREDIENT_NORMALIZATION_PACKAGES:
        if bool(item.get("default_enabled")):
            out.append(str(item.get("id")))
    return out


def _normalize_ingredient_normalization_packages(package_ids: list[str] | None) -> list[str]:
    pkg_map = _ingredient_normalization_package_map()
    requested: list[str] = []
    if package_ids:
        for raw in package_ids:
            value = str(raw or "").strip()
            if not value:
                continue
            if value not in pkg_map:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "[stage=ingredient_preflight_config] "
                        f"unknown normalization package: {value}"
                    ),
                )
            if value not in requested:
                requested.append(value)
    if not requested:
        requested = _default_ingredient_normalization_packages()
    return requested


def _normalize_ingredient_text(name: str, *, normalization_packages: list[str] | None = None) -> str:
    selected = set(normalization_packages or _default_ingredient_normalization_packages())
    value = str(name or "")
    if "unicode_nfkc" in selected:
        value = unicodedata.normalize("NFKC", value)
    if "punctuation_fold" in selected:
        value = value.translate(INGREDIENT_PUNCTUATION_FOLD_TABLE)
    if "whitespace_fold" in selected:
        value = " ".join(value.split())
    value = value.strip().lower()
    return value


def _normalize_ingredient_key(name: str) -> str:
    value = _normalize_ingredient_text(name, normalization_packages=["unicode_nfkc", "punctuation_fold", "whitespace_fold"])
    if not value:
        return ""
    return value[:120]


def _normalize_ingredient_en_key(value: str | None) -> str:
    raw = _normalize_ingredient_text(str(value or ""), normalization_packages=["unicode_nfkc", "punctuation_fold", "whitespace_fold"])
    if not raw:
        return ""
    compact = re.sub(r"[^a-z0-9]+", "", raw)
    return compact[:120]


def _extract_ingredient_name_en_from_fields(raw: dict[str, Any]) -> str | None:
    if not isinstance(raw, dict):
        return None
    candidates = (
        "name_en",
        "inci",
        "inci_name",
        "english_name",
        "en_name",
        "inciName",
        "nameEn",
    )
    for key in candidates:
        value = str(raw.get(key) or "").strip()
        if not value:
            continue
        if re.search(r"[A-Za-z]", value):
            return value
    return None


def _extract_ingredient_name_en_from_parenthesis(ingredient_name: str) -> str | None:
    text = str(ingredient_name or "").strip()
    if not text:
        return None
    matches = re.findall(r"\(([^()]+)\)", text)
    for part in matches:
        value = str(part or "").strip()
        if not value:
            continue
        if re.search(r"[A-Za-z]", value):
            return value
    return None


def _resolve_ingredient_key(
    *,
    ingredient_key_base: str,
    ingredient_name_en_key_field: str,
    ingredient_name_en_key_paren: str,
    normalization_packages: list[str],
) -> str:
    selected = set(normalization_packages)
    base = str(ingredient_key_base or "").strip().lower()
    if not base:
        raise HTTPException(
            status_code=422,
            detail="[stage=ingredient_stats_aggregate] ingredient base key is empty.",
        )
    if "en_exact" not in selected:
        return base

    field_key = str(ingredient_name_en_key_field or "").strip().lower()
    if field_key:
        return f"en::{field_key}"[:120]

    if "extract_en_parenthesis" in selected:
        paren_key = str(ingredient_name_en_key_paren or "").strip().lower()
        if paren_key:
            return f"en::{paren_key}"[:120]
    return base


def _collect_alias_names_from_parsed_item(parsed: dict[str, Any]) -> list[str]:
    out: list[str] = []
    name = str(parsed.get("ingredient_name") or "").strip()
    if name:
        out.append(name)
    name_en = str(parsed.get("ingredient_name_en") or "").strip()
    if name_en:
        out.append(name_en)
    if name:
        parenthesis = _extract_ingredient_name_en_from_parenthesis(ingredient_name=name)
        if parenthesis:
            out.append(parenthesis)
    dedup: list[str] = []
    seen: set[str] = set()
    for raw in out:
        value = str(raw or "").strip()
        if not value:
            continue
        key = value.lower()
        if key in seen:
            continue
        seen.add(key)
        dedup.append(value)
    return dedup


def _pick_preferred_name(counter: dict[str, int]) -> str:
    if not counter:
        return ""
    rows = sorted(counter.items(), key=lambda item: (-int(item[1]), len(str(item[0])), str(item[0])))
    return str(rows[0][0]).strip()


def _collect_item_alias_names(*, item: dict[str, Any]) -> list[str]:
    out: list[str] = []
    ingredient_name = str(item.get("ingredient_name") or "").strip()
    if ingredient_name:
        out.append(ingredient_name)
    ingredient_name_en = str(item.get("ingredient_name_en") or "").strip()
    if ingredient_name_en:
        out.append(ingredient_name_en)
    for raw in item.get("alias_names") or []:
        value = str(raw or "").strip()
        if value:
            out.append(value)
    dedup: list[str] = []
    seen: set[str] = set()
    for raw in out:
        lowered = raw.lower()
        if lowered in seen:
            continue
        seen.add(lowered)
        dedup.append(raw)
    return dedup


def _build_rank_stats(values: list[int]) -> dict[str, float | int]:
    sorted_values = sorted(int(v) for v in values)
    return {
        "min": int(sorted_values[0]),
        "max": int(sorted_values[-1]),
        "mean": _round_stat(sum(sorted_values) / len(sorted_values)),
        "median": _round_stat(_percentile(sorted_values, 50)),
        "p25": _round_stat(_percentile(sorted_values, 25)),
        "p75": _round_stat(_percentile(sorted_values, 75)),
    }


def _build_abundance_stats(*, major_count: int, trace_count: int) -> dict[str, float | int]:
    total = max(0, int(major_count) + int(trace_count))
    if total <= 0:
        raise HTTPException(
            status_code=422,
            detail="[stage=ingredient_stats_aggregate] abundance stats total is zero.",
        )
    return {
        "major_count": int(major_count),
        "trace_count": int(trace_count),
        "major_ratio": _round_stat(int(major_count) / total),
        "trace_ratio": _round_stat(int(trace_count) / total),
    }


def _build_order_confidence_stats(values: list[int]) -> dict[str, float]:
    sorted_values = sorted(int(v) for v in values)
    return {
        "mean": _round_stat(sum(sorted_values) / len(sorted_values)),
        "p25": _round_stat(_percentile(sorted_values, 25)),
        "p50": _round_stat(_percentile(sorted_values, 50)),
        "p75": _round_stat(_percentile(sorted_values, 75)),
    }


def _build_cooccurrence_top(
    *,
    counts: dict[str, Any],
    names: dict[str, Any],
    limit: int,
) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    for key, count_raw in counts.items():
        try:
            count = int(count_raw)
        except Exception:
            continue
        if count <= 0:
            continue
        ingredient_name = str(names.get(key) or key).strip() or str(key)
        items.append({"ingredient": ingredient_name, "count": count})
    items.sort(key=lambda x: (-int(x["count"]), str(x["ingredient"])))
    return items[: max(1, int(limit))]


def _build_ingredient_source_signature(
    *,
    category: str,
    ingredient_key: str,
    source_json: dict[str, Any],
) -> str:
    canonical = {
        "schema_version": INGREDIENT_SOURCE_SCHEMA_VERSION,
        "category": str(category or "").strip().lower(),
        "ingredient_key": str(ingredient_key or "").strip().lower(),
        "source_json": source_json,
    }
    raw = json.dumps(canonical, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha1(raw.encode("utf-8")).hexdigest()


def _load_profile_source_signature(rel_path: str) -> str:
    if not rel_path or not exists_rel_path(rel_path):
        return ""
    try:
        doc = load_json(rel_path)
    except Exception:
        return ""
    if not isinstance(doc, dict):
        return ""
    generator = doc.get("generator")
    if not isinstance(generator, dict):
        return ""
    return str(generator.get("source_signature") or "").strip()


def _source_product_count_from_source_json(*, source_json: dict[str, Any], fallback: int) -> int:
    if not isinstance(source_json, dict):
        return max(0, int(fallback))
    stats = source_json.get("stats")
    if not isinstance(stats, dict):
        return max(0, int(fallback))
    try:
        value = int(stats.get("product_count"))
    except Exception:
        value = int(fallback)
    return max(0, value)


def _normalize_ingredient_abundance_level(value: Any) -> str | None:
    text = str(value or "").strip().lower()
    if text in {"major", "main", "primary", "主要", "主成分"}:
        return "major"
    if text in {"trace", "minor", "secondary", "微量", "少量"}:
        return "trace"
    return None


def _parse_ingredient_order_confidence(value: Any) -> int | None:
    try:
        parsed = int(value)
    except Exception:
        return None
    if parsed < 0 or parsed > 100:
        return None
    return parsed


def _round_stat(value: float) -> float:
    return round(float(value), 4)


def _percentile(sorted_values: list[int], percentile: float) -> float:
    if not sorted_values:
        raise ValueError("sorted_values is empty.")
    if len(sorted_values) == 1:
        return float(sorted_values[0])
    p = max(0.0, min(100.0, float(percentile)))
    index = (len(sorted_values) - 1) * (p / 100.0)
    lower = int(index)
    upper = min(lower + 1, len(sorted_values) - 1)
    weight = index - lower
    lower_value = float(sorted_values[lower])
    upper_value = float(sorted_values[upper])
    return lower_value + (upper_value - lower_value) * weight

def _build_ingredient_id(category: str, ingredient_key: str) -> str:
    base = f"{category}::{ingredient_key}"
    digest = hashlib.sha1(base.encode("utf-8")).hexdigest()[:20]
    return f"ing-{digest}"


def _normalize_optional_category(category: str | None) -> str | None:
    value = str(category or "").strip().lower()
    if not value:
        return None
    if value not in VALID_CATEGORIES:
        raise HTTPException(status_code=400, detail=f"Invalid category: {value}.")
    return value


def _normalize_required_category(category: str) -> str:
    value = _normalize_optional_category(category)
    if not value:
        raise HTTPException(status_code=400, detail="category is required.")
    return value


def _normalize_target_type_key(raw: str) -> str:
    value = str(raw or "").strip()
    if not value:
        raise HTTPException(status_code=400, detail="target_type_key is required.")
    if len(value) > 128:
        raise HTTPException(status_code=400, detail="target_type_key is too long (max 128).")
    return value


def _normalize_ingredient_id_list(values: list[str]) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()
    for raw in values:
        value = str(raw or "").strip().lower()
        if not value:
            continue
        if len(value) > 64:
            raise HTTPException(status_code=400, detail=f"ingredient_id is too long: {value[:32]}...")
        if value in seen:
            continue
        seen.add(value)
        out.append(value)
    return out


def _featured_slot_schema_http_error(exc: Exception) -> HTTPException:
    return HTTPException(
        status_code=500,
        detail=(
            "Featured slot table query failed. "
            "Database schema may be outdated (missing table 'product_featured_slots'). "
            f"Raw error: {exc}"
        ),
    )


def _iter_ingredient_profile_rel_paths(category: str | None) -> list[str]:
    base = Path(settings.storage_dir).resolve()
    root = (base / "ingredients").resolve()
    if not str(root).startswith(str(base)):
        raise HTTPException(status_code=500, detail="Invalid ingredients storage root.")
    if not root.exists():
        return []

    target_dir = root
    if category:
        target_dir = (root / category).resolve()
        if not str(target_dir).startswith(str(root)):
            raise HTTPException(status_code=500, detail="Invalid ingredients category path.")
        if not target_dir.exists():
            return []

    rel_paths: list[str] = []
    for path in sorted(target_dir.rglob("*.json")):
        if not path.is_file():
            continue
        rel_paths.append(path.resolve().relative_to(base).as_posix())
    return rel_paths


def _resolve_ingredient_profile_path_for_delete(
    *,
    rec: IngredientLibraryIndex | None,
    ingredient_id: str,
) -> str:
    candidates: list[str] = []
    if rec is not None:
        storage_path = str(rec.storage_path or "").strip()
        if storage_path:
            candidates.append(storage_path)
        category = str(rec.category or "").strip().lower()
        if category:
            candidates.append(ingredient_profile_rel_path(category, ingredient_id))

    for rel in candidates:
        if rel and exists_rel_path(rel):
            return rel

    base = Path(settings.storage_dir).resolve()
    root = (base / "ingredients").resolve()
    if not str(root).startswith(str(base)) or not root.exists():
        return ""
    for path in root.rglob(f"{ingredient_id}.json"):
        if not path.is_file():
            continue
        resolved = path.resolve()
        if not str(resolved).startswith(str(root)):
            continue
        return resolved.relative_to(base).as_posix()
    return ""


def _load_ingredient_profile_doc(rel_path: str) -> dict[str, Any]:
    doc = load_json(rel_path)
    if not isinstance(doc, dict):
        raise ValueError("document is not an object.")
    return doc


def _required_text_field(doc: dict[str, Any], key: str) -> str:
    value = str(doc.get(key) or "").strip()
    if not value:
        raise ValueError(f"missing required field '{key}'.")
    return value


def _strict_str_list(value: Any, field_name: str) -> list[str]:
    if value is None:
        return []
    if not isinstance(value, list):
        raise ValueError(f"{field_name} should be a list.")
    out: list[str] = []
    for idx, item in enumerate(value):
        text = str(item or "").strip()
        if not text:
            raise ValueError(f"{field_name}[{idx}] is empty.")
        out.append(text)
    return out


def _strict_non_negative_int(value: Any, field_name: str, fallback: int | None = None) -> int:
    if value is None and fallback is not None:
        return max(0, int(fallback))
    try:
        parsed = int(value)
    except Exception as e:
        raise ValueError(f"{field_name} should be an integer.") from e
    if parsed < 0:
        raise ValueError(f"{field_name} should be >= 0.")
    return parsed


def _parse_optional_source_json(value: Any, field_name: str) -> dict[str, Any] | None:
    if value is None:
        return None
    if not isinstance(value, dict):
        raise ValueError(f"{field_name} should be an object.")
    stats = value.get("stats")
    samples = value.get("samples")
    if not isinstance(stats, dict):
        raise ValueError(f"{field_name}.stats should be an object.")
    if not isinstance(samples, list):
        raise ValueError(f"{field_name}.samples should be a list.")
    return value


def _to_ingredient_library_list_item(doc: dict[str, Any], rel_path: str) -> IngredientLibraryListItem:
    ingredient_id = _required_text_field(doc, "id")
    category = _required_text_field(doc, "category").lower()
    if category not in VALID_CATEGORIES:
        raise ValueError(f"invalid category in profile: {category}.")
    ingredient_name = _required_text_field(doc, "ingredient_name")
    ingredient_name_en = str(doc.get("ingredient_name_en") or "").strip() or None
    source_trace_ids = _strict_str_list(doc.get("source_trace_ids"), field_name="source_trace_ids")
    source_json = _parse_optional_source_json(doc.get("source_json"), field_name="source_json")
    if source_json is not None:
        source_count = _source_product_count_from_source_json(source_json=source_json, fallback=len(source_trace_ids))
    else:
        source_count = _strict_non_negative_int(
            doc.get("source_count"),
            field_name="source_count",
            fallback=len(source_trace_ids),
        )

    profile_raw = doc.get("profile")
    if not isinstance(profile_raw, dict):
        raise ValueError("profile should be an object.")
    summary = str(profile_raw.get("summary") or "").strip()
    generated_at = str(doc.get("generated_at") or "").strip() or None

    return IngredientLibraryListItem(
        ingredient_id=ingredient_id,
        category=category,
        ingredient_name=ingredient_name,
        ingredient_name_en=ingredient_name_en,
        summary=summary,
        source_count=source_count,
        source_trace_ids=source_trace_ids,
        generated_at=generated_at,
        storage_path=rel_path,
    )


def _to_ingredient_library_detail_item(doc: dict[str, Any], rel_path: str) -> IngredientLibraryDetailItem:
    base = _to_ingredient_library_list_item(doc=doc, rel_path=rel_path)
    ingredient_key = str(doc.get("ingredient_key") or "").strip() or None
    source_json = _parse_optional_source_json(doc.get("source_json"), field_name="source_json") or {}

    generator = doc.get("generator")
    if generator is None:
        generator = {}
    if not isinstance(generator, dict):
        raise ValueError("generator should be an object.")

    profile_raw = doc.get("profile")
    if not isinstance(profile_raw, dict):
        raise ValueError("profile should be an object.")
    profile = IngredientLibraryProfile(
        summary=str(profile_raw.get("summary") or "").strip(),
        benefits=_strict_str_list(profile_raw.get("benefits"), field_name="profile.benefits"),
        risks=_strict_str_list(profile_raw.get("risks"), field_name="profile.risks"),
        usage_tips=_strict_str_list(profile_raw.get("usage_tips"), field_name="profile.usage_tips"),
        suitable_for=_strict_str_list(profile_raw.get("suitable_for"), field_name="profile.suitable_for"),
        avoid_for=_strict_str_list(profile_raw.get("avoid_for"), field_name="profile.avoid_for"),
        confidence=_strict_non_negative_int(profile_raw.get("confidence"), field_name="profile.confidence", fallback=0),
        reason=str(profile_raw.get("reason") or "").strip(),
        analysis_text=str(profile_raw.get("analysis_text") or "").strip(),
    )

    source_samples_raw = doc.get("source_samples")
    if source_samples_raw is None:
        source_samples_raw = []
    if not isinstance(source_samples_raw, list):
        raise ValueError("source_samples should be a list.")
    source_samples: list[IngredientLibrarySourceSample] = []
    for idx, sample in enumerate(source_samples_raw):
        if not isinstance(sample, dict):
            raise ValueError(f"source_samples[{idx}] should be an object.")
        ingredient_raw = sample.get("ingredient")
        if ingredient_raw is None:
            ingredient_raw = {}
        if not isinstance(ingredient_raw, dict):
            raise ValueError(f"source_samples[{idx}].ingredient should be an object.")
        source_samples.append(
            IngredientLibrarySourceSample(
                trace_id=str(sample.get("trace_id") or "").strip(),
                brand=str(sample.get("brand") or "").strip(),
                name=str(sample.get("name") or "").strip(),
                one_sentence=str(sample.get("one_sentence") or "").strip(),
                ingredient=ingredient_raw,
            )
        )

    return IngredientLibraryDetailItem(
        ingredient_id=base.ingredient_id,
        category=base.category,
        ingredient_name=base.ingredient_name,
        ingredient_name_en=base.ingredient_name_en,
        ingredient_key=ingredient_key,
        source_count=base.source_count,
        source_trace_ids=base.source_trace_ids,
        source_samples=source_samples,
        source_json=source_json,
        generated_at=base.generated_at,
        generator=generator,
        profile=profile,
        storage_path=base.storage_path,
    )


def _parse_positive_int(value: Any) -> int | None:
    try:
        parsed = int(value)
    except Exception:
        return None
    if parsed <= 0:
        return None
    return parsed


def _safe_positive_int(value: Any, fallback: int = 0) -> int:
    parsed = _parse_positive_int(value)
    if parsed is None:
        return max(0, int(fallback))
    return int(parsed)


def _parse_confidence_0_100(value: Any) -> int | None:
    try:
        parsed = int(value)
    except Exception:
        return None
    if parsed < 0 or parsed > 100:
        return None
    return parsed


def _normalize_abundance_level(value: Any) -> str | None:
    text = str(value or "").strip().lower()
    if not text:
        return None
    if text in {"major", "main", "primary", "secondary", "主要", "主成分", "核心"}:
        return "major"
    if text in {"trace", "minor", "micro", "微量", "末端", "痕量", "辅料"}:
        return "trace"
    return None


def _safe_str_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    out: list[str] = []
    for item in value:
        text = str(item or "").strip()
        if not text:
            continue
        out.append(text)
        if len(out) >= 30:
            break
    return out


def _build_ingredient_alias_id(*, category: str, alias_key: str) -> str:
    raw = f"{category}::{alias_key}"
    digest = hashlib.sha1(raw.encode("utf-8")).hexdigest()[:24]
    return f"inga-{digest}"


def _build_ingredient_alias_keys(alias_name: str) -> list[str]:
    value = str(alias_name or "").strip()
    if not value:
        return []
    keys: list[str] = []
    base_key = _normalize_ingredient_key(value)
    if base_key:
        keys.append(f"cn::{base_key}")
    en_key = _normalize_ingredient_en_key(value)
    if en_key:
        keys.append(f"en::{en_key}")
    out: list[str] = []
    seen: set[str] = set()
    for key in keys:
        if key in seen:
            continue
        seen.add(key)
        out.append(key[:240])
    return out


def _upsert_ingredient_redirect(
    *,
    db: Session,
    category: str,
    old_ingredient_id: str,
    new_ingredient_id: str,
    reason: str,
) -> None:
    old_id = str(old_ingredient_id or "").strip().lower()
    new_id = str(new_ingredient_id or "").strip().lower()
    if not old_id or not new_id or old_id == new_id:
        return
    rec = db.get(IngredientLibraryRedirect, old_id)
    now = now_iso()
    if rec is None:
        rec = IngredientLibraryRedirect(
            old_ingredient_id=old_id,
            category=str(category or "").strip().lower(),
            new_ingredient_id=new_id,
            reason=str(reason or "").strip() or "alias remap",
            created_at=now,
            updated_at=now,
        )
    else:
        rec.category = str(category or "").strip().lower()
        rec.new_ingredient_id = new_id
        rec.reason = str(reason or "").strip() or rec.reason
        rec.updated_at = now
    db.add(rec)


def _upsert_ingredient_aliases(
    *,
    db: Session,
    category: str,
    ingredient_id: str,
    alias_names: list[str],
    resolver: str,
) -> None:
    normalized_category = str(category or "").strip().lower()
    target_id = str(ingredient_id or "").strip().lower()
    if not normalized_category or not target_id:
        return
    _ensure_ingredient_alias_tables(db)

    key_to_alias_name: dict[str, str] = {}
    for raw in alias_names:
        alias_name = str(raw or "").strip()
        if not alias_name:
            continue
        for alias_key in _build_ingredient_alias_keys(alias_name):
            if alias_key not in key_to_alias_name:
                key_to_alias_name[alias_key] = alias_name
    if not key_to_alias_name:
        return

    existing_rows = db.execute(
        select(IngredientLibraryAlias)
        .where(IngredientLibraryAlias.category == normalized_category)
        .where(IngredientLibraryAlias.alias_key.in_(list(key_to_alias_name.keys())))
    ).scalars().all()
    existing_map = {str(row.alias_key): row for row in existing_rows}
    now = now_iso()
    redirected_old_ids: set[str] = set()

    for alias_key, alias_name in key_to_alias_name.items():
        row = existing_map.get(alias_key)
        existing_target_id = str(row.ingredient_id or "").strip().lower() if row is not None else ""
        if row is not None and existing_target_id != target_id and existing_target_id not in redirected_old_ids:
            _upsert_ingredient_redirect(
                db=db,
                category=normalized_category,
                old_ingredient_id=existing_target_id,
                new_ingredient_id=target_id,
                reason=f"alias_key={alias_key}",
            )
            redirected_old_ids.add(existing_target_id)

        if row is None:
            row = IngredientLibraryAlias(
                alias_id=_build_ingredient_alias_id(category=normalized_category, alias_key=alias_key),
                category=normalized_category,
                alias_key=alias_key,
                alias_name=alias_name,
                ingredient_id=target_id,
                confidence=100,
                resolver=str(resolver or "").strip() or None,
                created_at=now,
                updated_at=now,
            )
        else:
            row.alias_name = alias_name
            row.ingredient_id = target_id
            row.confidence = 100
            row.resolver = str(resolver or "").strip() or row.resolver
            row.updated_at = now
        db.add(row)


def _resolve_ingredient_id_redirect(
    *,
    db: Session,
    category: str,
    ingredient_id: str,
) -> str:
    current = str(ingredient_id or "").strip().lower()
    if not current:
        return current
    normalized_category = str(category or "").strip().lower()
    seen: set[str] = set()
    for _ in range(4):
        if current in seen:
            break
        seen.add(current)
        row = db.get(IngredientLibraryRedirect, current)
        if row is None:
            break
        if str(row.category or "").strip().lower() != normalized_category:
            break
        target = str(row.new_ingredient_id or "").strip().lower()
        if not target or target == current:
            break
        current = target
    return current


def _ensure_ingredient_index_table(db: Session) -> None:
    bind = db.get_bind()
    IngredientLibraryIndex.__table__.create(bind=bind, checkfirst=True)


def _ensure_ingredient_alias_tables(db: Session) -> None:
    bind = db.get_bind()
    IngredientLibraryAlias.__table__.create(bind=bind, checkfirst=True)
    IngredientLibraryRedirect.__table__.create(bind=bind, checkfirst=True)


def _ensure_ingredient_build_job_table(db: Session) -> None:
    bind = db.get_bind()
    IngredientLibraryBuildJob.__table__.create(bind=bind, checkfirst=True)


def _ensure_product_route_mapping_index_table(db: Session) -> None:
    bind = db.get_bind()
    ProductRouteMappingIndex.__table__.create(bind=bind, checkfirst=True)


def _load_ingredient_index_map(db: Session, ingredient_ids: list[str]) -> dict[str, IngredientLibraryIndex]:
    ids = [str(item or "").strip() for item in ingredient_ids if str(item or "").strip()]
    if not ids:
        return {}
    out: dict[str, IngredientLibraryIndex] = {}
    chunk_size = 500
    for idx in range(0, len(ids), chunk_size):
        chunk = ids[idx : idx + chunk_size]
        rows = db.execute(
            select(IngredientLibraryIndex).where(IngredientLibraryIndex.ingredient_id.in_(chunk))
        ).scalars().all()
        for row in rows:
            out[str(row.ingredient_id)] = row
    return out


def _upsert_ingredient_index_from_scan(
    *,
    existing: IngredientLibraryIndex | None,
    category: str,
    ingredient_id: str,
    ingredient_name: str,
    ingredient_key: str,
    source_trace_ids: list[str],
) -> IngredientLibraryIndex:
    now = now_iso()
    rec = existing
    if rec is None:
        rec = IngredientLibraryIndex(
            ingredient_id=ingredient_id,
            category=category,
            ingredient_name=ingredient_name,
            ingredient_key=ingredient_key,
            status="pending",
            storage_path=None,
            model=None,
            source_trace_ids_json="[]",
            hit_count=0,
            first_seen_at=now,
            last_seen_at=now,
            last_generated_at=None,
            last_error=None,
        )
    else:
        rec.category = category
        rec.ingredient_name = ingredient_name
        rec.ingredient_key = ingredient_key
        if not str(rec.first_seen_at or "").strip():
            rec.first_seen_at = now
        rec.last_seen_at = now

    merged_trace_ids = _merge_unique_trace_ids(
        _parse_trace_ids_json(rec.source_trace_ids_json),
        source_trace_ids,
    )
    rec.source_trace_ids_json = json.dumps(merged_trace_ids, ensure_ascii=False)
    rec.hit_count = len(merged_trace_ids)
    return rec


def _backfill_ingredient_index_from_storage(db: Session, category: str | None) -> int:
    rel_paths = _iter_ingredient_profile_rel_paths(category=category)
    if not rel_paths:
        return 0

    _ensure_ingredient_alias_tables(db)
    docs: list[tuple[str, dict[str, Any]]] = []
    ingredient_ids: list[str] = []
    for rel_path in rel_paths:
        doc = _load_ingredient_profile_doc(rel_path=rel_path)
        ingredient_id = _required_text_field(doc, "id")
        ingredient_ids.append(ingredient_id)
        docs.append((rel_path, doc))

    index_map = _load_ingredient_index_map(db=db, ingredient_ids=ingredient_ids)
    touched = 0

    for rel_path, doc in docs:
        ingredient_id = _required_text_field(doc, "id")
        category_name = _required_text_field(doc, "category").lower()
        if category_name not in VALID_CATEGORIES:
            raise HTTPException(status_code=500, detail=f"Invalid category in ingredient profile: {category_name}.")
        ingredient_name = _required_text_field(doc, "ingredient_name")
        ingredient_key = str(doc.get("ingredient_key") or "").strip() or _normalize_ingredient_key(ingredient_name)
        source_trace_ids = _strict_str_list(doc.get("source_trace_ids"), field_name="source_trace_ids")
        generated_at = str(doc.get("generated_at") or "").strip() or now_iso()

        generator = doc.get("generator")
        if generator is None:
            generator = {}
        if not isinstance(generator, dict):
            raise HTTPException(status_code=500, detail=f"Invalid generator format in ingredient profile: {rel_path}.")
        model = str(generator.get("model") or "").strip() or None

        existing = index_map.get(ingredient_id)
        rec = _upsert_ingredient_index_from_scan(
            existing=existing,
            category=category_name,
            ingredient_id=ingredient_id,
            ingredient_name=ingredient_name,
            ingredient_key=ingredient_key,
            source_trace_ids=source_trace_ids,
        )
        rec.status = "ready"
        rec.storage_path = rel_path
        rec.model = model
        rec.last_generated_at = generated_at
        rec.last_error = None
        if not str(rec.first_seen_at or "").strip():
            rec.first_seen_at = generated_at
        db.add(rec)
        index_map[ingredient_id] = rec
        alias_names = [ingredient_name]
        ingredient_name_en = str(doc.get("ingredient_name_en") or "").strip()
        if ingredient_name_en:
            alias_names.append(ingredient_name_en)
        for sample in doc.get("source_samples") or []:
            if not isinstance(sample, dict):
                continue
            sample_ing = sample.get("ingredient")
            if isinstance(sample_ing, dict):
                sample_name = str(sample_ing.get("name") or "").strip()
                if sample_name:
                    alias_names.append(sample_name)
                sample_name_en = str(sample_ing.get("name_en") or sample_ing.get("inci") or "").strip()
                if sample_name_en:
                    alias_names.append(sample_name_en)
        _upsert_ingredient_aliases(
            db=db,
            category=category_name,
            ingredient_id=ingredient_id,
            alias_names=alias_names,
            resolver="storage_backfill",
        )
        touched += 1

    if touched:
        db.commit()
    return touched


def _parse_trace_ids_json(value: str | None) -> list[str]:
    raw = str(value or "").strip()
    if not raw:
        return []
    try:
        parsed = json.loads(raw)
    except Exception:
        return []
    if not isinstance(parsed, list):
        return []
    out: list[str] = []
    for item in parsed:
        text = str(item or "").strip()
        if not text:
            continue
        out.append(text)
    return list(dict.fromkeys(out))


def _merge_unique_trace_ids(left: list[str], right: list[str]) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()
    for item in [*left, *right]:
        text = str(item or "").strip()
        if not text or text in seen:
            continue
        seen.add(text)
        out.append(text)
    return out


def _emit_progress(event_callback: Callable[[dict[str, Any]], None] | None, payload: dict[str, Any]) -> None:
    if not event_callback:
        return
    try:
        event_callback(payload)
    except Exception:
        return


def _sse_iter(events: queue.Queue[tuple[str, dict[str, Any]] | None]):
    while True:
        try:
            item = events.get(timeout=2)
        except queue.Empty:
            yield ": keep-alive\n\n"
            continue
        if item is None:
            break
        event, payload = item
        yield f"event: {event}\ndata: {json.dumps(payload, ensure_ascii=False)}\n\n"


def _normalize_tags(tags: list[str]) -> list[str]:
    out: list[str] = []
    seen = set()
    for raw in tags:
        item = str(raw).strip()
        if not item or item in seen:
            continue
        seen.add(item)
        out.append(item)
        if len(out) >= 20:
            break
    return out

def _row_to_card(r: ProductIndex) -> ProductCard:
    try:
        tags = json.loads(r.tags_json or "[]")
        if not isinstance(tags, list):
            tags = []
    except json.JSONDecodeError:
        tags = []

    preferred_image_rel = preferred_image_rel_path(str(r.image_path or "").strip())
    return ProductCard(
        id=r.id,
        category=r.category,
        brand=r.brand,
        name=r.name,
        one_sentence=r.one_sentence,
        tags=tags,
        image_url=f"/{preferred_image_rel}" if preferred_image_rel else None,
        created_at=r.created_at,
    )
