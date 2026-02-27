import Link from "next/link";
import { notFound } from "next/navigation";
import { getIngredientShowcaseBySlug } from "@/lib/mobile/ingredientShowcase";
import { isWikiCategoryKey, WIKI_MAP } from "@/lib/mobile/ingredientWiki";

type Params = { category: string; slug: string };

export default async function IngredientDetailPage({
  params,
}: {
  params: Params | Promise<Params>;
}) {
  const raw = await Promise.resolve(params);

  if (!isWikiCategoryKey(raw.category)) {
    notFound();
  }

  const item = getIngredientShowcaseBySlug(raw.category, raw.slug);
  if (!item) {
    notFound();
  }

  const categoryLabel = WIKI_MAP[raw.category].label;

  return (
    <section className="pb-10">
      <Link
        href="/m/wiki"
        className="inline-flex h-9 items-center rounded-full border border-black/12 bg-white px-3.5 text-[13px] font-medium text-black/70 active:bg-black/[0.03]"
      >
        返回成份百科
      </Link>

      <article className="mt-4 overflow-hidden rounded-[28px] border border-black/10 bg-white shadow-[0_14px_30px_rgba(0,0,0,0.06)]">
        <div className={`${item.heroClassName} relative h-[320px] w-full`}>
          <div className="absolute inset-0 bg-[linear-gradient(178deg,rgba(255,255,255,0.08)_0%,rgba(255,255,255,0.0)_30%,rgba(0,0,0,0.2)_100%)]" />
          <div className="absolute left-5 top-5 rounded-full border border-white/55 bg-white/65 px-3 py-1 text-[12px] font-semibold tracking-[0.08em] text-black/58 backdrop-blur-sm">
            {item.heroLabel}
          </div>
          <div className="absolute bottom-5 left-5 right-5 text-white">
            <p className="text-[13px] font-medium tracking-[0.04em] text-white/85">{categoryLabel}</p>
            <h1 className="mt-1 text-[36px] leading-[1.04] font-semibold tracking-[-0.03em]">{item.name}</h1>
          </div>
        </div>

        <div className="px-5 py-6">
          <p className="text-[14px] font-medium text-black/52">{item.tagline}</p>
          <p className="mt-2 text-[17px] leading-[1.65] text-black/76">{item.why}</p>

          <section className="mt-6">
            <h2 className="text-[19px] font-semibold text-black/88">作用机制</h2>
            <ul className="mt-3 space-y-2">
              {item.mechanism.map((line) => (
                <li key={line} className="text-[15px] leading-[1.65] text-black/72">
                  {line}
                </li>
              ))}
            </ul>
          </section>

          <section className="mt-6 space-y-2">
            <div className="rounded-2xl bg-black/[0.03] px-4 py-3 text-[14px] leading-[1.6] text-black/72">
              <span className="font-semibold text-black/82">更适合：</span>
              {item.fit}
            </div>
            <div className="rounded-2xl bg-black/[0.03] px-4 py-3 text-[14px] leading-[1.6] text-black/72">
              <span className="font-semibold text-black/82">注意：</span>
              {item.caution}
            </div>
            <div className="rounded-2xl bg-black/[0.03] px-4 py-3 text-[14px] leading-[1.6] text-black/72">
              <span className="font-semibold text-black/82">用法建议：</span>
              {item.usage}
            </div>
          </section>
        </div>
      </article>
    </section>
  );
}
