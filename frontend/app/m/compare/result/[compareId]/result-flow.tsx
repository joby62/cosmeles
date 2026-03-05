"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { MobileCompareResult, MobileCompareResultSection } from "@/lib/api";

type InsightSource = "feel" | "rhythm" | "care" | "consensus" | "ingredient" | "fallback";

type ImmersiveCard = {
  key: string;
  source: InsightSource;
  title: string;
  hero: string;
  preview: string[];
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

  const currentName = productDocTitle(result.current_product, focusPair?.left_title || "你现在在用的方案");
  const recommendedName = productDocTitle(result.recommended_product, focusPair?.right_title || "推荐方案");

  const primaryName = finalDecision === "switch" ? recommendedName : currentName;
  const secondaryName = finalDecision === "switch" ? currentName : recommendedName;
  const heroDecision = heroDecisionLine(finalDecision, primaryName, secondaryName);
  const stanceLine = stanceLineByDecision(finalDecision);

  const reasonSections = focusPair?.sections?.length ? focusPair.sections : result.sections;
  const benefits = getSectionItems(reasonSections, "keep_benefits");
  const watchouts = getSectionItems(reasonSections, "keep_watchouts");
  const profileAdvice = getSectionItems(reasonSections, "profile_fit_advice");
  const ingredientAdvice = getSectionItems(reasonSections, "ingredient_order_diff");
  const pairDigest = pairResults.map((pair) => `${pair.left_title} vs ${pair.right_title}：${pair.verdict.headline}`);

  const immersiveCards = useMemo<ImmersiveCard[]>(() => {
    const rawCards: Array<{ key: string; source: InsightSource; title: string; items: string[]; fallback: string }> = [
      {
        key: "feel",
        source: "feel",
        title: "这套搭配带来的感受",
        items: benefits,
        fallback: "头皮状态更稳，洗完更轻松。",
      },
      {
        key: "rhythm",
        source: "rhythm",
        title: "更贴合你的护理节奏",
        items: profileAdvice,
        fallback: "先按当前节奏执行，再根据变化微调。",
      },
      {
        key: "care",
        source: "care",
        title: "使用时可以留意的点",
        items: watchouts,
        fallback: "留意频次和头皮反馈，避免过度清洁。",
      },
      {
        key: "consensus",
        source: "consensus",
        title: "多组对比的共识",
        items: pairDigest,
        fallback: "多组结果基本一致，建议已收敛。",
      },
      {
        key: "ingredient",
        source: "ingredient",
        title: "配方差异里最关键的一点",
        items: ingredientAdvice,
        fallback: "差异主要体现在配方排序与侧重点。",
      },
    ];

    const selected = rawCards
      .filter((card) => card.items.length > 0)
      .slice(0, 3)
      .map((card) => {
        const items = takeUnique(card.items);
        const hero = summarizeLine(items[0] || card.fallback, 34);
        const preview = takePreview(items);
        return {
          key: card.key,
          source: card.source,
          title: card.title,
          hero,
          preview,
          items,
        };
      });

    if (selected.length > 0) return selected;

    return [
      {
        key: "fallback",
        source: "fallback",
        title: "本次结论摘要",
        hero: "已经完成对比，先按这次建议执行。",
        preview: ["后续根据头皮状态变化再做微调。"],
        items: ["已经完成对比，先按这次建议执行。", "后续根据头皮状态变化再做微调。"],
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
      add("先按本次建议执行 7 天，再观察头皮和发丝反馈。");
      add("如出现不适，优先降低使用频次并暂停叠加强清洁产品。");
      add("想看更细节时，点每张建议卡的“全部内容”。");
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

  return (
    <>
      <section className="m-compare-result-page space-y-8 pb-12">
        <article className="rounded-[30px] border border-[#bfd3f7] bg-[linear-gradient(180deg,#f5f9ff_0%,#edf5ff_56%,#ffffff_100%)] px-6 py-7 shadow-[0_20px_48px_rgba(35,77,152,0.12)] dark:border-[#4d6ea6]/56 dark:bg-[linear-gradient(180deg,#11213a_0%,#101f36_56%,#0d192b_100%)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.52)]">
          <p className="text-[12px] font-semibold tracking-[0.04em] text-[#3e62aa] dark:text-[#93bcff]">最终建议</p>
          <h1 className="mt-3 text-[34px] leading-[1.14] font-semibold tracking-[-0.03em] text-[#101928] dark:text-[#edf3ff]">{heroDecision}</h1>
          <p className="mt-3 text-[15px] leading-[1.65] text-[#44516b] dark:text-[#c4d8f7]">{stanceLine}</p>

          <div className="mt-4 flex flex-wrap gap-2">
            <span className={`inline-flex h-8 items-center rounded-full border px-3 text-[12px] font-semibold ${decisionTone(finalDecision)}`}>{decisionLabel(finalDecision)}</span>
            <span className="inline-flex h-8 items-center rounded-full border border-[#1f2a3f]/12 bg-white/85 px-3 text-[12px] text-[#3f4a61] dark:border-[#7b94c0]/38 dark:bg-[rgba(39,55,84,0.72)] dark:text-[#d5e5ff]">
              置信度 {finalConfidence}%
            </span>
          </div>

          <section className="mt-5 rounded-[24px] border-2 border-[#79b1ff] bg-[linear-gradient(180deg,#e9f3ff_0%,#dfeeff_100%)] px-4 py-4 shadow-[0_10px_26px_rgba(0,113,227,0.16)] dark:border-[#5f94df]/66 dark:bg-[linear-gradient(180deg,#23426d_0%,#1c3659_100%)]">
            <p className="text-[12px] font-semibold tracking-[0.02em] text-[#3a67b2] dark:text-[#b8d6ff]">本次主推</p>
            <p className="mt-2 text-[24px] leading-[1.34] font-semibold tracking-[-0.02em] text-[#123a75] dark:text-[#e3efff]">{primaryName}</p>
          </section>

          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <section className="rounded-2xl border border-[#1f2a3f]/10 bg-white/78 px-4 py-3.5 dark:border-[#6782ac]/34 dark:bg-[rgba(31,46,72,0.74)]">
              <p className="text-[11px] font-medium text-[#59657f] dark:text-[#acc6ef]">你现在在用</p>
              <p className="mt-1 text-[14px] leading-[1.56] font-medium text-[#1c273e] dark:text-[#e6efff]">{currentName}</p>
            </section>
            <section className="rounded-2xl border border-[#a9c9f8]/68 bg-[#f2f7ff] px-4 py-3.5 dark:border-[#567ead]/60 dark:bg-[rgba(35,55,83,0.74)]">
              <p className="text-[11px] font-medium text-[#607092] dark:text-[#b7d0f5]">另一款可选</p>
              <p className="mt-1 text-[14px] leading-[1.56] font-medium text-[#2a3c5d] dark:text-[#d6e6ff]">{secondaryName}</p>
            </section>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <a
              href="#reason-gallery"
              className="m-pressable inline-flex h-11 items-center justify-center rounded-full bg-[linear-gradient(180deg,#2997ff_0%,#0071e3_100%)] px-6 text-[15px] font-semibold text-white shadow-[0_12px_28px_rgba(0,113,227,0.3)] active:opacity-95"
            >
              看原因
            </a>
            <Link
              href={`/m/compare?category=${encodeURIComponent(result.category)}`}
              className="m-pressable inline-flex h-11 items-center justify-center rounded-full border border-[#202737]/18 bg-white/74 px-5 text-[14px] font-medium text-[#2b3954] active:bg-black/[0.03] dark:border-[#6e85ad]/38 dark:bg-[rgba(31,47,72,0.75)] dark:text-[#d5e6ff]"
            >
              再做一次对比
            </Link>
          </div>
        </article>

        <section id="reason-gallery" className="space-y-4">
          <header className="px-1">
            <h2 className="text-[24px] font-semibold tracking-[-0.02em] text-[#152038] dark:text-[#e6efff]">建议卡</h2>
            <p className="mt-1 text-[14px] leading-[1.62] text-[#596781] dark:text-[#aac4ec]">每张卡只讲一件事，读完就知道为什么这样推荐。</p>
          </header>

          <div className="space-y-4">
            {immersiveCards.map((card) => (
              <article
                key={card.key}
                className="min-h-[68dvh] rounded-[30px] border border-[#1f2a3f]/10 bg-white/90 px-5 py-6 shadow-[0_18px_42px_rgba(17,34,64,0.08)] dark:border-[#6581ad]/34 dark:bg-[rgba(29,43,67,0.86)]"
              >
                <div>
                  <p className="text-[14px] font-semibold text-[#3f5e91] dark:text-[#9dc2fb]">{card.title}</p>
                  <h3 className="mt-4 text-[32px] leading-[1.2] font-semibold tracking-[-0.03em] text-[#141f34] dark:text-[#edf4ff]">{card.hero}</h3>
                </div>

                <div className="mt-8 space-y-2">
                  {card.preview.map((line, idx) => (
                    <p key={`${card.key}-${idx}`} className="rounded-2xl border border-[#1f2a3f]/10 bg-[#f8fafd] px-3.5 py-3 text-[14px] leading-[1.6] text-[#34415b] dark:border-[#6c87b2]/34 dark:bg-[rgba(32,47,74,0.78)] dark:text-[#d1e3ff]">
                      • {line}
                    </p>
                  ))}
                </div>

                <div className="mt-6 flex items-center justify-between">
                  <span className="text-[13px] text-[#667590] dark:text-[#abc4eb]">共 {card.items.length} 条</span>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveSheet({ source: card.source, title: card.title, items: card.items });
                    }}
                    className="m-pressable inline-flex h-10 items-center justify-center rounded-full bg-[linear-gradient(180deg,#2997ff_0%,#0071e3_100%)] px-5 text-[14px] font-semibold text-white shadow-[0_12px_24px_rgba(0,113,227,0.28)] active:opacity-95"
                  >
                    全部内容
                  </button>
                </div>
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

function heroDecisionLine(decision: "keep" | "switch" | "hybrid", primary: string, secondary: string): string {
  if (decision === "keep") return `建议继续用：${primary}`;
  if (decision === "switch") return `建议换成：${primary}`;
  return `建议分场景搭配：${primary} + ${secondary}`;
}

function stanceLineByDecision(decision: "keep" | "switch" | "hybrid"): string {
  if (decision === "keep") {
    return "态度很明确：先把头皮状态稳住，再决定要不要增强清洁。";
  }
  if (decision === "switch") {
    return "态度很明确：可以切换到更贴合你现阶段状态的方案，减少试错。";
  }
  return "态度很明确：按场景分工使用，两款各发挥优势会更稳。";
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

function getSectionItems(sections: MobileCompareResultSection[], key: MobileCompareResultSection["key"]): string[] {
  const target = sections.find((section) => section.key === key);
  if (!target) return [];
  return takeUnique(target.items || []);
}

function takePreview(items: string[]): string[] {
  const rest = items.slice(1, 3).map((line) => summarizeLine(line, 54));
  if (rest.length > 0) return rest;
  return ["点“全部内容”查看完整细节。"];
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
        label: "重点留意",
        className: "border-[#ffc0b8] bg-[#fff1ef] text-[#b35144] dark:border-[#c98379]/45 dark:bg-[#5a3230]/64 dark:text-[#ffd2cb]",
      };
    }
    return {
      label: "使用提示",
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
