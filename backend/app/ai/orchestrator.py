import json
import time
from datetime import datetime, timedelta
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.ai.capabilities import CapabilityExecutionResult, SUPPORTED_CAPABILITIES, execute_capability
from app.ai.errors import AIServiceError
from app.db.models import AIJob, AIRun
from app.db.session import SessionLocal
from app.services.storage import new_id, now_iso
from app.settings import settings


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

    def metrics_summary(self, capability: str | None = None, since_hours: int = 168) -> dict[str, Any]:
        since_hours = max(1, int(since_hours))
        window_start = (datetime.utcnow() - timedelta(hours=since_hours)).strftime("%Y-%m-%dT%H:%M:%SZ")

        jobs_stmt = select(AIJob).where(AIJob.created_at >= window_start)
        runs_stmt = select(AIRun).where(AIRun.created_at >= window_start)
        if capability:
            jobs_stmt = jobs_stmt.where(AIJob.capability == capability)
            runs_stmt = runs_stmt.where(AIRun.capability == capability)

        jobs = list(self.db.execute(jobs_stmt).scalars().all())
        runs = list(self.db.execute(runs_stmt).scalars().all())

        total_jobs = len(jobs)
        succeeded_jobs = sum(1 for j in jobs if j.status == "succeeded")
        failed_jobs = sum(1 for j in jobs if j.status == "failed")
        running_jobs = sum(1 for j in jobs if j.status == "running")
        queued_jobs = sum(1 for j in jobs if j.status == "queued")
        timeout_failures = sum(1 for j in jobs if _is_timeout_failure(j.error_code, j.error_message))

        total_runs = len(runs)
        succeeded_runs = sum(1 for r in runs if r.status == "succeeded")
        failed_runs = sum(1 for r in runs if r.status == "failed")

        latencies = sorted(int(r.latency_ms) for r in runs if isinstance(r.latency_ms, int))
        avg_latency_ms = (sum(latencies) / len(latencies)) if latencies else None
        p95_latency_ms = latencies[max(0, (len(latencies) * 95 + 99) // 100 - 1)] if latencies else None

        model_costs = _load_model_costs()
        priced_runs = 0
        total_estimated_cost = 0.0
        for run in runs:
            model = (run.model or "").strip()
            if not model or model not in model_costs:
                continue
            priced_runs += 1
            total_estimated_cost += model_costs[model]

        return {
            "capability": capability,
            "since_hours": since_hours,
            "window_start": window_start,
            "total_jobs": total_jobs,
            "succeeded_jobs": succeeded_jobs,
            "failed_jobs": failed_jobs,
            "running_jobs": running_jobs,
            "queued_jobs": queued_jobs,
            "success_rate": (succeeded_jobs / total_jobs) if total_jobs else 0.0,
            "timeout_failures": timeout_failures,
            "timeout_rate": (timeout_failures / total_jobs) if total_jobs else 0.0,
            "total_runs": total_runs,
            "succeeded_runs": succeeded_runs,
            "failed_runs": failed_runs,
            "avg_latency_ms": avg_latency_ms,
            "p95_latency_ms": p95_latency_ms,
            "total_estimated_cost": total_estimated_cost,
            "avg_task_cost": (total_estimated_cost / priced_runs) if priced_runs else None,
            "priced_runs": priced_runs,
            "cost_coverage_rate": (priced_runs / total_runs) if total_runs else 0.0,
        }

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


def _is_timeout_failure(error_code: str | None, error_message: str | None) -> bool:
    code = (error_code or "").lower()
    msg = (error_message or "").lower()
    return "timeout" in code or "timeout" in msg


def _load_model_costs() -> dict[str, float]:
    raw = (settings.ai_cost_per_run_by_model_json or "").strip()
    if not raw:
        return {}
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError as e:
        raise AIServiceError(
            code="ai_cost_config_invalid",
            message="AI_COST_PER_RUN_BY_MODEL_JSON must be valid JSON object.",
            http_status=500,
        ) from e
    if not isinstance(parsed, dict):
        raise AIServiceError(
            code="ai_cost_config_invalid",
            message="AI_COST_PER_RUN_BY_MODEL_JSON must be a JSON object.",
            http_status=500,
        )

    out: dict[str, float] = {}
    for key, value in parsed.items():
        model = str(key).strip()
        if not model:
            continue
        try:
            cost = float(value)
        except (TypeError, ValueError) as e:
            raise AIServiceError(
                code="ai_cost_config_invalid",
                message=f"Invalid cost value for model '{model}'.",
                http_status=500,
            ) from e
        if cost < 0:
            raise AIServiceError(
                code="ai_cost_config_invalid",
                message=f"Cost must be non-negative for model '{model}'.",
                http_status=500,
            )
        out[model] = cost
    return out
