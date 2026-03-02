from app.ai.capabilities import _normalize_ingredient_category_profile_result


def test_normalize_ingredient_profile_splits_mixed_cn_en_name():
    result = _normalize_ingredient_category_profile_result(
        category="bodywash",
        ingredient="PEG-150 季戊四醇四硬脂酸酯",
        payload={
            "ingredient_name": "季戊四醇四硬脂酸酯 (PEG-150 Pentaerythrityl Tetrastearate)",
            "ingredient_name_en": "",
            "category": "bodywash",
            "summary": "测试摘要",
            "benefits": ["测试作用"],
            "risks": ["测试风险"],
            "usage_tips": ["测试建议"],
            "suitable_for": ["测试人群"],
            "avoid_for": ["测试禁忌"],
            "confidence": 78,
            "reason": "测试依据",
        },
    )

    assert result["ingredient_name"] == "季戊四醇四硬脂酸酯"
    assert result["ingredient_name_en"] == "PEG-150 Pentaerythrityl Tetrastearate"


def test_normalize_ingredient_profile_keeps_clean_cn_and_en_fields():
    result = _normalize_ingredient_category_profile_result(
        category="shampoo",
        ingredient="吡罗克酮乙醇胺盐",
        payload={
            "ingredient_name": "吡罗克酮乙醇胺盐",
            "ingredient_name_en": "Piroctone Olamine",
            "category": "shampoo",
            "summary": "测试摘要2",
            "benefits": ["测试作用2"],
            "risks": [],
            "usage_tips": ["测试建议2"],
            "suitable_for": ["测试人群2"],
            "avoid_for": [],
            "confidence": 82,
            "reason": "测试依据2",
        },
    )

    assert result["ingredient_name"] == "吡罗克酮乙醇胺盐"
    assert result["ingredient_name_en"] == "Piroctone Olamine"
