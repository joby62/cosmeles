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

function featuredTitleClass(length: number): string {
  if (length > 56) return "text-[32px] leading-[1.06]";
  if (length > 34) return "text-[36px] leading-[1.04]";
  return "text-[42px] leading-[1.02]";
}

function summaryFocus(summary: string | null | undefined): string {
  const text = normalizeLine(summary || "");
  if (!text) return "暂无关键结论";
  const first = text.split(/[。！？!?.]/).map((part) => part.trim()).find(Boolean) || text;
  return first.length > 24 ? `${first.slice(0, 23)}…` : first;
}

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
        if (!cancelled) {
          setItems(resp.items);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setItems([]);
          setError(e instanceof Error ? e.message : String(e));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [active, normalizedQuery]);

  const featured = useMemo(() => items[0], [items]);
  const rest = useMemo(() => items.slice(1), [items]);
  const featuredName = useMemo(() => (featured ? splitIngredientName(featured.ingredient_name) : null), [featured]);

  return (
    <section className="m-wiki-page -mx-4 -mt-6 min-h-[calc(100dvh-3rem)] bg-[color:var(--m-wiki-canvas)] px-4 pb-36 pt-4 text-white">
      <div className="m-wiki-card rounded-[24px] p-3 backdrop-blur-xl">
        <form
          onSubmit={(e) => {
            e.preventDefault();
          }}
        >
          <div className="m-wiki-input-shell flex h-11 items-center rounded-2xl px-3 text-white/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]">
            <SearchIcon className="h-[17px] w-[17px] text-white/52" />
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
              className="ml-2.5 h-full w-full bg-transparent text-[16px] text-white/92 outline-none placeholder:text-white/36"
            />
            {query ? (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setLoading(true);
                  setError(null);
                }}
                className="m-pressable rounded-full bg-white/10 px-2.5 py-1 text-[12px] text-white/72 active:bg-white/18"
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
                  className={`m-pressable inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12px] transition-colors ${
                    activeTag
                      ? "border-white/36 bg-white/16 text-white"
                      : "border-white/12 bg-white/[0.03] text-white/72 active:bg-white/[0.08]"
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
        <div className="mb-3">
          <p className="m-wiki-kicker text-[14px] text-[#4ea0ff]">现已推出</p>
          <h1 className="mt-1 text-[34px] leading-[1.08] font-semibold tracking-[-0.03em]">成份百科</h1>
          <p className="mt-1 text-[15px] leading-[1.5] text-white/66">{WIKI_MAP[active].summary}</p>
        </div>

        {featured && featuredName ? (
          <Link
            href={`/m/wiki/${active}/${featured.ingredient_id}`}
            className="m-wiki-hero-card m-pressable block overflow-hidden rounded-[32px] transition-transform active:scale-[0.996]"
          >
            <div className={`${theme.heroClass} relative h-[252px] w-full`}>
              <div className={`absolute inset-0 ${theme.hazeClass}`} />
              <div className={`absolute right-[-42px] top-[-36px] h-[170px] w-[170px] rounded-full ${theme.accentClass} opacity-30 blur-3xl`} />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.16)_0%,rgba(255,255,255,0)_35%,rgba(0,0,0,0.42)_100%)]" />

              <Image
                src={`/m/categories/${active}.png`}
                alt={WIKI_MAP[active].label}
                width={128}
                height={128}
                className="absolute right-6 top-8 h-[96px] w-[96px] rounded-[28px] object-cover opacity-85 shadow-[0_16px_36px_rgba(0,0,0,0.25)] ring-1 ring-white/25"
              />

              <div className="absolute left-5 top-5 rounded-full border border-white/35 bg-white/10 px-2.5 py-0.5 text-[12px] font-medium text-white/86 backdrop-blur-lg">
                {WIKI_MAP[active].label}
              </div>

              <div className="absolute bottom-5 left-5 right-5">
                <p className="m-wiki-kicker text-[13px] text-white/82">必备精选</p>
                <h2 className={`mt-1 line-clamp-2 break-words font-semibold tracking-[-0.03em] text-white ${featuredTitleClass(featured.ingredient_name.length)}`}>
                  {featuredName.main}
                </h2>
                {featuredName.sub ? <p className="mt-1 line-clamp-1 text-[17px] leading-[1.1] font-semibold text-white/92">{featuredName.sub}</p> : null}
              </div>
            </div>

            <div className="flex items-center gap-3 border-t border-white/10 bg-black/34 px-4 py-3 backdrop-blur-2xl">
              <div className="min-w-0 flex-1">
                <p className="m-wiki-kicker text-[11px] text-white/55">一句话重点</p>
                <p className="mt-1 line-clamp-1 text-[15px] font-semibold text-white/90">{summaryFocus(featured.summary)}</p>
                <p className="mt-1 text-[12px] text-white/60">来源样本 {featured.source_count} 条</p>
              </div>
              <span className="inline-flex h-10 items-center rounded-full bg-white/18 px-4 text-[18px] font-semibold text-white">查看</span>
            </div>
          </Link>
        ) : null}
      </section>

      <section className="mt-4 space-y-4">
        {rest.map((item) => {
          const name = splitIngredientName(item.ingredient_name);
          return (
            <Link
              key={item.ingredient_id}
              href={`/m/wiki/${active}/${item.ingredient_id}`}
              className="m-wiki-hero-card m-pressable block overflow-hidden rounded-[28px] transition-transform active:scale-[0.997]"
            >
              <div className={`${theme.heroClass} relative h-[164px] w-full`}>
                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.13)_0%,rgba(255,255,255,0)_28%,rgba(0,0,0,0.4)_100%)]" />
                <Image
                  src={`/m/categories/${active}.png`}
                  alt={WIKI_MAP[active].label}
                  width={64}
                  height={64}
                  className="absolute right-4 top-3 h-12 w-12 rounded-2xl object-cover opacity-78 ring-1 ring-white/22"
                />
                <div className="absolute left-4 top-4 rounded-full border border-white/30 bg-white/10 px-2.5 py-0.5 text-[11px] font-medium text-white/82 backdrop-blur-md">
                  {WIKI_MAP[active].label}
                </div>
                <div className="absolute bottom-3 left-4 right-4">
                  <h3 className="line-clamp-2 break-words text-[26px] leading-[1.08] font-semibold tracking-[-0.02em] text-white">{name.main}</h3>
                  {name.sub ? <p className="mt-0.5 line-clamp-1 text-[15px] leading-[1.15] font-medium text-white/90">{name.sub}</p> : null}
                </div>
              </div>

              <div className="px-4 py-3">
                <p className="m-wiki-kicker text-[11px] text-white/54">一句话重点</p>
                <p className="mt-1 line-clamp-1 text-[15px] font-semibold text-white/88">{summaryFocus(item.summary)}</p>
                <p className="mt-1.5 text-[12px] text-white/56">来源样本 {item.source_count} 条</p>
              </div>
            </Link>
          );
        })}

        {loading && (
          <div className="m-wiki-card-soft rounded-[24px] px-4 py-5 text-[14px] text-white/65">
            正在加载真实成分数据...
          </div>
        )}

        {error && (
          <div className="rounded-[24px] border border-[#ff8f8f]/45 bg-[#ff5f5f]/10 px-4 py-5 text-[14px] text-[#ffd3d3]">
            加载失败：{error}
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <div className="m-wiki-card-soft rounded-[24px] px-4 py-5 text-[14px] text-white/65">
            当前分类暂无匹配成分，请先在后台构建成分库或更换关键词。
          </div>
        )}
      </section>
    </section>
  );
}
