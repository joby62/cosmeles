import json
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select, func

from app.constants import VALID_CATEGORIES
from app.db.session import get_db
from app.db.models import ProductIndex
from app.services.storage import load_json, save_json_at, exists_rel_path, remove_rel_path
from app.schemas import ProductCard, ProductListResponse, ProductListMeta, CategoryCount, ProductUpdateRequest

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
