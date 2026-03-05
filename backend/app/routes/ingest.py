import json
import inspect
import queue
import threading
import re
from typing import Any
from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import ValidationError
from sqlalchemy.orm import Session, sessionmaker

from app.ai.errors import AIServiceError
from app.constants import VALID_CATEGORIES, VALID_SOURCES
from app.db.session import get_db
from app.db.models import ProductIndex
from app.services.storage import (
    cleanup_doubao_artifacts,
    exists_rel_path,
    load_json,
    move_image_to_category,
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
MODEL_TIER_OPTIONS = {"mini", "lite", "pro"}

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
    stage1_model_tier: str | None = Form(None),
    stage2_model_tier: str | None = Form(None),
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
    normalized_stage1_model_tier = _normalize_model_tier(stage1_model_tier, field_name="stage1_model_tier")
    normalized_stage2_model_tier = _normalize_model_tier(stage2_model_tier, field_name="stage2_model_tier")

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
        try:
            image_rel = save_image(
                product_id,
                upload.filename or "upload.jpg",
                content,
                content_type=upload.content_type,
            )
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e)) from e

    # 1) choose document source
    meta_raw = meta_json or payload_json
    if meta_raw:
        doc = _parse_meta_json(meta_raw)
        ingest_mode = "manual_json"
    elif normalized_source in {"doubao", "auto"}:
        if not image_rel:
            raise HTTPException(status_code=400, detail="source=doubao requires image/file.")
        doc = _analyze_with_doubao(
            image_rel,
            product_id,
            stage1_model_tier=normalized_stage1_model_tier,
            stage2_model_tier=normalized_stage2_model_tier,
        )
        ingest_mode = "doubao"
    else:
        # manual upload without JSON: still allow, use doubao mock/real to bootstrap.
        if not image_rel:
            raise HTTPException(status_code=400, detail="manual upload without JSON still requires image/file.")
        doc = _analyze_with_doubao(
            image_rel,
            product_id,
            stage1_model_tier=normalized_stage1_model_tier,
            stage2_model_tier=normalized_stage2_model_tier,
        )
        ingest_mode = "manual_image_bootstrap"

    # 2) allow override minimal product fields
    _apply_product_overrides(
        doc,
        category=category_override,
        brand=_normalize_optional_text(brand),
        name=_normalize_optional_text(name),
    )
    if ingest_mode in {"doubao", "manual_image_bootstrap"}:
        _validate_stage2_ingredient_order_fields(doc)

    # 3) normalize + validate
    normalized = _normalize_with_error_reporting(doc, image_rel=image_rel)

    normalized_category = str(normalized.get("product", {}).get("category") or "").strip().lower()
    if image_rel and normalized_category:
        moved_image_rel = move_image_to_category(
            image_rel,
            category=normalized_category,
            image_id=product_id,
        )
        if moved_image_rel:
            image_rel = moved_image_rel
            evidence = normalized.setdefault("evidence", {})
            if isinstance(evidence, dict):
                evidence["image_path"] = image_rel

    # 4) save json
    json_rel = save_product_json(product_id, normalized, category=normalized_category or None)

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
    model_tier: str | None = Form(None),
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
    normalized_model_tier = _normalize_model_tier(model_tier, field_name="model_tier")

    product_id = new_id()
    content = await upload.read()
    if len(content) > settings.max_upload_bytes:
        raise HTTPException(status_code=413, detail=f"Image too large. Max {settings.max_upload_bytes} bytes.")
    try:
        image_rel = save_image(
            product_id,
            upload.filename or "upload.jpg",
            content,
            content_type=upload.content_type,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    try:
        stage1 = _invoke_stage1_analyzer(
            image_rel=image_rel,
            trace_id=product_id,
            model_tier=normalized_model_tier,
            image_paths=None,
            event_callback=None,
        )
    except HTTPException:
        remove_rel_path(image_rel)
        raise
    except Exception as e:
        remove_rel_path(image_rel)
        raise HTTPException(status_code=500, detail=f"Stage1 failed: {e}") from e
    stage1_requirement = _build_stage1_requirement(stage1.get("vision_text"))
    context = {
        "trace_id": product_id,
        "image_path": image_rel,
        "image_paths": [image_rel],
        "category": category_override,
        "brand": _normalize_optional_text(brand),
        "name": _normalize_optional_text(name),
        "vision_text": stage1["vision_text"],
        "vision_model": stage1["model"],
        "stage1_model_tier": normalized_model_tier,
        "vision_artifact": stage1.get("artifact"),
        "needs_more_images": stage1_requirement["needs_more_images"],
        "missing_fields": stage1_requirement["missing_fields"],
        "required_view": stage1_requirement["required_view"],
        "created_at": now_iso(),
    }
    try:
        context_rel = save_doubao_artifact(product_id, "stage1_context", context)
    except Exception as e:
        remove_rel_path(stage1.get("artifact"))
        remove_rel_path(image_rel)
        raise HTTPException(status_code=500, detail=f"Stage1 context persistence failed: {e}") from e

    return {
        "status": "needs_more_images" if stage1_requirement["needs_more_images"] else "ok",
        "trace_id": product_id,
        "category": category_override,
        "image_path": image_rel,
        "image_paths": [image_rel],
        "needs_more_images": stage1_requirement["needs_more_images"],
        "missing_fields": stage1_requirement["missing_fields"],
        "required_view": stage1_requirement["required_view"],
        "doubao": {
            "pipeline_mode": "stage1_done",
            "models": {"vision": stage1["model"], "struct": None},
            "vision_text": stage1["vision_text"],
            "artifacts": {
                "vision": stage1.get("artifact"),
                "context": context_rel,
            },
        },
        "next": "/api/upload/stage1/supplement" if stage1_requirement["needs_more_images"] else "/api/upload/stage2",
    }


@router.post("/upload/stage2")
def ingest_stage2(
    trace_id: str = Form(...),
    category: str | None = Form(None),
    brand: str | None = Form(None),
    name: str | None = Form(None),
    model_tier: str | None = Form(None),
    db: Session = Depends(get_db),
):
    if not trace_id.strip():
        raise HTTPException(status_code=400, detail="trace_id is required.")
    return _finalize_stage2(
        trace_id=trace_id.strip(),
        category=category,
        brand=brand,
        name=name,
        model_tier=_normalize_model_tier(model_tier, field_name="model_tier"),
        db=db,
        event_callback=None,
    )


@router.post("/upload/stage1/stream")
async def ingest_stage1_stream(
    image: UploadFile | None = File(None),
    file: UploadFile | None = File(None),
    category: str | None = Form(None),
    brand: str | None = Form(None),
    name: str | None = Form(None),
    model_tier: str | None = Form(None),
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
    normalized_model_tier = _normalize_model_tier(model_tier, field_name="model_tier")

    content = await upload.read()
    if len(content) > settings.max_upload_bytes:
        raise HTTPException(status_code=413, detail=f"Image too large. Max {settings.max_upload_bytes} bytes.")

    events: queue.Queue[tuple[str, dict[str, Any]] | None] = queue.Queue()
    trace_id = new_id()
    try:
        image_rel = save_image(
            trace_id,
            upload.filename or "upload.jpg",
            content,
            content_type=upload.content_type,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    def emit(event: str, payload: dict[str, Any]) -> None:
        events.put((event, payload))

    def worker() -> None:
        try:
            emit("progress", {"step": "stage1_start", "trace_id": trace_id, "image_path": image_rel})
            stage1 = _invoke_stage1_analyzer(
                image_rel=image_rel,
                trace_id=trace_id,
                model_tier=normalized_model_tier,
                image_paths=None,
                event_callback=lambda e: emit("progress", e),
            )
            stage1_requirement = _build_stage1_requirement(stage1.get("vision_text"))
            context = {
                "trace_id": trace_id,
                "image_path": image_rel,
                "image_paths": [image_rel],
                "category": category_override,
                "brand": _normalize_optional_text(brand),
                "name": _normalize_optional_text(name),
                "vision_text": stage1["vision_text"],
                "vision_model": stage1["model"],
                "stage1_model_tier": normalized_model_tier,
                "vision_artifact": stage1.get("artifact"),
                "needs_more_images": stage1_requirement["needs_more_images"],
                "missing_fields": stage1_requirement["missing_fields"],
                "required_view": stage1_requirement["required_view"],
                "created_at": now_iso(),
            }
            context_rel = save_doubao_artifact(trace_id, "stage1_context", context)
            result = {
                "status": "needs_more_images" if stage1_requirement["needs_more_images"] else "ok",
                "trace_id": trace_id,
                "category": category_override,
                "image_path": image_rel,
                "image_paths": [image_rel],
                "needs_more_images": stage1_requirement["needs_more_images"],
                "missing_fields": stage1_requirement["missing_fields"],
                "required_view": stage1_requirement["required_view"],
                "doubao": {
                    "pipeline_mode": "stage1_done",
                    "models": {"vision": stage1["model"], "struct": None},
                    "vision_text": stage1["vision_text"],
                    "artifacts": {
                        "vision": stage1.get("artifact"),
                        "context": context_rel,
                    },
                },
                "next": "/api/upload/stage1/supplement" if stage1_requirement["needs_more_images"] else "/api/upload/stage2",
            }
            emit("result", result)
        except HTTPException as e:
            remove_rel_path(image_rel)
            emit("error", {"status": e.status_code, "detail": e.detail})
        except Exception as e:  # pragma: no cover
            remove_rel_path(image_rel)
            emit("error", {"status": 500, "detail": f"Stage1 failed: {e}"})
        finally:
            emit("done", {"status": "done"})
            events.put(None)

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


@router.post("/upload/stage1/supplement")
async def ingest_stage1_supplement(
    trace_id: str = Form(...),
    image: UploadFile | None = File(None),
    file: UploadFile | None = File(None),
    model_tier: str | None = Form(None),
):
    if image and file:
        raise HTTPException(status_code=400, detail="Please provide only one file field: image or file.")
    upload = image or file
    if upload is None:
        raise HTTPException(status_code=400, detail="supplement requires image/file.")
    if not upload.content_type or not upload.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Only image upload is supported.")
    tid = str(trace_id or "").strip()
    if not tid:
        raise HTTPException(status_code=400, detail="trace_id is required.")
    normalized_model_tier = _normalize_model_tier(model_tier, field_name="model_tier")
    upload_filename = upload.filename or "supplement.jpg"

    content = await upload.read()
    if len(content) > settings.max_upload_bytes:
        raise HTTPException(status_code=413, detail=f"Image too large. Max {settings.max_upload_bytes} bytes.")
    return _run_stage1_supplement(
        trace_id=tid,
        filename=upload_filename,
        content=content,
        content_type=upload.content_type,
        model_tier=normalized_model_tier,
        event_callback=None,
    )


@router.post("/upload/stage1/supplement/stream")
async def ingest_stage1_supplement_stream(
    trace_id: str = Form(...),
    image: UploadFile | None = File(None),
    file: UploadFile | None = File(None),
    model_tier: str | None = Form(None),
):
    if image and file:
        raise HTTPException(status_code=400, detail="Please provide only one file field: image or file.")
    upload = image or file
    if upload is None:
        raise HTTPException(status_code=400, detail="supplement requires image/file.")
    if not upload.content_type or not upload.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Only image upload is supported.")
    tid = str(trace_id or "").strip()
    if not tid:
        raise HTTPException(status_code=400, detail="trace_id is required.")
    normalized_model_tier = _normalize_model_tier(model_tier, field_name="model_tier")
    upload_filename = upload.filename or "supplement.jpg"

    content = await upload.read()
    if len(content) > settings.max_upload_bytes:
        raise HTTPException(status_code=413, detail=f"Image too large. Max {settings.max_upload_bytes} bytes.")

    events: queue.Queue[tuple[str, dict[str, Any]] | None] = queue.Queue()

    def emit(event: str, payload: dict[str, Any]) -> None:
        events.put((event, payload))

    def worker() -> None:
        try:
            emit("progress", {"step": "stage1_supplement_start", "trace_id": tid})
            result = _run_stage1_supplement(
                trace_id=tid,
                filename=upload_filename,
                content=content,
                content_type=upload.content_type,
                model_tier=normalized_model_tier,
                event_callback=lambda e: emit("progress", e),
            )
            emit("result", result)
        except HTTPException as e:
            emit("error", {"status": e.status_code, "detail": e.detail})
        except Exception as e:  # pragma: no cover
            emit("error", {"status": 500, "detail": f"Stage1 supplement failed: {e}"})
        finally:
            emit("done", {"status": "done"})
            events.put(None)

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


@router.post("/upload/stage2/stream")
def ingest_stage2_stream(
    trace_id: str = Form(...),
    category: str | None = Form(None),
    brand: str | None = Form(None),
    name: str | None = Form(None),
    model_tier: str | None = Form(None),
    db: Session = Depends(get_db),
):
    tid = trace_id.strip()
    if not tid:
        raise HTTPException(status_code=400, detail="trace_id is required.")
    normalized_model_tier = _normalize_model_tier(model_tier, field_name="model_tier")

    events: queue.Queue[tuple[str, dict[str, Any]] | None] = queue.Queue()
    SessionMaker = sessionmaker(autocommit=False, autoflush=False, bind=db.get_bind())

    def emit(event: str, payload: dict[str, Any]) -> None:
        events.put((event, payload))

    def worker() -> None:
        local_db = SessionMaker()
        try:
            emit("progress", {"step": "stage2_start", "trace_id": tid})
            result = _finalize_stage2(
                trace_id=tid,
                category=category,
                brand=brand,
                name=name,
                model_tier=normalized_model_tier,
                db=local_db,
                event_callback=lambda e: emit("progress", e),
            )
            emit("result", result)
        except HTTPException as e:
            emit("error", {"status": e.status_code, "detail": e.detail})
        except Exception as e:  # pragma: no cover
            emit("error", {"status": 500, "detail": f"Stage2 failed: {e}"})
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

@router.post("/maintenance/cleanup-doubao")
def cleanup_doubao(days: int = Query(14, ge=1, le=3650)):
    result = cleanup_doubao_artifacts(days=days)
    return {"status": "ok", **result}


def _run_stage1_supplement(
    *,
    trace_id: str,
    filename: str,
    content: bytes,
    content_type: str | None,
    model_tier: str | None,
    event_callback=None,
) -> dict[str, Any]:
    context_rel = f"doubao_runs/{trace_id}/stage1_context.json"
    if not exists_rel_path(context_rel):
        raise HTTPException(status_code=404, detail="Stage1 context not found. Please run /api/upload/stage1 first.")
    if exists_rel_path(f"products/{trace_id}.json"):
        raise HTTPException(status_code=409, detail="This trace_id has already been finalized.")

    context = load_json(context_rel)
    primary_image_path = str(context.get("image_path") or "").strip()
    if not primary_image_path:
        raise HTTPException(status_code=400, detail="Invalid stage1 context: missing image_path.")
    if not exists_rel_path(primary_image_path):
        raise HTTPException(status_code=404, detail="Primary image not found, please restart from /api/upload/stage1.")

    context_image_paths = context.get("image_paths")
    if isinstance(context_image_paths, list):
        image_paths = [str(item or "").strip() for item in context_image_paths if str(item or "").strip()]
    else:
        image_paths = []
    if not image_paths:
        image_paths = [primary_image_path]

    if len(image_paths) >= 2:
        raise HTTPException(status_code=409, detail="Supplement image already exists for this trace_id (max 2 images).")

    try:
        supplement_image_path = save_image(
            f"{trace_id}.supp1",
            filename,
            content,
            content_type=content_type,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    combined_image_paths = [primary_image_path, supplement_image_path]
    try:
        stage1 = _invoke_stage1_analyzer(
            image_rel=primary_image_path,
            image_paths=combined_image_paths,
            trace_id=trace_id,
            model_tier=model_tier,
            event_callback=event_callback,
        )
    except HTTPException:
        remove_rel_path(supplement_image_path)
        raise
    except Exception as e:
        remove_rel_path(supplement_image_path)
        raise HTTPException(status_code=500, detail=f"Stage1 supplement failed: {e}") from e

    stage1_requirement = _build_stage1_requirement(stage1.get("vision_text"))
    if stage1_requirement["needs_more_images"]:
        remove_rel_path(supplement_image_path)
        missing_labels = ",".join(stage1_requirement["missing_fields"]) or "unknown"
        raise HTTPException(
            status_code=422,
            detail=f"Two-image stage1 still missing critical fields: {missing_labels}. Please recapture clearer images.",
        )

    context["image_paths"] = combined_image_paths
    context["supplement_image_path"] = supplement_image_path
    context["vision_text"] = stage1["vision_text"]
    context["vision_model"] = stage1["model"]
    context["stage1_model_tier"] = model_tier
    context["vision_artifact"] = stage1.get("artifact")
    context["needs_more_images"] = False
    context["missing_fields"] = []
    context["required_view"] = None
    context["updated_at"] = now_iso()
    context_rel_saved = save_doubao_artifact(trace_id, "stage1_context", context)

    return {
        "status": "ok",
        "trace_id": trace_id,
        "category": _normalize_optional_text(context.get("category"), lower=True),
        "image_path": primary_image_path,
        "image_paths": combined_image_paths,
        "needs_more_images": False,
        "missing_fields": [],
        "required_view": None,
        "doubao": {
            "pipeline_mode": "stage1_done",
            "models": {"vision": stage1["model"], "struct": None},
            "vision_text": stage1["vision_text"],
            "artifacts": {
                "vision": stage1.get("artifact"),
                "context": context_rel_saved,
            },
        },
        "next": "/api/upload/stage2",
    }


def _finalize_stage2(
    trace_id: str,
    category: str | None,
    brand: str | None,
    name: str | None,
    model_tier: str | None,
    db: Session,
    event_callback=None,
) -> dict[str, Any]:
    context_rel = f"doubao_runs/{trace_id}/stage1_context.json"
    if not exists_rel_path(context_rel):
        raise HTTPException(status_code=404, detail="Stage1 context not found. Please run /api/upload/stage1 first.")

    context = load_json(context_rel)
    image_rel = context.get("image_path")
    if not image_rel:
        raise HTTPException(status_code=400, detail="Invalid stage1 context: missing image_path.")
    if bool(context.get("needs_more_images")):
        missing_fields = context.get("missing_fields")
        if isinstance(missing_fields, list):
            missing_text = ",".join(str(item or "").strip() for item in missing_fields if str(item or "").strip())
        else:
            missing_text = ""
        raise HTTPException(
            status_code=422,
            detail=(
                "Stage1 requires supplement image before Stage2."
                + (f" Missing fields: {missing_text}." if missing_text else "")
            ),
        )

    _emit_progress(event_callback, {"step": "stage2_infer", "message": "Calling Doubao stage2 struct model."})
    stage2 = _invoke_stage2_analyzer(
        vision_text=str(context.get("vision_text") or ""),
        trace_id=trace_id,
        model_tier=model_tier,
        event_callback=event_callback,
    )
    doc = stage2["doc"]
    if db.get(ProductIndex, trace_id):
        raise HTTPException(status_code=409, detail="This trace_id has already been finalized.")

    resolved_category = _normalize_optional_text(category, lower=True)
    if resolved_category is None:
        resolved_category = _normalize_optional_text(context.get("category"), lower=True)

    resolved_brand = _normalize_optional_text(brand) if brand is not None else _normalize_optional_text(context.get("brand"))
    resolved_name = _normalize_optional_text(name) if name is not None else _normalize_optional_text(context.get("name"))

    _apply_product_overrides(doc, resolved_category, resolved_brand, resolved_name)
    _attach_stage_evidence(doc, context, stage2)
    _validate_stage2_ingredient_order_fields(doc)
    _emit_progress(event_callback, {"step": "stage2_normalize", "message": "Normalizing structured document."})

    normalized = _normalize_with_error_reporting(doc, image_rel=image_rel)
    normalized_category = str(normalized.get("product", {}).get("category") or "").strip().lower()
    if image_rel and normalized_category:
        moved_image_rel = move_image_to_category(
            image_rel,
            category=normalized_category,
            image_id=trace_id,
        )
        if moved_image_rel:
            image_rel = moved_image_rel
            evidence = normalized.setdefault("evidence", {})
            if isinstance(evidence, dict):
                evidence["image_path"] = image_rel

    json_rel = save_product_json(trace_id, normalized, category=normalized_category or None)

    one_sentence = normalized.get("summary", {}).get("one_sentence")
    tags = _derive_tags(normalized)

    rec = ProductIndex(
        id=trace_id,
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

    _emit_progress(event_callback, {"step": "stage2_done", "message": "Product persisted."})
    return {
        "id": trace_id,
        "status": "ok",
        "mode": "doubao_two_stage",
        "category": normalized["product"]["category"],
        "image_path": image_rel,
        "json_path": json_rel,
        "doubao": _extract_doubao_preview(normalized),
        "endpoint": "/api/upload/stage2",
    }


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


def _emit_progress(event_callback, payload: dict[str, Any]) -> None:
    if not event_callback:
        return
    try:
        event_callback(payload)
    except Exception:
        return


def _analyze_with_doubao(
    image_rel: str,
    trace_id: str,
    stage1_model_tier: str | None = None,
    stage2_model_tier: str | None = None,
    event_callback=None,
) -> dict[str, Any]:
    client = DoubaoPipelineService()
    try:
        return client.analyze(
            image_rel,
            trace_id=trace_id,
            stage1_model_tier=stage1_model_tier,
            stage2_model_tier=stage2_model_tier,
            event_callback=event_callback,
        )
    except AIServiceError as e:
        raise HTTPException(status_code=e.http_status, detail=e.message) from e
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Doubao request failed: {e}") from e


def _analyze_with_doubao_stage1(
    image_rel: str,
    trace_id: str,
    image_paths: list[str] | None = None,
    model_tier: str | None = None,
    event_callback=None,
) -> dict[str, Any]:
    client = DoubaoPipelineService()
    try:
        return client.analyze_stage1(
            image_rel,
            image_paths=image_paths,
            trace_id=trace_id,
            model_tier=model_tier,
            event_callback=event_callback,
        )
    except AIServiceError as e:
        raise HTTPException(status_code=e.http_status, detail=e.message) from e
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Doubao request failed: {e}") from e


def _analyze_with_doubao_stage2(
    vision_text: str,
    trace_id: str,
    model_tier: str | None = None,
    event_callback=None,
) -> dict[str, Any]:
    if not vision_text.strip():
        raise HTTPException(status_code=400, detail="Stage1 output is empty, cannot run stage2.")
    client = DoubaoPipelineService()
    try:
        return client.analyze_stage2(
            vision_text,
            trace_id=trace_id,
            model_tier=model_tier,
            event_callback=event_callback,
        )
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
    product = {
        "category": (doc.get("product") or {}).get("category") if isinstance(doc.get("product"), dict) else doc.get("category"),
        "brand": (doc.get("product") or {}).get("brand") if isinstance(doc.get("product"), dict) else doc.get("brand"),
        "name": (doc.get("product") or {}).get("name") if isinstance(doc.get("product"), dict) else doc.get("name"),
    }

    summary_in = doc.get("summary") if isinstance(doc.get("summary"), dict) else {}
    if isinstance(summary_in, dict):
        summary = {
            "one_sentence": summary_in.get("one_sentence") or summary_in.get("oneSentence") or doc.get("one_sentence") or doc.get("oneSentence"),
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
        for idx, item in enumerate(ingredients_raw, start=1):
            if not isinstance(item, dict):
                continue
            risk = str(item.get("risk") or "low").lower()
            if risk not in {"low", "mid", "high"}:
                risk = "low"
            rank_value = _parse_positive_int(item.get("rank"))
            abundance_level = _normalize_abundance_level(
                item.get("abundance_level")
                or item.get("abundance")
                or item.get("major_minor")
            )
            order_confidence = _parse_order_confidence(item.get("order_confidence"))
            ingredients.append(
                {
                    "name": str(item.get("name") or "").strip(),
                    "type": str(item.get("type") or "未分类"),
                    "functions": _to_str_list(item.get("functions")),
                    "risk": risk,
                    "notes": str(item.get("notes") or ""),
                    "rank": rank_value or idx,
                    "abundance_level": abundance_level,
                    "order_confidence": order_confidence,
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


def _validate_stage2_ingredient_order_fields(doc: dict[str, Any]) -> None:
    ingredients = doc.get("ingredients")
    if not isinstance(ingredients, list) or not ingredients:
        raise HTTPException(
            status_code=422,
            detail="Structured result missing required field: ingredients (non-empty list).",
        )

    issues: list[str] = []
    ranks: list[int] = []
    for idx, item in enumerate(ingredients, start=1):
        if not isinstance(item, dict):
            issues.append(f"ingredients[{idx}] should be an object.")
            continue

        name = str(item.get("name") or "").strip()
        if not name:
            issues.append(f"ingredients[{idx}].name is required.")

        rank = _parse_positive_int(item.get("rank"))
        if rank is None:
            issues.append(f"ingredients[{idx}].rank is required and should be a positive integer.")
        else:
            ranks.append(rank)

        abundance = _normalize_abundance_level(
            item.get("abundance_level")
            or item.get("abundance")
            or item.get("major_minor")
        )
        if abundance is None:
            issues.append(f"ingredients[{idx}].abundance_level is required and should be major|trace.")

        confidence = _parse_order_confidence(item.get("order_confidence"))
        if confidence is None:
            issues.append(f"ingredients[{idx}].order_confidence is required and should be an integer in [0,100].")

    if len(ranks) != len(set(ranks)):
        issues.append("ingredients rank should be unique.")
    if ranks:
        expected = list(range(1, len(ranks) + 1))
        if sorted(ranks) != expected:
            issues.append("ingredients rank should be continuous from 1.")
        if ranks != expected:
            issues.append("ingredients rank should match the current list order.")

    if issues:
        detail = "; ".join(issues[:10])
        if len(issues) > 10:
            detail += f"; ...(+{len(issues) - 10} more)"
        raise HTTPException(
            status_code=422,
            detail=f"Stage2 ingredient order fields invalid: {detail}",
        )


def _parse_positive_int(value: Any) -> int | None:
    try:
        parsed = int(value)
    except Exception:
        return None
    if parsed <= 0:
        return None
    return parsed


def _parse_order_confidence(value: Any) -> int | None:
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
    major_alias = {
        "major",
        "main",
        "primary",
        "secondary",
        "主要",
        "主成分",
        "核心",
    }
    trace_alias = {
        "trace",
        "minor",
        "micro",
        "微量",
        "末端",
        "痕量",
        "辅料",
    }
    if text in major_alias:
        return "major"
    if text in trace_alias:
        return "trace"
    return None


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


def _build_stage1_requirement(vision_text: Any) -> dict[str, Any]:
    text = str(vision_text or "")
    sections = _parse_stage1_sections(text)
    missing_fields: list[str] = []

    brand_value = sections.get("品牌", "")
    name_value = sections.get("产品名", "")
    ingredients_value = sections.get("成分表原文", "")

    if _is_stage1_value_missing(brand_value):
        missing_fields.append("brand")
    if _is_stage1_value_missing(name_value):
        missing_fields.append("name")
    if _is_stage1_value_missing(ingredients_value):
        missing_fields.append("ingredients")

    needs_more_images = bool(missing_fields)
    required_view = _required_view_from_missing_fields(missing_fields) if needs_more_images else None
    return {
        "needs_more_images": needs_more_images,
        "missing_fields": missing_fields,
        "required_view": required_view,
    }


def _parse_stage1_sections(vision_text: str) -> dict[str, str]:
    lines = str(vision_text or "").replace("\r\n", "\n").split("\n")
    out: dict[str, list[str]] = {}
    current = "raw"
    out[current] = []
    for line in lines:
        m = re.match(r"^【([^】]+)】\s*(.*)$", line.strip())
        if m:
            current = str(m.group(1) or "").strip() or "raw"
            out.setdefault(current, [])
            trailing = str(m.group(2) or "").strip()
            if trailing:
                out[current].append(trailing)
            continue
        out.setdefault(current, []).append(line)
    return {key: "\n".join(value).strip() for key, value in out.items()}


def _is_stage1_value_missing(value: str) -> bool:
    text = str(value or "").strip()
    if not text:
        return True
    text_lc = text.lower()
    if text_lc in {"未识别", "未知", "n/a", "na", "-"}:
        return True
    if "未识别" in text:
        return True
    return False


def _required_view_from_missing_fields(missing_fields: list[str]) -> str:
    fields = set(str(item or "").strip().lower() for item in missing_fields)
    if "ingredients" in fields and ("brand" in fields or "name" in fields):
        return "补拍另一面（品牌/品名 + 成分表）"
    if "ingredients" in fields:
        return "补拍背面成分表"
    return "补拍正面品牌与品名"


def _normalize_optional_text(value: Any, lower: bool = False) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    return text.lower() if lower else text


def _normalize_model_tier(value: Any, *, field_name: str) -> str | None:
    text = str(value or "").strip().lower()
    if not text:
        return None
    if text not in MODEL_TIER_OPTIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid {field_name}: {text}. Allowed: mini, lite, pro.",
        )
    return text


def _invoke_stage1_analyzer(
    *,
    image_rel: str,
    image_paths: list[str] | None,
    trace_id: str,
    model_tier: str | None,
    event_callback=None,
) -> dict[str, Any]:
    fn = _analyze_with_doubao_stage1
    kwargs: dict[str, Any] = {}
    if image_paths and _accepts_parameter(fn, "image_paths"):
        kwargs["image_paths"] = image_paths
    if _accepts_parameter(fn, "model_tier"):
        kwargs["model_tier"] = model_tier
    if event_callback is not None and _accepts_parameter(fn, "event_callback"):
        kwargs["event_callback"] = event_callback
    return fn(image_rel, trace_id, **kwargs)


def _invoke_stage2_analyzer(
    *,
    vision_text: str,
    trace_id: str,
    model_tier: str | None,
    event_callback=None,
) -> dict[str, Any]:
    fn = _analyze_with_doubao_stage2
    kwargs: dict[str, Any] = {}
    if _accepts_parameter(fn, "model_tier"):
        kwargs["model_tier"] = model_tier
    if event_callback is not None and _accepts_parameter(fn, "event_callback"):
        kwargs["event_callback"] = event_callback
    return fn(vision_text, trace_id, **kwargs)


def _accepts_parameter(fn, name: str) -> bool:
    try:
        return name in inspect.signature(fn).parameters
    except Exception:
        return False


def _normalize_with_error_reporting(doc: dict[str, Any], image_rel: str | None) -> dict[str, Any]:
    shaped = _to_product_doc_shape(doc)
    evidence = shaped.get("evidence")
    doubao_raw = evidence.get("doubao_raw") if isinstance(evidence, dict) else None
    try:
        return normalize_doc(shaped, image_rel_path=image_rel, doubao_raw=doubao_raw)
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
