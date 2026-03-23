---
doc_id: mobile-result-decision-closure-rollout-archive-2026-03-24
title: Archived Mobile Result Decision Closure Rollout (2026-03-24 Snapshot)
doc_type: archive
initiative: mobile
workstream: architecture
owner: architecture-owner
status: archived
priority: p1
created_at: 2026-03-24
updated_at: 2026-03-24
related_docs:
  - mobile-result-decision-closure-rollout
---

# Archived Snapshot Notice

This file is an archived snapshot of the original closure rollout document.
It is preserved for historical reconstruction and should not be used as the current freeze.

# Mobile Result Decision Closure Rollout

## 1. 文档定位
- 本文是 [Mobile Result Decision Closure Spec v1](../product/mobile-result-decision-closure-spec-v1.md) 的 owner rollout freeze。
- 目标不是重写整个 `compare` / `wiki`，而是在当前已上线的 result-intent routing 之上，把 `result -> compare / rationale` 这段链路收成“回到明确决定”的产品路径。

## 2. 这轮要解决什么
- `result` 已经不再是继续阅读页，但 `compare` 仍更像工具页，`rationale` 仍更像泛 wiki 产品页。
- phase-12 要把这两块能力从“信息黑洞”收成“决策闭环”。

## 3. Owner 冻结结论

### 3.1 Result 页
- phase-10 已上线的 result 顶层结构继续保留：
  - 唯一强主按钮：`加入购物袋`
  - 疑虑动作顺序：`和我现在在用的比一下` -> `看为什么推荐这款`
  - 任务切换：`重测这类` -> `测其他品类`
- phase-12 不再重新设计 result 顶层 IA，只允许做与 compare / rationale 闭环相关的薄调整。

### 3.2 Compare 的产品角色
- `compare` 在 result 语境下不再被视为“独立工具页”，而是“换不换”的裁决页。
- 从 result 进入 compare 的第一目标不是展示更多信息，而是回答一句话：`值不值得换`
- result -> compare 的两种承接：
  - 有当前在用记录：优先走 closure compare 路径
  - 无当前在用记录：先进入极短上传承接，不继续暴露通用 compare 教育
- phase-12 第一版不强制重写 backend compare verdict enum；继续使用当前已存在的：
  - `switch`
  - `keep`
  - `hybrid`
- 但前端 CTA 语义冻结为：
  - `switch` -> `换成推荐这款`
  - `keep` -> `继续用现在这款`
  - `hybrid` -> `先保留现在这款`
- `hybrid` 在 phase-12 先被视为“差异不大 / 先保留当前”的 closure 语义，而不是继续扩展说明页。

### 3.3 Compare 结果页动作
- Compare 结果页第一屏必须先给结论，再给理由。
- Compare 结果页允许的次级动作先冻结为：
  - `看关键差异`
  - `看为什么推荐这款`
  - `换一个当前产品再比`
  - `测其他品类`
- `返回 compare 首页`、`查看成分百科`、`查看更多` 不得作为第一屏主层级动作。

### 3.4 Compare 成功定义
- Compare 的成功不只包括“接受推荐”。
- 以下两种都算 closure success：
  - 推荐产品加入购物袋
  - 当前产品被确认保留并写入“我的在用”
- 也就是说，compare 必须敢于输出“不必换”。

### 3.5 Rationale 的产品角色
- phase-12 第一版不新造一个完全独立页面；优先把当前 `wiki product detail` 收成 `rationale mode`。
- `rationale mode` 不是泛 wiki 产品页：
  - 第一屏先讲为什么适合你
  - 再讲解决什么问题
  - 再讲注意什么
- `rationale mode` 必须始终保留两个动作：
  - 主 CTA：`先加入购物袋`
  - 次 CTA：`和我现在在用的比一下`
- 不允许把用户先扔回泛 `wiki` 首页。

### 3.6 路由与返回规则
- 所有从 result 进入 compare / rationale 的动作必须继续携带：
  - `source`
  - `result_cta`
  - `return_to`
- `result -> rationale`：
  - 默认返回当前 result
  - 不回泛 wiki 首页
- `result -> compare`：
  - 默认返回当前 result
  - compare 裁决完成后，应进入明确决定动作，而不是回 compare 首页
- phase-12 不扩写第二套路由 contract；优先复用当前 route-state，并在 helper 层收敛。

### 3.7 Analytics 冻结
- phase-10 的 result 事件家族继续保留，不允许重命名或再生第二套 result event family。
- phase-12 允许新增的专用 closure 事件只限 compare / rationale：
  - `compare_entry_view`
  - `compare_upload_start`
  - `compare_upload_success`
  - `compare_result_accept_recommendation`
  - `compare_result_keep_current`
  - `compare_result_retry_current_product`
  - `compare_result_switch_category_click`
  - `rationale_view`
  - `rationale_to_bag_click`
  - `rationale_to_compare_click`
- 如果现有 `compare_result_cta_click` 已足够表达闭环，Worker A 可以提出“scoped diff = 0 / 无需扩事件”的 green 结论。

## 4. 这轮不做什么
- 不重构整个 compare 工具能力
- 不重构整个 wiki 产品详情系统
- 不修改推荐算法或 compare 核心判定算法
- 不扩展跨品类推荐宇宙
- 不让 `/m/me` 再次进入 result 顶层动作

## 5. 拆工建议

### Worker B
- 作为 truth owner，先冻结：
  - result -> compare / rationale route semantics
  - closure compare 的 entry / return / completion 规则
  - `keep current` 写回“我的在用”的最短链路
  - rationale mode 的 query / source / result_cta 语义

### Worker C
- 在 B 绿灯后做页面 adoption：
  - compare 的极短上传承接
  - compare 结果页的 verdict-first UI
  - rationale mode 的结论优先 UI

### Worker A
- 在 B/C 语义稳定后做 analytics / docs / dashboard 收口：
  - 保住 phase-10 result event family
  - 只在 closure 无法观测时新增专用 compare / rationale 事件

## 6. Go / No-Go
- 如果 compare 仍然需要先教育工具用法，no-go
- 如果 rationale 仍然把用户先带去泛 wiki / 泛详情，no-go
- 如果 compare 的主 CTA 仍固定推推荐款，no-go
- 如果 result / compare / rationale 之间出现第二套路由真相，no-go

## Archive Metadata

- archive_date: `2026-03-24`
- archive_source_path: `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-result-decision-closure-rollout.md`
- original_file_birth_time: `2026-03-19 17:13:45 +0800`
- original_file_last_modified_time: `2026-03-19 17:13:45 +0800`
