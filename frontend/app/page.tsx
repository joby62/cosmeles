import Link from "next/link";
import Image from "next/image";
import { fetchProducts, resolveImageUrl } from "@/lib/api";
import { TOP_CATEGORIES, CATEGORY_CONFIG } from "@/lib/catalog";

function t(v?: string | null) {
  return (v ?? "").trim();
}

export default async function HomePage() {
  const products = await fetchProducts();

  return (
    <main>
      <section className="hero">
        <div className="container-apple">
          <h1 className="hero__h1">Cosmeles</h1>
          <p className="hero__sub">
            以 Apple 式的克制美学，做一个“洗护选购”的极简橱窗。
          </p>

          <div style={{ marginTop: 18, display: "flex", gap: 10, flexWrap: "wrap" }}>
            {TOP_CATEGORIES.map((k) => (
              <Link key={k} href={`/c/${k}`} className="btn-apple">
                {CATEGORY_CONFIG[k].zh}
              </Link>
            ))}
            <Link href="/compare" className="btn-apple">
              横向对比
            </Link>
          </div>
        </div>
      </section>

      <section style={{ paddingBottom: 56 }}>
        <div className="container-apple">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(12, 1fr)",
              gap: 22,
            }}
          >
            {products.map((p) => (
              <Link
                key={p.id}
                href={`/products/${p.id}`}
                className="group"
                style={{
                  gridColumn: "span 12",
                  textDecoration: "none",
                }}
              >
                <div className="card-apple">
                  <div className="card-apple__media">
                    <Image
                      src={resolveImageUrl(p)}
                      alt={t(p.name) || "product"}
                      fill
                      className="object-contain transition-transform duration-500 group-hover:scale-[1.02]"
                    />
                  </div>
                </div>

                <div className="card-apple__meta">
                  <div className="card-apple__brand">{t(p.brand)}</div>
                  <div className="card-apple__name">{t(p.name)}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Responsive columns without fighting tailwind */}
      <style>{`
        @media (min-width: 640px) {
          a.group { grid-column: span 6; }
        }
        @media (min-width: 1024px) {
          a.group { grid-column: span 4; }
        }
      `}</style>
    </main>
  );
}