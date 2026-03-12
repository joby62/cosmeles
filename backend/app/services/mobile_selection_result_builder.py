import hashlib
import json
from typing import Any, Callable

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.ai.orchestrator import run_capability_now
from app.ai.prompts import load_prompt
from app.constants import MOBILE_RULES_VERSION, PRODUCT_PROFILE_SUPPORTED_CATEGORIES, VALID_CATEGORIES
from app.db.models import MobileSelectionResultIndex
from app.routes.mobile import (
    CATEGORY_LABELS_ZH,
    _build_answers_hash,
    _load_ready_product_analysis_result,
    _resolve_selection,
    _resolve_selection_product_row,
    _row_to_product_card,
    _selection_matrix_assets,
)
from app.schemas import (
    MobileSelectionChoice,
    MobileSelectionLinks,
    MobileSelectionMatrixAnalysis,
    MobileSelectionResultAIContent,
    MobileSelectionResultBuildItem,
    MobileSelectionResultBuildRequest,
    MobileSelectionResultBuildResponse,
    MobileSelectionResultContextPayload,
    MobileSelectionResultIngredientSnapshotItem,
    MobileSelectionResultProductAnalysisSummary,
    MobileSelectionResultShareCopy,
    MobileSelectionRoute,
)
from app.services.matrix_decision import _evaluate_trigger, MatrixQuestion
from app.services.mobile_selection_results import publish_mobile_selection_result
from app.services.storage import exists_rel_path


class SelectionResultBuildCancelledError(RuntimeError):
    pass


def build_mobile_selection_results(
    payload: MobileSelectionResultBuildRequest,
    *,
    db: Session,
    event_callback: Callable[[dict[str, Any]], None] | None = None,
    should_cancel: Callable[[], bool] | None = None,
) -> MobileSelectionResultBuildResponse:
    category = str(payload.category or "").strip().lower()
    if category:
        if category not in VALID_CATEGORIES:
            raise ValueError(f"Invalid category: {category}.")
        if category not in PRODUCT_PROFILE_SUPPORTED_CATEGORIES:
            raise ValueError(f"Selection result generation does not support category '{category}'.")
        target_categories = [category]
    else:
        target_categories = sorted(PRODUCT_PROFILE_SUPPORTED_CATEGORIES)

    prompt_versions = {
        cat: load_prompt(f"doubao.mobile_selection_result_{cat}").version
        for cat in target_categories
    }
    force_regenerate = bool(payload.force_regenerate)
    only_missing = bool(payload.only_missing)

    scenarios: list[tuple[str, dict[str, str]]] = []
    for target_category in target_categories:
        for answers in _enumerate_selection_answers(target_category):
            scenarios.append((target_category, answers))

    total = len(scenarios)
    _emit(
        event_callback,
        {
            "step": "selection_result_build_start",
            "categories": target_categories,
            "scanned_products": total,
            "text": f"开始构建 selection result：枚举场景 {total} 个。",
        },
    )

    submitted_to_model = 0
    created = 0
    updated = 0
    skipped = 0
    failed = 0
    items: list[MobileSelectionResultBuildItem] = []
    failures: list[str] = []

    for idx, (target_category, answers) in enumerate(scenarios, start=1):
        _check_cancel(should_cancel)
        try:
            context = _build_selection_result_context(
                db=db,
                category=target_category,
                answers=answers,
            )
            prompt_key = f"doubao.mobile_selection_result_{target_category}"
            prompt_version = prompt_versions[target_category]
            fingerprint = _build_selection_result_fingerprint(
                context=context,
                prompt_key=prompt_key,
                prompt_version=prompt_version,
                renderer_variant="selection_result_default",
            )
            existing = _load_existing_selection_result_index(
                db=db,
                category=target_category,
                answers_hash=context.answers_hash,
            )
            storage_ready = bool(existing and str(existing.storage_path or "").strip() and exists_rel_path(str(existing.storage_path or "").strip()))

            if only_missing and existing is not None and str(existing.status or "").strip().lower() == "ready" and storage_ready:
                skipped += 1
                items.append(
                    MobileSelectionResultBuildItem(
                        category=target_category,
                        answers_hash=context.answers_hash,
                        route_key=context.route.key,
                        route_title=context.route.title,
                        recommended_product_id=context.recommended_product.id,
                        status="skipped",
                        storage_path=str(existing.storage_path or "").strip() or None,
                        model=str(existing.model or "").strip() or None,
                    )
                )
                _emit(
                    event_callback,
                    {
                        "step": "selection_result_skip",
                        "category": target_category,
                        "index": idx,
                        "total": total,
                        "answers_hash": context.answers_hash,
                        "text": f"[{idx}/{total}] 跳过（仅缺失模式且已有结果）：{target_category} / {context.answers_hash}",
                    },
                )
                continue

            if (
                existing is not None
                and str(existing.status or "").strip().lower() == "ready"
                and storage_ready
                and not force_regenerate
                and str(existing.fingerprint or "").strip() == fingerprint
            ):
                skipped += 1
                items.append(
                    MobileSelectionResultBuildItem(
                        category=target_category,
                        answers_hash=context.answers_hash,
                        route_key=context.route.key,
                        route_title=context.route.title,
                        recommended_product_id=context.recommended_product.id,
                        status="skipped",
                        storage_path=str(existing.storage_path or "").strip() or None,
                        model=str(existing.model or "").strip() or None,
                    )
                )
                _emit(
                    event_callback,
                    {
                        "step": "selection_result_skip",
                        "category": target_category,
                        "index": idx,
                        "total": total,
                        "answers_hash": context.answers_hash,
                        "text": f"[{idx}/{total}] 跳过（指纹未变化）：{target_category} / {context.answers_hash}",
                    },
                )
                continue

            _emit(
                event_callback,
                {
                    "step": "selection_result_start",
                    "category": target_category,
                    "index": idx,
                    "total": total,
                    "answers_hash": context.answers_hash,
                    "text": f"[{idx}/{total}] 开始生成：{target_category} / {context.answers_hash}",
                },
            )
            submitted_to_model += 1
            ai_result = run_capability_now(
                capability=prompt_key,
                input_payload={
                    "selection_result_context_json": json.dumps(context.model_dump(mode="json"), ensure_ascii=False),
                },
                trace_id=context.answers_hash,
                event_callback=lambda event, _cat=target_category, _hash=context.answers_hash: _forward_selection_result_model_event(
                    event_callback=event_callback,
                    category=_cat,
                    answers_hash=_hash,
                    payload=event,
                ),
            )
            content_payload = {
                key: value
                for key, value in ai_result.items()
                if key not in {"model", "artifact"}
            }
            content = MobileSelectionResultAIContent.model_validate(content_payload)
            _published, rec = publish_mobile_selection_result(
                db=db,
                category=target_category,
                answers_hash=context.answers_hash,
                rules_version=context.rules_version,
                route=context.route,
                recommendation_source=context.recommendation_source,
                recommended_product=context.recommended_product,
                links=MobileSelectionLinks(
                    product=f"/product/{context.recommended_product.id}",
                    wiki=f"/m/wiki/{target_category}" if not context.route.key else (
                        f"/m/wiki/{target_category}?focus={context.route.key}" if target_category == "shampoo" else f"/m/wiki/{target_category}"
                    ),
                ),
                schema_version=content.schema_version,
                renderer_variant=content.renderer_variant,
                micro_summary=content.micro_summary,
                share_copy=MobileSelectionResultShareCopy.model_validate(content.share_copy.model_dump(mode="json")),
                blocks=list(content.blocks),
                ctas=list(content.ctas),
                display_order=list(content.display_order),
                fingerprint=fingerprint,
                raw_payload={
                    "context": context.model_dump(mode="json"),
                    "generated": content.model_dump(mode="json"),
                },
                prompt_key=prompt_key,
                prompt_version=prompt_version,
                model=str(ai_result.get("model") or "").strip(),
                refresh_reason="selection_result_build",
            )

            status = "updated" if existing is not None else "created"
            if status == "updated":
                updated += 1
            else:
                created += 1
            items.append(
                MobileSelectionResultBuildItem(
                    category=target_category,
                    answers_hash=context.answers_hash,
                    route_key=context.route.key,
                    route_title=context.route.title,
                    recommended_product_id=context.recommended_product.id,
                    status=status,
                    storage_path=str(rec.storage_path or "").strip() or None,
                    model=str(ai_result.get("model") or "").strip() or None,
                )
            )
            _emit(
                event_callback,
                {
                    "step": "selection_result_done",
                    "category": target_category,
                    "index": idx,
                    "total": total,
                    "answers_hash": context.answers_hash,
                    "status": status,
                    "submitted_to_model": submitted_to_model,
                    "created": created,
                    "updated": updated,
                    "skipped": skipped,
                    "failed": failed,
                    "text": f"[{idx}/{total}] 完成：{target_category} / {context.route.title} / {status}",
                },
            )
        except SelectionResultBuildCancelledError:
            raise
        except Exception as exc:
            message = f"{target_category}:{answers} | {exc}"
            failed += 1
            failures.append(message)
            try:
                answers_hash = _build_answers_hash(target_category, answers)
            except Exception:
                answers_hash = hashlib.sha1(
                    json.dumps({"category": target_category, "answers": answers}, ensure_ascii=False, sort_keys=True).encode("utf-8")
                ).hexdigest()
            items.append(
                MobileSelectionResultBuildItem(
                    category=target_category,
                    answers_hash=answers_hash,
                    status="failed",
                    error=str(exc),
                )
            )
            _emit(
                event_callback,
                {
                    "step": "selection_result_error",
                    "category": target_category,
                    "index": idx,
                    "total": total,
                    "answers_hash": answers_hash,
                    "failed": failed,
                    "text": f"[{idx}/{total}] 失败：{target_category} / {answers_hash} | {exc}",
                },
            )

    result = MobileSelectionResultBuildResponse(
        status="ok" if failed == 0 else "partial_ok",
        scanned_scenarios=total,
        submitted_to_model=submitted_to_model,
        created=created,
        updated=updated,
        skipped=skipped,
        failed=failed,
        items=items,
        failures=failures,
    )
    _emit(
        event_callback,
        {
            "step": "selection_result_build_done",
            "scanned_products": total,
            "submitted_to_model": submitted_to_model,
            "created": created,
            "updated": updated,
            "skipped": skipped,
            "failed": failed,
            "text": (
                f"Selection result 构建完成：scenarios={total}，created={created}，"
                f"updated={updated}，skipped={skipped}，failed={failed}"
            ),
        },
    )
    return result


def _build_selection_result_context(
    *,
    db: Session,
    category: str,
    answers: dict[str, str],
) -> MobileSelectionResultContextPayload:
    resolved = _resolve_selection(category=category, answers=answers)
    answers_hash = _build_answers_hash(category=category, answers=resolved["answers"])
    product_row, recommendation_source = _resolve_selection_product_row(
        db=db,
        category=category,
        route_key=str(resolved["route_key"]),
    )
    recommended_product = _row_to_product_card(product_row)
    analysis = _load_ready_product_analysis_result(db=db, product_id=recommended_product.id)
    return MobileSelectionResultContextPayload(
        category=category,
        category_label=CATEGORY_LABELS_ZH.get(category, category),
        answers_hash=answers_hash,
        rules_version=MOBILE_RULES_VERSION,
        answers=dict(resolved["answers"]),
        choices=[MobileSelectionChoice.model_validate(item) for item in resolved["choices"]],
        route=MobileSelectionRoute(key=str(resolved["route_key"]), title=str(resolved["route_title"])),
        matrix_analysis=MobileSelectionMatrixAnalysis.model_validate(resolved["matrix_analysis"]),
        recommendation_source=recommendation_source,
        recommended_product=recommended_product,
        product_analysis_summary=_to_product_analysis_summary(analysis),
        ingredient_snapshot=_to_ingredient_snapshot(analysis),
        product_analysis_fingerprint=(str(analysis.fingerprint or "").strip() or None) if analysis else None,
    )


def _to_product_analysis_summary(analysis: Any) -> MobileSelectionResultProductAnalysisSummary | None:
    if analysis is None:
        return None
    profile = analysis.profile
    return MobileSelectionResultProductAnalysisSummary(
        schema_version=str(profile.schema_version or "").strip(),
        headline=str(profile.headline or "").strip(),
        positioning_summary=str(profile.positioning_summary or "").strip(),
        subtype_fit_verdict=str(profile.subtype_fit_verdict or "").strip(),
        subtype_fit_reason=str(profile.subtype_fit_reason or "").strip(),
        best_for=list(profile.best_for or []),
        not_ideal_for=list(profile.not_ideal_for or []),
        usage_tips=list(profile.usage_tips or []),
        watchouts=list(profile.watchouts or []),
        confidence=int(profile.confidence or 0),
        confidence_reason=str(profile.confidence_reason or "").strip(),
        needs_review=bool(profile.needs_review),
        evidence_missing_codes=list(profile.evidence.missing_codes or []),
    )


def _to_ingredient_snapshot(analysis: Any) -> list[MobileSelectionResultIngredientSnapshotItem]:
    if analysis is None:
        return []
    items: list[MobileSelectionResultIngredientSnapshotItem] = []
    for ingredient in list(analysis.profile.key_ingredients or [])[:6]:
        items.append(
            MobileSelectionResultIngredientSnapshotItem(
                ingredient_name_cn=str(ingredient.ingredient_name_cn or "").strip(),
                ingredient_name_en=str(ingredient.ingredient_name_en or "").strip(),
                rank=int(ingredient.rank or 0),
                role=str(ingredient.role or "").strip(),
                impact=str(ingredient.impact or "").strip(),
            )
        )
    return items


def _enumerate_selection_answers(category: str) -> list[dict[str, str]]:
    config, _route_titles, _wiki_href = _selection_matrix_assets(category)
    out: list[dict[str, str]] = []
    working: dict[str, str] = {}
    questions = list(config.questions)

    def walk(index: int) -> None:
        if index >= len(questions):
            out.append(dict(working))
            return
        question = questions[index]
        if not _question_required(question, working):
            walk(index + 1)
            return
        for option_key in question.options.keys():
            working[question.key] = option_key
            walk(index + 1)
        working.pop(question.key, None)

    walk(0)
    return out


def _question_required(question: MatrixQuestion, answers: dict[str, str]) -> bool:
    required_when = str(question.required_when or "").strip()
    if not required_when:
        return True
    return _evaluate_trigger(required_when, answers)


def _load_existing_selection_result_index(
    *,
    db: Session,
    category: str,
    answers_hash: str,
) -> MobileSelectionResultIndex | None:
    return (
        db.execute(
            select(MobileSelectionResultIndex)
            .where(MobileSelectionResultIndex.category == category)
            .where(MobileSelectionResultIndex.rules_version == MOBILE_RULES_VERSION)
            .where(MobileSelectionResultIndex.answers_hash == answers_hash)
            .limit(1)
        )
        .scalars()
        .first()
    )


def _build_selection_result_fingerprint(
    *,
    context: MobileSelectionResultContextPayload,
    prompt_key: str,
    prompt_version: str,
    renderer_variant: str,
) -> str:
    canonical = {
        "context": context.model_dump(mode="json"),
        "prompt_key": prompt_key,
        "prompt_version": prompt_version,
        "renderer_variant": renderer_variant,
    }
    return hashlib.sha1(json.dumps(canonical, ensure_ascii=False, sort_keys=True).encode("utf-8")).hexdigest()


def _forward_selection_result_model_event(
    *,
    event_callback: Callable[[dict[str, Any]], None] | None,
    category: str,
    answers_hash: str,
    payload: dict[str, Any],
) -> None:
    event_type = str(payload.get("type") or "").strip()
    if event_type == "delta":
        delta = str(payload.get("delta") or "")
        if not delta:
            return
        _emit(
            event_callback,
            {
                "step": "selection_result_model_delta",
                "category": category,
                "answers_hash": answers_hash,
                "delta": delta,
                "text": delta,
            },
        )
        return
    if event_type != "step":
        return
    message = str(payload.get("message") or "").strip()
    if not message:
        return
    _emit(
        event_callback,
        {
            "step": "selection_result_model_step",
            "category": category,
            "answers_hash": answers_hash,
            "text": f"{answers_hash} | {message}",
        },
    )


def _emit(event_callback: Callable[[dict[str, Any]], None] | None, payload: dict[str, Any]) -> None:
    if event_callback is not None:
        event_callback(payload)


def _check_cancel(should_cancel: Callable[[], bool] | None) -> None:
    if should_cancel and should_cancel():
        raise SelectionResultBuildCancelledError("selection result build cancelled by operator.")
