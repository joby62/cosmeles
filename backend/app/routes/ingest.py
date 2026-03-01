import json
from typing import Any
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
    image: UploadFile | None = File(None),
    file: UploadFile | None = File(None),
    meta_json: str | None = Form(None),
    payload_json: str | None = Form(None),
    category: str = Form("shampoo"),
    brand: str | None = Form(None),
    name: str | None = Form(None),
    source: str = Form("manual"),  # manual | doubao | auto
    db: Session = Depends(get_db),
):
    upload = image or file

    if upload is None and not meta_json and not payload_json:
        raise HTTPException(status_code=400, detail="Please provide image/file or meta_json/payload_json.")

    if upload and (not upload.content_type or not upload.content_type.startswith("image/")):
        raise HTTPException(status_code=400, detail="Only image upload is supported.")

    product_id = new_id()
    image_rel = None
    if upload:
        content = await upload.read()
        image_rel = save_image(product_id, upload.filename or "upload.jpg", content)

    # 1) choose document source
    meta_raw = meta_json or payload_json
    if meta_raw:
        doc = _parse_meta_json(meta_raw)
        ingest_mode = "manual_json"
    elif source.lower() in {"doubao", "auto"}:
        if not image_rel:
            raise HTTPException(status_code=400, detail="source=doubao requires image/file.")
        client = DoubaoClient()
        doc = client.analyze(image_rel)
        ingest_mode = "doubao"
    else:
        # manual upload without JSON: still allow, use doubao mock/real to bootstrap.
        if not image_rel:
            raise HTTPException(status_code=400, detail="manual upload without JSON still requires image/file.")
        client = DoubaoClient()
        doc = client.analyze(image_rel)
        ingest_mode = "manual_image_bootstrap"

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

    return {
        "id": product_id,
        "status": "ok",
        "mode": ingest_mode,
        "category": normalized["product"]["category"],
        "image_path": image_rel,
        "json_path": json_rel,
    }

def _parse_meta_json(raw: str) -> dict[str, Any]:
    try:
        doc = json.loads(raw)
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=400, detail=f"Invalid meta_json/payload_json: {e.msg}") from e

    if not isinstance(doc, dict):
        raise HTTPException(status_code=400, detail="meta_json/payload_json must be a JSON object.")

    return _to_product_doc_shape(doc)

def _to_product_doc_shape(doc: dict[str, Any]) -> dict[str, Any]:
    # Already in target shape
    if "product" in doc and "summary" in doc:
        return doc

    product = {
        "category": doc.get("category") or "shampoo",
        "brand": doc.get("brand"),
        "name": doc.get("name"),
    }

    summary_in = doc.get("summary")
    if isinstance(summary_in, dict):
        summary = {
            "one_sentence": summary_in.get("one_sentence") or summary_in.get("oneSentence") or _fallback_summary(product),
            "pros": _to_str_list(summary_in.get("pros")),
            "cons": _to_str_list(summary_in.get("cons")),
            "who_for": _to_str_list(summary_in.get("who_for") or summary_in.get("whoFor")),
            "who_not_for": _to_str_list(summary_in.get("who_not_for") or summary_in.get("whoNotFor")),
        }
    else:
        summary = {
            "one_sentence": str(doc.get("one_sentence") or doc.get("oneSentence") or _fallback_summary(product)),
            "pros": _to_str_list(doc.get("pros")),
            "cons": _to_str_list(doc.get("cons")),
            "who_for": _to_str_list(doc.get("who_for") or doc.get("whoFor")),
            "who_not_for": _to_str_list(doc.get("who_not_for") or doc.get("whoNotFor")),
        }

    ingredients_raw = doc.get("ingredients")
    ingredients = []
    if isinstance(ingredients_raw, list):
        for item in ingredients_raw:
            if not isinstance(item, dict):
                continue
            risk = str(item.get("risk") or "low").lower()
            if risk not in {"low", "mid", "high"}:
                risk = "low"
            ingredients.append(
                {
                    "name": str(item.get("name") or "").strip(),
                    "type": str(item.get("type") or "未分类"),
                    "functions": _to_str_list(item.get("functions")),
                    "risk": risk,
                    "notes": str(item.get("notes") or ""),
                }
            )

    evidence_in = doc.get("evidence") if isinstance(doc.get("evidence"), dict) else {}
    evidence = {
        "image_path": evidence_in.get("image_path"),
        "doubao_raw": evidence_in.get("doubao_raw"),
    }

    return {
        "product": product,
        "summary": summary,
        "ingredients": ingredients,
        "evidence": evidence,
    }

def _to_str_list(v: Any) -> list[str]:
    if v is None:
        return []
    if isinstance(v, list):
        return [str(x) for x in v if str(x).strip()]
    s = str(v).strip()
    return [s] if s else []

def _fallback_summary(product: dict[str, Any]) -> str:
    brand = product.get("brand") or "该产品"
    name = product.get("name") or ""
    full = f"{brand} {name}".strip()
    return f"{full} 已完成入库，可在前端结果页用于展示成分与用法。"

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
