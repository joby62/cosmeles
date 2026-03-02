import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
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
      "bg-[radial-gradient(circle_at_24%_20%,rgba(235,250,255,0.94),rgba(184,222,238,0.88)_44%,rgba(138,186,210,0.93)_100%)]",
    hazeClass: "bg-[radial-gradient(circle_at_70%_78%,rgba(18,55,86,0.44),rgba(10,20,36,0)_64%)]",
    accentClass: "bg-[#8fd3f2]",
  },
  bodywash: {
    heroClass:
      "bg-[radial-gradient(circle_at_72%_20%,rgba(239,247,255,0.94),rgba(191,210,244,0.88)_42%,rgba(122,146,214,0.93)_100%)]",
    hazeClass: "bg-[radial-gradient(circle_at_20%_82%,rgba(32,41,98,0.42),rgba(10,20,36,0)_64%)]",
    accentClass: "bg-[#9fb5ff]",
  },
  conditioner: {
    heroClass:
      "bg-[radial-gradient(circle_at_20%_18%,rgba(248,244,255,0.95),rgba(214,198,246,0.9)_44%,rgba(154,132,220,0.93)_100%)]",
    hazeClass: "bg-[radial-gradient(circle_at_70%_80%,rgba(56,24,102,0.44),rgba(10,20,36,0)_64%)]",
    accentClass: "bg-[#bea1ff]",
  },
  lotion: {
    heroClass:
      "bg-[radial-gradient(circle_at_26%_20%,rgba(255,248,232,0.95),rgba(245,219,170,0.9)_45%,rgba(217,167,95,0.93)_100%)]",
    hazeClass: "bg-[radial-gradient(circle_at_72%_82%,rgba(90,56,18,0.4),rgba(10,20,36,0)_64%)]",
    accentClass: "bg-[#e7bd72]",
  },
  cleanser: {
    heroClass:
      "bg-[radial-gradient(circle_at_26%_18%,rgba(241,252,255,0.95),rgba(187,223,236,0.89)_44%,rgba(117,176,205,0.93)_100%)]",
    hazeClass: "bg-[radial-gradient(circle_at_74%_82%,rgba(18,70,87,0.42),rgba(10,20,36,0)_64%)]",
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
  "deep-repair": {
    title: "深度修护型",
    hint: "你本次结果优先看“结构修护 + 补脂封片”。",
    ingredients: ["水解角蛋白", "18-MEA", "聚季铵盐-10", "神经酰胺", "植物油脂"],
  },
  "volume-support": {
    title: "蓬松支撑型",
    hint: "你本次结果优先看“无硅减负 + 发根支撑”。",
    ingredients: ["咖啡因", "水解小麦蛋白", "海盐", "生物素", "无硅油体系"],
  },
};

type NameParts = {
  main: string;
  sub: string | null;
};

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

function queryValue(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function WikiCategoryPage({
  params,
  searchParams,
}: {
  params: Params | Promise<Params>;
  searchParams?: Search | Promise<Search>;
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
  const focus = current.key === "shampoo" && focusKey ? SHAMPOO_FOCUS_MAP[focusKey] : undefined;
  const query = queryValue(search.q);
  const library = await fetchIngredientLibrary({
    category,
    q: query,
    limit: 200,
  });

  return (
    <section className="-mx-4 -mt-6 min-h-[calc(100dvh-3rem)] bg-[#0b0d12] px-4 pb-32 pt-4 text-white">
      <div className="mb-4">
        <p className="text-[13px] font-medium text-[#4ea0ff]">成份百科</p>
        <h1 className="mt-1 text-[34px] leading-[1.08] font-semibold tracking-[-0.03em]">{current.label}</h1>
        <p className="mt-1 text-[15px] leading-[1.5] text-white/66">{current.summary}</p>
      </div>

      {focus && (
        <article className="mb-4 rounded-[24px] border border-white/12 bg-white/[0.05] px-4 py-4 backdrop-blur-xl">
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
                className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12px] ${
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
          return (
            <Link
              key={item.ingredient_id}
              href={`/m/wiki/${category}/${item.ingredient_id}`}
              className="block overflow-hidden rounded-[30px] border border-white/10 bg-[#121722] shadow-[0_20px_44px_rgba(0,0,0,0.36)] transition-transform active:scale-[0.997]"
            >
              <div className={`${theme.heroClass} relative h-[208px] w-full`}>
                <div className={`absolute inset-0 ${theme.hazeClass}`} />
                <div className={`absolute right-[-44px] top-[-30px] h-[130px] w-[130px] rounded-full ${theme.accentClass} opacity-32 blur-3xl`} />
                <div className="absolute inset-0 bg-[linear-gradient(178deg,rgba(255,255,255,0.15)_0%,rgba(255,255,255,0)_32%,rgba(0,0,0,0.36)_100%)]" />

                <div className="absolute left-4 top-4 rounded-full border border-white/30 bg-white/10 px-2.5 py-0.5 text-[11px] font-medium text-white/82 backdrop-blur-md">
                  {current.label}
                </div>

                <div className="absolute bottom-4 left-4 right-4">
                  <h2 className="line-clamp-2 break-words text-[30px] leading-[1.05] font-semibold tracking-[-0.03em] text-white">
                    {name.main}
                  </h2>
                  {name.sub ? <p className="mt-1 line-clamp-1 text-[18px] leading-[1.08] font-semibold tracking-[-0.015em] text-white/94">{name.sub}</p> : null}
                </div>
              </div>

              <div className="px-4 py-4">
                <p className="line-clamp-2 text-[15px] leading-[1.55] text-white/76">
                  {item.summary || "该成分暂无 AI 摘要，请检查成分库构建流程。"}
                </p>
                <p className="mt-2 text-[12px] text-white/54">来源样本：{item.source_count} 条</p>
              </div>
            </Link>
          );
        })}

        {library.items.length === 0 && (
          <article className="rounded-[24px] border border-white/10 bg-white/[0.05] px-4 py-5 text-[14px] leading-[1.6] text-white/65">
            当前分类暂无已生成成分，请先在后台执行成分库构建。
          </article>
        )}
      </div>

      <div className="mt-8">
        <Link
          href={`/m/${current.key}/start`}
          className="inline-flex h-11 items-center justify-center rounded-full border border-white/20 bg-white/[0.07] px-5 text-[15px] font-semibold text-white/90 backdrop-blur-xl active:bg-white/[0.12]"
        >
          进入{current.label}挑选
        </Link>
      </div>
    </section>
  );
}
