import json
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import app.routes.mobile as mobile_routes
from app.db.models import Base, MobileClientEvent
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
