import Link from "next/link";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import MobileAnalyticsDashboard from "@/components/analytics/MobileAnalyticsDashboard";
import { ANALYTICS_SECTIONS } from "@/lib/analyticsNav";

export const metadata: Metadata = {
  title: "数据分析 · 予选",
  description: "桌面端移动链路分析台，聚焦决策结果到达、结果动作、utility 回环与流失反馈。",
};

const STRUCTURED_FIELDS = [
  "event_id",
  "owner_type",
  "owner_id",
  "session_id",
  "name",
  "page",
  "route",
  "source",
  "category",
  "product_id",
  "user_product_id",
  "compare_id",
  "scenario_id",
  "step",
  "stage",
  "result_cta",
  "action",
  "target_path",
  "dwell_ms",
  "error_code",
  "error_detail",
  "http_status",
  "props_json",
  "created_at",
] as const;

const EVENT_GROUPS = [
  {
    title: "百科列表兴趣",
    status: "已接入",
    summary: "现在能看百科列表曝光、产品点击、成分点击，开始回答‘用户是不是在列表里就找不到想看的东西’。",
    events: ["wiki_list_view", "wiki_product_click", "wiki_ingredient_click"],
    value: "可以直接看产品列表 CTR、成分列表 CTR，以及不同筛选下的兴趣落差。",
  },
  {
    title: "会话与退出",
    status: "已接入",
    summary: "已经能按设备与会话看一次真实访问路径，也能看页面离开前停留了多久。",
    events: ["page_view", "page_exit"],
    value: "定位“看了没点”和“点了就走”的基础层。",
  },
  {
    title: "百科详情 CTA",
    status: "已接入",
    summary: "能判断百科详情里的上传 CTA 有没有进入视口、有没有被真正点击。",
    events: ["wiki_upload_cta_expose", "wiki_upload_cta_click"],
    value: "回答 CTA 是否有吸引力，而不是只猜文案问题。",
  },
  {
    title: "我的在用入口",
    status: "已接入",
    summary: "能看 use 页品类卡是否被点击，是否承接住百科来的意图流量。",
    events: ["my_use_category_card_click"],
    value: "判断详情页跳转后的第一步有没有继续发生。",
  },
  {
    title: "对比运行全链路",
    status: "已接入",
    summary: "上传、选库、启动、阶段推进、失败、成功都已有结构化事件，不再只剩日志文本。",
    events: [
      "compare_upload_pick",
      "compare_upload_success",
      "compare_upload_fail",
      "compare_run_start",
      "compare_stage_progress",
      "compare_stage_error",
      "compare_run_success",
    ],
    value: "能直接按 stage、error_code、http_status 看失败分布。",
  },
  {
    title: "决策结果与 utility 回环",
    status: "已接入",
    summary:
      "现在能直接看决策结果有没有被到达、主 CTA 有没有被点击、结果后有没有进入 utility，以及 utility 有没有把用户送回决策链路；老用户首页 workspace 快捷动作也可作为 supporting context 观察。",
    events: [
      "result_view",
      "result_primary_cta_click",
      "result_secondary_loop_click",
      "utility_return_click",
      "home_workspace_quick_action_click",
      "bag_add_success",
    ],
    value: "把‘拿到结果没有’‘结果后有没有继续’‘utility 有没有把人带回来’放进一套统一口径，并用 result_cta / action / target_path 观测 Phase 10 意图分流。",
  },
  {
    title: "对比结果阅读与落地",
    status: "已接入",
    summary: "对比结果页的阅读深度、停留、CTA 落地和后续动作继续保留，但退到 compare / utility 语境下解读。",
    events: [
      "compare_result_view",
      "compare_result_leave",
      "scroll_depth",
      "compare_result_cta_click",
      "compare_result_cta_land",
      "compare_run_start",
      "wiki_upload_cta_click",
      "wiki_category_ingredient_click",
      "wiki_category_choose_click",
      "product_showcase_continue_upload_click",
      "product_showcase_governance_click",
      "feedback_prompt_show",
      "feedback_submit",
      "feedback_skip",
    ],
    value: "继续回答 compare 结果页是否被阅读、点击和成功承接，但不再冒充决策结果主 KPI。",
  },
  {
    title: "误触、死点与停滞",
    status: "已接入",
    summary: "现在已经有 rage click、dead click 和 stall 信号，能开始判断‘按钮不清楚’‘点了没反应’还是‘用户卡住没动’。",
    events: ["rage_click", "dead_click", "stall_detected"],
    value: "让产品体验分析从后验报错，往前推进到界面摩擦本身。",
  },
  {
    title: "环境切片",
    status: "已接入",
    summary: "现在每条移动端事件会自动带浏览器、系统、网络、语言、viewport，以及内存/CPU/触控/在线状态这些能力环境。",
    events: [
      "browser_family",
      "os_family",
      "network_type",
      "lang",
      "viewport_bucket",
      "device_type",
      "device_memory_bucket",
      "cpu_core_bucket",
      "touch_points_bucket",
      "online_state",
    ],
    value: "能回答某类问题是不是只发生在特定设备能力、语言、网络或在线条件下。",
  },
] as const;

const ANALYTIC_QUESTIONS = [
  {
    question: "有多少会话从 /m 点击主 CTA 进入主链路？",
    answer: "首屏直接展示 home_primary_cta_click_sessions，作为 P0 漏斗分母。",
    signals: ["home_primary_cta_click", "home_primary_cta_click_sessions"],
  },
  {
    question: "进入 /m/choose 后，有多少会话开始答题？",
    answer: "展示 choose_start_click_sessions 与 choose_start_rate_from_choose_view，不再用 compare 启动代替。",
    signals: ["choose_view", "choose_start_click", "choose_start_rate_from_choose_view"],
  },
  {
    question: "哪一道题流失最高？",
    answer:
      "当有有效 stepful 数据时，首屏展示 question_dropoff_top，并用 question_dropoff_by_category 做补充；是否 live 由 question_dropoff_status 决定。",
    signals: [
      "questionnaire_view(step)",
      "question_answered(step)",
      "question_dropoff_top",
      "question_dropoff_by_category",
      "question_dropoff_status",
    ],
  },
  {
    question: "有多少会话成功到达结果页？",
    answer: "结果到达统一看 result_view_sessions，并展示 result_view_rate_from_home_primary_cta。",
    signals: ["result_view", "result_view_sessions", "result_view_rate_from_home_primary_cta"],
  },
  {
    question: "到达结果后有多少会话继续动作？",
    answer:
      "拆开展示 result_primary_cta_click / result_secondary_loop_click / utility_return_click；并用 result_cta / action / target_path 解释动作语义，compare 事件只做 supporting context。",
    signals: [
      "result_primary_cta_click",
      "result_secondary_loop_click",
      "utility_return_click",
      "home_workspace_quick_action_click (supporting only)",
      "compare_result_view (supporting only)",
    ],
  },
] as const;

const DEFERRED_SIGNALS = [
  {
    title: "更深的业务留存动作",
    reason: "现在已经能看到加入购物袋和完成测配结果，但还没继续追到收藏、复购、二次对比等更深留存动作。",
    items: ["wiki_detail_follow_save", "compare_again_after_result", "bag_to_checkout_intent"],
  },
  {
    title: "设备细颗粒环境",
    reason: "现在已经有内存、CPU、触控和在线状态，但 Web 端仍拿不到稳定设备型号，也还没有更细的 Save-Data 分层。",
    items: ["device_model", "save_data_segment", "battery_bucket", "render_fps_bucket"],
  },
] as const;

const FIRST_RELEASE_PANELS = [
  {
    title: "Overview",
    badge: "第一屏",
    description: "给产品、增长、工程一个共同入口，先看结果到达率、结果主 CTA 点击率和 utility 回流率。",
    outputs: ["核心趋势卡", "时间范围筛选", "category 分段", "结果与回流摘要"],
  },
  {
    title: "Funnel",
    badge: "第一优先级",
    description: "从百科详情到 use、到 compare、到结果页，把真实流失点按阶段拆开。",
    outputs: ["步骤漏斗", "分品类漏斗", "环节转化率", "流失占比"],
  },
  {
    title: "Stage Errors",
    badge: "工程联动",
    description: "按 stage / error_code / http_status 看热区，不再靠人肉翻日志。",
    outputs: ["错误热力图", "Top stage", "Top error_code", "近 7 天变化"],
  },
  {
    title: "Feedback",
    badge: "产品洞察",
    description: "把结构化事件和主观反馈合并看，判断‘慢’还是‘不信结果’更伤转化。",
    outputs: ["反馈分布", "stage x reason 交叉", "文本样本", "触发原因占比"],
  },
  {
    title: "Experience Signals",
    badge: "体验信号",
    description: "把决策结果动作、utility 回环、对比结果阅读深度、dead/rage/stall 和环境切片拉到一屏里看。",
    outputs: ["列表 CTR", "结果回环动作", "CTA 落地率", "阅读深度", "误触与停滞目标", "环境分布"],
  },
  {
    title: "Session Explorer",
    badge: "钻取层",
    description: "按 session_id / compare_id 还原一次真实路径，支持产品和工程一起复盘。",
    outputs: ["事件时间线", "错误上下文", "反馈记录", "关键页面停留"],
  },
] as const;

const FINAL_STATE_MODULES = [
  {
    title: "Command Center",
    summary: "一个首页同时看趋势、告警、核心转化、最近异常，不用在多个后台来回跳。",
    bullets: ["日/周趋势", "异常波动提醒", "关键指标目标线", "按 category 快切"],
  },
  {
    title: "Journey Intelligence",
    summary: "不只看单条漏斗，还能看不同来源、不同人群、不同品类的路径差异。",
    bullets: ["来源对比", "品类切片", "新旧用户路径", "多步流失定位"],
  },
  {
    title: "Reliability Atlas",
    summary: "把 AI 阶段错误、接口错误、任务恢复失败与转化损失直接挂钩。",
    bullets: ["stage 可靠性", "错误回放", "失败损失估算", "修复优先级排序"],
  },
  {
    title: "Trust & Comprehension",
    summary: "专门看用户为什么不信结果、看不懂结果、或者看完后没有继续行动。",
    bullets: ["结果页阅读深度", "反馈语义聚类", "结果页 CTA 深转化", "文案/结构实验对比"],
  },
  {
    title: "Experiment Overlay",
    summary: "以后上线 CTA 文案、流程、结果页结构 A/B 时，能直接在分析台对照看影响。",
    bullets: ["实验标记", "版本对比", "显著性提示", "回滚依据"],
  },
  {
    title: "Quality Loop",
    summary: "把产品问题发现、工程修复、AI 质量回归接成一个闭环，而不是分散到群消息里。",
    bullets: ["问题单联动", "修复前后对比", "自动回归面板", "待验证清单"],
  },
] as const;

const BUILD_PHASES = [
  {
    phase: "Phase 1",
    title: "可读分析台",
    detail: "先把现有埋点、可回答问题、第一版面板结构做成真实桌面入口，让团队统一语言。",
  },
  {
    phase: "Phase 2",
    title: "聚合接口与真数据",
    detail: "接 overview、funnel、errors、feedback、sessions 5 组接口，页面从说明台升级成可操作面板。",
  },
  {
    phase: "Phase 3",
    title: "次优先级信号补齐",
    detail: "补 dead click、结果页后续动作、环境字段与更细的实验标记，让分析从行为层再走向解释层。",
  },
  {
    phase: "Phase 4",
    title: "完全体经营台",
    detail: "接实验、异常告警、质量闭环与跨板块联动，让 /analytics 成为产品和工程的共同驾驶舱。",
  },
] as const;

function cx(...arr: Array<string | false | null | undefined>) {
  return arr.filter(Boolean).join(" ");
}

export default function AnalyticsPage() {
  const totalEvents = EVENT_GROUPS.reduce((sum, group) => sum + group.events.length, 0);

  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 -z-10 h-[420px] bg-[radial-gradient(circle_at_top_left,_rgba(15,101,74,0.18),_transparent_36%),radial-gradient(circle_at_top_right,_rgba(207,169,74,0.18),_transparent_28%),linear-gradient(180deg,_rgba(255,255,255,0.92),_rgba(245,245,247,0.72))]" />

      <div className="mx-auto max-w-[1240px] px-6 pb-24 pt-12 md:px-10">
        <header className="rounded-[36px] border border-black/10 bg-white/88 px-7 py-8 shadow-[0_22px_54px_rgba(16,24,40,0.08)] backdrop-blur">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-[760px]">
              <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#1a5a47]">Desktop Analytics</div>
              <h1 className="mt-3 text-[42px] font-semibold tracking-[-0.03em] text-black/90 md:text-[56px]">
                数据分析
              </h1>
              <p className="mt-4 max-w-[680px] text-[16px] leading-[1.72] text-black/64">
                这是 desktop 端独立板块的第一版骨架。它不假装已经有完整 BI，而是把我们现在真实已经接上的行为、阶段错误、主观反馈与后续完全体信息架构直接摆到台面上。
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {ANALYTICS_SECTIONS.map((section) => (
                <AnchorPill key={section.key} href={section.href}>
                  {section.navLabelZh}
                </AnchorPill>
              ))}
              <Link
                href="/auth"
                className="inline-flex h-10 items-center justify-center rounded-full border border-black/10 bg-white px-4 text-[13px] font-semibold text-black/72 hover:bg-black/[0.03]"
              >
                返回管理控制台
              </Link>
            </div>
          </div>

          <div className="mt-8 grid gap-3 md:grid-cols-4">
            <MetricTile label="已接入事件" value={`${totalEvents}`} detail="跨页面 + CTA + compare + 反馈" accent="emerald" />
            <MetricTile label="结构化字段" value={`${STRUCTURED_FIELDS.length}`} detail="可直接聚合，不只剩原始日志" accent="amber" />
            <MetricTile label="当前可回答问题" value={`${ANALYTIC_QUESTIONS.length}`} detail="已经能支撑产品和工程联动" accent="slate" />
            <MetricTile label="第一版核心面板" value={`${FIRST_RELEASE_PANELS.length}`} detail="overview / funnel / errors / feedback / sessions" accent="stone" />
          </div>

          <div className="mt-7 grid gap-3 lg:grid-cols-2">
            {ANALYTICS_SECTIONS.map((section) => (
              <article key={section.key} className="rounded-[22px] border border-black/10 bg-[#f7f8fb] px-4 py-4">
                <div className="text-[11px] font-semibold tracking-[0.12em] text-black/44 uppercase">{section.navLabelEn}</div>
                <div className="mt-1 text-[18px] font-semibold tracking-[-0.02em] text-black/86">{section.titleZh}</div>
                <p className="mt-2 text-[13px] leading-[1.62] text-black/62">{section.summaryZh}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {section.bulletsZh.map((item) => (
                    <span key={item} className="rounded-full border border-black/10 bg-white px-2.5 py-1 text-[11px] text-black/66">
                      {item}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </header>

        <section id="analytics-dashboard" className="mt-8 scroll-mt-20">
          <MobileAnalyticsDashboard />
        </section>

        <section id="live-signals" className="mt-8 grid gap-5 lg:grid-cols-[1.35fr_0.95fr]">
          <div className="rounded-[32px] border border-black/10 bg-white p-7 shadow-[0_18px_44px_rgba(16,24,40,0.06)]">
            <SectionKicker title="现有能力地图" eyebrow="Already Live" />
            <div className="mt-6 grid gap-4">
              {EVENT_GROUPS.map((group) => (
                <article key={group.title} className="rounded-[24px] border border-black/10 bg-[#fbfcf8] px-5 py-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="text-[20px] font-semibold tracking-[-0.02em] text-black/88">{group.title}</div>
                    <StatusPill tone="live">{group.status}</StatusPill>
                  </div>
                  <p className="mt-3 text-[14px] leading-[1.68] text-black/64">{group.summary}</p>
                  <p className="mt-3 text-[13px] leading-[1.65] text-black/74">{group.value}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {group.events.map((eventName) => (
                      <code
                        key={eventName}
                        className="rounded-full border border-black/10 bg-white px-3 py-1 text-[11px] tracking-[0.02em] text-black/66"
                      >
                        {eventName}
                      </code>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </div>

          <div className="space-y-5">
            <div className="rounded-[32px] border border-black/10 bg-[#10261d] px-7 py-7 text-white shadow-[0_18px_44px_rgba(16,24,40,0.12)]">
              <SectionKicker title="现在能回答什么" eyebrow="Immediate Value" light />
              <div className="mt-5 space-y-4">
                {ANALYTIC_QUESTIONS.map((item, index) => (
                  <div key={item.question} className="rounded-[22px] border border-white/12 bg-white/6 px-4 py-4">
                    <div className="text-[11px] uppercase tracking-[0.14em] text-white/52">Q{index + 1}</div>
                    <div className="mt-2 text-[16px] font-semibold leading-[1.45] text-white/92">{item.question}</div>
                    <p className="mt-2 text-[13px] leading-[1.65] text-white/68">{item.answer}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {item.signals.map((signal) => (
                        <code key={signal} className="rounded-full border border-white/12 bg-white/8 px-3 py-1 text-[11px] text-white/76">
                          {signal}
                        </code>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[32px] border border-black/10 bg-white p-7 shadow-[0_18px_44px_rgba(16,24,40,0.06)]">
              <SectionKicker title="当前建模基座" eyebrow="Data Base" />
              <div className="mt-5 grid gap-3">
                <CompactCard
                  title="身份层"
                  summary="owner_type + owner_id 已能做设备级路径，还能把一次 compare 的失败与历史行为串起来。"
                />
                <CompactCard
                  title="会话层"
                  summary="session_id 已打通前端到后端，能按一次真实访问观察 CTA、上传、compare、结果的连续性。"
                />
                <CompactCard
                  title="错误层"
                  summary="compare 失败已不是纯文本，stage / error_code / http_status 已结构化。"
                />
                <CompactCard
                  title="主观层"
                  summary="失败节点已接轻反馈，能把‘技术失败’和‘用户不信/嫌麻烦’分开看。"
                />
              </div>
            </div>
          </div>
        </section>

        <section className="mt-8 rounded-[32px] border border-black/10 bg-white p-7 shadow-[0_18px_44px_rgba(16,24,40,0.06)]">
          <SectionKicker title="暂时后置的次优先级信号" eyebrow="Deferred But Important" />
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {DEFERRED_SIGNALS.map((group) => (
              <article key={group.title} className="rounded-[24px] border border-[#e8ddd0] bg-[#fffaf3] px-5 py-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[18px] font-semibold tracking-[-0.02em] text-black/86">{group.title}</div>
                  <StatusPill tone="deferred">后置</StatusPill>
                </div>
                <p className="mt-3 text-[14px] leading-[1.68] text-black/64">{group.reason}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {group.items.map((item) => (
                    <code
                      key={item}
                      className="rounded-full border border-[#e2d2bf] bg-white px-3 py-1 text-[11px] tracking-[0.02em] text-black/66"
                    >
                      {item}
                    </code>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>

        <section id="v1-panels" className="mt-8 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[32px] border border-black/10 bg-white p-7 shadow-[0_18px_44px_rgba(16,24,40,0.06)]">
            <SectionKicker title="第一版页面结构" eyebrow="V1 Panels" />
            <div className="mt-6 space-y-4">
              {FIRST_RELEASE_PANELS.map((panel) => (
                <article key={panel.title} className="rounded-[24px] border border-black/10 bg-[#f7f8fb] px-5 py-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="text-[20px] font-semibold tracking-[-0.02em] text-black/88">{panel.title}</div>
                    <StatusPill tone="planned">{panel.badge}</StatusPill>
                  </div>
                  <p className="mt-3 text-[14px] leading-[1.68] text-black/64">{panel.description}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {panel.outputs.map((item) => (
                      <span key={item} className="rounded-full border border-black/10 bg-white px-3 py-1 text-[11px] text-black/66">
                        {item}
                      </span>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </div>

          <div className="space-y-5">
            <div className="rounded-[32px] border border-black/10 bg-[#f0f7ff] p-7 shadow-[0_18px_44px_rgba(16,24,40,0.06)]">
              <SectionKicker title="桌面首版该怎么读" eyebrow="Usage" />
              <ol className="mt-5 space-y-4">
                {[
                  "先看 Overview，确认是流量问题、转化问题，还是错误问题。",
                  "再切 Funnel，判断掉在 CTA、use、compare 启动还是结果消费。",
                  "如果是运行问题，转到 Stage Errors 找 stage / error_code 热点。",
                  "如果数据和日志都解释不够，再用 Feedback + Session Explorer 看具体路径。",
                ].map((item, index) => (
                  <li key={item} className="flex gap-3">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-[12px] font-semibold text-black/72">
                      {index + 1}
                    </div>
                    <p className="pt-1 text-[14px] leading-[1.65] text-black/66">{item}</p>
                  </li>
                ))}
              </ol>
            </div>

            <div className="rounded-[32px] border border-black/10 bg-white p-7 shadow-[0_18px_44px_rgba(16,24,40,0.06)]">
              <SectionKicker title="实施节奏" eyebrow="Build Phases" />
              <div className="mt-5 space-y-4">
                {BUILD_PHASES.map((phase) => (
                  <article key={phase.phase} className="rounded-[22px] border border-black/10 bg-white px-4 py-4">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-black/45">{phase.phase}</div>
                    <div className="mt-1 text-[17px] font-semibold tracking-[-0.02em] text-black/86">{phase.title}</div>
                    <p className="mt-2 text-[13px] leading-[1.65] text-black/62">{phase.detail}</p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="final-state" className="mt-8 rounded-[32px] border border-black/10 bg-[#0f1419] px-7 py-8 text-white shadow-[0_22px_54px_rgba(11,20,36,0.18)]">
          <SectionKicker title="这个页面的最终完全体" eyebrow="Final Form" light />
          <div className="mt-4 max-w-[820px] text-[16px] leading-[1.72] text-white/68">
            完全体的 `/analytics` 不会只是一个报表页，而是产品、工程、AI 质量共同使用的经营驾驶舱。它既回答“哪里掉了”，也回答“为什么掉、值不值得修、修完有没有变好”。
          </div>

          <div className="mt-7 grid gap-4 xl:grid-cols-3">
            {FINAL_STATE_MODULES.map((module) => (
              <article key={module.title} className="rounded-[24px] border border-white/10 bg-white/6 px-5 py-5">
                <div className="text-[20px] font-semibold tracking-[-0.02em] text-white/92">{module.title}</div>
                <p className="mt-3 text-[14px] leading-[1.7] text-white/68">{module.summary}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {module.bullets.map((bullet) => (
                    <span key={bullet} className="rounded-full border border-white/10 bg-white/8 px-3 py-1 text-[11px] text-white/78">
                      {bullet}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>

          <div className="mt-7 rounded-[26px] border border-white/10 bg-white/5 px-6 py-6">
            <div className="text-[12px] uppercase tracking-[0.14em] text-white/48">North Star</div>
            <div className="mt-2 text-[24px] font-semibold tracking-[-0.02em] text-white/92">
              从“行为日志堆”升级成“增长、体验、质量一体化决策台”
            </div>
            <p className="mt-3 max-w-[920px] text-[14px] leading-[1.75] text-white/68">
              最终目标不是展示更多图表，而是让我们在一个地方完成三件事：发现真实流失、判断修复优先级、验证修复是否改善结果。如果这三件事做不到，页面再漂亮也只是新的信息噪音。
            </p>
          </div>
        </section>
      </div>
    </section>
  );
}

function MetricTile({
  label,
  value,
  detail,
  accent,
}: {
  label: string;
  value: string;
  detail: string;
  accent: "emerald" | "amber" | "slate" | "stone";
}) {
  const toneClass =
    accent === "emerald"
      ? "bg-[#eff8f2] text-[#16553f]"
      : accent === "amber"
        ? "bg-[#fff5df] text-[#8f5a10]"
        : accent === "slate"
          ? "bg-[#eef3f8] text-[#30485f]"
          : "bg-[#f4efe8] text-[#65584b]";

  return (
    <div className="rounded-[24px] border border-black/8 bg-[#f9fafb] px-5 py-5">
      <div className="text-[12px] tracking-[0.08em] text-black/45">{label}</div>
      <div className="mt-3 flex items-center gap-3">
        <div className="text-[34px] font-semibold tracking-[-0.04em] text-black/88">{value}</div>
        <span className={cx("rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-[0.06em]", toneClass)}>READY</span>
      </div>
      <p className="mt-3 text-[13px] leading-[1.6] text-black/60">{detail}</p>
    </div>
  );
}

function SectionKicker({ eyebrow, title, light = false }: { eyebrow: string; title: string; light?: boolean }) {
  return (
    <div>
      <div className={cx("text-[12px] font-semibold uppercase tracking-[0.14em]", light ? "text-white/45" : "text-black/42")}>
        {eyebrow}
      </div>
      <h2 className={cx("mt-2 text-[32px] font-semibold tracking-[-0.03em]", light ? "text-white/92" : "text-black/88")}>{title}</h2>
    </div>
  );
}

function StatusPill({ children, tone }: { children: ReactNode; tone: "live" | "planned" | "deferred" }) {
  const className =
    tone === "live"
      ? "border-[#cbe7d8] bg-[#eff8f2] text-[#1f6a4e]"
      : tone === "planned"
        ? "border-[#d7dbe4] bg-[#f3f5f8] text-[#506073]"
        : "border-[#e7d4bc] bg-[#fff3df] text-[#925f16]";

  return <span className={cx("rounded-full border px-3 py-1 text-[11px] font-semibold tracking-[0.06em]", className)}>{children}</span>;
}

function CompactCard({ title, summary }: { title: string; summary: string }) {
  return (
    <article className="rounded-[22px] border border-black/10 bg-[#f7f8fb] px-4 py-4">
      <div className="text-[16px] font-semibold tracking-[-0.02em] text-black/86">{title}</div>
      <p className="mt-2 text-[13px] leading-[1.65] text-black/62">{summary}</p>
    </article>
  );
}

function AnchorPill({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      className="inline-flex h-10 items-center justify-center rounded-full border border-black/10 bg-white px-4 text-[13px] font-semibold text-black/72 hover:bg-black/[0.03]"
    >
      {children}
    </a>
  );
}
