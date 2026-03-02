import json
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.ai.errors import AIServiceError
from app.ai.orchestrator import AIOrchestrator
from app.db.models import AIJob, AIRun
from app.db.session import get_db
from app.schemas import AIJobCreateRequest, AIJobView, AIRunView

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
