import Link from "next/link";
import { notFound } from "next/navigation";
import { isWikiCategoryKey, WIKI_MAP, WIKI_ORDER } from "@/lib/mobile/ingredientWiki";

type Params = { category: string };

export default async function WikiCategoryPage({
  params,
}: {
  params: Params | Promise<Params>;
}) {
  const raw = await Promise.resolve(params);
  const category = raw.category;

  if (!isWikiCategoryKey(category)) {
    notFound();
  }

  const current = WIKI_MAP[category];

  return (
    <section className="pb-10">
      <div className="text-[13px] font-medium text-black/45">成份百科 · {current.label}</div>
      <h1 className="mt-2 text-[30px] leading-[1.12] font-semibold tracking-[-0.02em] text-black/90">{current.label}常见成分作用</h1>
      <p className="mt-2 text-[15px] leading-[1.55] text-black/60">{current.summary}</p>

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
