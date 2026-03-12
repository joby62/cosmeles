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
                props_json='{"dwell_ms":18200,"max_depth_percent":100,"exit_type":"unmount"}',
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
                event_id="evt-036i",
                owner_type="device",
                owner_id="owner-alpha",
                session_id="sess-1",
                name="profile_result_view",
                page="selection_result",
                route="/m/shampoo/result",
                source="m_compare_result",
                category="shampoo",
                created_at="2026-03-12T01:00:18.200000Z",
                props_json='{"cta":"recommendation_wiki","result_cta":"recommendation_wiki","from_compare_id":"cmp-1"}',
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
    assert payload["feedback_prompt_show"] == 2
    assert payload["feedback_submit"] == 1
    assert payload["compare_completion_rate"] == 0.3333
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
    assert any(item["name"] == "compare_run_success" for item in sessions_payload["timeline"])
    assert any(item["name"] == "compare_result_view" for item in sessions_payload["timeline"])


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
    assert completions[("recommendation_wiki", "profile_result_view")]["completions"] == 1
    assert completions[("recommendation_wiki", "profile_result_view")]["completion_rate_from_land"] == 1.0

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
