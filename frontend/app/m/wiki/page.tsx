import Link from "next/link";
import { WIKI_MAP, WIKI_ORDER } from "@/lib/mobile/ingredientWiki";

export default function MobileWikiPage() {
  return (
    <section className="pb-10">
      <h1 className="text-[44px] leading-[1.04] font-semibold tracking-[-0.03em] text-black/92">成份百科</h1>

      <section className="mt-5">
        <div className="overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex min-w-max gap-2.5">
            {WIKI_ORDER.map((key) => {
              const item = WIKI_MAP[key];
              return (
                <Link
                  key={item.key}
                  href={`/m/wiki/${item.key}`}
                  className="inline-flex h-9 items-center gap-2 rounded-full border border-black/80 bg-black px-3 text-[13px] text-white"
                >
                  <img src={`/m/categories/${item.key}.png`} alt={item.label} className="h-5 w-5 rounded-full object-cover" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <section className="mt-12">
        <h2 className="slogan-breathe max-w-[12ch] text-[34px] leading-[1.1] font-semibold tracking-[-0.026em] text-black/92">
          浴室里的最终答案。
        </h2>
        <p className="mt-4 max-w-[18ch] text-[24px] leading-[1.38] font-normal tracking-[-0.01em] text-black/62">
          省下挑花眼的时间，只留最合适的一件。
        </p>
      </section>

      <section className="mt-10 space-y-3">
        {WIKI_ORDER.map((key) => {
          const item = WIKI_MAP[key];
          return (
            <Link
              key={item.key}
              href={`/m/wiki/${item.key}`}
              className="block rounded-2xl border border-black/10 bg-white px-4 py-4 active:bg-black/[0.03]"
            >
              <div className="text-[16px] font-semibold text-black/90">{item.label}</div>
              <p className="mt-1 text-[13px] leading-[1.5] text-black/58">{item.summary}</p>
            </Link>
          );
        })}
      </section>
    </section>
  );
}
