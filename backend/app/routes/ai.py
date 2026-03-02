import json
import queue
import threading
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, sessionmaker

from app.ai.errors import AIServiceError
from app.ai.orchestrator import AIOrchestrator
from app.db.models import AIJob, AIRun
from app.db.session import get_db
from app.schemas import AIJobCreateRequest, AIJobView, AIRunView, AIMetricsSummaryView

router = APIRouter(prefix="/api/ai", tags=["ai"])


@router.post("/jobs", response_model=AIJobView)
def create_ai_job(payload: AIJobCreateRequest, db: Session = Depends(get_db)):
    orchestrator = AIOrchestrator(db)
    try:
        job = orchestrator.create_job(
            capability=payload.capability,
            input_payload=payload.input,
            trace_id=payload.trace_id,
        )
        if payload.run_immediately:
            job = orchestrator.run_job(job.id)
        return _to_job_view(job)
    except AIServiceError as e:
        raise HTTPException(status_code=e.http_status, detail=e.message) from e


@router.post("/jobs/stream")
def create_ai_job_stream(payload: AIJobCreateRequest, db: Session = Depends(get_db)):
    event_queue: queue.Queue[tuple[str, dict[str, Any]] | None] = queue.Queue()
    SessionMaker = sessionmaker(autocommit=False, autoflush=False, bind=db.get_bind())

    def emit(event: str, data: dict[str, Any]) -> None:
        event_queue.put((event, data))

    def worker() -> None:
        db_local = SessionMaker()
        try:
            orchestrator = AIOrchestrator(db_local)
            job = orchestrator.create_job(
                capability=payload.capability,
                input_payload=payload.input,
                trace_id=payload.trace_id,
            )
            emit("job_created", {"job_id": job.id, "capability": job.capability, "trace_id": job.trace_id})

            if payload.run_immediately:
                job = orchestrator.run_job(job.id, event_callback=lambda e: emit("progress", e))

            db_local.refresh(job)
            emit("result", {"job": _to_job_view(job).model_dump()})
        except AIServiceError as e:
            emit("error", {"code": e.code, "detail": e.message, "http_status": e.http_status})
        except Exception as e:  # pragma: no cover
            emit("error", {"code": "ai_stream_internal_error", "detail": str(e), "http_status": 500})
        finally:
            emit("done", {"status": "done"})
            event_queue.put(None)
            db_local.close()

    threading.Thread(target=worker, daemon=True).start()

    def event_iter():
        while True:
            try:
                item = event_queue.get(timeout=2)
            except queue.Empty:
                # keep alive
                yield ": keep-alive\n\n"
                continue
            if item is None:
                break
            event, payload_data = item
            yield _to_sse(event, payload_data)

    return StreamingResponse(
        event_iter(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Pragma": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/jobs/{job_id}/run", response_model=AIJobView)
def run_ai_job(job_id: str, db: Session = Depends(get_db)):
    orchestrator = AIOrchestrator(db)
    try:
        job = orchestrator.run_job(job_id)
        return _to_job_view(job)
    except AIServiceError as e:
        raise HTTPException(status_code=e.http_status, detail=e.message) from e


@router.get("/jobs/{job_id}", response_model=AIJobView)
def get_ai_job(job_id: str, db: Session = Depends(get_db)):
    job = db.get(AIJob, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="AI job not found.")
    return _to_job_view(job)


@router.get("/jobs", response_model=list[AIJobView])
def list_ai_jobs(
    capability: str | None = Query(None),
    status: str | None = Query(None),
    offset: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
    db: Session = Depends(get_db),
):
    orchestrator = AIOrchestrator(db)
    jobs = orchestrator.list_jobs(capability=capability, status=status, limit=limit, offset=offset)
    return [_to_job_view(job) for job in jobs]


@router.get("/runs", response_model=list[AIRunView])
def list_ai_runs(
    job_id: str | None = Query(None),
    offset: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
    db: Session = Depends(get_db),
):
    orchestrator = AIOrchestrator(db)
    runs = orchestrator.list_runs(job_id=job_id, limit=limit, offset=offset)
    return [_to_run_view(run) for run in runs]


@router.get("/metrics/summary", response_model=AIMetricsSummaryView)
def get_ai_metrics_summary(
    capability: str | None = Query(None),
    since_hours: int = Query(168, ge=1, le=24 * 365),
    db: Session = Depends(get_db),
):
    orchestrator = AIOrchestrator(db)
    try:
        return orchestrator.metrics_summary(capability=capability, since_hours=since_hours)
    except AIServiceError as e:
        raise HTTPException(status_code=e.http_status, detail=e.message) from e


def _to_job_view(job: AIJob) -> AIJobView:
    return AIJobView(
        id=job.id,
        capability=job.capability,
        status=job.status,
        trace_id=job.trace_id,
        input=_parse_json(job.input_json),
        output=_parse_json(job.output_json),
        prompt_key=job.prompt_key,
        prompt_version=job.prompt_version,
        model=job.model,
        error_code=job.error_code,
        error_http_status=job.error_http_status,
        error_message=job.error_message,
        created_at=job.created_at,
        started_at=job.started_at,
        finished_at=job.finished_at,
    )


def _to_run_view(run: AIRun) -> AIRunView:
    return AIRunView(
        id=run.id,
        job_id=run.job_id,
        capability=run.capability,
        status=run.status,
        prompt_key=run.prompt_key,
        prompt_version=run.prompt_version,
        model=run.model,
        request=_parse_json(run.request_json),
        response=_parse_json(run.response_json),
        latency_ms=run.latency_ms,
        error_code=run.error_code,
        error_http_status=run.error_http_status,
        error_message=run.error_message,
        created_at=run.created_at,
    )


def _parse_json(payload: str | None) -> dict[str, Any] | None:
    if not payload:
        return None
    try:
        value = json.loads(payload)
    except json.JSONDecodeError:
        return {"raw": payload}
    return value if isinstance(value, dict) else {"value": value}


def _to_sse(event: str, payload: dict[str, Any]) -> str:
    return f"event: {event}\ndata: {json.dumps(payload, ensure_ascii=False)}\n\n"
