import hashlib
import json
import queue
import threading
from collections import defaultdict
from uuid import uuid4
from typing import Any, Callable

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import Session, sessionmaker

from app.ai.errors import AIServiceError
from app.ai.orchestrator import run_capability_now
from app.constants import VALID_CATEGORIES
from app.db.models import MobileSelectionSession, ProductIndex
from app.db.session import get_db
from app.schemas import (
    MobileCompareBootstrapResponse,
    MobileCompareCategoryItem,
    MobileCompareEventRequest,
    MobileCompareIngredientDiff,
    MobileCompareIngredientOrderDiff,
    MobileCompareFunctionRankDiff,
    MobileCompareJobRequest,
    MobileCompareLibraryProductItem,
    MobileComparePersonalization,
    MobileCompareProfileBootstrap,
    MobileCompareProductLibrary,
    MobileCompareRecommendationBootstrap,
    MobileCompareResultResponse,
    MobileCompareResultSection,
    MobileCompareSourceGuide,
    MobileCompareTransparency,
    MobileCompareUploadResponse,
    MobileCompareVerdict,
    MobileSelectionChoice,
    MobileSelectionBatchDeleteRequest,
    MobileSelectionBatchDeleteResponse,
    MobileSelectionLinks,
    MobileSelectionResolveRequest,
    MobileSelectionResolveResponse,
    MobileSelectionRoute,
    MobileSelectionRuleHit,
    ProductDoc,
    ProductCard,
)
from app.services.doubao_pipeline_service import DoubaoPipelineService
from app.services.parser import normalize_doc
from app.services.storage import (
    now_iso,
    new_id,
    save_image,
    save_doubao_artifact,
    exists_rel_path,
    load_json,
)
from app.settings import settings

router = APIRouter(prefix="/api/mobile", tags=["mobile"])

MOBILE_OWNER_COOKIE_NAME = "mx_device_id"
MOBILE_OWNER_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365 * 2
MOBILE_OWNER_TYPE_DEVICE = "device"

# Bump this version when rule mapping changes.
MOBILE_RULES_VERSION = "2026-03-03.1"
MOBILE_COMPARE_VERSION = "2026-03-03.1"

FEATURED_PRODUCT_IDS: dict[str, str] = {
    "shampoo": "db1422ec-6263-45cc-966e-0ee9292fd8f1",
    "bodywash": "5839e60e-ce27-4b83-ab84-cd349126046c",
    "conditioner": "b43ab8f2-f4b2-4d7d-b691-b9c4d2c6c5bc",
    "lotion": "f6774685-cd03-4b99-a606-ef8af9ce1bad",
    "cleanser": "39fe09a5-65ab-40ed-b52b-1033159bab23",
}

CATEGORY_LABELS_ZH: dict[str, str] = {
    "shampoo": "洗发水",
    "bodywash": "沐浴露",
    "conditioner": "护发素",
    "lotion": "润肤霜",
    "cleanser": "洗面奶",
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

    product_row = _pick_product_row(db=db, category=category)
    if product_row is None:
        raise HTTPException(status_code=422, detail=f"No product found for category '{category}'.")
    product = _row_to_product_card(product_row)

    created_at = now_iso()
    session_id = str(uuid4())
    result = MobileSelectionResolveResponse(
        status="ok",
        session_id=session_id,
        reused=False,
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
        stmt.order_by(MobileSelectionSession.created_at.desc()).offset(offset).limit(limit)
    ).scalars().all()
    if owner_cookie_new:
        _set_owner_cookie(response, owner_id, request)
    return [_row_to_mobile_response(row) for row in rows]


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


@router.get("/compare/bootstrap", response_model=MobileCompareBootstrapResponse)
def mobile_compare_bootstrap(
    request: Request,
    response: Response,
    category: str | None = Query(None),
    db: Session = Depends(get_db),
):
    owner_type, owner_id, owner_cookie_new = _resolve_owner(request)
    selected_category = _normalize_category_or_default(category)
    latest = _latest_selection_session(
        db=db,
        owner_type=owner_type,
        owner_id=owner_id,
        category=selected_category,
    )

    profile = MobileCompareProfileBootstrap(
        has_history_profile=latest is not None,
        can_skip=False,
        last_completed_at=latest.created_at if latest else None,
        summary=_build_profile_summary_from_session(latest),
    )

    recommendation = MobileCompareRecommendationBootstrap(exists=False)
    if latest:
        resolved = _row_to_mobile_response(latest)
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
            title="上传你正在用的产品，和首推做一次专业对比",
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
    events: queue.Queue[tuple[str, dict[str, Any]] | None] = queue.Queue()
    SessionMaker = sessionmaker(autocommit=False, autoflush=False, bind=db.get_bind())

    def emit(event: str, data: dict[str, Any]) -> None:
        events.put((event, data))

    def worker() -> None:
        local_db = SessionMaker()
        try:
            result = _run_mobile_compare_job(
                payload=payload,
                owner_type=owner_type,
                owner_id=owner_id,
                db=local_db,
                event_callback=emit,
            )
            emit("result", result.model_dump())
        except HTTPException as e:
            emit("error", _compare_error_payload_from_http_exception(e))
        except AIServiceError as e:
            emit(
                "error",
                {
                    "code": e.code,
                    "detail": e.message,
                    "http_status": e.http_status,
                    "retryable": e.http_status >= 500,
                },
            )
        except Exception as e:  # pragma: no cover
            emit(
                "error",
                {
                    "code": "COMPARE_INTERNAL_ERROR",
                    "detail": str(e),
                    "http_status": 500,
                    "retryable": True,
                },
            )
        finally:
            emit("done", {"status": "done"})
            events.put(None)
            local_db.close()

    threading.Thread(target=worker, daemon=True).start()

    def event_iter():
        while True:
            try:
                item = events.get(timeout=2)
            except queue.Empty:
                yield ": keep-alive\n\n"
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


@router.get("/compare/results/{compare_id}", response_model=MobileCompareResultResponse)
def get_mobile_compare_result(
    compare_id: str,
    request: Request,
    response: Response,
):
    owner_type, owner_id, owner_cookie_new = _resolve_owner(request)
    rel_path = f"doubao_runs/{compare_id}/mobile_compare_result.json"
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
    payload: MobileCompareJobRequest,
    owner_type: str,
    owner_id: str,
    db: Session,
    event_callback: Callable[[str, dict[str, Any]], None],
) -> MobileCompareResultResponse:
    category = _normalize_required_category(payload.category)
    compare_id = new_id()

    event_callback(
        "progress",
        {
            "trace_id": compare_id,
            "stage": "prepare",
            "message": "已开始准备对比上下文。",
            "percent": 5,
        },
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

    event_callback(
        "progress",
        {
            "trace_id": compare_id,
            "stage": "stage1_vision",
            "message": "正在识别你当前产品的包装与成分表。",
            "percent": 15,
        },
    )
    current_doc_payload = _resolve_current_product_doc(
        category=category,
        payload=payload,
        owner_type=owner_type,
        owner_id=owner_id,
        trace_id=compare_id,
        event_callback=event_callback,
        db=db,
    )
    current_doc = ProductDoc.model_validate(current_doc_payload)

    event_callback(
        "progress",
        {
            "trace_id": compare_id,
            "stage": "load_recommended",
            "message": "正在加载历史首推产品。",
            "percent": 55,
        },
    )
    recommended_doc_payload = _load_product_doc_payload_by_id(
        db=db,
        product_id=recommendation.recommended_product.id,
        expected_category=category,
        trace_id=compare_id,
    )
    recommended_doc = ProductDoc.model_validate(recommended_doc_payload)

    ingredient_diff = _build_deterministic_ingredient_diff(
        current_doc=current_doc,
        recommended_doc=recommended_doc,
        include_inci_order_diff=payload.options.include_inci_order_diff,
        include_function_rank_diff=payload.options.include_function_rank_diff,
    )

    compare_context = _build_mobile_compare_context(
        category=category,
        personalization=profile_ctx,
        recommendation=recommendation,
        current_doc=current_doc,
        recommended_doc=recommended_doc,
        ingredient_diff=ingredient_diff,
    )

    event_callback(
        "progress",
        {
            "trace_id": compare_id,
            "stage": "mobile_compare_summary",
            "message": "正在生成个性化结论。",
            "percent": 70,
        },
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

    summary_sections = summary_output.get("sections")
    if not isinstance(summary_sections, dict):
        raise HTTPException(
            status_code=500,
            detail={
                "code": "COMPARE_SUMMARY_INVALID",
                "detail": "AI summary output sections is invalid.",
                "retryable": True,
                "trace_id": compare_id,
            },
        )

    sections = [
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

    personalization = MobileComparePersonalization(
        status=profile_ctx["status"],
        basis=profile_ctx["basis"],
        missing_fields=list(profile_ctx["missing_fields"]),
    )

    warnings: list[str] = []
    if personalization.status != "complete":
        warnings.append("你这次没有补全个人情况，个性化结论置信度会下降。")

    result = MobileCompareResultResponse(
        status="ok",
        trace_id=compare_id,
        compare_id=compare_id,
        category=category,
        personalization=personalization,
        verdict=MobileCompareVerdict(
            decision=str(summary_output.get("decision") or "hybrid"),
            headline=str(summary_output.get("headline") or "").strip(),
            confidence=float(summary_output.get("confidence") or 0.0),
        ),
        sections=sections,
        ingredient_diff=ingredient_diff,
        transparency=MobileCompareTransparency(
            model=str(summary_output.get("model") or "") or None,
            warnings=warnings,
            missing_fields=list(profile_ctx["missing_fields"]),
        ),
        recommendation=recommendation,
        current_product=current_doc,
        recommended_product=recommended_doc,
        created_at=now_iso(),
    )

    save_doubao_artifact(
        compare_id,
        "mobile_compare_result",
        {
            "owner_type": owner_type,
            "owner_id": owner_id,
            "compare_version": MOBILE_COMPARE_VERSION,
            "result": result.model_dump(),
        },
    )
    event_callback(
        "progress",
        {
            "trace_id": compare_id,
            "stage": "done",
            "message": "对比已完成。",
            "percent": 100,
        },
    )
    return result


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


def _resolve_current_product_doc(
    *,
    category: str,
    payload: MobileCompareJobRequest,
    owner_type: str,
    owner_id: str,
    trace_id: str,
    event_callback: Callable[[str, dict[str, Any]], None],
    db: Session,
) -> dict[str, Any]:
    source = str(payload.current_product.source or "upload_new").strip().lower()
    if source == "history_product":
        product_id = str(payload.current_product.product_id or "").strip()
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
        _increase_product_usage_count(product_id=product_id, category=category)
        return doc

    if source != "upload_new":
        raise HTTPException(
            status_code=400,
            detail={
                "code": "COMPARE_SOURCE_INVALID",
                "detail": f"Unsupported current_product.source: {source}.",
                "retryable": False,
                "trace_id": trace_id,
            },
        )

    upload_id = str(payload.current_product.upload_id or "").strip()
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
        event_type = str(event.get("type") or "").strip().lower()
        stage = str(event.get("stage") or "").strip() or "pipeline"
        if event_type == "step":
            event_callback(
                "progress",
                {
                    "trace_id": trace_id,
                    "stage": stage,
                    "message": str(event.get("message") or "").strip(),
                },
            )
            return
        if event_type == "delta":
            delta = str(event.get("delta") or "")
            if delta:
                event_callback(
                    "partial_text",
                    {
                        "trace_id": trace_id,
                        "channel": stage,
                        "text": delta,
                    },
                )
            return
        if event_type.startswith("job_"):
            event_callback(
                "progress",
                {
                    "trace_id": trace_id,
                    "stage": stage,
                    "message": event_type,
                },
            )

    stage1 = pipeline.analyze_stage1(
        image_path=image_path,
        trace_id=trace_id,
        event_callback=on_pipeline_event,
    )
    event_callback(
        "progress",
        {
            "trace_id": trace_id,
            "stage": "stage2_struct",
            "message": "正在结构化提取成分与摘要。",
            "percent": 40,
        },
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
    raw_category = str(product.get("category") or "").strip().lower()
    if raw_category and raw_category != category:
        raise HTTPException(
            status_code=422,
            detail={
                "code": "COMPARE_CATEGORY_MISMATCH",
                "detail": f"Current product category '{raw_category}' does not match selected category '{category}'.",
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
        _increase_product_usage_count(product_id=matched_product_id, category=category)
    return normalized


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
    stage = str(event.get("stage") or "").strip() or "mobile_compare_summary"
    if event_type == "step":
        event_callback(
            "progress",
            {
                "trace_id": trace_id,
                "stage": stage,
                "message": str(event.get("message") or "").strip(),
            },
        )
        return
    if event_type == "delta":
        delta = str(event.get("delta") or "")
        if delta:
            event_callback(
                "partial_text",
                {
                    "trace_id": trace_id,
                    "channel": "analysis_live",
                    "text": delta,
                },
            )
        return
    if event_type.startswith("job_"):
        event_callback(
            "progress",
            {
                "trace_id": trace_id,
                "stage": stage,
                "message": event_type,
            },
        )


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
        out.append(
            {
                "key": key,
                "name": name,
                "rank": idx,
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


def _usage_store_rel_path() -> str:
    return "doubao_runs/mobile_compare_usage/usage_counts.json"


def _load_mobile_compare_usage_map() -> dict[str, Any]:
    rel_path = _usage_store_rel_path()
    if not exists_rel_path(rel_path):
        return {"products": {}, "updated_at": now_iso()}
    raw = load_json(rel_path)
    if not isinstance(raw, dict):
        return {"products": {}, "updated_at": now_iso()}
    products = raw.get("products")
    if not isinstance(products, dict):
        products = {}
    return {
        "products": products,
        "updated_at": str(raw.get("updated_at") or now_iso()),
    }


def _save_mobile_compare_usage_map(payload: dict[str, Any]) -> None:
    save_doubao_artifact("mobile_compare_usage", "usage_counts", payload)


def _increase_product_usage_count(*, product_id: str, category: str) -> None:
    pid = str(product_id or "").strip()
    cat = str(category or "").strip().lower()
    if not pid or not cat:
        return
    payload = _load_mobile_compare_usage_map()
    products = payload.get("products")
    if not isinstance(products, dict):
        products = {}
    row = products.get(pid)
    if not isinstance(row, dict):
        row = {"count": 0, "category": cat}
    row["count"] = int(row.get("count") or 0) + 1
    row["category"] = cat
    row["updated_at"] = now_iso()
    products[pid] = row
    payload["products"] = products
    payload["updated_at"] = now_iso()
    _save_mobile_compare_usage_map(payload)


def _usage_count_by_product_id(*, category: str) -> dict[str, int]:
    payload = _load_mobile_compare_usage_map()
    products = payload.get("products")
    if not isinstance(products, dict):
        return {}
    out: dict[str, int] = {}
    for product_id, item in products.items():
        if not isinstance(item, dict):
            continue
        cat = str(item.get("category") or "").strip().lower()
        if cat != category:
            continue
        try:
            count = int(item.get("count") or 0)
        except Exception:
            count = 0
        if count > 0:
            out[str(product_id)] = count
    return out


def _build_mobile_compare_product_library(
    *,
    db: Session,
    category: str,
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
    usage = _usage_count_by_product_id(category=category)
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
        return MobileSelectionResolveResponse.model_validate(payload)
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


def _pick_product_row(db: Session, category: str) -> ProductIndex | None:
    featured_id = FEATURED_PRODUCT_IDS.get(category)
    if featured_id:
        featured = db.get(ProductIndex, featured_id)
        if featured and featured.category == category:
            return featured

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
