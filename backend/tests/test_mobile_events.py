import json
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import app.routes.mobile as mobile_routes
from app.db.models import Base, MobileClientEvent, MobileCompareSessionIndex, MobileSelectionSession
from app.db.session import get_db
from app.routes.mobile import router as mobile_router
from app.settings import settings


@pytest.fixture
def mobile_events_client(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    storage_dir = tmp_path / "storage"
    storage_dir.mkdir(parents=True, exist_ok=True)
    monkeypatch.setattr(settings, "storage_dir", str(storage_dir))
    user_storage_dir = tmp_path / "user_storage"
    user_storage_dir.mkdir(parents=True, exist_ok=True)
    monkeypatch.setattr(settings, "user_storage_dir", str(user_storage_dir))

    db_path = tmp_path / "events.db"
    engine = create_engine(
        f"sqlite:///{db_path}",
        connect_args={"check_same_thread": False},
    )
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)

    app = FastAPI()
    app.include_router(mobile_router)

    def override_get_db():
        db = SessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db

    with TestClient(app) as client:
        yield client, SessionLocal, storage_dir

    engine.dispose()


def test_mobile_events_endpoint_persists_event_row_and_sets_cookie(mobile_events_client):
    client, SessionLocal, storage_dir = mobile_events_client

    resp = client.post(
        "/api/mobile/events",
        json={
            "name": "wiki_upload_cta_click",
            "props": {
                "session_id": "sess-1",
                "page": "wiki_product_detail",
                "route": "/m/wiki/product/p123",
                "source": "wiki_product_detail",
                "category": "shampoo",
                "product_id": "p123",
                "dwell_ms": 1280,
                "target_path": "/m/me/use",
                "extra": "kept",
            },
        },
    )

    assert resp.status_code == 200
    payload = resp.json()
    assert payload["status"] == "ok"
    event_id = payload["event_id"]
    owner_id = str(client.cookies.get("mx_device_id") or "").strip()
    assert owner_id

    with SessionLocal() as db:
        row = db.get(MobileClientEvent, event_id)
        assert row is not None
        assert row.owner_type == "device"
        assert row.owner_id == owner_id
        assert row.session_id == "sess-1"
        assert row.name == "wiki_upload_cta_click"
        assert row.page == "wiki_product_detail"
        assert row.route == "/m/wiki/product/p123"
        assert row.source == "wiki_product_detail"
        assert row.category == "shampoo"
        assert row.product_id == "p123"
        assert row.dwell_ms == 1280
        props = json.loads(row.props_json)
        assert props["target_path"] == "/m/me/use"
        assert props["extra"] == "kept"

    assert not (storage_dir / "doubao_runs" / event_id).exists()


def test_legacy_compare_events_endpoint_remains_compatible_and_writes_artifact(mobile_events_client):
    client, SessionLocal, storage_dir = mobile_events_client
    client.cookies.set("mx_device_id", "device-fixed")

    resp = client.post(
        "/api/mobile/compare/events",
        json={
            "name": "compare_run_error",
            "props": {
                "session_id": "sess-2",
                "page": "mobile_compare",
                "route": "/m/compare",
                "source": "m_compare",
                "category": "bodywash",
                "compare_id": "cmp-1",
                "stage": "stage2_struct",
                "error_code": "compare_failed",
                "detail": "stage2 failed",
                "http_status": 502,
            },
        },
    )

    assert resp.status_code == 200
    payload = resp.json()
    assert payload["status"] == "ok"
    event_id = payload["event_id"]

    with SessionLocal() as db:
        row = db.get(MobileClientEvent, event_id)
        assert row is not None
        assert row.owner_id == "device-fixed"
        assert row.session_id == "sess-2"
        assert row.name == "compare_run_error"
        assert row.category == "bodywash"
        assert row.compare_id == "cmp-1"
        assert row.stage == "stage2_struct"
        assert row.error_code == "compare_failed"
        assert row.error_detail == "stage2 failed"
        assert row.http_status == 502

    artifact_path = storage_dir / "doubao_runs" / event_id / "mobile_compare_event.json"
    assert artifact_path.exists()
    artifact = json.loads(artifact_path.read_text(encoding="utf-8"))
    assert artifact["trace_id"] == event_id
    assert artifact["owner_id"] == "device-fixed"
    assert artifact["event_name"] == "compare_run_error"


def test_mobile_location_reverse_endpoint_returns_city_fields(mobile_events_client, monkeypatch: pytest.MonkeyPatch):
    client, _SessionLocal, _storage_dir = mobile_events_client

    monkeypatch.setattr(
        mobile_routes,
        "reverse_mobile_location",
        lambda latitude, longitude: {
            "status": "resolved",
            "provider": "amap",
            "location_city": "上海市",
            "location_district": "浦东新区",
            "location_province": "上海市",
            "location_formatted_address": "上海市浦东新区世纪大道",
            "location_city_code": "021",
            "location_adcode": "310115",
        },
    )

    resp = client.post(
        "/api/mobile/location/reverse",
        json={
            "latitude": 31.23,
            "longitude": 121.47,
            "accuracy_m": 1200,
            "time_zone": "Asia/Shanghai",
        },
    )

    assert resp.status_code == 200
    payload = resp.json()
    assert payload["status"] == "resolved"
    assert payload["provider"] == "amap"
    assert payload["location_city"] == "上海市"
    assert payload["location_district"] == "浦东新区"


def test_mobile_events_endpoint_enriches_location_context_captured(mobile_events_client, monkeypatch: pytest.MonkeyPatch):
    client, SessionLocal, _storage_dir = mobile_events_client

    monkeypatch.setattr(
        mobile_routes,
        "reverse_mobile_location",
        lambda latitude, longitude: {
            "status": "resolved",
            "provider": "amap",
            "location_city": "上海市",
            "location_district": "浦东新区",
            "location_province": "上海市",
            "location_formatted_address": "上海市浦东新区世纪大道",
            "location_city_code": "021",
            "location_adcode": "310115",
        },
    )

    resp = client.post(
        "/api/mobile/events",
        json={
            "name": "location_context_captured",
            "props": {
                "session_id": "sess-geo-1",
                "page": "selection_profile",
                "route": "/m/shampoo/profile",
                "source": "mobile_profile_location_consent:shampoo",
                "category": "shampoo",
                "location_permission": "granted",
                "location_source": "browser_geolocation",
                "location_precision": "coarse",
                "location_latitude": 31.23,
                "location_longitude": 121.47,
                "location_accuracy_m": 1200,
                "location_time_zone": "Asia/Shanghai",
                "location_label": "31.230, 121.470 +-1200m",
            },
        },
    )

    assert resp.status_code == 200
    event_id = resp.json()["event_id"]

    with SessionLocal() as db:
        row = db.get(MobileClientEvent, event_id)
        assert row is not None
        props = json.loads(row.props_json)
        assert props["location_geocode_status"] == "resolved"
        assert props["location_geocode_provider"] == "amap"
        assert props["location_city"] == "上海市"
        assert props["location_district"] == "浦东新区"
        assert props["location_label"] == "上海市 浦东新区 · 31.230, 121.470 · 约1.2km"


def test_mobile_compare_history_cleanup_preview_and_delete(mobile_events_client):
    client, SessionLocal, _storage_dir = mobile_events_client
    client.cookies.set("mx_device_id", "device-cleanup")

    with SessionLocal() as db:
        db.add_all(
            [
                MobileCompareSessionIndex(
                    compare_id="cmp-old-done",
                    owner_type="device",
                    owner_id="device-cleanup",
                    category="shampoo",
                    status="done",
                    message="old done",
                    created_at="2025-09-01T00:00:00.000000Z",
                    updated_at="2025-09-01T00:00:00.000000Z",
                ),
                MobileCompareSessionIndex(
                    compare_id="cmp-old-failed",
                    owner_type="device",
                    owner_id="device-cleanup",
                    category="bodywash",
                    status="failed",
                    message="old failed",
                    created_at="2025-09-10T00:00:00.000000Z",
                    updated_at="2025-09-10T00:00:00.000000Z",
                ),
                MobileCompareSessionIndex(
                    compare_id="cmp-recent-done",
                    owner_type="device",
                    owner_id="device-cleanup",
                    category="cleanser",
                    status="done",
                    message="recent done",
                    created_at="2026-03-10T00:00:00.000000Z",
                    updated_at="2026-03-10T00:00:00.000000Z",
                ),
            ]
        )
        db.commit()

    preview = client.post(
        "/api/mobile/compare/sessions/cleanup/preview",
        json={"older_than_days": 90, "statuses": ["done", "failed"], "limit_preview": 10},
    )
    assert preview.status_code == 200
    preview_payload = preview.json()
    assert preview_payload["matched_count"] == 2
    assert [item["compare_id"] for item in preview_payload["sample"]] == ["cmp-old-done", "cmp-old-failed"]

    deleted = client.post(
        "/api/mobile/compare/sessions/cleanup/delete",
        json={"older_than_days": 90, "statuses": ["done", "failed"], "limit_preview": 10},
    )
    assert deleted.status_code == 200
    deleted_payload = deleted.json()
    assert deleted_payload["deleted_ids"] == ["cmp-old-done", "cmp-old-failed"]

    with SessionLocal() as db:
        assert db.get(MobileCompareSessionIndex, "cmp-old-done") is None
        assert db.get(MobileCompareSessionIndex, "cmp-old-failed") is None
        assert db.get(MobileCompareSessionIndex, "cmp-recent-done") is not None


def test_mobile_selection_history_cleanup_preview_and_delete(mobile_events_client):
    client, SessionLocal, _storage_dir = mobile_events_client
    client.cookies.set("mx_device_id", "device-selection-cleanup")

    with SessionLocal() as db:
        db.add_all(
            [
                MobileSelectionSession(
                    id="sel-old",
                    owner_type="device",
                    owner_id="device-selection-cleanup",
                    category="shampoo",
                    rules_version="2026-03-03",
                    answers_hash="old",
                    route_key="deep-oil-control",
                    route_title="深层控油型",
                    product_id=None,
                    answers_json="{}",
                    result_json="{}",
                    is_pinned=False,
                    created_at="2025-09-01T00:00:00.000000Z",
                ),
                MobileSelectionSession(
                    id="sel-old-pinned",
                    owner_type="device",
                    owner_id="device-selection-cleanup",
                    category="bodywash",
                    rules_version="2026-03-03",
                    answers_hash="old-pinned",
                    route_key="rescue",
                    route_title="恒温舒缓修护型",
                    product_id=None,
                    answers_json="{}",
                    result_json="{}",
                    is_pinned=True,
                    pinned_at="2026-01-01T00:00:00.000000Z",
                    created_at="2025-09-01T00:00:00.000000Z",
                ),
                MobileSelectionSession(
                    id="sel-recent",
                    owner_type="device",
                    owner_id="device-selection-cleanup",
                    category="cleanser",
                    rules_version="2026-03-03",
                    answers_hash="recent",
                    route_key="gentle",
                    route_title="温和净澈型",
                    product_id=None,
                    answers_json="{}",
                    result_json="{}",
                    is_pinned=False,
                    created_at="2026-03-10T00:00:00.000000Z",
                ),
            ]
        )
        db.commit()

    preview = client.post(
        "/api/mobile/selection/sessions/cleanup/preview",
        json={"older_than_days": 90, "exclude_pinned": True, "limit_preview": 10},
    )
    assert preview.status_code == 200
    preview_payload = preview.json()
    assert preview_payload["matched_count"] == 1
    assert preview_payload["sample"][0]["session_id"] == "sel-old"

    deleted = client.post(
        "/api/mobile/selection/sessions/cleanup/delete",
        json={"older_than_days": 90, "exclude_pinned": True, "limit_preview": 10},
    )
    assert deleted.status_code == 200
    deleted_payload = deleted.json()
    assert deleted_payload["deleted_ids"] == ["sel-old"]

    with SessionLocal() as db:
        old_row = db.get(MobileSelectionSession, "sel-old")
        pinned_row = db.get(MobileSelectionSession, "sel-old-pinned")
        recent_row = db.get(MobileSelectionSession, "sel-recent")
        assert old_row is not None and old_row.deleted_at is not None
        assert pinned_row is not None and pinned_row.deleted_at is None
        assert recent_row is not None and recent_row.deleted_at is None
