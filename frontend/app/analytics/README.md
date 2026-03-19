# Mobile Analytics Hub README

## 模块定位
- 路由：`/analytics`
- 角色：管理员内部决策分析台
- 当前阶段：Phase 12 result decision closure analytics 对齐

## 首屏必须回答的 5 个问题
1. 有多少会话从 `/m` 点击主 CTA 进入主链路（`home_primary_cta_click_sessions`）？
2. 进入 `/m/choose` 后有多少会话开始答题（`choose_start_click_sessions`，并展示 `choose_start_rate_from_choose_view`）？
3. 哪一道题流失最高（`question_dropoff_top` + `question_dropoff_by_category` + `question_dropoff_status`）？
4. 有多少会话成功到达结果页（`result_view_sessions`，并展示 `result_view_rate_from_home_primary_cta`）？
5. 到达结果后有多少会话继续动作（`result_primary_cta_click_sessions` + `result_secondary_loop_click_sessions` + `utility_return_click_sessions`）？

## question_dropoff 当前状态
- 当 `questionnaire_view(step)` 与 `question_answered(step)` 存在有效数据时，状态为 `live` 并展示 `question_dropoff_top / question_dropoff_by_category`。
- 当当前时间窗没有有效 step 数据时，状态保持 `blocked_until_stepful_questionnaire_view_exists`，且返回空集合/空对象，不伪造兜底统计。

## 主 KPI 事件真值
- `home_primary_cta_click`
- `choose_view`
- `choose_start_click`
- `questionnaire_completed`
- `result_view`
- `result_primary_cta_click`
- `result_secondary_loop_click`
- `utility_return_click`

## Phase 10 意图观测（不新增 result event family）
- 不新增 `result_add_to_bag_click / result_compare_entry_click / result_rationale_entry_click / result_retry_same_category_click / result_switch_category_click` 这类第二套结果事件名。
- 继续使用既有结果事件族，通过以下 props 暴露意图：
  - `result_cta`
  - `action`
  - `target_path`
- 当前冻结词表（`result_cta`）：
  - `bag_add`
  - `compare`
  - `rationale`
  - `retry_same_category`
  - `switch_category`

## supporting context（非主结果成功叙事）
- `home_workspace_quick_action_click`
- `compare_result_view`
- `compare_result_cta_click`
- `compare_result_cta_land`

## Phase 12 closure 事件（compare / rationale 专用）
- `compare_result_accept_recommendation`
- `compare_result_keep_current`
- `compare_result_retry_current_product`
- `compare_result_switch_category_click`
- `rationale_view`
- `rationale_to_bag_click`
- `rationale_to_compare_click`

说明：
- 这批事件用于表达 closure 结果，不替代 phase-10 result 主事件族。
- compare 的 closure success 包含两类：
  - 接受推荐
  - 保留当前

## 使用原则
- 首屏先回答 P0 五问，再展开错误、反馈、环境和会话钻取。
- 不把 `compare_result_view`、`compare_result_cta_*` 重新当成主 KPI。
- 不把 `home_workspace_quick_action_click` 包装成主结果成功。
- 不把 utility 行为包装成主结果成功。
