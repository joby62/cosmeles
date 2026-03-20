# Mobile First-Run And Compare Closure Rollout

## 1. 文档定位
- 本文是以下 3 份产品文档的统一 owner rollout freeze：
  - [Mobile First-Run Funnel Execution Spec v1](../product/mobile-first-run-funnel-execution-spec-v1.md)
  - [Mobile Result Decision Closure Spec v1](../product/mobile-result-decision-closure-spec-v1.md)
  - [Mobile Compare Result Page Spec v1](../product/mobile-compare-result-page-spec-v1.md)
- phase-13 的目标不是继续补零散小洞，而是把这 3 份文档收成一套能落主线的统一执行口径。
- 本轮唯一 freeze 文档就是本文。
- phase-10 的 analytics 口径从现在开始不再作为执行真相；若需兼容旧 dashboard，只允许通过桥接映射兼容，不能继续作为前端新发射口径。
- 当前补丁轮只补 3 件事：
  - compare result 裁决化
  - keep-current / hybrid closure
  - phase-13 analytics canonical cleanup

## 2. 这轮要解决什么
- phase-13 第一轮已经把这些基础面基本收到了可接受状态：
  - `/m` 新用户首页主 CTA 化
  - `/m/choose` 整卡直达
  - result -> compare 在已有在用品时优先直达裁决
- 当前仍未达标、且本补丁轮必须补完的只有 3 类阻塞：
  - compare result 仍保留内部判断信息外溢，页面角色仍偏长内容展厅
  - keep-current / hybrid 还没有形成稳定 closure success，尤其是 `history_product`
  - analytics 仍残留 phase-10 / phase-12 叙事与 legacy fallback，需要切到 phase-13 canonical truth

## 3. Owner 冻结结论

### 3.1 `/m` 首访规则
- 新用户首页只保留一个主 CTA：`开始测配`
- 新用户首页不再保留：
  - `先查产品或成分`
  - compare / wiki / me / bag 任意 utility 可点击入口
  - “为了完整”保留的弱导航
- 老用户首页继续作为 workspace，但动作优先级冻结为：
  1. `继续上次进度`
  2. `回看上次结果`
  3. `和当前在用做对比`
  4. 其他快捷动作
- 本补丁轮不再继续改 `/m` 首页，只把它视为已通过的前置条件。

### 3.2 `/m/choose` 首轮进入规则
- 品类卡整块点击后必须直接进入对应品类第 1 题
- phase-13 必须删除“选中态 + 开始按钮”双动作
- 顶部恢复卡保留
- `/m/choose` 不增加任何 utility 分流入口
- 本补丁轮不再继续改 `/m/choose`，只把它视为已通过的前置条件。

### 3.3 `/m/[category]/profile`
- 页面只负责答题
- phase-13 不在 profile 里添加 compare / wiki / me / bag 快捷入口

### 3.4 `/m/[category]/result`
- result 顶层 IA 继续保留：
  - 唯一强主按钮：`加入购物袋`
  - 疑虑动作顺序：`和我现在在用的比一下` -> `看为什么推荐这款`
  - 任务切换：`重测这类` -> `测其他品类`
- `回到我的` 仍不允许回到 result 顶层动作
- result 之后的 compare / rationale / retry / switch 继续视为明确任务，不视为“查看更多”

### 3.5 Compare 承接规则
- `result -> compare` 的两条承接必须分开：
  - 已有当前在用品记录：优先直达 compare 裁决结果
  - 没有当前在用品记录：先进入极短上传承接
- compare 裁决完成后必须落到明确决定，不再回 compare 首页
- `keep` 与 `hybrid` 都必须允许“不换”成为正确结论
- `keep` / `hybrid` 的 closure success 都要求写回“我的在用”

### 3.6 Compare Result Page
- compare result 页的产品角色冻结为“换不换裁决页”
- 首屏必须只做：
  - 给 verdict
  - 给一句解释
  - 给当前产品与推荐产品的简化对照
  - 给一个强主 CTA
  - 给一个弱动作：`看关键差异`
- phase-13 必须删除或降级以下内容：
  - `置信度百分比`
  - `历史基线`
  - `route 标题`
  - `再做一次对比`
  - `查看推荐产品`
  - `查看成分百科`
  - 长滚动建议卡
  - `全部内容` 弹层
- compare result 页的动作顺序冻结为：
  1. 主 CTA
  2. `看关键差异`
  3. `看为什么推荐这款`
  4. `换一个当前产品再比`
  5. `回到这次结果`
  6. `测其他品类`
- 本补丁轮只允许改 compare result 本页的裁决结构与动作顺序，不再顺手扩到别的页面。

### 3.7 Rationale
- 继续优先使用 `wiki product detail` 承接 `rationale mode`
- rationale 第一屏必须继续先讲：
  - 为什么适合你
  - 解决什么核心问题
  - 需要注意什么
- rationale 页面必须持续保留：
  - `先加入购物袋`
  - `和我现在在用的比一下`

### 3.8 Analytics 冻结
- phase-13 起，首轮 funnel 与 result closure 的 canonical 事件口径冻结为：
  - `home_primary_cta_click`
  - `choose_category_start_click`
  - `questionnaire_view`
  - `questionnaire_completed`
  - `result_view`
  - `result_add_to_bag_click`
  - `result_compare_entry_click`
  - `result_rationale_entry_click`
  - `result_retry_same_category_click`
  - `result_switch_category_click`
  - `utility_return_click`
- compare canonical 事件口径冻结为：
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
- rationale canonical 事件口径冻结为：
  - `rationale_view`
  - `rationale_to_bag_click`
  - `rationale_to_compare_click`
- 本补丁轮的 analytics cleanup 只做三件事：
  - 去掉 README / dashboard / summary 里的旧 phase 叙事
  - 把 result / compare canonical event 作为一等公民
  - 保留 legacy bridge，但不允许继续把 legacy event 当成前端现行真相

### 3.9 兼容策略
- phase-10 时代的旧事件允许在 dashboard / backend summary 内保留兼容桥接，但不能再继续作为新前端发射口径。
- 如果某个旧指标必须短期继续服务已有 dashboard，Worker A 负责提供 derived mapping，而不是让前端同时发两套真相。

## 4. 这轮不做什么
- 不再继续改 `/m` 首页
- 不再继续改 `/m/choose`
- 不再扩 result 顶层 IA
- 不再改 rationale 页面视觉层
- 不重构整个 compare 算法
- 不重构整个 wiki 系统
- 不扩展 desktop 公开层
- 不在 result 之前重新放开 utility 能力

## 5. 拆工建议

### Worker A
- 只收 analytics 真相：
  - 去掉旧 phase 叙事
  - 处理 legacy metric 到 phase-13 canonical metric 的兼容映射
  - 更新 contract / backend summary / dashboard / tests

### Worker B
- 作为 closure truth owner：
  - 收 keep-current / hybrid 的 write-back 语义
  - 补 `history_product` 的 closure success
  - 收 compare result 到 `/m/me/use` 的完成链路

### Worker C
- 作为 experience owner：
  - 把 compare result 从长内容展厅改成裁决页
  - 调整 compare result 动作顺序
  - 不再为了兼容旧事件保留不该存在的页面结构

## 6. Go / No-Go
- compare result 首屏仍出现 `置信度 / 历史基线 / route 标题`，no-go
- compare result 仍保留 `全部内容` 弹层和长卡片阅读结构，no-go
- `history_product` 的 keep-current / hybrid 仍不能形成 closure success，no-go
- README / dashboard / backend summary 仍继续沿用旧 phase 叙事或旧 result/compare fallback，no-go
