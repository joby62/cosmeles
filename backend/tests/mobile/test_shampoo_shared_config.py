from app.domain.mobile.decision import load_mobile_decision_category_config
from app.services.matrix_decision import compile_matrix_config


def test_shampoo_shared_config_loads() -> None:
    config = load_mobile_decision_category_config("shampoo")
    assert config.schema_version == "mobile_decision_category.v1"
    assert config.category == "shampoo"
    assert config.route_titles["deep-oil-control"] == "深层控油型"
    assert config.matrix["category"] == "shampoo"


def test_shampoo_shared_matrix_compiles() -> None:
    config = load_mobile_decision_category_config("shampoo")
    compiled = compile_matrix_config(config.matrix)
    assert compiled.category == "shampoo"
    assert len(compiled.questions) == 3
    assert compiled.categories[0] == "deep-oil-control"
