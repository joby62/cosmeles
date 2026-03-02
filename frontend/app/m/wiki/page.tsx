"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { fetchIngredientLibrary, type IngredientLibraryListItem } from "@/lib/api";
import { WIKI_MAP, WIKI_ORDER, type WikiCategoryKey } from "@/lib/mobile/ingredientWiki";

type CategoryTheme = {
  heroClass: string;
  hazeClass: string;
  accentClass: string;
};

const CATEGORY_THEME: Record<WikiCategoryKey, CategoryTheme> = {
  shampoo: {
    heroClass:
      "bg-[radial-gradient(circle_at_24%_20%,rgba(235,250,255,0.94),rgba(184,222,238,0.88)_44%,rgba(138,186,210,0.93)_100%)]",
    hazeClass: "bg-[radial-gradient(circle_at_70%_78%,rgba(18,55,86,0.46),rgba(10,20,36,0)_64%)]",
    accentClass: "bg-[#8fd3f2]",
  },
  bodywash: {
    heroClass:
      "bg-[radial-gradient(circle_at_72%_20%,rgba(239,247,255,0.94),rgba(191,210,244,0.88)_42%,rgba(122,146,214,0.93)_100%)]",
    hazeClass: "bg-[radial-gradient(circle_at_20%_82%,rgba(32,41,98,0.44),rgba(10,20,36,0)_64%)]",
    accentClass: "bg-[#9fb5ff]",
  },
  conditioner: {
    heroClass:
      "bg-[radial-gradient(circle_at_20%_18%,rgba(248,244,255,0.95),rgba(214,198,246,0.9)_44%,rgba(154,132,220,0.93)_100%)]",
    hazeClass: "bg-[radial-gradient(circle_at_70%_80%,rgba(56,24,102,0.46),rgba(10,20,36,0)_64%)]",
    accentClass: "bg-[#bea1ff]",
  },
  lotion: {
    heroClass:
      "bg-[radial-gradient(circle_at_26%_20%,rgba(255,248,232,0.95),rgba(245,219,170,0.9)_45%,rgba(217,167,95,0.93)_100%)]",
    hazeClass: "bg-[radial-gradient(circle_at_72%_82%,rgba(90,56,18,0.42),rgba(10,20,36,0)_64%)]",
    accentClass: "bg-[#e7bd72]",
  },
  cleanser: {
    heroClass:
      "bg-[radial-gradient(circle_at_26%_18%,rgba(241,252,255,0.95),rgba(187,223,236,0.89)_44%,rgba(117,176,205,0.93)_100%)]",
    hazeClass: "bg-[radial-gradient(circle_at_74%_82%,rgba(18,70,87,0.44),rgba(10,20,36,0)_64%)]",
    accentClass: "bg-[#87c7dd]",
  },
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
  const theme = CATEGORY_THEME[active];

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

  const featured = useMemo(() => items[0], [items]);
  const rest = useMemo(() => items.slice(1), [items]);

  return (
    <section className="-mx-4 -mt-6 min-h-[calc(100dvh-3rem)] bg-[#0b0d12] px-4 pb-28 pt-4 text-white">
      <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-3 shadow-[0_20px_45px_rgba(0,0,0,0.35)] backdrop-blur-xl">
        <form
          onSubmit={(e) => {
            e.preventDefault();
          }}
        >
          <div className="flex h-11 items-center rounded-2xl border border-white/10 bg-white/[0.08] px-3 text-white/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]">
            <SearchIcon className="h-[17px] w-[17px] text-white/55" />
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
              placeholder="搜索成分名称"
              className="ml-2.5 h-full w-full bg-transparent text-[16px] text-white/92 outline-none placeholder:text-white/38"
            />
            {query ? (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setLoading(true);
                  setError(null);
                }}
                className="rounded-full bg-white/10 px-2.5 py-1 text-[12px] text-white/72 active:bg-white/20"
              >
                清除
              </button>
            ) : null}
          </div>
        </form>

        <section className="mt-3 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex min-w-max gap-2">
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
                  className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12px] transition-colors ${
                    activeTag
                      ? "border-white/35 bg-white/16 text-white"
                      : "border-white/12 bg-white/[0.03] text-white/70 active:bg-white/[0.09]"
                  }`}
                >
                  <Image src={`/m/categories/${item.key}.png`} alt={item.label} width={18} height={18} className="h-[18px] w-[18px] rounded-full object-cover" />
                  {item.label}
                </button>
              );
            })}
          </div>
        </section>
      </div>

      <section className="mt-6">
        <div className="mb-3 flex items-end justify-between">
          <div>
            <p className="text-[14px] font-medium text-[#4ea0ff]">现已推出</p>
            <h1 className="mt-1 text-[34px] leading-[1.08] font-semibold tracking-[-0.03em]">成份百科</h1>
            <p className="mt-1 text-[15px] leading-[1.5] text-white/66">{WIKI_MAP[active].summary}</p>
          </div>
        </div>

        {featured ? (
          <Link
            href={`/m/wiki/${active}/${featured.ingredient_id}`}
            className="block overflow-hidden rounded-[32px] border border-white/12 bg-[#121722] shadow-[0_26px_60px_rgba(0,0,0,0.5)] transition-transform active:scale-[0.996]"
          >
            <div className={`${theme.heroClass} relative h-[340px] w-full`}>
              <div className={`absolute inset-0 ${theme.hazeClass}`} />
              <div className="absolute inset-0 bg-[linear-gradient(178deg,rgba(255,255,255,0.18)_0%,rgba(255,255,255,0.0)_35%,rgba(0,0,0,0.36)_100%)]" />

              <div className="absolute left-5 top-5 inline-flex items-center rounded-full border border-white/35 bg-black/20 px-3 py-1 text-[12px] font-semibold tracking-[0.03em] text-white/92 backdrop-blur-xl">
                {featured.ingredient_id}
              </div>

              <div className="absolute left-5 top-16 rounded-full border border-white/35 bg-white/10 px-2.5 py-0.5 text-[12px] font-medium text-white/84 backdrop-blur-lg">
                {WIKI_MAP[active].label}
              </div>

              <div className="absolute bottom-6 left-5 right-5">
                <p className="text-[13px] font-medium tracking-[0.04em] text-white/84">必备精选</p>
                <h2 className="mt-1 text-[44px] leading-[0.98] font-semibold tracking-[-0.04em] text-white">{featured.ingredient_name}</h2>
              </div>
            </div>

            <div className="flex items-center gap-3 border-t border-white/10 bg-black/35 px-4 py-3 backdrop-blur-2xl">
              <Image src={`/m/categories/${active}.png`} alt={WIKI_MAP[active].label} width={44} height={44} className="h-11 w-11 rounded-xl object-cover ring-1 ring-white/18" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[18px] font-semibold tracking-[-0.015em] text-white/95">{featured.ingredient_name}</p>
                <p className="truncate text-[13px] text-white/62">来源样本 {featured.source_count} 条</p>
              </div>
              <span className="inline-flex h-10 items-center rounded-full bg-white/18 px-4 text-[18px] font-semibold text-white">查看</span>
            </div>
          </Link>
        ) : null}
      </section>

      <section className="mt-4 space-y-4">
        {rest.map((item, idx) => (
          <Link
            key={item.ingredient_id}
            href={`/m/wiki/${active}/${item.ingredient_id}`}
            className="block overflow-hidden rounded-[30px] border border-white/10 bg-[#121722] shadow-[0_20px_44px_rgba(0,0,0,0.36)] transition-transform active:scale-[0.997]"
          >
            <div className={`${theme.heroClass} relative h-[210px] w-full`}>
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.14)_0%,rgba(255,255,255,0.0)_34%,rgba(0,0,0,0.34)_100%)]" />
              <div className={`absolute right-[-40px] top-[-36px] h-[130px] w-[130px] rounded-full ${theme.accentClass} opacity-40 blur-3xl`} />

              <div className="absolute left-4 top-4 rounded-full border border-white/35 bg-black/20 px-2.5 py-1 text-[11px] font-semibold text-white/88 backdrop-blur-lg">
                #{idx + 2}
              </div>

              <div className="absolute bottom-5 left-4 right-4">
                <h3 className="text-[34px] leading-[1.03] font-semibold tracking-[-0.035em] text-white">{item.ingredient_name}</h3>
              </div>
            </div>

            <div className="px-4 py-4">
              <p className="line-clamp-2 text-[16px] leading-[1.5] text-white/84">
                {item.summary || "该成分暂无 AI 摘要，请检查成分库构建流程。"}
              </p>
              <p className="mt-2 text-[12px] text-white/56">来源样本 {item.source_count} 条</p>
            </div>
          </Link>
        ))}

        {loading && (
          <div className="rounded-[24px] border border-white/10 bg-white/[0.05] px-4 py-5 text-[14px] text-white/65">
            正在加载真实成分数据...
          </div>
        )}

        {error && (
          <div className="rounded-[24px] border border-[#ff8f8f]/45 bg-[#ff5f5f]/10 px-4 py-5 text-[14px] text-[#ffd3d3]">
            加载失败：{error}
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <div className="rounded-[24px] border border-white/10 bg-white/[0.05] px-4 py-5 text-[14px] text-white/65">
            当前分类暂无匹配成分，请先在后台构建成分库或更换关键词。
          </div>
        )}
      </section>
    </section>
  );
}
