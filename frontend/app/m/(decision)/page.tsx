"use client";

import { useEffect, useMemo, useState } from "react";
import MobilePageAnalytics from "@/components/mobile/MobilePageAnalytics";
import MobileTrackedLink from "@/components/mobile/MobileTrackedLink";
import {
  readDecisionResumeItem,
  type DecisionResumeItem,
} from "@/domain/mobile/progress/decisionResume";
import {
  buildDecisionCompareEntryHref,
  buildDecisionHomePrimaryHref,
  resolveDecisionHomePrimaryFlow,
} from "@/features/mobile-decision/decisionFlowTruth";
import { fetchMobileUserProducts, type MobileSelectionCategory } from "@/lib/api";
import { trackMobileEvent } from "@/lib/mobileAnalytics";

const TRUST_POINTS = ["约 30-45 秒", "直接给结果和理由", "少靠猜，少踩坑"] as const;
const HOME_PRIMARY_TARGET = buildDecisionHomePrimaryHref();

type HomeWorkspaceAction = {
  label: string;
  description: string;
  href: string;
  eventName: "home_resume_click" | "home_workspace_quick_action_click";
  action?: "resume" | "review_result" | "in_use_compare";
};

function getResumeTitle(item: DecisionResumeItem): string {
  if (item.kind === "draft") {
    return `你上次做到 ${item.labelZh} 第 ${item.answeredCount}/${item.totalSteps} 步，继续即可。`;
  }
  return `你上次拿到的是 ${item.labelZh} 结果，可以直接回看。`;
}

function getResumeActionLabel(item: DecisionResumeItem): string {
  return item.kind === "draft" ? "继续上次进度" : "回看上次结果";
}

export default function MobileDecisionHomePage() {
  const [resumeItem, setResumeItem] = useState<DecisionResumeItem | null>(null);
  const [inUseCategory, setInUseCategory] = useState<MobileSelectionCategory | null>(null);
  const [revealed, setRevealed] = useState(false);
  const analyticsSource = "m_home";
  const compareInUsePath = useMemo(
    () => buildDecisionCompareEntryHref(inUseCategory),
    [inUseCategory],
  );
  const workspacePrimaryFlow = useMemo(
    () => resolveDecisionHomePrimaryFlow({ resumeItem, inUseCategory }),
    [inUseCategory, resumeItem],
  );
  const isReturningUser = Boolean(workspacePrimaryFlow || inUseCategory);
  const workspacePrimaryAction = useMemo<HomeWorkspaceAction | null>(() => {
    if (!workspacePrimaryFlow) return null;
    if (workspacePrimaryFlow.kind === "resume_profile" || workspacePrimaryFlow.kind === "reopen_result") {
      return {
        label: getResumeActionLabel(workspacePrimaryFlow.resumeItem),
        description: getResumeTitle(workspacePrimaryFlow.resumeItem),
        href: workspacePrimaryFlow.href,
        eventName: "home_resume_click",
        action: workspacePrimaryFlow.kind === "resume_profile" ? "resume" : "review_result",
      };
    }
    if (workspacePrimaryFlow.kind === "in_use_compare") {
      return {
        label: "和当前在用做对比",
        description: "已检测到在用品记录，直接带入对比并判断是否值得继续用。",
        href: workspacePrimaryFlow.href,
        eventName: "home_workspace_quick_action_click",
        action: "in_use_compare",
      };
    }
    return null;
  }, [workspacePrimaryFlow]);
  const workspaceQuickActions = useMemo(
    () => [
      { label: "测新的", href: "/m/choose", action: "new_test" as const },
      { label: "对比", href: compareInUsePath, action: "compare" as const },
      { label: "查百科", href: "/m/wiki", action: "wiki" as const },
      { label: "我的", href: "/m/me", action: "me" as const },
    ],
    [compareInUsePath],
  );
  const showInUsePriorityCard = Boolean(inUseCategory && resumeItem);

  useEffect(() => {
    const rafId = window.requestAnimationFrame(() => {
      setRevealed(true);
    });
    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, []);

  useEffect(() => {
    const syncResume = () => {
      setResumeItem(readDecisionResumeItem(window.localStorage));
    };

    syncResume();
    window.addEventListener("focus", syncResume);
    window.addEventListener("storage", syncResume);
    return () => {
      window.removeEventListener("focus", syncResume);
      window.removeEventListener("storage", syncResume);
    };
  }, []);

  useEffect(() => {
    let active = true;
    const syncInUseCategory = async () => {
      try {
        const response = await fetchMobileUserProducts({ limit: 1 });
        if (!active) return;
        setInUseCategory(response.items[0]?.category || null);
      } catch {
        if (!active) return;
        setInUseCategory(null);
      }
    };

    void syncInUseCategory();
    const onFocus = () => {
      void syncInUseCategory();
    };
    window.addEventListener("focus", onFocus);
    return () => {
      active = false;
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  useEffect(() => {
    void trackMobileEvent("home_view", {
      page: "mobile_home",
      route: "/m",
      source: analyticsSource,
    });
  }, []);

  return (
    <section className="relative overflow-hidden pb-4">
      <MobilePageAnalytics page="mobile_home" route="/m" source={analyticsSource} />

      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-[-16%] top-[-10%] h-[260px] w-[260px] rounded-full bg-[#0a84ff]/12 blur-3xl" />
        <div className="absolute right-[-20%] top-[16%] h-[240px] w-[240px] rounded-full bg-[#6cc1ff]/10 blur-3xl" />
        <div className="absolute bottom-[-10%] left-[20%] h-[220px] w-[220px] rounded-full bg-[#ffd88f]/12 blur-3xl" />
      </div>

      <div className="relative space-y-6">
        <section
          className={`rounded-[32px] border border-black/8 bg-white/78 p-6 shadow-[0_24px_48px_rgba(15,29,53,0.08),inset_0_1px_0_rgba(255,255,255,0.85)] backdrop-blur-2xl transition-[opacity,transform] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] dark:border-white/10 dark:bg-[rgba(15,23,35,0.74)] dark:shadow-[0_28px_56px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.05)] ${
            revealed ? "translate-y-0 opacity-100" : "translate-y-5 opacity-0"
          }`}
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-black/8 bg-white/70 px-3 py-1.5 text-[12px] font-semibold tracking-[0.02em] text-black/66 dark:border-white/10 dark:bg-white/6 dark:text-white/66">
            <span className="h-2 w-2 rounded-full bg-[#0a84ff]" />
            个护决策工具
          </div>

          <h1 className="mt-5 max-w-[10ch] text-[40px] leading-[0.98] font-semibold tracking-[-0.05em] text-black/92 sm:text-[46px] dark:text-white/96">
            更快选到适合自己的护理方案
          </h1>

          <p className="mt-4 max-w-[34rem] text-[17px] leading-[1.65] tracking-[-0.015em] text-black/68 dark:text-white/72">
            回答少量问题，直接得到更适合你的护理方向和产品结果，不用自己逐个比成分。
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-2 text-[12px] font-medium text-black/56 dark:text-white/58">
            {TRUST_POINTS.map((item) => (
              <span
                key={item}
                className="rounded-full border border-black/8 bg-white/72 px-3 py-1.5 dark:border-white/10 dark:bg-white/6"
              >
                {item}
              </span>
            ))}
          </div>

          <div className="mt-7 grid gap-3">
            {!isReturningUser ? (
              <MobileTrackedLink
                href={HOME_PRIMARY_TARGET}
                eventName="home_primary_cta_click"
                eventProps={{
                  page: "mobile_home",
                  route: "/m",
                  source: analyticsSource,
                  target_path: HOME_PRIMARY_TARGET,
                }}
                className="m-pressable inline-flex h-14 items-center justify-center rounded-full bg-[linear-gradient(180deg,#4aa8ff_0%,#0a84ff_42%,#0071e3_100%)] px-6 text-[16px] font-semibold tracking-[-0.02em] text-white shadow-[0_18px_36px_rgba(10,132,255,0.28),inset_0_1px_0_rgba(255,255,255,0.28)] active:scale-[0.992]"
              >
                开始测配
              </MobileTrackedLink>
            ) : null}

            {isReturningUser && workspacePrimaryAction ? (
              <MobileTrackedLink
                href={workspacePrimaryAction.href}
                eventName={workspacePrimaryAction.eventName}
                eventProps={
                  workspacePrimaryAction.eventName === "home_resume_click"
                    ? {
                        page: "mobile_home",
                        route: "/m",
                        source: analyticsSource,
                        target_path: workspacePrimaryAction.href,
                      }
                    : {
                        page: "mobile_home",
                        route: "/m",
                        source: analyticsSource,
                        target_path: workspacePrimaryAction.href,
                        action: workspacePrimaryAction.action,
                      }
                }
                className="m-pressable inline-flex min-h-14 items-center justify-between gap-4 rounded-[24px] border border-black/8 bg-white/70 px-5 py-4 text-left shadow-[0_20px_40px_rgba(15,29,53,0.06)] dark:border-white/10 dark:bg-white/6 dark:shadow-[0_20px_44px_rgba(0,0,0,0.22)]"
              >
                <span>
                  <span className="block text-[14px] font-semibold tracking-[-0.01em] text-black/82 dark:text-white/86">
                    {workspacePrimaryAction.label}
                  </span>
                  <span className="mt-1 block text-[13px] leading-[1.55] text-black/58 dark:text-white/60">
                    {workspacePrimaryAction.description}
                  </span>
                </span>
                <span className="text-[15px] font-semibold text-[#0a84ff] dark:text-[#9ed0ff]">继续</span>
              </MobileTrackedLink>
            ) : null}

            {showInUsePriorityCard ? (
              <MobileTrackedLink
                href={compareInUsePath}
                eventName="home_workspace_quick_action_click"
                eventProps={{
                  page: "mobile_home",
                  route: "/m",
                  source: analyticsSource,
                  target_path: compareInUsePath,
                  action: "in_use_compare",
                }}
                className="m-pressable inline-flex min-h-12 items-center justify-between gap-3 rounded-[20px] border border-black/8 bg-white/65 px-5 py-3.5 text-left shadow-[0_14px_30px_rgba(15,29,53,0.06)] dark:border-white/10 dark:bg-white/6 dark:shadow-[0_18px_36px_rgba(0,0,0,0.22)]"
              >
                <span>
                  <span className="block text-[14px] font-semibold text-black/82 dark:text-white/86">和当前在用做对比</span>
                  <span className="mt-1 block text-[12px] leading-[1.55] text-black/56 dark:text-white/60">保持当前习惯，同时判断要不要替换。</span>
                </span>
                <span className="text-[15px] font-semibold text-[#0a84ff] dark:text-[#9ed0ff]">前往</span>
              </MobileTrackedLink>
            ) : null}
          </div>
        </section>

        <section
          className={`grid gap-4 transition-[opacity,transform] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] delay-100 ${
            revealed ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
          }`}
        >
          {!isReturningUser ? (
            <>
              <div className="rounded-[28px] border border-black/8 bg-white/64 p-5 shadow-[0_18px_36px_rgba(15,29,53,0.06)] backdrop-blur-2xl dark:border-white/10 dark:bg-[rgba(18,27,40,0.62)] dark:shadow-[0_20px_42px_rgba(0,0,0,0.24)]">
                <p className="text-[12px] font-semibold tracking-[0.06em] text-black/44 dark:text-white/46">怎么工作</p>
                <p className="mt-3 text-[18px] leading-[1.6] tracking-[-0.02em] text-black/82 dark:text-white/84">
                  先问少量问题，快速收敛到更适合你的护理方向，再给产品答案和理由。
                </p>
              </div>

            </>
          ) : (
            <div className="rounded-[28px] border border-black/8 bg-white/64 p-5 shadow-[0_18px_36px_rgba(15,29,53,0.06)] backdrop-blur-2xl dark:border-white/10 dark:bg-[rgba(18,27,40,0.62)] dark:shadow-[0_20px_42px_rgba(0,0,0,0.24)]">
              <p className="text-[12px] font-semibold tracking-[0.06em] text-black/44 dark:text-white/46">快捷动作</p>
              <div className="mt-3 grid grid-cols-2 gap-2.5">
                {workspaceQuickActions.map((item) => (
                  <MobileTrackedLink
                    key={item.action}
                    href={item.href}
                    eventName="home_workspace_quick_action_click"
                    eventProps={{
                      page: "mobile_home",
                      route: "/m",
                      source: analyticsSource,
                      target_path: item.href,
                      action: item.action,
                    }}
                    className="m-pressable inline-flex min-h-11 items-center justify-between rounded-[18px] border border-black/10 bg-white/80 px-4 py-3 text-[14px] font-semibold text-black/76 active:bg-black/[0.03] dark:border-white/12 dark:bg-white/7 dark:text-white/78"
                  >
                    <span>{item.label}</span>
                    <span className="text-black/32 dark:text-white/38">→</span>
                  </MobileTrackedLink>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>
    </section>
  );
}
