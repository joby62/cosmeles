# Jeslect 执行清单版

> 最后更新：2026-03-12

适用范围：

- 当前仓库：`/Users/lijiabo/cosmeles`
- 当前主执行分支：`codex/english-shop-standalone`
- 当前主市场：美国优先，英国次之
- 当前限制：`pay 模块暂不接入`

关联文档：

- 总览版路线图：[JESLECT_PHASE_PLAN.zh-CN.md](JESLECT_PHASE_PLAN.zh-CN.md)
- 中文项目说明：[../README.zh-CN.md](../README.zh-CN.md)

这份文档不是愿景说明，而是执行清单。
目标是把当前阶段拆成可以直接排期、跟进、验收的任务序列。

## 一、当前状态快照

当前阶段判断：

- `P0`：`93%~95%`
- `P1`：`25%~35%`
- `P2`：`10%~15%`
- `P3`：`0%~5%`

当前最值得盯的 3 个问题：

1. `commerce` 真实字段覆盖率不够高  
2. `trust / proof` 还不够像 launch-ready 品牌  
3. `pay` 虽然不能做，但交易骨架必须提前建

当前执行优先级：

1. 先收完 `P0`
2. 立刻进入 `P1` 第一批
3. 在 `pay` 还不能做时，提前做 `P2 pay-ready`

## 二、建议总排期

### 第 1-2 周

- 收完 `P0`
- 把美国站做成 launch-ready 的支付前 storefront

### 第 3-5 周

- 做 `P1` 第一批任务
- 把站点从“能用”推进到“可放量”

### 第 6-8 周

- 做 `P2` 交易骨架
- 让未来支付接入不需要推翻当前结构

### 政策条件成熟后

- 启动 `P3`
- 接入真实支付、订单和售后闭环

## 三、P0 剩余任务清单

### P0-1｜补齐主力商品 commerce 覆盖率

- 优先级：`P0-High`
- 当前状态：`进行中`
- 目标：
  让首页、Shop、Category、Search、Collection、PDP 首屏出现的主力商品，大部分都具备真实 `price / inventory / shipping ETA / pack size`
- 任务：
  - 用 `/ops/commerce` 按 category 和 completeness 筛主力商品
  - 先补首页、bestsellers、collections 首屏商品
  - 再补各 category 首屏与 search 高频商品
  - 最后补 compare / match 常见落点商品
- 依赖：
  - 真实商品字段来源可提供
  - 运营侧对 price/inventory/shipping 文案达成一致
- 主要风险：
  - 数据补录顺序不对，可能导致工具里看起来在补数据，但前台首屏还是空
- 验收标准：
  - 首页、Shop、Collection 首屏主力商品，大多数已显示真实 commerce 字段
  - PDP 和 Bag 对这些商品不再只显示 readiness 状态

### P0-2｜配置真实 support inbox

- 优先级：`P0-High`
- 当前状态：`待执行`
- 目标：
  让 `/support/contact` 成为真实可用入口，而不是只展示可配置结构
- 任务：
  - 明确对外 support 邮箱或工单入口
  - 在生产环境配置 `SUPPORT_EMAIL`
  - 视情况补 `SUPPORT_RESPONSE_WINDOW`
  - 视情况补 `SUPPORT_HOURS`
  - 视情况补 `SUPPORT_SCOPE_NOTE`
- 依赖：
  - 运营或品牌侧确认对外联系通道
- 主要风险：
  - 页面已经开放，但没有真实响应机制，会产生信任落差
- 验收标准：
  - `/support/contact` 线上显示真实联系入口
  - 支持文案和实际支持边界一致

### P0-3｜补 About / brand standards / trust language

- 优先级：`P0-High`
- 当前状态：`待执行`
- 目标：
  让站点从“功能站”更像“可上线品牌站”
- 任务：
  - 完成 `/about`
  - 设计 `brand standards / quality trust` 内容结构
  - 把首页、PDP、Support 的 trust 语言再统一一轮
- 依赖：
  - 当前 brand positioning 已在 README 和中文文档中成形
- 主要风险：
  - 如果 About/trust 太弱，站点会显得像工具壳，而不是品牌站
- 验收标准：
  - 首页与 About 对品牌定位表达一致
  - PDP / Support 的 trust 语气和首页一致

### P0-4｜做 launch-grade QA

- 优先级：`P0-High`
- 当前状态：`待执行`
- 目标：
  在上线前把核心页面的结构性问题一次性收口
- 任务：
  - mobile QA
  - desktop QA
  - empty states QA
  - error states QA
  - support/legal cross-link QA
  - recovery flow QA
- 依赖：
  - P0-1 到 P0-3 基本完成
- 主要风险：
  - 如果先做 QA 再补 trust 和数据，会造成二次返工
- 验收标准：
  - 主链路无阻塞跳转
  - 无明显错链、空态断裂、恢复失败

### P0-5｜做一轮文案与语言一致性检查

- 优先级：`P0-Medium`
- 当前状态：`待执行`
- 目标：
  彻底确认新 storefront 没有旧 `/m`、中文、旧 mobile 术语残留
- 任务：
  - 扫公开页面 copy
  - 扫 compare / match / learn / support 里的旧术语
  - 扫 error / empty states
- 依赖：
  - P0 页面结构稳定
- 主要风险：
  - 语言层残留会直接损伤品牌可信度
- 验收标准：
  - 新 storefront 全链路英文口径统一

### P0 收口顺序

建议顺序：

1. `P0-1 commerce 覆盖率`
2. `P0-2 support inbox`
3. `P0-3 About / trust`
4. `P0-4 launch QA`
5. `P0-5 文案一致性扫尾`

## 四、P1 首批任务清单

### P1-1｜升级商品排序逻辑

- 优先级：`P1-High`
- 当前状态：`待执行`
- 目标：
  让列表页更优先展示“更适合上线、更容易继续决策”的商品
- 任务：
  - 整合 `fit confidence`
  - 整合 `commerce completeness`
  - 整合 `launch priority`
  - 在 Home / Shop / Collection / Search 中统一排序思路
- 依赖：
  - P0-1 commerce 覆盖率继续推进
- 风险：
  - 如果排序只看单一维度，会牺牲站点整体转化质量
- 验收标准：
  - 列表页前排商品更接近 launch-ready 与 fit-ready

### P1-2｜补 analytics 与关键漏斗定义

- 优先级：`P1-High`
- 当前状态：`待执行`
- 目标：
  让后续优化不再凭感觉
- 任务：
  - 定义 landing / PDP / add to bag / saved recovery
  - 定义 match completion / compare completion
  - 定义 search-to-PDP / collection-to-PDP
  - 明确事件命名和页面归因
- 依赖：
  - P0 主链路稳定
- 风险：
  - 没有统一埋点，后续 P1/P2 无法判断优化是否有效
- 验收标准：
  - 有一套统一的 pre-checkout funnel 指标定义

### P1-3｜做 performance / accessibility pass

- 优先级：`P1-High`
- 当前状态：`待执行`
- 目标：
  让美国站具备基础上线质量
- 任务：
  - 核查关键页面首屏资源
  - 核查交互可达性
  - 核查对比度、焦点态、错误提示
  - 核查 mobile/desktop 关键性能问题
- 依赖：
  - P0 主界面不再大改
- 风险：
  - 如果等到 P2/P3 再补，会和交易层改动叠加
- 验收标准：
  - 核心页面达到基本上线质量

### P1-4｜完成 proof strategy 第一版

- 优先级：`P1-High`
- 当前状态：`待执行`
- 目标：
  明确 Jeslect 在没有真实 reviews 数据源时，如何建立持续可信的 proof 层
- 任务：
  - 明确 evidence-first 的站内展示原则
  - 明确未来 reviews 的数据来源边界
  - 明确哪些页面展示 fit proof、哪些页面展示 quality trust
- 依赖：
  - 当前 evidence layer 已统一
- 风险：
  - 如果 proof strategy 不成型，品牌长期会停留在“解释很多，但不够像成熟商店”
- 验收标准：
  - 首页、Collection、PDP、Learn、Compare 的 proof 体系有统一规则

### P1-5｜强化 About / standards / quality trust

- 优先级：`P1-Medium`
- 当前状态：`待执行`
- 目标：
  让品牌可信度不只依赖 product-level explanation
- 任务：
  - About 结构深化
  - quality standards 页面化
  - ingredient philosophy 页面化
  - support 与 brand trust 做互相导流
- 依赖：
  - P0-3 初版完成
- 风险：
  - 如果品牌层始终太薄，外部流量会更依赖单一 PDP 说服
- 验收标准：
  - 品牌信任不再只压在 product pages 上

### P1-6｜优化 Search / Collection / PDP 转化链

- 优先级：`P1-Medium`
- 当前状态：`待执行`
- 目标：
  让发现页、专题页、商品页形成同一条转化系统
- 任务：
  - 优化 search result ordering
  - 优化 collection 里的 concern-to-product 逻辑
  - 优化 PDP 的 related / compare / learn assist
- 依赖：
  - P1-1 排序逻辑
  - P1-2 analytics
- 风险：
  - 没有数据支持就盲调转化链，容易变成主观改版
- 验收标准：
  - Search / Collection / PDP 的下一步动作更统一

### P1 首批执行顺序

建议顺序：

1. `P1-1 排序逻辑`
2. `P1-2 analytics`
3. `P1-3 performance / accessibility`
4. `P1-4 proof strategy`
5. `P1-5 brand trust`
6. `P1-6 conversion chain`

## 五、P2 Pay-Ready 架构任务清单

### P2-1｜固化 SKU / variant / commerce schema

- 优先级：`P2-High`
- 当前状态：`待执行`
- 目标：
  为 cart / checkout / order 提供稳定的商品交易模型
- 任务：
  - 区分 product 与 variant
  - 明确 price / currency / pack size / inventory 的归属
  - 为未来 tax / duties 留扩展位
- 依赖：
  - 当前 commerce feed 基础已存在
- 风险：
  - 如果继续用 catalog-only product 模型承接交易，会在 checkout 时断裂
- 验收标准：
  - 后端 schema 可以稳定承接交易前字段

### P2-2｜把 Bag 升级成 checkout-ready cart

- 优先级：`P2-High`
- 当前状态：`待执行`
- 目标：
  让当前 Bag 从“saved shortlist”升级成真正可进入 checkout 的 cart
- 任务：
  - 规范 cart item 结构
  - 规范 quantity / variant / inventory check
  - 规范 cart persistence 与恢复
- 依赖：
  - P2-1 商品交易模型
- 风险：
  - 如果 cart 结构不升级，未来支付前会发生大量二次兼容
- 验收标准：
  - cart 数据结构已能对接 checkout

### P2-3｜建立 checkout draft

- 优先级：`P2-High`
- 当前状态：`待执行`
- 目标：
  在支付未开放时，先把 checkout session 前的数据流跑通
- 任务：
  - 建 `checkout draft`
  - 处理 cart -> checkout draft
  - 处理 draft 的恢复和过期
- 依赖：
  - P2-2 cart 升级
- 风险：
  - 没有 draft 层，未来一接 PSP 就会把页面状态和交易状态耦死
- 验收标准：
  - checkout draft 可创建、读取、恢复

### P2-4｜建立 address / shipping option / quote 结构

- 优先级：`P2-High`
- 当前状态：`待执行`
- 目标：
  为未来履约和支付前最终确认提供结构基础
- 任务：
  - 建 address model
  - 建 shipping option model
  - 建 shipping quote 占位结构
  - 预留不同区域扩展位
- 依赖：
  - P2-3 checkout draft
- 风险：
  - 只做支付、不做 shipping，会导致“能付款，不能交付”的伪闭环
- 验收标准：
  - checkout draft 已能挂 address 与 shipping option

### P2-5｜建立 order draft 状态机

- 优先级：`P2-High`
- 当前状态：`待执行`
- 目标：
  在没有支付的情况下，也先把交易状态机设计清楚
- 任务：
  - 建 `order draft`
  - 建 `pending payment`
  - 建 `abandoned checkout`
  - 预留 `paid / failed / refunded / disputed`
- 依赖：
  - P2-3 checkout draft
  - P2-4 shipping structure
- 风险：
  - 如果 payment state 和 order state 混为一谈，后面 webhook 会很难收
- 验收标准：
  - order 与 payment 有清晰分层

### P2-6｜建立 PaymentProviderAdapter 边界

- 优先级：`P2-High`
- 当前状态：`待执行`
- 目标：
  让未来接 PSP 时，不把供应商 SDK 绑进业务层
- 任务：
  - 定义 adapter interface
  - 定义 checkout session input/output
  - 定义 webhook event mapping
- 依赖：
  - P2-5 order draft 状态机
- 风险：
  - 如果直接把某 PSP 写进页面和业务逻辑，后续换 PSP 成本会非常高
- 验收标准：
  - 业务层可以不感知具体 PSP 字段

### P2-7｜新增 `/checkout` skeleton

- 优先级：`P2-Medium`
- 当前状态：`待执行`
- 目标：
  在支付未开放时，先把 checkout 结构与 UX 流程建起来
- 任务：
  - 起 `/checkout`
  - 承接 cart -> checkout draft
  - 接 address / shipping option
  - 支付按钮保持 disabled 或未开放说明
- 依赖：
  - P2-3
  - P2-4
- 风险：
  - 如果没有 skeleton，未来一接 pay 就会让前端同时做结构、状态、支付三件事
- 验收标准：
  - checkout 可走通到 payment-disabled 状态

### P2-8｜补幂等与恢复链

- 优先级：`P2-Medium`
- 当前状态：`待执行`
- 目标：
  避免未来交易链出现重复提交、状态错乱和恢复失败
- 任务：
  - draft 写入幂等
  - create session 幂等
  - checkout abandon 恢复
  - cart / checkout / order 关系校验
- 依赖：
  - P2-3 到 P2-7
- 风险：
  - 没有幂等与恢复，支付上线后最容易出脏状态
- 验收标准：
  - 同一用户重复操作不会制造多份脏状态

### P2 执行顺序

建议顺序：

1. `P2-1 schema`
2. `P2-2 cart`
3. `P2-3 checkout draft`
4. `P2-4 address / shipping`
5. `P2-5 order draft`
6. `P2-6 payment adapter`
7. `P2-7 checkout skeleton`
8. `P2-8 幂等与恢复`

## 六、P3 触发条件与预备动作

### 触发条件

只有这些条件明确后，才应该开 P3：

- 支付政策路径明确
- 商户主体明确
- 结算路径明确
- 支付服务商可正式接入
- P2 已准备好交易骨架

### P3 启动前应提前准备

- 选 PSP
- 明确 webhook 安全策略
- 明确支付成功/失败/取消回跳路由
- 明确退款与 dispute 的支持边界
- 明确美国站支付后 support 处理流程

## 七、当前最推荐的下一步

如果按当前项目节奏继续推进，建议这样执行：

1. 先收 `P0-1` 到 `P0-3`
2. 然后立即开 `P0-4 QA`
3. P0 收口后，立刻启动 `P1-1`、`P1-2`、`P1-3`
4. 与此同时开始设计 `P2-1` 和 `P2-2`

一句话：

不要等 pay 能做时才开始准备交易骨架。现在最正确的节奏，是一边收完 P0，一边给未来 P3 铺 P2 的路。
