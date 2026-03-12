"use client";

import { useEffect, useState } from "react";
import MobilePageAnalytics from "@/components/mobile/MobilePageAnalytics";
import MobileTrackedLink from "@/components/mobile/MobileTrackedLink";

const VALUE_STEPS = ["看懂", "比清", "决定"] as const;

export default function MobileHome() {
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const rafId = window.requestAnimationFrame(() => {
      setRevealed(true);
    });
    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <section className="-mx-4 -my-6 min-h-[100dvh] overflow-hidden bg-[color:var(--m-bg)]">
      <MobilePageAnalytics page="mobile_intro" route="/m" source="m_intro" />

      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-[-12%] top-[-8%] h-[280px] w-[280px] rounded-full bg-[#0a84ff]/12 blur-3xl" />
        <div className="absolute right-[-18%] top-[24%] h-[260px] w-[260px] rounded-full bg-white/10 blur-3xl dark:bg-[#78b8ff]/10" />
        <div className="absolute bottom-[-10%] left-[14%] h-[240px] w-[240px] rounded-full bg-[#7cc6ff]/8 blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-[100dvh] max-w-[680px] flex-col px-4 pb-[calc(env(safe-area-inset-bottom)+28px)] pt-[calc(env(safe-area-inset-top)+24px)]">
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
                href="/m/choose"
                eventName="mobile_intro_cta_click"
                eventProps={{
                  page: "mobile_intro",
                  route: "/m",
                  source: "m_intro",
                  action: "start_profile",
                  target_path: "/m/choose",
                }}
                className="m-pressable inline-flex h-14 w-full items-center justify-center rounded-full bg-[linear-gradient(180deg,#4aa8ff_0%,#0a84ff_42%,#0071e3_100%)] text-[16px] font-semibold tracking-[-0.02em] text-white shadow-[0_18px_36px_rgba(10,132,255,0.28),inset_0_1px_0_rgba(255,255,255,0.28)] active:scale-[0.992]"
              >
                开始测配
              </MobileTrackedLink>
              <p className="mt-3 text-center text-[12px] leading-[1.5] text-black/46 dark:text-white/48">
                从这里开始，更快知道什么更适合你。
              </p>
              <div className="mt-2 text-center">
                <MobileTrackedLink
                  href="/m/wiki"
                  eventName="mobile_intro_cta_click"
                  eventProps={{
                    page: "mobile_intro",
                    route: "/m",
                    source: "m_intro",
                    action: "browse_wiki",
                    target_path: "/m/wiki",
                  }}
                  className="m-pressable text-[12px] font-medium text-black/34 underline underline-offset-4 hover:text-black/46 dark:text-white/32 dark:hover:text-white/46"
                >
                  想先看看百科
                </MobileTrackedLink>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
