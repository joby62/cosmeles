import json
import queue
import threading
import hashlib
from pathlib import Path
from collections import defaultdict
from typing import Any, Callable

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select, func
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import sessionmaker

from app.ai.orchestrator import run_capability_now
from app.constants import VALID_CATEGORIES
from app.db.session import get_db
from app.db.models import ProductIndex, IngredientLibraryIndex
from app.settings import settings
from app.services.storage import (
    load_json,
    save_json_at,
    now_iso,
    save_ingredient_profile,
    ingredient_profile_rel_path,
    exists_rel_path,
    remove_rel_path,
    remove_rel_dir,
    remove_product_images,
    cleanup_orphan_storage,
)
from app.schemas import (
    ProductCard,
    ProductListResponse,
    ProductListMeta,
    CategoryCount,
    ProductUpdateRequest,
    ProductDedupSuggestRequest,
    ProductDedupSuggestResponse,
    ProductDedupSuggestion,
    ProductBatchDeleteRequest,
    ProductBatchDeleteResponse,
    OrphanStorageCleanupRequest,
    OrphanStorageCleanupResponse,
    IngredientLibraryBuildRequest,
    IngredientLibraryBuildResponse,
    IngredientLibraryBuildItem,
    IngredientLibraryListResponse,
    IngredientLibraryListItem,
    IngredientLibrarySourceSample,
    IngredientLibraryProfile,
    IngredientLibraryDetailItem,
    IngredientLibraryDetailResponse,
)

router = APIRouter(prefix="/api", tags=["products"])

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
    return load_json(rec.json_path)

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
def get_ingredient_library_item(category: str, ingredient_id: str):
    normalized_category = _normalize_required_category(category)
    normalized_ingredient_id = str(ingredient_id or "").strip().lower()
    if not normalized_ingredient_id:
        raise HTTPException(status_code=400, detail="ingredient_id is required.")

    rel_path = ingredient_profile_rel_path(normalized_category, normalized_ingredient_id)
    if not exists_rel_path(rel_path):
        raise HTTPException(status_code=404, detail=f"Ingredient profile not found: {normalized_category}/{normalized_ingredient_id}.")

    try:
        doc = _load_ingredient_profile_doc(rel_path=rel_path)
        item = _to_ingredient_library_detail_item(doc=doc, rel_path=rel_path)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Invalid ingredient profile '{rel_path}': {e}") from e

    return IngredientLibraryDetailResponse(status="ok", item=item)


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

        db.delete(rec)
        deleted_ids.append(product_id)

    db.commit()
    return ProductBatchDeleteResponse(
        status="ok",
        deleted_ids=deleted_ids,
        skipped_ids=skipped_ids,
        missing_ids=missing_ids,
        removed_files=removed_files,
        removed_dirs=removed_dirs,
    )


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
        image_rel = str(image_path or "").strip().lstrip("/")
        if image_rel:
            keep_image_paths.add(image_rel)

    result = cleanup_orphan_storage(
        keep_product_ids=keep_product_ids,
        keep_image_paths=keep_image_paths,
        min_age_minutes=payload.min_age_minutes,
        dry_run=payload.dry_run,
        max_delete=payload.max_delete,
    )
    return OrphanStorageCleanupResponse.model_validate(result)


def _build_ingredient_library_impl(
    payload: IngredientLibraryBuildRequest,
    db: Session,
    event_callback: Callable[[dict[str, Any]], None] | None,
) -> IngredientLibraryBuildResponse:
    category = (payload.category or "").strip().lower()
    if category and category not in VALID_CATEGORIES:
        raise HTTPException(status_code=400, detail=f"Invalid category: {category}.")

    _ensure_ingredient_index_table(db)
    backfilled_from_storage = _backfill_ingredient_index_from_storage(db=db, category=category)

    stmt = select(ProductIndex).order_by(ProductIndex.created_at.desc())
    if category:
        stmt = stmt.where(ProductIndex.category == category)

    rows = db.execute(stmt).scalars().all()
    grouped = _collect_category_ingredients(
        rows=rows,
        max_sources_per_ingredient=int(payload.max_sources_per_ingredient),
    )
    grouped_items = sorted(grouped.values(), key=lambda item: (item["category"], item["ingredient_name"]))

    _emit_progress(
        event_callback,
        {
            "step": "ingredient_build_start",
            "scanned_products": len(rows),
            "unique_ingredients": len(grouped_items),
            "backfilled_from_storage": backfilled_from_storage,
            "text": (
                f"开始生成成分库：产品 {len(rows)} 条，唯一成分 {len(grouped_items)} 条，"
                f"历史回填 {backfilled_from_storage} 条。"
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
        ingredient_id = item["ingredient_id"]
        ingredient_name = item["ingredient_name"]
        category_name = item["category"]
        source_trace_ids = sorted(item["source_trace_ids"])
        source_count = len(source_trace_ids)

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
        if is_ready and exists_rel_path(ready_storage_path) and not force_regenerate:
            index_rec.storage_path = ready_storage_path
            skipped += 1
            build_item = IngredientLibraryBuildItem(
                ingredient_id=ingredient_id,
                category=category_name,
                ingredient_name=ingredient_name,
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
                    "category": category_name,
                    "index": idx,
                    "total": total,
                    "text": f"[{idx}/{total}] 跳过已存在成分：{category_name} / {ingredient_name}",
                },
            )
            continue

        submitted_to_model += 1
        _emit_progress(
            event_callback,
            {
                "step": "ingredient_start",
                "ingredient_id": ingredient_id,
                "category": category_name,
                "index": idx,
                "total": total,
                "text": f"[{idx}/{total}] 生成成分：{category_name} / {ingredient_name}",
            },
        )
        try:
            ai_result = run_capability_now(
                capability="doubao.ingredient_category_profile",
                input_payload={
                    "ingredient": ingredient_name,
                    "category": category_name,
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
            profile_doc = {
                "id": ingredient_id,
                "category": category_name,
                "ingredient_name": ingredient_name,
                "ingredient_key": item["ingredient_key"],
                "source_count": source_count,
                "source_trace_ids": source_trace_ids,
                "source_samples": item["source_samples"],
                "generated_at": now_iso(),
                "generator": {
                    "capability": "doubao.ingredient_category_profile",
                    "model": str(ai_result.get("model") or ""),
                    "prompt_key": "doubao.ingredient_category_profile",
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
            index_rec.storage_path = storage_path
            index_rec.model = str(ai_result.get("model") or "").strip() or None
            index_rec.last_generated_at = now_iso()
            index_rec.last_error = None
            db.add(index_rec)

            items.append(
                IngredientLibraryBuildItem(
                    ingredient_id=ingredient_id,
                    category=category_name,
                    ingredient_name=ingredient_name,
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
                    "category": category_name,
                    "index": idx,
                    "total": total,
                    "status": status,
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
                    "category": category_name,
                    "index": idx,
                    "total": total,
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

    _emit_progress(
        event_callback,
        {
            "step": "dedup_scan_start",
            "category": category or None,
            "scanned_products": len(filtered),
            "category_groups": len(grouped),
            "min_confidence": min_confidence,
            "batch_size": batch_size,
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
) -> dict[str, dict[str, Any]]:
    grouped: dict[str, dict[str, Any]] = {}
    max_sources = max(1, min(30, int(max_sources_per_ingredient)))

    for row in rows:
        if not exists_rel_path(row.json_path):
            continue
        try:
            doc = load_json(row.json_path)
        except Exception:
            continue

        row_category = str(getattr(row, "category", "") or "").strip().lower()
        doc_category = ""
        if isinstance(doc.get("product"), dict):
            doc_category = str((doc.get("product") or {}).get("category") or "").strip().lower()
        category = row_category or doc_category or "unknown"

        ingredients = doc.get("ingredients")
        if not isinstance(ingredients, list):
            continue

        for raw in ingredients:
            if isinstance(raw, dict):
                ingredient_name = str(raw.get("name") or "").strip()
            else:
                ingredient_name = str(raw or "").strip()
            if not ingredient_name:
                continue

            ingredient_key = _normalize_ingredient_key(ingredient_name)
            if not ingredient_key:
                continue

            ingredient_id = _build_ingredient_id(category=category, ingredient_key=ingredient_key)
            group_key = f"{category}::{ingredient_key}"
            item = grouped.get(group_key)
            if item is None:
                item = {
                    "ingredient_id": ingredient_id,
                    "ingredient_name": ingredient_name,
                    "ingredient_key": ingredient_key,
                    "category": category,
                    "source_trace_ids": set(),
                    "source_samples": [],
                }
                grouped[group_key] = item

            item["source_trace_ids"].add(str(row.id))
            if len(item["source_samples"]) < max_sources:
                item["source_samples"].append(
                    {
                        "trace_id": str(row.id),
                        "brand": str(row.brand or "").strip(),
                        "name": str(row.name or "").strip(),
                        "one_sentence": str(row.one_sentence or "").strip(),
                        "ingredient": raw if isinstance(raw, dict) else {"name": ingredient_name},
                    }
                )

    return grouped


def _normalize_ingredient_key(name: str) -> str:
    value = str(name or "").strip().lower()
    if not value:
        return ""
    compact = " ".join(value.split())
    return compact[:120]


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


def _to_ingredient_library_list_item(doc: dict[str, Any], rel_path: str) -> IngredientLibraryListItem:
    ingredient_id = _required_text_field(doc, "id")
    category = _required_text_field(doc, "category").lower()
    if category not in VALID_CATEGORIES:
        raise ValueError(f"invalid category in profile: {category}.")
    ingredient_name = _required_text_field(doc, "ingredient_name")
    source_trace_ids = _strict_str_list(doc.get("source_trace_ids"), field_name="source_trace_ids")
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
        summary=summary,
        source_count=source_count,
        source_trace_ids=source_trace_ids,
        generated_at=generated_at,
        storage_path=rel_path,
    )


def _to_ingredient_library_detail_item(doc: dict[str, Any], rel_path: str) -> IngredientLibraryDetailItem:
    base = _to_ingredient_library_list_item(doc=doc, rel_path=rel_path)
    ingredient_key = str(doc.get("ingredient_key") or "").strip() or None

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
        ingredient_key=ingredient_key,
        source_count=base.source_count,
        source_trace_ids=base.source_trace_ids,
        source_samples=source_samples,
        generated_at=base.generated_at,
        generator=generator,
        profile=profile,
        storage_path=base.storage_path,
    )


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


def _ensure_ingredient_index_table(db: Session) -> None:
    bind = db.get_bind()
    IngredientLibraryIndex.__table__.create(bind=bind, checkfirst=True)


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

    return ProductCard(
        id=r.id,
        category=r.category,
        brand=r.brand,
        name=r.name,
        one_sentence=r.one_sentence,
        tags=tags,
        image_url=f"/{r.image_path}" if r.image_path else None,
        created_at=r.created_at,
    )
