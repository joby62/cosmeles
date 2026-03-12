# Jeslect / Cosmeles 中文说明

> 最后更新：2026-03-13

英文版请见：[README.md](README.md)

详细四阶段执行版请见：[docs/JESLECT_PHASE_PLAN.zh-CN.md](docs/JESLECT_PHASE_PLAN.zh-CN.md)
执行清单版请见：[docs/JESLECT_EXECUTION_CHECKLIST.zh-CN.md](docs/JESLECT_EXECUTION_CHECKLIST.zh-CN.md)
当前周执行面板请见：[docs/JESLECT_WEEKLY_BOARD.zh-CN.md](docs/JESLECT_WEEKLY_BOARD.zh-CN.md)

## 当前主线

`jeslect.com` 目前的主执行方向，仍然是美国优先的英文独立站。

当前项目状态：

- 主市场：美国优先，英国次之
- 产品形态：英文优先的 beauty / personal-care 独立站
- 运营边界：支付前 storefront
- 核心模型：`fit-first`，先讲适配度，再讲商品
- 当前明确不做：checkout、payment、order management

一句话理解：

Jeslect 现在不是完整商城，而是一个帮助用户在下单前更快看懂、比清楚、保存决策路径的英文独立站。

当前活跃前端：

- `frontend/`：Jeslect 新英文独立站
- `frontend-legacy/`：旧中文 / mobile 结构，仅保留作能力参考

## 本地运行

推荐开两个终端：先起后端，再起前端。

### 1. 启动后端

```bash
cd /Users/lijiabo/cosmeles/backend
PYTHONPATH='/Users/lijiabo/cosmeles/backend' conda run -n cosmeles uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

说明：

- 后端地址：`http://127.0.0.1:8000`
- 如果需要 Doubao 能力，先补 `backend/.env.local`
- 健康检查：

```bash
curl -s http://127.0.0.1:8000/healthz
curl -s http://127.0.0.1:8000/readyz
```

### 2. 启动前端

另开一个终端：

```bash
cd /Users/lijiabo/cosmeles/frontend
npm run dev
```

说明：

- 前端地址：`http://127.0.0.1:3000`
- 前端 `/api/*` 会转发到本地 `8000`
- 如果要显示真实 support contact，可补 `frontend/.env.local`

### 3. 本地访问入口

- 主站：`http://127.0.0.1:3000`
- Commerce 工作台：`http://127.0.0.1:3000/ops/commerce`

### 4. 中文切换 demo

- 用 header 里的 `EN / 中` 切换
- 当前 demo 只切壳层：
  - header / footer 语气
  - 导航标签
  - 中文品牌字标 `婕选`
- 页面正文目前大多仍保持英文，这是刻意控制范围的 demo，不是全站 i18n

### 5. 验证命令

前端 lint：

```bash
cd /Users/lijiabo/cosmeles/frontend
node ./node_modules/eslint/bin/eslint.js app components lib --max-warnings=0
```

前端 build：

```bash
cd /Users/lijiabo/cosmeles/frontend
node ./node_modules/next/dist/bin/next build --debug
```

后端 pytest：

```bash
PYTHONPATH='/Users/lijiabo/cosmeles:/Users/lijiabo/cosmeles/backend' conda run -n cosmeles pytest '/Users/lijiabo/cosmeles/backend/tests/test_mobile_compare.py' -q
```

## 当前产品定位

### 一句话定位

Jeslect 帮用户更快找到适合自己日常护理方案的产品，少靠猜，少走弯路。

### 内部产品定义

Jeslect 是一个以“适配度优先”为核心的个护决策型 storefront，覆盖 hair、body、skin 三条主线。

### 它当前在解决什么问题

- 降低用户的选品焦虑
- 比普通商品网格更清楚地解释“为什么适合你”
- 把 shipping、returns、support 提前到支付前链路
- 在 Bag、Match、Compare、Saved 之间保留用户进度
- 把内容理解和商品决策接到一条路径里

### 它当前不打算解决什么

- 完整支付闭环
- 订单与售后系统
- 支付后的履约链路
- 虚构 price / stock / ETA 的“伪完整商店”

## 用户价值

Jeslect 当前提供的价值，可以概括成 4 层。

### 1. 更清楚

用户可以快速理解：

- 这是什么产品
- 适合谁
- 不适合谁
- 为什么它适合这条 route

### 2. 更适合

用户不是被迫在大 catalog 里盲选，而是可以通过这些路径逐步收敛：

- `Match`
- `Compare`
- `Learn`
- 按问题进入的 concern-first browsing

### 3. 更安心

在没有 checkout 的阶段，用户依然能提前看到基础信任信息：

- shipping 说明
- returns 说明
- support 路径
- ingredient transparency
- privacy / terms / cookies 的边界

### 4. 不断档

用户离开后再回来，不需要重来。

当前已支持恢复：

- Bag
- Saved
- Match history
- Compare history
- recent product views

## 品牌语言

Jeslect 的语气应当是：

- 冷静
- 具体
- 有用
- 不评判用户

Jeslect 应避免：

- 过度奢华和高冷话术
- 模糊的“科技感”堆词
- 夸大效果
- 高压式电商文案

### 当前推荐首页 Hero

- Eyebrow：`Jeslect US`
- Headline：`Find products that fit your routine.`
- Subheadline：`Shop hair, body, and skin care with clearer fit, cleaner comparisons, and less guesswork.`
- Primary CTA：`Find my match`
- Secondary CTA：`Shop by concern`

## 当前公开信息架构

当前已在执行范围内的公开路由：

- `/`
- `/shop`
- `/shop/[category]`
- `/collections/[slug]`
- `/product/[id]`
- `/match`
- `/match/[sessionId]`
- `/compare`
- `/compare/[compareId]`
- `/learn`
- `/learn/product/[productId]`
- `/learn/ingredient/[category]/[ingredientId]`
- `/search`
- `/bag`
- `/saved`
- `/support`
- `/support/shipping`
- `/support/returns`
- `/support/faq`
- `/support/contact`
- `/privacy`
- `/terms`
- `/cookies`
- `/about`
- `/ops/commerce`（内部运营入口）

## 当前阶段计划

这部分基于当前分支真实状态，不是理想化 wishlist。

### P0｜美国站支付前 Launch Baseline

状态：

- 进度：约 `93%~95%`
- 阶段：`late P0 / launch hardening`

目标：

做一个面向美国市场的英文独立站，让用户在没有 checkout 的前提下，也能完成发现、理解、测配、对比、保存与支持信息查看。

P0 范围：

- 英文独立站骨架
- 美国优先 IA
- fit-first 决策链
- support / legal 基线
- saved-state continuity
- commerce readiness 和 feed plumbing
- 不做 payment / checkout / order management

P0 已完成：

- 新独立站已在 `frontend/`
- 老前端已冻结到 `frontend-legacy/`
- Home、Shop、Category、Product、Match、Compare、Learn、Bag、Saved、Search、Collections 已落地
- Support hub 与 Shipping / Returns / FAQ / Contact / Privacy / Terms / Cookies 已落地
- Bag、Saved、Match、Compare、recent views 可恢复
- product commerce readiness 已从后端贯通到前端
- 已有内部 commerce workbench
- 已支持 JSON / CSV / TSV 导入 commerce 数据
- 已有可配置的 support contact 入口
- Product / Learn / Compare 的 evidence trust 层已统一
- 公开商品排序已开始优先展示 commerce 完整度更高的产品

P0 还剩：

- 继续补更多产品的真实 commerce 数据：
  `price / inventory / shipping ETA / pack size`
- 在生产环境配置真实 support inbox
- 再做一轮 launch-grade QA：
  mobile layout
  desktop layout
  empty states
  error states
  support/legal cross-links
- 继续把首页、About、trust language 精修到更像 launch-ready 品牌，而不是“功能都接上了”

P0 明确不做：

- checkout
- payment
- shipping method selection
- order creation
- post-purchase support operations

P0 出关标准：

- 美国用户能顺利完成 discovery -> decision
- 新站没有中文残留
- 不展示假 commerce 数据
- trust 页面可见且内部口径一致
- 关键流程可恢复
- 首屏浏览不会因为 commerce 数据太空而显得站点发 hollow

### P1｜Launch Hardening + Conversion Foundation

状态：

- 进度：约 `25%~35%`
- 阶段：地基已铺，但还没彻底执行完

目标：

把现在“能用、真实”的 storefront，推进到“更能承压、更能转化”的状态。

P1 重点：

- 提高 catalog 的真实 commerce 覆盖率
- 做更好的 ranking：fit confidence + commerce completeness
- 做更完整的 trust / proof strategy
- 强化 About / brand standards / quality trust
- 强化 Search / Collection / Category / PDP 的统一转化逻辑
- 做 analytics、accessibility、performance 的 launch pass
- 把 support 从页面层推进到运营层

P1 完成标志：

- 高意图用户能在大多数商品上看到足够真实的 commerce 信息
- 站点有完整 trust strategy，不只是 support links
- Search、Category、Collection、PDP 开始像一个统一转化系统
- 在没有 checkout 的前提下，也能承接更大流量

### P2｜Full Shop + Regional Expansion

状态：

- 进度：约 `5%~10%`
- 阶段：刻意延后，尚未主执行

目标：

把 Jeslect 从 pre-checkout storefront 升级成真正可交易的独立站，并准备向英国等区域扩展。

P2 范围：

- checkout
- payment
- address handling
- shipping methods
- order confirmation
- order history
- post-purchase support
- UK regionalization
- lifecycle systems：
  email
  account
  loyalty / bundles / subscriptions（如确有必要）

P2 前提：

- P0 足够稳定
- P1 的 trust 和 commerce 覆盖率足够高
- 支付和订单系统是按独立站标准设计，不是后补拼接

## 当前进度结论

截至 `2026-03-12`：

- 如果按“美国站支付前 storefront”算，P0 已经接近完成
- 如果按“完整 shop”算，当前仍然主要在支付前阶段
- 当前最大短板已经不是页面骨架，而是：
  - 真实 commerce 数据覆盖率
  - trust / proof strategy
  - support / 运营准备度

一句话总结：

Jeslect 已经跨过“新独立站已经存在且能工作”的门槛，当前主要卡在 launch hardening，而不是页面缺失。

## 中国市场参考定位

这部分不是当前主执行线，而是对中国市场的策略参考。

### 我的判断

这套价值观，中国用户能理解，也能接受，但不能原样照搬美国站表达。

中国版更适合卖的是：

- 少踩坑
- 讲明白
- 更适合你

而不是直接照搬美国站的：

- clarity
- fit
- confidence
- continuity

### 中国市场的一句话定位

Jeslect 帮你更快选到适合自己日常护理方案的产品，少靠猜，少踩坑。

### 中国版内部产品定义

Jeslect 是一个以“适配度优先”为核心的个护决策与选购平台。

### 中国版用户价值主张

- 更清楚：这是什么，适合谁，不适合谁，为什么推荐它
- 更适合：不是只看热卖，而是看是否适合你的肤质、发质、使用场景和护理目标
- 更安心：成分、注意点、退换规则、支持路径提前说清楚
- 不断档：看到一半离开，再回来也能接着选

### 中国版品牌主张

Jeslect，不是让你看更多，而是帮你少买错。

### 中国市场可能性判断

我认为中国市场有机会，但更适合做成：

- 内容型个护决策助手
- 少踩坑型选购入口
- 成分与适配度导向的决策平台

而不是：

- 一个照搬美国独立站表达的极简商城

### 中国市场的主要阻力

- 用户通常需要更高的信息确定性
- 对社会证明、专业背书和平台评价更敏感
- 决策经常发生在小红书、抖音、天猫、京东等平台生态
- 除“适不适合”外，也会持续追问“值不值”

## 中国版首页文案稿

这部分是中国市场参考用文案，不是当前美国站线上文案。

### Hero 首屏

推荐版本：

- Eyebrow：`Jeslect 个护决策`
- Headline：`帮你更快选到更适合的护理产品`
- Subheadline：`从洗护、身体护理到护肤，先讲清楚适不适合你，再决定买什么。`
- Primary CTA：`开始测一测`
- Secondary CTA：`按问题选产品`

更直接的版本：

- Headline：`少踩坑，选对更适合你的护理产品`
- Subheadline：`不知道怎么选？先测、先比、先看明白。`

### 信任条

- `成分信息更清楚`
- `适合谁一眼看懂`
- `支持对比和继续保存`
- `离开回来也能接着看`

### 按问题进入

标题：

- `先从你的问题开始`

入口建议：

- `干燥缺水`
- `敏感泛红`
- `毛躁打结`
- `油腻厚重`
- `屏障脆弱`

### 测配模块

- 标题：`不知道怎么选？先测一测`
- 正文：`回答几个简单问题，快速缩小范围，找到更适合你的选择。`
- 按钮：`开始测配`

### 对比模块

- 标题：`两款之间拿不准？直接对比`
- 正文：`把关键差异、适合人群和使用场景放在一起看，少纠结。`
- 按钮：`开始对比`

### 百科模块

- 标题：`买之前，先看明白`
- 正文：`看懂成分、使用方法和常见问题，再决定要不要买。`
- 按钮：`去看百科`

### 精选商品模块

- 标题：`从这些开始更省心`
- 副标题：`适合第一次来、想快速做决定的人`

### 恢复流程模块

- 标题：`上次看到哪，这次接着看`
- 正文：`购物袋、对比记录、测配结果和最近浏览都会帮你保留下来。`

### 支持与安心模块

- 标题：`重要信息提前说清楚`
- 内容建议：
  - `成分信息`
  - `适合人群`
  - `退换说明`
  - `支持联系`

### 页脚短句

- `Jeslect 帮你把“适不适合我”这件事先讲清楚。`

## 中国版 PDP 文案结构稿

中国版 PDP 不适合做得太空，需要更快把“适不适合、差在哪、值不值”讲出来。

### 1. 首屏摘要区

建议顺序：

- 产品名
- 一句话核心收益
- 适合人群标签
- 不适合人群标签
- 核心卖点 2~3 条
- 主 CTA：`加入购物袋`
- 次 CTA：`开始对比` / `测一测是否适合我`

### 2. 为什么推荐它

标题建议：

- `为什么它更适合你`

内容结构：

- 适合解决什么问题
- 更适合什么肤质 / 发质 / 使用场景
- 如果你在意什么，这个产品能带来什么帮助

### 3. 不适合谁

标题建议：

- `这些情况不太建议优先选它`

这部分在中国市场很重要，因为它能快速建立可信度。

### 4. 关键成分与作用

标题建议：

- `关键成分在起什么作用`

内容结构：

- 关键成分
- 各自作用
- 适合关注什么问题的人看
- 完整成分表入口

### 5. 使用方式

标题建议：

- `怎么用更合适`

内容结构：

- 使用顺序
- 使用频率
- 建议用量
- 可搭配的 routine

### 6. 对比入口

标题建议：

- `还在两款之间犹豫？`

正文建议：

- `把关键差异放在一起看，少一点纠结。`

### 7. 证据 / 依据区

标题建议：

- `为什么我们这样判断`

内容结构：

- fit basis
- evidence highlights
- tradeoffs
- 风险边界

### 8. 常见问题

优先问题：

- 适不适合敏感肌 / 敏感头皮
- 适合什么时候用
- 如何搭配其他产品
- 有哪些边界和注意点
- 退换和支持怎么联系

### 9. 相关推荐

建议不是简单“猜你喜欢”，而是：

- `适合搭配使用`
- `如果你更在意温和，可以看这个`
- `如果你更在意修护，可以看这个`

## 本地开发

### 后端

```bash
cd /Users/lijiabo/cosmeles/backend
PYTHONPATH='/Users/lijiabo/cosmeles/backend' conda run -n cosmeles uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

### 前端

```bash
cd /Users/lijiabo/cosmeles/frontend
npm run dev
```

打开：

- `http://127.0.0.1:3000`

### 可选 support env

如果你希望 `/support/contact` 显示真实联系通道，可以在 `frontend/.env.local` 添加：

```env
SUPPORT_EMAIL=hello@jeslect.com
SUPPORT_RESPONSE_WINDOW=Replies within 1-2 business days
SUPPORT_HOURS=Mon-Fri, 9:00 AM-6:00 PM ET
SUPPORT_SCOPE_NOTE=Pre-purchase fit, shipping, and policy questions only.
```

## Legacy 说明

旧的 MatchUp / mobile-first 中文实现仍然保留在仓库中，仅用于能力复用和参考，不是当前 Jeslect 美国站的产品方向。
