import json
from pathlib import Path

import pytest

from app.schemas import (
    MobileSelectionLinks,
    MobileSelectionPublishedResult,
    MobileSelectionResultBlock,
    MobileSelectionResultCTA,
    MobileSelectionResultMeta,
    MobileSelectionRoute,
    ProductCard,
)
from app.services.mobile_selection_results import build_mobile_selection_result_contract_v3


REPO_ROOT = Path(__file__).resolve().parents[3]


def _build_published_result(
    *,
    blocks: list[MobileSelectionResultBlock] | None = None,
    ctas: list[MobileSelectionResultCTA] | None = None,
) -> MobileSelectionPublishedResult:
    return MobileSelectionPublishedResult(
        schema_version="selection_result_content.v2",
        renderer_variant="selection_result_default",
        scenario_id="selres-shampoo-2026-03-03-1-abc123",
        category="shampoo",
        answers_hash="hash-abc",
        rules_version="2026-03-03.1",
        route=MobileSelectionRoute(key="deep-oil-control", title="深层控油型"),
        recommendation_source="featured_slot",
        recommended_product=ProductCard(
            id="prod-1",
            category="shampoo",
            brand="Dove",
            name="Shampoo A",
            one_sentence="mock",
            tags=[],
            image_url="/assets/p-1.png",
            created_at="2026-03-12T01:00:00.000000Z",
        ),
        links=MobileSelectionLinks(
            product="/product/prod-1",
            wiki="/m/wiki/shampoo?focus=deep-oil-control",
        ),
        micro_summary="先稳住油脂分泌",
        display_order=["hero", "situation", "attention", "pitfalls", "ctas"],
        blocks=blocks
        or [
            MobileSelectionResultBlock(
                id="hero",
                kind="hero",
                version="v1",
                payload={
                    "title": "先稳住油脂分泌",
                    "subtitle": "先把出油波动稳定下来，再处理次级诉求。",
                },
            ),
            MobileSelectionResultBlock(
                id="situation",
                kind="explanation",
                version="v1",
                payload={
                    "title": "你现在更像什么情况",
                    "subtitle": "当前更偏向油脂管理优先，说明先稳态是关键。",
                },
            ),
            MobileSelectionResultBlock(
                id="attention",
                kind="strategy",
                version="v1",
                payload={
                    "title": "你当前最该抓住什么",
                    "subtitle": "先降低波动频率，再谈额外护理收益。",
                },
            ),
            MobileSelectionResultBlock(
                id="pitfalls",
                kind="warning",
                version="v1",
                payload={
                    "title": "你现在最该少踩的坑",
                    "subtitle": "避免过度追求强清洁导致头皮反弹。",
                },
            ),
        ],
        ctas=ctas
        or [
            MobileSelectionResultCTA(
                id="open_product",
                label="查看产品",
                action="product",
                href="/product/prod-1",
                payload={},
            ),
            MobileSelectionResultCTA(
                id="open_wiki",
                label="查看百科",
                action="wiki",
                href="/m/wiki/shampoo",
                payload={},
            ),
            MobileSelectionResultCTA(
                id="restart_compare",
                label="重新测评",
                action="compare",
                href="/m/compare?category=shampoo",
                payload={},
            ),
        ],
        meta=MobileSelectionResultMeta(
            prompt_key="doubao.mobile_selection_result_shampoo",
            prompt_version="v1",
            model="mock",
            refresh_reason="pytest",
            raw_storage_path=None,
            published_version_path="selection_results/published/mock.json",
            generated_at="2026-03-12T01:00:00.000000Z",
        ),
    )


def test_selection_result_v3_contract_file_is_consistent() -> None:
    payload = json.loads((REPO_ROOT / "shared/mobile/contracts/selection_result.v3.json").read_text(encoding="utf-8"))
    assert payload["schema_version"] == "selection_result.v3"
    assert payload["constraints"]["reason_count"] == 3
    assert payload["constraints"]["allowed_secondary_loops"] == ["compare", "wiki", "me"]
    assert payload["adapter_boundary"]["emits_fixed_contract_version"] == "selection_result.v3"
    assert payload["adapter_boundary"]["accepts_published_schema_versions"] == [
        "selection_result_content.v1",
        "selection_result_content.v2",
    ]


def test_analytics_events_contract_uses_result_event_family() -> None:
    payload = json.loads((REPO_ROOT / "shared/mobile/contracts/analytics_events.json").read_text(encoding="utf-8"))
    events = payload["events"]
    assert "result_view" in events
    assert "choose_category_start_click" in events
    assert "result_add_to_bag_click" in events
    assert "result_compare_entry_click" in events
    assert "result_rationale_entry_click" in events
    assert "result_retry_same_category_click" in events
    assert "result_switch_category_click" in events
    assert events["choose_start_click"]["status"] == "compatibility_only"
    assert events["result_primary_cta_click"]["status"] == "compatibility_only"
    assert events["result_secondary_loop_click"]["status"] == "compatibility_only"
    assert "profile_result_view" not in events
    assert payload["decision_result_semantics"]["legacy_aliases_removed"] == ["profile_result_view"]
    assert payload["decision_result_semantics"]["legacy_bridge_by_result_cta"]["compare"] == "result_compare_entry_click"


def test_analytics_p0_funnel_contract_keeps_phase_13_canonical_truth_with_legacy_bridges() -> None:
    payload = json.loads((REPO_ROOT / "shared/mobile/contracts/analytics_p0_funnel.v1.json").read_text(encoding="utf-8"))
    assert payload["canonical_event_vocabulary"]["first_run_funnel"] == [
        "home_primary_cta_click",
        "choose_category_start_click",
        "questionnaire_view",
        "questionnaire_completed",
        "result_view",
    ]
    assert payload["summary_metrics"]["choose_start_click_sessions"]["event"] == "choose_category_start_click"
    assert payload["summary_metrics"]["choose_start_click_sessions"]["compatibility_bridges"] == [
        {"event": "choose_start_click"}
    ]
    assert payload["summary_metrics"]["result_primary_cta_click_sessions"]["event"] == "result_add_to_bag_click"
    assert payload["funnel_steps"][1]["step_key"] == "choose_category_start"
    assert payload["funnel_steps"][2]["required_prop_values"] == {"step": 1}


def test_selection_result_adapter_builds_v3_contract() -> None:
    published = _build_published_result()
    contract = build_mobile_selection_result_contract_v3(published)

    assert contract.schema_version == "selection_result.v3"
    assert contract.summary.headline == "先稳住油脂分泌"
    assert len(contract.reasons) == 3
    assert contract.next_step.action == "product"
    assert [item.action for item in contract.secondary_loops] == ["wiki", "compare"]


def test_selection_result_adapter_requires_exactly_three_reasons() -> None:
    published = _build_published_result(
        blocks=[
            MobileSelectionResultBlock(
                id="hero",
                kind="hero",
                version="v1",
                payload={"title": "先稳住油脂分泌", "subtitle": "先稳住，再优化。"},
            ),
            MobileSelectionResultBlock(
                id="situation",
                kind="explanation",
                version="v1",
                payload={"title": "你现在更像什么情况", "subtitle": "当前更偏向油脂管理优先。"},
            ),
            MobileSelectionResultBlock(
                id="attention",
                kind="strategy",
                version="v1",
                payload={"title": "你当前最该抓住什么", "subtitle": "先降低波动频率。"},
            ),
        ]
    )

    with pytest.raises(ValueError, match="requires exactly 3 reasons"):
        build_mobile_selection_result_contract_v3(published)
