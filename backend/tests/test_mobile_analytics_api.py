from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db.models import Base, MobileClientEvent
from app.db.session import get_db
from app.routes.products import router as products_router
from app.settings import settings


@pytest.fixture
def mobile_analytics_client(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    storage_dir = tmp_path / "storage"
    storage_dir.mkdir(parents=True, exist_ok=True)
    monkeypatch.setattr(settings, "storage_dir", str(storage_dir))
    user_storage_dir = tmp_path / "user_storage"
    user_storage_dir.mkdir(parents=True, exist_ok=True)
    monkeypatch.setattr(settings, "user_storage_dir", str(user_storage_dir))

    db_path = tmp_path / "analytics.db"
    engine = create_engine(
        f"sqlite:///{db_path}",
        connect_args={"check_same_thread": False},
    )
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)

    app = FastAPI()
    app.include_router(products_router)

    def override_get_db():
        db = SessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db

    with SessionLocal() as db:
        rows = [
            MobileClientEvent(
                event_id="evt-001",
                owner_type="device",
                owner_id="owner-alpha",
                session_id="sess-1",
                name="page_view",
                page="wiki_product_detail",
                route="/m/wiki/product/p-1",
                source="wiki_product_detail",
                category="shampoo",
                product_id="p-1",
                created_at="2026-03-12T01:00:00.000000Z",
                props_json='{"client_ts":"2026-03-12T01:00:00.000Z"}',
            ),
            MobileClientEvent(
                event_id="evt-002",
                owner_type="device",
                owner_id="owner-alpha",
                session_id="sess-1",
                name="wiki_upload_cta_expose",
                page="wiki_product_detail",
                route="/m/wiki/product/p-1",
                source="wiki_product_detail",
                category="shampoo",
                product_id="p-1",
                created_at="2026-03-12T01:00:01.000000Z",
                props_json='{"target_path":"/m/me/use"}',
            ),
            MobileClientEvent(
                event_id="evt-003",
                owner_type="device",
                owner_id="owner-alpha",
                session_id="sess-1",
                name="wiki_upload_cta_click",
                page="wiki_product_detail",
                route="/m/wiki/product/p-1",
                source="wiki_product_detail",
                category="shampoo",
                product_id="p-1",
                created_at="2026-03-12T01:00:02.000000Z",
                props_json='{"target_path":"/m/me/use"}',
            ),
            MobileClientEvent(
                event_id="evt-004",
                owner_type="device",
                owner_id="owner-alpha",
                session_id="sess-1",
                name="page_view",
                page="my_use",
                route="/m/me/use",
                source="wiki_product_detail",
                category="shampoo",
                created_at="2026-03-12T01:00:03.000000Z",
                props_json="{}",
            ),
            MobileClientEvent(
                event_id="evt-005",
                owner_type="device",
                owner_id="owner-alpha",
                session_id="sess-1",
                name="my_use_category_card_click",
                page="my_use",
                route="/m/me/use",
                source="wiki_product_detail",
                category="shampoo",
                created_at="2026-03-12T01:00:04.000000Z",
                props_json='{"target_path":"/m/compare?category=shampoo"}',
            ),
            MobileClientEvent(
                event_id="evt-006",
                owner_type="device",
                owner_id="owner-alpha",
                session_id="sess-1",
                name="page_view",
                page="mobile_compare",
                route="/m/compare",
                source="m_compare",
                category="shampoo",
                created_at="2026-03-12T01:00:05.000000Z",
                props_json="{}",
            ),
            MobileClientEvent(
                event_id="evt-007",
                owner_type="device",
                owner_id="owner-alpha",
                session_id="sess-1",
                name="compare_run_start",
                page="mobile_compare",
                route="/m/compare",
                source="m_compare",
                category="shampoo",
                compare_id="cmp-1",
                created_at="2026-03-12T01:00:06.000000Z",
                props_json='{"run_mode":"with_upload","selected_library_count":1,"total_count":2}',
            ),
            MobileClientEvent(
                event_id="evt-008",
                owner_type="device",
                owner_id="owner-alpha",
                session_id="sess-1",
                name="compare_stage_progress",
                page="mobile_compare",
                route="/m/compare",
                source="m_compare",
                category="shampoo",
                compare_id="cmp-1",
                stage="prepare",
                created_at="2026-03-12T01:00:07.000000Z",
                props_json='{"stage_label":"准备对比任务"}',
            ),
            MobileClientEvent(
                event_id="evt-009",
                owner_type="device",
                owner_id="owner-alpha",
                session_id="sess-1",
                name="compare_stage_progress",
                page="mobile_compare",
                route="/m/compare",
                source="m_compare",
                category="shampoo",
                compare_id="cmp-1",
                stage="stage1_vision",
                created_at="2026-03-12T01:00:09.000000Z",
                props_json='{"stage_label":"识别图片文字"}',
            ),
            MobileClientEvent(
                event_id="evt-010",
                owner_type="device",
                owner_id="owner-alpha",
                session_id="sess-1",
                name="compare_stage_progress",
                page="mobile_compare",
                route="/m/compare",
                source="m_compare",
                category="shampoo",
                compare_id="cmp-1",
                stage="finalize",
                created_at="2026-03-12T01:00:13.000000Z",
                props_json='{"stage_label":"整理最终结论"}',
            ),
            MobileClientEvent(
                event_id="evt-011",
                owner_type="device",
                owner_id="owner-alpha",
                session_id="sess-1",
                name="compare_run_success",
                page="mobile_compare",
                route="/m/compare",
                source="m_compare",
                category="shampoo",
                compare_id="cmp-1",
                created_at="2026-03-12T01:00:15.000000Z",
                props_json='{"pair_count":1}',
            ),
            MobileClientEvent(
                event_id="evt-012",
                owner_type="device",
                owner_id="owner-alpha",
                session_id="sess-1",
                name="compare_result_view",
                page="compare_result",
                route="/m/compare/result/cmp-1",
                source="compare_result",
                category="shampoo",
                compare_id="cmp-1",
                created_at="2026-03-12T01:00:16.000000Z",
                props_json='{"decision":"keep","confidence":0.88}',
            ),
            MobileClientEvent(
                event_id="evt-013",
                owner_type="device",
                owner_id="owner-beta",
                session_id="sess-2",
                name="page_view",
                page="wiki_product_detail",
                route="/m/wiki/product/p-2",
                source="wiki_product_detail",
                category="bodywash",
                product_id="p-2",
                created_at="2026-03-12T02:00:00.000000Z",
                props_json="{}",
            ),
            MobileClientEvent(
                event_id="evt-014",
                owner_type="device",
                owner_id="owner-beta",
                session_id="sess-2",
                name="wiki_upload_cta_expose",
                page="wiki_product_detail",
                route="/m/wiki/product/p-2",
                source="wiki_product_detail",
                category="bodywash",
                product_id="p-2",
                created_at="2026-03-12T02:00:01.000000Z",
                props_json="{}",
            ),
            MobileClientEvent(
                event_id="evt-015",
                owner_type="device",
                owner_id="owner-beta",
                session_id="sess-2",
                name="page_view",
                page="my_use",
                route="/m/me/use",
                source="wiki_product_detail",
                category="bodywash",
                created_at="2026-03-12T02:00:02.000000Z",
                props_json="{}",
            ),
            MobileClientEvent(
                event_id="evt-016",
                owner_type="device",
                owner_id="owner-beta",
                session_id="sess-2",
                name="my_use_category_card_click",
                page="my_use",
                route="/m/me/use",
                source="wiki_product_detail",
                category="bodywash",
                created_at="2026-03-12T02:00:03.000000Z",
                props_json='{"target_path":"/m/compare?category=bodywash"}',
            ),
            MobileClientEvent(
                event_id="evt-017",
                owner_type="device",
                owner_id="owner-beta",
                session_id="sess-2",
                name="page_view",
                page="mobile_compare",
                route="/m/compare",
                source="m_compare",
                category="bodywash",
                created_at="2026-03-12T02:00:04.000000Z",
                props_json="{}",
            ),
            MobileClientEvent(
                event_id="evt-018",
                owner_type="device",
                owner_id="owner-beta",
                session_id="sess-2",
                name="compare_upload_fail",
                page="mobile_compare",
                route="/m/compare",
                source="m_compare",
                category="bodywash",
                stage="uploading",
                error_code="upload_failed",
                error_detail="upload gateway timeout",
                http_status=504,
                created_at="2026-03-12T02:00:05.000000Z",
                props_json='{"trigger_reason":"compare_upload_fail","stage_label":"上传当前在用产品"}',
            ),
            MobileClientEvent(
                event_id="evt-019",
                owner_type="device",
                owner_id="owner-beta",
                session_id="sess-2",
                name="feedback_prompt_show",
                page="mobile_compare",
                route="/m/compare",
                source="m_compare",
                category="bodywash",
                stage="uploading",
                created_at="2026-03-12T02:00:06.000000Z",
                props_json='{"trigger_reason":"compare_upload_fail"}',
            ),
            MobileClientEvent(
                event_id="evt-020",
                owner_type="device",
                owner_id="owner-beta",
                session_id="sess-2",
                name="feedback_submit",
                page="mobile_compare",
                route="/m/compare",
                source="m_compare",
                category="bodywash",
                stage="uploading",
                created_at="2026-03-12T02:00:07.000000Z",
                props_json='{"trigger_reason":"compare_upload_fail","reason_label":"too_much_work","reason_text":"太繁琐"}',
            ),
            MobileClientEvent(
                event_id="evt-021",
                owner_type="device",
                owner_id="owner-beta",
                session_id="sess-3",
                name="page_view",
                page="mobile_compare",
                route="/m/compare",
                source="m_compare",
                category="shampoo",
                created_at="2026-03-12T03:00:00.000000Z",
                props_json="{}",
            ),
            MobileClientEvent(
                event_id="evt-022",
                owner_type="device",
                owner_id="owner-beta",
                session_id="sess-3",
                name="compare_run_start",
                page="mobile_compare",
                route="/m/compare",
                source="m_compare",
                category="shampoo",
                compare_id="cmp-2",
                created_at="2026-03-12T03:00:01.000000Z",
                props_json='{"run_mode":"library_only","selected_library_count":2,"total_count":2}',
            ),
            MobileClientEvent(
                event_id="evt-023",
                owner_type="device",
                owner_id="owner-beta",
                session_id="sess-3",
                name="compare_stage_progress",
                page="mobile_compare",
                route="/m/compare",
                source="m_compare",
                category="shampoo",
                compare_id="cmp-2",
                stage="prepare",
                created_at="2026-03-12T03:00:02.000000Z",
                props_json='{"stage_label":"准备对比任务"}',
            ),
            MobileClientEvent(
                event_id="evt-024",
                owner_type="device",
                owner_id="owner-beta",
                session_id="sess-3",
                name="compare_stage_error",
                page="mobile_compare",
                route="/m/compare",
                source="m_compare",
                category="shampoo",
                compare_id="cmp-2",
                stage="stage2_struct",
                error_code="compare_failed",
                error_detail="stage2 unavailable",
                http_status=502,
                created_at="2026-03-12T03:00:03.000000Z",
                props_json='{"trigger_reason":"compare_stage_error","stage_label":"结构化成分信息"}',
            ),
            MobileClientEvent(
                event_id="evt-025",
                owner_type="device",
                owner_id="owner-beta",
                session_id="sess-3",
                name="feedback_prompt_show",
                page="mobile_compare",
                route="/m/compare",
                source="m_compare",
                category="shampoo",
                compare_id="cmp-2",
                stage="stage2_struct",
                created_at="2026-03-12T03:00:04.000000Z",
                props_json='{"trigger_reason":"compare_stage_error","stage_label":"结构化成分信息"}',
            ),
        ]
        db.add_all(rows)
        db.commit()

    with TestClient(app) as client:
        yield client

    engine.dispose()


def test_mobile_analytics_overview_and_funnel(mobile_analytics_client: TestClient):
    client = mobile_analytics_client
    query = "date_from=2026-03-10&date_to=2026-03-12"

    overview = client.get(f"/api/products/analytics/mobile/overview?{query}")
    assert overview.status_code == 200
    payload = overview.json()
    assert payload["sessions"] == 3
    assert payload["owners"] == 2
    assert payload["wiki_detail_views"] == 2
    assert payload["cta_expose"] == 2
    assert payload["cta_click"] == 1
    assert payload["compare_run_start"] == 2
    assert payload["compare_run_success"] == 1
    assert payload["compare_result_view"] == 1
    assert payload["feedback_prompt_show"] == 2
    assert payload["feedback_submit"] == 1
    assert payload["compare_completion_rate"] == 0.5
    assert payload["feedback_submit_rate"] == 0.5

    funnel = client.get(f"/api/products/analytics/mobile/funnel?{query}")
    assert funnel.status_code == 200
    steps = {item["step_key"]: item for item in funnel.json()["steps"]}
    assert steps["wiki_detail_view"]["count"] == 2
    assert steps["wiki_upload_cta_click"]["count"] == 1
    assert steps["my_use_page_view"]["count"] == 2
    assert steps["compare_page_view"]["count"] == 3
    assert steps["compare_run_start"]["count"] == 2
    assert steps["compare_result_view"]["count"] == 1


def test_mobile_analytics_errors_feedback_and_sessions(mobile_analytics_client: TestClient):
    client = mobile_analytics_client
    query = "date_from=2026-03-10&date_to=2026-03-12"

    errors = client.get(f"/api/products/analytics/mobile/errors?{query}")
    assert errors.status_code == 200
    error_payload = errors.json()
    assert error_payload["compare_run_start"] == 2
    assert error_payload["total_errors"] == 2
    by_stage = {item["key"]: item for item in error_payload["by_stage"]}
    assert by_stage["uploading"]["count"] == 1
    assert by_stage["stage2_struct"]["count"] == 1
    by_error_code = {item["key"]: item for item in error_payload["by_error_code"]}
    assert by_error_code["upload_failed"]["count"] == 1
    assert by_error_code["compare_failed"]["count"] == 1
    duration_items = {item["stage"]: item for item in error_payload["stage_duration_estimates"]}
    assert duration_items["prepare"]["samples"] >= 1

    feedback = client.get(f"/api/products/analytics/mobile/feedback?{query}")
    assert feedback.status_code == 200
    feedback_payload = feedback.json()
    assert feedback_payload["total_prompts"] == 2
    assert feedback_payload["total_submissions"] == 1
    trigger_counts = {item["key"]: item["count"] for item in feedback_payload["by_trigger_reason"]}
    assert trigger_counts["compare_upload_fail"] == 1
    assert trigger_counts["compare_stage_error"] == 1
    reason_counts = {item["key"]: item["count"] for item in feedback_payload["by_reason_label"]}
    assert reason_counts["too_much_work"] == 1
    assert feedback_payload["recent_text_samples"][0]["reason_text"] == "太繁琐"

    sessions = client.get(f"/api/products/analytics/mobile/sessions?{query}&compare_id=cmp-1")
    assert sessions.status_code == 200
    sessions_payload = sessions.json()
    assert sessions_payload["selected_compare_id"] == "cmp-1"
    assert sessions_payload["selected_session_id"] == "sess-1"
    assert sessions_payload["total"] >= 1
    assert any(item["name"] == "compare_run_success" for item in sessions_payload["timeline"])
    assert any(item["name"] == "compare_result_view" for item in sessions_payload["timeline"])
