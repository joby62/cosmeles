export const BAG_TRUST_POINTS = [
  "袋中商品会保存在当前设备上，离开后回来也不用重新加一遍。",
  "配送、退货和支持入口会在做决定之前持续可见，而不是埋到后链路里。",
  "每个已存商品都能一跳回到详情、对比和探索页面。",
] as const;

export const BAG_SUPPORT_LINKS = [
  {
    title: "配送说明",
    summary: "提前看清处理时效、运输节奏和追踪预期。",
    href: "/support/shipping",
  },
  {
    title: "退货规则",
    summary: "在加入袋中之前先看退货时限、退款节奏和条件要求。",
    href: "/support/returns",
  },
  {
    title: "联系路径",
    summary: "在订单系统未开放前，先明确商品、配送和退货问题该去哪里问。",
    href: "/support/contact",
  },
] as const;

export const SHIPPING_SECTIONS = [
  {
    title: "下单前应该看到什么",
    items: [
      "处理时间和运输时间应分开展示，让总等待时长更容易理解。",
      "配送时效应在商品页和袋中页提前可见，而不是进入支付后才出现。",
      "追踪信息的预期应属于购物流程的一部分，而不是只出现在售后邮件里。",
    ],
  },
  {
    title: "当前配送口径",
    items: [
      "当前站点先以美国市场的配送表达为主，后续再补英国专属规则。",
      "发货地与当前服务地区应直接说清楚，不让用户自己猜。",
      "如果某件商品走的是不同履约路径，应在下单前就讲明白。",
    ],
  },
  {
    title: "不该被隐藏的信息",
    items: [
      "配送费用是否清楚",
      "处理延迟或更慢路线是否前置",
      "追踪交接预期是否明确",
    ],
  },
] as const;

export const RETURNS_SECTIONS = [
  {
    title: "用户购买前需要知道什么",
    items: [
      "退货时限应该在进入支付前就能看到。",
      "退款节奏应该用直白语言说明，而不是堆政策术语。",
      "如果有品类例外，应直接点名，不要让用户事后才发现。",
    ],
  },
  {
    title: "退货页应该怎么建立信任",
    items: [
      "退货页应该像帮助决策的说明页，而不是防御性的法律陷阱。",
      "条件要求要足够具体，让用户一眼能理解。",
      "如果用户不确定是否适用，应始终能看到下一步去哪里问。",
    ],
  },
  {
    title: "哪些信息应该靠近袋中页",
    items: [
      "退货窗口摘要",
      "商品状态要求",
      "商品与订单问题的联系入口",
    ],
  },
] as const;

export const FAQ_ITEMS = [
  {
    question: "离开站点后，袋中内容还会保留吗？",
    answer: "会。当前设备会保存你的袋中 shortlist，回来后不用从头重新加。",
  },
  {
    question: "现在可以直接在婕选下单吗？",
    answer:
      "还不可以。当前站点重点在发现、测配、对比、探索和已存恢复，checkout、payment 和 order flow 还没有开放。",
  },
  {
    question: "为什么有些商品还没有价格、库存或配送时效？",
    answer:
      "因为当前商品数据源还没有稳定提供这些真实字段。婕选宁可先展示适配、成分和支持路径，也不会为了看起来更像商店而虚构商业信息。",
  },
  {
    question: "测配和对比怎么接起来？",
    answer: "测配会先保存你当前品类的路线结论，对比页再复用这份基础去判断候选商品是否更适合你。",
  },
  {
    question: "配送和退货信息在哪里看？",
    answer: "它们会作为一级支持页面持续可见，并从商品、袋中和页脚入口反复出现。",
  },
  {
    question: "为什么婕选会先解释路线，再讲商品细节？",
    answer: "因为站点是 fit-first 逻辑。先讲清楚为什么适合，再进入成分、比较和商品层判断。",
  },
] as const;

export const CONTACT_SECTIONS = [
  {
    title: "联系路径原则",
    items: [
      "商品问题、配送问题和退货问题不该被混进一个模糊入口里。",
      "站点应该在用户发消息前就告诉他，不同问题分别适合找哪类支持。",
      "响应预期应写在联系入口附近，而不是留给用户自己猜。",
    ],
  },
  {
    title: "用户应该总能找到的三件事",
    items: [
      "怎么咨询商品适配问题",
      "怎么咨询配送与追踪问题",
      "怎么咨询退货资格问题",
    ],
  },
] as const;

export const PDP_TRUST_NOTES = [
  "袋中会保存在当前设备上，所以你可以一边比较一边暂存，不用担心回来后重来。",
  "配送时效、退货规则和支持路径应该在支付前持续可见。",
  "商品页、探索页和对比页之间应该始终一跳可达。",
] as const;

export const PDP_SUPPORT_LINKS = [
  {
    title: "先看配送",
    summary: "在下单能力开放前，先把处理时效、运输预期和追踪逻辑看清楚。",
    href: "/support/shipping",
  },
  {
    title: "先看退货",
    summary: "在决定前先确认退货窗口、退款节奏和条件要求。",
    href: "/support/returns",
  },
  {
    title: "联系支持",
    summary: "先明确商品适配、配送和退货问题分别应该走哪条支持路径。",
    href: "/support/contact",
  },
] as const;

export const SHOP_SUPPORT_LINKS = [
  {
    title: "配送信息前置",
    summary: "在没有 checkout 的阶段，也要先看处理时效和运输节奏。",
    href: "/support/shipping",
  },
  {
    title: "退货规则清楚",
    summary: "在决定商品路线之前，把退货预期先看明白。",
    href: "/support/returns",
  },
  {
    title: "支持路径明确",
    summary: "先知道商品适配和配送问题该去哪里问，而不是等到问题出现后再找入口。",
    href: "/support/contact",
  },
] as const;

export const SEARCH_SUGGESTIONS = [
  { label: "干燥", query: "dryness" },
  { label: "毛躁", query: "frizz" },
  { label: "敏感", query: "sensitive" },
  { label: "控油", query: "oil" },
  { label: "屏障", query: "barrier" },
  { label: "洁面", query: "cleanser" },
] as const;

export const SEARCH_TRUST_POINTS = [
  "搜索应该先帮用户缩小范围，再平滑移交到测配、对比或正确的品类页。",
  "支持入口要在搜索页持续可见，避免用户不知道配送和退货信息在哪看。",
  "已存恢复在这里同样重要，搜索不该是个死路页。",
] as const;

export const LAUNCH_STATUS_POINTS = [
  "当前已开放：适配判断、成分解释、测配、对比、探索、袋中与已存恢复。",
  "当前未开放：真实支付、订单创建，以及每个商品的最终配送时效。",
  "袋中当前仍然更像可恢复 shortlist，不是完整结账购物车。",
] as const;

export const PRODUCT_RELEASE_NOTES = [
  "当前商品页已经支持适配、成分理解、对比入口和袋中恢复。",
  "如果当前响应里还没有价格、库存和配送时效，婕选不会主动猜一个出来。",
  "先用这页判断是否适合，再把 shortlist 留在袋中，等真实 commerce 字段逐步补齐。",
] as const;

export const BAG_RELEASE_NOTES = [
  "当前袋中仍是保存 shortlist 的一层，不是 checkout cart。",
  "加入袋中的商品会继续和测配、对比、探索、配送、退货与支持页面连起来。",
  "价格、库存和最终配送时效仍然依赖真实 commerce feed，缺失时不会虚构。",
] as const;

export const SAVED_TRUST_POINTS = [
  "袋中、测配、对比和最近浏览都应该可恢复，而不是每次回来重来一遍。",
  "在账号和 checkout 还没开放前，已存状态本身就应该有价值。",
  "配送、退货和支持入口在恢复层里也应持续可见。",
] as const;

export const SAVED_SUPPORT_LINKS = [
  {
    title: "配送说明",
    summary: "回看已存选择时，也要把处理时效、运输节奏和追踪预期放在旁边。",
    href: "/support/shipping",
  },
  {
    title: "退货规则",
    summary: "把已存 shortlist 带回袋中前，先看退货时限和条件要求。",
    href: "/support/returns",
  },
  {
    title: "联系支持",
    summary: "如果某个商品、对比结果或路线判断引出疑问，支持入口应该就在附近。",
    href: "/support/contact",
  },
] as const;
