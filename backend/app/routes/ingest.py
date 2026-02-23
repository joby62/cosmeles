import json
from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.db.models import ProductIndex
from app.services.storage import new_id, now_iso, save_image, save_product_json
from app.services.doubao_client import DoubaoClient
from app.services.parser import normalize_doc

router = APIRouter(prefix="/api", tags=["ingest"])

@router.post("/ingest")
async def ingest(
    image: UploadFile = File(...),
    category: str = Form("shampoo"),
    brand: str | None = Form(None),
    name: str | None = Form(None),
    db: Session = Depends(get_db),
):
    if not image.content_type or not image.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Only image upload is supported.")

    product_id = new_id()
    content = await image.read()
    image_rel = save_image(product_id, image.filename, content)

    # 1) call doubao (mock/real)
    client = DoubaoClient()
    doc = client.analyze(image_rel)

    # 2) allow override minimal product fields
    doc.setdefault("product", {})
    doc["product"]["category"] = category or doc["product"].get("category") or "shampoo"
    if brand:
        doc["product"]["brand"] = brand
    if name:
        doc["product"]["name"] = name

    # 3) normalize + validate
    normalized = normalize_doc(doc, image_rel_path=image_rel, doubao_raw=doc.get("evidence", {}).get("doubao_raw"))

    # 4) save json
    json_rel = save_product_json(product_id, normalized)

    # 5) index into sqlite
    one_sentence = normalized.get("summary", {}).get("one_sentence")
    tags = _derive_tags(normalized)

    rec = ProductIndex(
        id=product_id,
        category=normalized["product"]["category"],
        brand=normalized["product"].get("brand"),
        name=normalized["product"].get("name"),
        one_sentence=one_sentence,
        tags_json=json.dumps(tags, ensure_ascii=False),
        image_path=image_rel,
        json_path=json_rel,
        created_at=now_iso(),
    )
    db.add(rec)
    db.commit()

    return {"id": product_id, "status": "ok"}

def _derive_tags(doc: dict) -> list[str]:
    """
    MVP：非常朴素的标签提取。
    后面你可以把 tags 作为豆包输出的字段，或用更稳定的规则/词典。
    """
    tags: list[str] = []
    one = (doc.get("summary") or {}).get("one_sentence") or ""
    if "氨基酸" in one and "非" in one:
        tags.append("非氨基酸")
    if "SLES" in one or "硫酸盐" in one:
        tags.append("含硫酸盐表活")
    if "蓬松" in one:
        tags.append("蓬松")
    if "香精" in one:
        tags.append("含香精")
    return tags[:6]
