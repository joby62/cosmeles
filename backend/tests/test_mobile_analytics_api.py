from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db.models import Base, MobileClientEvent
from app.db.session import get_db
from app.routes.products import (
    _event_location_label,
    _event_location_region_label,
    router as products_router,
)
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
                props_json='{"client_ts":"2026-03-12T01:00:00.000Z","browser_family":"safari","os_family":"ios","device_type":"phone","viewport_bucket":"md","network_type":"4g","lang":"zh-CN","device_memory_bucket":"4gb","cpu_core_bucket":"6","touch_points_bucket":"5_plus","online_state":"online"}',
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
                event_id="evt-003a",
                owner_type="device",
                owner_id="owner-alpha",
                session_id="sess-1",
                name="home_primary_cta_click",
                page="selection_home",
                route="/m",
                source="m_home",
                category="shampoo",
                created_at="2026-03-12T01:00:02.100000Z",
                props_json='{"target_path":"/m/choose?category=shampoo"}',
            ),
            MobileClientEvent(
                event_id="evt-003aa",
                owner_type="device",
                owner_id="owner-alpha",
                session_id="sess-1",
                name="home_workspace_quick_action_click",
                page="selection_home",
                route="/m",
                source="m_home_workspace",
                category="shampoo",
                created_at="2026-03-12T01:00:02.150000Z",
                props_json='{"target_path":"/m/compare?category=shampoo","action":"compare"}',
            ),
            MobileClientEvent(
                event_id="evt-003b",
                owner_type="device",
                owner_id="owner-alpha",
                session_id="sess-1",
                name="choose_view",
                page="selection_choose",
                route="/m/choose?category=shampoo",
                source="m_choose",
                category="shampoo",
                created_at="2026-03-12T01:00:02.200000Z",
                props_json="{}",
            ),
            MobileClientEvent(
                event_id="evt-003c",
                owner_type="device",
                owner_id="owner-alpha",
                session_id="sess-1",
                name="choose_start_click",
                page="selection_choose",
                route="/m/choose?category=shampoo",
                source="m_choose",
                category="shampoo",
                created_at="2026-03-12T01:00:02.300000Z",
                props_json='{"target_path":"/m/shampoo/profile"}',
            ),
            MobileClientEvent(
                event_id="evt-003d",
                owner_type="device",
                owner_id="owner-alpha",
                session_id="sess-1",
                name="questionnaire_completed",
                page="selection_profile",
                route="/m/shampoo/profile",
                source="m_profile",
                category="shampoo",
                created_at="2026-03-12T01:00:02.900000Z",
                props_json='{"question_count":4}',
            ),
            MobileClientEvent(
                event_id="evt-003e",
                owner_type="device",
                owner_id="owner-alpha",
                session_id="sess-1",
                name="questionnaire_view",
                page="selection_profile",
                route="/m/shampoo/profile",
                source="m_profile",
                category="shampoo",
                created_at="2026-03-12T01:00:02.310000Z",
                props_json='{"category":"shampoo","step":1}',
            ),
            MobileClientEvent(
                event_id="evt-003f",
                owner_type="device",
                owner_id="owner-alpha",
                session_id="sess-1",
                name="questionnaire_view",
                page="selection_profile",
                route="/m/shampoo/profile",
                source="m_profile",
                category="shampoo",
                created_at="2026-03-12T01:00:02.320000Z",
                props_json='{"category":"shampoo","step":1,"question_key":"legacy_shampoo_step_1","question_title":"旧头皮状态"}',
            ),
            MobileClientEvent(
                event_id="evt-003g",
                owner_type="device",
                owner_id="owner-alpha",
                session_id="sess-1",
                name="question_answered",
                page="selection_profile",
                route="/m/shampoo/profile",
                source="m_profile",
                category="shampoo",
                created_at="2026-03-12T01:00:02.330000Z",
                props_json='{"category":"shampoo","step":1}',
            ),
            MobileClientEvent(
                event_id="evt-003h",
                owner_type="device",
                owner_id="owner-alpha",
                session_id="sess-1",
                name="questionnaire_view",
                page="selection_profile",
                route="/m/shampoo/profile",
                source="m_profile",
                category="shampoo",
                created_at="2026-03-12T01:00:02.340000Z",
                props_json='{"category":"shampoo","step":2}',
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
                props_json='{"browser_family":"safari","os_family":"ios","device_type":"phone","viewport_bucket":"md","network_type":"4g","lang":"zh-CN"}',
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
                props_json='{"browser_family":"safari","os_family":"ios","device_type":"phone","viewport_bucket":"md","network_type":"4g","lang":"zh-CN"}',
            ),
            MobileClientEvent(
                event_id="evt-006b",
                owner_type="device",
                owner_id="owner-alpha",
                session_id="sess-1",
                name="location_context_captured",
                page="mobile_compare",
                route="/m/compare",
                source="mobile_profile_location_consent:shampoo",
                category="shampoo",
                created_at="2026-03-12T01:00:05.500000Z",
                props_json='{"detail":"气候微调授权成功 · 近似位置 31.230, 121.470 +-1200m · Asia/Shanghai","location_permission":"granted","location_source":"browser_geolocation","location_precision":"coarse","location_latitude":31.23,"location_longitude":121.47,"location_accuracy_m":1200,"location_time_zone":"Asia/Shanghai","location_label":"31.230, 121.470 +-1200m · Asia/Shanghai"}',
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
                props_json='{"run_mode":"with_upload","selected_library_count":1,"total_count":2,"location_permission":"granted","location_source":"browser_geolocation","location_precision":"coarse","location_latitude":31.23,"location_longitude":121.47,"location_accuracy_m":1200,"location_time_zone":"Asia/Shanghai","location_label":"31.230, 121.470 +-1200m · Asia/Shanghai"}',
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
                props_json='{"decision":"keep","confidence":0.88,"location_permission":"granted","location_source":"browser_geolocation","location_precision":"coarse","location_latitude":31.23,"location_longitude":121.47,"location_accuracy_m":1200,"location_time_zone":"Asia/Shanghai","location_label":"31.230, 121.470 +-1200m · Asia/Shanghai"}',
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
                props_json='{"browser_family":"chrome","os_family":"android","device_type":"phone","viewport_bucket":"md","network_type":"3g","lang":"zh-CN","device_memory_bucket":"4gb","cpu_core_bucket":"8","touch_points_bucket":"5_plus","online_state":"online"}',
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
                event_id="evt-017c",
                owner_type="device",
                owner_id="owner-beta",
                session_id="sess-2",
                name="home_primary_cta_click",
                page="selection_home",
                route="/m",
                source="m_home",
                category="bodywash",
                created_at="2026-03-12T02:00:04.050000Z",
                props_json='{"target_path":"/m/choose?category=bodywash"}',
            ),
            MobileClientEvent(
                event_id="evt-017d",
                owner_type="device",
                owner_id="owner-beta",
                session_id="sess-2",
                name="choose_view",
                page="selection_choose",
                route="/m/choose?category=bodywash",
                source="m_choose",
                category="bodywash",
                created_at="2026-03-12T02:00:04.100000Z",
                props_json="{}",
            ),
            MobileClientEvent(
                event_id="evt-017e",
                owner_type="device",
                owner_id="owner-beta",
                session_id="sess-2",
                name="questionnaire_view",
                page="selection_profile",
                route="/m/bodywash/profile",
                source="m_profile",
                category="bodywash",
                created_at="2026-03-12T02:00:04.120000Z",
                props_json='{"category":"bodywash","step":1}',
            ),
            MobileClientEvent(
                event_id="evt-017f",
                owner_type="device",
                owner_id="owner-beta",
                session_id="sess-2",
                name="questionnaire_view",
                page="selection_profile",
                route="/m/bodywash/profile",
                source="m_profile",
                category="bodywash",
                created_at="2026-03-12T02:00:04.130000Z",
                props_json='{"category":"bodywash","step":1,"question_key":"legacy_bodywash_step_1","question_title":"旧清洁力度"}',
            ),
            MobileClientEvent(
                event_id="evt-017g",
                owner_type="device",
                owner_id="owner-beta",
                session_id="sess-2",
                name="questionnaire_view",
                page="selection_profile",
                route="/m/bodywash/profile",
                source="m_profile",
                category="bodywash",
                created_at="2026-03-12T02:00:04.140000Z",
                props_json='{"category":"bodywash","question_key":"q_bodywash_invalid","question_title":"缺失 step"}',
            ),
            MobileClientEvent(
                event_id="evt-017h",
                owner_type="device",
                owner_id="owner-beta",
                session_id="sess-2",
                name="question_answered",
                page="selection_profile",
                route="/m/bodywash/profile",
                source="m_profile",
                category="bodywash",
                created_at="2026-03-12T02:00:04.150000Z",
                props_json='{"category":"bodywash","question_key":"q_bodywash_invalid","question_title":"缺失 step"}',
            ),
            MobileClientEvent(
                event_id="evt-017b",
                owner_type="device",
                owner_id="owner-beta",
                session_id="sess-2",
                name="location_context_captured",
                page="mobile_compare",
                route="/m/compare",
                source="mobile_profile_location_consent:bodywash",
                category="bodywash",
                created_at="2026-03-12T02:00:04.500000Z",
                props_json='{"detail":"气候微调授权成功 · 近似位置 35.680, 139.760 +-4800m · Asia/Tokyo","location_permission":"granted","location_source":"browser_geolocation","location_precision":"coarse","location_latitude":35.68,"location_longitude":139.76,"location_accuracy_m":4800,"location_time_zone":"Asia/Tokyo","location_label":"35.680, 139.760 +-4800m · Asia/Tokyo"}',
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
                props_json='{"trigger_reason":"compare_upload_fail","stage_label":"上传当前在用产品","location_permission":"granted","location_source":"browser_geolocation","location_precision":"coarse","location_latitude":35.68,"location_longitude":139.76,"location_accuracy_m":4800,"location_time_zone":"Asia/Tokyo","location_label":"35.680, 139.760 +-4800m · Asia/Tokyo"}',
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
                event_id="evt-021a",
                owner_type="device",
                owner_id="owner-beta",
                session_id="sess-3",
                name="home_primary_cta_click",
                page="selection_home",
                route="/m",
                source="m_home",
                category="shampoo",
                created_at="2026-03-12T03:00:00.050000Z",
                props_json='{"target_path":"/m/choose?category=shampoo"}',
            ),
            MobileClientEvent(
                event_id="evt-021b",
                owner_type="device",
                owner_id="owner-beta",
                session_id="sess-3",
                name="choose_view",
                page="selection_choose",
                route="/m/choose?category=shampoo",
                source="m_choose",
                category="shampoo",
                created_at="2026-03-12T03:00:00.100000Z",
                props_json="{}",
            ),
            MobileClientEvent(
                event_id="evt-021c",
                owner_type="device",
                owner_id="owner-beta",
                session_id="sess-3",
                name="choose_start_click",
                page="selection_choose",
                route="/m/choose?category=shampoo",
                source="m_choose",
                category="shampoo",
                created_at="2026-03-12T03:00:00.150000Z",
                props_json='{"target_path":"/m/shampoo/profile"}',
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
            MobileClientEvent(
                event_id="evt-026",
                owner_type="device",
                owner_id="owner-gamma",
                session_id="sess-4",
                name="wiki_list_view",
                page="wiki_list",
                route="/m/wiki",
                source="m_wiki",
                category="shampoo",
                created_at="2026-03-12T04:00:00.000000Z",
                props_json='{"entry_tab":"product","visible_count":24,"total_count":48,"browser_family":"chrome","os_family":"android","device_type":"phone","viewport_bucket":"md","network_type":"4g","lang":"zh-CN","device_memory_bucket":"8gb","cpu_core_bucket":"8","touch_points_bucket":"5_plus","online_state":"online"}',
            ),
            MobileClientEvent(
                event_id="evt-027",
                owner_type="device",
                owner_id="owner-gamma",
                session_id="sess-4",
                name="wiki_product_click",
                page="wiki_list",
                route="/m/wiki",
                source="m_wiki",
                category="shampoo",
                product_id="p-5",
                created_at="2026-03-12T04:00:01.000000Z",
                props_json='{"position":1,"featured":true,"target_path":"/m/wiki/product/p-5"}',
            ),
            MobileClientEvent(
                event_id="evt-028",
                owner_type="device",
                owner_id="owner-gamma",
                session_id="sess-5",
                name="wiki_list_view",
                page="wiki_list",
                route="/m/wiki?tab=ingredient",
                source="m_wiki",
                category="shampoo",
                created_at="2026-03-12T04:05:00.000000Z",
                props_json='{"entry_tab":"ingredient","visible_count":24,"total_count":60,"browser_family":"chrome","os_family":"android","device_type":"phone","viewport_bucket":"md","network_type":"4g","lang":"en-US","device_memory_bucket":"8gb","cpu_core_bucket":"8","touch_points_bucket":"5_plus","online_state":"online"}',
            ),
            MobileClientEvent(
                event_id="evt-029",
                owner_type="device",
                owner_id="owner-gamma",
                session_id="sess-5",
                name="wiki_ingredient_click",
                page="wiki_list",
                route="/m/wiki?tab=ingredient",
                source="m_wiki",
                category="shampoo",
                created_at="2026-03-12T04:05:01.000000Z",
                props_json='{"position":1,"target_path":"/m/wiki/ingredients/ing-1"}',
            ),
            MobileClientEvent(
                event_id="evt-030",
                owner_type="device",
                owner_id="owner-alpha",
                session_id="sess-1",
                name="compare_result_leave",
                page="compare_result",
                route="/m/compare/result/cmp-1",
                source="m_compare_result",
                category="shampoo",
                compare_id="cmp-1",
                created_at="2026-03-12T01:00:18.000000Z",
                props_json='{"dwell_ms":18200,"max_depth_percent":100,"exit_type":"unmount","location_permission":"granted","location_source":"browser_geolocation","location_precision":"coarse","location_latitude":31.23,"location_longitude":121.47,"location_accuracy_m":1200,"location_time_zone":"Asia/Shanghai","location_label":"31.230, 121.470 +-1200m · Asia/Shanghai"}',
            ),
            MobileClientEvent(
                event_id="evt-031",
                owner_type="device",
                owner_id="owner-alpha",
                session_id="sess-1",
                name="scroll_depth",
                page="compare_result",
                route="/m/compare/result/cmp-1",
                source="m_compare_result",
                category="shampoo",
                compare_id="cmp-1",
                created_at="2026-03-12T01:00:17.000000Z",
                props_json='{"depth_percent":75,"max_depth_percent":79}',
            ),
            MobileClientEvent(
                event_id="evt-032",
                owner_type="device",
                owner_id="owner-alpha",
                session_id="sess-1",
                name="scroll_depth",
                page="compare_result",
                route="/m/compare/result/cmp-1",
                source="m_compare_result",
                category="shampoo",
                compare_id="cmp-1",
                created_at="2026-03-12T01:00:17.500000Z",
                props_json='{"depth_percent":100,"max_depth_percent":100}',
            ),
            MobileClientEvent(
                event_id="evt-033",
                owner_type="device",
                owner_id="owner-alpha",
                session_id="sess-1",
                name="stall_detected",
                page="compare_result",
                route="/m/compare/result/cmp-1",
                source="m_compare_result",
                category="shampoo",
                compare_id="cmp-1",
                created_at="2026-03-12T01:00:17.700000Z",
                props_json='{"dwell_ms":19000,"idle_ms":18000}',
            ),
            MobileClientEvent(
                event_id="evt-034",
                owner_type="device",
                owner_id="owner-alpha",
                session_id="sess-1",
                name="rage_click",
                page="compare_result",
                route="/m/compare/result/cmp-1",
                source="m_compare_result",
                category="shampoo",
                compare_id="cmp-1",
                created_at="2026-03-12T01:00:17.800000Z",
                props_json='{"target_id":"result:cta:rerun-compare","click_count":3}',
            ),
            MobileClientEvent(
                event_id="evt-035",
                owner_type="device",
                owner_id="owner-alpha",
                session_id="sess-1",
                name="compare_result_cta_click",
                page="compare_result",
                route="/m/compare/result/cmp-1",
                source="m_compare_result",
                category="shampoo",
                compare_id="cmp-1",
                created_at="2026-03-12T01:00:17.900000Z",
                props_json='{"cta":"rerun_compare"}',
            ),
            MobileClientEvent(
                event_id="evt-036",
                owner_type="device",
                owner_id="owner-alpha",
                session_id="sess-1",
                name="compare_result_cta_click",
                page="compare_result",
                route="/m/compare/result/cmp-1",
                source="m_compare_result",
                category="shampoo",
                compare_id="cmp-1",
                created_at="2026-03-12T01:00:18.100000Z",
                props_json='{"cta":"recommendation_product"}',
            ),
            MobileClientEvent(
                event_id="evt-036b",
                owner_type="device",
                owner_id="owner-alpha",
                session_id="sess-1",
                name="compare_result_cta_land",
                page="mobile_compare",
                route="/m/compare?category=shampoo",
                source="m_compare_result",
                category="shampoo",
                compare_id="cmp-1",
                created_at="2026-03-12T01:00:18.050000Z",
                props_json='{"cta":"rerun_compare"}',
            ),
            MobileClientEvent(
                event_id="evt-036c",
                owner_type="device",
                owner_id="owner-alpha",
                session_id="sess-1",
                name="compare_result_cta_land",
                page="product_showcase",
                route="/product/p-9",
                source="m_compare_result",
                category="shampoo",
                compare_id="cmp-1",
                created_at="2026-03-12T01:00:18.150000Z",
                props_json='{"cta":"recommendation_product"}',
            ),
            MobileClientEvent(
                event_id="evt-036d",
                owner_type="device",
                owner_id="owner-alpha",
                session_id="sess-1",
                name="compare_run_start",
                page="mobile_compare",
                route="/m/compare?category=shampoo&source=compare_result&result_cta=rerun_compare&from_compare_id=cmp-1",
                source="m_compare_result",
                category="shampoo",
                compare_id="cmp-3",
                created_at="2026-03-12T01:00:18.060000Z",
                props_json='{"run_mode":"library_only","selected_library_count":2,"total_count":2,"result_cta":"rerun_compare","from_compare_id":"cmp-1"}',
            ),
            MobileClientEvent(
                event_id="evt-036e",
                owner_type="device",
                owner_id="owner-alpha",
                session_id="sess-1",
                name="product_showcase_continue_upload_click",
                page="product_showcase",
                route="/product/p-9",
                source="m_compare_result",
                category="shampoo",
                product_id="p-9",
                created_at="2026-03-12T01:00:18.160000Z",
                props_json='{"target_path":"/product/pipeline#product-ingest-workbench","result_cta":"recommendation_product","from_compare_id":"cmp-1"}',
            ),
            MobileClientEvent(
                event_id="evt-036f",
                owner_type="device",
                owner_id="owner-alpha",
                session_id="sess-1",
                name="bag_add_success",
                page="product_showcase",
                route="/product/p-9",
                source="m_compare_result",
                category="shampoo",
                product_id="p-9",
                created_at="2026-03-12T01:00:18.170000Z",
                props_json='{"result_cta":"recommendation_product","from_compare_id":"cmp-1"}',
            ),
            MobileClientEvent(
                event_id="evt-036g",
                owner_type="device",
                owner_id="owner-alpha",
                session_id="sess-1",
                name="compare_result_cta_click",
                page="compare_result",
                route="/m/compare/result/cmp-1",
                source="m_compare_result",
                category="shampoo",
                compare_id="cmp-1",
                created_at="2026-03-12T01:00:18.180000Z",
                props_json='{"cta":"recommendation_wiki"}',
            ),
            MobileClientEvent(
                event_id="evt-036h",
                owner_type="device",
                owner_id="owner-alpha",
                session_id="sess-1",
                name="compare_result_cta_land",
                page="wiki_category",
                route="/m/wiki/shampoo",
                source="m_compare_result",
                category="shampoo",
                compare_id="cmp-1",
                created_at="2026-03-12T01:00:18.190000Z",
                props_json='{"cta":"recommendation_wiki"}',
            ),
            MobileClientEvent(
                event_id="evt-036ha",
                owner_type="device",
                owner_id="owner-alpha",
                session_id="sess-1",
                name="compare_result_accept_recommendation",
                page="compare_result",
                route="/m/compare/result/cmp-1",
                source="m_compare_result",
                category="shampoo",
                compare_id="cmp-1",
                created_at="2026-03-12T01:00:18.191000Z",
                props_json='{"target_path":"/product/p-9"}',
            ),
            MobileClientEvent(
                event_id="evt-036hb",
                owner_type="device",
                owner_id="owner-alpha",
                session_id="sess-1",
                name="compare_result_keep_current",
                page="compare_result",
                route="/m/compare/result/cmp-1",
                source="m_compare_result",
                category="shampoo",
                compare_id="cmp-1",
                created_at="2026-03-12T01:00:18.192000Z",
                props_json='{"target_path":"/m/me/use?category=shampoo"}',
            ),
            MobileClientEvent(
                event_id="evt-036hc",
                owner_type="device",
                owner_id="owner-alpha",
                session_id="sess-1",
                name="rationale_view",
                page="wiki_product_detail",
                route="/m/wiki/product/p-9",
                source="m_compare_result",
                category="shampoo",
                product_id="p-9",
                compare_id="cmp-1",
                created_at="2026-03-12T01:00:18.193000Z",
                props_json='{"result_cta":"recommendation_wiki"}',
            ),
            MobileClientEvent(
                event_id="evt-036hd",
                owner_type="device",
                owner_id="owner-alpha",
                session_id="sess-1",
                name="rationale_to_bag_click",
                page="wiki_product_detail",
                route="/m/wiki/product/p-9",
                source="m_compare_result",
                category="shampoo",
                product_id="p-9",
                compare_id="cmp-1",
                created_at="2026-03-12T01:00:18.194000Z",
                props_json='{"result_cta":"recommendation_wiki","target_path":"/product/p-9"}',
            ),
            MobileClientEvent(
                event_id="evt-036he",
                owner_type="device",
                owner_id="owner-alpha",
                session_id="sess-1",
                name="rationale_to_compare_click",
                page="wiki_product_detail",
                route="/m/wiki/product/p-9",
                source="m_compare_result",
                category="shampoo",
                product_id="p-9",
                compare_id="cmp-1",
                created_at="2026-03-12T01:00:18.195000Z",
                props_json='{"result_cta":"recommendation_wiki","target_path":"/m/compare?category=shampoo"}',
            ),
            MobileClientEvent(
                event_id="evt-036i",
                owner_type="device",
                owner_id="owner-alpha",
                session_id="sess-1",
                name="result_view",
                page="selection_result",
                route="/m/shampoo/result",
                source="m_compare_result",
                category="shampoo",
                created_at="2026-03-12T01:00:18.200000Z",
                props_json='{"scenario_id":"selres-shampoo-2026-03-03-1-abc123","cta":"recommendation_wiki","result_cta":"recommendation_wiki","from_compare_id":"cmp-1"}',
            ),
            MobileClientEvent(
                event_id="evt-036j",
                owner_type="device",
                owner_id="owner-alpha",
                session_id="sess-1",
                name="result_primary_cta_click",
                page="selection_result",
                route="/m/shampoo/result",
                source="selection_result",
                category="shampoo",
                created_at="2026-03-12T01:00:18.210000Z",
                props_json='{"scenario_id":"selres-shampoo-2026-03-03-1-abc123","result_cta":"bag_add","action":"bag_add","target_path":"/product/p-9"}',
            ),
            MobileClientEvent(
                event_id="evt-036k",
                owner_type="device",
                owner_id="owner-alpha",
                session_id="sess-1",
                name="result_secondary_loop_click",
                page="selection_result",
                route="/m/shampoo/result",
                source="selection_result",
                category="shampoo",
                created_at="2026-03-12T01:00:18.220000Z",
                props_json='{"scenario_id":"selres-shampoo-2026-03-03-1-abc123","result_cta":"rationale","target_path":"/m/wiki/shampoo","action":"wiki"}',
            ),
            MobileClientEvent(
                event_id="evt-036l",
                owner_type="device",
                owner_id="owner-alpha",
                session_id="sess-1",
                name="utility_return_click",
                page="wiki_category",
                route="/m/wiki/shampoo",
                source="m_wiki",
                category="shampoo",
                compare_id="cmp-1",
                created_at="2026-03-12T01:00:18.230000Z",
                props_json='{"scenario_id":"selres-shampoo-2026-03-03-1-abc123","result_cta":"rationale","target_path":"/m/shampoo/result","action":"wiki_return"}',
            ),
            MobileClientEvent(
                event_id="evt-036m",
                owner_type="device",
                owner_id="owner-alpha",
                session_id="sess-1",
                name="result_view",
                page="selection_result",
                route="/m/shampoo/result",
                source="selection_result",
                category="shampoo",
                created_at="2026-03-13T01:00:18.200000Z",
                props_json='{"scenario_id":"selres-shampoo-2026-03-04-2-def456","cta":"recommendation_product"}',
            ),
            MobileClientEvent(
                event_id="evt-036n",
                owner_type="device",
                owner_id="owner-alpha",
                session_id="sess-1",
                name="result_primary_cta_click",
                page="selection_result",
                route="/m/shampoo/result",
                source="selection_result",
                category="shampoo",
                created_at="2026-03-13T01:00:18.210000Z",
                props_json='{"scenario_id":"selres-shampoo-2026-03-04-2-def456","result_cta":"bag_add","action":"bag_add","target_path":"/product/p-9"}',
            ),
            MobileClientEvent(
                event_id="evt-036o",
                owner_type="device",
                owner_id="owner-alpha",
                session_id="sess-1",
                name="result_secondary_loop_click",
                page="selection_result",
                route="/m/shampoo/result",
                source="selection_result",
                category="shampoo",
                created_at="2026-03-13T01:00:18.220000Z",
                props_json='{"scenario_id":"selres-shampoo-2026-03-04-2-def456","result_cta":"rationale","target_path":"/m/wiki/shampoo","action":"wiki"}',
            ),
            MobileClientEvent(
                event_id="evt-036p",
                owner_type="device",
                owner_id="owner-alpha",
                session_id="sess-1",
                name="utility_return_click",
                page="wiki_category",
                route="/m/wiki/shampoo",
                source="m_wiki",
                category="shampoo",
                created_at="2026-03-13T01:00:18.230000Z",
                props_json='{"scenario_id":"selres-shampoo-2026-03-04-2-def456","result_cta":"rationale","target_path":"/m/shampoo/result","action":"wiki_return"}',
            ),
            MobileClientEvent(
                event_id="evt-037",
                owner_type="device",
                owner_id="owner-gamma",
                session_id="sess-4",
                name="scroll_depth",
                page="wiki_list",
                route="/m/wiki",
                source="m_wiki",
                category="shampoo",
                created_at="2026-03-12T04:00:02.000000Z",
                props_json='{"depth_percent":50,"max_depth_percent":54,"entry_tab":"product"}',
            ),
            MobileClientEvent(
                event_id="evt-038",
                owner_type="device",
                owner_id="owner-gamma",
                session_id="sess-4",
                name="stall_detected",
                page="wiki_list",
                route="/m/wiki",
                source="m_wiki",
                category="shampoo",
                created_at="2026-03-12T04:00:20.000000Z",
                props_json='{"dwell_ms":21000,"idle_ms":20000}',
            ),
            MobileClientEvent(
                event_id="evt-039",
                owner_type="device",
                owner_id="owner-gamma",
                session_id="sess-4",
                name="rage_click",
                page="wiki_list",
                route="/m/wiki",
                source="m_wiki",
                category="shampoo",
                created_at="2026-03-12T04:00:21.000000Z",
                props_json='{"target_id":"wiki:search:open","click_count":3}',
            ),
            MobileClientEvent(
                event_id="evt-040",
                owner_type="device",
                owner_id="owner-alpha",
                session_id="sess-1",
                name="dead_click",
                page="compare_result",
                route="/m/compare/result/cmp-1",
                source="m_compare_result",
                category="shampoo",
                compare_id="cmp-1",
                created_at="2026-03-12T01:00:18.200000Z",
                props_json='{"target_id":"result:cta:wiki","wait_ms":900}',
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
    assert payload["compare_run_start"] == 3
    assert payload["compare_run_success"] == 1
    assert payload["compare_result_view"] == 1
    assert payload["result_view"] == 1
    assert payload["result_primary_cta_click"] == 1
    assert payload["result_secondary_loop_click"] == 1
    assert payload["utility_return_click"] == 1
    assert payload["home_primary_cta_click_sessions"] == 3
    assert payload["home_workspace_quick_action_click_sessions"] == 1
    assert payload["choose_view_sessions"] == 3
    assert payload["choose_start_click_sessions"] == 2
    assert payload["questionnaire_completed_sessions"] == 1
    assert payload["result_view_sessions"] == 1
    assert payload["result_primary_cta_click_sessions"] == 1
    assert payload["result_secondary_loop_click_sessions"] == 1
    assert payload["utility_return_click_sessions"] == 1
    assert payload["compare_result_view_sessions"] == 1
    assert payload["choose_start_rate_from_choose_view"] == 0.6667
    assert payload["result_view_rate_from_home_primary_cta"] == 0.3333
    assert payload["result_primary_cta_rate_from_result_view"] == 1.0
    assert payload["result_loop_entry_rate_from_result_view"] == 1.0
    assert payload["utility_return_rate_from_result_loop"] == 1.0
    assert payload["question_dropoff_status"] == "live"
    assert payload["question_dropoff_reason"] == ""
    assert payload["question_dropoff_top"]["category"] == "bodywash"
    assert payload["question_dropoff_top"]["step"] == 1
    assert payload["question_dropoff_top"]["question_key"] == "q1"
    assert payload["question_dropoff_top"]["question_title"] == "气候与微环境"
    assert payload["question_dropoff_top"]["questionnaire_view_sessions"] == 1
    assert payload["question_dropoff_top"]["question_answered_sessions"] == 0
    assert payload["question_dropoff_top"]["dropoff_sessions"] == 1
    assert payload["question_dropoff_top"]["dropoff_rate"] == 1.0
    by_category = {item["category"]: item for item in payload["question_dropoff_by_category"]}
    assert by_category["bodywash"]["step"] == 1
    assert by_category["bodywash"]["question_key"] == "q1"
    assert by_category["bodywash"]["question_title"] == "气候与微环境"
    assert by_category["bodywash"]["dropoff_sessions"] == 1
    assert by_category["shampoo"]["step"] == 2
    assert by_category["shampoo"]["question_key"] == "q2"
    assert by_category["shampoo"]["question_title"] == "头皮核心痛点"
    assert by_category["shampoo"]["dropoff_sessions"] == 1
    assert payload["feedback_prompt_show"] == 2
    assert payload["feedback_submit"] == 1
    assert payload["compare_completion_rate"] == 0.3333
    assert payload["feedback_submit_rate"] == 0.5

    funnel = client.get(f"/api/products/analytics/mobile/funnel?{query}")
    assert funnel.status_code == 200
    steps = {item["step_key"]: item for item in funnel.json()["steps"]}
    assert steps["home_primary_cta"]["count"] == 3
    assert steps["choose_view"]["count"] == 3
    assert steps["choose_start"]["count"] == 2
    assert steps["questionnaire_completed"]["count"] == 1
    assert steps["result_view"]["count"] == 1
    assert steps["choose_start"]["from_prev_rate"] == 0.6667
    assert steps["result_view"]["from_first_rate"] == 0.3333


def test_mobile_analytics_p0_sessions_not_inflated_by_multi_scenarios(mobile_analytics_client: TestClient):
    client = mobile_analytics_client
    query = "date_from=2026-03-10&date_to=2026-03-13"

    overview = client.get(f"/api/products/analytics/mobile/overview?{query}")
    assert overview.status_code == 200
    payload = overview.json()

    # Same session emits two result scenarios; *_sessions must stay session-deduped.
    assert payload["result_view"] == 2
    assert payload["result_primary_cta_click"] == 2
    assert payload["result_secondary_loop_click"] == 2
    assert payload["utility_return_click"] == 2
    assert payload["result_view_sessions"] == 1
    assert payload["result_primary_cta_click_sessions"] == 1
    assert payload["result_secondary_loop_click_sessions"] == 1
    assert payload["utility_return_click_sessions"] == 1
    assert payload["result_view_rate_from_home_primary_cta"] == 0.3333
    assert payload["result_primary_cta_rate_from_result_view"] == 1.0
    assert payload["result_loop_entry_rate_from_result_view"] == 1.0
    assert payload["utility_return_rate_from_result_loop"] == 1.0

    funnel = client.get(f"/api/products/analytics/mobile/funnel?{query}")
    assert funnel.status_code == 200
    steps = {item["step_key"]: item for item in funnel.json()["steps"]}
    assert steps["home_primary_cta"]["count"] == 3
    assert steps["result_view"]["count"] == 1
    assert steps["result_view"]["from_first_rate"] == 0.3333


def test_mobile_analytics_question_dropoff_dedup_and_ignore_invalid_rows(mobile_analytics_client: TestClient):
    client = mobile_analytics_client
    query = "date_from=2026-03-10&date_to=2026-03-12"

    overview = client.get(f"/api/products/analytics/mobile/overview?{query}")
    assert overview.status_code == 200
    payload = overview.json()
    top = payload["question_dropoff_top"]

    assert payload["question_dropoff_status"] == "live"
    # bodywash step=1 has repeated questionnaire_view rows in one session -> must dedupe to 1.
    assert top["category"] == "bodywash"
    assert top["step"] == 1
    assert top["question_key"] == "q1"
    assert top["question_title"] == "气候与微环境"
    assert top["questionnaire_view_sessions"] == 1
    # question_answered row missing step must be ignored, so answered stays 0.
    assert top["question_answered_sessions"] == 0
    assert top["dropoff_sessions"] == 1


def test_mobile_analytics_question_dropoff_blocked_without_valid_stepful_rows(mobile_analytics_client: TestClient):
    client = mobile_analytics_client
    query = "date_from=2026-03-13&date_to=2026-03-13"

    overview = client.get(f"/api/products/analytics/mobile/overview?{query}")
    assert overview.status_code == 200
    payload = overview.json()

    # The day has analytics rows, but no valid questionnaire_view/question_answered stepful rows.
    assert payload["total_events"] > 0
    assert payload["question_dropoff_status"] == "blocked_until_stepful_questionnaire_view_exists"
    assert payload["question_dropoff_reason"] != ""
    assert payload["question_dropoff_top"] is None
    assert payload["question_dropoff_by_category"] == []


def test_mobile_analytics_errors_feedback_and_sessions(mobile_analytics_client: TestClient):
    client = mobile_analytics_client
    query = "date_from=2026-03-10&date_to=2026-03-12"

    errors = client.get(f"/api/products/analytics/mobile/errors?{query}")
    assert errors.status_code == 200
    error_payload = errors.json()
    assert error_payload["compare_run_start"] == 3
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
    assert sessions_payload["items"][0]["latest_location_label"] == "31.230, 121.470 · 约1.2km"
    assert sessions_payload["items"][0]["latest_location_time_zone"] == "Asia/Shanghai"
    assert any(item["name"] == "compare_run_success" for item in sessions_payload["timeline"])
    assert any(item["name"] == "compare_result_view" for item in sessions_payload["timeline"])
    assert any(item["name"] == "compare_result_accept_recommendation" for item in sessions_payload["timeline"])
    assert any(item["name"] == "compare_result_keep_current" for item in sessions_payload["timeline"])
    assert any(item["name"] == "rationale_to_bag_click" for item in sessions_payload["timeline"])
    assert any(item["name"] == "utility_return_click" for item in sessions_payload["timeline"])
    assert any(item["location_label"] == "31.230, 121.470 · 约1.2km" for item in sessions_payload["timeline"])
    utility_return = next(item for item in sessions_payload["timeline"] if item["name"] == "utility_return_click")
    assert utility_return["result_cta"] == "rationale"
    assert utility_return["action"] == "wiki_return"
    assert utility_return["target_path"] == "/m/shampoo/result"


def test_mobile_analytics_experience(mobile_analytics_client: TestClient):
    client = mobile_analytics_client
    query = "date_from=2026-03-10&date_to=2026-03-12"

    experience = client.get(f"/api/products/analytics/mobile/experience?{query}")
    assert experience.status_code == 200
    payload = experience.json()

    assert payload["wiki_product_list_views"] == 1
    assert payload["wiki_product_clicks"] == 1
    assert payload["wiki_product_ctr"] == 1.0
    assert payload["wiki_ingredient_list_views"] == 1
    assert payload["wiki_ingredient_clicks"] == 1
    assert payload["wiki_ingredient_ctr"] == 1.0
    assert payload["compare_result_views"] == 1
    assert payload["decision_result_views"] == 1
    assert payload["decision_result_primary_cta_clicks"] == 1
    assert payload["decision_result_secondary_loop_clicks"] == 1
    assert payload["utility_return_clicks"] == 1
    assert payload["home_workspace_quick_action_clicks"] == 1
    assert payload["compare_closure_accept_recommendation"] == 1
    assert payload["compare_closure_keep_current"] == 1
    assert payload["rationale_view"] == 1
    assert payload["rationale_to_bag_click"] == 1
    assert payload["rationale_to_compare_click"] == 1
    assert payload["compare_result_leaves"] == 1
    assert payload["avg_result_dwell_ms"] == 18200.0
    assert payload["p50_result_dwell_ms"] == 18200.0
    assert payload["result_scroll_75"] == 1
    assert payload["result_scroll_100"] == 1
    assert payload["result_scroll_75_rate"] == 1.0
    assert payload["result_scroll_100_rate"] == 1.0
    assert payload["stall_detected"] == 2
    assert payload["rage_clicks"] == 2
    assert payload["dead_clicks"] == 1

    depth_items = {(item["page"], item["depth_percent"]): item for item in payload["scroll_depth_by_page"]}
    assert depth_items[("compare_result", 75)]["count"] == 1
    assert depth_items[("compare_result", 100)]["rate"] == 1.0
    assert depth_items[("wiki_list", 50)]["rate"] == 0.5

    stall_by_page = {item["key"]: item["count"] for item in payload["stall_by_page"]}
    assert stall_by_page["compare_result"] == 1
    assert stall_by_page["wiki_list"] == 1

    rage_targets = {(item["page"], item["target_id"]): item["count"] for item in payload["rage_click_targets"]}
    assert rage_targets[("compare_result", "result:cta:rerun-compare")] == 1
    assert rage_targets[("wiki_list", "wiki:search:open")] == 1
    dead_targets = {(item["page"], item["target_id"]): item["count"] for item in payload["dead_click_targets"]}
    assert dead_targets[("compare_result", "result:cta:wiki")] == 1

    cta_counts = {item["key"]: item["count"] for item in payload["result_cta_clicks"]}
    assert cta_counts["rerun_compare"] == 1
    assert cta_counts["recommendation_product"] == 1
    assert cta_counts["recommendation_wiki"] == 1
    followthrough = {item["cta"]: item for item in payload["result_cta_followthrough"]}
    assert followthrough["rerun_compare"]["landings"] == 1
    assert followthrough["rerun_compare"]["landing_rate"] == 1.0
    assert followthrough["recommendation_product"]["landings"] == 1
    assert followthrough["recommendation_wiki"]["landings"] == 1
    completions = {(item["cta"], item["completion_key"]): item for item in payload["result_cta_completions"]}
    assert completions[("rerun_compare", "compare_run_start")]["completions"] == 1
    assert completions[("rerun_compare", "compare_run_start")]["completion_rate_from_land"] == 1.0
    assert completions[("recommendation_product", "product_showcase_continue_upload_click")]["completions"] == 1
    assert completions[("recommendation_product", "product_showcase_continue_upload_click")]["completion_rate_from_click"] == 1.0
    assert completions[("recommendation_product", "bag_add_success")]["completions"] == 1
    assert completions[("recommendation_wiki", "result_view")]["completions"] == 1
    assert completions[("recommendation_wiki", "result_view")]["completion_rate_from_land"] == 1.0
    secondary_actions = {item["key"]: item["count"] for item in payload["result_secondary_loop_actions"]}
    assert secondary_actions["wiki"] == 1
    utility_returns = {item["key"]: item["count"] for item in payload["utility_return_actions"]}
    assert utility_returns["wiki_return"] == 1
    primary_result_ctas = {item["key"]: item["count"] for item in payload["result_primary_cta_result_ctas"]}
    assert primary_result_ctas["bag_add"] == 1
    primary_target_paths = {item["key"]: item["count"] for item in payload["result_primary_cta_target_paths"]}
    assert primary_target_paths["/product/p-9"] == 1
    loop_result_ctas = {item["key"]: item["count"] for item in payload["result_secondary_loop_result_ctas"]}
    assert loop_result_ctas["rationale"] == 1
    loop_target_paths = {item["key"]: item["count"] for item in payload["result_secondary_loop_target_paths"]}
    assert loop_target_paths["/m/wiki/shampoo"] == 1
    utility_result_ctas = {item["key"]: item["count"] for item in payload["utility_return_result_ctas"]}
    assert utility_result_ctas["rationale"] == 1
    utility_target_paths = {item["key"]: item["count"] for item in payload["utility_return_target_paths"]}
    assert utility_target_paths["/m/shampoo/result"] == 1
    home_workspace_actions = {item["key"]: item["count"] for item in payload["home_workspace_quick_actions"]}
    assert home_workspace_actions["compare"] == 1
    compare_closure_actions = {item["key"]: item["count"] for item in payload["compare_closure_actions"]}
    assert compare_closure_actions["accept_recommendation"] == 1
    assert compare_closure_actions["keep_current"] == 1
    rationale_closure_actions = {item["key"]: item["count"] for item in payload["rationale_closure_actions"]}
    assert rationale_closure_actions["view"] == 1
    assert rationale_closure_actions["to_bag"] == 1
    assert rationale_closure_actions["to_compare"] == 1

    browser_counts = {item["key"]: item["count"] for item in payload["browser_families"]}
    assert browser_counts["chrome"] == 3
    assert browser_counts["safari"] == 1
    os_counts = {item["key"]: item["count"] for item in payload["os_families"]}
    assert os_counts["android"] == 3
    assert os_counts["ios"] == 1
    network_counts = {item["key"]: item["count"] for item in payload["network_types"]}
    assert network_counts["4g"] == 3
    assert network_counts["3g"] == 1
    memory_counts = {item["key"]: item["count"] for item in payload["device_memory_buckets"]}
    assert memory_counts["4gb"] == 2
    assert memory_counts["8gb"] == 2
    cpu_counts = {item["key"]: item["count"] for item in payload["cpu_core_buckets"]}
    assert cpu_counts["6"] == 1
    assert cpu_counts["8"] == 3
    touch_counts = {item["key"]: item["count"] for item in payload["touch_points_buckets"]}
    assert touch_counts["5_plus"] == 4
    online_counts = {item["key"]: item["count"] for item in payload["online_states"]}
    assert online_counts["online"] == 4
    assert payload["location_capture_events"] == 2
    assert payload["location_capture_sessions"] == 2
    assert payload["sessions_with_location"] == 2
    assert payload["sessions_without_location"] == 3
    assert payload["location_coverage_rate"] == 0.4
    region_counts = {item["key"]: item["count"] for item in payload["location_regions"]}
    assert region_counts["31.2, 121.5|Asia/Shanghai"] == 1
    assert region_counts["35.7, 139.8|Asia/Tokyo"] == 1
    region_labels = {item["key"]: item["label"] for item in payload["location_regions"]}
    assert region_labels["31.2, 121.5|Asia/Shanghai"] == "31.2, 121.5"
    assert region_labels["35.7, 139.8|Asia/Tokyo"] == "35.7, 139.8"
    timezone_counts = {item["key"]: item["count"] for item in payload["location_time_zones"]}
    assert timezone_counts["Asia/Shanghai"] == 1
    assert timezone_counts["Asia/Tokyo"] == 1
    timezone_labels = {item["key"]: item["label"] for item in payload["location_time_zones"]}
    assert timezone_labels["Asia/Shanghai"] == "上海时区"
    assert timezone_labels["Asia/Tokyo"] == "东京时区"
    accuracy_counts = {item["key"]: item["count"] for item in payload["location_accuracy_buckets"]}
    assert accuracy_counts["1-3km"] == 1
    assert accuracy_counts["3-10km"] == 1


def test_mobile_analytics_geo_filters(mobile_analytics_client: TestClient):
    client = mobile_analytics_client
    query = "date_from=2026-03-10&date_to=2026-03-12"

    filtered_experience = client.get(
        f"/api/products/analytics/mobile/experience?{query}&location_presence=with_location&location_time_zone=Asia/Shanghai"
    )
    assert filtered_experience.status_code == 200
    filtered_payload = filtered_experience.json()
    assert filtered_payload["sessions_with_location"] == 1
    assert filtered_payload["sessions_without_location"] == 0
    assert filtered_payload["location_coverage_rate"] == 1.0
    assert filtered_payload["location_time_zones"][0]["key"] == "Asia/Shanghai"
    assert filtered_payload["location_time_zones"][0]["label"] == "上海时区"

    missing_sessions = client.get(f"/api/products/analytics/mobile/sessions?{query}&location_presence=without_location")
    assert missing_sessions.status_code == 200
    missing_payload = missing_sessions.json()
    assert missing_payload["total"] == 3
    assert all(item["latest_location_label"] is None for item in missing_payload["items"])

    region_sessions = client.get(
        "/api/products/analytics/mobile/sessions",
        params={
            "date_from": "2026-03-10",
            "date_to": "2026-03-12",
            "location_region": "31.2, 121.5|Asia/Shanghai",
        },
    )
    assert region_sessions.status_code == 200
    region_payload = region_sessions.json()
    assert region_payload["total"] == 1
    assert region_payload["items"][0]["session_id"] == "sess-1"


def test_location_label_prefers_city_when_available():
    props = {
        "location_city": "上海市",
        "location_district": "浦东新区",
        "location_latitude": 31.23,
        "location_longitude": 121.47,
        "location_accuracy_m": 1200,
        "location_time_zone": "Asia/Shanghai",
    }

    assert _event_location_label(props) == "上海市 浦东新区 · 31.230, 121.470 · 约1.2km"
    assert _event_location_region_label(props) == "上海市 浦东新区 · 31.2, 121.5"
