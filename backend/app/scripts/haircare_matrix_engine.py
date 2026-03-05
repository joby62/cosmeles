from __future__ import annotations

import csv
import io
from typing import Any

AnswerMap = dict[str, str]
ScoreMap = dict[str, float]
MatrixConfig = dict[str, Any]


def calculate_best_match(user_answers: AnswerMap, config: MatrixConfig) -> tuple[str, ScoreMap]:
    """
    Generic weighted matrix scoring + veto masks.
    Time complexity: O(N) where N is number of answered questions.
    """
    categories: list[str] = list(config["categories"])
    scoring_matrix: dict[str, dict[str, dict[str, float]]] = config["scoring_matrix"]
    veto_masks: list[dict[str, dict[str, Any]]] = config.get("veto_masks", [])

    scores: ScoreMap = {category: 0.0 for category in categories}

    for question_key, answer_val in user_answers.items():
        if question_key not in scoring_matrix:
            continue
        row = scoring_matrix[question_key]
        if answer_val not in row:
            continue
        weights = row[answer_val]
        for category, points in weights.items():
            if category in scores:
                scores[category] += float(points)

    for veto in veto_masks:
        trigger = veto.get("trigger", {})
        mask = veto.get("mask", {})
        if all(user_answers.get(t_key) == t_val for t_key, t_val in trigger.items()):
            for category, mask_value in mask.items():
                if category in scores:
                    scores[category] *= float(mask_value)

    best_match = categories[0]
    for category in categories[1:]:
        if scores[category] > scores[best_match]:
            best_match = category
    return best_match, scores


SHAMPOO_CONFIG: MatrixConfig = {
    "categories": [
        "deep-oil-control",
        "anti-dandruff-itch",
        "gentle-soothing",
        "anti-hair-loss",
        "moisture-balance",
    ],
    "scoring_matrix": {
        "q1": {
            "A": {
                "deep-oil-control": 15,
                "anti-dandruff-itch": 5,
                "gentle-soothing": -10,
                "anti-hair-loss": 2,
                "moisture-balance": -15,
            },
            "B": {
                "deep-oil-control": -5,
                "anti-dandruff-itch": 0,
                "gentle-soothing": 5,
                "anti-hair-loss": 0,
                "moisture-balance": 5,
            },
            "C": {
                "deep-oil-control": -15,
                "anti-dandruff-itch": -5,
                "gentle-soothing": 10,
                "anti-hair-loss": 0,
                "moisture-balance": 15,
            },
        },
        "q2": {
            "A": {
                "deep-oil-control": 0,
                "anti-dandruff-itch": 30,
                "gentle-soothing": 0,
                "anti-hair-loss": 0,
                "moisture-balance": -10,
            },
            "B": {
                "deep-oil-control": -20,
                "anti-dandruff-itch": -15,
                "gentle-soothing": 30,
                "anti-hair-loss": -10,
                "moisture-balance": 5,
            },
            "C": {
                "deep-oil-control": 5,
                "anti-dandruff-itch": 0,
                "gentle-soothing": 5,
                "anti-hair-loss": 30,
                "moisture-balance": 0,
            },
            "D": {
                "deep-oil-control": 2,
                "anti-dandruff-itch": -15,
                "gentle-soothing": -5,
                "anti-hair-loss": -10,
                "moisture-balance": 5,
            },
        },
        "q3": {
            "A": {
                "deep-oil-control": -5,
                "anti-dandruff-itch": 0,
                "gentle-soothing": 5,
                "anti-hair-loss": 0,
                "moisture-balance": 8,
            },
            "B": {
                "deep-oil-control": 5,
                "anti-dandruff-itch": 0,
                "gentle-soothing": 0,
                "anti-hair-loss": 5,
                "moisture-balance": -5,
            },
            "C": {
                "deep-oil-control": 0,
                "anti-dandruff-itch": 0,
                "gentle-soothing": 0,
                "anti-hair-loss": 0,
                "moisture-balance": 0,
            },
        },
    },
    "veto_masks": [
        {"trigger": {"q2": "B"}, "mask": {"deep-oil-control": 0, "anti-dandruff-itch": 0}},
        {"trigger": {"q2": "A"}, "mask": {"moisture-balance": 0}},
        {"trigger": {"q1": "C"}, "mask": {"deep-oil-control": 0}},
    ],
}

CONDITIONER_CONFIG: MatrixConfig = {
    "categories": ["c-color-lock", "c-airy-light", "c-structure-rebuild", "c-smooth-frizz", "c-basic-hydrate"],
    "scoring_matrix": {
        "c_q1": {
            "A": {
                "c-color-lock": 0,
                "c-airy-light": -5,
                "c-structure-rebuild": 20,
                "c-smooth-frizz": 10,
                "c-basic-hydrate": -10,
            },
            "B": {
                "c-color-lock": 0,
                "c-airy-light": 5,
                "c-structure-rebuild": 5,
                "c-smooth-frizz": 5,
                "c-basic-hydrate": 10,
            },
            "C": {
                "c-color-lock": 0,
                "c-airy-light": 10,
                "c-structure-rebuild": -15,
                "c-smooth-frizz": -5,
                "c-basic-hydrate": 15,
            },
        },
        "c_q2": {
            "A": {
                "c-color-lock": 0,
                "c-airy-light": 25,
                "c-structure-rebuild": 5,
                "c-smooth-frizz": -20,
                "c-basic-hydrate": 5,
            },
            "B": {
                "c-color-lock": 0,
                "c-airy-light": -15,
                "c-structure-rebuild": 10,
                "c-smooth-frizz": 25,
                "c-basic-hydrate": -5,
            },
            "C": {
                "c-color-lock": 0,
                "c-airy-light": 5,
                "c-structure-rebuild": 0,
                "c-smooth-frizz": 5,
                "c-basic-hydrate": 5,
            },
        },
        "c_q3": {
            "A": {
                "c-color-lock": 40,
                "c-airy-light": 0,
                "c-structure-rebuild": 5,
                "c-smooth-frizz": 0,
                "c-basic-hydrate": 0,
            },
            "B": {
                "c-color-lock": 0,
                "c-airy-light": -10,
                "c-structure-rebuild": 5,
                "c-smooth-frizz": 20,
                "c-basic-hydrate": 5,
            },
            "C": {
                "c-color-lock": 0,
                "c-airy-light": 10,
                "c-structure-rebuild": 0,
                "c-smooth-frizz": -5,
                "c-basic-hydrate": 10,
            },
        },
    },
    "veto_masks": [
        {"trigger": {"c_q2": "A"}, "mask": {"c-smooth-frizz": 0}},
        {"trigger": {"c_q1": "C"}, "mask": {"c-structure-rebuild": 0}},
    ],
}

CSV_TEST_DATA = """test_id,desc,q1,q2,q3,c_q1,c_q2,c_q3,exp_shampoo,exp_conditioner
1,classic commuter oily scalp,A,D,C,C,C,C,deep-oil-control,c-basic-hydrate
2,regularly styled routine,B,D,A,A,C,C,moisture-balance,c-structure-rebuild
3,naturally fine flat hair,A,D,B,B,A,C,deep-oil-control,c-airy-light
4,natural frizz curls,C,D,C,B,B,B,moisture-balance,c-smooth-frizz
5,seasonal mild dandruff,B,A,C,C,C,C,anti-dandruff-itch,c-basic-hydrate
6,recently dyed fresh color,B,D,A,B,C,A,moisture-balance,c-color-lock"""


def run_tests(csv_text: str = CSV_TEST_DATA) -> tuple[int, int]:
    print("=" * 60)
    print("Haircare Matrix Engine Test Run")
    print("=" * 60)

    reader = csv.DictReader(io.StringIO(csv_text))
    passed_tests = 0
    total_tests = 0

    for row in reader:
        total_tests += 1
        test_id = row["test_id"]
        desc = row["desc"]

        shampoo_input: AnswerMap = {"q1": row["q1"], "q2": row["q2"], "q3": row["q3"]}
        conditioner_input: AnswerMap = {"c_q1": row["c_q1"], "c_q2": row["c_q2"], "c_q3": row["c_q3"]}

        shampoo_result, shampoo_scores = calculate_best_match(shampoo_input, SHAMPOO_CONFIG)
        conditioner_result, conditioner_scores = calculate_best_match(conditioner_input, CONDITIONER_CONFIG)

        shampoo_ok = shampoo_result == row["exp_shampoo"]
        conditioner_ok = conditioner_result == row["exp_conditioner"]
        both_ok = shampoo_ok and conditioner_ok
        if both_ok:
            passed_tests += 1

        status = "PASS" if both_ok else "FAIL"
        print(f"\n[{status}] Case {test_id}: {desc}")
        print(f"  Shampoo expected: {row['exp_shampoo']} | actual: {shampoo_result}")
        shampoo_top2 = sorted(shampoo_scores.items(), key=lambda item: item[1], reverse=True)[:2]
        print(f"  Shampoo score top2: {shampoo_top2}")
        print(f"  Conditioner expected: {row['exp_conditioner']} | actual: {conditioner_result}")
        conditioner_top2 = sorted(conditioner_scores.items(), key=lambda item: item[1], reverse=True)[:2]
        print(f"  Conditioner score top2: {conditioner_top2}")

    accuracy = (passed_tests / total_tests * 100.0) if total_tests else 0.0
    print("\n" + "=" * 60)
    print(f"Summary: {passed_tests}/{total_tests} passed | accuracy: {accuracy:.1f}%")
    print("=" * 60)
    return passed_tests, total_tests


if __name__ == "__main__":
    run_tests()
