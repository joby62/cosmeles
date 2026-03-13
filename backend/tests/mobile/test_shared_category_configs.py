from app.domain.mobile.decision import load_mobile_decision_category_config
from app.services.matrix_decision import compile_matrix_config


CATEGORIES = ("shampoo", "bodywash", "conditioner", "lotion", "cleanser")


def test_shared_config_loads_for_all_categories() -> None:
    for category in CATEGORIES:
        config = load_mobile_decision_category_config(category)
        assert config.schema_version == "mobile_decision_category.v1"
        assert config.category == category
        assert config.matrix["category"] == category
        assert set(config.route_titles) == set(config.matrix["categories"])


def test_shared_matrix_compiles_for_all_categories() -> None:
    for category in CATEGORIES:
        config = load_mobile_decision_category_config(category)
        compiled = compile_matrix_config(config.matrix)
        assert compiled.category == category
        assert compiled.questions
        assert tuple(compiled.categories) == tuple(config.matrix["categories"])
