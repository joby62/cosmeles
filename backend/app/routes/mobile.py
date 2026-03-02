import hashlib
import json
from uuid import uuid4
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.constants import VALID_CATEGORIES
from app.db.models import MobileSelectionSession, ProductIndex
from app.db.session import get_db
from app.schemas import (
    MobileSelectionChoice,
    MobileSelectionLinks,
    MobileSelectionResolveRequest,
    MobileSelectionResolveResponse,
    MobileSelectionRoute,
    MobileSelectionRuleHit,
    ProductCard,
)
from app.services.storage import now_iso

router = APIRouter(prefix="/api/mobile", tags=["mobile"])

# Bump this version when rule mapping changes.
MOBILE_RULES_VERSION = "2026-03-03.1"

FEATURED_PRODUCT_IDS: dict[str, str] = {
    "shampoo": "db1422ec-6263-45cc-966e-0ee9292fd8f1",
    "bodywash": "5839e60e-ce27-4b83-ab84-cd349126046c",
    "conditioner": "b43ab8f2-f4b2-4d7d-b691-b9c4d2c6c5bc",
    "lotion": "f6774685-cd03-4b99-a606-ef8af9ce1bad",
    "cleanser": "39fe09a5-65ab-40ed-b52b-1033159bab23",
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
def resolve_mobile_selection(payload: MobileSelectionResolveRequest, db: Session = Depends(get_db)):
    category = str(payload.category or "").strip().lower()
    if category not in VALID_CATEGORIES:
        raise HTTPException(status_code=400, detail=f"Invalid category: {category}.")

    answers = _normalize_answers(payload.answers)
    resolved = _resolve_selection(category=category, answers=answers)
    answers_hash = _build_answers_hash(category=category, answers=resolved["answers"])

    if payload.reuse_existing:
        existing = db.execute(
            select(MobileSelectionSession)
            .where(MobileSelectionSession.category == category)
            .where(MobileSelectionSession.rules_version == MOBILE_RULES_VERSION)
            .where(MobileSelectionSession.answers_hash == answers_hash)
            .order_by(MobileSelectionSession.created_at.desc())
            .limit(1)
        ).scalars().first()
        if existing:
            stored = _row_to_mobile_response(existing)
            return stored.model_copy(update={"reused": True})

    product_row = _pick_product_row(db=db, category=category)
    if product_row is None:
        raise HTTPException(status_code=422, detail=f"No product found for category '{category}'.")
    product = _row_to_product_card(product_row)

    created_at = now_iso()
    session_id = str(uuid4())
    response = MobileSelectionResolveResponse(
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
        category=category,
        rules_version=MOBILE_RULES_VERSION,
        answers_hash=answers_hash,
        route_key=resolved["route_key"],
        route_title=resolved["route_title"],
        product_id=product.id,
        answers_json=json.dumps(resolved["answers"], ensure_ascii=False),
        result_json=json.dumps(response.model_dump(), ensure_ascii=False),
        created_at=created_at,
    )
    db.add(row)
    db.commit()
    return response


@router.get("/selection/sessions/{session_id}", response_model=MobileSelectionResolveResponse)
def get_mobile_selection_session(session_id: str, db: Session = Depends(get_db)):
    row = db.get(MobileSelectionSession, session_id)
    if not row:
        raise HTTPException(status_code=404, detail="Selection session not found.")
    return _row_to_mobile_response(row)


@router.get("/selection/sessions", response_model=list[MobileSelectionResolveResponse])
def list_mobile_selection_sessions(
    category: str | None = Query(None),
    offset: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    stmt = select(MobileSelectionSession)
    if category:
        normalized = str(category).strip().lower()
        if normalized not in VALID_CATEGORIES:
            raise HTTPException(status_code=400, detail=f"Invalid category: {normalized}.")
        stmt = stmt.where(MobileSelectionSession.category == normalized)
    rows = db.execute(
        stmt.order_by(MobileSelectionSession.created_at.desc()).offset(offset).limit(limit)
    ).scalars().all()
    return [_row_to_mobile_response(row) for row in rows]


def _row_to_mobile_response(row: MobileSelectionSession) -> MobileSelectionResolveResponse:
    try:
        payload = json.loads(row.result_json)
    except Exception as e:  # pragma: no cover
        raise HTTPException(status_code=500, detail=f"Invalid session payload: {e}") from e
    try:
        return MobileSelectionResolveResponse.model_validate(payload)
    except Exception as e:  # pragma: no cover
        raise HTTPException(status_code=500, detail=f"Session payload schema invalid: {e}") from e


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
