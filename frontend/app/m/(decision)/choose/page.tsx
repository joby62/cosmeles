"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import MobilePageAnalytics from "@/components/mobile/MobilePageAnalytics";
import MobileTrackedLink from "@/components/mobile/MobileTrackedLink";
import {
  getDecisionCatalogPrimaryEntry,
  listDecisionCategories,
  formatDecisionDurationSummary,
} from "@/domain/mobile/decision/catalog";
import { getDecisionCategoryPresentation } from "@/domain/mobile/decision/presentation";
import {
  DECISION_SELECTED_CATEGORY_STORAGE_KEY,
  appendSourceToPath,
  normalizeDecisionCategory,
  readDecisionResumeItem,
  type DecisionResumeItem,
} from "@/domain/mobile/progress/decisionResume";
import type { MobileSelectionCategory } from "@/lib/api";
import { trackMobileEvent } from "@/lib/mobileAnalytics";

function getResumeCopy(item: DecisionResumeItem): string {
  if (item.kind === "draft") {
    return `你上次做到 ${item.labelZh} 第 ${item.answeredCount}/${item.totalSteps} 步，继续即可。`;
  }
  return `你上次看过 ${item.labelZh} 结果，如果状态没变，可以直接回看。`;
}

function getResumeAction(item: DecisionResumeItem): string {
  return item.kind === "draft" ? "继续进度" : "回看结果";
}

export default function MobileChoosePage() {
  const categories = listDecisionCategories();
  const [resumeItem, setResumeItem] = useState<DecisionResumeItem | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<MobileSelectionCategory>(
    normalizeDecisionCategory(getDecisionCatalogPrimaryEntry()) || "shampoo",
  );
  const analyticsSource = "m_choose";
  const resumeTargetPath = useMemo(
    () => (resumeItem ? appendSourceToPath(resumeItem.targetPath, "choose_resume") : null),
    [resumeItem],
  );

  useEffect(() => {
    const syncSelection = () => {
      const preferredCategory = normalizeDecisionCategory(window.localStorage.getItem(DECISION_SELECTED_CATEGORY_STORAGE_KEY));
      const latestResume = readDecisionResumeItem(window.localStorage);
      setResumeItem(latestResume);
      setSelectedCategory(
        preferredCategory ||
          latestResume?.category ||
          normalizeDecisionCategory(getDecisionCatalogPrimaryEntry()) ||
          "shampoo",
      );
    };

    syncSelection();
    window.addEventListener("focus", syncSelection);
    window.addEventListener("storage", syncSelection);
    return () => {
      window.removeEventListener("focus", syncSelection);
      window.removeEventListener("storage", syncSelection);
    };
  }, []);

  useEffect(() => {
    void trackMobileEvent("choose_view", {
      page: "mobile_choose",
      route: "/m/choose",
      source: analyticsSource,
    });
  }, []);

  const handleSelectCategory = (category: MobileSelectionCategory) => {
    setSelectedCategory(category);
    window.localStorage.setItem(DECISION_SELECTED_CATEGORY_STORAGE_KEY, category);
    void trackMobileEvent("choose_category_select", {
      page: "mobile_choose",
      route: "/m/choose",
      source: analyticsSource,
      category,
    });
  };

  return (
    <section className="relative overflow-hidden pb-6">
      <MobilePageAnalytics page="mobile_choose" route="/m/choose" source={analyticsSource} />

      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute right-[-18%] top-[-10%] h-[240px] w-[240px] rounded-full bg-[#0a84ff]/10 blur-3xl" />
        <div className="absolute left-[-14%] top-[28%] h-[220px] w-[220px] rounded-full bg-[#ffd88f]/10 blur-3xl" />
      </div>

      <div className="relative space-y-5">
        <section className="rounded-[28px] border border-black/8 bg-white/74 p-6 shadow-[0_22px_44px_rgba(15,29,53,0.08),inset_0_1px_0_rgba(255,255,255,0.82)] backdrop-blur-2xl dark:border-white/10 dark:bg-[rgba(15,23,35,0.74)] dark:shadow-[0_24px_48px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.05)]">
          <p className="text-[12px] font-semibold tracking-[0.06em] text-black/46 dark:text-white/48">选择品类</p>
          <h1 className="mt-3 text-[34px] leading-[1.04] font-semibold tracking-[-0.045em] text-black/92 dark:text-white/96">
            先选你现在要解决的那一类
          </h1>
          <p className="mt-3 max-w-[32rem] text-[16px] leading-[1.65] tracking-[-0.015em] text-black/66 dark:text-white/70">
            每类只问少量问题，直接给更合适的方向和结果。
          </p>
        </section>

        {resumeItem && resumeTargetPath ? (
          <section className="rounded-[24px] border border-[#0a84ff]/16 bg-[linear-gradient(180deg,rgba(10,132,255,0.10),rgba(255,255,255,0.84))] p-5 shadow-[0_18px_38px_rgba(10,132,255,0.10)] backdrop-blur-2xl dark:border-[#78b8ff]/18 dark:bg-[linear-gradient(180deg,rgba(120,184,255,0.14),rgba(18,26,38,0.86))]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[12px] font-semibold tracking-[0.06em] text-[#0a84ff] dark:text-[#9ed0ff]">恢复上次进度</p>
                <p className="mt-2 text-[15px] leading-[1.6] text-black/76 dark:text-white/78">{getResumeCopy(resumeItem)}</p>
              </div>
              <MobileTrackedLink
                href={resumeTargetPath}
                eventName="choose_resume_click"
                eventProps={{
                  page: "mobile_choose",
                  route: "/m/choose",
                  source: analyticsSource,
                  category: resumeItem.category,
                  target_path: resumeTargetPath,
                }}
                className="m-pressable inline-flex shrink-0 items-center justify-center rounded-full bg-[#0a84ff] px-4 py-2 text-[13px] font-semibold text-white shadow-[0_14px_28px_rgba(10,132,255,0.22)]"
              >
                {getResumeAction(resumeItem)}
              </MobileTrackedLink>
            </div>
          </section>
        ) : null}

        <section className="grid gap-4">
          {categories.map((category) => {
            const presentation = getDecisionCategoryPresentation(category.key);
            const active = selectedCategory === category.key;
            const startPath = `/m/${category.key}/profile?step=1&source=choose_start`;
            return (
              <article
                key={category.key}
                className={`overflow-hidden rounded-[28px] border p-5 shadow-[0_20px_40px_rgba(15,29,53,0.08)] backdrop-blur-2xl transition-[transform,border-color,box-shadow] duration-200 ${
                  active
                    ? "border-[#0a84ff]/20 bg-[linear-gradient(180deg,rgba(10,132,255,0.10),rgba(255,255,255,0.88))] dark:border-[#78b8ff]/22 dark:bg-[linear-gradient(180deg,rgba(120,184,255,0.14),rgba(18,26,38,0.86))]"
                    : "border-black/8 bg-white/70 dark:border-white/10 dark:bg-[rgba(18,27,40,0.66)]"
                }`}
              >
                <button
                  type="button"
                  onClick={() => handleSelectCategory(category.key)}
                  className="block w-full text-left"
                  aria-pressed={active}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="max-w-[15rem]">
                      <div className="inline-flex items-center rounded-full border border-black/8 bg-white/72 px-3 py-1 text-[12px] font-medium text-black/50 dark:border-white/10 dark:bg-white/6 dark:text-white/52">
                        {formatDecisionDurationSummary(category)}
                      </div>
                      <h2 className="mt-3 text-[24px] leading-[1.05] font-semibold tracking-[-0.035em] text-black/90 dark:text-white/94">
                        {category.labelZh}
                      </h2>
                      <p className="mt-3 text-[15px] leading-[1.65] text-black/66 dark:text-white/68">{presentation.scene}</p>
                    </div>
                    <div className="relative h-[96px] w-[112px] shrink-0 overflow-hidden rounded-[22px] bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.92),rgba(255,255,255,0.56)_65%,rgba(255,255,255,0.18))] dark:bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.22),rgba(255,255,255,0.08)_65%,rgba(255,255,255,0.02))]">
                      <Image
                        src={presentation.imageSrc}
                        alt={category.labelZh}
                        fill
                        className="object-contain p-3"
                        sizes="112px"
                      />
                    </div>
                  </div>
                </button>

                <div className="mt-5 flex items-center justify-between gap-4">
                  <p className="text-[13px] text-black/46 dark:text-white/48">{active ? "当前选择" : "点卡片可切换当前选择"}</p>
                  <MobileTrackedLink
                    href={startPath}
                    eventName="choose_start_click"
                    eventProps={{
                      page: "mobile_choose",
                      route: "/m/choose",
                      source: analyticsSource,
                      category: category.key,
                      target_path: startPath,
                    }}
                    onClick={() => {
                      window.localStorage.setItem(DECISION_SELECTED_CATEGORY_STORAGE_KEY, category.key);
                    }}
                    className={`m-pressable inline-flex items-center justify-center rounded-full px-5 py-2.5 text-[14px] font-semibold ${
                      active
                        ? "bg-[#0a84ff] text-white shadow-[0_14px_28px_rgba(10,132,255,0.24)]"
                        : "border border-black/8 bg-white/82 text-black/76 dark:border-white/10 dark:bg-white/8 dark:text-white/76"
                    }`}
                  >
                    开始
                  </MobileTrackedLink>
                </div>
              </article>
            );
          })}
        </section>
      </div>
    </section>
  );
}
