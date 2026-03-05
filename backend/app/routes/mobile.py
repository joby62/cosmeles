import hashlib
import json
import queue
import threading
from collections import defaultdict
from itertools import combinations
from pathlib import Path
from uuid import uuid4
from typing import Any, Callable, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session, sessionmaker

from app.ai.errors import AIServiceError
from app.ai.orchestrator import run_capability_now
from app.constants import VALID_CATEGORIES, MOBILE_RULES_VERSION, ROUTE_MAPPING_SUPPORTED_CATEGORIES
from app.db.models import (
    MobileBagItem,
    MobileCompareSessionIndex,
    MobileCompareUsageStat,
    MobileSelectionSession,
    ProductFeaturedSlot,
    ProductIndex,
    ProductRouteMappingIndex,
)
from app.db.session import get_db
from app.schemas import (
    MobileCompareBatchDeleteRequest,
    MobileCompareBatchDeleteResponse,
    MobileBagDeleteResponse,
    MobileBagItem as MobileBagItemView,
    MobileBagListResponse,
    MobileBagUpsertRequest,
    MobileCompareBootstrapResponse,
    MobileCompareCategoryItem,
    MobileCompareEventRequest,
    MobileCompareIngredientDiff,
    MobileCompareIngredientOrderDiff,
    MobileCompareFunctionRankDiff,
    MobileCompareJobRequest,
    MobileCompareJobTargetInput,
    MobileCompareLibraryProductItem,
    MobileCompareOverallVerdict,
    MobileComparePairResult,
    MobileComparePersonalization,
    MobileCompareProfileBootstrap,
    MobileCompareProductLibrary,
    MobileCompareRecommendationBootstrap,
    MobileCompareResultResponse,
    MobileCompareResultSection,
    MobileCompareSessionError,
    MobileCompareSessionResponse,
    MobileCompareSessionResultBrief,
    MobileCompareSourceGuide,
    MobileCompareTargetProduct,
    MobileCompareTransparency,
    MobileCompareUploadResponse,
    MobileCompareVerdict,
    MobileSelectionChoice,
    MobileSelectionBatchDeleteRequest,
    MobileSelectionBatchDeleteResponse,
    MobileSelectionPinRequest,
    MobileSelectionLinks,
    MobileSelectionResolveRequest,
    MobileSelectionResolveResponse,
    MobileSelectionRoute,
    MobileSelectionRuleHit,
    MobileWikiCategoryFacet,
    MobileWikiProductDetailItem,
    MobileWikiProductDetailResponse,
    MobileWikiProductItem,
    MobileWikiProductListResponse,
    MobileWikiSubtypeFacet,
    ProductDoc,
    ProductCard,
)
from app.services.doubao_pipeline_service import DoubaoPipelineService
from app.services.parser import normalize_doc
from app.services.storage import (
    exists_rel_path,
    load_json,
    new_id,
    now_iso,
    remove_rel_dir,
    save_doubao_artifact,
    save_image,
)
from app.settings import settings

router = APIRouter(prefix="/api/mobile", tags=["mobile"])

MOBILE_OWNER_COOKIE_NAME = "mx_device_id"
MOBILE_OWNER_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365 * 2
MOBILE_OWNER_TYPE_DEVICE = "device"

MOBILE_COMPARE_VERSION = "2026-03-03.3"
MOBILE_COMPARE_HEARTBEAT_SECONDS = 2
MOBILE_COMPARE_SESSION_STAGE = "mobile_compare_session"
MOBILE_COMPARE_RESULT_STAGE = "mobile_compare_result"
MOBILE_COMPARE_STAGE_META: dict[str, str] = {
    "prepare": "准备对比任务",
    "resolve_targets": "读取待对比产品",
    "resolve_target": "整理产品信息",
    "stage1_vision": "识别图片文字",
    "stage2_struct": "结构化成分信息",
    "pair_compare": "生成两两分析",
    "finalize": "整理最终结论",
    "done": "对比完成",
}

CATEGORY_LABELS_ZH: dict[str, str] = {
    "shampoo": "洗发水",
    "bodywash": "沐浴露",
    "conditioner": "护发素",
    "lotion": "润肤霜",
    "cleanser": "洗面奶",
}
ROUTE_MAPPED_CATEGORIES = {"shampoo", "bodywash"}
CATEGORY_LEVEL_TARGET_KEY = "__category__"

CATEGORY_ALIASES: dict[str, str] = {
    "shampoo": "shampoo",
    "洗发水": "shampoo",
    "bodywash": "bodywash",
    "沐浴露": "bodywash",
    "沐浴乳": "bodywash",
    "conditioner": "conditioner",
    "护发素": "conditioner",
    "lotion": "lotion",
    "润肤霜": "lotion",
    "身体乳": "lotion",
    "cleanser": "cleanser",
    "洗面奶": "cleanser",
    "洁面乳": "cleanser",
}

SHAMPOO_Q1_LABELS = {
    "A": "一天不洗就塌/油",
    "B": "2-3天洗一次正好",
    "C": "3天以上不洗也不油",
}
SHAMPOO_Q2_LABELS = {
    "A": "有头屑且发痒",
    "B": "头皮发红/刺痛/长痘",
    "C": "无特殊感觉",
}
SHAMPOO_Q3_LABELS = {
    "A": "频繁染烫/干枯易断",
    "B": "细软塌/贴头皮",
    "C": "原生发/健康",
}
SHAMPOO_BUNDLE_TITLES = {
    "deep-oil-control": "深层控油型",
    "anti-dandruff-itch": "去屑止痒型",
    "gentle-soothing": "温和舒缓型",
    "deep-repair": "深度修护型",
    "volume-support": "蓬松支撑型",
}
SHAMPOO_ROUTE_DECISIONS: dict[str, dict[str, str | None]] = {
    "fast-anti-dandruff": {
        "bundle_key": "anti-dandruff-itch",
        "base_filter": "Q1 底色保留当前清洁强度，优先保证抗真菌活性发挥。",
        "pain_filter": "Q2 触发“有屑且痒”快路径，直接进入去屑止痒线。",
        "bonus_filter": "快路径已完成，不再继续 Q3。",
    },
    "fast-sensitive-soothe": {
        "bundle_key": "gentle-soothing",
        "base_filter": "Q1 底色回退到低刺激清洁框架。",
        "pain_filter": "Q2 触发“发红/刺痛”快路径，优先舒缓与屏障修护。",
        "bonus_filter": "快路径已完成，不再继续 Q3。",
    },
    "oil-repair-balance": {
        "bundle_key": "deep-repair",
        "base_filter": "Q1=油性，清洁底色仍要保持对头皮油脂的控制。",
        "pain_filter": "Q2 无特殊不适，继续以发丝状态做细化。",
        "bonus_filter": "Q3=受损，添加修护插件并建议分区洗。",
    },
    "oil-lightweight-volume": {
        "bundle_key": "volume-support",
        "base_filter": "Q1=油性，保持清爽底色。",
        "pain_filter": "Q2 无特殊不适，进入发质插件阶段。",
        "bonus_filter": "Q3=细软塌，锁定蓬松支撑插件。",
    },
    "oil-control-clean": {
        "bundle_key": "deep-oil-control",
        "base_filter": "Q1=油性，底色走高效控油清洁。",
        "pain_filter": "Q2 无特殊不适，不需要药理去屑或舒缓优先。",
        "bonus_filter": "Q3=健康发丝，以控油稳定为主。",
    },
    "balance-repair": {
        "bundle_key": "deep-repair",
        "base_filter": "Q1=平衡节奏，底色保持温和。",
        "pain_filter": "Q2 无特殊不适，继续按发丝状态分流。",
        "bonus_filter": "Q3=受损，进入深度修护线。",
    },
    "balance-lightweight": {
        "bundle_key": "volume-support",
        "base_filter": "Q1=平衡节奏，清洁不过度。",
        "pain_filter": "Q2 无特殊不适，继续按发质定位。",
        "bonus_filter": "Q3=细软塌，进入蓬松支撑线。",
    },
    "balance-simple": {
        "bundle_key": "gentle-soothing",
        "base_filter": "Q1=平衡节奏，优先稳定可持续。",
        "pain_filter": "Q2 无头皮困扰，无需功效线加码。",
        "bonus_filter": "Q3=健康发丝，收敛到温和维稳线。",
    },
    "moisture-repair": {
        "bundle_key": "deep-repair",
        "base_filter": "Q1=低出油，底色以滋润舒适为主。",
        "pain_filter": "Q2 无头皮困扰，继续按发丝状态判断。",
        "bonus_filter": "Q3=受损，锁定修护与补脂。",
    },
    "moisture-lightweight": {
        "bundle_key": "volume-support",
        "base_filter": "Q1=低出油，仍需避免发根负担过重。",
        "pain_filter": "Q2 无特殊不适，进入发质插件阶段。",
        "bonus_filter": "Q3=细软塌，优先轻盈与支撑。",
    },
    "moisture-gentle": {
        "bundle_key": "gentle-soothing",
        "base_filter": "Q1=低出油，底色优先温和舒适。",
        "pain_filter": "Q2 无明显困扰，维持低刺激框架。",
        "bonus_filter": "Q3=健康发丝，避免功能堆叠。",
    },
}

BODYWASH_Q1_LABELS = {
    "A": "干燥寒冷",
    "B": "干燥炎热",
    "C": "潮湿闷热",
    "D": "潮湿寒冷",
}
BODYWASH_Q2_LABELS = {
    "A": "极度敏感",
    "B": "屏障健康",
}
BODYWASH_Q3_LABELS = {
    "A": "出油旺盛",
    "B": "缺油干涩",
    "C": "角质堆积（鸡皮/厚茧）",
    "D": "状态正常（无明显痛点）",
}
BODYWASH_Q4_LABELS = {
    "A": "清爽干脆",
    "B": "柔滑滋润",
}
BODYWASH_Q5_LABELS = {
    "A": "极致纯净",
    "B": "情绪留香",
}
BODYWASH_ROUTE_CATEGORY = {
    "rescue": "恒温舒缓修护型",
    "purge": "水杨酸净彻控油型",
    "polish": "乳酸尿素更新型",
    "glow": "氨基酸亮肤型",
    "shield": "脂类补充油膏型",
    "vibe": "轻盈香氛平衡型",
}

CONDITIONER_LABELS = {
    "target": {
        "tangle": "打结难梳",
        "frizz": "毛躁炸开",
        "dry-ends": "发尾干硬分叉",
        "flat-roots": "贴头皮没蓬松",
    },
    "hair": {
        "short": "短发或中短",
        "mid-long": "中长发",
        "long-damaged": "长发/经常烫染",
        "fine-flat": "细软扁塌",
    },
    "use": {
        "tips-quick": "只抹发尾，快冲",
        "hold-1-3": "停留 1-3 分钟",
        "more-for-smooth": "用量偏多，追求更顺",
        "touch-scalp": "常不小心碰到头皮",
    },
    "avoid": {
        "still-rough": "冲完还是涩",
        "next-day-flat": "第二天就塌",
        "strong-fragrance": "香味太重",
        "residue-film": "有残留膜感",
    },
}
CONDITIONER_TARGET_TITLE = {
    "tangle": "顺滑梳理",
    "frizz": "控躁服帖",
    "dry-ends": "尾段修护",
    "flat-roots": "轻盈蓬松",
}

LOTION_LABELS = {
    "group": {
        "dry-tight": "洗后常紧绷、偏干",
        "rough-dull": "摸起来粗糙、缺光泽",
        "sensitive-red": "容易泛红或刺痒",
        "stable-maintain": "整体稳定，想长期维护",
    },
    "issue": {
        "itch-flake": "干痒/轻微起屑",
        "rough-patch": "局部粗糙（手肘膝盖）",
        "dull-no-soft": "不够细腻柔软",
        "none": "没有明显困扰",
    },
    "scene": {
        "after-shower": "洗澡后马上用",
        "dry-cold": "换季/干冷时用",
        "ac-room": "空调环境白天用",
        "night-repair": "夜间修护用",
    },
    "avoid": {
        "sticky-greasy": "黏腻厚重",
        "strong-fragrance": "香味太重",
        "active-too-much": "活性叠加太多",
        "none": "没有特别排除",
    },
}
LOTION_GROUP_TITLE = {
    "dry-tight": "干燥紧绷路线",
    "rough-dull": "粗糙暗沉路线",
    "sensitive-red": "敏感脆弱路线",
    "stable-maintain": "稳定维护路线",
}

CLEANSER_LABELS = {
    "skin": {
        "oily-acne": "偏油、易闷痘",
        "combo": "混合肌",
        "dry-sensitive": "偏干、易敏感",
        "stable": "整体稳定",
    },
    "issue": {
        "oil-shine": "油光和闷感",
        "tight-after": "洗后紧绷",
        "sting-red": "刺痛/泛红",
        "residue": "防晒残留洗不净",
    },
    "scene": {
        "morning-quick": "早晨快洗",
        "night-clean": "晚间日常清洁",
        "post-workout": "运动后清洁",
        "after-sunscreen": "防晒后清洁",
    },
    "avoid": {
        "over-clean": "清洁过猛",
        "strong-fragrance": "香味太重",
        "low-foam": "低泡无反馈",
        "complex-formula": "配方过于复杂",
    },
}
CLEANSER_SKIN_TITLE = {
    "oily-acne": "油痘清衡路线",
    "combo": "混合平衡路线",
    "dry-sensitive": "干敏稳护路线",
    "stable": "稳定维持路线",
}


@router.post("/selection/resolve", response_model=MobileSelectionResolveResponse)
def resolve_mobile_selection(
    payload: MobileSelectionResolveRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    category = str(payload.category or "").strip().lower()
    if category not in VALID_CATEGORIES:
        raise HTTPException(status_code=400, detail=f"Invalid category: {category}.")

    owner_type, owner_id, owner_cookie_new = _resolve_owner(request)
    answers = _normalize_answers(payload.answers)
    resolved = _resolve_selection(category=category, answers=answers)
    answers_hash = _build_answers_hash(category=category, answers=resolved["answers"])

    if payload.reuse_existing:
        existing = db.execute(
            select(MobileSelectionSession)
            .where(MobileSelectionSession.owner_type == owner_type)
            .where(MobileSelectionSession.owner_id == owner_id)
            .where(MobileSelectionSession.category == category)
            .where(MobileSelectionSession.rules_version == MOBILE_RULES_VERSION)
            .where(MobileSelectionSession.answers_hash == answers_hash)
            .where(MobileSelectionSession.deleted_at.is_(None))
            .order_by(MobileSelectionSession.created_at.desc())
            .limit(1)
        ).scalars().first()
        if existing:
            if owner_cookie_new:
                _set_owner_cookie(response, owner_id, request)
            stored = _row_to_mobile_response(existing)
            return stored.model_copy(update={"reused": True})

    target_type_key = _selection_target_type_key(category=category, route_key=str(resolved["route_key"]))
    if not target_type_key:
        raise HTTPException(
            status_code=422,
            detail=f"Cannot resolve target_type_key for category='{category}', route='{resolved['route_key']}'.",
        )
    featured_query_error: str | None = None
    try:
        product_row = _pick_featured_product_row(
            db=db,
            category=category,
            target_type_key=target_type_key,
        )
    except HTTPException as exc:
        featured_query_error = str(exc.detail)
        product_row = None

    if product_row is None:
        product_row = _pick_route_mapped_product_row(
            db=db,
            category=category,
            target_type_key=target_type_key,
            rules_version=MOBILE_RULES_VERSION,
        )
    if product_row is None:
        product_row = _pick_product_row(db=db, category=category)
    if product_row is None:
        if featured_query_error:
            raise HTTPException(status_code=500, detail=featured_query_error)
        raise HTTPException(status_code=422, detail=f"No product found for category '{category}'.")
    product = _row_to_product_card(product_row)

    created_at = now_iso()
    session_id = str(uuid4())
    result = MobileSelectionResolveResponse(
        status="ok",
        session_id=session_id,
        reused=False,
        is_pinned=False,
        pinned_at=None,
        category=category,
        rules_version=MOBILE_RULES_VERSION,
        route=MobileSelectionRoute(key=resolved["route_key"], title=resolved["route_title"]),
        choices=[MobileSelectionChoice.model_validate(item) for item in resolved["choices"]],
        rule_hits=[MobileSelectionRuleHit.model_validate(item) for item in resolved["rule_hits"]],
        recommended_product=product,
        links=MobileSelectionLinks(
            product=f"/product/{product.id}",
            wiki=resolved["wiki_href"],
        ),
        created_at=created_at,
    )

    row = MobileSelectionSession(
        id=session_id,
        owner_type=owner_type,
        owner_id=owner_id,
        category=category,
        rules_version=MOBILE_RULES_VERSION,
        answers_hash=answers_hash,
        route_key=resolved["route_key"],
        route_title=resolved["route_title"],
        product_id=product.id,
        answers_json=json.dumps(resolved["answers"], ensure_ascii=False),
        result_json=json.dumps(result.model_dump(), ensure_ascii=False),
        is_pinned=False,
        pinned_at=None,
        created_at=created_at,
    )
    db.add(row)
    db.commit()
    if owner_cookie_new:
        _set_owner_cookie(response, owner_id, request)
    return result


@router.get("/selection/sessions/{session_id}", response_model=MobileSelectionResolveResponse)
def get_mobile_selection_session(
    session_id: str,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    owner_type, owner_id, owner_cookie_new = _resolve_owner(request)
    row = db.execute(
        select(MobileSelectionSession)
        .where(MobileSelectionSession.id == session_id)
        .where(MobileSelectionSession.owner_type == owner_type)
        .where(MobileSelectionSession.owner_id == owner_id)
        .where(MobileSelectionSession.deleted_at.is_(None))
        .limit(1)
    ).scalars().first()
    if not row:
        raise HTTPException(status_code=404, detail="Selection session not found.")
    if owner_cookie_new:
        _set_owner_cookie(response, owner_id, request)
    return _row_to_mobile_response(row)


@router.get("/selection/sessions", response_model=list[MobileSelectionResolveResponse])
def list_mobile_selection_sessions(
    request: Request,
    response: Response,
    category: str | None = Query(None),
    offset: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    owner_type, owner_id, owner_cookie_new = _resolve_owner(request)
    stmt = (
        select(MobileSelectionSession)
        .where(MobileSelectionSession.owner_type == owner_type)
        .where(MobileSelectionSession.owner_id == owner_id)
        .where(MobileSelectionSession.deleted_at.is_(None))
    )
    if category:
        normalized = str(category).strip().lower()
        if normalized not in VALID_CATEGORIES:
            raise HTTPException(status_code=400, detail=f"Invalid category: {normalized}.")
        stmt = stmt.where(MobileSelectionSession.category == normalized)
    rows = db.execute(
        stmt.order_by(*_selection_session_order_expr()).offset(offset).limit(limit)
    ).scalars().all()
    if owner_cookie_new:
        _set_owner_cookie(response, owner_id, request)
    return [_row_to_mobile_response(row) for row in rows]


@router.post("/selection/sessions/{session_id}/pin", response_model=MobileSelectionResolveResponse)
def pin_mobile_selection_session(
    session_id: str,
    payload: MobileSelectionPinRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    owner_type, owner_id, owner_cookie_new = _resolve_owner(request)
    row = db.execute(
        select(MobileSelectionSession)
        .where(MobileSelectionSession.id == session_id)
        .where(MobileSelectionSession.owner_type == owner_type)
        .where(MobileSelectionSession.owner_id == owner_id)
        .where(MobileSelectionSession.deleted_at.is_(None))
        .limit(1)
    ).scalars().first()
    if row is None:
        raise HTTPException(status_code=404, detail="Selection session not found.")

    should_pin = bool(payload.pinned)
    row.is_pinned = should_pin
    row.pinned_at = now_iso() if should_pin else None
    db.commit()
    db.refresh(row)

    if owner_cookie_new:
        _set_owner_cookie(response, owner_id, request)
    return _row_to_mobile_response(row)


@router.post(
    "/selection/sessions/batch/delete",
    response_model=MobileSelectionBatchDeleteResponse,
)
def batch_delete_mobile_selection_sessions(
    payload: MobileSelectionBatchDeleteRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    owner_type, owner_id, owner_cookie_new = _resolve_owner(request)
    normalized_ids = _normalize_session_ids(payload.ids)
    if not normalized_ids:
        raise HTTPException(status_code=400, detail="ids cannot be empty.")

    rows = db.execute(
        select(MobileSelectionSession).where(MobileSelectionSession.id.in_(normalized_ids))
    ).scalars().all()
    by_id = {row.id: row for row in rows}

    deleted_ids: list[str] = []
    not_found_ids: list[str] = []
    forbidden_ids: list[str] = []
    deleted_at = now_iso()
    deleted_by = f"{owner_type}:{owner_id}"
    dirty = False

    for session_id in normalized_ids:
        row = by_id.get(session_id)
        if row is None or row.deleted_at is not None:
            not_found_ids.append(session_id)
            continue
        if row.owner_type != owner_type or row.owner_id != owner_id:
            forbidden_ids.append(session_id)
            continue
        row.deleted_at = deleted_at
        row.deleted_by = deleted_by
        deleted_ids.append(session_id)
        dirty = True

    if dirty:
        db.commit()
    if owner_cookie_new:
        _set_owner_cookie(response, owner_id, request)
    return MobileSelectionBatchDeleteResponse(
        status="ok",
        deleted_ids=deleted_ids,
        not_found_ids=not_found_ids,
        forbidden_ids=forbidden_ids,
    )


@router.get("/wiki/products", response_model=MobileWikiProductListResponse)
def list_mobile_wiki_products(
    request: Request,
    response: Response,
    category: str | None = Query(None),
    target_type_key: str | None = Query(None),
    q: str | None = Query(None, description="search brand/name/summary"),
    offset: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=200),
    db: Session = Depends(get_db),
):
    _, owner_id, owner_cookie_new = _resolve_owner(request)
    normalized_category = str(category or "").strip().lower() or None
    if normalized_category and normalized_category not in VALID_CATEGORIES:
        raise HTTPException(status_code=400, detail=f"Invalid category: {normalized_category}.")

    normalized_target_type_key = str(target_type_key or "").strip() or None
    if normalized_target_type_key and not normalized_category:
        raise HTTPException(status_code=400, detail="target_type_key requires category.")
    if normalized_target_type_key and normalized_category and normalized_category not in ROUTE_MAPPED_CATEGORIES:
        if normalized_target_type_key != CATEGORY_LEVEL_TARGET_KEY:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Invalid target_type_key '{normalized_target_type_key}' for category '{normalized_category}'. "
                    f"Use '{CATEGORY_LEVEL_TARGET_KEY}'."
                ),
            )
    if normalized_target_type_key and normalized_category in ROUTE_MAPPED_CATEGORIES:
        if normalized_target_type_key == CATEGORY_LEVEL_TARGET_KEY:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Invalid target_type_key '{normalized_target_type_key}' for route-mapped category "
                    f"'{normalized_category}'."
                ),
            )

    normalized_query = str(q or "").strip()
    stmt = select(ProductIndex)
    if normalized_category:
        stmt = stmt.where(ProductIndex.category == normalized_category)
    if normalized_query:
        like = f"%{normalized_query}%"
        stmt = stmt.where(
            (ProductIndex.name.like(like))
            | (ProductIndex.brand.like(like))
            | (ProductIndex.one_sentence.like(like))
        )
    rows = db.execute(stmt.order_by(ProductIndex.created_at.desc())).scalars().all()
    rows = [row for row in rows if exists_rel_path(str(row.json_path or ""))]

    product_ids = [str(row.id or "").strip() for row in rows if str(row.id or "").strip()]
    route_mapping_by_product_id = _route_mapping_by_product_id(db=db, product_ids=product_ids)
    featured_by_slot = _featured_slot_by_slot_key(db=db, categories={str(row.category or "").strip().lower() for row in rows})

    category_counts: dict[str, int] = defaultdict(int)
    subtype_counts: dict[str, tuple[str, int]] = {}
    built_items: list[MobileWikiProductItem] = []

    for row in rows:
        category_key = str(row.category or "").strip().lower()
        if not category_key:
            continue
        mapping = route_mapping_by_product_id.get(str(row.id))
        item = _build_mobile_wiki_product_item(
            row=row,
            mapping=mapping,
            featured_by_slot=featured_by_slot,
        )
        category_counts[category_key] += 1

        if normalized_category == category_key and item.target_type_level == "subcategory":
            sub_key = str(item.target_type_key or "").strip()
            sub_label = str(item.target_type_title or "").strip()
            if sub_key and sub_label:
                prev = subtype_counts.get(sub_key)
                if prev:
                    subtype_counts[sub_key] = (sub_label, prev[1] + 1)
                else:
                    subtype_counts[sub_key] = (sub_label, 1)

        if normalized_target_type_key and item.target_type_key != normalized_target_type_key:
            continue
        built_items.append(item)

    categories = [
        MobileWikiCategoryFacet(
            key=cat,
            label=CATEGORY_LABELS_ZH.get(cat, cat),
            count=count,
        )
        for cat, count in sorted(category_counts.items(), key=lambda x: (-x[1], x[0]))
    ]
    subtypes = [
        MobileWikiSubtypeFacet(
            key=key,
            label=value[0],
            count=value[1],
        )
        for key, value in sorted(subtype_counts.items(), key=lambda x: (-x[1][1], x[0]))
    ]

    total = len(built_items)
    sliced = built_items[offset : offset + limit]
    if owner_cookie_new:
        _set_owner_cookie(response, owner_id, request)
    return MobileWikiProductListResponse(
        status="ok",
        category=normalized_category,
        target_type_key=normalized_target_type_key,
        query=normalized_query or None,
        total=total,
        offset=offset,
        limit=limit,
        categories=categories,
        subtypes=subtypes,
        items=sliced,
    )


@router.get("/wiki/products/{product_id}", response_model=MobileWikiProductDetailResponse)
def get_mobile_wiki_product_detail(
    product_id: str,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    _, owner_id, owner_cookie_new = _resolve_owner(request)
    pid = str(product_id or "").strip()
    if not pid:
        raise HTTPException(status_code=400, detail="product_id is required.")
    row = db.get(ProductIndex, pid)
    if row is None:
        raise HTTPException(status_code=404, detail=f"Product '{pid}' not found.")
    json_path = str(row.json_path or "").strip()
    if not json_path or not exists_rel_path(json_path):
        raise HTTPException(status_code=404, detail=f"Product doc for '{pid}' is missing.")

    try:
        raw_doc = load_json(json_path)
        normalized_doc = normalize_doc(
            raw_doc,
            image_rel_path=str(row.image_path or "").strip() or None,
            doubao_raw=str(raw_doc.get("evidence", {}).get("doubao_raw") or ""),
        )
        doc = ProductDoc.model_validate(normalized_doc)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Invalid product doc for '{pid}': {exc}") from exc

    mapping = db.get(ProductRouteMappingIndex, pid)
    featured_by_slot = _featured_slot_by_slot_key(db=db, categories={str(row.category or "").strip().lower()})
    item = _build_mobile_wiki_product_item(
        row=row,
        mapping=mapping,
        featured_by_slot=featured_by_slot,
    )
    if owner_cookie_new:
        _set_owner_cookie(response, owner_id, request)
    return MobileWikiProductDetailResponse(
        status="ok",
        item=MobileWikiProductDetailItem(
            product=item.product,
            doc=doc,
            category_label=item.category_label,
            target_type_key=item.target_type_key,
            target_type_title=item.target_type_title,
            target_type_level=item.target_type_level,
            mapping_ready=item.mapping_ready,
            primary_confidence=item.primary_confidence,
            secondary_type_key=item.secondary_type_key,
            secondary_type_title=item.secondary_type_title,
            secondary_confidence=item.secondary_confidence,
            is_featured=item.is_featured,
        ),
    )


@router.get("/bag/items", response_model=MobileBagListResponse)
def list_mobile_bag_items(
    request: Request,
    response: Response,
    category: str | None = Query(None),
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    owner_type, owner_id, owner_cookie_new = _resolve_owner(request)
    normalized_category = str(category or "").strip().lower() or None
    if normalized_category and normalized_category not in VALID_CATEGORIES:
        raise HTTPException(status_code=400, detail=f"Invalid category: {normalized_category}.")

    stmt = (
        select(MobileBagItem)
        .where(MobileBagItem.owner_type == owner_type)
        .where(MobileBagItem.owner_id == owner_id)
    )
    if normalized_category:
        stmt = stmt.where(MobileBagItem.category == normalized_category)
    rows = (
        db.execute(
            stmt.order_by(
                MobileBagItem.updated_at.desc(),
                MobileBagItem.created_at.desc(),
                MobileBagItem.id.desc(),
            )
            .offset(offset)
            .limit(limit)
        )
        .scalars()
        .all()
    )
    item_views = _build_mobile_bag_item_views(db=db, bag_rows=rows)
    total_quantity = sum(max(1, int(item.quantity)) for item in item_views)
    if owner_cookie_new:
        _set_owner_cookie(response, owner_id, request)
    return MobileBagListResponse(
        status="ok",
        category=normalized_category,
        total_items=len(item_views),
        total_quantity=total_quantity,
        items=item_views,
    )


@router.post("/bag/items", response_model=MobileBagItemView)
def upsert_mobile_bag_item(
    payload: MobileBagUpsertRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    owner_type, owner_id, owner_cookie_new = _resolve_owner(request)
    product_id = str(payload.product_id or "").strip()
    if not product_id:
        raise HTTPException(status_code=400, detail="product_id is required.")
    product = db.get(ProductIndex, product_id)
    if product is None:
        raise HTTPException(status_code=404, detail=f"Product '{product_id}' not found.")
    if not exists_rel_path(str(product.json_path or "")):
        raise HTTPException(status_code=404, detail=f"Product doc for '{product_id}' is missing.")

    row = (
        db.execute(
            select(MobileBagItem)
            .where(MobileBagItem.owner_type == owner_type)
            .where(MobileBagItem.owner_id == owner_id)
            .where(MobileBagItem.product_id == product_id)
            .limit(1)
        )
        .scalars()
        .first()
    )
    now = now_iso()
    if row is None:
        row = MobileBagItem(
            id=str(uuid4()),
            owner_type=owner_type,
            owner_id=owner_id,
            category=str(product.category or "").strip().lower(),
            product_id=product_id,
            quantity=int(payload.quantity),
            created_at=now,
            updated_at=now,
        )
    else:
        row.quantity = min(99, max(1, int(row.quantity or 0) + int(payload.quantity)))
        row.updated_at = now
    db.add(row)
    db.commit()
    db.refresh(row)

    views = _build_mobile_bag_item_views(db=db, bag_rows=[row])
    if not views:
        raise HTTPException(status_code=500, detail=f"Failed to build bag item view for '{row.id}'.")
    if owner_cookie_new:
        _set_owner_cookie(response, owner_id, request)
    return views[0]


@router.delete("/bag/items/{item_id}", response_model=MobileBagDeleteResponse)
def delete_mobile_bag_item(
    item_id: str,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    owner_type, owner_id, owner_cookie_new = _resolve_owner(request)
    normalized_item_id = str(item_id or "").strip()
    if not normalized_item_id:
        raise HTTPException(status_code=400, detail="item_id is required.")
    row = (
        db.execute(
            select(MobileBagItem)
            .where(MobileBagItem.id == normalized_item_id)
            .where(MobileBagItem.owner_type == owner_type)
            .where(MobileBagItem.owner_id == owner_id)
            .limit(1)
        )
        .scalars()
        .first()
    )
    if row is None:
        raise HTTPException(status_code=404, detail=f"Bag item '{normalized_item_id}' not found.")
    db.delete(row)
    db.commit()
    if owner_cookie_new:
        _set_owner_cookie(response, owner_id, request)
    return MobileBagDeleteResponse(status="ok", item_id=normalized_item_id, deleted=True)


@router.get("/compare/bootstrap", response_model=MobileCompareBootstrapResponse)
def mobile_compare_bootstrap(
    request: Request,
    response: Response,
    category: str | None = Query(None),
    db: Session = Depends(get_db),
):
    owner_type, owner_id, owner_cookie_new = _resolve_owner(request)
    selected_category = _normalize_category_or_default(category)
    selected_session = _latest_selection_session(
        db=db,
        owner_type=owner_type,
        owner_id=owner_id,
        category=selected_category,
    )

    profile = MobileCompareProfileBootstrap(
        has_history_profile=selected_session is not None,
        basis=_selection_basis(selected_session),
        can_skip=False,
        last_completed_at=selected_session.created_at if selected_session else None,
        summary=_build_profile_summary_from_session(selected_session),
    )

    recommendation = MobileCompareRecommendationBootstrap(exists=False)
    if selected_session:
        resolved = _row_to_mobile_response(selected_session)
        recommendation = MobileCompareRecommendationBootstrap(
            exists=True,
            session_id=resolved.session_id,
            route_title=resolved.route.title,
            product=resolved.recommended_product,
        )

    recommendation_product_id = (
        str(recommendation.product.id)
        if recommendation.product and str(recommendation.product.id).strip()
        else None
    )
    product_library = _build_mobile_compare_product_library(
        db=db,
        category=selected_category,
        owner_type=owner_type,
        owner_id=owner_id,
        recommendation_product_id=recommendation_product_id,
    )

    out = MobileCompareBootstrapResponse(
        status="ok",
        trace_id=new_id(),
        categories=[
            MobileCompareCategoryItem(key=key, label=CATEGORY_LABELS_ZH.get(key, key), enabled=True)
            for key in ("shampoo", "bodywash", "conditioner", "lotion", "cleanser")
        ],
        selected_category=selected_category,
        profile=profile,
        recommendation=recommendation,
        product_library=product_library,
        source_guide=MobileCompareSourceGuide(
            title="上传你正在用的产品，和产品库做一次专业对比",
            value_points=[
                "看懂成分差异，不只看营销词。",
                "结合你填写的个人情况，给到可执行建议。",
                "明确告诉你更适合：继续用、替换，还是分场景并用。",
            ],
        ),
    )
    if owner_cookie_new:
        _set_owner_cookie(response, owner_id, request)
    return out


@router.post("/compare/current-product/upload", response_model=MobileCompareUploadResponse)
async def upload_mobile_compare_current_product(
    request: Request,
    response: Response,
    category: str = Form(...),
    image: UploadFile = File(...),
    brand: str | None = Form(None),
    name: str | None = Form(None),
):
    owner_type, owner_id, owner_cookie_new = _resolve_owner(request)
    normalized_category = _normalize_required_category(category)
    if not image.content_type or not image.content_type.startswith("image/"):
        raise HTTPException(
            status_code=400,
            detail={
                "code": "COMPARE_UPLOAD_INVALID_CONTENT_TYPE",
                "detail": "Only image upload is supported.",
            },
        )

    content = await image.read()
    if len(content) > settings.max_upload_bytes:
        raise HTTPException(
            status_code=413,
            detail={
                "code": "COMPARE_UPLOAD_TOO_LARGE",
                "detail": f"Image too large. Max {settings.max_upload_bytes} bytes.",
            },
        )

    upload_id = new_id()
    try:
        image_rel = save_image(
            upload_id,
            image.filename or "upload.jpg",
            content,
            content_type=image.content_type,
            subdir=f"mobile_compare/{normalized_category}",
        )
    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail={"code": "COMPARE_UPLOAD_INVALID_IMAGE", "detail": str(e)},
        ) from e

    payload = {
        "upload_id": upload_id,
        "owner_type": owner_type,
        "owner_id": owner_id,
        "category": normalized_category,
        "brand": str(brand or "").strip() or None,
        "name": str(name or "").strip() or None,
        "filename": image.filename,
        "content_type": image.content_type,
        "image_path": image_rel,
        "created_at": now_iso(),
    }
    save_doubao_artifact(upload_id, "mobile_compare_upload_meta", payload)

    if owner_cookie_new:
        _set_owner_cookie(response, owner_id, request)
    return MobileCompareUploadResponse(
        status="ok",
        trace_id=upload_id,
        upload_id=upload_id,
        category=normalized_category,
        image_path=image_rel,
        created_at=payload["created_at"],
    )


@router.post("/compare/jobs/stream")
def run_mobile_compare_job_stream(
    payload: MobileCompareJobRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    owner_type, owner_id, owner_cookie_new = _resolve_owner(request)
    category_hint = str(payload.category or "").strip().lower() or "unknown"
    compare_id = new_id()
    events: queue.Queue[tuple[str, dict[str, Any]] | None] = queue.Queue()
    SessionMaker = sessionmaker(autocommit=False, autoflush=False, bind=db.get_bind())

    def emit(event: str, data: dict[str, Any], *, db_session: Session) -> None:
        if event == "progress":
            percent_raw = data.get("percent")
            pair_index_raw = data.get("pair_index")
            pair_total_raw = data.get("pair_total")
            try:
                percent_value = int(percent_raw) if percent_raw is not None else 0
            except Exception:
                percent_value = 0
            try:
                pair_index_value = int(pair_index_raw) if pair_index_raw is not None else None
            except Exception:
                pair_index_value = None
            try:
                pair_total_value = int(pair_total_raw) if pair_total_raw is not None else None
            except Exception:
                pair_total_value = None
            _upsert_mobile_compare_session(
                compare_id=compare_id,
                owner_type=owner_type,
                owner_id=owner_id,
                category=category_hint,
                db=db_session,
                patch={
                    "status": "done" if str(data.get("stage") or "") == "done" else "running",
                    "stage": str(data.get("stage") or "").strip() or None,
                    "stage_label": str(data.get("stage_label") or "").strip() or None,
                    "message": str(data.get("message") or "").strip() or None,
                    "percent": percent_value,
                    "pair_index": pair_index_value,
                    "pair_total": pair_total_value,
                },
            )
        events.put((event, data))

    _upsert_mobile_compare_session(
        compare_id=compare_id,
        owner_type=owner_type,
        owner_id=owner_id,
        category=category_hint,
        db=db,
        patch={
            "status": "running",
            "stage": "prepare",
            "stage_label": MOBILE_COMPARE_STAGE_META.get("prepare"),
            "message": "任务已提交，正在准备分析。",
            "percent": 2,
        },
    )
    emit(
        "accepted",
        {
            "status": "accepted",
            "trace_id": compare_id,
            "compare_id": compare_id,
            "category": category_hint,
            "stage": "prepare",
            "stage_label": MOBILE_COMPARE_STAGE_META.get("prepare"),
            "message": "任务已提交，正在准备分析。",
            "percent": 2,
            "ts": now_iso(),
        },
        db_session=db,
    )

    def worker() -> None:
        local_db = SessionMaker()
        try:
            result = _run_mobile_compare_job(
                compare_id=compare_id,
                payload=payload,
                owner_type=owner_type,
                owner_id=owner_id,
                db=local_db,
                event_callback=lambda event, data: emit(event, data, db_session=local_db),
            )
            _upsert_mobile_compare_session(
                compare_id=compare_id,
                owner_type=owner_type,
                owner_id=owner_id,
                category=result.category,
                db=local_db,
                patch={
                    "status": "done",
                    "stage": "done",
                    "stage_label": MOBILE_COMPARE_STAGE_META.get("done"),
                    "message": "对比已完成。",
                    "percent": 100,
                    "pair_index": None,
                    "pair_total": None,
                    "error": None,
                    "result": {
                        "decision": result.verdict.decision,
                        "headline": result.verdict.headline,
                        "confidence": float(result.verdict.confidence or 0.0),
                        "created_at": result.created_at,
                    },
                },
            )
            emit("result", result.model_dump(), db_session=local_db)
        except HTTPException as e:
            err_payload = _compare_error_payload_from_http_exception(e)
            _upsert_mobile_compare_session(
                compare_id=compare_id,
                owner_type=owner_type,
                owner_id=owner_id,
                category=category_hint,
                db=local_db,
                patch={
                    "status": "failed",
                    "message": str(err_payload.get("detail") or "对比任务失败。"),
                    "error": err_payload,
                },
            )
            emit("error", err_payload, db_session=local_db)
        except AIServiceError as e:
            err_payload = {
                "code": e.code,
                "detail": e.message,
                "http_status": e.http_status,
                "retryable": e.http_status >= 500,
            }
            _upsert_mobile_compare_session(
                compare_id=compare_id,
                owner_type=owner_type,
                owner_id=owner_id,
                category=category_hint,
                db=local_db,
                patch={
                    "status": "failed",
                    "message": str(err_payload.get("detail") or "对比任务失败。"),
                    "error": err_payload,
                },
            )
            emit("error", err_payload, db_session=local_db)
        except Exception as e:  # pragma: no cover
            err_payload = {
                "code": "COMPARE_INTERNAL_ERROR",
                "detail": str(e),
                "http_status": 500,
                "retryable": True,
            }
            _upsert_mobile_compare_session(
                compare_id=compare_id,
                owner_type=owner_type,
                owner_id=owner_id,
                category=category_hint,
                db=local_db,
                patch={
                    "status": "failed",
                    "message": str(err_payload.get("detail") or "对比任务失败。"),
                    "error": err_payload,
                },
            )
            emit("error", err_payload, db_session=local_db)
        finally:
            emit("done", {"status": "done"}, db_session=local_db)
            events.put(None)
            local_db.close()

    threading.Thread(target=worker, daemon=True).start()

    def event_iter():
        while True:
            try:
                item = events.get(timeout=MOBILE_COMPARE_HEARTBEAT_SECONDS)
            except queue.Empty:
                yield _to_sse(
                    "heartbeat",
                    {
                        "status": "running",
                        "stage": "pair_compare",
                        "stage_label": MOBILE_COMPARE_STAGE_META.get("pair_compare"),
                        "message": "系统仍在分析中，请稍候。",
                        "ts": now_iso(),
                    },
                )
                continue
            if item is None:
                break
            event, payload_data = item
            yield _to_sse(event, payload_data)

    stream = StreamingResponse(
        event_iter(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Pragma": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
    if owner_cookie_new:
        _set_owner_cookie(stream, owner_id, request)
    return stream


@router.get("/compare/sessions", response_model=list[MobileCompareSessionResponse])
def list_mobile_compare_sessions(
    request: Request,
    response: Response,
    category: str | None = Query(None),
    offset: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    owner_type, owner_id, owner_cookie_new = _resolve_owner(request)
    normalized_category: str | None = None
    if category:
        normalized_category = str(category or "").strip().lower()
        if normalized_category not in VALID_CATEGORIES:
            raise HTTPException(status_code=400, detail=f"Invalid category: {normalized_category}.")
    records = _list_mobile_compare_sessions(
        db=db,
        owner_type=owner_type,
        owner_id=owner_id,
        category=normalized_category,
        offset=offset,
        limit=limit,
    )
    if owner_cookie_new:
        _set_owner_cookie(response, owner_id, request)
    return records


@router.post(
    "/compare/sessions/batch/delete",
    response_model=MobileCompareBatchDeleteResponse,
)
def batch_delete_mobile_compare_sessions(
    payload: MobileCompareBatchDeleteRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    owner_type, owner_id, owner_cookie_new = _resolve_owner(request)
    normalized_ids = _normalize_session_ids(payload.ids)
    if not normalized_ids:
        raise HTTPException(status_code=400, detail="ids cannot be empty.")

    rows = db.execute(
        select(MobileCompareSessionIndex).where(MobileCompareSessionIndex.compare_id.in_(normalized_ids))
    ).scalars().all()
    by_id = {str(row.compare_id): row for row in rows}

    deleted_ids: list[str] = []
    not_found_ids: list[str] = []
    forbidden_ids: list[str] = []
    removed_files = 0
    removed_dirs = 0
    dirty = False

    for compare_id in normalized_ids:
        row = by_id.get(compare_id)
        if row is None:
            not_found_ids.append(compare_id)
            continue
        if row.owner_type != owner_type or row.owner_id != owner_id:
            forbidden_ids.append(compare_id)
            continue
        db.delete(row)
        files_count, dirs_count = remove_rel_dir(f"doubao_runs/{compare_id}")
        removed_files += files_count
        removed_dirs += dirs_count
        deleted_ids.append(compare_id)
        dirty = True

    if dirty:
        db.commit()
    if owner_cookie_new:
        _set_owner_cookie(response, owner_id, request)
    return MobileCompareBatchDeleteResponse(
        status="ok",
        deleted_ids=deleted_ids,
        not_found_ids=not_found_ids,
        forbidden_ids=forbidden_ids,
        removed_files=removed_files,
        removed_dirs=removed_dirs,
    )


@router.post("/compare/sessions/reindex")
def reindex_mobile_compare_sessions(
    limit: int = Query(5000, ge=1, le=200_000),
    only_missing: bool = Query(True),
    dry_run: bool = Query(False),
    db: Session = Depends(get_db),
):
    _ensure_mobile_compare_index_tables(db)
    result = _backfill_mobile_compare_session_index_from_storage(
        db=db,
        limit=limit,
        only_missing=only_missing,
        dry_run=dry_run,
    )
    return {"status": "ok", **result}


@router.get("/compare/sessions/{compare_id}", response_model=MobileCompareSessionResponse)
def get_mobile_compare_session(
    compare_id: str,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    owner_type, owner_id, owner_cookie_new = _resolve_owner(request)
    record = _get_mobile_compare_session_record(
        db=db,
        compare_id=compare_id,
        owner_type=owner_type,
        owner_id=owner_id,
    )
    if record is None:
        raise HTTPException(status_code=404, detail="Compare session not found.")
    if owner_cookie_new:
        _set_owner_cookie(response, owner_id, request)
    return record


@router.get("/compare/results/{compare_id}", response_model=MobileCompareResultResponse)
def get_mobile_compare_result(
    compare_id: str,
    request: Request,
    response: Response,
):
    owner_type, owner_id, owner_cookie_new = _resolve_owner(request)
    rel_path = f"doubao_runs/{compare_id}/{MOBILE_COMPARE_RESULT_STAGE}.json"
    if not exists_rel_path(rel_path):
        raise HTTPException(status_code=404, detail="Compare result not found.")

    payload = load_json(rel_path)
    if str(payload.get("owner_type") or "") != owner_type or str(payload.get("owner_id") or "") != owner_id:
        raise HTTPException(status_code=404, detail="Compare result not found.")
    result_payload = payload.get("result")
    if not isinstance(result_payload, dict):
        raise HTTPException(status_code=500, detail="Compare result payload is invalid.")
    result = MobileCompareResultResponse.model_validate(result_payload)
    if owner_cookie_new:
        _set_owner_cookie(response, owner_id, request)
    return result


@router.post("/compare/events")
def record_mobile_compare_event(
    payload: MobileCompareEventRequest,
    request: Request,
    response: Response,
):
    owner_type, owner_id, owner_cookie_new = _resolve_owner(request)
    trace_id = new_id()
    save_doubao_artifact(
        trace_id,
        "mobile_compare_event",
        {
            "trace_id": trace_id,
            "owner_type": owner_type,
            "owner_id": owner_id,
            "event_name": payload.name,
            "props": payload.props,
            "created_at": now_iso(),
        },
    )
    if owner_cookie_new:
        _set_owner_cookie(response, owner_id, request)
    return {"status": "ok", "trace_id": trace_id}


def _run_mobile_compare_job(
    *,
    compare_id: str,
    payload: MobileCompareJobRequest,
    owner_type: str,
    owner_id: str,
    db: Session,
    event_callback: Callable[[str, dict[str, Any]], None],
) -> MobileCompareResultResponse:
    category = _normalize_required_category(payload.category)

    _emit_compare_progress(
        event_callback,
        trace_id=compare_id,
        stage="prepare",
        message="正在准备对比上下文。",
        percent=5,
    )

    recommendation_session = _latest_selection_session(
        db=db,
        owner_type=owner_type,
        owner_id=owner_id,
        category=category,
    )
    if recommendation_session is None:
        raise HTTPException(
            status_code=422,
            detail={
                "code": "COMPARE_RECOMMENDATION_NOT_FOUND",
                "detail": f"Category '{category}' has no historical recommendation for this device.",
                "retryable": False,
                "trace_id": compare_id,
            },
        )
    recommendation = _row_to_mobile_response(recommendation_session)

    profile_ctx = _resolve_compare_profile_context(
        category=category,
        payload=payload,
        recommendation_session=recommendation_session,
        trace_id=compare_id,
    )

    normalized_targets = _normalize_compare_targets(payload=payload, trace_id=compare_id)
    _emit_compare_progress(
        event_callback,
        trace_id=compare_id,
        stage="resolve_targets",
        message=f"已收到 {len(normalized_targets)} 款产品。",
        percent=12,
    )

    resolved_targets: list[dict[str, Any]] = []
    for idx, target in enumerate(normalized_targets, start=1):
        _emit_compare_progress(
            event_callback,
            trace_id=compare_id,
            stage="resolve_target",
            message=f"正在准备第 {idx}/{len(normalized_targets)} 款产品。",
            percent=18 + idx * 8,
        )
        target_doc_payload = _resolve_target_product_doc(
            category=category,
            target=target,
            owner_type=owner_type,
            owner_id=owner_id,
            trace_id=compare_id,
            event_callback=event_callback,
            db=db,
        )
        target_doc = ProductDoc.model_validate(target_doc_payload)
        target_id = _target_identity(target)
        resolved_targets.append(
            {
                "target": target,
                "target_id": target_id,
                "title": _target_title_from_doc(target_doc),
                "doc": target_doc,
            }
        )

    pair_inputs: list[dict[str, Any]] = []
    for left_idx, right_idx in combinations(range(len(resolved_targets)), 2):
        left = resolved_targets[left_idx]
        right = resolved_targets[right_idx]
        ingredient_diff = _build_deterministic_ingredient_diff(
            current_doc=left["doc"],
            recommended_doc=right["doc"],
            include_inci_order_diff=payload.options.include_inci_order_diff,
            include_function_rank_diff=payload.options.include_function_rank_diff,
        )
        pair_inputs.append(
            {
                "pair_key": f"{left_idx + 1}-{right_idx + 1}",
                "left": left,
                "right": right,
                "ingredient_diff": ingredient_diff,
            }
        )

    if not pair_inputs:
        raise HTTPException(
            status_code=422,
            detail={
                "code": "COMPARE_TARGET_COUNT_INVALID",
                "detail": "At least 2 products are required for compare.",
                "retryable": False,
                "trace_id": compare_id,
            },
        )

    pair_results: list[MobileComparePairResult] = []
    used_models: list[str] = []
    for idx, pair in enumerate(pair_inputs, start=1):
        _emit_compare_progress(
            event_callback,
            trace_id=compare_id,
            stage="pair_compare",
            message=f"正在生成第 {idx}/{len(pair_inputs)} 组两两对比结论。",
            percent=62 + int((idx - 1) * 30 / max(1, len(pair_inputs))),
            pair_index=idx,
            pair_total=len(pair_inputs),
        )
        compare_context = _build_mobile_compare_context(
            category=category,
            personalization=profile_ctx,
            recommendation=recommendation,
            current_doc=pair["left"]["doc"],
            recommended_doc=pair["right"]["doc"],
            ingredient_diff=pair["ingredient_diff"],
        )
        summary_output = run_capability_now(
            capability="doubao.mobile_compare_summary",
            input_payload={"compare_context_json": json.dumps(compare_context, ensure_ascii=False)},
            trace_id=compare_id,
            event_callback=lambda e: _emit_mobile_compare_ai_event(
                event=e,
                trace_id=compare_id,
                event_callback=event_callback,
            ),
        )

        sections = _build_compare_sections_from_summary(summary_output=summary_output, trace_id=compare_id)
        verdict = MobileCompareVerdict(
            decision=str(summary_output.get("decision") or "hybrid"),
            headline=str(summary_output.get("headline") or "").strip(),
            confidence=float(summary_output.get("confidence") or 0.0),
        )
        pair_results.append(
            MobileComparePairResult(
                pair_key=str(pair["pair_key"]),
                left_target_id=str(pair["left"]["target_id"]),
                right_target_id=str(pair["right"]["target_id"]),
                left_title=str(pair["left"]["title"]),
                right_title=str(pair["right"]["title"]),
                verdict=verdict,
                sections=sections,
                ingredient_diff=pair["ingredient_diff"],
            )
        )
        model_name = str(summary_output.get("model") or "").strip()
        if model_name and model_name not in used_models:
            used_models.append(model_name)

    primary_pair = pair_results[0]
    overall = _build_overall_verdict(pair_results)
    personalization = MobileComparePersonalization(
        status=profile_ctx["status"],
        basis=profile_ctx["basis"],
        missing_fields=list(profile_ctx["missing_fields"]),
    )

    warnings: list[str] = []
    if personalization.status != "complete":
        warnings.append("你这次没有补全个人情况，个性化结论置信度会下降。")

    products = [
        MobileCompareTargetProduct(
            target_id=str(item["target_id"]),
            source=str(item["target"].source),
            brand=item["doc"].product.brand,
            name=item["doc"].product.name,
            one_sentence=item["doc"].summary.one_sentence,
        )
        for item in resolved_targets
    ]

    result = MobileCompareResultResponse(
        status="ok",
        trace_id=compare_id,
        compare_id=compare_id,
        category=category,
        personalization=personalization,
        verdict=MobileCompareVerdict(
            decision=overall.decision,
            headline=overall.headline,
            confidence=overall.confidence,
        ),
        sections=primary_pair.sections,
        ingredient_diff=primary_pair.ingredient_diff,
        transparency=MobileCompareTransparency(
            model="|".join(used_models) if used_models else None,
            warnings=warnings,
            missing_fields=list(profile_ctx["missing_fields"]),
        ),
        recommendation=recommendation,
        current_product=resolved_targets[0]["doc"],
        recommended_product=resolved_targets[1]["doc"],
        products=products,
        pair_results=pair_results,
        overall=overall,
        created_at=now_iso(),
    )

    save_doubao_artifact(
        compare_id,
        MOBILE_COMPARE_RESULT_STAGE,
        {
            "owner_type": owner_type,
            "owner_id": owner_id,
            "compare_version": MOBILE_COMPARE_VERSION,
            "result": result.model_dump(),
        },
    )
    _emit_compare_progress(
        event_callback,
        trace_id=compare_id,
        stage="finalize",
        message="正在整理最终结果。",
        percent=96,
    )
    _emit_compare_progress(
        event_callback,
        trace_id=compare_id,
        stage="done",
        message="对比已完成。",
        percent=100,
    )
    return result


def _emit_compare_progress(
    event_callback: Callable[[str, dict[str, Any]], None],
    *,
    trace_id: str,
    stage: str,
    message: str,
    percent: int | None = None,
    pair_index: int | None = None,
    pair_total: int | None = None,
) -> None:
    payload: dict[str, Any] = {
        "trace_id": trace_id,
        "stage": stage,
        "stage_label": MOBILE_COMPARE_STAGE_META.get(stage, "处理中"),
        "message": str(message or "").strip(),
        "ts": now_iso(),
    }
    if percent is not None:
        payload["percent"] = int(max(0, min(100, percent)))
    if pair_index is not None and pair_total is not None and pair_total > 0:
        payload["pair_index"] = int(pair_index)
        payload["pair_total"] = int(pair_total)
    event_callback("progress", payload)


def _resolve_compare_profile_context(
    *,
    category: str,
    payload: MobileCompareJobRequest,
    recommendation_session: MobileSelectionSession,
    trace_id: str,
) -> dict[str, Any]:
    _ = payload
    try:
        raw = json.loads(recommendation_session.answers_json or "{}")
    except Exception:
        raw = {}
    answers = _normalize_answers(raw if isinstance(raw, dict) else {})
    if not answers:
        raise HTTPException(
            status_code=422,
            detail={
                "code": "COMPARE_PROFILE_INSUFFICIENT",
                "detail": "No reusable profile answers found for this category.",
                "retryable": False,
                "trace_id": trace_id,
            },
        )
    resolved = _resolve_selection(category=category, answers=answers)
    return {
        "status": "complete",
        "basis": "reuse_latest",
        "missing_fields": [],
        "answers": resolved["answers"],
        "choices": resolved["choices"],
        "rule_hits": resolved["rule_hits"],
        "route_title": resolved["route_title"],
    }


def _normalize_compare_targets(
    *,
    payload: MobileCompareJobRequest,
    trace_id: str,
) -> list[MobileCompareJobTargetInput]:
    raw_targets = list(payload.targets or [])
    if not raw_targets:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "COMPARE_TARGETS_REQUIRED",
                "detail": "targets is required and must include 2 or 3 products.",
                "retryable": False,
                "trace_id": trace_id,
            },
        )

    normalized: list[MobileCompareJobTargetInput] = []
    seen: set[str] = set()
    upload_count = 0
    for item in raw_targets:
        source = str(item.source or "").strip().lower()
        if source == "upload_new":
            upload_id = str(item.upload_id or "").strip()
            if not upload_id:
                raise HTTPException(
                    status_code=400,
                    detail={
                        "code": "COMPARE_UPLOAD_ID_REQUIRED",
                        "detail": "upload_id is required when source=upload_new.",
                        "retryable": False,
                        "trace_id": trace_id,
                    },
                )
            key = f"upload:{upload_id}"
            upload_count += 1
            target = MobileCompareJobTargetInput(source="upload_new", upload_id=upload_id)
        elif source == "history_product":
            product_id = str(item.product_id or "").strip()
            if not product_id:
                raise HTTPException(
                    status_code=400,
                    detail={
                        "code": "COMPARE_CURRENT_PRODUCT_ID_REQUIRED",
                        "detail": "product_id is required when source=history_product.",
                        "retryable": False,
                        "trace_id": trace_id,
                    },
                )
            key = f"history:{product_id}"
            target = MobileCompareJobTargetInput(source="history_product", product_id=product_id)
        else:
            raise HTTPException(
                status_code=400,
                detail={
                    "code": "COMPARE_SOURCE_INVALID",
                    "detail": f"Unsupported target.source: {source}.",
                    "retryable": False,
                    "trace_id": trace_id,
                },
            )

        if key in seen:
            raise HTTPException(
                status_code=400,
                detail={
                    "code": "COMPARE_TARGET_DUPLICATE",
                    "detail": f"Duplicate target is not allowed: {key}.",
                    "retryable": False,
                    "trace_id": trace_id,
                },
            )
        seen.add(key)
        normalized.append(target)

    if upload_count > 1:
        raise HTTPException(
            status_code=422,
            detail={
                "code": "COMPARE_UPLOAD_TARGET_LIMIT",
                "detail": "At most one upload target is supported.",
                "retryable": False,
                "trace_id": trace_id,
            },
        )
    if len(normalized) < 2 or len(normalized) > 3:
        raise HTTPException(
            status_code=422,
            detail={
                "code": "COMPARE_TARGET_COUNT_INVALID",
                "detail": "targets count must be between 2 and 3.",
                "retryable": False,
                "trace_id": trace_id,
            },
        )
    return normalized


def _target_identity(target: MobileCompareJobTargetInput) -> str:
    source = str(target.source or "").strip().lower()
    if source == "upload_new":
        return f"upload:{str(target.upload_id or '').strip()}"
    return f"product:{str(target.product_id or '').strip()}"


def _target_title_from_doc(doc: ProductDoc) -> str:
    brand = str(doc.product.brand or "").strip()
    name = str(doc.product.name or "").strip()
    if brand and name:
        return f"{brand} {name}"
    if name:
        return name
    if brand:
        return brand
    return "未命名产品"


def _resolve_target_product_doc(
    *,
    category: str,
    target: MobileCompareJobTargetInput,
    owner_type: str,
    owner_id: str,
    trace_id: str,
    event_callback: Callable[[str, dict[str, Any]], None],
    db: Session,
) -> dict[str, Any]:
    source = str(target.source or "upload_new").strip().lower()
    if source == "history_product":
        product_id = str(target.product_id or "").strip()
        if not product_id:
            raise HTTPException(
                status_code=400,
                detail={
                    "code": "COMPARE_CURRENT_PRODUCT_ID_REQUIRED",
                    "detail": "product_id is required when source=history_product.",
                    "retryable": False,
                    "trace_id": trace_id,
                },
            )
        doc = _load_product_doc_payload_by_id(
            db=db,
            product_id=product_id,
            expected_category=category,
            trace_id=trace_id,
        )
        return doc

    if source != "upload_new":
        raise HTTPException(
            status_code=400,
            detail={
                "code": "COMPARE_SOURCE_INVALID",
                "detail": f"Unsupported target.source: {source}.",
                "retryable": False,
                "trace_id": trace_id,
            },
        )

    upload_id = str(target.upload_id or "").strip()
    if not upload_id:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "COMPARE_UPLOAD_ID_REQUIRED",
                "detail": "upload_id is required when source=upload_new.",
                "retryable": False,
                "trace_id": trace_id,
            },
        )
    meta = _load_mobile_compare_upload_meta(upload_id=upload_id, owner_type=owner_type, owner_id=owner_id, trace_id=trace_id)
    image_path = str(meta.get("image_path") or "").strip()
    if not image_path or not exists_rel_path(image_path):
        raise HTTPException(
            status_code=404,
            detail={
                "code": "COMPARE_UPLOAD_IMAGE_NOT_FOUND",
                "detail": f"Upload image not found for upload_id={upload_id}.",
                "retryable": False,
                "trace_id": trace_id,
            },
        )

    pipeline = DoubaoPipelineService()

    def on_pipeline_event(event: dict[str, Any]) -> None:
        _ = event
        # Do not forward low-level pipeline deltas/steps to mobile users.
        return

    _emit_compare_progress(
        event_callback,
        trace_id=trace_id,
        stage="stage1_vision",
        message="正在识别图片中的品牌、品类与成分信息。",
        percent=32,
    )
    stage1 = pipeline.analyze_stage1(
        image_path=image_path,
        trace_id=trace_id,
        event_callback=on_pipeline_event,
    )
    _emit_compare_progress(
        event_callback,
        trace_id=trace_id,
        stage="stage2_struct",
        message="正在结构化提取成分与摘要。",
        percent=40,
    )
    stage2 = pipeline.analyze_stage2(
        vision_text=str(stage1.get("vision_text") or ""),
        trace_id=trace_id,
        event_callback=on_pipeline_event,
    )

    doc = stage2.get("doc")
    if not isinstance(doc, dict):
        raise HTTPException(
            status_code=500,
            detail={
                "code": "COMPARE_PARSE_INVALID_DOC",
                "detail": "Stage2 did not return a valid product document.",
                "retryable": True,
                "trace_id": trace_id,
            },
        )

    product = doc.setdefault("product", {})
    raw_category = str(product.get("category") or "").strip()
    normalized_raw_category = _normalize_model_category(raw_category)
    if normalized_raw_category and normalized_raw_category not in VALID_CATEGORIES:
        raise HTTPException(
            status_code=422,
            detail={
                "code": "COMPARE_CATEGORY_INVALID",
                "detail": (
                    "Current product category extracted from image is invalid: "
                    f"'{raw_category}'."
                ),
                "retryable": False,
                "trace_id": trace_id,
            },
        )
    if normalized_raw_category and normalized_raw_category != category:
        raise HTTPException(
            status_code=422,
            detail={
                "code": "COMPARE_CATEGORY_MISMATCH",
                "detail": (
                    "Current product category "
                    f"'{raw_category}' does not match selected category '{category}'."
                ),
                "retryable": False,
                "trace_id": trace_id,
            },
        )

    product["category"] = category
    brand_override = str(meta.get("brand") or "").strip()
    name_override = str(meta.get("name") or "").strip()
    if brand_override:
        product["brand"] = brand_override
    if name_override:
        product["name"] = name_override

    normalized = normalize_doc(
        doc,
        image_rel_path=image_path,
        doubao_raw=str(stage2.get("struct_text") or ""),
    )
    evidence = normalized.setdefault("evidence", {})
    evidence["doubao_vision_text"] = stage1.get("vision_text")
    evidence["doubao_pipeline_mode"] = "mobile-compare-two-stage"
    evidence["doubao_models"] = {
        "vision": stage1.get("model"),
        "struct": stage2.get("model"),
    }
    evidence["doubao_artifacts"] = {
        "vision": stage1.get("artifact"),
        "struct": stage2.get("artifact"),
    }
    matched_product_id = _match_existing_product_id_for_usage(
        db=db,
        category=category,
        brand=str(normalized.get("product", {}).get("brand") or ""),
        name=str(normalized.get("product", {}).get("name") or ""),
    )
    if matched_product_id:
        _increase_product_usage_count(
            db=db,
            owner_type=owner_type,
            owner_id=owner_id,
            product_id=matched_product_id,
            category=category,
        )
    return normalized


def _build_compare_sections_from_summary(
    *,
    summary_output: dict[str, Any],
    trace_id: str,
) -> list[MobileCompareResultSection]:
    summary_sections = summary_output.get("sections")
    if not isinstance(summary_sections, dict):
        raise HTTPException(
            status_code=500,
            detail={
                "code": "COMPARE_SUMMARY_INVALID",
                "detail": "AI summary output sections is invalid.",
                "retryable": True,
                "trace_id": trace_id,
            },
        )
    return [
        MobileCompareResultSection(
            key="keep_benefits",
            title="继续用这款，你最能得到什么",
            items=[str(item).strip() for item in summary_sections.get("keep_benefits", []) if str(item).strip()],
        ),
        MobileCompareResultSection(
            key="keep_watchouts",
            title="如果继续用，这些点要多留意",
            items=[str(item).strip() for item in summary_sections.get("keep_watchouts", []) if str(item).strip()],
        ),
        MobileCompareResultSection(
            key="ingredient_order_diff",
            title="两款成分排位，哪里不一样",
            items=[str(item).strip() for item in summary_sections.get("ingredient_order_diff", []) if str(item).strip()],
        ),
        MobileCompareResultSection(
            key="profile_fit_advice",
            title="结合你填写的个人情况，更适合你的用法",
            items=[str(item).strip() for item in summary_sections.get("profile_fit_advice", []) if str(item).strip()],
        ),
    ]


def _build_overall_verdict(pair_results: list[MobileComparePairResult]) -> MobileCompareOverallVerdict:
    if not pair_results:
        return MobileCompareOverallVerdict(
            decision="hybrid",
            headline="暂无可用对比结论。",
            confidence=0.0,
            summary_items=[],
        )

    if len(pair_results) == 1:
        first = pair_results[0]
        return MobileCompareOverallVerdict(
            decision=first.verdict.decision,
            headline=first.verdict.headline,
            confidence=first.verdict.confidence,
            summary_items=[f"{first.left_title} vs {first.right_title}：{first.verdict.headline}"],
        )

    decisions = {item.verdict.decision for item in pair_results}
    confidence = sum(float(item.verdict.confidence or 0.0) for item in pair_results) / len(pair_results)
    if len(decisions) == 1:
        decision = pair_results[0].verdict.decision
    else:
        decision = "hybrid"

    if decision == "keep":
        headline = "多组两两对比后，整体更建议优先选择更稳妥的一款。"
    elif decision == "switch":
        headline = "多组两两对比后，整体更建议替换到更匹配的一款。"
    else:
        headline = "多组两两对比后，按场景分配使用会更合适。"

    summary_items = [
        f"{item.left_title} vs {item.right_title}：{item.verdict.headline}"
        for item in pair_results[:3]
        if str(item.verdict.headline or "").strip()
    ]
    return MobileCompareOverallVerdict(
        decision=decision,
        headline=headline,
        confidence=round(confidence, 4),
        summary_items=summary_items,
    )


def _load_mobile_compare_upload_meta(
    *,
    upload_id: str,
    owner_type: str,
    owner_id: str,
    trace_id: str,
) -> dict[str, Any]:
    rel_path = f"doubao_runs/{upload_id}/mobile_compare_upload_meta.json"
    if not exists_rel_path(rel_path):
        raise HTTPException(
            status_code=404,
            detail={
                "code": "COMPARE_UPLOAD_NOT_FOUND",
                "detail": f"upload_id '{upload_id}' not found.",
                "retryable": False,
                "trace_id": trace_id,
            },
        )
    payload = load_json(rel_path)
    if str(payload.get("owner_type") or "") != owner_type or str(payload.get("owner_id") or "") != owner_id:
        raise HTTPException(
            status_code=404,
            detail={
                "code": "COMPARE_UPLOAD_NOT_FOUND",
                "detail": f"upload_id '{upload_id}' not found.",
                "retryable": False,
                "trace_id": trace_id,
            },
        )
    return payload


def _load_product_doc_payload_by_id(
    *,
    db: Session,
    product_id: str,
    expected_category: str,
    trace_id: str,
) -> dict[str, Any]:
    rec = db.get(ProductIndex, product_id)
    if rec is None:
        raise HTTPException(
            status_code=404,
            detail={
                "code": "COMPARE_PRODUCT_NOT_FOUND",
                "detail": f"Product '{product_id}' not found.",
                "retryable": False,
                "trace_id": trace_id,
            },
        )
    if str(rec.category or "").strip().lower() != expected_category:
        raise HTTPException(
            status_code=422,
            detail={
                "code": "COMPARE_CATEGORY_MISMATCH",
                "detail": f"Product '{product_id}' category does not match '{expected_category}'.",
                "retryable": False,
                "trace_id": trace_id,
            },
        )
    if not exists_rel_path(rec.json_path):
        raise HTTPException(
            status_code=404,
            detail={
                "code": "COMPARE_PRODUCT_DOC_MISSING",
                "detail": f"Product document missing for '{product_id}'.",
                "retryable": False,
                "trace_id": trace_id,
            },
        )
    return load_json(rec.json_path)


def _emit_mobile_compare_ai_event(
    *,
    event: dict[str, Any],
    trace_id: str,
    event_callback: Callable[[str, dict[str, Any]], None],
) -> None:
    event_type = str(event.get("type") or "").strip().lower()
    stage = str(event.get("stage") or "").strip() or "pair_compare"
    if event_type == "step":
        raw_message = str(event.get("message") or "").strip()
        lowered = raw_message.lower()
        # Drop verbose model internals, only keep user-facing milestones.
        if not raw_message:
            return
        if "calling model" in lowered:
            return
        if lowered.startswith("job_"):
            return
        _emit_compare_progress(
            event_callback,
            trace_id=trace_id,
            stage="pair_compare" if stage == "mobile_compare_summary" else stage,
            message="本组分析已完成，正在整理建议。" if "completed" in lowered else raw_message,
        )
        return
    # Never forward model deltas or orchestrator events to user-facing stream.
    if event_type in {"delta", "job_started", "job_succeeded", "job_failed"}:
        return


def _build_mobile_compare_context(
    *,
    category: str,
    personalization: dict[str, Any],
    recommendation: MobileSelectionResolveResponse,
    current_doc: ProductDoc,
    recommended_doc: ProductDoc,
    ingredient_diff: MobileCompareIngredientDiff,
) -> dict[str, Any]:
    return {
        "category": category,
        "personalization": {
            "status": personalization["status"],
            "basis": personalization["basis"],
            "missing_fields": personalization["missing_fields"],
            "summary_labels": [str(item.get("label") or "").strip() for item in personalization.get("choices", []) if str(item.get("label") or "").strip()],
        },
        "history_recommendation": {
            "route_title": recommendation.route.title,
            "route_key": recommendation.route.key,
            "rule_hits": [item.model_dump() for item in recommendation.rule_hits],
        },
        "current_product": {
            "brand": current_doc.product.brand,
            "name": current_doc.product.name,
            "one_sentence": current_doc.summary.one_sentence,
            "risk_counts": _count_risks(current_doc),
        },
        "recommended_product": {
            "brand": recommended_doc.product.brand,
            "name": recommended_doc.product.name,
            "one_sentence": recommended_doc.summary.one_sentence,
            "risk_counts": _count_risks(recommended_doc),
        },
        "ingredient_diff": ingredient_diff.model_dump(),
    }


def _count_risks(doc: ProductDoc) -> dict[str, int]:
    out = {"low": 0, "mid": 0, "high": 0}
    for item in doc.ingredients:
        risk = str(item.risk or "").strip().lower()
        if risk in out:
            out[risk] += 1
    return out


def _mobile_compare_session_rel_path(compare_id: str) -> str:
    return f"doubao_runs/{compare_id}/{MOBILE_COMPARE_SESSION_STAGE}.json"


def _mobile_compare_result_rel_path(compare_id: str) -> str:
    return f"doubao_runs/{compare_id}/{MOBILE_COMPARE_RESULT_STAGE}.json"


def _session_payload_belongs_to_owner(payload: dict[str, Any], *, owner_type: str, owner_id: str) -> bool:
    return (
        str(payload.get("owner_type") or "") == owner_type
        and str(payload.get("owner_id") or "") == owner_id
    )


def _safe_load_json_dict(rel_path: str) -> dict[str, Any] | None:
    if not exists_rel_path(rel_path):
        return None
    try:
        payload = load_json(rel_path)
    except Exception:
        return None
    if not isinstance(payload, dict):
        return None
    return payload


def _normalize_model_category(raw: str | None) -> str:
    text = str(raw or "").strip()
    if not text:
        return ""
    lowered = text.lower()
    alias = CATEGORY_ALIASES.get(text) or CATEGORY_ALIASES.get(lowered)
    if alias:
        return alias
    return lowered


def _ensure_mobile_compare_index_tables(db: Session) -> None:
    bind = db.get_bind()
    MobileCompareSessionIndex.__table__.create(bind=bind, checkfirst=True)
    MobileCompareUsageStat.__table__.create(bind=bind, checkfirst=True)


def _coerce_mobile_compare_session_index_payload(
    *,
    compare_id: str,
    payload: dict[str, Any],
) -> dict[str, Any] | None:
    owner_type = str(payload.get("owner_type") or "").strip()
    owner_id = str(payload.get("owner_id") or "").strip()
    if not owner_type or not owner_id:
        return None

    status_value = str(payload.get("status") or "running").strip().lower()
    if status_value not in {"running", "done", "failed"}:
        status_value = "running"

    category = _normalize_model_category(payload.get("category"))
    if category not in VALID_CATEGORIES:
        category = "unknown"

    percent_raw = payload.get("percent")
    try:
        percent = int(percent_raw) if percent_raw is not None else 0
    except Exception:
        percent = 0
    percent = max(0, min(100, percent))

    pair_index_raw = payload.get("pair_index")
    pair_total_raw = payload.get("pair_total")
    try:
        pair_index = int(pair_index_raw) if pair_index_raw is not None else None
    except Exception:
        pair_index = None
    try:
        pair_total = int(pair_total_raw) if pair_total_raw is not None else None
    except Exception:
        pair_total = None

    created_at = str(payload.get("created_at") or now_iso())
    updated_at = str(payload.get("updated_at") or created_at)

    out: dict[str, Any] = {
        "compare_id": compare_id,
        "owner_type": owner_type,
        "owner_id": owner_id,
        "category": category,
        "status": status_value,
        "created_at": created_at,
        "updated_at": updated_at,
        "stage": str(payload.get("stage") or "").strip() or None,
        "stage_label": str(payload.get("stage_label") or "").strip() or None,
        "message": str(payload.get("message") or "").strip() or None,
        "percent": percent,
        "pair_index": pair_index,
        "pair_total": pair_total,
    }

    result_value = payload.get("result")
    error_value = payload.get("error")
    if isinstance(result_value, dict):
        out["result"] = result_value
    if isinstance(error_value, dict):
        out["error"] = error_value
    return out


def _coerce_mobile_compare_session_index_payload_from_result(
    *,
    compare_id: str,
    payload: dict[str, Any],
) -> dict[str, Any] | None:
    owner_type = str(payload.get("owner_type") or "").strip()
    owner_id = str(payload.get("owner_id") or "").strip()
    if not owner_type or not owner_id:
        return None
    result_payload = payload.get("result")
    if not isinstance(result_payload, dict):
        return None
    fallback = _fallback_mobile_compare_session_from_result_payload(
        compare_id=compare_id,
        result_payload=result_payload,
    )
    if fallback is None:
        return None
    return {
        "compare_id": fallback.compare_id,
        "owner_type": owner_type,
        "owner_id": owner_id,
        "category": fallback.category,
        "status": fallback.status,
        "created_at": fallback.created_at,
        "updated_at": fallback.updated_at,
        "stage": fallback.stage,
        "stage_label": fallback.stage_label,
        "message": fallback.message,
        "percent": fallback.percent,
        "pair_index": fallback.pair_index,
        "pair_total": fallback.pair_total,
        "result": fallback.result.model_dump() if fallback.result else None,
        "error": fallback.error.model_dump() if fallback.error else None,
    }


def _backfill_mobile_compare_session_index_from_storage(
    *,
    db: Session,
    limit: int,
    only_missing: bool,
    dry_run: bool,
) -> dict[str, Any]:
    runs_root = Path(settings.storage_dir).resolve() / "doubao_runs"
    stats: dict[str, Any] = {
        "limit": int(limit),
        "only_missing": bool(only_missing),
        "dry_run": bool(dry_run),
        "visited_dirs": 0,
        "runs_with_compare_artifacts": 0,
        "indexed": 0,
        "skipped_existing": 0,
        "skipped_invalid": 0,
        "errors": 0,
        "sources": {"session": 0, "result_fallback": 0},
    }
    if not runs_root.exists() or not runs_root.is_dir():
        return stats

    for run_dir in sorted(runs_root.iterdir(), key=lambda item: item.name):
        if stats["visited_dirs"] >= limit:
            break
        if not run_dir.is_dir():
            continue

        compare_id = str(run_dir.name or "").strip()
        if not compare_id:
            continue
        stats["visited_dirs"] += 1

        session_rel = _mobile_compare_session_rel_path(compare_id)
        result_rel = _mobile_compare_result_rel_path(compare_id)
        has_session = exists_rel_path(session_rel)
        has_result = exists_rel_path(result_rel)
        if not has_session and not has_result:
            continue
        stats["runs_with_compare_artifacts"] += 1

        if only_missing and db.get(MobileCompareSessionIndex, compare_id) is not None:
            stats["skipped_existing"] += 1
            continue

        source: str | None = None
        index_payload: dict[str, Any] | None = None

        if has_session:
            session_payload = _safe_load_json_dict(session_rel)
            if session_payload is not None:
                index_payload = _coerce_mobile_compare_session_index_payload(
                    compare_id=compare_id,
                    payload=session_payload,
                )
                if index_payload is not None:
                    source = "session"

        if index_payload is None and has_result:
            result_container = _safe_load_json_dict(result_rel)
            if result_container is not None:
                index_payload = _coerce_mobile_compare_session_index_payload_from_result(
                    compare_id=compare_id,
                    payload=result_container,
                )
                if index_payload is not None:
                    source = "result_fallback"

        if index_payload is None or source is None:
            stats["skipped_invalid"] += 1
            continue

        if dry_run:
            stats["indexed"] += 1
            stats["sources"][source] = int(stats["sources"].get(source, 0)) + 1
            continue

        try:
            _upsert_mobile_compare_session_index(db=db, payload=index_payload)
            stats["indexed"] += 1
            stats["sources"][source] = int(stats["sources"].get(source, 0)) + 1
        except Exception:
            db.rollback()
            stats["errors"] += 1
            continue

    return stats


def _upsert_mobile_compare_session(
    *,
    compare_id: str,
    owner_type: str,
    owner_id: str,
    category: str,
    db: Session,
    patch: dict[str, Any],
) -> MobileCompareSessionResponse:
    existing_payload: dict[str, Any] = {}
    rel_path = _mobile_compare_session_rel_path(compare_id)
    loaded = _safe_load_json_dict(rel_path)
    if loaded is not None:
        existing_payload = loaded

    base_category = str(existing_payload.get("category") or category or "unknown").strip().lower() or "unknown"
    status_value = str(patch.get("status") or existing_payload.get("status") or "running").strip().lower()
    if status_value not in {"running", "done", "failed"}:
        status_value = "running"

    percent_raw = patch.get("percent", existing_payload.get("percent", 0))
    try:
        percent_value = int(percent_raw)
    except Exception:
        percent_value = 0
    percent_value = max(0, min(100, percent_value))

    created_at = str(existing_payload.get("created_at") or now_iso())
    updated_at = now_iso()

    merged: dict[str, Any] = {
        "compare_id": compare_id,
        "owner_type": owner_type,
        "owner_id": owner_id,
        "category": base_category,
        "status": status_value,
        "created_at": created_at,
        "updated_at": updated_at,
        "stage": patch.get("stage", existing_payload.get("stage")),
        "stage_label": patch.get("stage_label", existing_payload.get("stage_label")),
        "message": patch.get("message", existing_payload.get("message")),
        "percent": percent_value,
        "pair_index": patch.get("pair_index", existing_payload.get("pair_index")),
        "pair_total": patch.get("pair_total", existing_payload.get("pair_total")),
        "result": patch.get("result", existing_payload.get("result")),
        "error": patch.get("error", existing_payload.get("error")),
    }
    if patch.get("result") is None and "result" in patch:
        merged["result"] = None
    if patch.get("error") is None and "error" in patch:
        merged["error"] = None

    save_doubao_artifact(compare_id, MOBILE_COMPARE_SESSION_STAGE, merged)
    _upsert_mobile_compare_session_index(db=db, payload=merged)
    normalized = _normalize_mobile_compare_session_payload(merged)
    if normalized is None:  # pragma: no cover
        raise HTTPException(status_code=500, detail="Failed to persist mobile compare session.")
    return normalized


def _normalize_mobile_compare_session_payload(payload: dict[str, Any]) -> MobileCompareSessionResponse | None:
    if not isinstance(payload, dict):
        return None
    compare_id = str(payload.get("compare_id") or "").strip()
    category = str(payload.get("category") or "").strip().lower()
    if not compare_id or not category:
        return None

    status_value = str(payload.get("status") or "running").strip().lower()
    if status_value not in {"running", "done", "failed"}:
        status_value = "running"

    created_at = str(payload.get("created_at") or "").strip() or now_iso()
    updated_at = str(payload.get("updated_at") or "").strip() or created_at

    try:
        percent = int(payload.get("percent") or 0)
    except Exception:
        percent = 0
    percent = max(0, min(100, percent))

    pair_index_raw = payload.get("pair_index")
    pair_total_raw = payload.get("pair_total")
    try:
        pair_index = int(pair_index_raw) if pair_index_raw is not None else None
    except Exception:
        pair_index = None
    try:
        pair_total = int(pair_total_raw) if pair_total_raw is not None else None
    except Exception:
        pair_total = None

    result_brief: MobileCompareSessionResultBrief | None = None
    raw_result = payload.get("result")
    if isinstance(raw_result, dict):
        try:
            result_brief = MobileCompareSessionResultBrief.model_validate(raw_result)
        except Exception:
            result_brief = None

    error_payload: MobileCompareSessionError | None = None
    raw_error = payload.get("error")
    if isinstance(raw_error, dict):
        try:
            error_payload = MobileCompareSessionError.model_validate(raw_error)
        except Exception:
            error_payload = None

    try:
        return MobileCompareSessionResponse(
            status=status_value,
            compare_id=compare_id,
            category=category,
            created_at=created_at,
            updated_at=updated_at,
            stage=str(payload.get("stage") or "").strip() or None,
            stage_label=str(payload.get("stage_label") or "").strip() or None,
            message=str(payload.get("message") or "").strip() or None,
            percent=percent,
            pair_index=pair_index,
            pair_total=pair_total,
            result=result_brief,
            error=error_payload,
        )
    except Exception:
        return None


def _upsert_mobile_compare_session_index(*, db: Session, payload: dict[str, Any]) -> None:
    compare_id = str(payload.get("compare_id") or "").strip()
    owner_type = str(payload.get("owner_type") or "").strip()
    owner_id = str(payload.get("owner_id") or "").strip()
    if not compare_id or not owner_type or not owner_id:
        return

    row = db.get(MobileCompareSessionIndex, compare_id)
    if row is None:
        row = MobileCompareSessionIndex(
            compare_id=compare_id,
            owner_type=owner_type,
            owner_id=owner_id,
            category=str(payload.get("category") or "unknown").strip().lower() or "unknown",
            status="running",
            created_at=str(payload.get("created_at") or now_iso()),
            updated_at=str(payload.get("updated_at") or now_iso()),
        )

    status_value = str(payload.get("status") or row.status or "running").strip().lower()
    if status_value not in {"running", "done", "failed"}:
        status_value = "running"

    pair_index_raw = payload.get("pair_index")
    pair_total_raw = payload.get("pair_total")
    try:
        percent = int(payload.get("percent") or 0)
    except Exception:
        percent = 0
    try:
        pair_index = int(pair_index_raw) if pair_index_raw is not None else None
    except Exception:
        pair_index = None
    try:
        pair_total = int(pair_total_raw) if pair_total_raw is not None else None
    except Exception:
        pair_total = None

    result_json: str | None = None
    error_json: str | None = None
    result_value = payload.get("result")
    error_value = payload.get("error")
    if isinstance(result_value, dict):
        result_json = json.dumps(result_value, ensure_ascii=False)
    if isinstance(error_value, dict):
        error_json = json.dumps(error_value, ensure_ascii=False)

    row.owner_type = owner_type
    row.owner_id = owner_id
    row.category = str(payload.get("category") or row.category or "unknown").strip().lower() or "unknown"
    row.status = status_value
    row.stage = str(payload.get("stage") or "").strip() or None
    row.stage_label = str(payload.get("stage_label") or "").strip() or None
    row.message = str(payload.get("message") or "").strip() or None
    row.percent = max(0, min(100, int(percent)))
    row.pair_index = pair_index
    row.pair_total = pair_total
    row.result_json = result_json
    row.error_json = error_json
    row.created_at = str(payload.get("created_at") or row.created_at or now_iso())
    row.updated_at = str(payload.get("updated_at") or now_iso())
    db.add(row)
    db.commit()


def _session_payload_from_index_row(row: MobileCompareSessionIndex) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "compare_id": row.compare_id,
        "owner_type": row.owner_type,
        "owner_id": row.owner_id,
        "category": row.category,
        "status": row.status,
        "created_at": row.created_at,
        "updated_at": row.updated_at,
        "stage": row.stage,
        "stage_label": row.stage_label,
        "message": row.message,
        "percent": int(row.percent or 0),
        "pair_index": row.pair_index,
        "pair_total": row.pair_total,
    }
    if row.result_json:
        try:
            parsed = json.loads(row.result_json)
            if isinstance(parsed, dict):
                payload["result"] = parsed
        except Exception:
            pass
    if row.error_json:
        try:
            parsed = json.loads(row.error_json)
            if isinstance(parsed, dict):
                payload["error"] = parsed
        except Exception:
            pass
    return payload


def _fallback_mobile_compare_session_from_result_payload(
    *,
    compare_id: str,
    result_payload: dict[str, Any],
) -> MobileCompareSessionResponse | None:
    try:
        result = MobileCompareResultResponse.model_validate(result_payload)
    except Exception:
        return None
    return MobileCompareSessionResponse(
        status="done",
        compare_id=compare_id,
        category=str(result.category),
        created_at=result.created_at,
        updated_at=result.created_at,
        stage="done",
        stage_label=MOBILE_COMPARE_STAGE_META.get("done"),
        message="对比已完成。",
        percent=100,
        result=MobileCompareSessionResultBrief(
            decision=result.verdict.decision,
            headline=result.verdict.headline,
            confidence=float(result.verdict.confidence or 0.0),
            created_at=result.created_at,
        ),
        error=None,
    )


def _get_mobile_compare_session_record(
    *,
    db: Session,
    compare_id: str,
    owner_type: str,
    owner_id: str,
) -> MobileCompareSessionResponse | None:
    row = db.get(MobileCompareSessionIndex, compare_id)
    if row is not None:
        if row.owner_type != owner_type or row.owner_id != owner_id:
            return None
        normalized = _normalize_mobile_compare_session_payload(_session_payload_from_index_row(row))
        if normalized is not None:
            return normalized

    session_rel = _mobile_compare_session_rel_path(compare_id)
    session_payload = _safe_load_json_dict(session_rel)
    if session_payload is not None:
        if _session_payload_belongs_to_owner(session_payload, owner_type=owner_type, owner_id=owner_id):
            _upsert_mobile_compare_session_index(db=db, payload=session_payload)
            payload_from_index = db.get(MobileCompareSessionIndex, compare_id)
            if payload_from_index is not None:
                normalized = _normalize_mobile_compare_session_payload(_session_payload_from_index_row(payload_from_index))
                if normalized is not None:
                    return normalized
            normalized = _normalize_mobile_compare_session_payload(session_payload)
            if normalized is not None:
                return normalized

    result_rel = _mobile_compare_result_rel_path(compare_id)
    result_container = _safe_load_json_dict(result_rel)
    if result_container is None:
        return None
    if not _session_payload_belongs_to_owner(result_container, owner_type=owner_type, owner_id=owner_id):
        return None
    result_payload = result_container.get("result")
    if not isinstance(result_payload, dict):
        return None
    fallback = _fallback_mobile_compare_session_from_result_payload(
        compare_id=compare_id,
        result_payload=result_payload,
    )
    if fallback is None:
        return None
    _upsert_mobile_compare_session_index(
        db=db,
        payload={
            "compare_id": fallback.compare_id,
            "owner_type": owner_type,
            "owner_id": owner_id,
            "category": fallback.category,
            "status": fallback.status,
            "created_at": fallback.created_at,
            "updated_at": fallback.updated_at,
            "stage": fallback.stage,
            "stage_label": fallback.stage_label,
            "message": fallback.message,
            "percent": fallback.percent,
            "pair_index": fallback.pair_index,
            "pair_total": fallback.pair_total,
            "result": fallback.result.model_dump() if fallback.result else None,
            "error": fallback.error.model_dump() if fallback.error else None,
        },
    )
    return fallback


def _featured_slot_schema_http_error(exc: Exception) -> HTTPException:
    return HTTPException(
        status_code=500,
        detail=(
            "Failed to query featured slots. "
            "Database schema may be outdated (missing table 'product_featured_slots'). "
            f"Raw error: {exc}"
        ),
    )


def _route_mapping_by_product_id(
    *,
    db: Session,
    product_ids: list[str],
) -> dict[str, ProductRouteMappingIndex]:
    normalized_ids = [str(item or "").strip() for item in product_ids if str(item or "").strip()]
    if not normalized_ids:
        return {}
    try:
        rows = db.execute(
            select(ProductRouteMappingIndex).where(ProductRouteMappingIndex.product_id.in_(normalized_ids))
        ).scalars().all()
    except OperationalError as exc:
        raise HTTPException(
            status_code=500,
            detail=(
                "Failed to query route mapping index. "
                "Database schema may be outdated (missing table 'product_route_mapping_index'). "
                f"Raw error: {exc}"
            ),
        ) from exc
    out: dict[str, ProductRouteMappingIndex] = {}
    for row in rows:
        out[str(row.product_id)] = row
    return out


def _featured_slot_by_slot_key(
    *,
    db: Session,
    categories: set[str],
) -> dict[str, ProductFeaturedSlot]:
    normalized_categories = sorted({str(item or "").strip().lower() for item in categories if str(item or "").strip()})
    if not normalized_categories:
        return {}
    try:
        rows = db.execute(
            select(ProductFeaturedSlot).where(ProductFeaturedSlot.category.in_(normalized_categories))
        ).scalars().all()
    except OperationalError as exc:
        raise _featured_slot_schema_http_error(exc) from exc
    out: dict[str, ProductFeaturedSlot] = {}
    for row in rows:
        category = str(row.category or "").strip().lower()
        target_type_key = str(row.target_type_key or "").strip()
        if not category or not target_type_key:
            continue
        out[f"{category}::{target_type_key}"] = row
    return out


def _build_mobile_wiki_product_item(
    *,
    row: ProductIndex,
    mapping: ProductRouteMappingIndex | None,
    featured_by_slot: dict[str, ProductFeaturedSlot],
) -> MobileWikiProductItem:
    category = str(row.category or "").strip().lower()
    category_label = CATEGORY_LABELS_ZH.get(category, category or "-")

    target_type_key: str | None = None
    target_type_title: str | None = None
    target_type_level: Literal["subcategory", "category", "unknown"] = "unknown"
    mapping_ready = False
    primary_confidence: int | None = None
    secondary_type_key: str | None = None
    secondary_type_title: str | None = None
    secondary_confidence: int | None = None

    if category in ROUTE_MAPPED_CATEGORIES:
        if mapping is not None and str(mapping.status or "").strip().lower() == "ready":
            key = str(mapping.primary_route_key or "").strip()
            if key:
                target_type_key = key
                target_type_title = str(mapping.primary_route_title or "").strip() or key
                target_type_level = "subcategory"
                mapping_ready = True
                try:
                    primary_confidence = int(mapping.primary_confidence or 0)
                except Exception:
                    primary_confidence = 0
                secondary_key = str(mapping.secondary_route_key or "").strip()
                secondary_title = str(mapping.secondary_route_title or "").strip()
                secondary_type_key = secondary_key or None
                secondary_type_title = secondary_title or None
                if mapping.secondary_confidence is not None:
                    try:
                        secondary_confidence = int(mapping.secondary_confidence)
                    except Exception:
                        secondary_confidence = None
    else:
        target_type_key = CATEGORY_LEVEL_TARGET_KEY
        target_type_title = category_label
        target_type_level = "category"
        mapping_ready = True

    slot = featured_by_slot.get(f"{category}::{target_type_key}") if target_type_key else None
    is_featured = bool(slot and str(slot.product_id or "").strip() == str(row.id))
    return MobileWikiProductItem(
        product=_row_to_product_card(row),
        category_label=category_label,
        target_type_key=target_type_key,
        target_type_title=target_type_title,
        target_type_level=target_type_level,
        mapping_ready=mapping_ready,
        primary_confidence=primary_confidence,
        secondary_type_key=secondary_type_key,
        secondary_type_title=secondary_type_title,
        secondary_confidence=secondary_confidence,
        is_featured=is_featured,
    )


def _build_mobile_bag_item_views(
    *,
    db: Session,
    bag_rows: list[MobileBagItem],
) -> list[MobileBagItemView]:
    if not bag_rows:
        return []
    product_ids = [str(row.product_id or "").strip() for row in bag_rows if str(row.product_id or "").strip()]
    product_rows = db.execute(select(ProductIndex).where(ProductIndex.id.in_(product_ids))).scalars().all()
    product_by_id = {str(row.id): row for row in product_rows}
    mapping_by_product_id = _route_mapping_by_product_id(db=db, product_ids=product_ids)
    featured_by_slot = _featured_slot_by_slot_key(
        db=db,
        categories={str(row.category or "").strip().lower() for row in product_rows},
    )

    out: list[MobileBagItemView] = []
    for bag_row in bag_rows:
        product_id = str(bag_row.product_id or "").strip()
        product_row = product_by_id.get(product_id)
        if product_row is None:
            raise HTTPException(
                status_code=500,
                detail=(
                    f"Bag item '{bag_row.id}' references missing product '{product_id}'. "
                    "Please clean invalid bag data."
                ),
            )
        if not exists_rel_path(str(product_row.json_path or "")):
            raise HTTPException(
                status_code=500,
                detail=(
                    f"Bag item '{bag_row.id}' references product '{product_id}' with missing doc file. "
                    "Please repair product storage."
                ),
            )

        wiki_item = _build_mobile_wiki_product_item(
            row=product_row,
            mapping=mapping_by_product_id.get(product_id),
            featured_by_slot=featured_by_slot,
        )
        try:
            quantity = int(bag_row.quantity or 1)
        except Exception:
            quantity = 1
        quantity = min(99, max(1, quantity))
        out.append(
            MobileBagItemView(
                item_id=str(bag_row.id),
                quantity=quantity,
                created_at=str(bag_row.created_at),
                updated_at=str(bag_row.updated_at),
                product=wiki_item.product,
                target_type_key=wiki_item.target_type_key,
                target_type_title=wiki_item.target_type_title,
                target_type_level=wiki_item.target_type_level,
                is_featured=wiki_item.is_featured,
            )
        )
    return out


def _list_mobile_compare_sessions(
    *,
    db: Session,
    owner_type: str,
    owner_id: str,
    category: str | None,
    offset: int,
    limit: int,
) -> list[MobileCompareSessionResponse]:
    stmt = (
        select(MobileCompareSessionIndex)
        .where(MobileCompareSessionIndex.owner_type == owner_type)
        .where(MobileCompareSessionIndex.owner_id == owner_id)
    )
    if category:
        stmt = stmt.where(MobileCompareSessionIndex.category == category)
    rows = (
        db.execute(
            stmt.order_by(
                MobileCompareSessionIndex.updated_at.desc(),
                MobileCompareSessionIndex.created_at.desc(),
                MobileCompareSessionIndex.compare_id.desc(),
            )
            .offset(offset)
            .limit(limit)
        )
        .scalars()
        .all()
    )

    records: list[MobileCompareSessionResponse] = []
    for row in rows:
        normalized = _normalize_mobile_compare_session_payload(_session_payload_from_index_row(row))
        if normalized is not None:
            records.append(normalized)
    return records


def _increase_product_usage_count(
    *,
    db: Session,
    owner_type: str,
    owner_id: str,
    product_id: str,
    category: str,
) -> None:
    pid = str(product_id or "").strip()
    cat = str(category or "").strip().lower()
    normalized_owner_type = str(owner_type or "").strip() or MOBILE_OWNER_TYPE_DEVICE
    normalized_owner_id = str(owner_id or "").strip()
    if not pid or not cat or not normalized_owner_id:
        return
    row = db.get(
        MobileCompareUsageStat,
        {
            "owner_type": normalized_owner_type,
            "owner_id": normalized_owner_id,
            "category": cat,
            "product_id": pid,
        },
    )
    if row is None:
        row = MobileCompareUsageStat(
            owner_type=normalized_owner_type,
            owner_id=normalized_owner_id,
            category=cat,
            product_id=pid,
            usage_count=0,
            updated_at=now_iso(),
        )
    row.usage_count = int(row.usage_count or 0) + 1
    row.updated_at = now_iso()
    db.add(row)
    db.commit()


def _usage_count_by_product_id(
    *,
    db: Session,
    owner_type: str,
    owner_id: str,
    category: str,
) -> dict[str, int]:
    cat = str(category or "").strip().lower()
    normalized_owner_type = str(owner_type or "").strip() or MOBILE_OWNER_TYPE_DEVICE
    normalized_owner_id = str(owner_id or "").strip()
    if not cat or not normalized_owner_id:
        return {}
    rows = (
        db.execute(
            select(MobileCompareUsageStat)
            .where(MobileCompareUsageStat.owner_type == normalized_owner_type)
            .where(MobileCompareUsageStat.owner_id == normalized_owner_id)
            .where(MobileCompareUsageStat.category == cat)
            .order_by(
                MobileCompareUsageStat.usage_count.desc(),
                MobileCompareUsageStat.updated_at.desc(),
            )
            .limit(200)
        )
        .scalars()
        .all()
    )
    out: dict[str, int] = {}
    for row in rows:
        try:
            count = int(row.usage_count or 0)
        except Exception:
            count = 0
        if count > 0:
            out[str(row.product_id)] = count
    return out


def _build_mobile_compare_product_library(
    *,
    db: Session,
    category: str,
    owner_type: str,
    owner_id: str,
    recommendation_product_id: str | None,
) -> MobileCompareProductLibrary:
    rows = (
        db.execute(
            select(ProductIndex)
            .where(ProductIndex.category == category)
            .order_by(ProductIndex.created_at.desc())
            .limit(80)
        )
        .scalars()
        .all()
    )
    usage = _usage_count_by_product_id(
        db=db,
        owner_type=owner_type,
        owner_id=owner_id,
        category=category,
    )
    row_ids = {str(row.id) for row in rows}

    most_used_product_id: str | None = None
    if usage:
        candidates = [(count, pid) for pid, count in usage.items() if pid in row_ids]
        candidates.sort(key=lambda item: (-item[0], item[1]))
        if candidates and candidates[0][0] > 0:
            most_used_product_id = candidates[0][1]

    items = []
    row_order: dict[str, int] = {}
    for idx, row in enumerate(rows):
        row_order[str(row.id)] = idx
    for row in rows:
        pid = str(row.id)
        item = MobileCompareLibraryProductItem(
            product=_row_to_product_card(row),
            is_recommendation=bool(recommendation_product_id and pid == recommendation_product_id),
            is_most_used=bool(most_used_product_id and pid == most_used_product_id),
            usage_count=int(usage.get(pid, 0)),
        )
        items.append(item)

    def sort_key(item: MobileCompareLibraryProductItem) -> tuple[int, int, int]:
        primary = 0
        if item.is_recommendation:
            primary = 0
        elif item.is_most_used:
            primary = 1
        else:
            primary = 2
        usage_key = -int(item.usage_count or 0)
        order_key = int(row_order.get(str(item.product.id), 10_000))
        return (primary, usage_key, order_key)

    items.sort(key=sort_key)
    return MobileCompareProductLibrary(
        recommendation_product_id=recommendation_product_id,
        most_used_product_id=most_used_product_id,
        items=items,
    )


def _build_deterministic_ingredient_diff(
    *,
    current_doc: ProductDoc,
    recommended_doc: ProductDoc,
    include_inci_order_diff: bool,
    include_function_rank_diff: bool,
) -> MobileCompareIngredientDiff:
    current_items = _extract_ingredient_rows(current_doc)
    recommended_items = _extract_ingredient_rows(recommended_doc)

    current_map = {item["key"]: item for item in current_items}
    recommended_map = {item["key"]: item for item in recommended_items}
    overlap_keys = [item["key"] for item in current_items if item["key"] in recommended_map]
    only_current_keys = [item["key"] for item in current_items if item["key"] not in recommended_map]
    only_recommended_keys = [item["key"] for item in recommended_items if item["key"] not in current_map]

    inci_order_diff: list[MobileCompareIngredientOrderDiff] = []
    if include_inci_order_diff:
        shifts: list[tuple[int, int, int, str]] = []
        for key in overlap_keys:
            cur_rank = int(current_map[key]["rank"])
            rec_rank = int(recommended_map[key]["rank"])
            if cur_rank == rec_rank:
                continue
            shifts.append((abs(cur_rank - rec_rank), cur_rank, rec_rank, str(current_map[key]["name"])))
        shifts.sort(key=lambda item: (-item[0], item[1], item[2]))
        inci_order_diff = [
            MobileCompareIngredientOrderDiff(
                ingredient=name,
                current_rank=cur_rank,
                recommended_rank=rec_rank,
            )
            for _, cur_rank, rec_rank, name in shifts[:12]
        ]

    function_rank_diff: list[MobileCompareFunctionRankDiff] = []
    if include_function_rank_diff:
        current_scores = _function_priority_scores(current_items)
        recommended_scores = _function_priority_scores(recommended_items)
        union_keys = sorted(set(current_scores.keys()) | set(recommended_scores.keys()))
        diffs: list[tuple[float, str, float, float]] = []
        for key in union_keys:
            current_score = float(current_scores.get(key, 0.0))
            recommended_score = float(recommended_scores.get(key, 0.0))
            if abs(current_score - recommended_score) < 0.0001:
                continue
            diffs.append((abs(current_score - recommended_score), key, current_score, recommended_score))
        diffs.sort(key=lambda item: (-item[0], item[1]))
        function_rank_diff = [
            MobileCompareFunctionRankDiff(
                function=fn,
                current_score=round(cur, 4),
                recommended_score=round(rec, 4),
            )
            for _, fn, cur, rec in diffs[:12]
        ]

    return MobileCompareIngredientDiff(
        overlap=[str(current_map[key]["name"]) for key in overlap_keys[:40]],
        only_current=[str(current_map[key]["name"]) for key in only_current_keys[:40]],
        only_recommended=[str(recommended_map[key]["name"]) for key in only_recommended_keys[:40]],
        inci_order_diff=inci_order_diff,
        function_rank_diff=function_rank_diff,
    )


def _extract_ingredient_rows(doc: ProductDoc) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    seen: set[str] = set()
    for idx, item in enumerate(doc.ingredients, start=1):
        name = str(item.name or "").strip()
        if not name:
            continue
        key = name.lower()
        if key in seen:
            continue
        seen.add(key)
        functions = [str(fn or "").strip() for fn in item.functions if str(fn or "").strip()]
        rank_value = int(item.rank) if isinstance(item.rank, int) and item.rank > 0 else idx
        out.append(
            {
                "key": key,
                "name": name,
                "rank": rank_value,
                "functions": functions,
            }
        )
    return out


def _function_priority_scores(items: list[dict[str, Any]]) -> dict[str, float]:
    raw: dict[str, float] = defaultdict(float)
    for idx, item in enumerate(items):
        functions = item.get("functions") or []
        if not isinstance(functions, list):
            continue
        weight = float(max(1, 20 - idx))
        for fn in functions:
            text = str(fn or "").strip().lower()
            if not text:
                continue
            raw[text] += weight

    if not raw:
        return {}
    peak = max(raw.values()) or 1.0
    return {key: value / peak for key, value in raw.items()}




def _match_existing_product_id_for_usage(
    *,
    db: Session,
    category: str,
    brand: str,
    name: str,
) -> str | None:
    normalized_brand = _normalize_text_for_match(brand)
    normalized_name = _normalize_text_for_match(name)
    if not normalized_name and not normalized_brand:
        return None

    rows = (
        db.execute(
            select(ProductIndex)
            .where(ProductIndex.category == category)
            .order_by(ProductIndex.created_at.desc())
            .limit(200)
        )
        .scalars()
        .all()
    )

    # 优先：品牌 + 名称完全匹配
    for row in rows:
        row_brand = _normalize_text_for_match(row.brand)
        row_name = _normalize_text_for_match(row.name)
        if normalized_name and normalized_brand and row_name == normalized_name and row_brand == normalized_brand:
            return str(row.id)

    # 次优：名称完全匹配
    if normalized_name:
        for row in rows:
            row_name = _normalize_text_for_match(row.name)
            if row_name == normalized_name:
                return str(row.id)

    return None


def _normalize_text_for_match(raw: str | None) -> str:
    text = str(raw or "").strip().lower()
    if not text:
        return ""
    return "".join(ch for ch in text if ch.isalnum())


def _normalize_category_or_default(raw: str | None) -> str:
    if raw is None:
        return "shampoo"
    value = str(raw or "").strip().lower()
    if not value:
        return "shampoo"
    if value not in VALID_CATEGORIES:
        raise HTTPException(status_code=400, detail=f"Invalid category: {value}.")
    return value


def _normalize_required_category(raw: str | None) -> str:
    value = str(raw or "").strip().lower()
    if not value:
        raise HTTPException(status_code=400, detail="category is required.")
    if value not in VALID_CATEGORIES:
        raise HTTPException(status_code=400, detail=f"Invalid category: {value}.")
    return value


def _selection_session_order_expr():
    return (
        MobileSelectionSession.is_pinned.desc(),
        MobileSelectionSession.pinned_at.desc(),
        MobileSelectionSession.created_at.desc(),
    )


def _latest_selection_session(
    *,
    db: Session,
    owner_type: str,
    owner_id: str,
    category: str,
) -> MobileSelectionSession | None:
    return (
        db.execute(
            select(MobileSelectionSession)
            .where(MobileSelectionSession.owner_type == owner_type)
            .where(MobileSelectionSession.owner_id == owner_id)
            .where(MobileSelectionSession.category == category)
            .where(MobileSelectionSession.deleted_at.is_(None))
            .order_by(MobileSelectionSession.created_at.desc())
            .limit(1)
        )
        .scalars()
        .first()
    )


def _selection_basis(row: MobileSelectionSession | None) -> str:
    if row is None:
        return "none"
    return "latest"


def _build_profile_summary_from_session(row: MobileSelectionSession | None) -> list[str]:
    if row is None:
        return []
    try:
        payload = json.loads(row.result_json or "{}")
    except Exception:
        return []
    choices = payload.get("choices")
    if not isinstance(choices, list):
        return []
    out: list[str] = []
    for item in choices:
        if not isinstance(item, dict):
            continue
        label = str(item.get("label") or "").strip()
        if label:
            out.append(label)
    return out[:4]


def _compare_error_payload_from_http_exception(exc: HTTPException) -> dict[str, Any]:
    detail = exc.detail
    if isinstance(detail, dict):
        out = dict(detail)
        out.setdefault("http_status", exc.status_code)
        out.setdefault("retryable", exc.status_code >= 500)
        return out
    return {
        "code": "COMPARE_HTTP_ERROR",
        "detail": str(detail),
        "http_status": exc.status_code,
        "retryable": exc.status_code >= 500,
    }


def _to_sse(event: str, payload: dict[str, Any]) -> str:
    return f"event: {event}\ndata: {json.dumps(payload, ensure_ascii=False)}\n\n"


def _row_to_mobile_response(row: MobileSelectionSession) -> MobileSelectionResolveResponse:
    try:
        payload = json.loads(row.result_json)
    except Exception as e:  # pragma: no cover
        raise HTTPException(status_code=500, detail=f"Invalid session payload: {e}") from e
    try:
        resolved = MobileSelectionResolveResponse.model_validate(payload)
        return resolved.model_copy(
            update={
                "is_pinned": bool(row.is_pinned),
                "pinned_at": row.pinned_at,
            }
        )
    except Exception as e:  # pragma: no cover
        raise HTTPException(status_code=500, detail=f"Session payload schema invalid: {e}") from e


def _resolve_owner(request: Request) -> tuple[str, str, bool]:
    existing = _normalize_owner_id(request.cookies.get(MOBILE_OWNER_COOKIE_NAME))
    if existing:
        return MOBILE_OWNER_TYPE_DEVICE, existing, False
    forwarded = _normalize_owner_id(request.headers.get("x-mobile-device-id"))
    if forwarded:
        return MOBILE_OWNER_TYPE_DEVICE, forwarded, False
    return MOBILE_OWNER_TYPE_DEVICE, str(uuid4()), True


def _set_owner_cookie(response: Response, owner_id: str, request: Request) -> None:
    response.set_cookie(
        key=MOBILE_OWNER_COOKIE_NAME,
        value=owner_id,
        max_age=MOBILE_OWNER_COOKIE_MAX_AGE_SECONDS,
        httponly=True,
        samesite="lax",
        secure=_is_secure_request(request),
        path="/",
    )


def _is_secure_request(request: Request) -> bool:
    if request.url.scheme == "https":
        return True
    forwarded_proto = str(request.headers.get("x-forwarded-proto") or "").lower()
    return "https" in forwarded_proto


def _normalize_session_ids(raw_ids: list[str]) -> list[str]:
    normalized: list[str] = []
    seen: set[str] = set()
    for item in raw_ids or []:
        value = str(item or "").strip()
        if not value or value in seen:
            continue
        seen.add(value)
        normalized.append(value)
    return normalized


def _normalize_owner_id(raw: str | None) -> str:
    value = str(raw or "").strip()
    if not value:
        return ""
    if len(value) > 128:
        return ""
    return value


def _build_answers_hash(category: str, answers: dict[str, str]) -> str:
    canonical = json.dumps({"category": category, "answers": answers}, ensure_ascii=False, sort_keys=True)
    return hashlib.sha1(canonical.encode("utf-8")).hexdigest()


def _normalize_answers(raw: dict[str, str]) -> dict[str, str]:
    normalized: dict[str, str] = {}
    for k, v in (raw or {}).items():
        key = str(k or "").strip()
        value = str(v or "").strip()
        if not key or not value:
            continue
        normalized[key] = value
    return normalized


def _selection_target_type_key(category: str, route_key: str) -> str | None:
    normalized_category = str(category or "").strip().lower()
    normalized_route_key = str(route_key or "").strip()
    if normalized_category not in ROUTE_MAPPING_SUPPORTED_CATEGORIES:
        if normalized_category in VALID_CATEGORIES:
            return CATEGORY_LEVEL_TARGET_KEY
        return None
    if normalized_category == "shampoo":
        decision = SHAMPOO_ROUTE_DECISIONS.get(normalized_route_key)
        if not decision:
            return None
        mapped = str(decision.get("bundle_key") or "").strip()
        return mapped or None
    if normalized_category == "bodywash":
        return normalized_route_key or None
    return None


def _pick_featured_product_row(
    db: Session,
    category: str,
    target_type_key: str,
) -> ProductIndex | None:
    try:
        slot = db.execute(
            select(ProductFeaturedSlot)
            .where(ProductFeaturedSlot.category == category)
            .where(ProductFeaturedSlot.target_type_key == target_type_key)
            .limit(1)
        ).scalars().first()
    except OperationalError as exc:
        raise _featured_slot_schema_http_error(exc) from exc
    if slot is None:
        return None
    product_id = str(slot.product_id or "").strip()
    if not product_id:
        return None
    product = db.get(ProductIndex, product_id)
    if product is None:
        return None
    if str(product.category or "").strip().lower() != category:
        return None
    if not exists_rel_path(str(product.json_path or "")):
        return None
    return product


def _extract_route_score_from_mapping(scores_json: str, target_type_key: str) -> int | None:
    raw = str(scores_json or "").strip()
    if not raw:
        return None
    try:
        parsed = json.loads(raw)
    except Exception:
        return None
    if not isinstance(parsed, list):
        return None
    for item in parsed:
        if not isinstance(item, dict):
            continue
        route_key = str(item.get("route_key") or "").strip()
        if route_key != target_type_key:
            continue
        try:
            score = int(item.get("confidence"))
        except Exception:
            return None
        return max(0, min(100, score))
    return None


def _pick_route_mapped_product_row(
    db: Session,
    category: str,
    target_type_key: str,
    rules_version: str,
) -> ProductIndex | None:
    try:
        rows = db.execute(
            select(ProductRouteMappingIndex)
            .where(ProductRouteMappingIndex.category == category)
            .where(ProductRouteMappingIndex.rules_version == rules_version)
            .where(ProductRouteMappingIndex.status == "ready")
            .order_by(ProductRouteMappingIndex.last_generated_at.desc())
        ).scalars().all()
    except OperationalError:
        return None

    best_row: ProductIndex | None = None
    best_score = -1
    best_generated_at = ""
    for mapping in rows:
        score = _extract_route_score_from_mapping(str(mapping.scores_json or ""), target_type_key)
        if score is None or score <= 0:
            continue
        product = db.get(ProductIndex, str(mapping.product_id))
        if not product:
            continue
        if str(product.category or "").strip().lower() != category:
            continue
        if not exists_rel_path(str(product.json_path or "")):
            continue
        generated_at = str(mapping.last_generated_at or "")
        if score > best_score or (score == best_score and generated_at > best_generated_at):
            best_score = score
            best_generated_at = generated_at
            best_row = product
    return best_row


def _pick_product_row(db: Session, category: str) -> ProductIndex | None:
    return db.execute(
        select(ProductIndex)
        .where(ProductIndex.category == category)
        .order_by(ProductIndex.created_at.desc())
        .limit(1)
    ).scalars().first()


def _row_to_product_card(row: ProductIndex) -> ProductCard:
    image_url = f"/{row.image_path.lstrip('/')}" if row.image_path else None
    tags: list[str] = []
    raw_tags = str(row.tags_json or "").strip()
    if raw_tags:
        try:
            parsed = json.loads(raw_tags)
            if isinstance(parsed, list):
                tags = [str(item).strip() for item in parsed if str(item).strip()]
        except Exception:
            tags = []
    return ProductCard(
        id=str(row.id),
        category=str(row.category),
        brand=row.brand,
        name=row.name,
        one_sentence=row.one_sentence,
        tags=tags,
        image_url=image_url,
        created_at=row.created_at,
    )


def _resolve_selection(category: str, answers: dict[str, str]) -> dict[str, Any]:
    if category == "shampoo":
        return _resolve_shampoo(answers)
    if category == "bodywash":
        return _resolve_bodywash(answers)
    if category == "conditioner":
        return _resolve_conditioner(answers)
    if category == "lotion":
        return _resolve_lotion(answers)
    if category == "cleanser":
        return _resolve_cleanser(answers)
    raise HTTPException(status_code=400, detail=f"Unsupported category: {category}.")


def _resolve_shampoo(answers: dict[str, str]) -> dict[str, Any]:
    q1 = _require_value(answers, "q1", {"A", "B", "C"})
    q2 = _require_value(answers, "q2", {"A", "B", "C"})
    q3 = answers.get("q3")
    if q2 not in {"A", "B"}:
        q3 = _require_value(answers, "q3", {"A", "B", "C"})
    elif q3 and q3 not in {"A", "B", "C"}:
        raise HTTPException(status_code=400, detail="Invalid answer: q3.")

    route_key = _resolve_shampoo_route_key(q1=q1, q2=q2, q3=q3)
    decision = SHAMPOO_ROUTE_DECISIONS[route_key]
    bundle_key = str(decision["bundle_key"])
    route_title = SHAMPOO_BUNDLE_TITLES[bundle_key]

    choices = [
        {"key": "q1", "value": q1, "label": SHAMPOO_Q1_LABELS[q1]},
        {"key": "q2", "value": q2, "label": SHAMPOO_Q2_LABELS[q2]},
    ]
    normalized_answers = {"q1": q1, "q2": q2}
    if q3:
        choices.append({"key": "q3", "value": q3, "label": SHAMPOO_Q3_LABELS[q3]})
        normalized_answers["q3"] = q3

    rule_hits = [
        {"rule": "base_filter", "effect": str(decision["base_filter"])},
        {"rule": "pain_filter", "effect": str(decision["pain_filter"])},
    ]
    if decision.get("bonus_filter"):
        rule_hits.append({"rule": "bonus_filter", "effect": str(decision["bonus_filter"])})

    return {
        "answers": normalized_answers,
        "route_key": route_key,
        "route_title": route_title,
        "choices": choices,
        "rule_hits": rule_hits,
        "wiki_href": f"/m/wiki/shampoo?focus={bundle_key}",
    }


def _resolve_shampoo_route_key(q1: str, q2: str, q3: str | None) -> str:
    # Keep same ordering as frontend/lib/mobile/shampooDecision.ts.
    if q2 == "A":
        return "fast-anti-dandruff"
    if q2 == "B":
        return "fast-sensitive-soothe"

    q3v = q3 or "C"
    if q1 == "A" and q3v == "A":
        return "oil-repair-balance"
    if q1 == "A" and q3v == "B":
        return "oil-lightweight-volume"
    if q1 == "A" and q3v == "C":
        return "oil-control-clean"

    if q1 == "B" and q3v == "A":
        return "balance-repair"
    if q1 == "B" and q3v == "B":
        return "balance-lightweight"
    if q1 == "B" and q3v == "C":
        return "balance-simple"

    if q1 == "C" and q3v == "A":
        return "moisture-repair"
    if q1 == "C" and q3v == "B":
        return "moisture-lightweight"
    return "moisture-gentle"


def _resolve_bodywash(answers: dict[str, str]) -> dict[str, Any]:
    q1 = _require_value(answers, "q1", {"A", "B", "C", "D"})
    q2 = _require_value(answers, "q2", {"A", "B"})
    q3 = answers.get("q3")
    q4 = answers.get("q4")
    q5 = answers.get("q5")

    if q2 == "B":
        q3 = _require_value(answers, "q3", {"A", "B", "C", "D"})
        q4 = _require_value(answers, "q4", {"A", "B"})
        q5 = _require_value(answers, "q5", {"A", "B"})
    else:
        if q3 and q3 not in {"A", "B", "C", "D"}:
            raise HTTPException(status_code=400, detail="Invalid answer: q3.")
        if q4 and q4 not in {"A", "B"}:
            raise HTTPException(status_code=400, detail="Invalid answer: q4.")
        if q5 and q5 not in {"A", "B"}:
            raise HTTPException(status_code=400, detail="Invalid answer: q5.")

    route_key = _resolve_bodywash_route_key(q1=q1, q2=q2, q3=q3, q4=q4, q5=q5)
    route_title = BODYWASH_ROUTE_CATEGORY[route_key]

    choices = [
        {"key": "q1", "value": q1, "label": BODYWASH_Q1_LABELS[q1]},
        {"key": "q2", "value": q2, "label": BODYWASH_Q2_LABELS[q2]},
    ]
    normalized_answers = {"q1": q1, "q2": q2}
    if q3:
        choices.append({"key": "q3", "value": q3, "label": BODYWASH_Q3_LABELS[q3]})
        normalized_answers["q3"] = q3
    if q4:
        choices.append({"key": "q4", "value": q4, "label": BODYWASH_Q4_LABELS[q4]})
        normalized_answers["q4"] = q4
    if q5:
        choices.append({"key": "q5", "value": q5, "label": BODYWASH_Q5_LABELS[q5]})
        normalized_answers["q5"] = q5

    rule_hits = [
        {"rule": "q1", "effect": f"基础背景：{BODYWASH_Q1_LABELS[q1]}。"},
        {"rule": "q2", "effect": f"安全优先：{BODYWASH_Q2_LABELS[q2]}。"},
    ]
    if q2 == "A":
        rule_hits.append({"rule": "hard_filter", "effect": "触发敏感快路径，关闭酸类/强洗剂路径。"})
    else:
        rule_hits.append({"rule": "q3", "effect": f"功能主线：{BODYWASH_Q3_LABELS[q3 or 'D']}。"})
        rule_hits.append({"rule": "q4", "effect": f"肤感修正：{BODYWASH_Q4_LABELS[q4 or 'A']}。"})
        rule_hits.append({"rule": "q5", "effect": f"特殊限制：{BODYWASH_Q5_LABELS[q5 or 'B']}。"})
    rule_hits.append({"rule": "route", "effect": f"最终收敛：{route_title}。"})

    return {
        "answers": normalized_answers,
        "route_key": route_key,
        "route_title": route_title,
        "choices": choices,
        "rule_hits": rule_hits,
        "wiki_href": "/m/wiki/bodywash",
    }


def _resolve_bodywash_route_key(q1: str, q2: str, q3: str | None, q4: str | None, q5: str | None) -> str:
    # Keep same ordering as frontend/lib/mobile/bodywashDecision.ts.
    if q2 == "A" or q5 == "A":
        return "rescue"
    if q3 == "C":
        return "polish"
    if q3 == "A":
        return "purge"

    if q3 == "B":
        return "shield"
    if q1 == "A":
        return "shield"
    if q1 == "D" and q4 == "B":
        return "shield"

    if (q1 == "B" or q1 == "C") and q3 == "D" and q2 == "B":
        return "glow"
    return "vibe"


def _resolve_conditioner(answers: dict[str, str]) -> dict[str, Any]:
    target = _require_value(answers, "target", {"tangle", "frizz", "dry-ends", "flat-roots"})
    hair = _require_value(answers, "hair", {"short", "mid-long", "long-damaged", "fine-flat"})
    use = _require_value(answers, "use", {"tips-quick", "hold-1-3", "more-for-smooth", "touch-scalp"})
    avoid = _require_value(answers, "avoid", {"still-rough", "next-day-flat", "strong-fragrance", "residue-film"})

    route_key = f"target:{target}|hair:{hair}|use:{use}|avoid:{avoid}"
    route_title = CONDITIONER_TARGET_TITLE[target]
    choices = [
        {"key": "target", "value": target, "label": CONDITIONER_LABELS["target"][target]},
        {"key": "hair", "value": hair, "label": CONDITIONER_LABELS["hair"][hair]},
        {"key": "use", "value": use, "label": CONDITIONER_LABELS["use"][use]},
        {"key": "avoid", "value": avoid, "label": CONDITIONER_LABELS["avoid"][avoid]},
    ]
    rule_hits = [
        {"rule": "target", "effect": f"核心诉求：{CONDITIONER_LABELS['target'][target]}。"},
        {"rule": "hair", "effect": f"发质约束：{CONDITIONER_LABELS['hair'][hair]}。"},
        {"rule": "use", "effect": f"用法约束：{CONDITIONER_LABELS['use'][use]}。"},
        {"rule": "avoid", "effect": f"排除条件：{CONDITIONER_LABELS['avoid'][avoid]}。"},
    ]
    return {
        "answers": {"target": target, "hair": hair, "use": use, "avoid": avoid},
        "route_key": route_key,
        "route_title": route_title,
        "choices": choices,
        "rule_hits": rule_hits,
        "wiki_href": "/m/wiki/conditioner",
    }


def _resolve_lotion(answers: dict[str, str]) -> dict[str, Any]:
    group = _require_value(answers, "group", {"dry-tight", "rough-dull", "sensitive-red", "stable-maintain"})
    issue = _require_value(answers, "issue", {"itch-flake", "rough-patch", "dull-no-soft", "none"})
    scene = _require_value(answers, "scene", {"after-shower", "dry-cold", "ac-room", "night-repair"})
    avoid = _require_value(answers, "avoid", {"sticky-greasy", "strong-fragrance", "active-too-much", "none"})

    fallback = group == "sensitive-red" and (issue == "itch-flake" or avoid == "active-too-much")
    route_key = f"group:{group}|issue:{issue}|scene:{scene}|avoid:{avoid}|fallback:{'yes' if fallback else 'no'}"
    route_title = LOTION_GROUP_TITLE[group]

    choices = [
        {"key": "group", "value": group, "label": LOTION_LABELS["group"][group]},
        {"key": "issue", "value": issue, "label": LOTION_LABELS["issue"][issue]},
        {"key": "scene", "value": scene, "label": LOTION_LABELS["scene"][scene]},
        {"key": "avoid", "value": avoid, "label": LOTION_LABELS["avoid"][avoid]},
    ]
    rule_hits = [
        {"rule": "group", "effect": f"人群定位：{LOTION_LABELS['group'][group]}。"},
        {"rule": "issue", "effect": f"核心困扰：{LOTION_LABELS['issue'][issue]}。"},
        {"rule": "scene", "effect": f"主要场景：{LOTION_LABELS['scene'][scene]}。"},
        {"rule": "avoid", "effect": f"排除条件：{LOTION_LABELS['avoid'][avoid]}。"},
    ]
    if fallback:
        rule_hits.append({"rule": "fallback", "effect": "触发稳态回退：优先极简修护路径。"})

    return {
        "answers": {"group": group, "issue": issue, "scene": scene, "avoid": avoid},
        "route_key": route_key,
        "route_title": route_title,
        "choices": choices,
        "rule_hits": rule_hits,
        "wiki_href": "/m/wiki/lotion",
    }


def _resolve_cleanser(answers: dict[str, str]) -> dict[str, Any]:
    skin = _require_value(answers, "skin", {"oily-acne", "combo", "dry-sensitive", "stable"})
    issue = _require_value(answers, "issue", {"oil-shine", "tight-after", "sting-red", "residue"})
    scene = _require_value(answers, "scene", {"morning-quick", "night-clean", "post-workout", "after-sunscreen"})
    avoid = _require_value(answers, "avoid", {"over-clean", "strong-fragrance", "low-foam", "complex-formula"})

    fallback = skin == "dry-sensitive" and (issue == "sting-red" or avoid == "over-clean")
    route_key = f"skin:{skin}|issue:{issue}|scene:{scene}|avoid:{avoid}|fallback:{'yes' if fallback else 'no'}"
    route_title = CLEANSER_SKIN_TITLE[skin]

    choices = [
        {"key": "skin", "value": skin, "label": CLEANSER_LABELS["skin"][skin]},
        {"key": "issue", "value": issue, "label": CLEANSER_LABELS["issue"][issue]},
        {"key": "scene", "value": scene, "label": CLEANSER_LABELS["scene"][scene]},
        {"key": "avoid", "value": avoid, "label": CLEANSER_LABELS["avoid"][avoid]},
    ]
    rule_hits = [
        {"rule": "skin", "effect": f"肤质定位：{CLEANSER_LABELS['skin'][skin]}。"},
        {"rule": "issue", "effect": f"核心困扰：{CLEANSER_LABELS['issue'][issue]}。"},
        {"rule": "scene", "effect": f"主要场景：{CLEANSER_LABELS['scene'][scene]}。"},
        {"rule": "avoid", "effect": f"排除条件：{CLEANSER_LABELS['avoid'][avoid]}。"},
    ]
    if fallback:
        rule_hits.append({"rule": "fallback", "effect": "触发耐受回退：优先温和洁面路径。"})

    return {
        "answers": {"skin": skin, "issue": issue, "scene": scene, "avoid": avoid},
        "route_key": route_key,
        "route_title": route_title,
        "choices": choices,
        "rule_hits": rule_hits,
        "wiki_href": "/m/wiki/cleanser",
    }


def _require_value(answers: dict[str, str], key: str, allowed: set[str]) -> str:
    value = str(answers.get(key) or "").strip()
    if not value:
        raise HTTPException(status_code=400, detail=f"Missing answer: {key}.")
    if value not in allowed:
        raise HTTPException(status_code=400, detail=f"Invalid answer: {key}.")
    return value
