import { fetchProducts, resolveImageUrl } from "@/lib/api";
import Image from "next/image";
import Link from "next/link";
import { CATEGORY_CONFIG } from "@/lib/catalog";

type Params = { category: string };

export default async function CategoryPage({
  params,
}: {
  params: Params | Promise<Params>;
}) {
  // ✅ 兼容：Next 可能传对象，也可能传 Promise
  const { category } = await Promise.resolve(params);

  const products = await fetchProducts();
  const filtered = products.filter((p) => p.category === category);

  const title =
    CATEGORY_CONFIG[category as keyof typeof CATEGORY_CONFIG]?.zh ?? category;

  return (
    <main className="min-h-screen px-6 pt-14 pb-16">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
          {title}
        </h1>

        <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
          {filtered.map((p) => (
            <Link key={p.id} href={`/product/${p.id}`} className="group block">
              <div className="relative aspect-square bg-black/5 border border-black/10 overflow-hidden">
                <Image
                  src={resolveImageUrl(p)}
                  alt={p.name}
                  fill
                  className="object-contain transition-transform duration-500 group-hover:scale-[1.02]"
                />
              </div>
              <div className="mt-4">
                <div className="text-xs text-black/60">{p.brand ?? ""}</div>
                <div className="mt-1 text-base font-medium tracking-tight text-black/90">
                  {p.name}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
