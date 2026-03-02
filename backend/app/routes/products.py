import json
import queue
import threading
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
from app.db.models import ProductIndex
from app.services.storage import load_json, save_json_at, exists_rel_path, remove_rel_path, remove_rel_dir
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
    if remove_rel_path(rec.image_path):
        removed += 1

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
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no"},
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
        if remove_rel_path(rec.image_path):
            removed_files += 1
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
    batch_size = int(payload.compare_batch_size or payload.max_compare_per_product or 20)
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
                ai_input = {
                    "anchor_product": _compact_product_for_dedup(anchor),
                    "candidate_products": [_compact_product_for_dedup(item) for item in chunk],
                }
                try:
                    ai_result = run_capability_now(
                        capability="doubao.product_dedup_group",
                        input_payload=ai_input,
                        trace_id=f"dedup-{anchor_id}",
                        event_callback=lambda e, _cat=cat, _anchor=anchor_id: _emit_progress(
                            event_callback,
                            {"step": "dedup_model_event", "category": _cat, "anchor_id": _anchor, **e},
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
                except Exception as e:
                    failures.append(f"{anchor_id}: {e}")
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

    row_by_id = {str(item["row"].id): item["row"] for item in filtered}
    suggestions = _build_suggestions_from_relations(relations=directed_relations, row_by_id=row_by_id)
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

    analysis_text = str(ai_result.get("analysis_text") or "").strip()
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
    row_by_id: dict[str, ProductIndex],
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

        keep_id = _pick_keep_id(component, comp_relations, row_by_id)
        remove_ids = sorted(
            [pid for pid in component if pid != keep_id],
            key=lambda pid: (str(getattr(row_by_id.get(pid), "created_at", "") or ""), pid),
            reverse=True,
        )

        max_confidence = max(max(0, min(100, int(rel.get("confidence") or 0))) for rel in comp_relations)
        reason = _component_reason(comp_relations)
        analysis_text = _component_analysis_text(comp_relations)
        compared_ids = sorted(
            component,
            key=lambda pid: (str(getattr(row_by_id.get(pid), "created_at", "") or ""), pid),
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
    row_by_id: dict[str, ProductIndex],
) -> str:
    incoming: dict[str, int] = defaultdict(int)
    outgoing: dict[str, int] = defaultdict(int)
    for rel in comp_relations:
        keep_id = str(rel.get("keep_id") or "").strip()
        remove_id = str(rel.get("remove_id") or "").strip()
        confidence = max(0, min(100, int(rel.get("confidence") or 0)))
        incoming[keep_id] += confidence
        outgoing[remove_id] += confidence

    ranked = sorted(
        component,
        key=lambda pid: (
            -incoming.get(pid, 0),
            outgoing.get(pid, 0),
            str(getattr(row_by_id.get(pid), "created_at", "") or ""),
            pid,
        ),
    )
    return ranked[0]


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
            item = events.get(timeout=10)
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
