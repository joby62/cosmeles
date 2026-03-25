---
doc_id: mobile-result-decision-closure-spec-v1
title: Mobile Result Decision Closure Spec v1
doc_type: spec
initiative: mobile
workstream: product
owner: product-owner
status: in_execution
priority: p0
created_at: 2026-03-19
updated_at: 2026-03-24
phase: phase-13
started_at: 2026-03-19
frozen_at: 2026-03-19
related_docs:
  - mobile-decision-prd-v1
  - mobile-result-intent-routing-prd-v1
  - mobile-compare-result-page-spec-v1
  - mobile-first-run-and-compare-closure-rollout
related_assignments:
  - phase-12-worker-a
  - phase-12-worker-b
  - phase-12-worker-c
  - phase-13-worker-a
  - phase-13-worker-b
  - phase-13-worker-c
---

# Mobile Result Decision Closure Spec v1

## 1. 文档信息
- 文档名称：Mobile Result Decision Closure Spec v1
- 适用范围：
  - `/m/[category]/result`
  - `/m/compare`
  - `/m/wiki/product/[productId]` 在 `result rationale` 语境下的承接方式
- 关联文档：
  - [Mobile Decision-First PRD v1](./mobile-decision-prd-v1.md)
  - [Mobile Result Intent Routing PRD v1](./mobile-result-intent-routing-prd-v1.md)
  - [Mobile First-Run Funnel Execution Spec v1](./mobile-first-run-funnel-execution-spec-v1.md)
  - [Mobile Compare Result Page Spec v1](./mobile-compare-result-page-spec-v1.md)
- 当前阶段目标：
  - 先把用户从 `result` 页送回一个明确决定
  - 不让 `compare` 和“看依据”变成信息黑洞

## 2. 产品定义

### 2.1 这部分产品是什么
- `result` 页是决策收口页，不是内容分发页。
- `compare` 是“换不换”的裁决页，不是独立工具页。
- “看为什么推荐这款”是推荐依据页，不是百科首页入口。

### 2.2 这部分产品不是什么
- 不是继续阅读页
- 不是功能导航页
- 不是把用户送去看更多内容的中转页
- 不是用来证明系统很完整的展示页

## 3. 核心判断
- 用户完成 `choose -> profile -> result` 后，系统的第一责任不是继续解释，而是先接住已经被说服的人。
- 结果页后只允许三类任务存在：
  1. `先收下当前推荐`
  2. `验证推荐是否真的值得换`
  3. `切换到新的任务`
- `我的` 不是任务，是容器。
- 所以 `回到我的` 不能和 `加入购物袋 / 对比 / 看依据 / 重测 / 测其他品类` 并列。

## 4. 用户意图排序
结果页后的真实用户意图，优先级固定为：

1. `我认可这个结果，先收下`
2. `我还不放心，想和当前在用的比一下`
3. `我想知道为什么推荐这款`
4. `我想换个任务`

产品约束：
- 不允许把 2 和 3 的层级放到 1 前面
- 不允许把 4 做成模糊按钮
- 不允许出现“看更多”这种无决策目标动作

## 5. 结果页目标与结构

### 5.1 页面目标
- 第一目标：接住已经认可推荐的人
- 第二目标：把有疑虑的人送进正确的疑虑解决路径
- 第三目标：让切换任务的用户明确知道该去哪里

### 5.2 页面目标句
- 这一屏只做一件事：把用户送回一个明确决定

### 5.3 信息架构

#### 第一层：主动作
- 唯一强主按钮：`加入购物袋`
- 可选弱化文案：
  - `先加入购物袋`
  - `先收进购物袋`
- 推荐副文案：
  - `先收下，后面还可以继续对比或查看依据`

产品要求：
- 结果页只能有一个强主按钮
- 这个按钮必须是转化动作
- 不能把“查看产品详情”或“看依据”做成主按钮

#### 第二层：解决疑虑
- 动作 1：`和我现在在用的比一下`
- 动作 2：`看为什么推荐这款`

优先级要求：
- `compare` 高于 `看依据`
- 多数用户的第一疑虑不是“我想学成分”
- 多数用户的第一疑虑是“这款和我现在用的比，到底值不值得换”

推荐文案：
- 标题：`和我现在在用的比一下`
- 默认描述：`上传你现在在用的，直接看差异、取舍和是否值得换`
- 若用户已有在用品：
  - 描述：`已帮你带上当前产品，点开直接对比`
- 若用户没有在用品：
  - 标题：`上传现在在用的，对比一下`
  - 描述：`拍一下瓶身，直接看差异和是否值得换`

推荐依据动作文案：
- `看为什么推荐这款`
- `看推荐依据`
- `了解这款为什么适合你`

禁用文案：
- `查看产品详情`
- `查看成分百科`

#### 第三层：切换任务
- `重测这类`
- `测其他品类`

行为定义：
- `重测这类`
  - 回到当前品类 profile 第一步
- `测其他品类`
  - 回到 `/m/choose`

禁用文案：
- `重新判断一次`

原因：
- 用户无法理解这是“重做当前品类”还是“切换到其他品类”
- 这是偷懒按钮，不是清晰动作

### 5.4 结果页禁止出现的内容
- `回到我的` 作为主层级动作
- 泛工具入口
- 泛百科入口
- 多个同级强按钮
- “查看更多”类无目标动作

## 6. Compare 承接规范

### 6.1 页面定义
- `compare` 的页面目标不是展示更多信息
- `compare` 的页面目标是回答一句话：`值不值得换`

### 6.2 进入方式
- 若用户已有“当前在用”记录：
  - 结果页点击 compare 后直接进入对比结果
- 若用户没有“当前在用”记录：
  - 先进入一个极短上传承接页
  - 该页只做一件事：上传当前在用品
  - 不额外暴露其他入口

### 6.3 Compare 结果页第一屏必须回答的问题
- `更建议换成推荐这款`
- `现在这款可以继续用，没必要急着换`
- `差异不大，按预算和肤感选`

要求：
- 首屏必须先给结论
- 不能先堆差异表、成分表、长解释

### 6.4 Compare 主 CTA 规则
Compare 结果页的主 CTA 不固定，必须跟着结论走：

1. 若推荐款明显更优
   - 主 CTA：`换成推荐这款`
2. 若当前在用品仍可继续使用
   - 主 CTA：`继续用现在这款`
3. 若两者差异不大
   - 主 CTA：`先保留现在这款`

产品要求：
- compare 不能强行把所有用户都推向买推荐
- 如果 compare 的真实结论是“不必换”，系统必须敢说
- 这一步服务的是信任，不是强推转化

### 6.5 Compare 次级动作
- `看关键差异`
- `看为什么推荐这款`
- `换一个当前产品再比`
- `测其他品类`

### 6.6 Compare 成功定义
以下两种都算成功：

1. 用户接受推荐
   - 推荐产品加入购物袋
2. 用户保留当前产品
   - 当前产品写入“我的在用”

这两种都代表系统完成了“帮用户做决定”。

## 7. 推荐依据页承接规范

### 7.1 页面定义
- 这不是百科首页
- 这不是泛商品详情页
- 这是 `推荐依据页`

### 7.2 页面目标
- 让用户更信这次推荐
- 不把用户教育成成分党

### 7.3 第一屏必须回答的三件事
1. 为什么这款适合你
2. 它解决的是你哪一个核心问题
3. 你需要注意什么

### 7.4 页面结构
- 顶部：一句结果结论
- 中部：三个推荐理由
- 下部：关键成分与注意点
- 末尾：如有必要，再展示完整产品信息与成分明细

要求：
- 先结论，后解释
- 不允许一上来就是长篇原料说明
- 不允许把用户先送去百科首页或搜索页

### 7.5 推荐依据页必须保留的动作
- 主 CTA：`先加入购物袋`
- 次 CTA：`和我现在在用的比一下`

页面约束：
- 用户看完依据后，要么收下
- 要么去 compare
- 不允许继续往“更多阅读”无尽下钻

## 8. 返回与路由规则

### 8.1 统一参数
所有从 `result` 页进入后续页面的动作，必须携带：
- `source`
- `result_cta`
- `return_to`

### 8.2 Result -> Compare
- 默认回退目标：当前 `result` 页
- compare 完成后，优先进入 compare 裁决页
- compare 裁决完成后，不回到 compare 首页，而是进入最终决定动作

### 8.3 Result -> 推荐依据页
- 默认回退目标：当前 `result` 页
- 推荐依据页返回时，回到 `result`
- 不允许直接把用户扔到泛 `wiki` 首页

### 8.4 Result -> 切换任务
- `重测这类`：`/m/[category]/profile?step=1`
- `测其他品类`：`/m/choose`

产品要求：
- 所有后续页面必须可回到有效决策位置
- 不允许把浏览器后退当成唯一业务返回机制

## 9. 指标优先级

### 9.1 P0
- `result_view`
- `result_add_to_bag_click / result_view`
- `result_compare_entry_click / result_view`
- `result_rationale_entry_click / result_view`

### 9.2 P1
- `compare_result_accept_recommendation`
- `compare_result_keep_current`
- `rationale_to_bag_click`
- `rationale_to_compare_click`

### 9.3 P2
- compare 深层阅读
- 依据页深层阅读
- 购物袋后的后续动作

说明：
- 先看用户有没有重新做出决定
- 再看他们读了多少内容

## 10. 事件规范

### 10.1 结果页事件
- `result_view`
- `result_add_to_bag_click`
- `result_compare_entry_click`
- `result_rationale_entry_click`
- `result_retry_same_category_click`
- `result_switch_category_click`

### 10.2 Compare 事件
- `compare_entry_view`
- `compare_upload_start`
- `compare_upload_success`
- `compare_result_view`
- `compare_result_accept_recommendation`
- `compare_result_keep_current`
- `compare_result_retry_current_product`
- `compare_result_switch_category_click`

### 10.3 推荐依据页事件
- `rationale_view`
- `rationale_to_bag_click`
- `rationale_to_compare_click`

## 11. 验收标准

### 11.1 结果页
- 仅出现一个强主按钮，且为 `加入购物袋`
- `compare` 入口层级高于 `看依据`
- `重测这类` 与 `测其他品类` 同时可见且语义清晰
- 不出现 `回到我的` 作为同层级任务动作

### 11.2 Compare
- 用户进入 compare 后，第一屏 3 秒内能看懂结论
- compare 首页不再承担工具教育
- compare 的主 CTA 跟随结论变化，而不是固定推推荐款
- compare 完成后能落到一个明确决定

### 11.3 推荐依据页
- 第一屏先讲“为什么适合你”，不是先讲成分百科
- 页面内持续保留 `加入购物袋` 和 `去 compare` 两个动作
- 不把用户直接丢到泛百科首页

## 12. 非目标
- 不在本期重构整个 `wiki` 产品
- 不在本期重构整个 `compare` 工具能力
- 不在本期扩展结果页后的跨品类推荐宇宙
- 不在本期讨论 desktop 公开层

## 13. 产品拍板结论
- 结果页不是终点页，而是决策收口页。
- `compare` 不是工具页，而是“换不换”裁决页。
- 推荐依据页不是百科首页，而是“为什么是它”的解释页。
- 如果 `compare` 和推荐依据页不能把用户送回一个明确决定，它们就不是能力，而是黑洞。
