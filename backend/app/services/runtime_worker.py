from __future__ import annotations

import logging
import threading
from typing import Any

from sqlalchemy import select

from app.db.models import UploadIngestJob
from app.db.session import SessionLocal
from app.routes.mobile import run_mobile_compare_worker_once
from app.routes.ingest import _ensure_upload_ingest_job_table, _run_upload_ingest_job
from app.routes.products import run_product_workbench_worker_once
from app.settings import settings
from app.services.runtime_topology import is_worker_runtime

logger = logging.getLogger(__name__)

_worker_lock = threading.Lock()
_worker_thread: threading.Thread | None = None
_worker_stop: threading.Event | None = None


def _worker_poll_interval_seconds() -> float:
    try:
        interval = float(getattr(settings, "worker_poll_interval_seconds", 1.0))
    except Exception:
        interval = 1.0
    return max(0.2, interval)


def run_upload_ingest_worker_once() -> bool:
    db = SessionLocal()
    try:
        _ensure_upload_ingest_job_table(db)
        rec = (
            db.execute(
                select(UploadIngestJob)
                .where(UploadIngestJob.status == "queued")
                .order_by(UploadIngestJob.updated_at.asc())
                .limit(1)
            )
            .scalars()
            .first()
        )
        if rec is None:
            return False
        _run_upload_ingest_job(job_id=str(rec.job_id), db=db, resume=bool(rec.resume_requested))
        return True
    finally:
        db.close()


def _worker_loop(stop_event: threading.Event) -> None:
    poll_interval = _worker_poll_interval_seconds()
    while not stop_event.is_set():
        try:
            processed_upload = run_upload_ingest_worker_once()
            processed_compare = run_mobile_compare_worker_once()
            processed_workbench = run_product_workbench_worker_once()
            processed = bool(processed_upload or processed_compare or processed_workbench)
        except Exception as exc:  # pragma: no cover - defensive guard for long-running loop.
            logger.exception("runtime worker loop failed: %s", exc)
            processed = False
        wait_seconds = 0.1 if processed else poll_interval
        stop_event.wait(wait_seconds)


def start_runtime_worker_daemon() -> bool:
    if not is_worker_runtime():
        return False
    global _worker_thread, _worker_stop
    with _worker_lock:
        if _worker_thread is not None and _worker_thread.is_alive():
            return True
        stop_event = threading.Event()
        thread = threading.Thread(
            target=_worker_loop,
            args=(stop_event,),
            daemon=True,
            name="runtime-upload-ingest-worker",
        )
        thread.start()
        _worker_stop = stop_event
        _worker_thread = thread
        return True


def stop_runtime_worker_daemon(timeout_seconds: float = 1.0) -> bool:
    global _worker_thread, _worker_stop
    with _worker_lock:
        if _worker_thread is None:
            return True
        if _worker_stop is not None:
            _worker_stop.set()
        _worker_thread.join(max(0.1, timeout_seconds))
        alive = _worker_thread.is_alive()
        if not alive:
            _worker_thread = None
            _worker_stop = None
        return not alive


def describe_runtime_worker_state() -> dict[str, Any]:
    with _worker_lock:
        running = bool(_worker_thread is not None and _worker_thread.is_alive())
    return {
        "enabled": is_worker_runtime(),
        "running": running,
        "poll_interval_seconds": _worker_poll_interval_seconds(),
        "capabilities": ["upload_ingest", "mobile_compare", "product_workbench"],
    }
