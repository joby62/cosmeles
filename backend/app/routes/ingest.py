import json
from typing import Any
from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException, Query
from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.ai.errors import AIServiceError
from app.constants import VALID_CATEGORIES, VALID_SOURCES
from app.db.session import get_db
from app.db.models import ProductIndex
from app.services.storage import (
    cleanup_doubao_artifacts,
    exists_rel_path,
    load_json,
    new_id,
    now_iso,
    save_doubao_artifact,
    save_image,
    save_product_json,
    remove_rel_path,
)
from app.services.doubao_pipeline_service import DoubaoPipelineService
from app.services.parser import normalize_doc
from app.settings import settings

router = APIRouter(prefix="/api", tags=["ingest"])

@router.post("/ingest")
@router.post("/upload")
async def ingest(
    image: UploadFile | None = File(None),
    file: UploadFile | None = File(None),
    meta_json: str | None = Form(None),
    payload_json: str | None = Form(None),
    category: str | None = Form(None),
    brand: str | None = Form(None),
    name: str | None = Form(None),
    source: str = Form("doubao"),  # manual | doubao | auto
    db: Session = Depends(get_db),
):
    if image and file:
        raise HTTPException(status_code=400, detail="Please provide only one file field: image or file.")

    upload = image or file
    normalized_source = (source or "manual").strip().lower()
    if normalized_source not in VALID_SOURCES:
        raise HTTPException(status_code=400, detail=f"Invalid source: {source}.")

    category_override = _normalize_optional_text(category, lower=True)
    if category_override and category_override not in VALID_CATEGORIES:
        raise HTTPException(status_code=400, detail=f"Invalid category: {category_override}.")

    if upload is None and not meta_json and not payload_json:
        raise HTTPException(status_code=400, detail="Please provide image/file or meta_json/payload_json.")

    if upload and (not upload.content_type or not upload.content_type.startswith("image/")):
        raise HTTPException(status_code=400, detail="Only image upload is supported.")

    product_id = new_id()
    image_rel = None
    if upload:
        content = await upload.read()
        if len(content) > settings.max_upload_bytes:
            raise HTTPException(status_code=413, detail=f"Image too large. Max {settings.max_upload_bytes} bytes.")
        image_rel = save_image(product_id, upload.filename or "upload.jpg", content)

    # 1) choose document source
    meta_raw = meta_json or payload_json
    if meta_raw:
        doc = _parse_meta_json(meta_raw)
        ingest_mode = "manual_json"
    elif normalized_source in {"doubao", "auto"}:
        if not image_rel:
            raise HTTPException(status_code=400, detail="source=doubao requires image/file.")
        doc = _analyze_with_doubao(image_rel, product_id)
        ingest_mode = "doubao"
    else:
        # manual upload without JSON: still allow, use doubao mock/real to bootstrap.
        if not image_rel:
            raise HTTPException(status_code=400, detail="manual upload without JSON still requires image/file.")
        doc = _analyze_with_doubao(image_rel, product_id)
        ingest_mode = "manual_image_bootstrap"

    # 2) allow override minimal product fields
    _apply_product_overrides(
        doc,
        category=category_override,
        brand=_normalize_optional_text(brand),
        name=_normalize_optional_text(name),
    )

    # 3) normalize + validate
    normalized = _normalize_with_error_reporting(doc, image_rel=image_rel)

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
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        remove_rel_path(json_rel)
        remove_rel_path(image_rel)
        raise HTTPException(status_code=500, detail=f"Failed to persist product index: {e}") from e

    return {
        "id": product_id,
        "status": "ok",
        "mode": ingest_mode,
        "category": normalized["product"]["category"],
        "image_path": image_rel,
        "json_path": json_rel,
        "doubao": _extract_doubao_preview(normalized),
        "endpoint": "/api/upload",
    }


@router.post("/upload/stage1")
async def ingest_stage1(
    image: UploadFile | None = File(None),
    file: UploadFile | None = File(None),
    category: str | None = Form(None),
    brand: str | None = Form(None),
    name: str | None = Form(None),
):
    if image and file:
        raise HTTPException(status_code=400, detail="Please provide only one file field: image or file.")

    upload = image or file
    if upload is None:
        raise HTTPException(status_code=400, detail="stage1 requires image/file.")
    if not upload.content_type or not upload.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Only image upload is supported.")

    category_override = _normalize_optional_text(category, lower=True)
    if category_override and category_override not in VALID_CATEGORIES:
        raise HTTPException(status_code=400, detail=f"Invalid category: {category_override}.")

    product_id = new_id()
    content = await upload.read()
    if len(content) > settings.max_upload_bytes:
        raise HTTPException(status_code=413, detail=f"Image too large. Max {settings.max_upload_bytes} bytes.")
    image_rel = save_image(product_id, upload.filename or "upload.jpg", content)

    try:
        stage1 = _analyze_with_doubao_stage1(image_rel, product_id)
    except HTTPException:
        remove_rel_path(image_rel)
        raise
    except Exception as e:
        remove_rel_path(image_rel)
        raise HTTPException(status_code=500, detail=f"Stage1 failed: {e}") from e
    context = {
        "trace_id": product_id,
        "image_path": image_rel,
        "category": category_override,
        "brand": _normalize_optional_text(brand),
        "name": _normalize_optional_text(name),
        "vision_text": stage1["vision_text"],
        "vision_model": stage1["model"],
        "vision_artifact": stage1.get("artifact"),
        "created_at": now_iso(),
    }
    try:
        context_rel = save_doubao_artifact(product_id, "stage1_context", context)
    except Exception as e:
        remove_rel_path(stage1.get("artifact"))
        remove_rel_path(image_rel)
        raise HTTPException(status_code=500, detail=f"Stage1 context persistence failed: {e}") from e

    return {
        "status": "ok",
        "trace_id": product_id,
        "category": category_override,
        "image_path": image_rel,
        "doubao": {
            "pipeline_mode": "stage1_done",
            "models": {"vision": stage1["model"], "struct": stage1["model"]},
            "vision_text": stage1["vision_text"],
            "artifacts": {
                "vision": stage1.get("artifact"),
                "context": context_rel,
            },
        },
        "next": "/api/upload/stage2",
    }


@router.post("/upload/stage2")
def ingest_stage2(
    trace_id: str = Form(...),
    category: str | None = Form(None),
    brand: str | None = Form(None),
    name: str | None = Form(None),
    db: Session = Depends(get_db),
):
    if not trace_id.strip():
        raise HTTPException(status_code=400, detail="trace_id is required.")
    product_id = trace_id.strip()
    context_rel = f"doubao_runs/{product_id}/stage1_context.json"
    if not exists_rel_path(context_rel):
        raise HTTPException(status_code=404, detail="Stage1 context not found. Please run /api/upload/stage1 first.")

    context = load_json(context_rel)
    image_rel = context.get("image_path")
    if not image_rel:
        raise HTTPException(status_code=400, detail="Invalid stage1 context: missing image_path.")

    stage2 = _analyze_with_doubao_stage2(str(context.get("vision_text") or ""), product_id)
    doc = stage2["doc"]
    if db.get(ProductIndex, product_id):
        raise HTTPException(status_code=409, detail="This trace_id has already been finalized.")

    resolved_category = _normalize_optional_text(category, lower=True)
    if resolved_category is None:
        resolved_category = _normalize_optional_text(context.get("category"), lower=True)

    resolved_brand = _normalize_optional_text(brand) if brand is not None else _normalize_optional_text(context.get("brand"))
    resolved_name = _normalize_optional_text(name) if name is not None else _normalize_optional_text(context.get("name"))

    _apply_product_overrides(doc, resolved_category, resolved_brand, resolved_name)
    _attach_stage_evidence(doc, context, stage2)

    normalized = _normalize_with_error_reporting(doc, image_rel=image_rel)
    json_rel = save_product_json(product_id, normalized)

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
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        remove_rel_path(json_rel)
        raise HTTPException(status_code=500, detail=f"Failed to persist product index: {e}") from e

    return {
        "id": product_id,
        "status": "ok",
        "mode": "doubao_two_stage",
        "category": normalized["product"]["category"],
        "image_path": image_rel,
        "json_path": json_rel,
        "doubao": _extract_doubao_preview(normalized),
        "endpoint": "/api/upload/stage2",
    }

@router.post("/maintenance/cleanup-doubao")
def cleanup_doubao(days: int = Query(14, ge=1, le=3650)):
    result = cleanup_doubao_artifacts(days=days)
    return {"status": "ok", **result}


def _analyze_with_doubao(image_rel: str, trace_id: str) -> dict[str, Any]:
    client = DoubaoPipelineService()
    try:
        return client.analyze(image_rel, trace_id=trace_id)
    except AIServiceError as e:
        raise HTTPException(status_code=e.http_status, detail=e.message) from e
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Doubao request failed: {e}") from e


def _analyze_with_doubao_stage1(image_rel: str, trace_id: str) -> dict[str, Any]:
    client = DoubaoPipelineService()
    try:
        return client.analyze_stage1(image_rel, trace_id=trace_id)
    except AIServiceError as e:
        raise HTTPException(status_code=e.http_status, detail=e.message) from e
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Doubao request failed: {e}") from e


def _analyze_with_doubao_stage2(vision_text: str, trace_id: str) -> dict[str, Any]:
    if not vision_text.strip():
        raise HTTPException(status_code=400, detail="Stage1 output is empty, cannot run stage2.")
    client = DoubaoPipelineService()
    try:
        return client.analyze_stage2(vision_text, trace_id=trace_id)
    except AIServiceError as e:
        raise HTTPException(status_code=e.http_status, detail=e.message) from e
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Doubao request failed: {e}") from e


def _apply_product_overrides(doc: dict[str, Any], category: str | None, brand: str | None, name: str | None) -> None:
    doc.setdefault("product", {})

    if category:
        if category not in VALID_CATEGORIES:
            raise HTTPException(status_code=400, detail=f"Invalid category in payload: {category}.")
        doc["product"]["category"] = category
    else:
        model_category = _normalize_optional_text(doc["product"].get("category"), lower=True)
        if not model_category:
            raise HTTPException(
                status_code=422,
                detail=(
                    "Structured result missing required field: product.category. "
                    f"Allowed values: {', '.join(sorted(VALID_CATEGORIES))}."
                ),
            )
        if model_category not in VALID_CATEGORIES:
            raise HTTPException(
                status_code=422,
                detail=(
                    f"Structured result has invalid product.category='{model_category}'. "
                    f"Allowed values: {', '.join(sorted(VALID_CATEGORIES))}."
                ),
            )
        doc["product"]["category"] = model_category

    if brand:
        doc["product"]["brand"] = brand
    if name:
        doc["product"]["name"] = name


def _attach_stage_evidence(doc: dict[str, Any], stage1_ctx: dict[str, Any], stage2: dict[str, Any]) -> None:
    evidence = doc.setdefault("evidence", {})
    evidence["doubao_raw"] = stage2.get("struct_text")
    evidence["doubao_vision_text"] = stage1_ctx.get("vision_text")
    evidence["doubao_pipeline_mode"] = "two-stage"
    evidence["doubao_models"] = {
        "vision": stage1_ctx.get("vision_model"),
        "struct": stage2.get("model"),
    }
    evidence["doubao_artifacts"] = {
        "vision": stage1_ctx.get("vision_artifact"),
        "struct": stage2.get("artifact"),
        "context": f"doubao_runs/{stage1_ctx.get('trace_id')}/stage1_context.json",
    }


def _extract_doubao_preview(normalized_doc: dict[str, Any]) -> dict[str, Any] | None:
    evidence = normalized_doc.get("evidence")
    if not isinstance(evidence, dict):
        return None
    artifacts = evidence.get("doubao_artifacts") if isinstance(evidence.get("doubao_artifacts"), dict) else {}
    return {
        "pipeline_mode": evidence.get("doubao_pipeline_mode"),
        "models": evidence.get("doubao_models"),
        "vision_text": evidence.get("doubao_vision_text"),
        "struct_text": evidence.get("doubao_raw"),
        "artifacts": {
            "vision": artifacts.get("vision"),
            "struct": artifacts.get("struct"),
            "context": artifacts.get("context"),
        },
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
        "category": doc.get("category"),
        "brand": doc.get("brand"),
        "name": doc.get("name"),
    }

    summary_in = doc.get("summary")
    if isinstance(summary_in, dict):
        summary = {
            "one_sentence": summary_in.get("one_sentence") or summary_in.get("oneSentence"),
            "pros": _to_str_list(summary_in.get("pros")),
            "cons": _to_str_list(summary_in.get("cons")),
            "who_for": _to_str_list(summary_in.get("who_for") or summary_in.get("whoFor")),
            "who_not_for": _to_str_list(summary_in.get("who_not_for") or summary_in.get("whoNotFor")),
        }
    else:
        summary = {
            "one_sentence": doc.get("one_sentence") or doc.get("oneSentence"),
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
        "doubao_vision_text": evidence_in.get("doubao_vision_text"),
        "doubao_pipeline_mode": evidence_in.get("doubao_pipeline_mode"),
        "doubao_models": evidence_in.get("doubao_models"),
        "doubao_artifacts": evidence_in.get("doubao_artifacts"),
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


def _normalize_optional_text(value: Any, lower: bool = False) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    return text.lower() if lower else text


def _normalize_with_error_reporting(doc: dict[str, Any], image_rel: str | None) -> dict[str, Any]:
    evidence = doc.get("evidence")
    doubao_raw = evidence.get("doubao_raw") if isinstance(evidence, dict) else None
    try:
        return normalize_doc(doc, image_rel_path=image_rel, doubao_raw=doubao_raw)
    except ValidationError as e:
        issues: list[str] = []
        for err in e.errors():
            loc = ".".join(str(p) for p in err.get("loc", []))
            msg = str(err.get("msg", "invalid value"))
            issues.append(f"{loc}: {msg}" if loc else msg)
        summary = "; ".join(issues[:8]) if issues else "unknown validation error"
        if len(issues) > 8:
            summary += f"; ...(+{len(issues) - 8} more)"
        raise HTTPException(
            status_code=422,
            detail=f"Structured result validation failed: {summary}",
        ) from e
