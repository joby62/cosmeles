"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { MobileCompareResult, MobileCompareResultSection } from "@/lib/api";
import { trackMobileEvent, trackMobileEventWithBeacon } from "@/lib/mobileAnalytics";
import { describeMobileRouteFocus } from "@/lib/mobile/routeCopy";

type InsightSource = "feel" | "rhythm" | "care" | "consensus" | "ingredient" | "fallback";

type ImmersiveCard = {
  key: string;
  source: InsightSource;
  title: string;
  hero: string;
  teaser: string[];
  items: string[];
  showAllCta: boolean;
};

type SheetState = {
  source: InsightSource;
  title: string;
  items: string[];
};

type ProductVisual = {
  shortName: string;
  fullName: string;
  imageSrc: string;
};

export default function MobileCompareResultFlow({ result }: { result: MobileCompareResult }) {
  const [activeSheet, setActiveSheet] = useState<SheetState | null>(null);
  const route = `/m/compare/result/${result.compare_id}`;

  const pairResults = useMemo(() => result.pair_results || [], [result.pair_results]);
  const overall = result.overall || null;
  const focusPair = pairResults[0] || null;
  const routeFocus = describeMobileRouteFocus(result.category, result.recommendation.route.key);
  const routeTitle = result.recommendation.route.title || "历史首推";

  const finalDecision = overall?.decision || result.verdict.decision;
  const finalConfidence = Math.round((overall?.confidence ?? result.verdict.confidence) * 100);

  const categoryImage = `/m/categories/${result.category}.png`;
  const currentProduct = result.current_product?.product;
  const recommendedProduct = result.recommendation.recommended_product;

  const currentFullName = formatProductName(currentProduct?.brand, currentProduct?.name, focusPair?.left_title || "当前方案");
  const recommendedFullName = formatProductName(
    recommendedProduct?.brand,
    recommendedProduct?.name,
    focusPair?.right_title || "推荐方案",
  );

  const currentVisual: ProductVisual = {
    shortName: shortProductName(currentProduct?.brand, currentProduct?.name, "当前方案"),
    fullName: currentFullName,
    imageSrc: categoryImage,
  };

  const recommendedVisual: ProductVisual = {
    shortName: shortProductName(recommendedProduct?.brand, recommendedProduct?.name, "推荐方案"),
    fullName: recommendedFullName,
    imageSrc: normalizeImageSrc(recommendedProduct?.image_url, categoryImage),
  };

  const heroTitle = heroDecisionTitle(finalDecision, currentVisual.shortName, recommendedVisual.shortName);
  const attitudeText = heroDecisionAttitude(finalDecision);
  const primaryVisual = finalDecision === "switch" ? recommendedVisual : currentVisual;
  const secondaryVisual = finalDecision === "switch" ? currentVisual : recommendedVisual;

  const reasonSections = focusPair?.sections?.length ? focusPair.sections : result.sections;
  const benefits = getSectionItems(reasonSections, "keep_benefits");
  const watchouts = getSectionItems(reasonSections, "keep_watchouts");
  const profileAdvice = getSectionItems(reasonSections, "profile_fit_advice");
  const ingredientAdvice = getSectionItems(reasonSections, "ingredient_order_diff");
  const pairDigest = pairResults.map((pair) => `${pair.left_title} vs ${pair.right_title}：${pair.verdict.headline}`);

  const immersiveCards = useMemo<ImmersiveCard[]>(() => {
    const sources: Array<{ key: string; source: InsightSource; title: string; items: string[]; fallback: string }> = [
      {
        key: "feel",
        source: "feel",
        title: "这套搭配带来的感受",
        items: benefits,
        fallback: "头皮状态会更稳，日常清洁更轻松。",
      },
      {
        key: "rhythm",
        source: "rhythm",
        title: "更贴合你的护理节奏",
        items: profileAdvice,
        fallback: "先按当前节奏执行，再根据状态微调。",
      },
      {
        key: "care",
        source: "care",
        title: "使用时可以留意的点",
        items: watchouts,
        fallback: "注意头皮反馈和清洁频次，避免过度清洁。",
      },
      {
        key: "consensus",
        source: "consensus",
        title: "多组对比的共识",
        items: pairDigest,
        fallback: "多组结论一致，建议方向较稳定。",
      },
      {
        key: "ingredient",
        source: "ingredient",
        title: "配方差异里最关键的一点",
        items: ingredientAdvice,
        fallback: "差异主要体现在配方排序和侧重点。",
      },
    ];

    const cards = sources
      .filter((item) => item.items.length > 0)
      .slice(0, 3)
      .map((item) => {
        const allItems = takeUnique(item.items);
        const hero = summarizeLine(allItems[0] || item.fallback, 32);
        const showAllCta = allItems.length > 4;
        const teaser = (showAllCta ? allItems.slice(1, 3) : allItems.slice(1)).map((line) => summarizeLine(line, 58));
        return {
          key: item.key,
          source: item.source,
          title: item.title,
          hero,
          teaser,
          items: allItems,
          showAllCta,
        };
      });

    if (cards.length > 0) return cards;

    return [
      {
        key: "fallback",
        source: "fallback",
        title: "本次结论摘要",
        hero: "先按这次建议执行，减少试错。",
        teaser: ["如需更细节，再看成分百科与推荐产品。"],
        items: ["先按这次建议执行，减少试错。", "如需更细节，再看成分百科与推荐产品。"],
        showAllCta: false,
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
      add("出现不适时先降低频次，并暂停叠加强清洁产品。");
      add("需要更细信息时，再展开建议卡的全部内容。");
    }

    return out.slice(0, 3);
  }, [benefits, profileAdvice, watchouts]);

  const trackResultCta = (cta: string, extra?: Record<string, unknown>, useBeacon = false) => {
    const payload = {
      page: "compare_result",
      route,
      source: "m_compare_result",
      category: result.category,
      compare_id: result.compare_id,
      decision: finalDecision,
      confidence: finalConfidence / 100,
      cta,
      ...extra,
    };
    if (useBeacon) {
      trackMobileEventWithBeacon("compare_result_cta_click", payload);
      return;
    }
    void trackMobileEvent("compare_result_cta_click", payload);
  };

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
        <article className="rounded-[32px] border border-[#d9dde5] bg-[linear-gradient(180deg,#fbfcfe_0%,#f4f6fa_100%)] px-6 py-7 shadow-[0_16px_38px_rgba(17,24,39,0.07)] dark:border-[#4e586b] dark:bg-[linear-gradient(180deg,#151d2b_0%,#111926_100%)] dark:shadow-[0_18px_42px_rgba(0,0,0,0.5)]">
          <p className="text-[12px] font-semibold tracking-[0.04em] text-[#5f6b85] dark:text-[#aeb8cb]">最终建议</p>
          <h1 className="mt-2 text-[34px] leading-[1.14] font-semibold tracking-[-0.03em] text-[#111827] dark:text-[#f3f6ff]">{heroTitle}</h1>
          <p className="mt-3 text-[15px] leading-[1.65] text-[#4b556a] dark:text-[#c9d2e6]">{attitudeText}</p>

          <div className="mt-4 flex flex-wrap gap-2">
            <span className={`inline-flex h-8 items-center rounded-full border px-3 text-[12px] font-semibold ${decisionTone(finalDecision)}`}>
              {decisionLabel(finalDecision)}
            </span>
            <span className="inline-flex h-8 items-center rounded-full border border-[#d4d9e3] bg-white px-3 text-[12px] text-[#4b556a] dark:border-[#5f6b82] dark:bg-[#1f2a3e] dark:text-[#d2dcf0]">
              置信度 {finalConfidence}%
            </span>
          </div>

          <section className="mt-6 rounded-[28px] border border-[#cdd8ea] bg-white/88 px-4 py-4 dark:border-[#5f6d87] dark:bg-[#1d283b]">
            <p className="text-[12px] font-semibold text-[#5f6d87] dark:text-[#b3c0d8]">沿用的历史基线</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="inline-flex min-h-8 items-center rounded-full border border-[#cfe2ff] bg-[#f4f8ff] px-3 text-[12px] text-[#24509c] dark:border-[#6f86a8] dark:bg-[#243146] dark:text-[#d7e7ff]">
                {routeTitle}
              </span>
              <span className="inline-flex min-h-8 items-center rounded-full border border-[#d4d9e3] bg-white px-3 text-[12px] text-[#52617b] dark:border-[#5f6b82] dark:bg-[#1f2a3e] dark:text-[#d2dcf0]">
                历史主推：{recommendedVisual.shortName}
              </span>
            </div>
            <p className="mt-3 text-[14px] leading-[1.65] text-[#52617b] dark:text-[#c9d2e6]">{routeFocus}</p>
          </section>

          {finalDecision === "hybrid" ? (
            <section className="mt-6 rounded-[28px] border border-[#ccd2dd] bg-white/92 px-4 py-4 dark:border-[#5e6a81] dark:bg-[#1d283b]">
              <p className="text-[12px] font-semibold text-[#606e89] dark:text-[#b3c0d8]">本次主推</p>
              <h2 className="mt-2 text-[24px] leading-[1.35] font-semibold text-[#1a2437] dark:text-[#e8f0ff]">分场景搭配使用</h2>
              <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <MiniProductCard title="场景 A" visual={currentVisual} />
                <MiniProductCard title="场景 B" visual={recommendedVisual} />
              </div>
            </section>
          ) : (
            <section className="mt-6 rounded-[30px] border border-[#b9c9e6] bg-[linear-gradient(180deg,#ffffff_0%,#f6f8fc_100%)] px-4 py-5 shadow-[0_12px_30px_rgba(15,23,42,0.08)] dark:border-[#596983] dark:bg-[linear-gradient(180deg,#1f2b40_0%,#1a2435_100%)]">
              <p className="text-[12px] font-semibold text-[#5f6d87] dark:text-[#b1bfd7]">本次主推</p>
              <div className="mt-3 flex items-center gap-3">
                <ProductThumb src={primaryVisual.imageSrc} alt={primaryVisual.shortName} size={74} />
                <div className="min-w-0 flex-1">
                  <h2 className="text-[26px] leading-[1.25] font-semibold tracking-[-0.02em] text-[#152036] dark:text-[#edf4ff]">{primaryVisual.shortName}</h2>
                  <p className="mt-1 line-clamp-2 text-[13px] leading-[1.5] text-[#5a667f] dark:text-[#b9c8df]">{primaryVisual.fullName}</p>
                </div>
              </div>
            </section>
          )}

          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <MiniProductCard title="你现在在用" visual={currentVisual} />
            <MiniProductCard title="另一款可选" visual={secondaryVisual} />
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <a
              href="#reason-gallery"
              data-analytics-id="result:cta:reason-gallery"
              onClick={() => {
                trackResultCta("reason_gallery_anchor");
              }}
              className="m-pressable inline-flex h-11 items-center justify-center rounded-full bg-[linear-gradient(180deg,#2997ff_0%,#0071e3_100%)] px-6 text-[15px] font-semibold text-white shadow-[0_12px_28px_rgba(0,113,227,0.28)] active:opacity-95"
            >
              看原因
            </a>
            <Link
              href={`/m/compare?category=${encodeURIComponent(result.category)}`}
              data-analytics-id="result:cta:rerun-compare"
              onClick={() => {
                trackResultCta("rerun_compare", undefined, true);
              }}
              className="m-pressable inline-flex h-11 items-center justify-center rounded-full border border-[#d0d6e0] bg-white px-5 text-[14px] font-medium text-[#2f3b53] active:bg-black/[0.03] dark:border-[#5f6b82] dark:bg-[#1f2a3e] dark:text-[#d7e4ff]"
            >
              再做一次对比
            </Link>
          </div>
        </article>

        <section id="reason-gallery" className="space-y-4">
          <header className="px-1">
            <h2 className="text-[24px] font-semibold tracking-[-0.02em] text-[#18253b] dark:text-[#ecf2ff]">建议卡</h2>
            <p className="mt-1 text-[14px] leading-[1.62] text-[#5a6780] dark:text-[#aebfdb]">一张卡讲一件事，先读重点；条目超过 4 条再展开“全部内容”。</p>
          </header>

          <div className="space-y-5">
            {immersiveCards.map((card) => (
              <article
                key={card.key}
                className="min-h-[68dvh] rounded-[32px] border border-[#d7dce6] bg-[linear-gradient(180deg,#fbfcfe_0%,#f4f6fa_100%)] px-5 py-6 shadow-[0_16px_38px_rgba(17,24,39,0.07)] dark:border-[#59637a] dark:bg-[linear-gradient(180deg,#192336_0%,#151e2f_100%)]"
              >
                <p className="text-[14px] font-semibold text-[#5e6d87] dark:text-[#9db4d9]">{card.title}</p>
                <h3 className="mt-4 text-[38px] leading-[1.14] font-semibold tracking-[-0.03em] text-[#142036] dark:text-[#f0f5ff]">{card.hero}</h3>

                <div className="mt-8 space-y-3">
                  {card.teaser.map((line, idx) => (
                    <p
                      key={`${card.key}-${idx}`}
                      className="rounded-2xl border border-[#d7dce6] bg-white px-3.5 py-3 text-[14px] leading-[1.6] text-[#36435d] dark:border-[#63708a] dark:bg-[#1f2a3e] dark:text-[#d7e5ff]"
                    >
                      • {line}
                    </p>
                  ))}
                  {card.teaser.length === 0 ? (
                    <p className="rounded-2xl border border-[#d7dce6] bg-white px-3.5 py-3 text-[14px] leading-[1.6] text-[#36435d] dark:border-[#63708a] dark:bg-[#1f2a3e] dark:text-[#d7e5ff]">
                      • 这张卡的要点已在标题中完整呈现。
                    </p>
                  ) : null}
                </div>

                <div className="mt-6 flex items-center justify-between">
                  <span className="text-[13px] text-[#6c7893] dark:text-[#b3c4e2]">共 {card.items.length} 条</span>
                  {card.showAllCta ? (
                    <button
                      type="button"
                      onClick={() => {
                        trackResultCta("open_full_card", {
                          card_source: card.source,
                          card_key: card.key,
                        });
                        setActiveSheet({ source: card.source, title: card.title, items: card.items });
                      }}
                      data-analytics-id={`result:cta:open-full:${card.key}`}
                      className="m-pressable inline-flex h-10 items-center justify-center rounded-full bg-[linear-gradient(180deg,#2997ff_0%,#0071e3_100%)] px-5 text-[14px] font-semibold text-white shadow-[0_12px_24px_rgba(0,113,227,0.26)] active:opacity-95"
                    >
                      全部内容
                    </button>
                  ) : (
                    <span className="text-[12px] text-[#8b95aa] dark:text-[#9fafc8]">已全部展示</span>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>

        <article className="rounded-[26px] border border-[#d7dce6] bg-[linear-gradient(180deg,#fbfcfe_0%,#f4f6fa_100%)] px-5 py-5 shadow-[0_12px_30px_rgba(17,24,39,0.06)] dark:border-[#5c677f] dark:bg-[linear-gradient(180deg,#1b2638_0%,#151e2f_100%)]">
          <h3 className="text-[20px] font-semibold tracking-[-0.02em] text-[#16233a] dark:text-[#ecf2ff]">接下来这样做</h3>
          <ul className="mt-3 space-y-2.5">
            {actionItems.map((line, idx) => (
              <li
                key={`${line}-${idx}`}
                className="rounded-2xl border border-[#d7dce6] bg-white px-3.5 py-3 text-[14px] leading-[1.62] text-[#30405c] dark:border-[#64718b] dark:bg-[#1f2a3e] dark:text-[#d6e6ff]"
              >
                {line}
              </li>
            ))}
          </ul>

          <div className="mt-5 flex flex-wrap gap-2">
            <Link
              href={result.recommendation.links.product}
              data-analytics-id="result:cta:product"
              onClick={() => {
                trackResultCta("recommendation_product", {
                  target_path: result.recommendation.links.product,
                }, true);
              }}
              className="m-pressable inline-flex h-11 items-center justify-center rounded-full bg-[linear-gradient(180deg,#2997ff_0%,#0071e3_100%)] px-6 text-[15px] font-semibold text-white shadow-[0_12px_28px_rgba(0,113,227,0.28)] active:opacity-95"
            >
              查看推荐产品
            </Link>
            <Link
              href={result.recommendation.links.wiki}
              data-analytics-id="result:cta:wiki"
              onClick={() => {
                trackResultCta("recommendation_wiki", {
                  target_path: result.recommendation.links.wiki,
                }, true);
              }}
              className="m-pressable inline-flex h-11 items-center justify-center rounded-full border border-[#d0d6e0] bg-white px-5 text-[14px] font-medium text-[#2f3b53] active:bg-black/[0.03] dark:border-[#5f6b82] dark:bg-[#1f2a3e] dark:text-[#d7e4ff]"
            >
              查看成分百科
            </Link>
          </div>
        </article>

        {result.transparency.warnings.length > 0 ? (
          <div className="rounded-2xl border border-[#f0d8a8] bg-[#fff8eb] px-4 py-3 text-[13px] leading-[1.6] text-[#89600e] dark:border-[#8c7346] dark:bg-[#3b2f1c] dark:text-[#ffd99a]">
            {result.transparency.warnings.join(" ")}
          </div>
        ) : null}
      </section>

      {activeSheet ? (
        <div className="fixed inset-0 z-[84]" role="dialog" aria-modal="true" aria-label={`${activeSheet.title}全部内容`}>
          <button
            type="button"
            className="absolute inset-0 bg-black/48 backdrop-blur-sm"
            onClick={() => {
              setActiveSheet(null);
            }}
            aria-label="关闭弹层"
          />

          <div className="m-sheet-enter absolute inset-x-0 bottom-0 max-h-[84dvh] overflow-hidden rounded-t-[30px] border border-white/42 bg-white/95 shadow-[0_-24px_68px_rgba(0,0,0,0.34)] dark:border-[#6f7d98]/34 dark:bg-[rgba(16,26,42,0.96)] dark:shadow-[0_-24px_72px_rgba(0,0,0,0.56)]">
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
                      className="rounded-2xl border border-[#d7dce6] bg-[#f8fafd] px-3.5 py-3.5 dark:border-[#6f88b3]/36 dark:bg-[rgba(30,45,70,0.76)]"
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

function MiniProductCard({ title, visual }: { title: string; visual: ProductVisual }) {
  return (
    <section className="rounded-2xl border border-[#d7dce6] bg-white px-3 py-3 dark:border-[#61708a] dark:bg-[#1f2a3e]">
      <p className="text-[11px] font-medium text-[#67758f] dark:text-[#acbdd9]">{title}</p>
      <div className="mt-2 flex items-center gap-2.5">
        <ProductThumb src={visual.imageSrc} alt={visual.shortName} size={42} />
        <div className="min-w-0">
          <p className="truncate text-[14px] font-semibold text-[#1f2b43] dark:text-[#e3edff]">{visual.shortName}</p>
          <p className="truncate text-[12px] text-[#7b869c] dark:text-[#9fb1cd]">{visual.fullName}</p>
        </div>
      </div>
    </section>
  );
}

function ProductThumb({ src, alt, size }: { src: string; alt: string; size: number }) {
  const rounded = Math.round(size * 0.28);
  if (/^https?:\/\//.test(src)) {
    return (
      <div
        aria-label={alt}
        className="shrink-0 border border-[#d9deea] bg-cover bg-center dark:border-[#61708a]"
        style={{
          width: `${size}px`,
          height: `${size}px`,
          borderRadius: `${rounded}px`,
          backgroundImage: `url(${encodeURI(src)})`,
        }}
      />
    );
  }

  return (
    <div className="relative shrink-0 overflow-hidden border border-[#d9deea] bg-[#eef2f8] dark:border-[#61708a] dark:bg-[#253249]" style={{ width: `${size}px`, height: `${size}px`, borderRadius: `${rounded}px` }}>
      <Image src={src} alt={alt} fill sizes={`${size}px`} className="object-cover" />
    </div>
  );
}

function normalizeImageSrc(raw: string | null | undefined, fallback: string): string {
  const value = String(raw || "").trim();
  if (!value) return fallback;
  if (value.startsWith("http://") || value.startsWith("https://") || value.startsWith("/")) return value;
  return fallback;
}

function formatProductName(
  brand: string | null | undefined,
  name: string | null | undefined,
  fallback: string,
): string {
  const b = sanitizeText(brand || "", 32);
  const n = sanitizeText(name || "", 80);
  const combined = [b, n].filter(Boolean).join(" ").trim();
  return combined || sanitizeText(fallback, 80) || "方案";
}

function shortProductName(
  brand: string | null | undefined,
  name: string | null | undefined,
  fallback: string,
): string {
  const full = formatProductName(brand, name, fallback);
  const plain = full.replace(/（.*?）|\(.*?\)/g, "").trim();
  if (plain.length <= 14) return plain;
  const brandPart = sanitizeText(brand || "", 12);
  const namePart = sanitizeText(name || "", 22).replace(/（.*?）|\(.*?\)/g, "").trim();
  if (brandPart && namePart) {
    const joined = `${brandPart} ${namePart}`;
    if (joined.length <= 14) return joined;
    return `${joined.slice(0, 13)}…`;
  }
  return `${plain.slice(0, 13)}…`;
}

function heroDecisionTitle(decision: "keep" | "switch" | "hybrid", currentShort: string, recommendedShort: string): string {
  if (decision === "switch") return `现在更适合你：${recommendedShort}`;
  if (decision === "hybrid") return "现在更适合你：分场景搭配";
  return `现在更适合你：${currentShort}`;
}

function heroDecisionAttitude(decision: "keep" | "switch" | "hybrid"): string {
  if (decision === "switch") return "态度很明确：切到更贴合你当下状态的方案，减少试错。";
  if (decision === "hybrid") return "态度很明确：两款分工使用，会比只用一款更稳。";
  return "态度很明确：先把头皮状态稳住，再决定要不要增强清洁。";
}

function decisionLabel(value: "keep" | "switch" | "hybrid"): string {
  if (value === "keep") return "建议继续用";
  if (value === "switch") return "建议切换";
  return "建议分场景";
}

function decisionTone(value: "keep" | "switch" | "hybrid"): string {
  if (value === "keep") return "border-[#c7d6f0] bg-[#eef4ff] text-[#3e5b8f] dark:border-[#6f86b0] dark:bg-[#2a3a56] dark:text-[#c8d8f5]";
  if (value === "switch") return "border-[#c7d6f0] bg-[#eef4ff] text-[#3e5b8f] dark:border-[#6f86b0] dark:bg-[#2a3a56] dark:text-[#c8d8f5]";
  return "border-[#e3d3b6] bg-[#faf2e5] text-[#8a6730] dark:border-[#8f7b57] dark:bg-[#3a3123] dark:text-[#f0d7ab]";
}

function getSectionItems(sections: MobileCompareResultSection[], key: MobileCompareResultSection["key"]): string[] {
  const target = sections.find((section) => section.key === key);
  if (!target) return [];
  return takeUnique(target.items || []);
}

function itemTagMeta(source: InsightSource, line: string): { label: string; className: string } {
  if (source === "feel") {
    return {
      label: "体验亮点",
      className: "border-[#bfd1f1] bg-[#edf3ff] text-[#3f5d92] dark:border-[#6f86b0] dark:bg-[#2a3a56] dark:text-[#d0def8]",
    };
  }

  if (source === "rhythm") {
    return {
      label: "护理建议",
      className: "border-[#bfd1f1] bg-[#edf3ff] text-[#3f5d92] dark:border-[#6f86b0] dark:bg-[#2a3a56] dark:text-[#d0def8]",
    };
  }

  if (source === "care") {
    const text = line.toLowerCase();
    if (/高风险|严重|避免|禁用|炎症|破损|刺激|过敏|加重/.test(text)) {
      return {
        label: "重点留意",
        className: "border-[#efc0b8] bg-[#fff0ed] text-[#a85144] dark:border-[#95615b] dark:bg-[#4a2d2a] dark:text-[#ffcdc6]",
      };
    }
    return {
      label: "使用提示",
      className: "border-[#e3d3b6] bg-[#faf2e5] text-[#8a6730] dark:border-[#8f7b57] dark:bg-[#3a3123] dark:text-[#f0d7ab]",
    };
  }

  if (source === "consensus") {
    return {
      label: "对比共识",
      className: "border-[#cfd6e4] bg-[#f3f6fb] text-[#4a5a78] dark:border-[#6f7e98] dark:bg-[#2a364d] dark:text-[#d2def3]",
    };
  }

  if (source === "ingredient") {
    return {
      label: "配方看点",
      className: "border-[#cfd6e4] bg-[#f3f6fb] text-[#4a5a78] dark:border-[#6f7e98] dark:bg-[#2a364d] dark:text-[#d2def3]",
    };
  }

  return {
    label: "核心信息",
    className: "border-[#cfd6e4] bg-[#f3f6fb] text-[#4a5a78] dark:border-[#6f7e98] dark:bg-[#2a364d] dark:text-[#d2def3]",
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
