import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchIngredientLibraryItem } from "@/lib/api";
import { isWikiCategoryKey, type WikiCategoryKey, WIKI_MAP } from "@/lib/mobile/ingredientWiki";

type Params = { category: string; slug: string };
const INGREDIENT_ID_PATTERN = /^ing-[a-f0-9]{20}$/;

type CategoryTheme = {
  heroClass: string;
  hazeClass: string;
};

const CATEGORY_THEME: Record<WikiCategoryKey, CategoryTheme> = {
  shampoo: {
    heroClass:
      "bg-[radial-gradient(circle_at_24%_20%,rgba(235,250,255,0.94),rgba(184,222,238,0.88)_44%,rgba(138,186,210,0.93)_100%)]",
    hazeClass: "bg-[radial-gradient(circle_at_70%_78%,rgba(18,55,86,0.46),rgba(10,20,36,0)_64%)]",
  },
  bodywash: {
    heroClass:
      "bg-[radial-gradient(circle_at_72%_20%,rgba(239,247,255,0.94),rgba(191,210,244,0.88)_42%,rgba(122,146,214,0.93)_100%)]",
    hazeClass: "bg-[radial-gradient(circle_at_20%_82%,rgba(32,41,98,0.44),rgba(10,20,36,0)_64%)]",
  },
  conditioner: {
    heroClass:
      "bg-[radial-gradient(circle_at_20%_18%,rgba(248,244,255,0.95),rgba(214,198,246,0.9)_44%,rgba(154,132,220,0.93)_100%)]",
    hazeClass: "bg-[radial-gradient(circle_at_70%_80%,rgba(56,24,102,0.46),rgba(10,20,36,0)_64%)]",
  },
  lotion: {
    heroClass:
      "bg-[radial-gradient(circle_at_26%_20%,rgba(255,248,232,0.95),rgba(245,219,170,0.9)_45%,rgba(217,167,95,0.93)_100%)]",
    hazeClass: "bg-[radial-gradient(circle_at_72%_82%,rgba(90,56,18,0.42),rgba(10,20,36,0)_64%)]",
  },
  cleanser: {
    heroClass:
      "bg-[radial-gradient(circle_at_26%_18%,rgba(241,252,255,0.95),rgba(187,223,236,0.89)_44%,rgba(117,176,205,0.93)_100%)]",
    hazeClass: "bg-[radial-gradient(circle_at_74%_82%,rgba(18,70,87,0.44),rgba(10,20,36,0)_64%)]",
  },
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
  const theme = CATEGORY_THEME[category];

  return (
    <section className="-mx-4 -mt-6 min-h-[calc(100dvh-3rem)] bg-[#0b0d12] pb-28 pt-4 text-white">
      <div className="px-4">
        <Link
          href="/m/wiki"
          className="inline-flex h-10 items-center rounded-full border border-white/16 bg-white/10 px-4 text-[13px] font-medium text-white/86 backdrop-blur-xl active:bg-white/15"
        >
          返回成份百科
        </Link>
      </div>

      <article className="mt-4 overflow-hidden rounded-[32px] border border-white/10 bg-[#121722] shadow-[0_28px_70px_rgba(0,0,0,0.48)]">
        <div className={`${theme.heroClass} relative h-[380px] w-full`}>
          <div className={`absolute inset-0 ${theme.hazeClass}`} />
          <div className="absolute inset-0 bg-[linear-gradient(176deg,rgba(255,255,255,0.16)_0%,rgba(255,255,255,0)_35%,rgba(0,0,0,0.36)_100%)]" />

          <div className="absolute left-5 top-5 rounded-full border border-white/35 bg-black/20 px-3 py-1 text-[12px] font-semibold tracking-[0.03em] text-white/92 backdrop-blur-xl">
            {item.ingredient_id}
          </div>

          <div className="absolute left-5 top-16 rounded-full border border-white/35 bg-white/12 px-2.5 py-0.5 text-[12px] font-medium text-white/88 backdrop-blur-lg">
            {categoryLabel}
          </div>

          <div className="absolute bottom-6 left-5 right-5">
            <p className="text-[13px] font-medium tracking-[0.04em] text-white/84">成分详情</p>
            <h1 className="mt-1 text-[44px] leading-[0.98] font-semibold tracking-[-0.04em] text-white">{item.ingredient_name}</h1>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-px border-t border-white/10 bg-white/10 text-center">
          <div className="bg-black/28 px-2 py-3 backdrop-blur-xl">
            <p className="text-[11px] text-white/55">来源样本</p>
            <p className="mt-1 text-[18px] font-semibold text-white">{item.source_count}</p>
          </div>
          <div className="bg-black/28 px-2 py-3 backdrop-blur-xl">
            <p className="text-[11px] text-white/55">置信度</p>
            <p className="mt-1 text-[18px] font-semibold text-white">{profile.confidence}</p>
          </div>
          <div className="bg-black/28 px-2 py-3 backdrop-blur-xl">
            <p className="text-[11px] text-white/55">分类</p>
            <p className="mt-1 text-[16px] font-semibold text-white">{categoryLabel}</p>
          </div>
        </div>
      </article>

      <div className="mt-5 space-y-3 px-4">
        <section className="rounded-[24px] border border-white/10 bg-white/[0.05] p-4 backdrop-blur-xl">
          <p className="text-[12px] font-medium tracking-[0.04em] text-[#4ea0ff]">核心摘要</p>
          <p className="mt-2 text-[25px] leading-[1.35] tracking-[-0.015em] text-white/92">
            {profile.summary || "该成分暂无 AI 摘要，请检查后端构建日志。"}
          </p>
        </section>

        <section className="grid gap-3">
          <Panel title="主要收益" items={profile.benefits} emptyText="暂无收益描述。" />
          <Panel title="潜在风险" items={profile.risks} emptyText="暂无风险描述。" />
          <Panel title="使用建议" items={profile.usage_tips} emptyText="暂无使用建议。" />
        </section>

        <section className="grid grid-cols-1 gap-3">
          <InfoRow title="更适合" value={profile.suitable_for.join("；") || "暂无数据"} />
          <InfoRow title="需规避" value={profile.avoid_for.join("；") || "暂无数据"} />
          <InfoRow title="模型结论依据" value={profile.reason || "未提供"} />
        </section>

        {item.source_samples.length > 0 && (
          <section className="pt-1">
            <h2 className="text-[16px] font-semibold text-white/92">来源样本</h2>
            <div className="mt-3 space-y-2.5">
              {item.source_samples.slice(0, 5).map((sample) => (
                <div key={`${sample.trace_id}-${sample.name}`} className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 backdrop-blur-xl">
                  <div className="text-[13px] font-medium text-white/82">
                    {sample.brand || "未知品牌"} · {sample.name || "未知产品"}
                  </div>
                  <div className="mt-1 text-[12px] text-white/52">trace_id: {sample.trace_id || "n/a"}</div>
                  <p className="mt-2 text-[13px] leading-[1.55] text-white/68">{sample.one_sentence || "无一句话描述"}</p>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </section>
  );
}

function Panel({ title, items, emptyText }: { title: string; items: string[]; emptyText: string }) {
  return (
    <section className="rounded-[22px] border border-white/10 bg-white/[0.04] px-4 py-4 backdrop-blur-xl">
      <h3 className="text-[15px] font-semibold text-white/90">{title}</h3>
      {items.length > 0 ? (
        <ul className="mt-2 space-y-2">
          {items.map((line) => (
            <li key={line} className="text-[14px] leading-[1.55] text-white/75">
              {line}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-[14px] text-white/52">{emptyText}</p>
      )}
    </section>
  );
}

function InfoRow({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-[20px] border border-white/10 bg-white/[0.04] px-4 py-3 backdrop-blur-xl">
      <p className="text-[12px] font-medium text-white/55">{title}</p>
      <p className="mt-1 text-[14px] leading-[1.55] text-white/78">{value}</p>
    </div>
  );
}
