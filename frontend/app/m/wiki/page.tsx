"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { WIKI_MAP, WIKI_ORDER, type WikiCategoryKey } from "@/lib/mobile/ingredientWiki";
import { INGREDIENT_SHOWCASE_MAP } from "@/lib/mobile/ingredientShowcase";

function SearchIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className={className}>
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="2" />
      <path d="M16 16L21 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export default function MobileWikiPage() {
  const [active, setActive] = useState<WikiCategoryKey>("shampoo");
  const [query, setQuery] = useState("");
  const normalized = query.trim().toLowerCase();

  const cards = useMemo(() => {
    const source = INGREDIENT_SHOWCASE_MAP[active];
    if (!normalized) return source;
    return source.filter((item) => {
      const haystack = `${item.name} ${item.tagline} ${item.preview} ${item.heroLabel}`.toLowerCase();
      return haystack.includes(normalized);
    });
  }, [active, normalized]);

  return (
    <section className="pb-12">
      <form
        className="mt-1"
        onSubmit={(e) => {
          e.preventDefault();
        }}
      >
        <div className="flex h-12 overflow-hidden rounded-2xl border border-black/12 bg-white shadow-[0_1px_0_rgba(255,255,255,0.8)_inset,0_10px_22px_rgba(0,0,0,0.05)]">
          <label htmlFor="wiki-search" className="flex min-w-0 flex-1 items-center gap-2.5 px-4 text-black/45">
            <SearchIcon className="h-[18px] w-[18px]" />
            <input
              id="wiki-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索洗护成分"
              className="h-full w-full bg-transparent text-[16px] text-black/80 outline-none placeholder:text-black/35"
            />
          </label>
          <button
            type="submit"
            className="h-full shrink-0 border-l border-black/10 px-4 text-[16px] font-semibold text-black/78 active:bg-black/[0.03]"
          >
            搜索
          </button>
        </div>
      </form>

      <section className="mt-4 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex min-w-max gap-2.5">
          {WIKI_ORDER.map((key) => {
            const item = WIKI_MAP[key];
            const activeTag = key === active;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setActive(key)}
                className={`inline-flex h-9 items-center gap-2 rounded-full border px-3 text-[13px] transition-colors ${
                  activeTag
                    ? "border-black/85 bg-black text-white"
                    : "border-black/12 bg-white text-black/72 active:bg-black/[0.04]"
                }`}
              >
                <img src={`/m/categories/${item.key}.png`} alt={item.label} className="h-5 w-5 rounded-full object-cover" />
                {item.label}
              </button>
            );
          })}
        </div>
      </section>

      <section className="mt-5 space-y-4">
        {cards.map((item) => (
          <Link
            key={item.slug}
            href={`/m/wiki/${active}/${item.slug}`}
            className="block overflow-hidden rounded-[28px] border border-black/10 bg-white shadow-[0_14px_30px_rgba(0,0,0,0.06)] active:scale-[0.997]"
          >
            <div className={`${item.heroClassName} relative h-[292px] w-full`}>
              <div className="absolute inset-0 bg-[linear-gradient(175deg,rgba(255,255,255,0.1)_0%,rgba(255,255,255,0.0)_30%,rgba(0,0,0,0.18)_100%)]" />
              <div className="absolute left-5 top-5 rounded-full border border-white/55 bg-white/65 px-3 py-1 text-[12px] font-semibold tracking-[0.08em] text-black/58 backdrop-blur-sm">
                {item.heroLabel}
              </div>
              <div className="absolute bottom-5 left-5 right-5 text-white">
                <p className="text-[13px] font-medium tracking-[0.04em] text-white/85">{item.heroSub}</p>
                <h3 className="mt-1 text-[34px] leading-[1.06] font-semibold tracking-[-0.03em]">{item.name}</h3>
              </div>
            </div>

            <div className="px-5 py-5">
              <p className="text-[14px] font-medium text-black/52">{item.tagline}</p>
              <p className="mt-2 text-[26px] leading-[1.22] font-semibold tracking-[-0.025em] text-black/88">{item.preview}</p>
            </div>
          </Link>
        ))}

        {cards.length === 0 && (
          <div className="rounded-2xl border border-black/10 bg-white px-4 py-5 text-[14px] text-black/55">没有匹配到成分，换个关键词试试。</div>
        )}
      </section>
    </section>
  );
}
