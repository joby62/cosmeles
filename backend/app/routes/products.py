import json
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select, func

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
    rows = db.execute(select(ProductIndex).order_by(ProductIndex.created_at.desc())).scalars().all()
    docs: list[dict] = []
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

    suggestions: list[ProductDedupSuggestion] = []
    involved_ids: set[str] = set()
    failures: list[str] = []
    visited_ids: set[str] = set()

    for anchor in filtered:
        anchor_id = anchor["row"].id
        if anchor_id in visited_ids:
            continue
        candidates = _pick_similar_candidates(anchor, filtered, payload.max_compare_per_product)
        if not candidates:
            continue

        ai_input = {
            "anchor_product": _compact_product_for_dedup(anchor),
            "candidate_products": [_compact_product_for_dedup(item) for item in candidates],
        }
        trace_id = f"dedup-{anchor_id}"
        try:
            ai_result = run_capability_now(
                capability="doubao.product_dedup_group",
                input_payload=ai_input,
                trace_id=trace_id,
            )
        except Exception as e:
            failures.append(f"{anchor_id}: {e}")
            continue

        duplicates_raw = ai_result.get("duplicates")
        if not isinstance(duplicates_raw, list):
            failures.append(f"{anchor_id}: invalid dedup output (duplicates).")
            continue

        keep_id = str(ai_result.get("keep_id") or "").strip()
        reason = str(ai_result.get("reason") or "").strip()
        analysis_text = str(ai_result.get("analysis_text") or "").strip()
        if not keep_id:
            failures.append(f"{anchor_id}: invalid dedup output (keep_id).")
            continue

        remove_ids: list[str] = []
        max_confidence = 0
        for item in duplicates_raw:
            if not isinstance(item, dict):
                continue
            pid = str(item.get("id") or "").strip()
            if not pid or pid == keep_id:
                continue
            try:
                confidence = int(item.get("confidence"))
            except Exception:
                confidence = 0
            confidence = max(0, min(100, confidence))
            if confidence < payload.min_confidence:
                continue
            remove_ids.append(pid)
            if confidence > max_confidence:
                max_confidence = confidence

        remove_ids = list(dict.fromkeys(remove_ids))
        if not remove_ids:
            continue

        group_members = [keep_id, *remove_ids]
        visited_ids.update(group_members)
        involved_ids.update(group_members)

        suggestions.append(
            ProductDedupSuggestion(
                group_id=f"group-{len(suggestions) + 1}",
                keep_id=keep_id,
                remove_ids=remove_ids,
                confidence=max_confidence,
                reason=reason,
                analysis_text=analysis_text or None,
                compared_ids=[anchor_id, *[c["row"].id for c in candidates]],
            )
        )

    involved_rows = [item["row"] for item in filtered if item["row"].id in involved_ids]
    return ProductDedupSuggestResponse(
        status="ok",
        scanned_products=len(filtered),
        suggestions=suggestions,
        involved_products=[_row_to_card(row) for row in involved_rows],
        failures=failures[:20],
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


def _pick_similar_candidates(anchor: dict, all_items: list[dict], max_count: int) -> list[dict]:
    anchor_row = anchor["row"]
    scored: list[tuple[float, dict]] = []
    for item in all_items:
        row = item["row"]
        if row.id == anchor_row.id:
            continue
        score = _similarity_score(anchor, item)
        if score < 0.2:
            continue
        scored.append((score, item))
    scored.sort(key=lambda pair: pair[0], reverse=True)
    return [item for _, item in scored[:max_count]]


def _similarity_score(a: dict, b: dict) -> float:
    a_row, b_row = a["row"], b["row"]
    if a_row.category != b_row.category:
        return 0.0

    score = 0.15
    a_brand = (a_row.brand or "").strip().lower()
    b_brand = (b_row.brand or "").strip().lower()
    if a_brand and b_brand and a_brand == b_brand:
        score += 0.25

    a_name = _token_set(a_row.name or "")
    b_name = _token_set(b_row.name or "")
    score += _jaccard(a_name, b_name) * 0.35

    a_ings = set(_ingredient_names(a["doc"]))
    b_ings = set(_ingredient_names(b["doc"]))
    score += _jaccard(a_ings, b_ings) * 0.25

    a_desc = (a_row.one_sentence or "").strip().lower()
    b_desc = (b_row.one_sentence or "").strip().lower()
    if a_desc and b_desc and (a_desc in b_desc or b_desc in a_desc):
        score += 0.1

    return min(score, 1.0)


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


def _token_set(text: str) -> set[str]:
    value = str(text or "").strip().lower()
    if not value:
        return set()
    for ch in ("-", "_", "/", ",", ".", "（", "）", "(", ")", "·"):
        value = value.replace(ch, " ")
    return {token for token in value.split() if token}


def _jaccard(a: set[str], b: set[str]) -> float:
    if not a or not b:
        return 0.0
    inter = len(a & b)
    union = len(a | b)
    if union == 0:
        return 0.0
    return inter / union


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
