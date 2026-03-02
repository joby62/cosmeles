"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchIngredientLibrary, type IngredientLibraryListItem } from "@/lib/api";
import { WIKI_MAP, WIKI_ORDER, type WikiCategoryKey } from "@/lib/mobile/ingredientWiki";

const CATEGORY_HERO_CLASS: Record<WikiCategoryKey, string> = {
  shampoo: "bg-[radial-gradient(circle_at_28%_22%,rgba(236,250,255,0.96),rgba(199,231,245,0.9)_42%,rgba(168,206,223,0.9)_72%,rgba(145,187,208,0.95)_100%)]",
  bodywash: "bg-[radial-gradient(circle_at_76%_18%,rgba(239,247,255,0.98),rgba(208,225,244,0.92)_45%,rgba(174,197,231,0.9)_74%,rgba(145,171,214,0.95)_100%)]",
  conditioner: "bg-[radial-gradient(circle_at_30%_14%,rgba(247,244,255,0.98),rgba(222,213,246,0.92)_44%,rgba(193,179,236,0.9)_74%,rgba(162,147,221,0.95)_100%)]",
  lotion: "bg-[radial-gradient(circle_at_20%_20%,rgba(255,250,238,0.98),rgba(248,232,202,0.93)_46%,rgba(238,211,168,0.9)_74%,rgba(220,189,144,0.95)_100%)]",
  cleanser: "bg-[radial-gradient(circle_at_26%_18%,rgba(241,252,255,0.99),rgba(210,235,244,0.92)_44%,rgba(175,211,227,0.9)_74%,rgba(145,189,209,0.95)_100%)]",
};

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
  const [items, setItems] = useState<IngredientLibraryListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const normalizedQuery = query.trim();

  useEffect(() => {
    let cancelled = false;

    fetchIngredientLibrary({
      category: active,
      q: normalizedQuery || undefined,
      limit: 120,
    })
      .then((resp) => {
        if (cancelled) return;
        setItems(resp.items);
      })
      .catch((e) => {
        if (cancelled) return;
        setItems([]);
        setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [active, normalizedQuery]);

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
              onChange={(e) => {
                const next = e.target.value;
                if (next.trim() !== normalizedQuery) {
                  setLoading(true);
                  setError(null);
                }
                setQuery(next);
              }}
              placeholder="搜索已生成成分"
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
                onClick={() => {
                  if (key !== active) {
                    setLoading(true);
                    setError(null);
                  }
                  setActive(key);
                }}
                className={`inline-flex h-9 items-center gap-2 rounded-full border px-3 text-[13px] transition-colors ${
                  activeTag
                    ? "border-black/85 bg-black text-white"
                    : "border-black/12 bg-white text-black/72 active:bg-black/[0.04]"
                }`}
              >
                <Image src={`/m/categories/${item.key}.png`} alt={item.label} width={20} height={20} className="h-5 w-5 rounded-full object-cover" />
                {item.label}
              </button>
            );
          })}
        </div>
      </section>

      <section className="mt-5 space-y-4">
        {items.map((item) => (
          <Link
            key={item.ingredient_id}
            href={`/m/wiki/${active}/${item.ingredient_id}`}
            className="block overflow-hidden rounded-[28px] border border-black/10 bg-white shadow-[0_14px_30px_rgba(0,0,0,0.06)] active:scale-[0.997]"
          >
            <div className={`${CATEGORY_HERO_CLASS[active]} relative h-[240px] w-full`}>
              <div className="absolute inset-0 bg-[linear-gradient(175deg,rgba(255,255,255,0.1)_0%,rgba(255,255,255,0.0)_30%,rgba(0,0,0,0.18)_100%)]" />
              <div className="absolute left-5 top-5 rounded-full border border-white/55 bg-white/65 px-3 py-1 text-[12px] font-semibold tracking-[0.04em] text-black/62 backdrop-blur-sm">
                {item.ingredient_id}
              </div>
              <div className="absolute bottom-5 left-5 right-5 text-white">
                <p className="text-[13px] font-medium tracking-[0.04em] text-white/85">{WIKI_MAP[active].label}</p>
                <h3 className="mt-1 text-[34px] leading-[1.06] font-semibold tracking-[-0.03em]">{item.ingredient_name}</h3>
              </div>
            </div>

            <div className="px-5 py-5">
              <p className="text-[13px] text-black/50">来源样本 {item.source_count} 条</p>
              <p className="mt-2 text-[19px] leading-[1.45] text-black/78">
                {item.summary || "该成分暂无 AI 摘要，请检查成分库构建流程。"}
              </p>
            </div>
          </Link>
        ))}

        {loading && <div className="rounded-2xl border border-black/10 bg-white px-4 py-5 text-[14px] text-black/55">正在加载真实成分数据...</div>}
        {error && <div className="rounded-2xl border border-red-300 bg-red-50 px-4 py-5 text-[14px] text-red-700">加载失败：{error}</div>}
        {!loading && !error && items.length === 0 && (
          <div className="rounded-2xl border border-black/10 bg-white px-4 py-5 text-[14px] text-black/55">当前分类暂无匹配成分，请先在后台构建成分库或更换关键词。</div>
        )}
      </section>
    </section>
  );
}
