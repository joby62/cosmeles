import Link from "next/link";
import { fetchMobileCompareResult } from "@/lib/api";

export default async function MobileCompareResultPage({
  params,
}: {
  params: Promise<{ compareId: string }>;
}) {
  const { compareId } = await Promise.resolve(params);
  const result = await fetchMobileCompareResult(compareId);

  return (
    <section className="pb-12">
      <div className="text-[13px] font-medium text-black/45">专业对比 · 结论</div>
      <h1 className="mt-2 text-[30px] leading-[1.12] font-semibold tracking-[-0.02em] text-black/92">
        {result.verdict.headline}
      </h1>
      <p className="mt-2 text-[13px] leading-[1.5] text-black/60">
        决策：{decisionLabel(result.verdict.decision)} · 置信度 {Math.round(result.verdict.confidence * 100)}%
      </p>

      {result.transparency.warnings.length > 0 ? (
        <div className="mt-4 rounded-2xl border border-[#ffd28f]/45 bg-[#fff6e8] px-4 py-3 text-[13px] text-[#8b5a00]">
          {result.transparency.warnings.join(" ")}
        </div>
      ) : null}

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

      <article className="mt-5 rounded-2xl border border-black/10 bg-white px-4 py-4">
        <h2 className="text-[15px] font-semibold text-black/86">成分差异快照</h2>
        <div className="mt-2 text-[13px] leading-[1.55] text-black/68">
          共同成分 {result.ingredient_diff.overlap.length} 项 · 当前独有 {result.ingredient_diff.only_current.length} 项 · 首推独有{" "}
          {result.ingredient_diff.only_recommended.length} 项
        </div>
        {result.ingredient_diff.inci_order_diff.length > 0 ? (
          <div className="mt-2 text-[12px] leading-[1.55] text-black/60">
            排位差异（前{result.ingredient_diff.inci_order_diff.length}）：{" "}
            {result.ingredient_diff.inci_order_diff
              .slice(0, 4)
              .map((item) => `${item.ingredient}(${item.current_rank}/${item.recommended_rank})`)
              .join("，")}
          </div>
        ) : null}
      </article>

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
  if (value === "keep") return "继续用";
  if (value === "switch") return "建议替换";
  return "分场景并用";
}
