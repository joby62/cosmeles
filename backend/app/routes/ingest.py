import json
import inspect
import queue
import re
import mimetypes
from datetime import datetime, timezone
from typing import Any
from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse, Response
from pydantic import ValidationError
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy import inspect as sa_inspect, select, text

from app.ai.errors import AIServiceError
from app.constants import VALID_CATEGORIES, VALID_SOURCES
from app.db.session import get_db
from app.db.models import ProductIndex, UploadIngestJob
from app.platform.storage_backend import get_runtime_storage
from app.platform.task_queue import get_runtime_task_queue
from app.services.runtime_topology import should_inline_dispatch_upload_job
from app.services.storage import (
    cleanup_doubao_artifacts,
    convert_temp_upload_to_storage_image,
    exists_rel_path,
    move_image_to_category,
    new_id,
    now_iso,
    save_doubao_artifact,
    save_image,
    save_product_json,
    remove_rel_path,
    save_temp_upload_image,
)
from app.services.doubao_pipeline_service import DoubaoPipelineService
from app.services.parser import normalize_doc
from app.settings import settings
from app.schemas import (
    UploadIngestJobBatchRetryRequest,
    UploadIngestJobBatchRetryResponse,
    UploadIngestJobCancelResponse,
    UploadIngestJobError,
    UploadIngestJobView,
)

router = APIRouter(prefix="/api", tags=["ingest"])
MODEL_TIER_OPTIONS = {"mini", "lite", "pro"}
UPLOAD_INGEST_JOB_STALE_SECONDS = 60 * 30
UPLOAD_INGEST_JOB_PROCESS_STARTED_AT = datetime.now(timezone.utc)
UPLOAD_INGEST_MAX_CONCURRENCY = max(1, min(8, int(settings.upload_ingest_max_concurrency)))

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

    get_runtime_task_queue().start_stream_task(worker, task_name=f"upload-stage1-stream-{trace_id}")

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

    get_runtime_task_queue().start_stream_task(worker, task_name=f"upload-stage1-supplement-{tid}")
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

    get_runtime_task_queue().start_stream_task(worker, task_name=f"upload-stage2-stream-{tid}")

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


@router.post("/upload/jobs", response_model=UploadIngestJobView)
async def create_upload_ingest_job(
    image: UploadFile | None = File(None),
    file: UploadFile | None = File(None),
    supplement_image: UploadFile | None = File(None),
    supplement_file: UploadFile | None = File(None),
    category: str | None = Form(None),
    brand: str | None = Form(None),
    name: str | None = Form(None),
    stage1_model_tier: str | None = Form(None),
    stage2_model_tier: str | None = Form(None),
    db: Session = Depends(get_db),
):
    if image and file:
        raise HTTPException(status_code=400, detail="Please provide only one file field: image or file.")
    if supplement_image and supplement_file:
        raise HTTPException(status_code=400, detail="Please provide only one supplement file field: supplement_image or supplement_file.")
    upload = image or file
    supplement_upload = supplement_image or supplement_file
    if upload is None:
        raise HTTPException(status_code=400, detail="upload jobs require image/file.")
    if not upload.content_type or not upload.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Only image upload is supported.")
    if supplement_upload and (not supplement_upload.content_type or not supplement_upload.content_type.startswith("image/")):
        raise HTTPException(status_code=400, detail="Only image upload is supported for supplement image.")

    normalized_category = _normalize_optional_text(category, lower=True)
    if normalized_category and normalized_category not in VALID_CATEGORIES:
        raise HTTPException(status_code=400, detail=f"Invalid category: {normalized_category}.")
    normalized_stage1_model_tier = _normalize_model_tier(stage1_model_tier, field_name="stage1_model_tier")
    normalized_stage2_model_tier = _normalize_model_tier(stage2_model_tier, field_name="stage2_model_tier")

    content = await upload.read()
    if len(content) > settings.max_upload_bytes:
        raise HTTPException(status_code=413, detail=f"Image too large. Max {settings.max_upload_bytes} bytes.")

    _ensure_upload_ingest_job_table(db)
    job_id = new_id()
    try:
        temp_rel = save_temp_upload_image(
            job_id,
            upload.filename or "upload.img",
            content,
            content_type=upload.content_type,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Temp upload persistence failed: {e}") from e

    supplement_temp_rel: str | None = None
    if supplement_upload is not None:
        supplement_content = await supplement_upload.read()
        if len(supplement_content) > settings.max_upload_bytes:
            remove_rel_path(temp_rel)
            raise HTTPException(status_code=413, detail=f"Supplement image too large. Max {settings.max_upload_bytes} bytes.")
        try:
            supplement_temp_rel = save_temp_upload_image(
                job_id,
                supplement_upload.filename or "supplement.img",
                supplement_content,
                content_type=supplement_upload.content_type,
                suffix="supp1",
            )
        except Exception as e:
            remove_rel_path(temp_rel)
            raise HTTPException(status_code=400, detail=f"Supplement temp persistence failed: {e}") from e

    now = now_iso()
    rec = UploadIngestJob(
        job_id=job_id,
        status="queued",
        stage="queued",
        stage_label=_upload_ingest_job_stage_label("queued"),
        message=_upload_ingest_queue_message(action="任务已入队", supplement=bool(supplement_temp_rel)),
        percent=3,
        file_name=str(upload.filename or "").strip() or "upload.img",
        source_content_type=str(upload.content_type or "").strip() or None,
        temp_upload_path=temp_rel,
        supplement_temp_upload_path=supplement_temp_rel,
        image_path=None,
        image_paths_json="[]",
        category_override=normalized_category,
        brand_override=_normalize_optional_text(brand),
        name_override=_normalize_optional_text(name),
        stage1_model_tier=normalized_stage1_model_tier,
        stage2_model_tier=normalized_stage2_model_tier,
        stage1_text=None,
        stage1_reasoning_text=None,
        stage2_text=None,
        stage2_reasoning_text=None,
        missing_fields_json="[]",
        required_view=None,
        models_json=None,
        artifacts_json=None,
        cancel_requested=False,
        resume_requested=False,
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
    _submit_upload_ingest_job(bind=db.get_bind(), job_id=job_id, resume=False)
    return _to_upload_ingest_job_view(rec)


@router.get("/upload/jobs", response_model=list[UploadIngestJobView])
def list_upload_ingest_jobs(
    status: str | None = Query(None),
    offset: int = Query(0, ge=0),
    limit: int = Query(30, ge=1, le=200),
    db: Session = Depends(get_db),
):
    _ensure_upload_ingest_job_table(db)
    normalized_status = str(status or "").strip().lower() or None
    if normalized_status and normalized_status not in {"queued", "running", "waiting_more", "cancelling", "cancelled", "done", "failed"}:
        raise HTTPException(status_code=400, detail=f"Invalid status: {normalized_status}.")

    stmt = select(UploadIngestJob)
    if normalized_status:
        stmt = stmt.where(UploadIngestJob.status == normalized_status)
    rows = db.execute(stmt.order_by(UploadIngestJob.updated_at.desc()).offset(offset).limit(limit)).scalars().all()
    views: list[UploadIngestJobView] = []
    now_utc = datetime.now(timezone.utc)
    for row in rows:
        _reconcile_upload_ingest_job_state(db=db, rec=row, now_utc=now_utc)
        if normalized_status and str(row.status or "").strip().lower() != normalized_status:
            continue
        views.append(_to_upload_ingest_job_view(row))
    return views


@router.get("/upload/jobs/{job_id}", response_model=UploadIngestJobView)
def get_upload_ingest_job(job_id: str, db: Session = Depends(get_db)):
    _ensure_upload_ingest_job_table(db)
    rec = db.get(UploadIngestJob, str(job_id or "").strip())
    if rec is None:
        raise HTTPException(status_code=404, detail=f"Upload ingest job '{job_id}' not found.")
    _reconcile_upload_ingest_job_state(db=db, rec=rec, now_utc=datetime.now(timezone.utc))
    return _to_upload_ingest_job_view(rec)


@router.post("/upload/jobs/{job_id}/cancel", response_model=UploadIngestJobCancelResponse)
def cancel_upload_ingest_job(job_id: str, db: Session = Depends(get_db)):
    _ensure_upload_ingest_job_table(db)
    rec = db.get(UploadIngestJob, str(job_id or "").strip())
    if rec is None:
        raise HTTPException(status_code=404, detail=f"Upload ingest job '{job_id}' not found.")

    status = str(rec.status or "").strip().lower()
    if status in {"done", "failed", "cancelled"}:
        return UploadIngestJobCancelResponse(status="ok", job=_to_upload_ingest_job_view(rec))

    now = now_iso()
    rec.cancel_requested = True
    rec.updated_at = now
    if status in {"queued", "waiting_more"}:
        rec.status = "cancelled"
        rec.stage = "cancelled"
        rec.stage_label = _upload_ingest_job_stage_label("cancelled")
        rec.message = "任务已取消。"
        rec.finished_at = now
    else:
        rec.status = "cancelling"
        rec.stage = "cancelling"
        rec.stage_label = _upload_ingest_job_stage_label("cancelling")
        rec.message = "已收到取消请求，当前阶段结束后停止。"
    db.add(rec)
    db.commit()
    db.refresh(rec)
    return UploadIngestJobCancelResponse(status="ok", job=_to_upload_ingest_job_view(rec))


@router.post("/upload/jobs/{job_id}/retry", response_model=UploadIngestJobView)
def retry_upload_ingest_job(job_id: str, db: Session = Depends(get_db)):
    _ensure_upload_ingest_job_table(db)
    rec = db.get(UploadIngestJob, str(job_id or "").strip())
    if rec is None:
        raise HTTPException(status_code=404, detail=f"Upload ingest job '{job_id}' not found.")

    status = str(rec.status or "").strip().lower()
    if status not in {"failed", "cancelled"}:
        raise HTTPException(status_code=409, detail=f"Only failed/cancelled job can retry. current_status={status}.")

    retry_block = _get_upload_job_retry_block(rec)
    if retry_block is not None:
        raise HTTPException(status_code=retry_block["http_status"], detail=retry_block["detail"])

    _prepare_upload_ingest_job_for_retry(rec)
    db.add(rec)
    db.commit()
    db.refresh(rec)
    _submit_upload_ingest_job(bind=db.get_bind(), job_id=rec.job_id, resume=False)
    return _to_upload_ingest_job_view(rec)


@router.post("/upload/jobs/retry-batch", response_model=UploadIngestJobBatchRetryResponse)
def retry_upload_ingest_jobs_batch(
    payload: UploadIngestJobBatchRetryRequest,
    db: Session = Depends(get_db),
):
    _ensure_upload_ingest_job_table(db)
    job_ids = _normalize_upload_ingest_job_batch_ids(payload.job_ids)
    if not job_ids:
        raise HTTPException(status_code=400, detail="job_ids must contain at least one non-empty job id.")

    retried_records: list[UploadIngestJob] = []
    failed_items: list[dict[str, Any]] = []

    for job_id in job_ids:
        rec = db.get(UploadIngestJob, job_id)
        if rec is None:
            failed_items.append(
                {
                    "job_id": job_id,
                    "detail": f"Upload ingest job '{job_id}' not found.",
                    "http_status": 404,
                }
            )
            continue

        status = str(rec.status or "").strip().lower()
        if status not in {"failed", "cancelled"}:
            failed_items.append(
                {
                    "job_id": job_id,
                    "detail": f"Only failed/cancelled job can retry. current_status={status}.",
                    "http_status": 409,
                }
            )
            continue

        retry_block = _get_upload_job_retry_block(rec)
        if retry_block is not None:
            failed_items.append(
                {
                    "job_id": job_id,
                    "detail": retry_block["detail"],
                    "http_status": int(retry_block["http_status"]),
                }
            )
            continue

        _prepare_upload_ingest_job_for_retry(rec)
        db.add(rec)
        retried_records.append(rec)

    if retried_records:
        db.commit()
    else:
        db.rollback()

    retried_jobs: list[UploadIngestJobView] = []
    for rec in retried_records:
        db.refresh(rec)
        _submit_upload_ingest_job(bind=db.get_bind(), job_id=rec.job_id, resume=False)
        retried_jobs.append(_to_upload_ingest_job_view(rec))

    response_status = "ok"
    if failed_items and retried_jobs:
        response_status = "partial"
    elif failed_items:
        response_status = "failed"

    return UploadIngestJobBatchRetryResponse(
        status=response_status,
        requested=len(job_ids),
        retried=len(retried_jobs),
        failed=len(failed_items),
        retried_jobs=retried_jobs,
        failed_items=failed_items,
    )


@router.get("/upload/jobs/{job_id}/preview")
def preview_upload_ingest_job_image(
    job_id: str,
    slot: str = Query("primary"),
    db: Session = Depends(get_db),
):
    _ensure_upload_ingest_job_table(db)
    rec = db.get(UploadIngestJob, str(job_id or "").strip())
    if rec is None:
        raise HTTPException(status_code=404, detail=f"Upload ingest job '{job_id}' not found.")

    normalized_slot = str(slot or "").strip().lower()
    if normalized_slot not in {"primary", "supplement"}:
        raise HTTPException(status_code=400, detail=f"Invalid slot: {slot}. expected primary|supplement.")

    rel_path = str(rec.temp_upload_path or "").strip() if normalized_slot == "primary" else str(rec.supplement_temp_upload_path or "").strip()
    if not rel_path:
        raise HTTPException(status_code=404, detail=f"[stage=upload_job_preview] {normalized_slot} temp path missing.")
    if not exists_rel_path(rel_path):
        raise HTTPException(status_code=404, detail=f"[stage=upload_job_preview] {normalized_slot} temp image missing: {rel_path}")

    try:
        payload = get_runtime_storage().read_bytes(rel_path)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"[stage=upload_job_preview] failed to read {normalized_slot} temp image: {e}",
        ) from e

    media_type = mimetypes.guess_type(rel_path)[0] or "application/octet-stream"
    return Response(
        content=payload,
        media_type=media_type,
        headers={"Cache-Control": "no-store"},
    )


@router.post("/upload/jobs/{job_id}/resume", response_model=UploadIngestJobView)
async def resume_upload_ingest_job(
    job_id: str,
    image: UploadFile | None = File(None),
    file: UploadFile | None = File(None),
    category: str | None = Form(None),
    brand: str | None = Form(None),
    name: str | None = Form(None),
    db: Session = Depends(get_db),
):
    _ensure_upload_ingest_job_table(db)
    rec = db.get(UploadIngestJob, str(job_id or "").strip())
    if rec is None:
        raise HTTPException(status_code=404, detail=f"Upload ingest job '{job_id}' not found.")

    status = str(rec.status or "").strip().lower()
    if status != "waiting_more":
        raise HTTPException(status_code=409, detail=f"Only waiting_more job can resume. current_status={status}.")

    resume_block = _get_upload_job_resume_block(rec)
    if resume_block is not None:
        raise HTTPException(status_code=resume_block["http_status"], detail=resume_block["detail"])

    if image and file:
        raise HTTPException(status_code=400, detail="Please provide only one file field: image or file.")
    upload = image or file
    has_image = upload is not None

    normalized_category = _normalize_optional_text(category, lower=True)
    if normalized_category and normalized_category not in VALID_CATEGORIES:
        raise HTTPException(status_code=400, detail=f"Invalid category: {normalized_category}.")
    normalized_brand = _normalize_optional_text(brand)
    normalized_name = _normalize_optional_text(name)

    if not has_image and normalized_category is None and normalized_brand is None and normalized_name is None:
        raise HTTPException(status_code=400, detail="resume requires supplement image or manual category/brand/name.")

    supplement_temp_rel: str | None = None
    if upload is not None:
        context_rel = f"doubao_runs/{rec.job_id}/stage1_context.json"
        if exists_rel_path(context_rel):
            context = get_runtime_storage().load_json(context_rel)
            context_paths = context.get("image_paths")
            if isinstance(context_paths, list):
                existing_paths = [str(item or "").strip() for item in context_paths if str(item or "").strip()]
            else:
                existing_paths = []
            if len(existing_paths) >= 2:
                raise HTTPException(
                    status_code=409,
                    detail="[stage=upload_job_resume] stage1 already has two images; please resume with manual category/brand/name only.",
                )
        if not upload.content_type or not upload.content_type.startswith("image/"):
            raise HTTPException(status_code=400, detail="Only image upload is supported.")
        content = await upload.read()
        if len(content) > settings.max_upload_bytes:
            raise HTTPException(status_code=413, detail=f"Image too large. Max {settings.max_upload_bytes} bytes.")
        try:
            supplement_temp_rel = save_temp_upload_image(
                rec.job_id,
                upload.filename or "supplement.img",
                content,
                content_type=upload.content_type,
                suffix="supp1",
            )
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Supplement image persistence failed: {e}") from e

    now = now_iso()
    if normalized_category is not None:
        rec.category_override = normalized_category
    if normalized_brand is not None:
        rec.brand_override = normalized_brand
    if normalized_name is not None:
        rec.name_override = normalized_name
    if supplement_temp_rel is not None:
        rec.supplement_temp_upload_path = supplement_temp_rel

    rec.status = "queued"
    rec.stage = "queued"
    rec.stage_label = _upload_ingest_job_stage_label("queued")
    rec.message = _upload_ingest_queue_message(action="继续任务已入队")
    rec.percent = max(45, int(rec.percent or 0))
    rec.cancel_requested = False
    rec.resume_requested = True
    rec.error_json = None
    rec.started_at = None
    rec.finished_at = None
    rec.updated_at = now
    db.add(rec)
    db.commit()
    db.refresh(rec)
    _submit_upload_ingest_job(bind=db.get_bind(), job_id=rec.job_id, resume=True)
    return _to_upload_ingest_job_view(rec)


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

    context = get_runtime_storage().load_json(context_rel)
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

    context = get_runtime_storage().load_json(context_rel)
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


class UploadIngestJobCancelledError(RuntimeError):
    pass


def _upload_ingest_queue_message(*, action: str, supplement: bool = False) -> str:
    if should_inline_dispatch_upload_job():
        message = f"{action}，等待执行（本地并发上限 {UPLOAD_INGEST_MAX_CONCURRENCY}）。"
    else:
        message = f"{action}，等待 worker 执行。"
    if supplement:
        message += "（双图同品）"
    return message


def _ensure_upload_ingest_job_table(db: Session) -> None:
    bind = db.get_bind()
    UploadIngestJob.__table__.create(bind=bind, checkfirst=True)
    inspector = sa_inspect(bind)
    columns = {item["name"] for item in inspector.get_columns("upload_ingest_jobs")}
    statements: list[str] = []
    if "resume_requested" not in columns:
        statements.append("ALTER TABLE upload_ingest_jobs ADD COLUMN resume_requested BOOLEAN NOT NULL DEFAULT false")
    if "stage1_reasoning_text" not in columns:
        statements.append("ALTER TABLE upload_ingest_jobs ADD COLUMN stage1_reasoning_text TEXT")
    if "stage2_reasoning_text" not in columns:
        statements.append("ALTER TABLE upload_ingest_jobs ADD COLUMN stage2_reasoning_text TEXT")
    if statements:
        with bind.begin() as conn:
            for stmt in statements:
                conn.execute(text(stmt))


def _submit_upload_ingest_job(*, bind: Any, job_id: str, resume: bool) -> None:
    if not should_inline_dispatch_upload_job():
        # phase-15 split/multi profile: API only queues jobs in DB; dedicated worker process pulls and executes.
        return

    SessionMaker = sessionmaker(autocommit=False, autoflush=False, bind=bind)

    def worker() -> None:
        local_db = SessionMaker()
        try:
            _run_upload_ingest_job(job_id=job_id, db=local_db, resume=resume)
        finally:
            local_db.close()

    try:
        get_runtime_task_queue().submit_upload_job(worker, task_name=f"upload-job-{job_id}")
    except Exception as e:
        _mark_upload_ingest_job_failed(
            job_id=job_id,
            bind=bind,
            code="upload_ingest_dispatch_failed",
            detail=f"[stage=upload_job_dispatch] queue submit failed: {e}",
            http_status=500,
        )


def _run_upload_ingest_job(*, job_id: str, db: Session, resume: bool) -> None:
    _ensure_upload_ingest_job_table(db)
    rec = db.get(UploadIngestJob, job_id)
    if rec is None:
        return

    try:
        if bool(rec.cancel_requested):
            raise UploadIngestJobCancelledError("job cancelled before execution.")
        now = now_iso()
        rec.status = "running"
        if not str(rec.started_at or "").strip():
            rec.started_at = now
        rec.finished_at = None
        if str(rec.stage or "").strip().lower() == "queued":
            rec.stage = "uploading"
            rec.stage_label = _upload_ingest_job_stage_label("uploading")
            rec.message = "任务开始执行。"
            rec.percent = max(8, int(rec.percent or 0))
        rec.resume_requested = False
        rec.updated_at = now
        db.add(rec)
        db.commit()
        db.refresh(rec)

        if resume:
            _resume_upload_ingest_job_flow(db=db, rec=rec)
        else:
            _start_upload_ingest_job_flow(db=db, rec=rec)
    except UploadIngestJobCancelledError as e:
        db.rollback()
        _mark_upload_ingest_job_cancelled(job_id=job_id, bind=db.get_bind(), message=str(e))
    except HTTPException as e:
        db.rollback()
        _mark_upload_ingest_job_failed(
            job_id=job_id,
            bind=db.get_bind(),
            code="upload_ingest_http_error",
            detail=str(e.detail),
            http_status=e.status_code,
        )
    except Exception as e:  # pragma: no cover
        db.rollback()
        _mark_upload_ingest_job_failed(
            job_id=job_id,
            bind=db.get_bind(),
            code="upload_ingest_internal_error",
            detail=str(e),
            http_status=500,
        )


def _start_upload_ingest_job_flow(*, db: Session, rec: UploadIngestJob) -> None:
    job_id = str(rec.job_id)
    _assert_upload_job_not_cancelled(db=db, rec=rec)
    has_initial_supplement = bool(str(rec.supplement_temp_upload_path or "").strip())

    _update_upload_job_stage(
        db=db,
        rec=rec,
        stage="converting",
        message="图片转换中（生成 webp/jpg）。" if not has_initial_supplement else "双图转换中（主图+补图，生成 webp/jpg）。",
        percent=max(15, int(rec.percent or 0)),
    )
    temp_upload = str(rec.temp_upload_path or "").strip()
    if not temp_upload:
        raise HTTPException(status_code=500, detail="[stage=upload_job_convert] temp_upload_path missing.")
    try:
        image_rel = convert_temp_upload_to_storage_image(
            temp_upload,
            image_id=job_id,
            subdir="tmp",
            delete_source=False,
        )
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"[stage=upload_job_convert] image conversion failed: {e}") from e

    supplement_temp = str(rec.supplement_temp_upload_path or "").strip()
    supplement_image_rel: str | None = None
    if supplement_temp:
        try:
            supplement_image_rel = convert_temp_upload_to_storage_image(
                supplement_temp,
                image_id=f"{job_id}.supp1",
                subdir="tmp",
                delete_source=False,
            )
        except Exception as e:
            raise HTTPException(status_code=422, detail=f"[stage=upload_job_convert_supplement] image conversion failed: {e}") from e

    stage1_input_paths = [image_rel]
    if supplement_image_rel:
        stage1_input_paths.append(supplement_image_rel)
    rec = db.get(UploadIngestJob, job_id)
    if rec is None:
        return
    rec.image_path = image_rel
    rec.image_paths_json = json.dumps(stage1_input_paths, ensure_ascii=False)
    rec.updated_at = now_iso()
    db.add(rec)
    db.commit()
    db.refresh(rec)

    _assert_upload_job_not_cancelled(db=db, rec=rec)
    _update_upload_job_stage(
        db=db,
        rec=rec,
        stage="stage1",
        message="Stage1 识别中。",
        percent=max(30, int(rec.percent or 0)),
    )
    stage1 = _invoke_stage1_analyzer(
        image_rel=image_rel,
        trace_id=job_id,
        model_tier=rec.stage1_model_tier,
        image_paths=stage1_input_paths[:2] if len(stage1_input_paths) > 1 else None,
        event_callback=lambda event: _append_upload_job_stage_event(bind=db.get_bind(), job_id=job_id, event=event),
    )
    _persist_stage1_context(
        db=db,
        rec=rec,
        stage1=stage1,
        image_paths=stage1_input_paths[:2],
        supplement_image_path=supplement_image_rel,
    )

    stage1_requirement = _build_upload_job_stage1_requirement(stage1.get("vision_text"))
    pending_missing_fields = _remaining_missing_fields_after_manual_input(
        missing_fields=stage1_requirement["missing_fields"],
        rec=rec,
    )
    if pending_missing_fields:
        _mark_upload_ingest_job_waiting_more(
            job_id=job_id,
            bind=db.get_bind(),
            missing_fields=pending_missing_fields,
            required_view=stage1_requirement["required_view"],
            message=(
                "Stage1 信息不完整："
                + "、".join(_upload_missing_field_label(item) for item in pending_missing_fields)
                + "。请补拍或补录后继续。"
            ),
        )
        return

    _finalize_upload_ingest_job_stage2(db=db, rec=rec)


def _resume_upload_ingest_job_flow(*, db: Session, rec: UploadIngestJob) -> None:
    job_id = str(rec.job_id)
    _assert_upload_job_not_cancelled(db=db, rec=rec)
    context_rel = f"doubao_runs/{job_id}/stage1_context.json"
    if not exists_rel_path(context_rel):
        raise HTTPException(status_code=404, detail="Stage1 context not found for resume.")
    context = get_runtime_storage().load_json(context_rel)
    image_path = str(context.get("image_path") or "").strip()
    if not image_path:
        raise HTTPException(status_code=422, detail="Invalid stage1 context: missing image_path.")
    if not exists_rel_path(image_path):
        raise HTTPException(status_code=404, detail=f"Primary image missing: {image_path}")
    image_paths_raw = context.get("image_paths")
    if isinstance(image_paths_raw, list):
        combined_paths = [str(item or "").strip() for item in image_paths_raw if str(item or "").strip()]
    else:
        combined_paths = []
    if not combined_paths:
        combined_paths = [image_path]

    stage1_requirement = _build_upload_job_stage1_requirement(context.get("vision_text"))

    supplement_temp = str(rec.supplement_temp_upload_path or "").strip()
    if supplement_temp:
        if len(combined_paths) < 2:
            _update_upload_job_stage(
                db=db,
                rec=rec,
                stage="converting",
                message="补拍图片转换中（生成 webp/jpg）。",
                percent=max(50, int(rec.percent or 0)),
            )
            try:
                supplement_image_rel = convert_temp_upload_to_storage_image(
                    supplement_temp,
                    image_id=f"{job_id}.supp1",
                    subdir="tmp",
                    delete_source=False,
                )
            except Exception as e:
                raise HTTPException(status_code=422, detail=f"[stage=upload_job_resume_convert] image conversion failed: {e}") from e

            rec = db.get(UploadIngestJob, job_id)
            if rec is None:
                return
            rec.updated_at = now_iso()
            db.add(rec)
            db.commit()
            db.refresh(rec)

            if supplement_image_rel not in combined_paths:
                combined_paths.append(supplement_image_rel)

            _assert_upload_job_not_cancelled(db=db, rec=rec)
            _update_upload_job_stage(
                db=db,
                rec=rec,
                stage="stage1",
                message="补拍后重新执行 Stage1 识别。",
                percent=max(58, int(rec.percent or 0)),
            )
            stage1 = _invoke_stage1_analyzer(
                image_rel=image_path,
                trace_id=job_id,
                model_tier=rec.stage1_model_tier,
                image_paths=combined_paths[:2],
                event_callback=lambda event: _append_upload_job_stage_event(bind=db.get_bind(), job_id=job_id, event=event),
            )
            _persist_stage1_context(
                db=db,
                rec=rec,
                stage1=stage1,
                image_paths=combined_paths[:2],
                supplement_image_path=supplement_image_rel,
            )
            stage1_requirement = _build_upload_job_stage1_requirement(stage1.get("vision_text"))

    pending_missing_fields = _remaining_missing_fields_after_manual_input(
        missing_fields=stage1_requirement["missing_fields"],
        rec=rec,
    )
    if pending_missing_fields:
        _mark_upload_ingest_job_waiting_more(
            job_id=job_id,
            bind=db.get_bind(),
            missing_fields=pending_missing_fields,
            required_view=stage1_requirement["required_view"],
            message=(
                "信息仍不完整："
                + "、".join(_upload_missing_field_label(item) for item in pending_missing_fields)
                + "。请继续补拍或补录。"
            ),
        )
        return

    rec = db.get(UploadIngestJob, job_id)
    if rec is None:
        return
    _finalize_upload_ingest_job_stage2(db=db, rec=rec)


def _persist_stage1_context(
    *,
    db: Session,
    rec: UploadIngestJob,
    stage1: dict[str, Any],
    image_paths: list[str],
    supplement_image_path: str | None = None,
) -> None:
    job_id = str(rec.job_id)
    image_path = str(rec.image_path or "").strip() or (image_paths[0] if image_paths else "")
    context = {
        "trace_id": job_id,
        "image_path": image_path,
        "image_paths": image_paths[:2],
        "supplement_image_path": supplement_image_path,
        "category": rec.category_override,
        "brand": rec.brand_override,
        "name": rec.name_override,
        "vision_text": stage1.get("vision_text"),
        "vision_model": stage1.get("model"),
        "stage1_model_tier": rec.stage1_model_tier,
        "vision_artifact": stage1.get("artifact"),
        "created_at": str(rec.created_at or now_iso()),
        "updated_at": now_iso(),
    }
    context_rel = save_doubao_artifact(job_id, "stage1_context", context)
    rec = db.get(UploadIngestJob, job_id)
    if rec is None:
        return
    models = _safe_json_dict(rec.models_json)
    models["vision"] = stage1.get("model")
    artifacts = _safe_json_dict(rec.artifacts_json)
    artifacts["vision"] = stage1.get("artifact")
    artifacts["context"] = context_rel
    rec.models_json = json.dumps(models, ensure_ascii=False)
    rec.artifacts_json = json.dumps(artifacts, ensure_ascii=False)
    rec.stage1_text = str(stage1.get("vision_text") or rec.stage1_text or "")
    rec.updated_at = now_iso()
    db.add(rec)
    db.commit()


def _finalize_upload_ingest_job_stage2(*, db: Session, rec: UploadIngestJob) -> None:
    job_id = str(rec.job_id)
    _assert_upload_job_not_cancelled(db=db, rec=rec)
    _update_upload_job_stage(
        db=db,
        rec=rec,
        stage="stage2",
        message="Stage2 结构化中。",
        percent=max(75, int(rec.percent or 0)),
    )
    try:
        result = _finalize_stage2(
            trace_id=job_id,
            category=rec.category_override,
            brand=rec.brand_override,
            name=rec.name_override,
            model_tier=rec.stage2_model_tier,
            db=db,
            event_callback=lambda event: _append_upload_job_stage_event(bind=db.get_bind(), job_id=job_id, event=event),
        )
    except HTTPException as e:
        missing_fields = _extract_waiting_more_fields_from_stage2_error(str(e.detail))
        if e.status_code == 422 and missing_fields:
            _mark_upload_ingest_job_waiting_more(
                job_id=job_id,
                bind=db.get_bind(),
                missing_fields=missing_fields,
                required_view="补录类别或补拍可见品类信息的图片",
                message=f"Stage2 缺失关键信息：{str(e.detail)}",
            )
            return
        raise

    rec = db.get(UploadIngestJob, job_id)
    if rec is None:
        return
    artifacts = _safe_json_dict(rec.artifacts_json)
    doubao = result.get("doubao") if isinstance(result, dict) else {}
    if isinstance(doubao, dict):
        output_artifacts = doubao.get("artifacts")
        if isinstance(output_artifacts, dict):
            for key, value in output_artifacts.items():
                artifacts[str(key)] = value
        models = _safe_json_dict(rec.models_json)
        output_models = doubao.get("models")
        if isinstance(output_models, dict):
            for key, value in output_models.items():
                models[str(key)] = value
        rec.models_json = json.dumps(models, ensure_ascii=False)
        struct_text = str(doubao.get("struct_text") or "").strip()
        if struct_text:
            rec.stage2_text = struct_text

    rec.artifacts_json = json.dumps(artifacts, ensure_ascii=False)
    rec.result_json = json.dumps(result, ensure_ascii=False)
    remove_rel_path(rec.temp_upload_path)
    remove_rel_path(rec.supplement_temp_upload_path)
    rec.temp_upload_path = None
    rec.supplement_temp_upload_path = None
    rec.status = "done"
    rec.stage = "done"
    rec.stage_label = _upload_ingest_job_stage_label("done")
    rec.message = "上传分析完成，产品已入库。"
    rec.percent = 100
    now = now_iso()
    rec.finished_at = now
    rec.updated_at = now
    db.add(rec)
    db.commit()


def _append_upload_job_stage_event(*, bind: Any, job_id: str, event: dict[str, Any]) -> None:
    SessionMaker = sessionmaker(autocommit=False, autoflush=False, bind=bind)
    progress_db = SessionMaker()
    try:
        rec = progress_db.get(UploadIngestJob, job_id)
        if rec is None:
            return
        payload = event if isinstance(event, dict) else {}
        stage = str(payload.get("stage") or "").strip().lower()
        event_type = str(payload.get("type") or "").strip().lower()
        stream_kind = str(payload.get("stream_kind") or "").strip().lower()
        text = str(payload.get("message") or payload.get("text") or "").strip()
        delta = str(payload.get("delta") or "").strip()

        if stage.startswith("stage1") and delta and stream_kind == "reasoning_summary":
            rec.stage1_reasoning_text = f"{rec.stage1_reasoning_text or ''}{delta}"
        elif stage.startswith("stage2") and delta and stream_kind == "reasoning_summary":
            rec.stage2_reasoning_text = f"{rec.stage2_reasoning_text or ''}{delta}"
        elif stage.startswith("stage1") and delta:
            rec.stage1_text = f"{rec.stage1_text or ''}{delta}"
        elif stage.startswith("stage2") and delta:
            rec.stage2_text = f"{rec.stage2_text or ''}{delta}"
        elif stage.startswith("stage1") and text and event_type == "step":
            rec.stage1_text = f"{rec.stage1_text or ''}\n{text}".strip()
        elif stage.startswith("stage2") and text and event_type == "step":
            rec.stage2_text = f"{rec.stage2_text or ''}\n{text}".strip()

        if text and event_type == "step":
            rec.message = text
        rec.status = "running"
        if stage.startswith("stage1"):
            rec.stage = "stage1"
            rec.stage_label = _upload_ingest_job_stage_label("stage1")
            rec.percent = max(35, int(rec.percent or 0))
        elif stage.startswith("stage2"):
            rec.stage = "stage2"
            rec.stage_label = _upload_ingest_job_stage_label("stage2")
            rec.percent = max(78, int(rec.percent or 0))
        now = now_iso()
        rec.updated_at = now
        if not str(rec.started_at or "").strip():
            rec.started_at = now
        progress_db.add(rec)
        progress_db.commit()
    finally:
        progress_db.close()


def _assert_upload_job_not_cancelled(*, db: Session, rec: UploadIngestJob) -> None:
    current = db.get(UploadIngestJob, rec.job_id)
    if current is None:
        raise UploadIngestJobCancelledError("job disappeared.")
    if bool(current.cancel_requested):
        raise UploadIngestJobCancelledError("job cancelled by operator.")


def _update_upload_job_stage(
    *,
    db: Session,
    rec: UploadIngestJob,
    stage: str,
    message: str,
    percent: int,
    status: str = "running",
) -> None:
    rec = db.get(UploadIngestJob, rec.job_id)
    if rec is None:
        return
    now = now_iso()
    rec.status = status
    rec.stage = stage
    rec.stage_label = _upload_ingest_job_stage_label(stage)
    rec.message = message
    rec.percent = max(0, min(100, int(percent)))
    rec.updated_at = now
    if status == "running" and not str(rec.started_at or "").strip():
        rec.started_at = now
    db.add(rec)
    db.commit()
    db.refresh(rec)


def _mark_upload_ingest_job_waiting_more(
    *,
    job_id: str,
    bind: Any,
    missing_fields: list[str],
    required_view: str | None,
    message: str,
) -> None:
    SessionMaker = sessionmaker(autocommit=False, autoflush=False, bind=bind)
    local_db = SessionMaker()
    try:
        rec = local_db.get(UploadIngestJob, job_id)
        if rec is None:
            return
        now = now_iso()
        rec.status = "waiting_more"
        rec.stage = "waiting_more"
        rec.stage_label = _upload_ingest_job_stage_label("waiting_more")
        rec.message = message
        rec.percent = max(70, min(95, int(rec.percent or 0)))
        rec.missing_fields_json = json.dumps(missing_fields, ensure_ascii=False)
        rec.required_view = str(required_view or "").strip() or _required_view_from_missing_fields(missing_fields)
        rec.updated_at = now
        rec.finished_at = None
        local_db.add(rec)
        local_db.commit()
    finally:
        local_db.close()


def _mark_upload_ingest_job_cancelled(*, job_id: str, bind: Any, message: str) -> None:
    SessionMaker = sessionmaker(autocommit=False, autoflush=False, bind=bind)
    local_db = SessionMaker()
    try:
        rec = local_db.get(UploadIngestJob, job_id)
        if rec is None:
            return
        now = now_iso()
        rec.status = "cancelled"
        rec.stage = "cancelled"
        rec.stage_label = _upload_ingest_job_stage_label("cancelled")
        rec.message = str(message or "任务已取消。")
        rec.percent = max(0, min(99, int(rec.percent or 0)))
        rec.finished_at = now
        rec.updated_at = now
        local_db.add(rec)
        local_db.commit()
    finally:
        local_db.close()


def _mark_upload_ingest_job_failed(
    *,
    job_id: str,
    bind: Any,
    code: str,
    detail: str,
    http_status: int,
) -> None:
    SessionMaker = sessionmaker(autocommit=False, autoflush=False, bind=bind)
    local_db = SessionMaker()
    try:
        rec = local_db.get(UploadIngestJob, job_id)
        if rec is None:
            return
        now = now_iso()
        rec.status = "failed"
        rec.stage = "failed"
        rec.stage_label = _upload_ingest_job_stage_label("failed")
        rec.message = str(detail or "upload ingest job failed.")
        rec.error_json = json.dumps(
            {
                "code": str(code or "upload_ingest_failed"),
                "detail": str(detail or "upload ingest failed."),
                "http_status": int(http_status or 500),
            },
            ensure_ascii=False,
        )
        rec.finished_at = now
        rec.updated_at = now
        local_db.add(rec)
        local_db.commit()
    finally:
        local_db.close()


def _reconcile_upload_ingest_job_state(*, db: Session, rec: UploadIngestJob, now_utc: datetime) -> None:
    status = str(rec.status or "").strip().lower()
    if status not in {"queued", "running", "cancelling"}:
        return
    reason = _upload_ingest_job_orphan_reason(rec=rec, now_utc=now_utc)
    if reason is None:
        return
    now = now_iso()
    last_updated = str(rec.updated_at or "").strip() or "-"
    active_stage = str(rec.stage or status or "unknown").strip() or "unknown"
    if status == "cancelling" or bool(rec.cancel_requested):
        rec.status = "cancelled"
        rec.stage = "cancelled"
        rec.stage_label = _upload_ingest_job_stage_label("cancelled")
        rec.message = (
            "任务已取消：检测到后台执行线程不存在，"
            f"reason={reason}，stage={active_stage}，last_update={last_updated}。"
        )
        rec.error_json = None
    else:
        detail = (
            "任务执行中断：检测到后台执行线程不存在，"
            f"reason={reason}，stage={active_stage}，last_update={last_updated}。"
        )
        rec.status = "failed"
        rec.stage = "failed"
        rec.stage_label = _upload_ingest_job_stage_label("failed")
        rec.message = detail
        rec.error_json = json.dumps(
            {
                "code": "upload_job_orphaned",
                "detail": detail,
                "http_status": 500,
            },
            ensure_ascii=False,
        )
    rec.finished_at = now
    rec.updated_at = now
    db.add(rec)
    db.commit()
    db.refresh(rec)


def _upload_ingest_job_orphan_reason(*, rec: UploadIngestJob, now_utc: datetime) -> str | None:
    status = str(rec.status or "").strip().lower()
    updated_at = _parse_utc_datetime(str(rec.updated_at or "").strip())
    created_at = _parse_utc_datetime(str(rec.created_at or "").strip())
    started_at = _parse_utc_datetime(str(rec.started_at or "").strip())
    last_update = updated_at or created_at
    if last_update is None:
        return None
    process_anchor = created_at if status == "queued" else (started_at or created_at)
    if process_anchor and process_anchor < UPLOAD_INGEST_JOB_PROCESS_STARTED_AT:
        return "service_restarted"
    stale_seconds = max(0, int((now_utc - last_update).total_seconds()))
    if stale_seconds >= UPLOAD_INGEST_JOB_STALE_SECONDS:
        return f"heartbeat_timeout_{stale_seconds}s"
    return None


def _get_upload_job_retry_block(rec: UploadIngestJob) -> dict[str, Any] | None:
    primary_temp = str(rec.temp_upload_path or "").strip()
    if not primary_temp:
        return {
            "http_status": 409,
            "detail": "[stage=upload_job_retry_prepare] temp_upload_path missing; upload temp context lost, cannot retry.",
        }
    if not exists_rel_path(primary_temp):
        return {
            "http_status": 404,
            "detail": f"[stage=upload_job_retry_prepare] primary temp image missing: {primary_temp}. upload temp context lost, cannot retry.",
        }

    supplement_temp = str(rec.supplement_temp_upload_path or "").strip()
    if supplement_temp and not exists_rel_path(supplement_temp):
        return {
            "http_status": 404,
            "detail": f"[stage=upload_job_retry_prepare] supplement temp image missing: {supplement_temp}. upload temp context lost, cannot retry.",
        }
    return None


def _normalize_upload_ingest_job_batch_ids(job_ids: list[str]) -> list[str]:
    normalized: list[str] = []
    seen: set[str] = set()
    for item in job_ids or []:
        value = str(item or "").strip()
        if not value or value in seen:
            continue
        seen.add(value)
        normalized.append(value)
    return normalized


def _prepare_upload_ingest_job_for_retry(rec: UploadIngestJob) -> None:
    now = now_iso()
    rec.status = "queued"
    rec.stage = "queued"
    rec.stage_label = _upload_ingest_job_stage_label("queued")
    rec.message = _upload_ingest_queue_message(action="重试任务已入队")
    rec.percent = 3
    rec.cancel_requested = False
    rec.resume_requested = False
    rec.stage1_text = None
    rec.stage1_reasoning_text = None
    rec.stage2_text = None
    rec.stage2_reasoning_text = None
    rec.missing_fields_json = "[]"
    rec.required_view = None
    rec.models_json = None
    rec.artifacts_json = None
    rec.image_path = None
    rec.image_paths_json = "[]"
    rec.result_json = None
    rec.error_json = None
    rec.started_at = None
    rec.finished_at = None
    rec.updated_at = now


def _get_upload_job_resume_block(rec: UploadIngestJob) -> dict[str, Any] | None:
    primary_temp = str(rec.temp_upload_path or "").strip()
    if not primary_temp:
        return {
            "http_status": 409,
            "detail": "[stage=upload_job_resume_prepare] temp_upload_path missing; waiting_more context lost, cannot resume. Please create a new upload job.",
        }
    if not exists_rel_path(primary_temp):
        return {
            "http_status": 404,
            "detail": f"[stage=upload_job_resume_prepare] primary temp image missing: {primary_temp}. waiting_more context lost, cannot resume. Please create a new upload job.",
        }

    context_rel = f"doubao_runs/{rec.job_id}/stage1_context.json"
    if not exists_rel_path(context_rel):
        return {
            "http_status": 404,
            "detail": f"[stage=upload_job_resume_prepare] stage1 context missing: {context_rel}. waiting_more context lost, cannot resume. Please create a new upload job.",
        }
    return None


def _to_upload_ingest_job_view(rec: UploadIngestJob) -> UploadIngestJobView:
    result = _safe_json_dict(rec.result_json) if str(rec.result_json or "").strip() else None
    models = _safe_json_dict(rec.models_json) if str(rec.models_json or "").strip() else None
    artifacts = _safe_json_dict(rec.artifacts_json) if str(rec.artifacts_json or "").strip() else None
    error_raw = _safe_json_dict(rec.error_json) if str(rec.error_json or "").strip() else None
    error_obj: UploadIngestJobError | None = None
    if error_raw:
        try:
            error_obj = UploadIngestJobError.model_validate(error_raw)
        except Exception:
            error_obj = UploadIngestJobError(code="upload_ingest_error", detail=str(error_raw), http_status=500)

    image_paths_raw = _safe_json_list(rec.image_paths_json)
    missing_fields = [str(item or "").strip() for item in _safe_json_list(rec.missing_fields_json) if str(item or "").strip()]
    primary_temp = str(rec.temp_upload_path or "").strip()
    supplement_temp = str(rec.supplement_temp_upload_path or "").strip()
    has_primary_temp = bool(primary_temp and exists_rel_path(primary_temp))
    has_supplement_temp = bool(supplement_temp and exists_rel_path(supplement_temp))
    status = str(rec.status or "queued").strip().lower() or "queued"
    retry_block = _get_upload_job_retry_block(rec) if status in {"failed", "cancelled"} else None
    resume_block = _get_upload_job_resume_block(rec) if status == "waiting_more" else None
    artifact_context_detail = resume_block["detail"] if resume_block is not None else (retry_block["detail"] if retry_block is not None else None)

    return UploadIngestJobView(
        status=status,
        job_id=str(rec.job_id),
        file_name=str(rec.file_name or "").strip() or None,
        source_content_type=str(rec.source_content_type or "").strip() or None,
        stage=str(rec.stage or "").strip() or None,
        stage_label=str(rec.stage_label or "").strip() or None,
        message=str(rec.message or "").strip() or None,
        percent=max(0, min(100, int(rec.percent or 0))),
        image_path=str(rec.image_path or "").strip() or None,
        image_paths=[str(item or "").strip() for item in image_paths_raw if str(item or "").strip()],
        has_primary_temp_preview=has_primary_temp,
        has_supplement_temp_preview=has_supplement_temp,
        temp_preview_url=f"/api/upload/jobs/{rec.job_id}/preview?slot=primary" if has_primary_temp else None,
        supplement_temp_preview_url=f"/api/upload/jobs/{rec.job_id}/preview?slot=supplement" if has_supplement_temp else None,
        can_retry=bool(status in {"failed", "cancelled"} and retry_block is None),
        can_resume=bool(status == "waiting_more" and resume_block is None),
        artifact_context_lost=bool(artifact_context_detail),
        artifact_context_detail=artifact_context_detail,
        category_override=str(rec.category_override or "").strip() or None,
        brand_override=str(rec.brand_override or "").strip() or None,
        name_override=str(rec.name_override or "").strip() or None,
        stage1_model_tier=_normalize_model_tier_optional_for_view(rec.stage1_model_tier),
        stage2_model_tier=_normalize_model_tier_optional_for_view(rec.stage2_model_tier),
        stage1_text=str(rec.stage1_text or "").strip() or None,
        stage1_reasoning_text=str(rec.stage1_reasoning_text or "").strip() or None,
        stage2_text=str(rec.stage2_text or "").strip() or None,
        stage2_reasoning_text=str(rec.stage2_reasoning_text or "").strip() or None,
        missing_fields=missing_fields,
        required_view=str(rec.required_view or "").strip() or None,
        models=models or None,
        artifacts=artifacts or None,
        result=result or None,
        error=error_obj,
        cancel_requested=bool(rec.cancel_requested),
        created_at=str(rec.created_at or ""),
        updated_at=str(rec.updated_at or ""),
        started_at=str(rec.started_at or "").strip() or None,
        finished_at=str(rec.finished_at or "").strip() or None,
    )


def _safe_json_dict(raw: str | None) -> dict[str, Any]:
    text = str(raw or "").strip()
    if not text:
        return {}
    try:
        parsed = json.loads(text)
    except Exception:
        return {}
    return parsed if isinstance(parsed, dict) else {}


def _safe_json_list(raw: str | None) -> list[Any]:
    text = str(raw or "").strip()
    if not text:
        return []
    try:
        parsed = json.loads(text)
    except Exception:
        return []
    return parsed if isinstance(parsed, list) else []


def _parse_utc_datetime(value: str) -> datetime | None:
    text = str(value or "").strip()
    if not text:
        return None
    try:
        if text.endswith("Z"):
            text = f"{text[:-1]}+00:00"
        parsed = datetime.fromisoformat(text)
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc)
    except ValueError:
        return None


def _upload_ingest_job_stage_label(stage: str) -> str:
    mapping = {
        "queued": "待执行",
        "uploading": "上传中",
        "converting": "转换中",
        "stage1": "Stage1 识别",
        "stage2": "Stage2 结构化",
        "waiting_more": "待补拍/补录",
        "cancelling": "取消中",
        "cancelled": "已取消",
        "done": "已完成",
        "failed": "失败",
    }
    key = str(stage or "").strip().lower()
    return mapping.get(key, key or "处理中")


def _extract_waiting_more_fields_from_stage2_error(detail: str) -> list[str]:
    text = str(detail or "").lower()
    out: list[str] = []
    if "product.category" in text:
        out.append("category")
    return out


def _build_upload_job_stage1_requirement(vision_text: Any) -> dict[str, Any]:
    base = _build_stage1_requirement(vision_text)
    missing = [item for item in base["missing_fields"] if item in {"brand", "ingredients"}]
    required_view = _required_view_from_missing_fields(missing) if missing else None
    return {
        "needs_more_images": bool(missing),
        "missing_fields": missing,
        "required_view": required_view,
    }


def _remaining_missing_fields_after_manual_input(*, missing_fields: list[str], rec: UploadIngestJob) -> list[str]:
    resolved_manual: set[str] = set()
    if str(rec.brand_override or "").strip():
        resolved_manual.add("brand")
    if str(rec.category_override or "").strip():
        resolved_manual.add("category")
    if str(rec.name_override or "").strip():
        resolved_manual.add("name")
    out: list[str] = []
    for item in missing_fields:
        key = str(item or "").strip().lower()
        if not key:
            continue
        if key in resolved_manual:
            continue
        out.append(key)
    return out


def _upload_missing_field_label(field: str) -> str:
    key = str(field or "").strip().lower()
    if key == "brand":
        return "品牌"
    if key == "name":
        return "产品名"
    if key == "category":
        return "产品类别"
    if key == "ingredients":
        return "成分表"
    return key or "未知字段"


def _normalize_model_tier_optional_for_view(value: str | None) -> str | None:
    text = str(value or "").strip().lower()
    if text in MODEL_TIER_OPTIONS:
        return text
    return None


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
    if "category" in fields:
        return "补拍可见产品类别的一面，或手动补录产品类别"
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
