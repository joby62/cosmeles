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
      <section className="pb-12">
        <article className="rounded-[24px] border border-[#ffb39e]/55 bg-[linear-gradient(180deg,#fff8f4_0%,#fff2ed_100%)] px-5 py-5">
          <div className="text-[12px] font-semibold tracking-[0.04em] text-[#b6543f]">对比结果加载失败</div>
          <h1 className="mt-2 text-[26px] leading-[1.18] font-semibold tracking-[-0.02em] text-[#452016]">本次对比未能完成展示</h1>
          <p className="mt-3 text-[14px] leading-[1.55] text-[#6c3428]">
            页面没有中断，已保留后端真实错误，方便继续排查。
          </p>
          <p className="mt-3 rounded-2xl border border-[#f6c6bc] bg-white/82 px-3 py-2 text-[13px] leading-[1.55] text-[#7a2d21]">
            真实错误：{loadError || "unknown"}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/m/compare"
              className="inline-flex h-10 items-center justify-center rounded-full bg-black px-5 text-[14px] font-semibold text-white"
            >
              返回横向对比
            </Link>
            <Link
              href="/m"
              className="inline-flex h-10 items-center justify-center rounded-full border border-black/15 px-5 text-[14px] font-semibold text-black/78"
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
  const finalHeadline = overall?.headline || result.verdict.headline;

  return (
    <section className="pb-12">
      <article className="overflow-hidden rounded-[26px] border border-[#b8cdf4] bg-[linear-gradient(180deg,#f4f8ff_0%,#ebf2ff_55%,#ffffff_100%)] px-5 py-5 shadow-[0_14px_36px_rgba(32,76,157,0.14)]">
        <div className="text-[12px] font-semibold tracking-[0.04em] text-[#3b62ad]">专业对比结论</div>
        <h1 className="mt-2 text-[28px] leading-[1.16] font-semibold tracking-[-0.02em] text-black/92">{finalHeadline}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className={`inline-flex h-8 items-center rounded-full border px-3 text-[12px] font-semibold ${decisionTone(finalDecision)}`}>
            {decisionLabel(finalDecision)}
          </span>
          <span className="inline-flex h-8 items-center rounded-full border border-black/10 bg-white/85 px-3 text-[12px] text-black/62">
            置信度 {finalConfidence}%
          </span>
        </div>

        {overall?.summary_items?.length ? (
          <div className="mt-4 grid grid-cols-1 gap-2">
            {overall.summary_items.slice(0, 3).map((item, idx) => (
              <div key={`${idx}-${item}`} className="rounded-xl border border-black/8 bg-white/82 px-3 py-2 text-[12px] leading-[1.5] text-black/66">
                {item}
              </div>
            ))}
          </div>
        ) : null}
      </article>

      {result.transparency.warnings.length > 0 ? (
        <div className="mt-4 rounded-2xl border border-[#ffd28f]/55 bg-[#fff7e9] px-4 py-3 text-[13px] text-[#8b5a00]">
          {result.transparency.warnings.join(" ")}
        </div>
      ) : null}

      {pairResults.length > 0 ? (
        <div className="mt-5 grid grid-cols-1 gap-3">
          {pairResults.map((pair) => (
            <article key={pair.pair_key} className="rounded-[22px] border border-black/10 bg-white px-4 py-4 shadow-[0_10px_24px_rgba(18,35,65,0.06)]">
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-[15px] leading-[1.35] font-semibold text-black/88">
                  {pair.left_title} vs {pair.right_title}
                </h2>
                <span className={`inline-flex h-7 shrink-0 items-center rounded-full border px-2.5 text-[11px] font-semibold ${decisionTone(pair.verdict.decision)}`}>
                  {pairDecisionLabel(pair.verdict.decision)}
                </span>
              </div>

              <p className="mt-2 text-[13px] leading-[1.5] text-black/66">{pair.verdict.headline}</p>

              <div className="mt-3 flex flex-wrap gap-1.5">
                <MetricPill label={`共同 ${pair.ingredient_diff.overlap.length}`} />
                <MetricPill label={`左侧独有 ${pair.ingredient_diff.only_current.length}`} />
                <MetricPill label={`右侧独有 ${pair.ingredient_diff.only_recommended.length}`} />
                <MetricPill label={`置信度 ${Math.round(pair.verdict.confidence * 100)}%`} />
              </div>

              <div className="mt-3 grid grid-cols-1 gap-2">
                {pair.sections.map((section) => (
                  <div key={`${pair.pair_key}-${section.key}`} className="rounded-xl border border-black/8 bg-black/[0.015] px-3 py-2.5">
                    <div className="text-[12px] font-semibold text-black/78">{sectionTitle(section.key, section.title)}</div>
                    <ul className="mt-1.5 space-y-1">
                      {section.items.slice(0, 3).map((item, idx) => (
                        <li key={`${section.key}-${idx}`} className="text-[12px] leading-[1.5] text-black/64">
                          • {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>

              {pair.ingredient_diff.inci_order_diff.length > 0 ? (
                <details className="mt-3 rounded-xl border border-black/8 bg-white/75 px-3 py-2">
                  <summary className="cursor-pointer text-[12px] font-medium text-black/70">查看成分排位差异</summary>
                  <ul className="mt-2 space-y-1">
                    {pair.ingredient_diff.inci_order_diff.slice(0, 6).map((item, idx) => (
                      <li key={`${pair.pair_key}-${item.ingredient}-${idx}`} className="text-[11px] leading-[1.45] text-black/58">
                        • {item.ingredient}：{item.current_rank} / {item.recommended_rank}
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}
            </article>
          ))}
        </div>
      ) : (
        <div className="mt-5 grid grid-cols-1 gap-3">
          {result.sections.map((section) => (
            <article key={section.key} className="rounded-[22px] border border-black/10 bg-white px-4 py-4">
              <h2 className="text-[15px] font-semibold text-black/86">{sectionTitle(section.key, section.title)}</h2>
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
          href={`/m/compare?category=${encodeURIComponent(result.category)}`}
          className="inline-flex h-10 items-center justify-center rounded-full bg-black px-5 text-[14px] font-semibold text-white"
        >
          再做一次对比
        </Link>
        <Link
          href={result.recommendation.links.product}
          className="inline-flex h-10 items-center justify-center rounded-full border border-black/15 px-5 text-[14px] font-semibold text-black/78"
        >
          查看推荐产品
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
  return "场景分配更合适";
}

function decisionTone(value: "keep" | "switch" | "hybrid"): string {
  if (value === "keep") return "border-[#b7d4ff] bg-[#ebf4ff] text-[#2e61be]";
  if (value === "switch") return "border-[#c8dcff] bg-[#f1f7ff] text-[#3669c4]";
  return "border-[#ffd79e] bg-[#fff6e8] text-[#96631a]";
}

function sectionTitle(key: string, fallback: string): string {
  if (key === "keep_benefits") return "继续使用时，你能得到什么";
  if (key === "keep_watchouts") return "继续使用时，需要留意什么";
  if (key === "ingredient_order_diff") return "两款成分排位差异";
  if (key === "profile_fit_advice") return "结合你的个人情况建议";
  return fallback;
}

function MetricPill({ label }: { label: string }) {
  return <span className="inline-flex h-6 items-center rounded-full border border-black/10 bg-white px-2.5 text-[11px] text-black/62">{label}</span>;
}
