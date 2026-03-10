import json
import itertools
from collections import Counter


def eval_trigger(trigger_str, answers):
    """
    轻量级 Trigger 解析器
    将 JSON 中的 "q1 == 'A' OR q2 == 'B'" 转化为 Python 可执行语句
    """
    eval_str = trigger_str
    # 替换逻辑运算符
    eval_str = eval_str.replace(" OR ", " or ").replace(" AND ", " and ")

    # 将变量替换为用户的实际选项
    for key, val in answers.items():
        # 为了避免误伤子串，确保替换的是独立的变量名
        eval_str = eval_str.replace(key, f"'{val}'")

    try:
        return eval(eval_str)
    except Exception as e:
        print(f"Trigger解析错误: {trigger_str} -> {eval_str} | Error: {e}")
        return False


def calculate_best_match(user_answers, config):
    """核心矩阵打分与掩码引擎"""
    categories = config["categories"]
    scoring_matrix = config["scoring_matrix"]
    veto_masks = config["veto_masks"]

    # 1. 初始化分数
    scores = {cat: 0 for cat in categories}

    # 2. 矩阵加权求和
    for q_key, q_val in user_answers.items():
        if q_key in scoring_matrix and q_val in scoring_matrix[q_key]:
            weights = scoring_matrix[q_key][q_val]
            for i, cat in enumerate(categories):
                scores[cat] += weights[i]

    # 3. 掩码强杀防线
    for veto in veto_masks:
        if eval_trigger(veto["trigger"], user_answers):
            mask = veto["mask"]
            for i, cat in enumerate(categories):
                scores[cat] *= mask[i]

    # 4. 选出最高分 (遇同分默认取第一个，真实环境可引入Tie-breaker)
    best_match = max(scores, key=scores.get)
    return best_match


def run_exhaustive_tests(json_file="rules.json"):
    print("=" * 60)
    print("🚀 Match Up (予选) - 决策矩阵全量穷举推演启动")
    print("=" * 60)

    with open(json_file, "r", encoding="utf-8") as f:
        configs = json.load(f)

    for config in configs:
        cat_name = config["category"]
        questions = config["questions"]

        # 提取所有问题的 Keys 和 选项列表
        q_keys = [q["key"] for q in questions]
        options_list = [list(q["options"].keys()) for q in questions]

        # 笛卡尔积：生成所有可能的问卷组合
        all_combinations = list(itertools.product(*options_list))
        total_cases = len(all_combinations)

        print(f"\n📦 品类: {cat_name.upper()} | 维度总数: {len(questions)} | 穷举组合总数: {total_cases} 种")

        results = []
        for combo in all_combinations:
            answers = dict(zip(q_keys, combo))
            best_cat = calculate_best_match(answers, config)
            results.append(best_cat)

        # 统计分布结果
        distribution = Counter(results)
        print("-" * 40)
        print("📊 理论流量命中率分布 (如果各选项被点击概率均等):")
        for cat in config["categories"]:
            hits = distribution.get(cat, 0)
            percentage = (hits / total_cases) * 100

            # 用直观的柱状图在终端展示
            bar = "█" * int(percentage / 2)
            warning = " ⚠️ [流量枯竭]" if percentage < 2.0 else ""
            monopoly = " 🚨 [流量垄断]" if percentage > 40.0 else ""

            print(f"  {cat:<20}: {percentage:>5.1f}% | {bar}{warning}{monopoly}")


if __name__ == "__main__":
    # 请确保同级目录下有 rules.json
    run_exhaustive_tests()
