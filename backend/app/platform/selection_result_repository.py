from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
from typing import Any, Protocol

from app.platform.storage_backend import RuntimeStorage, get_runtime_storage
from app.settings import settings


@dataclass(frozen=True)
class SelectionResultArtifactPaths:
    latest_path: str
    version_path: str
    raw_path: str | None = None


class SelectionResultRepository(Protocol):
    backend_name: str

    def persist(
        self,
        *,
        paths: SelectionResultArtifactPaths,
        published_doc: dict[str, Any],
        raw_doc: dict[str, Any] | None = None,
    ) -> None: ...

    def load(self, *, rel_path: str) -> dict[str, Any]: ...

    def contract(self) -> dict[str, Any]: ...


class LocalSelectionResultRepository:
    backend_name = "local_fs"

    def __init__(self, *, storage: RuntimeStorage):
        self._storage = storage

    def persist(
        self,
        *,
        paths: SelectionResultArtifactPaths,
        published_doc: dict[str, Any],
        raw_doc: dict[str, Any] | None = None,
    ) -> None:
        _persist_artifact_docs(storage=self._storage, paths=paths, published_doc=published_doc, raw_doc=raw_doc)

    def load(self, *, rel_path: str) -> dict[str, Any]:
        return self._storage.load_json(rel_path)

    def contract(self) -> dict[str, Any]:
        return {
            "online_truth": "artifact_file",
            "payload_backend": self.backend_name,
            "artifact_copy_only": False,
            "online_read_from_artifact": True,
            "artifact_storage_backend": self._storage.backend_name,
            "status": "legacy_local_fs_online_truth",
        }


class PostgresPayloadSelectionResultRepository:
    backend_name = "postgres_payload"

    def __init__(self, *, storage: RuntimeStorage):
        self._storage = storage

    def persist(
        self,
        *,
        paths: SelectionResultArtifactPaths,
        published_doc: dict[str, Any],
        raw_doc: dict[str, Any] | None = None,
    ) -> None:
        # Selection result online truth is PostgreSQL payload; artifact files are publish/archive copies only.
        _persist_artifact_docs(storage=self._storage, paths=paths, published_doc=published_doc, raw_doc=raw_doc)

    def load(self, *, rel_path: str) -> dict[str, Any]:
        raise RuntimeError(
            "postgres_payload repository does not support online artifact reads; "
            "selection result online reads must come from PostgreSQL payload."
        )

    def contract(self) -> dict[str, Any]:
        return {
            "online_truth": "postgres_payload",
            "payload_backend": self.backend_name,
            "artifact_copy_only": True,
            "online_read_from_artifact": False,
            "artifact_storage_backend": self._storage.backend_name,
            "status": "phase17_frozen",
        }


def _persist_artifact_docs(
    *,
    storage: RuntimeStorage,
    paths: SelectionResultArtifactPaths,
    published_doc: dict[str, Any],
    raw_doc: dict[str, Any] | None = None,
) -> None:
    if paths.raw_path and raw_doc is not None:
        storage.save_json(paths.raw_path, raw_doc)
    storage.save_json(paths.version_path, published_doc)
    storage.save_json(paths.latest_path, published_doc)


@lru_cache
def get_selection_result_repository() -> SelectionResultRepository:
    backend = str(settings.selection_result_repository_backend or "postgres_payload").strip().lower()
    if backend in {"local", "local_fs"}:
        return LocalSelectionResultRepository(storage=get_runtime_storage())
    if backend in {"postgres", "pg", "postgres_payload"}:
        return PostgresPayloadSelectionResultRepository(storage=get_runtime_storage())
    raise ValueError(f"Unsupported selection result repository backend: {backend}")
