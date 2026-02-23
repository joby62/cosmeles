import Link from "next/link";
import Image from "next/image";
import { fetchProducts, imageUrl } from "@/lib/api";
import { TOP_CATEGORIES, CATEGORY_CONFIG } from "@/lib/catalog";

function normalizeText(v?: string | null) {
  if (!v) return "";
  return v.replace(/\s+/g, " ").trim();
}

export default async function HomePage() {
  const products = await fetchProducts();

  // 为每个品类选出“主推产品”：优先用你指定的 featuredProductId，若缺失则 fallback 为同 category 第一条
  const featuredByKey = Object.fromEntries(
    TOP_CATEGORIES.map((k) => {
      const cfg = CATEGORY_CONFIG[k];
      const byId = products.find((p) => p.id === cfg.featuredProductId);
      const byCat = products.find((p) => (p.category || "").toLowerCase() === cfg.apiCategory.toLowerCase());
      return [k, byId || byCat || null] as const;
    })
  ) as Record<(typeof TOP_CATEGORIES)[number], any | null>;

  return (
    <main className="bg-black">
      {/* Apple-like hero rail */}
      <section className="mx-auto max-w-6xl px-6 pt-10">
        <div className="text-white/60 text-sm">Cosmeles</div>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight md:text-6xl">选购橱窗</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/60">
          每个品类只推荐一款：图大、信息少，点开才看完整成分与分析。
        </p>

        <div className="mt-6 flex flex-wrap gap-2">
          {TOP_CATEGORIES.map((k) => (
            <Link
              key={k}
              href={`/c/${k}`}
              className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm text-white/80 hover:bg-white/10"
            >
              {CATEGORY_CONFIG[k].zh}
            </Link>
          ))}
        </div>
      </section>

      {/* Full-bleed sections (one screen each) */}
      <section
        className="mt-10 h-[calc(100vh-72px)] overflow-y-auto scroll-smooth"
        style={{
          scrollSnapType: "y mandatory",
        }}
      >
        {TOP_CATEGORIES.map((k) => {
          const cfg = CATEGORY_CONFIG[k];
          const p = featuredByKey[k];
          const title = p?.name ? normalizeText(p.name) : cfg.zh;
          const brand = p?.brand ? normalizeText(p.brand) : "Cosmeles";
          const one = p?.one_sentence ? normalizeText(p.one_sentence) : cfg.tagline;

          const href = p?.id ? `/products/${p.id}` : `/c/${k}`;

          return (
            <article
              key={k}
              className="relative flex h-[calc(100vh-72px)] items-center justify-center"
              style={{ scrollSnapAlign: "start" }}
            >
              {/* background image */}
              <div className="absolute inset-0">
                {p?.id ? (
                  <Image
                    src={imageUrl(p.id)}
                    alt={title}
                    fill
                    priority
                    className="object-cover"
                    sizes="100vw"
                  />
                ) : (
                  <div className="h-full w-full bg-gradient-to-b from-white/10 to-black" />
                )}

                {/* vignette / overlay */}
                <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-black/40 to-black/70" />
              </div>

              {/* content */}
              <div className="relative mx-auto w-full max-w-6xl px-6">
                <div className="max-w-2xl">
                  <div className="text-xs uppercase tracking-widest text-white/60">{cfg.en}</div>
                  <h2 className="mt-3 text-5xl font-semibold tracking-tight md:text-6xl">{title}</h2>
                  <p className="mt-3 text-sm text-white/70">{brand}</p>
                  <p className="mt-4 max-w-xl text-base leading-relaxed text-white/75">{one}</p>

                  <div className="mt-6 flex flex-wrap gap-2">
                    {cfg.bullets.slice(0, 3).map((b) => (
                      <span
                        key={b}
                        className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-sm text-white/80"
                      >
                        {b}
                      </span>
                    ))}
                  </div>

                  <div className="mt-8 flex flex-wrap gap-3">
                    <Link
                      href={href}
                      className="rounded-full bg-white px-5 py-2.5 text-sm font-medium text-black hover:bg-white/90"
                    >
                      查看详情
                    </Link>
                    <Link
                      href={`/c/${k}`}
                      className="rounded-full border border-white/25 bg-black/20 px-5 py-2.5 text-sm font-medium text-white hover:bg-white/10"
                    >
                      进入品类
                    </Link>
                  </div>

                  <p className="mt-6 text-xs text-white/45">
                    提示：向下滚动/触控板滑动，一屏一品类（scroll-snap）。
                  </p>
                </div>
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}