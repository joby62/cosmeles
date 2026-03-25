import json
from pathlib import Path

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.db.models import Base, MobileSelectionResultIndex
from app.platform.cache_backend import get_runtime_cache_backend
from app.platform.lock_backend import get_runtime_lock_backend
from app.platform.selection_result_repository import get_selection_result_repository
from app.platform.storage_backend import get_runtime_storage
from app.schemas import (
    MobileSelectionLinks,
    MobileSelectionResultBlock,
    MobileSelectionResultCTA,
    MobileSelectionRoute,
    ProductCard,
)
from app.services.mobile_selection_results import (
    MobileSelectionResultLookupError,
    load_mobile_selection_result,
    publish_mobile_selection_result,
)
from app.settings import settings


def _clear_runtime_adapter_caches() -> None:
    get_runtime_storage.cache_clear()
    get_selection_result_repository.cache_clear()
    get_runtime_lock_backend.cache_clear()
    get_runtime_cache_backend.cache_clear()


@pytest.fixture
def selection_result_db(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    storage_dir = tmp_path / "storage"
    user_storage_dir = tmp_path / "user_storage"
    storage_dir.mkdir(parents=True, exist_ok=True)
    user_storage_dir.mkdir(parents=True, exist_ok=True)

    monkeypatch.setattr(settings, "storage_dir", str(storage_dir))
    monkeypatch.setattr(settings, "user_storage_dir", str(user_storage_dir))
    monkeypatch.setattr(settings, "storage_backend", "local_fs")
    monkeypatch.setattr(settings, "selection_result_repository_backend", "postgres_payload")
    monkeypatch.setattr(settings, "queue_backend", "local")
    monkeypatch.setattr(settings, "lock_backend", "local")
    _clear_runtime_adapter_caches()

    db_path = tmp_path / "selection-result.db"
    engine = create_engine(f"sqlite:///{db_path}", connect_args={"check_same_thread": False})
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)

    db: Session = SessionLocal()
    try:
        yield db, storage_dir
    finally:
        db.close()
        engine.dispose()
        _clear_runtime_adapter_caches()


def _publish_sample_selection_result(db: Session):
    return publish_mobile_selection_result(
        db=db,
        category="shampoo",
        answers_hash="hash-abc",
        rules_version="2026-03-03.1",
        route=MobileSelectionRoute(key="deep-oil-control", title="Deep Oil Control"),
        recommendation_source="category_fallback",
        recommended_product=ProductCard(
            id="prod-1",
            category="shampoo",
            brand="Dove",
            name="Shampoo A",
            one_sentence="mock",
            tags=[],
            image_url="/assets/p-1.png",
            created_at="2026-03-12T01:00:00.000000Z",
        ),
        links=MobileSelectionLinks(
            product="/product/prod-1",
            wiki="/m/wiki/shampoo?focus=deep-oil-control",
        ),
        schema_version="selection_result_content.v2",
        renderer_variant="selection_result_default",
        micro_summary="stabilize oil first",
        blocks=[
            MobileSelectionResultBlock(
                id="hero",
                kind="hero",
                version="v1",
                payload={"title": "Start with oil control", "subtitle": "Stabilize first."},
            ),
            MobileSelectionResultBlock(
                id="situation",
                kind="explanation",
                version="v1",
                payload={"title": "Current pattern", "subtitle": "Oil management should come first."},
            ),
            MobileSelectionResultBlock(
                id="attention",
                kind="strategy",
                version="v1",
                payload={"title": "Current priority", "subtitle": "Lower fluctuation before extras."},
            ),
            MobileSelectionResultBlock(
                id="pitfalls",
                kind="warning",
                version="v1",
                payload={"title": "Avoid this", "subtitle": "Do not over-clean aggressively."},
            ),
        ],
        ctas=[
            MobileSelectionResultCTA(
                id="open_product",
                label="Open Product",
                action="product",
                href="/product/prod-1",
                payload={},
            ),
            MobileSelectionResultCTA(
                id="open_wiki",
                label="Open Wiki",
                action="wiki",
                href="/m/wiki/shampoo",
                payload={},
            ),
            MobileSelectionResultCTA(
                id="restart_compare",
                label="Restart",
                action="compare",
                href="/m/compare?category=shampoo",
                payload={},
            ),
        ],
        display_order=["hero", "situation", "attention", "pitfalls", "ctas"],
        fingerprint="test-fingerprint",
        raw_payload={"revision": 1},
        prompt_key="pytest.mobile.selection.result",
        prompt_version="v1",
        model="mock-model",
        refresh_reason="pytest",
    )


def test_selection_result_publish_persists_artifact_copy_only_manifest(selection_result_db) -> None:
    db, storage_dir = selection_result_db

    _published, rec = _publish_sample_selection_result(db)
    manifest = json.loads(rec.artifact_manifest_json or "{}")

    assert rec.payload_backend == "postgres_payload"
    assert manifest["strategy"] == "artifact_copy_only"
    assert manifest["storage_backend"] == "local_fs"
    assert manifest["latest_path"] == rec.storage_path
    assert manifest["version_path"] == rec.published_version_path
    assert manifest["raw_path"] == rec.raw_storage_path
    assert (storage_dir / str(rec.storage_path or "")).exists()
    assert (storage_dir / str(rec.published_version_path or "")).exists()
    assert (storage_dir / str(rec.raw_storage_path or "")).exists()


def test_selection_result_load_reads_from_postgres_payload_without_artifact_online_read(selection_result_db) -> None:
    db, storage_dir = selection_result_db

    _published, rec = _publish_sample_selection_result(db)
    latest_path = storage_dir / str(rec.storage_path or "")
    version_path = storage_dir / str(rec.published_version_path or "")
    if latest_path.exists():
        latest_path.unlink()
    if version_path.exists():
        version_path.unlink()

    item, loaded_rec = load_mobile_selection_result(
        db=db,
        category="shampoo",
        rules_version="2026-03-03.1",
        answers_hash="hash-abc",
    )

    assert loaded_rec.scenario_id == rec.scenario_id
    assert item.scenario_id == rec.scenario_id
    assert item.blocks[0].id == "hero"


def test_selection_result_load_returns_payload_missing_error_when_pg_payload_empty(selection_result_db) -> None:
    db, _storage_dir = selection_result_db

    _published, rec = _publish_sample_selection_result(db)
    row = db.get(MobileSelectionResultIndex, rec.scenario_id)
    assert row is not None
    row.published_payload_json = None
    db.add(row)
    db.commit()

    with pytest.raises(MobileSelectionResultLookupError) as exc_info:
        load_mobile_selection_result(
            db=db,
            category="shampoo",
            rules_version="2026-03-03.1",
            answers_hash="hash-abc",
        )

    exc = exc_info.value
    assert exc.code == "SELECTION_RESULT_PAYLOAD_MISSING"
    assert exc.http_status == 409
    assert exc.stage == "selection_result_payload"
