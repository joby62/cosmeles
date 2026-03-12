import hashlib
import json
import queue
import threading
import re
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
    IngredientLibraryAlias,
    IngredientLibraryIndex,
    IngredientLibraryRedirect,
    MobileBagItem,
    MobileClientEvent,
    MobileCompareSessionIndex,
    MobileCompareUsageStat,
    MobileSelectionSession,
    ProductFeaturedSlot,
    ProductIndex,
    ProductAnalysisIndex,
    ProductRouteMappingIndex,
    UserProduct,
    UserUploadAsset,
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
    MobileClientEventRequest,
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
    MobileUserProductItem,
    MobileUserProductListResponse,
    MobileSelectionChoice,
    MobileSelectionFitExplanationItem,
    MobileSelectionFitExplanationResponse,
    MobileSelectionBatchDeleteRequest,
    MobileSelectionBatchDeleteResponse,
    MobileSelectionMatrixAnalysis,
    MobileSelectionMatrixQuestionContribution,
    MobileSelectionMatrixQuestionRouteDelta,
    MobileSelectionMatrixRouteScore,
    MobileSelectionMatrixTopRoute,
    MobileSelectionMatrixTriggeredVeto,
    MobileSelectionMatrixVetoRoute,
    MobileSelectionPinRequest,
    MobileSelectionLinks,
    MobileSelectionResolveRequest,
    MobileSelectionResolveResponse,
    MobileSelectionRoute,
    MobileSelectionRuleHit,
    MobileWikiCategoryFacet,
    MobileWikiIngredientRef,
    MobileWikiProductDetailItem,
    MobileWikiProductDetailResponse,
    MobileWikiProductAnalysisResponse,
    MobileWikiProductItem,
    MobileWikiProductListResponse,
    MobileWikiSubtypeFacet,
    ProductDoc,
    ProductCard,
    ProductAnalysisStoredResult,
)
from app.services.doubao_pipeline_service import DoubaoPipelineService
from app.services.matrix_decision import (
    MatrixDecisionConfig,
    MatrixDecisionResult,
    MatrixDecisionError,
    compile_matrix_config,
    resolve_matrix_selection,
)
from app.services.parser import normalize_doc
from app.services.selection_fit import RouteDiagnosticRule, get_route_diagnostic_rules
from app.services.storage import (
    copy_user_image_to_product,
    exists_rel_path,
    load_json,
    new_id,
    now_iso,
    preferred_image_rel_path,
    product_analysis_rel_path,
    remove_rel_dir,
    save_doubao_artifact,
    save_json_at,
    save_user_product_json,
    save_user_upload_bundle,
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
ROUTE_MAPPED_CATEGORIES = set(ROUTE_MAPPING_SUPPORTED_CATEGORIES)
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

SHAMPOO_ROUTE_TITLES = {
    "deep-oil-control": "深层控油型",
    "anti-dandruff-itch": "去屑止痒型",
    "gentle-soothing": "温和舒缓型",
    "anti-hair-loss": "防脱强韧型",
    "moisture-balance": "水油平衡型",
}

SHAMPOO_MATRIX_MODEL = {
    "category": "shampoo",
    "categories": [
        "deep-oil-control",
        "anti-dandruff-itch",
        "gentle-soothing",
        "anti-hair-loss",
        "moisture-balance",
    ],
    "questions": [
        {
            "key": "q1",
            "title": "头皮出油节奏",
            "options": {
                "A": "一天不洗就塌/油 (重度)",
                "B": "2-3天洗一次正好 (中度)",
                "C": "3天以上不洗也不油 (干性)",
            },
        },
        {
            "key": "q2",
            "title": "头皮核心痛点",
            "options": {
                "A": "有头屑且发痒 (真菌)",
                "B": "头皮发红/刺痛/长痘 (敏感)",
                "C": "掉发明显/发根脆弱 (脱发)",
                "D": "无特殊感觉 (健康)",
            },
        },
        {
            "key": "q3",
            "title": "发丝状态参考",
            "options": {
                "A": "频繁染烫/干枯易断",
                "B": "细软塌/贴头皮",
                "C": "原生发/健康",
            },
        },
    ],
    "scoring_matrix": {
        "q1": {
            "A": [15, 5, -10, -15, -15],
            "B": [-5, 0, 5, 0, 5],
            "C": [-15, -5, 10, 0, 15],
        },
        "q2": {
            "A": [0, 30, 0, 0, -10],
            "B": [-20, -15, 30, -10, 5],
            "C": [5, 0, 5, 30, 0],
            "D": [2, -5, -5, -5, 5],
        },
        "q3": {
            "A": [-5, 0, 5, 0, 8],
            "B": [5, 0, 0, 5, -5],
            "C": [0, 0, 0, 0, 0],
        },
    },
    "veto_masks": [
        {
            "trigger": "q2 == 'B'",
            "mask": [0, 0, 1, 0, 1],
            "note": "敏感防线：长痘/红肿期禁止使用强去油、强去屑及扩张血管的防脱成分",
        },
        {
            "trigger": "q2 == 'A'",
            "mask": [1, 1, 1, 1, 0],
            "note": "真菌防线：真菌感染期禁止使用高保湿平衡型产品，避免养活菌群",
        },
        {
            "trigger": "q1 == 'C'",
            "mask": [0, 1, 1, 1, 1],
            "note": "干皮脱脂防线：干性头皮禁止使用重度控油产品",
        },
    ],
}
SHAMPOO_MATRIX_CONFIG = compile_matrix_config(SHAMPOO_MATRIX_MODEL)

BODYWASH_ROUTE_TITLES = {
    "rescue": "恒温舒缓修护型",
    "purge": "水杨酸净彻控油型",
    "polish": "乳酸尿素更新型",
    "glow": "氨基酸亮肤型",
    "shield": "脂类补充油膏型",
    "vibe": "轻盈香氛平衡型",
}

BODYWASH_MATRIX_MODEL = {
    "category": "bodywash",
    "categories": [
        "rescue",
        "purge",
        "polish",
        "glow",
        "shield",
        "vibe",
    ],
    "questions": [
        {
            "key": "q1",
            "title": "气候与微环境",
            "options": {
                "A": "干燥寒冷",
                "B": "干燥炎热",
                "C": "潮湿闷热",
                "D": "潮湿寒冷",
            },
        },
        {
            "key": "q2",
            "title": "耐受度",
            "options": {
                "A": "极度敏感",
                "B": "屏障健康",
            },
        },
        {
            "key": "q3",
            "title": "油脂与角质状态",
            "options": {
                "A": "出油旺盛",
                "B": "缺油干涩",
                "C": "角质堆积（鸡皮/厚茧）",
                "D": "状态正常（无明显痛点）",
            },
        },
        {
            "key": "q4",
            "title": "冲洗肤感偏好",
            "options": {
                "A": "清爽干脆",
                "B": "柔滑滋润",
            },
        },
        {
            "key": "q5",
            "title": "特殊限制",
            "options": {
                "A": "极致纯净",
                "B": "情绪留香",
            },
        },
    ],
    "scoring_matrix": {
        "q1": {
            "A": [5, -10, -5, 0, 10, 0],
            "B": [0, 5, 0, 10, -5, 5],
            "C": [0, 10, 5, 5, -10, 5],
            "D": [5, 0, 0, 0, 5, 0],
        },
        "q2": {
            "A": [15, 0, 0, 0, 0, 0],
            "B": [0, 5, 5, 5, 0, 5],
        },
        "q3": {
            "A": [0, 20, 10, 0, -20, 5],
            "B": [10, -20, -10, 0, 20, 0],
            "C": [0, 10, 20, 0, -10, 0],
            "D": [0, -5, -5, 10, 0, 10],
        },
        "q4": {
            "A": [0, 5, 5, 5, -5, 5],
            "B": [0, 0, 0, 0, 5, 5],
        },
        "q5": {
            "A": [5, 0, 0, 0, 0, 0],
            "B": [-5, 0, 0, 5, 0, 5],
        },
    },
    "veto_masks": [
        {
            "trigger": "q2 == 'A'",
            "mask": [1, 0, 0, 0, 1, 0],
            "note": "病理防线：极度敏感肌强制清零所有刺激项，仅保留舒缓型与脂类补充沐浴油",
        },
        {
            "trigger": "q5 == 'A'",
            "mask": [1, 0, 0, 1, 1, 0],
            "note": "孕妇/绝对纯净防线：强制清零刺激性酸类（水杨酸/果酸）及香氛型产品，守住母婴安全红线",
        },
        {
            "trigger": "q3 == 'B'",
            "mask": [1, 0, 1, 1, 1, 1],
            "note": "成分排斥防线：大干皮严禁使用水杨酸控油型",
        },
        {
            "trigger": "q3 == 'A'",
            "mask": [1, 1, 1, 1, 0, 1],
            "note": "成分排斥防线：大油田严禁使用重度脂类油膏",
        },
    ],
}
BODYWASH_MATRIX_CONFIG = compile_matrix_config(BODYWASH_MATRIX_MODEL)

CONDITIONER_ROUTE_TITLES = {
    "c-color-lock": "锁色固色型",
    "c-airy-light": "轻盈蓬松型",
    "c-structure-rebuild": "结构修护型",
    "c-smooth-frizz": "柔顺抗躁型",
    "c-basic-hydrate": "基础保湿型",
}

CONDITIONER_MATRIX_MODEL = {
    "category": "conditioner",
    "categories": [
        "c-color-lock",
        "c-airy-light",
        "c-structure-rebuild",
        "c-smooth-frizz",
        "c-basic-hydrate",
    ],
    "questions": [
        {
            "key": "c_q1",
            "title": "发丝受损史",
            "options": {
                "A": "频繁漂/染/烫 (干枯空洞)",
                "B": "偶尔染烫/经常使用热工具 (轻度受损)",
                "C": "原生发/几乎不折腾 (健康)",
            },
        },
        {
            "key": "c_q2",
            "title": "发丝物理形态",
            "options": {
                "A": "细软少/极易贴头皮",
                "B": "粗硬/沙发/天生毛躁",
                "C": "正常适中",
            },
        },
        {
            "key": "c_q3",
            "title": "当前最渴望的视觉效果",
            "options": {
                "A": "刚染完，需要锁色/固色",
                "B": "打结梳不开，需要极致顺滑",
                "C": "发尾不干枯，保持自然蓬松就行",
            },
        },
    ],
    "scoring_matrix": {
        "c_q1": {
            "A": [15, -5, 20, 10, -10],
            "B": [5, 5, 5, 5, 10],
            "C": [-15, 10, -15, -5, 15],
        },
        "c_q2": {
            "A": [0, 25, 5, -20, 5],
            "B": [0, -15, 10, 25, -5],
            "C": [0, 5, 0, 5, 5],
        },
        "c_q3": {
            "A": [25, 0, 5, 0, 0],
            "B": [0, -10, 5, 20, 5],
            "C": [0, 10, 0, -5, 10],
        },
    },
    "veto_masks": [
        {
            "trigger": "c_q2 == 'A'",
            "mask": [1, 1, 1, 0, 1],
            "note": "质地防线：细软塌发质禁止使用重度柔顺产品，防贴头皮",
        },
        {
            "trigger": "c_q1 == 'C'",
            "mask": [0, 1, 0, 1, 1],
            "note": "过氧化/悖论防线：原生发禁止使用结构重塑型和锁色型产品，防发丝过载变硬",
        },
    ],
}
CONDITIONER_MATRIX_CONFIG = compile_matrix_config(CONDITIONER_MATRIX_MODEL)

LOTION_ROUTE_TITLES = {
    "light_hydrate": "轻盈保湿型",
    "heavy_repair": "重度修护型",
    "bha_clear": "BHA净痘型",
    "aha_renew": "AHA焕肤型",
    "glow_bright": "亮肤提光型",
    "vibe_fragrance": "留香氛围型",
}

LOTION_MATRIX_MODEL = {
    "category": "lotion",
    "categories": [
        "light_hydrate",
        "heavy_repair",
        "bha_clear",
        "aha_renew",
        "glow_bright",
        "vibe_fragrance",
    ],
    "questions": [
        {
            "key": "q1",
            "title": "气候环境与当前季节",
            "options": {
                "A": "干燥寒冷 / 长时间待在暖气房",
                "B": "炎热潮湿 / 夏季易出汗环境",
                "C": "换季温差大 / 经常刮风",
                "D": "气候温和 / 室内温湿度适宜",
            },
        },
        {
            "key": "q2",
            "title": "身体肌肤耐受度",
            "options": {
                "A": "极度敏感（易泛红、动不动就干痒、有湿疹/荨麻疹病史）",
                "B": "屏障健康（耐受力强，用猛药极少翻车）",
            },
        },
        {
            "key": "q3",
            "title": "最核心的皮肤痛点",
            "options": {
                "A": "极度干屑（小腿有蛇皮纹、脱屑、干到紧绷瘙痒）",
                "B": "躯干痘痘（前胸后背出油多，常起红肿痘或粉刺）",
                "C": "粗糙颗粒（大腿/手臂有鸡皮肤、毛孔粗糙、手肘脚踝角质厚）",
                "D": "暗沉色差（关节发黑、有晒痕、全身肤色不均）",
                "E": "状态正常（无明显痛点，只需日常维稳与保养）",
            },
        },
        {
            "key": "q4",
            "title": "身体乳质地与肤感偏好",
            "options": {
                "A": "秒吸收的轻薄水感（最怕粘腻沾睡衣，哪怕需要频繁补涂也只选清爽的）",
                "B": "适中滋润的丝滑乳液感（平衡型，好推开且有一定保湿续航）",
                "C": "强包裹的丰润油膏感（必须有厚重的膜感，不然总觉得没涂够）",
            },
        },
        {
            "key": "q5",
            "title": "特殊限制与诉求",
            "options": {
                "A": "极致纯净（孕妇/哺乳期可用，或极度排斥香精、色素、防腐剂）",
                "B": "情绪留香（看重身体乳的调香，希望带香入睡或伪体香）",
                "C": "无特殊限制（更看重实际功效，对香气和纯净度无执念）",
            },
        },
    ],
    "scoring_matrix": {
        "q1": {
            "A": [-10, 10, 0, 0, 0, 5],
            "B": [10, -10, 5, 0, 0, -5],
            "C": [-5, 5, 0, 0, 0, 0],
            "D": [5, -5, 0, 0, 0, 5],
        },
        "q2": {
            "A": [15, 15, 0, 0, 0, 0],
            "B": [0, 0, 5, 5, 5, 0],
        },
        "q3": {
            "A": [-10, 25, -20, -5, -5, -5],
            "B": [10, -20, 25, 5, 0, 0],
            "C": [0, -10, 10, 25, 5, 0],
            "D": [5, 0, 0, 10, 25, 5],
            "E": [15, -10, -15, -15, 10, 20],
        },
        "q4": {
            "A": [5, -5, 0, 0, 0, 0],
            "B": [0, 0, 0, 0, 0, 5],
            "C": [-5, 5, 0, 0, 0, 0],
        },
        "q5": {
            "A": [5, 5, 0, 0, 0, 0],
            "B": [-5, 0, 0, 0, 5, 10],
            "C": [0, 0, 0, 0, 0, 0],
        },
    },
    "veto_masks": [
        {
            "trigger": "q2 == 'A'",
            "mask": [1, 1, 0, 0, 1, 1],
            "note": "敏感防线：极度敏感强制清零水杨酸和果酸",
        },
        {
            "trigger": "q3 == 'B'",
            "mask": [1, 0, 1, 1, 1, 1],
            "note": "致痘防线：长痘强制清零重度修护霜防闷痘",
        },
        {
            "trigger": "q3 == 'A'",
            "mask": [1, 1, 0, 1, 1, 1],
            "note": "脱脂防线：极度干屑强制清零水杨酸防皲裂",
        },
        {
            "trigger": "q5 == 'A'",
            "mask": [1, 1, 0, 0, 1, 0],
            "note": "孕妇/绝对纯净防线：强制清零所有酸类剥脱成分（水杨酸/果酸）及香氛精油",
        },
    ],
}
LOTION_MATRIX_CONFIG = compile_matrix_config(LOTION_MATRIX_MODEL)

CLEANSER_ROUTE_TITLES = {
    "apg_soothing": "APG舒缓型",
    "pure_amino": "纯氨基酸温和型",
    "soap_amino_blend": "皂氨复配清洁型",
    "bha_clearing": "BHA净肤型",
    "clay_purifying": "泥膜净化型",
    "enzyme_polishing": "酵素抛光型",
}

CLEANSER_MATRIX_MODEL = {
    "category": "cleanser",
    "categories": [
        "apg_soothing",
        "pure_amino",
        "soap_amino_blend",
        "bha_clearing",
        "clay_purifying",
        "enzyme_polishing",
    ],
    "questions": [
        {
            "key": "q1",
            "title": "基础肤质与出油量",
            "options": {
                "A": "大油田（全脸泛油，刚洗完很快又油了，经常油光满面）",
                "B": "混油皮（T区出油明显易长黑头，U区正常或偏干）",
                "C": "中性/混干（出油量正常，只有换季或秋冬偶尔感到干燥）",
                "D": "大干皮（极少出油，洗脸后常感紧绷，甚至有起皮脱屑）",
            },
        },
        {
            "key": "q2",
            "title": "屏障健康与敏感度",
            "options": {
                "A": "重度敏感（有红血丝、常泛红发痒、处于烂脸期/皮炎期、极易刺痛）",
                "B": "轻度敏感（换季或受刺激时偶尔泛红，挑选护肤品需要谨慎）",
                "C": "屏障健康（“城墙皮”，基本不过敏，对猛药耐受度高）",
            },
        },
        {
            "key": "q3",
            "title": "日常清洁负担",
            "options": {
                "A": "每天浓妆（全妆，常使用防水彩妆/高倍防水防晒，需强力二次清洁洗去卸妆油残留）",
                "B": "日常淡妆/通勤防晒（仅涂抹普通防晒霜、隔离或轻薄气垫）",
                "C": "仅素颜（基本不化妆，仅需洗去日常分泌的皮脂与灰尘）",
            },
        },
        {
            "key": "q4",
            "title": "面部特殊痛点",
            "options": {
                "A": "黑头与闭口粉刺（T区毛孔粗大，有顽固脂栓）",
                "B": "红肿破口痘（有正在发炎、红肿疼痛或已经破口的痘痘）",
                "C": "暗沉粗糙（角质层较厚，摸起来不平滑，肤色不均/无光泽）",
                "D": "极度缺水紧绷（洗脸是件痛苦的事，洗完立刻干涩刺痛）",
                "E": "无明显痛点（状态稳定，日常健康维稳即可）",
            },
        },
        {
            "key": "q5",
            "title": "质地与洗后肤感",
            "options": {
                "A": "喜欢丰富绵密的泡沫（注重起泡的仪式感和缓冲感）",
                "B": "喜欢“搓盘子”般的绝对清爽感（追求极致去油，摸起来一点都不滑）",
                "C": "喜欢洗后保留水润滑溜感（抗拒紧绷，甚至偏好微微的膜感或保湿感）",
                "D": "喜欢无泡/低泡的温和感（只要温和不刺激就行，对泡沫无执念）",
            },
        },
    ],
    "scoring_matrix": {
        "q1": {
            "A": [-10, -5, 15, 10, 15, 5],
            "B": [-5, 5, 5, 10, 5, 10],
            "C": [5, 10, -10, -5, -5, 5],
            "D": [15, 10, -20, -15, -15, -5],
        },
        "q2": {
            "A": [20, 5, 0, 0, 0, 0],
            "B": [5, 10, -10, -5, -10, -5],
            "C": [-5, 0, 5, 5, 5, 5],
        },
        "q3": {
            "A": [-10, 5, 15, -5, 0, 0],
            "B": [0, 10, 5, 0, 0, 0],
            "C": [10, 5, -5, 0, 0, 0],
        },
        "q4": {
            "A": [0, 0, 10, 25, 15, 5],
            "B": [15, 20, -20, 0, -20, -10],
            "C": [0, 5, 5, 10, 5, 25],
            "D": [25, 15, -20, -10, -15, -5],
            "E": [5, 20, 5, -5, -5, 5],
        },
        "q5": {
            "A": [-5, 5, 5, 0, 0, 5],
            "B": [-5, -5, 5, 0, 5, 0],
            "C": [5, 5, -5, 0, -5, 0],
            "D": [5, -5, -5, 0, 0, 0],
        },
    },
    "veto_masks": [
        {
            "trigger": "q2 == 'A'",
            "mask": [1, 1, 0, 0, 0, 0],
            "note": "敏感防线：重度敏感强制清零皂基、泥膜及所有酸类/酶类剥脱成分",
        },
        {
            "trigger": "q4 == 'B'",
            "mask": [1, 1, 0, 0, 0, 0],
            "note": "破口防线：红肿破口痘强制清零皂基、泥膜物理摩擦以及所有酸类/酶类剥脱成分",
        },
        {
            "trigger": "q1 == 'D' OR q4 == 'D'",
            "mask": [1, 1, 0, 0, 0, 0],
            "note": "脱脂与屏障防线：大干皮或极度紧绷刺痛，强制清零皂基、水杨酸、泥膜，并绝对封杀酵素生物剥脱",
        },
    ],
}
CLEANSER_MATRIX_CONFIG = compile_matrix_config(CLEANSER_MATRIX_MODEL)


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
    recommendation_source = "category_fallback"
    try:
        product_row = _pick_featured_product_row(
            db=db,
            category=category,
            target_type_key=target_type_key,
        )
        if product_row is not None:
            recommendation_source = "featured_slot"
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
        if product_row is not None:
            recommendation_source = "route_mapping"
    if product_row is None:
        product_row = _pick_product_row(db=db, category=category)
        recommendation_source = "category_fallback"
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
        recommendation_source=recommendation_source,
        matrix_analysis=MobileSelectionMatrixAnalysis.model_validate(resolved.get("matrix_analysis") or {}),
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


@router.get("/selection/sessions/{session_id}/fit-explanation", response_model=MobileSelectionFitExplanationResponse)
def get_mobile_selection_fit_explanation(
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
    if row is None:
        raise HTTPException(status_code=404, detail="Selection session not found.")

    resolved = _row_to_mobile_response(row)
    raw_payload = _safe_parse_json_dict(str(row.result_json or ""))
    recommendation_source = _determine_selection_recommendation_source(
        db=db,
        row=row,
        resolved=resolved,
        raw_payload=raw_payload,
    )
    analysis = _load_ready_product_analysis_result(
        db=db,
        product_id=str(row.product_id or ""),
    )
    item = _build_selection_fit_explanation(
        session_id=str(row.id),
        resolved=resolved,
        recommendation_source=recommendation_source,
        analysis=analysis,
    )
    if owner_cookie_new:
        _set_owner_cookie(response, owner_id, request)
    return MobileSelectionFitExplanationResponse(status="ok", item=item)


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

    def apply_product_filters(stmt):
        next_stmt = stmt
        if normalized_category:
            next_stmt = next_stmt.where(ProductIndex.category == normalized_category)
        if normalized_query:
            like = f"%{normalized_query}%"
            next_stmt = next_stmt.where(
                (ProductIndex.name.like(like))
                | (ProductIndex.brand.like(like))
                | (ProductIndex.one_sentence.like(like))
            )
        return next_stmt

    try:
        rows = (
            db.execute(
                apply_product_filters(
                    select(ProductIndex)
                    .join(ProductAnalysisIndex, ProductAnalysisIndex.product_id == ProductIndex.id)
                    .where(ProductAnalysisIndex.status == "ready")
                ).order_by(ProductIndex.created_at.desc())
            )
            .scalars()
            .all()
        )
    except OperationalError as exc:
        raise HTTPException(
            status_code=500,
            detail=(
                "Failed to query product analysis index. "
                "Database schema may be outdated (missing table 'product_analysis_index'). "
                f"Raw error: {exc}"
            ),
        ) from exc

    product_ids = [str(row.id or "").strip() for row in rows if str(row.id or "").strip()]
    analysis_by_product_id = _product_analysis_by_product_id(db=db, product_ids=product_ids)
    route_mapping_by_product_id = _route_mapping_by_product_id(db=db, product_ids=product_ids)

    wiki_ready_rows: list[ProductIndex] = []
    category_counts: dict[str, int] = defaultdict(int)
    subtype_counts: dict[str, tuple[str, int]] = {}
    for row in rows:
        product_id = str(row.id or "").strip()
        if not product_id:
            continue
        if _mobile_wiki_product_unavailable_detail(
            row=row,
            analysis=analysis_by_product_id.get(product_id),
        ) is not None:
            continue
        wiki_ready_rows.append(row)

        category_key = str(row.category or "").strip().lower()
        if not category_key:
            continue
        category_counts[category_key] += 1

        if normalized_category == category_key and category_key in ROUTE_MAPPED_CATEGORIES:
            mapping = route_mapping_by_product_id.get(product_id)
            if mapping is None or str(mapping.status or "").strip().lower() != "ready":
                continue
            primary_key = str(mapping.primary_route_key or "").strip()
            if not primary_key:
                continue
            primary_title = str(mapping.primary_route_title or "").strip() or primary_key
            previous = subtype_counts.get(primary_key)
            subtype_counts[primary_key] = (
                primary_title,
                (previous[1] if previous else 0) + 1,
            )

    categories = [
        MobileWikiCategoryFacet(
            key=category_key,
            label=CATEGORY_LABELS_ZH.get(category_key, category_key),
            count=count,
        )
        for category_key, count in sorted(category_counts.items(), key=lambda item: (-item[1], item[0]))
    ]
    subtypes = [
        MobileWikiSubtypeFacet(
            key=route_key,
            label=title,
            count=count,
        )
        for route_key, (title, count) in sorted(subtype_counts.items(), key=lambda item: (-item[1][1], item[0]))
    ]

    filtered_rows = wiki_ready_rows
    if normalized_target_type_key and normalized_category in ROUTE_MAPPED_CATEGORIES:
        filtered_rows = []
        for row in wiki_ready_rows:
            mapping = route_mapping_by_product_id.get(str(row.id or "").strip())
            if mapping is None or str(mapping.status or "").strip().lower() != "ready":
                continue
            primary_key = str(mapping.primary_route_key or "").strip()
            if primary_key != normalized_target_type_key:
                continue
            filtered_rows.append(row)

    total = len(filtered_rows)
    sliced_rows = filtered_rows[offset : offset + limit]
    featured_by_slot = _featured_slot_by_slot_key(
        db=db,
        categories={str(row.category or "").strip().lower() for row in sliced_rows},
    )
    sliced = [
        _build_mobile_wiki_product_item(
            row=row,
            mapping=route_mapping_by_product_id.get(str(row.id)),
            featured_by_slot=featured_by_slot,
        )
        for row in sliced_rows
        if str(row.category or "").strip()
    ]
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
    analysis = _product_analysis_by_product_id(db=db, product_ids=[pid]).get(pid)
    unavailable_detail = _mobile_wiki_product_unavailable_detail(row=row, analysis=analysis)
    if unavailable_detail is not None:
        raise HTTPException(status_code=404, detail=unavailable_detail)
    json_path = str(row.json_path or "").strip()

    try:
        raw_doc = load_json(json_path)
        preferred_image_rel = preferred_image_rel_path(str(row.image_path or "").strip())
        normalized_doc = normalize_doc(
            raw_doc,
            image_rel_path=preferred_image_rel,
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
    ingredient_refs = _resolve_mobile_wiki_ingredient_refs(
        db=db,
        category=str(row.category or "").strip().lower(),
        ingredients=doc.ingredients,
    )
    if owner_cookie_new:
        _set_owner_cookie(response, owner_id, request)
    return MobileWikiProductDetailResponse(
        status="ok",
        item=MobileWikiProductDetailItem(
            product=item.product,
            doc=doc,
            ingredient_refs=ingredient_refs,
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


@router.get("/wiki/products/{product_id}/analysis", response_model=MobileWikiProductAnalysisResponse)
def get_mobile_wiki_product_analysis(
    product_id: str,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    _, owner_id, owner_cookie_new = _resolve_owner(request)
    pid = str(product_id or "").strip()
    if not pid:
        raise HTTPException(status_code=400, detail="product_id is required.")
    product_row = db.get(ProductIndex, pid)
    if product_row is None:
        raise HTTPException(status_code=404, detail=f"Product '{pid}' not found.")
    rec = _product_analysis_by_product_id(db=db, product_ids=[pid]).get(pid)
    unavailable_detail = _mobile_wiki_product_unavailable_detail(row=product_row, analysis=rec)
    if unavailable_detail is not None:
        raise HTTPException(status_code=404, detail=unavailable_detail)
    if rec is None:
        raise HTTPException(status_code=404, detail=f"Product analysis not found for product '{pid}'.")

    storage_path = _mobile_wiki_product_analysis_storage_path(row=product_row, analysis=rec)

    try:
        raw_doc = load_json(storage_path)
        item = ProductAnalysisStoredResult.model_validate(
            {
                **raw_doc,
                "storage_path": storage_path,
            }
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Invalid product analysis for '{pid}': {exc}") from exc

    if owner_cookie_new:
        _set_owner_cookie(response, owner_id, request)
    return MobileWikiProductAnalysisResponse(status="ok", item=item)


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


@router.get("/user-products", response_model=MobileUserProductListResponse)
def list_mobile_user_products(
    request: Request,
    response: Response,
    category: str | None = Query(None),
    offset: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    owner_type, owner_id, owner_cookie_new = _resolve_owner(request)
    normalized_category = str(category or "").strip().lower() or None
    if normalized_category and normalized_category not in VALID_CATEGORIES:
        raise HTTPException(status_code=400, detail=f"Invalid category: {normalized_category}.")

    _ensure_mobile_user_product_tables(db)
    stmt = (
        select(UserProduct)
        .where(UserProduct.owner_type == owner_type)
        .where(UserProduct.owner_id == owner_id)
    )
    if normalized_category:
        stmt = stmt.where(UserProduct.category == normalized_category)
    rows = (
        db.execute(
            stmt.order_by(
                UserProduct.updated_at.desc(),
                UserProduct.created_at.desc(),
                UserProduct.user_product_id.desc(),
            )
            .offset(offset)
            .limit(limit)
        )
        .scalars()
        .all()
    )

    count_stmt = (
        select(UserProduct)
        .where(UserProduct.owner_type == owner_type)
        .where(UserProduct.owner_id == owner_id)
    )
    if normalized_category:
        count_stmt = count_stmt.where(UserProduct.category == normalized_category)
    total = len(db.execute(count_stmt).scalars().all())

    items = [_row_to_mobile_user_product_item(row) for row in rows]
    if owner_cookie_new:
        _set_owner_cookie(response, owner_id, request)
    return MobileUserProductListResponse(
        status="ok",
        category=normalized_category,
        total=total,
        offset=offset,
        limit=limit,
        items=items,
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
            route_key=resolved.route.key,
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
    db: Session = Depends(get_db),
):
    owner_type, owner_id, owner_cookie_new = _resolve_owner(request)
    normalized_category = _normalize_required_category(category)
    _ensure_mobile_user_product_tables(db)
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
    user_product_id = new_id()
    try:
        stored = save_user_upload_bundle(
            upload_id=upload_id,
            owner_type=owner_type,
            owner_id=owner_id,
            category=normalized_category,
            filename=image.filename or "upload.jpg",
            content=content,
            content_type=image.content_type,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail={"code": "COMPARE_UPLOAD_INVALID_IMAGE", "detail": str(e)},
        ) from e

    created_at = now_iso()
    payload = {
        "upload_id": upload_id,
        "user_product_id": user_product_id,
        "owner_type": owner_type,
        "owner_id": owner_id,
        "category": normalized_category,
        "brand": str(brand or "").strip() or None,
        "name": str(name or "").strip() or None,
        "filename": image.filename,
        "content_type": image.content_type,
        "original_path": stored["original_path"],
        "image_path": stored["preview_image_path"],
        "meta_path": stored["meta_path"],
        "created_at": created_at,
        "updated_at": created_at,
    }
    save_json_at(stored["meta_path"], payload)

    upload_row = UserUploadAsset(
        upload_id=upload_id,
        owner_type=owner_type,
        owner_id=owner_id,
        category=normalized_category,
        brand=payload["brand"],
        name=payload["name"],
        original_path=stored["original_path"],
        preview_image_path=stored["preview_image_path"],
        meta_path=stored["meta_path"],
        user_product_id=user_product_id,
        status="uploaded",
        created_at=created_at,
        updated_at=created_at,
        last_used_at=created_at,
    )
    user_product_row = UserProduct(
        user_product_id=user_product_id,
        owner_type=owner_type,
        owner_id=owner_id,
        category=normalized_category,
        brand=payload["brand"],
        name=payload["name"],
        image_path=stored["preview_image_path"],
        source_upload_id=upload_id,
        status="uploaded",
        created_at=created_at,
        updated_at=created_at,
    )
    db.add(upload_row)
    db.add(user_product_row)
    db.commit()

    if owner_cookie_new:
        _set_owner_cookie(response, owner_id, request)
    return MobileCompareUploadResponse(
        status="ok",
        trace_id=upload_id,
        upload_id=upload_id,
        user_product_id=user_product_id,
        category=normalized_category,
        image_path=stored["preview_image_path"],
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
    targets_snapshot = _build_compare_targets_snapshot(payload.targets)
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
            "targets_snapshot": targets_snapshot,
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
            err_payload = _enrich_compare_error_payload(
                _compare_error_payload_from_http_exception(e),
                compare_id=compare_id,
                db=local_db,
            )
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
            err_payload = _enrich_compare_error_payload(
                {
                    "code": e.code,
                    "detail": e.message,
                    "http_status": e.http_status,
                    "retryable": e.http_status >= 500,
                },
                compare_id=compare_id,
                db=local_db,
            )
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
            err_payload = _enrich_compare_error_payload(
                {
                    "code": "COMPARE_INTERNAL_ERROR",
                    "detail": str(e),
                    "http_status": 500,
                    "retryable": True,
                },
                compare_id=compare_id,
                db=local_db,
            )
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


@router.post("/events")
def record_mobile_event(
    payload: MobileClientEventRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    return _record_mobile_client_event(
        payload=payload,
        request=request,
        response=response,
        db=db,
    )


@router.post("/compare/events")
def record_mobile_compare_event(
    payload: MobileCompareEventRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    return _record_mobile_client_event(
        payload=MobileClientEventRequest(name=payload.name, props=payload.props),
        request=request,
        response=response,
        db=db,
        legacy_artifact_kind="mobile_compare_event",
    )


def _record_mobile_client_event(
    *,
    payload: MobileClientEventRequest,
    request: Request,
    response: Response,
    db: Session,
    legacy_artifact_kind: str | None = None,
):
    owner_type, owner_id, owner_cookie_new = _resolve_owner(request)
    event_id = new_id()
    created_at = now_iso()
    props = payload.props if isinstance(payload.props, dict) else {}
    row = MobileClientEvent(
        event_id=event_id,
        owner_type=owner_type,
        owner_id=owner_id,
        session_id=_mobile_event_string(props.get("session_id"), limit=128),
        name=_mobile_event_string(payload.name, limit=128) or "unknown",
        page=_mobile_event_string(props.get("page"), limit=128),
        route=_mobile_event_string(props.get("route"), limit=256),
        source=_mobile_event_string(props.get("source"), limit=128),
        category=_mobile_event_string(props.get("category"), limit=32),
        product_id=_mobile_event_string(props.get("product_id"), limit=64),
        user_product_id=_mobile_event_string(props.get("user_product_id"), limit=64),
        compare_id=_mobile_event_string(props.get("compare_id"), limit=64),
        step=_mobile_event_string(props.get("step"), limit=64),
        stage=_mobile_event_string(props.get("stage"), limit=64),
        dwell_ms=_mobile_event_int(props.get("dwell_ms")),
        error_code=_mobile_event_string(props.get("error_code"), limit=64),
        error_detail=_mobile_event_detail(props),
        http_status=_mobile_event_int(props.get("http_status") if props.get("http_status") is not None else props.get("status_code")),
        props_json=json.dumps(props, ensure_ascii=False, default=str),
        created_at=created_at,
    )
    db.add(row)
    db.commit()

    if legacy_artifact_kind:
        save_doubao_artifact(
            event_id,
            legacy_artifact_kind,
            {
                "trace_id": event_id,
                "event_id": event_id,
                "owner_type": owner_type,
                "owner_id": owner_id,
                "event_name": row.name,
                "props": props,
                "created_at": created_at,
            },
        )

    if owner_cookie_new:
        _set_owner_cookie(response, owner_id, request)
    return {"status": "ok", "trace_id": event_id, "event_id": event_id}


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


def _build_compare_targets_snapshot(raw_targets: list[MobileCompareJobTargetInput] | None) -> list[dict[str, str]]:
    snapshot: list[dict[str, str]] = []
    if not raw_targets:
        return snapshot

    seen: set[str] = set()
    for item in raw_targets:
        source = str(item.source or "").strip().lower()
        if source == "upload_new":
            upload_id = str(item.upload_id or "").strip()
            if not upload_id:
                continue
            key = f"upload:{upload_id}"
            normalized_item = {"source": "upload_new", "upload_id": upload_id}
        elif source == "history_product":
            product_id = str(item.product_id or "").strip()
            if not product_id:
                continue
            key = f"history:{product_id}"
            normalized_item = {"source": "history_product", "product_id": product_id}
        else:
            continue

        if key in seen:
            continue
        seen.add(key)
        snapshot.append(normalized_item)
        if len(snapshot) >= 3:
            break

    return snapshot


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


def _get_mobile_user_upload_asset(
    *,
    db: Session,
    upload_id: str,
    owner_type: str,
    owner_id: str,
) -> UserUploadAsset | None:
    _ensure_mobile_user_product_tables(db)
    return (
        db.execute(
            select(UserUploadAsset)
            .where(UserUploadAsset.upload_id == upload_id)
            .where(UserUploadAsset.owner_type == owner_type)
            .where(UserUploadAsset.owner_id == owner_id)
            .limit(1)
        )
        .scalars()
        .first()
    )


def _get_mobile_user_product(
    *,
    db: Session,
    user_product_id: str,
    owner_type: str,
    owner_id: str,
) -> UserProduct | None:
    _ensure_mobile_user_product_tables(db)
    return (
        db.execute(
            select(UserProduct)
            .where(UserProduct.user_product_id == user_product_id)
            .where(UserProduct.owner_type == owner_type)
            .where(UserProduct.owner_id == owner_id)
            .limit(1)
        )
        .scalars()
        .first()
    )


def _validate_compare_upload_doc(
    *,
    category: str,
    raw_doc: dict[str, Any],
    image_path: str,
    brand_override: str,
    name_override: str,
    stage1: dict[str, Any],
    stage2: dict[str, Any],
    trace_id: str,
) -> dict[str, Any]:
    product = raw_doc.setdefault("product", {})
    raw_category = str(product.get("category") or "").strip()
    normalized_raw_category = _normalize_model_category(raw_category)
    if normalized_raw_category and normalized_raw_category not in VALID_CATEGORIES:
        raise HTTPException(
            status_code=422,
            detail={
                "code": "COMPARE_CATEGORY_INVALID",
                "detail": f"Current product category extracted from image is invalid: '{raw_category}'.",
                "retryable": False,
                "trace_id": trace_id,
            },
        )
    if normalized_raw_category and normalized_raw_category != category:
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
    if brand_override:
        product["brand"] = brand_override
    if name_override:
        product["name"] = name_override

    normalized = normalize_doc(
        raw_doc,
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
    return normalized


def _analyze_mobile_compare_upload_doc(
    *,
    category: str,
    image_path: str,
    brand_override: str,
    name_override: str,
    trace_id: str,
    event_callback: Callable[[str, dict[str, Any]], None],
) -> dict[str, Any]:
    if not image_path or not exists_rel_path(image_path):
        raise HTTPException(
            status_code=404,
            detail={
                "code": "COMPARE_UPLOAD_IMAGE_NOT_FOUND",
                "detail": f"Upload image not found: {image_path or '(empty)'}.",
                "retryable": False,
                "trace_id": trace_id,
            },
        )

    pipeline = DoubaoPipelineService()

    def on_pipeline_event(event: dict[str, Any]) -> None:
        _ = event
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

    return _validate_compare_upload_doc(
        category=category,
        raw_doc=doc,
        image_path=image_path,
        brand_override=brand_override,
        name_override=name_override,
        stage1=stage1,
        stage2=stage2,
        trace_id=trace_id,
    )


def _resolve_user_product_doc(
    *,
    category: str,
    row: UserProduct,
    owner_type: str,
    owner_id: str,
    trace_id: str,
    event_callback: Callable[[str, dict[str, Any]], None],
    db: Session,
) -> dict[str, Any]:
    if row.owner_type != owner_type or row.owner_id != owner_id:
        raise HTTPException(
            status_code=404,
            detail={
                "code": "COMPARE_UPLOAD_NOT_FOUND",
                "detail": f"user_product_id '{row.user_product_id}' not found.",
                "retryable": False,
                "trace_id": trace_id,
            },
        )
    if str(row.category or "").strip().lower() != category:
        raise HTTPException(
            status_code=422,
            detail={
                "code": "COMPARE_CATEGORY_MISMATCH",
                "detail": f"User product '{row.user_product_id}' category does not match '{category}'.",
                "retryable": False,
                "trace_id": trace_id,
            },
        )

    now = now_iso()
    json_path = str(row.json_path or "").strip()
    if json_path and exists_rel_path(json_path):
        upload_row = None
        if str(row.source_upload_id or "").strip():
            upload_row = _get_mobile_user_upload_asset(
                db=db,
                upload_id=str(row.source_upload_id),
                owner_type=owner_type,
                owner_id=owner_id,
            )
        if str(row.public_product_id or "").strip():
            _increase_product_usage_count(
                db=db,
                owner_type=owner_type,
                owner_id=owner_id,
                product_id=str(row.public_product_id),
                category=category,
            )
        row.updated_at = now
        db.add(row)
        if upload_row is not None:
            upload_row.last_used_at = now
            upload_row.updated_at = now
            db.add(upload_row)
        db.commit()
        return load_json(json_path)

    upload_id = str(row.source_upload_id or "").strip()
    if not upload_id:
        raise HTTPException(
            status_code=404,
            detail={
                "code": "COMPARE_UPLOAD_NOT_FOUND",
                "detail": f"user_product_id '{row.user_product_id}' has no source upload.",
                "retryable": False,
                "trace_id": trace_id,
            },
        )

    upload_row = _get_mobile_user_upload_asset(
        db=db,
        upload_id=upload_id,
        owner_type=owner_type,
        owner_id=owner_id,
    )
    meta = _load_mobile_compare_upload_meta(
        upload_id=upload_id,
        owner_type=owner_type,
        owner_id=owner_id,
        trace_id=trace_id,
        db=db,
    )
    image_path = str(meta.get("image_path") or row.image_path or "").strip()
    brand_override = str(row.brand or meta.get("brand") or "").strip()
    name_override = str(row.name or meta.get("name") or "").strip()

    try:
        normalized = _analyze_mobile_compare_upload_doc(
            category=category,
            image_path=image_path,
            brand_override=brand_override,
            name_override=name_override,
            trace_id=trace_id,
            event_callback=event_callback,
        )
        persisted_image_path = copy_user_image_to_product(
            image_rel=image_path,
            owner_type=owner_type,
            owner_id=owner_id,
            category=category,
            user_product_id=str(row.user_product_id),
        )
        if persisted_image_path:
            normalized.setdefault("evidence", {})["image_path"] = persisted_image_path
        json_path = save_user_product_json(
            user_product_id=str(row.user_product_id),
            owner_type=owner_type,
            owner_id=owner_id,
            category=category,
            doc=normalized,
        )
    except HTTPException as exc:
        row.status = "failed"
        row.last_error = _extract_http_exception_detail_message(exc)
        row.updated_at = now_iso()
        db.add(row)
        db.commit()
        raise

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

    row.brand = str(normalized.get("product", {}).get("brand") or "").strip() or row.brand
    row.name = str(normalized.get("product", {}).get("name") or "").strip() or row.name
    row.one_sentence = str(normalized.get("summary", {}).get("one_sentence") or "").strip() or None
    row.image_path = str(normalized.get("evidence", {}).get("image_path") or image_path or "").strip() or None
    row.json_path = json_path
    row.public_product_id = matched_product_id
    row.status = "ready"
    row.last_error = None
    row.updated_at = now
    row.last_analyzed_at = now
    db.add(row)
    if upload_row is not None:
        upload_row.last_used_at = now
        upload_row.updated_at = now
        upload_row.status = "linked"
        db.add(upload_row)
    db.commit()
    return normalized


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
    upload_row = _get_mobile_user_upload_asset(
        db=db,
        upload_id=upload_id,
        owner_type=owner_type,
        owner_id=owner_id,
    )
    if upload_row is not None and str(upload_row.user_product_id or "").strip():
        user_product_row = _get_mobile_user_product(
            db=db,
            user_product_id=str(upload_row.user_product_id),
            owner_type=owner_type,
            owner_id=owner_id,
        )
        if user_product_row is not None:
            return _resolve_user_product_doc(
                category=category,
                row=user_product_row,
                owner_type=owner_type,
                owner_id=owner_id,
                trace_id=trace_id,
                event_callback=event_callback,
                db=db,
            )

    meta = _load_mobile_compare_upload_meta(
        upload_id=upload_id,
        owner_type=owner_type,
        owner_id=owner_id,
        trace_id=trace_id,
        db=db,
    )
    return _analyze_mobile_compare_upload_doc(
        category=category,
        image_path=str(meta.get("image_path") or "").strip(),
        brand_override=str(meta.get("brand") or "").strip(),
        name_override=str(meta.get("name") or "").strip(),
        trace_id=trace_id,
        event_callback=event_callback,
    )


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
    db: Session | None = None,
) -> dict[str, Any]:
    if db is not None:
        upload_row = _get_mobile_user_upload_asset(
            db=db,
            upload_id=upload_id,
            owner_type=owner_type,
            owner_id=owner_id,
        )
        if upload_row is not None:
            meta_path = str(upload_row.meta_path or "").strip()
            if meta_path and exists_rel_path(meta_path):
                payload = load_json(meta_path)
                if str(payload.get("owner_type") or "") == owner_type and str(payload.get("owner_id") or "") == owner_id:
                    return payload

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


def _extract_http_exception_detail_message(exc: HTTPException) -> str:
    detail = exc.detail
    if isinstance(detail, dict):
        message = str(detail.get("detail") or detail.get("message") or "").strip()
        if message:
            return message
    return str(detail or "Unknown error").strip() or "Unknown error"


def _ensure_mobile_user_product_tables(db: Session) -> None:
    bind = db.get_bind()
    UserUploadAsset.__table__.create(bind=bind, checkfirst=True)
    UserProduct.__table__.create(bind=bind, checkfirst=True)


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
        "targets_snapshot": patch.get("targets_snapshot", existing_payload.get("targets_snapshot", [])),
        "result": patch.get("result", existing_payload.get("result")),
        "error": patch.get("error", existing_payload.get("error")),
    }
    if patch.get("result") is None and "result" in patch:
        merged["result"] = None
    if patch.get("error") is None and "error" in patch:
        merged["error"] = None
    if patch.get("targets_snapshot") is None and "targets_snapshot" in patch:
        merged["targets_snapshot"] = []

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

    targets_snapshot: list[MobileCompareJobTargetInput] = []
    raw_targets_snapshot = payload.get("targets_snapshot")
    if isinstance(raw_targets_snapshot, list):
        seen: set[str] = set()
        for raw_target in raw_targets_snapshot:
            if not isinstance(raw_target, dict):
                continue
            try:
                candidate = MobileCompareJobTargetInput.model_validate(raw_target)
            except Exception:
                continue

            source = str(candidate.source or "").strip().lower()
            if source == "upload_new":
                upload_id = str(candidate.upload_id or "").strip()
                if not upload_id:
                    continue
                key = f"upload:{upload_id}"
                normalized_target = MobileCompareJobTargetInput(source="upload_new", upload_id=upload_id)
            elif source == "history_product":
                product_id = str(candidate.product_id or "").strip()
                if not product_id:
                    continue
                key = f"history:{product_id}"
                normalized_target = MobileCompareJobTargetInput(source="history_product", product_id=product_id)
            else:
                continue

            if key in seen:
                continue
            seen.add(key)
            targets_snapshot.append(normalized_target)
            if len(targets_snapshot) >= 3:
                break

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
            targets_snapshot=targets_snapshot,
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
    session_rel = _mobile_compare_session_rel_path(compare_id)
    session_payload = _safe_load_json_dict(session_rel)
    if session_payload is not None:
        if _session_payload_belongs_to_owner(session_payload, owner_type=owner_type, owner_id=owner_id):
            _upsert_mobile_compare_session_index(db=db, payload=session_payload)
            normalized = _normalize_mobile_compare_session_payload(session_payload)
            if normalized is not None:
                return normalized

    row = db.get(MobileCompareSessionIndex, compare_id)
    if row is not None:
        if row.owner_type != owner_type or row.owner_id != owner_id:
            return None
        normalized = _normalize_mobile_compare_session_payload(_session_payload_from_index_row(row))
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


def _product_analysis_by_product_id(
    *,
    db: Session,
    product_ids: list[str],
) -> dict[str, ProductAnalysisIndex]:
    normalized_ids = [str(item or "").strip() for item in product_ids if str(item or "").strip()]
    if not normalized_ids:
        return {}
    try:
        rows = db.execute(
            select(ProductAnalysisIndex).where(ProductAnalysisIndex.product_id.in_(normalized_ids))
        ).scalars().all()
    except OperationalError as exc:
        raise HTTPException(
            status_code=500,
            detail=(
                "Failed to query product analysis index. "
                "Database schema may be outdated (missing table 'product_analysis_index'). "
                f"Raw error: {exc}"
            ),
        ) from exc
    out: dict[str, ProductAnalysisIndex] = {}
    for row in rows:
        out[str(row.product_id)] = row
    return out


def _mobile_wiki_product_analysis_storage_path(
    *,
    row: ProductIndex,
    analysis: ProductAnalysisIndex,
) -> str:
    return str(analysis.storage_path or "").strip() or product_analysis_rel_path(str(row.category or ""), str(row.id or ""))


def _mobile_wiki_product_unavailable_detail(
    *,
    row: ProductIndex,
    analysis: ProductAnalysisIndex | None,
) -> str | None:
    product_id = str(row.id or "").strip() or "-"
    json_path = str(row.json_path or "").strip()
    if not json_path or not exists_rel_path(json_path):
        return f"Product doc for '{product_id}' is missing."
    if analysis is None or str(analysis.status or "").strip().lower() != "ready":
        return f"Product analysis not found for product '{product_id}'."
    storage_path = _mobile_wiki_product_analysis_storage_path(row=row, analysis=analysis)
    if not storage_path or not exists_rel_path(storage_path):
        return f"Product analysis file missing for product '{product_id}'."
    return None


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


def _ensure_mobile_wiki_ingredient_tables(db: Session) -> None:
    bind = db.get_bind()
    IngredientLibraryAlias.__table__.create(bind=bind, checkfirst=True)
    IngredientLibraryRedirect.__table__.create(bind=bind, checkfirst=True)
    IngredientLibraryIndex.__table__.create(bind=bind, checkfirst=True)


def _normalize_mobile_wiki_ingredient_text(value: str) -> str:
    normalized = str(value or "").strip().lower()
    normalized = normalized.translate(
        str.maketrans(
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
    )
    normalized = " ".join(normalized.split())
    return normalized


def _normalize_mobile_wiki_ingredient_key(value: str) -> str:
    normalized = _normalize_mobile_wiki_ingredient_text(value)
    return normalized[:120]


def _normalize_mobile_wiki_ingredient_en_key(value: str) -> str:
    normalized = _normalize_mobile_wiki_ingredient_text(value)
    compact = re.sub(r"[^a-z0-9]+", "", normalized)
    return compact[:120]


def _extract_mobile_wiki_ingredient_en_from_parenthesis(value: str) -> str | None:
    text = str(value or "").strip()
    if not text:
        return None
    matches = re.findall(r"\(([^()]+)\)", text)
    for match in matches:
        segment = str(match or "").strip()
        if segment and re.search(r"[A-Za-z]", segment):
            return segment
    return None


def _build_mobile_wiki_alias_keys(name: str) -> list[str]:
    out: list[str] = []
    base_key = _normalize_mobile_wiki_ingredient_key(name)
    if base_key:
        out.append(f"cn::{base_key}")
    en_key = _normalize_mobile_wiki_ingredient_en_key(name)
    if en_key:
        out.append(f"en::{en_key}")
    parenthesis = _extract_mobile_wiki_ingredient_en_from_parenthesis(name)
    if parenthesis:
        parenthesis_key = _normalize_mobile_wiki_ingredient_en_key(parenthesis)
        if parenthesis_key:
            out.append(f"en::{parenthesis_key}")
    dedup: list[str] = []
    seen: set[str] = set()
    for key in out:
        if key in seen:
            continue
        seen.add(key)
        dedup.append(key)
    return dedup


def _resolve_mobile_wiki_redirect(
    *,
    db: Session,
    category: str,
    ingredient_id: str,
) -> str:
    current = str(ingredient_id or "").strip().lower()
    normalized_category = str(category or "").strip().lower()
    seen: set[str] = set()
    for _ in range(4):
        if not current or current in seen:
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


def _resolve_mobile_wiki_ingredient_refs(
    *,
    db: Session,
    category: str,
    ingredients: list[Any],
) -> list[MobileWikiIngredientRef]:
    normalized_category = str(category or "").strip().lower()
    if not normalized_category:
        return []
    _ensure_mobile_wiki_ingredient_tables(db)

    alias_keys_by_index: dict[int, list[str]] = {}
    all_alias_keys: set[str] = set()
    for idx, item in enumerate(ingredients, start=1):
        name = str(getattr(item, "name", "") or "").strip()
        keys = _build_mobile_wiki_alias_keys(name)
        alias_keys_by_index[idx] = keys
        all_alias_keys.update(keys)

    alias_rows = db.execute(
        select(IngredientLibraryAlias)
        .where(IngredientLibraryAlias.category == normalized_category)
        .where(IngredientLibraryAlias.alias_key.in_(sorted(all_alias_keys)))
    ).scalars().all() if all_alias_keys else []
    alias_by_key: dict[str, list[IngredientLibraryAlias]] = defaultdict(list)
    for row in alias_rows:
        alias_by_key[str(row.alias_key)].append(row)

    candidate_ids = {
        str(row.ingredient_id or "").strip().lower()
        for row in alias_rows
        if str(row.ingredient_id or "").strip()
    }
    ready_ids: set[str] = set()
    if candidate_ids:
        ready_rows = db.execute(
            select(IngredientLibraryIndex)
            .where(IngredientLibraryIndex.ingredient_id.in_(sorted(candidate_ids)))
            .where(IngredientLibraryIndex.category == normalized_category)
        ).scalars().all()
        for row in ready_rows:
            if str(row.status or "").strip().lower() == "ready":
                ready_ids.add(str(row.ingredient_id).strip().lower())

    out: list[MobileWikiIngredientRef] = []
    for idx, item in enumerate(ingredients, start=1):
        name = str(getattr(item, "name", "") or "").strip()
        keys = alias_keys_by_index.get(idx) or []
        matched_rows: list[IngredientLibraryAlias] = []
        for key in keys:
            matched_rows.extend(alias_by_key.get(key) or [])

        candidate_map: dict[str, IngredientLibraryAlias] = {}
        for row in matched_rows:
            ingredient_id = str(row.ingredient_id or "").strip().lower()
            if ingredient_id not in ready_ids:
                continue
            if ingredient_id not in candidate_map:
                candidate_map[ingredient_id] = row

        resolved_ids = sorted(candidate_map.keys())
        if len(resolved_ids) == 1:
            resolved_id = _resolve_mobile_wiki_redirect(
                db=db,
                category=normalized_category,
                ingredient_id=resolved_ids[0],
            )
            out.append(
                MobileWikiIngredientRef(
                    index=idx,
                    name=name,
                    ingredient_id=resolved_id,
                    status="resolved",
                    matched_alias=str(candidate_map[resolved_ids[0]].alias_name or "").strip() or None,
                    reason=None,
                )
            )
            continue
        if len(resolved_ids) > 1:
            out.append(
                MobileWikiIngredientRef(
                    index=idx,
                    name=name,
                    ingredient_id=None,
                    status="conflict",
                    matched_alias=None,
                    reason=f"matched_multiple_targets={','.join(resolved_ids[:5])}",
                )
            )
            continue
        out.append(
            MobileWikiIngredientRef(
                index=idx,
                name=name,
                ingredient_id=None,
                status="unresolved",
                matched_alias=None,
                reason="alias_not_found",
            )
        )
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


def _enrich_compare_error_payload(
    payload: dict[str, Any],
    *,
    compare_id: str,
    db: Session,
) -> dict[str, Any]:
    out = dict(payload or {})
    session_row = db.get(MobileCompareSessionIndex, compare_id)
    if session_row is not None:
        out.setdefault("stage", str(session_row.stage or "").strip() or None)
        out.setdefault("stage_label", str(session_row.stage_label or "").strip() or None)
    return out


def _to_sse(event: str, payload: dict[str, Any]) -> str:
    return f"event: {event}\ndata: {json.dumps(payload, ensure_ascii=False)}\n\n"


def _row_to_mobile_response(row: MobileSelectionSession) -> MobileSelectionResolveResponse:
    try:
        payload = json.loads(row.result_json)
    except Exception as e:  # pragma: no cover
        raise HTTPException(status_code=500, detail=f"Invalid session payload: {e}") from e
    try:
        if not isinstance(payload, dict):
            raise ValueError("session payload must be an object")
        if "matrix_analysis" not in payload or not isinstance(payload.get("matrix_analysis"), dict):
            payload["matrix_analysis"] = _rebuild_selection_matrix_analysis(
                category=str(row.category or ""),
                answers_json=str(row.answers_json or ""),
            )
        payload.setdefault("recommendation_source", "category_fallback")
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


def _mobile_event_string(value: Any, *, limit: int) -> str | None:
    text = str(value or "").strip()
    if not text:
        return None
    return text[:limit]


def _mobile_event_int(value: Any) -> int | None:
    if value is None or value == "":
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _mobile_event_detail(props: dict[str, Any]) -> str | None:
    for key in ("detail", "error_detail", "error"):
        text = _mobile_event_string(props.get(key), limit=2000)
        if text:
            return text
    return None


def _normalize_owner_id(raw: str | None) -> str:
    value = str(raw or "").strip()
    if not value:
        return ""
    if len(value) > 128:
        return ""
    return value


def _rebuild_selection_matrix_analysis(category: str, answers_json: str) -> dict[str, Any]:
    try:
        raw_answers = json.loads(answers_json or "{}")
    except Exception:
        return MobileSelectionMatrixAnalysis().model_dump()
    if not isinstance(raw_answers, dict):
        return MobileSelectionMatrixAnalysis().model_dump()
    try:
        config, route_titles, _wiki_href = _selection_matrix_assets(category)
        decision = resolve_matrix_selection(config, _normalize_answers(raw_answers))
    except Exception:
        return MobileSelectionMatrixAnalysis().model_dump()
    return _build_mobile_selection_matrix_analysis(
        config=config,
        route_titles=route_titles,
        decision=decision,
    )


def _safe_parse_json_dict(raw_text: str) -> dict[str, Any]:
    try:
        parsed = json.loads(raw_text or "{}")
    except Exception:
        return {}
    return parsed if isinstance(parsed, dict) else {}


def _load_ready_product_analysis_result(
    *,
    db: Session,
    product_id: str,
) -> ProductAnalysisStoredResult | None:
    pid = str(product_id or "").strip()
    if not pid:
        return None
    rec = db.get(ProductAnalysisIndex, pid)
    if rec is None or str(rec.status or "").strip().lower() != "ready":
        return None
    storage_path = str(rec.storage_path or "").strip() or product_analysis_rel_path(str(rec.category or ""), pid)
    if not exists_rel_path(storage_path):
        return None
    try:
        raw_doc = load_json(storage_path)
        return ProductAnalysisStoredResult.model_validate({**raw_doc, "storage_path": storage_path})
    except Exception:
        return None


def _determine_selection_recommendation_source(
    *,
    db: Session,
    row: MobileSelectionSession,
    resolved: MobileSelectionResolveResponse,
    raw_payload: dict[str, Any],
) -> str:
    explicit = str(raw_payload.get("recommendation_source") or "").strip().lower()
    if explicit in {"featured_slot", "route_mapping", "category_fallback"}:
        return explicit

    product_id = str(row.product_id or "").strip()
    category = str(row.category or "").strip().lower()
    route_key = str(resolved.route.key or "").strip()
    if not product_id or not category or not route_key:
        return "category_fallback"

    target_type_key = _selection_target_type_key(category=category, route_key=route_key)
    if target_type_key:
        try:
            slot = db.execute(
                select(ProductFeaturedSlot)
                .where(ProductFeaturedSlot.category == category)
                .where(ProductFeaturedSlot.target_type_key == target_type_key)
                .limit(1)
            ).scalars().first()
        except OperationalError:
            slot = None
        if slot and str(slot.product_id or "").strip() == product_id:
            return "featured_slot"

    mapping = db.get(ProductRouteMappingIndex, product_id)
    if (
        mapping is not None
        and str(mapping.status or "").strip().lower() == "ready"
        and str(mapping.category or "").strip().lower() == category
        and str(mapping.primary_route_key or "").strip() == route_key
    ):
        return "route_mapping"
    return "category_fallback"


def _build_selection_fit_explanation(
    *,
    session_id: str,
    resolved: MobileSelectionResolveResponse,
    recommendation_source: str,
    analysis: ProductAnalysisStoredResult | None,
) -> MobileSelectionFitExplanationItem:
    matrix = resolved.matrix_analysis
    route_title = str(resolved.route.title or "").strip() or str(resolved.route.key or "").strip()
    route_rationale = _build_selection_route_rationale(
        route_key=str(resolved.route.key or ""),
        route_title=route_title,
        matrix=matrix,
    )
    product_fit: list[dict[str, Any]] = []
    matched_points: list[str] = []
    tradeoffs: list[str] = []
    guardrails: list[str] = _build_selection_guardrails(matrix=matrix)
    confidence = 68
    needs_review = False

    if analysis is None:
        needs_review = True
        confidence = 52
        matched_points = ["当前推荐已基于测评路线选出，但这款主推暂时缺少产品增强分析。"]
        tradeoffs = ["暂时无法从二级类目诊断维度判断它与当前路线的细颗粒匹配度。"]
        guardrails.append("先看测评路线是否准确；产品解释层缺失时，不建议把当前主推理解为唯一最优解。")
    else:
        product_fit, matched_points, tradeoffs, guardrails_extra, fit_confidence, fit_needs_review = _build_selection_product_fit(
            category=str(resolved.category or ""),
            route_key=str(resolved.route.key or ""),
            analysis=analysis,
        )
        guardrails.extend(guardrails_extra)
        confidence = fit_confidence
        needs_review = fit_needs_review

    if recommendation_source == "category_fallback":
        needs_review = True
        confidence = max(0, confidence - 8)
        guardrails.append("当前推荐来自品类兜底，不是主推槽位或 route-mapping 精准命中。")

    summary_headline, summary_text = _build_selection_summary_text(
        route_title=route_title,
        route_rationale=route_rationale,
        matched_points=matched_points,
        tradeoffs=tradeoffs,
        analysis=analysis,
    )

    return MobileSelectionFitExplanationItem(
        session_id=session_id,
        category=resolved.category,
        route_key=resolved.route.key,
        route_title=resolved.route.title,
        recommended_product_id=str(resolved.recommended_product.id or "").strip() or None,
        recommendation_source=recommendation_source if recommendation_source in {"featured_slot", "route_mapping", "category_fallback"} else "category_fallback",
        summary_headline=summary_headline,
        summary_text=summary_text,
        matrix_analysis=matrix,
        route_rationale=route_rationale,
        product_fit=product_fit,
        matched_points=matched_points[:4],
        tradeoffs=tradeoffs[:4],
        guardrails=_dedupe_texts(guardrails)[:4],
        confidence=max(0, min(100, confidence)),
        needs_review=bool(needs_review),
    )


def _build_selection_route_rationale(
    *,
    route_key: str,
    route_title: str,
    matrix: MobileSelectionMatrixAnalysis,
) -> list[dict[str, Any]]:
    entries: list[dict[str, Any]] = []
    for item in matrix.question_contributions:
        delta = 0
        for delta_item in item.route_deltas:
            if str(delta_item.route_key) == route_key:
                delta = int(delta_item.delta)
                break
        if delta > 0:
            reason = f"这题为 {route_title} 增加 {delta} 分，是结果收敛的直接推动项。"
        elif delta < 0:
            reason = f"这题对 {route_title} 形成 {delta} 分阻力，但没有改变最终收敛方向。"
        else:
            reason = f"这题没有直接拉高 {route_title}，但也没有把结果推离当前路线。"
        entries.append(
            {
                "question_key": item.question_key,
                "question_title": item.question_title,
                "answer_label": item.answer_label,
                "route_delta": delta,
                "reason": reason,
            }
        )
    entries.sort(key=lambda item: (-int(item["route_delta"]), item["question_key"]))
    return entries[:4]


def _build_selection_product_fit(
    *,
    category: str,
    route_key: str,
    analysis: ProductAnalysisStoredResult,
) -> tuple[list[dict[str, Any]], list[str], list[str], list[str], int, bool]:
    profile = analysis.profile
    diagnostics_payload = profile.diagnostics.model_dump()
    rules = get_route_diagnostic_rules(category, route_key)
    fit_items: list[dict[str, Any]] = []
    matched_points: list[str] = []
    tradeoffs: list[str] = []
    guardrails: list[str] = []
    weighted_score = 0
    weight_total = 0
    hard_mismatch = False

    for rule in rules:
        score_payload = diagnostics_payload.get(rule.diagnostic_key) or {}
        product_score = max(0, min(5, int(score_payload.get("score") or 0)))
        source_reason = str(score_payload.get("reason") or "").strip()
        fit_level = _evaluate_selection_fit_level(rule.desired_level, product_score)
        fit_reason = _selection_fit_reason(rule=rule, product_score=product_score, source_reason=source_reason, fit_level=fit_level)
        fit_items.append(
            {
                "diagnostic_key": rule.diagnostic_key,
                "diagnostic_label": rule.diagnostic_label,
                "desired_level": rule.desired_level,
                "product_score": product_score,
                "fit_level": fit_level,
                "reason": fit_reason,
            }
        )
        weight_total += max(1, int(rule.weight))
        weighted_score += _selection_fit_weight_value(fit_level) * max(1, int(rule.weight))
        if fit_level == "high" and rule.weight >= 2:
            matched_points.append(f"{rule.diagnostic_label}与当前路线高度贴合：{source_reason or f'当前分值 {product_score}/5。'}")
        if fit_level == "low":
            tradeoffs.append(f"{rule.diagnostic_label}与当前路线不完全一致：{source_reason or f'当前分值 {product_score}/5。'}")
            if rule.weight >= 3:
                hard_mismatch = True

    if profile.subtype_fit_verdict in {"fit_with_limits", "weak_fit", "mismatch"}:
        tradeoffs.append(f"产品分析本身给出的路线判断是 {profile.subtype_fit_verdict}，说明这款主推与目标子类并非毫无边界。")
    if profile.needs_review:
        guardrails.append("当前产品分析已标记为待复核，建议结合产品详情页再判断。")
    for code in profile.evidence.missing_codes[:2]:
        guardrails.append(f"产品分析存在证据缺口：{_selection_missing_code_label(code)}。")
    if not matched_points:
        matched_points.append("当前主推至少在大方向上与测评路线一致，但高强度匹配证据不算充足。")
    if not tradeoffs:
        tradeoffs.extend(profile.watchouts[:2] or ["当前主推没有明显反向信号，但仍建议结合使用习惯和季节状态判断。"])

    confidence = int(round((weighted_score / max(1, weight_total)) * 100 / 2))
    confidence = int(round((confidence + int(profile.confidence or 0)) / 2))
    needs_review = hard_mismatch or profile.needs_review or profile.subtype_fit_verdict in {"weak_fit", "mismatch"}
    return fit_items[:6], _dedupe_texts(matched_points), _dedupe_texts(tradeoffs), _dedupe_texts(guardrails), confidence, needs_review


def _build_selection_guardrails(matrix: MobileSelectionMatrixAnalysis) -> list[str]:
    items: list[str] = []
    for veto in matrix.triggered_vetoes:
        blocked = "、".join(route.route_title for route in veto.excluded_routes) or "若干路线"
        note = str(veto.note or veto.trigger).strip()
        items.append(f"{note}；系统因此排除了 {blocked}。")
    return _dedupe_texts(items)


def _build_selection_summary_text(
    *,
    route_title: str,
    route_rationale: list[dict[str, Any]],
    matched_points: list[str],
    tradeoffs: list[str],
    analysis: ProductAnalysisStoredResult | None,
) -> tuple[str, str]:
    primary_reason = route_rationale[0]["reason"] if route_rationale else f"你的答案整体更偏向 {route_title}。"
    if analysis is None:
        return (
            f"你当前更适合 {route_title} 方向",
            f"{primary_reason} 系统已先按这条路线给出主推，但产品侧的增强分析暂时缺失，所以推荐解释仍不完整。",
        )
    verdict = str(analysis.profile.subtype_fit_verdict or "").strip()
    if verdict == "strong_fit":
        headline = f"你当前更适合 {route_title}，主推与路线高度一致"
    elif verdict == "fit_with_limits":
        headline = f"你当前更偏 {route_title}，主推大方向匹配"
    else:
        headline = f"你当前落在 {route_title}，但主推仍有边界"
    summary = primary_reason
    if matched_points:
        summary += f" 产品侧最强匹配点是：{matched_points[0]}"
    if tradeoffs:
        summary += f" 需要注意的是：{tradeoffs[0]}"
    return headline, summary


def _evaluate_selection_fit_level(desired_level: str, product_score: int) -> str:
    score = max(0, min(5, int(product_score)))
    if desired_level == "high":
        if score >= 4:
            return "high"
        if score == 3:
            return "medium"
        return "low"
    if desired_level == "mid":
        if 2 <= score <= 4:
            return "high"
        if score in {1, 5}:
            return "medium"
        return "low"
    if score <= 1:
        return "high"
    if score == 2:
        return "medium"
    return "low"


def _selection_fit_reason(
    *,
    rule: RouteDiagnosticRule,
    product_score: int,
    source_reason: str,
    fit_level: str,
) -> str:
    desired_text = {"high": "应该更强", "mid": "应该适中", "low": "应该更低"}.get(rule.desired_level, "应该更贴合")
    prefix = f"{rule.diagnostic_label}当前 {product_score}/5，按路线预期它{desired_text}。"
    if source_reason:
        return f"{prefix} {source_reason}"
    return f"{prefix} 当前匹配度为 {fit_level}。"


def _selection_fit_weight_value(fit_level: str) -> int:
    if fit_level == "high":
        return 2
    if fit_level == "medium":
        return 1
    return 0


def _selection_missing_code_label(code: str) -> str:
    mapping = {
        "route_support_missing": "路线支撑不足",
        "evidence_too_sparse": "证据过少",
        "active_strength_unclear": "活性强度不明",
        "ingredient_order_unclear": "成分排序不明",
        "formula_signal_conflict": "配方信号冲突",
        "ingredient_library_absent": "缺少成分库摘要",
        "summary_signal_too_weak": "摘要信号偏弱",
    }
    return mapping.get(str(code or "").strip(), str(code or "").strip() or "未知缺口")


def _dedupe_texts(items: list[str]) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()
    for item in items:
        value = str(item or "").strip()
        if not value or value in seen:
            continue
        seen.add(value)
        out.append(value)
    return out


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
    return normalized_route_key or None


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
    preferred_image_rel = preferred_image_rel_path(str(row.image_path or "").strip())
    image_url = f"/{preferred_image_rel.lstrip('/')}" if preferred_image_rel else None
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


def _row_to_mobile_user_product_item(row: UserProduct) -> MobileUserProductItem:
    preferred_image_rel = preferred_image_rel_path(str(row.image_path or "").strip())
    image_url = f"/{preferred_image_rel.lstrip('/')}" if preferred_image_rel else None
    return MobileUserProductItem(
        user_product_id=str(row.user_product_id),
        category=str(row.category),
        brand=row.brand,
        name=row.name,
        one_sentence=row.one_sentence,
        image_url=image_url,
        source_upload_id=row.source_upload_id,
        status=str(row.status or "uploaded"),
        created_at=str(row.created_at),
        updated_at=str(row.updated_at),
        last_analyzed_at=row.last_analyzed_at,
    )


def _resolve_selection(category: str, answers: dict[str, str]) -> dict[str, Any]:
    config, route_titles, wiki_href = _selection_matrix_assets(category)
    try:
        decision = resolve_matrix_selection(config, answers)
    except MatrixDecisionError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return _build_resolved_selection_payload(
        category=category,
        config=config,
        route_titles=route_titles,
        decision=decision,
        wiki_href=wiki_href(decision.best_category),
    )


def _selection_matrix_assets(
    category: str,
) -> tuple[MatrixDecisionConfig, dict[str, str], Callable[[str], str]]:
    normalized = str(category or "").strip().lower()
    if normalized == "shampoo":
        return SHAMPOO_MATRIX_CONFIG, SHAMPOO_ROUTE_TITLES, lambda route_key: f"/m/wiki/shampoo?focus={route_key}"
    if normalized == "bodywash":
        return BODYWASH_MATRIX_CONFIG, BODYWASH_ROUTE_TITLES, lambda _route_key: "/m/wiki/bodywash"
    if normalized == "conditioner":
        return CONDITIONER_MATRIX_CONFIG, CONDITIONER_ROUTE_TITLES, lambda _route_key: "/m/wiki/conditioner"
    if normalized == "lotion":
        return LOTION_MATRIX_CONFIG, LOTION_ROUTE_TITLES, lambda _route_key: "/m/wiki/lotion"
    if normalized == "cleanser":
        return CLEANSER_MATRIX_CONFIG, CLEANSER_ROUTE_TITLES, lambda _route_key: "/m/wiki/cleanser"
    raise HTTPException(status_code=400, detail=f"Unsupported category: {category}.")


def _build_resolved_selection_payload(
    *,
    category: str,
    config: MatrixDecisionConfig,
    route_titles: dict[str, str],
    decision: MatrixDecisionResult,
    wiki_href: str,
) -> dict[str, Any]:
    route_key = decision.best_category
    route_title = route_titles.get(route_key, route_key)
    normalized_answers = decision.normalized_answers

    choices: list[dict[str, str]] = []
    for question in config.questions:
        value = normalized_answers.get(question.key)
        if not value:
            continue
        label = question.options.get(value) or value
        choices.append({"key": question.key, "value": value, "label": label})

    rule_hits: list[dict[str, str]] = []
    for question in config.questions:
        value = normalized_answers.get(question.key)
        if not value:
            continue
        deltas = decision.question_contributions.get(question.key) or {}
        effect = " / ".join(
            f"{category}:{'+' if points >= 0 else ''}{points}"
            for category, points in deltas.items()
        )
        rule_hits.append(
            {
                "rule": question.key,
                "effect": f"{question.title}={question.options.get(value) or value}；得分贡献 {effect}",
            }
        )

    for item in decision.triggered_vetoes:
        blocked = "、".join(item.excluded_categories) if item.excluded_categories else "-"
        note = item.note or item.trigger
        rule_hits.append({"rule": "veto", "effect": f"{note}（禁用：{blocked}）"})

    top2_text = " / ".join(f"{route_titles.get(route_key_item, route_key_item)}:{score}" for route_key_item, score in decision.top2) or "-"
    rule_hits.append({"rule": "route", "effect": f"最终收敛：{route_title}（{route_key}）；Top2={top2_text}"})

    return {
        "answers": normalized_answers,
        "route_key": route_key,
        "route_title": route_title,
        "choices": choices,
        "rule_hits": rule_hits,
        "matrix_analysis": _build_mobile_selection_matrix_analysis(
            config=config,
            route_titles=route_titles,
            decision=decision,
        ),
        "wiki_href": wiki_href,
    }

def _build_mobile_selection_matrix_analysis(
    *,
    config: MatrixDecisionConfig,
    route_titles: dict[str, str],
    decision: MatrixDecisionResult,
) -> dict[str, Any]:
    best_score = int(decision.scores_after_mask.get(decision.best_category, 0))
    excluded_set = set(decision.excluded_categories)

    eligible_sorted = sorted(
        [route_key for route_key in config.categories if route_key not in excluded_set],
        key=lambda route_key: (
            -int(decision.scores_after_mask.get(route_key, 0)),
            list(config.categories).index(route_key),
        ),
    )
    rank_map = {route_key: idx + 1 for idx, route_key in enumerate(eligible_sorted)}
    excluded_rank_start = len(eligible_sorted) + 1

    routes: list[MobileSelectionMatrixRouteScore] = []
    for idx, route_key in enumerate(config.categories):
        is_excluded = route_key in excluded_set
        before_mask = int(decision.scores_before_mask.get(route_key, 0))
        after_raw = int(decision.scores_after_mask.get(route_key, 0))
        score_after_mask = None if is_excluded else after_raw
        gap_from_best = None if is_excluded else max(0, best_score - after_raw)
        routes.append(
            MobileSelectionMatrixRouteScore(
                route_key=route_key,
                route_title=route_titles.get(route_key, route_key),
                score_before_mask=before_mask,
                score_after_mask=score_after_mask,
                is_excluded=is_excluded,
                rank=(excluded_rank_start + idx) if is_excluded else rank_map.get(route_key, 0),
                gap_from_best=gap_from_best,
            )
        )

    question_contributions: list[MobileSelectionMatrixQuestionContribution] = []
    for question in config.questions:
        value = decision.normalized_answers.get(question.key)
        if not value:
            continue
        deltas = decision.question_contributions.get(question.key) or {}
        route_deltas = [
            MobileSelectionMatrixQuestionRouteDelta(
                route_key=route_key,
                route_title=route_titles.get(route_key, route_key),
                delta=int(deltas.get(route_key, 0)),
            )
            for route_key in config.categories
        ]
        question_contributions.append(
            MobileSelectionMatrixQuestionContribution(
                question_key=question.key,
                question_title=question.title,
                answer_value=value,
                answer_label=question.options.get(value) or value,
                route_deltas=route_deltas,
            )
        )

    triggered_vetoes = [
        MobileSelectionMatrixTriggeredVeto(
            trigger=item.trigger,
            note=item.note,
            excluded_routes=[
                MobileSelectionMatrixVetoRoute(
                    route_key=route_key,
                    route_title=route_titles.get(route_key, route_key),
                )
                for route_key in item.excluded_categories
            ],
        )
        for item in decision.triggered_vetoes
    ]
    top2 = [
        MobileSelectionMatrixTopRoute(
            route_key=route_key,
            route_title=route_titles.get(route_key, route_key),
            score_after_mask=int(score),
        )
        for route_key, score in decision.top2
    ]

    return MobileSelectionMatrixAnalysis(
        routes=routes,
        question_contributions=question_contributions,
        triggered_vetoes=triggered_vetoes,
        top2=top2,
    ).model_dump()


def _require_value(answers: dict[str, str], key: str, allowed: set[str]) -> str:
    value = str(answers.get(key) or "").strip()
    if not value:
        raise HTTPException(status_code=400, detail=f"Missing answer: {key}.")
    if value not in allowed:
        raise HTTPException(status_code=400, detail=f"Invalid answer: {key}.")
    return value
