import json
import queue
import threading
import hashlib
import re
import io
import zipfile
import unicodedata
from urllib.parse import parse_qs, urlsplit
from functools import lru_cache
from datetime import datetime, timedelta, timezone
from pathlib import Path
from collections import Counter, defaultdict
from typing import Any, Callable

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import inspect, select, func, text
from sqlalchemy.exc import OperationalError
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import sessionmaker

from app.ai.orchestrator import run_capability_now
from app.ai.prompts import load_prompt
from app.constants import (
    VALID_CATEGORIES,
    MOBILE_RULES_VERSION,
    PRODUCT_PROFILE_SUPPORTED_CATEGORIES,
    ROUTE_MAPPING_SUPPORTED_CATEGORIES,
)
from app.domain.mobile.decision import load_mobile_decision_category_config
from app.db.session import get_db, SessionLocal
from app.db.models import (
    ProductIndex,
    IngredientLibraryIndex,
    IngredientLibraryAlias,
    IngredientLibraryRedirect,
    IngredientLibraryBuildJob,
    ProductWorkbenchJob,
    ProductRouteMappingIndex,
    ProductAnalysisIndex,
    ProductFeaturedSlot,
    MobileSelectionSession,
    MobileBagItem,
    MobileCompareUsageStat,
    MobileClientEvent,
)
from app.platform.task_queue import get_runtime_task_queue
from app.settings import settings
from app.services.storage import (
    load_json,
    read_rel_bytes,
    save_json_at,
    now_iso,
    new_id,
    save_ingredient_profile,
    ingredient_profile_rel_path,
    exists_rel_path,
    remove_rel_path,
    remove_rel_dir,
    remove_product_images,
    image_variant_rel_paths,
    preferred_image_rel_path,
    cleanup_orphan_storage,
    save_product_route_mapping,
    product_route_mapping_rel_path,
    save_product_analysis,
    product_analysis_rel_path,
)
from app.services.runtime_topology import should_inline_dispatch_product_workbench_job
from app.services.mobile_selection_result_builder import (
    SelectionResultBuildCancelledError,
    build_mobile_selection_results,
)
from app.schemas import (
    ProductCard,
    ProductListResponse,
    ProductListMeta,
    CategoryCount,
    ProductRouteMappingIndexListResponse,
    ProductRouteMappingIndexItem,
    ProductFeaturedSlotItem,
    ProductFeaturedSlotListResponse,
    ProductFeaturedSlotUpsertRequest,
    ProductFeaturedSlotClearRequest,
    ProductFeaturedSlotClearResponse,
    ProductUpdateRequest,
    ProductDedupSuggestRequest,
    ProductDedupSuggestResponse,
    ProductDedupSuggestion,
    ProductWorkbenchJobView,
    ProductWorkbenchJobCancelResponse,
    ProductWorkbenchJobCounters,
    ProductWorkbenchJobError,
    ProductBatchDeleteRequest,
    ProductBatchDeleteResponse,
    OrphanStorageCleanupRequest,
    OrphanStorageCleanupResponse,
    MobileInvalidProductRefCleanupRequest,
    MobileInvalidProductRefCleanupResponse,
    IngredientLibraryBuildRequest,
    IngredientLibraryBuildResponse,
    IngredientLibraryBuildItem,
    IngredientLibraryPreflightRequest,
    IngredientLibraryPreflightResponse,
    IngredientLibraryNormalizationPackage,
    IngredientLibraryPreflightSummary,
    IngredientLibraryMergeCandidate,
    IngredientLibraryPreflightUsageTopItem,
    IngredientLibraryBuildJobCreateRequest,
    IngredientLibraryBuildJobView,
    IngredientLibraryBuildJobCounters,
    IngredientLibraryBuildJobError,
    IngredientLibraryBuildJobCancelResponse,
    IngredientLibraryBatchDeleteRequest,
    IngredientLibraryBatchDeleteResponse,
    IngredientLibraryDeleteFailureItem,
    IngredientLibraryListResponse,
    IngredientLibraryListItem,
    IngredientLibrarySourceSample,
    IngredientLibraryProfile,
    IngredientLibraryDetailItem,
    IngredientLibraryDetailResponse,
    ProductRouteMappingBuildRequest,
    ProductRouteMappingBuildResponse,
    ProductRouteMappingBuildItem,
    ProductRouteMappingScore,
    ProductRouteMappingResult,
    ProductRouteMappingDetailResponse,
    ProductAnalysisBuildRequest,
    ProductAnalysisBuildResponse,
    ProductAnalysisBuildItem,
    ProductAnalysisDetailResponse,
    ProductAnalysisIndexItem,
    ProductAnalysisIndexListResponse,
    ProductAnalysisStoredResult,
    ProductAnalysisResult,
    ProductAnalysisContextPayload,
    MobileSelectionResultBuildRequest,
    MobileSelectionResultBuildResponse,
    MobileSelectionResultBuildItem,
    MobileAnalyticsFilterState,
    MobileAnalyticsCountItem,
    MobileAnalyticsQuestionDropoffItem,
    MobileAnalyticsOverviewResponse,
    MobileAnalyticsFunnelStep,
    MobileAnalyticsFunnelResponse,
    MobileAnalyticsStageErrorMatrixItem,
    MobileAnalyticsStageDurationItem,
    MobileAnalyticsErrorsResponse,
    MobileAnalyticsFeedbackTextSample,
    MobileAnalyticsFeedbackMatrixItem,
    MobileAnalyticsFeedbackResponse,
    MobileAnalyticsPageDepthItem,
    MobileAnalyticsRageClickTargetItem,
    MobileAnalyticsCtaFollowthroughItem,
    MobileAnalyticsCtaCompletionItem,
    MobileAnalyticsExperienceResponse,
    MobileAnalyticsSessionSummary,
    MobileAnalyticsSessionEventItem,
    MobileAnalyticsSessionsResponse,
)

router = APIRouter(prefix="/api", tags=["products"])

INGREDIENT_SOURCE_SCHEMA_VERSION = "v2026-03-05.1"
INGREDIENT_SOURCE_COOCCURRENCE_TOP_N = 15
INGREDIENT_BUILD_JOB_HEARTBEAT_SECONDS = 2
INGREDIENT_BUILD_JOB_STALE_SECONDS = max(60 * 30, INGREDIENT_BUILD_JOB_HEARTBEAT_SECONDS * 300)
INGREDIENT_BUILD_JOB_PROCESS_STARTED_AT = datetime.now(timezone.utc)
PRODUCT_WORKBENCH_MAX_CONCURRENCY = max(1, min(2, int(getattr(settings, "product_workbench_max_concurrency", 1))))
PRODUCT_WORKBENCH_JOB_HEARTBEAT_SECONDS = 2
PRODUCT_WORKBENCH_JOB_STALE_SECONDS = max(60 * 30, PRODUCT_WORKBENCH_JOB_HEARTBEAT_SECONDS * 300)
PRODUCT_WORKBENCH_JOB_PROCESS_STARTED_AT = datetime.now(timezone.utc)
PRODUCT_WORKBENCH_LOG_LIMIT = 240
LIVE_TEXT_LOG_LIMIT = 200
INGREDIENT_NORMALIZATION_PACKAGE_VERSION = "v2026-03-06.1"
INGREDIENT_NORMALIZATION_PACKAGES: tuple[dict[str, Any], ...] = (
    {
        "id": "unicode_nfkc",
        "label": "Unicode 规范化",
        "description": "统一全半角和兼容字符（NFKC），降低同字形差异。",
        "default_enabled": True,
        "mode": "auto_merge",
    },
    {
        "id": "whitespace_fold",
        "label": "空白折叠",
        "description": "连续空白折叠为一个空格，去除首尾空白。",
        "default_enabled": True,
        "mode": "auto_merge",
    },
    {
        "id": "punctuation_fold",
        "label": "标点归一",
        "description": "统一中英文括号/连接符/分隔符写法。",
        "default_enabled": True,
        "mode": "auto_merge",
    },
    {
        "id": "extract_en_parenthesis",
        "label": "括号英文提取",
        "description": "从“中文(English)”中提取英文别名用于映射。",
        "default_enabled": True,
        "mode": "auto_merge",
    },
    {
        "id": "en_exact",
        "label": "英文名精确归一",
        "description": "英文/INCI 完全一致时归并为同一 ingredient_key。",
        "default_enabled": True,
        "mode": "auto_merge",
    },
)
INGREDIENT_PUNCTUATION_FOLD_TABLE = str.maketrans(
    {
        "（": "(",
        "）": ")",
        "【": "[",
        "】": "]",
        "，": ",",
        "、": ",",
        "。": ".",
        "；": ";",
        "：": ":",
        "／": "/",
        "－": "-",
        "—": "-",
        "–": "-",
        "·": " ",
        "・": " ",
    }
)


class IngredientLibraryBuildCancelledError(RuntimeError):
    pass


class ProductWorkbenchJobCancelledError(RuntimeError):
    def __init__(self, message: str, *, result: dict[str, Any] | None = None):
        super().__init__(message)
        self.result = result


ANALYTICS_DEFAULT_SINCE_HOURS = 24 * 7
ANALYTICS_MAX_SESSION_LIMIT = 50
ANALYTICS_SESSION_SCAN_LIMIT = 4000
ANALYTICS_STAGE_LABELS: dict[str, str] = {
    "uploading": "上传当前在用产品",
    "prepare": "准备对比任务",
    "resolve_targets": "读取待对比产品",
    "resolve_target": "整理产品信息",
    "stage1_vision": "识别图片文字",
    "stage2_struct": "结构化成分信息",
    "pair_compare": "生成两两分析",
    "finalize": "整理最终结论",
    "done": "对比完成",
}
ANALYTICS_P0_FUNNEL_STEPS: tuple[tuple[str, str], ...] = (
    ("home_primary_cta", "首页主 CTA"),
    ("choose_category_start", "点击品类直接开始"),
    ("questionnaire_step1_view", "进入第1题"),
    ("questionnaire_completed", "答题完成"),
    ("result_view", "结果到达"),
)
ANALYTICS_RESULT_CANONICAL_EVENT_TO_CTA: dict[str, str] = {
    "result_add_to_bag_click": "bag_add",
    "result_compare_entry_click": "compare",
    "result_rationale_entry_click": "rationale",
    "result_retry_same_category_click": "retry_same_category",
    "result_switch_category_click": "switch_category",
}
ANALYTICS_RESULT_SECONDARY_CANONICAL_EVENTS: tuple[str, ...] = (
    "result_compare_entry_click",
    "result_rationale_entry_click",
    "result_retry_same_category_click",
    "result_switch_category_click",
)
ANALYTICS_COMPARE_CLOSURE_EVENT_TO_ACTION_KEY: dict[str, str] = {
    "compare_result_accept_recommendation": "accept_recommendation",
    "compare_result_keep_current": "keep_current",
    "compare_result_hold_current": "hold_current",
    "compare_result_view_key_differences": "view_key_differences",
    "compare_result_open_rationale": "open_rationale",
    "compare_result_retry_current_product": "retry_current_product",
    "compare_result_switch_category_click": "switch_category",
    "compare_result_accept_recommendation_land": "accept_recommendation_land",
    "compare_result_keep_current_land": "keep_current_land",
}
ANALYTICS_OVERVIEW_EVENT_NAMES: tuple[str, ...] = (
    "home_primary_cta_click",
    "home_workspace_quick_action_click",
    "choose_view",
    "choose_start_click",
    "choose_category_start_click",
    "questionnaire_view",
    "question_answered",
    "questionnaire_completed",
    "page_view",
    "wiki_upload_cta_expose",
    "wiki_upload_cta_click",
    "my_use_category_card_click",
    "compare_run_start",
    "compare_run_success",
    "compare_result_view",
    "result_view",
    "result_primary_cta_click",
    "result_secondary_loop_click",
    "result_add_to_bag_click",
    "result_compare_entry_click",
    "result_rationale_entry_click",
    "result_retry_same_category_click",
    "result_switch_category_click",
    "utility_return_click",
    "feedback_prompt_show",
    "feedback_submit",
)
ANALYTICS_FUNNEL_EVENT_NAMES: tuple[str, ...] = (
    "home_primary_cta_click",
    "choose_start_click",
    "choose_category_start_click",
    "questionnaire_view",
    "questionnaire_completed",
    "result_view",
)
ANALYTICS_EXPERIENCE_EVENT_NAMES: tuple[str, ...] = (
    "page_view",
    "wiki_list_view",
    "wiki_product_click",
    "wiki_ingredient_click",
    "wiki_category_ingredient_click",
    "wiki_category_choose_click",
    "compare_result_view",
    "compare_result_leave",
    "scroll_depth",
    "stall_detected",
    "rage_click",
    "dead_click",
    "compare_result_cta_click",
    "compare_result_cta_land",
    "compare_entry_view",
    "compare_upload_start",
    "compare_upload_success",
    "compare_result_accept_recommendation",
    "compare_result_keep_current",
    "compare_result_hold_current",
    "compare_result_view_key_differences",
    "compare_result_open_rationale",
    "compare_result_retry_current_product",
    "compare_result_switch_category_click",
    "compare_result_accept_recommendation_land",
    "compare_result_keep_current_land",
    "compare_run_start",
    "location_context_captured",
    "wiki_upload_cta_click",
    "rationale_view",
    "rationale_to_bag_click",
    "rationale_to_compare_click",
    "result_view",
    "result_primary_cta_click",
    "result_secondary_loop_click",
    "result_add_to_bag_click",
    "result_compare_entry_click",
    "result_rationale_entry_click",
    "result_retry_same_category_click",
    "result_switch_category_click",
    "utility_return_click",
    "home_workspace_quick_action_click",
    "bag_add_success",
    "product_showcase_continue_upload_click",
    "product_showcase_governance_click",
)
ANALYTICS_QUESTION_DROPOFF_STATUS = "blocked_until_stepful_questionnaire_view_exists"
ANALYTICS_QUESTION_DROPOFF_REASON = (
    "当前时间窗内没有可用于 question_dropoff 的有效 question-step 数据。"
)
ANALYTICS_BROWSER_LABELS: dict[str, str] = {
    "chrome": "Chrome",
    "safari": "Safari",
    "edge": "Edge",
    "firefox": "Firefox",
    "wechat": "WeChat",
    "other": "其他",
    "unknown": "未知",
}
ANALYTICS_OS_LABELS: dict[str, str] = {
    "ios": "iOS",
    "android": "Android",
    "macos": "macOS",
    "windows": "Windows",
    "linux": "Linux",
    "other": "其他",
    "unknown": "未知",
}
ANALYTICS_DEVICE_LABELS: dict[str, str] = {
    "phone": "手机",
    "tablet": "平板",
    "desktop": "桌面",
    "unknown": "未知",
}
ANALYTICS_VIEWPORT_LABELS: dict[str, str] = {
    "xs": "超窄屏",
    "sm": "小屏",
    "md": "手机常规屏",
    "lg": "平板屏",
    "xl": "桌面宽屏",
    "unknown": "未知",
}
ANALYTICS_NETWORK_LABELS: dict[str, str] = {
    "slow-2g": "slow-2g",
    "2g": "2G",
    "3g": "3G",
    "4g": "4G",
    "unknown": "未知",
}
ANALYTICS_MEMORY_LABELS: dict[str, str] = {
    "lte1": "<= 1GB",
    "2gb": "2GB",
    "4gb": "4GB",
    "8gb": "8GB",
    "gt8gb": "> 8GB",
    "unknown": "未知",
}
ANALYTICS_CPU_LABELS: dict[str, str] = {
    "lte2": "<= 2 核",
    "4": "4 核",
    "6": "6 核",
    "8": "8 核",
    "gt8": "> 8 核",
    "unknown": "未知",
}
ANALYTICS_TOUCH_LABELS: dict[str, str] = {
    "0": "0",
    "1": "1",
    "2_4": "2-4",
    "5_plus": "5+",
    "unknown": "未知",
}
ANALYTICS_ONLINE_LABELS: dict[str, str] = {
    "online": "在线",
    "offline": "离线",
    "unknown": "未知",
}
ANALYTICS_TIME_ZONE_LABELS: dict[str, str] = {
    "Asia/Shanghai": "上海时区",
    "Asia/Hong_Kong": "香港时区",
    "Asia/Tokyo": "东京时区",
    "Asia/Seoul": "首尔时区",
    "Asia/Singapore": "新加坡时区",
    "Asia/Taipei": "台北时区",
    "Asia/Bangkok": "曼谷时区",
    "Asia/Dubai": "迪拜时区",
    "Europe/London": "伦敦时区",
    "Europe/Paris": "巴黎时区",
    "Europe/Berlin": "柏林时区",
    "America/Los_Angeles": "洛杉矶时区",
    "America/Denver": "丹佛时区",
    "America/Chicago": "芝加哥时区",
    "America/New_York": "纽约时区",
    "America/Toronto": "多伦多时区",
    "Australia/Sydney": "悉尼时区",
    "UTC": "UTC",
}
ANALYTICS_CTA_COMPLETION_LABELS: dict[str, str] = {
    "compare_run_start": "再次开始对比",
    "wiki_upload_cta_click": "点击上传一键分析",
    "wiki_category_ingredient_click": "点开成分词条",
    "wiki_category_choose_click": "进入该品类挑选",
    "result_view": "完成测评结果",
    "bag_add_success": "加入购物袋",
    "product_showcase_continue_upload_click": "继续上传解析",
    "product_showcase_governance_click": "返回产品治理",
}
ANALYTICS_RESULT_CTA_LABELS: dict[str, str] = {
    "bag_add": "加入购物袋",
    "compare": "和我现在在用的比一下",
    "rationale": "看为什么推荐这款",
    "retry_same_category": "重测这类",
    "switch_category": "测其他品类",
    "unknown": "未标注 result_cta",
}
ANALYTICS_HOME_WORKSPACE_ACTION_LABELS: dict[str, str] = {
    "new_test": "测新的",
    "compare": "对比",
    "wiki": "查百科",
    "me": "我的",
    "resume": "继续上次进度",
    "review_result": "回看上次结果",
    "in_use_compare": "和当前在用做对比",
    "unknown": "未标注 action",
}
ANALYTICS_COMPARE_CLOSURE_ACTION_LABELS: dict[str, str] = {
    "accept_recommendation": "接受推荐",
    "keep_current": "保留当前",
    "hold_current": "先保留当前",
    "view_key_differences": "查看关键差异",
    "open_rationale": "打开推荐依据",
    "retry_current_product": "换一个当前产品再比",
    "switch_category": "切换到其他品类",
    "accept_recommendation_land": "接受推荐成功落点",
    "keep_current_land": "保留当前成功落点",
}
ANALYTICS_RATIONALE_CLOSURE_ACTION_LABELS: dict[str, str] = {
    "view": "查看推荐依据",
    "to_bag": "依据页加入购物袋",
    "to_compare": "依据页去对比",
}


def _normalize_optional_text(value: Any) -> str | None:
    text = str(value or "").strip()
    return text or None


def _mask_owner_id(value: str | None) -> str | None:
    text = str(value or "").strip()
    if not text:
        return None
    if len(text) <= 8:
        return text
    return f"{text[:4]}…{text[-4:]}"


def _analytics_datetime_to_iso(value: datetime) -> str:
    return value.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%fZ")


def _parse_analytics_datetime(value: str | None, *, end_of_day: bool = False) -> datetime | None:
    text = str(value or "").strip()
    if not text:
        return None
    try:
        if re.fullmatch(r"\d{4}-\d{2}-\d{2}", text):
            parsed = datetime.fromisoformat(text)
            if end_of_day:
                parsed = parsed.replace(hour=23, minute=59, second=59, microsecond=999999)
            else:
                parsed = parsed.replace(hour=0, minute=0, second=0, microsecond=0)
            return parsed.replace(tzinfo=timezone.utc)
        if text.endswith("Z"):
            text = f"{text[:-1]}+00:00"
        parsed = datetime.fromisoformat(text)
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid datetime value: {value}.")


def _resolve_mobile_analytics_filters(
    *,
    since_hours: int | None,
    date_from: str | None,
    date_to: str | None,
    category: str | None,
    page: str | None,
    stage: str | None,
    error_code: str | None,
    trigger_reason: str | None,
    session_id: str | None,
    compare_id: str | None,
    owner_id: str | None,
    location_presence: str | None,
    location_time_zone: str | None,
    location_region: str | None,
    limit: int | None = None,
) -> tuple[MobileAnalyticsFilterState, str, str]:
    category_value = _normalize_optional_text(category)
    if category_value and category_value.lower() not in VALID_CATEGORIES:
        raise HTTPException(status_code=400, detail=f"Invalid category: {category_value}.")

    since_hours_value = since_hours
    if since_hours_value is not None and since_hours_value <= 0:
        raise HTTPException(status_code=400, detail="since_hours must be positive.")

    now_utc = datetime.now(timezone.utc)
    start_dt = _parse_analytics_datetime(date_from, end_of_day=False)
    end_dt = _parse_analytics_datetime(date_to, end_of_day=True)

    if start_dt is None and end_dt is None:
        since_hours_value = since_hours_value or ANALYTICS_DEFAULT_SINCE_HOURS
        start_dt = now_utc - timedelta(hours=since_hours_value)
        end_dt = now_utc
    elif start_dt is None and end_dt is not None:
        since_hours_value = since_hours_value or ANALYTICS_DEFAULT_SINCE_HOURS
        start_dt = end_dt - timedelta(hours=since_hours_value)
    elif start_dt is not None and end_dt is None:
        end_dt = now_utc

    if start_dt is None or end_dt is None:
        raise HTTPException(status_code=400, detail="Failed to resolve analytics time window.")
    if start_dt > end_dt:
        raise HTTPException(status_code=400, detail="date_from must be earlier than date_to.")

    location_presence_value = _normalize_optional_text(location_presence)
    if location_presence_value and location_presence_value not in {"with_location", "without_location"}:
        raise HTTPException(status_code=400, detail=f"Invalid location_presence: {location_presence_value}.")
    location_time_zone_value = _normalize_optional_text(location_time_zone)
    if location_presence_value == "without_location" and location_time_zone_value:
        raise HTTPException(status_code=400, detail="location_time_zone cannot be used with location_presence=without_location.")
    location_region_value = _normalize_optional_text(location_region)
    if location_presence_value == "without_location" and location_region_value:
        raise HTTPException(status_code=400, detail="location_region cannot be used with location_presence=without_location.")

    filters = MobileAnalyticsFilterState(
        since_hours=since_hours_value,
        date_from=_normalize_optional_text(date_from),
        date_to=_normalize_optional_text(date_to),
        category=category_value.lower() if category_value else None,
        page=_normalize_optional_text(page),
        stage=_normalize_optional_text(stage),
        error_code=_normalize_optional_text(error_code),
        trigger_reason=_normalize_optional_text(trigger_reason),
        session_id=_normalize_optional_text(session_id),
        compare_id=_normalize_optional_text(compare_id),
        owner_id=_normalize_optional_text(owner_id),
        location_presence=location_presence_value,
        location_time_zone=location_time_zone_value,
        location_region=location_region_value,
        limit=limit,
    )
    return filters, _analytics_datetime_to_iso(start_dt), _analytics_datetime_to_iso(end_dt)


def _safe_event_props(value: str | None) -> dict[str, Any]:
    text = str(value or "").strip()
    if not text:
        return {}
    try:
        parsed = json.loads(text)
        if isinstance(parsed, dict):
            return parsed
        return {}
    except json.JSONDecodeError:
        return {}


def _query_mobile_client_location_session_keys(
    *,
    db: Session,
    filters: MobileAnalyticsFilterState,
    start_iso: str,
    end_iso: str,
) -> set[str]:
    stmt = select(MobileClientEvent).where(
        MobileClientEvent.created_at >= start_iso,
        MobileClientEvent.created_at <= end_iso,
    )
    if filters.category:
        stmt = stmt.where(MobileClientEvent.category == filters.category)
    if filters.session_id:
        stmt = stmt.where(MobileClientEvent.session_id == filters.session_id)
    if filters.compare_id:
        stmt = stmt.where(MobileClientEvent.compare_id == filters.compare_id)
    if filters.owner_id:
        stmt = stmt.where(MobileClientEvent.owner_id == filters.owner_id)

    rows = db.execute(stmt).scalars().all()
    session_has_location: dict[str, bool] = {}
    session_time_zones: dict[str, set[str]] = defaultdict(set)
    session_regions: dict[str, set[str]] = defaultdict(set)
    for row in rows:
        props = _safe_event_props(row.props_json)
        session_key = _session_key_for_event(row)
        has_location = _has_event_location(props)
        session_has_location[session_key] = session_has_location.get(session_key, False) or has_location
        time_zone = _event_location_time_zone(props)
        if time_zone:
            session_time_zones[session_key].add(time_zone)
        region_key = _event_location_region_key(props)
        if region_key:
            session_regions[session_key].add(region_key)

    matched: set[str] = set()
    for session_key, has_location in session_has_location.items():
        if filters.location_presence == "with_location" and not has_location:
            continue
        if filters.location_presence == "without_location" and has_location:
            continue
        if filters.location_time_zone and filters.location_time_zone not in session_time_zones.get(session_key, set()):
            continue
        if filters.location_region and filters.location_region not in session_regions.get(session_key, set()):
            continue
        matched.add(session_key)
    return matched


def _query_mobile_client_events(
    *,
    db: Session,
    filters: MobileAnalyticsFilterState,
    start_iso: str,
    end_iso: str,
    names: list[str] | None = None,
    desc: bool = False,
    row_limit: int | None = None,
) -> list[tuple[MobileClientEvent, dict[str, Any]]]:
    matched_session_keys: set[str] | None = None
    if filters.location_presence or filters.location_time_zone or filters.location_region:
        matched_session_keys = _query_mobile_client_location_session_keys(
            db=db,
            filters=filters,
            start_iso=start_iso,
            end_iso=end_iso,
        )
        if not matched_session_keys:
            return []

    stmt = select(MobileClientEvent).where(
        MobileClientEvent.created_at >= start_iso,
        MobileClientEvent.created_at <= end_iso,
    )
    if filters.category:
        stmt = stmt.where(MobileClientEvent.category == filters.category)
    if filters.page:
        stmt = stmt.where(MobileClientEvent.page == filters.page)
    if filters.stage:
        stmt = stmt.where(MobileClientEvent.stage == filters.stage)
    if filters.error_code:
        stmt = stmt.where(MobileClientEvent.error_code == filters.error_code)
    if filters.session_id:
        stmt = stmt.where(MobileClientEvent.session_id == filters.session_id)
    if filters.compare_id:
        stmt = stmt.where(MobileClientEvent.compare_id == filters.compare_id)
    if filters.owner_id:
        stmt = stmt.where(MobileClientEvent.owner_id == filters.owner_id)
    if names:
        stmt = stmt.where(MobileClientEvent.name.in_(names))

    stmt = stmt.order_by(MobileClientEvent.created_at.desc() if desc else MobileClientEvent.created_at.asc())
    if row_limit is not None and row_limit > 0:
        stmt = stmt.limit(row_limit)

    rows = db.execute(stmt).scalars().all()
    out: list[tuple[MobileClientEvent, dict[str, Any]]] = []
    for row in rows:
        props = _safe_event_props(row.props_json)
        if filters.trigger_reason:
            trigger_reason = _normalize_optional_text(props.get("trigger_reason"))
            if trigger_reason != filters.trigger_reason:
                continue
        if matched_session_keys is not None and _session_key_for_event(row) not in matched_session_keys:
            continue
        out.append((row, props))
    return out


def _session_key_for_event(row: MobileClientEvent) -> str:
    session_id = _normalize_optional_text(row.session_id)
    if session_id:
        return session_id
    compare_id = _normalize_optional_text(row.compare_id)
    if compare_id:
        return f"compare::{compare_id}"
    return f"event::{row.event_id}"


def _compare_key_for_event(row: MobileClientEvent) -> str:
    compare_id = _normalize_optional_text(row.compare_id)
    if compare_id:
        return compare_id
    session_id = _normalize_optional_text(row.session_id)
    if session_id:
        return f"session::{session_id}"
    return row.event_id


def _decision_result_key_for_event(row: MobileClientEvent, props: dict[str, Any]) -> str:
    session_key = _session_key_for_event(row)
    scenario_id = _normalize_optional_text(props.get("scenario_id"))
    if scenario_id:
        return f"{session_key}:{scenario_id}"
    route = _normalize_optional_text(row.route)
    if route:
        return f"{session_key}:{route}"
    return session_key


def _rate(numerator: int, denominator: int) -> float:
    if denominator <= 0:
        return 0.0
    return round(float(numerator) / float(denominator), 4)


def _question_dropoff_step(props: dict[str, Any]) -> int | None:
    raw = props.get("step")
    if isinstance(raw, bool):
        return None
    if isinstance(raw, int):
        return raw if raw > 0 else None
    if isinstance(raw, float):
        if raw.is_integer() and raw > 0:
            return int(raw)
        return None
    text = _normalize_optional_text(raw)
    if not text:
        return None
    try:
        value = int(text)
    except (TypeError, ValueError):
        return None
    return value if value > 0 else None


def _question_dropoff_category(row: MobileClientEvent, props: dict[str, Any]) -> str | None:
    raw = _normalize_optional_text(row.category) or _normalize_optional_text(props.get("category"))
    if not raw:
        return None
    key = raw.lower()
    if key not in VALID_CATEGORIES:
        return None
    return key


@lru_cache(maxsize=16)
def _question_dropoff_shared_question_meta_by_step(category: str) -> dict[int, tuple[str, str]]:
    normalized_category = str(category or "").strip().lower()
    if not normalized_category or normalized_category not in VALID_CATEGORIES:
        return {}
    try:
        config = load_mobile_decision_category_config(normalized_category)
    except Exception:
        return {}

    matrix = config.matrix if isinstance(config.matrix, dict) else {}
    raw_questions = matrix.get("questions")
    if not isinstance(raw_questions, list):
        return {}

    meta_by_step: dict[int, tuple[str, str]] = {}
    for index, raw_question in enumerate(raw_questions, start=1):
        if not isinstance(raw_question, dict):
            continue
        question_key = _normalize_optional_text(raw_question.get("key")) or f"step_{index}"
        question_title = _normalize_optional_text(raw_question.get("title")) or f"第{index}题"
        meta_by_step[index] = (question_key, question_title)
    return meta_by_step


def _question_dropoff_shared_question_meta(category: str, step: int) -> tuple[str, str] | None:
    if step <= 0:
        return None
    return _question_dropoff_shared_question_meta_by_step(category).get(step)


def _question_dropoff_question_key(category: str, props: dict[str, Any], step: int) -> str:
    shared_meta = _question_dropoff_shared_question_meta(category, step)
    if shared_meta:
        return shared_meta[0]
    return (
        _normalize_optional_text(props.get("question_key"))
        or _normalize_optional_text(props.get("questionId"))
        or f"step_{step}"
    )


def _question_dropoff_question_title(category: str, props: dict[str, Any], step: int) -> str:
    shared_meta = _question_dropoff_shared_question_meta(category, step)
    if shared_meta:
        return shared_meta[1]
    return (
        _normalize_optional_text(props.get("question_title"))
        or _normalize_optional_text(props.get("questionTitle"))
        or _normalize_optional_text(props.get("question_text"))
        or _normalize_optional_text(props.get("questionText"))
        or f"第{step}题"
    )


def _question_dropoff_sort_key(item: MobileAnalyticsQuestionDropoffItem) -> tuple[int, float, int, str]:
    return (-item.dropoff_sessions, -item.dropoff_rate, item.step, item.category)


def _stage_label(stage: str | None, props: dict[str, Any] | None = None) -> str:
    props = props or {}
    prop_label = _normalize_optional_text(props.get("stage_label"))
    if prop_label:
        return prop_label
    key = str(stage or "").strip()
    return ANALYTICS_STAGE_LABELS.get(key, key or "-")


def _event_detail(row: MobileClientEvent, props: dict[str, Any]) -> str | None:
    return (
        _normalize_optional_text(row.error_detail)
        or _normalize_optional_text(props.get("detail"))
        or _normalize_optional_text(props.get("error"))
        or _normalize_optional_text(props.get("reason_text"))
    )


def _event_prop_key(props: dict[str, Any], key: str, *, fallback: str = "unknown") -> str:
    value = _normalize_optional_text(props.get(key))
    return value or fallback


def _is_choose_category_start_event(row: MobileClientEvent) -> bool:
    return row.name in {"choose_category_start_click", "choose_start_click"}


def _is_questionnaire_step1_view_event(row: MobileClientEvent, props: dict[str, Any]) -> bool:
    return row.name == "questionnaire_view" and _question_dropoff_step(props) == 1


def _canonical_result_event_name(row: MobileClientEvent, props: dict[str, Any]) -> str | None:
    if row.name in ANALYTICS_RESULT_CANONICAL_EVENT_TO_CTA:
        return row.name
    result_cta = _normalize_optional_text(props.get("result_cta"))
    if row.name == "result_primary_cta_click" and result_cta == "bag_add":
        return "result_add_to_bag_click"
    if row.name == "result_secondary_loop_click" and result_cta:
        for event_name, expected_cta in ANALYTICS_RESULT_CANONICAL_EVENT_TO_CTA.items():
            if event_name == "result_add_to_bag_click":
                continue
            if result_cta == expected_cta:
                return event_name
    return None


def _result_secondary_action_key(row: MobileClientEvent, props: dict[str, Any], canonical_event_name: str) -> str:
    action_key = _normalize_optional_text(props.get("action"))
    if canonical_event_name == "result_rationale_entry_click" and action_key in {None, "", "wiki"}:
        return "rationale"
    if action_key:
        return action_key
    fallback_by_event = {
        "result_compare_entry_click": "compare",
        "result_rationale_entry_click": "rationale",
        "result_retry_same_category_click": "retry_same_category",
        "result_switch_category_click": "switch_category",
    }
    return fallback_by_event.get(canonical_event_name, "unknown")


def _compare_result_cta_click_key(row: MobileClientEvent, props: dict[str, Any]) -> str | None:
    if row.name == "compare_result_cta_click":
        return _normalize_optional_text(props.get("cta"))
    if row.name == "compare_result_accept_recommendation":
        return "recommendation_product"
    if row.name == "compare_result_open_rationale":
        return "recommendation_wiki"
    if row.name == "compare_result_keep_current":
        return "keep_current"
    return None


def _compare_result_cta_land_key(row: MobileClientEvent, props: dict[str, Any]) -> str | None:
    if row.name == "compare_result_cta_land":
        return _normalize_optional_text(props.get("cta"))
    if row.name == "compare_result_accept_recommendation_land":
        return "recommendation_product"
    if row.name == "compare_result_keep_current_land":
        return "keep_current"
    return None


def _canonical_compare_closure_action_key(row: MobileClientEvent, props: dict[str, Any]) -> str | None:
    direct_key = ANALYTICS_COMPARE_CLOSURE_EVENT_TO_ACTION_KEY.get(str(row.name or "").strip())
    if direct_key:
        return direct_key
    cta_key = _normalize_optional_text(props.get("cta"))
    if row.name == "compare_result_cta_click" and cta_key == "recommendation_wiki":
        return "open_rationale"
    if row.name == "compare_result_cta_land" and cta_key == "recommendation_product":
        return "accept_recommendation_land"
    return None


def _route_query_params(route: str | None) -> dict[str, str]:
    route_text = _normalize_optional_text(route)
    if not route_text or "?" not in route_text:
        return {}
    query_text = ""
    try:
        query_text = urlsplit(route_text).query
    except Exception:
        query_text = str(route_text.split("?", 1)[1] if "?" in route_text else "")
    if not query_text:
        return {}
    parsed = parse_qs(query_text, keep_blank_values=False)
    out: dict[str, str] = {}
    for key, values in parsed.items():
        if not values:
            continue
        value = _normalize_optional_text(values[0])
        if value:
            out[key] = value
    return out


def _event_route_state_value(props: dict[str, Any], route_query: dict[str, str], key: str) -> str | None:
    return _normalize_optional_text(props.get(key)) or _normalize_optional_text(route_query.get(key))


def _event_compare_provenance(
    row: MobileClientEvent,
    props: dict[str, Any],
    route_query: dict[str, str],
) -> str | None:
    return (
        _normalize_optional_text(props.get("compare_id"))
        or _normalize_optional_text(row.compare_id)
        or _normalize_optional_text(route_query.get("compare_id"))
        or _normalize_optional_text(props.get("from_compare_id"))
        or _normalize_optional_text(route_query.get("from_compare_id"))
    )


def _route_context_key(
    *,
    return_to: str | None,
    scenario_id: str | None,
    result_cta: str | None,
    compare_id: str | None,
) -> str:
    parts: list[str] = []
    if return_to:
        parts.append("return_to")
    if scenario_id:
        parts.append("scenario_id")
    if result_cta:
        parts.append("result_cta")
    if compare_id:
        parts.append("compare_id")
    return "+".join(parts) if parts else "none"


def _route_context_label(value: str) -> str:
    if value == "none":
        return "未携带 return_to / scenario_id / result_cta / compare_id"
    token_label_map = {
        "return_to": "return_to",
        "scenario_id": "scenario_id",
        "result_cta": "result_cta",
        "compare_id": "compare_id",
    }
    return " + ".join(token_label_map.get(token, token) for token in value.split("+"))


def _build_route_context_count_items(counter: Counter[str]) -> list[MobileAnalyticsCountItem]:
    label_map = {key: _route_context_label(key) for key in counter.keys()}
    return _build_count_items(counter, denominator=sum(counter.values()), label_map=label_map)


def _is_my_use_target_path(path: str | None) -> bool:
    target_path = _normalize_optional_text(path)
    if not target_path:
        return False
    return target_path == "/m/me/use" or target_path.startswith("/m/me/use?")


def _has_event_environment(props: dict[str, Any]) -> bool:
    return any(
        _normalize_optional_text(props.get(key))
        for key in ("browser_family", "os_family", "device_type", "viewport_bucket", "network_type", "lang")
    )


def _event_prop_float(props: dict[str, Any], key: str) -> float | None:
    value = props.get(key)
    if isinstance(value, (int, float)):
        return float(value)
    text = _normalize_optional_text(value)
    if not text:
        return None
    try:
        return float(text)
    except (TypeError, ValueError):
        return None


def _event_location_time_zone(props: dict[str, Any]) -> str | None:
    return _normalize_optional_text(props.get("location_time_zone"))


def _humanize_location_time_zone(value: str | None) -> str | None:
    time_zone = _normalize_optional_text(value)
    if not time_zone:
        return None
    if time_zone in ANALYTICS_TIME_ZONE_LABELS:
        return ANALYTICS_TIME_ZONE_LABELS[time_zone]
    leaf = time_zone.split("/")[-1].replace("_", " ").strip()
    return f"{leaf} 时区" if leaf else time_zone


def _format_location_accuracy_label(value: float | None) -> str | None:
    if value is None or value <= 0:
        return None
    if value >= 1000:
        return f"约{round(value / 1000, 1):.1f}km"
    return f"约{int(round(value))}m"


def _event_location_city(props: dict[str, Any]) -> str | None:
    city = (
        _normalize_optional_text(props.get("location_city"))
        or _normalize_optional_text(props.get("location_prefecture_city"))
        or _normalize_optional_text(props.get("location_city_name"))
        or _normalize_optional_text(props.get("location_admin_city"))
    )
    district = _normalize_optional_text(props.get("location_district")) or _normalize_optional_text(
        props.get("location_district_name")
    )
    if city and district and district not in city:
        return f"{city} {district}"
    if city:
        return city
    return district or _normalize_optional_text(props.get("location_province"))


def _event_location_label(props: dict[str, Any]) -> str | None:
    latitude = _event_prop_float(props, "location_latitude")
    longitude = _event_prop_float(props, "location_longitude")
    city = _event_location_city(props)
    time_zone = _event_location_time_zone(props)
    accuracy_m = _event_prop_float(props, "location_accuracy_m")
    parts: list[str] = []
    if city:
        parts.append(city)
    if latitude is not None and longitude is not None:
        parts.append(f"{latitude:.3f}, {longitude:.3f}")
    accuracy_label = _format_location_accuracy_label(accuracy_m)
    if accuracy_label:
        parts.append(accuracy_label)
    if parts:
        return " · ".join(parts)
    label = _normalize_optional_text(props.get("location_label"))
    if label:
        return label
    return _humanize_location_time_zone(time_zone) or time_zone


def _has_event_location(props: dict[str, Any]) -> bool:
    return bool(_event_location_label(props))


def _event_location_region_key(props: dict[str, Any]) -> str | None:
    latitude = _event_prop_float(props, "location_latitude")
    longitude = _event_prop_float(props, "location_longitude")
    time_zone = _event_location_time_zone(props)
    if latitude is None or longitude is None:
        return time_zone or _event_location_label(props)
    region = f"{round(latitude, 1):.1f}, {round(longitude, 1):.1f}"
    return f"{region}|{time_zone}" if time_zone else region


def _event_location_region_label(props: dict[str, Any]) -> str | None:
    latitude = _event_prop_float(props, "location_latitude")
    longitude = _event_prop_float(props, "location_longitude")
    city = _event_location_city(props)
    time_zone_label = _humanize_location_time_zone(_event_location_time_zone(props))
    if city and latitude is None and longitude is None:
        return city
    if latitude is None or longitude is None:
        return time_zone_label or _event_location_label(props)
    region = f"{round(latitude, 1):.1f}, {round(longitude, 1):.1f}"
    return f"{city} · {region}" if city else region


def _event_location_accuracy_bucket(props: dict[str, Any]) -> str:
    accuracy_m = _event_prop_float(props, "location_accuracy_m")
    if accuracy_m is None or accuracy_m <= 0:
        return "未上报精度"
    if accuracy_m <= 1000:
        return "≤1km"
    if accuracy_m <= 3000:
        return "1-3km"
    if accuracy_m <= 10000:
        return "3-10km"
    return ">10km"


def _percentile_fraction(values: list[float], percentile: float) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    if len(ordered) == 1:
        return round(float(ordered[0]), 2)
    index = int(round((len(ordered) - 1) * percentile))
    index = max(0, min(index, len(ordered) - 1))
    return round(float(ordered[index]), 2)


def _build_count_items(counter: Counter[str], *, denominator: int, label_map: dict[str, str] | None = None) -> list[MobileAnalyticsCountItem]:
    label_map = label_map or {}
    items = sorted(counter.items(), key=lambda item: (-item[1], label_map.get(item[0], item[0])))
    return [
        MobileAnalyticsCountItem(
            key=key,
            label=label_map.get(key, key),
            count=count,
            rate=_rate(count, denominator),
        )
        for key, count in items
    ]


@router.get("/products/analytics/mobile/overview", response_model=MobileAnalyticsOverviewResponse)
def get_mobile_analytics_overview(
    since_hours: int | None = Query(None, ge=1, le=24 * 365),
    date_from: str | None = Query(None),
    date_to: str | None = Query(None),
    category: str | None = Query(None),
    page: str | None = Query(None),
    stage: str | None = Query(None),
    error_code: str | None = Query(None),
    trigger_reason: str | None = Query(None),
    location_presence: str | None = Query(None),
    location_time_zone: str | None = Query(None),
    db: Session = Depends(get_db),
):
    filters, start_iso, end_iso = _resolve_mobile_analytics_filters(
        since_hours=since_hours,
        date_from=date_from,
        date_to=date_to,
        category=category,
        page=page,
        stage=stage,
        error_code=error_code,
        trigger_reason=trigger_reason,
        session_id=None,
        compare_id=None,
        owner_id=None,
        location_presence=location_presence,
        location_time_zone=location_time_zone,
        location_region=None,
    )
    rows = _query_mobile_client_events(
        db=db,
        filters=filters,
        start_iso=start_iso,
        end_iso=end_iso,
        names=list(ANALYTICS_OVERVIEW_EVENT_NAMES),
    )

    session_ids = {
        row.session_id.strip()
        for row, _props in rows
        if isinstance(row.session_id, str) and row.session_id.strip()
    }
    owner_ids = {
        row.owner_id.strip()
        for row, _props in rows
        if isinstance(row.owner_id, str) and row.owner_id.strip()
    }
    home_primary_cta_click_sessions = {
        row.session_id.strip()
        for row, _props in rows
        if row.name == "home_primary_cta_click" and str(row.session_id or "").strip()
    }
    home_workspace_quick_action_click_sessions = {
        row.session_id.strip()
        for row, _props in rows
        if row.name == "home_workspace_quick_action_click" and str(row.session_id or "").strip()
    }
    choose_view_sessions = {
        row.session_id.strip()
        for row, _props in rows
        if row.name == "choose_view" and str(row.session_id or "").strip()
    }
    choose_start_click_sessions = {
        row.session_id.strip()
        for row, _props in rows
        if _is_choose_category_start_event(row) and str(row.session_id or "").strip()
    }
    questionnaire_completed_sessions = {
        row.session_id.strip()
        for row, _props in rows
        if row.name == "questionnaire_completed" and str(row.session_id or "").strip()
    }
    wiki_detail_views = {
        row.session_id.strip()
        for row, _props in rows
        if row.name == "page_view" and str(row.page or "").strip() == "wiki_product_detail" and str(row.session_id or "").strip()
    }
    cta_expose = {
        row.session_id.strip()
        for row, _props in rows
        if row.name == "wiki_upload_cta_expose" and str(row.session_id or "").strip()
    }
    cta_click = {
        row.session_id.strip()
        for row, _props in rows
        if row.name == "wiki_upload_cta_click" and str(row.session_id or "").strip()
    }
    use_page_views = {
        row.session_id.strip()
        for row, _props in rows
        if row.name == "page_view" and str(row.page or "").strip() == "my_use" and str(row.session_id or "").strip()
    }
    use_category_clicks = {
        row.session_id.strip()
        for row, _props in rows
        if row.name == "my_use_category_card_click" and str(row.session_id or "").strip()
    }
    compare_run_start_keys = {
        _compare_key_for_event(row)
        for row, _props in rows
        if row.name == "compare_run_start"
    }
    compare_run_start_sessions = {
        row.session_id.strip()
        for row, _props in rows
        if row.name == "compare_run_start" and str(row.session_id or "").strip()
    }
    compare_run_success_keys = {
        _compare_key_for_event(row)
        for row, _props in rows
        if row.name == "compare_run_success"
    }
    compare_result_view_sessions = {
        row.session_id.strip()
        for row, _props in rows
        if row.name == "compare_result_view" and str(row.session_id or "").strip()
    }
    compare_result_view_keys = {
        _compare_key_for_event(row)
        for row, _props in rows
        if row.name == "compare_result_view"
    }
    result_view_sessions = {
        row.session_id.strip()
        for row, _props in rows
        if row.name == "result_view" and str(row.session_id or "").strip()
    }
    result_view_keys = {
        _decision_result_key_for_event(row, props)
        for row, props in rows
        if row.name == "result_view"
    }
    result_primary_cta_click_sessions = {
        row.session_id.strip()
        for row, props in rows
        if _canonical_result_event_name(row, props) == "result_add_to_bag_click" and str(row.session_id or "").strip()
    }
    result_primary_cta_click_keys = {
        _decision_result_key_for_event(row, props)
        for row, props in rows
        if _canonical_result_event_name(row, props) == "result_add_to_bag_click"
    }
    result_secondary_loop_click_sessions = {
        row.session_id.strip()
        for row, props in rows
        if _canonical_result_event_name(row, props) in ANALYTICS_RESULT_SECONDARY_CANONICAL_EVENTS
        and str(row.session_id or "").strip()
    }
    result_secondary_loop_click_keys = {
        _decision_result_key_for_event(row, props)
        for row, props in rows
        if _canonical_result_event_name(row, props) in ANALYTICS_RESULT_SECONDARY_CANONICAL_EVENTS
    }
    utility_return_click_sessions = {
        row.session_id.strip()
        for row, _props in rows
        if row.name == "utility_return_click" and str(row.session_id or "").strip()
    }
    utility_return_click_keys = {
        _decision_result_key_for_event(row, props)
        for row, props in rows
        if row.name == "utility_return_click"
    }

    question_view_session_keys: set[tuple[str, str, int]] = set()
    question_answered_session_keys: set[tuple[str, str, int]] = set()
    question_meta_by_category_step: dict[tuple[str, int], tuple[str, str]] = {}
    for row, props in rows:
        if row.name not in {"questionnaire_view", "question_answered"}:
            continue
        session_id = _normalize_optional_text(row.session_id)
        if not session_id:
            continue
        category_key = _question_dropoff_category(row, props)
        if not category_key:
            continue
        step = _question_dropoff_step(props)
        if step is None:
            continue

        identity = (session_id, category_key, step)
        if row.name == "questionnaire_view":
            question_view_session_keys.add(identity)
        else:
            question_answered_session_keys.add(identity)

        meta_key = (category_key, step)
        next_question_key = _question_dropoff_question_key(category_key, props, step)
        next_question_title = _question_dropoff_question_title(category_key, props, step)
        prev_meta = question_meta_by_category_step.get(meta_key)
        if prev_meta is None:
            question_meta_by_category_step[meta_key] = (next_question_key, next_question_title)
            continue
        prev_question_key, prev_question_title = prev_meta
        if prev_question_key.startswith("step_") and not next_question_key.startswith("step_"):
            prev_question_key = next_question_key
        if prev_question_title.startswith("第") and prev_question_title.endswith("题") and not (
            next_question_title.startswith("第") and next_question_title.endswith("题")
        ):
            prev_question_title = next_question_title
        question_meta_by_category_step[meta_key] = (prev_question_key, prev_question_title)

    question_view_counter: Counter[tuple[str, int]] = Counter()
    question_answered_counter: Counter[tuple[str, int]] = Counter()
    for _session_id, category_key, step in question_view_session_keys:
        question_view_counter[(category_key, step)] += 1
    for _session_id, category_key, step in question_answered_session_keys:
        question_answered_counter[(category_key, step)] += 1

    question_dropoff_items: list[MobileAnalyticsQuestionDropoffItem] = []
    for (category_key, step), questionnaire_view_count in question_view_counter.items():
        question_answered_count = question_answered_counter.get((category_key, step), 0)
        dropoff_sessions = max(questionnaire_view_count - question_answered_count, 0)
        question_key, question_title = question_meta_by_category_step.get(
            (category_key, step),
            (f"step_{step}", f"第{step}题"),
        )
        question_dropoff_items.append(
            MobileAnalyticsQuestionDropoffItem(
                category=category_key,
                step=step,
                question_key=question_key,
                question_title=question_title,
                questionnaire_view_sessions=questionnaire_view_count,
                question_answered_sessions=question_answered_count,
                dropoff_sessions=dropoff_sessions,
                dropoff_rate=_rate(dropoff_sessions, questionnaire_view_count),
            )
        )

    sorted_question_dropoff_items = sorted(question_dropoff_items, key=_question_dropoff_sort_key)
    question_dropoff_top = sorted_question_dropoff_items[0] if sorted_question_dropoff_items else None
    question_dropoff_by_category_map: dict[str, MobileAnalyticsQuestionDropoffItem] = {}
    for item in sorted_question_dropoff_items:
        if item.category not in question_dropoff_by_category_map:
            question_dropoff_by_category_map[item.category] = item
    question_dropoff_by_category = [
        question_dropoff_by_category_map[key]
        for key in sorted(question_dropoff_by_category_map.keys())
    ]
    question_dropoff_status = "live" if question_dropoff_top else ANALYTICS_QUESTION_DROPOFF_STATUS
    question_dropoff_reason = "" if question_dropoff_top else ANALYTICS_QUESTION_DROPOFF_REASON

    result_reach_keys = result_view_keys or compare_result_view_keys
    feedback_prompt_show = sum(1 for row, _props in rows if row.name == "feedback_prompt_show")
    feedback_submit = sum(1 for row, _props in rows if row.name == "feedback_submit")

    return MobileAnalyticsOverviewResponse(
        status="ok",
        filters=filters,
        total_events=len(rows),
        sessions=len(session_ids),
        owners=len(owner_ids),
        home_primary_cta_click_sessions=len(home_primary_cta_click_sessions),
        home_workspace_quick_action_click_sessions=len(home_workspace_quick_action_click_sessions),
        choose_view_sessions=len(choose_view_sessions),
        choose_start_click_sessions=len(choose_start_click_sessions),
        questionnaire_completed_sessions=len(questionnaire_completed_sessions),
        result_view_sessions=len(result_view_sessions),
        result_primary_cta_click_sessions=len(result_primary_cta_click_sessions),
        result_secondary_loop_click_sessions=len(result_secondary_loop_click_sessions),
        utility_return_click_sessions=len(utility_return_click_sessions),
        compare_result_view_sessions=len(compare_result_view_sessions),
        choose_start_rate_from_choose_view=_rate(len(choose_start_click_sessions), len(choose_view_sessions)),
        result_view_rate_from_home_primary_cta=_rate(len(result_view_sessions), len(home_primary_cta_click_sessions)),
        result_primary_cta_rate_from_result_view=_rate(len(result_primary_cta_click_sessions), len(result_view_sessions)),
        result_loop_entry_rate_from_result_view=_rate(len(result_secondary_loop_click_sessions), len(result_view_sessions)),
        utility_return_rate_from_result_loop=_rate(len(utility_return_click_sessions), len(result_secondary_loop_click_sessions)),
        question_dropoff_status=question_dropoff_status,
        question_dropoff_reason=question_dropoff_reason,
        question_dropoff_top=question_dropoff_top,
        question_dropoff_by_category=question_dropoff_by_category,
        wiki_detail_views=len(wiki_detail_views),
        cta_expose=len(cta_expose),
        cta_click=len(cta_click),
        cta_ctr=_rate(len(cta_click), len(cta_expose)),
        use_page_views=len(use_page_views),
        use_category_clicks=len(use_category_clicks),
        use_to_compare_rate=_rate(len(compare_run_start_sessions), len(use_page_views)),
        compare_run_start=len(compare_run_start_keys),
        compare_run_success=len(compare_run_success_keys),
        compare_completion_rate=_rate(len(compare_run_success_keys), len(compare_run_start_keys)),
        compare_result_view=len(compare_result_view_keys),
        result_view=len(result_view_keys),
        result_primary_cta_click=len(result_primary_cta_click_keys),
        result_secondary_loop_click=len(result_secondary_loop_click_keys),
        utility_return_click=len(utility_return_click_keys),
        result_reach_rate=_rate(len(result_reach_keys), len(compare_run_success_keys)),
        feedback_prompt_show=feedback_prompt_show,
        feedback_submit=feedback_submit,
        feedback_submit_rate=_rate(feedback_submit, feedback_prompt_show),
    )


@router.get("/products/analytics/mobile/funnel", response_model=MobileAnalyticsFunnelResponse)
def get_mobile_analytics_funnel(
    since_hours: int | None = Query(None, ge=1, le=24 * 365),
    date_from: str | None = Query(None),
    date_to: str | None = Query(None),
    category: str | None = Query(None),
    location_presence: str | None = Query(None),
    location_time_zone: str | None = Query(None),
    db: Session = Depends(get_db),
):
    filters, start_iso, end_iso = _resolve_mobile_analytics_filters(
        since_hours=since_hours,
        date_from=date_from,
        date_to=date_to,
        category=category,
        page=None,
        stage=None,
        error_code=None,
        trigger_reason=None,
        session_id=None,
        compare_id=None,
        owner_id=None,
        location_presence=location_presence,
        location_time_zone=location_time_zone,
        location_region=None,
    )
    rows = _query_mobile_client_events(
        db=db,
        filters=filters,
        start_iso=start_iso,
        end_iso=end_iso,
        names=list(ANALYTICS_FUNNEL_EVENT_NAMES),
    )

    step_sessions: dict[str, set[str]] = {
        key: set() for key, _label in ANALYTICS_P0_FUNNEL_STEPS
    }
    for row, props in rows:
        session_id = _normalize_optional_text(row.session_id)
        if row.name == "home_primary_cta_click" and session_id:
            step_sessions["home_primary_cta"].add(session_id)
        elif _is_choose_category_start_event(row) and session_id:
            step_sessions["choose_category_start"].add(session_id)
        elif _is_questionnaire_step1_view_event(row, props) and session_id:
            step_sessions["questionnaire_step1_view"].add(session_id)
        elif row.name == "questionnaire_completed" and session_id:
            step_sessions["questionnaire_completed"].add(session_id)
        elif row.name == "result_view" and session_id:
            step_sessions["result_view"].add(session_id)

    steps: list[MobileAnalyticsFunnelStep] = []
    first_count = 0
    previous_count = 0
    for index, (step_key, step_label) in enumerate(ANALYTICS_P0_FUNNEL_STEPS):
        count = len(step_sessions[step_key])
        if index == 0:
            first_count = count
            previous_count = count
        steps.append(
            MobileAnalyticsFunnelStep(
                step_key=step_key,
                step_label=step_label,
                count=count,
                from_prev_rate=1.0 if index == 0 and count > 0 else _rate(count, previous_count),
                from_first_rate=1.0 if index == 0 and count > 0 else _rate(count, first_count),
            )
        )
        previous_count = count

    return MobileAnalyticsFunnelResponse(status="ok", filters=filters, steps=steps)


@router.get("/products/analytics/mobile/errors", response_model=MobileAnalyticsErrorsResponse)
def get_mobile_analytics_errors(
    since_hours: int | None = Query(None, ge=1, le=24 * 365),
    date_from: str | None = Query(None),
    date_to: str | None = Query(None),
    category: str | None = Query(None),
    stage: str | None = Query(None),
    error_code: str | None = Query(None),
    location_presence: str | None = Query(None),
    location_time_zone: str | None = Query(None),
    db: Session = Depends(get_db),
):
    filters, start_iso, end_iso = _resolve_mobile_analytics_filters(
        since_hours=since_hours,
        date_from=date_from,
        date_to=date_to,
        category=category,
        page=None,
        stage=stage,
        error_code=error_code,
        trigger_reason=None,
        session_id=None,
        compare_id=None,
        owner_id=None,
        location_presence=location_presence,
        location_time_zone=location_time_zone,
        location_region=None,
    )
    rows = _query_mobile_client_events(
        db=db,
        filters=filters,
        start_iso=start_iso,
        end_iso=end_iso,
        names=[
            "compare_upload_fail",
            "compare_stage_error",
            "compare_stage_progress",
            "compare_run_start",
            "compare_run_success",
        ],
    )

    compare_run_start = {
        _compare_key_for_event(row)
        for row, _props in rows
        if row.name == "compare_run_start"
    }
    error_signature_seen: set[str] = set()
    error_rows: list[tuple[MobileClientEvent, dict[str, Any]]] = []
    for row, props in rows:
        if row.name not in {"compare_upload_fail", "compare_stage_error"}:
            continue
        detail = _event_detail(row, props) or ""
        signature = "|".join(
            [
                _compare_key_for_event(row),
                str(row.name or "").strip(),
                str(row.stage or "").strip(),
                str(row.error_code or "").strip(),
                detail,
            ]
        )
        if signature in error_signature_seen:
            continue
        error_signature_seen.add(signature)
        error_rows.append((row, props))

    stage_counter: Counter[str] = Counter()
    stage_label_map: dict[str, str] = {}
    error_code_counter: Counter[str] = Counter()
    matrix_counter: Counter[tuple[str, str]] = Counter()
    for row, props in error_rows:
        stage_key = _normalize_optional_text(row.stage) or "unknown"
        stage_counter[stage_key] += 1
        stage_label_map[stage_key] = _stage_label(stage_key, props)
        error_key = _normalize_optional_text(row.error_code) or "unknown"
        error_code_counter[error_key] += 1
        matrix_counter[(stage_key, error_key)] += 1

    progress_by_compare: dict[str, list[tuple[datetime, MobileClientEvent, dict[str, Any]]]] = defaultdict(list)
    success_at_by_compare: dict[str, datetime] = {}
    for row, props in rows:
        compare_key = _normalize_optional_text(row.compare_id)
        if not compare_key:
            continue
        created_at = _parse_utc_datetime(str(row.created_at or "").strip())
        if created_at is None:
            continue
        if row.name == "compare_stage_progress":
            progress_by_compare[compare_key].append((created_at, row, props))
        elif row.name == "compare_run_success":
            success_at_by_compare[compare_key] = created_at

    duration_by_stage: dict[str, list[float]] = defaultdict(list)
    duration_label_map: dict[str, str] = {}
    for compare_key, items in progress_by_compare.items():
        ordered = sorted(items, key=lambda item: item[0])
        for index, current in enumerate(ordered):
            current_dt, current_row, current_props = current
            next_dt: datetime | None = ordered[index + 1][0] if index + 1 < len(ordered) else success_at_by_compare.get(compare_key)
            if next_dt is None or next_dt < current_dt:
                continue
            stage_key = _normalize_optional_text(current_row.stage) or "unknown"
            duration_by_stage[stage_key].append(float((next_dt - current_dt).total_seconds()))
            duration_label_map[stage_key] = _stage_label(stage_key, current_props)

    total_errors = len(error_rows)
    stage_error_matrix = [
        MobileAnalyticsStageErrorMatrixItem(
            stage=stage_key,
            stage_label=stage_label_map.get(stage_key, stage_key),
            error_code=error_key,
            count=count,
            rate=_rate(count, total_errors),
        )
        for (stage_key, error_key), count in sorted(matrix_counter.items(), key=lambda item: (-item[1], item[0][0], item[0][1]))
    ]
    stage_duration_estimates = [
        MobileAnalyticsStageDurationItem(
            stage=stage_key,
            stage_label=duration_label_map.get(stage_key, stage_key),
            samples=len(values),
            avg_seconds=round(sum(values) / len(values), 2) if values else 0.0,
            p50_seconds=_percentile_fraction(values, 0.5),
            p95_seconds=_percentile_fraction(values, 0.95),
        )
        for stage_key, values in sorted(duration_by_stage.items(), key=lambda item: (-len(item[1]), item[0]))
    ]

    return MobileAnalyticsErrorsResponse(
        status="ok",
        filters=filters,
        compare_run_start=len(compare_run_start),
        total_errors=total_errors,
        by_stage=_build_count_items(stage_counter, denominator=total_errors, label_map=stage_label_map),
        by_error_code=_build_count_items(error_code_counter, denominator=total_errors),
        stage_error_matrix=stage_error_matrix,
        stage_duration_estimates=stage_duration_estimates,
    )


@router.get("/products/analytics/mobile/feedback", response_model=MobileAnalyticsFeedbackResponse)
def get_mobile_analytics_feedback(
    since_hours: int | None = Query(None, ge=1, le=24 * 365),
    date_from: str | None = Query(None),
    date_to: str | None = Query(None),
    category: str | None = Query(None),
    trigger_reason: str | None = Query(None),
    location_presence: str | None = Query(None),
    location_time_zone: str | None = Query(None),
    db: Session = Depends(get_db),
):
    filters, start_iso, end_iso = _resolve_mobile_analytics_filters(
        since_hours=since_hours,
        date_from=date_from,
        date_to=date_to,
        category=category,
        page=None,
        stage=None,
        error_code=None,
        trigger_reason=trigger_reason,
        session_id=None,
        compare_id=None,
        owner_id=None,
        location_presence=location_presence,
        location_time_zone=location_time_zone,
        location_region=None,
    )
    rows = _query_mobile_client_events(
        db=db,
        filters=filters,
        start_iso=start_iso,
        end_iso=end_iso,
        names=["feedback_prompt_show", "feedback_submit", "feedback_skip"],
        desc=True,
    )

    prompt_counter: Counter[str] = Counter()
    reason_counter: Counter[str] = Counter()
    matrix_counter: Counter[tuple[str, str]] = Counter()
    text_samples: list[MobileAnalyticsFeedbackTextSample] = []
    total_prompts = 0
    total_submissions = 0

    for row, props in rows:
        trigger = _normalize_optional_text(props.get("trigger_reason")) or "unknown"
        if row.name == "feedback_prompt_show":
            total_prompts += 1
            prompt_counter[trigger] += 1
            continue
        if row.name != "feedback_submit":
            continue
        total_submissions += 1
        reason = _normalize_optional_text(props.get("reason_label")) or "unknown"
        reason_counter[reason] += 1
        matrix_counter[(trigger, reason)] += 1
        text_value = _normalize_optional_text(props.get("reason_text"))
        if text_value:
            text_samples.append(
                MobileAnalyticsFeedbackTextSample(
                    event_id=row.event_id,
                    created_at=str(row.created_at or ""),
                    trigger_reason=trigger,
                    reason_label=reason,
                    reason_text=text_value,
                    category=_normalize_optional_text(row.category),
                    compare_id=_normalize_optional_text(row.compare_id),
                    stage=_normalize_optional_text(row.stage),
                    session_id=_normalize_optional_text(row.session_id),
                )
            )

    matrix_items = [
        MobileAnalyticsFeedbackMatrixItem(
            trigger_reason=trigger,
            reason_label=reason,
            count=count,
            rate=_rate(count, total_submissions),
        )
        for (trigger, reason), count in sorted(matrix_counter.items(), key=lambda item: (-item[1], item[0][0], item[0][1]))
    ]

    return MobileAnalyticsFeedbackResponse(
        status="ok",
        filters=filters,
        total_prompts=total_prompts,
        total_submissions=total_submissions,
        by_trigger_reason=_build_count_items(prompt_counter, denominator=total_prompts),
        by_reason_label=_build_count_items(reason_counter, denominator=total_submissions),
        trigger_reason_matrix=matrix_items,
        recent_text_samples=text_samples[:12],
    )


@router.get("/products/analytics/mobile/experience", response_model=MobileAnalyticsExperienceResponse)
def get_mobile_analytics_experience(
    since_hours: int | None = Query(None, ge=1, le=24 * 365),
    date_from: str | None = Query(None),
    date_to: str | None = Query(None),
    category: str | None = Query(None),
    page: str | None = Query(None),
    location_presence: str | None = Query(None),
    location_time_zone: str | None = Query(None),
    db: Session = Depends(get_db),
):
    filters, start_iso, end_iso = _resolve_mobile_analytics_filters(
        since_hours=since_hours,
        date_from=date_from,
        date_to=date_to,
        category=category,
        page=page,
        stage=None,
        error_code=None,
        trigger_reason=None,
        session_id=None,
        compare_id=None,
        owner_id=None,
        location_presence=location_presence,
        location_time_zone=location_time_zone,
        location_region=None,
    )
    rows = _query_mobile_client_events(
        db=db,
        filters=filters,
        start_iso=start_iso,
        end_iso=end_iso,
        names=list(ANALYTICS_EXPERIENCE_EVENT_NAMES),
    )

    wiki_product_list_views = 0
    wiki_product_clicks = 0
    wiki_ingredient_list_views = 0
    wiki_ingredient_clicks = 0
    compare_result_views = 0
    decision_result_views = 0
    decision_result_primary_cta_clicks = 0
    decision_result_secondary_loop_clicks = 0
    utility_return_clicks = 0
    home_workspace_quick_action_clicks = 0
    compare_entry_views = 0
    compare_upload_starts = 0
    compare_upload_successes = 0
    compare_closure_accept_recommendation = 0
    compare_closure_keep_current = 0
    compare_keep_current_my_use_clicks = 0
    rationale_view = 0
    rationale_to_bag_click = 0
    rationale_to_compare_click = 0
    compare_result_leaves = 0
    result_dwell_values: list[float] = []
    scroll_depth_counter: Counter[tuple[str, int]] = Counter()
    result_scroll_75_keys: set[str] = set()
    result_scroll_100_keys: set[str] = set()
    stall_counter: Counter[str] = Counter()
    rage_counter: Counter[tuple[str, str]] = Counter()
    dead_click_counter: Counter[tuple[str, str]] = Counter()
    result_cta_counter: Counter[str] = Counter()
    result_cta_land_counter: Counter[str] = Counter()
    result_cta_click_sessions: dict[str, set[str]] = defaultdict(set)
    result_cta_land_sessions: dict[str, set[str]] = defaultdict(set)
    result_cta_completion_sessions: dict[tuple[str, str], set[str]] = defaultdict(set)
    compare_entry_result_cta_counter: Counter[str] = Counter()
    compare_upload_start_result_cta_counter: Counter[str] = Counter()
    compare_upload_success_result_cta_counter: Counter[str] = Counter()
    compare_entry_route_context_counter: Counter[str] = Counter()
    compare_upload_start_route_context_counter: Counter[str] = Counter()
    compare_upload_success_route_context_counter: Counter[str] = Counter()
    compare_keep_current_target_path_sessions: dict[str, set[str]] = defaultdict(set)
    compare_keep_current_my_use_keys: set[str] = set()
    result_secondary_loop_action_counter: Counter[str] = Counter()
    utility_return_action_counter: Counter[str] = Counter()
    result_primary_cta_result_cta_counter: Counter[str] = Counter()
    result_primary_cta_target_path_counter: Counter[str] = Counter()
    result_secondary_loop_result_cta_counter: Counter[str] = Counter()
    result_secondary_loop_target_path_counter: Counter[str] = Counter()
    utility_return_result_cta_counter: Counter[str] = Counter()
    utility_return_target_path_counter: Counter[str] = Counter()
    home_workspace_quick_action_counter: Counter[str] = Counter()
    compare_closure_action_sessions: dict[str, set[str]] = defaultdict(set)
    rationale_closure_action_counter: Counter[str] = Counter()
    browser_counter: Counter[str] = Counter()
    os_counter: Counter[str] = Counter()
    device_counter: Counter[str] = Counter()
    viewport_counter: Counter[str] = Counter()
    network_counter: Counter[str] = Counter()
    language_counter: Counter[str] = Counter()
    memory_counter: Counter[str] = Counter()
    cpu_counter: Counter[str] = Counter()
    touch_counter: Counter[str] = Counter()
    online_counter: Counter[str] = Counter()
    location_region_counter: Counter[str] = Counter()
    location_time_zone_counter: Counter[str] = Counter()
    location_accuracy_counter: Counter[str] = Counter()
    location_region_labels: dict[str, str] = {}
    location_time_zone_labels: dict[str, str] = {}

    page_view_counter: Counter[str] = Counter()
    env_seen_sessions: set[str] = set()
    session_keys_seen: set[str] = set()
    location_capture_sessions: set[str] = set()
    location_capture_events = 0
    latest_location_by_session: dict[str, dict[str, Any]] = {}

    for row, props in rows:
        row_page = _normalize_optional_text(row.page) or "unknown"
        session_key = _session_key_for_event(row)
        session_keys_seen.add(session_key)
        if session_key not in env_seen_sessions and _has_event_environment(props):
            env_seen_sessions.add(session_key)
            browser_counter[_event_prop_key(props, "browser_family")] += 1
            os_counter[_event_prop_key(props, "os_family")] += 1
            device_counter[_event_prop_key(props, "device_type")] += 1
            viewport_counter[_event_prop_key(props, "viewport_bucket")] += 1
            network_counter[_event_prop_key(props, "network_type")] += 1
            language_counter[_event_prop_key(props, "lang")] += 1
            memory_counter[_event_prop_key(props, "device_memory_bucket")] += 1
            cpu_counter[_event_prop_key(props, "cpu_core_bucket")] += 1
            touch_counter[_event_prop_key(props, "touch_points_bucket")] += 1
            online_counter[_event_prop_key(props, "online_state")] += 1
        if _has_event_location(props):
            latest_location_by_session[session_key] = props
        if row.name == "location_context_captured":
            location_capture_events += 1
            location_capture_sessions.add(session_key)
        compare_closure_action_key = _canonical_compare_closure_action_key(row, props)
        if compare_closure_action_key:
            compare_key = f"{session_key}:{_normalize_optional_text(row.compare_id) or 'no-compare'}"
            compare_closure_action_sessions[compare_closure_action_key].add(compare_key)
        compare_cta_click_key = _compare_result_cta_click_key(row, props)
        if compare_cta_click_key:
            result_cta_counter[compare_cta_click_key] += 1
            result_cta_click_sessions[compare_cta_click_key].add(
                f"{session_key}:{_normalize_optional_text(row.compare_id) or 'no-compare'}:{compare_cta_click_key}"
            )
        compare_cta_land_key = _compare_result_cta_land_key(row, props)
        if compare_cta_land_key:
            result_cta_land_counter[compare_cta_land_key] += 1
            origin_compare_id = (
                _normalize_optional_text(props.get("from_compare_id"))
                or _normalize_optional_text(row.compare_id)
                or "no-compare"
            )
            result_cta_land_sessions[compare_cta_land_key].add(
                f"{session_key}:{origin_compare_id}:{compare_cta_land_key}"
            )
        if row.name in ANALYTICS_CTA_COMPLETION_LABELS:
            cta_key = _normalize_optional_text(props.get("result_cta")) or _normalize_optional_text(props.get("cta"))
            if cta_key:
                origin_compare_id = _normalize_optional_text(props.get("from_compare_id")) or _normalize_optional_text(row.compare_id) or "no-compare"
                completion_key = row.name
                result_cta_completion_sessions[(cta_key, completion_key)].add(
                    f"{session_key}:{origin_compare_id}:{cta_key}:{completion_key}"
                )
        if row.name == "page_view":
            continue
        if row.name == "wiki_list_view":
            entry_tab = _normalize_optional_text(props.get("entry_tab")) or "product"
            page_view_counter[row_page] += 1
            if entry_tab == "ingredient":
                wiki_ingredient_list_views += 1
            else:
                wiki_product_list_views += 1
            continue
        if row.name == "wiki_product_click":
            wiki_product_clicks += 1
            continue
        if row.name == "wiki_ingredient_click":
            wiki_ingredient_clicks += 1
            continue
        if row.name == "compare_entry_view":
            compare_entry_views += 1
            route_query = _route_query_params(row.route)
            result_cta = _event_route_state_value(props, route_query, "result_cta")
            compare_entry_result_cta_counter[result_cta or "unknown"] += 1
            compare_entry_route_context_counter[
                _route_context_key(
                    return_to=_event_route_state_value(props, route_query, "return_to"),
                    scenario_id=_event_route_state_value(props, route_query, "scenario_id"),
                    result_cta=result_cta,
                    compare_id=_event_compare_provenance(row, props, route_query),
                )
            ] += 1
            continue
        if row.name == "compare_upload_start":
            compare_upload_starts += 1
            route_query = _route_query_params(row.route)
            result_cta = _event_route_state_value(props, route_query, "result_cta")
            compare_upload_start_result_cta_counter[result_cta or "unknown"] += 1
            compare_upload_start_route_context_counter[
                _route_context_key(
                    return_to=_event_route_state_value(props, route_query, "return_to"),
                    scenario_id=_event_route_state_value(props, route_query, "scenario_id"),
                    result_cta=result_cta,
                    compare_id=_event_compare_provenance(row, props, route_query),
                )
            ] += 1
            continue
        if row.name == "compare_upload_success":
            compare_upload_successes += 1
            route_query = _route_query_params(row.route)
            result_cta = _event_route_state_value(props, route_query, "result_cta")
            compare_upload_success_result_cta_counter[result_cta or "unknown"] += 1
            compare_upload_success_route_context_counter[
                _route_context_key(
                    return_to=_event_route_state_value(props, route_query, "return_to"),
                    scenario_id=_event_route_state_value(props, route_query, "scenario_id"),
                    result_cta=result_cta,
                    compare_id=_event_compare_provenance(row, props, route_query),
                )
            ] += 1
            continue
        if row.name == "compare_result_view":
            compare_result_views += 1
            page_view_counter[row_page] += 1
            continue
        if row.name == "result_view":
            decision_result_views += 1
            continue
        canonical_result_event_name = _canonical_result_event_name(row, props)
        if canonical_result_event_name == "result_add_to_bag_click":
            decision_result_primary_cta_clicks += 1
            result_primary_cta_result_cta_counter[ANALYTICS_RESULT_CANONICAL_EVENT_TO_CTA[canonical_result_event_name]] += 1
            result_primary_cta_target_path_counter[_event_prop_key(props, "target_path")] += 1
            continue
        if canonical_result_event_name in ANALYTICS_RESULT_SECONDARY_CANONICAL_EVENTS:
            decision_result_secondary_loop_clicks += 1
            action_key = _result_secondary_action_key(row, props, canonical_result_event_name)
            result_secondary_loop_action_counter[action_key] += 1
            result_secondary_loop_result_cta_counter[ANALYTICS_RESULT_CANONICAL_EVENT_TO_CTA[canonical_result_event_name]] += 1
            result_secondary_loop_target_path_counter[_event_prop_key(props, "target_path")] += 1
            continue
        if row.name == "utility_return_click":
            utility_return_clicks += 1
            action_key = _normalize_optional_text(props.get("action")) or "unknown"
            utility_return_action_counter[action_key] += 1
            utility_return_result_cta_counter[_event_prop_key(props, "result_cta")] += 1
            utility_return_target_path_counter[_event_prop_key(props, "target_path")] += 1
            continue
        if row.name == "home_workspace_quick_action_click":
            home_workspace_quick_action_clicks += 1
            action_key = _normalize_optional_text(props.get("action")) or "unknown"
            home_workspace_quick_action_counter[action_key] += 1
            continue
        if row.name == "compare_result_accept_recommendation":
            compare_closure_accept_recommendation += 1
            continue
        if row.name == "compare_result_keep_current":
            compare_closure_keep_current += 1
            target_path = _normalize_optional_text(props.get("target_path"))
            compare_key = f"{session_key}:{_normalize_optional_text(row.compare_id) or 'no-compare'}"
            compare_keep_current_target_path_sessions[target_path or "unknown"].add(compare_key)
            if _is_my_use_target_path(target_path):
                compare_keep_current_my_use_keys.add(compare_key)
            continue
        if row.name == "compare_result_keep_current_land":
            target_path = _normalize_optional_text(props.get("target_path"))
            compare_key = f"{session_key}:{_normalize_optional_text(row.compare_id) or 'no-compare'}"
            compare_keep_current_target_path_sessions[target_path or "unknown"].add(compare_key)
            if _is_my_use_target_path(target_path):
                compare_keep_current_my_use_keys.add(compare_key)
            continue
        if row.name in {
            "compare_result_hold_current",
            "compare_result_view_key_differences",
            "compare_result_open_rationale",
            "compare_result_retry_current_product",
            "compare_result_switch_category_click",
            "compare_result_accept_recommendation_land",
            "compare_result_cta_click",
            "compare_result_cta_land",
        }:
            continue
        if row.name == "rationale_view":
            rationale_view += 1
            rationale_closure_action_counter["view"] += 1
            continue
        if row.name == "rationale_to_bag_click":
            rationale_to_bag_click += 1
            rationale_closure_action_counter["to_bag"] += 1
            continue
        if row.name == "rationale_to_compare_click":
            rationale_to_compare_click += 1
            rationale_closure_action_counter["to_compare"] += 1
            continue
        if row.name == "compare_result_leave":
            compare_result_leaves += 1
            dwell_ms = props.get("dwell_ms")
            if isinstance(dwell_ms, (int, float)):
                result_dwell_values.append(float(dwell_ms))
            continue
        if row.name == "scroll_depth":
            depth_value = props.get("depth_percent")
            if not isinstance(depth_value, (int, float)):
                continue
            depth_percent = int(depth_value)
            scroll_depth_counter[(row_page, depth_percent)] += 1
            if row_page != "compare_result":
                continue
            compare_key = _compare_key_for_event(row)
            session_key = _normalize_optional_text(row.session_id) or compare_key
            unique_key = f"{session_key}:{_normalize_optional_text(row.route) or ''}:{depth_percent}"
            if depth_percent == 75:
                result_scroll_75_keys.add(unique_key)
            if depth_percent == 100:
                result_scroll_100_keys.add(unique_key)
            continue
        if row.name == "stall_detected":
            stall_counter[row_page] += 1
            continue
        if row.name == "rage_click":
            target_id = _normalize_optional_text(props.get("target_id")) or "unknown"
            rage_counter[(row_page, target_id)] += 1
            continue
        if row.name == "dead_click":
            target_id = _normalize_optional_text(props.get("target_id")) or "unknown"
            dead_click_counter[(row_page, target_id)] += 1
            continue
    scroll_depth_items = [
        MobileAnalyticsPageDepthItem(
            page=page_key,
            depth_percent=depth_percent,
            count=count,
            rate=_rate(count, page_view_counter.get(page_key, count)),
        )
        for (page_key, depth_percent), count in sorted(
            scroll_depth_counter.items(),
            key=lambda item: (item[0][0], item[0][1]),
        )
    ]
    total_rage_clicks = sum(rage_counter.values())
    total_dead_clicks = sum(dead_click_counter.values())
    rage_click_targets = [
        MobileAnalyticsRageClickTargetItem(
            page=page_key,
            target_id=target_id,
            count=count,
            rate=_rate(count, total_rage_clicks),
        )
        for (page_key, target_id), count in sorted(
            rage_counter.items(),
            key=lambda item: (-item[1], item[0][0], item[0][1]),
        )[:12]
    ]
    dead_click_targets = [
        MobileAnalyticsRageClickTargetItem(
            page=page_key,
            target_id=target_id,
            count=count,
            rate=_rate(count, total_dead_clicks),
        )
        for (page_key, target_id), count in sorted(
            dead_click_counter.items(),
            key=lambda item: (-item[1], item[0][0], item[0][1]),
        )[:12]
    ]
    result_cta_counter = Counter({key: len(session_keys) for key, session_keys in result_cta_click_sessions.items()})
    result_cta_land_counter = Counter({key: len(session_keys) for key, session_keys in result_cta_land_sessions.items()})
    followthrough_keys = sorted(set(result_cta_counter.keys()) | set(result_cta_land_counter.keys()))
    followthrough_items = [
        MobileAnalyticsCtaFollowthroughItem(
            cta=cta_key,
            clicks=result_cta_counter.get(cta_key, 0),
            landings=result_cta_land_counter.get(cta_key, 0),
            landing_rate=_rate(result_cta_land_counter.get(cta_key, 0), result_cta_counter.get(cta_key, 0)),
        )
        for cta_key in sorted(
            followthrough_keys,
            key=lambda key: (-result_cta_counter.get(key, 0), key),
        )
    ]
    completion_items = [
        MobileAnalyticsCtaCompletionItem(
            cta=cta_key,
            completion_key=completion_key,
            completion_label=ANALYTICS_CTA_COMPLETION_LABELS.get(completion_key, completion_key),
            clicks=len(result_cta_click_sessions.get(cta_key, set())),
            landings=len(result_cta_land_sessions.get(cta_key, set())),
            completions=len(session_keys),
            completion_rate_from_click=_rate(len(session_keys), len(result_cta_click_sessions.get(cta_key, set()))),
            completion_rate_from_land=_rate(len(session_keys), len(result_cta_land_sessions.get(cta_key, set()))),
        )
        for (cta_key, completion_key), session_keys in sorted(
            result_cta_completion_sessions.items(),
            key=lambda item: (-len(item[1]), item[0][0], item[0][1]),
        )
    ]
    env_denominator = len(env_seen_sessions)
    for props in latest_location_by_session.values():
        region_key = _event_location_region_key(props)
        if region_key:
            location_region_counter[region_key] += 1
            location_region_labels[region_key] = _event_location_region_label(props) or region_key
        time_zone = _event_location_time_zone(props)
        if time_zone:
            location_time_zone_counter[time_zone] += 1
            location_time_zone_labels[time_zone] = _humanize_location_time_zone(time_zone) or time_zone
        location_accuracy_counter[_event_location_accuracy_bucket(props)] += 1
    sessions_with_location = len(latest_location_by_session)
    sessions_without_location = max(0, len(session_keys_seen) - sessions_with_location)

    return MobileAnalyticsExperienceResponse(
        status="ok",
        filters=filters,
        wiki_product_list_views=wiki_product_list_views,
        wiki_product_clicks=wiki_product_clicks,
        wiki_product_ctr=_rate(wiki_product_clicks, wiki_product_list_views),
        wiki_ingredient_list_views=wiki_ingredient_list_views,
        wiki_ingredient_clicks=wiki_ingredient_clicks,
        wiki_ingredient_ctr=_rate(wiki_ingredient_clicks, wiki_ingredient_list_views),
        compare_result_views=compare_result_views,
        decision_result_views=decision_result_views,
        decision_result_primary_cta_clicks=decision_result_primary_cta_clicks,
        decision_result_secondary_loop_clicks=decision_result_secondary_loop_clicks,
        utility_return_clicks=utility_return_clicks,
        home_workspace_quick_action_clicks=home_workspace_quick_action_clicks,
        compare_entry_views=compare_entry_views,
        compare_upload_starts=compare_upload_starts,
        compare_upload_successes=compare_upload_successes,
        compare_upload_success_rate=_rate(compare_upload_successes, compare_upload_starts),
        compare_closure_accept_recommendation=compare_closure_accept_recommendation,
        compare_closure_keep_current=compare_closure_keep_current,
        compare_keep_current_my_use_clicks=len(compare_keep_current_my_use_keys),
        compare_keep_current_my_use_rate=_rate(len(compare_keep_current_my_use_keys), compare_closure_keep_current),
        rationale_view=rationale_view,
        rationale_to_bag_click=rationale_to_bag_click,
        rationale_to_compare_click=rationale_to_compare_click,
        compare_result_leaves=compare_result_leaves,
        avg_result_dwell_ms=round(sum(result_dwell_values) / len(result_dwell_values), 2) if result_dwell_values else 0.0,
        p50_result_dwell_ms=_percentile_fraction(result_dwell_values, 0.5),
        result_scroll_75=len(result_scroll_75_keys),
        result_scroll_100=len(result_scroll_100_keys),
        result_scroll_75_rate=_rate(len(result_scroll_75_keys), compare_result_views),
        result_scroll_100_rate=_rate(len(result_scroll_100_keys), compare_result_views),
        stall_detected=sum(stall_counter.values()),
        rage_clicks=total_rage_clicks,
        dead_clicks=total_dead_clicks,
        scroll_depth_by_page=scroll_depth_items,
        stall_by_page=_build_count_items(stall_counter, denominator=sum(stall_counter.values())),
        rage_click_targets=rage_click_targets,
        dead_click_targets=dead_click_targets,
        result_cta_clicks=_build_count_items(result_cta_counter, denominator=sum(result_cta_counter.values())),
        result_cta_followthrough=followthrough_items,
        result_cta_completions=completion_items,
        compare_entry_result_ctas=_build_count_items(
            compare_entry_result_cta_counter,
            denominator=sum(compare_entry_result_cta_counter.values()),
            label_map=ANALYTICS_RESULT_CTA_LABELS,
        ),
        compare_upload_start_result_ctas=_build_count_items(
            compare_upload_start_result_cta_counter,
            denominator=sum(compare_upload_start_result_cta_counter.values()),
            label_map=ANALYTICS_RESULT_CTA_LABELS,
        ),
        compare_upload_success_result_ctas=_build_count_items(
            compare_upload_success_result_cta_counter,
            denominator=sum(compare_upload_success_result_cta_counter.values()),
            label_map=ANALYTICS_RESULT_CTA_LABELS,
        ),
        compare_entry_route_contexts=_build_route_context_count_items(compare_entry_route_context_counter),
        compare_upload_start_route_contexts=_build_route_context_count_items(compare_upload_start_route_context_counter),
        compare_upload_success_route_contexts=_build_route_context_count_items(compare_upload_success_route_context_counter),
        compare_keep_current_target_paths=_build_count_items(
            Counter({key: len(session_keys) for key, session_keys in compare_keep_current_target_path_sessions.items()}),
            denominator=sum(len(session_keys) for session_keys in compare_keep_current_target_path_sessions.values()),
        ),
        result_secondary_loop_actions=_build_count_items(
            result_secondary_loop_action_counter,
            denominator=sum(result_secondary_loop_action_counter.values()),
        ),
        utility_return_actions=_build_count_items(
            utility_return_action_counter,
            denominator=sum(utility_return_action_counter.values()),
        ),
        result_primary_cta_result_ctas=_build_count_items(
            result_primary_cta_result_cta_counter,
            denominator=sum(result_primary_cta_result_cta_counter.values()),
            label_map=ANALYTICS_RESULT_CTA_LABELS,
        ),
        result_primary_cta_target_paths=_build_count_items(
            result_primary_cta_target_path_counter,
            denominator=sum(result_primary_cta_target_path_counter.values()),
        ),
        result_secondary_loop_result_ctas=_build_count_items(
            result_secondary_loop_result_cta_counter,
            denominator=sum(result_secondary_loop_result_cta_counter.values()),
            label_map=ANALYTICS_RESULT_CTA_LABELS,
        ),
        result_secondary_loop_target_paths=_build_count_items(
            result_secondary_loop_target_path_counter,
            denominator=sum(result_secondary_loop_target_path_counter.values()),
        ),
        utility_return_result_ctas=_build_count_items(
            utility_return_result_cta_counter,
            denominator=sum(utility_return_result_cta_counter.values()),
            label_map=ANALYTICS_RESULT_CTA_LABELS,
        ),
        utility_return_target_paths=_build_count_items(
            utility_return_target_path_counter,
            denominator=sum(utility_return_target_path_counter.values()),
        ),
        home_workspace_quick_actions=_build_count_items(
            home_workspace_quick_action_counter,
            denominator=sum(home_workspace_quick_action_counter.values()),
            label_map=ANALYTICS_HOME_WORKSPACE_ACTION_LABELS,
        ),
        compare_closure_actions=_build_count_items(
            Counter({key: len(session_keys) for key, session_keys in compare_closure_action_sessions.items()}),
            denominator=sum(len(session_keys) for session_keys in compare_closure_action_sessions.values()),
            label_map=ANALYTICS_COMPARE_CLOSURE_ACTION_LABELS,
        ),
        rationale_closure_actions=_build_count_items(
            rationale_closure_action_counter,
            denominator=sum(rationale_closure_action_counter.values()),
            label_map=ANALYTICS_RATIONALE_CLOSURE_ACTION_LABELS,
        ),
        browser_families=_build_count_items(browser_counter, denominator=env_denominator, label_map=ANALYTICS_BROWSER_LABELS),
        os_families=_build_count_items(os_counter, denominator=env_denominator, label_map=ANALYTICS_OS_LABELS),
        device_types=_build_count_items(device_counter, denominator=env_denominator, label_map=ANALYTICS_DEVICE_LABELS),
        viewport_buckets=_build_count_items(viewport_counter, denominator=env_denominator, label_map=ANALYTICS_VIEWPORT_LABELS),
        network_types=_build_count_items(network_counter, denominator=env_denominator, label_map=ANALYTICS_NETWORK_LABELS),
        languages=_build_count_items(language_counter, denominator=env_denominator),
        device_memory_buckets=_build_count_items(memory_counter, denominator=env_denominator, label_map=ANALYTICS_MEMORY_LABELS),
        cpu_core_buckets=_build_count_items(cpu_counter, denominator=env_denominator, label_map=ANALYTICS_CPU_LABELS),
        touch_points_buckets=_build_count_items(touch_counter, denominator=env_denominator, label_map=ANALYTICS_TOUCH_LABELS),
        online_states=_build_count_items(online_counter, denominator=env_denominator, label_map=ANALYTICS_ONLINE_LABELS),
        location_capture_events=location_capture_events,
        location_capture_sessions=len(location_capture_sessions),
        sessions_with_location=sessions_with_location,
        sessions_without_location=sessions_without_location,
        location_coverage_rate=_rate(sessions_with_location, len(session_keys_seen)),
        location_regions=_build_count_items(
            location_region_counter,
            denominator=sessions_with_location,
            label_map=location_region_labels,
        )[:12],
        location_time_zones=_build_count_items(
            location_time_zone_counter,
            denominator=sessions_with_location,
            label_map=location_time_zone_labels,
        )[:12],
        location_accuracy_buckets=_build_count_items(location_accuracy_counter, denominator=sessions_with_location),
    )


@router.get("/products/analytics/mobile/sessions", response_model=MobileAnalyticsSessionsResponse)
def get_mobile_analytics_sessions(
    since_hours: int | None = Query(None, ge=1, le=24 * 365),
    date_from: str | None = Query(None),
    date_to: str | None = Query(None),
    category: str | None = Query(None),
    page: str | None = Query(None),
    stage: str | None = Query(None),
    error_code: str | None = Query(None),
    trigger_reason: str | None = Query(None),
    session_id: str | None = Query(None),
    compare_id: str | None = Query(None),
    owner_id: str | None = Query(None),
    location_presence: str | None = Query(None),
    location_time_zone: str | None = Query(None),
    location_region: str | None = Query(None),
    limit: int = Query(12, ge=1, le=ANALYTICS_MAX_SESSION_LIMIT),
    db: Session = Depends(get_db),
):
    filters, start_iso, end_iso = _resolve_mobile_analytics_filters(
        since_hours=since_hours,
        date_from=date_from,
        date_to=date_to,
        category=category,
        page=page,
        stage=stage,
        error_code=error_code,
        trigger_reason=trigger_reason,
        session_id=session_id,
        compare_id=compare_id,
        owner_id=owner_id,
        location_presence=location_presence,
        location_time_zone=location_time_zone,
        location_region=location_region,
        limit=limit,
    )
    row_limit = None if (
        filters.session_id
        or filters.compare_id
        or filters.owner_id
        or filters.location_presence
        or filters.location_time_zone
    ) else ANALYTICS_SESSION_SCAN_LIMIT
    rows = _query_mobile_client_events(
        db=db,
        filters=filters,
        start_iso=start_iso,
        end_iso=end_iso,
        desc=True,
        row_limit=row_limit,
    )

    grouped: dict[str, list[tuple[MobileClientEvent, dict[str, Any]]]] = defaultdict(list)
    for row, props in rows:
        grouped[_session_key_for_event(row)].append((row, props))

    summaries: list[tuple[MobileAnalyticsSessionSummary, list[tuple[MobileClientEvent, dict[str, Any]]]]] = []
    for group_key, group_rows in grouped.items():
        ordered = sorted(group_rows, key=lambda item: str(item[0].created_at or ""))
        first_row = ordered[0][0]
        last_row = ordered[-1][0]
        started_at = _parse_utc_datetime(str(first_row.created_at or "").strip())
        last_event_at = _parse_utc_datetime(str(last_row.created_at or "").strip())
        category_counter: Counter[str] = Counter()
        pages: list[str] = []
        seen_pages: set[str] = set()
        seen_events: set[str] = set()
        events: list[str] = []
        compare_value: str | None = None
        latest_error_code: str | None = None
        latest_feedback_reason: str | None = None
        latest_location_label: str | None = None
        latest_location_time_zone: str | None = None
        outcome = "browsing"

        for row, props in ordered:
            category_value = _normalize_optional_text(row.category)
            if category_value:
                category_counter[category_value] += 1
            page_value = _normalize_optional_text(row.page)
            if page_value and page_value not in seen_pages:
                seen_pages.add(page_value)
                pages.append(page_value)
            if row.name not in seen_events:
                seen_events.add(row.name)
                events.append(row.name)
            compare_value = _normalize_optional_text(row.compare_id) or compare_value
            latest_error_code = _normalize_optional_text(row.error_code) or latest_error_code
            latest_feedback_reason = _normalize_optional_text(props.get("reason_label")) or latest_feedback_reason
            location_label = _event_location_label(props)
            if location_label:
                latest_location_label = location_label
                latest_location_time_zone = _event_location_time_zone(props) or latest_location_time_zone

            if row.name in {
                "compare_result_view",
                "result_view",
                "result_primary_cta_click",
                "result_secondary_loop_click",
                "result_add_to_bag_click",
                "result_compare_entry_click",
                "result_rationale_entry_click",
                "result_retry_same_category_click",
                "result_switch_category_click",
                "utility_return_click",
            }:
                outcome = "result_viewed"
            elif outcome != "result_viewed" and row.name == "feedback_submit":
                outcome = "feedback_submitted"
            elif outcome not in {"result_viewed", "feedback_submitted"} and row.name in {"compare_stage_error", "compare_upload_fail", "compare_run_error"}:
                outcome = "compare_failed"
            elif outcome == "browsing" and row.name == "compare_run_success":
                outcome = "compare_completed"
            elif outcome == "browsing" and row.name == "wiki_upload_cta_click":
                outcome = "cta_engaged"

        summary = MobileAnalyticsSessionSummary(
            session_id=group_key,
            owner_label=_mask_owner_id(first_row.owner_id),
            category=category_counter.most_common(1)[0][0] if category_counter else _normalize_optional_text(first_row.category),
            compare_id=compare_value,
            started_at=str(first_row.created_at or ""),
            last_event_at=str(last_row.created_at or ""),
            duration_seconds=round(float((last_event_at - started_at).total_seconds()), 2)
            if started_at and last_event_at and last_event_at >= started_at
            else 0.0,
            event_count=len(ordered),
            outcome=outcome,
            latest_page=_normalize_optional_text(last_row.page),
            latest_error_code=latest_error_code,
            latest_feedback_reason=latest_feedback_reason,
            latest_location_label=latest_location_label,
            latest_location_time_zone=latest_location_time_zone,
            pages=pages,
            events=events[:8],
        )
        summaries.append((summary, ordered))

    summaries.sort(key=lambda item: item[0].last_event_at, reverse=True)
    visible_summaries = summaries[:limit]

    selected_group_key = filters.session_id
    if selected_group_key is None and filters.compare_id:
        for summary, _group_rows in visible_summaries:
            if summary.compare_id == filters.compare_id:
                selected_group_key = summary.session_id
                break
    if selected_group_key is None and visible_summaries:
        selected_group_key = visible_summaries[0][0].session_id

    timeline: list[MobileAnalyticsSessionEventItem] = []
    selected_compare_id: str | None = None
    for summary, group_rows in summaries:
        if summary.session_id != selected_group_key:
            continue
        selected_compare_id = summary.compare_id
        for row, props in group_rows:
            timeline.append(
                MobileAnalyticsSessionEventItem(
                    event_id=row.event_id,
                    created_at=str(row.created_at or ""),
                    name=row.name,
                    page=_normalize_optional_text(row.page),
                    route=_normalize_optional_text(row.route),
                    category=_normalize_optional_text(row.category),
                    compare_id=_normalize_optional_text(row.compare_id),
                    stage=_normalize_optional_text(row.stage),
                    error_code=_normalize_optional_text(row.error_code),
                    detail=_event_detail(row, props),
                    trigger_reason=_normalize_optional_text(props.get("trigger_reason")),
                    reason_label=_normalize_optional_text(props.get("reason_label")),
                    dwell_ms=row.dwell_ms,
                    result_cta=_normalize_optional_text(props.get("result_cta")),
                    action=_normalize_optional_text(props.get("action")),
                    target_path=_normalize_optional_text(props.get("target_path")),
                    location_label=_event_location_label(props),
                    location_time_zone=_event_location_time_zone(props),
                    location_geocode_status=_normalize_optional_text(props.get("location_geocode_status")),
                    location_geocode_error=_normalize_optional_text(props.get("location_geocode_error")),
                )
            )
        break

    return MobileAnalyticsSessionsResponse(
        status="ok",
        filters=filters,
        total=len(summaries),
        selected_session_id=selected_group_key,
        selected_compare_id=selected_compare_id,
        items=[summary for summary, _group_rows in visible_summaries],
        timeline=timeline,
    )


@router.get("/products", response_model=list[ProductCard])
def list_products(
    category: str | None = Query(None),
    q: str | None = Query(None, description="search brand/name contains"),
    offset: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
    db: Session = Depends(get_db),
):
    if category:
        category = category.strip().lower()
        if category not in VALID_CATEGORIES:
            raise HTTPException(status_code=400, detail=f"Invalid category: {category}.")

    stmt = select(ProductIndex)
    if category:
        stmt = stmt.where(ProductIndex.category == category)
    if q:
        like = f"%{q}%"
        stmt = stmt.where((ProductIndex.name.like(like)) | (ProductIndex.brand.like(like)))

    stmt = stmt.order_by(ProductIndex.created_at.desc()).offset(offset).limit(limit)
    rows = db.execute(stmt).scalars().all()
    return [_row_to_card(r) for r in rows]

@router.get("/products/page", response_model=ProductListResponse)
def list_products_page(
    category: str | None = Query(None),
    q: str | None = Query(None, description="search brand/name contains"),
    offset: int = Query(0, ge=0),
    limit: int = Query(30, ge=1, le=200),
    db: Session = Depends(get_db),
):
    if category:
        category = category.strip().lower()
        if category not in VALID_CATEGORIES:
            raise HTTPException(status_code=400, detail=f"Invalid category: {category}.")

    stmt = select(ProductIndex)
    count_stmt = select(func.count()).select_from(ProductIndex)

    if category:
        stmt = stmt.where(ProductIndex.category == category)
        count_stmt = count_stmt.where(ProductIndex.category == category)
    if q:
        like = f"%{q}%"
        where_clause = (ProductIndex.name.like(like)) | (ProductIndex.brand.like(like))
        stmt = stmt.where(where_clause)
        count_stmt = count_stmt.where(where_clause)

    total = db.execute(count_stmt).scalar_one()
    rows = db.execute(stmt.order_by(ProductIndex.created_at.desc()).offset(offset).limit(limit)).scalars().all()

    return ProductListResponse(
        items=[_row_to_card(r) for r in rows],
        meta=ProductListMeta(total=total, offset=offset, limit=limit),
    )

@router.get("/categories/counts", response_model=list[CategoryCount])
def category_counts(db: Session = Depends(get_db)):
    rows = db.execute(
        select(ProductIndex.category, func.count(ProductIndex.id))
        .group_by(ProductIndex.category)
        .order_by(ProductIndex.category.asc())
    ).all()
    return [CategoryCount(category=category, count=count) for category, count in rows]

@router.post("/products/dedup/suggest", response_model=ProductDedupSuggestResponse)
def suggest_product_duplicates(payload: ProductDedupSuggestRequest, db: Session = Depends(get_db)):
    return _suggest_product_duplicates_impl(payload, db, event_callback=None)


@router.post("/products/dedup/suggest/stream")
def suggest_product_duplicates_stream(payload: ProductDedupSuggestRequest, db: Session = Depends(get_db)):
    events: queue.Queue[tuple[str, dict[str, Any]] | None] = queue.Queue()
    SessionMaker = sessionmaker(autocommit=False, autoflush=False, bind=db.get_bind())

    def emit(event: str, body: dict[str, Any]) -> None:
        events.put((event, body))

    def worker() -> None:
        local_db = SessionMaker()
        try:
            result = _suggest_product_duplicates_impl(payload, local_db, event_callback=lambda e: emit("progress", e))
            emit("result", result.model_dump())
        except HTTPException as e:
            emit("error", {"status": e.status_code, "detail": e.detail})
        except Exception as e:  # pragma: no cover
            emit("error", {"status": 500, "detail": f"dedup suggest failed: {e}"})
        finally:
            emit("done", {"status": "done"})
            events.put(None)
            local_db.close()

    threading.Thread(target=worker, daemon=True).start()
    return StreamingResponse(
        _sse_iter(events),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Pragma": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/products/dedup/jobs", response_model=ProductWorkbenchJobView)
def create_product_dedup_job(payload: ProductDedupSuggestRequest, db: Session = Depends(get_db)):
    return _create_product_workbench_job(
        db=db,
        job_type="dedup_suggest",
        params=payload.model_dump(),
        queued_message=_product_workbench_queue_message(action="任务已创建"),
    )


@router.get("/products/dedup/jobs", response_model=list[ProductWorkbenchJobView])
def list_product_dedup_jobs(
    status: str | None = Query(None),
    offset: int = Query(0, ge=0),
    limit: int = Query(30, ge=1, le=200),
    db: Session = Depends(get_db),
):
    return _list_product_workbench_jobs(
        db=db,
        job_type="dedup_suggest",
        status=status,
        offset=offset,
        limit=limit,
    )


@router.get("/products/dedup/jobs/{job_id}", response_model=ProductWorkbenchJobView)
def get_product_dedup_job(job_id: str, db: Session = Depends(get_db)):
    return _get_product_workbench_job(db=db, job_id=job_id, expected_job_type="dedup_suggest")


@router.post("/products/dedup/jobs/{job_id}/cancel", response_model=ProductWorkbenchJobCancelResponse)
def cancel_product_dedup_job(job_id: str, db: Session = Depends(get_db)):
    return _cancel_product_workbench_job(db=db, job_id=job_id, expected_job_type="dedup_suggest")


@router.post("/products/dedup/jobs/{job_id}/retry", response_model=ProductWorkbenchJobView)
def retry_product_dedup_job(job_id: str, db: Session = Depends(get_db)):
    return _retry_product_workbench_job(db=db, job_id=job_id, expected_job_type="dedup_suggest")


@router.post("/products/ingredients/library/build", response_model=IngredientLibraryBuildResponse)
def build_ingredient_library(payload: IngredientLibraryBuildRequest, db: Session = Depends(get_db)):
    return _build_ingredient_library_impl(payload, db, event_callback=None)


@router.post("/products/ingredients/library/build/stream")
def build_ingredient_library_stream(payload: IngredientLibraryBuildRequest, db: Session = Depends(get_db)):
    events: queue.Queue[tuple[str, dict[str, Any]] | None] = queue.Queue()
    SessionMaker = sessionmaker(autocommit=False, autoflush=False, bind=db.get_bind())

    def emit(event: str, body: dict[str, Any]) -> None:
        events.put((event, body))

    def worker() -> None:
        local_db = SessionMaker()
        try:
            result = _build_ingredient_library_impl(payload, local_db, event_callback=lambda e: emit("progress", e))
            emit("result", result.model_dump())
        except HTTPException as e:
            emit("error", {"status": e.status_code, "detail": e.detail})
        except Exception as e:  # pragma: no cover
            emit("error", {"status": 500, "detail": f"ingredient library build failed: {e}"})
        finally:
            emit("done", {"status": "done"})
            events.put(None)
            local_db.close()

    threading.Thread(target=worker, daemon=True).start()
    return StreamingResponse(
        _sse_iter(events),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Pragma": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/products/ingredients/library/preflight", response_model=IngredientLibraryPreflightResponse)
def preview_ingredient_library_preflight(payload: IngredientLibraryPreflightRequest, db: Session = Depends(get_db)):
    return _ingredient_library_preflight(payload=payload, db=db)


@router.post("/products/ingredients/library/jobs", response_model=IngredientLibraryBuildJobView)
def create_ingredient_library_build_job(
    payload: IngredientLibraryBuildJobCreateRequest,
    db: Session = Depends(get_db),
):
    normalized_category = _normalize_optional_category(payload.category)
    normalized_packages = _normalize_ingredient_normalization_packages(payload.normalization_packages)
    _ensure_ingredient_build_job_table(db)

    now = now_iso()
    rec = IngredientLibraryBuildJob(
        job_id=new_id(),
        status="queued",
        category=normalized_category,
        force_regenerate=bool(payload.force_regenerate),
        max_sources_per_ingredient=int(payload.max_sources_per_ingredient),
        normalization_packages_json=json.dumps(normalized_packages, ensure_ascii=False),
        stage="queued",
        stage_label=_ingredient_build_stage_label("queued"),
        message="任务已创建，等待执行。",
        percent=0,
        current_index=None,
        current_total=None,
        current_ingredient_id=None,
        current_ingredient_name=None,
        scanned_products=0,
        unique_ingredients=0,
        backfilled_from_storage=0,
        submitted_to_model=0,
        created_count=0,
        updated_count=0,
        skipped_count=0,
        failed_count=0,
        cancel_requested=False,
        live_text_json=None,
        result_json=None,
        error_json=None,
        created_at=now,
        updated_at=now,
        started_at=None,
        finished_at=None,
    )
    db.add(rec)
    db.commit()
    db.refresh(rec)
    _submit_ingredient_build_job(bind=db.get_bind(), job_id=rec.job_id)
    return _to_ingredient_build_job_view(rec)


@router.get("/products/ingredients/library/jobs", response_model=list[IngredientLibraryBuildJobView])
def list_ingredient_library_build_jobs(
    status: str | None = Query(None),
    category: str | None = Query(None),
    offset: int = Query(0, ge=0),
    limit: int = Query(30, ge=1, le=200),
    db: Session = Depends(get_db),
):
    _ensure_ingredient_build_job_table(db)
    normalized_category = _normalize_optional_category(category)
    normalized_status = str(status or "").strip().lower() or None
    if normalized_status and normalized_status not in {"queued", "running", "cancelling", "cancelled", "done", "failed"}:
        raise HTTPException(status_code=400, detail=f"Invalid status: {normalized_status}.")

    stmt = select(IngredientLibraryBuildJob)
    if normalized_status:
        stmt = stmt.where(IngredientLibraryBuildJob.status == normalized_status)
    if normalized_category:
        stmt = stmt.where(IngredientLibraryBuildJob.category == normalized_category)
    rows = db.execute(
        stmt.order_by(IngredientLibraryBuildJob.updated_at.desc()).offset(offset).limit(limit)
    ).scalars().all()
    now_utc = datetime.now(timezone.utc)
    views: list[IngredientLibraryBuildJobView] = []
    for row in rows:
        _reconcile_ingredient_build_job_state(db=db, rec=row, now_utc=now_utc)
        if normalized_status and str(row.status or "").strip().lower() != normalized_status:
            continue
        views.append(_to_ingredient_build_job_view(row))
    return views


@router.get("/products/ingredients/library/jobs/{job_id}", response_model=IngredientLibraryBuildJobView)
def get_ingredient_library_build_job(job_id: str, db: Session = Depends(get_db)):
    _ensure_ingredient_build_job_table(db)
    rec = db.get(IngredientLibraryBuildJob, job_id)
    if rec is None:
        raise HTTPException(status_code=404, detail=f"Ingredient build job '{job_id}' not found.")
    _reconcile_ingredient_build_job_state(db=db, rec=rec, now_utc=datetime.now(timezone.utc))
    return _to_ingredient_build_job_view(rec)


@router.post("/products/ingredients/library/jobs/{job_id}/cancel", response_model=IngredientLibraryBuildJobCancelResponse)
def cancel_ingredient_library_build_job(job_id: str, db: Session = Depends(get_db)):
    _ensure_ingredient_build_job_table(db)
    rec = db.get(IngredientLibraryBuildJob, job_id)
    if rec is None:
        raise HTTPException(status_code=404, detail=f"Ingredient build job '{job_id}' not found.")

    status = str(rec.status or "").strip().lower()
    if status in {"done", "failed", "cancelled"}:
        return IngredientLibraryBuildJobCancelResponse(status="ok", job=_to_ingredient_build_job_view(rec))

    rec.cancel_requested = True
    rec.updated_at = now_iso()
    if status == "queued":
        rec.status = "cancelled"
        rec.stage = "cancelled"
        rec.stage_label = _ingredient_build_stage_label("cancelled")
        rec.message = "任务在启动前已取消。"
        rec.percent = 0
        rec.finished_at = rec.updated_at
    else:
        rec.status = "cancelling"
        rec.stage = "cancelling"
        rec.stage_label = _ingredient_build_stage_label("cancelling")
        rec.message = "已收到取消请求，当前成分处理结束后停止。"
    rec.live_text_json = _update_ingredient_build_live_text_state_json(
        rec.live_text_json,
        updated_at=rec.updated_at,
        step=str(rec.stage or rec.status or "").strip().lower(),
        stage_label=str(rec.stage_label or "").strip() or _ingredient_build_stage_label(str(rec.stage or rec.status or "")),
        text=str(rec.message or ""),
        ingredient_id=rec.current_ingredient_id,
        ingredient_name=rec.current_ingredient_name,
    )
    db.add(rec)
    try:
        db.commit()
    except OperationalError as exc:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"[stage=ingredient_build_cancel] database write failed: {exc}",
        ) from exc
    db.refresh(rec)
    return IngredientLibraryBuildJobCancelResponse(status="ok", job=_to_ingredient_build_job_view(rec))


@router.post("/products/ingredients/library/jobs/{job_id}/retry", response_model=IngredientLibraryBuildJobView)
def retry_ingredient_library_build_job(job_id: str, db: Session = Depends(get_db)):
    _ensure_ingredient_build_job_table(db)
    rec = db.get(IngredientLibraryBuildJob, job_id)
    if rec is None:
        raise HTTPException(status_code=404, detail=f"Ingredient build job '{job_id}' not found.")

    status = str(rec.status or "").strip().lower()
    if status not in {"failed", "cancelled"}:
        raise HTTPException(status_code=409, detail=f"Only failed/cancelled job can retry. current_status={status}.")

    now = now_iso()
    rec.status = "queued"
    rec.stage = "queued"
    rec.stage_label = _ingredient_build_stage_label("queued")
    rec.message = "重试任务已入队，等待执行。"
    rec.percent = 0
    rec.current_index = None
    rec.current_total = None
    rec.current_ingredient_id = None
    rec.current_ingredient_name = None
    rec.scanned_products = 0
    rec.unique_ingredients = 0
    rec.backfilled_from_storage = 0
    rec.submitted_to_model = 0
    rec.created_count = 0
    rec.updated_count = 0
    rec.skipped_count = 0
    rec.failed_count = 0
    rec.cancel_requested = False
    rec.live_text_json = None
    rec.result_json = None
    rec.error_json = None
    rec.started_at = None
    rec.finished_at = None
    rec.updated_at = now
    db.add(rec)
    db.commit()
    db.refresh(rec)
    _submit_ingredient_build_job(bind=db.get_bind(), job_id=rec.job_id)
    return _to_ingredient_build_job_view(rec)


def _delete_ingredient_library_batch_item(
    *,
    db: Session,
    ingredient_id: str,
    rec: IngredientLibraryIndex | None,
    remove_doubao_artifacts: bool,
) -> tuple[bool, int, int]:
    removed_files = 0
    removed_dirs = 0
    profile_path = _resolve_ingredient_profile_path_for_delete(rec=rec, ingredient_id=ingredient_id)
    profile_deleted = False
    if profile_path and exists_rel_path(profile_path):
        if remove_rel_path(profile_path):
            profile_deleted = True
            removed_files += 1

    if rec is not None:
        alias_rows = db.execute(
            select(IngredientLibraryAlias)
            .where(IngredientLibraryAlias.category == str(rec.category or "").strip().lower())
            .where(IngredientLibraryAlias.ingredient_id == ingredient_id)
        ).scalars().all()
        for alias_row in alias_rows:
            db.delete(alias_row)
        redirect_rows = db.execute(
            select(IngredientLibraryRedirect).where(
                (IngredientLibraryRedirect.old_ingredient_id == ingredient_id)
                | (IngredientLibraryRedirect.new_ingredient_id == ingredient_id)
            )
        ).scalars().all()
        for redirect_row in redirect_rows:
            db.delete(redirect_row)
        db.delete(rec)

    if remove_doubao_artifacts:
        run_files, run_dirs = remove_rel_dir(f"doubao_runs/{ingredient_id}")
        removed_files += run_files
        removed_dirs += run_dirs

    deleted = rec is not None or profile_deleted
    return deleted, removed_files, removed_dirs


def _batch_delete_ingredient_library_impl(
    payload: IngredientLibraryBatchDeleteRequest,
    db: Session,
    event_callback: Callable[[dict[str, Any]], None] | None = None,
    should_cancel: Callable[[], bool] | None = None,
) -> IngredientLibraryBatchDeleteResponse:
    _ensure_ingredient_index_table(db)
    _ensure_ingredient_alias_tables(db)
    ingredient_ids = _normalize_ingredient_id_list(payload.ingredient_ids)
    if not ingredient_ids:
        raise HTTPException(status_code=400, detail="ingredient_ids cannot be empty.")

    rows = db.execute(
        select(IngredientLibraryIndex).where(IngredientLibraryIndex.ingredient_id.in_(ingredient_ids))
    ).scalars().all()
    by_id = {str(row.ingredient_id): row for row in rows}

    deleted_ids: list[str] = []
    missing_ids: list[str] = []
    failed_items: list[IngredientLibraryDeleteFailureItem] = []
    removed_files = 0
    removed_dirs = 0
    total = len(ingredient_ids)

    if event_callback:
        event_callback(
            {
                "step": "ingredient_delete_start",
                "index": 0,
                "total": total,
                "text": f"准备处理 {total} 个成分删除请求。",
            }
        )

    for index, ingredient_id in enumerate(ingredient_ids, start=1):
        if should_cancel and should_cancel():
            raise ProductWorkbenchJobCancelledError(
                f"成分删除任务已取消：deleted={len(deleted_ids)}，missing={len(missing_ids)}，failed={len(failed_items)}。",
                result=IngredientLibraryBatchDeleteResponse(
                    status="cancelled",
                    deleted_ids=deleted_ids,
                    missing_ids=missing_ids,
                    failed_items=failed_items,
                    removed_files=removed_files,
                    removed_dirs=removed_dirs,
                ).model_dump(),
            )
        rec = by_id.get(ingredient_id)
        try:
            if event_callback:
                event_callback(
                    {
                        "step": "ingredient_delete_item",
                        "index": index,
                        "total": total,
                        "ingredient_id": ingredient_id,
                        "text": f"删除成分 {ingredient_id} 及关联产物。",
                    }
                )
            deleted, item_removed_files, item_removed_dirs = _delete_ingredient_library_batch_item(
                db=db,
                ingredient_id=ingredient_id,
                rec=rec,
                remove_doubao_artifacts=bool(payload.remove_doubao_artifacts),
            )
            removed_files += item_removed_files
            removed_dirs += item_removed_dirs
            if not deleted:
                missing_ids.append(ingredient_id)
                if event_callback:
                    event_callback(
                        {
                            "step": "ingredient_delete_missing",
                            "index": index,
                            "total": total,
                            "ingredient_id": ingredient_id,
                            "text": f"成分 {ingredient_id} 不存在，记为 missing。",
                            "missing": len(missing_ids),
                        }
                    )
                continue
            deleted_ids.append(ingredient_id)
            db.commit()
            if event_callback:
                event_callback(
                    {
                        "step": "ingredient_delete_done",
                        "index": index,
                        "total": total,
                        "ingredient_id": ingredient_id,
                        "text": f"成分 {ingredient_id} 删除完成。",
                        "deleted": len(deleted_ids),
                        "removed_files": removed_files,
                        "removed_dirs": removed_dirs,
                    }
                )
        except Exception as e:
            db.rollback()
            failed_items.append(IngredientLibraryDeleteFailureItem(ingredient_id=ingredient_id, error=str(e)))
            if event_callback:
                event_callback(
                    {
                        "step": "ingredient_delete_error",
                        "index": index,
                        "total": total,
                        "ingredient_id": ingredient_id,
                        "text": f"成分 {ingredient_id} 删除失败：{e}",
                        "failed": len(failed_items),
                    }
                )

    return IngredientLibraryBatchDeleteResponse(
        status="ok",
        deleted_ids=deleted_ids,
        missing_ids=missing_ids,
        failed_items=failed_items,
        removed_files=removed_files,
        removed_dirs=removed_dirs,
    )


@router.post("/products/ingredients/library/batch-delete/jobs", response_model=ProductWorkbenchJobView)
def create_ingredient_batch_delete_job(
    payload: IngredientLibraryBatchDeleteRequest,
    db: Session = Depends(get_db),
):
    ingredient_ids = _normalize_ingredient_id_list(payload.ingredient_ids)
    if not ingredient_ids:
        raise HTTPException(status_code=400, detail="ingredient_ids cannot be empty.")
    return _create_product_workbench_job(
        db=db,
        job_type="ingredient_batch_delete",
        params=payload.model_dump(),
        queued_message=f"成分批量删除任务已创建，待处理 {len(ingredient_ids)} 个成分。",
    )


@router.get("/products/ingredients/library/batch-delete/jobs", response_model=list[ProductWorkbenchJobView])
def list_ingredient_batch_delete_jobs(
    status: str | None = Query(None),
    offset: int = Query(0, ge=0),
    limit: int = Query(30, ge=1, le=100),
    db: Session = Depends(get_db),
):
    return _list_product_workbench_jobs(
        db=db,
        job_type="ingredient_batch_delete",
        status=status,
        offset=offset,
        limit=limit,
    )


@router.get("/products/ingredients/library/batch-delete/jobs/{job_id}", response_model=ProductWorkbenchJobView)
def get_ingredient_batch_delete_job(job_id: str, db: Session = Depends(get_db)):
    return _get_product_workbench_job(db=db, job_id=job_id, expected_job_type="ingredient_batch_delete")


@router.post("/products/ingredients/library/batch-delete/jobs/{job_id}/cancel", response_model=ProductWorkbenchJobCancelResponse)
def cancel_ingredient_batch_delete_job(job_id: str, db: Session = Depends(get_db)):
    return _cancel_product_workbench_job(db=db, job_id=job_id, expected_job_type="ingredient_batch_delete")


@router.post("/products/ingredients/library/batch-delete/jobs/{job_id}/retry", response_model=ProductWorkbenchJobView)
def retry_ingredient_batch_delete_job(job_id: str, db: Session = Depends(get_db)):
    return _retry_product_workbench_job(db=db, job_id=job_id, expected_job_type="ingredient_batch_delete")


@router.post("/products/ingredients/library/batch-delete", response_model=IngredientLibraryBatchDeleteResponse)
def batch_delete_ingredient_library(
    payload: IngredientLibraryBatchDeleteRequest,
    db: Session = Depends(get_db),
):
    return _batch_delete_ingredient_library_impl(payload=payload, db=db)


@router.get("/products/ingredients/library", response_model=IngredientLibraryListResponse)
def list_ingredient_library(
    category: str | None = Query(None),
    q: str | None = Query(None, description="search ingredient name/summary"),
    offset: int = Query(0, ge=0),
    limit: int = Query(80, ge=1, le=500),
    db: Session = Depends(get_db),
):
    normalized_category = _normalize_optional_category(category)
    query = str(q or "").strip()
    query_lc = query.lower()
    _ensure_ingredient_index_table(db)

    base_stmt = select(IngredientLibraryIndex).where(IngredientLibraryIndex.status == "ready")
    if normalized_category:
        base_stmt = base_stmt.where(IngredientLibraryIndex.category == normalized_category)

    ready_count_stmt = select(func.count(IngredientLibraryIndex.ingredient_id)).select_from(IngredientLibraryIndex).where(
        IngredientLibraryIndex.status == "ready"
    )
    if normalized_category:
        ready_count_stmt = ready_count_stmt.where(IngredientLibraryIndex.category == normalized_category)
    ready_count = int(db.execute(ready_count_stmt).scalar() or 0)
    if ready_count == 0:
        _backfill_ingredient_index_from_storage(db=db, category=normalized_category)

    ordered_stmt = base_stmt.order_by(
        IngredientLibraryIndex.last_generated_at.desc(),
        IngredientLibraryIndex.ingredient_name.asc(),
        IngredientLibraryIndex.ingredient_id.asc(),
    )

    if not query_lc:
        total_stmt = select(func.count(IngredientLibraryIndex.ingredient_id)).select_from(IngredientLibraryIndex).where(
            IngredientLibraryIndex.status == "ready"
        )
        if normalized_category:
            total_stmt = total_stmt.where(IngredientLibraryIndex.category == normalized_category)
        total = int(db.execute(total_stmt).scalar() or 0)
        rows = (
            db.execute(ordered_stmt.offset(offset).limit(limit))
            .scalars()
            .all()
        )
        paged = [_load_ingredient_library_list_item_from_index_row(rec=row) for row in rows]
    else:
        rows = db.execute(ordered_stmt).scalars().all()
        matched_items: list[IngredientLibraryListItem] = []
        for row in rows:
            item = _load_ingredient_library_list_item_from_index_row(rec=row)
            haystack = f"{item.ingredient_name} {item.ingredient_name_en or ''} {item.summary}".lower()
            if query_lc not in haystack:
                continue
            matched_items.append(item)
        total = len(matched_items)
        paged = matched_items[offset : offset + limit]

    return IngredientLibraryListResponse(
        status="ok",
        category=normalized_category,
        query=(query or None),
        total=total,
        offset=offset,
        limit=limit,
        items=paged,
    )


@router.get("/products/ingredients/library/{category}/{ingredient_id}", response_model=IngredientLibraryDetailResponse)
def get_ingredient_library_item(category: str, ingredient_id: str, db: Session = Depends(get_db)):
    normalized_category = _normalize_required_category(category)
    normalized_ingredient_id = str(ingredient_id or "").strip().lower()
    if not normalized_ingredient_id:
        raise HTTPException(status_code=400, detail="ingredient_id is required.")
    _ensure_ingredient_alias_tables(db)
    resolved_ingredient_id = _resolve_ingredient_id_redirect(
        db=db,
        category=normalized_category,
        ingredient_id=normalized_ingredient_id,
    )

    rel_path = ingredient_profile_rel_path(normalized_category, resolved_ingredient_id)
    if not exists_rel_path(rel_path):
        raise HTTPException(
            status_code=404,
            detail=(
                f"Ingredient profile not found: {normalized_category}/{normalized_ingredient_id}."
                if resolved_ingredient_id == normalized_ingredient_id
                else (
                    f"Ingredient profile not found after redirect: {normalized_category}/{normalized_ingredient_id} "
                    f"-> {resolved_ingredient_id}."
                )
            ),
        )

    try:
        doc = _load_ingredient_profile_doc(rel_path=rel_path)
        item = _to_ingredient_library_detail_item(doc=doc, rel_path=rel_path)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Invalid ingredient profile '{rel_path}': {e}") from e

    return IngredientLibraryDetailResponse(status="ok", item=item)


@router.post("/products/route-mapping/build", response_model=ProductRouteMappingBuildResponse)
def build_product_route_mapping(payload: ProductRouteMappingBuildRequest, db: Session = Depends(get_db)):
    return _build_product_route_mapping_impl(payload, db=db, event_callback=None)


@router.post("/products/route-mapping/build/stream")
def build_product_route_mapping_stream(payload: ProductRouteMappingBuildRequest, db: Session = Depends(get_db)):
    events: queue.Queue[tuple[str, dict[str, Any]] | None] = queue.Queue()
    SessionMaker = sessionmaker(autocommit=False, autoflush=False, bind=db.get_bind())

    def emit(event: str, body: dict[str, Any]) -> None:
        events.put((event, body))

    def worker() -> None:
        local_db = SessionMaker()
        try:
            result = _build_product_route_mapping_impl(payload, local_db, event_callback=lambda e: emit("progress", e))
            emit("result", result.model_dump())
        except HTTPException as e:
            emit("error", {"status": e.status_code, "detail": e.detail})
        except Exception as e:  # pragma: no cover
            emit("error", {"status": 500, "detail": f"route mapping build failed: {e}"})
        finally:
            emit("done", {"status": "done"})
            events.put(None)
            local_db.close()

    threading.Thread(target=worker, daemon=True).start()
    return StreamingResponse(
        _sse_iter(events),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Pragma": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/products/route-mapping/jobs", response_model=ProductWorkbenchJobView)
def create_product_route_mapping_job(payload: ProductRouteMappingBuildRequest, db: Session = Depends(get_db)):
    return _create_product_workbench_job(
        db=db,
        job_type="route_mapping_build",
        params=payload.model_dump(),
        queued_message=_product_workbench_queue_message(action="任务已创建"),
    )


@router.get("/products/route-mapping/jobs", response_model=list[ProductWorkbenchJobView])
def list_product_route_mapping_jobs(
    status: str | None = Query(None),
    offset: int = Query(0, ge=0),
    limit: int = Query(30, ge=1, le=200),
    db: Session = Depends(get_db),
):
    return _list_product_workbench_jobs(
        db=db,
        job_type="route_mapping_build",
        status=status,
        offset=offset,
        limit=limit,
    )


@router.get("/products/route-mapping/jobs/{job_id}", response_model=ProductWorkbenchJobView)
def get_product_route_mapping_job(job_id: str, db: Session = Depends(get_db)):
    return _get_product_workbench_job(db=db, job_id=job_id, expected_job_type="route_mapping_build")


@router.post("/products/route-mapping/jobs/{job_id}/cancel", response_model=ProductWorkbenchJobCancelResponse)
def cancel_product_route_mapping_job(job_id: str, db: Session = Depends(get_db)):
    return _cancel_product_workbench_job(db=db, job_id=job_id, expected_job_type="route_mapping_build")


@router.post("/products/route-mapping/jobs/{job_id}/retry", response_model=ProductWorkbenchJobView)
def retry_product_route_mapping_job(job_id: str, db: Session = Depends(get_db)):
    return _retry_product_workbench_job(db=db, job_id=job_id, expected_job_type="route_mapping_build")


@router.get("/products/{product_id}/route-mapping", response_model=ProductRouteMappingDetailResponse)
def get_product_route_mapping(product_id: str, db: Session = Depends(get_db)):
    rec = db.get(ProductRouteMappingIndex, product_id)
    if not rec or str(rec.status or "").strip().lower() != "ready":
        raise HTTPException(status_code=404, detail=f"Route mapping not found for product '{product_id}'.")
    storage_path = str(rec.storage_path or "").strip() or product_route_mapping_rel_path(str(rec.category or ""), product_id)
    if not exists_rel_path(storage_path):
        raise HTTPException(status_code=404, detail=f"Route mapping file missing for product '{product_id}'.")
    try:
        doc = load_json(storage_path)
        item = _to_product_route_mapping_result(doc=doc, storage_path=storage_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Invalid route mapping for product '{product_id}': {e}") from e
    return ProductRouteMappingDetailResponse(status="ok", item=item)


@router.get("/products/route-mapping/index", response_model=ProductRouteMappingIndexListResponse)
def list_product_route_mapping_index(
    category: str | None = Query(None),
    db: Session = Depends(get_db),
):
    normalized_category = _normalize_optional_category(category)
    stmt = select(ProductRouteMappingIndex)
    if normalized_category:
        stmt = stmt.where(ProductRouteMappingIndex.category == normalized_category)
    rows = db.execute(stmt.order_by(ProductRouteMappingIndex.last_generated_at.desc())).scalars().all()
    items = [
        ProductRouteMappingIndexItem(
            product_id=str(row.product_id),
            category=str(row.category),
            status=str(row.status or ""),
            primary_route_key=str(row.primary_route_key or ""),
            primary_route_title=str(row.primary_route_title or ""),
            primary_confidence=int(row.primary_confidence or 0),
            secondary_route_key=str(row.secondary_route_key or "").strip() or None,
            secondary_route_title=str(row.secondary_route_title or "").strip() or None,
            secondary_confidence=(int(row.secondary_confidence) if row.secondary_confidence is not None else None),
            needs_review=bool(row.needs_review),
            rules_version=str(row.rules_version or ""),
            last_generated_at=str(row.last_generated_at or "").strip() or None,
        )
        for row in rows
    ]
    return ProductRouteMappingIndexListResponse(
        status="ok",
        category=normalized_category,
        total=len(items),
        items=items,
    )


@router.post("/products/analysis/build", response_model=ProductAnalysisBuildResponse)
def build_product_analysis(payload: ProductAnalysisBuildRequest, db: Session = Depends(get_db)):
    return _build_product_analysis_impl(payload, db=db, event_callback=None)


@router.post("/products/analysis/build/stream")
def build_product_analysis_stream(payload: ProductAnalysisBuildRequest, db: Session = Depends(get_db)):
    events: queue.Queue[tuple[str, dict[str, Any]] | None] = queue.Queue()
    SessionMaker = sessionmaker(autocommit=False, autoflush=False, bind=db.get_bind())

    def emit(event: str, body: dict[str, Any]) -> None:
        events.put((event, body))

    def worker() -> None:
        local_db = SessionMaker()
        try:
            result = _build_product_analysis_impl(payload, local_db, event_callback=lambda e: emit("progress", e))
            emit("result", result.model_dump())
        except HTTPException as e:
            emit("error", {"status": e.status_code, "detail": e.detail})
        except Exception as e:  # pragma: no cover
            emit("error", {"status": 500, "detail": f"product analysis build failed: {e}"})
        finally:
            emit("done", {"status": "done"})
            events.put(None)
            local_db.close()

    threading.Thread(target=worker, daemon=True).start()
    return StreamingResponse(
        _sse_iter(events),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Pragma": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/products/analysis/jobs", response_model=ProductWorkbenchJobView)
def create_product_analysis_job(payload: ProductAnalysisBuildRequest, db: Session = Depends(get_db)):
    return _create_product_workbench_job(
        db=db,
        job_type="product_analysis_build",
        params=payload.model_dump(),
        queued_message=_product_workbench_queue_message(action="任务已创建"),
    )


@router.get("/products/analysis/jobs", response_model=list[ProductWorkbenchJobView])
def list_product_analysis_jobs(
    status: str | None = Query(None),
    offset: int = Query(0, ge=0),
    limit: int = Query(30, ge=1, le=200),
    db: Session = Depends(get_db),
):
    return _list_product_workbench_jobs(
        db=db,
        job_type="product_analysis_build",
        status=status,
        offset=offset,
        limit=limit,
    )


@router.get("/products/analysis/jobs/{job_id}", response_model=ProductWorkbenchJobView)
def get_product_analysis_job(job_id: str, db: Session = Depends(get_db)):
    return _get_product_workbench_job(db=db, job_id=job_id, expected_job_type="product_analysis_build")


@router.post("/products/analysis/jobs/{job_id}/cancel", response_model=ProductWorkbenchJobCancelResponse)
def cancel_product_analysis_job(job_id: str, db: Session = Depends(get_db)):
    return _cancel_product_workbench_job(db=db, job_id=job_id, expected_job_type="product_analysis_build")


@router.post("/products/analysis/jobs/{job_id}/retry", response_model=ProductWorkbenchJobView)
def retry_product_analysis_job(job_id: str, db: Session = Depends(get_db)):
    return _retry_product_workbench_job(db=db, job_id=job_id, expected_job_type="product_analysis_build")


@router.get("/products/{product_id}/analysis", response_model=ProductAnalysisDetailResponse)
def get_product_analysis(product_id: str, db: Session = Depends(get_db)):
    rec = db.get(ProductAnalysisIndex, product_id)
    if not rec or str(rec.status or "").strip().lower() != "ready":
        raise HTTPException(status_code=404, detail=f"Product analysis not found for product '{product_id}'.")
    storage_path = str(rec.storage_path or "").strip() or product_analysis_rel_path(str(rec.category or ""), product_id)
    if not exists_rel_path(storage_path):
        raise HTTPException(status_code=404, detail=f"Product analysis file missing for product '{product_id}'.")
    try:
        doc = load_json(storage_path)
        item = _to_product_analysis_record(doc=doc, storage_path=storage_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Invalid product analysis for product '{product_id}': {e}") from e
    return ProductAnalysisDetailResponse(status="ok", item=item)


@router.get("/products/analysis/index", response_model=ProductAnalysisIndexListResponse)
def list_product_analysis_index(
    category: str | None = Query(None),
    db: Session = Depends(get_db),
):
    normalized_category = _normalize_optional_category(category)
    stmt = select(ProductAnalysisIndex)
    if normalized_category:
        stmt = stmt.where(ProductAnalysisIndex.category == normalized_category)
    rows = db.execute(stmt.order_by(ProductAnalysisIndex.last_generated_at.desc())).scalars().all()
    items = [
        ProductAnalysisIndexItem(
            product_id=str(row.product_id),
            category=str(row.category),
            status=str(row.status or ""),
            route_key=str(row.route_key or ""),
            route_title=str(row.route_title or ""),
            headline=str(row.headline or ""),
            subtype_fit_verdict=(str(row.subtype_fit_verdict or "").strip() or None),
            confidence=int(row.confidence or 0),
            needs_review=bool(row.needs_review),
            schema_version=str(row.schema_version or ""),
            rules_version=str(row.rules_version or ""),
            last_generated_at=str(row.last_generated_at or "").strip() or None,
        )
        for row in rows
    ]
    return ProductAnalysisIndexListResponse(
        status="ok",
        category=normalized_category,
        total=len(items),
        items=items,
    )


@router.post("/products/selection-results/build", response_model=MobileSelectionResultBuildResponse)
def build_mobile_selection_result_content(
    payload: MobileSelectionResultBuildRequest,
    db: Session = Depends(get_db),
):
    return _build_mobile_selection_results_impl(payload, db=db, event_callback=None)


@router.post("/products/selection-results/jobs", response_model=ProductWorkbenchJobView)
def create_mobile_selection_result_job(
    payload: MobileSelectionResultBuildRequest,
    db: Session = Depends(get_db),
):
    return _create_product_workbench_job(
        db=db,
        job_type="selection_result_build",
        params=payload.model_dump(),
        queued_message=_product_workbench_queue_message(action="任务已创建"),
    )


@router.get("/products/selection-results/jobs", response_model=list[ProductWorkbenchJobView])
def list_mobile_selection_result_jobs(
    status: str | None = Query(None),
    offset: int = Query(0, ge=0),
    limit: int = Query(30, ge=1, le=200),
    db: Session = Depends(get_db),
):
    return _list_product_workbench_jobs(
        db=db,
        job_type="selection_result_build",
        status=status,
        offset=offset,
        limit=limit,
    )


@router.get("/products/selection-results/jobs/{job_id}", response_model=ProductWorkbenchJobView)
def get_mobile_selection_result_job(job_id: str, db: Session = Depends(get_db)):
    return _get_product_workbench_job(db=db, job_id=job_id, expected_job_type="selection_result_build")


@router.post("/products/selection-results/jobs/{job_id}/cancel", response_model=ProductWorkbenchJobCancelResponse)
def cancel_mobile_selection_result_job(job_id: str, db: Session = Depends(get_db)):
    return _cancel_product_workbench_job(db=db, job_id=job_id, expected_job_type="selection_result_build")


@router.post("/products/selection-results/jobs/{job_id}/retry", response_model=ProductWorkbenchJobView)
def retry_mobile_selection_result_job(job_id: str, db: Session = Depends(get_db)):
    return _retry_product_workbench_job(db=db, job_id=job_id, expected_job_type="selection_result_build")


@router.get("/products/featured-slots", response_model=ProductFeaturedSlotListResponse)
def list_product_featured_slots(
    category: str | None = Query(None),
    db: Session = Depends(get_db),
):
    normalized_category = _normalize_optional_category(category)
    stmt = select(ProductFeaturedSlot)
    if normalized_category:
        stmt = stmt.where(ProductFeaturedSlot.category == normalized_category)
    try:
        rows = db.execute(stmt.order_by(ProductFeaturedSlot.category.asc(), ProductFeaturedSlot.target_type_key.asc())).scalars().all()
    except OperationalError as exc:
        raise _featured_slot_schema_http_error(exc) from exc
    items = [
        ProductFeaturedSlotItem(
            category=str(row.category or "").strip().lower(),
            target_type_key=str(row.target_type_key or "").strip(),
            product_id=str(row.product_id or "").strip(),
            updated_at=str(row.updated_at or "").strip(),
            updated_by=str(row.updated_by or "").strip() or None,
        )
        for row in rows
    ]
    return ProductFeaturedSlotListResponse(
        status="ok",
        category=normalized_category,
        total=len(items),
        items=items,
    )


@router.post("/products/featured-slots", response_model=ProductFeaturedSlotItem)
def upsert_product_featured_slot(
    payload: ProductFeaturedSlotUpsertRequest,
    db: Session = Depends(get_db),
):
    category = _normalize_required_category(payload.category)
    target_type_key = _normalize_target_type_key(payload.target_type_key)
    product_id = str(payload.product_id or "").strip()
    if not product_id:
        raise HTTPException(status_code=400, detail="product_id is required.")
    rec = db.get(ProductIndex, product_id)
    if not rec:
        raise HTTPException(status_code=404, detail=f"Product '{product_id}' not found.")
    if str(rec.category or "").strip().lower() != category:
        raise HTTPException(
            status_code=400,
            detail=f"Product '{product_id}' category mismatch: expected '{category}', got '{rec.category}'.",
        )

    try:
        row = db.execute(
            select(ProductFeaturedSlot)
            .where(ProductFeaturedSlot.category == category)
            .where(ProductFeaturedSlot.target_type_key == target_type_key)
            .limit(1)
        ).scalars().first()
        now = now_iso()
        updated_by = str(payload.updated_by or "").strip() or None
        if row is None:
            row = ProductFeaturedSlot(
                category=category,
                target_type_key=target_type_key,
                product_id=product_id,
                updated_at=now,
                updated_by=updated_by,
            )
        else:
            row.product_id = product_id
            row.updated_at = now
            row.updated_by = updated_by
        db.add(row)
        db.commit()
    except OperationalError as exc:
        raise _featured_slot_schema_http_error(exc) from exc
    return ProductFeaturedSlotItem(
        category=category,
        target_type_key=target_type_key,
        product_id=product_id,
        updated_at=row.updated_at,
        updated_by=row.updated_by,
    )


@router.post("/products/featured-slots/clear", response_model=ProductFeaturedSlotClearResponse)
def clear_product_featured_slot(
    payload: ProductFeaturedSlotClearRequest,
    db: Session = Depends(get_db),
):
    category = _normalize_required_category(payload.category)
    target_type_key = _normalize_target_type_key(payload.target_type_key)
    deleted = False
    try:
        row = db.execute(
            select(ProductFeaturedSlot)
            .where(ProductFeaturedSlot.category == category)
            .where(ProductFeaturedSlot.target_type_key == target_type_key)
            .limit(1)
        ).scalars().first()
        if row is not None:
            db.delete(row)
            deleted = True
        db.commit()
    except OperationalError as exc:
        raise _featured_slot_schema_http_error(exc) from exc
    return ProductFeaturedSlotClearResponse(
        status="ok",
        category=category,
        target_type_key=target_type_key,
        deleted=deleted,
    )


@router.get("/products/{product_id}")
def get_product(product_id: str, db: Session = Depends(get_db)):
    rec = db.get(ProductIndex, product_id)
    if not rec:
        raise HTTPException(status_code=404, detail="Not found")
    if not exists_rel_path(rec.json_path):
        raise HTTPException(status_code=404, detail="Product json file is missing.")
    doc = load_json(rec.json_path)
    preferred_image_rel = preferred_image_rel_path(str(rec.image_path or "").strip())
    if preferred_image_rel and isinstance(doc, dict):
        evidence = doc.setdefault("evidence", {})
        if isinstance(evidence, dict):
            evidence["image_path"] = preferred_image_rel
    return doc


@router.patch("/products/{product_id}", response_model=ProductCard)
def update_product(product_id: str, payload: ProductUpdateRequest, db: Session = Depends(get_db)):
    rec = db.get(ProductIndex, product_id)
    if not rec:
        raise HTTPException(status_code=404, detail="Not found")

    tags = None
    if payload.tags is not None:
        tags = _normalize_tags(payload.tags)
        rec.tags_json = json.dumps(tags, ensure_ascii=False)

    if payload.category is not None:
        cat = payload.category.strip().lower()
        if cat not in VALID_CATEGORIES:
            raise HTTPException(status_code=400, detail=f"Invalid category: {cat}.")
        rec.category = cat
    if payload.brand is not None:
        rec.brand = payload.brand.strip() or None
    if payload.name is not None:
        rec.name = payload.name.strip() or None
    if payload.one_sentence is not None:
        rec.one_sentence = payload.one_sentence.strip() or None

    if exists_rel_path(rec.json_path):
        doc = load_json(rec.json_path)
        doc.setdefault("product", {})
        doc.setdefault("summary", {})
        if payload.category is not None:
            doc["product"]["category"] = rec.category
        if payload.brand is not None:
            doc["product"]["brand"] = rec.brand
        if payload.name is not None:
            doc["product"]["name"] = rec.name
        if payload.one_sentence is not None:
            doc["summary"]["one_sentence"] = rec.one_sentence or ""
        if tags is not None:
            doc["tags"] = tags
        save_json_at(rec.json_path, doc)

    db.add(rec)
    db.commit()
    db.refresh(rec)
    return _row_to_card(rec)


@router.delete("/products/{product_id}")
def delete_product(product_id: str, db: Session = Depends(get_db)):
    rec = db.get(ProductIndex, product_id)
    if not rec:
        raise HTTPException(status_code=404, detail="Not found")

    removed = 0
    if remove_rel_path(rec.json_path):
        removed += 1
    image_removed, _ = remove_product_images(product_id=product_id, image_path=rec.image_path)
    removed += image_removed
    run_files, run_dirs = remove_rel_dir(f"doubao_runs/{product_id}")
    removed += run_files + run_dirs
    route_mapping_rec = db.get(ProductRouteMappingIndex, product_id)
    if route_mapping_rec:
        route_mapping_path = str(route_mapping_rec.storage_path or "").strip() or product_route_mapping_rel_path(
            str(route_mapping_rec.category or ""),
            product_id,
        )
        if route_mapping_path and remove_rel_path(route_mapping_path):
            removed += 1
        db.delete(route_mapping_rec)
    try:
        featured_slots = db.execute(
            select(ProductFeaturedSlot).where(ProductFeaturedSlot.product_id == product_id)
        ).scalars().all()
    except OperationalError as exc:
        raise _featured_slot_schema_http_error(exc) from exc
    for slot in featured_slots:
        db.delete(slot)

    db.delete(rec)
    db.commit()
    return {"id": product_id, "status": "deleted", "removed_files": removed}


def _delete_product_batch_item(
    *,
    db: Session,
    product_id: str,
    rec: ProductIndex,
    remove_doubao_artifacts: bool,
) -> tuple[int, int]:
    removed_files = 0
    removed_dirs = 0

    if remove_rel_path(rec.json_path):
        removed_files += 1
    image_removed, _ = remove_product_images(product_id=product_id, image_path=rec.image_path)
    removed_files += image_removed
    if remove_doubao_artifacts:
        f_count, d_count = remove_rel_dir(f"doubao_runs/{product_id}")
        removed_files += f_count
        removed_dirs += d_count

    route_mapping_rec = db.get(ProductRouteMappingIndex, product_id)
    if route_mapping_rec:
        route_mapping_path = str(route_mapping_rec.storage_path or "").strip() or product_route_mapping_rel_path(
            str(route_mapping_rec.category or ""),
            product_id,
        )
        if route_mapping_path and remove_rel_path(route_mapping_path):
            removed_files += 1
        db.delete(route_mapping_rec)
    analysis_rec = db.get(ProductAnalysisIndex, product_id)
    if analysis_rec:
        analysis_path = str(analysis_rec.storage_path or "").strip() or product_analysis_rel_path(
            str(analysis_rec.category or ""),
            product_id,
        )
        if analysis_path and remove_rel_path(analysis_path):
            removed_files += 1
        db.delete(analysis_rec)
    try:
        featured_slots = db.execute(
            select(ProductFeaturedSlot).where(ProductFeaturedSlot.product_id == product_id)
        ).scalars().all()
    except OperationalError as exc:
        raise _featured_slot_schema_http_error(exc) from exc
    for slot in featured_slots:
        db.delete(slot)

    db.delete(rec)
    return removed_files, removed_dirs


def _batch_delete_products_impl(
    payload: ProductBatchDeleteRequest,
    db: Session,
    event_callback: Callable[[dict[str, Any]], None] | None = None,
    should_cancel: Callable[[], bool] | None = None,
) -> ProductBatchDeleteResponse:
    ids = list(dict.fromkeys([str(item).strip() for item in payload.ids if str(item).strip()]))
    keep_ids = {str(item).strip() for item in payload.keep_ids if str(item).strip()}
    if not ids:
        raise HTTPException(status_code=400, detail="ids is required.")

    deleted_ids: list[str] = []
    skipped_ids: list[str] = []
    missing_ids: list[str] = []
    removed_files = 0
    removed_dirs = 0
    total = len(ids)

    if event_callback:
        event_callback(
            {
                "step": "product_delete_start",
                "index": 0,
                "total": total,
                "scanned_products": total,
                "text": f"准备处理 {total} 个产品删除请求。",
            }
        )

    for index, product_id in enumerate(ids, start=1):
        if should_cancel and should_cancel():
            raise ProductWorkbenchJobCancelledError(
                f"产品删除任务已取消：deleted={len(deleted_ids)}，skipped={len(skipped_ids)}，missing={len(missing_ids)}。",
                result=ProductBatchDeleteResponse(
                    status="cancelled",
                    deleted_ids=deleted_ids,
                    skipped_ids=skipped_ids,
                    missing_ids=missing_ids,
                    removed_files=removed_files,
                    removed_dirs=removed_dirs,
                ).model_dump(),
            )
        if product_id in keep_ids:
            skipped_ids.append(product_id)
            if event_callback:
                event_callback(
                    {
                        "step": "product_delete_skip",
                        "index": index,
                        "total": total,
                        "product_id": product_id,
                        "text": f"跳过保留产品 {product_id}。",
                        "skipped": len(skipped_ids),
                    }
                )
            continue
        rec = db.get(ProductIndex, product_id)
        if not rec:
            missing_ids.append(product_id)
            if event_callback:
                event_callback(
                    {
                        "step": "product_delete_missing",
                        "index": index,
                        "total": total,
                        "product_id": product_id,
                        "text": f"产品 {product_id} 不存在，记为 missing。",
                        "missing": len(missing_ids),
                    }
                )
            continue

        if event_callback:
            event_callback(
                {
                    "step": "product_delete_item",
                    "index": index,
                    "total": total,
                    "product_id": product_id,
                    "text": f"删除产品 {product_id} 及关联产物。",
                }
            )
        item_removed_files, item_removed_dirs = _delete_product_batch_item(
            db=db,
            product_id=product_id,
            rec=rec,
            remove_doubao_artifacts=bool(payload.remove_doubao_artifacts),
        )
        removed_files += item_removed_files
        removed_dirs += item_removed_dirs
        db.commit()
        deleted_ids.append(product_id)
        if event_callback:
            event_callback(
                {
                    "step": "product_delete_done",
                    "index": index,
                    "total": total,
                    "product_id": product_id,
                    "text": f"产品 {product_id} 删除完成。",
                    "deleted": len(deleted_ids),
                    "removed_files": removed_files,
                    "removed_dirs": removed_dirs,
                }
            )

    if deleted_ids:
        if event_callback:
            event_callback(
                {
                    "step": "product_delete_mobile_refs_cleanup",
                    "index": total,
                    "total": total,
                    "text": f"同步清理 {len(deleted_ids)} 个已删产品的移动端失效引用。",
                }
            )
        _cleanup_mobile_invalid_product_refs(
            db=db,
            dry_run=False,
            sample_limit=3,
            invalid_product_ids=set(deleted_ids),
            selection_deleted_by="products:batch_delete",
        )
        db.commit()

    return ProductBatchDeleteResponse(
        status="ok",
        deleted_ids=deleted_ids,
        skipped_ids=skipped_ids,
        missing_ids=missing_ids,
        removed_files=removed_files,
        removed_dirs=removed_dirs,
    )


@router.post("/products/batch-delete/jobs", response_model=ProductWorkbenchJobView)
def create_product_batch_delete_job(payload: ProductBatchDeleteRequest, db: Session = Depends(get_db)):
    ids = [str(item).strip() for item in payload.ids if str(item).strip()]
    if not ids:
        raise HTTPException(status_code=400, detail="ids is required.")
    return _create_product_workbench_job(
        db=db,
        job_type="product_batch_delete",
        params=payload.model_dump(),
        queued_message=f"产品批量删除任务已创建，待处理 {len(ids)} 个产品。",
    )


@router.get("/products/batch-delete/jobs", response_model=list[ProductWorkbenchJobView])
def list_product_batch_delete_jobs(
    status: str | None = Query(None),
    offset: int = Query(0, ge=0),
    limit: int = Query(30, ge=1, le=100),
    db: Session = Depends(get_db),
):
    return _list_product_workbench_jobs(
        db=db,
        job_type="product_batch_delete",
        status=status,
        offset=offset,
        limit=limit,
    )


@router.get("/products/batch-delete/jobs/{job_id}", response_model=ProductWorkbenchJobView)
def get_product_batch_delete_job(job_id: str, db: Session = Depends(get_db)):
    return _get_product_workbench_job(db=db, job_id=job_id, expected_job_type="product_batch_delete")


@router.post("/products/batch-delete/jobs/{job_id}/cancel", response_model=ProductWorkbenchJobCancelResponse)
def cancel_product_batch_delete_job(job_id: str, db: Session = Depends(get_db)):
    return _cancel_product_workbench_job(db=db, job_id=job_id, expected_job_type="product_batch_delete")


@router.post("/products/batch-delete/jobs/{job_id}/retry", response_model=ProductWorkbenchJobView)
def retry_product_batch_delete_job(job_id: str, db: Session = Depends(get_db)):
    return _retry_product_workbench_job(db=db, job_id=job_id, expected_job_type="product_batch_delete")


@router.post("/products/batch-delete", response_model=ProductBatchDeleteResponse)
def batch_delete_products(payload: ProductBatchDeleteRequest, db: Session = Depends(get_db)):
    return _batch_delete_products_impl(payload=payload, db=db)


def _cleanup_mobile_invalid_product_refs(
    *,
    db: Session,
    dry_run: bool,
    sample_limit: int,
    invalid_product_ids: set[str] | None = None,
    selection_deleted_by: str,
    event_callback: Callable[[dict[str, Any]], None] | None = None,
    should_cancel: Callable[[], bool] | None = None,
) -> MobileInvalidProductRefCleanupResponse:
    def _emit(step: str, *, index: int, total: int, text: str) -> None:
        if not event_callback:
            return
        event_callback(
            {
                "step": step,
                "index": index,
                "total": total,
                "text": text,
            }
        )

    normalized_invalid_ids: set[str] | None = None
    if invalid_product_ids is not None:
        normalized_invalid_ids = {
            str(item or "").strip()
            for item in invalid_product_ids
            if str(item or "").strip()
        }

    targeted_mode = normalized_invalid_ids is not None
    valid_product_ids: set[str] = set()
    if not targeted_mode:
        valid_product_ids = {
            str(item or "").strip()
            for item in db.execute(select(ProductIndex.id)).scalars().all()
            if str(item or "").strip()
        }

    def _empty_scope() -> dict[str, Any]:
        return {
            "scanned": 0,
            "invalid": 0,
            "repaired": 0,
            "sample_refs": [],
        }

    def _mark_invalid(scope: dict[str, Any], sample_ref: str) -> None:
        scope["invalid"] += 1
        if len(scope["sample_refs"]) < sample_limit:
            scope["sample_refs"].append(sample_ref)

    result: dict[str, Any] = {
        "status": "ok",
        "dry_run": bool(dry_run),
        "product_count": int(db.execute(select(func.count(ProductIndex.id))).scalar() or 0),
        "selection_sessions": _empty_scope(),
        "bag_items": _empty_scope(),
        "compare_usage_stats": _empty_scope(),
    }

    def _current_result_payload(status: str = "ok") -> dict[str, Any]:
        result["status"] = status
        result["total_invalid"] = (
            result["selection_sessions"]["invalid"]
            + result["bag_items"]["invalid"]
            + result["compare_usage_stats"]["invalid"]
        )
        result["total_repaired"] = (
            result["selection_sessions"]["repaired"]
            + result["bag_items"]["repaired"]
            + result["compare_usage_stats"]["repaired"]
        )
        return MobileInvalidProductRefCleanupResponse.model_validate(result).model_dump()

    _emit(
        "mobile_ref_cleanup_start",
        index=0,
        total=3,
        text=f"开始{'扫描' if dry_run else '修复'}移动端产品失效引用。",
    )
    if targeted_mode and not normalized_invalid_ids:
        return MobileInvalidProductRefCleanupResponse.model_validate(_current_result_payload())

    selection_stmt = select(MobileSelectionSession).where(MobileSelectionSession.deleted_at.is_(None))
    if targeted_mode and normalized_invalid_ids:
        selection_stmt = selection_stmt.where(MobileSelectionSession.product_id.in_(sorted(normalized_invalid_ids)))
    selection_rows = db.execute(selection_stmt).scalars().all()
    _emit("mobile_ref_cleanup_scope", index=1, total=3, text=f"扫描选择会话引用，共 {len(selection_rows)} 条。")
    result["selection_sessions"]["scanned"] = len(selection_rows)
    for row in selection_rows:
        if should_cancel and should_cancel():
            raise ProductWorkbenchJobCancelledError(
                "移动端失效引用清理已取消（选择会话阶段）。",
                result=_current_result_payload("cancelled"),
            )
        product_id = str(row.product_id or "").strip()
        if not product_id:
            continue
        if (not targeted_mode) and product_id in valid_product_ids:
            continue
        _mark_invalid(result["selection_sessions"], f"{row.id}:{product_id}")
        if dry_run:
            continue
        if not row.deleted_at:
            row.deleted_at = now_iso()
        row.deleted_by = row.deleted_by or selection_deleted_by
        row.is_pinned = False
        row.pinned_at = None
        row.product_id = None
        result["selection_sessions"]["repaired"] += 1
    _emit(
        "mobile_ref_cleanup_scope",
        index=1,
        total=3,
        text=(
            f"选择会话完成：invalid={result['selection_sessions']['invalid']}，"
            f"repaired={result['selection_sessions']['repaired']}。"
        ),
    )

    bag_stmt = select(MobileBagItem)
    if targeted_mode and normalized_invalid_ids:
        bag_stmt = bag_stmt.where(MobileBagItem.product_id.in_(sorted(normalized_invalid_ids)))
    bag_rows = db.execute(bag_stmt).scalars().all()
    _emit("mobile_ref_cleanup_scope", index=2, total=3, text=f"扫描购物袋引用，共 {len(bag_rows)} 条。")
    result["bag_items"]["scanned"] = len(bag_rows)
    for row in bag_rows:
        if should_cancel and should_cancel():
            raise ProductWorkbenchJobCancelledError(
                "移动端失效引用清理已取消（购物袋阶段）。",
                result=_current_result_payload("cancelled"),
            )
        product_id = str(row.product_id or "").strip()
        if not product_id:
            continue
        if (not targeted_mode) and product_id in valid_product_ids:
            continue
        _mark_invalid(result["bag_items"], f"{row.id}:{product_id}")
        if dry_run:
            continue
        db.delete(row)
        result["bag_items"]["repaired"] += 1
    _emit(
        "mobile_ref_cleanup_scope",
        index=2,
        total=3,
        text=f"购物袋完成：invalid={result['bag_items']['invalid']}，repaired={result['bag_items']['repaired']}。",
    )

    usage_stmt = select(MobileCompareUsageStat)
    if targeted_mode and normalized_invalid_ids:
        usage_stmt = usage_stmt.where(MobileCompareUsageStat.product_id.in_(sorted(normalized_invalid_ids)))
    usage_rows = db.execute(usage_stmt).scalars().all()
    _emit("mobile_ref_cleanup_scope", index=3, total=3, text=f"扫描使用统计引用，共 {len(usage_rows)} 条。")
    result["compare_usage_stats"]["scanned"] = len(usage_rows)
    for row in usage_rows:
        if should_cancel and should_cancel():
            raise ProductWorkbenchJobCancelledError(
                "移动端失效引用清理已取消（使用统计阶段）。",
                result=_current_result_payload("cancelled"),
            )
        product_id = str(row.product_id or "").strip()
        if not product_id:
            continue
        if (not targeted_mode) and product_id in valid_product_ids:
            continue
        _mark_invalid(
            result["compare_usage_stats"],
            f"{row.owner_type}/{row.owner_id}/{row.category}:{product_id}",
        )
        if dry_run:
            continue
        db.delete(row)
        result["compare_usage_stats"]["repaired"] += 1
    _emit(
        "mobile_ref_cleanup_scope",
        index=3,
        total=3,
        text=(
            f"使用统计完成：invalid={result['compare_usage_stats']['invalid']}，"
            f"repaired={result['compare_usage_stats']['repaired']}。"
        ),
    )
    return MobileInvalidProductRefCleanupResponse.model_validate(_current_result_payload())


@router.post("/maintenance/mobile/product-refs/jobs", response_model=ProductWorkbenchJobView)
def create_mobile_invalid_product_ref_cleanup_job(
    payload: MobileInvalidProductRefCleanupRequest,
    db: Session = Depends(get_db),
):
    return _create_product_workbench_job(
        db=db,
        job_type="mobile_invalid_ref_cleanup",
        params=payload.model_dump(),
        queued_message=f"移动端失效引用{'扫描' if payload.dry_run else '修复'}任务已创建。",
    )


@router.get("/maintenance/mobile/product-refs/jobs", response_model=list[ProductWorkbenchJobView])
def list_mobile_invalid_product_ref_cleanup_jobs(
    status: str | None = Query(None),
    offset: int = Query(0, ge=0),
    limit: int = Query(30, ge=1, le=100),
    db: Session = Depends(get_db),
):
    return _list_product_workbench_jobs(
        db=db,
        job_type="mobile_invalid_ref_cleanup",
        status=status,
        offset=offset,
        limit=limit,
    )


@router.get("/maintenance/mobile/product-refs/jobs/{job_id}", response_model=ProductWorkbenchJobView)
def get_mobile_invalid_product_ref_cleanup_job(job_id: str, db: Session = Depends(get_db)):
    return _get_product_workbench_job(db=db, job_id=job_id, expected_job_type="mobile_invalid_ref_cleanup")


@router.post("/maintenance/mobile/product-refs/jobs/{job_id}/cancel", response_model=ProductWorkbenchJobCancelResponse)
def cancel_mobile_invalid_product_ref_cleanup_job(job_id: str, db: Session = Depends(get_db)):
    return _cancel_product_workbench_job(db=db, job_id=job_id, expected_job_type="mobile_invalid_ref_cleanup")


@router.post("/maintenance/mobile/product-refs/jobs/{job_id}/retry", response_model=ProductWorkbenchJobView)
def retry_mobile_invalid_product_ref_cleanup_job(job_id: str, db: Session = Depends(get_db)):
    return _retry_product_workbench_job(db=db, job_id=job_id, expected_job_type="mobile_invalid_ref_cleanup")


@router.post("/maintenance/mobile/product-refs/cleanup", response_model=MobileInvalidProductRefCleanupResponse)
def cleanup_invalid_mobile_product_refs(
    payload: MobileInvalidProductRefCleanupRequest,
    db: Session = Depends(get_db),
):
    result = _cleanup_mobile_invalid_product_refs(
        db=db,
        dry_run=bool(payload.dry_run),
        sample_limit=int(payload.sample_limit),
        selection_deleted_by="maintenance:mobile_product_ref_cleanup",
    )
    if (not payload.dry_run) and result.total_repaired > 0:
        db.commit()
    return result


def _cleanup_orphan_storage_impl(
    payload: OrphanStorageCleanupRequest,
    db: Session,
    event_callback: Callable[[dict[str, Any]], None] | None = None,
    should_cancel: Callable[[], bool] | None = None,
) -> OrphanStorageCleanupResponse:
    if event_callback:
        event_callback(
            {
                "step": "orphan_cleanup_prepare",
                "index": 1,
                "total": 2,
                "text": "收集产品与图片引用集。",
            }
        )
    rows = db.execute(select(ProductIndex.id, ProductIndex.image_path)).all()
    keep_product_ids: set[str] = set()
    keep_image_paths: set[str] = set()
    for pid, image_path in rows:
        pid_text = str(pid or "").strip()
        if not pid_text:
            continue
        keep_product_ids.add(pid_text)
        for rel_path in image_variant_rel_paths(str(image_path or "").strip()):
            keep_image_paths.add(rel_path)

    if should_cancel and should_cancel():
        raise ProductWorkbenchJobCancelledError("孤儿存储清理在执行前已取消。")
    if event_callback:
        event_callback(
            {
                "step": "orphan_cleanup_scan",
                "index": 2,
                "total": 2,
                "text": f"开始{'预览' if payload.dry_run else '执行'} orphan 清理。",
            }
        )
    result = cleanup_orphan_storage(
        keep_product_ids=keep_product_ids,
        keep_image_paths=keep_image_paths,
        min_age_minutes=payload.min_age_minutes,
        dry_run=payload.dry_run,
        max_delete=payload.max_delete,
    )
    return OrphanStorageCleanupResponse.model_validate(result)


@router.post("/maintenance/storage/orphans/jobs", response_model=ProductWorkbenchJobView)
def create_orphan_storage_cleanup_job(payload: OrphanStorageCleanupRequest, db: Session = Depends(get_db)):
    return _create_product_workbench_job(
        db=db,
        job_type="orphan_storage_cleanup",
        params=payload.model_dump(),
        queued_message=f"orphan 存储{'预览' if payload.dry_run else '清理'}任务已创建。",
    )


@router.get("/maintenance/storage/orphans/jobs", response_model=list[ProductWorkbenchJobView])
def list_orphan_storage_cleanup_jobs(
    status: str | None = Query(None),
    offset: int = Query(0, ge=0),
    limit: int = Query(30, ge=1, le=100),
    db: Session = Depends(get_db),
):
    return _list_product_workbench_jobs(
        db=db,
        job_type="orphan_storage_cleanup",
        status=status,
        offset=offset,
        limit=limit,
    )


@router.get("/maintenance/storage/orphans/jobs/{job_id}", response_model=ProductWorkbenchJobView)
def get_orphan_storage_cleanup_job(job_id: str, db: Session = Depends(get_db)):
    return _get_product_workbench_job(db=db, job_id=job_id, expected_job_type="orphan_storage_cleanup")


@router.post("/maintenance/storage/orphans/jobs/{job_id}/cancel", response_model=ProductWorkbenchJobCancelResponse)
def cancel_orphan_storage_cleanup_job(job_id: str, db: Session = Depends(get_db)):
    return _cancel_product_workbench_job(db=db, job_id=job_id, expected_job_type="orphan_storage_cleanup")


@router.post("/maintenance/storage/orphans/jobs/{job_id}/retry", response_model=ProductWorkbenchJobView)
def retry_orphan_storage_cleanup_job(job_id: str, db: Session = Depends(get_db)):
    return _retry_product_workbench_job(db=db, job_id=job_id, expected_job_type="orphan_storage_cleanup")


@router.post("/maintenance/storage/orphans/cleanup", response_model=OrphanStorageCleanupResponse)
def cleanup_orphan_storage_assets(payload: OrphanStorageCleanupRequest, db: Session = Depends(get_db)):
    return _cleanup_orphan_storage_impl(payload=payload, db=db)


@router.get("/maintenance/storage/images/download")
def download_all_product_images(db: Session = Depends(get_db)):
    rows = db.execute(
        select(ProductIndex.id, ProductIndex.image_path).order_by(ProductIndex.created_at.desc())
    ).all()
    if not rows:
        raise HTTPException(status_code=404, detail="No products found, image archive unavailable.")

    zip_buffer = io.BytesIO()
    seen_paths: set[str] = set()
    missing_paths: list[str] = []
    added_count = 0

    with zipfile.ZipFile(zip_buffer, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:
        for product_id, image_path in rows:
            primary_rel = str(image_path or "").strip().lstrip("/")
            if not primary_rel:
                continue
            for rel_path in image_variant_rel_paths(primary_rel):
                if rel_path in seen_paths:
                    continue
                seen_paths.add(rel_path)
                is_primary = rel_path == primary_rel
                if not is_primary and not exists_rel_path(rel_path):
                    continue
                try:
                    image_bytes = read_rel_bytes(rel_path)
                except Exception as exc:
                    if is_primary:
                        missing_paths.append(f"{product_id}:{rel_path}:{exc}")
                    continue
                zf.writestr(rel_path, image_bytes)
                added_count += 1

    if missing_paths:
        preview = "; ".join(missing_paths[:20])
        if len(missing_paths) > 20:
            preview += f"; ...(+{len(missing_paths) - 20} more)"
        raise HTTPException(
            status_code=500,
            detail=f"Image archive failed: missing/unreadable image files: {preview}",
        )
    if added_count <= 0:
        raise HTTPException(status_code=404, detail="No product images found, image archive unavailable.")

    zip_buffer.seek(0)
    ts = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    filename = f"cosmeles-product-images-{ts}.zip"
    headers = {
        "Content-Disposition": f'attachment; filename="{filename}"',
        "X-Image-Count": str(added_count),
    }
    return StreamingResponse(zip_buffer, media_type="application/zip", headers=headers)


def _build_ingredient_library_impl(
    payload: IngredientLibraryBuildRequest,
    db: Session,
    event_callback: Callable[[dict[str, Any]], None] | None,
    stop_checker: Callable[[], bool] | None = None,
) -> IngredientLibraryBuildResponse:
    category = (payload.category or "").strip().lower()
    if category and category not in VALID_CATEGORIES:
        raise HTTPException(status_code=400, detail=f"Invalid category: {category}.")
    normalization_packages = _normalize_ingredient_normalization_packages(payload.normalization_packages)

    _ensure_ingredient_index_table(db)
    _ensure_ingredient_alias_tables(db)
    backfilled_from_storage = _backfill_ingredient_index_from_storage(db=db, category=category)

    stmt = select(ProductIndex).order_by(ProductIndex.created_at.desc())
    if category:
        stmt = stmt.where(ProductIndex.category == category)

    rows = db.execute(stmt).scalars().all()
    grouped, aggregate_meta = _collect_category_ingredients(
        rows=rows,
        max_sources_per_ingredient=int(payload.max_sources_per_ingredient),
        normalization_packages=normalization_packages,
    )
    grouped_items = sorted(grouped.values(), key=lambda item: (item["category"], item["ingredient_name"]))
    raw_unique = int(aggregate_meta.get("raw_unique_ingredients") or len(grouped_items))
    merged_delta = max(0, raw_unique - len(grouped_items))

    _emit_progress(
        event_callback,
        {
            "step": "ingredient_build_start",
            "scanned_products": len(rows),
            "unique_ingredients": len(grouped_items),
            "raw_unique_ingredients": raw_unique,
            "merged_delta": merged_delta,
            "normalization_packages": normalization_packages,
            "backfilled_from_storage": backfilled_from_storage,
            "text": (
                f"开始生成成分库：产品 {len(rows)} 条，唯一成分 {len(grouped_items)} 条，"
                f"原始唯一 {raw_unique}（归并 {merged_delta}），历史回填 {backfilled_from_storage} 条。"
            ),
        },
    )

    ingredient_ids = [str(item["ingredient_id"]) for item in grouped_items]
    index_map = _load_ingredient_index_map(db=db, ingredient_ids=ingredient_ids)

    submitted_to_model = 0
    created = 0
    updated = 0
    skipped = 0
    failed = 0
    failures: list[str] = []
    items: list[IngredientLibraryBuildItem] = []
    force_regenerate = bool(payload.force_regenerate)

    total = len(grouped_items)
    for idx, item in enumerate(grouped_items, start=1):
        if stop_checker is not None and stop_checker():
            _emit_progress(
                event_callback,
                {
                    "step": "ingredient_build_cancelled",
                    "index": idx,
                    "total": total,
                    "text": f"任务取消：已处理到 {idx - 1}/{total}。",
                },
            )
            raise IngredientLibraryBuildCancelledError("ingredient build cancelled by operator.")

        ingredient_id = item["ingredient_id"]
        ingredient_name = item["ingredient_name"]
        ingredient_name_en = str(item.get("ingredient_name_en") or "").strip() or None
        category_name = item["category"]
        source_trace_ids = sorted(item["source_trace_ids"])
        source_json = item["source_json"]
        source_signature = str(item["source_signature"])
        source_schema_version = str(item["source_schema_version"])
        alias_names = _collect_item_alias_names(item=item)
        source_count = _source_product_count_from_source_json(source_json=source_json, fallback=len(source_trace_ids))

        storage_rel = ingredient_profile_rel_path(category_name, ingredient_id)
        index_rec = _upsert_ingredient_index_from_scan(
            existing=index_map.get(ingredient_id),
            category=category_name,
            ingredient_id=ingredient_id,
            ingredient_name=ingredient_name,
            ingredient_key=str(item["ingredient_key"]),
            source_trace_ids=source_trace_ids,
        )
        index_map[ingredient_id] = index_rec
        db.add(index_rec)

        ready_storage_path = str(index_rec.storage_path or "").strip()
        if ready_storage_path and not exists_rel_path(ready_storage_path) and exists_rel_path(storage_rel):
            ready_storage_path = storage_rel
        if not ready_storage_path:
            ready_storage_path = storage_rel
        is_ready = str(index_rec.status or "").strip().lower() == "ready"
        existing_source_signature = ""
        if is_ready and exists_rel_path(ready_storage_path):
            existing_source_signature = _load_profile_source_signature(ready_storage_path)

        if (
            is_ready
            and exists_rel_path(ready_storage_path)
            and not force_regenerate
            and existing_source_signature
            and existing_source_signature == source_signature
        ):
            index_rec.storage_path = ready_storage_path
            skipped += 1
            _upsert_ingredient_aliases(
                db=db,
                category=category_name,
                ingredient_id=ingredient_id,
                alias_names=alias_names,
                resolver="ingredient_build",
            )
            build_item = IngredientLibraryBuildItem(
                ingredient_id=ingredient_id,
                category=category_name,
                ingredient_name=ingredient_name,
                ingredient_name_en=ingredient_name_en,
                source_count=source_count,
                source_trace_ids=source_trace_ids,
                storage_path=ready_storage_path,
                status="skipped",
                model=index_rec.model,
                error=None,
            )
            items.append(build_item)
            _emit_progress(
                event_callback,
                {
                    "step": "ingredient_skip",
                    "ingredient_id": ingredient_id,
                    "ingredient_name": ingredient_name,
                    "category": category_name,
                    "index": idx,
                    "total": total,
                    "skipped": skipped,
                    "text": f"[{idx}/{total}] 跳过（统计签名未变化）：{category_name} / {ingredient_name}",
                },
            )
            continue

        submitted_to_model += 1
        _emit_progress(
            event_callback,
            {
                "step": "ingredient_start",
                "ingredient_id": ingredient_id,
                "ingredient_name": ingredient_name,
                "category": category_name,
                "index": idx,
                "total": total,
                "submitted_to_model": submitted_to_model,
                "text": f"[{idx}/{total}] 生成成分：{category_name} / {ingredient_name}",
            },
        )
        try:
            ai_result = run_capability_now(
                capability="doubao.ingredient_category_profile",
                input_payload={
                    "ingredient": ingredient_name,
                    "category": category_name,
                    "source_json": source_json,
                    "source_samples": item["source_samples"],
                },
                trace_id=ingredient_id,
                event_callback=lambda e, _iid=ingredient_id, _iname=ingredient_name, _cat=category_name: _forward_ingredient_model_event(
                    event_callback=event_callback,
                    ingredient_id=_iid,
                    ingredient_name=_iname,
                    category=_cat,
                    payload=e,
                ),
            )
            normalized_ingredient_name = str(ai_result.get("ingredient_name") or ingredient_name).strip() or ingredient_name
            normalized_ingredient_name_en = str(ai_result.get("ingredient_name_en") or "").strip() or None
            _upsert_ingredient_aliases(
                db=db,
                category=category_name,
                ingredient_id=ingredient_id,
                alias_names=[normalized_ingredient_name, normalized_ingredient_name_en, *alias_names],
                resolver="ingredient_model",
            )
            profile_doc = {
                "id": ingredient_id,
                "category": category_name,
                "ingredient_name": normalized_ingredient_name,
                "ingredient_name_en": normalized_ingredient_name_en,
                "ingredient_key": item["ingredient_key"],
                "source_count": source_count,
                "source_trace_ids": source_trace_ids,
                "source_samples": item["source_samples"],
                "source_json": source_json,
                "generated_at": now_iso(),
                "generator": {
                    "capability": "doubao.ingredient_category_profile",
                    "model": str(ai_result.get("model") or ""),
                    "prompt_key": "doubao.ingredient_category_profile",
                    "source_signature": source_signature,
                    "source_schema_version": source_schema_version,
                },
                "profile": {
                    "summary": str(ai_result.get("summary") or "").strip(),
                    "benefits": _safe_str_list(ai_result.get("benefits")),
                    "risks": _safe_str_list(ai_result.get("risks")),
                    "usage_tips": _safe_str_list(ai_result.get("usage_tips")),
                    "suitable_for": _safe_str_list(ai_result.get("suitable_for")),
                    "avoid_for": _safe_str_list(ai_result.get("avoid_for")),
                    "confidence": int(ai_result.get("confidence") or 0),
                    "reason": str(ai_result.get("reason") or "").strip(),
                    "analysis_text": str(ai_result.get("analysis_text") or "").strip(),
                },
            }
            existed_before = exists_rel_path(storage_rel)
            storage_path = save_ingredient_profile(category_name, ingredient_id, profile_doc)
            status = "updated" if existed_before else "created"
            if status == "updated":
                updated += 1
            else:
                created += 1

            index_rec.status = "ready"
            index_rec.ingredient_name = normalized_ingredient_name
            index_rec.storage_path = storage_path
            index_rec.model = str(ai_result.get("model") or "").strip() or None
            index_rec.last_generated_at = now_iso()
            index_rec.last_error = None
            db.add(index_rec)

            items.append(
                IngredientLibraryBuildItem(
                    ingredient_id=ingredient_id,
                    category=category_name,
                    ingredient_name=normalized_ingredient_name,
                    ingredient_name_en=normalized_ingredient_name_en,
                    source_count=source_count,
                    source_trace_ids=source_trace_ids,
                    storage_path=storage_path,
                    status=status,
                    model=index_rec.model,
                    error=None,
                )
            )
            _emit_progress(
                event_callback,
                {
                    "step": "ingredient_done",
                    "ingredient_id": ingredient_id,
                    "ingredient_name": normalized_ingredient_name,
                    "category": category_name,
                    "index": idx,
                    "total": total,
                    "status": status,
                    "created": created,
                    "updated": updated,
                    "text": f"[{idx}/{total}] 完成：{category_name} / {ingredient_name}（{status}）",
                },
            )
        except Exception as e:
            failed += 1
            message = f"{ingredient_id} ({category_name}/{ingredient_name}): {e}"
            failures.append(message)
            index_rec.status = "failed"
            index_rec.last_error = str(e)
            db.add(index_rec)
            items.append(
                IngredientLibraryBuildItem(
                    ingredient_id=ingredient_id,
                    category=category_name,
                    ingredient_name=ingredient_name,
                    ingredient_name_en=None,
                    source_count=source_count,
                    source_trace_ids=source_trace_ids,
                    storage_path=None,
                    status="failed",
                    model=None,
                    error=str(e),
                )
            )
            _emit_progress(
                event_callback,
                {
                    "step": "ingredient_error",
                    "ingredient_id": ingredient_id,
                    "ingredient_name": ingredient_name,
                    "category": category_name,
                    "index": idx,
                    "total": total,
                    "failed": failed,
                    "text": f"[{idx}/{total}] 失败：{category_name} / {ingredient_name} | {e}",
                },
            )

    db.commit()

    status = "ok" if failed == 0 else "partial_failed"
    _emit_progress(
        event_callback,
        {
            "step": "ingredient_build_done",
            "status": status,
            "backfilled_from_storage": backfilled_from_storage,
            "submitted_to_model": submitted_to_model,
            "created": created,
            "updated": updated,
            "skipped": skipped,
            "failed": failed,
            "text": (
                "成分库生成完成："
                f"backfilled={backfilled_from_storage}, submitted={submitted_to_model}, "
                f"created={created}, updated={updated}, skipped={skipped}, failed={failed}"
            ),
        },
    )
    return IngredientLibraryBuildResponse(
        status=status,
        scanned_products=len(rows),
        unique_ingredients=len(grouped_items),
        backfilled_from_storage=backfilled_from_storage,
        submitted_to_model=submitted_to_model,
        created=created,
        updated=updated,
        skipped=skipped,
        failed=failed,
        items=items,
        failures=failures[:200],
    )


def _ingredient_library_preflight(
    *,
    payload: IngredientLibraryPreflightRequest,
    db: Session,
) -> IngredientLibraryPreflightResponse:
    category = (payload.category or "").strip().lower()
    if category and category not in VALID_CATEGORIES:
        raise HTTPException(status_code=400, detail=f"Invalid category: {category}.")
    selected_packages = _normalize_ingredient_normalization_packages(payload.normalization_packages)
    baseline_packages = [pkg for pkg in selected_packages if pkg != "en_exact"]
    if not baseline_packages:
        baseline_packages = ["unicode_nfkc", "punctuation_fold", "whitespace_fold"]

    stmt = select(ProductIndex).order_by(ProductIndex.created_at.desc())
    if category:
        stmt = stmt.where(ProductIndex.category == category)
    rows = db.execute(stmt).scalars().all()
    records = _collect_category_ingredient_records(rows=rows)

    grouped_items, meta = _aggregate_category_ingredients(
        records=records,
        max_sources_per_ingredient=int(payload.max_sources_per_ingredient),
        normalization_packages=selected_packages,
    )
    merge_candidates = _build_ingredient_preflight_merge_candidates(
        records=records,
        selected_packages=selected_packages,
        baseline_packages=baseline_packages,
        limit=int(payload.max_merge_preview),
    )
    usage_top = _build_ingredient_preflight_usage_top(grouped_items=grouped_items, limit=20)

    raw_unique = int(meta.get("raw_unique_ingredients") or 0)
    unique_after = int(meta.get("unique_ingredients") or 0)
    merged_delta = max(0, raw_unique - unique_after)
    summary = IngredientLibraryPreflightSummary(
        scanned_products=int(meta.get("scanned_products") or len(rows)),
        total_mentions=int(meta.get("total_mentions") or 0),
        raw_unique_ingredients=raw_unique,
        unique_ingredients_after=unique_after,
        merged_delta=merged_delta,
        merged_groups=len(merge_candidates),
        unresolved_conflicts=0,
    )
    return IngredientLibraryPreflightResponse(
        status="ok",
        category=category or None,
        available_packages=[
            IngredientLibraryNormalizationPackage(
                id=str(pkg["id"]),
                label=str(pkg["label"]),
                description=str(pkg["description"]),
                default_enabled=bool(pkg.get("default_enabled")),
                mode=str(pkg.get("mode") or "auto_merge"),
            )
            for pkg in INGREDIENT_NORMALIZATION_PACKAGES
        ],
        selected_packages=selected_packages,
        summary=summary,
        new_merges=merge_candidates,
        usage_top=usage_top,
        warnings=[],
    )


def _build_ingredient_preflight_merge_candidates(
    *,
    records: list[dict[str, Any]],
    selected_packages: list[str],
    baseline_packages: list[str],
    limit: int,
) -> list[IngredientLibraryMergeCandidate]:
    merged: dict[str, dict[str, Any]] = {}
    for record in records:
        category = str(record.get("category") or "").strip().lower()
        product_id = str(record.get("product_id") or "").strip()
        for parsed in record.get("items") or []:
            selected_key = _resolve_ingredient_key(
                ingredient_key_base=str(parsed.get("ingredient_key_base") or ""),
                ingredient_name_en_key_field=str(parsed.get("ingredient_name_en_key_field") or ""),
                ingredient_name_en_key_paren=str(parsed.get("ingredient_name_en_key_paren") or ""),
                normalization_packages=selected_packages,
            )
            baseline_key = _resolve_ingredient_key(
                ingredient_key_base=str(parsed.get("ingredient_key_base") or ""),
                ingredient_name_en_key_field=str(parsed.get("ingredient_name_en_key_field") or ""),
                ingredient_name_en_key_paren=str(parsed.get("ingredient_name_en_key_paren") or ""),
                normalization_packages=baseline_packages,
            )
            scope_key = f"{category}::{selected_key}"
            bucket = merged.get(scope_key)
            if bucket is None:
                bucket = {
                    "category": category,
                    "canonical_key": selected_key,
                    "base_keys": set(),
                    "names": defaultdict(int),
                    "product_ids": set(),
                    "mention_count": 0,
                    "triggered_by": set(),
                }
                merged[scope_key] = bucket
            bucket["base_keys"].add(baseline_key)
            bucket["mention_count"] = int(bucket["mention_count"]) + 1
            bucket["product_ids"].add(product_id)
            name = str(parsed.get("ingredient_name") or "").strip()
            if name:
                bucket["names"][name] += 1
            if selected_key != baseline_key and selected_key.startswith("en::"):
                bucket["triggered_by"].add("en_exact")

    out: list[IngredientLibraryMergeCandidate] = []
    for bucket in merged.values():
        if len(bucket["base_keys"]) <= 1:
            continue
        names_counter: dict[str, int] = dict(bucket["names"])
        names_sorted = sorted(names_counter.items(), key=lambda item: (-int(item[1]), len(str(item[0])), str(item[0])))
        merged_names = [str(item[0]) for item in names_sorted[:8]]
        canonical_name = merged_names[0] if merged_names else str(bucket["canonical_key"])
        confidence = 95 if "en_exact" in bucket["triggered_by"] else 80
        out.append(
            IngredientLibraryMergeCandidate(
                category=str(bucket["category"]),
                canonical_key=str(bucket["canonical_key"]),
                canonical_name=canonical_name,
                merged_names=merged_names,
                source_product_count=len(bucket["product_ids"]),
                mention_count=int(bucket["mention_count"]),
                confidence=confidence,
                triggered_by=sorted(str(x) for x in bucket["triggered_by"]),
            )
        )

    out.sort(key=lambda item: (-int(item.mention_count), item.category, item.canonical_name))
    return out[: max(10, min(1000, int(limit)))]


def _build_ingredient_preflight_usage_top(
    *,
    grouped_items: dict[str, dict[str, Any]],
    limit: int,
) -> list[IngredientLibraryPreflightUsageTopItem]:
    items: list[IngredientLibraryPreflightUsageTopItem] = []
    for row in grouped_items.values():
        source_json = row.get("source_json")
        stats = source_json.get("stats") if isinstance(source_json, dict) else {}
        mention_count = int((stats or {}).get("mention_count") or 0)
        product_count = len(set(str(x) for x in row.get("source_trace_ids") or []))
        items.append(
            IngredientLibraryPreflightUsageTopItem(
                category=str(row.get("category") or "").strip().lower(),
                ingredient_id=str(row.get("ingredient_id") or ""),
                ingredient_key=str(row.get("ingredient_key") or ""),
                ingredient_name=str(row.get("ingredient_name") or ""),
                ingredient_name_en=str(row.get("ingredient_name_en") or "").strip() or None,
                mention_count=mention_count,
                source_product_count=product_count,
            )
        )
    items.sort(
        key=lambda item: (
            -int(item.mention_count),
            -int(item.source_product_count),
            item.category,
            item.ingredient_name,
        )
    )
    return items[: max(10, min(100, int(limit)))]


def _run_ingredient_library_build_job(
    *,
    job_id: str,
    payload: IngredientLibraryBuildRequest,
    db: Session,
) -> None:
    _ensure_ingredient_build_job_table(db)
    rec = db.get(IngredientLibraryBuildJob, job_id)
    if rec is None:
        return

    now = now_iso()
    if bool(rec.cancel_requested):
        rec.status = "cancelled"
        rec.stage = "cancelled"
        rec.stage_label = _ingredient_build_stage_label("cancelled")
        rec.message = "任务在启动前已取消。"
        rec.finished_at = now
        rec.updated_at = now
        db.add(rec)
        db.commit()
        return

    rec.status = "running"
    rec.stage = "prepare"
    rec.stage_label = _ingredient_build_stage_label("prepare")
    rec.message = "任务启动，准备扫描成分。"
    rec.percent = max(1, int(rec.percent or 0))
    rec.started_at = now
    rec.finished_at = None
    rec.updated_at = now
    rec.error_json = None
    rec.result_json = None
    db.add(rec)
    db.commit()

    CancelSessionMaker = sessionmaker(autocommit=False, autoflush=False, bind=db.get_bind())

    def on_progress(event: dict[str, Any]) -> None:
        _apply_ingredient_build_job_progress(db=db, job_id=job_id, payload=event)

    def stop_checker() -> bool:
        cancel_db = CancelSessionMaker()
        try:
            row = cancel_db.get(IngredientLibraryBuildJob, job_id)
            return bool(row and row.cancel_requested)
        finally:
            cancel_db.close()

    try:
        result = _build_ingredient_library_impl(
            payload=payload,
            db=db,
            event_callback=on_progress,
            stop_checker=stop_checker,
        )
        _mark_ingredient_build_job_done(job_id=job_id, result=result, bind=db.get_bind())
    except IngredientLibraryBuildCancelledError as e:
        db.rollback()
        _mark_ingredient_build_job_cancelled(job_id=job_id, message=str(e), bind=db.get_bind())
    except HTTPException as e:
        db.rollback()
        _mark_ingredient_build_job_failed(
            job_id=job_id,
            code="ingredient_build_http_error",
            detail=str(e.detail),
            http_status=e.status_code,
            bind=db.get_bind(),
        )
    except Exception as e:  # pragma: no cover
        db.rollback()
        _mark_ingredient_build_job_failed(
            job_id=job_id,
            code="ingredient_build_internal_error",
            detail=str(e),
            http_status=500,
            bind=db.get_bind(),
        )


def _submit_ingredient_build_job(*, bind: Any, job_id: str) -> None:
    SessionMaker = sessionmaker(autocommit=False, autoflush=False, bind=bind)

    def worker() -> None:
        local_db = SessionMaker()
        try:
            rec = local_db.get(IngredientLibraryBuildJob, job_id)
            if rec is None:
                return
            build_payload = IngredientLibraryBuildRequest(
                category=str(rec.category or "").strip() or None,
                force_regenerate=bool(rec.force_regenerate),
                max_sources_per_ingredient=int(rec.max_sources_per_ingredient or 8),
                normalization_packages=_ingredient_build_job_packages(rec),
            )
            _run_ingredient_library_build_job(job_id=job_id, payload=build_payload, db=local_db)
        finally:
            local_db.close()

    threading.Thread(target=worker, daemon=True).start()


def _ingredient_build_job_packages(rec: IngredientLibraryBuildJob) -> list[str]:
    raw = str(rec.normalization_packages_json or "").strip()
    if not raw:
        return _default_ingredient_normalization_packages()
    try:
        parsed = json.loads(raw)
    except Exception:
        return _default_ingredient_normalization_packages()
    if not isinstance(parsed, list):
        return _default_ingredient_normalization_packages()
    return _normalize_ingredient_normalization_packages([str(item) for item in parsed])


def _reconcile_ingredient_build_job_state(
    *,
    db: Session,
    rec: IngredientLibraryBuildJob,
    now_utc: datetime,
) -> None:
    status = str(rec.status or "").strip().lower()
    if status not in {"queued", "running", "cancelling"}:
        return

    reason = _ingredient_build_job_orphan_reason(rec=rec, now_utc=now_utc)
    if reason is None:
        return

    last_updated = str(rec.updated_at or "").strip() or "-"
    active_stage = str(rec.stage or status or "unknown").strip() or "unknown"
    now = now_iso()
    if status == "cancelling" or bool(rec.cancel_requested):
        rec.status = "cancelled"
        rec.stage = "cancelled"
        rec.stage_label = _ingredient_build_stage_label("cancelled")
        rec.message = (
            "任务已取消：检测到后台执行线程不存在，"
            f"reason={reason}，stage={active_stage}，last_update={last_updated}。"
        )
        rec.error_json = None
    else:
        detail = (
            "任务执行中断：检测到后台执行线程不存在，"
            f"reason={reason}，stage={active_stage}，last_update={last_updated}。"
        )
        rec.status = "failed"
        rec.stage = "failed"
        rec.stage_label = _ingredient_build_stage_label("failed")
        rec.message = detail
        rec.error_json = json.dumps(
            {
                "code": "ingredient_build_orphaned",
                "detail": detail,
                "http_status": 500,
            },
            ensure_ascii=False,
        )
    rec.finished_at = now
    rec.updated_at = now
    db.add(rec)
    db.commit()
    db.refresh(rec)


def _ingredient_build_job_orphan_reason(
    *,
    rec: IngredientLibraryBuildJob,
    now_utc: datetime,
) -> str | None:
    status = str(rec.status or "").strip().lower()
    updated_at = _parse_utc_datetime(str(rec.updated_at or "").strip())
    created_at = _parse_utc_datetime(str(rec.created_at or "").strip())
    started_at = _parse_utc_datetime(str(rec.started_at or "").strip())
    last_update = updated_at or created_at
    if last_update is None:
        return None
    process_anchor = created_at if status == "queued" else (started_at or created_at)
    if process_anchor and process_anchor < INGREDIENT_BUILD_JOB_PROCESS_STARTED_AT:
        return "service_restarted"
    stale_seconds = max(0, int((now_utc - last_update).total_seconds()))
    if stale_seconds >= INGREDIENT_BUILD_JOB_STALE_SECONDS:
        return f"heartbeat_timeout_{stale_seconds}s"
    return None


def _parse_utc_datetime(value: str) -> datetime | None:
    text = str(value or "").strip()
    if not text:
        return None
    try:
        if text.endswith("Z"):
            text = f"{text[:-1]}+00:00"
        parsed = datetime.fromisoformat(text)
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc)
    except ValueError:
        return None


def _apply_ingredient_build_job_progress(
    *,
    db: Session,
    job_id: str,
    payload: dict[str, Any],
) -> None:
    rec = db.get(IngredientLibraryBuildJob, job_id)
    if rec is None:
        return

    step = str(payload.get("step") or "").strip().lower()
    now = now_iso()
    text = str(payload.get("text") or "").strip()
    stream_kind = _normalize_live_text_stream_kind(str(payload.get("stream_kind") or ""))

    if step:
        rec.stage = step
        rec.stage_label = _ingredient_build_stage_label(step)
        if step == "ingredient_model_delta" and stream_kind == "reasoning_summary":
            rec.stage_label = "思考摘要"

    if step == "ingredient_build_start":
        rec.scanned_products = _safe_positive_int(payload.get("scanned_products"), fallback=rec.scanned_products)
        rec.unique_ingredients = _safe_positive_int(payload.get("unique_ingredients"), fallback=rec.unique_ingredients)
        rec.backfilled_from_storage = _safe_positive_int(
            payload.get("backfilled_from_storage"),
            fallback=rec.backfilled_from_storage,
        )
    if step == "ingredient_start":
        rec.submitted_to_model = _safe_positive_int(
            payload.get("submitted_to_model"),
            fallback=rec.submitted_to_model,
        )
    if step == "ingredient_skip":
        rec.skipped_count = _safe_positive_int(payload.get("skipped"), fallback=rec.skipped_count)
    if step == "ingredient_done":
        rec.created_count = _safe_positive_int(payload.get("created"), fallback=rec.created_count)
        rec.updated_count = _safe_positive_int(payload.get("updated"), fallback=rec.updated_count)
    if step == "ingredient_error":
        rec.failed_count = _safe_positive_int(payload.get("failed"), fallback=rec.failed_count)
    if step == "ingredient_build_done":
        rec.submitted_to_model = _safe_positive_int(payload.get("submitted_to_model"), fallback=rec.submitted_to_model)
        rec.created_count = _safe_positive_int(payload.get("created"), fallback=rec.created_count)
        rec.updated_count = _safe_positive_int(payload.get("updated"), fallback=rec.updated_count)
        rec.skipped_count = _safe_positive_int(payload.get("skipped"), fallback=rec.skipped_count)
        rec.failed_count = _safe_positive_int(payload.get("failed"), fallback=rec.failed_count)

    rec.current_ingredient_id = str(payload.get("ingredient_id") or rec.current_ingredient_id or "").strip() or rec.current_ingredient_id
    rec.current_ingredient_name = str(payload.get("ingredient_name") or rec.current_ingredient_name or "").strip() or rec.current_ingredient_name
    if text:
        if step == "ingredient_model_delta":
            target_label = _live_text_target_label(item_id=rec.current_ingredient_id, item_name=rec.current_ingredient_name)
            rec.message = f"{target_label} · {'思考摘要' if stream_kind == 'reasoning_summary' else '模型输出'}流式生成中"
        else:
            rec.message = text
    rec.live_text_json = _update_ingredient_build_live_text_state_json(
        rec.live_text_json,
        updated_at=now,
        step=step,
        stage_label=str(rec.stage_label or "").strip() or _ingredient_build_stage_label(step),
        text=text,
        ingredient_id=rec.current_ingredient_id,
        ingredient_name=rec.current_ingredient_name,
        stream_kind=stream_kind,
    )

    index_value = _safe_positive_int(payload.get("index"), fallback=rec.current_index or 0)
    total_value = _safe_positive_int(payload.get("total"), fallback=rec.current_total or 0)
    rec.current_index = index_value if index_value > 0 else None
    rec.current_total = total_value if total_value > 0 else None
    rec.percent = _ingredient_build_progress_percent(
        current=int(rec.percent or 0),
        step=step,
        index=rec.current_index,
        total=rec.current_total,
    )
    rec.updated_at = now
    db.add(rec)
    db.commit()


def _mark_ingredient_build_job_done(
    *,
    job_id: str,
    result: IngredientLibraryBuildResponse,
    bind: Any,
) -> None:
    SessionMaker = sessionmaker(autocommit=False, autoflush=False, bind=bind)
    db = SessionMaker()
    try:
        rec = db.get(IngredientLibraryBuildJob, job_id)
        if rec is None:
            return
        now = now_iso()
        rec.status = "done"
        rec.stage = "done"
        rec.stage_label = _ingredient_build_stage_label("done")
        rec.message = (
            "成分库生成完成："
            f"created={result.created}, updated={result.updated}, skipped={result.skipped}, failed={result.failed}"
        )
        rec.percent = 100
        rec.scanned_products = int(result.scanned_products)
        rec.unique_ingredients = int(result.unique_ingredients)
        rec.backfilled_from_storage = int(result.backfilled_from_storage)
        rec.submitted_to_model = int(result.submitted_to_model)
        rec.created_count = int(result.created)
        rec.updated_count = int(result.updated)
        rec.skipped_count = int(result.skipped)
        rec.failed_count = int(result.failed)
        rec.live_text_json = _update_ingredient_build_live_text_state_json(
            rec.live_text_json,
            updated_at=now,
            step="done",
            stage_label=_ingredient_build_stage_label("done"),
            text=str(rec.message or ""),
            ingredient_id=rec.current_ingredient_id,
            ingredient_name=rec.current_ingredient_name,
        )
        rec.result_json = json.dumps(result.model_dump(), ensure_ascii=False)
        rec.error_json = None
        rec.finished_at = now
        rec.updated_at = now
        db.add(rec)
        db.commit()
    finally:
        db.close()


def _mark_ingredient_build_job_cancelled(
    *,
    job_id: str,
    message: str,
    bind: Any,
) -> None:
    SessionMaker = sessionmaker(autocommit=False, autoflush=False, bind=bind)
    db = SessionMaker()
    try:
        rec = db.get(IngredientLibraryBuildJob, job_id)
        if rec is None:
            return
        now = now_iso()
        rec.status = "cancelled"
        rec.stage = "cancelled"
        rec.stage_label = _ingredient_build_stage_label("cancelled")
        rec.message = message.strip() or "任务已取消。"
        rec.percent = max(0, min(99, int(rec.percent or 0)))
        rec.live_text_json = _update_ingredient_build_live_text_state_json(
            rec.live_text_json,
            updated_at=now,
            step="cancelled",
            stage_label=_ingredient_build_stage_label("cancelled"),
            text=str(rec.message or ""),
            ingredient_id=rec.current_ingredient_id,
            ingredient_name=rec.current_ingredient_name,
        )
        rec.finished_at = now
        rec.updated_at = now
        db.add(rec)
        db.commit()
    finally:
        db.close()


def _mark_ingredient_build_job_failed(
    *,
    job_id: str,
    code: str,
    detail: str,
    http_status: int,
    bind: Any,
) -> None:
    SessionMaker = sessionmaker(autocommit=False, autoflush=False, bind=bind)
    db = SessionMaker()
    try:
        rec = db.get(IngredientLibraryBuildJob, job_id)
        if rec is None:
            return
        now = now_iso()
        rec.status = "failed"
        rec.stage = "failed"
        rec.stage_label = _ingredient_build_stage_label("failed")
        rec.message = detail
        rec.live_text_json = _update_ingredient_build_live_text_state_json(
            rec.live_text_json,
            updated_at=now,
            step="failed",
            stage_label=_ingredient_build_stage_label("failed"),
            text=str(detail or ""),
            ingredient_id=rec.current_ingredient_id,
            ingredient_name=rec.current_ingredient_name,
        )
        rec.error_json = json.dumps(
            {
                "code": str(code or "ingredient_build_failed"),
                "detail": str(detail or "ingredient build failed."),
                "http_status": int(http_status or 500),
            },
            ensure_ascii=False,
        )
        rec.finished_at = now
        rec.updated_at = now
        db.add(rec)
        db.commit()
    finally:
        db.close()


def _normalize_live_text_stream_kind(value: str | None) -> str:
    key = str(value or "").strip().lower()
    if key in {"reasoning_summary", "reasoning_summary_text"}:
        return "reasoning_summary"
    return "output_text"


def _live_text_target_label(*, item_id: str | None, item_name: str | None) -> str:
    identifier = str(item_id or "").strip()
    label = str(item_name or "").strip()
    if label and identifier and label != identifier:
        return f"{label} / {identifier}"
    return label or identifier or "-"


def _load_stream_live_text_state(raw: str | None) -> dict[str, Any]:
    parsed = _safe_load_json_object(raw) or {}
    logs_raw = parsed.get("logs")
    logs = [str(item).strip() for item in logs_raw] if isinstance(logs_raw, list) else []
    out: dict[str, Any] = {"logs": [item for item in logs if item]}
    for prefix in ("output", "reasoning"):
        index_raw = parsed.get(f"{prefix}_log_index")
        out[f"{prefix}_buffer"] = str(parsed.get(f"{prefix}_buffer") or "")
        out[f"{prefix}_target"] = str(parsed.get(f"{prefix}_target") or "")
        out[f"{prefix}_log_index"] = index_raw if isinstance(index_raw, int) else None
    return out


def _stream_live_text_from_json(raw: str | None) -> str | None:
    state = _load_stream_live_text_state(raw)
    logs = state["logs"]
    if not logs:
        return None
    return "\n\n".join(logs)


def _update_stream_live_text_state_json(
    raw: str | None,
    *,
    updated_at: str,
    step: str,
    stage_label: str,
    text: str,
    stream_kind: str | None,
    target_label: str | None,
) -> str | None:
    state = _load_stream_live_text_state(raw)
    logs = list(state["logs"])
    output_buffer = str(state["output_buffer"])
    output_target = str(state["output_target"])
    output_log_index = state["output_log_index"]
    reasoning_buffer = str(state["reasoning_buffer"])
    reasoning_target = str(state["reasoning_target"])
    reasoning_log_index = state["reasoning_log_index"]

    def trim_logs() -> None:
        nonlocal logs, output_log_index, reasoning_log_index
        if len(logs) <= LIVE_TEXT_LOG_LIMIT:
            return
        overflow = len(logs) - LIVE_TEXT_LOG_LIMIT
        logs = logs[overflow:]
        if isinstance(output_log_index, int):
            output_log_index = None if output_log_index < overflow else (output_log_index - overflow)
        if isinstance(reasoning_log_index, int):
            reasoning_log_index = None if reasoning_log_index < overflow else (reasoning_log_index - overflow)

    def append_line(line: str) -> None:
        nonlocal logs
        value = str(line or "").strip()
        if not value:
            return
        if logs and logs[-1] == value:
            return
        logs.append(value)
        trim_logs()

    def stream_block(kind: str, merged: str, target: str) -> str:
        title = "模型输出（response.output_text）" if kind == "output_text" else "思考摘要（response.reasoning_summary_text）"
        return f"[{updated_at}] {title} | {target or '-'}\n{merged}"

    def sync_stream(kind: str) -> None:
        nonlocal logs, output_log_index, reasoning_log_index
        if kind == "reasoning_summary":
            merged = reasoning_buffer.strip()
            if not merged:
                return
            line = stream_block(kind, merged, reasoning_target)
            if isinstance(reasoning_log_index, int) and 0 <= reasoning_log_index < len(logs):
                logs[reasoning_log_index] = line
            else:
                logs.append(line)
                reasoning_log_index = len(logs) - 1
                trim_logs()
            return
        merged = output_buffer.strip()
        if not merged:
            return
        line = stream_block(kind, merged, output_target)
        if isinstance(output_log_index, int) and 0 <= output_log_index < len(logs):
            logs[output_log_index] = line
        else:
            logs.append(line)
            output_log_index = len(logs) - 1
            trim_logs()

    def freeze_streams(*, clear_targets: bool) -> None:
        nonlocal output_buffer, output_target, output_log_index, reasoning_buffer, reasoning_target, reasoning_log_index
        sync_stream("output_text")
        sync_stream("reasoning_summary")
        output_buffer = ""
        output_log_index = None
        reasoning_buffer = ""
        reasoning_log_index = None
        if clear_targets:
            output_target = ""
            reasoning_target = ""

    is_stream_delta = step.endswith("_model_delta") or step == "ingredient_model_delta"
    if is_stream_delta:
        normalized_kind = _normalize_live_text_stream_kind(stream_kind)
        if normalized_kind == "reasoning_summary":
            next_target = str(target_label or reasoning_target or "").strip() or "-"
            if reasoning_buffer.strip() and reasoning_target and reasoning_target != next_target:
                sync_stream("reasoning_summary")
                reasoning_buffer = ""
                reasoning_log_index = None
            reasoning_target = next_target
            if text:
                reasoning_buffer = f"{reasoning_buffer}{text}"
                sync_stream("reasoning_summary")
        else:
            next_target = str(target_label or output_target or "").strip() or "-"
            if output_buffer.strip() and output_target and output_target != next_target:
                sync_stream("output_text")
                output_buffer = ""
                output_log_index = None
            output_target = next_target
            if text:
                output_buffer = f"{output_buffer}{text}"
                sync_stream("output_text")
    else:
        freeze_streams(clear_targets=step in {"ingredient_build_done", "ingredient_build_cancelled", "done", "failed", "cancelled"})
        if text:
            append_line(f"[{updated_at}] {stage_label or step or '处理中'} | {text}")

    if not logs and not output_buffer.strip() and not reasoning_buffer.strip():
        return None

    return json.dumps(
        {
            "logs": logs,
            "output_buffer": output_buffer,
            "output_target": output_target,
            "output_log_index": output_log_index,
            "reasoning_buffer": reasoning_buffer,
            "reasoning_target": reasoning_target,
            "reasoning_log_index": reasoning_log_index,
        },
        ensure_ascii=False,
    )


def _update_ingredient_build_live_text_state_json(
    raw: str | None,
    *,
    updated_at: str,
    step: str,
    stage_label: str,
    text: str,
    ingredient_id: str | None,
    ingredient_name: str | None,
    stream_kind: str | None = None,
) -> str | None:
    return _update_stream_live_text_state_json(
        raw,
        updated_at=updated_at,
        step=step,
        stage_label=stage_label,
        text=text,
        stream_kind=stream_kind,
        target_label=_live_text_target_label(item_id=ingredient_id, item_name=ingredient_name),
    )


def _ingredient_build_live_text_from_json(raw: str | None) -> str | None:
    return _stream_live_text_from_json(raw)


def _ingredient_build_progress_percent(
    *,
    current: int,
    step: str,
    index: int | None,
    total: int | None,
) -> int:
    value = max(0, min(100, int(current)))
    if step in {"queued", "prepare"}:
        return max(value, 1)
    if step == "ingredient_build_start":
        return max(value, 5)
    if step in {"ingredient_start", "ingredient_done", "ingredient_skip", "ingredient_error", "ingredient_model_step", "ingredient_model_delta"}:
        if index is not None and total is not None and total > 0:
            computed = 15 + int((max(0, min(total, index)) / total) * 80)
            return max(value, min(95, computed))
        return max(value, 15)
    if step in {"ingredient_build_cancelled", "cancelling"}:
        return max(value, 10)
    if step in {"ingredient_build_done", "done"}:
        return 100
    if step in {"failed", "cancelled"}:
        return max(value, 0)
    return value


def _ingredient_build_stage_label(stage: str) -> str:
    mapping = {
        "queued": "待执行",
        "prepare": "准备中",
        "ingredient_build_start": "扫描成分",
        "ingredient_start": "生成成分画像",
        "ingredient_model_step": "模型执行",
        "ingredient_model_delta": "模型输出",
        "ingredient_done": "单项完成",
        "ingredient_skip": "跳过未变化项",
        "ingredient_error": "单项失败",
        "ingredient_build_done": "任务完成",
        "ingredient_build_cancelled": "任务取消",
        "cancelling": "取消中",
        "cancelled": "已取消",
        "done": "已完成",
        "failed": "失败",
    }
    key = str(stage or "").strip().lower()
    return mapping.get(key, key or "处理中")


def _to_ingredient_build_job_view(rec: IngredientLibraryBuildJob) -> IngredientLibraryBuildJobView:
    result_obj: IngredientLibraryBuildResponse | None = None
    error_obj: IngredientLibraryBuildJobError | None = None

    result_raw = _safe_load_json_object(rec.result_json)
    if result_raw is not None:
        try:
            result_obj = IngredientLibraryBuildResponse.model_validate(result_raw)
        except Exception:
            result_obj = None

    error_raw = _safe_load_json_object(rec.error_json)
    if error_raw is not None:
        try:
            error_obj = IngredientLibraryBuildJobError.model_validate(error_raw)
        except Exception:
            error_obj = IngredientLibraryBuildJobError(
                code="ingredient_build_error",
                detail=str(error_raw),
                http_status=500,
            )

    return IngredientLibraryBuildJobView(
        status=str(rec.status or "queued").strip().lower() or "queued",
        job_id=str(rec.job_id),
        category=str(rec.category or "").strip() or None,
        force_regenerate=bool(rec.force_regenerate),
        max_sources_per_ingredient=int(rec.max_sources_per_ingredient or 8),
        normalization_packages=_ingredient_build_job_packages(rec),
        stage=str(rec.stage or "").strip() or None,
        stage_label=str(rec.stage_label or "").strip() or None,
        message=str(rec.message or "").strip() or None,
        percent=max(0, min(100, int(rec.percent or 0))),
        current_index=int(rec.current_index) if rec.current_index is not None else None,
        current_total=int(rec.current_total) if rec.current_total is not None else None,
        current_ingredient_id=str(rec.current_ingredient_id or "").strip() or None,
        current_ingredient_name=str(rec.current_ingredient_name or "").strip() or None,
        live_text=_ingredient_build_live_text_from_json(rec.live_text_json),
        counters=IngredientLibraryBuildJobCounters(
            scanned_products=int(rec.scanned_products or 0),
            unique_ingredients=int(rec.unique_ingredients or 0),
            backfilled_from_storage=int(rec.backfilled_from_storage or 0),
            submitted_to_model=int(rec.submitted_to_model or 0),
            created=int(rec.created_count or 0),
            updated=int(rec.updated_count or 0),
            skipped=int(rec.skipped_count or 0),
            failed=int(rec.failed_count or 0),
        ),
        result=result_obj,
        error=error_obj,
        cancel_requested=bool(rec.cancel_requested),
        created_at=str(rec.created_at or ""),
        updated_at=str(rec.updated_at or ""),
        started_at=str(rec.started_at or "").strip() or None,
        finished_at=str(rec.finished_at or "").strip() or None,
    )


def _safe_load_json_object(raw: str | None) -> dict[str, Any] | None:
    text = str(raw or "").strip()
    if not text:
        return None
    try:
        parsed = json.loads(text)
    except Exception:
        return {"detail": text}
    if not isinstance(parsed, dict):
        return {"value": parsed}
    return parsed


def _safe_load_json_list(raw: str | None) -> list[Any]:
    text = str(raw or "").strip()
    if not text:
        return []
    try:
        parsed = json.loads(text)
    except Exception:
        return []
    return parsed if isinstance(parsed, list) else []


def _update_product_workbench_live_text_state_json(
    raw: str | None,
    *,
    updated_at: str,
    step: str,
    stage_label: str,
    text: str,
    item_id: str | None,
    item_name: str | None,
    stream_kind: str | None = None,
) -> str | None:
    return _update_stream_live_text_state_json(
        raw,
        updated_at=updated_at,
        step=step,
        stage_label=stage_label,
        text=text,
        stream_kind=stream_kind,
        target_label=_live_text_target_label(item_id=item_id, item_name=item_name),
    )


def _product_workbench_live_text_from_json(raw: str | None) -> str | None:
    return _stream_live_text_from_json(raw)


def _product_workbench_queue_message(*, action: str) -> str:
    if should_inline_dispatch_product_workbench_job():
        return f"{action}，等待执行（本地并发上限 {PRODUCT_WORKBENCH_MAX_CONCURRENCY}）。"
    return f"{action}，等待 worker 执行。"


def _ensure_product_workbench_job_table(db: Session) -> None:
    bind = db.get_bind()
    ProductWorkbenchJob.__table__.create(bind=bind, checkfirst=True)
    inspector = inspect(bind)
    columns = {item["name"] for item in inspector.get_columns("product_workbench_jobs")}
    statements: list[str] = []
    if "live_text_json" not in columns:
        statements.append("ALTER TABLE product_workbench_jobs ADD COLUMN live_text_json TEXT")
    if statements:
        with bind.begin() as conn:
            for stmt in statements:
                conn.execute(text(stmt))


def _create_product_workbench_job(
    *,
    db: Session,
    job_type: str,
    params: dict[str, Any],
    queued_message: str,
) -> ProductWorkbenchJobView:
    _ensure_product_workbench_job_table(db)
    _validate_product_workbench_job_type(job_type)
    now = now_iso()
    rec = ProductWorkbenchJob(
        job_id=new_id(),
        job_type=job_type,
        status="queued",
        params_json=json.dumps(params or {}, ensure_ascii=False),
        stage="queued",
        stage_label=_product_workbench_stage_label(job_type=job_type, stage="queued"),
        message=str(queued_message or "").strip() or "任务已创建，等待执行。",
        percent=0,
        current_index=None,
        current_total=None,
        current_item_id=None,
        current_item_name=None,
        counters_json=json.dumps({}, ensure_ascii=False),
        logs_json="[]",
        live_text_json=None,
        result_json=None,
        error_json=None,
        cancel_requested=False,
        created_at=now,
        updated_at=now,
        started_at=None,
        finished_at=None,
    )
    db.add(rec)
    db.commit()
    db.refresh(rec)
    _submit_product_workbench_job(bind=db.get_bind(), job_id=rec.job_id)
    return _to_product_workbench_job_view(rec)


def _list_product_workbench_jobs(
    *,
    db: Session,
    job_type: str,
    status: str | None,
    offset: int,
    limit: int,
) -> list[ProductWorkbenchJobView]:
    _ensure_product_workbench_job_table(db)
    normalized_job_type = _validate_product_workbench_job_type(job_type)
    normalized_status = _normalize_product_workbench_status(status)
    stmt = select(ProductWorkbenchJob).where(ProductWorkbenchJob.job_type == normalized_job_type)
    if normalized_status:
        stmt = stmt.where(ProductWorkbenchJob.status == normalized_status)
    rows = db.execute(stmt.order_by(ProductWorkbenchJob.updated_at.desc()).offset(offset).limit(limit)).scalars().all()
    now_utc = datetime.now(timezone.utc)
    views: list[ProductWorkbenchJobView] = []
    for row in rows:
        _reconcile_product_workbench_job_state(db=db, rec=row, now_utc=now_utc)
        if normalized_status and str(row.status or "").strip().lower() != normalized_status:
            continue
        views.append(_to_product_workbench_job_view(row))
    return views


def _get_product_workbench_job(
    *,
    db: Session,
    job_id: str,
    expected_job_type: str,
) -> ProductWorkbenchJobView:
    _ensure_product_workbench_job_table(db)
    normalized_job_type = _validate_product_workbench_job_type(expected_job_type)
    value = str(job_id or "").strip()
    if not value:
        raise HTTPException(status_code=400, detail="job_id is required.")
    rec = db.get(ProductWorkbenchJob, value)
    if rec is None or str(rec.job_type or "").strip() != normalized_job_type:
        raise HTTPException(status_code=404, detail=f"Product workbench job '{job_id}' not found.")
    _reconcile_product_workbench_job_state(db=db, rec=rec, now_utc=datetime.now(timezone.utc))
    return _to_product_workbench_job_view(rec)


def _cancel_product_workbench_job(
    *,
    db: Session,
    job_id: str,
    expected_job_type: str,
) -> ProductWorkbenchJobCancelResponse:
    _ensure_product_workbench_job_table(db)
    normalized_job_type = _validate_product_workbench_job_type(expected_job_type)
    value = str(job_id or "").strip()
    if not value:
        raise HTTPException(status_code=400, detail="job_id is required.")
    rec = db.get(ProductWorkbenchJob, value)
    if rec is None or str(rec.job_type or "").strip() != normalized_job_type:
        raise HTTPException(status_code=404, detail=f"Product workbench job '{job_id}' not found.")

    status = str(rec.status or "").strip().lower()
    if status in {"done", "failed", "cancelled"}:
        return ProductWorkbenchJobCancelResponse(status="ok", job=_to_product_workbench_job_view(rec))

    rec.cancel_requested = True
    now = now_iso()
    rec.updated_at = now
    if status == "queued":
        rec.status = "cancelled"
        rec.stage = "cancelled"
        rec.stage_label = _product_workbench_stage_label(job_type=normalized_job_type, stage="cancelled")
        rec.message = "任务在启动前已取消。"
        rec.percent = 0
        rec.finished_at = now
    else:
        rec.status = "cancelling"
        rec.stage = "cancelling"
        rec.stage_label = _product_workbench_stage_label(job_type=normalized_job_type, stage="cancelling")
        rec.message = "已收到取消请求，当前处理单元结束后停止。"
    rec.live_text_json = _update_product_workbench_live_text_state_json(
        rec.live_text_json,
        updated_at=now,
        step=str(rec.stage or rec.status or "").strip().lower(),
        stage_label=str(rec.stage_label or "").strip() or _product_workbench_stage_label(job_type=normalized_job_type, stage=str(rec.stage or rec.status or "")),
        text=str(rec.message or ""),
        item_id=str(rec.current_item_id or "").strip() or None,
        item_name=str(rec.current_item_name or "").strip() or None,
    )
    db.add(rec)
    db.commit()
    db.refresh(rec)
    return ProductWorkbenchJobCancelResponse(status="ok", job=_to_product_workbench_job_view(rec))


def _retry_product_workbench_job(
    *,
    db: Session,
    job_id: str,
    expected_job_type: str,
) -> ProductWorkbenchJobView:
    _ensure_product_workbench_job_table(db)
    normalized_job_type = _validate_product_workbench_job_type(expected_job_type)
    value = str(job_id or "").strip()
    if not value:
        raise HTTPException(status_code=400, detail="job_id is required.")
    rec = db.get(ProductWorkbenchJob, value)
    if rec is None or str(rec.job_type or "").strip() != normalized_job_type:
        raise HTTPException(status_code=404, detail=f"Product workbench job '{job_id}' not found.")

    status = str(rec.status or "").strip().lower()
    if status not in {"failed", "cancelled"}:
        raise HTTPException(status_code=409, detail=f"Only failed/cancelled job can retry. current_status={status}.")

    now = now_iso()
    rec.status = "queued"
    rec.stage = "queued"
    rec.stage_label = _product_workbench_stage_label(job_type=normalized_job_type, stage="queued")
    rec.message = _product_workbench_queue_message(action="重试任务已入队")
    rec.percent = 0
    rec.current_index = None
    rec.current_total = None
    rec.current_item_id = None
    rec.current_item_name = None
    rec.counters_json = json.dumps({}, ensure_ascii=False)
    rec.logs_json = "[]"
    rec.live_text_json = None
    rec.result_json = None
    rec.error_json = None
    rec.cancel_requested = False
    rec.started_at = None
    rec.finished_at = None
    rec.updated_at = now
    db.add(rec)
    db.commit()
    db.refresh(rec)
    _submit_product_workbench_job(bind=db.get_bind(), job_id=rec.job_id)
    return _to_product_workbench_job_view(rec)


def _submit_product_workbench_job(*, bind: Any, job_id: str) -> None:
    if not should_inline_dispatch_product_workbench_job():
        # split/multi profile: API only queues jobs in DB; dedicated worker process pulls and executes.
        return

    SessionMaker = sessionmaker(autocommit=False, autoflush=False, bind=bind)

    def worker() -> None:
        local_db = SessionMaker()
        try:
            _run_product_workbench_job(job_id=job_id, db=local_db)
        finally:
            local_db.close()

    try:
        get_runtime_task_queue().submit_product_workbench_job(worker, task_name=f"product-workbench-job-{job_id}")
    except Exception as e:
        _mark_product_workbench_job_failed(
            job_id=job_id,
            bind=bind,
            code="product_workbench_dispatch_failed",
            detail=f"[stage=product_workbench_dispatch] queue submit failed: {e}",
            http_status=500,
        )


def run_product_workbench_worker_once() -> bool:
    db = SessionLocal()
    try:
        _ensure_product_workbench_job_table(db)
        rec = (
            db.execute(
                select(ProductWorkbenchJob)
                .where(ProductWorkbenchJob.status == "queued")
                .order_by(ProductWorkbenchJob.updated_at.asc())
                .limit(1)
            )
            .scalars()
            .first()
        )
        if rec is None:
            return False
        _run_product_workbench_job(job_id=str(rec.job_id), db=db)
        return True
    finally:
        db.close()


def _run_product_workbench_job(*, job_id: str, db: Session) -> None:
    _ensure_product_workbench_job_table(db)
    rec = db.get(ProductWorkbenchJob, str(job_id or "").strip())
    if rec is None:
        return
    job_type = _validate_product_workbench_job_type(str(rec.job_type or "").strip())
    params = _safe_load_json_object(rec.params_json) or {}
    SessionMaker = sessionmaker(autocommit=False, autoflush=False, bind=db.get_bind())

    def should_cancel() -> bool:
        local_db = SessionMaker()
        try:
            row = local_db.get(ProductWorkbenchJob, job_id)
            return bool(row and row.cancel_requested)
        finally:
            local_db.close()

    try:
        if bool(rec.cancel_requested):
            raise ProductWorkbenchJobCancelledError("job cancelled before execution.")
        now = now_iso()
        rec.status = "running"
        rec.stage = "prepare"
        rec.stage_label = _product_workbench_stage_label(job_type=job_type, stage="prepare")
        rec.message = "任务启动，准备执行。"
        rec.percent = max(1, int(rec.percent or 0))
        rec.updated_at = now
        if not str(rec.started_at or "").strip():
            rec.started_at = now
        rec.finished_at = None
        db.add(rec)
        db.commit()
        db.refresh(rec)

        if job_type == "route_mapping_build":
            build_payload = ProductRouteMappingBuildRequest.model_validate(params)
            result = _build_product_route_mapping_impl(
                build_payload,
                db=db,
                event_callback=lambda payload: _apply_product_workbench_job_progress(
                    bind=db.get_bind(),
                    job_id=job_id,
                    payload=payload,
                ),
                should_cancel=should_cancel,
            )
        elif job_type == "product_analysis_build":
            analysis_payload = ProductAnalysisBuildRequest.model_validate(params)
            result = _build_product_analysis_impl(
                analysis_payload,
                db=db,
                event_callback=lambda payload: _apply_product_workbench_job_progress(
                    bind=db.get_bind(),
                    job_id=job_id,
                    payload=payload,
                ),
                should_cancel=should_cancel,
            )
        elif job_type == "dedup_suggest":
            dedup_payload = ProductDedupSuggestRequest.model_validate(params)
            result = _suggest_product_duplicates_impl(
                dedup_payload,
                db=db,
                event_callback=lambda payload: _apply_product_workbench_job_progress(
                    bind=db.get_bind(),
                    job_id=job_id,
                    payload=payload,
                ),
                should_cancel=should_cancel,
            )
        elif job_type == "selection_result_build":
            selection_payload = MobileSelectionResultBuildRequest.model_validate(params)
            try:
                result = _build_mobile_selection_results_impl(
                    selection_payload,
                    db=db,
                    event_callback=lambda payload: _apply_product_workbench_job_progress(
                        bind=db.get_bind(),
                        job_id=job_id,
                        payload=payload,
                    ),
                    should_cancel=should_cancel,
                )
            except SelectionResultBuildCancelledError as exc:
                raise ProductWorkbenchJobCancelledError(str(exc)) from exc
        elif job_type == "product_batch_delete":
            delete_payload = ProductBatchDeleteRequest.model_validate(params)
            result = _batch_delete_products_impl(
                delete_payload,
                db=db,
                event_callback=lambda payload: _apply_product_workbench_job_progress(
                    bind=db.get_bind(),
                    job_id=job_id,
                    payload=payload,
                ),
                should_cancel=should_cancel,
            )
        elif job_type == "ingredient_batch_delete":
            ingredient_delete_payload = IngredientLibraryBatchDeleteRequest.model_validate(params)
            result = _batch_delete_ingredient_library_impl(
                ingredient_delete_payload,
                db=db,
                event_callback=lambda payload: _apply_product_workbench_job_progress(
                    bind=db.get_bind(),
                    job_id=job_id,
                    payload=payload,
                ),
                should_cancel=should_cancel,
            )
        elif job_type == "orphan_storage_cleanup":
            orphan_payload = OrphanStorageCleanupRequest.model_validate(params)
            result = _cleanup_orphan_storage_impl(
                orphan_payload,
                db=db,
                event_callback=lambda payload: _apply_product_workbench_job_progress(
                    bind=db.get_bind(),
                    job_id=job_id,
                    payload=payload,
                ),
                should_cancel=should_cancel,
            )
        elif job_type == "mobile_invalid_ref_cleanup":
            mobile_ref_payload = MobileInvalidProductRefCleanupRequest.model_validate(params)
            result = _cleanup_mobile_invalid_product_refs(
                db=db,
                dry_run=bool(mobile_ref_payload.dry_run),
                sample_limit=int(mobile_ref_payload.sample_limit),
                selection_deleted_by="maintenance:mobile_product_ref_cleanup",
                event_callback=lambda payload: _apply_product_workbench_job_progress(
                    bind=db.get_bind(),
                    job_id=job_id,
                    payload=payload,
                ),
                should_cancel=should_cancel,
            )
            if (not mobile_ref_payload.dry_run) and result.total_repaired > 0:
                db.commit()
        else:  # pragma: no cover
            raise HTTPException(status_code=400, detail=f"Unsupported product workbench job type: {job_type}.")

        result_payload = result.model_dump()
        if job_type == "route_mapping_build":
            done_message = (
                "任务完成："
                f"scanned={int(result_payload.get('scanned_products') or 0)}，"
                f"created={int(result_payload.get('created') or 0)}，"
                f"updated={int(result_payload.get('updated') or 0)}，"
                f"failed={int(result_payload.get('failed') or 0)}"
            )
        elif job_type == "product_analysis_build":
            done_message = (
                "任务完成："
                f"scanned={int(result_payload.get('scanned_products') or 0)}，"
                f"created={int(result_payload.get('created') or 0)}，"
                f"updated={int(result_payload.get('updated') or 0)}，"
                f"failed={int(result_payload.get('failed') or 0)}"
            )
        elif job_type == "selection_result_build":
            done_message = (
                "任务完成："
                f"scenarios={int(result_payload.get('scanned_scenarios') or 0)}，"
                f"created={int(result_payload.get('created') or 0)}，"
                f"updated={int(result_payload.get('updated') or 0)}，"
                f"failed={int(result_payload.get('failed') or 0)}"
            )
        elif job_type == "product_batch_delete":
            done_message = (
                "任务完成："
                f"deleted={len(result_payload.get('deleted_ids') or [])}，"
                f"skipped={len(result_payload.get('skipped_ids') or [])}，"
                f"missing={len(result_payload.get('missing_ids') or [])}"
            )
        elif job_type == "ingredient_batch_delete":
            done_message = (
                "任务完成："
                f"deleted={len(result_payload.get('deleted_ids') or [])}，"
                f"missing={len(result_payload.get('missing_ids') or [])}，"
                f"failed={len(result_payload.get('failed_items') or [])}"
            )
        elif job_type == "orphan_storage_cleanup":
            images_obj = result_payload.get("images") if isinstance(result_payload.get("images"), dict) else {}
            runs_obj = result_payload.get("runs") if isinstance(result_payload.get("runs"), dict) else {}
            done_message = (
                f"{'预览完成' if bool(result_payload.get('dry_run')) else '清理完成'}："
                f"images_deleted={int(images_obj.get('deleted_images') or 0)}，"
                f"runs_deleted={int(runs_obj.get('deleted_runs') or 0)}"
            )
        elif job_type == "mobile_invalid_ref_cleanup":
            done_message = (
                f"{'扫描完成' if bool(result_payload.get('dry_run')) else '修复完成'}："
                f"invalid={int(result_payload.get('total_invalid') or 0)}，"
                f"repaired={int(result_payload.get('total_repaired') or 0)}"
            )
        else:
            done_message = (
                "任务完成："
                f"scanned={int(result_payload.get('scanned_products') or 0)}，"
                f"suggestions={len(result_payload.get('suggestions') or [])}，"
                f"failed={len(result_payload.get('failures') or [])}"
            )
        _mark_product_workbench_job_done(
            job_id=job_id,
            bind=db.get_bind(),
            result=result_payload,
            message=done_message,
        )
    except ProductWorkbenchJobCancelledError as e:
        db.rollback()
        _mark_product_workbench_job_cancelled(
            job_id=job_id,
            bind=db.get_bind(),
            message=str(e),
            result=e.result if isinstance(getattr(e, "result", None), dict) else None,
        )
    except HTTPException as e:
        db.rollback()
        _mark_product_workbench_job_failed(
            job_id=job_id,
            bind=db.get_bind(),
            code="product_workbench_http_error",
            detail=str(e.detail),
            http_status=e.status_code,
        )
    except Exception as e:  # pragma: no cover
        db.rollback()
        _mark_product_workbench_job_failed(
            job_id=job_id,
            bind=db.get_bind(),
            code="product_workbench_internal_error",
            detail=str(e),
            http_status=500,
        )


def _apply_product_workbench_job_progress(*, bind: Any, job_id: str, payload: dict[str, Any]) -> None:
    SessionMaker = sessionmaker(autocommit=False, autoflush=False, bind=bind)
    local_db = SessionMaker()
    try:
        rec = local_db.get(ProductWorkbenchJob, job_id)
        if rec is None:
            return
        job_type = _validate_product_workbench_job_type(str(rec.job_type or "").strip())
        now = now_iso()
        step = str(payload.get("step") or "").strip().lower()
        stage = step or str(rec.stage or "running").strip().lower()
        stage_label = _product_workbench_stage_label(job_type=job_type, stage=stage)
        text = str(payload.get("text") or payload.get("message") or "").strip()
        stream_kind = _normalize_live_text_stream_kind(str(payload.get("stream_kind") or ""))
        if not text and step.endswith("_model_delta"):
            text = str(payload.get("delta") or "").strip()
        if step.endswith("_model_delta") and stream_kind == "reasoning_summary":
            stage_label = "思考摘要"

        counters = _safe_load_json_object(rec.counters_json) or {}
        _merge_product_workbench_counters(
            job_type=job_type,
            counters=counters,
            payload=payload,
        )
        rec.counters_json = json.dumps(counters, ensure_ascii=False)

        current_index, current_total, current_item_id, current_item_name = _product_workbench_progress_cursor(
            job_type=job_type,
            payload=payload,
            prev_index=rec.current_index,
            prev_total=rec.current_total,
            prev_item_id=str(rec.current_item_id or "").strip() or None,
            prev_item_name=str(rec.current_item_name or "").strip() or None,
        )
        rec.current_index = current_index
        rec.current_total = current_total
        rec.current_item_id = current_item_id
        rec.current_item_name = current_item_name
        rec.percent = _product_workbench_progress_percent(
            job_type=job_type,
            current=int(rec.percent or 0),
            step=step,
            index=current_index,
            total=current_total,
        )
        rec.status = "running"
        rec.stage = stage or "running"
        rec.stage_label = stage_label
        if text:
            if step.endswith("_model_delta"):
                target_label = _live_text_target_label(item_id=current_item_id, item_name=current_item_name)
                rec.message = f"{target_label} · {'思考摘要' if stream_kind == 'reasoning_summary' else '模型输出'}流式生成中"
            else:
                rec.message = text
                logs = _safe_load_json_list(rec.logs_json)
                line = f"[{now}] {stage_label} | {text}"
                if not logs or str(logs[-1]) != line:
                    logs.append(line)
                    if len(logs) > PRODUCT_WORKBENCH_LOG_LIMIT:
                        logs = logs[-PRODUCT_WORKBENCH_LOG_LIMIT:]
                    rec.logs_json = json.dumps(logs, ensure_ascii=False)
            rec.live_text_json = _update_product_workbench_live_text_state_json(
                rec.live_text_json,
                updated_at=now,
                step=step,
                stage_label=stage_label,
                text=text,
                item_id=current_item_id,
                item_name=current_item_name,
                stream_kind=stream_kind,
            )
        rec.updated_at = now
        if not str(rec.started_at or "").strip():
            rec.started_at = now
        local_db.add(rec)
        local_db.commit()
    finally:
        local_db.close()


def _mark_product_workbench_job_done(
    *,
    job_id: str,
    bind: Any,
    result: dict[str, Any],
    message: str,
) -> None:
    SessionMaker = sessionmaker(autocommit=False, autoflush=False, bind=bind)
    local_db = SessionMaker()
    try:
        rec = local_db.get(ProductWorkbenchJob, job_id)
        if rec is None:
            return
        now = now_iso()
        job_type = _validate_product_workbench_job_type(str(rec.job_type or "").strip())
        counters = _safe_load_json_object(rec.counters_json) or {}
        if isinstance(result, dict):
            _merge_product_workbench_counters(
                job_type=job_type,
                counters=counters,
                payload=result,
            )
        rec.counters_json = json.dumps(counters, ensure_ascii=False)
        rec.status = "done"
        rec.stage = "done"
        rec.stage_label = _product_workbench_stage_label(job_type=job_type, stage="done")
        rec.message = str(message or "").strip() or "任务完成。"
        rec.percent = 100
        rec.live_text_json = _update_product_workbench_live_text_state_json(
            rec.live_text_json,
            updated_at=now,
            step="done",
            stage_label=rec.stage_label,
            text=rec.message,
            item_id=str(rec.current_item_id or "").strip() or None,
            item_name=str(rec.current_item_name or "").strip() or None,
        )
        rec.result_json = json.dumps(result or {}, ensure_ascii=False)
        rec.error_json = None
        rec.finished_at = now
        rec.updated_at = now
        local_db.add(rec)
        local_db.commit()
    finally:
        local_db.close()


def _mark_product_workbench_job_cancelled(
    *,
    job_id: str,
    bind: Any,
    message: str,
    result: dict[str, Any] | None = None,
) -> None:
    SessionMaker = sessionmaker(autocommit=False, autoflush=False, bind=bind)
    local_db = SessionMaker()
    try:
        rec = local_db.get(ProductWorkbenchJob, job_id)
        if rec is None:
            return
        now = now_iso()
        job_type = _validate_product_workbench_job_type(str(rec.job_type or "").strip())
        counters = _safe_load_json_object(rec.counters_json) or {}
        if isinstance(result, dict):
            _merge_product_workbench_counters(
                job_type=job_type,
                counters=counters,
                payload=result,
            )
        rec.counters_json = json.dumps(counters, ensure_ascii=False)
        rec.status = "cancelled"
        rec.stage = "cancelled"
        rec.stage_label = _product_workbench_stage_label(job_type=job_type, stage="cancelled")
        rec.message = str(message or "任务已取消。")
        rec.percent = max(0, min(99, int(rec.percent or 0)))
        rec.live_text_json = _update_product_workbench_live_text_state_json(
            rec.live_text_json,
            updated_at=now,
            step="cancelled",
            stage_label=rec.stage_label,
            text=rec.message,
            item_id=str(rec.current_item_id or "").strip() or None,
            item_name=str(rec.current_item_name or "").strip() or None,
        )
        if isinstance(result, dict):
            rec.result_json = json.dumps(result, ensure_ascii=False)
        rec.finished_at = now
        rec.updated_at = now
        local_db.add(rec)
        local_db.commit()
    finally:
        local_db.close()


def _mark_product_workbench_job_failed(
    *,
    job_id: str,
    bind: Any,
    code: str,
    detail: str,
    http_status: int,
) -> None:
    SessionMaker = sessionmaker(autocommit=False, autoflush=False, bind=bind)
    local_db = SessionMaker()
    try:
        rec = local_db.get(ProductWorkbenchJob, job_id)
        if rec is None:
            return
        now = now_iso()
        job_type = _validate_product_workbench_job_type(str(rec.job_type or "").strip())
        rec.status = "failed"
        rec.stage = "failed"
        rec.stage_label = _product_workbench_stage_label(job_type=job_type, stage="failed")
        rec.message = str(detail or "任务失败。")
        rec.live_text_json = _update_product_workbench_live_text_state_json(
            rec.live_text_json,
            updated_at=now,
            step="failed",
            stage_label=rec.stage_label,
            text=rec.message,
            item_id=str(rec.current_item_id or "").strip() or None,
            item_name=str(rec.current_item_name or "").strip() or None,
        )
        rec.error_json = json.dumps(
            {
                "code": str(code or "product_workbench_failed"),
                "detail": str(detail or "product workbench job failed."),
                "http_status": int(http_status or 500),
            },
            ensure_ascii=False,
        )
        rec.finished_at = now
        rec.updated_at = now
        local_db.add(rec)
        local_db.commit()
    finally:
        local_db.close()


def _reconcile_product_workbench_job_state(*, db: Session, rec: ProductWorkbenchJob, now_utc: datetime) -> None:
    status = str(rec.status or "").strip().lower()
    if status not in {"queued", "running", "cancelling"}:
        return
    reason = _product_workbench_job_orphan_reason(rec=rec, now_utc=now_utc)
    if reason is None:
        return

    now = now_iso()
    job_type = _validate_product_workbench_job_type(str(rec.job_type or "").strip())
    last_updated = str(rec.updated_at or "").strip() or "-"
    active_stage = str(rec.stage or status or "unknown").strip() or "unknown"
    if status == "cancelling" or bool(rec.cancel_requested):
        rec.status = "cancelled"
        rec.stage = "cancelled"
        rec.stage_label = _product_workbench_stage_label(job_type=job_type, stage="cancelled")
        rec.message = (
            "任务已取消：检测到后台执行线程不存在，"
            f"reason={reason}，stage={active_stage}，last_update={last_updated}。"
        )
        rec.live_text_json = _update_product_workbench_live_text_state_json(
            rec.live_text_json,
            updated_at=now,
            step="cancelled",
            stage_label=rec.stage_label,
            text=rec.message,
            item_id=str(rec.current_item_id or "").strip() or None,
            item_name=str(rec.current_item_name or "").strip() or None,
        )
        rec.error_json = None
    else:
        detail = (
            "任务执行中断：检测到后台执行线程不存在，"
            f"reason={reason}，stage={active_stage}，last_update={last_updated}。"
        )
        rec.status = "failed"
        rec.stage = "failed"
        rec.stage_label = _product_workbench_stage_label(job_type=job_type, stage="failed")
        rec.message = detail
        rec.live_text_json = _update_product_workbench_live_text_state_json(
            rec.live_text_json,
            updated_at=now,
            step="failed",
            stage_label=rec.stage_label,
            text=rec.message,
            item_id=str(rec.current_item_id or "").strip() or None,
            item_name=str(rec.current_item_name or "").strip() or None,
        )
        rec.error_json = json.dumps(
            {
                "code": "product_workbench_job_orphaned",
                "detail": detail,
                "http_status": 500,
            },
            ensure_ascii=False,
        )
    rec.finished_at = now
    rec.updated_at = now
    db.add(rec)
    db.commit()
    db.refresh(rec)


def _product_workbench_job_orphan_reason(*, rec: ProductWorkbenchJob, now_utc: datetime) -> str | None:
    status = str(rec.status or "").strip().lower()
    updated_at = _parse_utc_datetime(str(rec.updated_at or "").strip())
    created_at = _parse_utc_datetime(str(rec.created_at or "").strip())
    started_at = _parse_utc_datetime(str(rec.started_at or "").strip())
    last_update = updated_at or created_at
    if last_update is None:
        return None
    process_anchor = created_at if status == "queued" else (started_at or created_at)
    if process_anchor and process_anchor < PRODUCT_WORKBENCH_JOB_PROCESS_STARTED_AT:
        return "service_restarted"
    stale_seconds = max(0, int((now_utc - last_update).total_seconds()))
    if stale_seconds >= PRODUCT_WORKBENCH_JOB_STALE_SECONDS:
        return f"heartbeat_timeout_{stale_seconds}s"
    return None


def _to_product_workbench_job_view(rec: ProductWorkbenchJob) -> ProductWorkbenchJobView:
    params_obj = _safe_load_json_object(rec.params_json) or {}
    counters_obj = _safe_load_json_object(rec.counters_json) or {}
    logs = [str(item or "") for item in _safe_load_json_list(rec.logs_json) if str(item or "").strip()]
    result = _safe_load_json_object(rec.result_json)
    error_raw = _safe_load_json_object(rec.error_json)
    error_obj: ProductWorkbenchJobError | None = None
    if error_raw is not None:
        try:
            error_obj = ProductWorkbenchJobError.model_validate(error_raw)
        except Exception:
            error_obj = ProductWorkbenchJobError(
                code="product_workbench_error",
                detail=str(error_raw),
                http_status=500,
            )
    try:
        counters = ProductWorkbenchJobCounters.model_validate(counters_obj)
    except Exception:
        counters = ProductWorkbenchJobCounters()
    return ProductWorkbenchJobView(
        status=str(rec.status or "queued").strip().lower() or "queued",
        job_id=str(rec.job_id),
        job_type=_validate_product_workbench_job_type(str(rec.job_type or "").strip()),
        params=params_obj,
        stage=str(rec.stage or "").strip() or None,
        stage_label=str(rec.stage_label or "").strip() or None,
        message=str(rec.message or "").strip() or None,
        percent=max(0, min(100, int(rec.percent or 0))),
        current_index=int(rec.current_index) if rec.current_index is not None else None,
        current_total=int(rec.current_total) if rec.current_total is not None else None,
        current_item_id=str(rec.current_item_id or "").strip() or None,
        current_item_name=str(rec.current_item_name or "").strip() or None,
        counters=counters,
        live_text=_product_workbench_live_text_from_json(rec.live_text_json),
        logs=logs[-PRODUCT_WORKBENCH_LOG_LIMIT:],
        result=result,
        error=error_obj,
        cancel_requested=bool(rec.cancel_requested),
        created_at=str(rec.created_at or ""),
        updated_at=str(rec.updated_at or ""),
        started_at=str(rec.started_at or "").strip() or None,
        finished_at=str(rec.finished_at or "").strip() or None,
    )


def _validate_product_workbench_job_type(job_type: str) -> str:
    value = str(job_type or "").strip().lower()
    if value not in {
        "route_mapping_build",
        "product_analysis_build",
        "dedup_suggest",
        "selection_result_build",
        "product_batch_delete",
        "ingredient_batch_delete",
        "orphan_storage_cleanup",
        "mobile_invalid_ref_cleanup",
    }:
        raise HTTPException(status_code=400, detail=f"Invalid job_type: {job_type}.")
    return value


def _normalize_product_workbench_status(status: str | None) -> str | None:
    value = str(status or "").strip().lower() or None
    if value is None:
        return None
    if value not in {"queued", "running", "cancelling", "cancelled", "done", "failed"}:
        raise HTTPException(status_code=400, detail=f"Invalid status: {value}.")
    return value


def _product_workbench_stage_label(*, job_type: str, stage: str) -> str:
    key = str(stage or "").strip().lower()
    common = {
        "queued": "待执行",
        "prepare": "准备中",
        "running": "执行中",
        "cancelling": "取消中",
        "cancelled": "已取消",
        "done": "已完成",
        "failed": "失败",
    }
    if key in common:
        return common[key]
    if job_type == "route_mapping_build":
        mapping = {
            "route_mapping_build_start": "扫描产品",
            "route_mapping_start": "映射中",
            "route_mapping_model_step": "模型执行",
            "route_mapping_model_delta": "模型输出",
            "route_mapping_done": "单项完成",
            "route_mapping_skip": "跳过未变化项",
            "route_mapping_error": "单项失败",
            "route_mapping_build_done": "任务完成",
        }
        return mapping.get(key, key or "处理中")
    if job_type == "product_analysis_build":
        mapping = {
            "product_analysis_build_start": "扫描产品",
            "product_analysis_start": "分析中",
            "product_analysis_model_step": "模型执行",
            "product_analysis_model_delta": "模型输出",
            "product_analysis_done": "单项完成",
            "product_analysis_skip": "跳过未变化项",
            "product_analysis_error": "单项失败",
            "product_analysis_build_done": "任务完成",
        }
        return mapping.get(key, key or "处理中")
    if job_type == "selection_result_build":
        mapping = {
            "selection_result_build_start": "枚举场景",
            "selection_result_start": "场景生成中",
            "selection_result_model_step": "模型执行",
            "selection_result_model_delta": "模型输出",
            "selection_result_done": "单项完成",
            "selection_result_skip": "跳过未变化项",
            "selection_result_error": "单项失败",
            "selection_result_build_done": "任务完成",
        }
        return mapping.get(key, key or "处理中")
    if job_type == "product_batch_delete":
        mapping = {
            "product_delete_start": "准备删除",
            "product_delete_item": "删除产品",
            "product_delete_done": "单项完成",
            "product_delete_skip": "跳过保留项",
            "product_delete_missing": "目标缺失",
            "product_delete_mobile_refs_cleanup": "清理移动端引用",
        }
        return mapping.get(key, key or "处理中")
    if job_type == "ingredient_batch_delete":
        mapping = {
            "ingredient_delete_start": "准备删除",
            "ingredient_delete_item": "删除成分",
            "ingredient_delete_done": "单项完成",
            "ingredient_delete_missing": "目标缺失",
            "ingredient_delete_error": "单项失败",
        }
        return mapping.get(key, key or "处理中")
    if job_type == "orphan_storage_cleanup":
        mapping = {
            "orphan_cleanup_prepare": "收集引用",
            "orphan_cleanup_scan": "扫描 orphan",
        }
        return mapping.get(key, key or "处理中")
    if job_type == "mobile_invalid_ref_cleanup":
        mapping = {
            "mobile_ref_cleanup_start": "准备扫描",
            "mobile_ref_cleanup_scope": "处理分区",
        }
        return mapping.get(key, key or "处理中")
    mapping = {
        "dedup_scan_start": "扫描候选",
        "dedup_category_start": "按品类分析",
        "dedup_anchor_start": "锚点分析",
        "dedup_model_event": "模型执行",
        "dedup_model_delta": "模型输出",
        "dedup_pair_result": "两两判定",
        "dedup_pair_error": "两两失败",
        "dedup_anchor_done": "锚点完成",
        "dedup_scan_done": "任务完成",
    }
    return mapping.get(key, key or "处理中")


def _product_workbench_progress_cursor(
    *,
    job_type: str,
    payload: dict[str, Any],
    prev_index: int | None,
    prev_total: int | None,
    prev_item_id: str | None,
    prev_item_name: str | None,
) -> tuple[int | None, int | None, str | None, str | None]:
    if job_type == "route_mapping_build":
        index_value = _safe_positive_int(payload.get("index"), fallback=prev_index or 0)
        total_value = _safe_positive_int(payload.get("total"), fallback=prev_total or 0)
        product_id = str(payload.get("product_id") or prev_item_id or "").strip() or None
        category = str(payload.get("category") or prev_item_name or "").strip() or None
        return (
            index_value if index_value > 0 else None,
            total_value if total_value > 0 else None,
            product_id,
            category,
        )
    if job_type == "product_analysis_build":
        index_value = _safe_positive_int(payload.get("index"), fallback=prev_index or 0)
        total_value = _safe_positive_int(payload.get("total"), fallback=prev_total or 0)
        product_id = str(payload.get("product_id") or prev_item_id or "").strip() or None
        category = str(payload.get("category") or prev_item_name or "").strip() or None
        return (
            index_value if index_value > 0 else None,
            total_value if total_value > 0 else None,
            product_id,
            category,
        )
    if job_type == "selection_result_build":
        index_value = _safe_positive_int(payload.get("index"), fallback=prev_index or 0)
        total_value = _safe_positive_int(payload.get("total"), fallback=prev_total or 0)
        answers_hash = str(payload.get("answers_hash") or prev_item_id or "").strip() or None
        category = str(payload.get("category") or prev_item_name or "").strip() or None
        return (
            index_value if index_value > 0 else None,
            total_value if total_value > 0 else None,
            answers_hash,
            category,
        )
    if job_type == "product_batch_delete":
        index_value = _safe_positive_int(payload.get("index"), fallback=prev_index or 0)
        total_value = _safe_positive_int(payload.get("total"), fallback=prev_total or 0)
        product_id = str(payload.get("product_id") or prev_item_id or "").strip() or None
        label = str(payload.get("text") or prev_item_name or "").strip() or None
        return (
            index_value if index_value > 0 else None,
            total_value if total_value > 0 else None,
            product_id,
            label,
        )
    if job_type == "ingredient_batch_delete":
        index_value = _safe_positive_int(payload.get("index"), fallback=prev_index or 0)
        total_value = _safe_positive_int(payload.get("total"), fallback=prev_total or 0)
        ingredient_id = str(payload.get("ingredient_id") or prev_item_id or "").strip() or None
        label = str(payload.get("text") or prev_item_name or "").strip() or None
        return (
            index_value if index_value > 0 else None,
            total_value if total_value > 0 else None,
            ingredient_id,
            label,
        )
    if job_type == "orphan_storage_cleanup":
        index_value = _safe_positive_int(payload.get("index"), fallback=prev_index or 0)
        total_value = _safe_positive_int(payload.get("total"), fallback=prev_total or 0)
        step = str(payload.get("step") or prev_item_id or "").strip() or None
        label = str(payload.get("text") or prev_item_name or "").strip() or None
        return (
            index_value if index_value > 0 else None,
            total_value if total_value > 0 else None,
            step,
            label,
        )
    if job_type == "mobile_invalid_ref_cleanup":
        index_value = _safe_positive_int(payload.get("index"), fallback=prev_index or 0)
        total_value = _safe_positive_int(payload.get("total"), fallback=prev_total or 0)
        step = str(payload.get("step") or prev_item_id or "").strip() or None
        label = str(payload.get("text") or prev_item_name or "").strip() or None
        return (
            index_value if index_value > 0 else None,
            total_value if total_value > 0 else None,
            step,
            label,
        )
    index_value = _safe_positive_int(payload.get("anchor_index"), fallback=prev_index or 0)
    total_value = _safe_positive_int(payload.get("anchor_total"), fallback=prev_total or 0)
    anchor_id = str(payload.get("anchor_id") or prev_item_id or "").strip() or None
    category = str(payload.get("category") or prev_item_name or "").strip() or None
    return (
        index_value if index_value > 0 else None,
        total_value if total_value > 0 else None,
        anchor_id,
        category,
    )


def _merge_product_workbench_counters(
    *,
    job_type: str,
    counters: dict[str, Any],
    payload: dict[str, Any],
) -> None:
    def set_counter(name: str, value: Any) -> None:
        counters[name] = max(0, int(value))

    def inc_counter(name: str, delta: int = 1) -> None:
        prev = _safe_positive_int(counters.get(name), fallback=0)
        counters[name] = prev + max(0, int(delta))

    step = str(payload.get("step") or "").strip().lower()
    if job_type == "route_mapping_build":
        if "scanned_products" in payload:
            set_counter("scanned_products", _safe_positive_int(payload.get("scanned_products"), fallback=0))
        if step == "route_mapping_done":
            status = str(payload.get("status") or "").strip().lower()
            if status in {"created", "updated", "skipped", "failed"}:
                inc_counter(status)
            if status in {"created", "updated"}:
                inc_counter("submitted_to_model")
        elif step == "route_mapping_skip":
            inc_counter("skipped")
        elif step == "route_mapping_error":
            inc_counter("failed")
        for key in ("submitted_to_model", "created", "updated", "skipped", "failed"):
            if key in payload:
                set_counter(key, _safe_positive_int(payload.get(key), fallback=0))
        return
    if job_type == "product_analysis_build":
        if "scanned_products" in payload:
            set_counter("scanned_products", _safe_positive_int(payload.get("scanned_products"), fallback=0))
        if step == "product_analysis_done":
            status = str(payload.get("status") or "").strip().lower()
            if status in {"created", "updated", "skipped", "failed"}:
                inc_counter(status)
            if status in {"created", "updated"}:
                inc_counter("submitted_to_model")
        elif step == "product_analysis_skip":
            inc_counter("skipped")
        elif step == "product_analysis_error":
            inc_counter("failed")
        for key in ("submitted_to_model", "created", "updated", "skipped", "failed"):
            if key in payload:
                set_counter(key, _safe_positive_int(payload.get(key), fallback=0))
        return
    if job_type == "selection_result_build":
        if "scanned_products" in payload:
            set_counter("scanned_products", _safe_positive_int(payload.get("scanned_products"), fallback=0))
        if step == "selection_result_done":
            status = str(payload.get("status") or "").strip().lower()
            if status in {"created", "updated", "skipped", "failed"}:
                inc_counter(status)
            if status in {"created", "updated"}:
                inc_counter("submitted_to_model")
        elif step == "selection_result_skip":
            inc_counter("skipped")
        elif step == "selection_result_error":
            inc_counter("failed")
        for key in ("submitted_to_model", "created", "updated", "skipped", "failed"):
            if key in payload:
                set_counter(key, _safe_positive_int(payload.get(key), fallback=0))
        return
    if job_type == "product_batch_delete":
        if "scanned_products" in payload:
            set_counter("scanned_products", _safe_positive_int(payload.get("scanned_products"), fallback=0))
        if step == "product_delete_done":
            inc_counter("deleted")
        elif step == "product_delete_skip":
            inc_counter("skipped")
        elif step == "product_delete_missing":
            inc_counter("missing")
        deleted_ids_raw = payload.get("deleted_ids")
        if isinstance(deleted_ids_raw, list):
            set_counter("deleted", len(deleted_ids_raw))
        elif "deleted" in payload:
            set_counter("deleted", _safe_positive_int(payload.get("deleted"), fallback=0))
        skipped_ids_raw = payload.get("skipped_ids")
        if isinstance(skipped_ids_raw, list):
            set_counter("skipped", len(skipped_ids_raw))
        missing_ids_raw = payload.get("missing_ids")
        if isinstance(missing_ids_raw, list):
            set_counter("missing", len(missing_ids_raw))
        elif "missing" in payload:
            set_counter("missing", _safe_positive_int(payload.get("missing"), fallback=0))
        for key in ("removed_files", "removed_dirs"):
            if key in payload:
                set_counter(key, _safe_positive_int(payload.get(key), fallback=0))
        return
    if job_type == "ingredient_batch_delete":
        if step == "ingredient_delete_done":
            inc_counter("deleted")
        elif step == "ingredient_delete_missing":
            inc_counter("missing")
        elif step == "ingredient_delete_error":
            inc_counter("failed")
        deleted_ids_raw = payload.get("deleted_ids")
        if isinstance(deleted_ids_raw, list):
            set_counter("deleted", len(deleted_ids_raw))
        missing_ids_raw = payload.get("missing_ids")
        if isinstance(missing_ids_raw, list):
            set_counter("missing", len(missing_ids_raw))
        failed_items_raw = payload.get("failed_items")
        if isinstance(failed_items_raw, list):
            set_counter("failed", len(failed_items_raw))
        for key in ("removed_files", "removed_dirs"):
            if key in payload:
                set_counter(key, _safe_positive_int(payload.get(key), fallback=0))
        return
    if job_type == "orphan_storage_cleanup":
        images_raw = payload.get("images")
        if isinstance(images_raw, dict):
            for field in ("scanned_images", "orphan_images", "deleted_images"):
                if field in images_raw:
                    set_counter(field, _safe_positive_int(images_raw.get(field), fallback=0))
        runs_raw = payload.get("runs")
        if isinstance(runs_raw, dict):
            for field in ("scanned_runs", "orphan_runs", "deleted_runs"):
                if field in runs_raw:
                    set_counter(field, _safe_positive_int(runs_raw.get(field), fallback=0))
        return
    if job_type == "mobile_invalid_ref_cleanup":
        if "total_invalid" in payload:
            set_counter("invalid", _safe_positive_int(payload.get("total_invalid"), fallback=0))
        if "total_repaired" in payload:
            set_counter("repaired", _safe_positive_int(payload.get("total_repaired"), fallback=0))
        return

    if "scanned_products" in payload:
        set_counter("scanned_products", _safe_positive_int(payload.get("scanned_products"), fallback=0))
    if step in {"dedup_pair_result", "dedup_pair_error"}:
        inc_counter("compared_pairs")
    if step == "dedup_pair_error":
        inc_counter("failed")
    if "suggestions" in payload:
        suggestions_raw = payload.get("suggestions")
        if isinstance(suggestions_raw, list):
            set_counter("suggestions", len(suggestions_raw))
        else:
            set_counter("suggestions", _safe_positive_int(suggestions_raw, fallback=0))
    if "failures" in payload:
        failures_raw = payload.get("failures")
        if isinstance(failures_raw, list):
            set_counter("failed", len(failures_raw))
        else:
            set_counter("failed", _safe_positive_int(failures_raw, fallback=0))


def _product_workbench_progress_percent(
    *,
    job_type: str,
    current: int,
    step: str,
    index: int | None,
    total: int | None,
) -> int:
    value = max(0, min(100, int(current)))
    if step in {"queued", "prepare"}:
        return max(value, 1)
    if job_type == "route_mapping_build":
        if step == "route_mapping_build_start":
            return max(value, 5)
        if step in {"route_mapping_start", "route_mapping_done", "route_mapping_skip", "route_mapping_error", "route_mapping_model_step", "route_mapping_model_delta"}:
            if index is not None and total is not None and total > 0:
                computed = 10 + int((max(0, min(total, index)) / total) * 85)
                return max(value, min(95, computed))
            return max(value, 10)
        if step in {"route_mapping_build_done", "done"}:
            return 100
        return value
    if job_type == "product_analysis_build":
        if step == "product_analysis_build_start":
            return max(value, 5)
        if step in {"product_analysis_start", "product_analysis_done", "product_analysis_skip", "product_analysis_error", "product_analysis_model_step", "product_analysis_model_delta"}:
            if index is not None and total is not None and total > 0:
                computed = 10 + int((max(0, min(total, index)) / total) * 85)
                return max(value, min(95, computed))
            return max(value, 10)
        if step in {"product_analysis_build_done", "done"}:
            return 100
        return value
    if job_type == "selection_result_build":
        if step == "selection_result_build_start":
            return max(value, 5)
        if step in {"selection_result_start", "selection_result_done", "selection_result_skip", "selection_result_error", "selection_result_model_step", "selection_result_model_delta"}:
            if index is not None and total is not None and total > 0:
                computed = 10 + int((max(0, min(total, index)) / total) * 85)
                return max(value, min(95, computed))
            return max(value, 10)
        if step in {"selection_result_build_done", "done"}:
            return 100
        return value
    if job_type == "product_batch_delete":
        if step == "product_delete_start":
            return max(value, 5)
        if step == "product_delete_mobile_refs_cleanup":
            return max(value, 96)
        if step in {"product_delete_item", "product_delete_done", "product_delete_skip", "product_delete_missing"}:
            if index is not None and total is not None and total > 0:
                computed = 10 + int((max(0, min(total, index)) / total) * 82)
                return max(value, min(95, computed))
            return max(value, 10)
        if step == "done":
            return 100
        return value
    if job_type == "ingredient_batch_delete":
        if step == "ingredient_delete_start":
            return max(value, 5)
        if step in {"ingredient_delete_item", "ingredient_delete_done", "ingredient_delete_missing", "ingredient_delete_error"}:
            if index is not None and total is not None and total > 0:
                computed = 10 + int((max(0, min(total, index)) / total) * 85)
                return max(value, min(95, computed))
            return max(value, 10)
        if step == "done":
            return 100
        return value
    if job_type == "orphan_storage_cleanup":
        if step == "orphan_cleanup_prepare":
            return max(value, 10)
        if step == "orphan_cleanup_scan":
            return max(value, 60)
        if step == "done":
            return 100
        return value
    if job_type == "mobile_invalid_ref_cleanup":
        if step == "mobile_ref_cleanup_start":
            return max(value, 5)
        if step == "mobile_ref_cleanup_scope":
            if index is not None and total is not None and total > 0:
                computed = 15 + int((max(0, min(total, index)) / total) * 80)
                return max(value, min(95, computed))
            return max(value, 15)
        if step == "done":
            return 100
        return value
    if step == "dedup_scan_start":
        return max(value, 5)
    if step in {"dedup_anchor_start", "dedup_pair_result", "dedup_pair_error", "dedup_model_event", "dedup_model_delta", "dedup_anchor_done"}:
        if index is not None and total is not None and total > 0:
            computed = 10 + int((max(0, min(total, index)) / total) * 85)
            return max(value, min(95, computed))
        return max(value, 10)
    if step in {"dedup_scan_done", "done"}:
        return 100
    return value

def _build_product_route_mapping_impl(
    payload: ProductRouteMappingBuildRequest,
    db: Session,
    event_callback: Callable[[dict[str, Any]], None] | None,
    should_cancel: Callable[[], bool] | None = None,
) -> ProductRouteMappingBuildResponse:
    category = (payload.category or "").strip().lower()
    if category:
        if category not in VALID_CATEGORIES:
            raise HTTPException(status_code=400, detail=f"Invalid category: {category}.")
        if category not in ROUTE_MAPPING_SUPPORTED_CATEGORIES:
            raise HTTPException(
                status_code=400,
                detail=f"Route mapping does not support category '{category}'.",
            )
        target_categories = [category]
    else:
        target_categories = sorted(ROUTE_MAPPING_SUPPORTED_CATEGORIES)

    _ensure_product_route_mapping_index_table(db)
    prompt_versions = {
        cat: load_prompt(f"doubao.route_mapping_{cat}").version
        for cat in target_categories
    }

    rows = db.execute(
        select(ProductIndex)
        .where(ProductIndex.category.in_(target_categories))
        .order_by(ProductIndex.created_at.desc())
    ).scalars().all()

    scanned_products = len(rows)
    _emit_progress(
        event_callback,
        {
            "step": "route_mapping_build_start",
            "scanned_products": scanned_products,
            "categories": target_categories,
            "text": f"开始构建产品类型映射：扫描产品 {scanned_products} 条。",
        },
    )

    submitted_to_model = 0
    created = 0
    updated = 0
    skipped = 0
    failed = 0
    items: list[ProductRouteMappingBuildItem] = []
    failures: list[str] = []

    force_regenerate = bool(payload.force_regenerate)
    only_unmapped = bool(payload.only_unmapped)
    total = len(rows)

    def check_cancel() -> None:
        if should_cancel and should_cancel():
            raise ProductWorkbenchJobCancelledError("job cancelled by operator.")

    for idx, row in enumerate(rows, start=1):
        check_cancel()
        product_id = str(row.id)
        row_category = str(row.category or "").strip().lower()
        if row_category not in ROUTE_MAPPING_SUPPORTED_CATEGORIES:
            continue

        rec = db.get(ProductRouteMappingIndex, product_id)
        storage_path_existing = ""
        if rec:
            storage_path_existing = str(rec.storage_path or "").strip()
        if not storage_path_existing:
            storage_path_existing = product_route_mapping_rel_path(row_category, product_id)

        is_ready_existing = bool(
            rec
            and str(rec.status or "").strip().lower() == "ready"
            and str(rec.rules_version or "").strip() == MOBILE_RULES_VERSION
            and exists_rel_path(storage_path_existing)
        )

        if only_unmapped and is_ready_existing:
            skipped += 1
            items.append(
                ProductRouteMappingBuildItem(
                    product_id=product_id,
                    category=row_category,
                    status="skipped",
                    primary_route=_score_or_none(
                        route_key=str(rec.primary_route_key or ""),
                        route_title=str(rec.primary_route_title or ""),
                        confidence=int(rec.primary_confidence or 0),
                        reason="",
                    ),
                    secondary_route=_score_or_none(
                        route_key=str(rec.secondary_route_key or ""),
                        route_title=str(rec.secondary_route_title or ""),
                        confidence=int(rec.secondary_confidence or 0),
                        reason="",
                    ),
                    route_scores=_safe_route_score_models(rec.scores_json),
                    storage_path=storage_path_existing,
                    model=rec.model,
                    error=None,
                )
            )
            _emit_progress(
                event_callback,
                {
                    "step": "route_mapping_skip",
                    "product_id": product_id,
                    "category": row_category,
                    "index": idx,
                    "total": total,
                    "text": f"[{idx}/{total}] 跳过（已有映射）：{row_category} / {product_id}",
                },
            )
            continue

        try:
            check_cancel()
            if not exists_rel_path(row.json_path):
                raise ValueError(f"product json missing: {row.json_path}")
            doc = load_json(row.json_path)
            context = _build_route_mapping_product_context(row=row, doc=doc)
            fingerprint = _build_route_mapping_fingerprint(context)
        except ProductWorkbenchJobCancelledError:
            raise
        except Exception as e:
            failed += 1
            message = f"{product_id} ({row_category}): invalid product context | {e}"
            failures.append(message)
            now = now_iso()
            rec = _ensure_route_mapping_record(rec=rec, product_id=product_id, category=row_category)
            rec.rules_version = MOBILE_RULES_VERSION
            rec.fingerprint = rec.fingerprint or _fallback_route_mapping_fingerprint(row_category, product_id)
            rec.status = "failed"
            rec.prompt_key = f"doubao.route_mapping_{row_category}"
            rec.prompt_version = prompt_versions.get(row_category)
            rec.last_error = str(e)
            rec.last_generated_at = now
            db.add(rec)
            db.commit()
            items.append(
                ProductRouteMappingBuildItem(
                    product_id=product_id,
                    category=row_category,
                    status="failed",
                    primary_route=None,
                    secondary_route=None,
                    route_scores=[],
                    storage_path=None,
                    model=None,
                    error=f"invalid product context: {e}",
                )
            )
            _emit_progress(
                event_callback,
                {
                    "step": "route_mapping_error",
                    "product_id": product_id,
                    "category": row_category,
                    "index": idx,
                    "total": total,
                    "text": f"[{idx}/{total}] 失败：{row_category} / {product_id} | {e}",
                },
            )
            continue

        if is_ready_existing and not force_regenerate and str(rec.fingerprint or "").strip() == fingerprint:
            skipped += 1
            items.append(
                ProductRouteMappingBuildItem(
                    product_id=product_id,
                    category=row_category,
                    status="skipped",
                    primary_route=_score_or_none(
                        route_key=str(rec.primary_route_key or ""),
                        route_title=str(rec.primary_route_title or ""),
                        confidence=int(rec.primary_confidence or 0),
                        reason="",
                    ),
                    secondary_route=_score_or_none(
                        route_key=str(rec.secondary_route_key or ""),
                        route_title=str(rec.secondary_route_title or ""),
                        confidence=int(rec.secondary_confidence or 0),
                        reason="",
                    ),
                    route_scores=_safe_route_score_models(rec.scores_json),
                    storage_path=storage_path_existing,
                    model=rec.model,
                    error=None,
                )
            )
            _emit_progress(
                event_callback,
                {
                    "step": "route_mapping_skip",
                    "product_id": product_id,
                    "category": row_category,
                    "index": idx,
                    "total": total,
                    "text": f"[{idx}/{total}] 跳过（指纹未变化）：{row_category} / {product_id}",
                },
            )
            continue

        submitted_to_model += 1
        _emit_progress(
            event_callback,
            {
                "step": "route_mapping_start",
                "product_id": product_id,
                "category": row_category,
                "index": idx,
                "total": total,
                "text": f"[{idx}/{total}] 开始映射：{row_category} / {product_id}",
            },
        )

        capability = f"doubao.route_mapping_{row_category}"
        prompt_key = capability
        prompt_version = prompt_versions[row_category]
        try:
            check_cancel()
            ai_result = run_capability_now(
                capability=capability,
                input_payload={"product_context_json": json.dumps(context, ensure_ascii=False)},
                trace_id=product_id,
                event_callback=lambda event, _pid=product_id, _cat=row_category: _forward_route_mapping_model_event(
                    event_callback=event_callback,
                    product_id=_pid,
                    category=_cat,
                    payload=event,
                ),
            )

            generated_at = now_iso()
            profile_doc = {
                "product_id": product_id,
                "category": row_category,
                "rules_version": str(ai_result.get("rules_version") or MOBILE_RULES_VERSION),
                "fingerprint": fingerprint,
                "generated_at": generated_at,
                "prompt_key": prompt_key,
                "prompt_version": prompt_version,
                "model": str(ai_result.get("model") or "").strip(),
                "primary_route": ai_result.get("primary_route") or {},
                "secondary_route": ai_result.get("secondary_route") or {},
                "route_scores": ai_result.get("route_scores") or [],
                "evidence": ai_result.get("evidence") or {"positive": [], "counter": []},
                "confidence_reason": str(ai_result.get("confidence_reason") or "").strip(),
                "needs_review": bool(ai_result.get("needs_review")),
                "analysis_text": str(ai_result.get("analysis_text") or "").strip(),
            }
            result_item = _to_product_route_mapping_result(doc=profile_doc, storage_path="")
            storage_path = save_product_route_mapping(row_category, product_id, profile_doc)
            result_item = result_item.model_copy(update={"storage_path": storage_path})

            existed_before = rec is not None
            status = "updated" if existed_before else "created"
            if status == "updated":
                updated += 1
            else:
                created += 1

            rec = _ensure_route_mapping_record(rec=rec, product_id=product_id, category=row_category)
            rec.rules_version = result_item.rules_version
            rec.fingerprint = result_item.fingerprint
            rec.status = "ready"
            rec.storage_path = storage_path
            rec.primary_route_key = result_item.primary_route.route_key
            rec.primary_route_title = result_item.primary_route.route_title
            rec.primary_confidence = int(result_item.primary_route.confidence)
            rec.secondary_route_key = result_item.secondary_route.route_key
            rec.secondary_route_title = result_item.secondary_route.route_title
            rec.secondary_confidence = int(result_item.secondary_route.confidence)
            rec.scores_json = json.dumps([score.model_dump() for score in result_item.route_scores], ensure_ascii=False)
            rec.needs_review = bool(result_item.needs_review)
            rec.prompt_key = result_item.prompt_key
            rec.prompt_version = result_item.prompt_version
            rec.model = result_item.model
            rec.last_generated_at = result_item.generated_at
            rec.last_error = None
            db.add(rec)
            db.commit()

            items.append(
                ProductRouteMappingBuildItem(
                    product_id=product_id,
                    category=row_category,
                    status=status,
                    primary_route=result_item.primary_route,
                    secondary_route=result_item.secondary_route,
                    route_scores=result_item.route_scores,
                    storage_path=storage_path,
                    model=result_item.model,
                    error=None,
                )
            )
            _emit_progress(
                event_callback,
                {
                    "step": "route_mapping_done",
                    "product_id": product_id,
                    "category": row_category,
                    "index": idx,
                    "total": total,
                    "status": status,
                    "text": f"[{idx}/{total}] 完成：{row_category} / {product_id}（{status}）",
                },
            )
        except ProductWorkbenchJobCancelledError:
            raise
        except Exception as e:
            failed += 1
            message = f"{product_id} ({row_category}): {e}"
            failures.append(message)
            rec = _ensure_route_mapping_record(rec=rec, product_id=product_id, category=row_category)
            rec.rules_version = MOBILE_RULES_VERSION
            rec.fingerprint = fingerprint or _fallback_route_mapping_fingerprint(row_category, product_id)
            rec.status = "failed"
            rec.prompt_key = prompt_key
            rec.prompt_version = prompt_version
            rec.last_error = str(e)
            rec.last_generated_at = now_iso()
            db.add(rec)
            db.commit()
            items.append(
                ProductRouteMappingBuildItem(
                    product_id=product_id,
                    category=row_category,
                    status="failed",
                    primary_route=None,
                    secondary_route=None,
                    route_scores=[],
                    storage_path=None,
                    model=None,
                    error=str(e),
                )
            )
            _emit_progress(
                event_callback,
                {
                    "step": "route_mapping_error",
                    "product_id": product_id,
                    "category": row_category,
                    "index": idx,
                    "total": total,
                    "text": f"[{idx}/{total}] 失败：{row_category} / {product_id} | {e}",
                },
            )

    status = "ok" if failed == 0 else "partial_failed"
    _emit_progress(
        event_callback,
        {
            "step": "route_mapping_build_done",
            "status": status,
            "scanned_products": scanned_products,
            "submitted_to_model": submitted_to_model,
            "created": created,
            "updated": updated,
            "skipped": skipped,
            "failed": failed,
            "text": (
                "产品类型映射构建完成："
                f"submitted={submitted_to_model}, created={created}, "
                f"updated={updated}, skipped={skipped}, failed={failed}"
            ),
        },
    )
    return ProductRouteMappingBuildResponse(
        status=status,
        scanned_products=scanned_products,
        submitted_to_model=submitted_to_model,
        created=created,
        updated=updated,
        skipped=skipped,
        failed=failed,
        items=items,
        failures=failures[:200],
    )


def _to_product_route_mapping_result(doc: dict[str, Any], storage_path: str) -> ProductRouteMappingResult:
    if not isinstance(doc, dict):
        raise ValueError("route mapping document is not an object.")
    product_id = _required_text_field(doc, "product_id")
    category = _required_text_field(doc, "category").lower()
    if category not in ROUTE_MAPPING_SUPPORTED_CATEGORIES:
        raise ValueError(f"route mapping category unsupported: {category}")

    rules_version = _required_text_field(doc, "rules_version")
    fingerprint = _required_text_field(doc, "fingerprint")
    generated_at = _required_text_field(doc, "generated_at")
    prompt_key = _required_text_field(doc, "prompt_key")
    prompt_version = _required_text_field(doc, "prompt_version")
    model = _required_text_field(doc, "model")
    confidence_reason = _required_text_field(doc, "confidence_reason")

    needs_review_raw = doc.get("needs_review")
    if not isinstance(needs_review_raw, bool):
        raise ValueError("needs_review must be boolean.")

    primary_route = _parse_route_mapping_score(doc.get("primary_route"), "primary_route")
    secondary_route = _parse_route_mapping_score(doc.get("secondary_route"), "secondary_route")

    route_scores_raw = doc.get("route_scores")
    if not isinstance(route_scores_raw, list) or not route_scores_raw:
        raise ValueError("route_scores must be a non-empty list.")
    route_scores = [_parse_route_mapping_score(item, f"route_scores[{idx}]") for idx, item in enumerate(route_scores_raw)]

    evidence = _parse_route_mapping_evidence(doc.get("evidence"))
    analysis_text = str(doc.get("analysis_text") or "").strip()

    out_storage_path = str(storage_path or "").strip()
    return ProductRouteMappingResult(
        product_id=product_id,
        category=category,
        rules_version=rules_version,
        fingerprint=fingerprint,
        generated_at=generated_at,
        prompt_key=prompt_key,
        prompt_version=prompt_version,
        model=model,
        primary_route=primary_route,
        secondary_route=secondary_route,
        route_scores=route_scores,
        evidence=evidence,
        confidence_reason=confidence_reason,
        needs_review=bool(needs_review_raw),
        analysis_text=analysis_text,
        storage_path=out_storage_path,
    )


def _parse_route_mapping_score(value: Any, field_name: str) -> ProductRouteMappingScore:
    if not isinstance(value, dict):
        raise ValueError(f"{field_name} must be an object.")
    route_key = str(value.get("route_key") or "").strip()
    route_title = str(value.get("route_title") or "").strip()
    reason = str(value.get("reason") or "").strip()
    if not route_key:
        raise ValueError(f"{field_name}.route_key is required.")
    if not route_title:
        raise ValueError(f"{field_name}.route_title is required.")
    try:
        confidence = int(value.get("confidence"))
    except Exception as e:
        raise ValueError(f"{field_name}.confidence must be integer.") from e
    confidence = max(0, min(100, confidence))
    return ProductRouteMappingScore(
        route_key=route_key,
        route_title=route_title,
        confidence=confidence,
        reason=reason,
    )


def _parse_route_mapping_evidence(value: Any) -> dict[str, list[dict[str, Any]]]:
    if not isinstance(value, dict):
        return {"positive": [], "counter": []}

    def normalize_items(key: str) -> list[dict[str, Any]]:
        rows = value.get(key)
        if not isinstance(rows, list):
            return []
        out: list[dict[str, Any]] = []
        for idx, item in enumerate(rows):
            if not isinstance(item, dict):
                continue
            try:
                rank = int(item.get("rank"))
            except Exception:
                rank = 0
            out.append(
                {
                    "ingredient_name_cn": str(item.get("ingredient_name_cn") or "").strip(),
                    "ingredient_name_en": str(item.get("ingredient_name_en") or "").strip(),
                    "rank": max(0, rank),
                    "impact": str(item.get("impact") or "").strip(),
                }
            )
            if idx >= 30:
                break
        return out

    return {"positive": normalize_items("positive"), "counter": normalize_items("counter")}


def _safe_route_score_models(scores_json: str | None) -> list[ProductRouteMappingScore]:
    raw = str(scores_json or "").strip()
    if not raw:
        return []
    try:
        parsed = json.loads(raw)
    except Exception:
        return []
    if not isinstance(parsed, list):
        return []
    out: list[ProductRouteMappingScore] = []
    for idx, item in enumerate(parsed):
        try:
            out.append(_parse_route_mapping_score(item, f"scores_json[{idx}]"))
        except Exception:
            continue
    return out


def _score_or_none(
    *,
    route_key: str,
    route_title: str,
    confidence: int,
    reason: str,
) -> ProductRouteMappingScore | None:
    if not route_key.strip() or not route_title.strip():
        return None
    return ProductRouteMappingScore(
        route_key=route_key.strip(),
        route_title=route_title.strip(),
        confidence=max(0, min(100, int(confidence))),
        reason=reason,
    )


def _forward_route_mapping_model_event(
    event_callback: Callable[[dict[str, Any]], None] | None,
    product_id: str,
    category: str,
    payload: dict[str, Any],
) -> None:
    event_type = str(payload.get("type") or "").strip()
    if event_type == "delta":
        delta = str(payload.get("delta") or "")
        if not delta:
            return
        _emit_progress(
            event_callback,
            {
                "step": "route_mapping_model_delta",
                "product_id": product_id,
                "category": category,
                "delta": delta,
                "text": delta,
                "stream_kind": str(payload.get("stream_kind") or ""),
            },
        )
        return

    if event_type != "step":
        return
    message = str(payload.get("message") or "").strip()
    if not message:
        return
    _emit_progress(
        event_callback,
        {
            "step": "route_mapping_model_step",
            "product_id": product_id,
            "category": category,
            "text": f"{product_id} | {message}",
        },
    )


def _ensure_route_mapping_record(
    *,
    rec: ProductRouteMappingIndex | None,
    product_id: str,
    category: str,
) -> ProductRouteMappingIndex:
    if rec is not None:
        rec.category = category
        return rec
    return ProductRouteMappingIndex(
        product_id=product_id,
        category=category,
        rules_version=MOBILE_RULES_VERSION,
        fingerprint=_fallback_route_mapping_fingerprint(category, product_id),
        status="pending",
        storage_path=None,
        primary_route_key="",
        primary_route_title="",
        primary_confidence=0,
        secondary_route_key=None,
        secondary_route_title=None,
        secondary_confidence=None,
        scores_json="[]",
        needs_review=False,
        prompt_key=None,
        prompt_version=None,
        model=None,
        last_generated_at=None,
        last_error=None,
    )


def _build_product_analysis_impl(
    payload: ProductAnalysisBuildRequest,
    db: Session,
    event_callback: Callable[[dict[str, Any]], None] | None,
    should_cancel: Callable[[], bool] | None = None,
) -> ProductAnalysisBuildResponse:
    category = (payload.category or "").strip().lower()
    if category:
        if category not in VALID_CATEGORIES:
            raise HTTPException(status_code=400, detail=f"Invalid category: {category}.")
        if category not in PRODUCT_PROFILE_SUPPORTED_CATEGORIES:
            raise HTTPException(
                status_code=400,
                detail=f"Product analysis does not support category '{category}'.",
            )
        target_categories = [category]
    else:
        target_categories = sorted(PRODUCT_PROFILE_SUPPORTED_CATEGORIES)

    _ensure_product_route_mapping_index_table(db)
    _ensure_product_analysis_index_table(db)
    _ensure_ingredient_index_table(db)
    _ensure_ingredient_alias_tables(db)
    prompt_versions = {
        cat: load_prompt(f"doubao.product_profile_{cat}").version
        for cat in target_categories
    }

    rows = db.execute(
        select(ProductIndex)
        .where(ProductIndex.category.in_(target_categories))
        .order_by(ProductIndex.created_at.desc())
    ).scalars().all()

    scanned_products = len(rows)
    _emit_progress(
        event_callback,
        {
            "step": "product_analysis_build_start",
            "scanned_products": scanned_products,
            "categories": target_categories,
            "text": f"开始构建产品增强分析：扫描产品 {scanned_products} 条。",
        },
    )

    submitted_to_model = 0
    created = 0
    updated = 0
    skipped = 0
    failed = 0
    items: list[ProductAnalysisBuildItem] = []
    failures: list[str] = []

    force_regenerate = bool(payload.force_regenerate)
    only_unanalyzed = bool(payload.only_unanalyzed)
    total = len(rows)

    def check_cancel() -> None:
        if should_cancel and should_cancel():
            raise ProductWorkbenchJobCancelledError("job cancelled by operator.")

    for idx, row in enumerate(rows, start=1):
        check_cancel()
        product_id = str(row.id or "").strip()
        row_category = str(row.category or "").strip().lower()
        if row_category not in PRODUCT_PROFILE_SUPPORTED_CATEGORIES:
            continue

        rec = db.get(ProductAnalysisIndex, product_id)
        storage_path_existing = str(rec.storage_path or "").strip() if rec else ""
        if not storage_path_existing:
            storage_path_existing = product_analysis_rel_path(row_category, product_id)
        is_ready_existing = bool(
            rec
            and str(rec.status or "").strip().lower() == "ready"
            and str(rec.rules_version or "").strip() == MOBILE_RULES_VERSION
            and exists_rel_path(storage_path_existing)
        )

        if only_unanalyzed and is_ready_existing:
            skipped += 1
            items.append(
                ProductAnalysisBuildItem(
                    product_id=product_id,
                    category=row_category,
                    status="skipped",
                    route_key=str(rec.route_key or "").strip() or None,
                    route_title=str(rec.route_title or "").strip() or None,
                    headline=str(rec.headline or "").strip() or None,
                    subtype_fit_verdict=str(rec.subtype_fit_verdict or "").strip() or None,
                    confidence=int(rec.confidence or 0),
                    needs_review=bool(rec.needs_review),
                    storage_path=storage_path_existing,
                    model=rec.model,
                    error=None,
                )
            )
            _emit_progress(
                event_callback,
                {
                    "step": "product_analysis_skip",
                    "product_id": product_id,
                    "category": row_category,
                    "index": idx,
                    "total": total,
                    "text": f"[{idx}/{total}] 跳过（已有分析）：{row_category} / {product_id}",
                },
            )
            continue

        try:
            check_cancel()
            if not exists_rel_path(row.json_path):
                raise ValueError(f"product json missing: {row.json_path}")
            doc = load_json(row.json_path)
            context = _build_product_analysis_context(db=db, row=row, doc=doc)
            fingerprint = _build_product_analysis_fingerprint(context)
        except ProductWorkbenchJobCancelledError:
            raise
        except Exception as e:
            failed += 1
            message = f"{product_id} ({row_category}): invalid product analysis context | {e}"
            failures.append(message)
            now = now_iso()
            rec = _ensure_product_analysis_record(rec=rec, product_id=product_id, category=row_category)
            rec.rules_version = MOBILE_RULES_VERSION
            rec.fingerprint = rec.fingerprint or _fallback_product_analysis_fingerprint(row_category, product_id)
            rec.status = "failed"
            rec.prompt_key = f"doubao.product_profile_{row_category}"
            rec.prompt_version = prompt_versions.get(row_category)
            rec.last_error = str(e)
            rec.last_generated_at = now
            db.add(rec)
            items.append(
                ProductAnalysisBuildItem(
                    product_id=product_id,
                    category=row_category,
                    status="failed",
                    error=f"invalid product analysis context: {e}",
                )
            )
            _emit_progress(
                event_callback,
                {
                    "step": "product_analysis_error",
                    "product_id": product_id,
                    "category": row_category,
                    "index": idx,
                    "total": total,
                    "text": f"[{idx}/{total}] 失败：{row_category} / {product_id} | {e}",
                },
            )
            continue

        if is_ready_existing and not force_regenerate and str(rec.fingerprint or "").strip() == fingerprint:
            skipped += 1
            items.append(
                ProductAnalysisBuildItem(
                    product_id=product_id,
                    category=row_category,
                    status="skipped",
                    route_key=str(rec.route_key or "").strip() or None,
                    route_title=str(rec.route_title or "").strip() or None,
                    headline=str(rec.headline or "").strip() or None,
                    subtype_fit_verdict=str(rec.subtype_fit_verdict or "").strip() or None,
                    confidence=int(rec.confidence or 0),
                    needs_review=bool(rec.needs_review),
                    storage_path=storage_path_existing,
                    model=rec.model,
                    error=None,
                )
            )
            _emit_progress(
                event_callback,
                {
                    "step": "product_analysis_skip",
                    "product_id": product_id,
                    "category": row_category,
                    "index": idx,
                    "total": total,
                    "text": f"[{idx}/{total}] 跳过（指纹未变化）：{row_category} / {product_id}",
                },
            )
            continue

        submitted_to_model += 1
        _emit_progress(
            event_callback,
            {
                "step": "product_analysis_start",
                "product_id": product_id,
                "category": row_category,
                "index": idx,
                "total": total,
                "text": f"[{idx}/{total}] 开始分析：{row_category} / {product_id}",
            },
        )

        capability = f"doubao.product_profile_{row_category}"
        prompt_key = capability
        prompt_version = prompt_versions[row_category]
        try:
            check_cancel()
            ai_result = run_capability_now(
                capability=capability,
                input_payload={"product_analysis_context_json": json.dumps(context, ensure_ascii=False)},
                trace_id=product_id,
                event_callback=lambda event, _pid=product_id, _cat=row_category: _forward_product_analysis_model_event(
                    event_callback=event_callback,
                    product_id=_pid,
                    category=_cat,
                    payload=event,
                ),
            )

            generated_at = now_iso()
            profile_payload = {
                key: value
                for key, value in ai_result.items()
                if key not in {"model", "artifact"}
            }
            profile_doc = {
                "product_id": product_id,
                "category": row_category,
                "rules_version": MOBILE_RULES_VERSION,
                "fingerprint": fingerprint,
                "generated_at": generated_at,
                "prompt_key": prompt_key,
                "prompt_version": prompt_version,
                "model": str(ai_result.get("model") or "").strip(),
                "profile": profile_payload,
            }
            record = _to_product_analysis_record(doc=profile_doc, storage_path="")
            storage_path = save_product_analysis(row_category, product_id, profile_doc)
            record = record.model_copy(update={"storage_path": storage_path})

            existed_before = rec is not None
            status = "updated" if existed_before else "created"
            if status == "updated":
                updated += 1
            else:
                created += 1

            rec = _ensure_product_analysis_record(rec=rec, product_id=product_id, category=row_category)
            rec.rules_version = record.rules_version
            rec.fingerprint = record.fingerprint
            rec.status = "ready"
            rec.storage_path = storage_path
            rec.route_key = record.profile.route_key
            rec.route_title = record.profile.route_title
            rec.headline = record.profile.headline
            rec.subtype_fit_verdict = record.profile.subtype_fit_verdict
            rec.confidence = int(record.profile.confidence)
            rec.needs_review = bool(record.profile.needs_review)
            rec.schema_version = record.profile.schema_version
            rec.prompt_key = record.prompt_key
            rec.prompt_version = record.prompt_version
            rec.model = record.model
            rec.last_generated_at = record.generated_at
            rec.last_error = None
            db.add(rec)

            items.append(
                ProductAnalysisBuildItem(
                    product_id=product_id,
                    category=row_category,
                    status=status,
                    route_key=record.profile.route_key,
                    route_title=record.profile.route_title,
                    headline=record.profile.headline,
                    subtype_fit_verdict=record.profile.subtype_fit_verdict,
                    confidence=int(record.profile.confidence),
                    needs_review=bool(record.profile.needs_review),
                    storage_path=storage_path,
                    model=record.model,
                    error=None,
                )
            )
            _emit_progress(
                event_callback,
                {
                    "step": "product_analysis_done",
                    "product_id": product_id,
                    "category": row_category,
                    "index": idx,
                    "total": total,
                    "status": status,
                    "text": f"[{idx}/{total}] 完成：{row_category} / {product_id}（{status}）",
                },
            )
        except ProductWorkbenchJobCancelledError:
            raise
        except Exception as e:
            failed += 1
            message = f"{product_id} ({row_category}): {e}"
            failures.append(message)
            rec = _ensure_product_analysis_record(rec=rec, product_id=product_id, category=row_category)
            rec.rules_version = MOBILE_RULES_VERSION
            rec.fingerprint = fingerprint or _fallback_product_analysis_fingerprint(row_category, product_id)
            rec.status = "failed"
            rec.prompt_key = prompt_key
            rec.prompt_version = prompt_version
            rec.last_error = str(e)
            rec.last_generated_at = now_iso()
            db.add(rec)
            items.append(
                ProductAnalysisBuildItem(
                    product_id=product_id,
                    category=row_category,
                    status="failed",
                    error=str(e),
                )
            )
            _emit_progress(
                event_callback,
                {
                    "step": "product_analysis_error",
                    "product_id": product_id,
                    "category": row_category,
                    "index": idx,
                    "total": total,
                    "text": f"[{idx}/{total}] 失败：{row_category} / {product_id} | {e}",
                },
            )

    db.commit()

    status = "ok" if failed == 0 else "partial_failed"
    _emit_progress(
        event_callback,
        {
            "step": "product_analysis_build_done",
            "status": status,
            "scanned_products": scanned_products,
            "submitted_to_model": submitted_to_model,
            "created": created,
            "updated": updated,
            "skipped": skipped,
            "failed": failed,
            "text": (
                "产品增强分析构建完成："
                f"submitted={submitted_to_model}, created={created}, "
                f"updated={updated}, skipped={skipped}, failed={failed}"
            ),
        },
    )
    return ProductAnalysisBuildResponse(
        status=status,
        scanned_products=scanned_products,
        submitted_to_model=submitted_to_model,
        created=created,
        updated=updated,
        skipped=skipped,
        failed=failed,
        items=items,
        failures=failures[:200],
    )


def _build_mobile_selection_results_impl(
    payload: MobileSelectionResultBuildRequest,
    db: Session,
    event_callback: Callable[[dict[str, Any]], None] | None,
    should_cancel: Callable[[], bool] | None = None,
) -> MobileSelectionResultBuildResponse:
    try:
        return build_mobile_selection_results(
            payload,
            db=db,
            event_callback=event_callback,
            should_cancel=should_cancel,
        )
    except SelectionResultBuildCancelledError:
        raise
    except HTTPException:
        raise
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


def _to_product_analysis_record(doc: dict[str, Any], storage_path: str) -> ProductAnalysisStoredResult:
    if not isinstance(doc, dict):
        raise ValueError("product analysis document is not an object.")
    out_storage_path = str(storage_path or "").strip()
    payload = dict(doc)
    payload["storage_path"] = out_storage_path
    record = ProductAnalysisStoredResult.model_validate(payload)
    if record.profile.category != record.category:
        raise ValueError("product analysis profile category mismatch.")
    if record.profile.route_key.strip() != record.profile.route_key:
        raise ValueError("product analysis profile.route_key contains invalid whitespace.")
    return record


def _forward_product_analysis_model_event(
    event_callback: Callable[[dict[str, Any]], None] | None,
    product_id: str,
    category: str,
    payload: dict[str, Any],
) -> None:
    event_type = str(payload.get("type") or "").strip()
    if event_type == "delta":
        delta = str(payload.get("delta") or "")
        if not delta:
            return
        _emit_progress(
            event_callback,
            {
                "step": "product_analysis_model_delta",
                "product_id": product_id,
                "category": category,
                "delta": delta,
                "text": delta,
                "stream_kind": str(payload.get("stream_kind") or ""),
            },
        )
        return
    if event_type != "step":
        return
    message = str(payload.get("message") or "").strip()
    if not message:
        return
    _emit_progress(
        event_callback,
        {
            "step": "product_analysis_model_step",
            "product_id": product_id,
            "category": category,
            "text": f"{product_id} | {message}",
        },
    )


def _ensure_product_analysis_record(
    *,
    rec: ProductAnalysisIndex | None,
    product_id: str,
    category: str,
) -> ProductAnalysisIndex:
    if rec is not None:
        rec.category = category
        return rec
    return ProductAnalysisIndex(
        product_id=product_id,
        category=category,
        rules_version=MOBILE_RULES_VERSION,
        fingerprint=_fallback_product_analysis_fingerprint(category, product_id),
        status="pending",
        storage_path=None,
        route_key="",
        route_title="",
        headline="",
        subtype_fit_verdict=None,
        confidence=0,
        needs_review=False,
        schema_version="",
        prompt_key=None,
        prompt_version=None,
        model=None,
        last_generated_at=None,
        last_error=None,
    )


def _fallback_product_analysis_fingerprint(category: str, product_id: str) -> str:
    raw = f"{category}:{product_id}:product-analysis:fallback"
    return hashlib.sha1(raw.encode("utf-8")).hexdigest()


def _build_product_analysis_context(*, db: Session, row: ProductIndex, doc: dict[str, Any]) -> dict[str, Any]:
    product_context = _build_route_mapping_product_context(row=row, doc=doc)
    category = str(product_context.get("category") or "").strip().lower()
    if category not in PRODUCT_PROFILE_SUPPORTED_CATEGORIES:
        raise ValueError(f"product analysis category unsupported: {category}")

    route_mapping = _load_ready_route_mapping_for_product(db=db, product_id=str(row.id), category=category)
    ingredients = product_context.get("ingredients")
    if not isinstance(ingredients, list):
        raise ValueError("product analysis ingredients missing.")

    matched_profiles = _match_ingredient_profiles_for_analysis(db=db, category=category, ingredients=ingredients)
    context = {
        "product": {
            "product_id": str(row.id),
            "category": category,
            "brand": str(product_context.get("brand") or "").strip(),
            "name": str(product_context.get("name") or "").strip(),
            "one_sentence": str(product_context.get("one_sentence") or "").strip(),
        },
        "route_mapping": {
            "primary_route_key": route_mapping.primary_route.route_key,
            "primary_route_title": route_mapping.primary_route.route_title,
            "primary_confidence": int(route_mapping.primary_route.confidence),
            "secondary_route_key": route_mapping.secondary_route.route_key,
            "secondary_route_title": route_mapping.secondary_route.route_title,
            "secondary_confidence": int(route_mapping.secondary_route.confidence),
        },
        "stage2_summary": {
            "one_sentence": str(product_context.get("one_sentence") or "").strip(),
            "pros": _safe_str_list((product_context.get("summary") or {}).get("pros")),
            "cons": _safe_str_list((product_context.get("summary") or {}).get("cons")),
            "who_for": _safe_str_list((product_context.get("summary") or {}).get("who_for")),
            "who_not_for": _safe_str_list((product_context.get("summary") or {}).get("who_not_for")),
        },
        "ingredients_compact": _build_product_analysis_ingredients_compact(ingredients=ingredients),
        "salient_ingredient_briefs": _build_product_analysis_salient_ingredient_briefs(
            ingredients=ingredients,
            matched_profiles=matched_profiles,
            route_mapping=route_mapping,
        ),
        "formula_signals": _build_product_analysis_formula_signals(
            ingredients=ingredients,
            route_mapping=route_mapping,
            matched_profiles=matched_profiles,
        ),
    }
    return ProductAnalysisContextPayload.model_validate(context).model_dump()


def _load_ready_route_mapping_for_product(*, db: Session, product_id: str, category: str) -> ProductRouteMappingResult:
    rec = db.get(ProductRouteMappingIndex, product_id)
    if rec is None or str(rec.status or "").strip().lower() != "ready":
        raise ValueError("route mapping missing; build route mapping first.")
    if str(rec.category or "").strip().lower() != category:
        raise ValueError("route mapping category mismatch.")
    storage_path = str(rec.storage_path or "").strip() or product_route_mapping_rel_path(category, product_id)
    if not exists_rel_path(storage_path):
        raise ValueError("route mapping file missing.")
    doc = load_json(storage_path)
    return _to_product_route_mapping_result(doc=doc, storage_path=storage_path)


def _build_product_analysis_ingredients_compact(*, ingredients: list[dict[str, Any]]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for item in ingredients:
        if not isinstance(item, dict):
            continue
        out.append(
            {
                "rank": int(item.get("rank") or 0),
                "ingredient_name_cn": str(item.get("ingredient_name_cn") or "").strip(),
                "ingredient_name_en": str(item.get("ingredient_name_en") or "").strip(),
                "type": str(item.get("type") or "").strip(),
                "functions": _safe_str_list(item.get("functions")),
                "risk": str(item.get("risk") or "").strip().lower() or "low",
                "abundance_level": str(item.get("abundance_level") or "").strip().lower() or "trace",
            }
        )
    return out


def _match_ingredient_profiles_for_analysis(
    *,
    db: Session,
    category: str,
    ingredients: list[dict[str, Any]],
) -> dict[int, IngredientLibraryDetailItem]:
    alias_keys_by_rank: dict[int, list[str]] = {}
    alias_key_set: set[str] = set()
    for item in ingredients:
        if not isinstance(item, dict):
            continue
        rank = int(item.get("rank") or 0)
        if rank <= 0:
            continue
        candidates = [
            str(item.get("ingredient_name_raw") or "").strip(),
            str(item.get("ingredient_name_cn") or "").strip(),
            str(item.get("ingredient_name_en") or "").strip(),
        ]
        keys: list[str] = []
        seen: set[str] = set()
        for name in candidates:
            for key in _build_ingredient_alias_keys(name):
                if key in seen:
                    continue
                seen.add(key)
                keys.append(key)
                alias_key_set.add(key)
        if keys:
            alias_keys_by_rank[rank] = keys

    if not alias_key_set:
        return {}

    alias_rows = db.execute(
        select(IngredientLibraryAlias)
        .where(IngredientLibraryAlias.category == category)
        .where(IngredientLibraryAlias.alias_key.in_(sorted(alias_key_set)))
    ).scalars().all()
    alias_map = {str(row.alias_key): str(row.ingredient_id or "").strip().lower() for row in alias_rows}

    target_ids: list[str] = []
    for keys in alias_keys_by_rank.values():
        for key in keys:
            ingredient_id = alias_map.get(key)
            if ingredient_id:
                target_ids.append(_resolve_ingredient_id_redirect(db=db, category=category, ingredient_id=ingredient_id))
                break
    if not target_ids:
        return {}

    index_map = _load_ingredient_index_map(db, target_ids)
    out: dict[int, IngredientLibraryDetailItem] = {}
    for rank, keys in alias_keys_by_rank.items():
        resolved_id = ""
        for key in keys:
            ingredient_id = alias_map.get(key)
            if ingredient_id:
                resolved_id = _resolve_ingredient_id_redirect(db=db, category=category, ingredient_id=ingredient_id)
                break
        if not resolved_id:
            continue
        rec = index_map.get(resolved_id)
        if rec is None:
            continue
        rel_path = str(rec.storage_path or "").strip() or ingredient_profile_rel_path(category, resolved_id)
        if not exists_rel_path(rel_path):
            continue
        try:
            doc = _load_ingredient_profile_doc(rel_path=rel_path)
            out[rank] = _to_ingredient_library_detail_item(doc=doc, rel_path=rel_path)
        except Exception:
            continue
    return out


def _build_product_analysis_salient_ingredient_briefs(
    *,
    ingredients: list[dict[str, Any]],
    matched_profiles: dict[int, IngredientLibraryDetailItem],
    route_mapping: ProductRouteMappingResult,
) -> list[dict[str, Any]]:
    route_related_names = {
        str(item.ingredient_name_cn or "").strip().lower()
        for item in (route_mapping.evidence.positive + route_mapping.evidence.counter)
        if str(item.ingredient_name_cn or "").strip()
    }
    route_related_names.update(
        {
            str(item.ingredient_name_en or "").strip().lower()
            for item in (route_mapping.evidence.positive + route_mapping.evidence.counter)
            if str(item.ingredient_name_en or "").strip()
        }
    )

    out: list[dict[str, Any]] = []
    seen: set[int] = set()
    for item in ingredients:
        if not isinstance(item, dict):
            continue
        rank = int(item.get("rank") or 0)
        if rank <= 0 or rank in seen:
            continue
        profile = matched_profiles.get(rank)
        if profile is None:
            continue

        ingredient_cn = str(item.get("ingredient_name_cn") or "").strip()
        ingredient_en = str(item.get("ingredient_name_en") or "").strip()
        why_selected = "top_rank"
        if (
            ingredient_cn.lower() in route_related_names
            or ingredient_en.lower() in route_related_names
        ):
            why_selected = "route_related"
        elif str(item.get("risk") or "").strip().lower() in {"mid", "high"} or profile.profile.risks:
            why_selected = "risk_related"

        out.append(
            {
                "ingredient_name_cn": ingredient_cn,
                "ingredient_name_en": ingredient_en,
                "rank": rank,
                "why_selected": why_selected,
                "library_summary": str(profile.profile.summary or "").strip(),
                "benefit_tags": list(dict.fromkeys(profile.profile.benefits[:2])),
                "risk_tags": list(dict.fromkeys(profile.profile.risks[:2])),
            }
        )
        seen.add(rank)
        if len(out) >= 12:
            break
    return out


def _build_product_analysis_formula_signals(
    *,
    ingredients: list[dict[str, Any]],
    route_mapping: ProductRouteMappingResult,
    matched_profiles: dict[int, IngredientLibraryDetailItem],
) -> dict[str, Any]:
    function_counts: dict[str, int] = defaultdict(int)
    risk_counts: dict[str, int] = defaultdict(int)
    top10_names: list[str] = []
    matched_count = 0
    for item in ingredients[:10]:
        if not isinstance(item, dict):
            continue
        label = str(item.get("ingredient_name_cn") or "").strip() or str(item.get("ingredient_name_en") or "").strip() or str(item.get("ingredient_name_raw") or "").strip()
        if label:
            top10_names.append(label)
    for item in ingredients:
        if not isinstance(item, dict):
            continue
        for function_name in _safe_str_list(item.get("functions")):
            function_counts[function_name] += 1
        risk = str(item.get("risk") or "").strip().lower()
        if risk:
            risk_counts[risk] += 1
        rank = int(item.get("rank") or 0)
        if rank > 0 and rank in matched_profiles:
            matched_count += 1

    special_flags: list[str] = []
    if route_mapping.needs_review:
        special_flags.append("route_mapping_needs_review")
    if matched_count == 0:
        special_flags.append("ingredient_library_absent")
    elif matched_count < min(3, len(ingredients)):
        special_flags.append("ingredient_library_sparse")
    return {
        "top10_names": top10_names[:10],
        "function_counts": dict(function_counts),
        "risk_counts": dict(risk_counts),
        "special_flags": special_flags,
    }


def _build_product_analysis_fingerprint(context: dict[str, Any]) -> str:
    raw = json.dumps(context, ensure_ascii=False, sort_keys=True)
    return hashlib.sha1(raw.encode("utf-8")).hexdigest()


def _fallback_route_mapping_fingerprint(category: str, product_id: str) -> str:
    raw = f"{category}:{product_id}:fallback"
    return hashlib.sha1(raw.encode("utf-8")).hexdigest()


def _build_route_mapping_product_context(*, row: ProductIndex, doc: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(doc, dict):
        raise ValueError("product doc must be an object.")

    summary_raw = doc.get("summary")
    summary = summary_raw if isinstance(summary_raw, dict) else {}

    ingredients_raw = doc.get("ingredients")
    if not isinstance(ingredients_raw, list):
        raise ValueError("ingredients must be a list.")

    ingredients: list[dict[str, Any]] = []
    for rank, raw in enumerate(ingredients_raw, start=1):
        if isinstance(raw, dict):
            name_raw = str(raw.get("name") or "").strip()
            type_value = str(raw.get("type") or "").strip()
            functions = _safe_str_list(raw.get("functions"))
            risk = str(raw.get("risk") or "").strip()
            notes = str(raw.get("notes") or "").strip()
            rank_value = _parse_positive_int(raw.get("rank")) or rank
            abundance_level = _normalize_abundance_level(raw.get("abundance_level"))
            order_confidence = _parse_confidence_0_100(raw.get("order_confidence"))
        else:
            name_raw = str(raw or "").strip()
            type_value = ""
            functions = []
            risk = ""
            notes = ""
            rank_value = rank
            abundance_level = None
            order_confidence = None
        if not name_raw:
            continue

        ingredient_name_cn, ingredient_name_en = _split_ingredient_names(name_raw)
        ingredients.append(
            {
                "rank": rank_value,
                "ingredient_name_cn": ingredient_name_cn,
                "ingredient_name_en": ingredient_name_en,
                "ingredient_name_raw": name_raw,
                "abundance_level": abundance_level,
                "order_confidence": order_confidence,
                "type": type_value,
                "functions": functions,
                "risk": risk,
                "notes": notes,
            }
        )

    if not ingredients:
        raise ValueError("ingredients is empty.")

    return {
        "product_id": str(row.id),
        "category": str(row.category or "").strip().lower(),
        "rules_version": MOBILE_RULES_VERSION,
        "brand": str(row.brand or "").strip(),
        "name": str(row.name or "").strip(),
        "one_sentence": str(row.one_sentence or "").strip(),
        "summary": {
            "one_sentence": str(summary.get("one_sentence") or "").strip(),
            "pros": _safe_str_list(summary.get("pros")),
            "cons": _safe_str_list(summary.get("cons")),
            "who_for": _safe_str_list(summary.get("who_for")),
            "who_not_for": _safe_str_list(summary.get("who_not_for")),
        },
        "ingredients": ingredients,
    }


def _build_route_mapping_fingerprint(product_context: dict[str, Any]) -> str:
    canonical = {
        "category": str(product_context.get("category") or "").strip().lower(),
        "rules_version": str(product_context.get("rules_version") or "").strip(),
        "brand": str(product_context.get("brand") or "").strip(),
        "name": str(product_context.get("name") or "").strip(),
        "one_sentence": str(product_context.get("one_sentence") or "").strip(),
        "summary": product_context.get("summary") if isinstance(product_context.get("summary"), dict) else {},
        "ingredients": [],
    }
    ingredients = product_context.get("ingredients")
    if isinstance(ingredients, list):
        for item in ingredients:
            if not isinstance(item, dict):
                continue
            canonical["ingredients"].append(
                {
                    "rank": int(item.get("rank") or 0),
                    "ingredient_name_cn": str(item.get("ingredient_name_cn") or "").strip(),
                    "ingredient_name_en": str(item.get("ingredient_name_en") or "").strip(),
                    "ingredient_name_raw": str(item.get("ingredient_name_raw") or "").strip(),
                    "abundance_level": str(item.get("abundance_level") or "").strip().lower(),
                    "order_confidence": _parse_confidence_0_100(item.get("order_confidence")) or 0,
                    "type": str(item.get("type") or "").strip(),
                    "functions": _safe_str_list(item.get("functions")),
                    "risk": str(item.get("risk") or "").strip(),
                    "notes": str(item.get("notes") or "").strip(),
                }
            )
    raw = json.dumps(canonical, ensure_ascii=False, sort_keys=True)
    return hashlib.sha1(raw.encode("utf-8")).hexdigest()


def _split_ingredient_names(raw_name: str) -> tuple[str, str]:
    text = str(raw_name or "").strip()
    if not text:
        return "", ""

    english_candidates: list[str] = []
    for match in re.finditer(r"[A-Za-z][A-Za-z0-9\-\s_/.,]*", text):
        token = str(match.group(0) or "").strip(" ,.;，；")
        if token:
            english_candidates.append(token)

    cn = re.sub(r"\([^)]*[A-Za-z][^)]*\)", "", text)
    cn = re.sub(r"（[^）]*[A-Za-z][^）]*）", "", cn)
    cn = re.sub(r"[A-Za-z][A-Za-z0-9\-\s_/.,]*", "", cn)
    cn = cn.replace("[", "").replace("]", "")
    cn = re.sub(r"\s+", "", cn).strip("，,;；()（）")

    en = " ".join(dict.fromkeys(english_candidates)).strip()
    return cn, en


def _suggest_product_duplicates_impl(
    payload: ProductDedupSuggestRequest,
    db: Session,
    event_callback: Callable[[dict[str, Any]], None] | None,
    should_cancel: Callable[[], bool] | None = None,
) -> ProductDedupSuggestResponse:
    category = (payload.category or "").strip().lower()
    if category and category not in VALID_CATEGORIES:
        raise HTTPException(status_code=400, detail=f"Invalid category: {category}.")

    stmt = select(ProductIndex).order_by(ProductIndex.created_at.desc())
    if category:
        stmt = stmt.where(ProductIndex.category == category)

    rows = db.execute(stmt).scalars().all()
    docs: list[dict[str, Any]] = []
    for row in rows:
        if not exists_rel_path(row.json_path):
            continue
        try:
            doc = load_json(row.json_path)
        except Exception:
            continue
        docs.append({"row": row, "doc": doc})

    filtered = _filter_docs_for_dedup(
        docs,
        title_query=(payload.title_query or "").strip(),
        ingredient_hints=payload.ingredient_hints or [],
    )
    filtered = filtered[: payload.max_scan_products]
    grouped = _group_docs_by_category(filtered)
    batch_size = int(payload.compare_batch_size or 1)
    min_confidence = max(0, min(100, int(payload.min_confidence)))
    requested_model_tier = str(payload.model_tier or "").strip().lower() or None
    resolved_model: str | None = None

    _emit_progress(
        event_callback,
        {
            "step": "dedup_scan_start",
            "category": category or None,
            "scanned_products": len(filtered),
            "category_groups": len(grouped),
            "min_confidence": min_confidence,
            "batch_size": batch_size,
            "requested_model_tier": requested_model_tier,
        },
    )

    directed_relations: list[dict[str, Any]] = []
    failures: list[str] = []

    def check_cancel() -> None:
        if should_cancel and should_cancel():
            raise ProductWorkbenchJobCancelledError("job cancelled by operator.")

    for cat, items in grouped.items():
        check_cancel()
        if len(items) < 2:
            continue
        _emit_progress(
            event_callback,
            {
                "step": "dedup_category_start",
                "category": cat,
                "products": len(items),
            },
        )
        anchor_total = len(items) - 1
        for idx, anchor in enumerate(items[:-1]):
            check_cancel()
            anchor_id = str(anchor["row"].id)
            candidates = items[idx + 1 :]
            if not candidates:
                continue
            _emit_progress(
                event_callback,
                {
                    "step": "dedup_anchor_start",
                    "category": cat,
                    "anchor_id": anchor_id,
                    "anchor_index": idx + 1,
                    "anchor_total": anchor_total,
                    "candidate_total": len(candidates),
                },
            )

            chunk_hits = 0
            for chunk_start in range(0, len(candidates), batch_size):
                check_cancel()
                chunk = candidates[chunk_start : chunk_start + batch_size]
                chunk_ids = [str(item["row"].id) for item in chunk]
                for c in chunk:
                    c_cat = str(getattr(c["row"], "category", "") or "").strip().lower()
                    if c_cat != cat:
                        failures.append(f"{anchor_id}: category mismatch with candidate {c['row'].id}.")
                        chunk = []
                        chunk_ids = []
                        break
                if not chunk:
                    continue
                ai_input = {
                    "anchor_product": _compact_product_for_dedup(anchor),
                    "candidate_products": [_compact_product_for_dedup(item) for item in chunk],
                }
                if requested_model_tier:
                    ai_input["model_tier"] = requested_model_tier
                try:
                    check_cancel()
                    ai_result = run_capability_now(
                        capability="doubao.product_dedup_group",
                        input_payload=ai_input,
                        trace_id=f"dedup-{anchor_id}",
                        event_callback=lambda e, _cat=cat, _anchor=anchor_id: _forward_dedup_model_event(
                            event_callback=event_callback,
                            category=_cat,
                            anchor_id=_anchor,
                            payload=e,
                        ),
                    )
                    model_name = str(ai_result.get("model") or "").strip()
                    if model_name and not resolved_model:
                        resolved_model = model_name
                    relations = _extract_dedup_relations(
                        ai_result=ai_result,
                        anchor_id=anchor_id,
                        candidate_ids=chunk_ids,
                        min_confidence=min_confidence,
                    )
                    directed_relations.extend(relations)
                    chunk_hits += len(relations)

                    for candidate_id in chunk_ids:
                        pair_relation = _find_pair_relation(relations=relations, a_id=anchor_id, b_id=candidate_id)
                        _emit_progress(
                            event_callback,
                            {
                                "step": "dedup_pair_result",
                                "category": cat,
                                "anchor_id": anchor_id,
                                "candidate_id": candidate_id,
                                "duplicate": bool(pair_relation),
                                "keep_id": pair_relation.get("keep_id") if pair_relation else None,
                                "remove_id": pair_relation.get("remove_id") if pair_relation else None,
                                "confidence": int(pair_relation.get("confidence") or 0) if pair_relation else 0,
                                "reason": str(pair_relation.get("reason") or "") if pair_relation else "",
                                "text": _pair_result_text(
                                    anchor_id=anchor_id,
                                    candidate_id=candidate_id,
                                    relation=pair_relation,
                                ),
                            },
                        )
                except ProductWorkbenchJobCancelledError:
                    raise
                except Exception as e:
                    failures.append(f"{anchor_id}: {e}")
                    for candidate_id in chunk_ids:
                        _emit_progress(
                            event_callback,
                            {
                                "step": "dedup_pair_error",
                                "category": cat,
                                "anchor_id": anchor_id,
                                "candidate_id": candidate_id,
                                "text": f"{anchor_id} vs {candidate_id} | error: {e}",
                            },
                        )
                finally:
                    _emit_progress(
                        event_callback,
                        {
                            "step": "dedup_chunk_done",
                            "category": cat,
                            "anchor_id": anchor_id,
                            "chunk_start": chunk_start,
                            "chunk_size": len(chunk),
                            "chunk_hits": chunk_hits,
                        },
                    )

            _emit_progress(
                event_callback,
                {
                    "step": "dedup_anchor_done",
                    "category": cat,
                    "anchor_id": anchor_id,
                    "high_conf_pairs": chunk_hits,
                },
            )

    item_by_id = {str(item["row"].id): item for item in filtered}
    suggestions = _build_suggestions_from_relations(relations=directed_relations, item_by_id=item_by_id)
    involved_ids: set[str] = set()
    for item in suggestions:
        involved_ids.add(item.keep_id)
        involved_ids.update(item.remove_ids)

    _emit_progress(
        event_callback,
        {
            "step": "dedup_scan_done",
            "suggestions": len(suggestions),
            "high_conf_relations": len(directed_relations),
            "failures": len(failures),
        },
    )

    involved_rows = [item["row"] for item in filtered if str(item["row"].id) in involved_ids]
    return ProductDedupSuggestResponse(
        status="ok",
        scanned_products=len(filtered),
        requested_model_tier=requested_model_tier,
        model=resolved_model,
        suggestions=suggestions,
        involved_products=[_row_to_card(row) for row in involved_rows],
        failures=failures[:50],
    )


def _filter_docs_for_dedup(docs: list[dict], title_query: str, ingredient_hints: list[str]) -> list[dict]:
    query = title_query.strip().lower()
    hints = [h.strip().lower() for h in ingredient_hints if h and h.strip()]
    if not query and not hints:
        return docs

    out: list[dict] = []
    for item in docs:
        row = item["row"]
        doc = item["doc"]
        name = (row.name or "").lower()
        brand = (row.brand or "").lower()
        one_sentence = (row.one_sentence or "").lower()
        ingredient_names = _ingredient_names(doc)

        title_hit = bool(query and (query in name or query in brand or query in one_sentence))
        ingredient_hit = any(any(h in ing for ing in ingredient_names) for h in hints) if hints else False
        if title_hit or ingredient_hit:
            out.append(item)
    return out


def _group_docs_by_category(items: list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for item in items:
        row = item["row"]
        category = str(getattr(row, "category", "") or "").strip().lower() or "unknown"
        grouped[category].append(item)
    for cat_items in grouped.values():
        cat_items.sort(
            key=lambda item: (
                str(getattr(item["row"], "created_at", "") or ""),
                str(getattr(item["row"], "id", "") or ""),
            )
        )
    return grouped


def _extract_dedup_relations(
    ai_result: dict[str, Any],
    anchor_id: str,
    candidate_ids: list[str],
    min_confidence: int,
) -> list[dict[str, Any]]:
    allowed_ids = {anchor_id, *candidate_ids}
    keep_id = str(ai_result.get("keep_id") or "").strip()
    if not keep_id or keep_id not in allowed_ids:
        raise ValueError("invalid dedup output (keep_id).")

    duplicates_raw = ai_result.get("duplicates")
    if not isinstance(duplicates_raw, list):
        raise ValueError("invalid dedup output (duplicates).")

    analysis_text = _normalize_analysis_text_for_ui(str(ai_result.get("analysis_text") or ""))
    relations: list[dict[str, Any]] = []
    for item in duplicates_raw:
        if not isinstance(item, dict):
            continue
        remove_id = str(item.get("id") or "").strip()
        if not remove_id or remove_id == keep_id or remove_id not in allowed_ids:
            continue
        try:
            confidence = int(item.get("confidence"))
        except Exception:
            confidence = 0
        confidence = max(0, min(100, confidence))
        if confidence < min_confidence:
            continue
        relations.append(
            {
                "keep_id": keep_id,
                "remove_id": remove_id,
                "confidence": confidence,
                "reason": str(item.get("reason") or "").strip(),
                "analysis_text": analysis_text,
            }
        )
    return relations


def _build_suggestions_from_relations(
    relations: list[dict[str, Any]],
    item_by_id: dict[str, dict[str, Any]],
) -> list[ProductDedupSuggestion]:
    directed_best: dict[tuple[str, str], dict[str, Any]] = {}
    for item in relations:
        keep_id = str(item.get("keep_id") or "").strip()
        remove_id = str(item.get("remove_id") or "").strip()
        if not keep_id or not remove_id or keep_id == remove_id:
            continue
        key = (remove_id, keep_id)
        old = directed_best.get(key)
        if old is None or int(item.get("confidence") or 0) > int(old.get("confidence") or 0):
            directed_best[key] = item

    adjacency: dict[str, set[str]] = defaultdict(set)
    for rel in directed_best.values():
        keep_id = str(rel["keep_id"])
        remove_id = str(rel["remove_id"])
        adjacency[keep_id].add(remove_id)
        adjacency[remove_id].add(keep_id)

    suggestions: list[ProductDedupSuggestion] = []
    visited: set[str] = set()
    for start in sorted(adjacency.keys()):
        if start in visited:
            continue
        stack = [start]
        component: list[str] = []
        while stack:
            node = stack.pop()
            if node in visited:
                continue
            visited.add(node)
            component.append(node)
            stack.extend(list(adjacency.get(node, set()) - visited))

        if len(component) < 2:
            continue

        comp_set = set(component)
        comp_relations = [
            rel
            for rel in directed_best.values()
            if str(rel["keep_id"]) in comp_set and str(rel["remove_id"]) in comp_set
        ]
        if not comp_relations:
            continue

        keep_id = _pick_keep_id(component, comp_relations, item_by_id)
        remove_ids = sorted(
            [pid for pid in component if pid != keep_id],
            key=lambda pid: (str(getattr(item_by_id.get(pid, {}).get("row"), "created_at", "") or ""), pid),
            reverse=True,
        )

        max_confidence = max(max(0, min(100, int(rel.get("confidence") or 0))) for rel in comp_relations)
        reason = _component_reason(comp_relations)
        analysis_text = _component_analysis_text(comp_relations)
        compared_ids = sorted(
            component,
            key=lambda pid: (str(getattr(item_by_id.get(pid, {}).get("row"), "created_at", "") or ""), pid),
            reverse=True,
        )

        suggestions.append(
            ProductDedupSuggestion(
                group_id=f"group-{len(suggestions) + 1}",
                keep_id=keep_id,
                remove_ids=remove_ids,
                confidence=max_confidence,
                reason=reason,
                analysis_text=analysis_text or None,
                compared_ids=compared_ids,
            )
        )

    suggestions.sort(key=lambda item: item.confidence, reverse=True)
    return suggestions


def _pick_keep_id(
    component: list[str],
    comp_relations: list[dict[str, Any]],
    item_by_id: dict[str, dict[str, Any]],
) -> str:
    incoming: dict[str, int] = defaultdict(int)
    outgoing: dict[str, int] = defaultdict(int)
    for rel in comp_relations:
        keep_id = str(rel.get("keep_id") or "").strip()
        remove_id = str(rel.get("remove_id") or "").strip()
        confidence = max(0, min(100, int(rel.get("confidence") or 0)))
        incoming[keep_id] += confidence
        outgoing[remove_id] += confidence

    quality: dict[str, int] = {}
    for pid in component:
        quality[pid] = _info_completeness_score(item_by_id.get(pid, {}))

    ranked = sorted(
        component,
        key=lambda pid: (
            -quality.get(pid, 0),
            -incoming.get(pid, 0),
            outgoing.get(pid, 0),
            str(getattr(item_by_id.get(pid, {}).get("row"), "created_at", "") or ""),
            pid,
        ),
    )
    return ranked[0]


def _info_completeness_score(item: dict[str, Any]) -> int:
    row = item.get("row")
    doc = item.get("doc") if isinstance(item.get("doc"), dict) else {}
    score = 0

    brand = str(getattr(row, "brand", "") or "").strip()
    name = str(getattr(row, "name", "") or "").strip()
    one_sentence = str(getattr(row, "one_sentence", "") or "").strip()
    if brand:
        score += 4
    if name:
        score += 6
    if one_sentence:
        score += 4
        score += min(4, max(0, len(one_sentence) // 24))

    ingredients = _ingredient_names(doc)
    score += min(12, len(ingredients))

    summary = doc.get("summary")
    if isinstance(summary, dict):
        for key in ("pros", "cons", "who_for", "who_not_for"):
            value = summary.get(key)
            if isinstance(value, list):
                score += min(2, len([v for v in value if str(v).strip()]))

    evidence = doc.get("evidence")
    if isinstance(evidence, dict):
        image_path = str(evidence.get("image_path") or "").strip()
        if image_path:
            score += 2

    return score


def _find_pair_relation(relations: list[dict[str, Any]], a_id: str, b_id: str) -> dict[str, Any] | None:
    ids = {a_id, b_id}
    for item in relations:
        keep_id = str(item.get("keep_id") or "").strip()
        remove_id = str(item.get("remove_id") or "").strip()
        if {keep_id, remove_id} == ids:
            return item
    return None


def _pair_result_text(anchor_id: str, candidate_id: str, relation: dict[str, Any] | None) -> str:
    if not relation:
        return f"{anchor_id} vs {candidate_id} | non-duplicate"
    keep_id = str(relation.get("keep_id") or "").strip()
    remove_id = str(relation.get("remove_id") or "").strip()
    confidence = max(0, min(100, int(relation.get("confidence") or 0)))
    reason = str(relation.get("reason") or "").strip()
    text = f"{anchor_id} vs {candidate_id} | duplicate | keep={keep_id} remove={remove_id} confidence={confidence}"
    if reason:
        text += f" | reason={reason}"
    return text


def _forward_dedup_model_event(
    event_callback: Callable[[dict[str, Any]], None] | None,
    category: str,
    anchor_id: str,
    payload: dict[str, Any],
) -> None:
    event_type = str(payload.get("type") or "").strip()
    if event_type == "delta":
        delta = str(payload.get("delta") or "")
        if not delta:
            return
        _emit_progress(
            event_callback,
            {
                "step": "dedup_model_delta",
                "category": category,
                "anchor_id": anchor_id,
                "delta": delta,
                "text": delta,
                "stream_kind": str(payload.get("stream_kind") or ""),
            },
        )
        return
    if event_type != "step":
        return
    message = str(payload.get("message") or "").strip()
    if not message:
        return
    _emit_progress(
        event_callback,
        {
            "step": "dedup_model_event",
            "category": category,
            "anchor_id": anchor_id,
            "text": f"{anchor_id} | {message}",
        },
    )


def _forward_ingredient_model_event(
    event_callback: Callable[[dict[str, Any]], None] | None,
    ingredient_id: str,
    ingredient_name: str,
    category: str,
    payload: dict[str, Any],
) -> None:
    event_type = str(payload.get("type") or "").strip()
    if event_type == "delta":
        delta = str(payload.get("delta") or "")
        if not delta:
            return
        _emit_progress(
            event_callback,
            {
                "step": "ingredient_model_delta",
                "ingredient_id": ingredient_id,
                "ingredient_name": ingredient_name,
                "category": category,
                "delta": delta,
                "text": delta,
                "stream_kind": str(payload.get("stream_kind") or ""),
            },
        )
        return
    if event_type != "step":
        return
    message = str(payload.get("message") or "").strip()
    if not message:
        return
    _emit_progress(
        event_callback,
        {
            "step": "ingredient_model_step",
            "ingredient_id": ingredient_id,
            "category": category,
            "text": f"{ingredient_id} | {message}",
        },
    )


def _normalize_analysis_text_for_ui(text: str) -> str:
    raw = (text or "").strip()
    if not raw:
        return ""
    try:
        parsed = json.loads(raw)
        return json.dumps(parsed, ensure_ascii=False)
    except Exception:
        pass

    first = raw.find("{")
    last = raw.rfind("}")
    if first >= 0 and last > first:
        snippet = raw[first : last + 1]
        try:
            parsed = json.loads(snippet)
            return json.dumps(parsed, ensure_ascii=False)
        except Exception:
            return ""
    return ""


def _component_reason(comp_relations: list[dict[str, Any]]) -> str:
    reasons: list[str] = []
    for rel in sorted(comp_relations, key=lambda item: int(item.get("confidence") or 0), reverse=True):
        reason = str(rel.get("reason") or "").strip()
        if reason and reason not in reasons:
            reasons.append(reason)
        if len(reasons) >= 3:
            break
    return "；".join(reasons)


def _component_analysis_text(comp_relations: list[dict[str, Any]]) -> str:
    lines: list[str] = []
    for rel in sorted(comp_relations, key=lambda item: int(item.get("confidence") or 0), reverse=True):
        keep_id = str(rel.get("keep_id") or "").strip()
        remove_id = str(rel.get("remove_id") or "").strip()
        confidence = max(0, min(100, int(rel.get("confidence") or 0)))
        reason = str(rel.get("reason") or "").strip()
        line = f"{remove_id} -> {keep_id} | confidence={confidence}"
        if reason:
            line += f" | reason={reason}"
        lines.append(line)
        if len(lines) >= 12:
            break

    ai_texts: list[str] = []
    for rel in comp_relations:
        text = str(rel.get("analysis_text") or "").strip()
        if not text or text in ai_texts:
            continue
        ai_texts.append(text)
        if len(ai_texts) >= 2:
            break

    if not lines and not ai_texts:
        return ""

    out = ["同品类两两重合分析（高置信命中）", *lines]
    if ai_texts:
        out.append("")
        out.append("模型原文片段：")
        out.extend(ai_texts)
    return "\n".join(out).strip()


def _compact_product_for_dedup(item: dict) -> dict:
    row = item["row"]
    doc = item["doc"]
    return {
        "id": row.id,
        "category": row.category,
        "brand": row.brand,
        "name": row.name,
        "one_sentence": row.one_sentence,
        "ingredients": _ingredient_names(doc)[:30],
    }


def _ingredient_names(doc: dict) -> list[str]:
    ingredients = doc.get("ingredients")
    if not isinstance(ingredients, list):
        return []
    out: list[str] = []
    for item in ingredients:
        if not isinstance(item, dict):
            continue
        name = str(item.get("name") or "").strip().lower()
        if name:
            out.append(name)
    return list(dict.fromkeys(out))


def _collect_category_ingredients(
    *,
    rows: list[ProductIndex],
    max_sources_per_ingredient: int,
    normalization_packages: list[str] | None = None,
) -> tuple[dict[str, dict[str, Any]], dict[str, Any]]:
    records = _collect_category_ingredient_records(rows=rows)
    return _aggregate_category_ingredients(
        records=records,
        max_sources_per_ingredient=max_sources_per_ingredient,
        normalization_packages=normalization_packages,
    )


def _collect_category_ingredient_records(
    *,
    rows: list[ProductIndex],
) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    for row in rows:
        product_id = str(getattr(row, "id", "") or "").strip()
        json_path = str(getattr(row, "json_path", "") or "").strip()
        if not json_path or not exists_rel_path(json_path):
            raise HTTPException(
                status_code=422,
                detail=(
                    f"[stage=ingredient_stats_aggregate] product_id={product_id} "
                    f"json_missing path={json_path or '-'}"
                ),
            )
        try:
            doc = load_json(json_path)
        except Exception as e:
            raise HTTPException(
                status_code=422,
                detail=(
                    f"[stage=ingredient_stats_aggregate] product_id={product_id} "
                    f"json_load_failed path={json_path} error={e}"
                ),
            ) from e

        row_category = str(getattr(row, "category", "") or "").strip().lower()
        doc_category = ""
        if isinstance(doc.get("product"), dict):
            doc_category = str((doc.get("product") or {}).get("category") or "").strip().lower()
        category = row_category or doc_category or "unknown"

        ingredients = doc.get("ingredients")
        if not isinstance(ingredients, list) or not ingredients:
            raise HTTPException(
                status_code=422,
                detail=(
                    f"[stage=ingredient_stats_aggregate] category={category} product_id={product_id} "
                    "ingredients should be a non-empty list."
                ),
            )

        product_items: list[dict[str, Any]] = []
        issues: list[str] = []
        for idx, raw in enumerate(ingredients, start=1):
            if not isinstance(raw, dict):
                issues.append(f"ingredients[{idx}] should be an object.")
                continue

            ingredient_name = str(raw.get("name") or "").strip()
            ingredient_key_base = _normalize_ingredient_key(ingredient_name)
            ingredient_name_en_field = _extract_ingredient_name_en_from_fields(raw=raw)
            ingredient_name_en_paren = _extract_ingredient_name_en_from_parenthesis(ingredient_name=ingredient_name)
            ingredient_name_en = ingredient_name_en_field or ingredient_name_en_paren
            ingredient_name_en_key_field = _normalize_ingredient_en_key(ingredient_name_en_field)
            ingredient_name_en_key_paren = _normalize_ingredient_en_key(ingredient_name_en_paren)
            rank = _parse_positive_int(raw.get("rank"))
            abundance_level = _normalize_ingredient_abundance_level(
                raw.get("abundance_level") or raw.get("abundance") or raw.get("major_minor")
            )
            order_confidence = _parse_ingredient_order_confidence(raw.get("order_confidence"))

            item_issues: list[str] = []
            if not ingredient_name:
                item_issues.append(f"ingredients[{idx}].name is required.")
            if not ingredient_key_base:
                item_issues.append(f"ingredients[{idx}].name should be non-empty after normalization.")
            if rank is None:
                item_issues.append(f"ingredients[{idx}].rank should be a positive integer.")
            if abundance_level is None:
                item_issues.append(f"ingredients[{idx}].abundance_level should be major|trace.")
            if order_confidence is None:
                item_issues.append(f"ingredients[{idx}].order_confidence should be an integer in [0,100].")
            if item_issues:
                issues.extend(item_issues)
                continue

            product_items.append(
                {
                    "ingredient_name": ingredient_name,
                    "ingredient_name_en": ingredient_name_en,
                    "ingredient_name_en_key_field": ingredient_name_en_key_field,
                    "ingredient_name_en_key_paren": ingredient_name_en_key_paren,
                    "ingredient_key_base": ingredient_key_base,
                    "rank": int(rank),
                    "abundance_level": str(abundance_level),
                    "order_confidence": int(order_confidence),
                    "raw": raw,
                }
            )

        if issues:
            issue_preview = "; ".join(issues[:12])
            if len(issues) > 12:
                issue_preview += f"; ...(+{len(issues) - 12} more)"
            raise HTTPException(
                status_code=422,
                detail=(
                    f"[stage=ingredient_stats_aggregate] category={category} product_id={product_id} "
                    f"invalid_stage2_ingredient_fields: {issue_preview}"
                ),
            )

        records.append(
            {
                "product_id": product_id,
                "category": category,
                "brand": str(row.brand or "").strip(),
                "name": str(row.name or "").strip(),
                "one_sentence": str(row.one_sentence or "").strip(),
                "items": product_items,
            }
        )
    return records


def _aggregate_category_ingredients(
    *,
    records: list[dict[str, Any]],
    max_sources_per_ingredient: int,
    normalization_packages: list[str] | None = None,
) -> tuple[dict[str, dict[str, Any]], dict[str, Any]]:
    grouped: dict[str, dict[str, Any]] = {}
    max_sources = max(1, min(30, int(max_sources_per_ingredient)))
    selected_packages = _normalize_ingredient_normalization_packages(normalization_packages)
    raw_group_keys: set[str] = set()
    total_mentions = 0

    for record in records:
        category = str(record["category"])
        product_id = str(record["product_id"])
        product_key_to_name: dict[str, str] = {}
        items = record["items"]

        for parsed in items:
            ingredient_name = str(parsed["ingredient_name"])
            ingredient_name_en = str(parsed.get("ingredient_name_en") or "").strip() or None
            ingredient_key_base = str(parsed["ingredient_key_base"])
            ingredient_key = _resolve_ingredient_key(
                ingredient_key_base=ingredient_key_base,
                ingredient_name_en_key_field=str(parsed.get("ingredient_name_en_key_field") or ""),
                ingredient_name_en_key_paren=str(parsed.get("ingredient_name_en_key_paren") or ""),
                normalization_packages=selected_packages,
            )
            raw_group_keys.add(f"{category}::{ingredient_key_base}")
            total_mentions += 1

            ingredient_id = _build_ingredient_id(category=category, ingredient_key=ingredient_key)
            group_key = f"{category}::{ingredient_key}"
            item = grouped.get(group_key)
            if item is None:
                item = {
                    "ingredient_id": ingredient_id,
                    "ingredient_name": ingredient_name,
                    "ingredient_name_en": ingredient_name_en,
                    "ingredient_key": ingredient_key,
                    "category": category,
                    "source_trace_ids": set(),
                    "source_samples": [],
                    "_mention_count": 0,
                    "_rank_values": [],
                    "_major_count": 0,
                    "_trace_count": 0,
                    "_order_confidence_values": [],
                    "_cooccurrence_counts": {},
                    "_cooccurrence_names": {},
                    "_name_counts": defaultdict(int),
                    "_name_en_counts": defaultdict(int),
                    "_alias_names": set(),
                }
                grouped[group_key] = item

            item["source_trace_ids"].add(product_id)
            item["_mention_count"] = int(item["_mention_count"]) + 1
            item["_rank_values"].append(int(parsed["rank"]))
            item["_order_confidence_values"].append(int(parsed["order_confidence"]))
            if parsed["abundance_level"] == "major":
                item["_major_count"] = int(item["_major_count"]) + 1
            else:
                item["_trace_count"] = int(item["_trace_count"]) + 1
            item["_name_counts"][ingredient_name] += 1
            if ingredient_name_en:
                item["_name_en_counts"][ingredient_name_en] += 1
            for alias_name in _collect_alias_names_from_parsed_item(parsed):
                item["_alias_names"].add(alias_name)
            if len(item["source_samples"]) < max_sources:
                item["source_samples"].append(
                    {
                        "trace_id": product_id,
                        "brand": str(record["brand"]),
                        "name": str(record["name"]),
                        "one_sentence": str(record["one_sentence"]),
                        "rank": int(parsed["rank"]),
                        "abundance_level": str(parsed["abundance_level"]),
                        "order_confidence": int(parsed["order_confidence"]),
                        "ingredient": parsed["raw"],
                    }
                )
            if ingredient_key not in product_key_to_name:
                product_key_to_name[ingredient_key] = ingredient_name

        product_keys = sorted(product_key_to_name.keys())
        for ingredient_key in product_keys:
            group_key = f"{category}::{ingredient_key}"
            item = grouped[group_key]
            co_counts = item["_cooccurrence_counts"]
            co_names = item["_cooccurrence_names"]
            for other_key in product_keys:
                if other_key == ingredient_key:
                    continue
                prev = int(co_counts.get(other_key) or 0)
                co_counts[other_key] = prev + 1
                if other_key not in co_names:
                    co_names[other_key] = str(product_key_to_name.get(other_key) or other_key)

    for item in grouped.values():
        source_trace_ids = sorted(item["source_trace_ids"])
        mention_count = int(item.pop("_mention_count", 0))
        rank_values = sorted(int(v) for v in item.pop("_rank_values", []))
        major_count = int(item.pop("_major_count", 0))
        trace_count = int(item.pop("_trace_count", 0))
        order_confidence_values = sorted(int(v) for v in item.pop("_order_confidence_values", []))
        cooccurrence_counts = item.pop("_cooccurrence_counts", {})
        cooccurrence_names = item.pop("_cooccurrence_names", {})
        name_counts = dict(item.pop("_name_counts", {}))
        name_en_counts = dict(item.pop("_name_en_counts", {}))
        alias_names = sorted(str(x) for x in item.pop("_alias_names", set()) if str(x).strip())

        if mention_count <= 0 or not source_trace_ids:
            raise HTTPException(
                status_code=422,
                detail=(
                    f"[stage=ingredient_stats_aggregate] category={item.get('category')} "
                    f"ingredient_key={item.get('ingredient_key')} has empty aggregated stats."
                ),
            )
        if len(rank_values) != mention_count or len(order_confidence_values) != mention_count:
            raise HTTPException(
                status_code=422,
                detail=(
                    f"[stage=ingredient_stats_aggregate] category={item.get('category')} "
                    f"ingredient_key={item.get('ingredient_key')} stats_count_mismatch "
                    f"mention_count={mention_count} rank_values={len(rank_values)} "
                    f"order_confidence_values={len(order_confidence_values)}"
                ),
            )

        item["ingredient_name"] = _pick_preferred_name(name_counts) or str(item["ingredient_name"])
        item["ingredient_name_en"] = _pick_preferred_name(name_en_counts) or item.get("ingredient_name_en")
        item["alias_names"] = alias_names

        product_count = len(source_trace_ids)
        source_json = {
            "stats": {
                "product_count": product_count,
                "mention_count": mention_count,
                "rank": _build_rank_stats(rank_values),
                "abundance": _build_abundance_stats(major_count=major_count, trace_count=trace_count),
                "order_confidence": _build_order_confidence_stats(order_confidence_values),
                "cooccurrence_top": _build_cooccurrence_top(
                    counts=cooccurrence_counts,
                    names=cooccurrence_names,
                    limit=INGREDIENT_SOURCE_COOCCURRENCE_TOP_N,
                ),
                "data_quality": {
                    "missing_rank": 0,
                    "missing_abundance": 0,
                    "missing_order_confidence": 0,
                    "invalid_items": 0,
                },
            },
            "samples": item["source_samples"],
        }
        category = str(item["category"])
        ingredient_key = str(item["ingredient_key"])
        item["source_json"] = source_json
        item["source_schema_version"] = INGREDIENT_SOURCE_SCHEMA_VERSION
        item["source_signature"] = _build_ingredient_source_signature(
            category=category,
            ingredient_key=ingredient_key,
            source_json=source_json,
        )

    meta = {
        "scanned_products": len(records),
        "total_mentions": total_mentions,
        "raw_unique_ingredients": len(raw_group_keys),
        "unique_ingredients": len(grouped),
        "normalization_packages": selected_packages,
    }
    return grouped, meta


def _ingredient_normalization_package_map() -> dict[str, dict[str, Any]]:
    return {str(item["id"]): item for item in INGREDIENT_NORMALIZATION_PACKAGES}


def _default_ingredient_normalization_packages() -> list[str]:
    out: list[str] = []
    for item in INGREDIENT_NORMALIZATION_PACKAGES:
        if bool(item.get("default_enabled")):
            out.append(str(item.get("id")))
    return out


def _normalize_ingredient_normalization_packages(package_ids: list[str] | None) -> list[str]:
    pkg_map = _ingredient_normalization_package_map()
    requested: list[str] = []
    if package_ids:
        for raw in package_ids:
            value = str(raw or "").strip()
            if not value:
                continue
            if value not in pkg_map:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "[stage=ingredient_preflight_config] "
                        f"unknown normalization package: {value}"
                    ),
                )
            if value not in requested:
                requested.append(value)
    if not requested:
        requested = _default_ingredient_normalization_packages()
    return requested


def _normalize_ingredient_text(name: str, *, normalization_packages: list[str] | None = None) -> str:
    selected = set(normalization_packages or _default_ingredient_normalization_packages())
    value = str(name or "")
    if "unicode_nfkc" in selected:
        value = unicodedata.normalize("NFKC", value)
    if "punctuation_fold" in selected:
        value = value.translate(INGREDIENT_PUNCTUATION_FOLD_TABLE)
    if "whitespace_fold" in selected:
        value = " ".join(value.split())
    value = value.strip().lower()
    return value


def _normalize_ingredient_key(name: str) -> str:
    value = _normalize_ingredient_text(name, normalization_packages=["unicode_nfkc", "punctuation_fold", "whitespace_fold"])
    if not value:
        return ""
    return value[:120]


def _normalize_ingredient_en_key(value: str | None) -> str:
    raw = _normalize_ingredient_text(str(value or ""), normalization_packages=["unicode_nfkc", "punctuation_fold", "whitespace_fold"])
    if not raw:
        return ""
    compact = re.sub(r"[^a-z0-9]+", "", raw)
    return compact[:120]


def _extract_ingredient_name_en_from_fields(raw: dict[str, Any]) -> str | None:
    if not isinstance(raw, dict):
        return None
    candidates = (
        "name_en",
        "inci",
        "inci_name",
        "english_name",
        "en_name",
        "inciName",
        "nameEn",
    )
    for key in candidates:
        value = str(raw.get(key) or "").strip()
        if not value:
            continue
        if re.search(r"[A-Za-z]", value):
            return value
    return None


def _extract_ingredient_name_en_from_parenthesis(ingredient_name: str) -> str | None:
    text = str(ingredient_name or "").strip()
    if not text:
        return None
    matches = re.findall(r"\(([^()]+)\)", text)
    for part in matches:
        value = str(part or "").strip()
        if not value:
            continue
        if re.search(r"[A-Za-z]", value):
            return value
    return None


def _resolve_ingredient_key(
    *,
    ingredient_key_base: str,
    ingredient_name_en_key_field: str,
    ingredient_name_en_key_paren: str,
    normalization_packages: list[str],
) -> str:
    selected = set(normalization_packages)
    base = str(ingredient_key_base or "").strip().lower()
    if not base:
        raise HTTPException(
            status_code=422,
            detail="[stage=ingredient_stats_aggregate] ingredient base key is empty.",
        )
    if "en_exact" not in selected:
        return base

    field_key = str(ingredient_name_en_key_field or "").strip().lower()
    if field_key:
        return f"en::{field_key}"[:120]

    if "extract_en_parenthesis" in selected:
        paren_key = str(ingredient_name_en_key_paren or "").strip().lower()
        if paren_key:
            return f"en::{paren_key}"[:120]
    return base


def _collect_alias_names_from_parsed_item(parsed: dict[str, Any]) -> list[str]:
    out: list[str] = []
    name = str(parsed.get("ingredient_name") or "").strip()
    if name:
        out.append(name)
    name_en = str(parsed.get("ingredient_name_en") or "").strip()
    if name_en:
        out.append(name_en)
    if name:
        parenthesis = _extract_ingredient_name_en_from_parenthesis(ingredient_name=name)
        if parenthesis:
            out.append(parenthesis)
    dedup: list[str] = []
    seen: set[str] = set()
    for raw in out:
        value = str(raw or "").strip()
        if not value:
            continue
        key = value.lower()
        if key in seen:
            continue
        seen.add(key)
        dedup.append(value)
    return dedup


def _pick_preferred_name(counter: dict[str, int]) -> str:
    if not counter:
        return ""
    rows = sorted(counter.items(), key=lambda item: (-int(item[1]), len(str(item[0])), str(item[0])))
    return str(rows[0][0]).strip()


def _collect_item_alias_names(*, item: dict[str, Any]) -> list[str]:
    out: list[str] = []
    ingredient_name = str(item.get("ingredient_name") or "").strip()
    if ingredient_name:
        out.append(ingredient_name)
    ingredient_name_en = str(item.get("ingredient_name_en") or "").strip()
    if ingredient_name_en:
        out.append(ingredient_name_en)
    for raw in item.get("alias_names") or []:
        value = str(raw or "").strip()
        if value:
            out.append(value)
    dedup: list[str] = []
    seen: set[str] = set()
    for raw in out:
        lowered = raw.lower()
        if lowered in seen:
            continue
        seen.add(lowered)
        dedup.append(raw)
    return dedup


def _build_rank_stats(values: list[int]) -> dict[str, float | int]:
    sorted_values = sorted(int(v) for v in values)
    return {
        "min": int(sorted_values[0]),
        "max": int(sorted_values[-1]),
        "mean": _round_stat(sum(sorted_values) / len(sorted_values)),
        "median": _round_stat(_percentile(sorted_values, 50)),
        "p25": _round_stat(_percentile(sorted_values, 25)),
        "p75": _round_stat(_percentile(sorted_values, 75)),
    }


def _build_abundance_stats(*, major_count: int, trace_count: int) -> dict[str, float | int]:
    total = max(0, int(major_count) + int(trace_count))
    if total <= 0:
        raise HTTPException(
            status_code=422,
            detail="[stage=ingredient_stats_aggregate] abundance stats total is zero.",
        )
    return {
        "major_count": int(major_count),
        "trace_count": int(trace_count),
        "major_ratio": _round_stat(int(major_count) / total),
        "trace_ratio": _round_stat(int(trace_count) / total),
    }


def _build_order_confidence_stats(values: list[int]) -> dict[str, float]:
    sorted_values = sorted(int(v) for v in values)
    return {
        "mean": _round_stat(sum(sorted_values) / len(sorted_values)),
        "p25": _round_stat(_percentile(sorted_values, 25)),
        "p50": _round_stat(_percentile(sorted_values, 50)),
        "p75": _round_stat(_percentile(sorted_values, 75)),
    }


def _build_cooccurrence_top(
    *,
    counts: dict[str, Any],
    names: dict[str, Any],
    limit: int,
) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    for key, count_raw in counts.items():
        try:
            count = int(count_raw)
        except Exception:
            continue
        if count <= 0:
            continue
        ingredient_name = str(names.get(key) or key).strip() or str(key)
        items.append({"ingredient": ingredient_name, "count": count})
    items.sort(key=lambda x: (-int(x["count"]), str(x["ingredient"])))
    return items[: max(1, int(limit))]


def _build_ingredient_source_signature(
    *,
    category: str,
    ingredient_key: str,
    source_json: dict[str, Any],
) -> str:
    canonical = {
        "schema_version": INGREDIENT_SOURCE_SCHEMA_VERSION,
        "category": str(category or "").strip().lower(),
        "ingredient_key": str(ingredient_key or "").strip().lower(),
        "source_json": source_json,
    }
    raw = json.dumps(canonical, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha1(raw.encode("utf-8")).hexdigest()


def _load_profile_source_signature(rel_path: str) -> str:
    if not rel_path or not exists_rel_path(rel_path):
        return ""
    try:
        doc = load_json(rel_path)
    except Exception:
        return ""
    if not isinstance(doc, dict):
        return ""
    generator = doc.get("generator")
    if not isinstance(generator, dict):
        return ""
    return str(generator.get("source_signature") or "").strip()


def _source_product_count_from_source_json(*, source_json: dict[str, Any], fallback: int) -> int:
    if not isinstance(source_json, dict):
        return max(0, int(fallback))
    stats = source_json.get("stats")
    if not isinstance(stats, dict):
        return max(0, int(fallback))
    try:
        value = int(stats.get("product_count"))
    except Exception:
        value = int(fallback)
    return max(0, value)


def _normalize_ingredient_abundance_level(value: Any) -> str | None:
    text = str(value or "").strip().lower()
    if text in {"major", "main", "primary", "主要", "主成分"}:
        return "major"
    if text in {"trace", "minor", "secondary", "微量", "少量"}:
        return "trace"
    return None


def _parse_ingredient_order_confidence(value: Any) -> int | None:
    try:
        parsed = int(value)
    except Exception:
        return None
    if parsed < 0 or parsed > 100:
        return None
    return parsed


def _round_stat(value: float) -> float:
    return round(float(value), 4)


def _percentile(sorted_values: list[int], percentile: float) -> float:
    if not sorted_values:
        raise ValueError("sorted_values is empty.")
    if len(sorted_values) == 1:
        return float(sorted_values[0])
    p = max(0.0, min(100.0, float(percentile)))
    index = (len(sorted_values) - 1) * (p / 100.0)
    lower = int(index)
    upper = min(lower + 1, len(sorted_values) - 1)
    weight = index - lower
    lower_value = float(sorted_values[lower])
    upper_value = float(sorted_values[upper])
    return lower_value + (upper_value - lower_value) * weight

def _build_ingredient_id(category: str, ingredient_key: str) -> str:
    base = f"{category}::{ingredient_key}"
    digest = hashlib.sha1(base.encode("utf-8")).hexdigest()[:20]
    return f"ing-{digest}"


def _normalize_optional_category(category: str | None) -> str | None:
    value = str(category or "").strip().lower()
    if not value:
        return None
    if value not in VALID_CATEGORIES:
        raise HTTPException(status_code=400, detail=f"Invalid category: {value}.")
    return value


def _normalize_required_category(category: str) -> str:
    value = _normalize_optional_category(category)
    if not value:
        raise HTTPException(status_code=400, detail="category is required.")
    return value


def _normalize_target_type_key(raw: str) -> str:
    value = str(raw or "").strip()
    if not value:
        raise HTTPException(status_code=400, detail="target_type_key is required.")
    if len(value) > 128:
        raise HTTPException(status_code=400, detail="target_type_key is too long (max 128).")
    return value


def _normalize_ingredient_id_list(values: list[str]) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()
    for raw in values:
        value = str(raw or "").strip().lower()
        if not value:
            continue
        if len(value) > 64:
            raise HTTPException(status_code=400, detail=f"ingredient_id is too long: {value[:32]}...")
        if value in seen:
            continue
        seen.add(value)
        out.append(value)
    return out


def _featured_slot_schema_http_error(exc: Exception) -> HTTPException:
    return HTTPException(
        status_code=500,
        detail=(
            "Featured slot table query failed. "
            "Database schema may be outdated (missing table 'product_featured_slots'). "
            f"Raw error: {exc}"
        ),
    )


def _iter_ingredient_profile_rel_paths(category: str | None) -> list[str]:
    base = Path(settings.storage_dir).resolve()
    root = (base / "ingredients").resolve()
    if not str(root).startswith(str(base)):
        raise HTTPException(status_code=500, detail="Invalid ingredients storage root.")
    if not root.exists():
        return []

    target_dir = root
    if category:
        target_dir = (root / category).resolve()
        if not str(target_dir).startswith(str(root)):
            raise HTTPException(status_code=500, detail="Invalid ingredients category path.")
        if not target_dir.exists():
            return []

    rel_paths: list[str] = []
    for path in sorted(target_dir.rglob("*.json")):
        if not path.is_file():
            continue
        rel_paths.append(path.resolve().relative_to(base).as_posix())
    return rel_paths


def _resolve_ingredient_profile_path_for_delete(
    *,
    rec: IngredientLibraryIndex | None,
    ingredient_id: str,
) -> str:
    candidates: list[str] = []
    if rec is not None:
        storage_path = str(rec.storage_path or "").strip()
        if storage_path:
            candidates.append(storage_path)
        category = str(rec.category or "").strip().lower()
        if category:
            candidates.append(ingredient_profile_rel_path(category, ingredient_id))

    for rel in candidates:
        if rel and exists_rel_path(rel):
            return rel

    base = Path(settings.storage_dir).resolve()
    root = (base / "ingredients").resolve()
    if not str(root).startswith(str(base)) or not root.exists():
        return ""
    for path in root.rglob(f"{ingredient_id}.json"):
        if not path.is_file():
            continue
        resolved = path.resolve()
        if not str(resolved).startswith(str(root)):
            continue
        return resolved.relative_to(base).as_posix()
    return ""


def _load_ingredient_profile_doc(rel_path: str) -> dict[str, Any]:
    doc = load_json(rel_path)
    if not isinstance(doc, dict):
        raise ValueError("document is not an object.")
    return doc


def _load_ingredient_library_list_item_from_index_row(*, rec: IngredientLibraryIndex) -> IngredientLibraryListItem:
    ingredient_id = str(rec.ingredient_id or "").strip().lower()
    category = str(rec.category or "").strip().lower()
    rel_path = str(rec.storage_path or "").strip() or ingredient_profile_rel_path(category, ingredient_id)
    if not rel_path or not exists_rel_path(rel_path):
        raise HTTPException(
            status_code=500,
            detail=f"Ingredient profile missing for '{ingredient_id}' at '{rel_path or '-'}'.",
        )
    try:
        doc = _load_ingredient_profile_doc(rel_path=rel_path)
        return _to_ingredient_library_list_item(doc=doc, rel_path=rel_path)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Invalid ingredient profile '{rel_path}': {exc}") from exc


def _required_text_field(doc: dict[str, Any], key: str) -> str:
    value = str(doc.get(key) or "").strip()
    if not value:
        raise ValueError(f"missing required field '{key}'.")
    return value


def _strict_str_list(value: Any, field_name: str) -> list[str]:
    if value is None:
        return []
    if not isinstance(value, list):
        raise ValueError(f"{field_name} should be a list.")
    out: list[str] = []
    for idx, item in enumerate(value):
        text = str(item or "").strip()
        if not text:
            raise ValueError(f"{field_name}[{idx}] is empty.")
        out.append(text)
    return out


def _strict_non_negative_int(value: Any, field_name: str, fallback: int | None = None) -> int:
    if value is None and fallback is not None:
        return max(0, int(fallback))
    try:
        parsed = int(value)
    except Exception as e:
        raise ValueError(f"{field_name} should be an integer.") from e
    if parsed < 0:
        raise ValueError(f"{field_name} should be >= 0.")
    return parsed


def _parse_optional_source_json(value: Any, field_name: str) -> dict[str, Any] | None:
    if value is None:
        return None
    if not isinstance(value, dict):
        raise ValueError(f"{field_name} should be an object.")
    stats = value.get("stats")
    samples = value.get("samples")
    if not isinstance(stats, dict):
        raise ValueError(f"{field_name}.stats should be an object.")
    if not isinstance(samples, list):
        raise ValueError(f"{field_name}.samples should be a list.")
    return value


def _to_ingredient_library_list_item(doc: dict[str, Any], rel_path: str) -> IngredientLibraryListItem:
    ingredient_id = _required_text_field(doc, "id")
    category = _required_text_field(doc, "category").lower()
    if category not in VALID_CATEGORIES:
        raise ValueError(f"invalid category in profile: {category}.")
    ingredient_name = _required_text_field(doc, "ingredient_name")
    ingredient_name_en = str(doc.get("ingredient_name_en") or "").strip() or None
    source_trace_ids = _strict_str_list(doc.get("source_trace_ids"), field_name="source_trace_ids")
    source_json = _parse_optional_source_json(doc.get("source_json"), field_name="source_json")
    if source_json is not None:
        source_count = _source_product_count_from_source_json(source_json=source_json, fallback=len(source_trace_ids))
    else:
        source_count = _strict_non_negative_int(
            doc.get("source_count"),
            field_name="source_count",
            fallback=len(source_trace_ids),
        )

    profile_raw = doc.get("profile")
    if not isinstance(profile_raw, dict):
        raise ValueError("profile should be an object.")
    summary = str(profile_raw.get("summary") or "").strip()
    generated_at = str(doc.get("generated_at") or "").strip() or None

    return IngredientLibraryListItem(
        ingredient_id=ingredient_id,
        category=category,
        ingredient_name=ingredient_name,
        ingredient_name_en=ingredient_name_en,
        summary=summary,
        source_count=source_count,
        source_trace_ids=source_trace_ids,
        generated_at=generated_at,
        storage_path=rel_path,
    )


def _to_ingredient_library_detail_item(doc: dict[str, Any], rel_path: str) -> IngredientLibraryDetailItem:
    base = _to_ingredient_library_list_item(doc=doc, rel_path=rel_path)
    ingredient_key = str(doc.get("ingredient_key") or "").strip() or None
    source_json = _parse_optional_source_json(doc.get("source_json"), field_name="source_json") or {}

    generator = doc.get("generator")
    if generator is None:
        generator = {}
    if not isinstance(generator, dict):
        raise ValueError("generator should be an object.")

    profile_raw = doc.get("profile")
    if not isinstance(profile_raw, dict):
        raise ValueError("profile should be an object.")
    profile = IngredientLibraryProfile(
        summary=str(profile_raw.get("summary") or "").strip(),
        benefits=_strict_str_list(profile_raw.get("benefits"), field_name="profile.benefits"),
        risks=_strict_str_list(profile_raw.get("risks"), field_name="profile.risks"),
        usage_tips=_strict_str_list(profile_raw.get("usage_tips"), field_name="profile.usage_tips"),
        suitable_for=_strict_str_list(profile_raw.get("suitable_for"), field_name="profile.suitable_for"),
        avoid_for=_strict_str_list(profile_raw.get("avoid_for"), field_name="profile.avoid_for"),
        confidence=_strict_non_negative_int(profile_raw.get("confidence"), field_name="profile.confidence", fallback=0),
        reason=str(profile_raw.get("reason") or "").strip(),
        analysis_text=str(profile_raw.get("analysis_text") or "").strip(),
    )

    source_samples_raw = doc.get("source_samples")
    if source_samples_raw is None:
        source_samples_raw = []
    if not isinstance(source_samples_raw, list):
        raise ValueError("source_samples should be a list.")
    source_samples: list[IngredientLibrarySourceSample] = []
    for idx, sample in enumerate(source_samples_raw):
        if not isinstance(sample, dict):
            raise ValueError(f"source_samples[{idx}] should be an object.")
        ingredient_raw = sample.get("ingredient")
        if ingredient_raw is None:
            ingredient_raw = {}
        if not isinstance(ingredient_raw, dict):
            raise ValueError(f"source_samples[{idx}].ingredient should be an object.")
        source_samples.append(
            IngredientLibrarySourceSample(
                trace_id=str(sample.get("trace_id") or "").strip(),
                brand=str(sample.get("brand") or "").strip(),
                name=str(sample.get("name") or "").strip(),
                one_sentence=str(sample.get("one_sentence") or "").strip(),
                ingredient=ingredient_raw,
            )
        )

    return IngredientLibraryDetailItem(
        ingredient_id=base.ingredient_id,
        category=base.category,
        ingredient_name=base.ingredient_name,
        ingredient_name_en=base.ingredient_name_en,
        ingredient_key=ingredient_key,
        source_count=base.source_count,
        source_trace_ids=base.source_trace_ids,
        source_samples=source_samples,
        source_json=source_json,
        generated_at=base.generated_at,
        generator=generator,
        profile=profile,
        storage_path=base.storage_path,
    )


def _parse_positive_int(value: Any) -> int | None:
    try:
        parsed = int(value)
    except Exception:
        return None
    if parsed <= 0:
        return None
    return parsed


def _safe_positive_int(value: Any, fallback: int = 0) -> int:
    parsed = _parse_positive_int(value)
    if parsed is None:
        return max(0, int(fallback))
    return int(parsed)


def _parse_confidence_0_100(value: Any) -> int | None:
    try:
        parsed = int(value)
    except Exception:
        return None
    if parsed < 0 or parsed > 100:
        return None
    return parsed


def _normalize_abundance_level(value: Any) -> str | None:
    text = str(value or "").strip().lower()
    if not text:
        return None
    if text in {"major", "main", "primary", "secondary", "主要", "主成分", "核心"}:
        return "major"
    if text in {"trace", "minor", "micro", "微量", "末端", "痕量", "辅料"}:
        return "trace"
    return None


def _safe_str_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    out: list[str] = []
    for item in value:
        text = str(item or "").strip()
        if not text:
            continue
        out.append(text)
        if len(out) >= 30:
            break
    return out


def _build_ingredient_alias_id(*, category: str, alias_key: str) -> str:
    raw = f"{category}::{alias_key}"
    digest = hashlib.sha1(raw.encode("utf-8")).hexdigest()[:24]
    return f"inga-{digest}"


def _build_ingredient_alias_keys(alias_name: str) -> list[str]:
    value = str(alias_name or "").strip()
    if not value:
        return []
    keys: list[str] = []
    base_key = _normalize_ingredient_key(value)
    if base_key:
        keys.append(f"cn::{base_key}")
    en_key = _normalize_ingredient_en_key(value)
    if en_key:
        keys.append(f"en::{en_key}")
    out: list[str] = []
    seen: set[str] = set()
    for key in keys:
        if key in seen:
            continue
        seen.add(key)
        out.append(key[:240])
    return out


def _upsert_ingredient_redirect(
    *,
    db: Session,
    category: str,
    old_ingredient_id: str,
    new_ingredient_id: str,
    reason: str,
) -> None:
    old_id = str(old_ingredient_id or "").strip().lower()
    new_id = str(new_ingredient_id or "").strip().lower()
    if not old_id or not new_id or old_id == new_id:
        return
    rec = db.get(IngredientLibraryRedirect, old_id)
    now = now_iso()
    if rec is None:
        rec = IngredientLibraryRedirect(
            old_ingredient_id=old_id,
            category=str(category or "").strip().lower(),
            new_ingredient_id=new_id,
            reason=str(reason or "").strip() or "alias remap",
            created_at=now,
            updated_at=now,
        )
    else:
        rec.category = str(category or "").strip().lower()
        rec.new_ingredient_id = new_id
        rec.reason = str(reason or "").strip() or rec.reason
        rec.updated_at = now
    db.add(rec)


def _upsert_ingredient_aliases(
    *,
    db: Session,
    category: str,
    ingredient_id: str,
    alias_names: list[str],
    resolver: str,
) -> None:
    normalized_category = str(category or "").strip().lower()
    target_id = str(ingredient_id or "").strip().lower()
    if not normalized_category or not target_id:
        return
    _ensure_ingredient_alias_tables(db)
    # SessionLocal uses autoflush=False. Flush first so pending alias inserts in this
    # transaction become visible to the lookup query below; otherwise duplicate alias_id
    # rows can be staged and only fail at commit with UNIQUE constraint errors.
    db.flush()

    key_to_alias_name: dict[str, str] = {}
    for raw in alias_names:
        alias_name = str(raw or "").strip()
        if not alias_name:
            continue
        for alias_key in _build_ingredient_alias_keys(alias_name):
            if alias_key not in key_to_alias_name:
                key_to_alias_name[alias_key] = alias_name
    if not key_to_alias_name:
        return

    existing_rows = db.execute(
        select(IngredientLibraryAlias)
        .where(IngredientLibraryAlias.category == normalized_category)
        .where(IngredientLibraryAlias.alias_key.in_(list(key_to_alias_name.keys())))
    ).scalars().all()
    existing_map = {str(row.alias_key): row for row in existing_rows}
    now = now_iso()
    redirected_old_ids: set[str] = set()

    for alias_key, alias_name in key_to_alias_name.items():
        row = existing_map.get(alias_key)
        existing_target_id = str(row.ingredient_id or "").strip().lower() if row is not None else ""
        if row is not None and existing_target_id != target_id and existing_target_id not in redirected_old_ids:
            _upsert_ingredient_redirect(
                db=db,
                category=normalized_category,
                old_ingredient_id=existing_target_id,
                new_ingredient_id=target_id,
                reason=f"alias_key={alias_key}",
            )
            redirected_old_ids.add(existing_target_id)

        if row is None:
            row = IngredientLibraryAlias(
                alias_id=_build_ingredient_alias_id(category=normalized_category, alias_key=alias_key),
                category=normalized_category,
                alias_key=alias_key,
                alias_name=alias_name,
                ingredient_id=target_id,
                confidence=100,
                resolver=str(resolver or "").strip() or None,
                created_at=now,
                updated_at=now,
            )
        else:
            row.alias_name = alias_name
            row.ingredient_id = target_id
            row.confidence = 100
            row.resolver = str(resolver or "").strip() or row.resolver
            row.updated_at = now
        db.add(row)


def _resolve_ingredient_id_redirect(
    *,
    db: Session,
    category: str,
    ingredient_id: str,
) -> str:
    current = str(ingredient_id or "").strip().lower()
    if not current:
        return current
    normalized_category = str(category or "").strip().lower()
    seen: set[str] = set()
    for _ in range(4):
        if current in seen:
            break
        seen.add(current)
        row = db.get(IngredientLibraryRedirect, current)
        if row is None:
            break
        if str(row.category or "").strip().lower() != normalized_category:
            break
        target = str(row.new_ingredient_id or "").strip().lower()
        if not target or target == current:
            break
        current = target
    return current


def _ensure_ingredient_index_table(db: Session) -> None:
    bind = db.get_bind()
    IngredientLibraryIndex.__table__.create(bind=bind, checkfirst=True)


def _ensure_ingredient_alias_tables(db: Session) -> None:
    bind = db.get_bind()
    IngredientLibraryAlias.__table__.create(bind=bind, checkfirst=True)
    IngredientLibraryRedirect.__table__.create(bind=bind, checkfirst=True)


def _ensure_ingredient_build_job_table(db: Session) -> None:
    bind = db.get_bind()
    IngredientLibraryBuildJob.__table__.create(bind=bind, checkfirst=True)
    inspector = inspect(bind)
    columns = {item["name"] for item in inspector.get_columns("ingredient_library_build_jobs")}
    statements: list[str] = []
    if "normalization_packages_json" not in columns:
        statements.append("ALTER TABLE ingredient_library_build_jobs ADD COLUMN normalization_packages_json TEXT NOT NULL DEFAULT '[]'")
    if "live_text_json" not in columns:
        statements.append("ALTER TABLE ingredient_library_build_jobs ADD COLUMN live_text_json TEXT")
    if statements:
        with bind.begin() as conn:
            for stmt in statements:
                conn.execute(text(stmt))


def _ensure_product_route_mapping_index_table(db: Session) -> None:
    bind = db.get_bind()
    ProductRouteMappingIndex.__table__.create(bind=bind, checkfirst=True)


def _ensure_product_analysis_index_table(db: Session) -> None:
    bind = db.get_bind()
    ProductAnalysisIndex.__table__.create(bind=bind, checkfirst=True)


def _load_ingredient_index_map(db: Session, ingredient_ids: list[str]) -> dict[str, IngredientLibraryIndex]:
    ids = [str(item or "").strip() for item in ingredient_ids if str(item or "").strip()]
    if not ids:
        return {}
    out: dict[str, IngredientLibraryIndex] = {}
    chunk_size = 500
    for idx in range(0, len(ids), chunk_size):
        chunk = ids[idx : idx + chunk_size]
        rows = db.execute(
            select(IngredientLibraryIndex).where(IngredientLibraryIndex.ingredient_id.in_(chunk))
        ).scalars().all()
        for row in rows:
            out[str(row.ingredient_id)] = row
    return out


def _upsert_ingredient_index_from_scan(
    *,
    existing: IngredientLibraryIndex | None,
    category: str,
    ingredient_id: str,
    ingredient_name: str,
    ingredient_key: str,
    source_trace_ids: list[str],
) -> IngredientLibraryIndex:
    now = now_iso()
    rec = existing
    if rec is None:
        rec = IngredientLibraryIndex(
            ingredient_id=ingredient_id,
            category=category,
            ingredient_name=ingredient_name,
            ingredient_key=ingredient_key,
            status="pending",
            storage_path=None,
            model=None,
            source_trace_ids_json="[]",
            hit_count=0,
            first_seen_at=now,
            last_seen_at=now,
            last_generated_at=None,
            last_error=None,
        )
    else:
        rec.category = category
        rec.ingredient_name = ingredient_name
        rec.ingredient_key = ingredient_key
        if not str(rec.first_seen_at or "").strip():
            rec.first_seen_at = now
        rec.last_seen_at = now

    merged_trace_ids = _merge_unique_trace_ids(
        _parse_trace_ids_json(rec.source_trace_ids_json),
        source_trace_ids,
    )
    rec.source_trace_ids_json = json.dumps(merged_trace_ids, ensure_ascii=False)
    rec.hit_count = len(merged_trace_ids)
    return rec


def _backfill_ingredient_index_from_storage(db: Session, category: str | None) -> int:
    rel_paths = _iter_ingredient_profile_rel_paths(category=category)
    if not rel_paths:
        return 0

    _ensure_ingredient_alias_tables(db)
    docs: list[tuple[str, dict[str, Any]]] = []
    ingredient_ids: list[str] = []
    for rel_path in rel_paths:
        doc = _load_ingredient_profile_doc(rel_path=rel_path)
        ingredient_id = _required_text_field(doc, "id")
        ingredient_ids.append(ingredient_id)
        docs.append((rel_path, doc))

    index_map = _load_ingredient_index_map(db=db, ingredient_ids=ingredient_ids)
    touched = 0

    for rel_path, doc in docs:
        ingredient_id = _required_text_field(doc, "id")
        category_name = _required_text_field(doc, "category").lower()
        if category_name not in VALID_CATEGORIES:
            raise HTTPException(status_code=500, detail=f"Invalid category in ingredient profile: {category_name}.")
        ingredient_name = _required_text_field(doc, "ingredient_name")
        ingredient_key = str(doc.get("ingredient_key") or "").strip() or _normalize_ingredient_key(ingredient_name)
        source_trace_ids = _strict_str_list(doc.get("source_trace_ids"), field_name="source_trace_ids")
        generated_at = str(doc.get("generated_at") or "").strip() or now_iso()

        generator = doc.get("generator")
        if generator is None:
            generator = {}
        if not isinstance(generator, dict):
            raise HTTPException(status_code=500, detail=f"Invalid generator format in ingredient profile: {rel_path}.")
        model = str(generator.get("model") or "").strip() or None

        existing = index_map.get(ingredient_id)
        rec = _upsert_ingredient_index_from_scan(
            existing=existing,
            category=category_name,
            ingredient_id=ingredient_id,
            ingredient_name=ingredient_name,
            ingredient_key=ingredient_key,
            source_trace_ids=source_trace_ids,
        )
        rec.status = "ready"
        rec.storage_path = rel_path
        rec.model = model
        rec.last_generated_at = generated_at
        rec.last_error = None
        if not str(rec.first_seen_at or "").strip():
            rec.first_seen_at = generated_at
        db.add(rec)
        index_map[ingredient_id] = rec
        alias_names = [ingredient_name]
        ingredient_name_en = str(doc.get("ingredient_name_en") or "").strip()
        if ingredient_name_en:
            alias_names.append(ingredient_name_en)
        for sample in doc.get("source_samples") or []:
            if not isinstance(sample, dict):
                continue
            sample_ing = sample.get("ingredient")
            if isinstance(sample_ing, dict):
                sample_name = str(sample_ing.get("name") or "").strip()
                if sample_name:
                    alias_names.append(sample_name)
                sample_name_en = str(sample_ing.get("name_en") or sample_ing.get("inci") or "").strip()
                if sample_name_en:
                    alias_names.append(sample_name_en)
        _upsert_ingredient_aliases(
            db=db,
            category=category_name,
            ingredient_id=ingredient_id,
            alias_names=alias_names,
            resolver="storage_backfill",
        )
        touched += 1

    if touched:
        db.commit()
    return touched


def _parse_trace_ids_json(value: str | None) -> list[str]:
    raw = str(value or "").strip()
    if not raw:
        return []
    try:
        parsed = json.loads(raw)
    except Exception:
        return []
    if not isinstance(parsed, list):
        return []
    out: list[str] = []
    for item in parsed:
        text = str(item or "").strip()
        if not text:
            continue
        out.append(text)
    return list(dict.fromkeys(out))


def _merge_unique_trace_ids(left: list[str], right: list[str]) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()
    for item in [*left, *right]:
        text = str(item or "").strip()
        if not text or text in seen:
            continue
        seen.add(text)
        out.append(text)
    return out


def _emit_progress(event_callback: Callable[[dict[str, Any]], None] | None, payload: dict[str, Any]) -> None:
    if not event_callback:
        return
    try:
        event_callback(payload)
    except Exception:
        return


def _sse_iter(events: queue.Queue[tuple[str, dict[str, Any]] | None]):
    while True:
        try:
            item = events.get(timeout=2)
        except queue.Empty:
            yield ": keep-alive\n\n"
            continue
        if item is None:
            break
        event, payload = item
        yield f"event: {event}\ndata: {json.dumps(payload, ensure_ascii=False)}\n\n"


def _normalize_tags(tags: list[str]) -> list[str]:
    out: list[str] = []
    seen = set()
    for raw in tags:
        item = str(raw).strip()
        if not item or item in seen:
            continue
        seen.add(item)
        out.append(item)
        if len(out) >= 20:
            break
    return out

def _row_to_card(r: ProductIndex) -> ProductCard:
    try:
        tags = json.loads(r.tags_json or "[]")
        if not isinstance(tags, list):
            tags = []
    except json.JSONDecodeError:
        tags = []

    preferred_image_rel = preferred_image_rel_path(str(r.image_path or "").strip())
    return ProductCard(
        id=r.id,
        category=r.category,
        brand=r.brand,
        name=r.name,
        one_sentence=r.one_sentence,
        tags=tags,
        image_url=f"/{preferred_image_rel}" if preferred_image_rel else None,
        created_at=r.created_at,
    )
