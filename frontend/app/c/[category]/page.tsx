import Link from "next/link";
import Image from "next/image";
import { fetchProducts, imageUrl } from "@/lib/api";
import { CATEGORY_CONFIG, isCategoryKey } from "@/lib/catalog";

export default async function CategoryPage(props: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await props.params;

  if (!isCategoryKey(category)) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-16">
        <div className="text-white/60">Unknown category.</div>
        <Link href="/" className="mt-4 inline-block text-white underline">
          Back
        </Link>
      </main>
    );
  }

  const cfg = CATEGORY_CONFIG[category];
  const products = await fetchProducts();

  // 防御：cfg.apiCategory 一定存在；但仍做兜底避免你再遇到 undefined
  const apiCat = (cfg?.apiCategory || category || "").toLowerCase();
  const list = products.filter((p) => (p.category || "").toLowerCase() === apiCat);

  // 只主推一个：优先 featuredProductId，否则取该类第一个
  const featured = list.find((p) => p.id === cfg.featuredProductId) || list[0] || null;

  return (
    <main className="mx-auto max-w-6xl px-6 py-12 text-black">
      <div className="text-xs text-black/50">{cfg.zh}</div>
      <h1 className="mt-2 text-5xl font-semibold tracking-tight">{cfg.en}</h1>
      <p className="mt-3 text-sm text-black/60">{cfg.tagline}</p>

      <section className="mt-10 overflow-hidden rounded-[28px] border border-black/10 bg-white shadow-sm">
        <div className="grid md:grid-cols-2">
          <div className="relative aspect-[4/3] bg-neutral-50">
            {featured?.id ? (
              <Image
                src={imageUrl(featured.id)}
                alt={featured.name || cfg.en}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 50vw"
                priority
              />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-black/40">暂无图片</div>
            )}
          </div>

          <div className="p-8 md:p-10">
            <div className="text-xs uppercase tracking-widest text-black/40">{cfg.en}</div>
            <h2 className="mt-3 text-3xl font-semibold">{featured?.name || "未命名产品"}</h2>
            <p className="mt-3 text-sm leading-relaxed text-black/60">
              {featured?.one_sentence || "主推款：点击查看完整成分与分析。"}
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              {cfg.bullets.map((b) => (
                <span key={b} className="rounded-full border border-black/10 bg-black/[0.03] px-3 py-1 text-sm text-black/70">
                  {b}
                </span>
              ))}
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href={featured?.id ? `/products/${featured.id}` : "/"}
                className="rounded-full bg-black px-5 py-2.5 text-sm font-medium text-white hover:bg-black/90"
              >
                查看详情
              </Link>
              <Link
                href="/"
                className="rounded-full border border-black/15 bg-white px-5 py-2.5 text-sm font-medium text-black hover:bg-black/[0.03]"
              >
                返回橱窗
              </Link>
            </div>

            <p className="mt-6 text-xs text-black/40">MVP：每类只主推一款。</p>
          </div>
        </div>
      </section>
    </main>
  );
}