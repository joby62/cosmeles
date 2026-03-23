---
doc_id: mobile-compare-result-page-spec-v1
title: Mobile Compare Result Page Spec v1
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
  - mobile-result-decision-closure-spec-v1
  - mobile-first-run-and-compare-closure-rollout
related_assignments:
  - phase-13-worker-c
---
# Mobile Compare Result Page Spec v1

## 1. 文档信息
- 文档名称：Mobile Compare Result Page Spec v1
- 适用范围：
  - `/m/compare/result/[compareId]`
- 关联文档：
  - [Mobile Result Intent Routing PRD v1](./mobile-result-intent-routing-prd-v1.md)
  - [Mobile Result Decision Closure Spec v1](./mobile-result-decision-closure-spec-v1.md)
- 当前阶段目标：
  - 把 compare 结果页从“内容展厅”改成“裁决页”
  - 让用户在 compare 后完成一个明确决定

## 2. 产品定义

### 2.1 这页是什么
- compare 结果页是“换不换”裁决页。
- 这页只负责回答：`值不值得换`

### 2.2 这页不是什么
- 不是沉浸式长内容页
- 不是成分百科延伸页
- 不是推荐产品详情页
- 不是继续引导阅读的内容页

## 3. 核心判断
- compare 结果页的目标不是让用户继续看更多。
- compare 结果页的目标是让用户完成一个动作。
- 首屏必须先给结论，再给理由，再给执行。
- `置信度百分比`、`历史基线`、`route 名称` 不是用户价值，是内部逻辑外溢。

## 4. 页面目标
- 3 秒内让用户知道：换 / 不换 / 暂不换
- 10 秒内让用户完成动作

## 5. verdict 类型

### 5.1 `switch`
- 含义：更建议换成推荐这款
- 用户问题：我现在该不该换
- 页面回答：该换

### 5.2 `keep`
- 含义：当前在用品仍可继续使用
- 用户问题：我现在这款是不是也行
- 页面回答：可以继续用

### 5.3 `hybrid`
- 含义：差异不大或更适合分场景使用
- 用户问题：要不要立刻全换
- 页面回答：先别急着全换

产品要求：
- `hybrid` 不是炫技状态
- 它只在系统确实不能给出明确单向替换建议时使用

## 6. 信息结构

### 6.1 第一屏：结论区
页面职责：
- 直接给最终判断

必须包含：
- Eyebrow：`对比结论`
- verdict 标签：
  - `建议切换`
  - `建议继续用`
  - `差异不大`
- H1 结论句
- 一句解释文案
- 当前产品与推荐产品的简化对照
- 一个强主 CTA
- 一个弱动作：`看关键差异`

禁止出现：
- `置信度 84%`
- `历史基线`
- `route 标题`
- `再做一次对比`
- `查看成分百科`
- `查看推荐产品`

### 6.2 第一屏文案例子

#### `switch`
- 标签：`建议切换`
- H1：`更建议换成推荐这款`
- 解释：`它更贴合你当前状态，继续用现在这款的收益不大`
- 主 CTA：`换成推荐这款`

#### `keep`
- 标签：`建议继续用`
- H1：`现在这款可以继续用`
- 解释：`当前没有足够理由立刻更换，先把这套用稳更重要`
- 主 CTA：`继续用现在这款`

#### `hybrid`
- 标签：`差异不大`
- H1：`两款差异不大，先别急着换`
- 解释：`没有必要因为一点点差异立刻重买，先保留当前更稳`
- 主 CTA：`先保留现在这款`
- 次 CTA：`把推荐款收进购物袋`

### 6.3 第二屏：为什么这么判
页面职责：
- 给出足够支撑决定的理由

必须包含：
- 标题：`为什么这么判断`
- 3 张理由卡

三张理由卡类型固定为：
1. `更匹配你的当前问题`
2. `继续用现在这款的限制或风险`
3. `换过去后最直接的体感差异`

每张卡结构固定为：
- 一句小标题
- 一句判断
- 一句证据

产品要求：
- 一张卡只讲一件事
- 不允许 5 张、7 张、10 张地堆
- 不允许“全部内容”弹层
- 不允许 `min-h 68dvh` 这种拉长阅读的结构

### 6.4 第三屏：接下来这样做
页面职责：
- 告诉用户如果按这个决定执行，下一步该做什么

必须包含：
- 标题：`接下来这样做`
- 2 到 3 条执行建议

建议类型固定为：
- `先停什么`
- `先继续什么`
- `观察几天看什么反馈`

例子：
- `先按这款连续用 7 天，再看出油和头痒有没有缓下来`
- `这段时间别叠加强清洁或强去屑产品`
- `如果刺激感变强，先降频`

### 6.5 第四屏：其他动作
页面职责：
- 承接少数仍未完成决定的用户

动作顺序固定为：
1. `看为什么推荐这款`
2. `换一个当前产品再比`
3. `回到这次结果`
4. `测其他品类`

禁止出现：
- `回到我的`
- `查看成分百科`
- `查看推荐产品`

原因：
- compare 的目标是裁决
- 不是把用户继续送去下一个内容池

## 7. CTA 规则

### 7.1 主 CTA 必须跟随 verdict 变化
- `switch`：`换成推荐这款`
- `keep`：`继续用现在这款`
- `hybrid`：`先保留现在这款`

### 7.2 CTA 后的业务动作
- `换成推荐这款`
  - 推荐产品加入购物袋
- `继续用现在这款`
  - 当前产品写入“我的在用”
- `先保留现在这款`
  - 当前产品写入“我的在用”

### 7.3 次 CTA 规则
- 只允许保留少量弱动作
- 弱动作不能和主 CTA 抢主权
- `回到我的` 只能在成功态里出现，不能在 compare 结果页默认出现

## 8. 成功定义
以下都算 compare 成功：

1. 用户接受推荐
   - 推荐产品进入购物袋
2. 用户保留当前
   - 当前产品进入“我的在用”

产品要求：
- compare 成功不等于强行把所有人推向推荐款
- 真正的成功是帮用户完成判断

## 9. 当前实现必须删除或降级的内容
- 置信度百分比
- 历史基线路由说明
- 首屏 `看原因`
- 首屏 `再做一次对比`
- 长滚动 `建议卡`
- `全部内容` 弹层
- `查看推荐产品`
- `查看成分百科`

## 10. 事件规范

### 10.1 页面事件
- `compare_result_view`

### 10.2 CTA 事件
- `compare_result_accept_recommendation`
- `compare_result_keep_current`
- `compare_result_hold_current`
- `compare_result_view_key_differences`
- `compare_result_open_rationale`
- `compare_result_retry_current_product`
- `compare_result_switch_category_click`

### 10.3 成功落点事件
- `compare_result_accept_recommendation_land`
- `compare_result_keep_current_land`

## 11. 验收标准
- 首屏 3 秒内能看懂“换不换”
- 首屏只有一个强主 CTA
- 首屏不出现内部判断信息
- 第二屏只保留 3 个理由
- compare 结果页不再承担百科教育
- compare 完成后可落到一个明确决定

## 12. 角色分工

### 12.1 `Product Owner`
- 冻结 compare 结果页目标句
- 冻结 verdict 与 CTA 映射
- 冻结页面区块顺序

### 12.2 `Experience Owner`
- 把页面从长内容展厅改成裁决页
- 压缩首屏阅读负担

### 12.3 `User Insight And Copy Owner`
- 把 `switch / keep / hybrid` 翻译成用户听得懂的话
- 去掉伪专业表达

### 12.4 `Architecture Owner`
- 输出稳定 verdict 契约
- 支持 dynamic CTA 与落点

### 12.5 `Workers`
- 删除错误区块
- 重排页面结构
- 调整 compare 结果页埋点

## 13. 产品拍板结论
- compare 结果页不是展示页，是裁决页。
- 首屏先给结论，不给伪数据。
- 先帮用户完成判断，再允许他们继续看内容。
- 如果 compare 结果页还在鼓励继续阅读，它就没有完成自己的任务。
