from __future__ import annotations

from dataclasses import dataclass
import re
from typing import Any, Mapping


MASKED_SCORE = -10**9
_TRIGGER_CLAUSE_RE = re.compile(
    r"""^\s*(?P<key>[A-Za-z_][A-Za-z0-9_]*)\s*==\s*(?P<quote>['"])(?P<value>[^'"]+)(?P=quote)\s*$"""
)


class MatrixDecisionError(ValueError):
    """Raised when matrix config or user answers are invalid."""


@dataclass(frozen=True)
class MatrixQuestion:
    key: str
    title: str
    options: dict[str, str]
    required_when: str | None = None


@dataclass(frozen=True)
class MatrixVetoMask:
    trigger: str
    mask: tuple[int, ...]
    note: str


@dataclass(frozen=True)
class MatrixDecisionConfig:
    category: str
    categories: tuple[str, ...]
    questions: tuple[MatrixQuestion, ...]
    scoring_matrix: dict[str, dict[str, tuple[int, ...]]]
    veto_masks: tuple[MatrixVetoMask, ...]


@dataclass(frozen=True)
class TriggeredVeto:
    trigger: str
    note: str
    excluded_categories: tuple[str, ...]


@dataclass(frozen=True)
class MatrixDecisionResult:
    normalized_answers: dict[str, str]
    scores_before_mask: dict[str, int]
    scores_after_mask: dict[str, int]
    question_contributions: dict[str, dict[str, int]]
    triggered_vetoes: tuple[TriggeredVeto, ...]
    excluded_categories: tuple[str, ...]
    best_category: str
    top2: tuple[tuple[str, int], ...]


def compile_matrix_config(raw: Mapping[str, Any]) -> MatrixDecisionConfig:
    if not isinstance(raw, Mapping):
        raise MatrixDecisionError("matrix config must be an object.")

    category = str(raw.get("category") or "").strip().lower()
    if not category:
        raise MatrixDecisionError("matrix config category is required.")

    raw_categories = raw.get("categories")
    if not isinstance(raw_categories, list) or not raw_categories:
        raise MatrixDecisionError("matrix config categories must be a non-empty list.")
    categories: list[str] = []
    seen_categories: set[str] = set()
    for idx, item in enumerate(raw_categories):
        name = str(item or "").strip()
        if not name:
            raise MatrixDecisionError(f"matrix categories[{idx}] is empty.")
        if name in seen_categories:
            raise MatrixDecisionError(f"matrix categories has duplicate value '{name}'.")
        seen_categories.add(name)
        categories.append(name)

    raw_questions = raw.get("questions")
    if not isinstance(raw_questions, list) or not raw_questions:
        raise MatrixDecisionError("matrix config questions must be a non-empty list.")

    questions: list[MatrixQuestion] = []
    seen_question_keys: set[str] = set()
    for idx, item in enumerate(raw_questions):
        if not isinstance(item, Mapping):
            raise MatrixDecisionError(f"matrix questions[{idx}] must be an object.")
        key = str(item.get("key") or "").strip()
        title = str(item.get("title") or "").strip() or key
        raw_options = item.get("options")
        if not key:
            raise MatrixDecisionError(f"matrix questions[{idx}].key is required.")
        if key in seen_question_keys:
            raise MatrixDecisionError(f"matrix questions has duplicate key '{key}'.")
        if not isinstance(raw_options, Mapping) or not raw_options:
            raise MatrixDecisionError(f"matrix questions[{idx}].options must be a non-empty object.")
        options: dict[str, str] = {}
        for raw_opt_key, raw_opt_label in raw_options.items():
            opt_key = str(raw_opt_key or "").strip()
            opt_label = str(raw_opt_label or "").strip()
            if not opt_key or not opt_label:
                raise MatrixDecisionError(f"matrix questions[{idx}] has empty option key/label.")
            options[opt_key] = opt_label
        required_when = str(item.get("required_when") or "").strip() or None
        if required_when:
            _validate_trigger(required_when)
        questions.append(MatrixQuestion(key=key, title=title, options=options, required_when=required_when))
        seen_question_keys.add(key)

    raw_scoring_matrix = raw.get("scoring_matrix")
    if not isinstance(raw_scoring_matrix, Mapping):
        raise MatrixDecisionError("matrix scoring_matrix must be an object.")

    scoring_matrix: dict[str, dict[str, tuple[int, ...]]] = {}
    category_len = len(categories)
    for question in questions:
        raw_answers = raw_scoring_matrix.get(question.key)
        if not isinstance(raw_answers, Mapping) or not raw_answers:
            raise MatrixDecisionError(f"matrix scoring_matrix missing question '{question.key}'.")
        answer_weights: dict[str, tuple[int, ...]] = {}
        for option_key in question.options:
            raw_weights = raw_answers.get(option_key)
            if not isinstance(raw_weights, list) or len(raw_weights) != category_len:
                raise MatrixDecisionError(
                    f"matrix scoring_matrix[{question.key}][{option_key}] must have {category_len} numbers."
                )
            normalized_weights: list[int] = []
            for weight in raw_weights:
                try:
                    normalized_weights.append(int(weight))
                except Exception as exc:
                    raise MatrixDecisionError(
                        f"matrix scoring_matrix[{question.key}][{option_key}] contains non-integer weight."
                    ) from exc
            answer_weights[option_key] = tuple(normalized_weights)
        scoring_matrix[question.key] = answer_weights

    raw_veto_masks = raw.get("veto_masks")
    if raw_veto_masks is None:
        raw_veto_masks = []
    if not isinstance(raw_veto_masks, list):
        raise MatrixDecisionError("matrix veto_masks must be a list.")

    veto_masks: list[MatrixVetoMask] = []
    for idx, item in enumerate(raw_veto_masks):
        if not isinstance(item, Mapping):
            raise MatrixDecisionError(f"matrix veto_masks[{idx}] must be an object.")
        trigger = str(item.get("trigger") or "").strip()
        note = str(item.get("note") or "").strip()
        raw_mask = item.get("mask")
        if not trigger:
            raise MatrixDecisionError(f"matrix veto_masks[{idx}].trigger is required.")
        if not isinstance(raw_mask, list) or len(raw_mask) != category_len:
            raise MatrixDecisionError(f"matrix veto_masks[{idx}].mask must have {category_len} values.")
        _validate_trigger(trigger)
        normalized_mask: list[int] = []
        for raw_value in raw_mask:
            try:
                mask_value = int(raw_value)
            except Exception as exc:
                raise MatrixDecisionError(f"matrix veto_masks[{idx}].mask contains non-integer value.") from exc
            if mask_value not in {0, 1}:
                raise MatrixDecisionError(f"matrix veto_masks[{idx}].mask only supports 0/1 values.")
            normalized_mask.append(mask_value)
        veto_masks.append(MatrixVetoMask(trigger=trigger, mask=tuple(normalized_mask), note=note))

    return MatrixDecisionConfig(
        category=category,
        categories=tuple(categories),
        questions=tuple(questions),
        scoring_matrix=scoring_matrix,
        veto_masks=tuple(veto_masks),
    )


def resolve_matrix_selection(
    config: MatrixDecisionConfig,
    raw_answers: Mapping[str, Any],
) -> MatrixDecisionResult:
    normalized_answers = _normalize_answers(raw_answers)
    _validate_answers(config, normalized_answers)
    question_keys = {question.key for question in config.questions}
    filtered_answers = {key: value for key, value in normalized_answers.items() if key in question_keys}

    scores: dict[str, int] = {category: 0 for category in config.categories}
    contributions: dict[str, dict[str, int]] = {}

    for question in config.questions:
        answer = filtered_answers.get(question.key)
        if not answer:
            continue
        weights = config.scoring_matrix[question.key][answer]
        delta_map: dict[str, int] = {}
        for idx, category in enumerate(config.categories):
            delta = int(weights[idx])
            scores[category] += delta
            delta_map[category] = delta
        contributions[question.key] = delta_map

    scores_before_mask = dict(scores)

    excluded_categories: set[str] = set()
    triggered_vetoes: list[TriggeredVeto] = []
    for veto in config.veto_masks:
        if not _evaluate_trigger(veto.trigger, filtered_answers):
            continue
        excluded: list[str] = []
        for idx, category in enumerate(config.categories):
            if int(veto.mask[idx]) == 0:
                excluded_categories.add(category)
                excluded.append(category)
        triggered_vetoes.append(
            TriggeredVeto(
                trigger=veto.trigger,
                note=veto.note,
                excluded_categories=tuple(excluded),
            )
        )

    scores_after_mask = dict(scores_before_mask)
    for category in excluded_categories:
        scores_after_mask[category] = MASKED_SCORE

    ordered_categories = list(config.categories)
    eligible = [category for category in ordered_categories if category not in excluded_categories]
    if not eligible:
        eligible = ordered_categories

    best_category = eligible[0]
    for category in eligible[1:]:
        if scores_after_mask[category] > scores_after_mask[best_category]:
            best_category = category

    order_index = {category: idx for idx, category in enumerate(ordered_categories)}
    ranked = sorted(
        eligible,
        key=lambda category: (-scores_after_mask[category], order_index[category]),
    )
    top2 = tuple((category, int(scores_after_mask[category])) for category in ranked[:2])

    return MatrixDecisionResult(
        normalized_answers=dict(filtered_answers),
        scores_before_mask=scores_before_mask,
        scores_after_mask=scores_after_mask,
        question_contributions=contributions,
        triggered_vetoes=tuple(triggered_vetoes),
        excluded_categories=tuple(sorted(excluded_categories, key=lambda item: order_index[item])),
        best_category=best_category,
        top2=top2,
    )


def _normalize_answers(raw_answers: Mapping[str, Any]) -> dict[str, str]:
    normalized: dict[str, str] = {}
    for raw_key, raw_value in (raw_answers or {}).items():
        key = str(raw_key or "").strip()
        value = str(raw_value or "").strip()
        if not key or not value:
            continue
        normalized[key] = value
    return normalized


def _validate_answers(config: MatrixDecisionConfig, answers: Mapping[str, str]) -> None:
    for question in config.questions:
        required = True
        if question.required_when:
            required = _evaluate_trigger(question.required_when, answers)
        value = answers.get(question.key)
        if required and not value:
            raise MatrixDecisionError(f"Missing answer: {question.key}.")
        if value and value not in question.options:
            raise MatrixDecisionError(f"Invalid answer: {question.key}.")


def _validate_trigger(expression: str) -> None:
    test_answers = {"_dummy_key_": "_dummy_value_"}
    try:
        _evaluate_trigger(expression, test_answers, validate_only=True)
    except MatrixDecisionError:
        raise
    except Exception as exc:
        raise MatrixDecisionError(f"Invalid trigger expression: {expression}") from exc


def _evaluate_trigger(
    expression: str,
    answers: Mapping[str, str],
    *,
    validate_only: bool = False,
) -> bool:
    expr = str(expression or "").strip()
    if not expr:
        return False

    or_parts = re.split(r"\s+OR\s+", expr, flags=re.IGNORECASE)
    for part in or_parts:
        and_parts = re.split(r"\s+AND\s+", part, flags=re.IGNORECASE)
        and_result = True
        for clause in and_parts:
            matched = _TRIGGER_CLAUSE_RE.match(str(clause or "").strip())
            if not matched:
                raise MatrixDecisionError(f"Unsupported trigger clause: {clause}")
            if validate_only:
                continue
            key = str(matched.group("key"))
            value = str(matched.group("value"))
            if str(answers.get(key) or "") != value:
                and_result = False
                break
        if and_result:
            return True
    return False
