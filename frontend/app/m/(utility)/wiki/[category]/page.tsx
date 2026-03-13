import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import MobileEventBeacon from "@/components/mobile/MobileEventBeacon";
import MobileTrackedLink from "@/components/mobile/MobileTrackedLink";
import { fetchIngredientLibrary } from "@/lib/api";
import { isWikiCategoryKey, WIKI_MAP, WIKI_ORDER, type WikiCategoryKey } from "@/lib/mobile/ingredientWiki";

type Params = { category: string };
type Search = Record<string, string | string[] | undefined>;

type ShampooFocus = {
  title: string;
  hint: string;
  ingredients: string[];
};

type CategoryTheme = {
  heroClass: string;
  hazeClass: string;
  accentClass: string;
};

const CATEGORY_THEME: Record<WikiCategoryKey, CategoryTheme> = {
  shampoo: {
    heroClass:
      "bg-[radial-gradient(circle_at_25%_18%,rgba(235,250,255,0.96),rgba(186,222,238,0.9)_45%,rgba(133,181,206,0.94)_100%)]",
    hazeClass: "bg-[radial-gradient(circle_at_70%_80%,rgba(16,53,80,0.42),rgba(10,20,36,0)_64%)]",
    accentClass: "bg-[#8fd3f2]",
  },
  bodywash: {
    heroClass:
      "bg-[radial-gradient(circle_at_70%_18%,rgba(242,248,255,0.96),rgba(194,211,246,0.9)_44%,rgba(121,143,210,0.94)_100%)]",
    hazeClass: "bg-[radial-gradient(circle_at_22%_82%,rgba(28,38,92,0.42),rgba(10,20,36,0)_64%)]",
    accentClass: "bg-[#9fb5ff]",
  },
  conditioner: {
    heroClass:
      "bg-[radial-gradient(circle_at_24%_16%,rgba(248,244,255,0.97),rgba(214,198,245,0.91)_44%,rgba(152,129,216,0.94)_100%)]",
    hazeClass: "bg-[radial-gradient(circle_at_72%_82%,rgba(56,24,102,0.42),rgba(10,20,36,0)_64%)]",
    accentClass: "bg-[#bea1ff]",
  },
  lotion: {
    heroClass:
      "bg-[radial-gradient(circle_at_24%_18%,rgba(255,248,232,0.97),rgba(246,220,173,0.91)_44%,rgba(217,168,96,0.94)_100%)]",
    hazeClass: "bg-[radial-gradient(circle_at_70%_82%,rgba(90,56,18,0.4),rgba(10,20,36,0)_64%)]",
    accentClass: "bg-[#e7bd72]",
  },
  cleanser: {
    heroClass:
      "bg-[radial-gradient(circle_at_24%_18%,rgba(242,252,255,0.97),rgba(189,223,236,0.9)_44%,rgba(117,176,203,0.94)_100%)]",
    hazeClass: "bg-[radial-gradient(circle_at_72%_82%,rgba(16,66,84,0.42),rgba(10,20,36,0)_64%)]",
    accentClass: "bg-[#87c7dd]",
  },
};

const SHAMPOO_FOCUS_MAP: Record<string, ShampooFocus> = {
  "deep-oil-control": {
    title: "深层控油型",
    hint: "你本次结果优先看“控油抑脂 + 毛囊疏通”。",
    ingredients: ["PCA 锌", "葡萄糖酸锌", "水杨酸", "月桂酰肌氨酸钠", "C14-16 烯烃磺酸钠"],
  },
  "anti-dandruff-itch": {
    title: "去屑止痒型",
    hint: "你本次结果优先看“抗真菌 + 止痒接触时间”。",
    ingredients: ["吡罗克酮乙醇胺盐（OCT）", "吡硫鎓锌（ZPT）", "水杨酸", "薄荷醇"],
  },
  "gentle-soothing": {
    title: "温和舒缓型",
    hint: "你本次结果优先看“低刺激清洁 + 屏障修护”。",
    ingredients: ["APG（烷基糖苷）", "氨基酸表活", "红没药醇", "积雪草提取物", "泛醇（B5）"],
  },
  "anti-hair-loss": {
    title: "防脱强韧型",
    hint: "你本次结果优先看“发根强韧 + 头皮微循环支持”。",
    ingredients: ["咖啡因", "生物素", "烟酰胺", "锌 PCA", "多肽复配"],
  },
  "moisture-balance": {
    title: "水油平衡型",
    hint: "你本次结果优先看“保湿舒适 + 轻负担维稳”。",
    ingredients: ["泛醇（B5）", "神经酰胺", "甜菜碱", "甘油", "温和表活体系"],
  },
};

type NameParts = {
  main: string;
  sub: string | null;
};

function normalizeLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function splitIngredientName(raw: string): NameParts {
  const text = raw.trim();
  const idx = text.indexOf("(");
  if (idx <= 0) {
    return { main: text, sub: null };
  }
  return {
    main: text.slice(0, idx).trim(),
    sub: text.slice(idx).trim() || null,
  };
}

function summaryFocus(summary: string | null | undefined): string {
  const text = normalizeLine(summary || "");
  if (!text) return "暂无关键结论";
  const first = text.split(/[。！？!?.]/).map((part) => part.trim()).find(Boolean) || text;
  return first.length > 24 ? `${first.slice(0, 23)}…` : first;
}

function queryValue(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function WikiCategoryPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams?: Promise<Search>;
}) {
  const raw = await Promise.resolve(params);
  const search = (await Promise.resolve(searchParams)) || {};
  const category = raw.category;

  if (!isWikiCategoryKey(category)) {
    notFound();
  }

  const current = WIKI_MAP[category];
  const theme = CATEGORY_THEME[category];
  const focusKey = queryValue(search.focus);
  const resultCta = queryValue(search.result_cta);
  const fromCompareId = queryValue(search.from_compare_id);
  const focus = current.key === "shampoo" && focusKey ? SHAMPOO_FOCUS_MAP[focusKey] : undefined;
  const query = queryValue(search.q);
  const returnQuery = new URLSearchParams();
  if (focusKey) returnQuery.set("focus", focusKey);
  if (query) returnQuery.set("q", query);
  const returnTo = returnQuery.toString() ? `/m/wiki/${category}?${returnQuery.toString()}` : `/m/wiki/${category}`;
  const library = await fetchIngredientLibrary({
    category,
    q: query,
    limit: 200,
  });

  return (
    <section className="m-wiki-page -mx-4 -mt-6 min-h-[calc(100dvh-3rem)] bg-[color:var(--m-wiki-canvas)] px-4 pb-36 pt-4 text-white">
      {resultCta && fromCompareId ? (
        <MobileEventBeacon
          name="compare_result_cta_land"
          props={{
            page: "wiki_category",
            route: `/m/wiki/${category}`,
            source: "m_compare_result",
            category,
            compare_id: fromCompareId,
            cta: resultCta,
          }}
        />
      ) : null}
      <div className="mb-4">
        <p className="m-wiki-kicker text-[13px] text-[#4ea0ff]">成份百科</p>
        <h1 data-m-large-title={current.label} className="mt-1 text-[34px] leading-[1.08] font-semibold tracking-[-0.03em]">{current.label}</h1>
        <p className="mt-1 text-[15px] leading-[1.5] text-white/66">{current.summary}</p>
      </div>

      {focus && (
        <article className="m-wiki-card mb-4 rounded-[24px] px-4 py-4 backdrop-blur-xl">
          <h2 className="text-[16px] font-semibold text-white/92">来自结果卡：{focus.title}</h2>
          <p className="mt-2 text-[14px] leading-[1.55] text-white/72">{focus.hint}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {focus.ingredients.map((name) => (
              <span key={name} className="inline-flex h-7 items-center rounded-full border border-white/12 bg-white/[0.05] px-3 text-[12px] text-white/78">
                {name}
              </span>
            ))}
          </div>
        </article>
      )}

      <div className="mb-4 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex min-w-max gap-2">
          {WIKI_ORDER.map((key) => {
            const item = WIKI_MAP[key];
            const active = item.key === current.key;
            return (
              <Link
                key={item.key}
                href={`/m/wiki/${item.key}`}
                className={`m-pressable inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12px] ${
                  active
                    ? "border-white/35 bg-white/16 text-white"
                    : "border-white/12 bg-white/[0.03] text-white/72 active:bg-white/[0.09]"
                }`}
              >
                <Image src={`/m/categories/${item.key}.png`} alt={item.label} width={18} height={18} className="h-[18px] w-[18px] rounded-full object-cover" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>

      <div className="space-y-4">
        {library.items.map((item) => {
          const name = splitIngredientName(item.ingredient_name);
          const ingredientHref = `/m/wiki/${category}/${item.ingredient_id}?return_to=${encodeURIComponent(returnTo)}`;
          return (
            <MobileTrackedLink
              key={item.ingredient_id}
              href={ingredientHref}
              eventName="wiki_category_ingredient_click"
              eventProps={{
                page: "wiki_category",
                route: `/m/wiki/${category}`,
                source: "wiki_category",
                category,
                target_path: ingredientHref,
                ingredient_id: item.ingredient_id,
                result_cta: resultCta || undefined,
                from_compare_id: fromCompareId || undefined,
              }}
              className="m-wiki-hero-card m-pressable block overflow-hidden rounded-[28px] transition-transform active:scale-[0.997]"
            >
              <div className={`${theme.heroClass} relative h-[164px] w-full`}>
                <div className={`absolute inset-0 ${theme.hazeClass}`} />
                <div className={`absolute right-[-30px] top-[-26px] h-[120px] w-[120px] rounded-full ${theme.accentClass} opacity-30 blur-3xl`} />
                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.13)_0%,rgba(255,255,255,0)_28%,rgba(0,0,0,0.4)_100%)]" />

                <Image
                  src={`/m/categories/${category}.png`}
                  alt={current.label}
                  width={64}
                  height={64}
                  className="absolute right-4 top-3 h-12 w-12 rounded-2xl object-cover opacity-78 ring-1 ring-white/22"
                />

                <div className="absolute left-4 top-4 rounded-full border border-white/30 bg-white/10 px-2.5 py-0.5 text-[11px] font-medium text-white/82 backdrop-blur-md">
                  {current.label}
                </div>

                <div className="absolute bottom-3 left-4 right-4">
                  <h2 className="line-clamp-2 break-words text-[26px] leading-[1.08] font-semibold tracking-[-0.02em] text-white">{name.main}</h2>
                  {name.sub ? <p className="mt-0.5 line-clamp-1 text-[15px] leading-[1.15] font-medium text-white/90">{name.sub}</p> : null}
                </div>
              </div>

              <div className="px-4 py-3">
                <p className="m-wiki-kicker text-[11px] text-white/54">一句话重点</p>
                <p className="mt-1 line-clamp-1 text-[15px] font-semibold text-white/88">{summaryFocus(item.summary)}</p>
                <p className="mt-1.5 text-[12px] text-white/56">来源样本 {item.source_count} 条</p>
              </div>
            </MobileTrackedLink>
          );
        })}

        {library.items.length === 0 && (
          <article className="m-wiki-card-soft rounded-[24px] px-4 py-5 text-[14px] leading-[1.6] text-white/65">
            当前分类暂无已生成成分，请先在后台执行成分库构建。
          </article>
        )}
      </div>

      <div className="mt-8">
        <MobileTrackedLink
          href={`/m/${current.key}/profile?step=1`}
          eventName="wiki_category_choose_click"
          eventProps={{
            page: "wiki_category",
            route: `/m/wiki/${category}`,
            source: "wiki_category",
            category,
            target_path: `/m/${current.key}/profile?step=1`,
            result_cta: resultCta || undefined,
            from_compare_id: fromCompareId || undefined,
          }}
          className="m-pressable inline-flex h-11 items-center justify-center rounded-full border border-white/20 bg-white/[0.07] px-5 text-[15px] font-semibold text-white/90 backdrop-blur-xl active:bg-white/[0.12]"
        >
          进入{current.label}挑选
        </MobileTrackedLink>
      </div>
    </section>
  );
}
