from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from functools import lru_cache
import threading
from typing import Any, Callable, Protocol

from app.settings import settings


RuntimeTask = Callable[[], None]


class RuntimeTaskQueue(Protocol):
    backend_name: str

    def start_stream_task(self, task: RuntimeTask, *, task_name: str) -> None: ...

    def submit_upload_job(self, task: RuntimeTask, *, task_name: str) -> None: ...

    def submit_compare_job(self, task: RuntimeTask, *, task_name: str) -> None: ...

    def submit_product_workbench_job(self, task: RuntimeTask, *, task_name: str) -> None: ...

    def contract(self) -> dict[str, Any]: ...


class LocalRuntimeTaskQueue:
    backend_name = "local_thread"

    def __init__(self) -> None:
        upload_workers = max(1, min(8, int(settings.upload_ingest_max_concurrency)))
        compare_workers = max(1, min(8, int(getattr(settings, "compare_job_max_concurrency", 1))))
        product_workbench_workers = max(1, min(2, int(getattr(settings, "product_workbench_max_concurrency", 1))))
        self._upload_executor = ThreadPoolExecutor(
            max_workers=upload_workers,
            thread_name_prefix="upload-ingest",
        )
        self._compare_executor = ThreadPoolExecutor(
            max_workers=compare_workers,
            thread_name_prefix="mobile-compare",
        )
        self._product_workbench_executor = ThreadPoolExecutor(
            max_workers=product_workbench_workers,
            thread_name_prefix="product-workbench",
        )

    def start_stream_task(self, task: RuntimeTask, *, task_name: str) -> None:
        threading.Thread(target=task, daemon=True, name=task_name).start()

    def submit_upload_job(self, task: RuntimeTask, *, task_name: str) -> None:
        self._upload_executor.submit(task)

    def submit_compare_job(self, task: RuntimeTask, *, task_name: str) -> None:
        self._compare_executor.submit(task)

    def submit_product_workbench_job(self, task: RuntimeTask, *, task_name: str) -> None:
        self._product_workbench_executor.submit(task)

    def contract(self) -> dict[str, Any]:
        return {
            "backend": self.backend_name,
            "supports": {
                "upload_ingest": "submit_upload_job",
                "mobile_compare": "submit_compare_job",
                "product_workbench": "submit_product_workbench_job",
                "legacy_stream": "start_stream_task",
            },
            "upload_ingest_max_workers": max(1, min(8, int(settings.upload_ingest_max_concurrency))),
            "mobile_compare_max_workers": max(1, min(8, int(getattr(settings, "compare_job_max_concurrency", 1))),
            ),
            "product_workbench_max_workers": max(
                1,
                min(2, int(getattr(settings, "product_workbench_max_concurrency", 1))),
            ),
        }


@lru_cache
def get_runtime_task_queue() -> RuntimeTaskQueue:
    backend = str(settings.queue_backend or "local").strip().lower()
    if backend in {"local", "local_thread"}:
        return LocalRuntimeTaskQueue()
    raise ValueError(f"Unsupported queue backend: {backend}")
