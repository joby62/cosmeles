import Link from "next/link";
import { fetchMobileCompareResult } from "@/lib/api";
import { formatRuntimeError } from "@/lib/error";

export default async function MobileCompareResultPage({
  params,
}: {
  params: { compareId: string } | Promise<{ compareId: string }>;
}) {
  const { compareId } = await Promise.resolve(params);
  let result: Awaited<ReturnType<typeof fetchMobileCompareResult>> | null = null;
  let loadError: string | null = null;

  try {
    result = await fetchMobileCompareResult(compareId);
  } catch (err) {
    loadError = formatRuntimeError(err);
  }

  if (!result) {
    return (
      <section className="m-compare-result-page pb-12">
        <article className="rounded-[24px] border border-[#ffb39e]/55 bg-[linear-gradient(180deg,#fff8f4_0%,#fff2ed_100%)] px-5 py-5 dark:border-[#b16b58]/45 dark:bg-[linear-gradient(180deg,#35221f_0%,#2a1a18_100%)]">
          <div className="text-[12px] font-semibold tracking-[0.04em] text-[#b6543f] dark:text-[#ffb39d]">对比结果加载失败</div>
          <h1 className="mt-2 text-[26px] leading-[1.18] font-semibold tracking-[-0.02em] text-[#452016] dark:text-[#ffd5cb]">本次对比未能完成展示</h1>
          <p className="mt-3 text-[14px] leading-[1.55] text-[#6c3428] dark:text-[#f2beb1]">
            页面没有中断，已保留后端真实错误，方便继续排查。
          </p>
          <p className="mt-3 rounded-2xl border border-[#f6c6bc] bg-white/82 px-3 py-2 text-[13px] leading-[1.55] text-[#7a2d21] dark:border-[#a16a61]/45 dark:bg-[rgba(59,34,31,0.7)] dark:text-[#ffd2c8]">
            真实错误：{loadError || "unknown"}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/m/compare"
              className="inline-flex h-10 items-center justify-center rounded-full bg-[linear-gradient(180deg,#2997ff_0%,#0071e3_100%)] px-5 text-[14px] font-semibold text-white shadow-[0_10px_24px_rgba(0,113,227,0.28)]"
            >
              返回横向对比
            </Link>
            <Link
              href="/m"
              className="inline-flex h-10 items-center justify-center rounded-full border border-[#202737]/18 px-5 text-[14px] font-semibold text-[#232e45] dark:border-[#6e85ad]/38 dark:text-[#d6e5ff]"
            >
              回到移动首页
            </Link>
          </div>
        </article>
      </section>
    );
  }

  const pairResults = result.pair_results || [];
  const overall = result.overall || null;
  const finalDecision = overall?.decision || result.verdict.decision;
  const finalConfidence = Math.round((overall?.confidence ?? result.verdict.confidence) * 100);
  const finalHeadline = String(overall?.headline || result.verdict.headline || "你的本次对比结论已生成。").trim();
  const focusPair = pairResults[0] || null;
  const leftAnchor = focusPair?.left_title || productDocTitle(result.current_product, "当前在用");
  const rightAnchor = focusPair?.right_title || productDocTitle(result.recommended_product, "推荐方案");
  const quickReasons = buildQuickReasons(overall?.summary_items || [], (focusPair?.sections || result.sections || []).slice(0, 3));
  const personaTags = (result.recommendation.choices || [])
    .map((item) => String(item.label || "").trim())
    .filter(Boolean)
    .slice(0, 2);
  const hasExtraPair = pairResults.length > 1;

  return (
    <section className="m-compare-result-page space-y-5 pb-12">
      <article className="overflow-hidden rounded-[28px] border border-[#bdd1f6] bg-[linear-gradient(180deg,#f4f8ff_0%,#edf4ff_58%,#ffffff_100%)] px-5 py-6 shadow-[0_16px_38px_rgba(34,77,151,0.14)] dark:border-[#5370a8]/54 dark:bg-[linear-gradient(180deg,#122038_0%,#0f1b2f_58%,#0d1728_100%)] dark:shadow-[0_16px_38px_rgba(0,0,0,0.45)]">
        <div className="text-[12px] font-semibold tracking-[0.04em] text-[#3b62ad] dark:text-[#8cb8ff]">你的浴室答案</div>
        <h1 className="mt-2 text-[34px] leading-[1.14] font-semibold tracking-[-0.03em] text-[#111928] dark:text-[#edf3ff]">{finalHeadline}</h1>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className={`inline-flex h-8 items-center rounded-full border px-3 text-[12px] font-semibold ${decisionTone(finalDecision)}`}>
            {decisionLabel(finalDecision)}
          </span>
          <span className="inline-flex h-8 items-center rounded-full border border-[#1f2a3f]/12 bg-white/85 px-3 text-[12px] text-[#3f4a61] dark:border-[#7b94c0]/38 dark:bg-[rgba(39,55,84,0.72)] dark:text-[#d5e5ff]">
            置信度 {finalConfidence}%
          </span>
          {personaTags.map((tag) => (
            <span
              key={tag}
              className="inline-flex h-8 items-center rounded-full border border-[#1f2a3f]/10 bg-white/72 px-3 text-[12px] text-[#4b5870] dark:border-[#6d86b0]/34 dark:bg-[rgba(34,49,76,0.72)] dark:text-[#cadeff]"
            >
              {tag}
            </span>
          ))}
        </div>

        {quickReasons.length > 0 ? (
          <div className="mt-4 space-y-2">
            {quickReasons.slice(0, 2).map((reason, idx) => (
              <p
                key={`${idx}-${reason}`}
                className="rounded-2xl border border-[#1f2a3f]/10 bg-white/76 px-3 py-2 text-[13px] leading-[1.55] text-[#39445c] dark:border-[#6f87b0]/32 dark:bg-[rgba(33,47,73,0.72)] dark:text-[#d0e0fb]"
              >
                {reason}
              </p>
            ))}
          </div>
        ) : null}

        <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div className="rounded-2xl border border-[#1f2a3f]/10 bg-white/75 px-3 py-3 dark:border-[#6a84ad]/34 dark:bg-[rgba(31,46,72,0.72)]">
            <div className="text-[11px] text-[#55617a] dark:text-[#aac4ec]">当前方案</div>
            <div className="mt-1 text-[13px] font-medium leading-[1.45] text-[#1c273c] dark:text-[#e1ecff]">{leftAnchor}</div>
          </div>
          <div className="rounded-2xl border border-[#1f2a3f]/10 bg-white/75 px-3 py-3 dark:border-[#6a84ad]/34 dark:bg-[rgba(31,46,72,0.72)]">
            <div className="text-[11px] text-[#55617a] dark:text-[#aac4ec]">建议方案</div>
            <div className="mt-1 text-[13px] font-medium leading-[1.45] text-[#1c273c] dark:text-[#e1ecff]">{rightAnchor}</div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <a
            href="#full-report"
            className="inline-flex h-11 items-center justify-center rounded-full bg-[linear-gradient(180deg,#2997ff_0%,#0071e3_100%)] px-6 text-[15px] font-semibold text-white shadow-[0_12px_28px_rgba(0,113,227,0.3)] active:opacity-95"
          >
            展开看全
          </a>
          <Link
            href={`/m/compare?category=${encodeURIComponent(result.category)}`}
            className="inline-flex h-11 items-center justify-center rounded-full border border-[#202737]/18 bg-white/75 px-5 text-[14px] font-medium text-[#2b3954] dark:border-[#6e85ad]/38 dark:bg-[rgba(31,47,72,0.75)] dark:text-[#d5e6ff]"
          >
            再做一次对比
          </Link>
        </div>
      </article>

      <article className="rounded-[24px] border border-[#1f2a3f]/10 bg-white/84 px-4 py-4 dark:border-[#5d77a2]/34 dark:bg-[rgba(19,31,50,0.9)]">
        <h2 className="text-[18px] font-semibold tracking-[-0.01em] text-[#162036] dark:text-[#e2edff]">为什么是这个结论</h2>
        <p className="mt-1 text-[13px] text-[#56627b] dark:text-[#abc5ed]">先看关键线索，再决定是否深入完整报告。</p>
        <div className="mt-3 space-y-2">
          {quickReasons.slice(0, 3).map((reason, idx) => (
            <div
              key={`${idx}-${reason}-core`}
              className="rounded-2xl border border-[#1f2a3f]/8 bg-[#f6f8fc] px-3 py-2 text-[13px] leading-[1.55] text-[#33405a] dark:border-[#6781ad]/30 dark:bg-[rgba(30,44,69,0.7)] dark:text-[#c8daf7]"
            >
              {reason}
            </div>
          ))}
        </div>
      </article>

      {hasExtraPair ? (
        <details className="rounded-[24px] border border-[#1f2a3f]/10 bg-white/84 px-4 py-3 dark:border-[#5d77a2]/34 dark:bg-[rgba(19,31,50,0.9)]">
          <summary className="cursor-pointer list-none">
            <div className="flex items-center justify-between">
              <span className="text-[16px] font-semibold text-[#1a2440] dark:text-[#e0ebff]">其余对比分组</span>
              <span className="text-[12px] text-[#5a6782] dark:text-[#a7c2ea]">{pairResults.length - 1} 组</span>
            </div>
          </summary>
          <div className="mt-3 space-y-2">
            {pairResults.slice(1).map((pair) => (
              <div
                key={`${pair.pair_key}-brief`}
                className="rounded-2xl border border-[#1f2a3f]/8 bg-[#f8fafd] px-3 py-2 text-[13px] leading-[1.5] text-[#324058] dark:border-[#6781ad]/28 dark:bg-[rgba(30,44,69,0.65)] dark:text-[#cadcf9]"
              >
                {pair.left_title} vs {pair.right_title} · {pairDecisionLabel(pair.verdict.decision)}
              </div>
            ))}
          </div>
        </details>
      ) : null}

      {result.transparency.warnings.length > 0 ? (
        <div className="rounded-2xl border border-[#ffd28f]/55 bg-[#fff7e9] px-4 py-3 text-[13px] text-[#8b5a00] dark:border-[#e6b56b]/45 dark:bg-[rgba(86,63,23,0.48)] dark:text-[#ffdca5]">
          {result.transparency.warnings.join(" ")}
        </div>
      ) : null}

      <section id="full-report" className="space-y-3">
        <div className="px-1">
          <h2 className="text-[22px] font-semibold tracking-[-0.02em] text-[#152038] dark:text-[#e4eeff]">完整报告</h2>
          <p className="mt-1 text-[13px] text-[#5a6782] dark:text-[#a7c2ea]">所有明细都在这里，默认折叠，按需展开。</p>
        </div>

        {pairResults.length > 0 ? (
          pairResults.map((pair) => (
            <details
              key={`${pair.pair_key}-full`}
              className="rounded-[22px] border border-[#1f2a3f]/10 bg-white/86 px-4 py-3 dark:border-[#5a73a0]/34 dark:bg-[rgba(18,29,48,0.92)]"
            >
              <summary className="cursor-pointer list-none">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-[15px] leading-[1.4] font-semibold text-[#17213a] dark:text-[#e0ecff]">
                    {pair.left_title} vs {pair.right_title}
                  </h3>
                  <span className={`inline-flex h-7 shrink-0 items-center rounded-full border px-2.5 text-[11px] font-semibold ${decisionTone(pair.verdict.decision)}`}>
                    {pairDecisionLabel(pair.verdict.decision)}
                  </span>
                </div>
              </summary>

              <p className="mt-3 text-[13px] leading-[1.55] text-[#3b465e] dark:text-[#c7d9f5]">{pair.verdict.headline}</p>

              <div className="mt-3 space-y-2">
                {pair.sections.map((section) => (
                  <details
                    key={`${pair.pair_key}-${section.key}`}
                    className="rounded-xl border border-[#1f2a3f]/8 bg-[#f7f9fc] px-3 py-2 dark:border-[#6881ad]/30 dark:bg-[rgba(32,46,72,0.64)]"
                  >
                    <summary className="cursor-pointer text-[13px] font-semibold text-[#2b354d] dark:text-[#d9e8ff]">
                      {sectionTitle(section.key, section.title)}
                    </summary>
                    <ul className="mt-2 space-y-1.5">
                      {section.items.map((item, idx) => (
                        <li key={`${section.key}-${idx}`} className="text-[12px] leading-[1.55] text-[#455069] dark:text-[#c3d5f3]">
                          • {item}
                        </li>
                      ))}
                    </ul>
                  </details>
                ))}
              </div>

              {pair.ingredient_diff.inci_order_diff.length > 0 || pair.ingredient_diff.function_rank_diff.length > 0 ? (
                <details className="mt-3 rounded-xl border border-[#1f2a3f]/8 bg-white/80 px-3 py-2 dark:border-[#6781ad]/30 dark:bg-[rgba(28,42,66,0.74)]">
                  <summary className="cursor-pointer text-[12px] font-medium text-[#3b4660] dark:text-[#d2e3ff]">查看成分排位与功能差异</summary>
                  {pair.ingredient_diff.inci_order_diff.length > 0 ? (
                    <ul className="mt-2 space-y-1">
                      {pair.ingredient_diff.inci_order_diff.slice(0, 10).map((item, idx) => (
                        <li key={`${pair.pair_key}-${item.ingredient}-${idx}`} className="text-[11px] leading-[1.45] text-[#54617d] dark:text-[#bdd0f0]">
                          • {item.ingredient}：{item.current_rank} / {item.recommended_rank}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </details>
              ) : null}
            </details>
          ))
        ) : (
          result.sections.map((section) => (
            <details
              key={`${section.key}-full`}
              className="rounded-[22px] border border-[#1f2a3f]/10 bg-white/86 px-4 py-3 dark:border-[#5d77a2]/34 dark:bg-[rgba(19,31,50,0.9)]"
            >
              <summary className="cursor-pointer text-[15px] font-semibold text-[#1a2337] dark:text-[#e1ecff]">
                {sectionTitle(section.key, section.title)}
              </summary>
              <ul className="mt-2 space-y-1.5">
                {section.items.map((item, idx) => (
                  <li key={`${section.key}-${idx}`} className="text-[13px] leading-[1.55] text-[#3f4b64] dark:text-[#c4d7f6]">
                    • {item}
                  </li>
                ))}
              </ul>
            </details>
          ))
        )}
      </section>

      <div className="mt-1 flex flex-wrap gap-2">
        <Link
          href={result.recommendation.links.product}
          className="inline-flex h-10 items-center justify-center rounded-full border border-[#202737]/18 px-5 text-[14px] font-semibold text-[#232e45] dark:border-[#6e85ad]/38 dark:text-[#d6e5ff]"
        >
          查看推荐产品
        </Link>
        <Link
          href={result.recommendation.links.wiki}
          className="inline-flex h-10 items-center justify-center rounded-full border border-[#202737]/18 px-5 text-[14px] font-semibold text-[#232e45] dark:border-[#6e85ad]/38 dark:text-[#d6e5ff]"
        >
          查看成分百科
        </Link>
      </div>
    </section>
  );
}

function decisionLabel(value: "keep" | "switch" | "hybrid"): string {
  if (value === "keep") return "继续用";
  if (value === "switch") return "建议换";
  return "分场景";
}

function pairDecisionLabel(value: "keep" | "switch" | "hybrid"): string {
  if (value === "keep") return "更偏向当前方案";
  if (value === "switch") return "更偏向推荐方案";
  return "场景分配更合适";
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

function buildQuickReasons(
  overallItems: string[],
  sections: Array<{ items: string[] }>,
): string[] {
  const out: string[] = [];
  const push = (value: string) => {
    const text = String(value || "").trim();
    if (!text) return;
    if (out.includes(text)) return;
    out.push(text);
  };

  for (const item of overallItems) {
    push(item);
    if (out.length >= 3) return out;
  }

  for (const section of sections) {
    for (const item of section.items || []) {
      push(item);
      if (out.length >= 3) return out;
    }
  }

  if (out.length === 0) {
    out.push("已完成对比分析，建议优先按结论动作执行，再查看完整明细。");
  }
  return out;
}
