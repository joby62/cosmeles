from __future__ import annotations

from dataclasses import dataclass
from typing import Literal


DesiredLevel = Literal["high", "mid", "low"]


@dataclass(frozen=True)
class RouteDiagnosticRule:
    diagnostic_key: str
    diagnostic_label: str
    desired_level: DesiredLevel
    weight: int


FIT_RULES: dict[str, dict[str, tuple[RouteDiagnosticRule, ...]]] = {
    "shampoo": {
        "deep-oil-control": (
            RouteDiagnosticRule("cleanse_intensity", "清洁强度", "high", 3),
            RouteDiagnosticRule("oil_control_support", "控油支持", "high", 3),
            RouteDiagnosticRule("daily_use_friendliness", "高频使用友好度", "mid", 1),
            RouteDiagnosticRule("residue_weight", "残留厚重感", "low", 2),
        ),
        "anti-dandruff-itch": (
            RouteDiagnosticRule("dandruff_itch_support", "去屑止痒支持", "high", 3),
            RouteDiagnosticRule("scalp_soothing_support", "头皮舒缓支持", "high", 2),
            RouteDiagnosticRule("cleanse_intensity", "清洁强度", "mid", 1),
            RouteDiagnosticRule("residue_weight", "残留厚重感", "low", 1),
        ),
        "gentle-soothing": (
            RouteDiagnosticRule("scalp_soothing_support", "头皮舒缓支持", "high", 3),
            RouteDiagnosticRule("daily_use_friendliness", "高频使用友好度", "high", 2),
            RouteDiagnosticRule("cleanse_intensity", "清洁强度", "low", 2),
            RouteDiagnosticRule("residue_weight", "残留厚重感", "low", 1),
            RouteDiagnosticRule("moisture_balance_support", "水油平衡支持", "mid", 1),
        ),
        "anti-hair-loss": (
            RouteDiagnosticRule("hair_strengthening_support", "强韧支持", "high", 3),
            RouteDiagnosticRule("scalp_soothing_support", "头皮舒缓支持", "mid", 1),
            RouteDiagnosticRule("daily_use_friendliness", "高频使用友好度", "mid", 1),
            RouteDiagnosticRule("residue_weight", "残留厚重感", "low", 1),
        ),
        "moisture-balance": (
            RouteDiagnosticRule("moisture_balance_support", "水油平衡支持", "high", 3),
            RouteDiagnosticRule("daily_use_friendliness", "高频使用友好度", "high", 2),
            RouteDiagnosticRule("cleanse_intensity", "清洁强度", "mid", 1),
            RouteDiagnosticRule("residue_weight", "残留厚重感", "low", 1),
            RouteDiagnosticRule("scalp_soothing_support", "头皮舒缓支持", "mid", 1),
        ),
    },
    "bodywash": {
        "rescue": (
            RouteDiagnosticRule("barrier_repair_support", "屏障修护支持", "high", 3),
            RouteDiagnosticRule("rinse_afterfeel_nourishment", "洗后柔润感", "high", 2),
            RouteDiagnosticRule("cleanse_intensity", "清洁强度", "low", 2),
        ),
        "purge": (
            RouteDiagnosticRule("body_acne_support", "痘肌支持", "high", 3),
            RouteDiagnosticRule("cleanse_intensity", "清洁强度", "high", 2),
            RouteDiagnosticRule("rinse_afterfeel_nourishment", "洗后柔润感", "mid", 1),
        ),
        "polish": (
            RouteDiagnosticRule("keratin_softening_support", "粗糙角质支持", "high", 3),
            RouteDiagnosticRule("cleanse_intensity", "清洁强度", "mid", 1),
            RouteDiagnosticRule("rinse_afterfeel_nourishment", "洗后柔润感", "mid", 1),
        ),
        "glow": (
            RouteDiagnosticRule("brightening_support", "提亮支持", "high", 3),
            RouteDiagnosticRule("cleanse_intensity", "清洁强度", "mid", 1),
            RouteDiagnosticRule("barrier_repair_support", "屏障修护支持", "mid", 1),
        ),
        "shield": (
            RouteDiagnosticRule("barrier_repair_support", "屏障修护支持", "high", 3),
            RouteDiagnosticRule("rinse_afterfeel_nourishment", "洗后柔润感", "high", 2),
            RouteDiagnosticRule("cleanse_intensity", "清洁强度", "low", 2),
        ),
        "vibe": (
            RouteDiagnosticRule("fragrance_presence", "香氛存在感", "high", 3),
            RouteDiagnosticRule("cleanse_intensity", "清洁强度", "mid", 1),
            RouteDiagnosticRule("rinse_afterfeel_nourishment", "洗后柔润感", "mid", 1),
        ),
    },
    "conditioner": {
        "c-color-lock": (
            RouteDiagnosticRule("color_lock_support", "锁色支持", "high", 3),
            RouteDiagnosticRule("anti_frizz_support", "抗躁支持", "mid", 1),
            RouteDiagnosticRule("repair_density", "修护密度", "mid", 1),
            RouteDiagnosticRule("fine_hair_burden", "细软压塌风险", "low", 1),
        ),
        "c-airy-light": (
            RouteDiagnosticRule("airy_light_support", "轻盈蓬松支持", "high", 3),
            RouteDiagnosticRule("detangling_support", "解结支持", "mid", 1),
            RouteDiagnosticRule("fine_hair_burden", "细软压塌风险", "low", 3),
        ),
        "c-structure-rebuild": (
            RouteDiagnosticRule("repair_density", "修护密度", "high", 3),
            RouteDiagnosticRule("anti_frizz_support", "抗躁支持", "mid", 1),
            RouteDiagnosticRule("detangling_support", "解结支持", "mid", 1),
        ),
        "c-smooth-frizz": (
            RouteDiagnosticRule("anti_frizz_support", "抗躁支持", "high", 3),
            RouteDiagnosticRule("detangling_support", "解结支持", "high", 2),
            RouteDiagnosticRule("repair_density", "修护密度", "mid", 1),
            RouteDiagnosticRule("fine_hair_burden", "细软压塌风险", "mid", 1),
        ),
        "c-basic-hydrate": (
            RouteDiagnosticRule("basic_hydration_support", "基础保湿支持", "high", 3),
            RouteDiagnosticRule("detangling_support", "解结支持", "mid", 1),
            RouteDiagnosticRule("airy_light_support", "轻盈蓬松支持", "mid", 1),
            RouteDiagnosticRule("fine_hair_burden", "细软压塌风险", "low", 1),
        ),
    },
    "lotion": {
        "light_hydrate": (
            RouteDiagnosticRule("light_hydration_support", "轻盈保湿支持", "high", 3),
            RouteDiagnosticRule("occlusive_weight", "封闭厚重感", "low", 3),
            RouteDiagnosticRule("heavy_repair_support", "重度修护支持", "mid", 1),
        ),
        "heavy_repair": (
            RouteDiagnosticRule("heavy_repair_support", "重度修护支持", "high", 3),
            RouteDiagnosticRule("occlusive_weight", "封闭厚重感", "high", 2),
            RouteDiagnosticRule("light_hydration_support", "轻盈保湿支持", "mid", 1),
        ),
        "bha_clear": (
            RouteDiagnosticRule("body_acne_support", "痘肌支持", "high", 3),
            RouteDiagnosticRule("occlusive_weight", "封闭厚重感", "low", 2),
            RouteDiagnosticRule("fragrance_presence", "香氛存在感", "mid", 1),
        ),
        "aha_renew": (
            RouteDiagnosticRule("aha_renew_support", "焕肤支持", "high", 3),
            RouteDiagnosticRule("light_hydration_support", "轻盈保湿支持", "mid", 1),
            RouteDiagnosticRule("occlusive_weight", "封闭厚重感", "low", 1),
        ),
        "glow_bright": (
            RouteDiagnosticRule("brightening_support", "提亮支持", "high", 3),
            RouteDiagnosticRule("light_hydration_support", "轻盈保湿支持", "mid", 1),
            RouteDiagnosticRule("occlusive_weight", "封闭厚重感", "mid", 1),
        ),
        "vibe_fragrance": (
            RouteDiagnosticRule("fragrance_presence", "香氛存在感", "high", 3),
            RouteDiagnosticRule("light_hydration_support", "轻盈保湿支持", "mid", 1),
            RouteDiagnosticRule("occlusive_weight", "封闭厚重感", "mid", 1),
        ),
    },
    "cleanser": {
        "apg_soothing": (
            RouteDiagnosticRule("apg_support", "APG体系支持", "high", 3),
            RouteDiagnosticRule("barrier_friendliness", "屏障友好度", "high", 3),
            RouteDiagnosticRule("soap_blend_strength", "皂氨复配强度", "low", 2),
            RouteDiagnosticRule("bha_support", "BHA净肤支持", "low", 1),
            RouteDiagnosticRule("clay_support", "泥类净化支持", "low", 1),
            RouteDiagnosticRule("enzyme_support", "酵素抛光支持", "low", 1),
        ),
        "pure_amino": (
            RouteDiagnosticRule("amino_support", "氨基酸体系支持", "high", 3),
            RouteDiagnosticRule("barrier_friendliness", "屏障友好度", "high", 3),
            RouteDiagnosticRule("soap_blend_strength", "皂氨复配强度", "low", 2),
            RouteDiagnosticRule("bha_support", "BHA净肤支持", "low", 1),
        ),
        "soap_amino_blend": (
            RouteDiagnosticRule("soap_blend_strength", "皂氨复配强度", "high", 3),
            RouteDiagnosticRule("makeup_residue_support", "防晒彩妆残留处理", "high", 2),
            RouteDiagnosticRule("barrier_friendliness", "屏障友好度", "mid", 1),
        ),
        "bha_clearing": (
            RouteDiagnosticRule("bha_support", "BHA净肤支持", "high", 3),
            RouteDiagnosticRule("makeup_residue_support", "防晒彩妆残留处理", "mid", 1),
            RouteDiagnosticRule("barrier_friendliness", "屏障友好度", "mid", 1),
        ),
        "clay_purifying": (
            RouteDiagnosticRule("clay_support", "泥类净化支持", "high", 3),
            RouteDiagnosticRule("soap_blend_strength", "皂氨复配强度", "mid", 1),
            RouteDiagnosticRule("barrier_friendliness", "屏障友好度", "mid", 1),
        ),
        "enzyme_polishing": (
            RouteDiagnosticRule("enzyme_support", "酵素抛光支持", "high", 3),
            RouteDiagnosticRule("makeup_residue_support", "防晒彩妆残留处理", "mid", 1),
            RouteDiagnosticRule("barrier_friendliness", "屏障友好度", "mid", 1),
        ),
    },
}


def get_route_diagnostic_rules(category: str, route_key: str) -> tuple[RouteDiagnosticRule, ...]:
    return FIT_RULES.get(str(category or "").strip().lower(), {}).get(str(route_key or "").strip(), ())
