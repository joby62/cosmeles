from app.ai.prompts import load_prompt
from app.schemas import (
    BodywashProductAnalysisResult,
    CleanserProductAnalysisResult,
    ConditionerProductAnalysisResult,
    LotionProductAnalysisResult,
    ProductAnalysisContextPayload,
    ShampooProductAnalysisResult,
)


def _build_context_payload(category: str) -> dict:
    return {
        "product": {
            "product_id": "prod-1",
            "category": category,
            "brand": "Brand",
            "name": "Name",
            "one_sentence": "一句话",
        },
        "route_mapping": {
            "primary_route_key": "route-a",
            "primary_route_title": "类型A",
            "primary_confidence": 86,
            "secondary_route_key": "route-b",
            "secondary_route_title": "类型B",
            "secondary_confidence": 52,
        },
        "stage2_summary": {
            "one_sentence": "摘要",
            "pros": ["优点1"],
            "cons": ["缺点1"],
            "who_for": ["适合1"],
            "who_not_for": ["不适合1"],
        },
        "ingredients_compact": [
            {
                "rank": 1,
                "ingredient_name_cn": "水",
                "ingredient_name_en": "Water",
                "type": "溶剂",
                "functions": ["溶剂"],
                "risk": "low",
                "abundance_level": "major",
            }
        ],
        "salient_ingredient_briefs": [
            {
                "ingredient_name_cn": "水",
                "ingredient_name_en": "Water",
                "rank": 1,
                "why_selected": "top_rank",
                "library_summary": "基础溶剂。",
                "benefit_tags": ["基础"],
                "risk_tags": [],
            }
        ],
        "formula_signals": {
            "top10_names": ["水"],
            "function_counts": {"溶剂": 1},
            "risk_counts": {"low": 1},
            "special_flags": [],
        },
    }


def _build_base_result(schema_version: str, category: str) -> dict:
    return {
        "schema_version": schema_version,
        "category": category,
        "route_key": "route-a",
        "route_title": "类型A",
        "headline": "这是一个合规标题",
        "positioning_summary": "这是一个定位摘要，用于验证结果 schema 可以被严格解析。",
        "subtype_fit_verdict": "fit_with_limits",
        "subtype_fit_reason": "当前 route 有一定支持，但证据强度仍然有限。",
        "best_for": ["适合对象一", "适合对象二", "适合对象三"],
        "not_ideal_for": ["不适合对象一", "不适合对象二", "不适合对象三"],
        "usage_tips": ["用法提示一", "用法提示二", "用法提示三"],
        "watchouts": ["注意事项一", "注意事项二", "注意事项三"],
        "key_ingredients": [
            {
                "ingredient_name_cn": "水",
                "ingredient_name_en": "Water",
                "rank": 1,
                "role": "基础溶剂",
                "impact": "提供基底。",
            }
        ],
        "evidence": {
            "positive": [
                {
                    "ingredient_name_cn": "水",
                    "ingredient_name_en": "Water",
                    "rank": 1,
                    "impact": "说明配方基底清晰。",
                }
            ],
            "counter": [],
            "missing_codes": ["summary_signal_too_weak"],
        },
        "confidence": 68,
        "confidence_reason": "证据基本成立，但缺少更强的功能性成分支撑。",
        "needs_review": True,
    }


def test_product_profile_prompts_load_and_reference_context_contract():
    categories = ("shampoo", "bodywash", "conditioner", "lotion", "cleanser")
    for category in categories:
        prompt = load_prompt(f"doubao.product_profile_{category}").text
        assert "{{product_analysis_context_json}}" in prompt
        assert "diagnostics" in prompt
        assert "subtype_fit_verdict" in prompt
        assert "route_support_missing" in prompt


def test_product_analysis_context_payload_accepts_compact_contract():
    payload = ProductAnalysisContextPayload.model_validate(_build_context_payload("shampoo"))
    assert payload.product.category == "shampoo"
    assert payload.route_mapping.primary_confidence == 86


def test_product_profile_result_schemas_accept_category_specific_diagnostics():
    shampoo = ShampooProductAnalysisResult.model_validate(
        {
            **_build_base_result("product_profile_shampoo.v1", "shampoo"),
            "diagnostics": {
                "cleanse_intensity": {"score": 4, "reason": "清洁基底较明确。"},
                "oil_control_support": {"score": 4, "reason": "控油倾向较明显。"},
                "dandruff_itch_support": {"score": 1, "reason": "去屑证据偏弱。"},
                "scalp_soothing_support": {"score": 2, "reason": "舒缓支持有限。"},
                "hair_strengthening_support": {"score": 1, "reason": "强韧证据不足。"},
                "moisture_balance_support": {"score": 2, "reason": "平衡支持一般。"},
                "daily_use_friendliness": {"score": 3, "reason": "日常使用边界中等。"},
                "residue_weight": {"score": 1, "reason": "残留负担较低。"},
            },
        }
    )
    bodywash = BodywashProductAnalysisResult.model_validate(
        {
            **_build_base_result("product_profile_bodywash.v1", "bodywash"),
            "diagnostics": {
                "cleanse_intensity": {"score": 3, "reason": "清洁力中等。"},
                "barrier_repair_support": {"score": 2, "reason": "修护支持有限。"},
                "body_acne_support": {"score": 1, "reason": "净痘证据偏弱。"},
                "keratin_softening_support": {"score": 1, "reason": "更新支持不足。"},
                "brightening_support": {"score": 2, "reason": "亮肤逻辑较轻。"},
                "fragrance_presence": {"score": 4, "reason": "香氛存在感较强。"},
                "rinse_afterfeel_nourishment": {"score": 3, "reason": "洗后肤感较平衡。"},
            },
        }
    )
    conditioner = ConditionerProductAnalysisResult.model_validate(
        {
            **_build_base_result("product_profile_conditioner.v1", "conditioner"),
            "diagnostics": {
                "detangling_support": {"score": 4, "reason": "顺滑解结能力较强。"},
                "anti_frizz_support": {"score": 3, "reason": "抚躁支持中等。"},
                "airy_light_support": {"score": 2, "reason": "轻盈程度一般。"},
                "repair_density": {"score": 2, "reason": "修护密度有限。"},
                "color_lock_support": {"score": 1, "reason": "锁色证据不足。"},
                "basic_hydration_support": {"score": 4, "reason": "基础保湿较稳定。"},
                "fine_hair_burden": {"score": 2, "reason": "对细软发负担偏低。"},
            },
        }
    )
    lotion = LotionProductAnalysisResult.model_validate(
        {
            **_build_base_result("product_profile_lotion.v1", "lotion"),
            "diagnostics": {
                "light_hydration_support": {"score": 4, "reason": "轻保湿支持较明显。"},
                "heavy_repair_support": {"score": 1, "reason": "重修护结构不足。"},
                "body_acne_support": {"score": 1, "reason": "净痘支持很弱。"},
                "aha_renew_support": {"score": 1, "reason": "焕肤证据不足。"},
                "brightening_support": {"score": 2, "reason": "提亮逻辑有限。"},
                "fragrance_presence": {"score": 3, "reason": "有一定香氛存在感。"},
                "occlusive_weight": {"score": 2, "reason": "封闭感中低。"},
            },
        }
    )
    cleanser = CleanserProductAnalysisResult.model_validate(
        {
            **_build_base_result("product_profile_cleanser.v1", "cleanser"),
            "diagnostics": {
                "apg_support": {"score": 2, "reason": "APG 支持一般。"},
                "amino_support": {"score": 3, "reason": "氨基酸支持中等。"},
                "soap_blend_strength": {"score": 1, "reason": "皂氨复配证据偏弱。"},
                "bha_support": {"score": 0, "reason": "未见明确 BHA 支持。"},
                "clay_support": {"score": 0, "reason": "未见泥类结构。"},
                "enzyme_support": {"score": 0, "reason": "未见酵素逻辑。"},
                "barrier_friendliness": {"score": 4, "reason": "对屏障较友好。"},
                "makeup_residue_support": {"score": 2, "reason": "残留清洁能力一般。"},
            },
        }
    )

    assert shampoo.category == "shampoo"
    assert bodywash.category == "bodywash"
    assert conditioner.category == "conditioner"
    assert lotion.category == "lotion"
    assert cleanser.category == "cleanser"
