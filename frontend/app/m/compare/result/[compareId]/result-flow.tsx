"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { MobileCompareResult, MobileCompareResultSection } from "@/lib/api";

type StepKey = "decision" | "reason" | "action";

type StepMeta = {
  key: StepKey;
  label: string;
  short: string;
};

type InsightCard = {
  key: string;
  title: string;
  summary: string;
  items: string[];
};

type ReportCard = {
  key: string;
  title: string;
  summary: string;
  decision: "keep" | "switch" | "hybrid";
  items: string[];
};

const STEP_META: StepMeta[] = [
  { key: "decision", label: "1. 先看结论", short: "结论" },
  { key: "reason", label: "2. 再看原因", short: "原因" },
  { key: "action", label: "3. 最后行动", short: "行动" },
];

export default function MobileCompareResultFlow({ result }: { result: MobileCompareResult }) {
  const [activeStep, setActiveStep] = useState<StepKey>("decision");
  const [activeSheet, setActiveSheet] = useState<{ title: string; items: string[] } | null>(null);
  const [sheetIndex, setSheetIndex] = useState(0);
  const [reportOpen, setReportOpen] = useState(false);

  const pairResults = useMemo(() => result.pair_results || [], [result.pair_results]);
  const overall = result.overall || null;
  const focusPair = pairResults[0] || null;
  const finalDecision = overall?.decision || result.verdict.decision;
  const finalConfidence = Math.round((overall?.confidence ?? result.verdict.confidence) * 100);
  const finalHeadline = sanitizeText(overall?.headline || result.verdict.headline || "你的本次对比结论已生成。", 42);
  const leftAnchor = focusPair?.left_title || productDocTitle(result.current_product, "当前方案");
  const rightAnchor = focusPair?.right_title || productDocTitle(result.recommended_product, "建议方案");
  const reasonSections = focusPair?.sections?.length ? focusPair.sections : result.sections;

  const benefits = getSectionItems(reasonSections, "keep_benefits");
  const watchouts = getSectionItems(reasonSections, "keep_watchouts");
  const profileAdvice = getSectionItems(reasonSections, "profile_fit_advice");
  const ingredientAdvice = getSectionItems(reasonSections, "ingredient_order_diff");
  const pairDigest = pairResults.map((pair) => `${pair.left_title} vs ${pair.right_title}：${pair.verdict.headline}`);

  const insightCards = useMemo<InsightCard[]>(() => {
    const candidates: InsightCard[] = [
      {
        key: "benefits",
        title: "你能得到什么",
        summary: summarizeLine(benefits[0] || "当前方案与画像匹配，能更稳定满足你的核心需求。"),
        items: benefits,
      },
      {
        key: "watchouts",
        title: "你要留意什么",
        summary: summarizeLine(watchouts[0] || "继续使用时留意头皮状态变化，避免过度清洁。"),
        items: watchouts,
      },
      {
        key: "profile",
        title: "结合你的情况",
        summary: summarizeLine(profileAdvice[0] || "按你的画像先执行当前结论，再看 7 天变化。"),
        items: profileAdvice,
      },
      {
        key: "pairs",
        title: "各组对比结论",
        summary: summarizeLine(pairDigest[0] || "多组对比后，结论已收敛到当前建议。"),
        items: pairDigest,
      },
      {
        key: "ingredient",
        title: "成分差异重点",
        summary: summarizeLine(ingredientAdvice[0] || "关键差异已在成分排位里体现。"),
        items: ingredientAdvice,
      },
    ];

    const picked = candidates.filter((card) => card.items.length > 0).slice(0, 3);
    if (picked.length > 0) return picked;
    return [
      {
        key: "fallback",
        title: "关键线索",
        summary: "已完成对比，建议先按结论执行，再看完整明细。",
        items: ["已完成对比，建议先按结论执行，再看完整明细。"],
      },
    ];
  }, [benefits, ingredientAdvice, pairDigest, profileAdvice, watchouts]);

  const actionItems = useMemo<string[]>(() => {
    const out: string[] = [];
    const add = (value: string) => {
      const text = sanitizeText(value, 60);
      if (!text) return;
      if (out.includes(text)) return;
      out.push(text);
    };

    profileAdvice.forEach(add);
    benefits.slice(0, 1).forEach(add);
    watchouts.slice(0, 1).forEach(add);

    if (out.length === 0) {
      add("先按本次结论执行 7 天，再根据头皮和发丝状态做下一轮对比。");
      add("若出现不适，优先降低使用频次并回看风险提示。");
      add("需要更细分场景时，再进入完整报告查看每组细节。");
    }

    return out.slice(0, 3);
  }, [benefits, profileAdvice, watchouts]);

  const reportCards = useMemo<ReportCard[]>(() => {
    if (pairResults.length === 0) {
      const detailItems = flattenSectionItems(reasonSections);
      return [
        {
          key: "single",
          title: "完整结论",
          summary: summarizeLine(result.verdict.headline || finalHeadline),
          decision: finalDecision,
          items: detailItems.length > 0 ? detailItems : ["本次完整数据较少，可先按当前结论执行。"],
        },
      ];
    }

    return pairResults.map((pair) => {
      const detailItems = flattenSectionItems(pair.sections);
      return {
        key: pair.pair_key,
        title: `${pair.left_title} vs ${pair.right_title}`,
        summary: summarizeLine(pair.verdict.headline || "这组结论已生成。"),
        decision: pair.verdict.decision,
        items: detailItems.length > 0 ? detailItems : ["该组暂无更细内容。"],
      };
    });
  }, [finalDecision, finalHeadline, pairResults, reasonSections, result.verdict.headline]);

  useEffect(() => {
    if (!activeSheet && !reportOpen) return;
    const prevOverflow = document.body.style.overflow;
    const prevTouchAction = document.body.style.touchAction;
    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none";
    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.touchAction = prevTouchAction;
    };
  }, [activeSheet, reportOpen]);

  useEffect(() => {
    const onEsc = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (activeSheet) {
        setActiveSheet(null);
        return;
      }
      if (reportOpen) {
        setReportOpen(false);
      }
    };

    window.addEventListener("keydown", onEsc);
    return () => {
      window.removeEventListener("keydown", onEsc);
    };
  }, [activeSheet, reportOpen]);

  const openSheet = (title: string, items: string[]) => {
    const cleaned = takeUnique(items);
    if (cleaned.length === 0) return;
    setActiveSheet({ title, items: cleaned });
    setSheetIndex(0);
  };

  const currentSheetItems = activeSheet?.items || [];
  const currentSheetText = currentSheetItems[sheetIndex] || "";

  return (
    <section className="m-compare-result-page space-y-4 pb-12">
      <nav className="grid grid-cols-3 gap-2">
        {STEP_META.map((step) => {
          const active = step.key === activeStep;
          return (
            <button
              key={step.key}
              type="button"
              onClick={() => {
                setActiveStep(step.key);
              }}
              className={`m-pressable rounded-2xl border px-2 py-2.5 text-center text-[12px] font-semibold transition ${
                active
                  ? "border-[#85b7ff] bg-[linear-gradient(180deg,#d9ebff_0%,#c9e1ff_100%)] text-[#1752ab] shadow-[0_10px_22px_rgba(0,113,227,0.16)] dark:border-[#4b8fe0] dark:bg-[linear-gradient(180deg,#1f3f6f_0%,#19355f_100%)] dark:text-[#cfe3ff]"
                  : "border-black/10 bg-white/78 text-black/56 dark:border-[#6a83ac]/38 dark:bg-[rgba(23,36,58,0.8)] dark:text-[#b8cce8]"
              }`}
            >
              <span className="hidden sm:inline">{step.label}</span>
              <span className="sm:hidden">{step.short}</span>
            </button>
          );
        })}
      </nav>

      <article className="rounded-[28px] border border-[#bfd4f8] bg-[linear-gradient(180deg,#f4f8ff_0%,#ecf3ff_58%,#ffffff_100%)] px-5 py-6 shadow-[0_16px_38px_rgba(34,77,151,0.13)] dark:border-[#48689e]/56 dark:bg-[linear-gradient(180deg,#112039_0%,#0f1d32_58%,#0d1729_100%)] dark:shadow-[0_16px_38px_rgba(0,0,0,0.5)]">
        {activeStep === "decision" ? (
          <DecisionStep
            finalHeadline={finalHeadline}
            finalDecision={finalDecision}
            finalConfidence={finalConfidence}
            currentTitle={leftAnchor}
            recommendedTitle={rightAnchor}
            summary={summarizeLine(focusPair?.verdict.headline || insightCards[0]?.summary || "先按本次结论执行，再按需查看细节。", 56)}
            onNext={() => {
              setActiveStep("reason");
            }}
            category={result.category}
          />
        ) : null}

        {activeStep === "reason" ? (
          <ReasonStep
            cards={insightCards}
            onOpenCard={(card) => {
              openSheet(card.title, card.items);
            }}
            onPrev={() => {
              setActiveStep("decision");
            }}
            onNext={() => {
              setActiveStep("action");
            }}
          />
        ) : null}

        {activeStep === "action" ? (
          <ActionStep
            actions={actionItems}
            onPrev={() => {
              setActiveStep("reason");
            }}
            onOpenReport={() => {
              setReportOpen(true);
            }}
            productLink={result.recommendation.links.product}
            wikiLink={result.recommendation.links.wiki}
          />
        ) : null}
      </article>

      {activeSheet ? (
        <div className="fixed inset-0 z-[84]" role="dialog" aria-modal="true" aria-label={`${activeSheet.title}详细内容`}>
          <button
            type="button"
            className="absolute inset-0 bg-black/48 backdrop-blur-sm"
            onClick={() => {
              setActiveSheet(null);
            }}
            aria-label="关闭弹层"
          />

          <div className="m-sheet-enter absolute inset-x-0 bottom-0 max-h-[84dvh] overflow-hidden rounded-t-[30px] border border-white/45 bg-white/95 shadow-[0_-24px_68px_rgba(0,0,0,0.34)] dark:border-[#7ca4df]/24 dark:bg-[rgba(16,26,42,0.96)] dark:shadow-[0_-24px_72px_rgba(0,0,0,0.56)]">
            <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-black/18 dark:bg-white/24" />
            <div className="flex items-center justify-between border-b border-black/8 px-5 py-3 dark:border-white/10">
              <h3 className="text-[17px] font-semibold text-[#17233b] dark:text-[#e7f0ff]">{activeSheet.title}</h3>
              <button
                type="button"
                onClick={() => {
                  setActiveSheet(null);
                }}
                className="m-pressable inline-flex h-8 items-center rounded-full border border-black/10 bg-white/75 px-3 text-[12px] font-medium text-[#24324a] active:bg-black/[0.03] dark:border-[#7ea5de]/28 dark:bg-[rgba(30,45,71,0.86)] dark:text-[#d6e7ff]"
              >
                关闭
              </button>
            </div>

            <div className="px-4 pb-5 pt-4">
              <div className="text-center text-[12px] text-[#5a6782] dark:text-[#abc5ed]">
                第 {sheetIndex + 1} / {currentSheetItems.length} 条
              </div>

              <div className="mt-3 rounded-[20px] border border-[#1f2a3f]/10 bg-[#f8fafd] px-4 py-4 text-[16px] leading-[1.6] text-[#1b2740] dark:border-[#6e88b3]/36 dark:bg-[rgba(31,45,70,0.76)] dark:text-[#dce9ff]">
                {currentSheetText}
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSheetIndex((current) => (current > 0 ? current - 1 : current));
                  }}
                  disabled={sheetIndex === 0}
                  className={`m-pressable inline-flex h-10 items-center justify-center rounded-full border text-[14px] font-medium ${
                    sheetIndex === 0
                      ? "cursor-not-allowed border-black/8 bg-black/[0.03] text-black/35 dark:border-white/8 dark:bg-white/[0.04] dark:text-white/35"
                      : "border-black/12 bg-white/82 text-[#293650] active:bg-black/[0.03] dark:border-[#7fa6df]/30 dark:bg-[rgba(32,47,74,0.84)] dark:text-[#d5e7ff]"
                  }`}
                >
                  上一条
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSheetIndex((current) => (current < currentSheetItems.length - 1 ? current + 1 : current));
                  }}
                  disabled={sheetIndex >= currentSheetItems.length - 1}
                  className={`m-pressable inline-flex h-10 items-center justify-center rounded-full border text-[14px] font-medium ${
                    sheetIndex >= currentSheetItems.length - 1
                      ? "cursor-not-allowed border-black/8 bg-black/[0.03] text-black/35 dark:border-white/8 dark:bg-white/[0.04] dark:text-white/35"
                      : "border-[#6aa9ff] bg-[linear-gradient(180deg,#2997ff_0%,#0071e3_100%)] text-white shadow-[0_10px_22px_rgba(0,113,227,0.28)] active:opacity-95"
                  }`}
                >
                  下一条
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {reportOpen ? (
        <div className="fixed inset-0 z-[82]" role="dialog" aria-modal="true" aria-label="完整报告">
          <button
            type="button"
            className="absolute inset-0 bg-black/46 backdrop-blur-sm"
            onClick={() => {
              setReportOpen(false);
            }}
            aria-label="关闭完整报告"
          />

          <div className="m-sheet-enter absolute inset-x-0 bottom-0 max-h-[86dvh] overflow-hidden rounded-t-[30px] border border-white/42 bg-white/96 shadow-[0_-24px_68px_rgba(0,0,0,0.34)] dark:border-[#7ca4df]/24 dark:bg-[rgba(14,24,40,0.97)] dark:shadow-[0_-26px_76px_rgba(0,0,0,0.62)]">
            <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-black/18 dark:bg-white/24" />
            <div className="flex items-center justify-between border-b border-black/8 px-5 py-3 dark:border-white/10">
              <h3 className="text-[17px] font-semibold text-[#17233b] dark:text-[#e7f0ff]">完整报告</h3>
              <button
                type="button"
                onClick={() => {
                  setReportOpen(false);
                }}
                className="m-pressable inline-flex h-8 items-center rounded-full border border-black/10 bg-white/75 px-3 text-[12px] font-medium text-[#24324a] active:bg-black/[0.03] dark:border-[#7ea5de]/28 dark:bg-[rgba(30,45,71,0.86)] dark:text-[#d6e7ff]"
              >
                关闭
              </button>
            </div>

            <div className="max-h-[calc(86dvh-88px)] space-y-3 overflow-y-auto px-4 pb-5 pt-4">
              {reportCards.map((card) => (
                <article
                  key={card.key}
                  className="rounded-[20px] border border-[#1f2a3f]/10 bg-white px-4 py-4 shadow-[0_8px_22px_rgba(16,32,61,0.06)] dark:border-[#6983ad]/34 dark:bg-[rgba(28,42,67,0.84)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h4 className="text-[15px] leading-[1.45] font-semibold text-[#17223a] dark:text-[#e4efff]">{card.title}</h4>
                    <span className={`inline-flex h-7 shrink-0 items-center rounded-full border px-2.5 text-[11px] font-semibold ${decisionTone(card.decision)}`}>
                      {pairDecisionLabel(card.decision)}
                    </span>
                  </div>
                  <p className="mt-2 text-[14px] leading-[1.52] text-[#3d4a63] dark:text-[#ccdefb]">{card.summary}</p>

                  <button
                    type="button"
                    onClick={() => {
                      openSheet(card.title, card.items);
                    }}
                    className="m-pressable mt-3 inline-flex h-9 items-center justify-center rounded-full bg-[linear-gradient(180deg,#2997ff_0%,#0071e3_100%)] px-4 text-[13px] font-semibold text-white shadow-[0_10px_22px_rgba(0,113,227,0.26)] active:opacity-95"
                  >
                    展开看全
                  </button>
                </article>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function DecisionStep({
  finalHeadline,
  finalDecision,
  finalConfidence,
  currentTitle,
  recommendedTitle,
  summary,
  onNext,
  category,
}: {
  finalHeadline: string;
  finalDecision: "keep" | "switch" | "hybrid";
  finalConfidence: number;
  currentTitle: string;
  recommendedTitle: string;
  summary: string;
  onNext: () => void;
  category: string;
}) {
  return (
    <div>
      <p className="text-[12px] font-semibold tracking-[0.04em] text-[#3b62ad] dark:text-[#8cb8ff]">一步一屏 · 先结论后细节</p>
      <h1 className="mt-2 text-[34px] leading-[1.14] font-semibold tracking-[-0.03em] text-[#111928] dark:text-[#edf3ff]">{finalHeadline}</h1>

      <div className="mt-4 flex flex-wrap gap-2">
        <span className={`inline-flex h-8 items-center rounded-full border px-3 text-[12px] font-semibold ${decisionTone(finalDecision)}`}>
          {decisionLabel(finalDecision)}
        </span>
        <span className="inline-flex h-8 items-center rounded-full border border-[#1f2a3f]/12 bg-white/85 px-3 text-[12px] text-[#3f4a61] dark:border-[#7b94c0]/38 dark:bg-[rgba(39,55,84,0.72)] dark:text-[#d5e5ff]">
          置信度 {finalConfidence}%
        </span>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <section className="rounded-2xl border border-[#1f2a3f]/10 bg-white/78 px-3 py-3 dark:border-[#6782ac]/34 dark:bg-[rgba(31,46,72,0.74)]">
          <p className="text-[11px] font-medium text-[#56627c] dark:text-[#acc6ef]">当前方案</p>
          <p className="mt-1 text-[13px] leading-[1.45] font-medium text-[#1c273e] dark:text-[#e5efff]">{sanitizeText(currentTitle, 46)}</p>
        </section>
        <section className="rounded-2xl border border-[#7eb2ff]/44 bg-[#edf5ff] px-3 py-3 dark:border-[#4e85d4]/50 dark:bg-[rgba(33,58,94,0.82)]">
          <p className="text-[11px] font-medium text-[#3a67b2] dark:text-[#b9d6ff]">建议方案</p>
          <p className="mt-1 text-[13px] leading-[1.45] font-medium text-[#1d3f7d] dark:text-[#d7e9ff]">{sanitizeText(recommendedTitle, 46)}</p>
        </section>
      </div>

      <p className="mt-4 rounded-2xl border border-[#1f2a3f]/10 bg-white/72 px-3 py-3 text-[14px] leading-[1.55] text-[#3a4660] dark:border-[#6b84af]/32 dark:bg-[rgba(30,45,70,0.72)] dark:text-[#cfe0fd]">
        {summary}
      </p>

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onNext}
          className="m-pressable inline-flex h-11 items-center justify-center rounded-full bg-[linear-gradient(180deg,#2997ff_0%,#0071e3_100%)] px-6 text-[15px] font-semibold text-white shadow-[0_12px_28px_rgba(0,113,227,0.3)] active:opacity-95"
        >
          看为什么
        </button>
        <Link
          href={`/m/compare?category=${encodeURIComponent(category)}`}
          className="m-pressable inline-flex h-11 items-center justify-center rounded-full border border-[#202737]/18 bg-white/74 px-5 text-[14px] font-medium text-[#2b3954] active:bg-black/[0.03] dark:border-[#6e85ad]/38 dark:bg-[rgba(31,47,72,0.75)] dark:text-[#d5e6ff]"
        >
          再做一次对比
        </Link>
      </div>
    </div>
  );
}

function ReasonStep({
  cards,
  onOpenCard,
  onPrev,
  onNext,
}: {
  cards: InsightCard[];
  onOpenCard: (card: InsightCard) => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div>
      <p className="text-[12px] font-semibold tracking-[0.04em] text-[#3b62ad] dark:text-[#8cb8ff]">一步一屏 · 每次只看一条重点</p>
      <h2 className="mt-2 text-[30px] leading-[1.16] font-semibold tracking-[-0.03em] text-[#111928] dark:text-[#edf3ff]">为什么是这个结论</h2>
      <p className="mt-2 text-[14px] leading-[1.55] text-[#4f5c76] dark:text-[#b1cbed]">主屏只保留一句摘要，点击“展开看全”再逐条查看。</p>

      <div className="mt-4 space-y-3">
        {cards.map((card) => (
          <section
            key={card.key}
            className="rounded-[20px] border border-[#1f2a3f]/10 bg-white/82 px-3.5 py-3 shadow-[0_8px_22px_rgba(21,38,70,0.06)] dark:border-[#6682ad]/34 dark:bg-[rgba(29,43,67,0.8)]"
          >
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-[15px] font-semibold text-[#152137] dark:text-[#e4eeff]">{card.title}</h3>
              <button
                type="button"
                onClick={() => {
                  onOpenCard(card);
                }}
                className="m-pressable inline-flex h-8 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(180deg,#2997ff_0%,#0071e3_100%)] px-3 text-[12px] font-semibold text-white shadow-[0_10px_20px_rgba(0,113,227,0.24)] active:opacity-95"
              >
                展开看全
              </button>
            </div>
            <p className="mt-2 text-[14px] leading-[1.5] text-[#3c4964] dark:text-[#ccdefa]">{card.summary}</p>
          </section>
        ))}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onPrev}
          className="m-pressable inline-flex h-10 items-center justify-center rounded-full border border-[#1f2a3f]/14 bg-white/78 text-[14px] font-medium text-[#2d3a55] active:bg-black/[0.03] dark:border-[#6d86b1]/34 dark:bg-[rgba(30,45,70,0.78)] dark:text-[#cfe1ff]"
        >
          返回结论
        </button>
        <button
          type="button"
          onClick={onNext}
          className="m-pressable inline-flex h-10 items-center justify-center rounded-full bg-[linear-gradient(180deg,#2997ff_0%,#0071e3_100%)] text-[14px] font-semibold text-white shadow-[0_10px_22px_rgba(0,113,227,0.28)] active:opacity-95"
        >
          看怎么做
        </button>
      </div>
    </div>
  );
}

function ActionStep({
  actions,
  onPrev,
  onOpenReport,
  productLink,
  wikiLink,
}: {
  actions: string[];
  onPrev: () => void;
  onOpenReport: () => void;
  productLink: string;
  wikiLink: string;
}) {
  return (
    <div>
      <p className="text-[12px] font-semibold tracking-[0.04em] text-[#3b62ad] dark:text-[#8cb8ff]">一步一屏 · 给你可执行动作</p>
      <h2 className="mt-2 text-[30px] leading-[1.16] font-semibold tracking-[-0.03em] text-[#111928] dark:text-[#edf3ff]">你现在可以这样做</h2>

      <ul className="mt-4 space-y-2">
        {actions.map((line, idx) => (
          <li
            key={`${line}-${idx}`}
            className="rounded-2xl border border-[#1f2a3f]/10 bg-white/82 px-3 py-2.5 text-[14px] leading-[1.55] text-[#2f3b56] dark:border-[#6882ae]/34 dark:bg-[rgba(30,45,70,0.78)] dark:text-[#d4e5ff]"
          >
            {line}
          </li>
        ))}
      </ul>

      <div className="mt-5 flex flex-wrap gap-2">
        <Link
          href={productLink}
          className="m-pressable inline-flex h-11 items-center justify-center rounded-full bg-[linear-gradient(180deg,#2997ff_0%,#0071e3_100%)] px-6 text-[15px] font-semibold text-white shadow-[0_12px_28px_rgba(0,113,227,0.3)] active:opacity-95"
        >
          查看推荐产品
        </Link>
        <Link
          href={wikiLink}
          className="m-pressable inline-flex h-11 items-center justify-center rounded-full border border-[#202737]/18 bg-white/74 px-5 text-[14px] font-medium text-[#2b3954] active:bg-black/[0.03] dark:border-[#6e85ad]/38 dark:bg-[rgba(31,47,72,0.75)] dark:text-[#d5e6ff]"
        >
          查看成分百科
        </Link>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onPrev}
          className="m-pressable inline-flex h-10 items-center justify-center rounded-full border border-[#1f2a3f]/14 bg-white/78 text-[14px] font-medium text-[#2d3a55] active:bg-black/[0.03] dark:border-[#6d86b1]/34 dark:bg-[rgba(30,45,70,0.78)] dark:text-[#cfe1ff]"
        >
          返回原因
        </button>
        <button
          type="button"
          onClick={onOpenReport}
          className="m-pressable inline-flex h-10 items-center justify-center rounded-full bg-[linear-gradient(180deg,#2997ff_0%,#0071e3_100%)] text-[14px] font-semibold text-white shadow-[0_10px_22px_rgba(0,113,227,0.28)] active:opacity-95"
        >
          展开看全
        </button>
      </div>
    </div>
  );
}

function getSectionItems(
  sections: MobileCompareResultSection[],
  key: MobileCompareResultSection["key"],
): string[] {
  const target = sections.find((section) => section.key === key);
  if (!target) return [];
  return takeUnique(target.items || []);
}

function flattenSectionItems(sections: MobileCompareResultSection[]): string[] {
  const out: string[] = [];
  for (const section of sections) {
    const title = sectionTitle(section.key, section.title);
    for (const line of section.items || []) {
      out.push(`${title}：${sanitizeText(line, 78)}`);
    }
  }
  return takeUnique(out);
}

function decisionLabel(value: "keep" | "switch" | "hybrid"): string {
  if (value === "keep") return "继续用";
  if (value === "switch") return "建议换";
  return "分场景";
}

function pairDecisionLabel(value: "keep" | "switch" | "hybrid"): string {
  if (value === "keep") return "偏向当前";
  if (value === "switch") return "偏向推荐";
  return "场景分配";
}

function decisionTone(value: "keep" | "switch" | "hybrid"): string {
  if (value === "keep") return "border-[#b7d4ff] bg-[#ebf4ff] text-[#2e61be] dark:border-[#6b9eeb]/44 dark:bg-[#253f67]/66 dark:text-[#bddaff]";
  if (value === "switch") return "border-[#c8dcff] bg-[#f1f7ff] text-[#3669c4] dark:border-[#78aef6]/44 dark:bg-[#284875]/68 dark:text-[#c8e2ff]";
  return "border-[#ffd79e] bg-[#fff6e8] text-[#96631a] dark:border-[#f0c174]/42 dark:bg-[#5d4822]/55 dark:text-[#ffdca8]";
}

function sectionTitle(key: string, fallback: string): string {
  if (key === "keep_benefits") return "你能得到什么";
  if (key === "keep_watchouts") return "需要留意什么";
  if (key === "ingredient_order_diff") return "成分排位差异";
  if (key === "profile_fit_advice") return "结合你的情况";
  return fallback;
}

function productDocTitle(
  doc: { product?: { brand?: string | null; name?: string | null } } | null | undefined,
  fallback: string,
): string {
  const brand = String(doc?.product?.brand || "").trim();
  const name = String(doc?.product?.name || "").trim();
  const combined = [brand, name].filter(Boolean).join(" ").trim();
  return combined || fallback;
}

function takeUnique(lines: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of lines) {
    const line = sanitizeText(raw, 120);
    if (!line || seen.has(line)) continue;
    seen.add(line);
    out.push(line);
  }
  return out;
}

function summarizeLine(value: string, max = 46): string {
  const text = sanitizeText(value, 120);
  if (!text) return "";
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

function sanitizeText(value: string, max: number): string {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}
