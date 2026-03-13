"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import MobilePageAnalytics from "@/components/mobile/MobilePageAnalytics";
import MobileTrackedLink from "@/components/mobile/MobileTrackedLink";

const VALUE_STEPS = ["看懂", "比清", "决定"] as const;

type GuideStepId = "choose" | "compare" | "wiki" | "me";

type GuideStep = {
  id: GuideStepId;
  label: string;
  title: string;
  body: string;
  eyebrow: string;
  previewTag: string;
  previewTitle: string;
  previewBody: string;
  outcomes: readonly string[];
  targetX: string;
};

const GUIDE_STEPS: readonly GuideStep[] = [
  {
    id: "choose",
    label: "开始测配",
    eyebrow: "回答少量问题",
    title: "先拿到更适合你的护理方向",
    body: "进入后会先完成个性测配，拿到更适合的护理重点、产品方向和为什么。",
    previewTag: "个性测配结果",
    previewTitle: "更适合先做控油修护",
    previewBody: "不是直接推商品，而是先告诉你更该优先解决什么，再给推荐方向。",
    outcomes: ["护理重点", "推荐方向", "原因解释"],
    targetX: "12.5%",
  },
  {
    id: "compare",
    label: "横向对比",
    eyebrow: "把两款放一起",
    title: "直接看清差异点，再决定买哪一个",
    body: "横向对比会把两款产品的适配倾向、关键成分差异和更值得先看的那一款直接摆出来。",
    previewTag: "横向对比结论",
    previewTitle: "A 更适合油头，B 更适合敏感头皮",
    previewBody: "不靠自己逐个成分比，而是先看到结论，再决定要不要继续深挖。",
    outcomes: ["适配差异", "关键成分", "先看哪款"],
    targetX: "37.5%",
  },
  {
    id: "wiki",
    label: "百科",
    eyebrow: "先查再决定",
    title: "查产品或成分时，先给你结论",
    body: "百科不是资料堆砌，而是先帮你看懂它适合谁、该注意什么、值不值得继续看。",
    previewTag: "百科速读",
    previewTitle: "先看结论，再决定要不要点开细节",
    previewBody: "点进去先拿到一句话判断和关键注意点，减少无效阅读。",
    outcomes: ["适合谁", "要注意什么", "是否值得继续看"],
    targetX: "62.5%",
  },
  {
    id: "me",
    label: "我的",
    eyebrow: "把过程存下来",
    title: "在用、历史和购物袋都会被保留",
    body: "离开再回来，也能继续上次的判断过程，不用重新找、不用重新记。",
    previewTag: "我的记录",
    previewTitle: "你的决策进度会被接住",
    previewBody: "在用记录、历史结果和购物袋会统一收好，下次回来可以接着看。",
    outcomes: ["在用", "历史", "购物袋"],
    targetX: "87.5%",
  },
] as const;

function getGuideIndex(step: string | null): number {
  const index = GUIDE_STEPS.findIndex((item) => item.id === step);
  return index >= 0 ? index : 0;
}

function GuideNavIcon({ name }: { name: GuideStepId }) {
  if (name === "choose") return <span className="m-nav-choose-icon" aria-hidden="true" />;
  if (name === "compare") return <span className="m-nav-compare-icon" aria-hidden="true" />;
  if (name === "wiki") return <span className="m-nav-wiki-icon" aria-hidden="true" />;

  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="8" r="3.5" fill="none" stroke="currentColor" strokeWidth="1.9" />
      <path d="M5.2 19.2a6.8 6.8 0 0 1 13.6 0" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  );
}

function GuidePointer() {
  return (
    <svg width="34" height="42" viewBox="0 0 34 42" aria-hidden="true">
      <path
        d="M17 2v26.5m0 0-6.2-6.2M17 28.5l6.2-6.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="17" cy="30.5" r="9.5" fill="currentColor" opacity="0.1" />
    </svg>
  );
}

export default function MobileHome() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [revealed, setRevealed] = useState(false);

  const guideOpen = searchParams.get("guide") === "1";
  const activeGuideIndex = guideOpen ? getGuideIndex(searchParams.get("step")) : 0;
  const activeGuideStep = GUIDE_STEPS[activeGuideIndex];

  useEffect(() => {
    const rafId = window.requestAnimationFrame(() => {
      setRevealed(true);
    });
    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, []);

  const openGuideStep = (index: number) => {
    const next = GUIDE_STEPS[Math.max(0, Math.min(index, GUIDE_STEPS.length - 1))];
    router.replace(`/m?guide=1&step=${next.id}`, { scroll: false });
  };

  const closeGuide = () => {
    router.replace("/m", { scroll: false });
  };

  const guideProgress = `${activeGuideIndex + 1}/${GUIDE_STEPS.length}`;

  return (
    <section
      className={`-mx-4 -my-6 min-h-[100dvh] overflow-hidden ${
        guideOpen
          ? "bg-[radial-gradient(circle_at_top,#13223d_0%,#08101d_28%,#04070d_58%,#020307_100%)] text-white"
          : "bg-[color:var(--m-bg)]"
      }`}
    >
      <MobilePageAnalytics page="mobile_intro" route="/m" source="m_intro" />

      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className={`absolute left-[-12%] top-[-8%] h-[280px] w-[280px] rounded-full blur-3xl ${
            guideOpen ? "bg-[#0a84ff]/18" : "bg-[#0a84ff]/12"
          }`}
        />
        <div
          className={`absolute right-[-18%] top-[24%] h-[260px] w-[260px] rounded-full blur-3xl ${
            guideOpen ? "bg-[#7cc6ff]/14" : "bg-white/10 dark:bg-[#78b8ff]/10"
          }`}
        />
        <div
          className={`absolute bottom-[-10%] left-[14%] h-[240px] w-[240px] rounded-full blur-3xl ${
            guideOpen ? "bg-[#65a8ff]/10" : "bg-[#7cc6ff]/8"
          }`}
        />
      </div>

      <div className="relative mx-auto flex min-h-[100dvh] max-w-[680px] flex-col px-4 pb-[calc(env(safe-area-inset-bottom)+28px)] pt-[calc(env(safe-area-inset-top)+24px)]">
        {!guideOpen ? (
          <>
            <div
              className={`transition-[opacity,transform] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                revealed ? "translate-y-0 opacity-100" : "translate-y-5 opacity-0"
              }`}
            >
              <div className="inline-flex items-center gap-2 rounded-full border border-black/8 bg-white/60 px-3 py-1.5 text-[12px] font-semibold tracking-[0.02em] text-black/66 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] backdrop-blur-xl dark:border-white/10 dark:bg-white/6 dark:text-white/66 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                <span className="h-2 w-2 rounded-full bg-[#0a84ff]" />
                予选
              </div>
            </div>

            <div className="mt-12 flex flex-1 flex-col justify-between gap-10">
              <div className="space-y-8">
                <div
                  className={`max-w-[520px] transition-[opacity,transform] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] delay-75 ${
                    revealed ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
                  }`}
                >
                  <p className="text-[14px] font-medium tracking-[0.01em] text-black/48 dark:text-white/52">适配度优先的个护决策入口</p>
                  <h1 className="mt-4 text-[42px] leading-[0.98] font-semibold tracking-[-0.05em] text-black/92 sm:text-[48px] dark:text-white/96">
                    <span className="block">更快选到</span>
                    <span className="mt-1 block">适合自己的日常护理方案</span>
                  </h1>
                  <p className="mt-5 max-w-[520px] text-[17px] leading-[1.65] tracking-[-0.015em] text-black/68 dark:text-white/72">
                    予选帮你更快选到适合自己日常护理方案的产品，少靠猜，少踩坑。
                  </p>
                </div>

                <div
                  className={`grid gap-3 transition-[opacity,transform] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] delay-150 ${
                    revealed ? "translate-y-0 opacity-100" : "translate-y-7 opacity-0"
                  }`}
                >
                  <section className="overflow-hidden rounded-[30px] border border-black/8 bg-white/68 p-5 shadow-[0_22px_44px_rgba(15,29,53,0.08),inset_0_1px_0_rgba(255,255,255,0.78)] backdrop-blur-2xl dark:border-white/10 dark:bg-[rgba(20,29,43,0.7)] dark:shadow-[0_24px_48px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.05)]">
                    <div className="inline-flex items-center rounded-full bg-[#0a84ff]/10 px-3 py-1 text-[12px] font-semibold text-[#0a84ff] dark:bg-[#78b8ff]/14 dark:text-[#9ed0ff]">
                      适配度优先
                    </div>
                    <p className="mt-4 text-[18px] leading-[1.6] tracking-[-0.015em] text-black/82 dark:text-white/84">
                      予选是一个以“适配度优先”为核心的个护选购与决策平台。
                    </p>
                  </section>

                  <section className="overflow-hidden rounded-[30px] border border-black/8 bg-white/58 p-5 shadow-[0_20px_40px_rgba(15,29,53,0.07),inset_0_1px_0_rgba(255,255,255,0.76)] backdrop-blur-2xl dark:border-white/10 dark:bg-[rgba(17,25,38,0.62)] dark:shadow-[0_22px_44px_rgba(0,0,0,0.26),inset_0_1px_0_rgba(255,255,255,0.05)]">
                    <div className="flex flex-wrap gap-2">
                      {VALUE_STEPS.map((step, index) => (
                        <div
                          key={step}
                          className={`inline-flex h-9 items-center rounded-full border px-4 text-[13px] font-semibold ${
                            index === VALUE_STEPS.length - 1
                              ? "border-[#0a84ff]/24 bg-[#0a84ff]/10 text-[#0a84ff] dark:border-[#78b8ff]/22 dark:bg-[#78b8ff]/12 dark:text-[#9ed0ff]"
                              : "border-black/8 bg-white/72 text-black/68 dark:border-white/10 dark:bg-white/6 dark:text-white/70"
                          }`}
                        >
                          {step}
                        </div>
                      ))}
                    </div>
                    <p className="mt-4 text-[16px] leading-[1.65] tracking-[-0.015em] text-black/72 dark:text-white/74">
                      不是把更多商品堆给你，而是先帮你看懂、比清、再做决定。
                    </p>
                  </section>
                </div>
              </div>

              <div
                className={`transition-[opacity,transform] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] delay-225 ${
                  revealed ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
                }`}
              >
                <div className="overflow-hidden rounded-[32px] border border-black/8 bg-white/72 p-4 shadow-[0_24px_48px_rgba(15,29,53,0.1),inset_0_1px_0_rgba(255,255,255,0.82)] backdrop-blur-2xl dark:border-white/10 dark:bg-[rgba(15,23,35,0.74)] dark:shadow-[0_28px_54px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.06)]">
                  <MobileTrackedLink
                    href="/m?guide=1&step=choose"
                    eventName="mobile_intro_cta_click"
                    eventProps={{
                      page: "mobile_intro",
                      route: "/m",
                      source: "m_intro",
                      action: "open_guide",
                      target_path: "/m?guide=1&step=choose",
                    }}
                    className="m-pressable inline-flex h-14 w-full items-center justify-center rounded-full bg-[linear-gradient(180deg,#4aa8ff_0%,#0a84ff_42%,#0071e3_100%)] text-[16px] font-semibold tracking-[-0.02em] text-white shadow-[0_18px_36px_rgba(10,132,255,0.28),inset_0_1px_0_rgba(255,255,255,0.28)] active:scale-[0.992]"
                  >
                    下一步
                  </MobileTrackedLink>
                  <p className="mt-3 text-center text-[12px] leading-[1.5] text-black/46 dark:text-white/48">
                    先用半分钟看完四个入口，进入后就知道自己会拿到什么。
                  </p>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex min-h-[100dvh] flex-col">
            <div
              className={`transition-[opacity,transform] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                revealed ? "translate-y-0 opacity-100" : "translate-y-5 opacity-0"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-[12px] font-semibold tracking-[0.02em] text-white/78 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-xl">
                  <span className="h-2 w-2 rounded-full bg-[#7cc6ff]" />
                  予选新手指引
                </div>

                <button
                  type="button"
                  onClick={closeGuide}
                  className="m-pressable inline-flex h-9 items-center rounded-full border border-white/10 bg-white/[0.05] px-3 text-[13px] font-medium text-white/58 active:bg-white/[0.09]"
                >
                  返回前页
                </button>
              </div>

              <div className="mt-6 max-w-[560px]">
                <p className="text-[13px] font-medium tracking-[0.02em] text-[#9ed0ff]">新手指引 · {guideProgress}</p>
                <h1 className="mt-3 text-[34px] leading-[1.02] font-semibold tracking-[-0.04em] text-white/96 sm:text-[40px]">
                  进入前，先知道每个入口会给你什么结果
                </h1>
                <p className="mt-4 max-w-[560px] text-[16px] leading-[1.65] tracking-[-0.015em] text-white/64">
                  不是猜图标，也不是先进去再摸索。先把四个入口各自能帮你解决什么看清楚。
                </p>
              </div>
            </div>

            <div className="mt-8 flex flex-1 flex-col">
              <div className="relative flex flex-1 flex-col overflow-hidden rounded-[36px] border border-white/10 bg-[linear-gradient(180deg,rgba(13,20,32,0.92)_0%,rgba(7,11,18,0.96)_100%)] p-4 shadow-[0_30px_80px_rgba(0,0,0,0.46),inset_0_1px_0_rgba(255,255,255,0.06)]">
                <div className="pointer-events-none absolute inset-x-6 top-8 h-[180px] rounded-[30px] border border-white/[0.05] bg-white/[0.03] blur-[2px]" />
                <div className="pointer-events-none absolute left-8 right-12 top-[118px] h-[160px] rounded-[30px] border border-white/[0.04] bg-white/[0.02] blur-[3px]" />
                <div className="pointer-events-none absolute right-[-12%] top-[18%] h-[200px] w-[200px] rounded-full bg-[#0a84ff]/12 blur-3xl" />

                <div
                  key={activeGuideStep.id}
                  className="relative rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.12)_0%,rgba(255,255,255,0.08)_100%)] p-6 shadow-[0_24px_48px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-2xl"
                >
                  <div className="inline-flex items-center rounded-full border border-[#7cc6ff]/18 bg-[#0a84ff]/14 px-3 py-1 text-[12px] font-semibold text-[#9ed0ff]">
                    {activeGuideStep.previewTag}
                  </div>
                  <p className="mt-4 text-[13px] font-medium tracking-[0.02em] text-white/48">你最终会拿到</p>
                  <h2 className="mt-2 max-w-[420px] text-[28px] leading-[1.08] font-semibold tracking-[-0.035em] text-white/96">
                    {activeGuideStep.previewTitle}
                  </h2>
                  <p className="mt-4 max-w-[460px] text-[15px] leading-[1.7] tracking-[-0.01em] text-white/66">
                    {activeGuideStep.previewBody}
                  </p>

                  <div className="mt-5 flex flex-wrap gap-2">
                    {activeGuideStep.outcomes.map((item) => (
                      <div
                        key={item}
                        className="inline-flex h-9 items-center rounded-full border border-white/10 bg-white/[0.06] px-4 text-[13px] font-medium text-white/76"
                      >
                        {item}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pointer-events-none absolute inset-x-0 bottom-[128px] flex justify-center">
                  <div
                    className="absolute -translate-x-1/2 text-[#9ed0ff]"
                    style={{ left: activeGuideStep.targetX }}
                  >
                    <GuidePointer />
                  </div>
                </div>

                <div
                  className="mt-auto rounded-[30px] border border-white/10 bg-white/[0.06] p-5 shadow-[0_24px_48px_rgba(0,0,0,0.24),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-2xl"
                >
                  <p className="text-[12px] font-semibold tracking-[0.04em] text-[#9ed0ff]">{activeGuideStep.eyebrow}</p>
                  <h3 className="mt-2 text-[22px] leading-[1.18] font-semibold tracking-[-0.03em] text-white/96">
                    {activeGuideStep.title}
                  </h3>
                  <p className="mt-3 text-[15px] leading-[1.7] tracking-[-0.01em] text-white/64">{activeGuideStep.body}</p>

                  <div className="mt-5 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => (activeGuideIndex === 0 ? closeGuide() : openGuideStep(activeGuideIndex - 1))}
                      className="m-pressable inline-flex h-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] px-4 text-[14px] font-medium text-white/66 active:bg-white/[0.08]"
                    >
                      {activeGuideIndex === 0 ? "返回前页" : "上一步"}
                    </button>

                    {activeGuideIndex === GUIDE_STEPS.length - 1 ? (
                      <MobileTrackedLink
                        href="/m/choose"
                        eventName="mobile_intro_cta_click"
                        eventProps={{
                          page: "mobile_intro",
                          route: "/m",
                          source: "m_intro",
                          action: "finish_guide",
                          target_path: "/m/choose",
                        }}
                        className="m-pressable inline-flex h-11 flex-1 items-center justify-center rounded-full bg-[linear-gradient(180deg,#56b1ff_0%,#0a84ff_48%,#0071e3_100%)] px-5 text-[15px] font-semibold tracking-[-0.02em] text-white shadow-[0_16px_32px_rgba(10,132,255,0.28),inset_0_1px_0_rgba(255,255,255,0.28)] active:scale-[0.992]"
                      >
                        进入予选
                      </MobileTrackedLink>
                    ) : (
                      <button
                        type="button"
                        onClick={() => openGuideStep(activeGuideIndex + 1)}
                        className="m-pressable inline-flex h-11 flex-1 items-center justify-center rounded-full bg-[linear-gradient(180deg,#56b1ff_0%,#0a84ff_48%,#0071e3_100%)] px-5 text-[15px] font-semibold tracking-[-0.02em] text-white shadow-[0_16px_32px_rgba(10,132,255,0.28),inset_0_1px_0_rgba(255,255,255,0.28)] active:scale-[0.992]"
                      >
                        下一步
                      </button>
                    )}
                  </div>
                </div>

                <div className="mt-4 rounded-[30px] border border-white/10 bg-black/34 p-1.5 shadow-[0_20px_44px_rgba(0,0,0,0.3)] backdrop-blur-2xl">
                  <div className="grid grid-cols-4 gap-1.5">
                    {GUIDE_STEPS.map((step, index) => {
                      const active = activeGuideIndex === index;
                      return (
                        <button
                          key={step.id}
                          type="button"
                          onClick={() => openGuideStep(index)}
                          className={`m-pressable flex min-h-[62px] flex-col items-center justify-center rounded-[24px] px-2 text-center transition-[background-color,color,box-shadow,transform] duration-250 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                            active
                              ? "bg-[linear-gradient(180deg,rgba(81,176,255,0.34)_0%,rgba(10,132,255,0.18)_100%)] text-white shadow-[0_16px_32px_rgba(10,132,255,0.22)]"
                              : "text-white/48 active:bg-white/[0.08] active:text-white/72"
                          }`}
                        >
                          <span className="leading-none">
                            <GuideNavIcon name={step.id} />
                          </span>
                          <span className={`mt-2 text-[11px] leading-none ${active ? "font-semibold" : "font-medium"}`}>{step.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
