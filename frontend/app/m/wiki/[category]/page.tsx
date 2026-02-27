import Link from "next/link";
import { notFound } from "next/navigation";
import { isWikiCategoryKey, WIKI_MAP, WIKI_ORDER } from "@/lib/mobile/ingredientWiki";

type Params = { category: string };
type Search = Record<string, string | string[] | undefined>;

type ShampooFocus = {
  title: string;
  hint: string;
  ingredients: string[];
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
  const focusKey = queryValue(search.focus);
  const focus = current.key === "shampoo" && focusKey ? SHAMPOO_FOCUS_MAP[focusKey] : undefined;

  return (
    <section className="pb-10">
      <div className="text-[13px] font-medium text-black/45">成份百科 · {current.label}</div>
      <h1 className="mt-2 text-[30px] leading-[1.12] font-semibold tracking-[-0.02em] text-black/90">{current.label}常见成分作用</h1>
      <p className="mt-2 text-[15px] leading-[1.55] text-black/60">{current.summary}</p>

      {focus && (
        <article className="mt-5 rounded-2xl border border-black/10 bg-white px-4 py-4">
          <h2 className="text-[16px] font-semibold text-black/88">来自结果卡：{focus.title}</h2>
          <p className="mt-2 text-[14px] leading-[1.55] text-black/72">{focus.hint}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {focus.ingredients.map((name) => (
              <span
                key={name}
                className="inline-flex h-7 items-center rounded-full border border-black/10 bg-black/[0.03] px-3 text-[12px] text-black/72"
              >
                {name}
              </span>
            ))}
          </div>
        </article>
      )}

      <div className="mt-5 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex min-w-max gap-2.5">
          {WIKI_ORDER.map((key) => {
            const item = WIKI_MAP[key];
            const active = item.key === current.key;
            return (
              <Link
                key={item.key}
                href={`/m/wiki/${item.key}`}
                className={`inline-flex h-9 items-center gap-2 rounded-full px-3 text-[13px] ${
                  active ? "border border-black/80 bg-black text-white" : "border border-black/10 bg-white text-black/72"
                }`}
              >
                <img src={`/m/categories/${item.key}.png`} alt={item.label} className="h-5 w-5 rounded-full object-cover" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>

      <div className="mt-7 space-y-3">
        {current.items.map((item) => (
          <article key={item.name} className="rounded-2xl border border-black/10 bg-white px-4 py-4">
            <h2 className="text-[16px] font-semibold text-black/88">{item.name}</h2>
            <p className="mt-2 text-[14px] leading-[1.5] text-black/72">作用：{item.effect}</p>
            <p className="mt-1 text-[14px] leading-[1.5] text-black/72">更适合：{item.fit}</p>
            <p className="mt-1 text-[13px] leading-[1.5] text-black/55">注意：{item.caution}</p>
          </article>
        ))}
      </div>

      <div className="mt-8">
        <Link
          href={`/m/${current.key}/start`}
          className="inline-flex h-11 items-center justify-center rounded-full border border-black/15 px-5 text-[15px] font-semibold text-black/80 active:bg-black/[0.03]"
        >
          进入{current.label}挑选
        </Link>
      </div>
    </section>
  );
}
