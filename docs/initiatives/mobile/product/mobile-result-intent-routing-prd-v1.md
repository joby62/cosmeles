---
doc_id: mobile-result-intent-routing-prd-v1
title: Mobile Result Intent Routing PRD v1
doc_type: spec
initiative: mobile
workstream: product
owner: product-owner
status: frozen
priority: p0
created_at: 2026-03-19
updated_at: 2026-03-24
phase: phase-10
frozen_at: 2026-03-19
related_docs:
  - mobile-decision-prd-v1
  - mobile-result-intent-routing-rollout
related_assignments:
  - phase-10-worker-a
  - phase-10-worker-b
  - phase-10-worker-c
  - phase-11-worker-a
  - phase-11-worker-b
  - phase-11-worker-c
---

# Mobile Result Intent Routing PRD v1

## 1. 文档信息
- 文档名称：Mobile Result Intent Routing PRD v1
- 适用范围：`/m/[category]/result`、`/m` 首页分层、`/m/choose` 回流与返回逻辑
- 关联文档：[Mobile Decision-First PRD v1](./mobile-decision-prd-v1.md)
- 当前定位：结果页不是终点页，而是意图分流页

## 2. 背景与问题
- 现状里结果页主动作偏向“继续阅读”，没有优先承接“我已认可推荐，准备转化”的用户。
- 有疑虑用户被默认引导去看详情/成分，不够自然地进入“和我当前产品做对比”。
- “重新判断一次”语义过于模糊，无法区分“重测当前品类”和“切换到其他品类”。
- 老用户已经理解模块分区，首页仍以“从头开始测配”为唯一主呈现时，会造成重复教育和效率损失。

## 3. 目标
- 结果页同时承接四类高频意图：`接受推荐`、`验证推荐`、`理解推荐`、`切换任务`。
- 用最少认知成本把多数疑虑用户自然导向 compare，而不是先导向重阅读。
- 让“重测当前品类”和“测其他品类”成为明确且可区分的动作。
- 让 `/m` 对新老用户采用不同呈现策略，减少对老用户的重复教育。

## 4. 非目标
- 不改变当前“decision-first 主链路优先”的总策略。
- 不下线 `wiki`、`compare`、`me`。
- 不在本期重构 compare 和 wiki 内部信息架构。
- 不改动后端推荐算法与全场景内容供给机制。

## 5. 用户意图分层
结果页默认存在以下四类意图，且顺序有主次：

1. `我认可推荐，想先收下`（转化意图）
2. `我还不放心，想验证一下`（对比意图，主疑虑路径）
3. `我想自己搞懂为什么`（解释/百科意图）
4. `我现在想切去别的任务`（重测或换品类）

产品要求：
- 不把 1 和 2 让位给阅读动作。
- 不把 4 合并成模糊按钮。

## 6. 结果页信息架构（目标态）

### 6.1 第一层：主动作（转化）
- 主按钮：`加入购物袋`
- 说明文案：`先收下，后续仍可继续对比或查看依据`

设计约束：
- 结果页只保留一个“强主按钮”，且该按钮必须是转化动作。
- 不使用“查看产品详情”作为主按钮。

### 6.2 第二层：疑虑解决（双路径）
- 卡片 A（优先）：`和我现在在用的比一下`
  - 副文案：`上传或选择你当前在用的，直接看差异和是否值得换`
  - 若用户有在用记录：`已带上当前在用品，点开直接对比`
- 卡片 B（次优先）：`看为什么推荐这款`
  - 副文案：`查看推荐依据、关键成分和注意点`

设计约束：
- 对比路径在视觉层级上高于百科/详情路径。
- 文案避免“成分百科”这类高门槛命名作为第一疑虑动作。

### 6.3 第三层：切换任务
- 次级按钮 1：`重测这类`
  - 行为：回到当前品类 profile 第一步
- 次级按钮 2：`测其他品类`
  - 行为：进入 `/m/choose`

设计约束：
- 不使用“重新判断一次”单一模糊动作替代上述两个动作。

## 7. 返回与跳转规则（必须显式）
所有结果页后续跳转必须带来源语义（`source/return_to/result_cta`），并遵循以下规则：

- 来源 `decision_profile`：
  - 返回优先：当前品类 profile 最近可恢复位置
  - 兜底：`/m/choose`
- 来源 `utility_compare_reentry`：
  - 返回优先：compare result -> compare 首页
  - 兜底：`/m/compare`
- 来源 `utility_wiki_reentry`：
  - 返回优先：wiki product/category
  - 兜底：`/m/wiki`
- 主动点 `测其他品类`：
  - 目标固定：`/m/choose`
- 主动点 `重测这类`：
  - 目标固定：`/m/[category]/profile?step=1`

约束：
- 不允许仅依赖浏览器后退承担业务返回逻辑。
- fallback 必须可落回决策链路，不允许死路。

## 8. `/m` 首页新老用户分层呈现

### 8.1 新用户（首访/无历史）
- 主呈现：decision landing
- 主 CTA：`开始测配`
- 次入口：`先查产品或成分`（弱入口）

### 8.2 老用户（有历史行为）
按优先级呈现首页主动作：

1. 有未完成问答：`继续上次进度`
2. 无未完成问答但有最近结果：`回看上次结果`
3. 有在用品记录：展示 `和当前在用做对比` 快捷动作
4. 快捷区：`测新的`、`对比`、`查百科`、`我的`

约束：
- 老用户首页可作为 workspace，但不回退到“首访四入口导览”。
- 新用户仍采用单主叙事，不被 workspace 结构干扰。

## 9. 文案规范（结果页）
- 主按钮：`加入购物袋`
- 对比动作：`和我现在在用的比一下`
- 解释动作：`看为什么推荐这款`
- 切换动作：`重测这类`、`测其他品类`

禁用文案（结果页主入口）：
- `查看产品详情`（不可作为主按钮）
- `重新判断一次`（不可作为单一动作）
- `查看成分百科`（不可作为第一疑虑动作）

## 10. 事件与指标

### 10.1 新增/统一事件（建议）
- `result_add_to_bag_click`
- `result_compare_entry_click`
- `result_rationale_entry_click`
- `result_retry_same_category_click`
- `result_switch_category_click`
- `home_workspace_quick_action_click`

### 10.2 核心观测指标
- 结果页转化点击率：`result_add_to_bag_click / result_view`
- 结果页疑虑分流率：
  - `result_compare_entry_click / result_view`
  - `result_rationale_entry_click / result_view`
- 结果页任务切换率：
  - `result_retry_same_category_click / result_view`
  - `result_switch_category_click / result_view`
- 老用户首页效率：
  - `home_resume_click / home_view`
  - `home_workspace_quick_action_click / home_view`

## 11. 实施优先级

### P0（必须）
- 调整结果页 CTA 层级：主转化、对比优先、解释次之、切换拆分
- 落地返回规则和 fallback
- 首页完成新老用户分层
- 落地对应事件

### P1（建议）
- 对比入口增加“已带上在用品”状态
- 对比入口支持快速上传引导文案 A/B
- 结果页根据用户状态动态调整第二层文案

### P2（后续）
- 跨品类连续任务流（例如洗发完成后引导护发）
- 结果页个性化快捷动作排序

## 12. 验收标准
- 结果页出现且仅出现一个强主按钮，且为 `加入购物袋`
- 结果页存在明确的 compare 入口，且层级高于“看依据/百科”
- “重测这类”和“测其他品类”均可见且语义清晰
- 首页可根据新老用户状态切换呈现，不对老用户重复首访教育
- 任一路径返回都可回到有效页面，且不依赖浏览器后退作为唯一机制
