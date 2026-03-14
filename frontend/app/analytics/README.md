# Mobile Analytics Hub README

## 模块定位
- 路由：`/analytics`
- 角色：管理员内部决策分析台
- 目标：统一 mobile 决策主链路的经营口径，优先回答每周复盘四问

## 北极星口径
- 首访用户从进入决策链路到 `result_view` 的完成率
- 结果后续动作分两段：
  - `result_primary_cta_click`（主承接动作）
  - `result_secondary_loop_click -> utility_return_click`（回环与回流）

## 每周复盘四问（先答这四个）
1. 本周有多少用户进入主链路？
2. 其中多少用户拿到了结果（`result_view`）？
3. 拿到结果后多少用户继续动作（主 CTA / 次级回环 / 回流）？
4. 最大掉点在首页、choose、分析，还是结果承接？

## 主事件词汇（当前真值）
- `result_view`
- `result_primary_cta_click`
- `result_secondary_loop_click`
- `utility_return_click`

## 兼容事件（仅上下文，不作主 KPI）
- `compare_result_view`
- `compare_result_cta_click`
- `compare_result_cta_land`

说明：
- 兼容事件仅用于历史会话解释和 compare 语境排障。
- 主 KPI 面板不再用兼容事件替代 `result_*` 与 `utility_return_click`。

## 面板分工
- `Overview`
  - 结果到达率、结果主 CTA 点击率、utility 回流率
- `Funnel`
  - 主链路漏斗 + 结果段口径说明（兼容事件显式标注）
- `Experience Signals`
  - 决策结果动作、utility 回环、compare 兼容阅读上下文、体验摩擦信号
- `Session Explorer`
  - 会话时间线 + Journey Summary + 原始事件上下文

## 使用原则
- 不把 utility 行为包装成主结果成功。
- 不把兼容事件当产品真值。
- 先回答四个经营问题，再展开错误、反馈与环境细分。
