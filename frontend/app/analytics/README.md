# Mobile Analytics Hub README

## 模块定位
- 路由：`/analytics`
- 角色：管理员内部决策分析台
- 当前阶段：Phase 5 P0 contract 首屏落地

## 首屏必须回答的 5 个问题
1. 有多少会话从 `/m` 点击主 CTA 进入主链路（`home_primary_cta_click_sessions`）？
2. 进入 `/m/choose` 后有多少会话开始答题（`choose_start_click_sessions`，并展示 `choose_start_rate_from_choose_view`）？
3. 哪一道题流失最高（`question_dropoff`）？
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

## 兼容事件（仅 supporting context）
- `compare_result_view`
- `compare_result_cta_click`
- `compare_result_cta_land`

## 使用原则
- 首屏先回答 P0 五问，再展开错误、反馈、环境和会话钻取。
- 不把 `compare_result_view`、`profile_result_view` 重新当成主 KPI。
- 不把 utility 行为包装成主结果成功。
