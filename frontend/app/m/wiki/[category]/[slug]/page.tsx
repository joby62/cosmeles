import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchIngredientLibraryItem } from "@/lib/api";
import { isWikiCategoryKey, type WikiCategoryKey, WIKI_MAP } from "@/lib/mobile/ingredientWiki";

type Params = { category: string; slug: string };
const INGREDIENT_ID_PATTERN = /^ing-[a-f0-9]{20}$/;

const CATEGORY_HERO_CLASS: Record<WikiCategoryKey, string> = {
  shampoo: "bg-[radial-gradient(circle_at_28%_22%,rgba(236,250,255,0.96),rgba(199,231,245,0.9)_42%,rgba(168,206,223,0.9)_72%,rgba(145,187,208,0.95)_100%)]",
  bodywash: "bg-[radial-gradient(circle_at_76%_18%,rgba(239,247,255,0.98),rgba(208,225,244,0.92)_45%,rgba(174,197,231,0.9)_74%,rgba(145,171,214,0.95)_100%)]",
  conditioner: "bg-[radial-gradient(circle_at_30%_14%,rgba(247,244,255,0.98),rgba(222,213,246,0.92)_44%,rgba(193,179,236,0.9)_74%,rgba(162,147,221,0.95)_100%)]",
  lotion: "bg-[radial-gradient(circle_at_20%_20%,rgba(255,250,238,0.98),rgba(248,232,202,0.93)_46%,rgba(238,211,168,0.9)_74%,rgba(220,189,144,0.95)_100%)]",
  cleanser: "bg-[radial-gradient(circle_at_26%_18%,rgba(241,252,255,0.99),rgba(210,235,244,0.92)_44%,rgba(175,211,227,0.9)_74%,rgba(145,189,209,0.95)_100%)]",
};

export default async function IngredientDetailPage({
  params,
}: {
  params: Params | Promise<Params>;
}) {
  const raw = await Promise.resolve(params);

  if (!isWikiCategoryKey(raw.category)) {
    notFound();
  }

  const category = raw.category;
  const ingredientId = raw.slug.trim().toLowerCase();
  if (!INGREDIENT_ID_PATTERN.test(ingredientId)) {
    notFound();
  }
  let detail;
  try {
    detail = await fetchIngredientLibraryItem(category, ingredientId);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (message.startsWith("API 404")) {
      notFound();
    }
    throw e;
  }

  const item = detail.item;
  const profile = item.profile;
  const categoryLabel = WIKI_MAP[category].label;

  return (
    <section className="pb-10">
      <Link
        href="/m/wiki"
        className="inline-flex h-9 items-center rounded-full border border-black/12 bg-white px-3.5 text-[13px] font-medium text-black/70 active:bg-black/[0.03]"
      >
        返回成份百科
      </Link>

      <article className="mt-4 overflow-hidden rounded-[28px] border border-black/10 bg-white shadow-[0_14px_30px_rgba(0,0,0,0.06)]">
        <div className={`${CATEGORY_HERO_CLASS[category]} relative h-[280px] w-full`}>
          <div className="absolute inset-0 bg-[linear-gradient(178deg,rgba(255,255,255,0.08)_0%,rgba(255,255,255,0.0)_30%,rgba(0,0,0,0.2)_100%)]" />
          <div className="absolute left-5 top-5 rounded-full border border-white/55 bg-white/65 px-3 py-1 text-[12px] font-semibold tracking-[0.04em] text-black/62 backdrop-blur-sm">
            {item.ingredient_id}
          </div>
          <div className="absolute bottom-5 left-5 right-5 text-white">
            <p className="text-[13px] font-medium tracking-[0.04em] text-white/85">{categoryLabel}</p>
            <h1 className="mt-1 text-[34px] leading-[1.05] font-semibold tracking-[-0.03em]">{item.ingredient_name}</h1>
          </div>
        </div>

        <div className="px-5 py-6">
          <section className="rounded-2xl bg-black/[0.03] px-4 py-4">
            <h2 className="text-[16px] font-semibold text-black/86">核心摘要</h2>
            <p className="mt-2 text-[15px] leading-[1.65] text-black/74">
              {profile.summary || "该成分暂无 AI 摘要，请检查后端构建日志。"}
            </p>
          </section>

          <section className="mt-6 grid gap-3">
            <div className="rounded-2xl border border-black/10 bg-white px-4 py-4">
              <h3 className="text-[15px] font-semibold text-black/86">主要收益</h3>
              <ul className="mt-2 space-y-1.5">
                {profile.benefits.map((line) => (
                  <li key={line} className="text-[14px] leading-[1.55] text-black/74">
                    {line}
                  </li>
                ))}
              </ul>
              {profile.benefits.length === 0 && <p className="mt-2 text-[14px] text-black/50">暂无收益描述。</p>}
            </div>

            <div className="rounded-2xl border border-black/10 bg-white px-4 py-4">
              <h3 className="text-[15px] font-semibold text-black/86">潜在风险</h3>
              <ul className="mt-2 space-y-1.5">
                {profile.risks.map((line) => (
                  <li key={line} className="text-[14px] leading-[1.55] text-black/74">
                    {line}
                  </li>
                ))}
              </ul>
              {profile.risks.length === 0 && <p className="mt-2 text-[14px] text-black/50">暂无风险描述。</p>}
            </div>

            <div className="rounded-2xl border border-black/10 bg-white px-4 py-4">
              <h3 className="text-[15px] font-semibold text-black/86">使用建议</h3>
              <ul className="mt-2 space-y-1.5">
                {profile.usage_tips.map((line) => (
                  <li key={line} className="text-[14px] leading-[1.55] text-black/74">
                    {line}
                  </li>
                ))}
              </ul>
              {profile.usage_tips.length === 0 && <p className="mt-2 text-[14px] text-black/50">暂无使用建议。</p>}
            </div>
          </section>

          <section className="mt-6 space-y-2">
            <div className="rounded-2xl bg-black/[0.03] px-4 py-3 text-[14px] leading-[1.6] text-black/72">
              <span className="font-semibold text-black/82">更适合：</span>
              {profile.suitable_for.join("；") || "暂无数据"}
            </div>
            <div className="rounded-2xl bg-black/[0.03] px-4 py-3 text-[14px] leading-[1.6] text-black/72">
              <span className="font-semibold text-black/82">需规避：</span>
              {profile.avoid_for.join("；") || "暂无数据"}
            </div>
            <div className="rounded-2xl bg-black/[0.03] px-4 py-3 text-[14px] leading-[1.6] text-black/72">
              <span className="font-semibold text-black/82">置信度：</span>
              {profile.confidence}
            </div>
            <div className="rounded-2xl bg-black/[0.03] px-4 py-3 text-[14px] leading-[1.6] text-black/72">
              <span className="font-semibold text-black/82">来源样本：</span>
              {item.source_count} 条
            </div>
            <div className="rounded-2xl bg-black/[0.03] px-4 py-3 text-[14px] leading-[1.6] text-black/72">
              <span className="font-semibold text-black/82">模型结论依据：</span>
              {profile.reason || "未提供"}
            </div>
          </section>

          {item.source_samples.length > 0 && (
            <section className="mt-6">
              <h2 className="text-[16px] font-semibold text-black/86">来源样本</h2>
              <div className="mt-3 space-y-2">
                {item.source_samples.slice(0, 5).map((sample) => (
                  <div key={`${sample.trace_id}-${sample.name}`} className="rounded-2xl border border-black/10 bg-white px-4 py-3">
                    <div className="text-[13px] font-medium text-black/72">{sample.brand || "未知品牌"} · {sample.name || "未知产品"}</div>
                    <div className="mt-1 text-[12px] text-black/48">trace_id: {sample.trace_id || "n/a"}</div>
                    <p className="mt-2 text-[13px] leading-[1.55] text-black/62">{sample.one_sentence || "无一句话描述"}</p>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </article>
    </section>
  );
}
