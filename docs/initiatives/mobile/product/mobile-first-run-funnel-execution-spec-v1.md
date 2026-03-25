---
doc_id: mobile-first-run-funnel-execution-spec-v1
title: Mobile First-Run Funnel Execution Spec v1
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
  - mobile-result-decision-closure-spec-v1
  - mobile-compare-result-page-spec-v1
  - mobile-first-run-and-compare-closure-rollout
related_assignments:
  - phase-13-worker-a
  - phase-13-worker-b
  - phase-13-worker-c
---

# Mobile First-Run Funnel Execution Spec v1

## 1. 文档信息
- 文档名称：Mobile First-Run Funnel Execution Spec v1
- 适用范围：
  - `/m`
  - `/m/choose`
  - `/m/[category]/profile`
  - `/m/[category]/result`
- 关联文档：
  - [Mobile Decision-First PRD v1](./mobile-decision-prd-v1.md)
  - [Mobile Result Intent Routing PRD v1](./mobile-result-intent-routing-prd-v1.md)
  - [Mobile Result Decision Closure Spec v1](./mobile-result-decision-closure-spec-v1.md)
- 当前阶段目标：
  - 先把新用户首轮测配跑通
  - 先保 `result` 到达
  - 先冻结首轮漏斗口径

## 2. 产品定义

### 2.1 这段产品是什么
- 这是一条首轮决策主链路。
- 这条链路只负责把用户尽快送到 `result`。
- 这条链路优先解决的是首访激活，不是功能完整。

### 2.2 这段产品不是什么
- 不是功能地图
- 不是 utility 导航入口
- 不是百科、对比、我的的综合首页
- 不是在首访阶段教用户理解整个系统的地方

## 3. 核心判断
- 这不是功能收纳问题。
- 这是主链路保卫战。
- 新用户只配看到一件事：`开始测配`。
- 没有测配，就没有后面的 `compare / wiki / bag / me`。
- 没有 `result`，留存、回流、购物转化都只是空谈。

## 4. 用户分层规则

### 4.1 禁止使用的分群说法
- 禁止使用 `专业用户` 这种模糊说法。

原因：
- 这不是用户分层，这是团队自我安慰。
- 系统只认真实行为，不认想象中的用户气质。

### 4.2 允许的分层依据
系统只按以下行为状态分层：
- 是否有未完成问答
- 是否有最近结果
- 是否有当前在用记录

### 4.3 新用户定义
满足以下条件则视为新用户：
- 没有未完成问答
- 没有最近结果
- 没有当前在用记录

### 4.4 老用户定义
只要存在以下任一条件，即视为老用户：
- 有未完成问答
- 有最近结果
- 有当前在用记录

## 5. 页面级执行规则

### 5.1 `/m`

#### 新用户
页面目标：
- 让用户立刻点击 `开始测配`

页面要求：
- 只保留一个主 CTA：`开始测配`
- 不给 `wiki` 弱入口
- 不给快捷按钮
- 不给任何 utility 导航
- 不做产品地图教学
- 不做 compare / wiki / me 首访露出

禁止内容：
- `先查产品或成分`
- 四宫格快捷入口
- “为了完整”保留的 utility 露出

#### 老用户
页面目标：
- 用最短路径恢复已有任务

动作优先级固定为：
1. `继续上次进度`
2. `回看上次结果`
3. `和当前在用做对比`
4. 其他快捷动作

产品要求：
- 老用户首页才允许作为 workspace
- workspace 不能反向污染新用户首页

### 5.2 `/m/choose`
页面目标：
- 让用户选品类后直接进入第 1 题

页面要求：
- 品类卡整块点击后直接进入对应品类第 1 题
- 去掉“选中态 + 开始按钮”双动作
- 顶部恢复卡片保留
- 不重复教育系统价值
- 不增加 utility 分流入口

禁止内容：
- 二次确认按钮
- “点选后再开始”的双动作结构
- 长说明
- 任何与首轮答题无关的跳转

### 5.3 `/m/[category]/profile`
页面目标：
- 只负责答题

页面要求：
- 只允许答题
- 不给 utility 分流
- 不加 compare、wiki、me 快捷入口
- 不加额外教育

### 5.4 `/m/[category]/result`
页面目标：
- 首轮成功定义为到达 `result`

页面要求：
- 只有到这里，才开放：
  - `加入购物袋`
  - `和我现在在用的比一下`
  - `看为什么推荐这款`
  - `重测这类`
  - `测其他品类`

产品要求：
- 只有进入 `result` 后，才谈留存、转化、回流
- `result` 之前不允许把用户送去 utility

## 6. 该砍什么
- 新用户首页的 `先查产品或成分`
- `choose` 页的二次确认按钮
- 首访阶段任何四宫格快捷入口
- 首访阶段任何“为了完整”保留的 utility 露出
- `专业用户` 这种模糊分群说法

## 7. 该保什么
- 唯一主动作：`开始测配`
- `choose -> 直接进题`
- 首次成功定义：到达 `result`
- 老用户恢复能力
- `result` 之后的 `compare / wiki / bag / me` 承接能力

## 8. 埋点口径

### 8.1 首轮漏斗只看这几步
- `home_primary_cta_click`
- `choose_category_start_click`
- `questionnaire_view(step=1)`
- `questionnaire_completed`
- `result_view`

### 8.2 事件设计原则
- 不要再把“选中品类”和“开始答题”拆成两个关键点击
- 如果一个点击本身就是开始，就只记一个主事件
- 否则是在给自己制造假流失

### 8.3 第二层指标
- `result_primary_cta_click`
- `result_compare_entry_click`
- `result_rationale_entry_click`
- `utility_return_click`

产品要求：
- 顺序不能反
- 先保首轮跑通，再看结果后回流

## 9. 页面验收标准

### 9.1 `/m`
- 新用户首页只有一个主 CTA：`开始测配`
- 新用户首页不出现 `wiki / compare / me` 可点击入口
- 老用户首页才出现 workspace

### 9.2 `/m/choose`
- 点击品类卡后直接进入对应品类第 1 题
- 不再存在“先选中，再点开始”
- 顶部恢复卡片正常保留

### 9.3 `/m/[category]/profile`
- 页面只承担答题
- 页面内不出现 utility 分流动作

### 9.4 `/m/[category]/result`
- 首轮成功统一定义为到达 `result`
- 到达 `result` 后才允许出现结果后承接动作

## 10. 角色分工

### 10.1 `Product Owner`
- 冻结新用户 / 老用户分层规则
- 冻结首轮漏斗口径
- 冻结 `choose` 直接开始

### 10.2 `Experience Owner`
- 把 `choose` 改成整卡直达
- 删除首访多余入口

### 10.3 `User Insight And Copy Owner`
- 首访不再讲 `compare / wiki / me`
- 所有文案围绕“快到结果”

### 10.4 `Architecture Owner`
- 改事件契约
- 确保首轮漏斗能闭环

### 10.5 `Workers`
- 按冻结后的口径删入口、改跳转、改埋点

## 11. 产品拍板结论
- 新用户首页不是导航页，是主链路起点。
- `choose` 不是选择确认页，是进入答题前的最后一步。
- `profile` 不是解释页，只负责答题。
- `result` 之前不谈 utility。
- 所有后续留存、对比、百科、购物动作，都建立在首轮 `result` 到达之后。
