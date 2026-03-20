# Mobile Analytics Hub README

## 模块定位
- 路由：`/analytics`
- 角色：管理员内部决策分析台
- 当前阶段：Phase 13 analytics canonical cleanup

## 首屏必须回答的 5 个问题
1. 有多少会话从 `/m` 点击主 CTA 进入主链路（`home_primary_cta_click_sessions`）？
2. 进入 `/m/choose` 后有多少会话点击品类卡直接开始答题（canonical `choose_category_start_click`；summary key 仍为兼容保留的 `choose_start_click_sessions`，并展示 `choose_start_rate_from_choose_view`）？
3. 哪一道题流失最高（`question_dropoff_top` + `question_dropoff_by_category` + `question_dropoff_status`）？
4. 有多少会话成功到达结果页（`result_view_sessions`，并展示 `result_view_rate_from_home_primary_cta`）？
5. 到达结果后有多少会话继续动作：加袋闭环、进入 compare / rationale / retry / switch，以及 utility 回流（canonical `result_add_to_bag_click` + result secondary canonical events + `utility_return_click`；summary keys 仍沿用兼容保留的 `result_primary_cta_click_sessions` / `result_secondary_loop_click_sessions` / `utility_return_click_sessions`）

## question_dropoff 当前状态
- 当 `questionnaire_view(step)` 与 `question_answered(step)` 存在有效数据时，状态为 `live` 并展示 `question_dropoff_top / question_dropoff_by_category`。
- 当当前时间窗没有有效 step 数据时，状态保持 `blocked_until_stepful_questionnaire_view_exists`，且返回空集合/空对象，不伪造兜底统计。

## Phase 13 canonical 事件真值
- first-run funnel：
  - `home_primary_cta_click`
  - `choose_category_start_click`
  - `questionnaire_view(step=1)`
  - `questionnaire_completed`
  - `result_view`
- result closure：
  - `result_add_to_bag_click`
  - `result_compare_entry_click`
  - `result_rationale_entry_click`
  - `result_retry_same_category_click`
  - `result_switch_category_click`
  - `utility_return_click`
- compare closure：
  - `compare_entry_view`
  - `compare_upload_start`
  - `compare_upload_success`
  - `compare_result_view`
  - `compare_result_accept_recommendation`
  - `compare_result_keep_current`
  - `compare_result_hold_current`
  - `compare_result_view_key_differences`
  - `compare_result_open_rationale`
  - `compare_result_retry_current_product`
  - `compare_result_switch_category_click`
  - `compare_result_accept_recommendation_land`
  - `compare_result_keep_current_land`
- rationale closure：
  - `rationale_view`
  - `rationale_to_bag_click`
  - `rationale_to_compare_click`

## compatibility bridge（仅兼容层）
- backend / dashboard summary shape 继续保留旧 key：
  - `choose_start_click_sessions`
  - `result_primary_cta_click_sessions`
  - `result_secondary_loop_click_sessions`
- 这些 key 的真值来源已经切到 canonical events，不再把旧事件当成前端现行真相。
- legacy 事件只允许作为桥接输入：
  - `choose_start_click` -> `choose_category_start_click`
  - `result_primary_cta_click(result_cta=bag_add)` -> `result_add_to_bag_click`
  - `result_secondary_loop_click(result_cta=compare|rationale|retry_same_category|switch_category)` -> 对应 result secondary canonical event
  - `compare_result_cta_click(cta=recommendation_wiki)` -> `compare_result_open_rationale`
  - `compare_result_cta_land(cta=recommendation_product)` -> `compare_result_accept_recommendation_land`

## 使用原则
- 首屏先回答 P0 五问，再展开错误、反馈、环境和会话钻取。
- `compare_result_view` 是 compare closure canonical 事件，但在第一屏 P0 中只作为 supporting context，不冒充 first-run 主 KPI。
- 不把 `compare_result_cta_*` 重新当成主 KPI 或当前真相词表。
- 不把 `home_workspace_quick_action_click` 包装成主结果成功。
- 不把 utility 行为包装成主结果成功。
