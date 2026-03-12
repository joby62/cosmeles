# Jeslect 四阶段执行版路线图

> 最后更新：2026-03-12

执行清单版请见：[JESLECT_EXECUTION_CHECKLIST.zh-CN.md](JESLECT_EXECUTION_CHECKLIST.zh-CN.md)

适用范围：

- 当前仓库：`/Users/lijiabo/cosmeles`
- 当前主执行分支：`codex/english-shop-standalone`
- 当前主市场：美国优先，英国次之
- 当前政策前提：`pay 模块暂不接入`

这份文档是执行版路线图，不是品牌层面的愿景文案。
它用于回答 5 个问题：

- 我们现在在哪个阶段
- 每个阶段到底要完成什么
- 当前卡点是什么
- 接下来按什么顺序推进
- pay 模块未来怎么接，才能不推翻现在的架构

## 一、总判断

当前项目不是在“从 0 到 1 搭独立站”，而是在“收完美国站支付前上线基线”。

如果按四阶段重排，当前进度判断如下：

- `P0`：`93%~95%`
- `P1`：`25%~35%`
- `P2`：`10%~15%`
- `P3`：`0%~5%`

当前最重要的结论：

- 页面骨架不是主要问题
- 当前主要问题是：
  - commerce 数据覆盖率
  - trust / proof strategy
  - support / 运营准备度
- pay 虽然暂时不能做，但现在就必须开始做 `pay-ready architecture`

## 二、四阶段总览

### P0｜美国站支付前上线基线

一句话：

先把美国站做成一个真实、可恢复、可解释、可承接用户决策的 storefront。

目标边界：

- 允许：发现、筛选、测配、对比、学习、保存、查看支持与政策
- 不允许：伪造价格、库存、配送时效
- 不做：checkout、payment、order creation

### P1｜上线加固与转化基础

一句话：

把现在“能用”的站，推进到“敢放量”的站。

目标边界：

- 强化内容、排序、信任、性能、可访问性、监测
- 让 Search / Category / Collection / PDP 真正形成一套转化系统

### P2｜交易核心就绪，但先不接支付

一句话：

把未来最难补的交易骨架先建起来，但支付本身继续延后。

目标边界：

- 允许：cart / checkout skeleton / address / shipping option / order draft
- 不允许：接真实支付、真实扣款

### P3｜支付激活、订单闭环、区域扩展

一句话：

在政策与主体条件就绪后，再把 Jeslect 升级成真正可成交的独立站。

目标边界：

- 支付接入
- 订单闭环
- 售后支持
- 美国站稳定后，再做英国区域化

## 三、P0 执行计划

### 当前状态

P0 已经接近完成。当前站点已经具备：

- 新英文独立站骨架
- Home / Shop / Category / Product / Match / Compare / Learn / Search / Bag / Saved / Collections
- support / legal 基础层
- evidence-based trust
- support contact 配置能力
- saved / recovery 能力
- commerce readiness 与导入工具

### P0 核心目标

- 美国用户能从 discovery 平稳走到 decision
- 新站不再依赖旧中文 `/m` 结构
- 站点在没有支付的情况下也保持真实可信
- 关键信息前置，不让用户“赌”

### P0 剩余任务

- 补更多产品的真实 `price / inventory / shipping ETA / pack size`
- 配置生产环境 `support inbox`
- 做一轮 launch-grade QA
- 补 `About / brand standards / trust language`
- 再检查一次全站中英文口径一致性

### P0 依赖

- 真实商品数据源持续补录
- 支持邮箱或工单入口明确
- 运营侧确认 shipping / returns / support 对外口径

### P0 风险

- 商品页结构已经像可上线商店，但 commerce 数据覆盖率如果不够，会让站点显得空
- 没有真实支持通道时，support 页会形成“有入口、弱运营”落差
- About / trust 不够强时，品牌会显得“工具站”而不是“品牌站”

### P0 验收标准

- 用户从首页进入，不会走到死路
- 新站没有中文残留
- 不展示假价格、假库存、假 ETA
- Bag、Saved、Match、Compare 可恢复
- Support / Privacy / Terms / Cookies / Shipping / Returns 内部口径一致

### P0 建议排期

- `第 1 周`
  - 补 commerce 数据覆盖率
  - 配 support inbox
  - 起 About / trust copy
- `第 2 周`
  - 做 launch QA
  - 修 mobile / desktop / error / empty states
  - 收最后一轮 trust polish

## 四、P1 执行计划

### 当前状态

P1 的结构地基已经铺了一部分，但还没有进入系统执行阶段。

已经有的前置能力：

- evidence layer
- collections
- search
- saved / recent
- support/legal 架子
- commerce completeness 排序基础

### P1 核心目标

- 让站点从“诚实可用”变成“可放量承压”
- 让转化逻辑形成闭环，而不是页面各自成立

### P1 主要任务

- 提高 catalog 的真实 commerce 覆盖率
- 强化 `fit confidence + commerce completeness + launch priority` 排序
- 完善 `proof strategy`
- 强化 About / brand standards / ingredient philosophy / quality trust
- 做 Search / Category / Collection / PDP 的统一转化链优化
- 做 analytics / accessibility / performance 上线加固
- 建立 support 页面到运营响应的闭环

### P1 依赖

- P0 基本收口
- commerce 数据补录持续推进
- 品牌侧确定 About / quality trust 的表达边界
- support 运营路径明确

### P1 风险

- 如果 proof strategy 不成型，站点会长期停留在“功能强，但社会证明弱”
- 如果排序逻辑不继续进化，Search / Collection 的转化效率会卡住
- 如果 analytics 不补，后续优化会失去抓手

### P1 验收标准

- 高意图用户在大多数主力商品上能看到足够真实的商业信息
- 首页、列表页、PDP、support 的信任语言统一
- Search / Category / Collection / PDP 真正形成同一套转化系统
- 可访问性和性能达到上线基线

### P1 建议排期

- `第 3 周`
  - 排序逻辑升级
  - About / trust 标准页
- `第 4 周`
  - analytics / accessibility / performance pass
  - proof strategy 第一版
- `第 5 周`
  - Search / Collection / PDP 转化优化
  - support 运营闭环收口

## 五、P2 执行计划

### 当前状态

P2 还没显式开始，但不是完全没准备。

已经有的前置地基：

- Bag continuity
- commerce schema / readiness
- product commerce update flow
- support/legal 基础
- 可恢复的用户状态链

### 为什么 P2 现在就该做

当前政策原因虽然不能接 pay，但如果我们等到 pay 可以做时才补交易骨架，会让未来改动非常大。

P2 的价值是：

- 把未来最难补的领域模型先建好
- 让后续支付接入变成“接能力”，不是“重构系统”

### P2 核心目标

- 把 storefront 推进到 `checkout-ready but payment-disabled`

### P2 主要任务

- 规范 SKU / variant / price / currency / inventory / pack size 模型
- 把 Bag 从 `saved shortlist` 升级成 `checkout-ready cart`
- 建 `checkout draft` 结构
- 建 `address` 结构
- 建 `shipping option / shipping quote` 结构
- 预留 `tax / duties` 扩展位
- 建 `order draft / pending payment / abandoned checkout` 状态机
- 做幂等性和恢复链
- 新增 `/checkout` skeleton，但支付按钮继续 disabled 或未开放
- 预留 `payment provider adapter` 边界

### P2 依赖

- P0 稳定
- 商品 commerce 数据结构稳定
- shipping / returns 的运营口径更明确

### P2 风险

- 如果 cart / checkout / order 不先抽象，后面接 PSP 时会把现有 storefront 逻辑撕开
- 如果 shipping / address 模型不提前做，支付接入会卡在“能付钱但不能履约”
- 如果没有幂等和 order draft，未来会出现重复单和状态错乱风险

### P2 验收标准

- 即使没有 pay，checkout 数据流也已经能自洽
- cart / checkout / order draft 状态明确
- address / shipping option 已能承接未来真实集成
- 前端和后端都已经留出 PSP 接口边界

### P2 建议排期

- `第 6 周`
  - SKU / variant / commerce schema 固化
  - cart 升级
- `第 7 周`
  - checkout draft
  - address / shipping option / quote 结构
- `第 8 周`
  - order draft 状态机
  - 幂等与恢复
  - checkout skeleton

## 六、P3 执行计划

### 当前状态

P3 现在基本未启动，因为它依赖外部条件，而不是前端页面数量。

### P3 核心目标

- 在政策与主体条件就绪后，真正把支付接进来
- 建成订单闭环与售后闭环
- 为美国站稳定后扩到英国做准备

### P3 主要任务

- 选择并确认支付服务商
- 实现 `create checkout session`
- 实现支付回跳、取消、失败、重试流程
- 实现 webhook 驱动的支付状态同步
- 实现 `paid / failed / refunded / disputed` 状态流转
- 订单确认页
- 订单确认邮件
- post-purchase support 联动
- 美国站稳定后再做 UK 的 shipping / returns / support 差异化

### P3 依赖

- 政策条件允许
- 商户主体、结算、合规路径明确
- P2 已经准备好交易骨架

### P3 风险

- 如果没有先做 P2，P3 会演化成一次高风险重构
- 如果 webhook / order state 没设计好，支付成功和订单状态会脱节
- 如果先做 UK，再稳美国，会把支持和政策复杂度提前拉爆

### P3 验收标准

- 可以真实完成支付
- 订单状态与支付状态一致
- 支付失败、取消、退款都有明确恢复路径
- 美国站可以稳定承接真实交易

### P3 建议排期

- `政策条件就绪后`
  - `第 1 周`：PSP 接入与 session 创建
  - `第 2 周`：回跳、失败、取消、webhook
  - `第 3 周`：order confirmation 与支持联动
  - `第 4 周`：灰度、回放、稳定性修边

## 七、未来 pay 模块接入部署

这部分是当前最需要提前设计的。

### 当前为什么不能做

当前不是工程实现阻塞，而是策略与外部条件阻塞：

- 政策原因
- 支付主体与结算路径未最终落定
- 相关对外承诺不能提前上线

所以当前不应该做的是：

- 强接某个 PSP SDK
- 写死某个支付流
- 在前台制造“已经可以付款”的预期

### 当前应该提前做什么

- 固定 commerce 单一真源
- 固定 cart / checkout / order draft 领域模型
- 固定 address / shipping option 数据结构
- 预留 payment provider adapter
- 预留 webhook / event 处理框架
- 做 checkout failure / recovery 体验链
- 让 support / legal 文案提前为未来支付闭环留口

### 建议的支付接入顺序

1. 冻结交易领域模型  
2. 补完 `/checkout` skeleton  
3. 定义 `PaymentProviderAdapter` 接口  
4. 接具体 PSP 的 session 创建  
5. 接 webhook 和状态同步  
6. 接订单确认页与邮件  
7. 做失败 / 取消 / 重试恢复  
8. 灰度上线，再扩大流量

### 支付模块的接口边界建议

前端侧建议独立出：

- `createCheckoutSession`
- `resumeCheckout`
- `handleCheckoutCancel`
- `handleCheckoutSuccess`

后端侧建议独立出：

- `POST /api/checkout/draft`
- `POST /api/checkout/session`
- `POST /api/payments/webhook`
- `GET /api/orders/{id}`

注意：

- 不要让前端直接依赖 PSP 特定字段
- 不要把支付状态当成订单状态
- 不要把 webhook 逻辑写进页面层

### 支付上线前的硬门槛

- 主力商品有真实 price / inventory / shipping 信息
- checkout draft 数据结构稳定
- order draft 状态机稳定
- support 可以承接支付后的问题
- policy / terms / returns 已覆盖支付后场景
- 至少完成一轮失败回放和异常演练

## 八、当前建议执行顺序

如果我们按当前状态继续推进，建议顺序是：

1. 收完 `P0`
2. 进入 `P1`
3. 在 pay 还不能做时，提前做 `P2`
4. 等政策条件成熟，再开 `P3`

不要反过来：

- 不要在 P0 还没收口时急着做支付
- 不要在 P2 没准备好的情况下直接接 PSP
- 不要在美国站没稳定前先扩英国

## 九、当前最值得盯的 6 个指标

- `P0`：commerce 覆盖率
- `P0`：support inbox readiness
- `P0`：launch QA 缺陷收口率
- `P1`：Search / Collection / PDP 转化链表现
- `P2`：checkout draft 数据完整度
- `P3`：支付状态与订单状态一致性

## 十、给当前项目状态的最终判断

如果目标是“先做美国站支付前独立站”，我们已经非常接近可上线基线。

如果目标是“未来无缝升级成完整 shop”，现在最重要的不是抢做 pay，而是：

- 先把 `P0` 收完
- 再把 `P1` 做实
- 然后把 `P2` 交易骨架提前准备好

一句话总结：

Jeslect 当前已经跨过“新独立站已存在”的阶段，接下来最重要的是把它从“可展示”推进到“可上线、可承压、可接支付”。
