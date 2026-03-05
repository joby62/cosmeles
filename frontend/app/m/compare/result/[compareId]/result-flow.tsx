"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { MobileCompareResult, MobileCompareResultSection } from "@/lib/api";

type InsightSource = "feel" | "rhythm" | "care" | "consensus" | "ingredient" | "fallback";

type InsightCard = {
  key: string;
  source: InsightSource;
  title: string;
  summary: string;
  items: string[];
};

type SheetState = {
  source: InsightSource;
  title: string;
  items: string[];
};

export default function MobileCompareResultFlow({ result }: { result: MobileCompareResult }) {
  const [activeSheet, setActiveSheet] = useState<SheetState | null>(null);

  const pairResults = useMemo(() => result.pair_results || [], [result.pair_results]);
  const overall = result.overall || null;
  const focusPair = pairResults[0] || null;

  const finalDecision = overall?.decision || result.verdict.decision;
  const finalConfidence = Math.round((overall?.confidence ?? result.verdict.confidence) * 100);
  const finalHeadline = sanitizeText(overall?.headline || result.verdict.headline || "你的本次对比结论已生成。", 42);
  const leftAnchor = focusPair?.left_title || productDocTitle(result.current_product, "你现在在用");
  const rightAnchor = focusPair?.right_title || productDocTitle(result.recommended_product, "这次更推荐");
  const reasonSections = focusPair?.sections?.length ? focusPair.sections : result.sections;

  const benefits = getSectionItems(reasonSections, "keep_benefits");
  const watchouts = getSectionItems(reasonSections, "keep_watchouts");
  const profileAdvice = getSectionItems(reasonSections, "profile_fit_advice");
  const ingredientAdvice = getSectionItems(reasonSections, "ingredient_order_diff");
  const pairDigest = pairResults.map((pair) => `${pair.left_title} vs ${pair.right_title}：${pair.verdict.headline}`);

  const insightCards = useMemo<InsightCard[]>(() => {
    const candidates: InsightCard[] = [
      {
        key: "feel",
        source: "feel",
        title: "这套搭配带来的感受",
        summary: summarizeLine(benefits[0] || "头皮状态会更稳，日常洗护更容易保持舒适感。", 50),
        items: benefits,
      },
      {
        key: "rhythm",
        source: "rhythm",
        title: "更贴合你的护理节奏",
        summary: summarizeLine(profileAdvice[0] || "先按当前结论执行，再根据 7 天状态做细调。", 50),
        items: profileAdvice,
      },
      {
        key: "care",
        source: "care",
        title: "使用时可以留意的点",
        summary: summarizeLine(watchouts[0] || "留意清洁频次与头皮反馈，避免用力过猛。", 50),
        items: watchouts,
      },
      {
        key: "consensus",
        source: "consensus",
        title: "多组对比的共识",
        summary: summarizeLine(pairDigest[0] || "多组对比后，结论已收敛到当前建议。", 50),
        items: pairDigest,
      },
      {
        key: "ingredient",
        source: "ingredient",
        title: "成分差异重点",
        summary: summarizeLine(ingredientAdvice[0] || "关键差异集中在成分排位和功效侧重。", 50),
        items: ingredientAdvice,
      },
    ];

    const picked = candidates.filter((card) => card.items.length > 0).slice(0, 4);
    if (picked.length > 0) return picked;

    return [
      {
        key: "fallback",
        source: "fallback",
        title: "本次结论摘要",
        summary: "已经完成对比，先按结论执行，再按需看全部内容。",
        items: ["已经完成对比，先按结论执行，再按需看全部内容。"],
      },
    ];
  }, [benefits, ingredientAdvice, pairDigest, profileAdvice, watchouts]);

  const actionItems = useMemo<string[]>(() => {
    const out: string[] = [];
    const add = (value: string) => {
      const text = sanitizeText(value, 64);
      if (!text || out.includes(text)) return;
      out.push(text);
    };

    profileAdvice.forEach(add);
    benefits.slice(0, 1).forEach(add);
    watchouts.slice(0, 1).forEach(add);

    if (out.length === 0) {
      add("先按本次结论执行 7 天，再根据头皮和发丝状态做下一轮对比。");
      add("如果出现不适，先降低频次，再回看全部内容里的注意点。");
      add("需要更细分场景时，再看多组对比的完整明细。");
    }

    return out.slice(0, 3);
  }, [benefits, profileAdvice, watchouts]);

  useEffect(() => {
    if (!activeSheet) return;
    const prevOverflow = document.body.style.overflow;
    const prevTouchAction = document.body.style.touchAction;
    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none";
    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.touchAction = prevTouchAction;
    };
  }, [activeSheet]);

  useEffect(() => {
    if (!activeSheet) return;
    const onEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setActiveSheet(null);
      }
    };
    window.addEventListener("keydown", onEsc);
    return () => {
      window.removeEventListener("keydown", onEsc);
    };
  }, [activeSheet]);

  const openSheet = (card: InsightCard) => {
    const cleaned = takeUnique(card.items);
    if (cleaned.length === 0) return;
    setActiveSheet({ source: card.source, title: card.title, items: cleaned });
  };

  return (
    <>
      <section className="m-compare-result-page space-y-6 pb-12">
        <article className="rounded-[30px] border border-[#bfd3f7] bg-[linear-gradient(180deg,#f5f9ff_0%,#edf5ff_56%,#ffffff_100%)] px-6 py-7 shadow-[0_18px_42px_rgba(35,77,152,0.12)] dark:border-[#4d6ea6]/56 dark:bg-[linear-gradient(180deg,#12213a_0%,#101f36_56%,#0d192b_100%)] dark:shadow-[0_20px_48px_rgba(0,0,0,0.5)]">
          <p className="text-[12px] font-semibold tracking-[0.04em] text-[#3e62aa] dark:text-[#93bcff]">你的浴室答案</p>
          <h1 className="mt-3 text-[34px] leading-[1.16] font-semibold tracking-[-0.03em] text-[#11192b] dark:text-[#edf3ff]">{finalHeadline}</h1>

          <div className="mt-5 flex flex-wrap gap-2">
            <span className={`inline-flex h-8 items-center rounded-full border px-3 text-[12px] font-semibold ${decisionTone(finalDecision)}`}>
              {decisionLabel(finalDecision)}
            </span>
            <span className="inline-flex h-8 items-center rounded-full border border-[#1f2a3f]/12 bg-white/85 px-3 text-[12px] text-[#3f4a61] dark:border-[#7b94c0]/38 dark:bg-[rgba(39,55,84,0.72)] dark:text-[#d5e5ff]">
              置信度 {finalConfidence}%
            </span>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <section className="rounded-2xl border border-[#1f2a3f]/10 bg-white/78 px-4 py-3.5 dark:border-[#6782ac]/34 dark:bg-[rgba(31,46,72,0.74)]">
              <p className="text-[11px] font-medium text-[#59657f] dark:text-[#acc6ef]">你现在在用</p>
              <p className="mt-1 text-[14px] leading-[1.5] font-medium text-[#1c273e] dark:text-[#e6efff]">{sanitizeText(leftAnchor, 56)}</p>
            </section>
            <section className="rounded-2xl border border-[#7fb2ff]/44 bg-[#edf5ff] px-4 py-3.5 dark:border-[#4e85d4]/50 dark:bg-[rgba(33,58,94,0.82)]">
              <p className="text-[11px] font-medium text-[#3a67b2] dark:text-[#b9d6ff]">这次更推荐</p>
              <p className="mt-1 text-[14px] leading-[1.5] font-medium text-[#1d3f7d] dark:text-[#d7e9ff]">{sanitizeText(rightAnchor, 56)}</p>
            </section>
          </div>

          <p className="mt-5 rounded-2xl border border-[#1f2a3f]/10 bg-white/72 px-4 py-3.5 text-[14px] leading-[1.62] text-[#3a4660] dark:border-[#6b84af]/32 dark:bg-[rgba(30,45,70,0.72)] dark:text-[#cfe0fd]">
            {summarizeLine(focusPair?.verdict.headline || overall?.summary_items?.[0] || "先按这次结论执行，再看全部内容。", 78)}
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            <Link
              href={`/m/compare?category=${encodeURIComponent(result.category)}`}
              className="m-pressable inline-flex h-11 items-center justify-center rounded-full border border-[#202737]/18 bg-white/74 px-5 text-[14px] font-medium text-[#2b3954] active:bg-black/[0.03] dark:border-[#6e85ad]/38 dark:bg-[rgba(31,47,72,0.75)] dark:text-[#d5e6ff]"
            >
              再做一次对比
            </Link>
          </div>
        </article>

        <section className="space-y-4">
          <header className="px-1">
            <h2 className="text-[23px] font-semibold tracking-[-0.02em] text-[#152038] dark:text-[#e6efff]">沙龙建议卡</h2>
            <p className="mt-1 text-[14px] leading-[1.6] text-[#596781] dark:text-[#aac4ec]">每张卡先给一句核心建议，点“全部内容”再展开细节。</p>
          </header>

          <div className="space-y-4">
            {insightCards.map((card) => (
              <article
                key={card.key}
                className="rounded-[22px] border border-[#1f2a3f]/10 bg-white/86 px-4 py-4 shadow-[0_10px_24px_rgba(17,34,64,0.06)] dark:border-[#6581ad]/34 dark:bg-[rgba(29,43,67,0.82)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-[16px] font-semibold text-[#162138] dark:text-[#e4eeff]">{card.title}</h3>
                  <button
                    type="button"
                    onClick={() => {
                      openSheet(card);
                    }}
                    className="m-pressable inline-flex h-8 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(180deg,#2997ff_0%,#0071e3_100%)] px-3 text-[12px] font-semibold text-white shadow-[0_10px_20px_rgba(0,113,227,0.24)] active:opacity-95"
                  >
                    全部内容
                  </button>
                </div>
                <p className="mt-2 text-[14px] leading-[1.62] text-[#3d4a64] dark:text-[#cddffc]">{card.summary}</p>
                <p className="mt-2 text-[12px] text-[#6a7590] dark:text-[#a8c3eb]">共 {card.items.length} 条</p>
              </article>
            ))}
          </div>
        </section>

        <article className="rounded-[24px] border border-[#1f2a3f]/10 bg-white/84 px-4 py-5 shadow-[0_10px_24px_rgba(17,34,64,0.05)] dark:border-[#6480ab]/34 dark:bg-[rgba(27,41,65,0.82)]">
          <h3 className="text-[20px] font-semibold tracking-[-0.02em] text-[#152038] dark:text-[#e6efff]">接下来这样做</h3>
          <ul className="mt-3 space-y-2.5">
            {actionItems.map((line, idx) => (
              <li
                key={`${line}-${idx}`}
                className="rounded-2xl border border-[#1f2a3f]/10 bg-[#f8fafd] px-3.5 py-3 text-[14px] leading-[1.62] text-[#2f3b57] dark:border-[#6983af]/34 dark:bg-[rgba(30,45,70,0.78)] dark:text-[#d4e5ff]"
              >
                {line}
              </li>
            ))}
          </ul>

          <div className="mt-5 flex flex-wrap gap-2">
            <Link
              href={result.recommendation.links.product}
              className="m-pressable inline-flex h-11 items-center justify-center rounded-full bg-[linear-gradient(180deg,#2997ff_0%,#0071e3_100%)] px-6 text-[15px] font-semibold text-white shadow-[0_12px_28px_rgba(0,113,227,0.3)] active:opacity-95"
            >
              查看推荐产品
            </Link>
            <Link
              href={result.recommendation.links.wiki}
              className="m-pressable inline-flex h-11 items-center justify-center rounded-full border border-[#202737]/18 bg-white/74 px-5 text-[14px] font-medium text-[#2b3954] active:bg-black/[0.03] dark:border-[#6e85ad]/38 dark:bg-[rgba(31,47,72,0.75)] dark:text-[#d5e6ff]"
            >
              查看成分百科
            </Link>
          </div>
        </article>

        {result.transparency.warnings.length > 0 ? (
          <div className="rounded-2xl border border-[#ffd28f]/55 bg-[#fff7e9] px-4 py-3 text-[13px] leading-[1.6] text-[#8b5a00] dark:border-[#e6b56b]/45 dark:bg-[rgba(86,63,23,0.48)] dark:text-[#ffdca5]">
            {result.transparency.warnings.join(" ")}
          </div>
        ) : null}
      </section>

      {activeSheet ? (
        <div className="fixed inset-0 z-[84]" role="dialog" aria-modal="true" aria-label={`${activeSheet.title}全部内容`}>
          <button
            type="button"
            className="absolute inset-0 bg-black/46 backdrop-blur-sm"
            onClick={() => {
              setActiveSheet(null);
            }}
            aria-label="关闭弹层"
          />

          <div className="m-sheet-enter absolute inset-x-0 bottom-0 max-h-[84dvh] overflow-hidden rounded-t-[30px] border border-white/45 bg-white/95 shadow-[0_-24px_68px_rgba(0,0,0,0.34)] dark:border-[#7ca4df]/24 dark:bg-[rgba(16,26,42,0.96)] dark:shadow-[0_-24px_72px_rgba(0,0,0,0.56)]">
            <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-black/18 dark:bg-white/24" />
            <div className="flex items-center justify-between border-b border-black/8 px-5 py-3 dark:border-white/10">
              <h3 className="text-[17px] font-semibold text-[#17233b] dark:text-[#e7f0ff]">{activeSheet.title} · 全部内容</h3>
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

            <div className="max-h-[calc(84dvh-88px)] overflow-y-auto px-4 pb-6 pt-3">
              <p className="text-center text-[12px] text-[#5a6782] dark:text-[#abc5ed]">共 {activeSheet.items.length} 条</p>

              <ul className="mt-3 space-y-2.5">
                {activeSheet.items.map((line, index) => {
                  const tagMeta = itemTagMeta(activeSheet.source, line);
                  return (
                    <li
                      key={`${line}-${index}`}
                      className="rounded-2xl border border-[#1f2a3f]/10 bg-[#f8fafd] px-3.5 py-3.5 dark:border-[#6f88b3]/36 dark:bg-[rgba(30,45,70,0.76)]"
                    >
                      <div className="mb-2 flex items-center gap-2">
                        <span className={`inline-flex h-6 items-center rounded-full border px-2.5 text-[11px] font-semibold ${tagMeta.className}`}>{tagMeta.label}</span>
                      </div>
                      <p className="text-[15px] leading-[1.62] text-[#1f2b43] dark:text-[#dce9ff]">• {line}</p>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function decisionLabel(value: "keep" | "switch" | "hybrid"): string {
  if (value === "keep") return "先继续用";
  if (value === "switch") return "可试试新方案";
  return "分场景搭配";
}

function decisionTone(value: "keep" | "switch" | "hybrid"): string {
  if (value === "keep") return "border-[#b7d4ff] bg-[#ebf4ff] text-[#2e61be] dark:border-[#6b9eeb]/44 dark:bg-[#253f67]/66 dark:text-[#bddaff]";
  if (value === "switch") return "border-[#c8dcff] bg-[#f1f7ff] text-[#3669c4] dark:border-[#78aef6]/44 dark:bg-[#284875]/68 dark:text-[#c8e2ff]";
  return "border-[#ffd79e] bg-[#fff6e8] text-[#96631a] dark:border-[#f0c174]/42 dark:bg-[#5d4822]/55 dark:text-[#ffdca8]";
}

function getSectionItems(
  sections: MobileCompareResultSection[],
  key: MobileCompareResultSection["key"],
): string[] {
  const target = sections.find((section) => section.key === key);
  if (!target) return [];
  return takeUnique(target.items || []);
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

function itemTagMeta(source: InsightSource, line: string): { label: string; className: string } {
  if (source === "feel") {
    return {
      label: "体验亮点",
      className: "border-[#9ec7ff] bg-[#eaf3ff] text-[#2f61ba] dark:border-[#73a6ea]/44 dark:bg-[#294367]/66 dark:text-[#c7e0ff]",
    };
  }

  if (source === "rhythm") {
    return {
      label: "护理建议",
      className: "border-[#9ec7ff] bg-[#eaf3ff] text-[#2f61ba] dark:border-[#73a6ea]/44 dark:bg-[#294367]/66 dark:text-[#c7e0ff]",
    };
  }

  if (source === "care") {
    const text = line.toLowerCase();
    if (/高风险|严重|避免|禁用|炎症|破损|刺激|过敏|加重/.test(text)) {
      return {
        label: "高关注",
        className: "border-[#ffc0b8] bg-[#fff1ef] text-[#b35144] dark:border-[#c98379]/45 dark:bg-[#5a3230]/64 dark:text-[#ffd2cb]",
      };
    }
    if (/中风险|谨慎|注意|留意|可能|不适|干燥/.test(text)) {
      return {
        label: "中关注",
        className: "border-[#ffd79f] bg-[#fff6e8] text-[#946218] dark:border-[#c49b58]/45 dark:bg-[#584723]/66 dark:text-[#ffdfab]",
      };
    }
    return {
      label: "日常关注",
      className: "border-[#ffd79f] bg-[#fff6e8] text-[#946218] dark:border-[#c49b58]/45 dark:bg-[#584723]/66 dark:text-[#ffdfab]",
    };
  }

  if (source === "consensus") {
    return {
      label: "对比共识",
      className: "border-[#cbd6e8] bg-[#f3f6fb] text-[#4a5a78] dark:border-[#7e93b7]/44 dark:bg-[#2c3d5d]/65 dark:text-[#d2e1fb]",
    };
  }

  if (source === "ingredient") {
    return {
      label: "配方看点",
      className: "border-[#cbd6e8] bg-[#f3f6fb] text-[#4a5a78] dark:border-[#7e93b7]/44 dark:bg-[#2c3d5d]/65 dark:text-[#d2e1fb]",
    };
  }

  return {
    label: "核心信息",
    className: "border-[#cbd6e8] bg-[#f3f6fb] text-[#4a5a78] dark:border-[#7e93b7]/44 dark:bg-[#2c3d5d]/65 dark:text-[#d2e1fb]",
  };
}

function takeUnique(lines: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of lines) {
    const line = sanitizeText(raw, 180);
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
