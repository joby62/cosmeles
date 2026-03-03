import Link from "next/link";
import { fetchMobileCompareResult } from "@/lib/api";

export default async function MobileCompareResultPage({
  params,
}: {
  params: { compareId: string } | Promise<{ compareId: string }>;
}) {
  const { compareId } = await Promise.resolve(params);
  const result = await fetchMobileCompareResult(compareId);
  const pairResults = result.pair_results || [];
  const overall = result.overall || null;

  return (
    <section className="pb-12">
      <div className="text-[13px] font-medium text-black/45">专业对比 · 结论</div>
      <h1 className="mt-2 text-[30px] leading-[1.12] font-semibold tracking-[-0.02em] text-black/92">
        {overall?.headline || result.verdict.headline}
      </h1>
      <p className="mt-2 text-[13px] leading-[1.5] text-black/60">
        决策：{decisionLabel(overall?.decision || result.verdict.decision)} · 置信度 {Math.round((overall?.confidence ?? result.verdict.confidence) * 100)}%
      </p>
      {overall?.summary_items?.length ? (
        <ul className="mt-3 space-y-1">
          {overall.summary_items.map((item, idx) => (
            <li key={`${idx}-${item}`} className="text-[12px] leading-[1.5] text-black/58">
              • {item}
            </li>
          ))}
        </ul>
      ) : null}

      {result.transparency.warnings.length > 0 ? (
        <div className="mt-4 rounded-2xl border border-[#ffd28f]/45 bg-[#fff6e8] px-4 py-3 text-[13px] text-[#8b5a00]">
          {result.transparency.warnings.join(" ")}
        </div>
      ) : null}

      {pairResults.length > 0 ? (
        <div className="mt-5 grid grid-cols-1 gap-3">
          {pairResults.map((pair) => (
            <article key={pair.pair_key} className="rounded-2xl border border-black/10 bg-white px-4 py-4">
              <h2 className="text-[15px] font-semibold text-black/86">
                {pair.left_title} vs {pair.right_title}
              </h2>
              <p className="mt-1 text-[12px] leading-[1.5] text-black/58">
                结论：{pairDecisionLabel(pair.verdict.decision)} · 置信度 {Math.round(pair.verdict.confidence * 100)}%
              </p>

              <div className="mt-3 grid grid-cols-1 gap-2">
                {pair.sections.map((section) => (
                  <div key={`${pair.pair_key}-${section.key}`} className="rounded-xl border border-black/8 bg-black/[0.015] px-3 py-2.5">
                    <div className="text-[12px] font-semibold text-black/76">{section.title}</div>
                    <ul className="mt-1.5 space-y-1">
                      {section.items.map((item, idx) => (
                        <li key={`${section.key}-${idx}`} className="text-[12px] leading-[1.5] text-black/64">
                          • {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>

              <div className="mt-3 text-[12px] leading-[1.55] text-black/60">
                共同成分 {pair.ingredient_diff.overlap.length} 项 · 左侧独有 {pair.ingredient_diff.only_current.length} 项 · 右侧独有{" "}
                {pair.ingredient_diff.only_recommended.length} 项
              </div>
              {pair.ingredient_diff.inci_order_diff.length > 0 ? (
                <div className="mt-1 text-[11px] leading-[1.5] text-black/52">
                  排位差异（前{pair.ingredient_diff.inci_order_diff.length}）：{" "}
                  {pair.ingredient_diff.inci_order_diff
                    .slice(0, 4)
                    .map((item) => `${item.ingredient}(${item.current_rank}/${item.recommended_rank})`)
                    .join("，")}
                </div>
              ) : null}
            </article>
          ))}
        </div>
      ) : (
        <div className="mt-5 grid grid-cols-1 gap-3">
          {result.sections.map((section) => (
            <article key={section.key} className="rounded-2xl border border-black/10 bg-white px-4 py-4">
              <h2 className="text-[15px] font-semibold text-black/86">{section.title}</h2>
              <ul className="mt-2 space-y-1.5">
                {section.items.map((item, idx) => (
                  <li key={`${section.key}-${idx}`} className="text-[13px] leading-[1.55] text-black/68">
                    • {item}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-2">
        <Link
          href={result.recommendation.links.product}
          className="inline-flex h-10 items-center justify-center rounded-full bg-black px-5 text-[14px] font-semibold text-white"
        >
          查看历史首推
        </Link>
        <Link
          href={`/m/compare?category=${encodeURIComponent(result.category)}`}
          className="inline-flex h-10 items-center justify-center rounded-full border border-black/15 px-5 text-[14px] font-semibold text-black/78"
        >
          再对比一次
        </Link>
        <Link
          href={result.recommendation.links.wiki}
          className="inline-flex h-10 items-center justify-center rounded-full border border-black/15 px-5 text-[14px] font-semibold text-black/78"
        >
          查看成分百科
        </Link>
      </div>
    </section>
  );
}

function decisionLabel(value: "keep" | "switch" | "hybrid"): string {
  if (value === "keep") return "建议保留";
  if (value === "switch") return "建议替换";
  return "分场景并用";
}

function pairDecisionLabel(value: "keep" | "switch" | "hybrid"): string {
  if (value === "keep") return "更偏向左侧";
  if (value === "switch") return "更偏向右侧";
  return "两者分场景并用";
}
