import Link from "next/link";
import Image from "next/image";
import { fetchProducts, resolveImageUrl } from "@/lib/api";
import { TOP_CATEGORIES, CATEGORY_CONFIG } from "@/lib/catalog";
import { BRAND } from "@/lib/brand";

function normalizeText(v?: string | null) {
  return (v ?? "").trim();
}

export default async function HomePage() {
  const products = await fetchProducts();

  return (
    <div className="container-apple">
      {/* Hero */}
      <section className="hero">
        <h1 className="hero__title">{BRAND.zhName}</h1>
        <p className="hero__subtitle">{BRAND.slogan}</p>
        <p className="hero__subline">{BRAND.heroSubline}</p>

        {/* Category rail */}
        <div className="hero__rail">
          {TOP_CATEGORIES.map((k) => (
            <Link key={k} href={`/c/${k}`} className="chip">
              {CATEGORY_CONFIG[k].zh}
            </Link>
          ))}
          <Link href="/compare" className="chip chip--ghost">
            横向对比
          </Link>
        </div>
      </section>

      {/* Grid */}
      <section className="grid">
        {products.map((p) => {
          const img = resolveImageUrl(p);
          return (
            <Link key={p.id} href={`/products/${p.id}`} className="card">
              <div className="card__media">
                <Image
                  src={img}
                  alt={normalizeText(p.name) || "product"}
                  fill
                  sizes="(max-width: 768px) 100vw, 33vw"
                  className="card__img"
                />
              </div>

              <div className="card__meta">
                <div className="card__brand">{normalizeText(p.brand)}</div>
                <div className="card__name">{normalizeText(p.name)}</div>
              </div>
            </Link>
          );
        })}
      </section>
    </div>
  );
}