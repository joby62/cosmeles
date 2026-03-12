# Jeslect 周执行面板

> 最后更新：2026-03-12

适用范围：

- 当前仓库：`/Users/lijiabo/cosmeles`
- 当前分支：`codex/english-shop-standalone`
- 当前主目标：美国站支付前 storefront 收口
- 当前政策前提：`pay 模块暂不接入`

关联文档：

- 四阶段路线图：[JESLECT_PHASE_PLAN.zh-CN.md](JESLECT_PHASE_PLAN.zh-CN.md)
- 执行清单版：[JESLECT_EXECUTION_CHECKLIST.zh-CN.md](JESLECT_EXECUTION_CHECKLIST.zh-CN.md)
- 中文项目说明：[../README.zh-CN.md](../README.zh-CN.md)

这份文档是当前周的执行面板，不是长期路线图。
目标是把“现在最该做什么、下周接什么、哪里卡住、哪些需要拍板”压成一个可直接跟进的面板。

## 一、当前项目判断

截至 `2026-03-12`：

- 当前阶段：`late P0 / launch hardening`
- 当前进度判断：
  - `P0`：`93%~95%`
  - `P1`：`25%~35%`
  - `P2`：`10%~15%`
  - `P3`：`0%~5%`

当前最关键的工作，不是再扩页面，而是把美国站做成真正 launch-ready 的支付前 storefront。

## 二、本周执行清单（2026-03-09 至 2026-03-15）

### 本周目标

- 收紧 `P0` 的最后关键缺口
- 让站点从“结构完整”推进到“更接近可上线”
- 为下周的 QA 与 P1 第一批任务创造条件

### 本周最高优先级

#### W1-1｜补主力商品 commerce 覆盖率

- 目标：
  让首页、Shop、Collection、Category、Search 首屏主力商品尽量显示真实 `price / inventory / shipping ETA / pack size`
- 本周完成标准：
  - 确认主力商品补录优先级
  - 完成第一批主力商品 commerce 补录
  - 前台首屏已能稳定看到一批真实 commerce 字段
- 当前阻塞：
  - 真实商品字段来源和口径如果还不统一，会影响补录效率

#### W1-2｜明确并配置 support inbox

- 目标：
  让 `/support/contact` 进入真实可运营状态
- 本周完成标准：
  - 确认对外 support 邮箱或工单入口
  - 明确 response window / hours / scope note
  - 准备生产环境配置所需值
- 当前阻塞：
  - 如果对外联系通道还未定，本周只能停留在页面能力层

#### W1-3｜完成 About / trust 文案骨架

- 目标：
  让品牌层不再只有功能说明
- 本周完成标准：
  - 明确 About 的信息层级
  - 明确 brand standards / quality trust 的内容结构
  - 明确首页、PDP、Support 的 trust 文案统一规则
- 当前阻塞：
  - 需要对品牌语气和“讲多少品牌、讲多少产品依据”有明确取舍

### 本周次高优先级

#### W1-4｜准备 launch-grade QA 清单

- 目标：
  让下周 QA 不是临时扫页面，而是按固定清单验收
- 本周完成标准：
  - 列出 mobile QA 清单
  - 列出 desktop QA 清单
  - 列出 empty / error / recovery / support-link QA 清单

#### W1-5｜做一轮英文口径抽查

- 目标：
  先提前排查旧 `/m`、中文和旧 mobile 心智残留
- 本周完成标准：
  - 发现并记录主要语言残留点
  - 为下周集中修边准备列表

### 本周不建议插入的新工作

- 不建议现在插入 pay 相关实现
- 不建议扩新页面类型
- 不建议提前做 UK 专属分流
- 不建议在 proof strategy 未定前强上伪 reviews

## 三、下周执行清单（2026-03-16 至 2026-03-22）

### 下周目标

- 收完 `P0`
- 启动 `P1` 第一批任务

### 下周最高优先级

#### W2-1｜执行 launch-grade QA

- 目标：
  把当前美国站核心链路做一次系统验收
- 完成标准：
  - mobile / desktop QA 走完
  - empty states / error states QA 走完
  - support/legal cross-link QA 走完
  - recovery flow QA 走完
- 产出：
  - 缺陷清单
  - 修复优先级

#### W2-2｜修复 QA 阶段发现的高优先级问题

- 目标：
  把会影响 launch readiness 的问题收口
- 完成标准：
  - 主链路阻塞问题清零
  - 高优先级 trust / copy / empty-state 问题收口

#### W2-3｜启动 P1-1 排序逻辑升级

- 目标：
  让 Search / Shop / Collection / Category 开始按更合理的优先级展示商品
- 完成标准：
  - 明确排序因子
  - 启动 `fit confidence + commerce completeness + launch priority` 的统一排序方案

### 下周次高优先级

#### W2-4｜启动 P1-2 analytics 定义

- 目标：
  让后续优化开始有统一指标抓手
- 完成标准：
  - 明确 landing / PDP / add to bag / saved recovery
  - 明确 match / compare completion
  - 明确 search-to-PDP / collection-to-PDP

#### W2-5｜启动 P1-3 performance / accessibility pass

- 目标：
  提前把上线质量问题收口
- 完成标准：
  - 列出关键页面性能与可访问性问题
  - 开始第一轮修边

## 四、当前阻塞项

### B1｜真实 commerce 数据来源与补录节奏

- 当前影响：
  - 影响 P0-1
  - 影响首页和列表页首屏可信度
- 如果不解决：
  - 站点会继续停留在“有结构、字段不够实”的状态

### B2｜真实 support inbox 尚未最终落定

- 当前影响：
  - 影响 `/support/contact` 从“可配置”走到“真正可上线”
- 如果不解决：
  - support 页面会继续停留在准备态，而非运营态

### B3｜About / quality trust 还没有最终表达版本

- 当前影响：
  - 影响品牌层可信度
  - 影响首页与 PDP 的 brand trust 收口
- 如果不解决：
  - 站点会更像工具站，而不是准备上线的品牌站

### B4｜Pay 受政策限制暂时不能做

- 当前影响：
  - 无法进入真实 checkout / payment / order creation
- 当前策略：
  - 不做 pay implementation
  - 但提前准备 `P2 pay-ready architecture`

## 五、需要你拍板的事项

### D1｜对外 support 通道

需要确认：

- 是否已有正式对外 support 邮箱
- 是否需要工单入口而不是邮箱
- 对外承诺的响应时间窗口是什么

### D2｜commerce 数据补录的权威来源

需要确认：

- `price / inventory / shipping ETA / pack size` 的最终来源是谁
- 是运营补录、脚本导入，还是外部表同步
- 更新频率以什么为准

### D3｜About / brand standards 的表达重心

需要确认：

- 更偏品牌方法论
- 还是更偏质量与标准
- 还是两者平衡，但以“适配与清晰解释”为核心

### D4｜proof strategy 的边界

需要确认：

- 在没有真实 reviews 数据源前，是否坚持 `evidence-first`
- 未来如果要上 reviews，数据来源和审核边界是什么

## 六、当前建议的执行顺序

建议按这个顺序推进：

1. 本周先抓 `W1-1 commerce 覆盖率`
2. 并行确认 `W1-2 support inbox`
3. 紧接着完成 `W1-3 About / trust 骨架`
4. 然后准备 `W1-4 QA 清单`
5. 下周执行 `W2-1 QA`
6. QA 后立即做 `W2-2 修高优先级问题`
7. 之后无缝接 `W2-3 / W2-4 / W2-5`

## 七、当前一句话判断

当前 Jeslect 最需要的，不是再加功能，而是把：

- 数据
- 信任
- 运营入口
- QA

这 4 件事收完。

如果这 4 件事收住了，P0 就能真正从“差不多了”变成“可上线了”。
