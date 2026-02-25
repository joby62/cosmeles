import Link from "next/link";
import Image from "next/image";
import { fetchProducts, resolveImageUrl } from "@/lib/api";
import { TOP_CATEGORIES, CATEGORY_CONFIG } from "@/lib/catalog";

function normalizeText(v?: string | null) {
  return (v ?? "").trim();
}

export default async function HomePage() {
  const products = await fetchProducts();

  return (
    <main className="min-h-screen">
      {/* Hero */}
      <section className="px-6 pt-16 pb-10">
        <div className="mx-auto max-w-5xl">
          <h1 className="text-4xl md:text-6xl font-semibold tracking-tight">
            Cosmeles
          </h1>
          <p className="mt-4 text-base md:text-lg text-white/70 max-w-2xl">
            以 Apple 式的克制美学，做一个“洗护选购”的极简橱窗。
          </p>
        </div>
      </section>

      {/* Category rail */}
      <section className="px-6 pb-8">
        <div className="mx-auto max-w-5xl flex items-center gap-3 flex-wrap">
          {TOP_CATEGORIES.map((k) => (
            <Link
              key={k}
              href={`/c/${k}`}
              className="rounded-full border border-white/15 px-4 py-2 text-xs text-white/85 hover:text-white hover:border-white/30 transition"
            >
              {CATEGORY_CONFIG[k].zh}
            </Link>
          ))}
          <Link
            href="/compare"
            className="rounded-full border border-white/15 px-4 py-2 text-xs text-white/85 hover:text-white hover:border-white/30 transition"
          >
            横向对比
          </Link>
        </div>
      </section>

      {/* Grid */}
      <section className="px-6 pb-16">
        <div className="mx-auto max-w-5xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10">
          {products.map((p) => (
            <Link
              key={p.id}
              href={`/products/${p.id}`}
              className="group block"
            >
              <div className="relative aspect-square bg-white/5 border border-white/10 overflow-hidden">
                <Image
                  src={resolveImageUrl(p)}
                  alt={normalizeText(p.name) || "product"}
                  fill
                  className="object-contain transition-transform duration-500 group-hover:scale-[1.02]"
                />
              </div>

              <div className="mt-4">
                <div className="text-sm text-white/60">
                  {normalizeText(p.brand)}
                </div>
                <div className="mt-1 text-base font-medium tracking-tight">
                  {normalizeText(p.name)}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}