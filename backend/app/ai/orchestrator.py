import json
import time
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.ai.capabilities import CapabilityExecutionResult, SUPPORTED_CAPABILITIES, execute_capability
from app.ai.errors import AIServiceError
from app.db.models import AIJob, AIRun
from app.db.session import SessionLocal
from app.services.storage import new_id, now_iso


class AIOrchestrator:
    def __init__(self, db: Session):
        self.db = db

    def create_job(self, capability: str, input_payload: dict[str, Any], trace_id: str | None = None) -> AIJob:
        if capability not in SUPPORTED_CAPABILITIES:
            raise AIServiceError(
                code="capability_not_supported",
                message=f"Capability '{capability}' is not supported.",
                http_status=400,
            )
        job = AIJob(
            id=new_id(),
            capability=capability,
            status="queued",
            input_json=_dump_json(input_payload),
            output_json=None,
            trace_id=trace_id,
            prompt_key=None,
            prompt_version=None,
            model=None,
            error_code=None,
            error_http_status=None,
            error_message=None,
            created_at=now_iso(),
            started_at=None,
            finished_at=None,
        )
        self.db.add(job)
        self.db.commit()
        self.db.refresh(job)
        return job

    def run_job(self, job_id: str) -> AIJob:
        job = self.db.get(AIJob, job_id)
        if not job:
            raise AIServiceError(code="job_not_found", message=f"AI job '{job_id}' not found.", http_status=404)
        if job.status == "running":
            raise AIServiceError(code="job_already_running", message=f"AI job '{job_id}' is already running.", http_status=409)
        if job.status == "succeeded":
            return job

        request_payload = _load_json(job.input_json)
        if not isinstance(request_payload, dict):
            raise AIServiceError(code="invalid_job_input", message="Job input must be a JSON object.", http_status=500)

        job.status = "running"
        job.started_at = now_iso()
        job.finished_at = None
        job.error_code = None
        job.error_http_status = None
        job.error_message = None
        self.db.add(job)

        run = AIRun(
            id=new_id(),
            job_id=job.id,
            capability=job.capability,
            status="running",
            prompt_key=None,
            prompt_version=None,
            model=None,
            request_json=_dump_json(request_payload),
            response_json=None,
            latency_ms=None,
            error_code=None,
            error_http_status=None,
            error_message=None,
            created_at=now_iso(),
        )
        self.db.add(run)
        self.db.commit()
        self.db.refresh(job)
        self.db.refresh(run)

        started = time.perf_counter()
        try:
            result = execute_capability(job.capability, request_payload, trace_id=job.trace_id)
            self._mark_succeeded(job, run, result, started)
        except AIServiceError as e:
            self._mark_failed(job, run, e.code, e.message, e.http_status, started)
        except Exception as e:  # pragma: no cover - defensive fallback
            self._mark_failed(job, run, "ai_internal_error", str(e), 500, started)

        self.db.refresh(job)
        return job

    def create_and_run(self, capability: str, input_payload: dict[str, Any], trace_id: str | None = None) -> AIJob:
        job = self.create_job(capability=capability, input_payload=input_payload, trace_id=trace_id)
        return self.run_job(job.id)

    def list_jobs(self, capability: str | None = None, status: str | None = None, limit: int = 100, offset: int = 0) -> list[AIJob]:
        stmt = select(AIJob)
        if capability:
            stmt = stmt.where(AIJob.capability == capability)
        if status:
            stmt = stmt.where(AIJob.status == status)
        stmt = stmt.order_by(AIJob.created_at.desc()).offset(offset).limit(limit)
        return list(self.db.execute(stmt).scalars().all())

    def list_runs(self, job_id: str | None = None, limit: int = 100, offset: int = 0) -> list[AIRun]:
        stmt = select(AIRun)
        if job_id:
            stmt = stmt.where(AIRun.job_id == job_id)
        stmt = stmt.order_by(AIRun.created_at.desc()).offset(offset).limit(limit)
        return list(self.db.execute(stmt).scalars().all())

    def _mark_succeeded(self, job: AIJob, run: AIRun, result: CapabilityExecutionResult, started: float) -> None:
        latency_ms = int((time.perf_counter() - started) * 1000)
        run.status = "succeeded"
        run.prompt_key = result.prompt_key
        run.prompt_version = result.prompt_version
        run.model = result.model
        run.response_json = _dump_json(result.response_payload if result.response_payload is not None else result.output)
        run.latency_ms = latency_ms
        run.error_code = None
        run.error_http_status = None
        run.error_message = None
        self.db.add(run)

        job.status = "succeeded"
        job.output_json = _dump_json(result.output)
        job.prompt_key = result.prompt_key
        job.prompt_version = result.prompt_version
        job.model = result.model
        job.error_code = None
        job.error_http_status = None
        job.error_message = None
        job.finished_at = now_iso()
        self.db.add(job)
        self.db.commit()

    def _mark_failed(self, job: AIJob, run: AIRun, code: str, message: str, http_status: int, started: float) -> None:
        latency_ms = int((time.perf_counter() - started) * 1000)
        run.status = "failed"
        run.error_code = code
        run.error_http_status = http_status
        run.error_message = message
        run.latency_ms = latency_ms
        self.db.add(run)

        job.status = "failed"
        job.output_json = None
        job.error_code = code
        job.error_http_status = http_status
        job.error_message = message
        job.finished_at = now_iso()
        self.db.add(job)
        self.db.commit()


def run_capability_now(capability: str, input_payload: dict[str, Any], trace_id: str | None = None) -> dict[str, Any]:
    db = SessionLocal()
    try:
        orchestrator = AIOrchestrator(db)
        job = orchestrator.create_and_run(capability=capability, input_payload=input_payload, trace_id=trace_id)
        if job.status != "succeeded":
            raise AIServiceError(
                code=job.error_code or "ai_job_failed",
                message=job.error_message or "Capability execution failed.",
                http_status=job.error_http_status or 400,
            )
        output = _load_json(job.output_json)
        if isinstance(output, dict):
            return output
        raise AIServiceError(code="invalid_job_output", message="Capability output must be a JSON object.", http_status=500)
    finally:
        db.close()


def _dump_json(payload: Any) -> str:
    return json.dumps(payload, ensure_ascii=False)


def _load_json(payload: str | None) -> Any:
    if not payload:
        return None
    return json.loads(payload)
