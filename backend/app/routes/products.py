import json
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.db.session import get_db
from app.db.models import ProductIndex
from app.services.storage import load_json
from app.schemas import ProductCard

router = APIRouter(prefix="/api", tags=["products"])

@router.get("/products", response_model=list[ProductCard])
def list_products(
    category: str | None = Query(None),
    q: str | None = Query(None, description="search brand/name contains"),
    db: Session = Depends(get_db),
):
    stmt = select(ProductIndex)
    if category:
        stmt = stmt.where(ProductIndex.category == category)
    if q:
        like = f"%{q}%"
        stmt = stmt.where((ProductIndex.name.like(like)) | (ProductIndex.brand.like(like)))

    stmt = stmt.order_by(ProductIndex.created_at.desc())
    rows = db.execute(stmt).scalars().all()

    cards: list[ProductCard] = []
    for r in rows:
        cards.append(ProductCard(
            id=r.id,
            category=r.category,
            brand=r.brand,
            name=r.name,
            one_sentence=r.one_sentence,
            tags=json.loads(r.tags_json or "[]"),
            image_url=f"/{r.image_path}" if r.image_path else None,
            created_at=r.created_at,
        ))
    return cards

@router.get("/products/{product_id}")
def get_product(product_id: str, db: Session = Depends(get_db)):
    rec = db.get(ProductIndex, product_id)
    if not rec:
        raise HTTPException(status_code=404, detail="Not found")
    return load_json(rec.json_path)
